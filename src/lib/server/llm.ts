import "server-only";
import { z } from "zod";
import type { ToolCall } from "../game/judge";
import { type Fetch, GroqError, groqChat } from "./groq";

/*
  One model call per attempt, with tools. Models are tried in order and a
  rate-limited or failing model hands over to the next; whichever answered
  is recorded on the attempt, so the analysis never mixes them up.

  The route has 30 seconds: 5 for the guard and 10 for each of two models
  leaves room for the database. Groq usually answers in under a second.
*/

const MODEL_TIMEOUT_MS = 10_000;

const Completion = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullish(),
          reasoning: z.string().nullish(),
          tool_calls: z
            .array(z.object({ function: z.object({ name: z.string(), arguments: z.string() }) }))
            .nullish(),
        }),
      }),
    )
    .min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).nullish(),
});

export type ChatResult = {
  model: string;
  content: string;
  reasoning: string | null;
  toolCalls: ToolCall[];
  promptTokens: number | null;
  completionTokens: number | null;
};

/** Every model is out of quota. `retryAfter` is the shortest wait, in seconds. */
export class QuotaExhaustedError extends Error {
  constructor(readonly retryAfter: number | null) {
    super("All models are rate limited");
    this.name = "QuotaExhaustedError";
  }
}

/** The model produced a tool call Groq could not parse (`tool_use_failed`). */
export class ModelOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelOutputError";
  }
}

export type ChatRequest = {
  apiKey: string;
  models: readonly string[];
  system: string;
  user: string;
  tools: readonly unknown[];
  fetchImpl?: Fetch;
};

export async function chatWithTools(request: ChatRequest): Promise<ChatResult> {
  let lastError: unknown = null;
  let allRateLimited = true;
  let shortestWait: number | null = null;

  for (const model of request.models) {
    try {
      const raw = await groqChat(
        request.apiKey,
        {
          model,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          tools: request.tools,
          tool_choice: "auto",
          reasoning_effort: "low",
          max_completion_tokens: 700,
          temperature: 0.6,
        },
        request.fetchImpl,
        MODEL_TIMEOUT_MS,
      );
      const completion = Completion.parse(raw);
      const { message } = completion.choices[0];
      const { usage } = completion;
      return {
        model,
        content: message.content ?? "",
        reasoning: message.reasoning ?? null,
        toolCalls: (message.tool_calls ?? []).map((call) => ({
          name: call.function.name,
          arguments: call.function.arguments,
        })),
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
      };
    } catch (error) {
      if (error instanceof GroqError && error.status === 400 && error.code === "tool_use_failed") {
        throw new ModelOutputError(error.message);
      }
      const retryable =
        (error instanceof GroqError && (error.status === 429 || error.status >= 500)) ||
        (error instanceof DOMException && error.name === "TimeoutError");
      if (!retryable) throw error;

      lastError = error;
      if (error instanceof GroqError && error.status === 429) {
        if (error.retryAfter !== null) {
          shortestWait = shortestWait === null ? error.retryAfter : Math.min(shortestWait, error.retryAfter);
        }
      } else {
        allRateLimited = false;
      }
    }
  }

  if (allRateLimited) throw new QuotaExhaustedError(shortestWait);
  throw lastError;
}
