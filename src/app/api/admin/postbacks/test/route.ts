import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { runPostbackTest } from "@/lib/server/services/rewards-admin";

/** Origin shown to the admin (display only — the request itself is sent over the server's loopback). */
function publicOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/**
 * POST /api/admin/postbacks/test { kind: "video" | "offer", scenario: "valid" | "bad_signature" | "expired"
 *   | "duplicate" | "limit", userId?, offerId? }
 * Sends a real HTTP request from the server to our own webhook endpoint (logged with source
 * "admin_test") → { request, response: { httpStatus, body }, transport, log, notes, warmup }
 */
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  const body = await readJson(req);
  return jsonOk(await runPostbackTest(admin, body, publicOrigin(req)));
});
