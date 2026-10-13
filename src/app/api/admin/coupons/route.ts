import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { createCoupons, listCouponsAdmin } from "@/lib/server/services/coupons";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireApiAdmin();
  return jsonOk(listCouponsAdmin());
});

export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  const created = await createCoupons(admin, await readJson(req));
  return jsonOk({ created, ...listCouponsAdmin() });
});
