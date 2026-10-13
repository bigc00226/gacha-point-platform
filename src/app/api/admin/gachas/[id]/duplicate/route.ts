import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { duplicateGacha } from "@/lib/server/services/admin-gacha";

export const POST = route<RouteContext<"/api/admin/gachas/[id]/duplicate">>(async (_req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  const copy = await duplicateGacha(admin, id);
  return jsonOk({ id: copy.id });
});
