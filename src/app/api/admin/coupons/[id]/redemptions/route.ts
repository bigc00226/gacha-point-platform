import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { couponRedemptions } from "@/lib/server/services/coupons";

export const dynamic = "force-dynamic";

export const GET = route<RouteContext<"/api/admin/coupons/[id]/redemptions">>(async (_req, { params }) => {
  await requireApiAdmin();
  const { id } = await params;
  return jsonOk({ redemptions: couponRedemptions(id) });
});
