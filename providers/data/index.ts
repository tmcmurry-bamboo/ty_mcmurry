/**
 * Data source provider registry.
 *
 * Resolves the active DataSourceProvider from Postgres config.
 * Add new providers here — no changes needed in business logic.
 */

import { db } from "@/server/db";
import { logger } from "@/lib/logger";
import type { DataSourceProvider } from "@/types/providers";
import { MockDataProvider } from "./mock";
import { DatabricksProvider } from "./databricks";
import { RestApiProvider } from "./rest";

export { MockDataProvider, DatabricksProvider, RestApiProvider };

/**
 * Get the active/default data source provider from DB config.
 * Falls back to MockDataProvider in development.
 */
export async function getActiveDataProvider(): Promise<DataSourceProvider> {
  try {
    const config = await db.providerConfig.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (!config) {
      logger.warn("No active data provider configured — using mock provider");
      return new MockDataProvider();
    }

    switch (config.providerType) {
      case "DATABRICKS":
        return new DatabricksProvider(config.config as Record<string, string>);
      case "REST_API":
        return new RestApiProvider(config.config as Record<string, string>);
      case "MOCK":
      default:
        return new MockDataProvider();
    }
  } catch (err) {
    logger.error({ err }, "Failed to load data provider config — falling back to mock");
    return new MockDataProvider();
  }
}
