import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { demoGrant } from "@/lib/server/services/demo-tools";

/** POST /api/demo/grant { tickets?, points? } — demo top-up for the signed-in member. */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  return jsonOk({ balances: await demoGrant(user.id, await readJson(req)) });
});
