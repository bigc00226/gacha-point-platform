/**
 * Plain, serializable DTOs for the ポイ活 screens (built by
 * `@/lib/server/services/rewards*` and passed to client components).
 * Client-safe: type-only, no server imports.
 */
import type { Balances } from "@/lib/api-types";
import type {
  LedgerReason,
  OfferCategory,
  OfferProvider,
  PostbackKind,
  PostbackStatus,
  VerificationStep,
} from "@/lib/types";

/** Today's login-bonus state of a user (JST day). */
export interface LoginBonusStatusDto {
  claimedToday: boolean;
  /** Current streak: includes today when claimed, 0 when the streak is broken. */
  streak: number;
  /** Streak that the next claim makes (today's claim, or tomorrow's when already claimed). */
  nextStreak: number;
  /** Tickets granted per claim (admin setting). */
  tickets: number;
  totalClaims: number;
  /** JST "YYYY-MM-DD" of today. */
  todayKey: string;
  /** Next AM 0:00 JST (ISO). */
  nextResetAt: string;
}

/** GET /api/rewards/video */
export interface VideoStatusDto {
  todayCount: number;
  dailyLimit: number;
  remaining: number;
  ticketsPerView: number;
  /** Next AM 0:00 JST (ISO) — the daily count resets lazily by JST date key. */
  nextResetAt: string;
}

/** POST /api/rewards/video/start */
export interface AdSessionStartDto {
  session: { id: string; createdAt: string; expiresAt: string };
  video: VideoStatusDto;
  ad: {
    /** Length of the (mock) rewarded ad in seconds. */
    durationSec: number;
    /** The ad network only reports completion after at least this long (×5 demo fast-forward). */
    minWatchSec: number;
    network: "admob";
  };
}

/** An offerwall offer as shown to (a possibly signed-out) user. */
export interface OfferDto {
  id: string;
  provider: OfferProvider;
  providerLabel: string;
  title: string;
  description: string;
  category: OfferCategory;
  categoryLabel: string;
  conditions: string;
  iconUrl: string | null;
  estimatedTime: string;
  repeatable: boolean;
  /** Category setting before the campaign multiplier. */
  baseTickets: number;
  /** round(baseTickets × multiplier) — what the user receives. */
  tickets: number;
  multiplier: number;
  /** Non-repeatable: ever completed. Repeatable: completed today (JST). */
  completed: boolean;
  completedAt: string | null;
}

export interface TodayEarningsDto {
  login: number;
  video: number;
  offer: number;
  total: number;
}

export interface RewardHistoryItemDto {
  id: string;
  reason: LedgerReason;
  description: string;
  amount: number;
  createdAt: string;
}

/** Everything the /earn page renders. */
export interface EarnPageDto {
  /** Server clock (ISO) — used for hydration-safe countdowns. */
  serverNow: string;
  nextResetAt: string;
  settings: {
    loginBonusTickets: number;
    signupBonusTickets: number;
    videoTicketsPerView: number;
    videoDailyLimit: number;
    offerMultiplier: number;
  };
  /** null when signed out. */
  viewer: {
    id: string;
    nickname: string;
    balances: Balances;
    loginBonus: LoginBonusStatusDto;
    video: VideoStatusDto;
    today: TodayEarningsDto;
    recent: RewardHistoryItemDto[];
  } | null;
  offers: OfferDto[];
}

/** Result of one server-side verification run (the postback log, user-facing view). */
export interface VerificationResultDto {
  postbackId: string;
  kind: PostbackKind;
  provider: string;
  status: PostbackStatus;
  httpStatus: number;
  granted: boolean;
  ticketsGranted: number;
  message: string;
  steps: VerificationStep[];
  transactionId: string | null;
  receivedAt: string;
  /** The server-to-server notification exactly as the provider sent it. */
  callback: {
    method: "GET" | "POST";
    /** Path + query string, e.g. "/api/webhooks/admob-ssv?ad_network=...&signature=...". */
    url: string;
    params: Record<string, string>;
  };
  /** true when this result was already recorded (e.g. a retried completion). */
  replayed: boolean;
}

/** POST /api/demo/ad-network/complete */
export interface AdCompleteDto {
  result: VerificationResultDto;
  balances: Balances;
  video: VideoStatusDto;
}

/** POST /api/demo/offerwall/complete */
export interface OfferCompleteDto {
  result: VerificationResultDto;
  balances: Balances;
  offer: OfferDto;
}

/** POST /api/rewards/login-bonus */
export interface LoginBonusClaimDto {
  tickets: number;
  streak: number;
  balances: Balances;
  loginBonus: LoginBonusStatusDto;
}
