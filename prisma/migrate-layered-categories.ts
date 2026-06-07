import { PrismaClient } from "@prisma/client";

type SearchResultLike = {
  placeId?: unknown;
};

const prisma = new PrismaClient();

function normalize(text: string): string {
  return text.trim().toLocaleLowerCase("tr");
}

function buildLayeredCategory(sector: string, rawCategory: string): string {
  if (normalize(sector) === normalize(rawCategory)) return sector;
  return `${sector} > ${rawCategory}`;
}

async function main() {
  console.log("[migrate] Layered category migration started...");

  const leads = await prisma.lead.findMany({
    where: {
      source: "google_maps",
      ownerId: { not: null },
      placeId: { not: null },
      category: { not: null },
    },
    select: {
      id: true,
      ownerId: true,
      placeId: true,
      category: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const leadsByOwner = new Map<string, typeof leads>();
  for (const lead of leads) {
    if (!lead.ownerId || !lead.placeId || !lead.category) continue;
    const ownerLeads = leadsByOwner.get(lead.ownerId) ?? [];
    ownerLeads.push(lead);
    leadsByOwner.set(lead.ownerId, ownerLeads);
  }

  let updated = 0;
  let alreadyLayered = 0;
  let noSectorMatch = 0;

  for (const [ownerId, ownerLeads] of leadsByOwner.entries()) {
    const searches = await prisma.search.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      select: {
        sector: true,
        resultsJson: true,
      },
    });

    const placeIdToSector = new Map<string, string>();

    for (const search of searches) {
      let parsed: SearchResultLike[] = [];
      try {
        const raw = JSON.parse(search.resultsJson) as unknown;
        if (Array.isArray(raw)) parsed = raw as SearchResultLike[];
      } catch {
        continue;
      }

      for (const result of parsed) {
        const placeId = typeof result.placeId === "string" ? result.placeId : null;
        if (!placeId) continue;
        // Keep the first one because searches are iterated newest -> oldest.
        if (!placeIdToSector.has(placeId)) {
          placeIdToSector.set(placeId, search.sector);
        }
      }
    }

    for (const lead of ownerLeads) {
      const rawCategory = lead.category?.trim();
      if (!rawCategory) continue;

      if (rawCategory.includes(" > ")) {
        alreadyLayered++;
        continue;
      }

      const placeId = lead.placeId;
      if (!placeId) continue;

      const sector = placeIdToSector.get(placeId);
      if (!sector) {
        noSectorMatch++;
        continue;
      }

      const nextCategory = buildLayeredCategory(sector, rawCategory);
      if (nextCategory === rawCategory) continue;

      await prisma.lead.update({
        where: { id: lead.id },
        data: { category: nextCategory },
      });
      updated++;
    }
  }

  console.log(`[migrate] Updated leads: ${updated}`);
  console.log(`[migrate] Already layered: ${alreadyLayered}`);
  console.log(`[migrate] No sector match: ${noSectorMatch}`);
  console.log("[migrate] Done.");
}

main()
  .catch((error) => {
    console.error("[migrate] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
