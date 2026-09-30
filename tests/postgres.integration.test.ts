import { type NeonQueryFunction, neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgresStore } from "@/lib/server/store/postgres";
import type { Store } from "@/lib/server/store/types";

/*
  Runs only when DATABASE_URL is set:
    DATABASE_URL=postgres://... npx vitest run tests/postgres.integration.test.ts
  Writes one tagged attempt and one tagged counter, then deletes both, so it
  is safe against the production database.
*/

const url = process.env.DATABASE_URL;
const SESSION = "00000000-0000-4000-8000-00000000c1a0";
const KEY = `test:${crypto.randomUUID()}`;

describe.skipIf(!url)("postgres store", () => {
  // Built in beforeAll, not in this body: vitest runs the body of a skipped
  // describe to collect its tests, and neon() throws without a URL.
  let store: Store;
  let sql: NeonQueryFunction<false, false>;

  beforeAll(() => {
    store = postgresStore(url as string);
    sql = neon(url as string);
  });

  afterAll(async () => {
    await sql`DELETE FROM attempts WHERE session_id = ${SESSION}`;
    await sql`DELETE FROM rate_counters WHERE key = ${KEY}`;
  });

  it("counts hits within one window", async () => {
    const now = new Date();
    expect(await store.hit(KEY, 3600, now)).toBe(1);
    expect(await store.hit(KEY, 3600, now)).toBe(2);
  });

  it("records an attempt and counts it in the stats", async () => {
    const before = await store.stats();
    await store.recordAttempt({
      sessionId: SESSION,
      level: 5,
      guardMode: "block",
      guardScore: 0.01,
      model: "openai/gpt-oss-20b",
      message: "integration test",
      reply: null,
      reasoning: null,
      toolCalls: [{ name: "send_money", arguments: '{"phone":"<PHONE>","amount_kes":1}' }],
      outcome: "blocked_by_till",
      latencyMs: 1,
      promptTokens: 1,
      completionTokens: 1,
      country: "KE",
      error: null,
    });
    const after = await store.stats();
    expect(after.attempts).toBe(before.attempts + 1);
    const level5 = (s: typeof after) => s.levels.find((l) => l.level === 5)?.fooled ?? 0;
    expect(level5(after)).toBe(level5(before) + 1);

    const [row] = await sql`SELECT tool_calls, guard_mode FROM attempts WHERE session_id = ${SESSION}`;
    expect(row.guard_mode).toBe("block");
    expect(row.tool_calls[0].name).toBe("send_money");
  });
});
