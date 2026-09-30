import type { AttemptRecord, GameStats, Store } from "./types";
import { COUNTER_DAYS, daysBefore, RETENTION_DAYS, windowStart } from "./types";

type Logged = AttemptRecord & { createdAt: Date };

/** Local development and tests only. Refused on Vercel by config.ts. */
export function memoryStore(): Store & { attempts: Logged[] } {
  const counters = new Map<string, { start: Date; count: number }>();
  const attempts: Logged[] = [];
  const slot = (key: string, windowSeconds: number, now: Date) =>
    `${key}@${windowStart(now, windowSeconds).toISOString()}`;

  return {
    attempts,

    async hit(key, windowSeconds, now = new Date()) {
      const id = slot(key, windowSeconds, now);
      const counter = counters.get(id) ?? { start: windowStart(now, windowSeconds), count: 0 };
      counter.count += 1;
      counters.set(id, counter);
      return counter.count;
    },

    async count(key, windowSeconds, now = new Date()) {
      return counters.get(slot(key, windowSeconds, now))?.count ?? 0;
    },

    async recordAttempt(attempt) {
      attempts.push({ ...attempt, createdAt: new Date() });
    },

    async forget(sessionId) {
      const before = attempts.length;
      const kept = attempts.filter((a) => a.sessionId !== sessionId);
      attempts.splice(0, attempts.length, ...kept);
      return before - kept.length;
    },

    async prune(now = new Date()) {
      const oldest = daysBefore(now, RETENTION_DAYS);
      attempts.splice(0, attempts.length, ...attempts.filter((a) => a.createdAt >= oldest));
      const counterOldest = daysBefore(now, COUNTER_DAYS);
      for (const [id, counter] of counters) {
        if (counter.start < counterOldest) counters.delete(id);
      }
    },

    async stats(): Promise<GameStats> {
      const played = attempts.filter((a) => a.outcome !== "error");
      const levels = new Map<number, { attempts: number; wins: number; fooled: number }>();
      for (const a of played) {
        const row = levels.get(a.level) ?? { attempts: 0, wins: 0, fooled: 0 };
        row.attempts += 1;
        if (a.outcome === "transferred") row.wins += 1;
        if (a.outcome === "blocked_by_till") row.fooled += 1;
        levels.set(a.level, row);
      }
      return {
        attempts: played.length,
        players: new Set(played.map((a) => a.sessionId)).size,
        levels: [...levels].map(([level, row]) => ({ level, ...row })).sort((a, b) => a.level - b.level),
      };
    },
  };
}
