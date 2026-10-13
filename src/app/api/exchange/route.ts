import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { exchangeItem } from "@/lib/server/services/exchange";

/** POST /api/exchange { itemId, address?, saveAddress? } */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  return jsonOk(await exchangeItem(user.id, await readJson(req)));
});
