/**
 * Mock data provider — returns deterministic fixture data.
 * Used in development and tests when no real data source is configured.
 */

import type {
  DataSourceProvider,
  ProviderMetadata,
  ProviderConnectionResult,
  CompanyPreview,
  FetchOptions,
} from "@/types/providers";
import { logger } from "@/lib/logger";

const MOCK_FIELDS: Record<string, unknown> = {
  arr: 4500000,
  arr_growth: 0.32,
  nrr: 112,
  seats: 250,
  contract_start: "2023-01-15",
  contract_end: "2024-01-15",
  health_score: 78,
  support_tickets_open: 3,
  last_login_days_ago: 2,
  champion_name: "Jane Smith",
  champion_title: "VP of Engineering",
  company_name: "Acme Corporation",
  is_at_risk: false,
  expansion_eligible: true,
};

const MOCK_META: ProviderMetadata = {
  name: "mock",
  displayName: "Mock Data Provider",
  providerType: "MOCK",
  version: "1.0.0",
  capabilities: ["COMPANY_PREVIEW", "FIELD_DISCOVERY"],
  readOnly: true,
};

export class MockDataProvider implements DataSourceProvider {
  readonly metadata: ProviderMetadata = MOCK_META;

  getProviderMetadata(): ProviderMetadata {
    return MOCK_META;
  }

  async validateConnection(): Promise<ProviderConnectionResult> {
    return { success: true, latencyMs: 0, message: "Mock provider is always connected" };
  }

  async getCompanyPreview(
    companyId: string,
    options?: FetchOptions
  ): Promise<CompanyPreview> {
    const start = Date.now();
    logger.debug({ companyId }, "MockDataProvider.getCompanyPreview");

    const data: Record<string, unknown> = { ...MOCK_FIELDS, company_id: companyId };

    if (options?.fields?.length) {
      const filtered: Record<string, unknown> = {};
      for (const f of options.fields) filtered[f] = data[f] ?? null;
      return {
        companyId,
        fetchedAt: new Date().toISOString(),
        providerName: "mock",
        data: filtered,
        metadata: { fieldCount: options.fields.length, queryDurationMs: Date.now() - start, source: "mock" },
      };
    }

    return {
      companyId,
      fetchedAt: new Date().toISOString(),
      providerName: "mock",
      data,
      metadata: { fieldCount: Object.keys(data).length, queryDurationMs: Date.now() - start, source: "mock" },
    };
  }
}
