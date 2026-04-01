/**
 * Audit service — records all field edits and generation events.
 * Every mutation that touches a GenerationRun or its field values must call
 * this service so there is an immutable audit trail in AuditEntry.
 */

import { db } from "@/server/db";
import { generateId } from "@/lib/ids";
import { logger } from "@/lib/logger";

export type AuditAction =
  | "FIELD_EDITED"
  | "DECK_GENERATED"
  | "TEMPLATE_SCANNED"
  | "TEMPLATE_IMPORTED"
  | "RUN_STARTED"
  | "RUN_COMPLETED"
  | "RUN_FAILED"
  | "RUN_CANCELLED"
  | "PREVIEW_VIEWED"
  | "PROVIDER_CONFIG_UPDATED"
  | string;

export interface AuditEntryInput {
  runId?: string | null;
  sessionId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  actorName: string;
  correlationId?: string | null;
}

export async function recordAuditEntry(input: AuditEntryInput): Promise<void> {
  const log = logger.child({ correlationId: input.correlationId, service: "audit" });

  try {
    await db.auditEntry.create({
      data: {
        id: generateId(),
        runId: input.runId ?? null,
        sessionId: input.sessionId ?? null,
        actorName: input.actorName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
        reason: input.reason ?? null,
        correlationId: input.correlationId ?? null,
      },
    });

    log.info(
      { runId: input.runId, action: input.action, entityType: input.entityType, actor: input.actorName },
      "Audit entry recorded"
    );
  } catch (err) {
    log.error({ err, input }, "Failed to record audit entry — non-fatal, continuing");
  }
}

export async function getAuditEntriesForRun(runId: string) {
  return db.auditEntry.findMany({
    where: { runId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getRecentAuditEntries(limit = 50) {
  return db.auditEntry.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { run: { select: { id: true, templateId: true, companyId: true } } },
  });
}
