import type { Lead } from "@prisma/client";

export type GenerateWebsiteInput = {
  lead: Pick<
    Lead,
    | "name"
    | "category"
    | "phone"
    | "address"
    | "city"
    | "country"
    | "rating"
    | "reviewsCount"
  >;
  style?: "modern" | "classic" | "bold";
  extraInstructions?: string;
};

export type GenerateWebsiteResult = {
  html: string;
  css: string;
  model: string;
  prompt: string;
};

const GEMINI_BACKOFF_MS = 10 * 60 * 1000;
let geminiBackoffUntil = 0;

const SYSTEM_PROMPT = `You are an expert web designer. Generate a complete, production-ready website for a small local business as TWO SEPARATE FILES (HTML + CSS).

Return STRICT JSON with exactly two keys:
  - "html": the full index.html (must link the stylesheet via <link rel="stylesheet" href="style.css">). NO inline <style> blocks. NO inline style="" attributes (allowed only on Google Maps iframe if needed).
  - "css": the full style.css content. Modern, clean, responsive (CSS variables, flex/grid, mobile-first). Includes all needed selectors used by the HTML.

Requirements for the HTML:
- Starts with <!DOCTYPE html>. Includes <html lang="tr">.
- Sections: header/nav, hero, about, services, gallery (CSS-shape placeholders), testimonials, contact (with phone/address/Google Maps embed iframe if address available), footer.
- Semantic HTML5. Accessible (alt, aria where useful). Open Graph meta tags.
- Subtle scroll-fade animation via a small inline <script> using IntersectionObserver (this script is allowed inline).
- Language: Turkish content.
- No external CSS/JS frameworks. No external image URLs. Use CSS gradients/shapes for visuals.

Do NOT wrap the JSON in markdown fences. Do NOT add any commentary.`;

function buildUserPrompt(input: GenerateWebsiteInput): string {
  const { lead, style = "modern", extraInstructions } = input;
  return [
    `Business: ${lead.name}`,
    `Category: ${lead.category ?? "Yerel işletme"}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.address ? `Address: ${lead.address}` : null,
    lead.city ? `City: ${lead.city}` : null,
    lead.country ? `Country: ${lead.country}` : null,
    lead.rating ? `Rating: ${lead.rating} (${lead.reviewsCount ?? 0} reviews)` : null,
    `Style: ${style}`,
    extraInstructions ? `Extra: ${extraInstructions}` : null,
    "",
    "Generate the full HTML now.",
  ]
    .filter(Boolean)
    .join("\n");
}

function stripHtmlFences(text: string): string {
  return text
    .replace(/^```(?:html|json)?\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function isGeminiResourceExhausted(status: number, body: string): boolean {
  if (status !== 429) return false;
  return /RESOURCE_EXHAUSTED|prepayment credits are depleted/i.test(body);
}

function shouldSkipGeminiForNow(): boolean {
  return Date.now() < geminiBackoffUntil;
}

/**
 * Extracts <style>…</style> blocks from HTML and returns the cleaned HTML
 * (with a <link rel="stylesheet" href="style.css"> in <head>) plus the
 * concatenated CSS. Used as a safety net when the model returns inline CSS.
 */
function splitInlineStyle(rawHtml: string): { html: string; css: string } {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const cssParts: string[] = [];
  const html = rawHtml.replace(styleRegex, (_m, body) => {
    cssParts.push(String(body).trim());
    return "";
  });
  const css = cssParts.join("\n\n").trim();
  if (!css) return { html: rawHtml, css: "" };
  // Inject link tag if missing.
  let withLink = html;
  if (!/href="style\.css"/i.test(withLink)) {
    if (/<\/head>/i.test(withLink)) {
      withLink = withLink.replace(
        /<\/head>/i,
        `<link rel="stylesheet" href="style.css" />\n</head>`,
      );
    } else {
      withLink = `<link rel="stylesheet" href="style.css" />\n` + withLink;
    }
  }
  return { html: withLink, css };
}

/**
 * Calls Google Gemini to generate a website.
 * Falls back to a high-quality template if no key is configured or the call fails.
 *
 * Env:
 *   GEMINI_API_KEY  — Google AI Studio key
 *   GEMINI_MODEL    — default: gemini-2.0-flash
 */
export async function generateWebsite(
  input: GenerateWebsiteInput,
): Promise<GenerateWebsiteResult> {
  const prompt = buildUserPrompt(input);
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const forceTemplate = process.env.GEMINI_FORCE_TEMPLATE === "true";

  if (geminiKey && !forceTemplate && !shouldSkipGeminiForNow()) {
    try {
      const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            role: "system",
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 16384,
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                html: { type: "string" },
                css: { type: "string" },
              },
              required: ["html", "css"],
            },
          },
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        if (isGeminiResourceExhausted(res.status, body)) {
          geminiBackoffUntil = Date.now() + GEMINI_BACKOFF_MS;
          throw new Error("Gemini kredi limiti dolu (RESOURCE_EXHAUSTED)");
        }
        throw new Error(`Gemini ${res.status}: ${body}`);
      }
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const raw = parts.map((p: { text?: string }) => p.text ?? "").join("");
      const cleaned = stripHtmlFences(raw);
      let html = "";
      let css = "";
      try {
        const parsed = JSON.parse(cleaned);
        html = String(parsed.html ?? "").trim();
        css = String(parsed.css ?? "").trim();
      } catch {
        // Model didn't comply with JSON; treat as raw HTML and split.
        const split = splitInlineStyle(cleaned);
        html = split.html;
        css = split.css;
      }
      if (!html.toLowerCase().includes("<!doctype")) {
        throw new Error("Gemini returned no HTML");
      }
      // Extra safety: if html still has inline <style>, lift it out.
      if (/<style[^>]*>/i.test(html)) {
        const split = splitInlineStyle(html);
        html = split.html;
        css = (css ? css + "\n\n" : "") + split.css;
      }
      return {
        html,
        css,
        model: `gemini:${model}`,
        prompt,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[ai] Gemini kullanılamadı (${message}), template kullanılacak.`);
    }
  }

  // Fallback template — single inline-styled HTML, then split.
  const fallback = renderTemplate(input);
  const split = splitInlineStyle(fallback);
  return {
    html: split.html,
    css: split.css,
    model: "template",
    prompt,
  };
}

function renderTemplate(input: GenerateWebsiteInput): string {
  const { lead } = input;
  const safe = (s: string | null | undefined, def = "") =>
    (s ?? def).replace(/[<>"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const name = safe(lead.name, "İşletme");
  const category = safe(lead.category, "Yerel İşletme");
  const phone = safe(lead.phone);
  const phoneHref = (lead.phone ?? "").replace(/\s+/g, "");
  const address = safe(lead.address);
  const city = safe(lead.city);
  const fullAddress = [address, city].filter(Boolean).join(", ");
  const mapsQ = encodeURIComponent(fullAddress || name);
  const rating = lead.rating ?? 4.8;
  const reviews = lead.reviewsCount ?? 25;

  // Pick gradient based on category hash
  const palettes = [
    { from: "#0f172a", to: "#1e40af", accent: "#38bdf8" },
    { from: "#7c2d12", to: "#ea580c", accent: "#fbbf24" },
    { from: "#064e3b", to: "#059669", accent: "#34d399" },
    { from: "#581c87", to: "#a21caf", accent: "#f0abfc" },
    { from: "#831843", to: "#db2777", accent: "#fbcfe8" },
  ];
  const seed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const p = palettes[seed % palettes.length];

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name} — ${category}</title>
<meta name="description" content="${name} — ${category}${city ? `, ${city}` : ""}. Profesyonel hizmet, müşteri memnuniyeti odaklı yaklaşım." />
<meta property="og:title" content="${name}" />
<meta property="og:description" content="${category}${city ? ` · ${city}` : ""}" />
<meta property="og:type" content="website" />
<style>
  :root {
    --bg: #0a0a0b;
    --surface: #111114;
    --text: #f5f5f7;
    --muted: #a1a1aa;
    --primary: ${p.accent};
    --grad-from: ${p.from};
    --grad-to: ${p.to};
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: var(--bg); color: var(--text); line-height: 1.6;
  }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
  /* Nav */
  nav { position: sticky; top: 0; z-index: 50; background: rgba(10,10,11,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.06); }
  nav .container { display: flex; align-items: center; justify-content: space-between; height: 70px; }
  .logo { font-weight: 700; font-size: 1.25rem; letter-spacing: -0.02em; }
  .logo span { color: var(--primary); }
  nav ul { display: flex; gap: 2rem; list-style: none; }
  nav a { color: var(--text); text-decoration: none; font-size: 0.95rem; opacity: 0.8; transition: opacity .2s; }
  nav a:hover { opacity: 1; }
  .cta-btn { background: var(--primary); color: #000 !important; padding: 0.6rem 1.25rem; border-radius: 999px; font-weight: 600; opacity: 1 !important; }
  /* Hero */
  .hero { position: relative; padding: 8rem 0 6rem; overflow: hidden; }
  .hero::before { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, var(--grad-from) 0%, var(--grad-to) 100%); opacity: 0.6; z-index: -2; }
  .hero::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1), transparent 50%); z-index: -1; }
  .hero h1 { font-size: clamp(2.5rem, 6vw, 5rem); line-height: 1.05; letter-spacing: -0.03em; font-weight: 800; max-width: 900px; }
  .hero h1 em { font-style: normal; background: linear-gradient(90deg, var(--primary), #fff); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .hero p { font-size: 1.25rem; color: var(--muted); margin-top: 1.5rem; max-width: 600px; }
  .hero-actions { margin-top: 2.5rem; display: flex; gap: 1rem; flex-wrap: wrap; }
  .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.9rem 1.75rem; border-radius: 999px; text-decoration: none; font-weight: 600; transition: transform .15s, box-shadow .15s; }
  .btn-primary { background: var(--primary); color: #000; }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 32px ${p.accent}44; }
  .btn-ghost { background: rgba(255,255,255,0.08); color: var(--text); border: 1px solid rgba(255,255,255,0.15); }
  .btn-ghost:hover { background: rgba(255,255,255,0.14); }
  .rating { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 2rem; padding: 0.5rem 1rem; background: rgba(255,255,255,0.06); border-radius: 999px; font-size: 0.9rem; }
  .stars { color: #fbbf24; letter-spacing: 2px; }
  /* Sections */
  section { padding: 6rem 0; }
  .section-title { font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -0.02em; font-weight: 700; margin-bottom: 1rem; }
  .section-sub { color: var(--muted); font-size: 1.1rem; margin-bottom: 3rem; max-width: 600px; }
  /* About */
  .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
  @media (max-width: 768px) { .about-grid { grid-template-columns: 1fr; } }
  .about-visual { aspect-ratio: 4/5; border-radius: 24px; background: linear-gradient(135deg, var(--grad-from), var(--grad-to)); position: relative; overflow: hidden; }
  .about-visual::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 70% 20%, rgba(255,255,255,0.3), transparent 50%); }
  /* Services */
  .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
  .service { background: var(--surface); padding: 2rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.06); transition: border-color .2s, transform .2s; }
  .service:hover { border-color: var(--primary); transform: translateY(-4px); }
  .service-icon { width: 50px; height: 50px; background: linear-gradient(135deg, var(--grad-from), var(--grad-to)); border-radius: 14px; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
  .service h3 { font-size: 1.25rem; margin-bottom: 0.5rem; }
  .service p { color: var(--muted); font-size: 0.95rem; }
  /* Gallery */
  .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .gallery-item { aspect-ratio: 1; border-radius: 16px; background: linear-gradient(135deg, var(--grad-from), var(--grad-to)); position: relative; overflow: hidden; }
  .gallery-item:nth-child(2n) { background: linear-gradient(135deg, var(--grad-to), var(--grad-from)); }
  .gallery-item::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2), transparent 60%); }
  /* Testimonials */
  .testimonials { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
  .testimonial { background: var(--surface); padding: 2rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.06); }
  .testimonial p { font-style: italic; margin-bottom: 1.5rem; }
  .testimonial-author { display: flex; align-items: center; gap: 0.75rem; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--grad-from), var(--grad-to)); }
  /* Contact */
  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; }
  @media (max-width: 768px) { .contact-grid { grid-template-columns: 1fr; } }
  .contact-info { display: flex; flex-direction: column; gap: 1.5rem; }
  .contact-row { display: flex; align-items: flex-start; gap: 1rem; padding: 1.25rem; background: var(--surface); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); }
  .contact-row strong { display: block; margin-bottom: 0.25rem; }
  .contact-row span { color: var(--muted); font-size: 0.95rem; }
  iframe { width: 100%; height: 400px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); filter: invert(0.9) hue-rotate(180deg); }
  /* Footer */
  footer { padding: 3rem 0; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; color: var(--muted); font-size: 0.9rem; }
  /* Animations */
  .fade-in { opacity: 0; transform: translateY(20px); transition: opacity .8s, transform .8s; }
  .fade-in.visible { opacity: 1; transform: translateY(0); }
</style>
</head>
<body>
<nav>
  <div class="container">
    <div class="logo">${name.split(" ")[0]}<span>.</span></div>
    <ul>
      <li><a href="#about">Hakkımızda</a></li>
      <li><a href="#services">Hizmetler</a></li>
      <li><a href="#contact">İletişim</a></li>
      ${phone ? `<li><a class="cta-btn" href="tel:${phoneHref}">Ara</a></li>` : ""}
    </ul>
  </div>
</nav>

<header class="hero">
  <div class="container">
    <h1>${name} — <em>${category}</em>${city ? ` ${city}` : ""}</h1>
    <p>Müşteri memnuniyetini ön planda tutan, profesyonel ve güvenilir hizmet anlayışı.</p>
    <div class="hero-actions">
      ${phone ? `<a class="btn btn-primary" href="tel:${phoneHref}">📞 Hemen Ara</a>` : ""}
      <a class="btn btn-ghost" href="#contact">Bize Ulaşın</a>
    </div>
    <div class="rating">
      <span class="stars">★★★★★</span>
      <span>${rating.toFixed(1)} / 5 — ${reviews}+ memnun müşteri</span>
    </div>
  </div>
</header>

<section id="about">
  <div class="container">
    <div class="about-grid fade-in">
      <div>
        <h2 class="section-title">Hakkımızda</h2>
        <p class="section-sub">${name}, ${city || "bölgede"} ${category.toLowerCase()} alanında uzun yıllardır hizmet veren, kalite ve müşteri memnuniyetini ilke edinmiş bir işletmedir.</p>
        <p style="color:var(--muted)">Deneyimli ekibimiz, modern teknik ve ekipmanlarımızla siz değerli müşterilerimize en iyi deneyimi sunmayı hedefliyoruz. Hijyen, profesyonellik ve dakiklik bizim için sadece kelime değil, çalışma prensibimizdir.</p>
      </div>
      <div class="about-visual"></div>
    </div>
  </div>
</section>

<section id="services" style="background:var(--surface)">
  <div class="container">
    <div class="fade-in">
      <h2 class="section-title">Hizmetlerimiz</h2>
      <p class="section-sub">Size özel, kişiye özel çözümler.</p>
    </div>
    <div class="services-grid">
      ${[1, 2, 3, 4, 5, 6]
        .map(
          (i) => `
      <div class="service fade-in">
        <div class="service-icon">${["✨", "🎯", "⚡", "💎", "🌟", "🔥"][i - 1]}</div>
        <h3>Hizmet ${i}</h3>
        <p>Profesyonel ekibimizle sunduğumuz kaliteli ve güvenilir hizmet anlayışı.</p>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>

<section>
  <div class="container">
    <div class="fade-in">
      <h2 class="section-title">Galeri</h2>
      <p class="section-sub">Çalışmalarımızdan kareler.</p>
    </div>
    <div class="gallery">
      ${[1, 2, 3, 4, 5, 6, 7, 8].map(() => `<div class="gallery-item fade-in"></div>`).join("")}
    </div>
  </div>
</section>

<section style="background:var(--surface)">
  <div class="container">
    <div class="fade-in">
      <h2 class="section-title">Müşteri Yorumları</h2>
      <p class="section-sub">${reviews}+ mutlu müşteri.</p>
    </div>
    <div class="testimonials">
      ${[
        { n: "Ayşe K.", t: "Harika bir deneyimdi, kesinlikle tavsiye ederim. İlgili ve profesyonel bir ekip." },
        { n: "Mehmet Y.", t: "Yıllardır geliyorum, kalitelerinden hiç şüphe duymadım. Teşekkürler!" },
        { n: "Zeynep D.", t: "Tertemiz mekan, güleryüzlü hizmet. Her ziyaretimde memnun ayrılıyorum." },
      ]
        .map(
          (q) => `
      <div class="testimonial fade-in">
        <p>"${q.t}"</p>
        <div class="testimonial-author"><div class="avatar"></div><div><strong>${q.n}</strong><span style="color:var(--muted);font-size:.85rem">Müşteri</span></div></div>
      </div>`,
        )
        .join("")}
    </div>
  </div>
</section>

<section id="contact">
  <div class="container">
    <div class="fade-in">
      <h2 class="section-title">İletişim</h2>
      <p class="section-sub">Bize ulaşın, sorularınızı yanıtlayalım.</p>
    </div>
    <div class="contact-grid">
      <div class="contact-info">
        ${phone ? `<a class="contact-row" href="tel:${phoneHref}" style="text-decoration:none;color:inherit"><div class="service-icon" style="width:44px;height:44px;font-size:1.1rem;margin:0">📞</div><div><strong>Telefon</strong><span>${phone}</span></div></a>` : ""}
        ${fullAddress ? `<div class="contact-row"><div class="service-icon" style="width:44px;height:44px;font-size:1.1rem;margin:0">📍</div><div><strong>Adres</strong><span>${fullAddress}</span></div></div>` : ""}
        <div class="contact-row"><div class="service-icon" style="width:44px;height:44px;font-size:1.1rem;margin:0">⏰</div><div><strong>Çalışma Saatleri</strong><span>Pazartesi - Cumartesi: 09:00 - 19:00</span></div></div>
      </div>
      <iframe src="https://www.google.com/maps?q=${mapsQ}&output=embed" loading="lazy" allowfullscreen></iframe>
    </div>
  </div>
</section>

<footer>
  <div class="container">
    <div class="logo" style="margin-bottom:1rem">${name.split(" ")[0]}<span>.</span></div>
    <p>© ${new Date().getFullYear()} ${name}. Tüm hakları saklıdır.</p>
  </div>
</footer>

<script>
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => io.observe(el));
</script>
</body>
</html>`;
}
