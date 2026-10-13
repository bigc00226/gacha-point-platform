import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { startAdSession } from "@/lib/server/services/rewards";

/**
 * POST /api/rewards/video/start — opens an ad session (status "started") before the ad plays.
 * 409 LIMIT_REACHED when today's limit is used up. No tickets are granted here: they are
 * granted only when the ad network's signed SSV callback for this session is verified.
 */
export const POST = route(async () => {
  const user = await requireApiUser();
  return jsonOk(await startAdSession(user.id));
});
