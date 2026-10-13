import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { listOrdersAdmin } from "@/lib/server/services/exchange";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireApiAdmin();
  return jsonOk(listOrdersAdmin());
});
