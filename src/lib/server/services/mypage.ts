import "server-only";
import type { DrawRecord, LedgerEntry, Order, ShippingAddress, User, UserPrize } from "@/lib/types";
import type { LoginBonusStatusDto, VideoStatusDto } from "@/components/earn/types";
import { getDb } from "../store";
import { getLoginBonusStatus, getVideoStatus } from "./rewards";

/** Everything My Page renders for the signed-in member (own data only). */
export interface MypageDto {
  serverNow: string;
  user: { id: string; nickname: string; email: string; createdAt: string; tickets: number; points: number };
  loginBonus: LoginBonusStatusDto;
  video: VideoStatusDto;
  prizes: Array<UserPrize & { trackingNumber: string | null; shippedAt: string | null }>;
  orders: Order[];
  ledger: LedgerEntry[];
  draws: DrawRecord[];
  lastAddress: ShippingAddress | null;
  stats: { draws: number; slots: number; prizesToShip: number; pendingOrders: number };
}

export function listMyPrizes(userId: string): MypageDto["prizes"] {
  const db = getDb();
  return [...db.userPrizes.values()]
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => {
      const order = p.orderId ? db.orders.get(p.orderId) : undefined;
      return { ...p, trackingNumber: order?.trackingNumber ?? null, shippedAt: order?.shippedAt ?? null };
    });
}

export function buildMypageData(user: User): MypageDto {
  const db = getDb();
  const now = Date.now();
  const ledger = db.ledger.filter((e) => e.userId === user.id).reverse();
  const draws = db.draws.filter((d) => d.userId === user.id).reverse();
  const orders = [...db.orders.values()].filter((o) => o.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const prizes = listMyPrizes(user.id);
  return {
    serverNow: new Date(now).toISOString(),
    user: { id: user.id, nickname: user.nickname, email: user.email, createdAt: user.createdAt, tickets: user.tickets, points: user.points },
    loginBonus: getLoginBonusStatus(user, now),
    video: getVideoStatus(user, now),
    prizes,
    orders,
    ledger: ledger.slice(0, 500),
    draws: draws.slice(0, 50),
    lastAddress: user.lastAddress,
    stats: {
      draws: draws.length,
      slots: draws.reduce((sum, d) => sum + d.count, 0),
      prizesToShip: prizes.filter((p) => p.type === "physical" && p.status === "owned").length,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
    },
  };
}
