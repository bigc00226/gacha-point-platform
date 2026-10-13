import "server-only";
import type { Balances } from "@/lib/api-types";
import { formatPoints, formatTickets } from "@/lib/format";
import { jstDateKey } from "@/lib/time";
import { assertDemoToolsEnabled } from "../demo";
import { ApiError } from "../http";
import { changePoints, changeTickets } from "../ledger";
import { lockKeys, withLocks } from "../lock";
import { getDb } from "../store";
import { vInt } from "../validate";

/** Demo-only shortcuts used by the floating DEMO panel. Disabled with DEMO_TOOLS_ENABLED=false. */

export async function demoGrant(userId: string, body: Record<string, unknown>): Promise<Balances> {
  assertDemoToolsEnabled();
  const tickets = body.tickets === undefined ? 0 : vInt(body.tickets, "tickets", "チケット", { min: 0, max: 100_000 });
  const points = body.points === undefined ? 0 : vInt(body.points, "points", "ポイント", { min: 0, max: 10_000_000 });
  if (tickets === 0 && points === 0) throw new ApiError(400, "VALIDATION_ERROR", "付与する数を指定してください");
  return withLocks([lockKeys.user(userId)], () => {
    const db = getDb();
    const user = db.users.get(userId);
    if (!user) throw new ApiError(404, "NOT_FOUND", "会員が見つかりません");
    if (tickets > 0) changeTickets(db, user, tickets, "demo_grant", `デモ用チケット付与（${formatTickets(tickets)}）`);
    if (points > 0) changePoints(db, user, points, "demo_grant", `デモ用ポイント付与（${formatPoints(points)}）`);
    return { tickets: user.tickets, points: user.points };
  });
}

export async function demoVideoReset(userId: string): Promise<{ todayCount: number }> {
  assertDemoToolsEnabled();
  return withLocks([lockKeys.user(userId)], () => {
    const user = getDb().users.get(userId);
    if (!user) throw new ApiError(404, "NOT_FOUND", "会員が見つかりません");
    user.videoViews = { date: jstDateKey(), count: 0 };
    return { todayCount: 0 };
  });
}

/** Puts the ゴールドラッシュガチャ a few slots from the end so the ラストワン賞 can be tried. */
export async function demoLastOneSetup(body: Record<string, unknown>): Promise<{ gachaId: string; remainingSlots: number }> {
  assertDemoToolsEnabled();
  const gachaId = typeof body.gachaId === "string" ? body.gachaId : "g_goldrush";
  const remaining = body.remaining === undefined ? 5 : vInt(body.remaining, "remaining", "残り口数", { min: 1, max: 100 });
  return withLocks([lockKeys.gacha(gachaId)], () => {
    const gacha = getDb().gachas.get(gachaId);
    if (!gacha || gacha.isSandbox) throw new ApiError(404, "NOT_FOUND", "ガチャが見つかりません");
    gacha.remainingSlots = Math.min(remaining, gacha.totalSlots);
    gacha.status = "active";
    gacha.lastOneWinner = null;
    gacha.updatedAt = new Date().toISOString();
    return { gachaId, remainingSlots: gacha.remainingSlots };
  });
}
