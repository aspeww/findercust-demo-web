import Link from "next/link";
import { redirect } from "next/navigation";
import { History, Plus, MapPin, Search as SearchIcon } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function DiscoverHistoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const searches = await prisma.search.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <History className="size-6" /> Geçmiş Aramalar
          </h1>
          <p className="text-sm text-muted-foreground">
            Yaptığın tüm potansiyel müşteri aramaları burada listelenir.
          </p>
        </div>
        <Button asChild>
          <Link href="/discover/new">
            <Plus className="size-4" /> Yeni Arama
          </Link>
        </Button>
      </div>

      {searches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <SearchIcon className="size-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Henüz arama yok</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                İlk aramanı oluştur ve potansiyel müşterileri keşfet.
              </p>
            </div>
            <Button asChild>
              <Link href="/discover/new">
                <Plus className="size-4" /> İlk Aramayı Oluştur
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {searches.map((s) => (
            <Link
              key={s.id}
              href={`/discover/${s.id}`}
              className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{s.sector}</h3>
                    <span className="text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" />
                      {s.city}
                      {s.district ? ` / ${s.district}` : ""}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDateTime(s.createdAt)}</span>
                    <span>·</span>
                    <span>{s.district ? `${s.district} odaklı` : "İl geneli"}</span>
                    {s.segment && (
                      <>
                        <span>·</span>
                        <span>{s.segment}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      durum:{" "}
                      <Badge
                        variant={s.status === "completed" ? "success" : "warning"}
                        className="ml-1"
                      >
                        {s.status}
                      </Badge>
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold">{s.resultCount}</div>
                  <div className="text-xs text-muted-foreground">sonuç</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
