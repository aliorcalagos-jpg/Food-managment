import { createHash } from "node:crypto";
import { db } from "./db";

export type Rule = { key: string; limit: number; windowSeconds: number };

// "now" is read from the database, in UTC to match how Prisma stores timestamps,
// so instances with skewed clocks agree on window boundaries.
const NOW = "(now() AT TIME ZONE 'UTC')";

/**
 * Count one hit against a fixed window and say whether it is still within the
 * limit. One atomic upsert, so concurrent requests can't slip past the limit.
 */
export async function hit(rule: Rule): Promise<{ allowed: boolean; count: number }> {
  const rows = await db.$queryRawUnsafe<{ count: number }[]>(
    `INSERT INTO "RateLimit" ("key", "count", "windowStart")
     VALUES ($1, 1, ${NOW})
     ON CONFLICT ("key") DO UPDATE SET
       "count" = CASE WHEN "RateLimit"."windowStart" <= ${NOW} - make_interval(secs => $2::double precision)
                      THEN 1 ELSE "RateLimit"."count" + 1 END,
       "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${NOW} - make_interval(secs => $2::double precision)
                            THEN ${NOW} ELSE "RateLimit"."windowStart" END
     RETURNING "count"`,
    rule.key,
    rule.windowSeconds,
  );
  const count = Number(rows[0].count);
  return { allowed: count <= rule.limit, count };
}

/** Counts a hit on every rule and allows the request only if all of them allow it. */
export async function hitAll(rules: Rule[]): Promise<boolean> {
  const results = await Promise.all(rules.map(hit));
  // Stale windows are dead weight; sweep them occasionally rather than on every request.
  if (Math.random() < 0.01) {
    await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 3600 * 1000) } } }).catch(() => {});
  }
  return results.every((r) => r.allowed);
}

const digest = (s: string) => createHash("sha256").update(s.toLowerCase()).digest("hex").slice(0, 32);

const LOGIN_WINDOW = 15 * 60;

/**
 * Login throttling. Per (ip, account) so a stranger can't lock a real user out
 * from their own network, plus a looser per-ip cap against spraying many accounts.
 * With no known ip (not behind a trusted proxy) only the per-account cap applies.
 */
export function loginRules(ip: string | null, email: string): Rule[] {
  const rules: Rule[] = [{ key: `login:${ip ?? "any"}:${digest(email)}`, limit: 10, windowSeconds: LOGIN_WINDOW }];
  if (ip) rules.push({ key: `login-ip:${ip}`, limit: 50, windowSeconds: LOGIN_WINDOW });
  return rules;
}

export function signupRules(ip: string | null): Rule[] {
  return [{ key: `signup:${ip ?? "unknown"}`, limit: ip ? 10 : 100, windowSeconds: 3600 }];
}

export const allowLogin = (ip: string | null, email: string) => hitAll(loginRules(ip, email));
export const allowSignup = (ip: string | null) => hitAll(signupRules(ip));
