import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  Briefcase,
  Globe,
  Target,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatTRY,
  formatDateTime,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_VARIANT,
  type LeadStatus,
} from "@/lib/domain";
import { StatusPie, CityBar, TrendLine } from "./_components/charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const [
    leadCount,
    noWebsiteCount,
    projectCount,
    wonCount,
    leadsByStatus,
    leadsByCity,
    deliveredProjects,
    inProgressProjects,
    recentActivities,
    last30,
  ] = await Promise.all([
    prisma.lead.count({ where: { ownerId: userId } }),
    prisma.lead.count({
      where: { ownerId: userId, OR: [{ website: null }, { website: "" }] },
    }),
    prisma.project.count({ where: { ownerId: userId } }),
    prisma.lead.count({ where: { ownerId: userId, status: "won" } }),
    prisma.lead.groupBy({
      by: ["status"],
      where: { ownerId: userId },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["city"],
      where: { ownerId: userId, city: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),
    prisma.project.aggregate({
      where: { ownerId: userId, status: "delivered" },
      _sum: { priceCents: true },
    }),
    prisma.project.aggregate({
      where: {
        ownerId: userId,
        status: { in: ["in_progress", "review", "draft"] },
      },
      _sum: { priceCents: true },
    }),
    prisma.activity.findMany({
      where: { lead: { ownerId: userId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { lead: { select: { id: true, name: true } } },
    }),
    prisma.lead.findMany({
      where: {
        ownerId: userId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: { createdAt: true },
    }),
  ]);

  const stats = [
    { label: "Toplam Lead", value: leadCount, icon: Users },
    {
      label: "Websitesiz",
      value: noWebsiteCount,
      icon: Globe,
      hint: leadCount > 0 ? `${Math.round((noWebsiteCount / leadCount) * 100)}% oran` : "",
    },
    { label: "Aktif Proje", value: projectCount, icon: Briefcase },
    { label: "Kazanılan", value: wonCount, icon: Target },
  ];

  const statusData = leadsByStatus.map((g) => ({
    status: g.status,
    count: g._count._all,
  }));
  const cityData = leadsByCity.map((g) => ({
    city: g.city ?? "—",
    count: g._count._all,
  }));

  // Trend by day (last 30)
  const trendMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(5, 10); // MM-DD
    trendMap.set(key, 0);
  }
  for (const l of last30) {
    const key = l.createdAt.toISOString().slice(5, 10);
    trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
  }
  const trendData = Array.from(trendMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Hoş geldin{session?.user?.name ? `, ${session.user.name}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Genel bakış, son aktiviteler ve önemli metrikler.
          </p>
        </div>
        <Button asChild>
          <Link href="/discover">
            Yeni keşif <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{s.value}</div>
                {s.hint && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {s.hint}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Teslim edilen ciro
            </CardTitle>
            <TrendingUp className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {formatTRY(deliveredProjects._sum.priceCents)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pipeline değeri
            </CardTitle>
            <TrendingUp className="size-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">
              {formatTRY(inProgressProjects._sum.priceCents)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead durumu</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusPie data={statusData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Şehir bazında</CardTitle>
          </CardHeader>
          <CardContent>
            <CityBar data={cityData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Son 30 gün — yeni lead trendi</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendLine data={trendData} />
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Son aktiviteler</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz aktivite yok. Bir lead aç ve not/arama ekle.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentActivities.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-4 border-b pb-3 last:border-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/leads/${a.lead.id}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {a.lead.name}
                    </Link>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      <span className="capitalize">{a.type === "status_change" ? "durum" : a.type}</span>{" "}
                      · {a.content}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Status legend */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline durumu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {statusData.map((s) => (
              <Badge
                key={s.status}
                variant={
                  LEAD_STATUS_VARIANT[s.status as LeadStatus] ?? "muted"
                }
                className="text-sm"
              >
                {LEAD_STATUS_LABEL[s.status as LeadStatus] ?? s.status}: {s.count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
