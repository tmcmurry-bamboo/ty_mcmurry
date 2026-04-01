/**
 * Template service — CRUD and import operations for Templates and TemplateFields.
 * All mutations record audit entries.
 */

import { db } from "@/server/db";
import { generateId } from "@/lib/ids";
import { logger } from "@/lib/logger";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { recordAuditEntry } from "./audit.service";
import type { CreateTemplateInput, UpdateTemplateInput, CreateTemplateFieldInput } from "@/validations/template";

// ============================================================
// TEMPLATE CRUD
// ============================================================

export async function createTemplate(
  input: CreateTemplateInput,
  actorName: string,
  correlationId?: string
) {
  const log = logger.child({ correlationId, service: "template" });

  const existing = await db.template.findFirst({
    where: { googleSlideId: input.googleSlideId },
  });
  if (existing) {
    throw new ConflictError(
      `A template with Google Slide ID "${input.googleSlideId}" already exists.`
    );
  }

  const template = await db.template.create({
    data: {
      id: generateId(),
      name: input.name,
      description: input.description ?? null,
      googleSlideId: input.googleSlideId,
      googleSlideUrl: input.googleSlideUrl,
      status: "DRAFT",
    },
  });

  await recordAuditEntry({
    action: "TEMPLATE_IMPORTED",
    entityType: "Template",
    entityId: template.id,
    after: { id: template.id, name: template.name },
    actorName,
    correlationId,
  });

  log.info({ templateId: template.id, name: template.name }, "Template created");
  return template;
}

export async function getTemplate(id: string) {
  const template = await db.template.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      conditions: { orderBy: { sortOrder: "asc" } },
      objectTags: true,
      _count: { select: { generationRuns: true } },
    },
  });
  if (!template) throw new NotFoundError("Template", id);
  return template;
}

export async function listTemplates(status?: "DRAFT" | "ACTIVE" | "INACTIVE") {
  return db.template.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { fields: true, conditions: true, generationRuns: true } },
    },
  });
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
  actorName: string,
  correlationId?: string
) {
  const existing = await db.template.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Template", id);

  const updated = await db.template.update({
    where: { id },
    data: {
      name: input.name ?? undefined,
      description: input.description ?? undefined,
      status: (input.status ?? undefined) as any,
      ...(input.dismissedTokens !== undefined ? { dismissedTokens: input.dismissedTokens } as any : {}),
    },
  });

  await recordAuditEntry({
    action: "TEMPLATE_IMPORTED",
    entityType: "Template",
    entityId: id,
    before: { name: existing.name, status: existing.status },
    after: { name: updated.name, status: updated.status },
    actorName,
    correlationId,
  });

  return updated;
}

export async function deleteTemplate(id: string, actorName: string, correlationId?: string) {
  const existing = await db.template.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Template", id);

  if ((existing.status as string) !== "INACTIVE") {
    throw new ConflictError(
      "Template must be set to Inactive before it can be deleted."
    );
  }

  // Nullify templateId on all generation runs so history is preserved
  await db.generationRun.updateMany({
    where: { templateId: id },
    data: { templateId: null as any },
  });

  await db.template.delete({ where: { id } });

  await recordAuditEntry({
    action: "TEMPLATE_IMPORTED",
    entityType: "Template",
    entityId: id,
    before: { name: existing.name, status: existing.status },
    reason: "Deleted by user",
    actorName,
    correlationId,
  });
}

// ============================================================
// TEMPLATE FIELDS
// ============================================================

export async function createTemplateField(
  input: CreateTemplateFieldInput,
  actorName: string,
  correlationId?: string
) {
  const template = await db.template.findUnique({ where: { id: input.templateId } });
  if (!template) throw new NotFoundError("Template", input.templateId);

  const duplicate = await db.templateField.findFirst({
    where: { templateId: input.templateId, name: input.name },
  });
  if (duplicate) {
    throw new ValidationError(`Field "${input.name}" already exists on this template.`);
  }

  const field = await db.templateField.create({
    data: {
      id: generateId(),
      templateId: input.templateId,
      name: input.name,
      token: input.token,
      fieldType: input.fieldType,
      dataPath: input.dataPath ?? null,
      description: input.description ?? null,
      required: input.required ?? false,
      defaultValue: input.defaultValue ?? null,
      sortOrder: input.sortOrder ?? 0,
      booleanConfig: input.booleanConfig ?? undefined,
      judgmentConfig: input.judgmentConfig ?? undefined,
    },
  });

  await recordAuditEntry({
    action: "TEMPLATE_IMPORTED",
    entityType: "TemplateField",
    entityId: field.id,
    after: { name: field.name, fieldType: field.fieldType },
    actorName,
    correlationId,
  });

  logger.info({ fieldId: field.id, templateId: input.templateId }, "Template field created");
  return field;
}

export async function deleteTemplateField(
  fieldId: string,
  actorName: string,
  correlationId?: string
) {
  const field = await db.templateField.findUnique({ where: { id: fieldId } });
  if (!field) throw new NotFoundError("TemplateField", fieldId);

  await db.templateField.delete({ where: { id: fieldId } });

  await recordAuditEntry({
    action: "TEMPLATE_IMPORTED",
    entityType: "TemplateField",
    entityId: fieldId,
    before: { name: field.name, fieldType: field.fieldType },
    reason: "Field deleted",
    actorName,
    correlationId,
  });
}
