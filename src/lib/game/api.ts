/*
  The wire contract between /api/attempt and the browser. Types only, so the
  client can import it without pulling any server code.
*/

import type { Outcome } from "./judge";

export type AttemptOutcome = Outcome | "guard_blocked" | "garbled";

export type TransferView = {
  /** The number Mlinzi gave, in local format, e.g. "0712 345 678". */
  phone: string | null;
  /** The refund whose number on file was paid. That number never leaves the server. */
  onFileFor: string | null;
  amountKes: number | null;
  valid: boolean;
  authorized: boolean;
  executed: boolean;
};

export type PlayedResult = {
  status: "played";
  outcome: AttemptOutcome;
  reply: string | null;
  transfers: TransferView[];
  /** Prompt Guard's score. On levels 1 to 3 it is recorded but never blocks. */
  guardScore: number | null;
  /** The score reached the blocking threshold: level 4 would have stopped this message. */
  guardFlagged: boolean;
  unlocked: number;
  /** Mlinzi was fooled on the last level, which wins the game. */
  finished: boolean;
};

export type RefusedResult = {
  status: "locked" | "rate_limited" | "busy" | "sleeping" | "disabled" | "unavailable";
  message: string;
};

export type PlayResult = PlayedResult | RefusedResult;

export type ApiResponse =
  | PlayResult
  | { status: "invalid" | "forbidden" | "offline"; message: string };
