import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const project = await prisma.project.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!project || !project.generatedHtml) {
    return new Response("Not found", { status: 404 });
  }

  let html = project.generatedHtml;
  // Rewrite the <link rel="stylesheet" href="style.css"> to point at our route
  // so the same id can serve both the bundled HTML+CSS preview and the
  // standalone style.css download.
  if (project.generatedCss) {
    html = html.replace(
      /<link[^>]+href="style\.css"[^>]*>/i,
      `<link rel="stylesheet" href="/preview/${id}/style.css" />`,
    );
    // If model didn't include a link tag at all, inject CSS inline before </head>.
    if (!/href="\/preview\/[^"]+\/style\.css"/i.test(html)) {
      const styleTag = `<style>${project.generatedCss}</style>`;
      html = /<\/head>/i.test(html)
        ? html.replace(/<\/head>/i, `${styleTag}\n</head>`)
        : styleTag + html;
    }
  }

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
