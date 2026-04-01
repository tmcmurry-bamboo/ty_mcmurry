/**
 * Generation run domain types.
 */

export type RunStatus =
  | "PENDING"
  | "FETCHING"
  | "PREVIEW"
  | "GENERATING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface GenerationRun {
  id: string;
  templateId: string;
  sessionId: string | null;
  actorName: string;
  companyId: string;
  providerName: string | null;
  status: RunStatus;
  sourceDataSummary: SourceDataSummary | null;
  editedFieldsSummary: EditedFieldsSummary | null;
  generatedPresentationId: string | null;
  generatedPresentationUrl: string | null;
  errorMessage: string | null;
  errorDetails: unknown;
  correlationId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceDataSummary {
  fieldCount: number;
  fetchedAt: string; // ISO string
  providerName: string;
}

export interface EditedFieldsSummary {
  editedCount: number;
  totalCount: number;
  fields: EditedFieldSummaryEntry[];
}

export interface EditedFieldSummaryEntry {
  fieldName: string;
  sourceValue: string | null;
  editedValue: string | null;
  reason: string | null;
  editorName: string | null;
  editedAt: string | null;
}

export interface GenerationFieldValue {
  id: string;
  runId: string;
  fieldId: string | null;
  fieldName: string;
  sourceValue: string | null;
  editedValue: string | null;
  finalValue: string | null;
  wasEdited: boolean;
  editReason: string | null;
  editorName: string | null;
  editedAt: Date | null;
  createdAt: Date;
}

export interface AuditEntry {
  id: string;
  runId: string | null;
  sessionId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  correlationId: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

// ============================================================
// GENERATION REQUEST / PREVIEW
// ============================================================

export interface GenerationRequest {
  templateId: string;
  companyId: string;
  actorName: string;
  sessionId?: string;
  correlationId?: string;
}

export interface FieldPreviewEntry {
  fieldId: string | null;
  fieldName: string;
  token: string;
  fieldType: string;
  sourceValue: string | null;
  editedValue: string | null;
  wasEdited: boolean;
  editReason: string | null;
  dataPath: string | null;
}

export interface GenerationPreview {
  runId: string;
  templateId: string;
  companyId: string;
  actorName: string;
  fields: FieldPreviewEntry[];
  fetchedAt: string;
  providerName: string;
}

// ============================================================
// AUDIT SLIDE DATA
// ============================================================

export interface AuditSlideData {
  runId: string;
  templateId: string;
  templateName: string;
  companyId: string;
  actorName: string;
  generatedAt: string;
  entries: AuditSlideEntry[];
}

export interface AuditSlideEntry {
  fieldName: string;
  sourceValue: string | null;
  editedValue: string | null;
  finalValue: string | null;
  wasEdited: boolean;
  editReason: string | null;
  editorName: string | null;
  editedAt: string | null;
}
