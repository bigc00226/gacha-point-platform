import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { balancesOf, getLoginBonusStatus, getVideoStatus, todayEarnings } from "@/lib/server/services/rewards";

export const dynamic = "force-dynamic";

/** GET /api/rewards — the signed-in user's ポイ活 summary (login bonus, video count, today's earnings). */
export const GET = route(async () => {
  const user = await requireApiUser();
  const now = Date.now();
  return jsonOk({
    balances: balancesOf(user),
    loginBonus: getLoginBonusStatus(user, now),
    video: getVideoStatus(user, now),
    today: todayEarnings(user.id, now),
  });
});
