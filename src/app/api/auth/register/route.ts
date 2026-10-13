import type { User } from "@/lib/types";
import { jstDateKey } from "@/lib/time";
import { setSessionCookie } from "@/lib/server/auth";
import { toPublicUser } from "@/lib/server/dto";
import { ApiError, isSecureRequest, jsonOk, readJson, route } from "@/lib/server/http";
import { newId } from "@/lib/server/ids";
import { changeTickets } from "@/lib/server/ledger";
import { withLock } from "@/lib/server/lock";
import { hashPassword } from "@/lib/server/password";
import { findUserByEmail, getDb } from "@/lib/server/store";
import { validationFail, vEmail, vString } from "@/lib/server/validate";

export const POST = route(async (req) => {
  const body = await readJson(req);
  const nickname = vString(body.nickname, "nickname", "ニックネーム", { max: 20 });
  const email = vEmail(body.email);
  const password = vString(body.password, "password", "パスワード", { min: 8, max: 72, trim: false });
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    validationFail("password", "パスワードは英字と数字を組み合わせて8文字以上で入力してください");
  }
  if (body.agree !== true) validationFail("agree", "利用規約への同意が必要です");

  const db = getDb();
  const user = await withLock(`email:${email}`, () => {
    if (findUserByEmail(db, email)) {
      throw new ApiError(409, "EMAIL_TAKEN", "このメールアドレスは既に登録されています", { field: "email" });
    }
    const now = new Date().toISOString();
    const created: User = {
      id: newId("u"),
      email,
      passwordHash: hashPassword(password),
      nickname,
      role: "user",
      status: "active",
      tickets: 0,
      points: 0,
      loginBonus: { lastClaimDate: null, streak: 0, totalClaims: 0 },
      videoViews: { date: jstDateKey(), count: 0 },
      lastAddress: null,
      createdAt: now,
      lastLoginAt: now,
    };
    db.users.set(created.id, created);
    const bonus = db.rewardSettings.signupBonusTickets;
    if (bonus > 0) changeTickets(db, created, bonus, "signup_bonus", "新規登録ボーナス");
    return created;
  });

  await setSessionCookie(user.id, isSecureRequest(req));
  return jsonOk({ user: toPublicUser(user), signupBonus: db.rewardSettings.signupBonusTickets });
});
