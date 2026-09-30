import "server-only";
import type { AttemptOutcome, PlayedResult, PlayResult, RefusedResult, TransferView } from "../game/api";
import { type Transfer, judge } from "../game/judge";
import { getLevel, MAX_LEVEL } from "../game/levels";
import { formatLocalPhone } from "../game/phone";
import { redact } from "../game/redact";
import type { Session } from "../session";
import { NUMBERS_ON_FILE } from "./ledger";
import { type ChatResult, ModelOutputError, QuotaExhaustedError } from "./llm";
import { systemPromptFor } from "./prompts";
import { type AttemptRecord, type Store, windowStart } from "./store/types";

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
  sessionHourlyLimit: number;
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

const HOUR = 3_600;
const DAY = 86_400;
const KEEP = new Set(Object.values(NUMBERS_ON_FILE));

const MESSAGES = {
  locked: "That level is still locked. Beat the one before it first.",
  sleeping: "Mlinzi amelala. Today's free AI quota is used up. Rudi kesho!",
  disabled: "Mlinzi is off duty for maintenance. Rudi baadaye.",
  unavailable: "Something went wrong reaching Mlinzi. Try again.",
} as const;

function refusal(status: RefusedResult["status"], message: string): PlayResult {
  return { status, message };
}

/** 40 -> "40 seconds", 150 -> "3 minutes". */
export function waitFor(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.ceil(s / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/*
  Groq's daily limits refill continuously (one request frees up about every
  86 seconds), so a rate limit is always a short wait, never "come back
  tomorrow". Only the game's own daily cap means that.
*/
function busy(retryAfter: number | null): PlayResult {
  const when = retryAfter === null ? "a minute" : waitFor(retryAfter);
  return refusal("busy", `Mlinzi is busy with other players. Try again in ${when}.`);
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
  const clock = new Date(started);
  const level = getLevel(input.level);

  if (!deps.limits.gameEnabled) return refusal("disabled", MESSAGES.disabled);
  if (!level || level.id > input.session.unlocked) return refusal("locked", MESSAGES.locked);

  const hourLeft = (windowStart(clock, HOUR).getTime() + HOUR * 1000 - started) / 1000;
  if ((await deps.store.hit(`session:${input.session.sid}`, HOUR, clock)) > deps.limits.sessionHourlyLimit) {
    return refusal(
      "rate_limited",
      `Pole! That's ${deps.limits.sessionHourlyLimit} tries this hour. Mlinzi needs a break: come back in ${waitFor(hourLeft)}.`,
    );
  }
  if ((await deps.store.hit(`ip:${input.ipHash}`, HOUR, clock)) > deps.limits.ipHourlyLimit) {
    return refusal("rate_limited", `Pole! Too many tries from your network this hour. Come back in ${waitFor(hourLeft)}.`);
  }
  // The daily cap counts only attempts that reached a model, so a busy
  // spell of retries can't use it up. Checked here, counted after.
  if ((await deps.store.count("global", DAY, clock)) >= deps.limits.dailyAttemptCap) {
    return refusal("sleeping", MESSAGES.sleeping);
  }
  const countModelCall = async () => {
    // The first model call of each UTC day also clears out old data.
    if ((await deps.store.hit("global", DAY, clock)) === 1) await deps.store.prune(clock);
  };

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

  const flagged = (score: number | null) => score !== null && score >= deps.limits.guardThreshold;
  const played = (outcome: AttemptOutcome, rest: Partial<PlayedResult> = {}): PlayResult => ({
    status: "played",
    outcome,
    reply: null,
    transfers: [],
    guardScore: null,
    guardFlagged: false,
    unlocked: input.session.unlocked,
    finished: input.session.finished,
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
      if (error instanceof QuotaExhaustedError) return busy(error.retryAfter);
      return refusal("unavailable", MESSAGES.unavailable);
    }
    if (flagged(guardScore)) {
      await record({ outcome: "guard_blocked", guardScore });
      return played("guard_blocked", { guardScore, guardFlagged: true });
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
      await countModelCall();
      await record({ outcome: "garbled", guardScore, error: describe(error) });
      return played("garbled", { guardScore, guardFlagged: flagged(guardScore) });
    }
    await record({ outcome: "error", guardScore, error: describe(error) });
    if (error instanceof QuotaExhaustedError) return busy(error.retryAfter);
    return refusal("unavailable", MESSAGES.unavailable);
  }
  if (shadowScore) guardScore = await shadowScore;
  await countModelCall();

  const { outcome, transfers } = judge(chat.toolCalls, level.enforcement, NUMBERS_ON_FILE);
  const unlocked =
    outcome === "transferred"
      ? Math.min(MAX_LEVEL, Math.max(input.session.unlocked, level.id + 1))
      : input.session.unlocked;
  // The last level can't be won through the model, so fooling it anyway,
  // and watching the till refuse, is what finishes the game.
  const finished = input.session.finished || (level.id === MAX_LEVEL && outcome === "blocked_by_till");

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
    guardFlagged: flagged(guardScore),
    unlocked,
    finished,
  });
}
