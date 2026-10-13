import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { bulkShip, listOrdersAdmin } from "@/lib/server/services/exchange";

/** POST /api/admin/orders/bulk-ship { ids } */
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  const body = await readJson<{ ids?: unknown }>(req);
  const shipped = await bulkShip(admin, body.ids);
  return jsonOk({ shipped, ...listOrdersAdmin() });
});
