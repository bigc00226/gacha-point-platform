import "server-only";
import type { Balances } from "@/lib/api-types";
import type { Coupon, CouponRedemption, CouponType, User } from "@/lib/types";
import { normalizeCouponCode } from "@/lib/codes";
import { formatNumber, formatPoints } from "@/lib/format";
import { recordAudit } from "../audit";
import { ApiError } from "../http";
import { generateCouponCode, newId } from "../ids";
import { changePoints } from "../ledger";
import { lockKeys, withLock, withLocks } from "../lock";
import { getDb } from "../store";
import { validationFail, vInt, vOneOf, vOptionalDate, vString } from "../validate";

/**
 * Coupon codes (ポイント付与コード).
 *  single = 使い捨て型: one redemption in total (DM distribution).
 *  shared = 先着限定型: common keyword (あいことば), N redemptions in total, once per member.
 */

export type CouponState = "active" | "exhausted" | "expired" | "disabled";

export interface CouponDto extends Coupon {
  state: CouponState;
}

export function couponState(c: Coupon, now = Date.now()): CouponState {
  if (!c.active) return "disabled";
  if (c.expiresAt && Date.parse(c.expiresAt) <= now) return "expired";
  if (c.usedCount >= c.maxUses) return "exhausted";
  return "active";
}

function findByCode(code: string): Coupon | undefined {
  for (const c of getDb().coupons.values()) if (c.code === code) return c;
  return undefined;
}

// --- Brute-force protection: 10 failed attempts per member per 10 minutes ---
type FailGlobal = typeof globalThis & { __poigachaCouponFails?: Map<string, number[]> };
const failStore = globalThis as FailGlobal;
const fails = (failStore.__poigachaCouponFails ??= new Map<string, number[]>());
const FAIL_WINDOW_MS = 10 * 60_000;
const FAIL_LIMIT = 10;

function assertNotThrottled(userId: string) {
  const now = Date.now();
  const recent = (fails.get(userId) ?? []).filter((t) => now - t < FAIL_WINDOW_MS);
  fails.set(userId, recent);
  if (recent.length >= FAIL_LIMIT) {
    throw new ApiError(429, "RATE_LIMITED", "入力ミスが続いたため、しばらく時間をおいてから（10分後）再度お試しください。");
  }
}
function recordFailure(userId: string) {
  fails.set(userId, [...(fails.get(userId) ?? []), Date.now()]);
}

export interface RedeemResultDto {
  points: number;
  balances: Balances;
  coupon: { displayCode: string; type: CouponType; label: string };
}

export async function redeemCoupon(userId: string, rawCode: unknown): Promise<RedeemResultDto> {
  const input = typeof rawCode === "string" ? rawCode : "";
  const code = normalizeCouponCode(input);
  if (!code) validationFail("code", "コードを入力してください");
  if (code.length > 40) validationFail("code", "コードが長すぎます");
  assertNotThrottled(userId);

  const found = findByCode(code);
  if (!found) {
    recordFailure(userId);
    throw new ApiError(404, "INVALID_CODE", "コードが正しくありません。入力内容をご確認ください。");
  }
  return withLocks([lockKeys.coupon(found.id), lockKeys.user(userId)], () => {
    const db = getDb();
    const coupon = db.coupons.get(found.id);
    const user = db.users.get(userId);
    if (!coupon) throw new ApiError(404, "INVALID_CODE", "コードが正しくありません。入力内容をご確認ください。");
    if (!user || user.status !== "active") throw new ApiError(403, "USER_SUSPENDED", "このアカウントではご利用いただけません");
    const now = Date.now();
    if (!coupon.active) throw new ApiError(409, "CODE_DISABLED", "このコードは現在ご利用いただけません");
    if (coupon.expiresAt && Date.parse(coupon.expiresAt) <= now) throw new ApiError(409, "CODE_EXPIRED", "このコードは有効期限が切れています");
    if (coupon.type === "single" && coupon.usedCount >= 1) {
      recordFailure(userId);
      throw new ApiError(409, "CODE_USED", "このコードは既に使用されています");
    }
    if (db.couponRedemptions.some((r) => r.couponId === coupon.id && r.userId === userId)) {
      throw new ApiError(409, "ALREADY_REDEEMED", "このコードは既にご利用済みです（おひとり様1回まで）");
    }
    if (coupon.usedCount >= coupon.maxUses) {
      throw new ApiError(409, "CODE_LIMIT_REACHED", "先着人数に達したため、このコードの受付は終了しました");
    }
    coupon.usedCount += 1;
    const redemption: CouponRedemption = {
      id: newId("cr"),
      couponId: coupon.id,
      code: coupon.code,
      userId,
      userNickname: user.nickname,
      points: coupon.points,
      createdAt: new Date(now).toISOString(),
    };
    db.couponRedemptions.push(redemption);
    changePoints(db, user, coupon.points, "coupon", `クーポンコード「${coupon.displayCode}」`, coupon.id, redemption.createdAt);
    return {
      points: coupon.points,
      balances: { tickets: user.tickets, points: user.points },
      coupon: { displayCode: coupon.displayCode, type: coupon.type, label: coupon.label },
    };
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface CouponKpisDto {
  issuedPoints: number;
  redeemedPoints: number;
  redemptionsToday: number;
  activeCodes: number;
}

export function listCouponsAdmin(): { coupons: CouponDto[]; kpis: CouponKpisDto } {
  const db = getDb();
  const now = Date.now();
  const coupons = [...db.coupons.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => ({ ...c, state: couponState(c, now) }));
  const todayStart = new Date(now - ((now + 9 * 3600_000) % 86_400_000)).toISOString();
  return {
    coupons,
    kpis: {
      issuedPoints: coupons.reduce((sum, c) => sum + c.points * c.maxUses, 0),
      redeemedPoints: coupons.reduce((sum, c) => sum + c.points * c.usedCount, 0),
      redemptionsToday: db.couponRedemptions.filter((r) => r.createdAt >= todayStart).length,
      activeCodes: coupons.filter((c) => c.state === "active").length,
    },
  };
}

export async function createCoupons(admin: User, body: Record<string, unknown>): Promise<CouponDto[]> {
  const type = vOneOf(body.type, "type", "コードの種類", ["single", "shared"] as const);
  const points = vInt(body.points, "points", "付与ポイント", { min: 100, max: 1_000_000 });
  const label = vString(body.label, "label", "メモ", { optional: true, max: 60 });
  const expiresAt = vOptionalDate(body.expiresAt, "expiresAt", "有効期限");
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) validationFail("expiresAt", "有効期限は未来の日時を指定してください");

  return withLock("coupons", () => {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = new Set([...db.coupons.values()].map((c) => c.code));
    const created: Coupon[] = [];
    if (type === "single") {
      const quantity = vInt(body.quantity, "quantity", "発行数", { min: 1, max: 500 });
      const prefix = vString(body.prefix ?? "PG", "prefix", "接頭辞", { max: 6 }).toUpperCase();
      if (!/^[A-Z]{2,6}$/.test(prefix)) validationFail("prefix", "接頭辞は英字2〜6文字で入力してください");
      const batchId = newId("cb");
      for (let i = 0; i < quantity; i++) {
        let display = generateCouponCode(prefix);
        while (existing.has(normalizeCouponCode(display))) display = generateCouponCode(prefix);
        existing.add(normalizeCouponCode(display));
        created.push({
          id: newId("cp"),
          type,
          code: normalizeCouponCode(display),
          displayCode: display,
          points,
          maxUses: 1,
          usedCount: 0,
          active: true,
          expiresAt,
          label: label || "使い捨てコード",
          batchId,
          createdAt: now,
          createdBy: admin.nickname,
        });
      }
    } else {
      const keyword = vString(body.keyword, "keyword", "あいことば", { min: 2, max: 30 });
      const code = normalizeCouponCode(keyword);
      if (code.length < 2) validationFail("keyword", "あいことばは2文字以上で入力してください");
      if (existing.has(code)) validationFail("keyword", "同じあいことばが既に登録されています");
      const maxUses = vInt(body.maxUses, "maxUses", "先着人数", { min: 1, max: 1_000_000 });
      created.push({
        id: newId("cp"),
        type,
        code,
        displayCode: keyword,
        points,
        maxUses,
        usedCount: 0,
        active: true,
        expiresAt,
        label: label || "先着限定コード",
        batchId: null,
        createdAt: now,
        createdBy: admin.nickname,
      });
    }
    for (const c of created) db.coupons.set(c.id, c);
    recordAudit(
      db,
      admin,
      "クーポンを発行",
      created[0].label,
      type === "single" ? `使い捨て型 ${created.length}件 / ${formatPoints(points)}` : `先着限定型「${created[0].displayCode}」先着${formatNumber(created[0].maxUses)}名 / ${formatPoints(points)}`,
    );
    return created.map((c) => ({ ...c, state: couponState(c) }));
  });
}

export async function setCouponActive(admin: User, id: string, active: unknown): Promise<CouponDto> {
  if (typeof active !== "boolean") validationFail("active", "状態の指定が正しくありません");
  return withLocks([lockKeys.coupon(id)], () => {
    const db = getDb();
    const coupon = db.coupons.get(id);
    if (!coupon) throw new ApiError(404, "NOT_FOUND", "クーポンが見つかりません");
    coupon.active = active;
    recordAudit(db, admin, active ? "クーポンを有効化" : "クーポンを停止", coupon.displayCode, coupon.label);
    return { ...coupon, state: couponState(coupon) };
  });
}

export async function deleteCoupon(admin: User, id: string): Promise<void> {
  await withLocks([lockKeys.coupon(id)], () => {
    const db = getDb();
    const coupon = db.coupons.get(id);
    if (!coupon) throw new ApiError(404, "NOT_FOUND", "クーポンが見つかりません");
    if (coupon.usedCount > 0) throw new ApiError(409, "COUPON_USED", "利用実績のあるコードは削除できません（停止してください）");
    db.coupons.delete(id);
    recordAudit(db, admin, "クーポンを削除", coupon.displayCode, coupon.label);
  });
}

export function couponRedemptions(id: string): CouponRedemption[] {
  const db = getDb();
  if (!db.coupons.has(id)) throw new ApiError(404, "NOT_FOUND", "クーポンが見つかりません");
  return db.couponRedemptions.filter((r) => r.couponId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
