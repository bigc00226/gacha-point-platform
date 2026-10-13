import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, notFoundError, readJson, route } from "@/lib/server/http";
import { deleteGacha, getGachaEdit, updateGacha } from "@/lib/server/services/admin-gacha";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/admin/gachas/[id]">;

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiAdmin();
  const { id } = await params;
  const gacha = getGachaEdit(id);
  if (!gacha) throw notFoundError("ガチャ");
  return jsonOk({ gacha });
});

export const PUT = route<Ctx>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  await updateGacha(admin, id, await readJson(req));
  return jsonOk({ gacha: getGachaEdit(id) });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  await deleteGacha(admin, id);
  return jsonOk({ id });
});
