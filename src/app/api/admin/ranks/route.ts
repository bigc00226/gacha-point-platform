import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { createRank, listRanksAdmin } from "@/lib/server/services/ranks";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireApiAdmin();
  return jsonOk({ ranks: listRanksAdmin() });
});

export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  const rank = await createRank(admin, await readJson(req));
  return jsonOk({ rank, ranks: listRanksAdmin() });
});
