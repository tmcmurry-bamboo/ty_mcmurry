/**
 * Centralized structured logger.
 *
 * Uses pino for structured JSON logging in production and
 * pino-pretty for human-readable output in development.
 *
 * SECURITY: Never log sensitive values (tokens, API keys, PII).
 * Use redactPaths to strip known sensitive paths automatically.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ runId, templateId }, "Generation started");
 *   logger.error({ err, correlationId }, "Generation failed");
 */

import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const logLevel = process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");

const redactPaths = [
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.api_key",
  "*.accessToken",
  "*.access_token",
  "*.refreshToken",
  "*.refresh_token",
  "*.privateKey",
  "*.private_key",
  "*.credentials",
  "config.token",
  "config.apiKey",
  "config.password",
  "req.headers.authorization",
  "req.headers.cookie",
];

const transport = isDev
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    }
  : undefined;

export const logger = pino({
  level: logLevel,
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  base: {
    env: process.env.NODE_ENV,
    service: "slides-platform",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(transport ? { transport } : {}),
});

/**
 * Create a child logger with bound context fields.
 * Useful for request-scoped or run-scoped logging.
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Create a request-scoped logger with correlationId pre-bound.
 */
export function createRequestLogger(correlationId: string) {
  return logger.child({ correlationId });
}
