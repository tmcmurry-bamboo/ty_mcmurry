/**
 * Pure token normalization and fuzzy-matching utilities.
 * Safe for client-side imports (no Node.js / googleapis dependencies).
 */

/**
 * Normalize a token for fuzzy comparison:
 * strip {{ }}, lowercase, remove all non-alphanumeric characters.
 * e.g. "{{Ask_BambooHR_2_0}}" → "askbamboohr20"
 */
export function normalizeToken(raw: string): string {
  return raw
    .replace(/^\{\{|\}\}$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Returns true if normalize(a) is a prefix of normalize(b) or vice versa.
 * e.g. "{{Ask_BambooHR_2_0}}" fuzzy-matches "{{ask_bamboohr_20_circle}}"
 * because "askbamboohr20" is a prefix of "askbamboohr20circle".
 */
export function fuzzyMatchToken(a: string, b: string): boolean {
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (!na || !nb) return false;
  return nb.startsWith(na) || na.startsWith(nb);
}
