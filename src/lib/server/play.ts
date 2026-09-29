import "server-only";
import type { AttemptOutcome, PlayedResult, PlayResult, TransferView } from "../game/api";
import { type Transfer, judge } from "../game/judge";
import { getLevel, MAX_LEVEL } from "../game/levels";
import { formatLocalPhone } from "../game/phone";
import { redact } from "../game/redact";
import { APPROVED_REFUNDS } from "../game/till";
import type { Session } from "../session";
import { type ChatResult, ModelOutputError, QuotaExhaustedError } from "./llm";
import { systemPromptFor } from "./prompts";
import type { AttemptRecord, Store } from "./store/types";

/*
  One attempt, start to finish:
    limits -> guard (blocking, or scored in the shadow) -> model -> judge -> log
  Every attempt is a fresh conversation. Mlinzi keeps no memory between
  messages, so nobody can smuggle a forged earlier turn into the history.
  Dependencies are injected so tests drive this without a network.
*/

export type PlayLimits = {
  guardThreshold: number;
  dailyAttemptCap: number;
  ipHourlyLimit: number;
  gameEnabled: boolean;
};

export type PlayDeps = {
  store: Store;
  chat: (system: string, user: string) => Promise<ChatResult>;
  scoreInjection: (text: string) => Promise<number>;
  limits: PlayLimits;
  now?: () => number;
};

export type PlayInput = {
  level: number;
  message: string;
  session: Session;
  ipHash: string;
  country: string | null;
};

const KEEP = new Set(APPROVED_REFUNDS.map((refund) => refund.phone));
const BUSY_THRESHOLD_SECONDS = 120;

const MESSAGES = {
  locked: "That level is still locked. Beat the one before it first.",
  rate_limited: "Pole! Too many tries from your network this hour. Come back in a bit.",
  busy: "Mlinzi is catching his breath. Try again in a minute.",
  sleeping: "Mlinzi amelala. Today's free AI quota is used up. Rudi kesho!",
  disabled: "Mlinzi is off duty for maintenance. Rudi baadaye.",
  unavailable: "Something went wrong reaching Mlinzi. Try again.",
} as const;

function refusal(status: keyof typeof MESSAGES): PlayResult {
  return { status, message: MESSAGES[status] };
}

function describe(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.slice(0, 300);
}

function view(transfer: Transfer): TransferView {
  return { ...transfer, phone: transfer.phone ? formatLocalPhone(transfer.phone) : null };
}

export async function play(input: PlayInput, deps: PlayDeps): Promise<PlayResult> {
  const now = deps.now ?? Date.now;
  const started = now();
  const level = getLevel(input.level);

  if (!deps.limits.gameEnabled) return refusal("disabled");
  if (!level || level.id > input.session.unlocked) return refusal("locked");

  if ((await deps.store.hit(`ip:${input.ipHash}`, 3_600)) > deps.limits.ipHourlyLimit) {
    return refusal("rate_limited");
  }
  if ((await deps.store.hit("global", 86_400)) > deps.limits.dailyAttemptCap) {
    return refusal("sleeping");
  }

  const record = (fields: Partial<AttemptRecord> & Pick<AttemptRecord, "outcome">) =>
    deps.store.recordAttempt({
      sessionId: input.session.sid,
      level: level.id,
      guardMode: level.guardMode,
      guardScore: null,
      model: null,
      message: redact(input.message, KEEP),
      reply: null,
      reasoning: null,
      toolCalls: [],
      promptTokens: null,
      completionTokens: null,
      country: input.country,
      error: null,
      ...fields,
      latencyMs: now() - started,
    });

  const played = (outcome: AttemptOutcome, rest: Partial<PlayedResult> = {}): PlayResult => ({
    status: "played",
    outcome,
    reply: null,
    transfers: [],
    guardScore: null,
    unlocked: input.session.unlocked,
    ...rest,
  });

  // The guard. On blocking levels it runs first and fails closed. On the
  // others it scores in parallel with the model and never blocks, which is
  // how the research log gets guard scores for every attack, blocked or not.
  let guardScore: number | null = null;
  let shadowScore: Promise<number | null> | null = null;
  if (level.guardMode === "block") {
    try {
      guardScore = await deps.scoreInjection(input.message);
    } catch (error) {
      await record({ outcome: "error", error: `guard: ${describe(error)}` });
      return refusal("unavailable");
    }
    if (guardScore >= deps.limits.guardThreshold) {
      await record({ outcome: "guard_blocked", guardScore });
      return played("guard_blocked", { guardScore });
    }
  } else {
    shadowScore = deps.scoreInjection(input.message).catch(() => null);
  }

  let chat: ChatResult;
  try {
    chat = await deps.chat(systemPromptFor(level.id), input.message);
  } catch (error) {
    if (shadowScore) guardScore = await shadowScore;
    if (error instanceof ModelOutputError) {
      await record({ outcome: "garbled", guardScore, error: describe(error) });
      return played("garbled", { guardScore });
    }
    await record({ outcome: "error", guardScore, error: describe(error) });
    if (error instanceof QuotaExhaustedError) {
      const wait = error.retryAfter;
      return refusal(wait !== null && wait <= BUSY_THRESHOLD_SECONDS ? "busy" : "sleeping");
    }
    return refusal("unavailable");
  }
  if (shadowScore) guardScore = await shadowScore;

  const { outcome, transfers } = judge(chat.toolCalls, level.enforcement);
  const unlocked =
    outcome === "transferred"
      ? Math.min(MAX_LEVEL, Math.max(input.session.unlocked, level.id + 1))
      : input.session.unlocked;

  await record({
    outcome,
    guardScore,
    model: chat.model,
    reply: redact(chat.content, KEEP),
    reasoning: chat.reasoning === null ? null : redact(chat.reasoning, KEEP),
    toolCalls: chat.toolCalls.map((call) => ({ name: call.name, arguments: redact(call.arguments, KEEP) })),
    promptTokens: chat.promptTokens,
    completionTokens: chat.completionTokens,
  });

  return played(outcome, {
    reply: chat.content.trim() || null,
    transfers: transfers.map(view),
    guardScore,
    unlocked,
  });
}
