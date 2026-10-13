import { jsonOk, readJson, route } from "@/lib/server/http";
import { demoLastOneSetup } from "@/lib/server/services/demo-tools";

/** POST /api/demo/last-one-setup { gachaId?, remaining? } — demo only. */
export const POST = route(async (req) => {
  let body: Record<string, unknown> = {};
  try {
    body = await readJson(req);
  } catch {
    body = {};
  }
  return jsonOk(await demoLastOneSetup(body));
});
