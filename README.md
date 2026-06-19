# FinderCust Demo Web

Google Maps üzerinden işletme keşfi, CRM pipeline, AI web sitesi üretimi ve SMTP outreach otomasyonu içeren canlı demo uygulaması.

## Demo Giriş

| Alan | Değer |
|------|-------|
| E-posta | `demo@findercust.com` |
| Şifre | `Demo123!` |

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

## Canlı Yayın (Docker / Submail SMTP)

SMTP outreach için Ayarlar ekranından Submail veya herhangi bir SMTP sağlayıcısı ekleyin. Çoklu SMTP profili ve otomasyon motoru desteklenir.

### 1. Ortam değişkenleri

```bash
cp .env.example .env
```

Zorunlu:

- `AUTH_SECRET` — `openssl rand -base64 32`
- `GOOGLE_MAPS_API_KEY` — Discover araması için (opsiyonel demo modunda)

### 2. Docker Compose ile deploy

```bash
docker compose up -d --build
```

İlk açılışta migration + demo seed otomatik çalışır (`DEMO_SEED=true`).

### 3. Reverse proxy (ör. Nginx + subdomain)

```nginx
server {
  listen 443 ssl;
  server_name demo.sizindomain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

`AUTH_TRUST_HOST=true` production için gereklidir.

## Özellikler

- **Discover** — Google Places ile işletme arama
- **Leads & Pipeline** — CRM ve durum takibi
- **Projects** — AI ile web sitesi üretimi (Gemini veya şablon)
- **Outreach** — Tekil/toplu e-posta, çoklu SMTP profili
- **Otomasyon** — Yeni lead'lere sıralı SMTP rotasyonu ile mail gönderimi

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Production build |
| `npm run db:migrate` | Migration |
| `npm run db:seed` | Demo verisi yükle |
| `npm run db:reset` | DB sıfırla + seed |

## Güvenlik Notları

- `.env` dosyasını asla commit etmeyin
- Production'da güçlü `AUTH_SECRET` kullanın
- SMTP şifreleri veritabanında saklanır; production için şifreleme önerilir
- Demo ortamında `GEMINI_FORCE_TEMPLATE=true` API maliyetini düşürür

## Repo

GitHub: [findercust-demo-web](https://github.com/aspeww/findercust-demo-web)
