import { requireApiUser } from "@/lib/server/auth";
import { assertDemoToolsEnabled } from "@/lib/server/demo";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { simulateAdNetworkCompletion } from "@/lib/server/services/rewards-webhook";
import { vString } from "@/lib/server/validate";

/**
 * POST /api/demo/ad-network/complete { sessionId } — DEMO ONLY.
 * Plays the role of Google's ad server: once the ad finished, it builds the signed SSV callback
 * and delivers it to the same processor as GET /api/webhooks/admob-ssv. Returns the verification
 * timeline: { result, balances, video }.
 */
export const POST = route(async (req) => {
  assertDemoToolsEnabled();
  const user = await requireApiUser();
  const body = await readJson(req);
  const sessionId = vString(body.sessionId, "sessionId", "視聴セッションID", { max: 64 });
  return jsonOk(await simulateAdNetworkCompletion(user.id, sessionId));
});
