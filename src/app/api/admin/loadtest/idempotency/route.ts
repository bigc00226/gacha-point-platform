import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { runIdempotencyTest } from "@/lib/server/services/loadtest";

/** POST /api/admin/loadtest/idempotency — 二重送信（冪等性）テスト */
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  return jsonOk(await runIdempotencyTest(admin, await readJson(req)));
});
