import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultBodyTemplate } from "@/lib/mail";
import type { SmtpProfile } from "./actions";
import { SettingsForm } from "./_components/settings-form";

export const dynamic = "force-dynamic";

function parseSmtpProfiles(raw: string | null | undefined): SmtpProfile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          id: typeof row.id === "string" ? row.id : "",
          name: typeof row.name === "string" ? row.name : "",
          smtpHost: typeof row.smtpHost === "string" ? row.smtpHost : "",
          smtpPort: typeof row.smtpPort === "number" ? row.smtpPort : 587,
          smtpSecure: Boolean(row.smtpSecure),
          smtpUser: typeof row.smtpUser === "string" ? row.smtpUser : "",
          smtpPass: typeof row.smtpPass === "string" ? row.smtpPass : "",
          fromEmail: typeof row.fromEmail === "string" ? row.fromEmail : "",
          fromName:
            typeof row.fromName === "string"
              ? row.fromName
              : row.fromName == null
                ? null
                : null,
          replyTo:
            typeof row.replyTo === "string"
              ? row.replyTo
              : row.replyTo == null
                ? null
                : null,
          createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
        } satisfies SmtpProfile;
      })
      .filter((item) => item.id && item.name && item.smtpHost && item.smtpUser && item.fromEmail);
  } catch {
    return [];
  }
}

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const setting = await prisma.mailSetting.findUnique({
    where: { userId: session.user.id },
  });
  const smtpProfiles = parseSmtpProfiles(setting?.smtpProfilesJson);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ayarlar</h1>
        <p className="text-sm text-muted-foreground">
          SMTP yapılandırman + işletmelere otomatik gönderilecek mail şablonu.
        </p>
      </div>

      <SettingsForm
        initial={{
          smtpHost: setting?.smtpHost ?? "",
          smtpPort: setting?.smtpPort ?? 587,
          smtpSecure: setting?.smtpSecure ?? false,
          smtpUser: setting?.smtpUser ?? "",
          smtpPass: setting?.smtpPass ?? "",
          fromEmail: setting?.fromEmail ?? "",
          fromName: setting?.fromName ?? "",
          replyTo: setting?.replyTo ?? "",
          signature: setting?.signature ?? "",
          defaultSubject:
            setting?.defaultSubject ?? "İşletmenize özel web sitesi teklifi",
          defaultBody: setting?.defaultBody ?? getDefaultBodyTemplate(),
          activeSmtpProfileId: setting?.activeSmtpProfileId ?? null,
          smtpProfiles,
        }}
      />
    </div>
  );
}
