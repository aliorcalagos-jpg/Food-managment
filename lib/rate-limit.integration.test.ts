import { afterAll, describe, expect, it } from "vitest";
import { db } from "./db";
import { hit, hitAll, loginRules, signupRules } from "./rate-limit";

const run = process.env.DATABASE_URL ? describe : describe.skip;
const tag = `rl${Date.now()}`;
const k = (n: string) => `${tag}:${n}`;

run("rate limiter (database)", () => {
  afterAll(async () => {
    await db.rateLimit.deleteMany({ where: { key: { contains: tag } } });
    await db.$disconnect();
  });

  it("allows up to the limit then blocks", async () => {
    const rule = { key: k("basic"), limit: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await hit(rule)).allowed);
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("keeps keys independent", async () => {
    const a = { key: k("a"), limit: 1, windowSeconds: 60 };
    const b = { key: k("b"), limit: 1, windowSeconds: 60 };
    await hit(a);
    expect((await hit(a)).allowed).toBe(false);
    expect((await hit(b)).allowed).toBe(true);
  });

  it("starts a new window once the old one has expired", async () => {
    const rule = { key: k("window"), limit: 1, windowSeconds: 60 };
    await hit(rule);
    expect((await hit(rule)).allowed).toBe(false);
    await db.rateLimit.update({ where: { key: rule.key }, data: { windowStart: new Date(Date.now() - 61_000) } });
    expect(await hit(rule)).toEqual({ allowed: true, count: 1 });
    expect((await hit(rule)).allowed).toBe(false);
  });

  it("does not reset a window that is still open", async () => {
    const rule = { key: k("open"), limit: 1, windowSeconds: 60 };
    await hit(rule);
    await db.rateLimit.update({ where: { key: rule.key }, data: { windowStart: new Date(Date.now() - 59_000) } });
    expect((await hit(rule)).allowed).toBe(false);
  });

  it("counts concurrent hits exactly (no lost updates)", async () => {
    const rule = { key: k("race"), limit: 10, windowSeconds: 60 };
    const results = await Promise.all(Array.from({ length: 25 }, () => hit(rule)));
    expect(results.map((r) => r.count).sort((x, y) => x - y)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
  });

  it("hitAll blocks if any rule is exhausted", async () => {
    const loose = { key: k("loose"), limit: 100, windowSeconds: 60 };
    const tight = { key: k("tight"), limit: 1, windowSeconds: 60 };
    expect(await hitAll([loose, tight])).toBe(true);
    expect(await hitAll([loose, tight])).toBe(false);
  });
});

describe("rate limit policy", () => {
  it("scopes login per ip and account, hashes the email, and adds an ip-wide cap", () => {
    const rules = loginRules("1.2.3.4", "Ann@Example.com");
    expect(rules).toHaveLength(2);
    expect(rules[0].key).not.toContain("ann");
    expect(rules[0].key).not.toContain("example");
    // case-insensitive: the same account can't dodge the limit by changing case
    expect(loginRules("1.2.3.4", "ann@example.com")[0].key).toBe(rules[0].key);
    expect(loginRules("5.6.7.8", "ann@example.com")[0].key).not.toBe(rules[0].key);
    expect(rules[1].limit).toBeGreaterThan(rules[0].limit);
  });

  it("without an ip only the per-account rule applies", () => {
    expect(loginRules(null, "a@b.co")).toHaveLength(1);
  });

  it("is looser for signups with no known ip so one bucket can't block everyone quickly", () => {
    expect(signupRules("1.2.3.4")[0].limit).toBe(10);
    expect(signupRules(null)[0].limit).toBe(100);
  });
});
