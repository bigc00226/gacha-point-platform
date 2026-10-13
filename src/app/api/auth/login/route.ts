import { assertLoginAllowed, clearLoginFailures, recordLoginFailure, setSessionCookie } from "@/lib/server/auth";
import { toPublicUser } from "@/lib/server/dto";
import { ApiError, isSecureRequest, jsonOk, readJson, route } from "@/lib/server/http";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { findUserByEmail, getDb } from "@/lib/server/store";
import { vEmail, vString } from "@/lib/server/validate";

// Used to spend the same scrypt time when the email does not exist (no user enumeration by timing).
const DUMMY_HASH = hashPassword("dummy-password-for-timing");

export const POST = route(async (req) => {
  const body = await readJson(req);
  const email = vEmail(body.email);
  const password = vString(body.password, "password", "パスワード", { trim: false, max: 200 });
  assertLoginAllowed(email);

  const user = findUserByEmail(getDb(), email);
  const valid = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH) && !!user;
  if (!user || !valid) {
    recordLoginFailure(email);
    throw new ApiError(401, "INVALID_CREDENTIALS", "メールアドレスまたはパスワードが正しくありません");
  }
  if (user.status !== "active") {
    throw new ApiError(403, "SUSPENDED", "このアカウントは利用停止中です。運営にお問い合わせください。");
  }
  clearLoginFailures(email);
  user.lastLoginAt = new Date().toISOString();
  await setSessionCookie(user.id, isSecureRequest(req));
  return jsonOk({ user: toPublicUser(user) });
});
