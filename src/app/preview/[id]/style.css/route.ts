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
    select: { generatedCss: true },
  });
  if (!project?.generatedCss) {
    return new Response("/* no css */", {
      status: 404,
      headers: { "Content-Type": "text/css; charset=utf-8" },
    });
  }
  return new Response(project.generatedCss, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
