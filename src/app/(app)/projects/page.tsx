import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatTRY } from "@/lib/domain";
import { ProjectsTable } from "./_components/projects-table";
import { NewProjectDialog } from "./_components/new-project-dialog";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [projects, leads] = await Promise.all([
    prisma.project.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { lead: { select: { id: true, name: true } } },
    }),
    prisma.lead.findMany({
      where: { ownerId: session.user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalRevenue = projects
    .filter((p) => p.status === "delivered")
    .reduce((s, p) => s + (p.priceCents ?? 0), 0);

  const pipelineValue = projects
    .filter((p) => p.status !== "cancelled" && p.status !== "delivered")
    .reduce((s, p) => s + (p.priceCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projeler</h1>
          <p className="text-sm text-muted-foreground">
            Lead'lere atadığın website projelerini yönet.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/export/projects">
              <Download className="size-4" /> Excel
            </a>
          </Button>
          <NewProjectDialog leads={leads} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Toplam proje" value={projects.length} />
        <Stat label="Teslim edilen ciro" value={formatTRY(totalRevenue)} />
        <Stat label="Pipeline değeri" value={formatTRY(pipelineValue)} />
      </div>

      <ProjectsTable projects={projects} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
