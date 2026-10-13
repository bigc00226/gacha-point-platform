import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { setGachaStatus } from "@/lib/server/services/admin-gacha";

export const PATCH = route<RouteContext<"/api/admin/gachas/[id]/status">>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  const body = await readJson<{ status?: unknown }>(req);
  const gacha = await setGachaStatus(admin, id, body.status);
  return jsonOk({ id: gacha.id, status: gacha.status });
});
