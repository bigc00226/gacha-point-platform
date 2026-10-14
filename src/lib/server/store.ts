import "server-only";
import type {
  AdSession,
  AuditLog,
  Coupon,
  CouponRedemption,
  DrawRecord,
  ExchangeItem,
  Gacha,
  ID,
  ISODateString,
  LedgerEntry,
  MediaAsset,
  MiniGameSlot,
  Offer,
  OfferCompletion,
  Order,
  PostbackLog,
  Prize,
  Rank,
  RewardSettings,
  SiteSettings,
  User,
  UserPrize,
} from "@/lib/types";
import { buildSeedDb } from "./seed";

/**
 * In-memory database (the demo intentionally has no DB).
 *
 * Each collection corresponds to a table in the production design. The object
 * lives on `globalThis`, so it survives dev hot reloads and is shared by all
 * pages and Route Handlers of the running server process. Restarting the server
 * (or "デモデータ初期化" in the admin) restores the seed data.
 *
 * On serverless hosts (Vercel) requests can land on different instances, so
 * `state/sync.ts` keeps every instance's copy in step through a shared cache.
 *
 * Bump SCHEMA_VERSION whenever the shape of `Db` or the seed changes: a running
 * dev server then re-seeds instead of serving a stale shape.
 */
export const SCHEMA_VERSION = 3;

export interface Db {
  schemaVersion: number;
  seededAt: ISODateString;
  users: Map<ID, User>;
  ranks: Map<ID, Rank>;
  gachas: Map<ID, Gacha>;
  prizes: Map<ID, Prize>;
  /** Append-only, oldest first. */
  draws: DrawRecord[];
  /** `${userId}:${requestId}` → draw id. Idempotency keys for draw requests. */
  drawRequests: Map<string, ID>;
  userPrizes: Map<ID, UserPrize>;
  /** Append-only, oldest first. */
  ledger: LedgerEntry[];
  rewardSettings: RewardSettings;
  offers: Map<ID, Offer>;
  offerCompletions: OfferCompletion[];
  adSessions: Map<ID, AdSession>;
  /** Append-only, oldest first. */
  postbacks: PostbackLog[];
  /** `${provider}:${transactionId}` of postbacks that already granted tickets. */
  processedTransactions: Set<string>;
  coupons: Map<ID, Coupon>;
  couponRedemptions: CouponRedemption[];
  exchangeItems: Map<ID, ExchangeItem>;
  orders: Map<ID, Order>;
  media: Map<ID, MediaAsset>;
  /** Bytes of uploaded media (built-in samples are static files under /public/demo). */
  mediaBlobs: Map<ID, Uint8Array>;
  miniGames: Map<ID, MiniGameSlot>;
  siteSettings: SiteSettings;
  /** Append-only, oldest first. */
  auditLogs: AuditLog[];
  /**
   * Rate-limit counters. They live in the database (not in module state) so
   * every server instance enforces the same limits.
   */
  /** Failed logins per email → locked until (epoch ms). */
  loginFailures: Map<string, { count: number; lockedUntil: number }>;
  /** Wrong coupon codes per member (epoch ms of each failure). */
  couponFailures: Map<ID, number[]>;
}

type StoreGlobal = typeof globalThis & { __poigachaDb?: Db };
const store = globalThis as StoreGlobal;

function seed(): Db {
  const db = buildSeedDb();
  db.schemaVersion = SCHEMA_VERSION;
  store.__poigachaDb = db;
  return db;
}

/** The live database. Seeded on first access. */
export function getDb(): Db {
  const db = store.__poigachaDb;
  return db && db.schemaVersion === SCHEMA_VERSION ? db : seed();
}

/** Restore the initial demo data. */
export function resetDb(): Db {
  return seed();
}

/** The live database if this process already has one (never seeds). */
export function peekDb(): Db | undefined {
  const db = store.__poigachaDb;
  return db && db.schemaVersion === SCHEMA_VERSION ? db : undefined;
}

/** Replace the live database (used when loading the state shared between server instances). */
export function installDb(db: Db): void {
  store.__poigachaDb = db;
}

// ---------------------------------------------------------------------------
// Shared selectors
// ---------------------------------------------------------------------------

/** All ranks, highest first (ラストワン賞 has order 0 and comes first). */
export function sortedRanks(db: Db): Rank[] {
  return [...db.ranks.values()].sort((a, b) => a.order - b.order);
}

/** Ranks that regular prizes can use (everything except ラストワン賞). */
export function prizeRanks(db: Db): Rank[] {
  return sortedRanks(db).filter((r) => !r.isLastOne);
}

export function lastOneRank(db: Db): Rank | undefined {
  return sortedRanks(db).find((r) => r.isLastOne);
}

/** Prizes of a gacha, highest rank first. */
export function prizesOfGacha(db: Db, gachaId: ID): Prize[] {
  const rankOrder = (id: ID) => db.ranks.get(id)?.order ?? 999;
  return [...db.prizes.values()]
    .filter((p) => p.gachaId === gachaId)
    .sort((a, b) => rankOrder(a.rankId) - rankOrder(b.rankId) || a.sortOrder - b.sortOrder);
}

/** Gachas shown in the app (excludes load-test sandboxes), by sortOrder. */
export function visibleGachas(db: Db): Gacha[] {
  return [...db.gachas.values()].filter((g) => !g.isSandbox).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Real members (excludes load-test virtual users). */
export function visibleUsers(db: Db): User[] {
  return [...db.users.values()].filter((u) => !u.isVirtual);
}

export function findUserByEmail(db: Db, email: string): User | undefined {
  const target = email.trim().toLowerCase();
  for (const user of db.users.values()) if (user.email === target) return user;
  return undefined;
}
