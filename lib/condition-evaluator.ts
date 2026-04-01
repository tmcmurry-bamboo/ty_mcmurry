/**
 * Condition evaluator — pure functions used by the generation service.
 * Extracted into a separate module for testability.
 */

export type ConditionOperatorType =
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

/**
 * Evaluate a single condition operator against a resolved field value.
 * All values are strings at this layer; numeric comparisons parse on demand.
 */
export function evaluateCondition(
  fieldValue: string,
  operator: ConditionOperatorType,
  condValue: string
): boolean {
  const numField = parseFloat(fieldValue);
  const numCond = parseFloat(condValue);
  const numericValid = !isNaN(numField) && !isNaN(numCond);

  switch (operator) {
    case "EQUALS":                return fieldValue === condValue;
    case "NOT_EQUALS":            return fieldValue !== condValue;
    case "GREATER_THAN":          return numericValid && numField > numCond;
    case "LESS_THAN":             return numericValid && numField < numCond;
    case "GREATER_THAN_OR_EQUAL": return numericValid && numField >= numCond;
    case "LESS_THAN_OR_EQUAL":    return numericValid && numField <= numCond;
    case "CONTAINS":              return fieldValue.includes(condValue);
    case "NOT_CONTAINS":          return !fieldValue.includes(condValue);
    case "IS_TRUE":               return fieldValue === "true" || fieldValue === "1";
    case "IS_FALSE":              return fieldValue === "false" || fieldValue === "0" || fieldValue === "";
    case "IS_NULL":               return fieldValue === "" || fieldValue === "null";
    case "IS_NOT_NULL":           return fieldValue !== "" && fieldValue !== "null";
    default:                      return false;
  }
}

/**
 * Resolve a field value from company data using an optional dot-path.
 * Falls back to the fieldName as a top-level key if no path is given.
 */
export function resolveFieldValue(
  fieldName: string,
  dataPath: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  companyData: Record<string, any>
): string {
  const path = dataPath ?? fieldName;
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = companyData;
  for (const part of parts) {
    if (cursor == null) break;
    cursor = cursor[part];
  }
  if (cursor == null) return "";
  return String(cursor);
}
