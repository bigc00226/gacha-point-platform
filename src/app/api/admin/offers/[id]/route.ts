import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { deleteOffer, updateOffer } from "@/lib/server/services/rewards-admin";

/** PUT /api/admin/offers/[id] — any subset of the offer fields (e.g. { active: false } to unpublish) → { offer } */
export const PUT = route<RouteContext<"/api/admin/offers/[id]">>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  const body = await readJson(req);
  return jsonOk({ offer: await updateOffer(admin, id, body) });
});

/** DELETE /api/admin/offers/[id] → { id, completions } (completion history and ledger rows are kept) */
export const DELETE = route<RouteContext<"/api/admin/offers/[id]">>(async (_req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  return jsonOk(await deleteOffer(admin, id));
});
