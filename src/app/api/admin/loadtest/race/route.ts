import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { runRaceTest } from "@/lib/server/services/loadtest";

export const maxDuration = 60;

/** POST /api/admin/loadtest/race — ラストワン争奪 同時アクセステスト */
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  return jsonOk(await runRaceTest(admin, await readJson(req)));
});
