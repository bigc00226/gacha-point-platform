import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { simulateGacha } from "@/lib/server/services/admin-gacha";

/** POST /api/admin/gachas/simulate { gachaId?, prizes, count } — dry run, nothing is saved. */
export const POST = route(async (req) => {
  await requireApiAdmin();
  return jsonOk(await simulateGacha(await readJson(req)));
});
