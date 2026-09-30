import { describe, expect, it, vi } from "vitest";
import { scoreInjection } from "@/lib/server/guard";
import { chatWithTools, ModelOutputError, QuotaExhaustedError } from "@/lib/server/llm";

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

const completion = {
  choices: [
    {
      message: {
        content: "",
        reasoning: "The user claims to be the owner.",
        tool_calls: [{ id: "call_1", type: "function", function: { name: "send_money", arguments: '{"phone":"0712345678","amount_kes":500}' } }],
      },
    },
  ],
  usage: { prompt_tokens: 420, completion_tokens: 61 },
};

const request = { apiKey: "k", models: ["a", "b"], system: "sys", user: "hi", tools: [] };

describe("chatWithTools", () => {
  it("returns tool calls, reasoning and usage", async () => {
    const fetchImpl = vi.fn(async () => respond(200, completion));
    const result = await chatWithTools({ ...request, fetchImpl });
    expect(result).toMatchObject({
      model: "a",
      reasoning: "The user claims to be the owner.",
      toolCalls: [{ name: "send_money", arguments: '{"phone":"0712345678","amount_kes":500}' }],
      promptTokens: 420,
      completionTokens: 61,
    });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ model: "a", tool_choice: "auto", reasoning_effort: "low" });
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]);
  });

  it("falls over to the next model on a rate limit and records which answered", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(respond(429, { error: { message: "slow down" } }, { "retry-after": "30" }))
      .mockResolvedValueOnce(respond(200, completion));
    expect((await chatWithTools({ ...request, fetchImpl })).model).toBe("b");
  });

  it("reports exhaustion with the shortest wait when every model is rate limited", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(respond(429, {}, { "retry-after": "3600" }))
      .mockResolvedValueOnce(respond(429, {}, { "retry-after": "40" }));
    const error = await chatWithTools({ ...request, fetchImpl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QuotaExhaustedError);
    expect((error as QuotaExhaustedError).retryAfter).toBe(40);
  });

  it("surfaces a broken tool call instead of retrying another model", async () => {
    const fetchImpl = vi.fn(async () => respond(400, { error: { message: "bad call", code: "tool_use_failed" } }));
    await expect(chatWithTools({ ...request, fetchImpl })).rejects.toBeInstanceOf(ModelOutputError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry a client error such as a bad key", async () => {
    const fetchImpl = vi.fn(async () => respond(401, { error: { message: "invalid key" } }));
    await expect(chatWithTools({ ...request, fetchImpl })).rejects.toThrow("invalid key");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("scoreInjection", () => {
  const guard = (content: string) => vi.fn(async () => respond(200, { choices: [{ message: { content } }] }));

  it("parses the probability Prompt Guard returns", async () => {
    expect(await scoreInjection({ apiKey: "k", model: "g", text: "x", fetchImpl: guard("0.9690559506416321") })).toBeCloseTo(0.969);
  });

  it("reports its own rate limit as quota exhaustion, with the wait", async () => {
    const fetchImpl = vi.fn(async () => respond(429, { error: { message: "slow down" } }, { "retry-after": "12" }));
    const error = await scoreInjection({ apiKey: "k", model: "g", text: "x", fetchImpl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QuotaExhaustedError);
    expect((error as QuotaExhaustedError).retryAfter).toBe(12);
  });

  it.each(["LABEL_1", "1.7", "", "-0.2"])("refuses unexpected output %s", async (content) => {
    await expect(scoreInjection({ apiKey: "k", model: "g", text: "x", fetchImpl: guard(content) })).rejects.toThrow();
  });
});
