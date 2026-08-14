/**
 * Cloudflare R2 client over the S3-compatible API with AWS Signature V4.
 * Mirrors the Worker-binding R2Bucket surface used by the route handlers:
 * put(), get() returning { body, size }, delete() accepting one key or many.
 */

import { createHash, createHmac } from "node:crypto";

interface R2HTTPMetadata {
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
}

export interface R2ObjectBody {
  key: string;
  body: Uint8Array;
  size: number;
  etag?: string;
  httpMetadata: R2HTTPMetadata;
}

const UNRESERVED = /[A-Za-z0-9\-._~]/;

function encodeRfc3986Segment(segment: string): string {
  let out = "";
  for (const char of segment) {
    out += UNRESERVED.test(char)
      ? char
      : Array.from(new TextEncoder().encode(char), (b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`).join("");
  }
  return out;
}

function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

export class CloudflareR2API {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly bucketName: string;
  private readonly host: string;

  constructor(config: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  }) {
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
      throw new Error("CloudflareR2API requires accountId, accessKeyId, secretAccessKey, and bucketName");
    }
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.bucketName = config.bucketName;
    this.host = `${config.accountId}.r2.cloudflarestorage.com`;
  }

  private async signedFetch(
    method: string,
    key: string,
    body?: Uint8Array,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    const canonicalPath = `/${encodeRfc3986Segment(this.bucketName)}/${key.split("/").map(encodeRfc3986Segment).join("/")}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
    const dateStamp = amzDate.slice(0, 8);
    const region = "auto";
    const service = "s3";
    const payloadHash = sha256Hex(body ?? "");

    // Canonical headers: lowercase names, sorted, trimmed values.
    const headers: Record<string, string> = {
      host: this.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    for (const [name, value] of Object.entries(extraHeaders)) {
      headers[name.toLowerCase()] = value.trim();
    }
    const sortedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join("");
    const signedHeaders = sortedHeaderNames.join(";");

    const canonicalRequest = [method, canonicalPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");

    const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const requestHeaders: Record<string, string> = { ...headers, authorization };
    delete requestHeaders.host; // fetch sets Host from the URL

    return fetch(`https://${this.host}${canonicalPath}`, {
      method,
      headers: requestHeaders,
      body: body as BodyInit | undefined,
    });
  }

  async put(
    key: string,
    data: Uint8Array | ArrayBuffer,
    options?: { httpMetadata?: R2HTTPMetadata },
  ): Promise<{ key: string; size: number; etag?: string }> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const extraHeaders: Record<string, string> = {};
    if (options?.httpMetadata?.contentType) extraHeaders["content-type"] = options.httpMetadata.contentType;
    if (options?.httpMetadata?.cacheControl) extraHeaders["cache-control"] = options.httpMetadata.cacheControl;

    const response = await this.signedFetch("PUT", key, bytes, extraHeaders);
    if (!response.ok) {
      throw new Error(`R2 upload failed: HTTP ${response.status} ${await response.text().catch(() => "")}`);
    }
    return { key, size: bytes.byteLength, etag: response.headers.get("etag") ?? undefined };
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const response = await this.signedFetch("GET", key);
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`R2 get failed: HTTP ${response.status}`);
    }
    const body = new Uint8Array(await response.arrayBuffer());
    return {
      key,
      body,
      size: body.byteLength,
      etag: response.headers.get("etag") ?? undefined,
      httpMetadata: {
        contentType: response.headers.get("content-type") ?? undefined,
        cacheControl: response.headers.get("cache-control") ?? undefined,
      },
    };
  }

  async delete(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    await Promise.all(
      list.map(async (key) => {
        const response = await this.signedFetch("DELETE", key);
        if (!response.ok && response.status !== 404) {
          throw new Error(`R2 delete failed for ${key}: HTTP ${response.status}`);
        }
      }),
    );
  }
}
