import { getConfig } from "@/lib/server/config";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

// Public totals for the scoreboard. The CDN holds them for a minute, so a
// busy launch day costs one query a minute, not one per visitor.
export async function GET() {
  try {
    const stats = await getStore(getConfig()).stats();
    return Response.json(stats, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("stats failed", error);
    return Response.json(
      { message: "Stats unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
