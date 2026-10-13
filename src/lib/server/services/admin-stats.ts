import "server-only";
import type { AuditLog, LedgerReason, Order, PostbackLog } from "@/lib/types";
import { addDaysToKey, jstDateKey } from "@/lib/time";
import { getDb, visibleGachas, visibleUsers } from "../store";
import { recentBigWins } from "./gacha";

export interface DashboardDto {
  generatedAt: string;
  kpis: {
    members: number;
    newToday: number;
    activeToday: number;
    drawRequestsToday: number;
    slotsToday: number;
    ticketsSpentToday: number;
    ticketsGrantedToday: number;
    pointsGrantedToday: number;
    pointsExchangedToday: number;
    pendingOrders: number;
    activeGachas: number;
  };
  grantBreakdownToday: Array<{ key: string; label: string; tickets: number }>;
  days: Array<{ key: string; label: string; slots: number; ticketsGranted: number; ticketsSpent: number; newMembers: number }>;
  gachas: Array<{ id: string; title: string; status: string; remainingSlots: number; totalSlots: number; lastOneWinner: string | null; slotsToday: number }>;
  bigWins: ReturnType<typeof recentBigWins>;
  postbacks: PostbackLog[];
  orders: Order[];
  audits: AuditLog[];
}

const GRANT_SOURCES: Array<{ reason: LedgerReason; label: string }> = [
  { reason: "login_bonus", label: "ログインボーナス" },
  { reason: "video_reward", label: "動画視聴" },
  { reason: "offer_reward", label: "案件達成" },
  { reason: "signup_bonus", label: "新規登録" },
  { reason: "admin_adjust", label: "運営調整" },
];

export function buildDashboard(now = Date.now()): DashboardDto {
  const db = getDb();
  const virtual = new Set([...db.users.values()].filter((u) => u.isVirtual).map((u) => u.id));
  const today = jstDateKey(now);
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i - 6));
  const days = new Map(dayKeys.map((k) => [k, { slots: 0, ticketsGranted: 0, ticketsSpent: 0, newMembers: 0 }]));

  const members = visibleUsers(db);
  let newToday = 0;
  for (const u of members) {
    const k = jstDateKey(u.createdAt);
    if (k === today) newToday += 1;
    const d = days.get(k);
    if (d) d.newMembers += 1;
  }

  const active = new Set<string>();
  const grants = new Map<LedgerReason, number>();
  let ticketsSpentToday = 0;
  let ticketsGrantedToday = 0;
  let pointsGrantedToday = 0;
  let pointsExchangedToday = 0;
  for (const e of db.ledger) {
    // Demo top-ups (DEMO panel) are tooling, not business activity.
    if (virtual.has(e.userId) || e.reason === "demo_grant") continue;
    const k = jstDateKey(e.createdAt);
    const d = days.get(k);
    if (e.currency === "ticket") {
      if (e.amount > 0 && d) d.ticketsGranted += e.amount;
      if (e.amount < 0 && d) d.ticketsSpent += -e.amount;
    }
    if (k !== today) continue;
    active.add(e.userId);
    if (e.currency === "ticket") {
      if (e.amount > 0) {
        ticketsGrantedToday += e.amount;
        grants.set(e.reason, (grants.get(e.reason) ?? 0) + e.amount);
      } else ticketsSpentToday += -e.amount;
    } else if (e.amount > 0 && e.reason !== "exchange_refund") pointsGrantedToday += e.amount;
    else if (e.reason === "exchange") pointsExchangedToday += -e.amount;
  }

  let drawRequestsToday = 0;
  let slotsToday = 0;
  const slotsTodayByGacha = new Map<string, number>();
  for (const d of db.draws) {
    if (virtual.has(d.userId)) continue;
    const k = jstDateKey(d.createdAt);
    const day = days.get(k);
    if (day) day.slots += d.count;
    if (k === today) {
      drawRequestsToday += 1;
      slotsToday += d.count;
      slotsTodayByGacha.set(d.gachaId, (slotsTodayByGacha.get(d.gachaId) ?? 0) + d.count);
    }
  }

  const gachas = visibleGachas(db);
  const orders = [...db.orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    generatedAt: new Date(now).toISOString(),
    kpis: {
      members: members.length,
      newToday,
      activeToday: active.size,
      drawRequestsToday,
      slotsToday,
      ticketsSpentToday,
      ticketsGrantedToday,
      pointsGrantedToday,
      pointsExchangedToday,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      activeGachas: gachas.filter((g) => g.status === "active").length,
    },
    grantBreakdownToday: GRANT_SOURCES.map((s) => ({ key: s.reason, label: s.label, tickets: grants.get(s.reason) ?? 0 })),
    days: dayKeys.map((k) => ({ key: k, label: `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`, ...days.get(k)! })),
    gachas: gachas.map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      remainingSlots: g.remainingSlots,
      totalSlots: g.totalSlots,
      lastOneWinner: g.lastOneWinner?.nickname ?? null,
      slotsToday: slotsTodayByGacha.get(g.id) ?? 0,
    })),
    bigWins: recentBigWins(6),
    postbacks: db.postbacks.filter((p) => !p.userId || !virtual.has(p.userId)).slice(-6).reverse(),
    orders: orders.slice(0, 5),
    audits: db.auditLogs.slice(-8).reverse(),
  };
}
