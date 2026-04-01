/**
 * Databricks SQL data provider — Phase 3 implementation.
 *
 * Uses the Databricks Statement Execution REST API:
 *   POST /api/2.0/sql/statements
 *
 * Auth token is read from the env var named in config.tokenRef.
 * The company lookup SQL can be overridden via config.companyQuery;
 * the default looks up a single row from {catalog}.{schema}.accounts
 * where the id column matches companyId.
 */

import type {
  DataSourceProvider,
  ProviderMetadata,
  ProviderConnectionResult,
  CompanyPreview,
  FetchOptions,
  DatabricksProviderConfig,
} from "@/types/providers";
import { ProviderError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const META: ProviderMetadata = {
  name: "databricks",
  displayName: "Databricks SQL",
  providerType: "DATABRICKS",
  version: "1.0.0",
  capabilities: ["COMPANY_PREVIEW", "FIELD_DISCOVERY", "BATCH_FETCH"],
  readOnly: true,
};

interface StatementResponse {
  statement_id: string;
  status: { state: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" };
  result?: {
    data_array?: (string | null)[][];
    schema?: { columns: { name: string; type_text: string }[] };
  };
  error?: { message: string };
}

export class DatabricksProvider implements DataSourceProvider {
  readonly metadata: ProviderMetadata = META;
  private readonly config: DatabricksProviderConfig;

  constructor(config: Record<string, string>) {
    this.config = config as unknown as DatabricksProviderConfig;
  }

  getProviderMetadata(): ProviderMetadata {
    return META;
  }

  private getToken(): string {
    const token = process.env[this.config.tokenRef];
    if (!token) {
      throw new ProviderError(
        "databricks",
        `Databricks token not found in env var "${this.config.tokenRef}"`
      );
    }
    return token;
  }

  private baseUrl(): string {
    return `https://${this.config.host}`;
  }

  private async executeStatement(
    sql: string,
    parameters: { name: string; value: string; type: string }[] = [],
    timeoutSeconds = 30
  ): Promise<StatementResponse> {
    const token = this.getToken();
    const res = await fetch(`${this.baseUrl()}/api/2.0/sql/statements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse_id: this.config.httpPath.split("/").pop(),
        statement: sql,
        wait_timeout: `${timeoutSeconds}s`,
        parameters,
        disposition: "INLINE",
        format: "JSON_ARRAY",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ProviderError("databricks", `HTTP ${res.status}: ${body}`);
    }

    return res.json() as Promise<StatementResponse>;
  }

  private rowsToRecords(result: StatementResponse["result"]): Record<string, unknown>[] {
    if (!result?.data_array || !result?.schema) return [];
    const cols = result.schema.columns.map((c) => c.name);
    return result.data_array.map((row) =>
      Object.fromEntries(cols.map((col, i) => [col, row[i] ?? null]))
    );
  }

  async validateConnection(): Promise<ProviderConnectionResult> {
    const start = Date.now();
    try {
      logger.info({ host: this.config.host }, "Databricks: validating connection");
      const result = await this.executeStatement("SELECT 1 AS ping", [], 10);
      const success = result.status.state === "SUCCEEDED";
      return {
        success,
        latencyMs: Date.now() - start,
        message: success ? "Databricks connection successful" : (result.error?.message ?? "Statement did not succeed"),
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
    logger.info({ companyId, host: this.config.host }, "DatabricksProvider.getCompanyPreview");

    try {
      const catalog = this.config.catalog ?? "hive_metastore";
      const schema = this.config.schema ?? "default";
      const table = "accounts";
      const fieldList = options?.fields?.length
        ? options.fields.map((f) => `\`${f}\``).join(", ")
        : "*";

      const sql = `SELECT ${fieldList} FROM \`${catalog}\`.\`${schema}\`.\`${table}\` WHERE id = :companyId LIMIT 1`;

      const result = await this.executeStatement(
        sql,
        [{ name: "companyId", value: companyId, type: "STRING" }],
        Math.floor((options?.timeoutMs ?? 30000) / 1000)
      );

      if (result.status.state !== "SUCCEEDED") {
        throw new ProviderError(
          "databricks",
          result.error?.message ?? `Statement state: ${result.status.state}`
        );
      }

      const records = this.rowsToRecords(result.result);
      if (records.length === 0) {
        throw new ProviderError("databricks", `No account found for companyId: ${companyId}`);
      }

      const data = records[0];
      return {
        companyId,
        fetchedAt: new Date().toISOString(),
        providerName: "databricks",
        data,
        metadata: {
          fieldCount: Object.keys(data).length,
          queryDurationMs: Date.now() - start,
          source: `${catalog}.${schema}.${table}`,
        },
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError("databricks", err instanceof Error ? err.message : "Unknown error");
    }
  }
}
