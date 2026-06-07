import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/domain";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const ids = url.searchParams.getAll("id");
  const status = url.searchParams.get("status") ?? undefined;
  const noWebsite = url.searchParams.get("noWebsite") === "1";

  const leads = await prisma.lead.findMany({
    where: {
      ownerId: session.user.id,
      ...(ids.length > 0 ? { id: { in: ids } } : {}),
      ...(status ? { status } : {}),
      ...(noWebsite ? { OR: [{ website: null }, { website: "" }] } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "FinderCust";
  wb.created = new Date();
  const sheet = wb.addWorksheet("Leads");

  sheet.columns = [
    { header: "Adı", key: "name", width: 28 },
    { header: "Kategori", key: "category", width: 18 },
    { header: "Şehir", key: "city", width: 14 },
    { header: "Telefon", key: "phone", width: 18 },
    { header: "Website", key: "website", width: 28 },
    { header: "Adres", key: "address", width: 32 },
    { header: "Durum", key: "status", width: 14 },
    { header: "Puan", key: "rating", width: 8 },
    { header: "Yorum", key: "reviewsCount", width: 8 },
    { header: "Notlar", key: "notes", width: 30 },
    { header: "Oluşturulma", key: "createdAt", width: 18 },
  ];

  // Header style
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF18181B" },
  };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 22;

  for (const l of leads) {
    sheet.addRow({
      name: l.name,
      category: l.category ?? "",
      city: l.city ?? "",
      phone: l.phone ?? "",
      website: l.website ?? "(yok)",
      address: l.address ?? "",
      status:
        LEAD_STATUS_LABEL[l.status as LeadStatus] ?? l.status,
      rating: l.rating ?? "",
      reviewsCount: l.reviewsCount ?? "",
      notes: l.notes ?? "",
      createdAt: l.createdAt,
    });
  }

  // Stripe rows
  sheet.eachRow((row, idx) => {
    if (idx === 1) return;
    if (idx % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF4F4F5" },
      };
    }
  });
  sheet.autoFilter = { from: "A1", to: "K1" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `findercust-leads-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
