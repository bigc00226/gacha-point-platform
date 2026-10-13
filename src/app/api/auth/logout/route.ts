import { clearSessionCookie } from "@/lib/server/auth";
import { jsonOk, route } from "@/lib/server/http";

export const POST = route(async () => {
  await clearSessionCookie();
  return jsonOk({ loggedOut: true });
});
