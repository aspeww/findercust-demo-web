import JSZip from "jszip";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const project = await prisma.project.findFirst({
    where: { id, ownerId: session.user.id },
    include: { lead: { select: { name: true } } },
  });
  if (!project || !project.generatedHtml) {
    return new Response("Not found", { status: 404 });
  }

  const slug =
    project.lead.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "website";

  if (project.generatedCss) {
    const zip = new JSZip();
    zip.file("index.html", project.generatedHtml);
    zip.file("style.css", project.generatedCss);
    zip.file(
      "README.txt",
      [
        `${project.lead.name} — AI üretimi website`,
        ``,
        `Dosyalar:`,
        `  index.html  — Ana sayfa`,
        `  style.css   — Stiller`,
        ``,
        `Yerelde açmak için: index.html'i çift tıkla.`,
        `VS Code'da düzenlemek için: bu klasörü VS Code'da aç.`,
      ].join("\n"),
    );
    const buf = await zip.generateAsync({ type: "nodebuffer" });
    return new Response(buf as unknown as ArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}.zip"`,
      },
    });
  }

  return new Response(project.generatedHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.html"`,
    },
  });
}
