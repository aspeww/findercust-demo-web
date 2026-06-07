"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Phone, Globe, GlobeLock, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  hasNoWebsite,
  type LeadStatus,
} from "@/lib/domain";
import { updateLeadStatus } from "../../leads/actions";

type Lead = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  status: string;
};

const COLUMNS: LeadStatus[] = [
  "new",
  "contacted",
  "interested",
  "negotiating",
  "won",
  "lost",
];

const COLUMN_RING: Record<LeadStatus, string> = {
  new: "ring-sky-200",
  contacted: "ring-zinc-200",
  interested: "ring-amber-200",
  negotiating: "ring-amber-300",
  won: "ring-emerald-200",
  lost: "ring-rose-200",
  archived: "ring-zinc-200",
};

export function PipelineBoard({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onChange = (id: string, status: string) => {
    start(async () => {
      const res = await updateLeadStatus(id, status);
      if ("ok" in res) {
        toast.success("Taşındı");
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const grouped: Record<string, Lead[]> = {};
  for (const c of COLUMNS) grouped[c] = [];
  for (const l of leads) {
    if (grouped[l.status]) grouped[l.status].push(l);
  }

  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {COLUMNS.map((col) => (
        <div
          key={col}
          className={`rounded-xl border bg-muted/30 p-3 ring-2 ring-inset ${COLUMN_RING[col]}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{LEAD_STATUS_LABEL[col]}</h3>
            <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {grouped[col].length}
            </span>
          </div>
          <div className="space-y-2">
            {grouped[col].length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                Boş
              </p>
            ) : (
              grouped[col].map((l) => {
                const noWeb = hasNoWebsite(l.website);
                return (
                  <div
                    key={l.id}
                    className="rounded-lg border bg-card p-3 shadow-sm"
                  >
                    <Link
                      href={`/leads/${l.id}`}
                      className="block text-sm font-medium hover:underline"
                    >
                      {l.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {l.category && <span>{l.category}</span>}
                      {l.city && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="size-3" />
                          {l.city}
                        </span>
                      )}
                      {l.phone && (
                        <span className="inline-flex items-center gap-0.5">
                          <Phone className="size-3" />
                          {l.phone.split(" ").slice(0, 2).join(" ")}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5">
                        {noWeb ? (
                          <>
                            <GlobeLock className="size-3 text-rose-500" />
                            <span className="text-rose-600">site yok</span>
                          </>
                        ) : (
                          <>
                            <Globe className="size-3 text-emerald-500" />
                            site var
                          </>
                        )}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Select
                        value={l.status}
                        onValueChange={(v) => onChange(l.id, v)}
                        disabled={pending}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {LEAD_STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
