import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { deleteMiniGame, listMiniGames, saveMiniGame } from "@/lib/server/services/minigames";

type Ctx = RouteContext<"/api/admin/minigames/[id]">;

export const PUT = route<Ctx>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  await saveMiniGame(admin, id, await readJson(req));
  return jsonOk({ games: listMiniGames(true) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  await deleteMiniGame(admin, id);
  return jsonOk({ games: listMiniGames(true) });
});
