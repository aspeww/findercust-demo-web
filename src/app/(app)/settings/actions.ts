"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { demoMutationBlocked, demoMutationError } from "@/lib/demo";
import {
  bodyToHtml,
  getDefaultBodyTemplate,
  renderEmailBody,
  sendMail,
  type MailerConfig,
} from "@/lib/mail";

export type SmtpProfile = {
  id: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  createdAt: string;
};

export type SmtpProfileOption = {
  id: string;
  name: string;
  fromEmail: string;
};

type SmtpCredentials = Pick<
  SmtpProfile,
  | "smtpHost"
  | "smtpPort"
  | "smtpSecure"
  | "smtpUser"
  | "smtpPass"
  | "fromEmail"
  | "fromName"
  | "replyTo"
>;

type SmtpProfileInput = SmtpCredentials & { name: string };

const SMTP_PROFILE_LIMIT = 20;

const smtpProfileSchema = z.object({
  name: z.string().trim().min(1, "Profil adı zorunlu").max(64, "Profil adı çok uzun"),
  smtpHost: z.string().trim().min(1, "SMTP sunucusu zorunlu"),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.coerce.boolean().optional().default(false),
  smtpUser: z.string().trim().min(1, "Kullanıcı adı zorunlu"),
  smtpPass: z.string().min(1, "Parola zorunlu"),
  fromEmail: z.string().email("Geçerli bir e-posta gir"),
  fromName: z.string().trim().optional().nullable(),
  replyTo: z.string().email().optional().or(z.literal("")).nullable(),
});

const storedSmtpProfileSchema = smtpProfileSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().min(1),
});

function parseSmtpProfiles(raw: string | null | undefined): SmtpProfile[] {
  if (!raw) return [];
  try {
    const parsed = storedSmtpProfileSchema.array().safeParse(JSON.parse(raw));
    return parsed.success
      ? parsed.data.map((profile) => ({
          ...profile,
          fromName: profile.fromName ?? null,
          replyTo: profile.replyTo || null,
        }))
      : [];
  } catch {
    return [];
  }
}

function stringifySmtpProfiles(profiles: SmtpProfile[]): string {
  return JSON.stringify(profiles);
}

function toActiveSmtpUpdate(data: {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName?: string | null;
  replyTo?: string | null;
}): SmtpCredentials {
  return {
    smtpHost: data.smtpHost,
    smtpPort: data.smtpPort,
    smtpSecure: data.smtpSecure,
    smtpUser: data.smtpUser,
    smtpPass: data.smtpPass,
    fromEmail: data.fromEmail,
    fromName: data.fromName ?? null,
    replyTo: data.replyTo || null,
  };
}

function getSmtpProfileOptions(setting: {
  smtpProfilesJson?: string | null;
}): SmtpProfileOption[] {
  return parseSmtpProfiles(setting.smtpProfilesJson)
    .filter((profile) => profile.fromEmail.trim())
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      fromEmail: profile.fromEmail,
    }));
}

function resolveMailerConfig(
  setting: {
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean;
    smtpUser: string | null;
    smtpPass: string | null;
    fromEmail: string | null;
    fromName: string | null;
    replyTo: string | null;
    smtpProfilesJson: string | null;
    activeSmtpProfileId: string | null;
  } | null,
  smtpProfileId?: string,
):
  | { ok: false; error: string; selectedProfileId: string | null }
  | { ok: true; cfg: MailerConfig; selectedProfileId: string | null } {
  if (!setting) {
    return { ok: false, error: "Önce SMTP ayarlarını kaydet", selectedProfileId: null };
  }

  const profiles = parseSmtpProfiles(setting.smtpProfilesJson);
  const normalizedProfileId = smtpProfileId?.trim();
  let selectedProfile = normalizedProfileId
    ? profiles.find((profile) => profile.id === normalizedProfileId)
    : undefined;

  if (normalizedProfileId && !selectedProfile) {
    return {
      ok: false,
      error: "Seçilen SMTP profili bulunamadı",
      selectedProfileId: null,
    };
  }

  if (!selectedProfile && setting.activeSmtpProfileId) {
    selectedProfile = profiles.find(
      (profile) => profile.id === setting.activeSmtpProfileId,
    );
  }

  const source = selectedProfile
    ? {
        host: selectedProfile.smtpHost,
        port: selectedProfile.smtpPort,
        secure: selectedProfile.smtpSecure,
        user: selectedProfile.smtpUser,
        pass: selectedProfile.smtpPass,
        fromEmail: selectedProfile.fromEmail,
        fromName: selectedProfile.fromName,
        replyTo: selectedProfile.replyTo,
      }
    : {
        host: setting.smtpHost,
        port: setting.smtpPort ?? 587,
        secure: setting.smtpSecure,
        user: setting.smtpUser,
        pass: setting.smtpPass,
        fromEmail: setting.fromEmail,
        fromName: setting.fromName,
        replyTo: setting.replyTo,
      };

  if (!source.host || !source.user || !source.pass || !source.fromEmail) {
    return {
      ok: false,
      error: "Önce SMTP ayarlarını kaydet",
      selectedProfileId: selectedProfile?.id ?? null,
    };
  }

  return {
    ok: true,
    selectedProfileId: selectedProfile?.id ?? null,
    cfg: {
      host: source.host,
      port: source.port,
      secure: source.secure,
      user: source.user,
      pass: source.pass,
      fromEmail: source.fromEmail,
      fromName: source.fromName,
      replyTo: source.replyTo,
    },
  };
}

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

export type SmtpProfileActionState =
  | { ok: true; activeProfileId: string }
  | { ok: false; error: string };

export async function saveMailSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const blocked = demoMutationBlocked();
  if (blocked) return blocked;
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
  const existingSetting = await prisma.mailSetting.findUnique({ where: { userId } });
  const existingProfiles = parseSmtpProfiles(existingSetting?.smtpProfilesJson);
  const nextProfiles = existingSetting?.activeSmtpProfileId
    ? existingProfiles.map((profile) =>
        profile.id === existingSetting.activeSmtpProfileId
          ? {
              ...profile,
              ...toActiveSmtpUpdate(data),
            }
          : profile,
      )
    : existingProfiles;

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
      smtpProfilesJson: stringifySmtpProfiles(nextProfiles),
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
      smtpProfilesJson: stringifySmtpProfiles(nextProfiles),
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function createSmtpProfile(
  input: unknown,
): Promise<SmtpProfileActionState> {
  const blocked = demoMutationBlocked();
  if (blocked) return blocked;
  const userId = await requireUserId();
  const parsed = smtpProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Geçersiz profil verisi",
    };
  }

  const setting = await prisma.mailSetting.findUnique({ where: { userId } });
  const profiles = parseSmtpProfiles(setting?.smtpProfilesJson);
  if (profiles.length >= SMTP_PROFILE_LIMIT) {
    return { ok: false, error: `En fazla ${SMTP_PROFILE_LIMIT} SMTP profili ekleyebilirsin` };
  }

  const nameLower = parsed.data.name.toLocaleLowerCase("tr");
  const hasSameName = profiles.some(
    (profile) => profile.name.toLocaleLowerCase("tr") === nameLower,
  );
  if (hasSameName) {
    return { ok: false, error: "Aynı isimde profil zaten var" };
  }

  const profile: SmtpProfile = {
    id: crypto.randomUUID(),
    name: parsed.data.name,
    ...toActiveSmtpUpdate(parsed.data),
    createdAt: new Date().toISOString(),
  };

  const nextProfiles = [profile, ...profiles];

  if (setting) {
    await prisma.mailSetting.update({
      where: { userId },
      data: {
        ...toActiveSmtpUpdate(profile),
        activeSmtpProfileId: profile.id,
        smtpProfilesJson: stringifySmtpProfiles(nextProfiles),
      },
    });
  } else {
    await prisma.mailSetting.create({
      data: {
        userId,
        ...toActiveSmtpUpdate(profile),
        activeSmtpProfileId: profile.id,
        smtpProfilesJson: stringifySmtpProfiles(nextProfiles),
      },
    });
  }

  revalidatePath("/settings");
  return { ok: true, activeProfileId: profile.id };
}

export async function activateSmtpProfile(
  profileId: string,
): Promise<SmtpProfileActionState> {
  const blocked = demoMutationBlocked();
  if (blocked) return blocked;
  const userId = await requireUserId();
  const normalizedProfileId = profileId.trim();
  if (!normalizedProfileId) return { ok: false, error: "Profil seçimi geçersiz" };

  const setting = await prisma.mailSetting.findUnique({ where: { userId } });
  if (!setting) return { ok: false, error: "Önce bir SMTP profili oluştur" };

  const profiles = parseSmtpProfiles(setting.smtpProfilesJson);
  const profile = profiles.find((item) => item.id === normalizedProfileId);
  if (!profile) return { ok: false, error: "Profil bulunamadı" };

  await prisma.mailSetting.update({
    where: { userId },
    data: {
      ...toActiveSmtpUpdate(profile),
      activeSmtpProfileId: profile.id,
    },
  });

  revalidatePath("/settings");
  return { ok: true, activeProfileId: profile.id };
}

export async function sendTestEmail(toEmail: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const blocked = demoMutationBlocked();
  if (blocked) return blocked;
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
  smtpProfileId?: string;
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
  const blocked = demoMutationBlocked();
  if (blocked) return blocked;
  const userId = await requireUserId();
  const setting = await prisma.mailSetting.findUnique({ where: { userId } });
  const resolvedMailer = resolveMailerConfig(setting, input.smtpProfileId);
  if (!resolvedMailer.ok) {
    return { ok: false, error: `${resolvedMailer.error} (/settings)` };
  }
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, ownerId: userId },
  });
  if (!lead) return { ok: false, error: "Lead bulunamadı" };
  const to = (input.toEmail || lead.email || "").trim();
  if (!to) return { ok: false, error: "Lead'in e-posta adresi yok" };

  const subject =
    input.subject?.trim() ||
    setting?.defaultSubject?.trim() ||
    "İşletmenize özel web sitesi teklifi";
  const text = input.body?.trim()
    ? input.body.trim()
    : renderEmailBody(setting?.defaultBody, lead, setting?.signature);

  const res = await sendMail(resolvedMailer.cfg, { to, subject, text });

  const log = await prisma.emailLog.create({
    data: {
      leadId: lead.id,
      userId,
      toEmail: to,
      fromEmail: resolvedMailer.cfg.fromEmail,
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
  overrides?: { subject?: string; body?: string; smtpProfileId?: string },
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
      smtpProfileId: overrides?.smtpProfileId,
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

export async function getOutreachPreview(
  leadId: string,
  smtpProfileId?: string,
): Promise<{
  subject: string;
  body: string;
  htmlPreview: string;
  to: string;
  hasSettings: boolean;
  smtpProfiles: SmtpProfileOption[];
  selectedSmtpProfileId: string | null;
}> {
  const userId = await requireUserId();
  const setting = await prisma.mailSetting.findUnique({ where: { userId } });
  const smtpProfiles = getSmtpProfileOptions({
    smtpProfilesJson: setting?.smtpProfilesJson,
  });
  const resolvedMailer = resolveMailerConfig(setting, smtpProfileId);
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
    hasSettings: resolvedMailer.ok,
    smtpProfiles,
    selectedSmtpProfileId: resolvedMailer.selectedProfileId,
  };
}

export async function getOutreachAutomationProfiles(): Promise<{
  profiles: SmtpProfileOption[];
  activeProfileId: string | null;
  hasUsableSender: boolean;
}> {
  const userId = await requireUserId();
  const setting = await prisma.mailSetting.findUnique({ where: { userId } });
  const profiles = getSmtpProfileOptions({ smtpProfilesJson: setting?.smtpProfilesJson });
  const resolved = resolveMailerConfig(setting);
  return {
    profiles,
    activeProfileId: setting?.activeSmtpProfileId ?? resolved.selectedProfileId,
    hasUsableSender: resolved.ok,
  };
}
