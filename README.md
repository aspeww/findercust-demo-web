# FinderCust Demo Web

Google Maps üzerinden işletme keşfi, CRM pipeline, AI web sitesi üretimi ve SMTP outreach otomasyonu içeren **salt okunur canlı demo** uygulaması.

## Demo Giriş

| Alan | Değer |
|------|-------|
| E-posta | `demo@findercust.com` |
| Şifre | `Demo123!` |

Demo modunda paneli gezebilirsiniz; kayıt, düzenleme, silme, export ve e-posta gönderimi devre dışıdır.

## Hızlı Başlangıç (Yerel)

```bash
cp .env.example .env
# .env içinde AUTH_SECRET üretin: openssl rand -base64 32

npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Uygulama: http://localhost:3000

## Vercel Deploy

1. Repoyu GitHub'a push edin
2. [Vercel](https://vercel.com) → Import Project
3. Ortam değişkenlerini ekleyin:

| Değişken | Zorunlu | Değer |
|----------|---------|-------|
| `AUTH_SECRET` | **Evet** | `openssl rand -base64 32` ile üretin |
| `DATABASE_URL` | Hayır | `vercel.json` içinde varsayılan tanımlı |
| `DEMO_MODE` | Hayır | `vercel.json` içinde `true` |
| `NEXT_PUBLIC_DEMO_MODE` | Hayır | `vercel.json` içinde `true` |

Diğer demo değişkenleri `vercel.json` içinde hazır gelir. Sadece **`AUTH_SECRET`** Vercel panelinden eklemeniz gerekir (giriş için zorunlu).

Build komutu `vercel.json` içinde tanımlıdır: migration + seed + Next.js build.

> **Not:** Vercel serverless ortamında SQLite salt okunur demo için uygundur. Veri build sırasında seed edilir.

## Docker Deploy (Alternatif)

```bash
docker compose up -d --build
```

İlk açılışta migration + demo seed otomatik çalışır (`DEMO_SEED=true`).

## Özellikler

- **Discover** — Google Places ile işletme arama (demo modunda yeni arama kapalı)
- **Leads & Pipeline** — CRM ve durum takibi (salt okunur)
- **Projects** — AI ile web sitesi üretimi (demo modunda kapalı)
- **Outreach** — E-posta otomasyonu (demo modunda kapalı)

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Production build |
| `npm run vercel-build` | Vercel build (migrate + seed + build) |
| `npm run db:seed` | Demo verisi yükle |
| `npm run db:reset` | DB sıfırla + seed |

## Güvenlik Notları

- `.env` dosyasını asla commit etmeyin
- Production'da güçlü `AUTH_SECRET` kullanın
- Demo ortamında `DEMO_MODE=true` tüm yazma işlemlerini engeller

## Repo

GitHub: [findercust-demo-web](https://github.com/aspeww/findercust-demo-web)
