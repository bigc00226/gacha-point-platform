import { assertDemoToolsEnabled } from "@/lib/server/demo";
import { jsonOk, route } from "@/lib/server/http";
import { resetDb } from "@/lib/server/store";

/** POST /api/demo/reset — restore the initial demo data (sessions of seeded accounts stay valid). */
export const POST = route(async () => {
  assertDemoToolsEnabled();
  const db = resetDb();
  return jsonOk({ seededAt: db.seededAt });
});
