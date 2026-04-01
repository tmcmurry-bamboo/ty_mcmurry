/**
 * Application error types and error handling utilities.
 *
 * Pattern:
 *   - AppError is the base class for all known application errors.
 *   - Subclasses encode HTTP status and error codes.
 *   - toUserMessage() returns safe, client-facing messages.
 *   - Internal details (stack traces, raw errors) are never sent to clients.
 */

// ============================================================
// BASE ERROR
// ============================================================

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** Safe message suitable for returning to clients. */
  toUserMessage(): string {
    return this.message;
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

// ============================================================
// HTTP / VALIDATION ERRORS
// ============================================================

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id "${id}" not found` : `${resource} not found`,
      "NOT_FOUND",
      404
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, "FORBIDDEN", 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

// ============================================================
// INTEGRATION ERRORS
// ============================================================

export class GoogleApiError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, "GOOGLE_API_ERROR", 502, details);
  }

  toUserMessage(): string {
    return "Google API request failed. Please try again or check your Google credentials.";
  }
}

export class ProviderError extends AppError {
  public readonly providerName: string;

  constructor(providerName: string, message: string, details?: unknown) {
    super(message, "PROVIDER_ERROR", 502, details);
    this.providerName = providerName;
  }

  toUserMessage(): string {
    return `Data provider "${this.providerName}" returned an error. Please verify your connection settings.`;
  }
}

export class LlmProviderError extends AppError {
  public readonly providerName: string;

  constructor(providerName: string, message: string, details?: unknown) {
    super(message, "LLM_PROVIDER_ERROR", 502, details);
    this.providerName = providerName;
  }

  toUserMessage(): string {
    return `LLM provider "${this.providerName}" is unavailable. Classification features may be limited.`;
  }
}

// ============================================================
// GENERATION ERRORS
// ============================================================

export class GenerationError extends AppError {
  public readonly runId?: string;

  constructor(message: string, runId?: string, details?: unknown) {
    super(message, "GENERATION_ERROR", 500, details);
    this.runId = runId;
  }

  toUserMessage(): string {
    return "Deck generation failed. Please check the run log for details.";
  }
}

// ============================================================
// UTILITIES
// ============================================================

/** Type guard — checks if a value is any AppError. */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** Extract a safe response payload from any error. */
export function toErrorResponse(
  err: unknown,
  correlationId?: string
): {
  error: string;
  message: string;
  statusCode: number;
  correlationId?: string;
  detail?: string;      // only populated in non-production
} {
  const cid = correlationId ?? undefined;
  // Evaluated at call time so tests can override process.env.NODE_ENV
  const isDev = process.env.NODE_ENV !== "production";

  if (isAppError(err)) {
    return {
      error: err.code,
      message: err.toUserMessage(),
      statusCode: err.statusCode,
      correlationId: cid,
      ...(isDev ? { detail: err.message } : {}),
    };
  }

  // Unknown/unexpected errors
  const rawMessage =
    err instanceof Error ? err.message : String(err);

  return {
    error: "INTERNAL_ERROR",
    // In dev show the real message; in prod show a generic one
    message: isDev
      ? `Unexpected error: ${rawMessage}`
      : "An unexpected error occurred. Please try again.",
    statusCode: 500,
    correlationId: cid,
    ...(isDev
      ? {
          detail:
            err instanceof Error && err.stack
              ? err.stack.split("\n").slice(0, 5).join("\n")
              : rawMessage,
        }
      : {}),
  };
}

/** Wrap an async function with structured error logging (for server actions). */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<{ data: T; error: null } | { data: null; error: ReturnType<typeof toErrorResponse> }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: toErrorResponse(err) };
  }
}
