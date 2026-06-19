"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Trash2,
  Download,
  Mail,
  Globe,
  GlobeLock,
  Phone,
  MapPin,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Play,
  Square,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  LEAD_STATUS_VARIANT,
  hasNoWebsite,
  type LeadStatus,
} from "@/lib/domain";
import { SECTORS } from "@/lib/geo-data";
import {
  bulkDeleteLeads,
  bulkUpdateStatus,
  updateLeadStatus,
} from "../actions";
import { sendBulkOutreach } from "../../settings/actions";
import {
  DEFAULT_BATCH_MAX,
  DEFAULT_BATCH_MIN,
  getAutomationSnapshot,
  startAutomation,
  stopAutomation,
  subscribeAutomation,
  type AutomationSnapshot,
} from "./automation-engine";

type Lead = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: string;
  rating: number | null;
  reviewsCount: number | null;
  createdAt: Date;
};

type SortKey = "name" | "city" | "category" | "status" | "rating" | "createdAt";
type SortDir = "asc" | "desc";

export function LeadsTable({
  leads,
  demoMode = false,
}: {
  leads: Lead[];
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [emailFilter, setEmailFilter] = useState<string>("all");
  const [websiteFilter, setWebsiteFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [automation, setAutomation] = useState<AutomationSnapshot>(
    getAutomationSnapshot(),
  );
  const [automationMinBatch, setAutomationMinBatch] = useState(String(DEFAULT_BATCH_MIN));
  const [automationMaxBatch, setAutomationMaxBatch] = useState(String(DEFAULT_BATCH_MAX));

  useEffect(() => subscribeAutomation(setAutomation), []);

  const onStartAutomation = async () => {
    const result = await startAutomation({
      minBatch: Number(automationMinBatch),
      maxBatch: Number(automationMaxBatch),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Otomasyon arka planda başlatıldı");
  };

  const onStopAutomation = () => {
    stopAutomation("Kullanıcı otomasyonu durdurdu.");
    toast.message("Otomasyon durduruldu");
    router.refresh();
  };

  const cities = Array.from(
    new Set(leads.map((l) => l.city).filter(Boolean) as string[]),
  ).sort();

  const categories = Array.from(SECTORS);

  let filtered = leads.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (cityFilter !== "all" && l.city !== cityFilter) return false;
    if (categoryFilter !== "all" && l.category !== categoryFilter) return false;
    if (emailFilter === "yes" && !l.email) return false;
    if (emailFilter === "no" && l.email) return false;
    if (websiteFilter === "no" && !hasNoWebsite(l.website)) return false;
    if (websiteFilter === "yes" && hasNoWebsite(l.website)) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [l.name, l.category, l.city, l.phone].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), "tr");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const allSelected =
    filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filtered.forEach((l) => next.delete(l.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filtered.forEach((l) => next.add(l.id));
      setSelected(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const exportUrl = () => {
    const params = new URLSearchParams();
    if (selected.size > 0) {
      selected.forEach((id) => params.append("id", id));
    } else {
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (websiteFilter === "no") params.set("noWebsite", "1");
    }
    const qs = params.toString();
    return `/api/export/leads${qs ? `?${qs}` : ""}`;
  };

  const onBulkDelete = () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} lead silinecek. Emin misin?`)) return;
    const ids = Array.from(selected);
    start(async () => {
      const res = await bulkDeleteLeads(ids);
      if (res.ok) {
        toast.success(`${res.count} lead silindi`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const onBulkStatus = () => {
    if (!bulkStatus || selected.size === 0) return;
    const ids = Array.from(selected);
    start(async () => {
      const res = await bulkUpdateStatus(ids, bulkStatus);
      if ("ok" in res && res.ok) {
        toast.success(`${ids.length} lead güncellendi`);
        setSelected(new Set());
        setBulkStatus("");
        router.refresh();
      } else if ("error" in res) {
        toast.error(res.error);
      }
    });
  };

  const onBulkOutreach = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    start(async () => {
      const res = await sendBulkOutreach(ids);
      if (res.sent > 0) {
        toast.success(`${res.sent} işletmeye tanıtım maili gönderildi`);
      }
      if (res.skipped > 0) {
        toast.warning(`${res.skipped} işletme atlandı (e-posta yok)`);
      }
      if (res.failed > 0) {
        toast.error(`${res.failed} işletmede gönderim başarısız`);
      }
      router.refresh();
    });
  };

  const onStatusChange = (id: string, status: string) => {
    start(async () => {
      const res = await updateLeadStatus(id, status);
      if ("ok" in res) {
        toast.success("Durum güncellendi");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Ara: işletme, kategori, şehir, telefon…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Şehir" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm şehirler</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm kategoriler</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={websiteFilter} onValueChange={setWebsiteFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm websiteler</SelectItem>
            <SelectItem value="no">Sadece websitesiz</SelectItem>
            <SelectItem value="yes">Sadece website olanlar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={emailFilter} onValueChange={setEmailFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm e-postalar</SelectItem>
            <SelectItem value="yes">E-posta var</SelectItem>
            <SelectItem value="no">E-posta yok</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filtered.length} / {leads.length}
          </span>
          <Button asChild variant="outline" size="sm">
            <a href={exportUrl()}>
              <Download className="size-4" />
              Excel{selected.size > 0 ? ` (${selected.size})` : ""}
            </a>
          </Button>
        </div>
      </div>

      {!demoMode && (
      <div className="rounded-md border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">SMTP Otomasyonu</span>
          <Input
            type="number"
            min={15}
            max={25}
            value={automationMinBatch}
            onChange={(e) => setAutomationMinBatch(e.target.value)}
            className="h-9 w-[92px]"
            aria-label="Min batch"
          />
          <Input
            type="number"
            min={15}
            max={25}
            value={automationMaxBatch}
            onChange={(e) => setAutomationMaxBatch(e.target.value)}
            className="h-9 w-[92px]"
            aria-label="Max batch"
          />
          {!automation.running ? (
            <Button size="sm" onClick={() => void onStartAutomation()}>
              <Play className="size-4" />
              Otomasyonu Başlat
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={onStopAutomation}
            >
              <Square className="size-4" />
              Durdur
            </Button>
          )}

          <span className="text-xs text-muted-foreground">
            Profil sayısı: {automation.profilesCount}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{automation.status}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Gönderilen: {automation.stats.sent} • Hata: {automation.stats.failed} • Atlanan: {automation.stats.skipped} • Döngü: {automation.stats.cycles}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Akış: Her SMTP için {automationMinBatch}-{automationMaxBatch} lead, profil geçişinde 3 dk, tur tamamlanınca 5 dk bekler.
        </p>
      </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {selected.size} seçildi
          </span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Durumu değiştir…" />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {LEAD_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            disabled={!bulkStatus || pending}
            onClick={onBulkStatus}
          >
            Uygula
          </Button>
          {!demoMode && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={onBulkOutreach}
            >
              <Mail className="size-4" />
              Seçilene mail gönder
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={onBulkDelete}
          >
            <Trash2 className="size-4" />
            Sil
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Temizle
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onChange={toggleAll} />
              </TableHead>
              <SortableHead
                label="İşletme"
                k="name"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <SortableHead
                label="Kategori"
                k="category"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <SortableHead
                label="Şehir"
                k="city"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <TableHead>İletişim</TableHead>
              <TableHead>Website</TableHead>
              <SortableHead
                label="Puan"
                k="rating"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <TableHead>Durum</TableHead>
              <TableHead className="text-right">Aksiyon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableEmpty colSpan={9}>
                Lead bulunamadı. Filtreleri değiştir veya yeni bir tane ekle.
              </TableEmpty>
            ) : (
              filtered.map((l) => {
                const noWeb = hasNoWebsite(l.website);
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(l.id)}
                        onChange={() => toggleOne(l.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/leads/${l.id}`}
                        className="hover:underline"
                      >
                        {l.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.category ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.city ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" />
                          {l.city}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {l.phone ? (
                        <a
                          href={`tel:${l.phone}`}
                          className="inline-flex items-center gap-1 text-sm hover:underline"
                        >
                          <Phone className="size-3" />
                          {l.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {noWeb ? (
                        <Badge variant="danger" className="gap-1">
                          <GlobeLock className="size-3" /> Yok
                        </Badge>
                      ) : (
                        <a
                          href={l.website!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm hover:underline"
                        >
                          <Globe className="size-3" />
                          var
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.rating != null ? `★ ${l.rating}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={l.status}
                        onValueChange={(v) => onStatusChange(l.id, v)}
                      >
                        <SelectTrigger className="h-8 w-[140px] border-none bg-transparent p-0 hover:bg-accent">
                          <Badge
                            variant={
                              LEAD_STATUS_VARIANT[l.status as LeadStatus] ??
                              "muted"
                            }
                          >
                            {LEAD_STATUS_LABEL[l.status as LeadStatus] ??
                              l.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {LEAD_STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/leads/${l.id}`}>Detay</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortableHead({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableHead>
      <button
        onClick={() => onClick(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {active &&
          (sortDir === "asc" ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          ))}
      </button>
    </TableHead>
  );
}
