import { getCurrentUser } from "@/lib/server/auth";
import { jsonOk, notFoundError, route } from "@/lib/server/http";
import { getGachaDetail } from "@/lib/server/services/gacha";

export const dynamic = "force-dynamic";

/** GET /api/gachas/[id] — gacha detail with the prize lineup (drafts: admins only). */
export const GET = route<RouteContext<"/api/gachas/[id]">>(async (_req, { params }) => {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const gacha = getGachaDetail(id, { allowDraft: viewer?.role === "admin" });
  if (!gacha) throw notFoundError("ガチャ");
  return jsonOk({ gacha }, { headers: { "Cache-Control": "no-store" } });
});
