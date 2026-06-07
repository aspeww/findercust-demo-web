import nodemailer from "nodemailer";
import type { Lead } from "@prisma/client";

export type MailerConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName?: string | null;
  replyTo?: string | null;
};

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

const DEFAULT_BODY_TEMPLATE = `Merhaba {{name}} ekibi,

{{cityLine}} {{websiteStatusLine}}

{{name}} için sadece "bir web sitesi" değil, doğrudan daha fazla dönüşüm alacak bir dijital satış altyapısı kuruyoruz.

Sunduğumuz paket:

- Size özel, mobil uyumlu, hızlı açılan profesyonel website
- Google'da görünürlük için temel SEO ve yerel arama optimizasyonu
- WhatsApp / arama / form butonlarıyla anlık müşteri dönüşümü
- Lead takibi için CRM altyapısı (müşteri adaylarını kaçırmamanız için)
- İsteğe göre kampanya, referans ve güven unsurlarıyla satış odaklı sayfalar

{{improvementLine}}

Fiyat tarafında piyasanın en alt seviyesinden, işletmenize özel bir başlangıç kampanyası sunuyoruz. Önce sizi dinleyip ihtiyaca göre net ve şeffaf teklif veriyoruz.

İsterseniz 2-3 örnek tasarım görseli de paylaşabiliriz; böylece daha başlamadan nasıl bir sonuç alacağınızı net görmüş olursunuz.

Uygunsa bu mesaja sadece "evet" yazmanız yeterli. Kısa bir görüşmeyle en hızlı ve en verimli planı birlikte çıkaralım.

İyi çalışmalar dileriz.`;

export function renderEmailBody(
  template: string | null | undefined,
  lead: Pick<Lead, "name" | "category" | "city" | "phone" | "website">,
  signature?: string | null,
): string {
  const hasWebsite = Boolean(lead.website && lead.website.trim());

  const websiteStatusLine = hasWebsite
    ? "Mevcut web sitenizi inceledik; daha modern, daha hızlı ve dönüşüm odaklı bir yapıyla çok daha iyi sonuç alabileceğinizi düşünüyoruz."
    : "Fark ettik ki aktif bir web siteniz yok; bu alanda hızlı bir iyileştirme ile daha fazla müşteri talebi yakalayabilirsiniz.";

  const improvementLine = hasWebsite
    ? "Özellikle mevcut sitenizde tasarım dili, hız, mobil deneyim ve teklif/iletişim akışını iyileştirerek daha fazla arama ve mesaj dönüşümü almanızı hedefliyoruz."
    : "Sıfırdan kuracağımız yapıda işletmenizi güçlü gösteren bir vitrin ve düzenli müşteri akışı sağlayan bir dönüşüm sistemi oluşturuyoruz.";

  const body = (template ?? DEFAULT_BODY_TEMPLATE)
    .replaceAll("{{name}}", lead.name ?? "")
    .replaceAll("{{category}}", lead.category ?? "işletme")
    .replaceAll("{{city}}", lead.city ?? "")
    .replaceAll("{{phone}}", lead.phone ?? "")
    .replaceAll("{{website}}", lead.website ?? "")
    .replaceAll(
      "{{cityLine}}",
      lead.city
        ? `${lead.city}'de {{category}} alanında yaptığınız iş gerçekten dikkat çekiyor.`
        : "İşletmenizin sunduğu hizmet kalitesi gerçekten dikkat çekiyor.",
    );
  const enrichedBody = body
    .replaceAll("{{category}}", lead.category ?? "işletme")
    .replaceAll("{{websiteStatusLine}}", websiteStatusLine)
    .replaceAll("{{improvementLine}}", improvementLine);
  return signature ? `${enrichedBody}\n\n${signature}` : enrichedBody;
}

export function getDefaultBodyTemplate(): string {
  return DEFAULT_BODY_TEMPLATE;
}

export function bodyToHtml(text: string): string {
  // Minimal text -> HTML conversion (preserve paragraphs and line breaks).
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const paragraphs = text.split(/\n{2,}/).map((p) => {
    const lines = p.split("\n").map(escape).join("<br />");
    return `<p style="margin:0 0 1em 0;">${lines}</p>`;
  });
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:600px">${paragraphs.join(
    "",
  )}</div>`;
}

export async function sendMail(
  cfg: MailerConfig,
  opts: {
    to: string;
    subject: string;
    text: string;
  },
): Promise<SendResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    const info = await transporter.sendMail({
      from: cfg.fromName
        ? `"${cfg.fromName}" <${cfg.fromEmail}>`
        : cfg.fromEmail,
      replyTo: cfg.replyTo ?? undefined,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: bodyToHtml(opts.text),
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
