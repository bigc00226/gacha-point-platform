import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { listPostbacks, parsePostbackFilter } from "@/lib/server/services/rewards-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/postbacks?kind=video|offer&status=<PostbackStatus>&provider=admob|skyflag|tapjoy
 *   &source=simulator|external|admin_test&q=<user / transaction id / postback id>&page=1&pageSize=50
 * → { rows (newest first), total, page, pageCount, pageSize, filter, kpis }
 */
export const GET = route(async (req) => {
  await requireApiAdmin();
  const search = new URL(req.url).searchParams;
  const filter = parsePostbackFilter(Object.fromEntries(search));
  return jsonOk(listPostbacks(filter, Number(search.get("page") ?? 1), Number(search.get("pageSize") ?? 50)));
});
