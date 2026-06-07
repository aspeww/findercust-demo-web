/**
 * Seed script — populates the DB with realistic Turkish business mock data.
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CITIES = [
  "İstanbul",
  "Ankara",
  "İzmir",
  "Bursa",
  "Antalya",
  "Adana",
  "Konya",
  "Eskişehir",
];

const CATEGORIES = [
  "Kuaför",
  "Restoran",
  "Kafe",
  "Oto Yıkama",
  "Berber",
  "Diş Kliniği",
  "Veteriner",
  "Spor Salonu",
  "Pastane",
  "Çiçekçi",
  "Emlakçı",
  "Avukat Bürosu",
];

const STATUSES = [
  "new",
  "new",
  "new",
  "contacted",
  "contacted",
  "interested",
  "negotiating",
  "won",
  "lost",
];

const NAMES = [
  "Yıldız", "Mavi", "Altın", "Kervan", "Şirin", "Anadolu", "Boğaziçi",
  "Marmara", "Ege", "Akdeniz", "Karadeniz", "Lale", "Gül", "Çınar",
  "Pınar", "Hilal", "Güneş", "Ay", "Nehir", "Deniz", "Kale", "Saray",
  "Sultan", "Bey", "Hanım", "Usta", "Maestro", "Royal", "Premium", "Elit",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function maybeWebsite(name: string): string | null {
  // 60% no website (our target leads), 40% has website
  if (Math.random() < 0.6) return null;
  const slug = name
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `https://www.${slug}.com.tr`;
}

function phone(): string {
  const op = pick(["530", "532", "535", "541", "544", "551", "555"]);
  const a = String(Math.floor(100 + Math.random() * 900));
  const b = String(Math.floor(10 + Math.random() * 90));
  const c = String(Math.floor(10 + Math.random() * 90));
  return `+90 ${op} ${a} ${b} ${c}`;
}

async function main() {
  console.log("🌱 Seeding database...");

  // Find any existing user to assign leads to (you'll be the admin).
  const owner = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!owner) {
    console.log(
      "⚠️  No user found — please register first at /register, then run seed again.",
    );
    return;
  }
  console.log(`👤 Assigning to user: ${owner.email}`);

  // Wipe existing leads/projects/activities for this owner (safe re-seed).
  await prisma.activity.deleteMany({ where: { lead: { ownerId: owner.id } } });
  await prisma.project.deleteMany({ where: { ownerId: owner.id } });
  await prisma.lead.deleteMany({ where: { ownerId: owner.id } });

  const leads = [];
  for (let i = 0; i < 40; i++) {
    const name1 = pick(NAMES);
    const cat = pick(CATEGORIES);
    const businessName = `${name1} ${cat}`;
    const city = pick(CITIES);
    const website = maybeWebsite(businessName);
    const status = pick(STATUSES);

    leads.push({
      name: businessName,
      category: cat,
      phone: phone(),
      website,
      address: `${pick(["Atatürk", "Cumhuriyet", "İstiklal", "Bağdat", "Barbaros"])} Cd. No:${Math.floor(Math.random() * 200) + 1}`,
      city,
      country: "Türkiye",
      lat: 36 + Math.random() * 6,
      lng: 27 + Math.random() * 14,
      rating: Math.round((3 + Math.random() * 2) * 10) / 10,
      reviewsCount: Math.floor(Math.random() * 500),
      status,
      source: "google_maps",
      ownerId: owner.id,
      placeId: `mock_${Date.now()}_${i}`,
    });
  }

  await prisma.lead.createMany({ data: leads });
  console.log(`✅ Created ${leads.length} leads`);

  // Add activities to ~half of them
  const allLeads = await prisma.lead.findMany({ where: { ownerId: owner.id } });
  let activityCount = 0;
  for (const lead of allLeads) {
    const numActs = Math.floor(Math.random() * 4);
    for (let j = 0; j < numActs; j++) {
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          userId: owner.id,
          type: pick(["note", "call", "email", "status_change"]),
          content: pick([
            "İlk arama yapıldı, ilgilendiklerini söylediler.",
            "Mesaj bırakıldı, geri dönüş bekleniyor.",
            "Teklif e-postası gönderildi.",
            "Toplantı ayarlandı, gelecek hafta.",
            "Fiyat müzakeresi devam ediyor.",
            "Karar verme aşamasında.",
            "Olumlu geri dönüş, sözleşme hazırlanıyor.",
          ]),
        },
      });
      activityCount++;
    }
  }
  console.log(`✅ Created ${activityCount} activities`);

  // Create a few projects from won leads
  const wonLeads = allLeads.filter((l) => l.status === "won");
  let projectCount = 0;
  for (const lead of wonLeads) {
    await prisma.project.create({
      data: {
        leadId: lead.id,
        ownerId: owner.id,
        title: `${lead.name} — Kurumsal Website`,
        description: "5 sayfalık responsive kurumsal site, SEO optimize.",
        status: pick(["draft", "in_progress", "review", "delivered"]),
        priceCents: pick([500000, 750000, 1000000, 1500000, 2500000]),
        currency: "TRY",
        liveUrl:
          Math.random() > 0.5
            ? `https://${lead.name.toLowerCase().replace(/\s+/g, "-")}.findercust.com`
            : null,
      },
    });
    projectCount++;
  }
  console.log(`✅ Created ${projectCount} projects`);
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
