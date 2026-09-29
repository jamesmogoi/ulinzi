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

export interface Store {
  /** Count one hit in a fixed window and return the count so far. */
  hit(key: string, windowSeconds: number, now?: Date): Promise<number>;
  recordAttempt(attempt: AttemptRecord): Promise<void>;
  stats(): Promise<GameStats>;
}

export function windowStart(now: Date, windowSeconds: number): Date {
  const size = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / size) * size);
}
