/*
  An anonymous player session in a signed cookie: a random id for the
  research log and the highest level unlocked. No account, no personal
  data. The signature stops a player from editing the cookie to skip
  levels; everything a level needs to check happens server-side.
*/

import { z } from "zod";
import { fromBase64Url, hmacSign, hmacVerify, toBase64Url } from "./crypto";
import { MAX_LEVEL } from "./game/levels";

export const SESSION_COOKIE = "mlinzi_session";

const SessionSchema = z.object({
  v: z.literal(1),
  sid: z.uuid(),
  unlocked: z.number().int().min(1).max(MAX_LEVEL),
});

export type Session = z.infer<typeof SessionSchema>;

export function newSession(): Session {
  return { v: 1, sid: crypto.randomUUID(), unlocked: 1 };
}

export async function encodeSession(session: Session, secret: string): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  const signature = toBase64Url(await hmacSign(secret, payload));
  return `${payload}.${signature}`;
}

export async function decodeSession(
  token: string | undefined,
  secret: string,
): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes || !(await hmacVerify(secret, payload, signatureBytes))) return null;

  const json = fromBase64Url(payload);
  if (!json) return null;
  try {
    const parsed = SessionSchema.safeParse(JSON.parse(new TextDecoder().decode(json)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
} as const;
