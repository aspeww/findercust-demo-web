"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Loader2, ExternalLink, Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateWebsiteForLead } from "@/app/(app)/projects/actions";

export function GenerateWebsiteButton({
  leadId,
  hasExisting,
}: {
  leadId: string;
  hasExisting?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<"modern" | "classic" | "bold">("modern");
  const [extra, setExtra] = useState("");
  const [pending, start] = useTransition();
  const [resultId, setResultId] = useState<string | null>(null);

  const onGenerate = () => {
    start(async () => {
      const res = await generateWebsiteForLead(leadId, { style, extra });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResultId(res.projectId);
      toast.success(
        res.model === "template"
          ? "Website üretildi (template — GEMINI_API_KEY ekle gerçek AI için)"
          : `Website üretildi (${res.model})`,
      );
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <Sparkles className="size-4" />
          {hasExisting ? "Yeniden Üret" : "AI ile Website Oluştur"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            AI Website Üreticisi
          </DialogTitle>
          <DialogDescription>
            İşletmenin bilgilerinden tek dosya, hazır kullanıma uygun bir
            website oluşturulur. GEMINI_API_KEY varsa Google Gemini, yoksa
            kaliteli template fallback kullanılır.
          </DialogDescription>
        </DialogHeader>

        {resultId ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm">✅ Website hazır. Şimdi önizleyebilir, kodu düzenleyebilir veya HTML'i indirip VS Code'da açabilirsin.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a
                  href={`/preview/${resultId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" /> Önizle
                </a>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <a href={`/projects/${resultId}/edit`}>
                  <Pencil className="size-4" /> Düzenle
                </a>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
              >
                <a href={`/api/preview/${resultId}/download`}>
                  <Download className="size-4" /> HTML İndir
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stil</Label>
              <Select
                value={style}
                onValueChange={(v) => setStyle(v as typeof style)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern (varsayılan)</SelectItem>
                  <SelectItem value="classic">Klasik</SelectItem>
                  <SelectItem value="bold">Cesur / Renkli</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra">Ek talimat (opsiyonel)</Label>
              <Textarea
                id="extra"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="Örn: 'rezervasyon butonu olsun', 'mavi-beyaz tema'…"
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {resultId ? (
            <Button
              variant="outline"
              onClick={() => {
                setResultId(null);
                setOpen(false);
              }}
            >
              Kapat
            </Button>
          ) : (
            <Button onClick={onGenerate} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Üretiliyor…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Üret
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
