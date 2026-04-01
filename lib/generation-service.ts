/**
 * Generation service — Phase 4 core.
 *
 * Pipeline:
 *   PENDING → FETCHING (fetch company data)
 *           → PREVIEW  (resolve + store field values)
 *           → GENERATING (copy deck, replace tokens, apply conditions)
 *           → COMPLETED / FAILED
 *
 * All state transitions are persisted to GenerationRun.
 * Field values are recorded in GenerationFieldValue for audit.
 */

import { db } from "@/server/db";
import { Prisma } from "@prisma/client";
import { getActiveDataProvider } from "@/providers/data";
import { generateDeckFromTemplate } from "@/providers/slides/google";
import { generateCorrelationId } from "@/lib/ids";
import { GenerationError, ProviderError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { TokenReplacement, VisibilityCondition } from "@/providers/slides/google";
import { evaluateCondition, resolveFieldValue } from "@/lib/condition-evaluator";

// Inferred from Prisma db query
type TemplateField = Awaited<ReturnType<typeof db.templateField.findMany>>[number];
type TemplateCondition = Awaited<ReturnType<typeof db.templateCondition.findMany>>[number];

function buildVisibilityConditions(
  conditions: TemplateCondition[],
  resolvedValues: Map<string, string>
): VisibilityCondition[] {
  const result: VisibilityCondition[] = [];

  for (const cond of conditions) {
    if (!cond.isActive) continue;
    const fieldValue = resolvedValues.get(cond.fieldName) ?? "";
    const triggers = evaluateCondition(fieldValue, cond.operator, cond.value);
    if (triggers) {
      result.push({
        action: cond.action,
        targetType: cond.targetType,
        targetId: cond.targetId,
      });
    }
  }

  return result;
}

// ── Token replacement ──────────────────────────────────────────────────────

function buildTokenReplacements(
  fields: TemplateField[],
  resolvedValues: Map<string, string>
): TokenReplacement[] {
  return fields.map((field) => ({
    token: field.token,
    value: resolvedValues.get(field.name) ?? field.defaultValue ?? "",
  }));
}

// ── Status helpers ─────────────────────────────────────────────────────────

async function setRunStatus(
  runId: string,
  status: string,
  extra: Record<string, unknown> = {}
) {
  await db.generationRun.update({
    where: { id: runId },
    data: { status: status as any, ...extra },
  });
}

// ── Main service function ──────────────────────────────────────────────────

export interface RunGenerationInput {
  runId: string;
  templateId: string;
  companyId: string;
  actorName: string;
  sessionId?: string;
}

export async function runGeneration(input: RunGenerationInput): Promise<void> {
  const { runId, templateId, companyId, actorName } = input;
  const correlationId = generateCorrelationId();

  logger.info({ runId, templateId, companyId, correlationId }, "Generation pipeline start");

  try {
    // ── 1. FETCHING — get company data ──────────────────────────────────
    await setRunStatus(runId, "FETCHING", { startedAt: new Date(), correlationId });

    const dataProvider = await getActiveDataProvider();
    let companyData: Record<string, unknown>;

    try {
      const preview = await dataProvider.getCompanyPreview(companyId, { correlationId });
      companyData = preview.data;
      await db.generationRun.update({
        where: { id: runId },
        data: {
          providerName: dataProvider.metadata.name,
          sourceDataSummary: {
            fieldCount: preview.metadata.fieldCount,
            fetchedAt: preview.fetchedAt,
            source: preview.metadata.source,
          },
        },
      });
    } catch (err) {
      throw new GenerationError(
        err instanceof Error ? err.message : "Failed to fetch company data",
        runId
      );
    }

    // ── 2. PREVIEW — load template config + resolve field values ────────
    await setRunStatus(runId, "PREVIEW");

    const template = await db.template.findUnique({
      where: { id: templateId },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        conditions: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    if (!template) {
      throw new GenerationError(`Template "${templateId}" not found`, runId);
    }

    // Build resolved values map
    const resolvedValues = new Map<string, string>();
    for (const field of template.fields) {
      const value = resolveFieldValue(field.name, field.dataPath, companyData);
      resolvedValues.set(field.name, value);
    }

    // Store field values for audit
    await db.generationFieldValue.createMany({
      data: template.fields.map((field: TemplateField) => ({
        id: crypto.randomUUID(),
        runId,
        fieldId: field.id,
        fieldName: field.name,
        sourceValue: resolvedValues.get(field.name) ?? null,
        finalValue: resolvedValues.get(field.name) ?? null,
        wasEdited: false,
      })),
      skipDuplicates: true,
    });

    // ── 3. GENERATING — copy deck + apply replacements + conditions ─────
    await setRunStatus(runId, "GENERATING");

    const replacements = buildTokenReplacements(template.fields, resolvedValues);
    const visibilityConditions = buildVisibilityConditions(template.conditions, resolvedValues);

    logger.info(
      { runId, replacements: replacements.length, conditions: visibilityConditions.length },
      "Generating deck"
    );

    const deckResult = await generateDeckFromTemplate(template.googleSlideId, {
      presentationTitle: `${template.name} — ${companyId}`,
      replacements,
      conditions: visibilityConditions,
    });

    // ── 4. COMPLETED ────────────────────────────────────────────────────
    await setRunStatus(runId, "COMPLETED", {
      completedAt: new Date(),
      generatedPresentationId: deckResult.presentationId,
      generatedPresentationUrl: deckResult.presentationUrl,
    });

    // Write audit entry
    await db.auditEntry.create({
      data: {
        id: crypto.randomUUID(),
        runId,
        sessionId: input.sessionId ?? null,
        actorName,
        action: "DECK_GENERATED",
        entityType: "GenerationRun",
        entityId: runId,
        after: {
          presentationId: deckResult.presentationId,
          presentationUrl: deckResult.presentationUrl,
          fieldCount: template.fields.length,
          conditionsApplied: visibilityConditions.length,
        },
        correlationId,
      },
    });

    logger.info({ runId, presentationId: deckResult.presentationId }, "Generation complete");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error({ runId, err }, "Generation pipeline failed");

    await db.generationRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
        errorDetails: err instanceof ProviderError ? { providerName: err.providerName } : Prisma.DbNull,
      },
    });

    // Still write a failure audit entry
    await db.auditEntry.create({
      data: {
        id: crypto.randomUUID(),
        runId,
        sessionId: input.sessionId ?? null,
        actorName,
        action: "DECK_GENERATION_FAILED",
        entityType: "GenerationRun",
        entityId: runId,
        after: { errorMessage: message },
        correlationId,
      },
    }).catch(() => {}); // best-effort
  }
}
