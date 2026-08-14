import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// The Drizzle client requires a Cloudflare Worker D1 binding. After the
// Vercel refactor, runtime queries go through lib/cloudflare-d1-api.ts
// instead; this module remains for drizzle-kit tooling and any future
// Worker deployment that reintroduces the binding.
export function getDb() {
  const env = (globalThis as typeof globalThis & { __REPAIRTRACE_RUNTIME_ENV__?: { DB?: unknown } }).__REPAIRTRACE_RUNTIME_ENV__ ?? {};
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Runtime queries use the REST client in lib/cloudflare-d1-api.ts; this Drizzle client only works on a Worker deployment with a real D1 binding."
    );
  }

  return drizzle(env.DB as never, { schema });
}
