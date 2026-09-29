import { cookies } from "next/headers";
import { z } from "zod";
import { hmacHex } from "@/lib/crypto";
import type { ApiResponse, PlayResult } from "@/lib/game/api";
import { MAX_LEVEL, MAX_MESSAGE_LENGTH } from "@/lib/game/levels";
import { SEND_MONEY_TOOL } from "@/lib/game/till";
import { getConfig } from "@/lib/server/config";
import { scoreInjection } from "@/lib/server/guard";
import { chatWithTools } from "@/lib/server/llm";
import { play } from "@/lib/server/play";
import { getStore } from "@/lib/server/store";
import {
  decodeSession,
  encodeSession,
  newSession,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/session";

export const maxDuration = 30;

const Body = z.object({
  level: z.number().int().min(1).max(MAX_LEVEL),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

const STATUS: Record<PlayResult["status"], number> = {
  played: 200,
  locked: 403,
  rate_limited: 429,
  busy: 503,
  sleeping: 503,
  disabled: 503,
  unavailable: 502,
};

function reply(body: ApiResponse, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  // SameSite=Lax already keeps the session cookie off cross-site POSTs; this
  // refuses them outright.
  if (!isSameOrigin(request)) {
    return reply({ status: "forbidden", message: "Cross-site request refused." }, 403);
  }

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return reply(
      { status: "invalid", message: `Send a message of 1 to ${MAX_MESSAGE_LENGTH} characters.` },
      400,
    );
  }

  try {
    const config = getConfig();
    const jar = await cookies();
    const session =
      (await decodeSession(jar.get(SESSION_COOKIE)?.value, config.SESSION_SECRET)) ?? newSession();

    // Vercel overwrites x-forwarded-for, so it cannot be spoofed. Only an
    // HMAC of it is ever stored.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const result = await play(
      {
        level: body.data.level,
        message: body.data.message,
        session,
        ipHash: await hmacHex(config.SESSION_SECRET, `ip:${ip}`),
        country: request.headers.get("x-vercel-ip-country"),
      },
      {
        store: getStore(config),
        chat: (system, user) =>
          chatWithTools({
            apiKey: config.GROQ_API_KEY,
            models: config.GAME_MODELS,
            system,
            user,
            tools: [SEND_MONEY_TOOL],
          }),
        scoreInjection: (text) =>
          scoreInjection({ apiKey: config.GROQ_API_KEY, model: config.GUARD_MODEL, text }),
        limits: {
          guardThreshold: config.GUARD_THRESHOLD,
          dailyAttemptCap: config.DAILY_ATTEMPT_CAP,
          ipHourlyLimit: config.IP_HOURLY_LIMIT,
          gameEnabled: config.GAME_ENABLED,
        },
      },
    );

    const unlocked = result.status === "played" ? result.unlocked : session.unlocked;
    jar.set(
      SESSION_COOKIE,
      await encodeSession({ ...session, unlocked }, config.SESSION_SECRET),
      SESSION_COOKIE_OPTIONS,
    );
    return reply(result, STATUS[result.status]);
  } catch (error) {
    console.error("attempt failed", error);
    return reply({ status: "unavailable", message: "Something went wrong reaching Mlinzi. Try again." }, 502);
  }
}
