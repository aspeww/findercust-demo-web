"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, Loader2, Send } from "lucide-react";
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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getOutreachPreview,
  sendOutreachEmail,
} from "@/app/(app)/settings/actions";

type SmtpProfileOption = {
  id: string;
  name: string;
  fromEmail: string;
};

export function OutreachButton({
  leadId,
  defaultEmail,
}: {
  leadId: string;
  defaultEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasSettings, setHasSettings] = useState(true);
  const [to, setTo] = useState(defaultEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [smtpProfiles, setSmtpProfiles] = useState<SmtpProfileOption[]>([]);
  const [selectedSmtpProfileId, setSelectedSmtpProfileId] = useState<string | null>(
    null,
  );
  const [pending, start] = useTransition();

  const selectedSmtpValue = selectedSmtpProfileId ?? "default";

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      try {
        const p = await getOutreachPreview(leadId);
        setSubject(p.subject);
        setBody(p.body);
        setTo((prev) => prev || p.to);
        setHasSettings(p.hasSettings);
        setSmtpProfiles(p.smtpProfiles);
        setSelectedSmtpProfileId(p.selectedSmtpProfileId);
        setLoaded(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Önizleme alınamadı");
      }
    })();
  }, [open, loaded, leadId]);

  const onSend = () => {
    if (!to.trim()) {
      toast.warning("Alıcı e-posta gerekli");
      return;
    }
    start(async () => {
      const r = await sendOutreachEmail({
        leadId,
        smtpProfileId: selectedSmtpProfileId ?? undefined,
        toEmail: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      if (r.ok) {
        toast.success("Mail gönderildi");
        setOpen(false);
      } else {
        toast.error(r.error);
      }
    });
  };

  const onSmtpProfileChange = (value: string) => {
    const nextProfileId = value === "default" ? null : value;
    setSelectedSmtpProfileId(nextProfileId);
    start(async () => {
      const p = await getOutreachPreview(leadId, nextProfileId ?? undefined);
      setHasSettings(p.hasSettings);
      setSmtpProfiles(p.smtpProfiles);
      setSelectedSmtpProfileId(p.selectedSmtpProfileId);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <Mail className="size-4" />
          Mail Gönder
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            Otomatik Tanıtım Maili
          </DialogTitle>
          <DialogDescription>
            İşletmeye, web sitesi teklifi içeren profesyonel bir mail gönder.
            Şablon ve gönderici bilgileri Ayarlar&apos;dan yönetilir.
          </DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasSettings ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium text-amber-300">
              SMTP ayarları eksik
            </p>
            <p className="mt-1 text-muted-foreground">
              Mail gönderebilmek için önce{" "}
              <a href="/settings" className="text-primary underline">
                Ayarlar
              </a>{" "}
              sayfasından SMTP yapılandırmanı kaydet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="smtpProfile">SMTP Profili</Label>
              <Select value={selectedSmtpValue} onValueChange={onSmtpProfileChange}>
                <SelectTrigger id="smtpProfile">
                  <SelectValue placeholder="Profil seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Varsayılan SMTP</SelectItem>
                  {smtpProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name} ({profile.fromEmail})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Alıcı</Label>
              <Input
                id="to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="info@isletme.com"
              />
              {!defaultEmail && !to && (
                <p className="text-xs text-amber-400">
                  Bu lead&apos;in kayıtlı e-postası yok — manuel girmen gerek.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Konu</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Mesaj</Label>
              <Textarea
                id="body"
                rows={14}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Düzenleyebilirsin. Boşluk varsa otomatik şablon kullanılır.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            İptal
          </Button>
          <Button
            onClick={onSend}
            disabled={pending || !loaded || !hasSettings}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
