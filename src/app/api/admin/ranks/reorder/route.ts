import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { listRanksAdmin, reorderRanks } from "@/lib/server/services/ranks";

/** POST /api/admin/ranks/reorder { ids: string[] } — prize ranks, highest first. */
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  const body = await readJson<{ ids?: unknown }>(req);
  await reorderRanks(admin, body.ids);
  return jsonOk({ ranks: listRanksAdmin() });
});
