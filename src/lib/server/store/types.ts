import type { GuardMode } from "../../game/levels";

export type AttemptRecord = {
  sessionId: string;
  level: number;
  guardMode: GuardMode;
  guardScore: number | null;
  model: string | null;
  /** Everything below is redacted before it gets here. */
  message: string;
  reply: string | null;
  reasoning: string | null;
  toolCalls: unknown;
  outcome: string;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  country: string | null;
  error: string | null;
};

export type LevelStats = {
  level: number;
  attempts: number;
  /** Money left the till. */
  wins: number;
  /** The model was fooled but the till refused (level 5). */
  fooled: number;
};

export type GameStats = {
  attempts: number;
  players: number;
  levels: LevelStats[];
};

/** How long the research log keeps an attempt. The privacy page promises this. */
export const RETENTION_DAYS = 365;
/** Rate counters are only read in their own window; two days is plenty. */
export const COUNTER_DAYS = 2;

export interface Store {
  /** Count one hit in a fixed window and return the count so far. */
  hit(key: string, windowSeconds: number, now?: Date): Promise<number>;
  /** The count so far in the current window, without adding to it. */
  count(key: string, windowSeconds: number, now?: Date): Promise<number>;
  recordAttempt(attempt: AttemptRecord): Promise<void>;
  /** Delete every attempt logged under a session, and say how many. */
  forget(sessionId: string): Promise<number>;
  /** Delete attempts past retention and counters past use. */
  prune(now?: Date): Promise<void>;
  /** Totals for the scoreboard. Failed attempts (errors) are not counted. */
  stats(): Promise<GameStats>;
}

export function windowStart(now: Date, windowSeconds: number): Date {
  const size = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / size) * size);
}

export function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}
