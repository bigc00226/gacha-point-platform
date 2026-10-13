import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { claimLoginBonus, getLoginBonusStatus } from "@/lib/server/services/rewards";

export const dynamic = "force-dynamic";

/** GET /api/rewards/login-bonus — today's login-bonus state. */
export const GET = route(async () => {
  const user = await requireApiUser();
  return jsonOk(getLoginBonusStatus(user));
});

/** POST /api/rewards/login-bonus — claim today's bonus (409 ALREADY_CLAIMED when already claimed). */
export const POST = route(async () => {
  const user = await requireApiUser();
  return jsonOk(await claimLoginBonus(user.id));
});
