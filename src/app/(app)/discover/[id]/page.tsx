import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/domain";
import { ResultsTable } from "./_components/results-table";
import type { SearchResult } from "../actions";

export const dynamic = "force-dynamic";

export default async function SearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const search = await prisma.search.findFirst({
    where: { id, ownerId: session.user.id },
  });

  if (!search) notFound();

  const results = JSON.parse(search.resultsJson) as SearchResult[];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/discover">
          <ArrowLeft className="size-4" /> Geri
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold">
          {search.sector}{" "}
          <span className="text-muted-foreground">·</span>{" "}
          <span className="font-normal">
            {search.city}
            {search.district ? ` / ${search.district}` : ""}
          </span>
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{formatDateTime(search.createdAt)}</span>
          <span>·</span>
          <span>{search.district ? `${search.district} odaklı` : "İl geneli"}</span>
          {search.segment && (
            <>
              <span>·</span>
              <span>{search.segment}</span>
            </>
          )}
          <span>·</span>
          <span>
            durum:{" "}
            <Badge
              variant={search.status === "completed" ? "success" : "warning"}
            >
              {search.status}
            </Badge>
          </span>
        </div>
      </div>

      <ResultsTable
        searchId={search.id}
        results={results}
        createdAt={search.createdAt}
      />
    </div>
  );
}
