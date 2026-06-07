import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PROJECT_STATUS_LABEL, type ProjectStatus, formatTRY } from "@/lib/domain";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const projects = await prisma.project.findMany({
    where: { ownerId: session.user.id },
    include: { lead: true },
    orderBy: { createdAt: "desc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "FinderCust";
  const sheet = wb.addWorksheet("Projeler");

  sheet.columns = [
    { header: "Başlık", key: "title", width: 32 },
    { header: "İşletme", key: "lead", width: 28 },
    { header: "Durum", key: "status", width: 14 },
    { header: "Fiyat", key: "price", width: 14 },
    { header: "Para Birimi", key: "currency", width: 10 },
    { header: "Canlı URL", key: "liveUrl", width: 32 },
    { header: "Açıklama", key: "description", width: 40 },
    { header: "Oluşturulma", key: "createdAt", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF18181B" },
  };

  for (const p of projects) {
    sheet.addRow({
      title: p.title,
      lead: p.lead.name,
      status:
        PROJECT_STATUS_LABEL[p.status as ProjectStatus] ?? p.status,
      price: p.priceCents ? formatTRY(p.priceCents) : "",
      currency: p.currency,
      liveUrl: p.liveUrl ?? "",
      description: p.description ?? "",
      createdAt: p.createdAt,
    });
  }

  sheet.autoFilter = { from: "A1", to: "H1" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="findercust-projects-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
