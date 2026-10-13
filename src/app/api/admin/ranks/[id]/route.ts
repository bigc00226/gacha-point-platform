import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { deleteRank, listRanksAdmin, updateRank } from "@/lib/server/services/ranks";

export const PUT = route<RouteContext<"/api/admin/ranks/[id]">>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  const rank = await updateRank(admin, id, await readJson(req));
  return jsonOk({ rank, ranks: listRanksAdmin() });
});

export const DELETE = route<RouteContext<"/api/admin/ranks/[id]">>(async (_req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  await deleteRank(admin, id);
  return jsonOk({ ranks: listRanksAdmin() });
});
