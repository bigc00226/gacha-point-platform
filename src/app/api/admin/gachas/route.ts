import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { createGacha, listAdminGachas } from "@/lib/server/services/admin-gacha";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireApiAdmin();
  return jsonOk({ gachas: listAdminGachas() });
});

export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  const gacha = await createGacha(admin, await readJson(req));
  return jsonOk({ id: gacha.id });
});
