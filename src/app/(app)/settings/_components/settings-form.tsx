"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Send, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  activateSmtpProfile,
  createSmtpProfile,
  saveMailSettings,
  sendTestEmail,
  type SmtpProfile,
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
  activeSmtpProfileId: string | null;
  smtpProfiles: SmtpProfile[];
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const [state, formAction, pending] = useActionState<
    SettingsState,
    FormData
  >(saveMailSettings, undefined);

  const [testTo, setTestTo] = useState("");
  const [testing, startTest] = useTransition();
  const [profiles, setProfiles] = useState<SmtpProfile[]>(initial.smtpProfiles);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(
    initial.activeSmtpProfileId,
  );
  const [profileName, setProfileName] = useState("");
  const [profilePending, startProfileTransition] = useTransition();

  const [smtpHost, setSmtpHost] = useState(initial.smtpHost);
  const [smtpPort, setSmtpPort] = useState(String(initial.smtpPort));
  const [smtpSecure, setSmtpSecure] = useState(initial.smtpSecure);
  const [smtpUser, setSmtpUser] = useState(initial.smtpUser);
  const [smtpPass, setSmtpPass] = useState(initial.smtpPass);
  const [fromEmail, setFromEmail] = useState(initial.fromEmail);
  const [fromName, setFromName] = useState(initial.fromName);
  const [replyTo, setReplyTo] = useState(initial.replyTo);

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

  const currentProfilePayload = () => ({
    smtpHost: smtpHost.trim(),
    smtpPort: Number(smtpPort),
    smtpSecure,
    smtpUser: smtpUser.trim(),
    smtpPass,
    fromEmail: fromEmail.trim(),
    fromName: fromName.trim() || null,
    replyTo: replyTo.trim() || null,
  });

  const loadProfile = (profile: SmtpProfile) => {
    setSmtpHost(profile.smtpHost);
    setSmtpPort(String(profile.smtpPort));
    setSmtpSecure(profile.smtpSecure);
    setSmtpUser(profile.smtpUser);
    setSmtpPass(profile.smtpPass);
    setFromEmail(profile.fromEmail);
    setFromName(profile.fromName ?? "");
    setReplyTo(profile.replyTo ?? "");
  };

  const onCreateProfile = () => {
    if (!profileName.trim()) {
      toast.warning("Profil adı zorunlu");
      return;
    }
    startProfileTransition(async () => {
      const result = await createSmtpProfile({
        name: profileName.trim(),
        ...currentProfilePayload(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const newProfile: SmtpProfile = {
        id: result.activeProfileId,
        name: profileName.trim(),
        ...currentProfilePayload(),
        createdAt: new Date().toISOString(),
      };
      setProfiles((prev) => [newProfile, ...prev]);
      setActiveProfileId(result.activeProfileId);
      setProfileName("");
      toast.success("SMTP profili oluşturuldu ve aktif edildi");
    });
  };

  const onActivateProfile = (profile: SmtpProfile) => {
    startProfileTransition(async () => {
      const result = await activateSmtpProfile(profile.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setActiveProfileId(profile.id);
      loadProfile(profile);
      toast.success(`Aktif profil: ${profile.name}`);
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
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
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
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
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
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
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
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
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
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
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
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromName">Gönderen adı</Label>
              <Input
                id="fromName"
                name="fromName"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Ahmet — FinderCust"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="replyTo">Reply-To (opsiyonel)</Label>
              <Input
                id="replyTo"
                name="replyTo"
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Yeni profil adı (örn: Gmail Satış)"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={onCreateProfile}
                disabled={profilePending}
              >
                {profilePending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Profili oluştur
              </Button>
            </div>

            {profiles.length > 0 ? (
              <div className="grid gap-2">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">{profile.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {profile.fromEmail} • {profile.smtpHost}:{profile.smtpPort}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={activeProfileId === profile.id ? "default" : "outline"}
                      onClick={() => onActivateProfile(profile)}
                      disabled={profilePending}
                    >
                      {activeProfileId === profile.id ? "Aktif" : "Aktif yap"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Henüz profil yok. Üstteki bilgileri doldurup profil oluşturabilirsin.
              </p>
            )}
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
