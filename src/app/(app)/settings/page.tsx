import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultBodyTemplate } from "@/lib/mail";
import { SettingsForm } from "./_components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const setting = await prisma.mailSetting.findUnique({
    where: { userId: session.user.id },
  });

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
        }}
      />
    </div>
  );
}
