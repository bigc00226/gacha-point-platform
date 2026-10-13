import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { adjustBalance, getUserDetailAdmin } from "@/lib/server/services/admin-users";

/** POST { currency: "ticket" | "point", amount: ±n, reason } */
export const POST = route<RouteContext<"/api/admin/users/[id]/adjust">>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  await adjustBalance(admin, id, await readJson(req));
  return jsonOk(getUserDetailAdmin(id));
});
