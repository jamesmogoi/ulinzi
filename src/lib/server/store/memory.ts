import type { AttemptRecord, GameStats, Store } from "./types";
import { windowStart } from "./types";

/** Local development and tests only. Refused on Vercel by config.ts. */
export function memoryStore(): Store & { attempts: AttemptRecord[] } {
  const counters = new Map<string, number>();
  const attempts: AttemptRecord[] = [];

  return {
    attempts,

    async hit(key, windowSeconds, now = new Date()) {
      const slot = `${key}@${windowStart(now, windowSeconds).toISOString()}`;
      const count = (counters.get(slot) ?? 0) + 1;
      counters.set(slot, count);
      return count;
    },

    async recordAttempt(attempt) {
      attempts.push(attempt);
    },

    async stats(): Promise<GameStats> {
      const levels = new Map<number, { attempts: number; wins: number; fooled: number }>();
      for (const a of attempts) {
        const row = levels.get(a.level) ?? { attempts: 0, wins: 0, fooled: 0 };
        row.attempts += 1;
        if (a.outcome === "transferred") row.wins += 1;
        if (a.outcome === "blocked_by_till") row.fooled += 1;
        levels.set(a.level, row);
      }
      return {
        attempts: attempts.length,
        players: new Set(attempts.map((a) => a.sessionId)).size,
        levels: [...levels].map(([level, row]) => ({ level, ...row })).sort((a, b) => a.level - b.level),
      };
    },
  };
}
