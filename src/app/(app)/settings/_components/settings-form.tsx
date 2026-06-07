"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  saveMailSettings,
  sendTestEmail,
  type SettingsState,
} from "../actions";

type Initial = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  signature: string;
  defaultSubject: string;
  defaultBody: string;
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<
    SettingsState,
    FormData
  >(saveMailSettings, undefined);

  const [testTo, setTestTo] = useState("");
  const [testing, startTest] = useTransition();

  // Show toast based on action result
  if (state?.ok === true) {
    // fire-and-forget — toast is allowed during render via setTimeout
    setTimeout(() => toast.success("Ayarlar kaydedildi"), 0);
  } else if (state?.ok === false) {
    setTimeout(() => toast.error(state.error), 0);
  }

  const onTest = () => {
    if (!testTo.trim()) {
      toast.warning("Test için bir e-posta gir");
      return;
    }
    startTest(async () => {
      const r = await sendTestEmail(testTo.trim());
      if (r.ok) toast.success("Test maili gönderildi");
      else toast.error(r.error ?? "Gönderilemedi");
    });
  };

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SMTP Yapılandırması</CardTitle>
          <CardDescription>
            Bu bilgilerle işletmelere mail göndereceğiz. Gmail için App Password
            oluşturup smtp.gmail.com:465 (secure) kullanabilirsin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP Host</Label>
              <Input
                id="smtpHost"
                name="smtpHost"
                defaultValue={initial.smtpHost}
                placeholder="smtp.gmail.com"
                required
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-2">
                <Label htmlFor="smtpPort">Port</Label>
                <Input
                  id="smtpPort"
                  name="smtpPort"
                  type="number"
                  defaultValue={initial.smtpPort}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpSecure" className="block">
                  SSL
                </Label>
                <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                  <input
                    id="smtpSecure"
                    name="smtpSecure"
                    type="checkbox"
                    defaultChecked={initial.smtpSecure}
                  />
                  TLS
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpUser">Kullanıcı adı</Label>
              <Input
                id="smtpUser"
                name="smtpUser"
                defaultValue={initial.smtpUser}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPass">Parola / App password</Label>
              <Input
                id="smtpPass"
                name="smtpPass"
                type="password"
                defaultValue={initial.smtpPass}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fromEmail">Gönderen e-posta</Label>
              <Input
                id="fromEmail"
                name="fromEmail"
                type="email"
                defaultValue={initial.fromEmail}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromName">Gönderen adı</Label>
              <Input
                id="fromName"
                name="fromName"
                defaultValue={initial.fromName}
                placeholder="Ahmet — FinderCust"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="replyTo">Reply-To (opsiyonel)</Label>
              <Input
                id="replyTo"
                name="replyTo"
                type="email"
                defaultValue={initial.replyTo}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mail Şablonu</CardTitle>
          <CardDescription>
            Değişkenler:{" "}
            <code className="rounded bg-muted px-1">{"{{name}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{category}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{city}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{phone}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{website}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{websiteStatusLine}}"}</code>{" "}
            <code className="rounded bg-muted px-1">{"{{improvementLine}}"}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultSubject">Konu</Label>
            <Input
              id="defaultSubject"
              name="defaultSubject"
              defaultValue={initial.defaultSubject}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultBody">Mesaj gövdesi</Label>
            <Textarea
              id="defaultBody"
              name="defaultBody"
              rows={14}
              defaultValue={initial.defaultBody}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signature">İmza (her maile eklenir)</Label>
            <Textarea
              id="signature"
              name="signature"
              rows={4}
              defaultValue={initial.signature}
              placeholder="--&#10;Ad Soyad&#10;FinderCust&#10;web@findercust.com"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Test için e-posta…"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            type="email"
            className="w-64"
          />
          <Button
            type="button"
            variant="outline"
            onClick={onTest}
            disabled={testing}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Test maili gönder
          </Button>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Kaydet
        </Button>
      </div>
    </form>
  );
}
