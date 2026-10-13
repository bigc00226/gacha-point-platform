import "server-only";
import type { DrawRecord, LedgerEntry, Order, PostbackLog, User, UserPrize, UserRole, UserStatus } from "@/lib/types";
import { formatPoints, formatTickets } from "@/lib/format";
import { recordAudit } from "../audit";
import { ApiError } from "../http";
import { changePoints, changeTickets } from "../ledger";
import { lockKeys, withLocks } from "../lock";
import { getDb, visibleUsers } from "../store";
import { validationFail, vInt, vOneOf, vString } from "../validate";
import { getLoginBonusStatus, getVideoStatus } from "./rewards";

export interface AdminUserRowDto {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  status: UserStatus;
  tickets: number;
  points: number;
  createdAt: string;
  lastLoginAt: string | null;
  draws: number;
}

export function listUsersAdmin(): AdminUserRowDto[] {
  const db = getDb();
  const draws = new Map<string, number>();
  for (const d of db.draws) draws.set(d.userId, (draws.get(d.userId) ?? 0) + d.count);
  return visibleUsers(db)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((u) => ({
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      role: u.role,
      status: u.status,
      tickets: u.tickets,
      points: u.points,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      draws: draws.get(u.id) ?? 0,
    }));
}

export interface AdminUserDetailDto {
  user: AdminUserRowDto & { loginStreak: number; loginClaimedToday: boolean; videoToday: number; videoLimit: number };
  ledger: LedgerEntry[];
  draws: DrawRecord[];
  prizes: UserPrize[];
  orders: Order[];
  postbacks: PostbackLog[];
}

export function getUserDetailAdmin(id: string): AdminUserDetailDto | null {
  const db = getDb();
  const u = db.users.get(id);
  if (!u || u.isVirtual) return null;
  const row = listUsersAdmin().find((r) => r.id === id)!;
  const bonus = getLoginBonusStatus(u);
  const video = getVideoStatus(u);
  return {
    user: { ...row, loginStreak: bonus.streak, loginClaimedToday: bonus.claimedToday, videoToday: video.todayCount, videoLimit: video.dailyLimit },
    ledger: db.ledger.filter((e) => e.userId === id).reverse().slice(0, 300),
    draws: db.draws.filter((d) => d.userId === id).reverse().slice(0, 50),
    prizes: [...db.userPrizes.values()].filter((p) => p.userId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    orders: [...db.orders.values()].filter((o) => o.userId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    postbacks: db.postbacks.filter((p) => p.userId === id).slice(-100).reverse(),
  };
}

export async function setUserStatus(admin: User, id: string, status: unknown): Promise<void> {
  const next = vOneOf(status, "status", "状態", ["active", "suspended"] as const);
  await withLocks([lockKeys.user(id)], () => {
    const db = getDb();
    const user = db.users.get(id);
    if (!user || user.isVirtual) throw new ApiError(404, "NOT_FOUND", "会員が見つかりません");
    if (user.id === admin.id && next === "suspended") throw new ApiError(400, "SELF_SUSPEND", "自分自身を利用停止にすることはできません");
    if (user.role === "admin" && next === "suspended") {
      const activeAdmins = [...db.users.values()].filter((u) => u.role === "admin" && u.status === "active");
      if (activeAdmins.length <= 1) throw new ApiError(400, "LAST_ADMIN", "最後の管理者は利用停止にできません");
    }
    user.status = next;
    recordAudit(db, admin, next === "suspended" ? "会員を利用停止" : "会員の利用を再開", `${user.nickname}（${user.email}）`);
  });
}

export async function adjustBalance(admin: User, id: string, body: Record<string, unknown>): Promise<{ tickets: number; points: number }> {
  const currency = vOneOf(body.currency, "currency", "種類", ["ticket", "point"] as const);
  const amount = vInt(body.amount, "amount", "調整数", { min: -10_000_000, max: 10_000_000 });
  if (amount === 0) validationFail("amount", "0以外の数を入力してください");
  const reason = vString(body.reason, "reason", "理由", { max: 100 });
  return withLocks([lockKeys.user(id)], () => {
    const db = getDb();
    const user = db.users.get(id);
    if (!user || user.isVirtual) throw new ApiError(404, "NOT_FOUND", "会員が見つかりません");
    const description = `運営調整: ${reason}`;
    if (currency === "ticket") changeTickets(db, user, amount, "admin_adjust", description);
    else changePoints(db, user, amount, "admin_adjust", description);
    const label = currency === "ticket" ? formatTickets(Math.abs(amount)) : formatPoints(Math.abs(amount));
    recordAudit(db, admin, "残高を調整", `${user.nickname}（${user.email}）`, `${currency === "ticket" ? "チケット" : "ポイント"} ${amount > 0 ? "+" : "-"}${label} / ${reason}`);
    return { tickets: user.tickets, points: user.points };
  });
}
