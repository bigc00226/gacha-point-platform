import { requireApiAdmin } from "@/lib/server/auth";
import { jsonOk, readJson, route } from "@/lib/server/http";
import { updateSiteSettings } from "@/lib/server/services/admin-settings";

/** PUT { siteName, tagline, announcement } */
export const PUT = route(async (req) => {
  const admin = await requireApiAdmin();
  return jsonOk({ site: await updateSiteSettings(admin, await readJson(req)) });
});
