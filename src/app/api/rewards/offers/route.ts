import { getCurrentUser } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { listOffersForUser } from "@/lib/server/services/rewards";

export const dynamic = "force-dynamic";

/** GET /api/rewards/offers — active offers with rewards; completion state when signed in. */
export const GET = route(async () => {
  const user = await getCurrentUser();
  return jsonOk({ offers: listOffersForUser(user?.id ?? null) });
});
