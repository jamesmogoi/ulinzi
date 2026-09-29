import "server-only";

/*
  One POST to Groq's OpenAI-compatible endpoint. No SDK: the request and the
  response are both visible here, which is the point for a security demo.
*/

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 20_000;

export type Fetch = typeof fetch;

export class GroqError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    /** Seconds, from `retry-after`. Groq sets it only on a 429. */
    readonly retryAfter: number | null,
  ) {
    super(message);
    this.name = "GroqError";
  }
}

export async function groqChat(
  apiKey: string,
  body: Record<string, unknown>,
  fetchImpl: Fetch = fetch,
): Promise<unknown> {
  const response = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    let message = `Groq returned ${response.status}`;
    let code: string | null = null;
    try {
      const payload = (await response.json()) as { error?: { message?: string; code?: string } };
      message = payload.error?.message ?? message;
      code = payload.error?.code ?? null;
    } catch {
      // Body was not JSON; the status says enough.
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new GroqError(message, response.status, code, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null);
  }

  return response.json();
}
