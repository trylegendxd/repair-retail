/**
 * Cloudflare D1 Database REST API client.
 * Mirrors the Worker-binding D1Database surface used by the route handlers:
 * prepare().bind().first()/all()/run() plus batch(), including result meta.
 */

export interface D1Meta {
  changes: number;
  last_row_id: number;
  duration: number;
  rows_read: number;
  rows_written: number;
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: D1Meta;
}

interface D1ApiQueryResult {
  success?: boolean;
  results?: unknown[];
  meta?: Partial<D1Meta>;
  error?: string;
}

interface D1ApiResponse {
  success?: boolean;
  result?: D1ApiQueryResult[];
  errors?: Array<{ code?: number; message?: string }>;
}

const EMPTY_META: D1Meta = { changes: 0, last_row_id: 0, duration: 0, rows_read: 0, rows_written: 0 };

function toMeta(meta: Partial<D1Meta> | undefined): D1Meta {
  return {
    changes: Number(meta?.changes ?? 0),
    last_row_id: Number(meta?.last_row_id ?? 0),
    duration: Number(meta?.duration ?? 0),
    rows_read: Number(meta?.rows_read ?? 0),
    rows_written: Number(meta?.rows_written ?? 0),
  };
}

export class D1PreparedStatement {
  constructor(
    private readonly client: CloudflareD1API,
    readonly sql: string,
    readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): D1PreparedStatement {
    return new D1PreparedStatement(this.client, this.sql, params);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await this.client.execute<T>(this.sql, this.params);
    return result.results[0] ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.client.execute<T>(this.sql, this.params);
  }

  async run(): Promise<D1Result> {
    return this.client.execute(this.sql, this.params);
  }
}

export class CloudflareD1API {
  private readonly endpoint: string;
  private readonly apiToken: string;

  constructor(config: { accountId: string; databaseId: string; apiToken: string }) {
    if (!config.accountId || !config.databaseId || !config.apiToken) {
      throw new Error("CloudflareD1API requires accountId, databaseId, and apiToken");
    }
    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;
    this.apiToken = config.apiToken;
  }

  prepare(sql: string): D1PreparedStatement {
    return new D1PreparedStatement(this, sql);
  }

  /**
   * Executes statements sequentially over the REST API. This is not one SQL
   * transaction, so multi-statement writes must stay individually guarded
   * (the offer-acceptance statements each carry their own WHERE/EXISTS
   * conditions and remain correct when run one at a time — each single UPDATE
   * is atomic in SQLite).
   */
  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const results: D1Result[] = [];
    for (const statement of statements) {
      results.push(await this.execute(statement.sql, statement.params));
    }
    return results;
  }

  async execute<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<D1Result<T>> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });

    let data: D1ApiResponse;
    try {
      data = (await response.json()) as D1ApiResponse;
    } catch {
      throw new Error(`D1 API error: HTTP ${response.status} with unreadable body`);
    }

    if (!response.ok || data.success === false) {
      const message = data.errors?.[0]?.message || `HTTP ${response.status}`;
      throw new Error(`D1 API error: ${message}`);
    }

    const result = data.result?.[0];
    if (!result || result.success === false) {
      throw new Error(`D1 query error: ${result?.error || "unknown error"}`);
    }

    return {
      results: (result.results ?? []) as T[],
      success: true,
      meta: toMeta(result.meta) ?? EMPTY_META,
    };
  }
}
