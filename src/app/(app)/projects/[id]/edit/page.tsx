import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { HtmlEditor } from "./_components/html-editor";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const project = await prisma.project.findFirst({
    where: { id, ownerId: session.user.id },
    include: { lead: { select: { name: true } } },
  });
  if (!project) notFound();
  if (!project.generatedHtml) {
    redirect(`/projects/${id}`);
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/leads/${project.leadId}`}>
          <ArrowLeft className="size-4" /> Lead&apos;e dön
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold">
          {project.lead.name} — Website Düzenle
        </h1>
        <p className="text-sm text-muted-foreground">
          HTML&apos;i doğrudan düzenle, sağda canlı önizle, hazır olduğunda
          kaydet veya indirip VS Code&apos;da aç.
        </p>
      </div>

      <HtmlEditor
        projectId={project.id}
        initialHtml={project.generatedHtml}
        initialCss={project.generatedCss ?? ""}
      />
    </div>
  );
}
