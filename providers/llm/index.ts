/**
 * LLM provider registry.
 * Resolves the active LlmProvider from Postgres config.
 */

import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import type { LlmProvider } from "@/types/providers";
import { StubLlmProvider } from "./stub";
import { OpenAiProvider } from "./openai";

export { StubLlmProvider, OpenAiProvider };

export async function getActiveLlmProvider(): Promise<LlmProvider> {
  try {
    const config = await db.llmProviderConfig.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (!config) {
      logger.warn("No active LLM provider configured — using stub provider");
      return new StubLlmProvider();
    }

    switch (config.providerType) {
      case "OPENAI":
        return new OpenAiProvider(config.config as Record<string, unknown>);
      case "STUB":
      default:
        return new StubLlmProvider();
    }
  } catch (err) {
    logger.error({ err }, "Failed to load LLM provider config — falling back to stub");
    return new StubLlmProvider();
  }
}
