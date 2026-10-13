import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { redeemCoupon } from "@/lib/server/services/coupons";

/** POST /api/coupons/redeem { code } — シリアルコード / あいことば */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  const body = await readJson<{ code?: unknown }>(req);
  return jsonOk(await redeemCoupon(user.id, body.code));
});
