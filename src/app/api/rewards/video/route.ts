import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { getVideoStatus } from "@/lib/server/services/rewards";

export const dynamic = "force-dynamic";

/** GET /api/rewards/video → { todayCount, dailyLimit, remaining, ticketsPerView, nextResetAt } (lazy JST reset). */
export const GET = route(async () => {
  const user = await requireApiUser();
  return jsonOk(getVideoStatus(user));
});
