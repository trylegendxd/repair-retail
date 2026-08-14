import { getD1 } from "./server-marketplace";

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const db = getD1();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  try {
    const count = await db
      .prepare("SELECT COUNT(*) as cnt FROM rate_limit_events WHERE key = ? AND created_at > ?")
      .bind(key, since)
      .first<{ cnt: number }>();

    const current = count?.cnt ?? 0;
    if (current >= limit) {
      return { allowed: false, remaining: 0 };
    }

    await db
      .prepare("INSERT INTO rate_limit_events (id, key, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
      .bind(`rl_${crypto.randomUUID()}`, key)
      .run();

    // Opportunistic pruning so the table cannot grow without bound.
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await db.prepare("DELETE FROM rate_limit_events WHERE created_at < ?").bind(cutoff).run();
    }

    return { allowed: true, remaining: limit - current - 1 };
  } catch (error) {
    console.error("rate limit check failed", error);
    return { allowed: true, remaining: limit };
  }
}
