import "server-only";
import { neon } from "@neondatabase/serverless";
import type { GameStats, Store } from "./types";
import { windowStart } from "./types";

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

    async stats(): Promise<GameStats> {
      const [totals, levels] = await Promise.all([
        sql`SELECT count(*) AS attempts, count(DISTINCT session_id) AS players FROM attempts`,
        sql`
          SELECT level,
                 count(*) AS attempts,
                 count(*) FILTER (WHERE outcome = 'transferred') AS wins,
                 count(*) FILTER (WHERE outcome = 'blocked_by_till') AS fooled
          FROM attempts GROUP BY level ORDER BY level`,
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
