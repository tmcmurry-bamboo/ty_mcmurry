/**
 * Field value formatting utilities applied during generation.
 *
 * Converts raw source values to slide-safe strings per field type.
 * DATE fields: strip time component so "2024-01-15T00:00:00.000Z" → "2024-01-15"
 */

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T/;

/** Convert a raw value to a slide-safe display string for a given field type. */
export function formatFieldValue(value: string | null | undefined, fieldType: string): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (fieldType === "DATE") {
    return normalizeDateValue(value);
  }

  return value;
}

/** Strip time from ISO datetime strings, leaving just the date portion (YYYY-MM-DD). */
export function normalizeDateValue(value: string): string {
  // ISO datetime: "2024-01-15T00:00:00Z" → "2024-01-15"
  if (ISO_DATETIME_RE.test(value)) {
    return value.slice(0, 10);
  }

  // Already a date-only string or some other format — return as-is
  return value;
}
