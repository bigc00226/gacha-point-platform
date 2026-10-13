import { requireApiUser } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";
import { demoVideoReset } from "@/lib/server/services/demo-tools";

/** POST /api/demo/video-reset — today's rewarded-video count back to 0 (demo only). */
export const POST = route(async () => {
  const user = await requireApiUser();
  return jsonOk(await demoVideoReset(user.id));
});
