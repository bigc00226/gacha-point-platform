import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { listMyPrizes } from "@/lib/server/services/mypage";

export const dynamic = "force-dynamic";

/** GET /api/me/prizes — the signed-in member's prize box (獲得景品). */
export const GET = route(async () => {
  const user = await requireApiUser();
  return jsonOk({ prizes: listMyPrizes(user.id) });
});
