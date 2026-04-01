/**
 * Template domain types.
 * These mirror the Prisma schema but are decoupled from Prisma client
 * to allow use in shared/client code and provider layers.
 */

export type TemplateStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type FieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "BOOLEAN"
  | "JUDGMENT"
  | "CONDITIONAL"
  | "NARRATIVE"
  | "METADATA_TAG";

export type ConditionType = "SLIDE_VISIBILITY" | "OBJECT_VISIBILITY";
export type ConditionTarget = "SLIDE" | "OBJECT";
export type ConditionOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN_OR_EQUAL"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "IS_TRUE"
  | "IS_FALSE"
  | "IS_NULL"
  | "IS_NOT_NULL";
export type ConditionAction = "SHOW" | "HIDE";

// ============================================================
// BOOLEAN CONFIG
// ============================================================

export interface BooleanFieldConfig {
  renderTrue: string;   // default: "●"
  renderFalse: string;  // default: "○"
  color: string;        // default: "#599d15"
  mode: "SYMBOLS" | "YES_NO" | "ICONS" | "SHAPES"; // v1: SYMBOLS
}

export const DEFAULT_BOOLEAN_CONFIG: BooleanFieldConfig = {
  renderTrue: "●",
  renderFalse: "○",
  color: "#599d15",
  mode: "SYMBOLS",
};

// ============================================================
// JUDGMENT CONFIG
// ============================================================

export type JudgmentType =
  | "SCORE"
  | "HEALTH"
  | "RISK"
  | "QA"
  | "STATUS"
  | "ADOPTION"
  | "SENTIMENT"
  | "CUSTOM";

export interface JudgmentFieldConfig {
  suggestedType: JudgmentType | null;
  criteria: JudgmentCriterion[];
  threshold: number | null;
  llmEnhanced: boolean;
}

export interface JudgmentCriterion {
  label: string;
  condition: string;
  weight?: number;
}

// ============================================================
// TEMPLATE FIELD
// ============================================================

export interface TemplateField {
  id: string;
  templateId: string;
  name: string;
  token: string;
  fieldType: FieldType;
  detectedType: FieldType | null;
  isAutoDetected: boolean;
  isManual: boolean;
  dataPath: string | null;
  description: string | null;
  required: boolean;
  defaultValue: string | null;
  sortOrder: number;
  booleanConfig: BooleanFieldConfig | null;
  judgmentConfig: JudgmentFieldConfig | null;
  narrativeConfig: NarrativeFieldConfig | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NarrativeFieldConfig {
  prompt: string;
  maxLength: number;
  llmProvider: string | null;
}

// ============================================================
// TEMPLATE OBJECT TAG
// ============================================================

export interface TemplateObjectTag {
  id: string;
  templateId: string;
  objectId: string;
  slideIndex: number | null;
  tagKey: string;
  tagValue: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// TEMPLATE CONDITION
// ============================================================

export interface TemplateCondition {
  id: string;
  templateId: string;
  name: string;
  conditionType: ConditionType;
  targetType: ConditionTarget;
  targetId: string;
  fieldName: string;
  operator: ConditionOperator;
  value: string;
  action: ConditionAction;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// TEMPLATE
// ============================================================

export interface Template {
  id: string;
  name: string;
  description: string | null;
  googleSlideId: string;
  googleSlideUrl: string;
  status: TemplateStatus;
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastScannedAt: Date | null;
  archivedAt: Date | null;
}

export interface TemplateWithRelations extends Template {
  fields: TemplateField[];
  objectTags: TemplateObjectTag[];
  conditions: TemplateCondition[];
}

// ============================================================
// SCAN RESULT
// ============================================================

export interface DetectedField {
  name: string;
  token: string;
  suggestedType: FieldType;
  source: "TEXT_TOKEN" | "METADATA_TAG" | "SPEAKER_NOTES" | "ALT_TEXT";
  slideIndex?: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  llmSuggested?: boolean;
}

export interface ScanResult {
  id: string;
  templateId: string;
  detectedFields: DetectedField[];
  rawScanData: unknown;
  scanDurationMs: number | null;
  fieldCount: number;
  triggeredBy: string | null;
  createdAt: Date;
}

// ============================================================
// AUTO-DETECTION HEURISTICS
// Judgment field keywords — used during template scan
// ============================================================

export const JUDGMENT_FIELD_KEYWORDS: string[] = [
  "score",
  "health",
  "risk",
  "qa",
  "status",
  "adoption",
  "sentiment",
  "grade",
  "rating",
  "level",
  "tier",
];

export const BOOLEAN_FIELD_SUFFIXES: string[] = [
  "_circle",
  "_enabled",
  "_active",
  "_flag",
  "_check",
  "_indicator",
];

export const BOOLEAN_FIELD_PREFIXES: string[] = [
  "is_",
  "has_",
  "can_",
  "show_",
  "hide_",
  "enable_",
  "feature_",
];
