"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  bodyToHtml,
  getDefaultBodyTemplate,
  renderEmailBody,
  sendMail,
  type MailerConfig,
} from "@/lib/mail";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const settingsSchema = z.object({
  smtpHost: z.string().trim().min(1, "SMTP sunucusu zorunlu"),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.coerce.boolean().optional().default(false),
  smtpUser: z.string().trim().min(1, "Kullanıcı adı zorunlu"),
  smtpPass: z.string().min(1, "Parola zorunlu"),
  fromEmail: z.string().email("Geçerli bir e-posta gir"),
  fromName: z.string().trim().optional().nullable(),
  replyTo: z.string().email().optional().or(z.literal("")).nullable(),
  signature: z.string().trim().optional().nullable(),
  defaultSubject: z.string().trim().optional().nullable(),
  defaultBody: z.string().trim().optional().nullable(),
});

export type SettingsState =
  | { ok: true }
  | { ok: false; error: string }
  | undefined;

export async function saveMailSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const userId = await requireUserId();
  const raw = Object.fromEntries(formData.entries());
  const parsed = settingsSchema.safeParse({
    ...raw,
    smtpSecure: raw.smtpSecure === "on" || raw.smtpSecure === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz veri" };
  }
  const data = parsed.data;
  await prisma.mailSetting.upsert({
    where: { userId },
    update: {
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      smtpUser: data.smtpUser,
      smtpPass: data.smtpPass,
      fromEmail: data.fromEmail,
      fromName: data.fromName ?? null,
      replyTo: data.replyTo || null,
      signature: data.signature ?? null,
      defaultSubject: data.defaultSubject ?? null,
      defaultBody: data.defaultBody ?? null,
    },
    create: {
      userId,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      smtpSecure: data.smtpSecure,
      smtpUser: data.smtpUser,
      smtpPass: data.smtpPass,
      fromEmail: data.fromEmail,
      fromName: data.fromName ?? null,
      replyTo: data.replyTo || null,
      signature: data.signature ?? null,
      defaultSubject: data.defaultSubject ?? null,
      defaultBody: data.defaultBody ?? null,
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function sendTestEmail(toEmail: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const userId = await requireUserId();
  const setting = await prisma.mailSetting.findUnique({ where: { userId } });
  if (!setting?.smtpHost || !setting?.smtpUser || !setting?.smtpPass || !setting?.fromEmail) {
    return { ok: false, error: "Önce SMTP ayarlarını kaydet" };
  }
  const cfg: MailerConfig = {
    host: setting.smtpHost,
    port: setting.smtpPort ?? 587,
    secure: setting.smtpSecure,
    user: setting.smtpUser,
    pass: setting.smtpPass,
    fromEmail: setting.fromEmail,
    fromName: setting.fromName,
    replyTo: setting.replyTo,
  };
  const res = await sendMail(cfg, {
    to: toEmail,
    subject: "FinderCust SMTP test",
    text: "Bu bir test mesajıdır. SMTP yapılandırman çalışıyor.",
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export type OutreachInput = {
  leadId: string;
  toEmail?: string;
  subject?: string;
  body?: string;
};

export type OutreachResult =
  | { ok: true; logId: string }
  | { ok: false; error: string };

export async function sendOutreachEmail(
  input: OutreachInput,
): Promise<OutreachResult> {
  const userId = await requireUserId();
  const setting = await prisma.mailSetting.findUnique({ where: { userId } });
  if (!setting?.smtpHost || !setting?.smtpUser || !setting?.smtpPass || !setting?.fromEmail) {
    return { ok: false, error: "Önce SMTP ayarlarını kaydet (/settings)" };
  }
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, ownerId: userId },
  });
  if (!lead) return { ok: false, error: "Lead bulunamadı" };
  const to = (input.toEmail || lead.email || "").trim();
  if (!to) return { ok: false, error: "Lead'in e-posta adresi yok" };

  const subject =
    input.subject?.trim() ||
    setting.defaultSubject?.trim() ||
    "İşletmenize özel web sitesi teklifi";
  const text = input.body?.trim()
    ? input.body.trim()
    : renderEmailBody(setting.defaultBody, lead, setting.signature);

  const cfg: MailerConfig = {
    host: setting.smtpHost,
    port: setting.smtpPort ?? 587,
    secure: setting.smtpSecure,
    user: setting.smtpUser,
    pass: setting.smtpPass,
    fromEmail: setting.fromEmail,
    fromName: setting.fromName,
    replyTo: setting.replyTo,
  };
  const res = await sendMail(cfg, { to, subject, text });

  const log = await prisma.emailLog.create({
    data: {
      leadId: lead.id,
      userId,
      toEmail: to,
      fromEmail: setting.fromEmail,
      subject,
      body: text,
      status: res.ok ? "sent" : "failed",
      error: res.ok ? null : res.error,
      messageId: res.ok ? res.messageId : null,
    },
  });

  if (res.ok) {
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        userId,
        type: "email",
        content: `Mail gönderildi: ${subject} → ${to}`,
      },
    });
    if (lead.status === "new") {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "contacted" },
      });
    }
  }

  revalidatePath(`/leads/${lead.id}`);
  return res.ok
    ? { ok: true, logId: log.id }
    : { ok: false, error: res.error };
}

export type BulkOutreachResult = {
  sent: number;
  failed: number;
  skipped: number;
  errors: { leadId: string; error: string }[];
};

export async function sendBulkOutreach(
  leadIds: string[],
  overrides?: { subject?: string; body?: string },
): Promise<BulkOutreachResult> {
  const result: BulkOutreachResult = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
  for (const leadId of leadIds) {
    const r = await sendOutreachEmail({
      leadId,
      subject: overrides?.subject,
      body: overrides?.body,
    });
    if (r.ok) result.sent++;
    else if (r.error.includes("e-posta adresi yok")) {
      result.skipped++;
    } else {
      result.failed++;
      result.errors.push({ leadId, error: r.error });
    }
  }
  return result;
}

export async function getOutreachPreview(leadId: string): Promise<{
  subject: string;
  body: string;
  htmlPreview: string;
  to: string;
  hasSettings: boolean;
}> {
  const userId = await requireUserId();
  const setting = await prisma.mailSetting.findUnique({ where: { userId } });
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ownerId: userId },
  });
  if (!lead) throw new Error("Lead bulunamadı");
  const subject =
    setting?.defaultSubject?.trim() || "İşletmenize özel web sitesi teklifi";
  const body = renderEmailBody(
    setting?.defaultBody ?? getDefaultBodyTemplate(),
    lead,
    setting?.signature,
  );
  return {
    subject,
    body,
    htmlPreview: bodyToHtml(body),
    to: lead.email ?? "",
    hasSettings: !!(setting?.smtpHost && setting?.smtpUser && setting?.smtpPass && setting?.fromEmail),
  };
}
