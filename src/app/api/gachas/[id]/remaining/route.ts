import type { RemainingInfo } from "@/lib/api-types";
import { jsonOk, notFoundError, route } from "@/lib/server/http";
import { getRemainingInfo, isPublicGachaId } from "@/lib/server/services/gacha";

export const dynamic = "force-dynamic";

/**
 * GET /api/gachas/[id]/remaining — public, no auth.
 * The gacha page calls this only on page load and right after a draw (no polling / WebSocket),
 * which keeps the request volume flat even when thousands of users wait for the last one.
 */
export const GET = route<RouteContext<"/api/gachas/[id]/remaining">>(async (_req, { params }) => {
  const { id } = await params;
  if (!isPublicGachaId(id)) throw notFoundError("ガチャ");
  return jsonOk<RemainingInfo>(getRemainingInfo(id), { headers: { "Cache-Control": "no-store" } });
});
