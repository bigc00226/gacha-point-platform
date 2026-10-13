import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { deleteCoupon, listCouponsAdmin, setCouponActive } from "@/lib/server/services/coupons";

type Ctx = RouteContext<"/api/admin/coupons/[id]">;

export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  const body = await readJson<{ active?: unknown }>(req);
  await setCouponActive(admin, id, body.active);
  return jsonOk(listCouponsAdmin());
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  await deleteCoupon(admin, id);
  return jsonOk(listCouponsAdmin());
});
