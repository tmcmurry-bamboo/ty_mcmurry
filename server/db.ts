/**
 * Prisma client singleton.
 *
 * Ensures a single PrismaClient instance is used across hot reloads in
 * development (avoids "too many connections" warnings).
 *
 * NEVER import this file in client components — it is server-only.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
