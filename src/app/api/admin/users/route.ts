import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { listUsersAdmin } from "@/lib/server/services/admin-users";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireApiAdmin();
  return jsonOk({ users: listUsersAdmin() });
});
