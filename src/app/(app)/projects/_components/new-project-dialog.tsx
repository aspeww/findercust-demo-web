"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
} from "@/lib/domain";
import { createProject } from "../actions";

type Lead = { id: string; name: string };

export function NewProjectDialog({
  leads,
  defaultLeadId,
  open: controlledOpen,
  onOpenChange,
}: {
  leads: Lead[];
  defaultLeadId?: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [pending, start] = useTransition();
  const [status, setStatus] = useState("draft");
  const [leadId, setLeadId] = useState<string>(defaultLeadId ?? leads[0]?.id ?? "");

  const onSubmit = (formData: FormData) => {
    formData.set("status", status);
    formData.set("leadId", leadId);
    start(async () => {
      const res = await createProject(formData);
      if ("ok" in res) {
        toast.success("Proje eklendi");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlledOpen && (
        <DialogTrigger asChild>
          <Button size="sm" disabled={leads.length === 0}>
            <Plus className="size-4" /> Yeni Proje
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Yeni Proje</DialogTitle>
          <DialogDescription>
            Bir lead'e bağlı website projesi oluştur.
          </DialogDescription>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>Lead *</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Lead seç" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Başlık *</Label>
            <Input
              id="title"
              name="title"
              required
              placeholder="Kurumsal Website"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Durum</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priceTRY">Fiyat (TRY)</Label>
              <Input
                id="priceTRY"
                name="priceTRY"
                type="number"
                min="0"
                placeholder="10000"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="liveUrl">Canlı URL</Label>
            <Input
              id="liveUrl"
              name="liveUrl"
              placeholder="https://…"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                İptal
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !leadId}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
