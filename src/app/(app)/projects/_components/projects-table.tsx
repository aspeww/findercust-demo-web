"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ExternalLink, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_VARIANT,
  formatTRY,
  formatDate,
  type ProjectStatus,
} from "@/lib/domain";
import { deleteProject } from "../actions";

type Project = {
  id: string;
  title: string;
  status: string;
  priceCents: number | null;
  liveUrl: string | null;
  generatedHtml: string | null;
  aiModel: string | null;
  createdAt: Date;
  lead: { id: string; name: string };
};

export function ProjectsTable({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onDelete = (id: string) => {
    if (!confirm("Proje silinecek. Emin misin?")) return;
    start(async () => {
      await deleteProject(id);
      toast.success("Proje silindi");
      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Başlık</TableHead>
            <TableHead>İşletme</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Fiyat</TableHead>
            <TableHead>Canlı URL</TableHead>
            <TableHead>Oluşturulma</TableHead>
            <TableHead className="text-right">Aksiyon</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.length === 0 ? (
            <TableEmpty colSpan={7}>
              Henüz proje yok. Bir lead'i kazandığında "Yeni Proje" ile ekleyebilirsin.
            </TableEmpty>
          ) : (
            projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell>
                  <Link
                    href={`/leads/${p.lead.id}`}
                    className="text-sm hover:underline"
                  >
                    {p.lead.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      PROJECT_STATUS_VARIANT[p.status as ProjectStatus] ??
                      "muted"
                    }
                  >
                    {PROJECT_STATUS_LABEL[p.status as ProjectStatus] ??
                      p.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatTRY(p.priceCents)}</TableCell>
                <TableCell>
                  {p.generatedHtml ? (
                    <a
                      href={`/preview/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <Sparkles className="size-3" /> AI Site
                    </a>
                  ) : p.liveUrl ? (
                    <a
                      href={p.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm hover:underline"
                    >
                      Aç <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(p.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(p.id)}
                    disabled={pending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
