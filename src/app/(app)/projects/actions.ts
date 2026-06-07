"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PROJECT_STATUSES } from "@/lib/domain";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user.id;
}

const projectSchema = z.object({
  leadId: z.string().min(1, "Lead seç"),
  title: z.string().min(2, "Başlık gerekli"),
  description: z.string().optional().nullable(),
  status: z.enum(PROJECT_STATUSES).default("draft"),
  priceTRY: z.coerce.number().int().min(0).optional().nullable(),
  liveUrl: z.string().optional().nullable(),
  previewUrl: z.string().optional().nullable(),
  repoUrl: z.string().optional().nullable(),
});

export async function createProject(formData: FormData) {
  const userId = await requireUserId();
  const raw = Object.fromEntries(formData.entries());
  const parsed = projectSchema.safeParse({
    ...raw,
    priceTRY: raw.priceTRY === "" ? null : raw.priceTRY,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form" };
  }
  const { priceTRY, ...rest } = parsed.data;
  await prisma.project.create({
    data: {
      ...rest,
      ownerId: userId,
      priceCents: priceTRY ? priceTRY * 100 : null,
      currency: "TRY",
    },
  });
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function updateProject(id: string, formData: FormData) {
  const userId = await requireUserId();
  const raw = Object.fromEntries(formData.entries());
  const parsed = projectSchema.partial().safeParse({
    ...raw,
    priceTRY: raw.priceTRY === "" ? null : raw.priceTRY,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form" };
  }
  const { priceTRY, ...rest } = parsed.data;
  await prisma.project.updateMany({
    where: { id, ownerId: userId },
    data: {
      ...rest,
      ...(priceTRY != null ? { priceCents: priceTRY * 100 } : {}),
    },
  });
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { ok: true as const };
}

export async function deleteProject(id: string) {
  const userId = await requireUserId();
  await prisma.project.deleteMany({ where: { id, ownerId: userId } });
  revalidatePath("/projects");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// AI website generation
// ---------------------------------------------------------------------------

import { generateWebsite } from "@/lib/ai/website-generator";

export type GenerateResult =
  | { ok: true; projectId: string; model: string }
  | { ok: false; error: string };

export async function generateWebsiteForLead(
  leadId: string,
  opts?: { style?: "modern" | "classic" | "bold"; extra?: string },
): Promise<GenerateResult> {
  const userId = await requireUserId();

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ownerId: userId },
  });
  if (!lead) return { ok: false, error: "Lead bulunamadı" };

  let result;
  try {
    result = await generateWebsite({
      lead,
      style: opts?.style ?? "modern",
      extraInstructions: opts?.extra,
    });
  } catch (err) {
    console.error("[ai] generateWebsite failed:", err);
    return { ok: false, error: "Website üretimi başarısız oldu" };
  }

  // Find existing AI project for this lead, or create new
  const existing = await prisma.project.findFirst({
    where: { leadId, ownerId: userId, aiModel: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  const project = existing
    ? await prisma.project.update({
        where: { id: existing.id },
        data: {
          generatedHtml: result.html,
          generatedCss: result.css,
          aiPrompt: result.prompt,
          aiModel: result.model,
          generatedAt: new Date(),
        },
      })
    : await prisma.project.create({
        data: {
          leadId,
          ownerId: userId,
          title: `${lead.name} — Website`,
          status: "review",
          generatedHtml: result.html,
          generatedCss: result.css,
          aiPrompt: result.prompt,
          aiModel: result.model,
          generatedAt: new Date(),
        },
      });

  await prisma.activity.create({
    data: {
      leadId,
      userId,
      type: "note",
      content: `AI website üretildi (${result.model})`,
    },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/projects");
  return { ok: true, projectId: project.id, model: result.model };
}

export async function regenerateWebsite(
  projectId: string,
  opts?: { style?: "modern" | "classic" | "bold"; extra?: string },
): Promise<GenerateResult> {
  const userId = await requireUserId();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
    include: { lead: true },
  });
  if (!project) return { ok: false, error: "Proje bulunamadı" };
  return generateWebsiteForLead(project.leadId, opts);
}

export async function updateProjectHtml(
  projectId: string,
  payload: { html?: string; css?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "Proje bulunamadı" };
  const { html, css } = payload;
  if (html !== undefined && (typeof html !== "string" || html.length === 0)) {
    return { ok: false, error: "HTML boş olamaz" };
  }
  if (html && html.length > 500_000) {
    return { ok: false, error: "HTML çok büyük (max 500KB)" };
  }
  if (css && css.length > 500_000) {
    return { ok: false, error: "CSS çok büyük (max 500KB)" };
  }
  await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(html !== undefined ? { generatedHtml: html } : {}),
      ...(css !== undefined ? { generatedCss: css } : {}),
      generatedAt: new Date(),
    },
  });
  revalidatePath(`/projects/${projectId}/edit`);
  revalidatePath(`/preview/${projectId}`);
  return { ok: true };
}

