import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { createOffer, listAdminOffers } from "@/lib/server/services/rewards-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/offers → { offers (with completion counts and current reward), multiplier, categoryTickets } */
export const GET = route(async () => {
  await requireApiAdmin();
  return jsonOk(listAdminOffers());
});

/**
 * POST /api/admin/offers
 * { title, description, category, conditions, provider, estimatedTime, repeatable, active, iconUrl, sortOrder? }
 * → { offer }
 */
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  const body = await readJson(req);
  return jsonOk({ offer: await createOffer(admin, body) });
});
