import { auth } from "@/lib/auth";
import { demoApiBlocked } from "@/lib/demo";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import type { SearchResult } from "@/app/(app)/discover/actions";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = demoApiBlocked();
  if (blocked) return blocked;

  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const search = await prisma.search.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!search) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const results = JSON.parse(search.resultsJson) as SearchResult[];
  const date = new Date().toISOString().slice(0, 10);
  const slug = `${search.sector}-${search.city}-${search.district ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${slug}-${date}.${format}`;

  if (format === "csv") {
    const headers = [
      "İşletme",
      "Kategori",
      "Şehir",
      "İlçe",
      "Adres",
      "Telefon",
      "E-posta",
      "Website",
      "Instagram",
      "Puan",
      "Yorum sayısı",
      "Durum",
    ];
    const rows = results.map((r) => [
      r.name,
      r.category,
      r.city,
      r.district ?? "",
      r.address,
      r.phone ?? "",
      r.email ?? "",
      r.website ?? "",
      r.social?.instagram ?? "",
      r.rating,
      r.reviewsCount,
      r.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? "");
            return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n");
    // Excel-friendly UTF-8 BOM
    return new Response("\uFEFF" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // XLSX
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Leadler");
  ws.columns = [
    { header: "İşletme", key: "name", width: 32 },
    { header: "Kategori", key: "category", width: 18 },
    { header: "Şehir", key: "city", width: 14 },
    { header: "İlçe", key: "district", width: 14 },
    { header: "Adres", key: "address", width: 40 },
    { header: "Telefon", key: "phone", width: 18 },
    { header: "E-posta", key: "email", width: 26 },
    { header: "Website", key: "website", width: 28 },
    { header: "Instagram", key: "instagram", width: 28 },
    { header: "Puan", key: "rating", width: 8 },
    { header: "Yorum sayısı", key: "reviews", width: 12 },
    { header: "Durum", key: "status", width: 12 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF18181B" },
  };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 12 },
  };

  results.forEach((r, i) => {
    const row = ws.addRow({
      name: r.name,
      category: r.category,
      city: r.city,
      district: r.district ?? "",
      address: r.address,
      phone: r.phone ?? "",
      email: r.email ?? "",
      website: r.website ?? "",
      instagram: r.social?.instagram ?? "",
      rating: r.rating,
      reviews: r.reviewsCount,
      status: r.status,
    });
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF4F4F5" },
        };
      });
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
