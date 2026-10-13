import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { getRewardSettingsPage, updateRewardSettings } from "@/lib/server/services/rewards-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/rewards/settings → { settings, history (setting changes), today (grant stats) } */
export const GET = route(async () => {
  await requireApiAdmin();
  return jsonOk(getRewardSettingsPage());
});

/**
 * PUT /api/admin/rewards/settings
 * { videoTicketsPerView, videoDailyLimit, loginBonusTickets, signupBonusTickets, offerMultiplier,
 *   offerCategoryTickets: { app, game, survey, signup, shopping, card } }
 * → { settings, changed, changes: ["動画1回あたりの付与枚数 3枚 → 5枚", …], history }
 */
export const PUT = route(async (req) => {
  const admin = await requireApiAdmin();
  const body = await readJson(req);
  return jsonOk(await updateRewardSettings(admin, body));
});
