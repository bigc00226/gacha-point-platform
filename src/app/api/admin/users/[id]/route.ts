import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, notFoundError, readJson, route } from "@/lib/server/http";
import { getUserDetailAdmin, setUserStatus } from "@/lib/server/services/admin-users";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/admin/users/[id]">;

export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiAdmin();
  const { id } = await params;
  const detail = getUserDetailAdmin(id);
  if (!detail) throw notFoundError("会員");
  return jsonOk(detail);
});

/** PATCH { status: "active" | "suspended" } */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  const body = await readJson<{ status?: unknown }>(req);
  await setUserStatus(admin, id, body.status);
  return jsonOk(getUserDetailAdmin(id));
});
