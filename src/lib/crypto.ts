/*
  HMAC-SHA256 over Web Crypto, which runs the same in Node, on Vercel and in
  tests. Signing and verification go through crypto.subtle, so the
  comparison is constant-time by construction.
*/

const encoder = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    keys.set(secret, key);
  }
  return key;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function hmacSign(secret: string, data: string): Promise<Uint8Array<ArrayBuffer>> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(data));
  return new Uint8Array(signature);
}

export async function hmacVerify(
  secret: string,
  data: string,
  signature: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  return crypto.subtle.verify("HMAC", await hmacKey(secret), signature, encoder.encode(data));
}

export async function hmacHex(secret: string, data: string): Promise<string> {
  const bytes = await hmacSign(secret, data);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
