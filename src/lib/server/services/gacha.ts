import "server-only";
import type { DrawResponse, RemainingInfo } from "@/lib/api-types";
import type { DrawRecord, DrawResultItem, Gacha, Prize, Rank, User, UserPrize } from "@/lib/types";
import { MAX_DRAW_COUNT } from "@/lib/constants";
import { effectivePpb, isSoldOutPrize } from "@/lib/probability";
import type {
  BigWinDto,
  GachaCardDto,
  GachaDetailDto,
  GachaViewerDto,
  PrizeDto,
  PrizeGroupDto,
  RankDto,
} from "@/components/gacha/types";
import { ApiError } from "../http";
import { generateGiftCode, newId } from "../ids";
import { changePoints, changeTickets } from "../ledger";
import { lockKeys, withLocks } from "../lock";
import { drawPrizes, type LotteryCandidate } from "../lottery";
import { getDb, lastOneRank, prizesOfGacha, sortedRanks, visibleGachas, type Db } from "../store";

/**
 * Gacha service: the draw transaction (抽選), remaining-slot info and the DTOs
 * used by the user-facing gacha screens.
 *
 * Production mapping of `executeDraw` (one DB transaction per request):
 *   BEGIN;
 *   SELECT ... FROM draw_requests WHERE user_id = $1 AND request_id = $2;      -- idempotency (unique key)
 *   SELECT ... FROM gachas WHERE id = $3 FOR UPDATE;                            -- slot / last-one lock
 *   SELECT ... FROM users  WHERE id = $1 FOR UPDATE;                            -- balance lock
 *   UPDATE gachas SET remaining_slots = remaining_slots - $n WHERE remaining_slots >= $n;
 *   INSERT draws / draw_results / ledger / user_prizes ...;
 *   COMMIT;
 * The demo keeps data in memory, so `withLocks` (keyed async mutex) plays the role of the row locks.
 */

/** Slots ≤ this, or ≤ 1% of the total, count as "ラストワン間近". */
const NEAR_LAST_ONE_SLOTS = 100;
const NEAR_LAST_ONE_RATIO = 0.01;
/** Rank order ≤ this counts as a "big win" (特賞・A賞・B賞) for the winners feed. */
const BIG_WIN_MAX_ORDER = 3;

export interface ExecuteDrawInput {
  userId: string;
  gachaId: string;
  count: number;
  requestId: string;
}

export interface ExecuteDrawOptions {
  /** Default true. The admin load test passes false to demonstrate race conditions. */
  useLock?: boolean;
  /** Default 0. Models the DB round trip between the snapshot read and the writes. */
  simulatedLatencyMs?: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function gachaNotFound(): ApiError {
  return new ApiError(404, "NOT_FOUND", "ガチャが見つかりません");
}

function isEnded(gacha: Pick<Gacha, "endsAt">, now = Date.now()): boolean {
  return gacha.endsAt !== null && Date.parse(gacha.endsAt) <= now;
}

function isNearLastOne(gacha: Pick<Gacha, "status" | "remainingSlots" | "totalSlots">): boolean {
  return (
    gacha.status === "active" &&
    gacha.remainingSlots > 0 &&
    (gacha.remainingSlots <= NEAR_LAST_ONE_SLOTS || gacha.remainingSlots <= gacha.totalSlots * NEAR_LAST_ONE_RATIO)
  );
}

/** Newest-first lookup (replays are almost always recent). */
function findDrawById(db: Db, drawId: string): DrawRecord | undefined {
  for (let i = db.draws.length - 1; i >= 0; i--) {
    if (db.draws[i].id === drawId) return db.draws[i];
  }
  return undefined;
}

function remainingInfoOf(gacha: Gacha): RemainingInfo {
  return {
    gachaId: gacha.id,
    totalSlots: gacha.totalSlots,
    remainingSlots: gacha.remainingSlots,
    status: gacha.status,
    lastOneWinner: gacha.lastOneWinner ? { nickname: gacha.lastOneWinner.nickname, at: gacha.lastOneWinner.at } : null,
    fetchedAt: new Date().toISOString(),
  };
}

function validateDrawInput(input: ExecuteDrawInput): void {
  const { count, requestId } = input;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_DRAW_COUNT) {
    throw new ApiError(400, "VALIDATION_ERROR", `回数は1〜${MAX_DRAW_COUNT}の整数で指定してください`, { field: "count" });
  }
  if (typeof requestId !== "string" || requestId.length < 8 || requestId.length > 100 || !/^[\x21-\x7e]+$/.test(requestId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "リクエストIDの形式が正しくありません", { field: "requestId" });
  }
  if (typeof input.userId !== "string" || !input.userId || typeof input.gachaId !== "string" || !input.gachaId) {
    throw new ApiError(400, "VALIDATION_ERROR", "リクエストの形式が正しくありません");
  }
}

// ---------------------------------------------------------------------------
// Draw transaction
// ---------------------------------------------------------------------------

/**
 * Draw `count` times (1–100) in ONE request / transaction.
 *
 * 1. validate input
 * 2. idempotency: a known `${userId}:${requestId}` returns the stored draw (`replayed: true`, no charge)
 * 3. read a snapshot (remaining slots, tickets, stock per prize) and validate it
 * 4. optional simulated DB latency
 * 5. lottery (CSPRNG, stock-aware) + writes computed from the snapshot
 *    (remaining = snapshot - count; last-one iff snapshot - count === 0)
 *
 * Everything from step 2 runs inside `withLocks([gacha, user])` unless `useLock === false`.
 */
export async function executeDraw(input: ExecuteDrawInput, options: ExecuteDrawOptions = {}): Promise<DrawResponse> {
  validateDrawInput(input);
  const useLock = options.useLock !== false;
  const latency = Math.max(0, Number(options.simulatedLatencyMs) || 0);
  const transaction = () => runDrawTransaction(input, latency);
  return useLock
    ? withLocks([lockKeys.gacha(input.gachaId), lockKeys.user(input.userId)], transaction)
    : transaction();
}

async function runDrawTransaction(input: ExecuteDrawInput, latencyMs: number): Promise<DrawResponse> {
  const startedAt = performance.now();
  const { userId, gachaId, count, requestId } = input;
  const db = getDb();

  // 2. Idempotency ---------------------------------------------------------
  const requestKey = `${userId}:${requestId}`;
  const knownDrawId = db.drawRequests.get(requestKey);
  if (knownDrawId) {
    const stored = findDrawById(db, knownDrawId);
    if (stored) {
      if (stored.gachaId !== gachaId || stored.count !== count) {
        throw new ApiError(409, "REQUEST_ID_CONFLICT", "同じリクエストIDが別の内容で使用されています。画面を再読み込みしてください。");
      }
      const user = db.users.get(userId);
      const gacha = db.gachas.get(gachaId);
      return {
        draw: stored,
        replayed: true,
        balances: { tickets: user?.tickets ?? 0, points: user?.points ?? 0 },
        remaining: gacha ? remainingInfoOf(gacha) : { ...emptyRemaining(gachaId) },
      };
    }
    // The record was removed (e.g. sandbox cleanup) — treat the key as unused.
    db.drawRequests.delete(requestKey);
  }

  // 3. Snapshot + validation ---------------------------------------------------
  const gacha = db.gachas.get(gachaId);
  if (!gacha) throw gachaNotFound();
  if (gacha.status === "soldout") throw new ApiError(409, "SOLD_OUT", "このガチャは完売しました");
  if (gacha.status !== "active") {
    throw new ApiError(409, "GACHA_UNAVAILABLE", "このガチャは現在ご利用いただけません");
  }
  if (isEnded(gacha)) throw new ApiError(409, "GACHA_ENDED", "このガチャの販売期間は終了しました");

  const remaining = gacha.remainingSlots;
  if (remaining <= 0) throw new ApiError(409, "SOLD_OUT", "このガチャは完売しました");
  if (count > remaining) {
    throw new ApiError(
      409,
      "INSUFFICIENT_SLOTS",
      `残り${remaining.toLocaleString("ja-JP")}口のため、${count}回は引けません`,
      { remaining },
    );
  }

  const user = db.users.get(userId);
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "会員情報が見つかりません");
  if (user.status !== "active") throw new ApiError(403, "USER_SUSPENDED", "このアカウントは現在ご利用いただけません");

  const tickets = user.tickets;
  const cost = count * gacha.ticketCost;
  if (tickets < cost) {
    throw new ApiError(
      400,
      "INSUFFICIENT_TICKETS",
      `ガチャチケットが不足しています（必要: ${cost.toLocaleString("ja-JP")}枚 / 所持: ${tickets.toLocaleString("ja-JP")}枚）`,
      { required: cost, balance: tickets },
    );
  }

  const prizes = prizesOfGacha(db, gachaId);
  const candidates: LotteryCandidate[] = prizes.map((p) => ({
    id: p.id,
    probabilityPpb: p.probabilityPpb,
    isFallback: p.isFallback,
    stockLeft: p.stock === null ? null : Math.max(0, p.stock - p.wonCount),
  }));
  if (candidates.filter((c) => c.isFallback).length !== 1) {
    throw new ApiError(409, "GACHA_UNAVAILABLE", "景品設定を確認中のため、現在このガチャは引けません");
  }

  // 4. Simulated DB round trip (SELECT → UPDATE) -------------------------------
  if (latencyMs > 0) await sleep(latencyMs);

  // 5. Lottery + writes from the snapshot --------------------------------------
  const picks = drawPrizes(candidates, count);
  const drawId = newId("dr");
  const at = new Date().toISOString();
  const prizeById = new Map<string, Prize>(prizes.map((p) => [p.id, p]));

  // Tickets first: changeTickets() refuses to go negative, so a failure here leaves nothing half-written.
  changeTickets(db, user, -cost, "gacha_draw", `${gacha.title}（${count}回）`, drawId, at);

  const remainingAfter = remaining - count;
  gacha.remainingSlots = remainingAfter;
  const firstSlot = gacha.totalSlots - remaining;

  const results: DrawResultItem[] = picks.map((prizeId, i) => {
    const prize = prizeById.get(prizeId)!;
    const rank = db.ranks.get(prize.rankId);
    prize.wonCount += 1;
    return {
      index: i + 1,
      slotNumber: firstSlot + i + 1,
      prizeId: prize.id,
      prizeName: prize.name,
      prizeImageUrl: prize.imageUrl,
      prizeType: prize.type,
      pointValue: prize.pointValue,
      rankId: prize.rankId,
      rankName: rank?.name ?? "—",
      rankColor: rank?.color ?? "#9AA4B8",
      rankOrder: rank?.order ?? 99,
    };
  });

  // Point prizes are credited as one ledger row.
  let pointsGained = results.reduce((sum, r) => (r.prizeType === "point" ? sum + r.pointValue : sum), 0);
  if (pointsGained > 0) {
    changePoints(db, user, pointsGained, "gacha_prize", `${gacha.title} 当選ポイント`, drawId, at);
  }

  // Digital / physical prizes go to the prize box.
  for (const r of results) {
    if (r.prizeType === "point") continue;
    addUserPrize(db, {
      user,
      gacha,
      drawId,
      prizeId: r.prizeId,
      isLastOne: false,
      name: r.prizeName,
      imageUrl: r.prizeImageUrl,
      rankName: r.rankName,
      rankColor: r.rankColor,
      type: r.prizeType,
      pointValue: r.pointValue,
      at,
    });
  }

  // ラストワン賞: decided from the snapshot (exactly once while the lock is held).
  const tookLastSlot = remainingAfter === 0;
  let lastOne: DrawRecord["lastOne"] = null;
  if (tookLastSlot) {
    gacha.status = "soldout";
    if (gacha.lastOnePrize) {
      lastOne = { ...gacha.lastOnePrize };
      gacha.lastOneWinner = { userId: user.id, nickname: user.nickname, drawId, at };
      if (lastOne.type === "point") {
        if (lastOne.pointValue > 0) {
          changePoints(db, user, lastOne.pointValue, "lastone_prize", `${gacha.title} ラストワン賞`, drawId, at);
          pointsGained += lastOne.pointValue;
        }
      } else {
        const rank = lastOneRank(db);
        addUserPrize(db, {
          user,
          gacha,
          drawId,
          prizeId: null,
          isLastOne: true,
          name: lastOne.name,
          imageUrl: lastOne.imageUrl,
          rankName: rank?.name ?? "ラストワン賞",
          rankColor: rank?.color ?? "#FFB800",
          type: lastOne.type,
          pointValue: lastOne.pointValue,
          at,
        });
      }
    }
  }

  const record: DrawRecord = {
    id: drawId,
    requestId,
    userId: user.id,
    userNickname: user.nickname,
    gachaId: gacha.id,
    gachaTitle: gacha.title,
    count,
    ticketCost: gacha.ticketCost,
    ticketsSpent: cost,
    pointsGained,
    results,
    lastOne,
    remainingAfter,
    serverMs: 0,
    createdAt: at,
  };
  db.draws.push(record);
  db.drawRequests.set(requestKey, drawId);
  gacha.updatedAt = at;
  record.serverMs = Math.max(0.01, Math.round((performance.now() - startedAt) * 100) / 100);

  return {
    draw: record,
    replayed: false,
    balances: { tickets: user.tickets, points: user.points },
    remaining: remainingInfoOf(gacha),
  };
}

function emptyRemaining(gachaId: string): RemainingInfo {
  return { gachaId, totalSlots: 0, remainingSlots: 0, status: "soldout", lastOneWinner: null, fetchedAt: new Date().toISOString() };
}

function addUserPrize(
  db: Db,
  p: {
    user: User;
    gacha: Gacha;
    drawId: string;
    prizeId: string | null;
    isLastOne: boolean;
    name: string;
    imageUrl: string | null;
    rankName: string;
    rankColor: string;
    type: "digital" | "physical";
    pointValue: number;
    at: string;
  },
): UserPrize {
  const prize: UserPrize = {
    id: newId("up"),
    userId: p.user.id,
    gachaId: p.gacha.id,
    gachaTitle: p.gacha.title,
    drawId: p.drawId,
    prizeId: p.prizeId,
    isLastOne: p.isLastOne,
    name: p.name,
    imageUrl: p.imageUrl,
    rankName: p.rankName,
    rankColor: p.rankColor,
    type: p.type,
    pointValue: p.pointValue,
    status: "owned",
    digitalCode: p.type === "digital" ? generateGiftCode() : null,
    orderId: null,
    createdAt: p.at,
  };
  db.userPrizes.set(prize.id, prize);
  return prize;
}

// ---------------------------------------------------------------------------
// Remaining slots (fetched on page load and right after a draw — no polling)
// ---------------------------------------------------------------------------

/** Latest remaining-slot info. Throws a 404 ApiError for unknown ids. */
export function getRemainingInfo(gachaId: string): RemainingInfo {
  const gacha = getDb().gachas.get(gachaId);
  if (!gacha) throw gachaNotFound();
  return remainingInfoOf(gacha);
}

// ---------------------------------------------------------------------------
// Winners feed
// ---------------------------------------------------------------------------

/**
 * Recent big wins (B賞 and above, plus ラストワン賞), newest first — one entry per
 * draw (its best result). Skips load-test sandboxes and deleted gachas.
 */
export function recentBigWins(
  limit = 10,
  gachaId?: string,
): Array<{
  drawId: string;
  nickname: string;
  gachaId: string;
  gachaTitle: string;
  rankName: string;
  rankColor: string;
  rankOrder: number;
  prizeName: string;
  prizeImageUrl: string | null;
  at: string;
  isLastOne?: boolean;
}> {
  const db = getDb();
  const out: BigWinDto[] = [];
  const lastRank = lastOneRank(db);
  for (let i = db.draws.length - 1; i >= 0 && out.length < limit; i--) {
    const draw = db.draws[i];
    if (gachaId && draw.gachaId !== gachaId) continue;
    const gacha = db.gachas.get(draw.gachaId);
    if (!gacha || gacha.isSandbox) continue;
    if (draw.lastOne) {
      out.push({
        drawId: draw.id,
        nickname: draw.userNickname,
        gachaId: draw.gachaId,
        gachaTitle: draw.gachaTitle,
        rankName: lastRank?.name ?? "ラストワン賞",
        rankColor: lastRank?.color ?? "#FFB800",
        rankOrder: 0,
        prizeName: draw.lastOne.name,
        prizeImageUrl: draw.lastOne.imageUrl,
        at: draw.createdAt,
        isLastOne: true,
      });
      continue;
    }
    let best: DrawResultItem | null = null;
    for (const r of draw.results) {
      if (r.rankOrder > BIG_WIN_MAX_ORDER) continue;
      if (!best || r.rankOrder < best.rankOrder) best = r;
    }
    if (!best) continue;
    out.push({
      drawId: draw.id,
      nickname: draw.userNickname,
      gachaId: draw.gachaId,
      gachaTitle: draw.gachaTitle,
      rankName: best.rankName,
      rankColor: best.rankColor,
      rankOrder: best.rankOrder,
      prizeName: best.prizeName,
      prizeImageUrl: best.prizeImageUrl,
      at: draw.createdAt,
      isLastOne: false,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// DTO builders (shared with other modules)
// ---------------------------------------------------------------------------

export function toRankDto(rank: Rank): RankDto {
  return {
    id: rank.id,
    name: rank.name,
    subtitle: rank.subtitle,
    color: rank.color,
    order: rank.order,
    logoUrl: rank.logoUrl,
    effect: { ...rank.effect },
    isLastOne: rank.isLastOne,
  };
}

function toPrizeDtos(prizes: Prize[]): PrizeDto[] {
  const effective = effectivePpb(prizes);
  return prizes.map((p) => ({
    id: p.id,
    rankId: p.rankId,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    type: p.type,
    pointValue: p.pointValue,
    probabilityPpb: p.probabilityPpb,
    effectivePpb: effective.get(p) ?? 0,
    isFallback: p.isFallback,
    stock: p.stock,
    remainingStock: p.stock === null ? null : Math.max(0, p.stock - p.wonCount),
    soldOut: isSoldOutPrize(p),
    wonCount: p.wonCount,
  }));
}

export function toGachaCardDto(db: Db, gacha: Gacha, now = Date.now()): GachaCardDto {
  const ended = isEnded(gacha, now);
  const prizes = prizesOfGacha(db, gacha.id);
  const top = (gacha.status !== "soldout" && prizes.find((p) => !isSoldOutPrize(p))) || prizes[0];
  const topRank = top ? db.ranks.get(top.rankId) : undefined;
  return {
    id: gacha.id,
    title: gacha.title,
    subtitle: gacha.subtitle,
    thumbnailUrl: gacha.thumbnailUrl,
    badge: gacha.badge,
    featured: gacha.featured,
    status: gacha.status,
    ticketCost: gacha.ticketCost,
    totalSlots: gacha.totalSlots,
    remainingSlots: gacha.remainingSlots,
    endsAt: gacha.endsAt,
    ended,
    nearLastOne: !ended && isNearLastOne(gacha),
    available: gacha.status === "active" && !ended && gacha.remainingSlots > 0,
    sortOrder: gacha.sortOrder,
    lastOnePrize: gacha.lastOnePrize ? { ...gacha.lastOnePrize } : null,
    lastOneWinner: gacha.lastOneWinner ? { nickname: gacha.lastOneWinner.nickname, at: gacha.lastOneWinner.at } : null,
    topPrize: top
      ? { name: top.name, imageUrl: top.imageUrl, rankName: topRank?.name ?? "", rankColor: topRank?.color ?? "#9AA4B8" }
      : null,
  };
}

/** Display order: on sale first (by sortOrder), then paused / ended, sold out last. */
function displayRank(card: GachaCardDto): number {
  if (card.available) return 0;
  if (card.status === "soldout") return 2;
  return 1;
}

/**
 * Gachas shown to members: no load-test sandboxes, no drafts.
 * Pass `includeDrafts` for admin previews.
 */
export function listGachaCards(options: { includeDrafts?: boolean } = {}): GachaCardDto[] {
  const db = getDb();
  const now = Date.now();
  return visibleGachas(db)
    .filter((g) => options.includeDrafts || g.status !== "draft")
    .map((g) => toGachaCardDto(db, g, now))
    .sort((a, b) => displayRank(a) - displayRank(b) || a.sortOrder - b.sortOrder);
}

/**
 * Gacha detail for the user page / API. Returns null for unknown ids, load-test
 * sandboxes and drafts (drafts are visible to admins when `allowDraft` is set).
 */
export function getGachaDetail(gachaId: string, options: { allowDraft?: boolean } = {}): GachaDetailDto | null {
  const db = getDb();
  const gacha = db.gachas.get(gachaId);
  if (!gacha || gacha.isSandbox) return null;
  if (gacha.status === "draft" && !options.allowDraft) return null;

  const prizes = prizesOfGacha(db, gacha.id);
  const prizeDtos = toPrizeDtos(prizes);
  const ranks = sortedRanks(db).map(toRankDto);
  const groups: PrizeGroupDto[] = [];
  for (const rank of ranks) {
    const inRank = prizeDtos.filter((p) => p.rankId === rank.id);
    if (inRank.length > 0) groups.push({ rank, prizes: inRank });
  }
  // Prizes whose rank was removed (defensive): show them under a neutral group.
  const orphans = prizeDtos.filter((p) => !ranks.some((r) => r.id === p.rankId));
  if (orphans.length > 0) {
    groups.push({
      rank: {
        id: "_other",
        name: "その他",
        subtitle: "",
        color: "#9AA4B8",
        order: 99,
        logoUrl: null,
        effect: { type: "builtin", url: null, builtinStyle: "basic" },
        isLastOne: false,
      },
      prizes: orphans,
    });
  }
  const expected = prizeDtos.reduce(
    (sum, p) => (p.type === "point" ? sum + (p.pointValue * p.effectivePpb) / 1_000_000_000 : sum),
    0,
  );
  const lastRank = ranks.find((r) => r.isLastOne) ?? null;

  return {
    ...toGachaCardDto(db, gacha),
    description: gacha.description,
    prizeGroups: groups,
    ranks,
    lastOneRank: lastRank,
    expectedPointsPerDraw: Math.round(expected * 10) / 10,
  };
}

/** Is this id a gacha members may see (exists, not a sandbox)? */
export function isPublicGachaId(gachaId: string): boolean {
  const gacha = getDb().gachas.get(gachaId);
  return !!gacha && !gacha.isSandbox;
}

export function toGachaViewerDto(user: User | null): GachaViewerDto | null {
  if (!user) return null;
  return { id: user.id, nickname: user.nickname, tickets: user.tickets, points: user.points, isAdmin: user.role === "admin" };
}
