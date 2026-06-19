import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDemoMode } from "@/lib/demo";
import { LeadsTable } from "./_components/leads-table";
import { NewLeadDialog } from "./_components/new-lead-dialog";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const leads = await prisma.lead.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      category: true,
      city: true,
      phone: true,
      email: true,
      website: true,
      status: true,
      rating: true,
      reviewsCount: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Web sitesi olmayan işletmeleri keşfet, takip et, satışa dönüştür.
          </p>
        </div>
        <NewLeadDialog />
      </div>
      <LeadsTable leads={leads} demoMode={isDemoMode()} />
    </div>
  );
}
