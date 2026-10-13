import { requireApiUser } from "@/lib/server/auth";
import { assertDemoToolsEnabled } from "@/lib/server/demo";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { simulateOfferCompletion } from "@/lib/server/services/rewards-webhook";
import { vString } from "@/lib/server/validate";

/**
 * POST /api/demo/offerwall/complete { offerId } — DEMO ONLY.
 * Plays the offerwall provider (skyflag / Tapjoy): builds the signed completion postback and
 * processes it with the same function as /api/webhooks/offerwall/[provider].
 * Returns { result, balances, offer }.
 */
export const POST = route(async (req) => {
  assertDemoToolsEnabled();
  const user = await requireApiUser();
  const body = await readJson(req);
  const offerId = vString(body.offerId, "offerId", "案件ID", { max: 64 });
  return jsonOk(await simulateOfferCompletion(user.id, offerId));
});
