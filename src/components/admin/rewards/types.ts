/**
 * Plain, serializable DTOs for the ポイ活 admin screens (built by
 * `@/lib/server/services/rewards-admin` and passed to client components).
 * Client-safe: type-only, no server imports.
 */
import type {
  AuditLog,
  OfferCategory,
  OfferProvider,
  PostbackKind,
  PostbackLog,
  PostbackStatus,
  RewardSettings,
} from "@/lib/types";

/** Editable part of RewardSettings (PUT /api/admin/rewards/settings body). */
export type RewardSettingsInput = Omit<RewardSettings, "updatedAt" | "updatedBy">;

export interface RewardGrantStatsDto {
  /** Today's (JST) grants by source: number of ledger rows and tickets. */
  login: { count: number; tickets: number };
  video: { count: number; tickets: number };
  offer: { count: number; tickets: number };
  signup: { count: number; tickets: number };
}

/** GET /api/admin/rewards/settings */
export interface RewardSettingsPageDto {
  settings: RewardSettings;
  history: AuditLog[];
  today: RewardGrantStatsDto;
}

/** PUT /api/admin/rewards/settings */
export interface RewardSettingsSaveDto {
  settings: RewardSettings;
  changed: boolean;
  /** Human readable diff, e.g. "動画1回あたりの付与枚数 3枚 → 5枚". */
  changes: string[];
  history: AuditLog[];
}

export interface AdminOfferDto {
  id: string;
  provider: OfferProvider;
  title: string;
  description: string;
  category: OfferCategory;
  conditions: string;
  iconUrl: string | null;
  estimatedTime: string;
  active: boolean;
  repeatable: boolean;
  sortOrder: number;
  createdAt: string;
  /** round(category tickets × multiplier) with the current settings. */
  tickets: number;
  completions: { total: number; today: number; ticketsTotal: number };
}

/** GET /api/admin/offers */
export interface AdminOffersDto {
  offers: AdminOfferDto[];
  multiplier: number;
  categoryTickets: Record<OfferCategory, number>;
}

/** Body of POST /api/admin/offers and PUT /api/admin/offers/[id] (PUT accepts any subset). */
export interface OfferInput {
  title: string;
  description: string;
  category: OfferCategory;
  conditions: string;
  provider: OfferProvider;
  estimatedTime: string;
  repeatable: boolean;
  active: boolean;
  iconUrl: string | null;
  sortOrder?: number;
}

/** A postback log row as shown in the admin. */
export interface PostbackLogDto extends PostbackLog {
  /** Nickname of `userId` when that member exists. */
  userNickname: string | null;
}

export interface PostbackKpisDto {
  todayReceived: number;
  todayGranted: number;
  todayTickets: number;
  todayRejected: number;
  todayDuplicates: number;
  /** Rejections by status (today). */
  todayByStatus: Partial<Record<PostbackStatus, number>>;
  total: number;
}

export interface PostbackFilterDto {
  kind: PostbackKind | "";
  status: PostbackStatus | "";
  provider: string;
  source: PostbackLog["source"] | "";
  q: string;
}

/** GET /api/admin/postbacks */
export interface PostbackListDto {
  rows: PostbackLogDto[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  filter: PostbackFilterDto;
  kpis: PostbackKpisDto;
}

export type PostbackTestKind = "video" | "offer";
export type PostbackTestScenario = "valid" | "bad_signature" | "expired" | "duplicate" | "limit";

/** POST /api/admin/postbacks/test */
export interface PostbackTestInput {
  kind: PostbackTestKind;
  scenario: PostbackTestScenario;
  userId?: string;
  offerId?: string;
}

export interface PostbackTestResultDto {
  kind: PostbackTestKind;
  scenario: PostbackTestScenario;
  request: {
    method: "GET";
    /** Absolute URL that was called. */
    url: string;
    params: Record<string, string>;
  };
  response: { httpStatus: number; body: unknown };
  /** How the request reached the webhook: a real HTTP request to the endpoint, or an in-process fallback. */
  transport: "http" | "in-process";
  log: PostbackLogDto | null;
  /** What the test did, in Japanese (e.g. "署名後に reward_amount を 3 → 100 に書き換えました"). */
  notes: string[];
  /** Notifications sent before the main one (e.g. to use up today's limit). */
  warmup: Array<{ status: PostbackStatus; httpStatus: number; tickets: number }>;
}

/** Data for the test tool's selects. */
export interface PostbackTestOptionsDto {
  users: Array<{ id: string; label: string; videoToday: number; tickets: number }>;
  offers: Array<{ id: string; title: string; provider: OfferProvider; repeatable: boolean; active: boolean }>;
  videoDailyLimit: number;
}

export interface WebhookEndpointDto {
  key: string;
  label: string;
  provider: string;
  method: string;
  url: string;
  note: string;
}
