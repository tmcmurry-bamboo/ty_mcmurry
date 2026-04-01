import { z } from "zod";
import { nonEmptyString, uuidSchema } from "./common";

export const generationRequestSchema = z.object({
  templateId: uuidSchema,
  companyId: nonEmptyString.max(200),
  actorName: nonEmptyString.max(200),
  sessionId: uuidSchema.optional(),
  packageTypeId: uuidSchema.optional(),       // manual override; auto-detected from data if absent
  packageTypeOverride: z.boolean().default(false),
});

export type GenerationRequestInput = z.infer<typeof generationRequestSchema>;

export const fieldEditSchema = z.object({
  fieldName: nonEmptyString,
  editedValue: z.string(),
  editReason: nonEmptyString.min(3, "Please provide a reason for this change"),
  editorName: nonEmptyString,
});

export type FieldEditInput = z.infer<typeof fieldEditSchema>;

export const submitPreviewEditsSchema = z.object({
  runId: uuidSchema,
  edits: z.array(fieldEditSchema),
  actorName: nonEmptyString,
});

export type SubmitPreviewEditsInput = z.infer<typeof submitPreviewEditsSchema>;

export const confirmGenerationSchema = z.object({
  runId: uuidSchema,
  actorName: nonEmptyString,
});

export type ConfirmGenerationInput = z.infer<typeof confirmGenerationSchema>;
