import { describe, expect, it } from "vitest";
import { hmacHex } from "@/lib/crypto";
import { decodeSession, encodeSession, newSession } from "@/lib/session";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("session cookie", () => {
  it("round-trips", async () => {
    const session = { ...newSession(), unlocked: 3 };
    expect(await decodeSession(await encodeSession(session, SECRET), SECRET)).toEqual(session);
  });

  it("rejects a cookie edited to skip levels", async () => {
    const token = await encodeSession(newSession(), SECRET);
    const [payload, signature] = token.split(".");
    const forged = JSON.parse(Buffer.from(payload, "base64url").toString());
    forged.unlocked = 5;
    const tampered = `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${signature}`;
    expect(await decodeSession(tampered, SECRET)).toBeNull();
  });

  it("rejects a cookie signed with another secret", async () => {
    const token = await encodeSession(newSession(), `${SECRET}-other`);
    expect(await decodeSession(token, SECRET)).toBeNull();
  });

  it.each([undefined, "", "abc", "a.b.c", "!!!.???", "e30.AAAA"])("rejects malformed token %s", async (token) => {
    expect(await decodeSession(token, SECRET)).toBeNull();
  });

  it("rejects a validly signed payload with an impossible level", async () => {
    const token = await encodeSession({ v: 1, sid: crypto.randomUUID(), unlocked: 9 }, SECRET);
    expect(await decodeSession(token, SECRET)).toBeNull();
  });

  it("hashes IPs deterministically without exposing them", async () => {
    const a = await hmacHex(SECRET, "ip:41.90.1.2");
    expect(a).toBe(await hmacHex(SECRET, "ip:41.90.1.2"));
    expect(a).not.toContain("41.90");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});
