import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Globe,
  GlobeLock,
  MapPin,
  Star,
  MessageSquare,
  Mail,
  Activity as ActivityIcon,
  CalendarCheck,
  RefreshCcw,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_VARIANT,
  formatDateTime,
  hasNoWebsite,
  type LeadStatus,
} from "@/lib/domain";
import { ActivityForm } from "./_components/activity-form";
import { LeadActions } from "./_components/lead-actions";
import { GenerateWebsiteButton } from "@/components/generate-website-button";
import { OutreachButton } from "@/components/outreach-button";

export const dynamic = "force-dynamic";

const ACTIVITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  note: MessageSquare,
  call: Phone,
  email: Mail,
  meeting: CalendarCheck,
  status_change: RefreshCcw,
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const lead = await prisma.lead.findFirst({
    where: { id, ownerId: session.user.id },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
      projects: true,
      emailLogs: {
        where: { status: "sent" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!lead) notFound();

  const noWeb = hasNoWebsite(lead.website);
  const mapsUrl =
    lead.lat && lead.lng
      ? `https://www.google.com/maps?q=${lead.lat},${lead.lng}`
      : `https://www.google.com/maps/search/${encodeURIComponent(
          `${lead.name} ${lead.city ?? ""}`,
        )}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/leads">
            <ArrowLeft className="size-4" /> Tüm leadler
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <OutreachButton leadId={lead.id} defaultEmail={lead.email} />
          <GenerateWebsiteButton
            leadId={lead.id}
            hasExisting={lead.projects.some((p) => p.aiModel)}
          />
          <LeadActions id={lead.id} status={lead.status} />
        </div>
      </div>

      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold">{lead.name}</h1>
                <Badge
                  variant={
                    LEAD_STATUS_VARIANT[lead.status as LeadStatus] ?? "muted"
                  }
                >
                  {LEAD_STATUS_LABEL[lead.status as LeadStatus] ?? lead.status}
                </Badge>
                {noWeb && (
                  <Badge variant="danger" className="gap-1">
                    <GlobeLock className="size-3" /> Websitesiz
                  </Badge>
                )}
                {lead.emailLogs.length > 0 && (
                  <Badge variant="success" className="gap-1">
                    <Mail className="size-3" />
                    Mail gönderildi ({lead.emailLogs.length})
                  </Badge>
                )}
              </div>
              {lead.category && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {lead.category}
                </p>
              )}
            </div>
            {lead.rating != null && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="size-4 fill-amber-400 text-amber-400" />
                <span className="font-medium">{lead.rating}</span>
                <span className="text-muted-foreground">
                  ({lead.reviewsCount ?? 0})
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<Phone className="size-4" />} label="Telefon">
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="hover:underline">
                {lead.phone}
              </a>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow icon={<Mail className="size-4" />} label="E-posta">
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className="hover:underline">
                {lead.email}
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </InfoRow>
          <InfoRow
            icon={
              noWeb ? <GlobeLock className="size-4" /> : <Globe className="size-4" />
            }
            label="Website"
          >
            {lead.website ? (
              <a
                href={lead.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {lead.website}
              </a>
            ) : (
              <span className="text-rose-600">Yok — site teklifi için ideal!</span>
            )}
          </InfoRow>
          <InfoRow icon={<MapPin className="size-4" />} label="Adres">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {[lead.address, lead.city, lead.country]
                .filter(Boolean)
                .join(", ") || "Maps'te ara"}
            </a>
          </InfoRow>
          <InfoRow icon={<ActivityIcon className="size-4" />} label="Kaynak">
            {lead.source}
          </InfoRow>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activities */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Aktivite zaman çizelgesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ActivityForm leadId={lead.id} />
            <div className="space-y-4 border-t pt-4">
              {lead.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Henüz aktivite yok. Yukarıdan ilkini ekle.
                </p>
              ) : (
                lead.activities.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.type] ?? MessageSquare;
                  return (
                    <div key={a.id} className="flex gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted">
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium capitalize">
                            {a.type === "status_change"
                              ? "Durum değişimi"
                              : a.type}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(a.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                          {a.content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notes & Projects */}
        <div className="space-y-6">
          {lead.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notlar</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                {lead.notes}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Projeler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lead.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Bu lead için henüz proje yok.
                </p>
              ) : (
                lead.projects.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-md border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{p.title}</div>
                      {p.aiModel && (
                        <Badge variant="info" className="gap-1 text-[10px]">
                          AI
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.status}
                    </div>
                    {p.generatedHtml && (
                      <a
                        href={`/preview/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-primary hover:underline"
                      >
                        Website&apos;yi önizle →
                      </a>
                    )}
                  </div>
                ))
              )}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/projects/new?leadId=${lead.id}`}>
                  + Yeni proje
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div>{children}</div>
      </div>
    </div>
  );
}
