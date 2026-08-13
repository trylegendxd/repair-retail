const encoder = new TextEncoder();

export class AuthenticationRequiredError extends Error {
  constructor() { super("Sign in to access the workshop workspace."); this.name = "AuthenticationRequiredError"; }
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Returns a stable, non-readable owner key for database ownership checks.
 * The original email address is never stored in RepairTrace tables.
 */
export async function ownerIdFromRequest(request: Request) {
  const authenticatedEmail = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const hostname = new URL(request.url).hostname;
  const previewIdentity = hostname === "terminal.local" || hostname === "localhost" || hostname === "127.0.0.1";
  if (!authenticatedEmail && !previewIdentity) throw new AuthenticationRequiredError();
  const identity = authenticatedEmail || "local-preview-owner";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`repairtrace-owner:${identity}`));
  return `owner_${bytesToHex(digest).slice(0, 32)}`;
}
