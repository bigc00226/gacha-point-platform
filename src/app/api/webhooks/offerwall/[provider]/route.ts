import { route } from "@/lib/server/http";
import { processOfferPostback, readWebhookParams, webhookSource } from "@/lib/server/services/rewards-webhook";

export const dynamic = "force-dynamic";

/**
 * GET|POST /api/webhooks/offerwall/{skyflag|tapjoy}?uid=…&offer_id=…&tid=…&category=…&payout=…&ts=<epoch s>&signature=…
 *
 * Offerwall completion postback — the endpoint the offerwall provider calls (POST accepts a
 * form or JSON body). Verified (signature → timestamp → duplicate → offer → reward calculation)
 * and logged; the response mirrors /api/webhooks/admob-ssv.
 */
async function handle(req: Request, ctx: RouteContext<"/api/webhooks/offerwall/[provider]">) {
  const { provider } = await ctx.params;
  const { params, error } = await readWebhookParams(req);
  const method = req.method === "POST" ? "POST" : "GET";
  const outcome = await processOfferPostback(provider, params, { method, source: webhookSource(req), parseError: error });
  return Response.json(outcome.body, { status: outcome.httpStatus, headers: { "Cache-Control": "no-store" } });
}

// GET postbacks still write (they grant tickets and log), so they publish the shared state too.
export const GET = route<RouteContext<"/api/webhooks/offerwall/[provider]">>(handle, { writes: true });
export const POST = route<RouteContext<"/api/webhooks/offerwall/[provider]">>(handle);
