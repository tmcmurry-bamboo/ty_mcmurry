/**
 * Stable ID generation utilities.
 * All IDs in the application use UUIDs for predictable sortability
 * and distributed system compatibility.
 */

import { v4 as uuidv4 } from "uuid";

/** Generate a new UUID v4. */
export function generateId(): string {
  return uuidv4();
}

/** Generate a correlation ID for request tracing. */
export function generateCorrelationId(): string {
  return `corr_${uuidv4()}`;
}

/** Generate a run ID for a generation run. */
export function generateRunId(): string {
  return `run_${uuidv4()}`;
}

/** Generate a session token for user sessions. */
export function generateSessionToken(): string {
  return `sess_${uuidv4()}`;
}

/** Truncate an ID to a short display form (first 8 chars after prefix). */
export function shortId(id: string): string {
  const parts = id.split("_");
  const raw = parts.length > 1 ? parts[1] : parts[0];
  return raw.replace(/-/g, "").slice(0, 8).toUpperCase();
}
