import type { MeResponse } from "@/lib/api-types";
import { getCurrentUser } from "@/lib/server/auth";
import { toPublicUser } from "@/lib/server/dto";
import { jsonOk, route } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await getCurrentUser();
  return jsonOk<MeResponse>({ user: user ? toPublicUser(user) : null });
});
