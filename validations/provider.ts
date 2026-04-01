import { z } from "zod";
import { nonEmptyString } from "./common";

export const dataProviderTypeSchema = z.enum(["DATABRICKS", "REST_API", "MOCK"]);
export const llmProviderTypeSchema = z.enum(["OPENAI", "ANTHROPIC", "STUB"]);

export const databricksConfigSchema = z.object({
  host: z.string().url("Must be a valid Databricks workspace URL"),
  httpPath: nonEmptyString,
  catalog: z.string().optional(),
  schema: z.string().optional(),
  tokenRef: nonEmptyString.describe("Environment variable name holding the token"),
});

export const restApiConfigSchema = z.object({
  baseUrl: z.string().url("Must be a valid base URL"),
  authType: z.enum(["bearer", "api_key", "none"]).default("none"),
  apiKeyRef: z.string().optional(),
  headers: z.record(z.string()).optional(),
  timeoutMs: z.number().int().min(1000).max(60000).default(10000),
  companyIdParam: nonEmptyString.default("companyId"),
});

export const openAiConfigSchema = z.object({
  model: z.string().default("gpt-4o-mini"),
  apiKeyRef: nonEmptyString.describe("Environment variable name holding the API key"),
  orgId: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
});

export const createProviderConfigSchema = z.object({
  name: nonEmptyString.max(100),
  displayName: nonEmptyString.max(200),
  providerType: dataProviderTypeSchema,
  isActive: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  config: z.record(z.unknown()),
});

export type CreateProviderConfigInput = z.infer<typeof createProviderConfigSchema>;

export const createLlmProviderConfigSchema = z.object({
  name: nonEmptyString.max(100),
  displayName: nonEmptyString.max(200),
  providerType: llmProviderTypeSchema,
  isActive: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  config: z.record(z.unknown()),
});

export type CreateLlmProviderConfigInput = z.infer<typeof createLlmProviderConfigSchema>;

export const sessionCreateSchema = z.object({
  name: nonEmptyString.max(200, "Name must be under 200 characters"),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).default("EDITOR"),
});

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>;
