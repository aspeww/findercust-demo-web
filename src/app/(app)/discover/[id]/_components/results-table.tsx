"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  X,
  ExternalLink,
  Eye,
  Phone as PhoneIcon,
  AtSign,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LEAD_STATUS_LABEL,
  LEAD_STATUS_VARIANT,
  formatDate,
  type LeadStatus,
} from "@/lib/domain";
import { importSearchResults } from "../../actions";
import type { SearchResult } from "../../actions";

const PAGE_SIZE = 20;

type Props = {
  searchId: string;
  results: SearchResult[];
  createdAt: Date;
};

export function ResultsTable({ searchId, results, createdAt }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [webFilter, setWebFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [revealedPhones, setRevealedPhones] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let arr = results;
    if (q.trim()) {
      const needle = q.toLowerCase();
      arr = arr.filter(
        (r) =>
          r.name.toLowerCase().includes(needle) ||
          r.phone?.toLowerCase().includes(needle) ||
          r.email?.toLowerCase().includes(needle) ||
          r.address.toLowerCase().includes(needle),
      );
    }
    if (statusFilter !== "all") {
      arr = arr.filter((r) => r.status === statusFilter);
    }
    if (webFilter === "yes") arr = arr.filter((r) => !!r.website);
    if (webFilter === "no") arr = arr.filter((r) => !r.website);
    return arr;
  }, [results, q, statusFilter, webFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filteredIds = filtered.map((r) => r.placeId);

  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const allPageSelected =
    pageItems.length > 0 && pageItems.every((r) => selected.has(r.placeId));

  const toggleAll = () => {
    if (allPageSelected) {
      const next = new Set(selected);
      pageItems.forEach((r) => next.delete(r.placeId));
      setSelected(next);
    } else {
      const next = new Set(selected);
      pageItems.forEach((r) => next.add(r.placeId));
      setSelected(next);
    }
  };
  const toggleAllFiltered = () => {
    if (allFilteredSelected) {
      const next = new Set(selected);
      filteredIds.forEach((id) => next.delete(id));
      setSelected(next);
      return;
    }
    const next = new Set(selected);
    filteredIds.forEach((id) => next.add(id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const revealPhone = (id: string) => {
    setRevealedPhones((prev) => new Set(prev).add(id));
  };

  const onImport = () => {
    if (selected.size === 0) {
      toast.warning("Önce işletme seç");
      return;
    }
    start(async () => {
      const res = await importSearchResults(searchId, Array.from(selected));
      toast.success(`${res.imported} işletme leads'e eklendi`);
      setSelected(new Set());
      router.refresh();
    });
  };

  const exportUrl = (fmt: "csv" | "xlsx") =>
    `/api/discover/${searchId}/export?format=${fmt}`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div>
            <div className="text-sm font-semibold">Leadler</div>
            <div className="text-xs text-muted-foreground">
              {filtered.length} / {results.length} sonuç
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={exportUrl("csv")}>
                <Download className="size-4" /> CSV
              </a>
            </Button>
            <Button asChild size="sm">
              <a href={exportUrl("xlsx")}>
                <Download className="size-4" /> XLSX
              </a>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid gap-3 border-b p-4 sm:grid-cols-3">
          <Input
            placeholder="Ara: isim, telefon, e-posta…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm durumlar</SelectItem>
              <SelectItem value="new">Yeni</SelectItem>
              <SelectItem value="contacted">İletişimde</SelectItem>
              <SelectItem value="interested">İlgili</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={webFilter}
            onValueChange={(v) => {
              setWebFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Website: tümü</SelectItem>
              <SelectItem value="no">Website: yok</SelectItem>
              <SelectItem value="yes">Website: var</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk action */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between gap-2 border-b bg-accent/30 p-3 text-sm">
            <span>{selected.size} işletme seçili</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={toggleAllFiltered}
              >
                {allFilteredSelected
                  ? "Filtredekileri bırak"
                  : `Filtredeki tümünü seç (${filtered.length})`}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
              >
                Temizle
              </Button>
              <Button size="sm" onClick={onImport} disabled={pending}>
                Leads'e aktar
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allPageSelected}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead>İşletme</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>E-posta</TableHead>
              <TableHead className="text-center">Web</TableHead>
              <TableHead className="text-center">Sosyal</TableHead>
              <TableHead>Adres</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Güncelleme</TableHead>
              <TableHead className="text-right">Detay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableEmpty colSpan={10}>
                Filtreyle eşleşen sonuç yok.
              </TableEmpty>
            ) : (
              pageItems.map((r) => {
                const phoneHidden = !revealedPhones.has(r.placeId);
                return (
                  <TableRow key={r.placeId}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.placeId)}
                        onChange={() => toggleOne(r.placeId)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      {r.phone ? (
                        <button
                          type="button"
                          onClick={() => revealPhone(r.placeId)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs hover:bg-muted/70"
                          title="Telefonu göster"
                        >
                          <PhoneIcon className="size-3" />
                          {phoneHidden
                            ? maskPhone(r.phone)
                            : r.phone}
                          {phoneHidden && <Eye className="size-3" />}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.email ? (
                        <a
                          href={`mailto:${r.email}`}
                          className="text-xs text-primary hover:underline"
                        >
                          {r.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.website ? (
                        <a
                          href={r.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-500 hover:underline"
                        >
                          <Check className="size-4" />
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <X className="mx-auto size-4 text-rose-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.social?.instagram ? (
                        <a
                          href={r.social.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex text-pink-500 hover:opacity-80"
                        >
                          <AtSign className="size-4" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                      {r.address}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          LEAD_STATUS_VARIANT[r.status as LeadStatus] ??
                          "muted"
                        }
                      >
                        {LEAD_STATUS_LABEL[r.status as LeadStatus] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`https://www.google.com/maps/search/${encodeURIComponent(
                          `${r.name} ${r.city}`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Detay
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-3">
            <span className="text-xs text-muted-foreground">
              Sayfa {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function maskPhone(phone: string) {
  // Show first 4 and last 2 digits, mask middle
  const digits = phone.replace(/\s+/g, "");
  if (digits.length < 7) return "•••";
  return `${digits.slice(0, 4)}•••••${digits.slice(-2)}`;
}
