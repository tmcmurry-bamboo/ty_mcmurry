import { z } from "zod";
import { nonEmptyString, optionalString } from "./common";

// ── Data provider config shapes ─────────────────────────────────────────────

export const databricksConfigSchema = z.object({
  host: nonEmptyString.describe("e.g. adb-1234567890.12.azuredatabricks.net"),
  httpPath: nonEmptyString.describe("e.g. /sql/1.0/warehouses/abc123"),
  catalog: optionalString,
  schema: optionalString,
  tokenRef: nonEmptyString.describe("Name of env var holding the PAT, e.g. DATABRICKS_TOKEN"),
});

export const restApiConfigSchema = z.object({
  baseUrl: z.string().url("Must be a valid URL"),
  authType: z.enum(["bearer", "api_key", "none"]),
  apiKeyRef: optionalString.describe("Env var name holding the API key"),
  companyIdParam: nonEmptyString.default("companyId"),
  timeoutMs: z.number().int().min(1000).max(60000).default(10000),
});

export const createDataProviderSchema = z.object({
  name: nonEmptyString.max(100),
  displayName: nonEmptyString.max(100),
  providerType: z.enum(["DATABRICKS", "REST_API", "MOCK"]),
  isDefault: z.boolean().default(false),
  config: z.record(z.unknown()),
});

export type CreateDataProviderInput = z.infer<typeof createDataProviderSchema>;

export const updateDataProviderSchema = createDataProviderSchema.partial();
export type UpdateDataProviderInput = z.infer<typeof updateDataProviderSchema>;

// ── LLM provider config shapes ───────────────────────────────────────────────

export const openAiConfigSchema = z.object({
  model: z.string().default("gpt-4o-mini"),
  apiKeyRef: nonEmptyString.describe("Name of env var holding the OpenAI API key"),
  orgId: optionalString,
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
});

export const createLlmProviderSchema = z.object({
  name: nonEmptyString.max(100),
  displayName: nonEmptyString.max(100),
  providerType: z.enum(["OPENAI", "ANTHROPIC", "STUB"]),
  isDefault: z.boolean().default(false),
  config: z.record(z.unknown()),
});

export type CreateLlmProviderInput = z.infer<typeof createLlmProviderSchema>;

export const updateLlmProviderSchema = createLlmProviderSchema.partial();
export type UpdateLlmProviderInput = z.infer<typeof updateLlmProviderSchema>;
