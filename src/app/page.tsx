import { cookies } from "next/headers";
import { Game } from "@/components/Game";
import { decodeSession, SESSION_COOKIE } from "@/lib/session";

export default async function Home() {
  // Only progress is read here. The page renders without any
  // secrets configured, so a fresh clone shows the game before setup.
  const secret = process.env.SESSION_SECRET;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = secret && secret.length >= 32 ? await decodeSession(token, secret) : null;

  return <Game initialUnlocked={session?.unlocked ?? 1} initialFinished={session?.finished ?? false} />;
}
