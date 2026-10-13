import "server-only";
import { randomBytes } from "node:crypto";
import type { AdSession, Offer, OfferCategory, PostbackKind, PostbackLog, PostbackStatus, VerificationStep } from "@/lib/types";
import { OFFER_CATEGORY_LABELS, OFFER_PROVIDER_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { jstDateKey } from "@/lib/time";
import type { AdCompleteDto, OfferCompleteDto, VerificationResultDto } from "@/components/earn/types";
import { ApiError } from "../http";
import { newId, newTransactionId } from "../ids";
import { changeTickets } from "../ledger";
import { lockKeys, withLocks } from "../lock";
import { signParams, verifyParams, type WebhookProvider } from "../signature";
import { getDb, type Db } from "../store";
import {
  AD_MIN_WATCH_MS,
  AD_SESSION_TTL_MS,
  balancesOf,
  getVideoStatus,
  offerCompletionState,
  offerTicketsFor,
  toOfferDto,
} from "./rewards";

/**
 * Server-to-server reward notifications (webhooks / postbacks).
 *
 * The ONLY code path that grants tickets for videos and offers. Each attempt runs a
 * verification pipeline and is recorded as a PostbackLog with every step:
 *
 *   Rewarded video (AdMob SSV):  署名検証 → タイムスタンプ → 重複チェック → 広告セッション照合 → 1日の視聴上限 → チケット付与
 *   Offerwall (skyflag/Tapjoy):  署名検証 → タイムスタンプ → 重複チェック → 案件照合 → 付与数の計算 → チケット付与
 *
 * The whole pipeline runs inside withLocks([user, transaction]) so concurrent or
 * retried notifications can neither double-grant nor exceed the daily limit.
 * Production mapping: one DB transaction with
 *   INSERT INTO processed_transactions (provider, tx_id) ... (unique key → duplicate)
 *   SELECT ... FROM users WHERE id = $1 FOR UPDATE           (daily count / balance)
 *   UPDATE ad_sessions SET status = 'rewarded' WHERE id = $2 AND status = 'started'
 */

export const TIMESTAMP_TOLERANCE_MS = 5 * 60_000;
export const MAX_POSTBACK_LOGS = 5_000;
export const ADMOB_WEBHOOK_PATH = "/api/webhooks/admob-ssv";
export const OFFERWALL_PROVIDERS = ["skyflag", "tapjoy"] as const;
export type OfferwallProvider = (typeof OFFERWALL_PROVIDERS)[number];

export function offerwallWebhookPath(provider: string): string {
  return `/api/webhooks/offerwall/${provider}`;
}

export function isOfferwallProvider(value: string): value is OfferwallProvider {
  return (OFFERWALL_PROVIDERS as readonly string[]).includes(value);
}

/** Webhook path for a log entry (video → AdMob SSV, offer → offerwall/<provider>). */
export function webhookPathFor(kind: PostbackKind, provider: string): string {
  return kind === "video" ? ADMOB_WEBHOOK_PATH : offerwallWebhookPath(provider);
}

const LABELS = {
  request: "リクエスト形式",
  signature: "署名検証（HMAC-SHA256）",
  timestamp: "タイムスタンプ検証",
  duplicate: "重複チェック（transaction_id）",
  session: "広告セッション照合",
  limit: "1日の視聴上限",
  offer: "案件照合",
  rate: "付与数の計算",
  grant: "チケット付与",
} as const;

const HTTP_STATUS: Record<PostbackStatus, number> = {
  granted: 200,
  // Acknowledged (2xx) so the provider stops retrying, but nothing is granted.
  duplicate: 200,
  limit_reached: 200,
  invalid_signature: 401,
  expired: 400,
  unknown_user: 400,
  invalid_session: 400,
  invalid_request: 400,
};

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

const MAX_PARAMS = 40;
const MAX_KEY_LENGTH = 64;
const MAX_VALUE_LENGTH = 1_000;
const MAX_BODY_LENGTH = 32_000;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export interface ParsedWebhookParams {
  params: Record<string, string>;
  /** Structural problem (duplicate keys = parameter pollution, too many / too long params ...). */
  error: string | null;
}

function collectParams(entries: Iterable<[string, string]>): ParsedWebhookParams {
  const params: Record<string, string> = {};
  let error: string | null = null;
  let count = 0;
  for (const [key, value] of entries) {
    if (++count > MAX_PARAMS) {
      error ??= `パラメータが多すぎます（最大${MAX_PARAMS}個）`;
      break;
    }
    if (FORBIDDEN_KEYS.has(key) || key.length === 0 || key.length > MAX_KEY_LENGTH) {
      error ??= `不正なパラメータ名です（${key.slice(0, MAX_KEY_LENGTH) || "空"}）`;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      error ??= `パラメータ「${key}」が重複しています（パラメータ汚染の疑い）`;
      continue;
    }
    if (value.length > MAX_VALUE_LENGTH) {
      error ??= `パラメータ「${key}」が長すぎます`;
      params[key] = value.slice(0, 200);
      continue;
    }
    params[key] = value;
  }
  return { params, error };
}

/** Reads callback parameters from the query string (GET) and, for POST, a form or JSON body. */
export async function readWebhookParams(req: Request): Promise<ParsedWebhookParams> {
  const url = new URL(req.url);
  const entries: Array<[string, string]> = [...url.searchParams];
  let bodyError: string | null = url.search.length > 8_000 ? "クエリ文字列が長すぎます" : null;
  if (req.method === "POST") {
    const text = await req.text();
    if (text.length > MAX_BODY_LENGTH) {
      bodyError ??= "リクエストボディが大きすぎます";
    } else if (text.trim()) {
      const type = req.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        try {
          const json = JSON.parse(text) as unknown;
          if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("not an object");
          for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
            if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
              entries.push([key, String(value)]);
            } else {
              bodyError ??= `パラメータ「${key}」の形式が正しくありません`;
            }
          }
        } catch {
          bodyError ??= "JSONの形式が正しくありません";
        }
      } else {
        entries.push(...new URLSearchParams(text));
      }
    }
  }
  const parsed = collectParams(entries);
  return { params: parsed.params, error: bodyError ?? parsed.error };
}

// ---------------------------------------------------------------------------
// Admin test-tool marker: a one-time nonce header proves the request came from
// our own server's テスト送信 (so the log can say "テスト送信" instead of "外部").
// ---------------------------------------------------------------------------

export const TEST_NONCE_HEADER = "x-poigacha-test-nonce";
type NonceGlobal = typeof globalThis & { __poigachaWebhookTestNonces?: Map<string, number> };
const testNonces: Map<string, number> = ((globalThis as NonceGlobal).__poigachaWebhookTestNonces ??= new Map());

export function issueTestNonce(): string {
  const now = Date.now();
  for (const [nonce, expiresAt] of testNonces) if (expiresAt < now) testNonces.delete(nonce);
  const nonce = randomBytes(16).toString("hex");
  testNonces.set(nonce, now + 60_000);
  return nonce;
}

/** "admin_test" when the request carries a valid one-time nonce from issueTestNonce(), else "external". */
export function webhookSource(req: Request): PostbackLog["source"] {
  const nonce = req.headers.get(TEST_NONCE_HEADER);
  if (!nonce) return "external";
  const expiresAt = testNonces.get(nonce);
  if (expiresAt === undefined) return "external";
  testNonces.delete(nonce);
  return expiresAt >= Date.now() ? "admin_test" : "external";
}

// ---------------------------------------------------------------------------
// Pipeline plumbing
// ---------------------------------------------------------------------------

export interface WebhookContext {
  method: "GET" | "POST";
  source: PostbackLog["source"];
  /** Structural problem found while parsing (→ invalid_request). */
  parseError?: string | null;
}

/** JSON body returned to the provider. HTTP 2xx = accepted (no retry needed). */
export interface WebhookResponseBody {
  ok: boolean;
  status: PostbackStatus;
  granted: boolean;
  tickets: number;
  message: string;
  postbackId: string;
}

export interface WebhookOutcome {
  log: PostbackLog;
  httpStatus: number;
  body: WebhookResponseBody;
}

interface Draft {
  kind: PostbackKind;
  provider: string;
  ctx: WebhookContext;
  params: Record<string, string>;
  userId: string;
  txId: string;
  receivedAtMs: number;
  steps: VerificationStep[];
}

function newDraft(
  kind: PostbackKind,
  provider: string,
  ctx: WebhookContext,
  params: Record<string, string>,
  userId: string,
  txId: string,
  receivedAtMs: number,
): Draft {
  return { kind, provider, ctx, params, userId, txId, receivedAtMs, steps: [] };
}

function pass(d: Draft, key: keyof typeof LABELS, detail: string) {
  d.steps.push({ key, label: LABELS[key], ok: true, detail });
}

function fail(d: Draft, key: keyof typeof LABELS, detail: string) {
  d.steps.push({ key, label: LABELS[key], ok: false, detail });
}

/** Copy of the params for the log (values capped so a hostile caller can't bloat memory). */
function paramsForLog(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) out[key] = value.length > 300 ? `${value.slice(0, 300)}…` : value;
  return out;
}

function finish(
  db: Db,
  d: Draft,
  status: PostbackStatus,
  message: string,
  opts: { tickets?: number; id?: string; httpStatus?: number } = {},
): WebhookOutcome {
  const httpStatus = opts.httpStatus ?? HTTP_STATUS[status];
  const log: PostbackLog = {
    id: opts.id ?? newId("pb"),
    kind: d.kind,
    provider: d.provider,
    method: d.ctx.method,
    receivedAt: new Date(d.receivedAtMs).toISOString(),
    userId: d.userId ? d.userId.slice(0, 64) : null,
    transactionId: d.txId ? d.txId.slice(0, 128) : null,
    params: paramsForLog(d.params),
    status,
    httpStatus,
    ticketsGranted: opts.tickets ?? 0,
    steps: d.steps,
    message,
    source: d.ctx.source,
  };
  db.postbacks.push(log);
  if (db.postbacks.length > MAX_POSTBACK_LOGS) db.postbacks.splice(0, db.postbacks.length - MAX_POSTBACK_LOGS);
  return {
    log,
    httpStatus,
    body: {
      ok: httpStatus < 300,
      status,
      granted: status === "granted",
      tickets: log.ticketsGranted,
      message,
      postbackId: log.id,
    },
  };
}

/** "2秒" / "3分12秒" / "5時間" */
function describeDuration(ms: number): string {
  const sec = Math.round(Math.abs(ms) / 1000);
  if (sec < 60) return `${sec}秒`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分${sec % 60 ? `${sec % 60}秒` : ""}`;
  const hours = Math.floor(min / 60);
  if (hours < 48) return `${hours}時間${min % 60 ? `${min % 60}分` : ""}`;
  return `${Math.floor(hours / 24)}日`;
}

function verifySignature(d: Draft, provider: WebhookProvider): { status: PostbackStatus; message: string } | null {
  const signature = d.params.signature;
  if (!signature) {
    fail(d, "signature", "署名（signature）がありません");
    return { status: "invalid_signature", message: "署名がないため拒否しました" };
  }
  if (!verifyParams(provider, d.params, signature)) {
    fail(d, "signature", "署名が一致しません（改ざん・なりすましの疑い）");
    return { status: "invalid_signature", message: "署名が一致しないため拒否しました" };
  }
  const keyId = d.params.key_id ? `（key_id: ${d.params.key_id}）` : "";
  pass(d, "signature", `署名が一致しました${keyId}`);
  return null;
}

function verifyTimestamp(d: Draft, raw: string | undefined, unit: "ms" | "s"): { status: PostbackStatus; message: string } | null {
  const pattern = unit === "ms" ? /^\d{12,14}$/ : /^\d{9,11}$/;
  if (!raw || !pattern.test(raw)) {
    fail(d, "timestamp", unit === "ms" ? "timestamp（ミリ秒）がない、または形式が正しくありません" : "ts（秒）がない、または形式が正しくありません");
    return { status: "invalid_request", message: "タイムスタンプの形式が正しくないため拒否しました" };
  }
  const tsMs = unit === "ms" ? Number(raw) : Number(raw) * 1000;
  const diff = d.receivedAtMs - tsMs;
  if (Math.abs(diff) > TIMESTAMP_TOLERANCE_MS) {
    fail(
      d,
      "timestamp",
      diff > 0
        ? `受信時刻より${describeDuration(diff)}前の通知です（許容範囲: 5分）。古い通知の再送（リプレイ）の疑い`
        : `受信時刻より${describeDuration(diff)}先の時刻です（許容範囲: 5分）`,
    );
    return { status: "expired", message: "タイムスタンプが許容範囲外のため拒否しました" };
  }
  pass(d, "timestamp", `受信時刻との差 ${describeDuration(diff)}（許容範囲: 5分）`);
  return null;
}

function verifyNotProcessed(db: Db, d: Draft, provider: string): { status: PostbackStatus; message: string } | null {
  if (!d.txId) {
    fail(d, "duplicate", "transaction_id がありません");
    return { status: "invalid_request", message: "transaction_id がないため拒否しました" };
  }
  if (db.processedTransactions.has(`${provider}:${d.txId}`)) {
    fail(d, "duplicate", "同じtransaction_idは処理済みです（二重付与を防止）");
    return { status: "duplicate", message: "処理済みのトランザクションのため付与しません" };
  }
  pass(d, "duplicate", "未処理のトランザクションです");
  return null;
}

// ---------------------------------------------------------------------------
// Rewarded video — AdMob server-side verification (SSV) callback
// ---------------------------------------------------------------------------

export async function processVideoCallback(params: Record<string, string>, ctx: WebhookContext): Promise<WebhookOutcome> {
  const receivedAtMs = Date.now();
  const userId = params.user_id ?? "";
  const txId = params.transaction_id ?? "";
  return withLocks([lockKeys.user(userId || "-"), lockKeys.transaction("admob", txId || "-")], () => {
    const db = getDb();
    const d = newDraft("video", "admob", ctx, params, userId, txId, receivedAtMs);
    const reject = (r: { status: PostbackStatus; message: string }) => finish(db, d, r.status, r.message);

    if (ctx.parseError) {
      fail(d, "request", ctx.parseError);
      return finish(db, d, "invalid_request", "リクエストの形式が正しくないため拒否しました");
    }

    // 1. 署名検証 — HMAC-SHA256 over the canonical params, compared with timingSafeEqual.
    const sig = verifySignature(d, "admob");
    if (sig) return reject(sig);

    // 2. タイムスタンプ検証 — AdMob sends epoch milliseconds.
    const ts = verifyTimestamp(d, params.timestamp, "ms");
    if (ts) return reject(ts);

    // 3. 重複チェック — idempotency by transaction_id.
    const dup = verifyNotProcessed(db, d, "admob");
    if (dup) return reject(dup);

    // 4. 広告セッション照合 — the session we issued before the ad played (custom_data).
    const user = db.users.get(userId);
    if (!user) {
      fail(d, "session", userId ? `user_id「${userId.slice(0, 64)}」の会員が存在しません` : "user_id がありません");
      return finish(db, d, "unknown_user", "会員を確認できないため拒否しました");
    }
    if (user.status !== "active") {
      fail(d, "session", "利用停止中の会員です");
      return finish(db, d, "unknown_user", "利用停止中の会員のため付与しません");
    }
    const sessionId = params.custom_data ?? "";
    const session = sessionId ? db.adSessions.get(sessionId) : undefined;
    if (!session) {
      fail(d, "session", `視聴セッション（custom_data: ${sessionId.slice(0, 64) || "なし"}）が見つかりません`);
      return finish(db, d, "invalid_session", "広告セッションを確認できないため拒否しました");
    }
    if (session.userId !== user.id) {
      fail(d, "session", "視聴セッションの会員と user_id が一致しません");
      return finish(db, d, "invalid_session", "広告セッションの会員が一致しないため拒否しました");
    }
    if (session.status !== "started") {
      fail(
        d,
        "session",
        session.status === "rewarded"
          ? "この視聴セッションは付与済みです（1回の視聴につき1回まで）"
          : "この視聴セッションは処理済みです",
      );
      return finish(db, d, "invalid_session", "処理済みの広告セッションのため付与しません");
    }
    const age = receivedAtMs - Date.parse(session.createdAt);
    if (age > AD_SESSION_TTL_MS) {
      fail(d, "session", `視聴セッションの有効期限（30分）を過ぎています（開始から${describeDuration(age)}）`);
      return finish(db, d, "invalid_session", "広告セッションの有効期限切れのため拒否しました");
    }
    pass(d, "session", `視聴セッション ${session.id} を確認（開始から${describeDuration(age)}）`);

    // 5. 1日の視聴上限 — authoritative check with lazy JST reset.
    const settings = db.rewardSettings;
    const today = jstDateKey(receivedAtMs);
    const count = user.videoViews.date === today ? user.videoViews.count : 0;
    const at = new Date(receivedAtMs).toISOString();
    if (count >= settings.videoDailyLimit) {
      fail(d, "limit", `本日の上限（${settings.videoDailyLimit}回）に達しています（毎日0:00にリセット）`);
      Object.assign(session, { status: "rejected", completedAt: at, transactionId: txId } satisfies Partial<AdSession>);
      return finish(db, d, "limit_reached", "本日の視聴上限に達しているため付与しません");
    }
    pass(d, "limit", `本日 ${count + 1}/${settings.videoDailyLimit} 回目（毎日0:00にリセット）`);

    // 6. チケット付与 — the amount is the admin setting (the callback's reward_amount is not trusted).
    const tickets = settings.videoTicketsPerView;
    const postbackId = newId("pb");
    changeTickets(db, user, tickets, "video_reward", "動画視聴（リワード広告）", postbackId);
    user.videoViews = { date: today, count: count + 1 };
    Object.assign(session, { status: "rewarded", completedAt: at, transactionId: txId, tickets } satisfies Partial<AdSession>);
    db.processedTransactions.add(`admob:${txId}`);
    pass(d, "grant", `+${formatNumber(tickets)}枚（設定値: 動画1回あたり${formatNumber(tickets)}枚／残高 ${formatNumber(user.tickets)}枚）`);
    return finish(db, d, "granted", `チケット${formatNumber(tickets)}枚を付与しました`, { tickets, id: postbackId });
  });
}

// ---------------------------------------------------------------------------
// Offerwall postback (skyflag / Tapjoy)
// ---------------------------------------------------------------------------

export async function processOfferPostback(
  provider: string,
  params: Record<string, string>,
  ctx: WebhookContext,
): Promise<WebhookOutcome> {
  const receivedAtMs = Date.now();
  const providerKey = provider.slice(0, 32);
  const userId = params.uid ?? "";
  const txId = params.tid ?? "";
  return withLocks([lockKeys.user(userId || "-"), lockKeys.transaction(providerKey, txId || "-")], () => {
    const db = getDb();
    const d = newDraft("offer", providerKey, ctx, params, userId, txId, receivedAtMs);
    const reject = (r: { status: PostbackStatus; message: string }) => finish(db, d, r.status, r.message);

    if (!isOfferwallProvider(providerKey)) {
      fail(d, "request", `未対応の事業者です（${providerKey || "なし"}）`);
      return finish(db, d, "invalid_request", "未対応の事業者のため拒否しました", { httpStatus: 404 });
    }
    if (ctx.parseError) {
      fail(d, "request", ctx.parseError);
      return finish(db, d, "invalid_request", "リクエストの形式が正しくないため拒否しました");
    }

    // 1. 署名検証 with this provider's shared secret.
    const sig = verifySignature(d, providerKey);
    if (sig) return reject(sig);

    // 2. タイムスタンプ検証 — offerwalls send epoch seconds.
    const ts = verifyTimestamp(d, params.ts, "s");
    if (ts) return reject(ts);

    // 3. 重複チェック — key "<provider>:<tid>".
    const dup = verifyNotProcessed(db, d, providerKey);
    if (dup) return reject(dup);

    // 4. 案件照合 — member, offer, provider, active, not yet completed (1人1回 / 1日1回).
    const user = db.users.get(userId);
    if (!user) {
      fail(d, "offer", userId ? `uid「${userId.slice(0, 64)}」の会員が存在しません` : "uid がありません");
      return finish(db, d, "unknown_user", "会員を確認できないため拒否しました");
    }
    if (user.status !== "active") {
      fail(d, "offer", "利用停止中の会員です");
      return finish(db, d, "unknown_user", "利用停止中の会員のため付与しません");
    }
    const offerId = params.offer_id ?? "";
    const offer = offerId ? db.offers.get(offerId) : undefined;
    if (!offer) {
      fail(d, "offer", `案件が見つかりません（offer_id: ${offerId.slice(0, 64) || "なし"}）`);
      return finish(db, d, "invalid_request", "存在しない案件のため拒否しました");
    }
    if (offer.provider !== providerKey) {
      fail(d, "offer", `この案件は${OFFER_PROVIDER_LABELS[offer.provider]}の案件です（事業者が一致しません）`);
      return finish(db, d, "invalid_request", "事業者が一致しないため拒否しました");
    }
    if (!offer.active) {
      fail(d, "offer", `「${offer.title}」は掲載を停止しています`);
      return finish(db, d, "invalid_request", "掲載停止中の案件のため拒否しました");
    }
    const categoryLabel = OFFER_CATEGORY_LABELS[offer.category] ?? offer.category;
    const state = offerCompletionState(db, user.id, offer, receivedAtMs);
    if (state.completed) {
      fail(
        d,
        "offer",
        offer.repeatable
          ? `「${offer.title}」は本日すでに達成済みです（1日1回まで）`
          : `「${offer.title}」は達成済みです（1人1回まで）`,
      );
      return finish(db, d, "limit_reached", "達成済みの案件のため付与しません");
    }
    pass(d, "offer", `「${offer.title}」（${categoryLabel}）— ${offer.repeatable ? "本日は未達成" : "未達成"}を確認`);

    // 5. 付与数の計算 — category setting × campaign multiplier (admin settings, not the postback's payout).
    const settings = db.rewardSettings;
    const base = settings.offerCategoryTickets[offer.category] ?? 0;
    const tickets = offerTicketsFor(settings, offer.category);
    pass(d, "rate", `カテゴリ「${categoryLabel}」${formatNumber(base)}枚 × 倍率 ${settings.offerMultiplier.toFixed(1)} = ${formatNumber(tickets)}枚`);

    // 6. チケット付与 + completion record.
    const postbackId = newId("pb");
    if (tickets > 0) changeTickets(db, user, tickets, "offer_reward", `案件達成: ${offer.title}`, postbackId);
    db.offerCompletions.push({
      id: newId("oc"),
      userId: user.id,
      offerId: offer.id,
      provider: offer.provider,
      transactionId: txId,
      tickets,
      createdAt: new Date(receivedAtMs).toISOString(),
    });
    db.processedTransactions.add(`${providerKey}:${txId}`);
    pass(d, "grant", `+${formatNumber(tickets)}枚（残高 ${formatNumber(user.tickets)}枚）`);
    return finish(db, d, "granted", `チケット${formatNumber(tickets)}枚を付与しました`, { tickets, id: postbackId });
  });
}

// ---------------------------------------------------------------------------
// Results for the UI
// ---------------------------------------------------------------------------

export function webhookUrlOf(log: Pick<PostbackLog, "kind" | "provider" | "params">): string {
  const query = new URLSearchParams(log.params).toString();
  return `${webhookPathFor(log.kind, log.provider)}${query ? `?${query}` : ""}`;
}

export function toVerificationResult(log: PostbackLog, replayed = false): VerificationResultDto {
  return {
    postbackId: log.id,
    kind: log.kind,
    provider: log.provider,
    status: log.status,
    httpStatus: log.httpStatus,
    granted: log.status === "granted",
    ticketsGranted: log.ticketsGranted,
    message: log.message,
    steps: log.steps,
    transactionId: log.transactionId,
    receivedAt: log.receivedAt,
    callback: { method: log.method, url: webhookUrlOf(log), params: log.params },
    replayed,
  };
}

function findLatestPostback(db: Db, predicate: (log: PostbackLog) => boolean): PostbackLog | undefined {
  for (let i = db.postbacks.length - 1; i >= 0; i--) if (predicate(db.postbacks[i])) return db.postbacks[i];
  return undefined;
}

// ---------------------------------------------------------------------------
// Provider simulators (the demo plays Google's ad server and the offerwall ASPs)
// ---------------------------------------------------------------------------

/** AdMob-style SSV callback params, signed like the ad network would (signature + key_id last). */
export function buildAdmobCallback(
  session: Pick<AdSession, "id" | "userId">,
  opts: { timestampMs?: number; transactionId?: string; rewardAmount?: number } = {},
): Record<string, string> {
  const params: Record<string, string> = {
    ad_network: "5450213213286189855",
    ad_unit: "6300978111",
    custom_data: session.id,
    reward_amount: String(opts.rewardAmount ?? getDb().rewardSettings.videoTicketsPerView),
    reward_item: "ticket",
    timestamp: String(opts.timestampMs ?? Date.now()),
    transaction_id: opts.transactionId ?? newTransactionId("admob"),
    user_id: session.userId,
  };
  const keyId = "3335741209";
  const signature = signParams("admob", { ...params, key_id: keyId });
  return { ...params, signature, key_id: keyId };
}

const PAYOUT_YEN: Record<OfferCategory, number> = { app: 120, game: 240, survey: 20, signup: 400, shopping: 800, card: 3000 };

/** Offerwall postback params (uid, offer_id, tid, category, payout, ts) signed with the provider's secret. */
export function buildOfferPostback(
  offer: Pick<Offer, "id" | "provider" | "category">,
  userId: string,
  opts: { timestampMs?: number; transactionId?: string } = {},
): Record<string, string> {
  const params: Record<string, string> = {
    uid: userId,
    offer_id: offer.id,
    tid: opts.transactionId ?? newTransactionId(offer.provider),
    category: offer.category,
    payout: String(PAYOUT_YEN[offer.category] ?? 100),
    ts: String(Math.floor((opts.timestampMs ?? Date.now()) / 1000)),
  };
  return { ...params, signature: signParams(offer.provider, params) };
}

/** Re-sign params after editing them (used by the admin test tool for a provider retry). */
export function resign(provider: WebhookProvider, params: Record<string, string>): Record<string, string> {
  const rest = { ...params };
  delete rest.signature;
  const signature = signParams(provider, rest);
  const { key_id: keyId, ...others } = rest;
  return keyId !== undefined ? { ...others, signature, key_id: keyId } : { ...others, signature };
}

/**
 * POST /api/demo/ad-network/complete — plays Google's ad server: after the user finished the
 * ad, it sends the signed SSV callback to our webhook processor (the same function the
 * GET /api/webhooks/admob-ssv route uses). Idempotent per session.
 */
export async function simulateAdNetworkCompletion(userId: string, sessionId: string): Promise<AdCompleteDto> {
  const db = getDb();
  const session = db.adSessions.get(sessionId);
  if (!session || session.userId !== userId) throw new ApiError(404, "NOT_FOUND", "視聴セッションが見つかりません");

  let result: VerificationResultDto | null = null;
  if (session.status !== "started" && session.transactionId) {
    const previous = findLatestPostback(db, (l) => l.kind === "video" && l.transactionId === session.transactionId);
    if (previous) result = toVerificationResult(previous, true);
  }
  if (!result) {
    if (Date.now() - Date.parse(session.createdAt) < AD_MIN_WATCH_MS) {
      throw new ApiError(409, "AD_NOT_FINISHED", "広告の再生が完了していないため、広告ネットワークは成果通知を送信しませんでした。");
    }
    const outcome = await processVideoCallback(buildAdmobCallback(session), { method: "GET", source: "simulator" });
    result = toVerificationResult(outcome.log);
  }
  const user = getDb().users.get(userId);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "ログインが必要です");
  return { result, balances: balancesOf(user), video: getVideoStatus(user) };
}

/**
 * POST /api/demo/offerwall/complete — plays the offerwall provider: builds the signed postback
 * and processes it with the same function as GET|POST /api/webhooks/offerwall/[provider].
 */
export async function simulateOfferCompletion(userId: string, offerId: string): Promise<OfferCompleteDto> {
  const offer = getDb().offers.get(offerId);
  if (!offer || !offer.active) throw new ApiError(404, "NOT_FOUND", "案件が見つかりません");
  const outcome = await processOfferPostback(offer.provider, buildOfferPostback(offer, userId), {
    method: "GET",
    source: "simulator",
  });
  const db = getDb();
  const user = db.users.get(userId);
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "ログインが必要です");
  const current = db.offers.get(offerId) ?? offer;
  return { result: toVerificationResult(outcome.log), balances: balancesOf(user), offer: toOfferDto(db, current, userId) };
}
