import { jsonOk, route } from "@/lib/server/http";
import { listGachaCards } from "@/lib/server/services/gacha";

export const dynamic = "force-dynamic";

/** GET /api/gachas — gachas on the site (no drafts / load-test sandboxes), display order. */
export const GET = route(async () => {
  return jsonOk({ gachas: listGachaCards() }, { headers: { "Cache-Control": "no-store" } });
});
