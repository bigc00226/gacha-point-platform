import { route } from "@/lib/server/http";
import { processVideoCallback, readWebhookParams, webhookSource } from "@/lib/server/services/rewards-webhook";

export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/admob-ssv?ad_network=…&ad_unit=…&custom_data=<adSessionId>&reward_amount=…
 *   &reward_item=…&timestamp=<epoch ms>&transaction_id=…&user_id=…&signature=…&key_id=…
 *
 * Rewarded-video server-side verification (SSV) callback — the endpoint the ad network calls.
 * Every request is verified (signature → timestamp → duplicate → ad session → daily limit) and logged.
 *   200 { ok: true,  status: "granted" | "duplicate" | "limit_reached", granted, tickets, message, postbackId }
 *   401 { ok: false, status: "invalid_signature", ... }   400 { ok: false, status: "expired" | "invalid_session" | ... }
 */
export const GET = route(async (req) => {
  const { params, error } = await readWebhookParams(req);
  const outcome = await processVideoCallback(params, { method: "GET", source: webhookSource(req), parseError: error });
  return Response.json(outcome.body, { status: outcome.httpStatus, headers: { "Cache-Control": "no-store" } });
});
