import "server-only";
import { neon } from "@neondatabase/serverless";
import type { GameStats, Store } from "./types";
import { COUNTER_DAYS, daysBefore, RETENTION_DAYS, windowStart } from "./types";

/*
  Neon over HTTP: one round trip per query, no connection pool to manage in
  a serverless function. Schema in db/schema.sql.
*/

export function postgresStore(databaseUrl: string): Store {
  const sql = neon(databaseUrl);

  return {
    async hit(key, windowSeconds, now = new Date()) {
      const start = windowStart(now, windowSeconds).toISOString();
      const rows = await sql`
        INSERT INTO rate_counters (key, window_start, count)
        VALUES (${key}, ${start}, 1)
        ON CONFLICT (key, window_start) DO UPDATE SET count = rate_counters.count + 1
        RETURNING count`;
      return Number(rows[0].count);
    },

    async count(key, windowSeconds, now = new Date()) {
      const start = windowStart(now, windowSeconds).toISOString();
      const rows = await sql`SELECT count FROM rate_counters WHERE key = ${key} AND window_start = ${start}`;
      return rows.length ? Number(rows[0].count) : 0;
    },

    async recordAttempt(a) {
      await sql`
        INSERT INTO attempts (
          session_id, level, guard_mode, guard_score, model, message, reply, reasoning,
          tool_calls, outcome, latency_ms, prompt_tokens, completion_tokens, country, error
        ) VALUES (
          ${a.sessionId}, ${a.level}, ${a.guardMode}, ${a.guardScore}, ${a.model}, ${a.message},
          ${a.reply}, ${a.reasoning}, ${JSON.stringify(a.toolCalls)}::jsonb, ${a.outcome},
          ${a.latencyMs}, ${a.promptTokens}, ${a.completionTokens}, ${a.country}, ${a.error}
        )`;
    },

    async forget(sessionId) {
      const rows = await sql`DELETE FROM attempts WHERE session_id = ${sessionId} RETURNING 1`;
      return rows.length;
    },

    async prune(now = new Date()) {
      const oldest = daysBefore(now, RETENTION_DAYS).toISOString();
      const counterOldest = daysBefore(now, COUNTER_DAYS).toISOString();
      await sql`DELETE FROM attempts WHERE created_at < ${oldest}`;
      await sql`DELETE FROM rate_counters WHERE window_start < ${counterOldest}`;
    },

    async stats(): Promise<GameStats> {
      const [totals, levels] = await Promise.all([
        sql`SELECT count(*) AS attempts, count(DISTINCT session_id) AS players FROM attempts WHERE outcome <> 'error'`,
        sql`
          SELECT level,
                 count(*) AS attempts,
                 count(*) FILTER (WHERE outcome = 'transferred') AS wins,
                 count(*) FILTER (WHERE outcome = 'blocked_by_till') AS fooled
          FROM attempts WHERE outcome <> 'error' GROUP BY level ORDER BY level`,
      ]);
      return {
        attempts: Number(totals[0].attempts),
        players: Number(totals[0].players),
        levels: levels.map((row) => ({
          level: Number(row.level),
          attempts: Number(row.attempts),
          wins: Number(row.wins),
          fooled: Number(row.fooled),
        })),
      };
    },
  };
}
