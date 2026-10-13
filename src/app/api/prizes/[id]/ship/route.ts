import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { requestPrizeShipping } from "@/lib/server/services/exchange";

/** POST /api/prizes/[id]/ship { address } — request shipping of a won physical prize. */
export const POST = route<RouteContext<"/api/prizes/[id]/ship">>(async (req, { params }) => {
  const user = await requireApiUser();
  const { id } = await params;
  return jsonOk(await requestPrizeShipping(user.id, id, await readJson(req)));
});
