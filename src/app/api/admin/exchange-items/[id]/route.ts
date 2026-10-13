import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { deleteExchangeItem, listExchangeItemsAdmin, updateExchangeItem } from "@/lib/server/services/exchange";

type Ctx = RouteContext<"/api/admin/exchange-items/[id]">;

export const PUT = route<Ctx>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  await updateExchangeItem(admin, id, await readJson(req));
  return jsonOk({ items: listExchangeItemsAdmin() });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  await deleteExchangeItem(admin, id);
  return jsonOk({ items: listExchangeItemsAdmin() });
});
