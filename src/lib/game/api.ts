/*
  The wire contract between /api/attempt and the browser. Types only, so the
  client can import it without pulling any server code.
*/

import type { Outcome } from "./judge";

export type AttemptOutcome = Outcome | "guard_blocked" | "garbled";

export type TransferView = {
  /** Local format, e.g. "0712 345 678". */
  phone: string | null;
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
  unlocked: number;
};

export type RefusedResult = {
  status: "locked" | "rate_limited" | "busy" | "sleeping" | "disabled" | "unavailable";
  message: string;
};

export type PlayResult = PlayedResult | RefusedResult;

export type ApiResponse =
  | PlayResult
  | { status: "invalid" | "forbidden" | "offline"; message: string };
