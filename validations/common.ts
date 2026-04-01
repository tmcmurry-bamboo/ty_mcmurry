import { z } from "zod";

export const uuidSchema = z.string().uuid("Must be a valid UUID");

export const nonEmptyString = z
  .string()
  .min(1, "Field is required")
  .max(1000, "Field is too long");

export const optionalString = z.string().optional().nullable();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const idParamSchema = z.object({
  id: uuidSchema,
});

export type IdParam = z.infer<typeof idParamSchema>;
