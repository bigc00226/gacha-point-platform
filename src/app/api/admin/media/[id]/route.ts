import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { deleteMedia } from "@/lib/server/services/media";

/** DELETE /api/admin/media/[id] — blocked while the file is used anywhere. */
export const DELETE = route<RouteContext<"/api/admin/media/[id]">>(async (_req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  await deleteMedia(admin, id);
  return jsonOk({ id });
});
