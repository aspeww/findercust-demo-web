import type { BadgeProps } from "@/components/ui/badge";

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "interested",
  "negotiating",
  "won",
  "lost",
  "archived",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Yeni",
  contacted: "İletişim",
  interested: "İlgili",
  negotiating: "Pazarlık",
  won: "Kazanıldı",
  lost: "Kaybedildi",
  archived: "Arşiv",
};

export const LEAD_STATUS_VARIANT: Record<LeadStatus, BadgeProps["variant"]> = {
  new: "info",
  contacted: "muted",
  interested: "warning",
  negotiating: "warning",
  won: "success",
  lost: "danger",
  archived: "outline",
};

export const PROJECT_STATUSES = [
  "draft",
  "in_progress",
  "review",
  "delivered",
  "cancelled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Taslak",
  in_progress: "Yapımda",
  review: "İncelemede",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

export const PROJECT_STATUS_VARIANT: Record<
  ProjectStatus,
  BadgeProps["variant"]
> = {
  draft: "muted",
  in_progress: "info",
  review: "warning",
  delivered: "success",
  cancelled: "danger",
};

export const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  note: "Not",
  call: "Arama",
  email: "E-posta",
  status_change: "Durum değişimi",
  meeting: "Toplantı",
};

export function formatTRY(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function hasNoWebsite(website: string | null | undefined): boolean {
  return !website || website.trim() === "";
}
