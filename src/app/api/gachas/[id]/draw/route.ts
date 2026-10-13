import type { DrawResponse } from "@/lib/api-types";
import { MAX_DRAW_COUNT } from "@/lib/constants";
import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, notFoundError, readJson, route } from "@/lib/server/http";
import { executeDraw, isPublicGachaId } from "@/lib/server/services/gacha";
import { vInt, vString } from "@/lib/server/validate";

/**
 * POST /api/gachas/[id]/draw  { count: 1..100, requestId }
 * Draws `count` times in one request/transaction. Retrying with the same requestId
 * (e.g. after a network error) returns the stored result with `replayed: true` and no charge.
 */
export const POST = route<RouteContext<"/api/gachas/[id]/draw">>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const body = await readJson(req);
  const count = vInt(body.count, "count", "回数", { min: 1, max: MAX_DRAW_COUNT });
  const requestId = vString(body.requestId, "requestId", "リクエストID", { min: 8, max: 100 });
  if (!isPublicGachaId(id)) throw notFoundError("ガチャ");
  const result = await executeDraw({ userId: user.id, gachaId: id, count, requestId });
  return jsonOk<DrawResponse>(result, { headers: { "Cache-Control": "no-store" } });
});
