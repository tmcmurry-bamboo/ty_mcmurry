/**
 * Generation service — orchestrates the full deck generation pipeline.
 *
 * Pipeline (Phase 4 full implementation):
 *   1. PENDING   → create GenerationRun record
 *   2. FETCHING  → call active DataSourceProvider
 *   3. PREVIEW   → persist GenerationFieldValues, await user confirmation
 *   4. GENERATING→ apply Google Slides replacements
 *   5. COMPLETED → write audit slide, update run status
 *
 * This file contains the scaffolding; actual provider calls are Phase 3/4 work.
 */

import { db } from "@/server/db";
import { generateId, generateRunId, generateCorrelationId } from "@/lib/ids";
import { logger } from "@/lib/logger";
import { NotFoundError, GenerationError } from "@/lib/errors";
import { recordAuditEntry } from "./audit.service";
import type { GenerationRequestInput, SubmitPreviewEditsInput, ConfirmGenerationInput } from "@/validations/generation";
import { formatFieldValue } from "@/lib/field-formatters";
import type { GenerationPreview } from "@/types/generation";
type TemplateField = { id: string; name: string; token: string; fieldType: string; defaultValue: string | null; dataPath: string | null; sortOrder: number };
type GenerationFieldValue = { id: string; runId: string; fieldName: string; wasEdited: boolean };

// ============================================================
// START GENERATION — creates run + fetches data
// ============================================================

export async function startGeneration(
  input: GenerationRequestInput,
  correlationId = generateCorrelationId()
): Promise<GenerationPreview> {
  const log = logger.child({ correlationId, service: "generation" });

  const template = await db.template.findUnique({
    where: { id: input.templateId },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw new NotFoundError("Template", input.templateId);
  if (template.status !== "ACTIVE") {
    throw new GenerationError(
      `Template "${template.name}" is not active. Activate it before generating.`
    );
  }

  // 1. Create the run in PENDING state
  const runId = generateRunId();
  const run = await db.generationRun.create({
    data: {
      id: runId,
      templateId: template.id,
      sessionId: input.sessionId ?? null,
      actorName: input.actorName,
      companyId: input.companyId,
      status: "PENDING",
      correlationId,
      packageTypeId: input.packageTypeId ?? null,
      packageTypeOverride: input.packageTypeOverride ?? false,
    },
  });

  await recordAuditEntry({
    runId: run.id,
    action: "RUN_STARTED",
    entityType: "GenerationRun",
    entityId: run.id,
    after: { templateId: template.id, companyId: input.companyId },
    actorName: input.actorName,
    correlationId,
  });

  log.info({ runId, templateId: template.id, companyId: input.companyId }, "Generation run started");

  // 2. Transition to FETCHING
  await db.generationRun.update({ where: { id: runId }, data: { status: "FETCHING", startedAt: new Date() } });

  try {
    // TODO Phase 3: replace with real provider call via getActiveDataProvider()
    const mockData: Record<string, string> = {};
    for (const field of template.fields) {
      mockData[field.name] = field.defaultValue ?? `[${field.name}]`;
    }

    // 3. Persist field values and transition to PREVIEW
    await db.$transaction([
      ...template.fields.map((field: TemplateField) => {
        const raw = mockData[field.name] ?? null;
        const formatted = formatFieldValue(raw, field.fieldType) ?? raw;
        return db.generationFieldValue.create({
          data: {
            id: generateId(),
            runId,
            fieldId: field.id,
            fieldName: field.name,
            sourceValue: raw,
            finalValue: formatted,
          },
        });
      }),
      db.generationRun.update({
        where: { id: runId },
        data: {
          status: "PREVIEW",
          sourceDataSummary: {
            fieldCount: template.fields.length,
            fetchedAt: new Date().toISOString(),
            providerName: "mock",
          },
        },
      }),
    ]);

    log.info({ runId }, "Generation data fetched, run in PREVIEW state");

    return {
      runId,
      templateId: template.id,
      companyId: input.companyId,
      actorName: input.actorName,
      fetchedAt: new Date().toISOString(),
      providerName: "mock",
      fields: template.fields.map((f: TemplateField) => ({
        fieldId: f.id,
        fieldName: f.name,
        token: f.token,
        fieldType: f.fieldType,
        sourceValue: mockData[f.name] ?? null,
        editedValue: null,
        wasEdited: false,
        editReason: null,
        dataPath: f.dataPath,
      })),
    };
  } catch (err) {
    await db.generationRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        completedAt: new Date(),
      },
    });
    await recordAuditEntry({
      runId,
      action: "RUN_FAILED",
      entityType: "GenerationRun",
      entityId: runId,
      after: { error: err instanceof Error ? err.message : "Unknown error" },
      actorName: input.actorName,
      correlationId,
    });
    throw new GenerationError(`Generation failed: ${err instanceof Error ? err.message : "Unknown error"}`, runId);
  }
}

// ============================================================
// SUBMIT PREVIEW EDITS
// ============================================================

export async function submitPreviewEdits(
  input: SubmitPreviewEditsInput,
  correlationId?: string
) {
  const log = logger.child({ correlationId, service: "generation" });
  const run = await db.generationRun.findUnique({ where: { id: input.runId } });
  if (!run) throw new NotFoundError("GenerationRun", input.runId);
  if (run.status !== "PREVIEW") {
    throw new GenerationError(`Run is not in PREVIEW state (current: ${run.status})`, input.runId);
  }

  for (const edit of input.edits) {
    const fv = await db.generationFieldValue.findFirst({
      where: { runId: input.runId, fieldName: edit.fieldName },
    });
    if (!fv) continue;

    await db.generationFieldValue.update({
      where: { id: fv.id },
      data: {
        editedValue: edit.editedValue,
        finalValue: edit.editedValue,
        wasEdited: true,
        editReason: edit.editReason,
        editorName: edit.editorName,
        editedAt: new Date(),
      },
    });

    await recordAuditEntry({
      runId: input.runId,
      action: "FIELD_EDITED",
      entityType: "GenerationFieldValue",
      entityId: fv.id,
      before: { value: fv.sourceValue },
      after: { value: edit.editedValue, reason: edit.editReason },
      reason: edit.editReason,
      actorName: edit.editorName,
      correlationId,
    });
  }

  log.info({ runId: input.runId, editCount: input.edits.length }, "Preview edits submitted");
  return db.generationRun.findUnique({
    where: { id: input.runId },
    include: { fieldValues: true },
  });
}

// ============================================================
// CONFIRM GENERATION (PREVIEW → GENERATING → COMPLETED)
// ============================================================

export async function confirmGeneration(
  input: ConfirmGenerationInput,
  correlationId?: string
) {
  const log = logger.child({ correlationId, service: "generation" });
  const run = await db.generationRun.findUnique({
    where: { id: input.runId },
    include: {
      template: true,
      fieldValues: true,
    },
  });
  if (!run) throw new NotFoundError("GenerationRun", input.runId);
  if (run.status !== "PREVIEW") {
    throw new GenerationError(`Run is not in PREVIEW state (current: ${run.status})`, input.runId);
  }

  await db.generationRun.update({ where: { id: input.runId }, data: { status: "GENERATING" } });

  try {
    // Build package-based slide visibility conditions
    // Load all slide tags for this template; hide slides belonging to OTHER package types
    const packageConditions: import("@/providers/slides/google").VisibilityCondition[] = [];
    if (run.packageTypeId) {
      const allSlideTags = await db.templateSlideTag.findMany({
        where: { templateId: run.templateId },
      });
      for (const tag of allSlideTags) {
        if (tag.packageTypeId !== run.packageTypeId) {
          packageConditions.push({
            action: "HIDE",
            targetType: "SLIDE",
            targetId: String(tag.slideIndex),
          });
        }
      }
    }

    const completed = await db.generationRun.update({
      where: { id: input.runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        editedFieldsSummary: {
          editedCount: run.fieldValues.filter((fv: GenerationFieldValue) => fv.wasEdited).length,
          packageConditionsApplied: packageConditions.length,
        },
      },
    });

    await recordAuditEntry({
      runId: input.runId,
      action: "DECK_GENERATED",
      entityType: "GenerationRun",
      entityId: input.runId,
      actorName: input.actorName,
      correlationId,
    });

    log.info({ runId: input.runId }, "Generation completed");
    return completed;
  } catch (err) {
    await db.generationRun.update({
      where: { id: input.runId },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Unknown", completedAt: new Date() },
    });
    throw new GenerationError(`Deck generation failed: ${err instanceof Error ? err.message : "Unknown"}`, input.runId);
  }
}

// ============================================================
// QUERIES
// ============================================================

export async function getGenerationRun(id: string) {
  const run = await db.generationRun.findUnique({
    where: { id },
    include: { template: true, fieldValues: { orderBy: { fieldName: "asc" } }, auditEntries: { orderBy: { createdAt: "asc" } } },
  });
  if (!run) throw new NotFoundError("GenerationRun", id);
  return run;
}

export async function listGenerationRuns(limit = 50) {
  return db.generationRun.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { template: { select: { name: true } } },
  });
}
