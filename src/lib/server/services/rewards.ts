import "server-only";
import type { Balances } from "@/lib/api-types";
import type { AdSession, LedgerReason, Offer, OfferCategory, RewardSettings, User } from "@/lib/types";
import { OFFER_CATEGORY_LABELS, OFFER_PROVIDER_LABELS } from "@/lib/constants";
import { addDaysToKey, jstDateKey, nextJstMidnight, startOfJstDay } from "@/lib/time";
import type {
  AdSessionStartDto,
  EarnPageDto,
  LoginBonusClaimDto,
  LoginBonusStatusDto,
  OfferDto,
  RewardHistoryItemDto,
  TodayEarningsDto,
  VideoStatusDto,
} from "@/components/earn/types";
import { ApiError } from "../http";
import { newId } from "../ids";
import { changeTickets } from "../ledger";
import { lockKeys, withLocks } from "../lock";
import { getDb, type Db } from "../store";

/**
 * ポイ活 service (user side): login bonus, rewarded-video sessions, offerwall
 * listing and the data of the /earn page.
 *
 * Tickets for videos and offers are NEVER granted here: the browser can only
 * open an ad session. Tickets are granted exclusively by the webhook pipeline
 * (`rewards-webhook.ts`) after the provider's signed server-to-server
 * notification has been verified.
 *
 * Daily limits are evaluated lazily against the JST date key (no cron job):
 *   production: users.video_views_date / video_views_count, reset when the date differs.
 */

/** Length of the mock rewarded ad. */
export const AD_DURATION_SEC = 15;
/** Fastest legitimate completion (the demo's ×5 fast-forward): the mock ad network refuses earlier reports. */
export const AD_MIN_WATCH_MS = 3_000;
/** An SSV callback must reference a session opened within this window. */
export const AD_SESSION_TTL_MS = 30 * 60_000;
/** Open (unfinished) ad sessions allowed per user within the TTL — a cheap abuse guard. */
const MAX_OPEN_AD_SESSIONS = 10;
const MAX_AD_SESSIONS = 5_000;

const REWARD_REASONS: ReadonlySet<LedgerReason> = new Set(["login_bonus", "video_reward", "offer_reward", "signup_bonus"]);

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function balancesOf(user: Pick<User, "tickets" | "points">): Balances {
  return { tickets: user.tickets, points: user.points };
}

/** Tickets for completing an offer of `category`: round(category setting × campaign multiplier). */
export function offerTicketsFor(settings: RewardSettings, category: OfferCategory): number {
  return Math.max(0, Math.round((settings.offerCategoryTickets[category] ?? 0) * settings.offerMultiplier));
}

/** Active member or a 401/403 ApiError (re-checked inside locks). */
function activeUser(db: Db, userId: string): User {
  const user = db.users.get(userId);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "ログインが必要です。ログインしてから再度お試しください。");
  if (user.status !== "active") throw new ApiError(403, "SUSPENDED", "このアカウントは利用停止中です");
  return user;
}

/**
 * Whether `userId` has already completed `offer`:
 * non-repeatable → ever (1人1回), repeatable → today in JST (1日1回).
 */
export function offerCompletionState(
  db: Db,
  userId: string,
  offer: Pick<Offer, "id" | "repeatable">,
  now = Date.now(),
): { completed: boolean; completedAt: string | null } {
  const today = jstDateKey(now);
  for (let i = db.offerCompletions.length - 1; i >= 0; i--) {
    const c = db.offerCompletions[i];
    if (c.userId !== userId || c.offerId !== offer.id) continue;
    if (!offer.repeatable || jstDateKey(c.createdAt) === today) return { completed: true, completedAt: c.createdAt };
  }
  return { completed: false, completedAt: null };
}

// ---------------------------------------------------------------------------
// Login bonus
// ---------------------------------------------------------------------------

export function getLoginBonusStatus(user: User, now = Date.now()): LoginBonusStatusDto {
  const db = getDb();
  const today = jstDateKey(now);
  const { lastClaimDate, streak, totalClaims } = user.loginBonus;
  const claimedToday = lastClaimDate === today;
  const continuing = lastClaimDate === addDaysToKey(today, -1);
  return {
    claimedToday,
    streak: claimedToday || continuing ? streak : 0,
    nextStreak: claimedToday || continuing ? streak + 1 : 1,
    tickets: db.rewardSettings.loginBonusTickets,
    totalClaims,
    todayKey: today,
    nextResetAt: nextJstMidnight(now).toISOString(),
  };
}

/** POST /api/rewards/login-bonus — once per JST day; the streak continues when yesterday was claimed. */
export async function claimLoginBonus(userId: string): Promise<LoginBonusClaimDto> {
  return withLocks([lockKeys.user(userId)], () => {
    const db = getDb();
    const user = activeUser(db, userId);
    const now = Date.now();
    const today = jstDateKey(now);
    if (user.loginBonus.lastClaimDate === today) {
      throw new ApiError(409, "ALREADY_CLAIMED", "本日のログインボーナスは受け取り済みです。明日またお越しください。", {
        nextResetAt: nextJstMidnight(now).toISOString(),
      });
    }
    const streak = user.loginBonus.lastClaimDate === addDaysToKey(today, -1) ? user.loginBonus.streak + 1 : 1;
    const tickets = db.rewardSettings.loginBonusTickets;
    user.loginBonus = { lastClaimDate: today, streak, totalClaims: user.loginBonus.totalClaims + 1 };
    if (tickets > 0) changeTickets(db, user, tickets, "login_bonus", `ログインボーナス（${streak}日連続）`);
    return { tickets, streak, balances: balancesOf(user), loginBonus: getLoginBonusStatus(user, now) };
  });
}

// ---------------------------------------------------------------------------
// Rewarded video
// ---------------------------------------------------------------------------

export function getVideoStatus(user: User, now = Date.now()): VideoStatusDto {
  const settings = getDb().rewardSettings;
  const today = jstDateKey(now);
  const todayCount = user.videoViews.date === today ? user.videoViews.count : 0;
  return {
    todayCount,
    dailyLimit: settings.videoDailyLimit,
    remaining: Math.max(0, settings.videoDailyLimit - todayCount),
    ticketsPerView: settings.videoTicketsPerView,
    nextResetAt: nextJstMidnight(now).toISOString(),
  };
}

function pruneAdSessions(db: Db) {
  if (db.adSessions.size <= MAX_AD_SESSIONS) return;
  // Maps iterate in insertion order: drop the oldest sessions first.
  for (const id of db.adSessions.keys()) {
    if (db.adSessions.size <= MAX_AD_SESSIONS * 0.9) break;
    db.adSessions.delete(id);
  }
}

/**
 * POST /api/rewards/video/start — the server issues an ad session before the ad plays.
 * The ad network's SSV callback must reference it (custom_data), so a callback can't
 * be produced without an ad actually being served to this user.
 */
export async function startAdSession(userId: string): Promise<AdSessionStartDto> {
  return withLocks([lockKeys.user(userId)], () => {
    const db = getDb();
    const user = activeUser(db, userId);
    const now = Date.now();
    const video = getVideoStatus(user, now);
    if (video.remaining <= 0) {
      throw new ApiError(409, "LIMIT_REACHED", "本日の動画視聴は上限に達しました。毎日0:00（日本時間）にリセットされます。", { video });
    }
    let open = 0;
    for (const s of db.adSessions.values()) {
      if (s.userId === userId && s.status === "started" && now - Date.parse(s.createdAt) < AD_SESSION_TTL_MS) open++;
    }
    if (open >= MAX_OPEN_AD_SESSIONS) {
      throw new ApiError(429, "RATE_LIMITED", "広告の読み込みが続けて行われました。しばらく時間をおいてからお試しください。");
    }
    const session: AdSession = {
      id: newId("as"),
      userId,
      network: "admob",
      status: "started",
      createdAt: new Date(now).toISOString(),
      completedAt: null,
      transactionId: null,
      tickets: 0,
    };
    db.adSessions.set(session.id, session);
    pruneAdSessions(db);
    return {
      session: { id: session.id, createdAt: session.createdAt, expiresAt: new Date(now + AD_SESSION_TTL_MS).toISOString() },
      video,
      ad: { durationSec: AD_DURATION_SEC, minWatchSec: AD_MIN_WATCH_MS / 1000, network: "admob" },
    };
  });
}

// ---------------------------------------------------------------------------
// Offerwall (user side)
// ---------------------------------------------------------------------------

export function toOfferDto(db: Db, offer: Offer, userId: string | null, now = Date.now()): OfferDto {
  const settings = db.rewardSettings;
  const state = userId ? offerCompletionState(db, userId, offer, now) : { completed: false, completedAt: null };
  return {
    id: offer.id,
    provider: offer.provider,
    providerLabel: OFFER_PROVIDER_LABELS[offer.provider] ?? offer.provider,
    title: offer.title,
    description: offer.description,
    category: offer.category,
    categoryLabel: OFFER_CATEGORY_LABELS[offer.category] ?? offer.category,
    conditions: offer.conditions,
    iconUrl: offer.iconUrl,
    estimatedTime: offer.estimatedTime,
    repeatable: offer.repeatable,
    baseTickets: settings.offerCategoryTickets[offer.category] ?? 0,
    tickets: offerTicketsFor(settings, offer.category),
    multiplier: settings.offerMultiplier,
    completed: state.completed,
    completedAt: state.completedAt,
  };
}

/** Active offers by sortOrder (completed ones are kept, the UI marks them 達成済み). */
export function listOffersForUser(userId: string | null, now = Date.now()): OfferDto[] {
  const db = getDb();
  return [...db.offers.values()]
    .filter((o) => o.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    .map((offer) => toOfferDto(db, offer, userId, now));
}

// ---------------------------------------------------------------------------
// /earn page
// ---------------------------------------------------------------------------

/** Tickets earned today (JST) from login bonus / videos / offers, read from the ledger. */
export function todayEarnings(userId: string, now = Date.now()): TodayEarningsDto {
  const start = startOfJstDay(now).toISOString();
  // Ledger rows are appended in time order; allow a little slack for rows written with explicit timestamps.
  const stopBefore = new Date(Date.parse(start) - 60 * 60_000).toISOString();
  const out: TodayEarningsDto = { login: 0, video: 0, offer: 0, total: 0 };
  const ledger = getDb().ledger;
  for (let i = ledger.length - 1; i >= 0; i--) {
    const e = ledger[i];
    if (e.createdAt < stopBefore) break;
    if (e.userId !== userId || e.currency !== "ticket" || e.createdAt < start) continue;
    if (e.reason === "login_bonus") out.login += e.amount;
    else if (e.reason === "video_reward") out.video += e.amount;
    else if (e.reason === "offer_reward") out.offer += e.amount;
  }
  out.total = out.login + out.video + out.offer;
  return out;
}

/** Latest ticket rewards (login bonus, videos, offers, signup) of a user, newest first. */
export function recentRewards(userId: string, limit = 6): RewardHistoryItemDto[] {
  const out: RewardHistoryItemDto[] = [];
  const ledger = getDb().ledger;
  for (let i = ledger.length - 1; i >= 0 && out.length < limit; i--) {
    const e = ledger[i];
    if (e.userId !== userId || e.currency !== "ticket" || !REWARD_REASONS.has(e.reason)) continue;
    out.push({ id: e.id, reason: e.reason, description: e.description, amount: e.amount, createdAt: e.createdAt });
  }
  return out;
}

export function buildEarnPageData(user: User | null): EarnPageDto {
  const db = getDb();
  const now = Date.now();
  const s = db.rewardSettings;
  return {
    serverNow: new Date(now).toISOString(),
    nextResetAt: nextJstMidnight(now).toISOString(),
    settings: {
      loginBonusTickets: s.loginBonusTickets,
      signupBonusTickets: s.signupBonusTickets,
      videoTicketsPerView: s.videoTicketsPerView,
      videoDailyLimit: s.videoDailyLimit,
      offerMultiplier: s.offerMultiplier,
    },
    viewer: user
      ? {
          id: user.id,
          nickname: user.nickname,
          balances: balancesOf(user),
          loginBonus: getLoginBonusStatus(user, now),
          video: getVideoStatus(user, now),
          today: todayEarnings(user.id, now),
          recent: recentRewards(user.id),
        }
      : null,
    offers: listOffersForUser(user?.id ?? null, now),
  };
}
