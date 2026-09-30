import { describe, expect, it } from "vitest";
import { memoryStore } from "@/lib/server/store/memory";
import type { AttemptRecord } from "@/lib/server/store/types";

const attempt = (sessionId: string, outcome = "refused"): AttemptRecord => ({
  sessionId,
  level: 1,
  guardMode: "shadow",
  guardScore: null,
  model: null,
  message: "habari",
  reply: null,
  reasoning: null,
  toolCalls: [],
  outcome,
  latencyMs: 1,
  promptTokens: null,
  completionTokens: null,
  country: null,
  error: null,
});

const NOW = new Date("2026-09-30T10:20:00Z");

describe("memory store", () => {
  it("counts hits per fixed window, and reads a count without adding to it", async () => {
    const store = memoryStore();
    expect(await store.count("k", 3600, NOW)).toBe(0);
    expect(await store.hit("k", 3600, NOW)).toBe(1);
    expect(await store.hit("k", 3600, NOW)).toBe(2);
    expect(await store.count("k", 3600, NOW)).toBe(2);
    expect(await store.hit("k", 3600, new Date("2026-09-30T11:00:00Z"))).toBe(1);
  });

  it("forgets one session's attempts and nobody else's", async () => {
    const store = memoryStore();
    await store.recordAttempt(attempt("a"));
    await store.recordAttempt(attempt("a"));
    await store.recordAttempt(attempt("b"));
    expect(await store.forget("a")).toBe(2);
    expect(store.attempts.map((a) => a.sessionId)).toEqual(["b"]);
    expect(await store.forget("a")).toBe(0);
  });

  it("prunes attempts past retention and counters past use", async () => {
    const store = memoryStore();
    await store.recordAttempt(attempt("a"));
    await store.hit("k", 3600, NOW);
    await store.prune(new Date(NOW.getTime() + 3 * 86_400_000));
    expect(store.attempts).toHaveLength(1);
    expect(await store.count("k", 3600, NOW)).toBe(0);
    await store.prune(new Date(Date.now() + 366 * 86_400_000));
    expect(store.attempts).toHaveLength(0);
  });

  it("leaves failed attempts out of the scoreboard", async () => {
    const store = memoryStore();
    await store.recordAttempt(attempt("a", "transferred"));
    await store.recordAttempt(attempt("b", "error"));
    expect(await store.stats()).toEqual({ attempts: 1, players: 1, levels: [{ level: 1, attempts: 1, wins: 1, fooled: 0 }] });
  });
});
