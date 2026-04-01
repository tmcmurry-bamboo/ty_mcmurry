/**
 * REST API data provider — Phase 3 implementation stub.
 *
 * STUB: validateConnection performs a basic HTTP health-check ping.
 * Full field-mapping and response normalization in Phase 3.
 */

import type {
  DataSourceProvider,
  ProviderMetadata,
  ProviderConnectionResult,
  CompanyPreview,
  FetchOptions,
  RestApiProviderConfig,
} from "@/types/providers";
import { ProviderError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const META: ProviderMetadata = {
  name: "rest-api",
  displayName: "REST API",
  providerType: "REST_API",
  version: "1.0.0",
  capabilities: ["COMPANY_PREVIEW"],
  readOnly: true,
};

export class RestApiProvider implements DataSourceProvider {
  readonly metadata: ProviderMetadata = META;
  private readonly config: RestApiProviderConfig;

  constructor(config: Record<string, string>) {
    this.config = config as unknown as RestApiProviderConfig;
  }

  getProviderMetadata(): ProviderMetadata {
    return META;
  }

  async validateConnection(): Promise<ProviderConnectionResult> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 5000);
      const res = await fetch(this.config.baseUrl, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timer);
      return {
        success: res.ok,
        latencyMs: Date.now() - start,
        message: res.ok ? "Connection successful" : `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }

  async getCompanyPreview(
    companyId: string,
    options?: FetchOptions
  ): Promise<CompanyPreview> {
    const start = Date.now();
    logger.info({ companyId, baseUrl: this.config.baseUrl }, "RestApiProvider.getCompanyPreview");

    try {
      const url = new URL(this.config.baseUrl);
      url.searchParams.set(this.config.companyIdParam ?? "companyId", companyId);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(this.config.headers ?? {}),
      };

      if (this.config.authType === "bearer" && this.config.apiKeyRef) {
        const token = process.env[this.config.apiKeyRef];
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } else if (this.config.authType === "api_key" && this.config.apiKeyRef) {
        const key = process.env[this.config.apiKeyRef];
        if (key) headers["X-API-Key"] = key;
      }

      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        options?.timeoutMs ?? this.config.timeoutMs ?? 10000
      );

      const res = await fetch(url.toString(), { headers, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        throw new ProviderError("rest-api", `HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as Record<string, unknown>;

      return {
        companyId,
        fetchedAt: new Date().toISOString(),
        providerName: "rest-api",
        data: options?.fields?.length
          ? Object.fromEntries(options.fields.map((f) => [f, data[f] ?? null]))
          : data,
        metadata: {
          fieldCount: Object.keys(data).length,
          queryDurationMs: Date.now() - start,
          source: this.config.baseUrl,
        },
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError("rest-api", err instanceof Error ? err.message : "Unknown error");
    }
  }
}
