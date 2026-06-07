"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { LEAD_STATUSES } from "@/lib/domain";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user.id;
}

const leadSchema = z.object({
  name: z.string().min(2, "İsim gerekli"),
  category: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z
    .string()
    .email("Geçersiz e-posta")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(LEAD_STATUSES).default("new"),
});

function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" ? null : v;
  }
  return out as T;
}

export async function createLead(formData: FormData) {
  const userId = await requireUserId();
  const parsed = leadSchema.safeParse(
    clean(Object.fromEntries(formData.entries())),
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form" };
  }
  await prisma.lead.create({
    data: { ...parsed.data, ownerId: userId, source: "manual" },
  });
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  return { ok: true as const };
}

export async function updateLead(id: string, formData: FormData) {
  const userId = await requireUserId();
  const parsed = leadSchema.partial().safeParse(
    clean(Object.fromEntries(formData.entries())),
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form" };
  }
  await prisma.lead.updateMany({
    where: { id, ownerId: userId },
    data: parsed.data,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/pipeline");
  return { ok: true as const };
}

export async function updateLeadStatus(id: string, status: string) {
  const userId = await requireUserId();
  if (!LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
    return { error: "Geçersiz durum" };
  }
  const before = await prisma.lead.findFirst({
    where: { id, ownerId: userId },
  });
  if (!before) return { error: "Lead bulunamadı" };

  await prisma.lead.update({
    where: { id },
    data: { status },
  });
  await prisma.activity.create({
    data: {
      leadId: id,
      userId,
      type: "status_change",
      content: `Durum: ${before.status} → ${status}`,
    },
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function deleteLead(id: string) {
  const userId = await requireUserId();
  await prisma.lead.deleteMany({ where: { id, ownerId: userId } });
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  return { ok: true as const };
}

export async function bulkDeleteLeads(ids: string[]) {
  const userId = await requireUserId();
  await prisma.lead.deleteMany({
    where: { id: { in: ids }, ownerId: userId },
  });
  revalidatePath("/leads");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline");
  return { ok: true as const, count: ids.length };
}

export async function bulkUpdateStatus(ids: string[], status: string) {
  const userId = await requireUserId();
  if (!LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
    return { error: "Geçersiz durum" };
  }
  await prisma.lead.updateMany({
    where: { id: { in: ids }, ownerId: userId },
    data: { status },
  });
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

const activitySchema = z.object({
  leadId: z.string(),
  type: z.enum(["note", "call", "email", "meeting"]),
  content: z.string().min(1, "İçerik gerekli"),
});

export async function addActivity(formData: FormData) {
  const userId = await requireUserId();
  const parsed = activitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form" };
  }
  await prisma.activity.create({
    data: { ...parsed.data, userId },
  });
  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { ok: true as const };
}
