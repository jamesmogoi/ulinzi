import { cookies } from "next/headers";
import { getConfig } from "@/lib/server/config";
import { isSameOrigin, privateJson } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { decodeSession, encodeSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";

/*
  "Delete my messages". There are no accounts, so a player is their signed
  session id, which only their own cookie carries. Everything logged under
  it is deleted, then the id is replaced so nothing logged from now on links
  back to it. Level progress stays: it lives on the player's device anyway.
*/
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return privateJson({ message: "Cross-site request refused." }, 403);
  }

  try {
    const config = getConfig();
    const jar = await cookies();
    const session = await decodeSession(jar.get(SESSION_COOKIE)?.value, config.SESSION_SECRET);
    if (!session) return privateJson({ deleted: 0 });

    const deleted = await getStore(config).forget(session.sid);
    jar.set(
      SESSION_COOKIE,
      await encodeSession({ ...session, sid: crypto.randomUUID() }, config.SESSION_SECRET),
      SESSION_COOKIE_OPTIONS,
    );
    return privateJson({ deleted });
  } catch (error) {
    console.error("forget failed", error);
    return privateJson({ message: "Couldn't delete your messages right now. Try again." }, 502);
  }
}
