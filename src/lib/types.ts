/**
 * Domain model for the POIGACHA demo.
 *
 * The demo keeps everything in server memory (see lib/server/store.ts), but the
 * shapes below are designed to map 1:1 onto relational tables in production.
 * These types are shared by server code and client components.
 */

export type ID = string;
/** ISO-8601 timestamp string (UTC), e.g. "2026-10-13T06:53:00.000Z". */
export type ISODateString = string;
/** Calendar date in Japan time, "YYYY-MM-DD". Used for daily resets (AM 0:00 JST). */
export type JstDateKey = string;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended";

export interface ShippingAddress {
  fullName: string;
  postalCode: string; // "123-4567"
  prefecture: string; // one of PREFECTURES
  city: string;
  addressLine: string;
  building: string;
  phone: string;
}

export interface User {
  id: ID;
  email: string;
  /** "scrypt$<salt>$<hash>" — never sent to the client. */
  passwordHash: string;
  nickname: string;
  role: UserRole;
  status: UserStatus;
  /** ガチャチケット balance (spent on draws). */
  tickets: number;
  /** ポイント balance (won from gacha / coupons, spent on exchange). */
  points: number;
  loginBonus: {
    lastClaimDate: JstDateKey | null;
    streak: number;
    totalClaims: number;
  };
  /** Rewarded-video views for the JST day in `date`; a different date means 0 (lazy daily reset). */
  videoViews: { date: JstDateKey; count: number };
  /** Last shipping address used, to prefill forms. */
  lastAddress: ShippingAddress | null;
  /** Virtual users created by the admin load test; hidden from normal lists. */
  isVirtual?: boolean;
  createdAt: ISODateString;
  lastLoginAt: ISODateString | null;
}

/** User shape that is safe to send to the browser. */
export interface PublicUser {
  id: ID;
  email: string;
  nickname: string;
  role: UserRole;
  status: UserStatus;
  tickets: number;
  points: number;
  createdAt: ISODateString;
  lastLoginAt: ISODateString | null;
}

// ---------------------------------------------------------------------------
// Ranks (特賞 / A賞 / ... / ラストワン賞) and their effects
// ---------------------------------------------------------------------------

/** Built-in CSS/canvas effect used when no video/Lottie file is assigned. */
export type BuiltinEffectStyle =
  | "rainbow" // 特賞-class: rainbow flash + confetti
  | "gold"
  | "red"
  | "purple"
  | "blue"
  | "basic" // small sparkle
  | "lastone"; // black & gold spotlight

export type EffectType = "builtin" | "video" | "lottie";

export interface RankEffect {
  type: EffectType;
  /** URL of the MP4/WebM (type "video") or Lottie JSON (type "lottie"); null for builtin. */
  url: string | null;
  /** Always set: used for type "builtin" and as the fallback if the file fails to load. */
  builtinStyle: BuiltinEffectStyle;
}

export interface Rank {
  id: ID;
  /** Display name, e.g. "特賞", "A賞". */
  name: string;
  /** Secondary label, e.g. "大当たり". */
  subtitle: string;
  /** Hex color used for badges, card borders and glows. */
  color: string;
  /** 1 = highest rank. Results are sorted and the climax effect is chosen by this. */
  order: number;
  /** Logo image shown at the reveal (uploaded by the operator). */
  logoUrl: string | null;
  effect: RankEffect;
  /** Exactly one rank is the special ラストワン賞 rank. */
  isLastOne: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Gacha
// ---------------------------------------------------------------------------

export type GachaStatus = "draft" | "active" | "paused" | "soldout";

/**
 * point    — credited to the user's point balance immediately.
 * digital  — goes to the prize box with a (dummy) gift code.
 * physical — goes to the prize box; the user requests shipping with an address.
 */
export type PrizeType = "point" | "digital" | "physical";

export interface Prize {
  id: ID;
  gachaId: ID;
  rankId: ID;
  name: string;
  description: string;
  imageUrl: string | null;
  type: PrizeType;
  /** "point": amount credited. Others: reference value in points (display only). */
  pointValue: number;
  /** Win probability in parts per billion (1/100 = 10,000,000). Ignored when isFallback. */
  probabilityPpb: number;
  /** What the operator typed, e.g. "1/100" or "0.5%". */
  probabilityInput: string;
  /** Exactly one prize per gacha receives the remaining probability (and must be unlimited). */
  isFallback: boolean;
  /** Max number of times this prize can be won; null = unlimited. */
  stock: number | null;
  wonCount: number;
  sortOrder: number;
}

export interface LastOnePrize {
  name: string;
  description: string;
  imageUrl: string | null;
  type: PrizeType;
  pointValue: number;
}

export interface LastOneWinner {
  userId: ID;
  nickname: string;
  drawId: ID;
  at: ISODateString;
}

export interface Gacha {
  id: ID;
  title: string;
  subtitle: string;
  description: string;
  thumbnailUrl: string | null;
  /** Tickets consumed per single draw. */
  ticketCost: number;
  /** 総口数 */
  totalSlots: number;
  /** 残り口数 — decremented atomically under the gacha lock. */
  remainingSlots: number;
  status: GachaStatus;
  /** Ribbon text such as "PICK UP", "期間限定", "DEMO". */
  badge: string | null;
  featured: boolean;
  sortOrder: number;
  lastOnePrize: LastOnePrize | null;
  lastOneWinner: LastOneWinner | null;
  endsAt: ISODateString | null;
  /** Load-test sandbox gacha; hidden from normal lists. */
  isSandbox?: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Draws
// ---------------------------------------------------------------------------

export interface DrawResultItem {
  /** 1-based position within the request. */
  index: number;
  /** Absolute slot number in the gacha, e.g. the 12,570th 口. */
  slotNumber: number;
  prizeId: ID;
  prizeName: string;
  prizeImageUrl: string | null;
  prizeType: PrizeType;
  pointValue: number;
  rankId: ID;
  rankName: string;
  rankColor: string;
  rankOrder: number;
}

export interface DrawRecord {
  id: ID;
  /** Client-generated idempotency key; replays return this record without charging again. */
  requestId: string;
  userId: ID;
  userNickname: string;
  gachaId: ID;
  gachaTitle: string;
  count: number;
  ticketCost: number;
  ticketsSpent: number;
  /** Sum of point prizes (incl. a point last-one prize). */
  pointsGained: number;
  results: DrawResultItem[];
  /** Set when this request drew the final slot. */
  lastOne: LastOnePrize | null;
  remainingAfter: number;
  /** Server-side processing time of the transaction in ms. */
  serverMs: number;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Prize box (won digital / physical prizes)
// ---------------------------------------------------------------------------

/**
 * digital : owned (code shown)
 * physical: owned → shipping_requested → shipped
 */
export type UserPrizeStatus = "owned" | "shipping_requested" | "shipped";

export interface UserPrize {
  id: ID;
  userId: ID;
  gachaId: ID;
  gachaTitle: string;
  drawId: ID;
  /** null for a last-one prize. */
  prizeId: ID | null;
  isLastOne: boolean;
  name: string;
  imageUrl: string | null;
  rankName: string;
  rankColor: string;
  type: "digital" | "physical";
  pointValue: number;
  status: UserPrizeStatus;
  /** Dummy gift code for digital prizes. */
  digitalCode: string | null;
  orderId: ID | null;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Ledger (every balance change is recorded)
// ---------------------------------------------------------------------------

export type Currency = "ticket" | "point";

export type LedgerReason =
  | "signup_bonus"
  | "login_bonus"
  | "video_reward"
  | "offer_reward"
  | "gacha_draw"
  | "gacha_prize"
  | "lastone_prize"
  | "coupon"
  | "exchange"
  | "exchange_refund"
  | "admin_adjust"
  | "demo_grant";

export interface LedgerEntry {
  id: ID;
  userId: ID;
  currency: Currency;
  /** Positive = credit, negative = debit. */
  amount: number;
  balanceAfter: number;
  reason: LedgerReason;
  description: string;
  /** Related record id (draw id, order id, coupon id, postback id ...). */
  refId: string | null;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// ポイ活: rewards, offerwall, rewarded video, postbacks
// ---------------------------------------------------------------------------

export type OfferCategory = "app" | "game" | "survey" | "signup" | "shopping" | "card";

export interface RewardSettings {
  /** Tickets granted per completed rewarded video. */
  videoTicketsPerView: number;
  /** Max rewarded videos per user per JST day (resets at AM 0:00). */
  videoDailyLimit: number;
  loginBonusTickets: number;
  signupBonusTickets: number;
  /** Campaign multiplier applied to offerwall rewards (1 = normal, 2 = double). */
  offerMultiplier: number;
  /** Tickets per completed offer, by category (e.g. app install = 50). */
  offerCategoryTickets: Record<OfferCategory, number>;
  updatedAt: ISODateString;
  updatedBy: string | null;
}

export type OfferProvider = "skyflag" | "tapjoy";

export interface Offer {
  id: ID;
  provider: OfferProvider;
  title: string;
  description: string;
  category: OfferCategory;
  /** Achievement condition shown to the user, e.g. "インストール後レベル10到達". */
  conditions: string;
  iconUrl: string | null;
  /** e.g. "約5分" */
  estimatedTime: string;
  active: boolean;
  /** Repeatable offers (e.g. daily surveys) can be completed more than once. */
  repeatable: boolean;
  sortOrder: number;
  createdAt: ISODateString;
}

export interface OfferCompletion {
  id: ID;
  userId: ID;
  offerId: ID;
  provider: OfferProvider;
  transactionId: string;
  tickets: number;
  createdAt: ISODateString;
}

export type AdSessionStatus = "started" | "rewarded" | "rejected";

/** Issued by the server before an ad plays; the SSV callback must reference it. */
export interface AdSession {
  id: ID;
  userId: ID;
  network: "admob";
  status: AdSessionStatus;
  createdAt: ISODateString;
  completedAt: ISODateString | null;
  transactionId: string | null;
  tickets: number;
}

export type PostbackKind = "video" | "offer";

export type PostbackStatus =
  | "granted"
  | "duplicate"
  | "invalid_signature"
  | "expired"
  | "limit_reached"
  | "unknown_user"
  | "invalid_session"
  | "invalid_request";

export interface VerificationStep {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface PostbackLog {
  id: ID;
  kind: PostbackKind;
  /** "admob" | "skyflag" | "tapjoy" */
  provider: string;
  method: "GET" | "POST";
  receivedAt: ISODateString;
  userId: ID | null;
  transactionId: string | null;
  params: Record<string, string>;
  status: PostbackStatus;
  httpStatus: number;
  ticketsGranted: number;
  steps: VerificationStep[];
  message: string;
  /** Who sent it: the in-app simulator, an external caller, or the admin test tool. */
  source: "simulator" | "external" | "admin_test";
}

// ---------------------------------------------------------------------------
// Coupons (ポイント付与コード)
// ---------------------------------------------------------------------------

/** single = 使い捨て型 (one use), shared = 先着限定型 (common keyword, N uses). */
export type CouponType = "single" | "shared";

export interface Coupon {
  id: ID;
  type: CouponType;
  /** Normalized code used for lookup (see normalizeCouponCode). */
  code: string;
  /** Code as issued / typed by the admin. */
  displayCode: string;
  points: number;
  /** single: 1. shared: the 先着 limit. */
  maxUses: number;
  usedCount: number;
  active: boolean;
  expiresAt: ISODateString | null;
  /** Admin memo, e.g. "公式X 10月キャンペーン". */
  label: string;
  /** Codes generated together share a batch id. */
  batchId: string | null;
  createdAt: ISODateString;
  createdBy: string;
}

export interface CouponRedemption {
  id: ID;
  couponId: ID;
  code: string;
  userId: ID;
  userNickname: string;
  points: number;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Point exchange & shipping orders
// ---------------------------------------------------------------------------

export interface ExchangeItem {
  id: ID;
  name: string;
  description: string;
  imageUrl: string | null;
  pointsRequired: number;
  stock: number;
  type: "physical" | "digital";
  active: boolean;
  sortOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export type OrderSource = "exchange" | "gacha_prize";
/** pending = 未発送, shipped = 発送済, cancelled = キャンセル (points refunded). */
export type OrderStatus = "pending" | "shipped" | "cancelled";

export interface Order {
  id: ID;
  userId: ID;
  userNickname: string;
  source: OrderSource;
  /** ExchangeItem id or UserPrize id. */
  refId: ID;
  itemName: string;
  imageUrl: string | null;
  itemType: "physical" | "digital";
  pointsSpent: number;
  address: ShippingAddress | null;
  status: OrderStatus;
  trackingNumber: string | null;
  /** For digital exchange items: the code sent to the user. */
  digitalCode: string | null;
  adminNote: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  shippedAt: ISODateString | null;
}

// ---------------------------------------------------------------------------
// Media library
// ---------------------------------------------------------------------------

export type MediaKind = "image" | "video" | "lottie";

export interface MediaAsset {
  id: ID;
  kind: MediaKind;
  name: string;
  mime: string;
  size: number;
  /** Public URL: "/demo/..." for built-in samples, "/api/media/<id>" for uploads. */
  url: string;
  source: "builtin" | "upload";
  createdAt: ISODateString;
  uploadedBy: string | null;
}

// ---------------------------------------------------------------------------
// Mini games (extension slot for embedded external games)
// ---------------------------------------------------------------------------

export interface MiniGameSlot {
  id: ID;
  title: string;
  description: string;
  provider: string;
  /** iframe src. Internal sample: "/embed/coin-catch". */
  embedUrl: string;
  thumbnailUrl: string | null;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3";
  active: boolean;
  sortOrder: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Site settings & audit
// ---------------------------------------------------------------------------

export interface SiteSettings {
  siteName: string;
  tagline: string;
  /** Banner text at the top of the site; empty = hidden. */
  announcement: string;
  updatedAt: ISODateString;
}

export interface AuditLog {
  id: ID;
  actorId: ID;
  actorName: string;
  action: string;
  target: string;
  detail: string;
  createdAt: ISODateString;
}
