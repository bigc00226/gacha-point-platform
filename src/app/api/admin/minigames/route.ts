import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { listMiniGames, saveMiniGame } from "@/lib/server/services/minigames";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireApiAdmin();
  return jsonOk({ games: listMiniGames(true) });
});

export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  await saveMiniGame(admin, null, await readJson(req));
  return jsonOk({ games: listMiniGames(true) });
});
