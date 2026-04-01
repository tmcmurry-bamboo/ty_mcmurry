/**
 * Provider abstraction layer types.
 * Both data source providers and LLM providers share these interfaces.
 */

// ============================================================
// DATA SOURCE PROVIDER
// ============================================================

export type DataProviderType = "DATABRICKS" | "REST_API" | "MOCK";

export interface CompanyPreview {
  companyId: string;
  fetchedAt: string; // ISO string
  providerName: string;
  data: Record<string, unknown>; // flat or nested field values
  metadata: CompanyPreviewMetadata;
}

export interface CompanyPreviewMetadata {
  fieldCount: number;
  queryDurationMs: number;
  source: string;
}

export interface ProviderConnectionResult {
  success: boolean;
  latencyMs: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface ProviderMetadata {
  name: string;
  displayName: string;
  providerType: DataProviderType;
  version: string;
  capabilities: ProviderCapability[];
  readOnly: boolean;
}

export type ProviderCapability =
  | "COMPANY_PREVIEW"
  | "FIELD_DISCOVERY"
  | "BATCH_FETCH"
  | "STREAMING";

/**
 * DataSourceProvider interface.
 * All data providers must implement this contract.
 * Add new providers by implementing this interface — no business logic changes needed.
 */
export interface DataSourceProvider {
  readonly metadata: ProviderMetadata;

  /** Fetch a data preview for the given companyId. Read-only. */
  getCompanyPreview(
    companyId: string,
    options?: FetchOptions
  ): Promise<CompanyPreview>;

  /** Validate the provider connection with current config. */
  validateConnection(): Promise<ProviderConnectionResult>;

  /** Return provider metadata/info. */
  getProviderMetadata(): ProviderMetadata;
}

export interface FetchOptions {
  fields?: string[];       // limit to specific fields
  timeoutMs?: number;
  correlationId?: string;
}

// ============================================================
// LLM PROVIDER
// ============================================================

export type LlmProviderType = "OPENAI" | "ANTHROPIC" | "STUB";

export interface LlmProviderMetadata {
  name: string;
  displayName: string;
  providerType: LlmProviderType;
  model: string;
  capabilities: LlmCapability[];
}

export type LlmCapability =
  | "FIELD_CLASSIFICATION"
  | "NARRATIVE_GENERATION"
  | "JUDGMENT_EVALUATION"
  | "FIELD_TYPE_SUGGESTION";

export interface ClassifyFieldResult {
  fieldName: string;
  suggestedType: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
  isJudgmentField: boolean;
  judgmentType?: string;
}

export interface GenerateNarrativeResult {
  narrative: string;
  tokensUsed: number;
  model: string;
}

export interface EvaluateJudgmentResult {
  fieldName: string;
  score: number | null;
  label: string;
  reasoning: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

/**
 * LlmProvider interface.
 * All LLM providers must implement this contract.
 */
export interface LlmProvider {
  readonly metadata: LlmProviderMetadata;

  /** Classify a field name/token and suggest its type. */
  classifyField(
    fieldName: string,
    context?: ClassifyFieldContext
  ): Promise<ClassifyFieldResult>;

  /** Generate narrative text from a prompt and data context. */
  generateNarrative(
    prompt: string,
    context: Record<string, unknown>,
    options?: NarrativeOptions
  ): Promise<GenerateNarrativeResult>;

  /** Evaluate a judgment field based on criteria. */
  evaluateJudgment(
    fieldName: string,
    value: unknown,
    criteria: string[],
    options?: JudgmentOptions
  ): Promise<EvaluateJudgmentResult>;

  /** Validate the provider connection. */
  validateProviderConnection(): Promise<ProviderConnectionResult>;
}

export interface ClassifyFieldContext {
  templateName?: string;
  existingFields?: string[];
  token?: string;
}

export interface NarrativeOptions {
  maxLength?: number;
  tone?: "professional" | "casual" | "technical";
  model?: string;
}

export interface JudgmentOptions {
  threshold?: number;
  scale?: "0-10" | "0-100" | "LOW_MED_HIGH" | "RED_YELLOW_GREEN";
}

// ============================================================
// PROVIDER CONFIG SHAPES (stored in ProviderConfig.config JSON)
// ============================================================

export interface DatabricksProviderConfig {
  host: string;
  httpPath: string;
  catalog?: string;
  schema?: string;
  // token stored encrypted; never log
  tokenRef: string; // reference to env var name, not the value
}

export interface RestApiProviderConfig {
  baseUrl: string;
  authType: "bearer" | "api_key" | "none";
  // apiKey stored encrypted; never log
  apiKeyRef?: string; // reference to env var name
  headers?: Record<string, string>;
  timeoutMs: number;
  companyIdParam: string; // query param or path param name
}

export interface OpenAiProviderConfig {
  model: string;
  // apiKey stored encrypted; never log
  apiKeyRef: string; // reference to env var name
  orgId?: string;
  timeoutMs: number;
}

export interface StubLlmProviderConfig {
  simulateLatencyMs?: number;
  defaultConfidence?: "HIGH" | "MEDIUM" | "LOW";
}
