/**
 * Cloudflare R2 S3-Compatible REST API Client
 * Replaces Worker binding when running on standard Node.js/Vercel
 * Uses S3-compatible API that R2 provides
 */

interface R2Object {
  key: string;
  size: number;
  etag?: string;
  uploaded?: Date;
}

interface R2HTTPMetadata {
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
  [key: string]: unknown;
}

export class CloudflareR2API {
  private accountId: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private bucketName: string;
  private s3Endpoint: string;

  constructor(config: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  }) {
    if (
      !config.accountId ||
      !config.accessKeyId ||
      !config.secretAccessKey ||
      !config.bucketName
    ) {
      throw new Error(
        "CloudflareR2API requires accountId, accessKeyId, secretAccessKey, and bucketName"
      );
    }

    this.accountId = config.accountId;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.bucketName = config.bucketName;

    // R2 S3-compatible endpoint
    this.s3Endpoint = `https://${this.accountId}.r2.cloudflarestorage.com`;
  }

  private signRequest(
    method: string,
    path: string,
    headers: Record<string, string>
  ): Record<string, string> {
    // For simplicity, using AWS Signature Version 4
    // In production, consider using AWS SDK or similar library
    const crypto = require("crypto");

    const amzDate = new Date().toISOString().replace(/[:-]/g, "").split(".")[0] + "Z";
    const dateStamp = amzDate.split("T")[0];

    const canonicalRequest = [
      method,
      path,
      "",
      Object.entries(headers)
        .map(([k, v]) => `${k.toLowerCase()}:${v}`)
        .join("\n"),
      "",
      Object.keys(headers)
        .map((k) => k.toLowerCase())
        .sort()
        .join(";"),
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const canonicalRequestHash = crypto
      .createHash("sha256")
      .update(canonicalRequest)
      .digest("hex");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      `${dateStamp}/auto/s3/aws4_request`,
      canonicalRequestHash,
    ].join("\n");

    const kDate = crypto
      .createHmac("sha256", `AWS4${this.secretAccessKey}`)
      .update(dateStamp)
      .digest();

    const kRegion = crypto
      .createHmac("sha256", kDate)
      .update("auto")
      .digest();

    const kService = crypto
      .createHmac("sha256", kRegion)
      .update("s3")
      .digest();

    const kSigning = crypto
      .createHmac("sha256", kService)
      .update("aws4_request")
      .digest();

    const signature = crypto
      .createHmac("sha256", kSigning)
      .update(stringToSign)
      .digest("hex");

    const authHeader = [
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${dateStamp}/auto/s3/aws4_request`,
      `SignedHeaders=${Object.keys(headers)
        .map((k) => k.toLowerCase())
        .sort()
        .join(";")}`,
      `Signature=${signature}`,
    ].join(", ");

    return {
      ...headers,
      Authorization: authHeader,
      "X-Amz-Date": amzDate,
    };
  }

  async put(
    key: string,
    data: Uint8Array | ArrayBuffer | Buffer,
    options?: { httpMetadata?: R2HTTPMetadata }
  ): Promise<R2Object> {
    const path = `/${this.bucketName}/${key}`;
    const method = "PUT";

    const headers: Record<string, string> = {
      Host: `${this.accountId}.r2.cloudflarestorage.com`,
    };

    if (options?.httpMetadata?.contentType) {
      headers["Content-Type"] = options.httpMetadata.contentType;
    }

    if (options?.httpMetadata?.cacheControl) {
      headers["Cache-Control"] = options.httpMetadata.cacheControl;
    }

    const signedHeaders = this.signRequest(method, path, headers);

    try {
      const response = await fetch(`${this.s3Endpoint}${path}`, {
        method,
        headers: signedHeaders,
        body: data,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`R2 Upload Error: ${response.status} - ${errorText}`);
      }

      return {
        key,
        size: data instanceof Uint8Array ? data.length : Buffer.byteLength(data),
        etag: response.headers.get("etag") || undefined,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`R2 API Error: ${message}`);
    }
  }

  async delete(key: string): Promise<void> {
    const path = `/${this.bucketName}/${key}`;
    const method = "DELETE";

    const headers: Record<string, string> = {
      Host: `${this.accountId}.r2.cloudflarestorage.com`,
    };

    const signedHeaders = this.signRequest(method, path, headers);

    try {
      const response = await fetch(`${this.s3Endpoint}${path}`, {
        method,
        headers: signedHeaders,
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`R2 Delete Error: ${response.status}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`R2 API Error: ${message}`);
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    const path = `/${this.bucketName}/${key}`;
    const method = "GET";

    const headers: Record<string, string> = {
      Host: `${this.accountId}.r2.cloudflarestorage.com`,
    };

    const signedHeaders = this.signRequest(method, path, headers);

    try {
      const response = await fetch(`${this.s3Endpoint}${path}`, {
        method,
        headers: signedHeaders,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`R2 Get Error: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`R2 API Error: ${message}`);
    }
  }

  // Compatibility method for bulk operations
  async deleteMultiple(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }
}
