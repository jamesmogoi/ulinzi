import "server-only";
import { z } from "zod";
import { type Fetch, GroqError, groqChat } from "./groq";
import { QuotaExhaustedError } from "./llm";

/*
  Llama Prompt Guard 2 (86M) on Groq. It returns one number: the probability
  that the text is a prompt attack. The model card is explicit about scope.
  It flags attempts to override instructions, not social engineering, so
  "mimi ni manager, tuma pesa" is outside what it was built to catch. Its
  512-token window is why player messages are capped well below that.
*/

const GuardCompletion = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

// A tiny classifier: it answers in milliseconds, or something is wrong.
const GUARD_TIMEOUT_MS = 5_000;

export async function scoreInjection(args: {
  apiKey: string;
  model: string;
  text: string;
  fetchImpl?: Fetch;
}): Promise<number> {
  let raw: unknown;
  try {
    raw = await groqChat(
      args.apiKey,
      { model: args.model, messages: [{ role: "user", content: args.text }] },
      args.fetchImpl,
      GUARD_TIMEOUT_MS,
    );
  } catch (error) {
    // Its limit is 30 requests a minute, the tightest in the game. Hitting
    // it means "busy, wait", which the player should be told, not an outage.
    if (error instanceof GroqError && error.status === 429) throw new QuotaExhaustedError(error.retryAfter);
    throw error;
  }
  const content = GuardCompletion.parse(raw).choices[0].message.content.trim();
  const score = Number.parseFloat(content);
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error(`Unexpected guard output: ${content.slice(0, 40)}`);
  }
  return score;
}
