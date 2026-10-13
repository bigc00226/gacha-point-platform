import "server-only";
import type { Gacha, Prize, User } from "@/lib/types";
import { recordAudit } from "../audit";
import { ApiError } from "../http";
import { newId } from "../ids";
import { getDb, prizesOfGacha, type Db } from "../store";
import { vInt, vOneOf } from "../validate";
import { executeDraw } from "./gacha";


/**
 * Admin load / consistency tests. Everything runs against a sandbox gacha and
 * virtual users that are removed afterwards, using the real draw transaction
 * (executeDraw). "nolock" mode bypasses the lock to show what goes wrong without it.
 */

type LoadGlobal = typeof globalThis & { __poigachaLoadTestRunning?: boolean };
const state = globalThis as LoadGlobal;

export interface InvariantDto {
  key: string;
  label: string;
  expected: string;
  actual: string;
  ok: boolean;
  note: string;
}

export interface RaceReportDto {
  kind: "race";
  mode: "lock" | "nolock";
  options: { users: number; slots: number; draws: "1" | "10" | "random"; latencyMs: number; jitterMs: number };
  durationMs: number;
  throughput: number;
  requests: number;
  succeeded: number;
  rejected: { soldOut: number; insufficientSlots: number; other: number };
  slotsSold: number;
  totalSlots: number;
  finalRemaining: number;
  lastOneWinners: Array<{ nickname: string; drawId: string }>;
  duplicateSlots: number;
  ticketsSpent: number;
  latency: { avg: number; p50: number; p95: number; max: number };
  histogram: Array<{ label: string; count: number }>;
  invariants: InvariantDto[];
  ok: boolean;
  cleanup: { draws: number; ledger: number; users: number };
}

export interface IdempotencyReportDto {
  kind: "idempotency";
  mode: "lock" | "nolock";
  repeats: number;
  durationMs: number;
  drawRecords: number;
  replayed: number;
  errors: number;
  distinctDrawIds: number;
  ticketsCharged: number;
  expectedCharge: number;
  invariants: InvariantDto[];
  ok: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const fmt = (n: number) => n.toLocaleString("ja-JP");

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function createSandbox(db: Db, run: string, slots: number): Gacha {
  const source = db.gachas.get("g_dream") ?? [...db.gachas.values()].find((g) => !g.isSandbox);
  const now = new Date().toISOString();
  const gacha: Gacha = {
    id: `g_sbx_${run}`,
    title: "負荷テスト用ガチャ",
    subtitle: "",
    description: "",
    thumbnailUrl: null,
    ticketCost: 1,
    totalSlots: slots,
    remainingSlots: slots,
    status: "active",
    badge: null,
    featured: false,
    sortOrder: 99_999,
    lastOnePrize: source?.lastOnePrize ?? { name: "ラストワン賞", description: "", imageUrl: null, type: "point", pointValue: 1000 },
    lastOneWinner: null,
    endsAt: null,
    isSandbox: true,
    createdAt: now,
    updatedAt: now,
  };
  db.gachas.set(gacha.id, gacha);
  const prizes: Prize[] = source ? prizesOfGacha(db, source.id) : [];
  prizes.forEach((p, i) => {
    const id = `p_sbx_${run}_${i}`;
    db.prizes.set(id, { ...p, id, gachaId: gacha.id, wonCount: 0 });
  });
  return gacha;
}

function createVirtualUsers(db: Db, run: string, n: number, tickets: number): User[] {
  const now = new Date().toISOString();
  const users: User[] = [];
  for (let i = 0; i < n; i++) {
    const user: User = {
      id: `u_vt_${run}_${i}`,
      email: `vt${i}_${run}@loadtest.invalid`,
      passwordHash: "-",
      nickname: `仮想ユーザー${i + 1}`,
      role: "user",
      status: "active",
      tickets,
      points: 0,
      loginBonus: { lastClaimDate: null, streak: 0, totalClaims: 0 },
      videoViews: { date: "", count: 0 },
      lastAddress: null,
      isVirtual: true,
      createdAt: now,
      lastLoginAt: null,
    };
    db.users.set(user.id, user);
    users.push(user);
  }
  return users;
}

function cleanup(db: Db, gachaId: string, userIds: Set<string>): { draws: number; ledger: number; users: number } {
  const beforeDraws = db.draws.length;
  const beforeLedger = db.ledger.length;
  db.draws = db.draws.filter((d) => d.gachaId !== gachaId && !userIds.has(d.userId));
  for (const key of [...db.drawRequests.keys()]) if (userIds.has(key.split(":")[0])) db.drawRequests.delete(key);
  db.ledger = db.ledger.filter((e) => !userIds.has(e.userId));
  for (const [id, p] of db.userPrizes) if (userIds.has(p.userId)) db.userPrizes.delete(id);
  for (const p of prizesOfGacha(db, gachaId)) db.prizes.delete(p.id);
  db.gachas.delete(gachaId);
  for (const id of userIds) db.users.delete(id);
  return { draws: beforeDraws - db.draws.length, ledger: beforeLedger - db.ledger.length, users: userIds.size };
}

async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (state.__poigachaLoadTestRunning) throw new ApiError(409, "TEST_RUNNING", "別のテストを実行中です。完了までお待ちください");
  state.__poigachaLoadTestRunning = true;
  try {
    return await fn();
  } finally {
    state.__poigachaLoadTestRunning = false;
  }
}

/** ラストワン争奪：多数の仮想ユーザーが同時に残りわずかの口を引き合う。 */
export async function runRaceTest(admin: User, body: Record<string, unknown>): Promise<RaceReportDto> {
  const users = vInt(body.users ?? 1000, "users", "仮想ユーザー数", { min: 10, max: 2000 });
  const slots = vInt(body.slots ?? 300, "slots", "総口数", { min: 10, max: 10_000 });
  const draws = vOneOf(String(body.draws ?? "random"), "draws", "1リクエストの回数", ["1", "10", "random"] as const);
  const latencyMs = vInt(body.latencyMs ?? 1, "latencyMs", "擬似DB遅延", { min: 0, max: 5 });
  const jitterMs = vInt(body.jitterMs ?? 200, "jitterMs", "到着のばらつき", { min: 0, max: 2000 });
  const mode = vOneOf(String(body.mode ?? "lock"), "mode", "モード", ["lock", "nolock"] as const);

  return exclusive(async () => {
    const db = getDb();
    const run = newId("t").slice(2, 10);
    const gacha = createSandbox(db, run, slots);
    const vusers = createVirtualUsers(db, run, users, 20);
    const userIds = new Set(vusers.map((u) => u.id));
    const latencies: number[] = [];
    const rejected = { soldOut: 0, insufficientSlots: 0, other: 0 };
    let succeeded = 0;

    const started = performance.now();
    await Promise.all(
      vusers.map(async (u, i) => {
        if (jitterMs > 0) await sleep(Math.random() * jitterMs);
        const count = draws === "1" ? 1 : draws === "10" ? 10 : 1 + Math.floor(Math.random() * 10);
        const t0 = performance.now();
        try {
          await executeDraw(
            { userId: u.id, gachaId: gacha.id, count, requestId: `lt-${run}-${i}` },
            { useLock: mode === "lock", simulatedLatencyMs: latencyMs },
          );
          succeeded += 1;
        } catch (err) {
          const code = err instanceof ApiError ? err.code : "ERROR";
          if (code === "SOLD_OUT") rejected.soldOut += 1;
          else if (code === "INSUFFICIENT_SLOTS") rejected.insufficientSlots += 1;
          else rejected.other += 1;
        }
        latencies.push(performance.now() - t0);
      }),
    );
    const durationMs = performance.now() - started;

    const sandboxDraws = db.draws.filter((d) => d.gachaId === gacha.id);
    const slotsSold = sandboxDraws.reduce((sum, d) => sum + d.count, 0);
    const slotNumbers = sandboxDraws.flatMap((d) => d.results.map((r) => r.slotNumber));
    const duplicateSlots = slotNumbers.length - new Set(slotNumbers).size;
    const lastOneWinners = sandboxDraws.filter((d) => d.lastOne).map((d) => ({ nickname: d.userNickname, drawId: d.id }));
    const ticketsSpent = db.ledger
      .filter((e) => userIds.has(e.userId) && e.reason === "gacha_draw")
      .reduce((sum, e) => sum - e.amount, 0);
    const negative = vusers.filter((u) => u.tickets < 0).length;
    const finalRemaining = gacha.remainingSlots;

    const sorted = [...latencies].sort((a, b) => a - b);
    const max = sorted[sorted.length - 1] ?? 0;
    const bucketCount = 10;
    const width = Math.max(1, max / bucketCount);
    const histogram = Array.from({ length: bucketCount }, (_, b) => ({
      label: `${Math.round(b * width)}〜${Math.round((b + 1) * width)}ms`,
      count: sorted.filter((v) => (b === bucketCount - 1 ? v >= b * width : v >= b * width && v < (b + 1) * width)).length,
    }));

    const soldOutReached = slotsSold >= slots;
    const invariants: InvariantDto[] = [
      {
        key: "oversell",
        label: "売り越しがない（販売口数 ≦ 総口数）",
        expected: `${fmt(slots)}口以下`,
        actual: `${fmt(slotsSold)}口`,
        ok: slotsSold <= slots,
        note: slotsSold > slots ? `${fmt(slotsSold - slots)}口を売り越しました` : "総口数を超えて販売されていません",
      },
      {
        key: "remaining",
        label: "残り口数の記録が正しい",
        expected: `${fmt(slots - Math.min(slotsSold, slots))}口`,
        actual: `${fmt(finalRemaining)}口`,
        ok: finalRemaining === slots - slotsSold,
        note: finalRemaining === slots - slotsSold ? "販売数と残り口数が一致" : "同時更新で残り口数が上書きされました（ロストアップデート）",
      },
      {
        key: "slots",
        label: "同じ口番号が複数人に割り当てられていない",
        expected: "重複 0件",
        actual: `重複 ${fmt(duplicateSlots)}件`,
        ok: duplicateSlots === 0,
        note: duplicateSlots === 0 ? "すべての口番号が一意" : "同じ口番号の結果が複数の会員に発行されました",
      },
      {
        key: "lastone",
        label: "ラストワン賞の当選者がちょうど1名",
        expected: soldOutReached ? "1名" : "0名（未完売）",
        actual: `${lastOneWinners.length}名`,
        ok: soldOutReached ? lastOneWinners.length === 1 : lastOneWinners.length === 0,
        note:
          lastOneWinners.length > 1
            ? `${lastOneWinners.length}名に重複して付与されました`
            : lastOneWinners.length === 1
              ? `${lastOneWinners[0].nickname}が最後の1口を獲得`
              : soldOutReached
                ? "完売したのに当選者がいません"
                : "総口数まで販売されていません",
      },
      {
        key: "tickets",
        label: "チケット消費 = 販売口数 × 単価",
        expected: `${fmt(slotsSold)}枚`,
        actual: `${fmt(ticketsSpent)}枚`,
        ok: ticketsSpent === slotsSold,
        note: "台帳（ledger）の消費記録と抽選結果を突き合わせ",
      },
      {
        key: "negative",
        label: "残高がマイナスの会員がいない",
        expected: "0名",
        actual: `${negative}名`,
        ok: negative === 0,
        note: "残高更新は会員単位で検証（不足時はエラー）",
      },
    ];

    const cleaned = cleanup(db, gacha.id, userIds);
    const ok = invariants.every((v) => v.ok);
    recordAudit(db, admin, "負荷・整合性テストを実行", mode === "lock" ? "排他制御あり" : "排他制御なし（比較用）", `仮想ユーザー${fmt(users)} / 総口数${fmt(slots)} / ${ok ? "整合性OK" : "不整合を検出"}`);

    return {
      kind: "race",
      mode,
      options: { users, slots, draws, latencyMs, jitterMs },
      durationMs: round(durationMs),
      throughput: round(users / Math.max(0.001, durationMs / 1000)),
      requests: users,
      succeeded,
      rejected,
      slotsSold,
      totalSlots: slots,
      finalRemaining,
      lastOneWinners: lastOneWinners.slice(0, 10),
      duplicateSlots,
      ticketsSpent,
      latency: {
        avg: round(latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length)),
        p50: round(percentile(sorted, 50)),
        p95: round(percentile(sorted, 95)),
        max: round(max),
      },
      histogram,
      invariants,
      ok,
      cleanup: cleaned,
    };
  });
}

/** 二重送信：同じ requestId のリクエストを同時に N 回送る。 */
export async function runIdempotencyTest(admin: User, body: Record<string, unknown>): Promise<IdempotencyReportDto> {
  const repeats = vInt(body.repeats ?? 20, "repeats", "送信回数", { min: 2, max: 50 });
  const mode = vOneOf(String(body.mode ?? "lock"), "mode", "モード", ["lock", "nolock"] as const);
  const latencyMs = vInt(body.latencyMs ?? 1, "latencyMs", "擬似DB遅延", { min: 0, max: 5 });

  return exclusive(async () => {
    const db = getDb();
    const run = newId("t").slice(2, 10);
    const gacha = createSandbox(db, run, 10_000);
    const [user] = createVirtualUsers(db, run, 1, 1000);
    const count = 10;
    const requestId = `idem-${run}`;
    let replayed = 0;
    let errors = 0;
    const drawIds = new Set<string>();

    const started = performance.now();
    await Promise.all(
      Array.from({ length: repeats }, async () => {
        try {
          const res = await executeDraw({ userId: user.id, gachaId: gacha.id, count, requestId }, { useLock: mode === "lock", simulatedLatencyMs: latencyMs });
          drawIds.add(res.draw.id);
          if (res.replayed) replayed += 1;
        } catch {
          errors += 1;
        }
      }),
    );
    const durationMs = performance.now() - started;
    const drawRecords = db.draws.filter((d) => d.gachaId === gacha.id).length;
    const ticketsCharged = 1000 - user.tickets;
    const expectedCharge = count * gacha.ticketCost;
    const invariants: InvariantDto[] = [
      {
        key: "charge",
        label: "チケットの消費は1回分だけ",
        expected: `${fmt(expectedCharge)}枚`,
        actual: `${fmt(ticketsCharged)}枚`,
        ok: ticketsCharged === expectedCharge,
        note: ticketsCharged === expectedCharge ? "二重課金なし" : `${fmt(ticketsCharged / expectedCharge)}回分が課金されました`,
      },
      {
        key: "records",
        label: "抽選は1回だけ実行される",
        expected: "1件",
        actual: `${fmt(drawRecords)}件`,
        ok: drawRecords === 1,
        note: "同じリクエストIDの結果は保存済みのものを返す",
      },
      {
        key: "same",
        label: "すべての応答が同じ抽選結果",
        expected: "抽選ID 1種類",
        actual: `抽選ID ${fmt(drawIds.size)}種類`,
        ok: drawIds.size === 1,
        note: `${fmt(replayed)}件は保存済みの結果を返却（replayed）`,
      },
    ];
    cleanup(db, gacha.id, new Set([user.id]));
    const ok = invariants.every((v) => v.ok);
    recordAudit(db, admin, "二重送信テストを実行", mode === "lock" ? "排他制御あり" : "排他制御なし（比較用）", `${repeats}回同時送信 / ${ok ? "整合性OK" : "不整合を検出"}`);
    return {
      kind: "idempotency",
      mode,
      repeats,
      durationMs: round(durationMs),
      drawRecords,
      replayed,
      errors,
      distinctDrawIds: drawIds.size,
      ticketsCharged,
      expectedCharge,
      invariants,
      ok,
    };
  });
}
