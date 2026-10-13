import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { listOrdersAdmin, updateOrder } from "@/lib/server/services/exchange";

/** PATCH /api/admin/orders/[id] { action: "ship" | "cancel" | "note", trackingNumber?, adminNote? } */
export const PATCH = route<RouteContext<"/api/admin/orders/[id]">>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  const order = await updateOrder(admin, id, await readJson(req));
  return jsonOk({ order, ...listOrdersAdmin() });
});
