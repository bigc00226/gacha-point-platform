import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { createExchangeItem, listExchangeItemsAdmin } from "@/lib/server/services/exchange";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireApiAdmin();
  return jsonOk({ items: listExchangeItemsAdmin() });
});

export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  await createExchangeItem(admin, await readJson(req));
  return jsonOk({ items: listExchangeItemsAdmin() });
});
