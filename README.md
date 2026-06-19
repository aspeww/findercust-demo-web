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
3. Ortam değişkenlerini ekleyin (`.env.example` referans):

| Değişken | Değer |
|----------|-------|
| `DATABASE_URL` | `file:./prisma/demo.db` |
| `AUTH_SECRET` | `openssl rand -base64 32` ile üretin |
| `AUTH_TRUST_HOST` | `true` |
| `DEMO_MODE` | `true` |
| `NEXT_PUBLIC_DEMO_MODE` | `true` |
| `DEMO_SEED` | `true` |
| `DEMO_USER_EMAIL` | `demo@findercust.com` |
| `DEMO_USER_PASSWORD` | `Demo123!` |
| `GEMINI_FORCE_TEMPLATE` | `true` |

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
