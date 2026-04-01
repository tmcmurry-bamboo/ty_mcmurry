import { z } from "zod";
import { nonEmptyString, optionalString, uuidSchema } from "./common";

export const templateStatusSchema = z.enum(["DRAFT", "ACTIVE", "INACTIVE"]);

export const fieldTypeSchema = z.enum([
  "TEXT",
  "NUMBER",
  "DATE",
  "BOOLEAN",
  "JUDGMENT",
  "CONDITIONAL",
  "NARRATIVE",
  "METADATA_TAG",
]);

export const conditionOperatorSchema = z.enum([
  "EQUALS",
  "NOT_EQUALS",
  "GREATER_THAN",
  "LESS_THAN",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN_OR_EQUAL",
  "CONTAINS",
  "NOT_CONTAINS",
  "IS_TRUE",
  "IS_FALSE",
  "IS_NULL",
  "IS_NOT_NULL",
]);

export const booleanConfigSchema = z.object({
  renderTrue: z.string().min(1).default("●"),
  renderFalse: z.string().min(1).default("○"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .default("#599d15"),
  mode: z.enum(["SYMBOLS", "YES_NO", "ICONS", "SHAPES"]).default("SYMBOLS"),
});

export const judgmentConfigSchema = z.object({
  suggestedType: z
    .enum(["SCORE", "HEALTH", "RISK", "QA", "STATUS", "ADOPTION", "SENTIMENT", "CUSTOM"])
    .nullable()
    .optional(),
  criteria: z
    .array(
      z.object({
        label: z.string(),
        condition: z.string(),
        weight: z.number().optional(),
      })
    )
    .default([]),
  threshold: z.number().nullable().optional(),
  llmEnhanced: z.boolean().default(false),
});

export const createTemplateSchema = z.object({
  name: nonEmptyString.max(200),
  description: optionalString,
  googleSlideId: nonEmptyString.max(200),
  googleSlideUrl: z.string().url("Must be a valid Google Slides URL"),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: nonEmptyString.max(200).optional(),
  description: optionalString,
  status: templateStatusSchema.optional(),
  dismissedTokens: z.array(z.string()).optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const createTemplateFieldSchema = z.object({
  templateId: uuidSchema,
  name: nonEmptyString.max(200),
  token: nonEmptyString.max(500),
  fieldType: fieldTypeSchema,
  dataPath: optionalString,
  description: optionalString,
  required: z.boolean().default(false),
  defaultValue: optionalString,
  sortOrder: z.number().int().default(0),
  booleanConfig: booleanConfigSchema.optional().nullable(),
  judgmentConfig: judgmentConfigSchema.optional().nullable(),
});

export type CreateTemplateFieldInput = z.infer<typeof createTemplateFieldSchema>;

export const updateTemplateFieldSchema = createTemplateFieldSchema
  .omit({ templateId: true })
  .partial();

export type UpdateTemplateFieldInput = z.infer<typeof updateTemplateFieldSchema>;

export const createObjectTagSchema = z.object({
  templateId: uuidSchema,
  objectId: nonEmptyString,
  slideIndex: z.number().int().min(0).optional().nullable(),
  tagKey: nonEmptyString.max(100),
  tagValue: optionalString,
  description: optionalString,
});

export type CreateObjectTagInput = z.infer<typeof createObjectTagSchema>;

export const createConditionSchema = z.object({
  templateId: uuidSchema,
  name: nonEmptyString.max(200),
  conditionType: z.enum(["SLIDE_VISIBILITY", "OBJECT_VISIBILITY"]),
  targetType: z.enum(["SLIDE", "OBJECT"]),
  targetId: nonEmptyString,
  fieldName: nonEmptyString,
  operator: conditionOperatorSchema,
  value: z.string(),
  action: z.enum(["SHOW", "HIDE"]).default("HIDE"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export type CreateConditionInput = z.infer<typeof createConditionSchema>;

export const updateConditionSchema = createConditionSchema
  .omit({ templateId: true })
  .partial();

export type UpdateConditionInput = z.infer<typeof updateConditionSchema>;

export const importTemplateSchema = z.object({
  googleSlideUrl: z
    .string()
    .url()
    .refine(
      (url) =>
        url.includes("docs.google.com/presentation") ||
        url.includes("slides.google.com"),
      "Must be a valid Google Slides URL"
    ),
  name: nonEmptyString.max(200).optional(),
  description: optionalString,
  actorName: nonEmptyString,
});

export type ImportTemplateInput = z.infer<typeof importTemplateSchema>;
