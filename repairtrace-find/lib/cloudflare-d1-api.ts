/**
 * Cloudflare D1 Database REST API Client
 * Replaces Worker binding when running on standard Node.js/Vercel
 */

interface D1QueryParams {
  sql: string;
  params: unknown[];
}

interface D1Result<T> {
  results: T[];
  success: boolean;
  error?: string;
}

interface PreparedStatement {
  bind: (...params: unknown[]) => {
    first: <T>() => Promise<T | undefined>;
    all: <T>() => Promise<D1Result<T>>;
    run: () => Promise<{ success: boolean }>;
  };
}

export class CloudflareD1API {
  private accountId: string;
  private databaseId: string;
  private apiToken: string;
  private apiBaseUrl = "https://api.cloudflare.com/client/v4";

  constructor(config: {
    accountId: string;
    databaseId: string;
    apiToken: string;
  }) {
    if (!config.accountId || !config.databaseId || !config.apiToken) {
      throw new Error(
        "CloudflareD1API requires accountId, databaseId, and apiToken"
      );
    }
    this.accountId = config.accountId;
    this.databaseId = config.databaseId;
    this.apiToken = config.apiToken;
  }

  private async executeQuery<T>(
    sql: string,
    params: unknown[]
  ): Promise<D1Result<T>> {
    const url = `${this.apiBaseUrl}/accounts/${this.accountId}/d1/database/${this.databaseId}/query`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql,
          params,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { errors?: Array<{message?: string}> };
        const errorMessage =
          errorData.errors?.[0]?.message || `HTTP ${response.status}`;
        throw new Error(`D1 API Error: ${errorMessage}`);
      }

      const data = await response.json() as {
        result?: Array<{
          success?: boolean;
          results?: T[];
          error?: string;
        }>;
      };

      const result = data.result?.[0];

      if (!result?.success) {
        throw new Error(`D1 Query Error: ${result?.error || "Unknown error"}`);
      }

      return {
        results: result.results || [],
        success: true,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`D1 API Error: ${message}`);
    }
  }

  prepare(sql: string): PreparedStatement {
    return {
      bind: (...params: unknown[]) => ({
        first: async <T>(): Promise<T | undefined> => {
          const result = await this.executeQuery<T>(sql, params);
          return result.results?.[0];
        },
        all: async <T>(): Promise<D1Result<T>> => {
          return this.executeQuery<T>(sql, params);
        },
        run: async () => {
          try {
            await this.executeQuery(sql, params);
            return { success: true };
          } catch (error) {
            return { success: false };
          }
        },
      }),
    };
  }
}
