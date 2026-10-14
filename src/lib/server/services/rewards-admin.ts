import "server-only";
import type {
  AuditLog,
  Offer,
  OfferCategory,
  OfferProvider,
  PostbackKind,
  PostbackLog,
  PostbackStatus,
  RewardSettings,
  User,
} from "@/lib/types";
import { OFFER_CATEGORIES, OFFER_CATEGORY_LABELS, OFFER_PROVIDER_LABELS, POSTBACK_STATUS_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { jstDateKey, startOfJstDay } from "@/lib/time";
import type {
  AdminOfferDto,
  AdminOffersDto,
  PostbackFilterDto,
  PostbackKpisDto,
  PostbackListDto,
  PostbackLogDto,
  PostbackTestInput,
  PostbackTestKind,
  PostbackTestOptionsDto,
  PostbackTestResultDto,
  PostbackTestScenario,
  RewardGrantStatsDto,
  RewardSettingsInput,
  RewardSettingsPageDto,
  RewardSettingsSaveDto,
  WebhookEndpointDto,
} from "@/components/admin/rewards/types";
import { recordAudit } from "../audit";
import { ApiError, notFoundError } from "../http";
import { newId } from "../ids";
import { lockKeys, withLock, withLocks } from "../lock";
import { statePersistenceEnabled } from "../state/sync";
import { getDb, visibleUsers, type Db } from "../store";
import { vBool, vInt, vNumber, vOneOf, vOptionalUrl, vString, validationFail } from "../validate";
import { getVideoStatus, offerCompletionState, offerTicketsFor } from "./rewards";
import {
  ADMOB_WEBHOOK_PATH,
  buildAdmobCallback,
  buildOfferPostback,
  issueTestNonce,
  offerwallWebhookPath,
  processOfferPostback,
  processVideoCallback,
  resign,
  TEST_NONCE_HEADER,
  type WebhookOutcome,
} from "./rewards-webhook";

/**
 * ポイ活 admin service: reward settings (付与数・倍率・上限), offer CRUD, the postback
 * log and the テスト送信 tool that fires real HTTP requests at our own webhook endpoints.
 */

export const SETTINGS_AUDIT_ACTION = "付与設定を変更";
const SETTINGS_LOCK = "settings:rewards";
const OFFERS_LOCK = "offers";
const offerLock = (id: string) => `offer:${id}`;
const PROVIDERS: readonly OfferProvider[] = ["skyflag", "tapjoy"];

// ---------------------------------------------------------------------------
// Reward settings
// ---------------------------------------------------------------------------

export function parseRewardSettingsInput(body: Record<string, unknown>): RewardSettingsInput {
  const videoTicketsPerView = vInt(body.videoTicketsPerView, "videoTicketsPerView", "動画1回あたりの付与枚数", { min: 1, max: 1000 });
  const videoDailyLimit = vInt(body.videoDailyLimit, "videoDailyLimit", "1日の視聴上限", { min: 1, max: 100 });
  const loginBonusTickets = vInt(body.loginBonusTickets, "loginBonusTickets", "ログインボーナスの付与枚数", { min: 0, max: 1000 });
  const signupBonusTickets = vInt(body.signupBonusTickets, "signupBonusTickets", "新規登録ボーナスの付与枚数", { min: 0, max: 10_000 });
  const rawMultiplier = vNumber(body.offerMultiplier, "offerMultiplier", "案件の付与倍率", { min: 1, max: 10 });
  const offerMultiplier = Math.round(rawMultiplier * 10) / 10;
  if (Math.abs(offerMultiplier - rawMultiplier) > 1e-9) {
    validationFail("offerMultiplier", "案件の付与倍率は0.1刻みで入力してください");
  }
  const rawCategories = body.offerCategoryTickets;
  if (!rawCategories || typeof rawCategories !== "object") {
    validationFail("offerCategoryTickets", "カテゴリ別の付与枚数を入力してください");
  }
  const offerCategoryTickets = {} as Record<OfferCategory, number>;
  for (const category of OFFER_CATEGORIES) {
    offerCategoryTickets[category] = vInt(
      (rawCategories as Record<string, unknown>)[category],
      `offerCategoryTickets.${category}`,
      `「${OFFER_CATEGORY_LABELS[category]}」の付与枚数`,
      { min: 0, max: 100_000 },
    );
  }
  return { videoTicketsPerView, videoDailyLimit, loginBonusTickets, signupBonusTickets, offerMultiplier, offerCategoryTickets };
}

const SETTING_FIELDS: Array<{
  key: Exclude<keyof RewardSettingsInput, "offerCategoryTickets">;
  label: string;
  group: string;
  format: (value: number) => string;
}> = [
  { key: "videoTicketsPerView", label: "動画1回あたりの付与枚数", group: "リワード動画", format: (v) => `${formatNumber(v)}枚` },
  { key: "videoDailyLimit", label: "1日の視聴上限", group: "リワード動画", format: (v) => `${formatNumber(v)}回` },
  { key: "loginBonusTickets", label: "ログインボーナス", group: "ログインボーナス", format: (v) => `${formatNumber(v)}枚` },
  { key: "signupBonusTickets", label: "新規登録ボーナス", group: "新規登録ボーナス", format: (v) => `${formatNumber(v)}枚` },
  { key: "offerMultiplier", label: "案件の付与倍率", group: "案件", format: (v) => `×${v.toFixed(1)}` },
];

function settingsHistory(db: Db, limit = 15): AuditLog[] {
  const out: AuditLog[] = [];
  for (let i = db.auditLogs.length - 1; i >= 0 && out.length < limit; i--) {
    if (db.auditLogs[i].action === SETTINGS_AUDIT_ACTION) out.push(db.auditLogs[i]);
  }
  return out;
}

/** Today's (JST) ticket grants by source, from the ledger. */
function todayGrantStats(db: Db, now = Date.now()): RewardGrantStatsDto {
  const start = startOfJstDay(now).toISOString();
  const stopBefore = new Date(Date.parse(start) - 60 * 60_000).toISOString();
  const stats: RewardGrantStatsDto = {
    login: { count: 0, tickets: 0 },
    video: { count: 0, tickets: 0 },
    offer: { count: 0, tickets: 0 },
    signup: { count: 0, tickets: 0 },
  };
  const bucket = { login_bonus: stats.login, video_reward: stats.video, offer_reward: stats.offer, signup_bonus: stats.signup } as const;
  for (let i = db.ledger.length - 1; i >= 0; i--) {
    const e = db.ledger[i];
    if (e.createdAt < stopBefore) break;
    if (e.createdAt < start || e.currency !== "ticket") continue;
    const target = bucket[e.reason as keyof typeof bucket];
    if (!target) continue;
    target.count += 1;
    target.tickets += e.amount;
  }
  return stats;
}

export function getRewardSettingsPage(): RewardSettingsPageDto {
  const db = getDb();
  return { settings: { ...db.rewardSettings, offerCategoryTickets: { ...db.rewardSettings.offerCategoryTickets } }, history: settingsHistory(db), today: todayGrantStats(db) };
}

/** PUT /api/admin/rewards/settings — applies immediately to the next grant; audited with before → after. */
export async function updateRewardSettings(admin: User, body: Record<string, unknown>): Promise<RewardSettingsSaveDto> {
  const input = parseRewardSettingsInput(body);
  return withLock(SETTINGS_LOCK, () => {
    const db = getDb();
    const before = db.rewardSettings;
    const changes: string[] = [];
    const groups = new Set<string>();
    for (const field of SETTING_FIELDS) {
      if (before[field.key] !== input[field.key]) {
        changes.push(`${field.label} ${field.format(before[field.key])} → ${field.format(input[field.key])}`);
        groups.add(field.group);
      }
    }
    for (const category of OFFER_CATEGORIES) {
      const prev = before.offerCategoryTickets[category];
      const next = input.offerCategoryTickets[category];
      if (prev !== next) {
        changes.push(`案件「${OFFER_CATEGORY_LABELS[category]}」 ${formatNumber(prev)}枚 → ${formatNumber(next)}枚`);
        groups.add("案件");
      }
    }
    if (changes.length > 0) {
      const settings: RewardSettings = { ...input, updatedAt: new Date().toISOString(), updatedBy: admin.nickname };
      db.rewardSettings = settings;
      recordAudit(db, admin, SETTINGS_AUDIT_ACTION, [...groups].join("・"), changes.join(" / "));
    }
    return { settings: db.rewardSettings, changed: changes.length > 0, changes, history: settingsHistory(db) };
  });
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export function listAdminOffers(): AdminOffersDto {
  const db = getDb();
  const today = jstDateKey();
  const stats = new Map<string, AdminOfferDto["completions"]>();
  for (const c of db.offerCompletions) {
    const s = stats.get(c.offerId) ?? { total: 0, today: 0, ticketsTotal: 0 };
    s.total += 1;
    s.ticketsTotal += c.tickets;
    if (jstDateKey(c.createdAt) === today) s.today += 1;
    stats.set(c.offerId, s);
  }
  const offers = [...db.offers.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    .map<AdminOfferDto>((o) => ({
      id: o.id,
      provider: o.provider,
      title: o.title,
      description: o.description,
      category: o.category,
      conditions: o.conditions,
      iconUrl: o.iconUrl,
      estimatedTime: o.estimatedTime,
      active: o.active,
      repeatable: o.repeatable,
      sortOrder: o.sortOrder,
      createdAt: o.createdAt,
      tickets: offerTicketsFor(db.rewardSettings, o.category),
      completions: stats.get(o.id) ?? { total: 0, today: 0, ticketsTotal: 0 },
    }));
  return {
    offers,
    multiplier: db.rewardSettings.offerMultiplier,
    categoryTickets: { ...db.rewardSettings.offerCategoryTickets },
  };
}

type OfferFields = Omit<Offer, "id" | "createdAt">;

/** Validates an offer body. `partial` (PUT) only validates the keys that are present. */
function parseOfferInput(body: Record<string, unknown>, partial: boolean): Partial<OfferFields> {
  const out: Partial<OfferFields> = {};
  const has = (key: string) => !partial || body[key] !== undefined;
  if (has("title")) out.title = vString(body.title, "title", "案件名", { max: 60 });
  if (has("description")) out.description = vString(body.description, "description", "説明", { optional: true, max: 200 });
  if (has("category")) out.category = vOneOf(body.category, "category", "カテゴリ", OFFER_CATEGORIES);
  if (has("conditions")) out.conditions = vString(body.conditions, "conditions", "達成条件", { max: 120 });
  if (has("provider")) out.provider = vOneOf(body.provider, "provider", "提供元", PROVIDERS);
  if (has("estimatedTime")) out.estimatedTime = vString(body.estimatedTime, "estimatedTime", "目安時間", { max: 20 });
  if (body.repeatable !== undefined) out.repeatable = vBool(body.repeatable, "repeatable", "繰り返し設定");
  else if (!partial) out.repeatable = false;
  if (body.active !== undefined) out.active = vBool(body.active, "active", "公開設定");
  else if (!partial) out.active = true;
  if (has("iconUrl")) out.iconUrl = vOptionalUrl(body.iconUrl, "iconUrl", "アイコン画像");
  if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== "") {
    out.sortOrder = vInt(body.sortOrder, "sortOrder", "表示順", { min: 0, max: 9999 });
  }
  return out;
}

function offerSummary(db: Db, offer: Offer): string {
  return `${OFFER_PROVIDER_LABELS[offer.provider]} / ${OFFER_CATEGORY_LABELS[offer.category]} / ${formatNumber(offerTicketsFor(db.rewardSettings, offer.category))}枚${offer.repeatable ? " / 毎日" : ""}`;
}

export async function createOffer(admin: User, body: Record<string, unknown>): Promise<Offer> {
  const fields = parseOfferInput(body, false) as OfferFields & { sortOrder?: number };
  return withLock(OFFERS_LOCK, () => {
    const db = getDb();
    const maxOrder = Math.max(0, ...[...db.offers.values()].map((o) => o.sortOrder));
    const offer: Offer = {
      id: newId("of"),
      provider: fields.provider,
      title: fields.title,
      description: fields.description,
      category: fields.category,
      conditions: fields.conditions,
      iconUrl: fields.iconUrl ?? null,
      estimatedTime: fields.estimatedTime,
      active: fields.active,
      repeatable: fields.repeatable,
      sortOrder: fields.sortOrder ?? maxOrder + 1,
      createdAt: new Date().toISOString(),
    };
    db.offers.set(offer.id, offer);
    recordAudit(db, admin, "案件を追加", offer.title, offerSummary(db, offer));
    return offer;
  });
}

const OFFER_FIELD_LABELS: Record<keyof OfferFields, string> = {
  provider: "提供元",
  title: "案件名",
  description: "説明",
  category: "カテゴリ",
  conditions: "達成条件",
  iconUrl: "アイコン",
  estimatedTime: "目安時間",
  active: "公開設定",
  repeatable: "繰り返し設定",
  sortOrder: "表示順",
};

export async function updateOffer(admin: User, id: string, body: Record<string, unknown>): Promise<Offer> {
  const fields = parseOfferInput(body, true);
  return withLocks([OFFERS_LOCK, offerLock(id)], () => {
    const db = getDb();
    const offer = db.offers.get(id);
    if (!offer) throw notFoundError("案件");
    const changed = (Object.keys(fields) as Array<keyof OfferFields>).filter((key) => fields[key] !== offer[key]);
    if (changed.length === 0) return offer;
    Object.assign(offer, fields);
    if (changed.length === 1 && changed[0] === "active") {
      recordAudit(db, admin, offer.active ? "案件を公開" : "案件を停止", offer.title, offerSummary(db, offer));
    } else {
      recordAudit(db, admin, "案件を編集", offer.title, `変更: ${changed.map((k) => OFFER_FIELD_LABELS[k]).join("・")}`);
    }
    return offer;
  });
}

export async function deleteOffer(admin: User, id: string): Promise<{ id: string; completions: number }> {
  return withLocks([OFFERS_LOCK, offerLock(id)], () => {
    const db = getDb();
    const offer = db.offers.get(id);
    if (!offer) throw notFoundError("案件");
    const completions = db.offerCompletions.filter((c) => c.offerId === id).length;
    db.offers.delete(id);
    recordAudit(db, admin, "案件を削除", offer.title, `達成履歴 ${formatNumber(completions)}件とチケット付与履歴は保持`);
    return { id, completions };
  });
}

// ---------------------------------------------------------------------------
// Postback log
// ---------------------------------------------------------------------------

const KINDS: readonly PostbackKind[] = ["video", "offer"];
const STATUSES = Object.keys(POSTBACK_STATUS_LABELS) as PostbackStatus[];
const SOURCES: ReadonlyArray<PostbackLog["source"]> = ["simulator", "external", "admin_test"];

export function parsePostbackFilter(input: Record<string, string | string[] | undefined>): PostbackFilterDto {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const kind = one(input.kind);
  const status = one(input.status);
  const source = one(input.source);
  const provider = one(input.provider);
  return {
    kind: (KINDS as readonly string[]).includes(kind) ? (kind as PostbackKind) : "",
    status: (STATUSES as readonly string[]).includes(status) ? (status as PostbackStatus) : "",
    provider: ["admob", "skyflag", "tapjoy"].includes(provider) ? provider : "",
    source: (SOURCES as readonly string[]).includes(source) ? (source as PostbackLog["source"]) : "",
    q: one(input.q).trim().slice(0, 100),
  };
}

export function toPostbackLogDto(db: Db, log: PostbackLog): PostbackLogDto {
  const user = log.userId ? db.users.get(log.userId) : undefined;
  return { ...log, userNickname: user?.nickname ?? null };
}

function postbackKpis(db: Db, now = Date.now()): PostbackKpisDto {
  const start = startOfJstDay(now).toISOString();
  const kpis: PostbackKpisDto = {
    todayReceived: 0,
    todayGranted: 0,
    todayTickets: 0,
    todayRejected: 0,
    todayDuplicates: 0,
    todayByStatus: {},
    total: db.postbacks.length,
  };
  for (let i = db.postbacks.length - 1; i >= 0; i--) {
    const log = db.postbacks[i];
    if (log.receivedAt < start) break;
    kpis.todayReceived += 1;
    kpis.todayByStatus[log.status] = (kpis.todayByStatus[log.status] ?? 0) + 1;
    if (log.status === "granted") {
      kpis.todayGranted += 1;
      kpis.todayTickets += log.ticketsGranted;
    } else if (log.status === "duplicate") {
      kpis.todayDuplicates += 1;
    } else {
      kpis.todayRejected += 1;
    }
  }
  return kpis;
}

/** Newest first, filtered and paginated (GET /api/admin/postbacks and the admin page). */
export function listPostbacks(filter: PostbackFilterDto, page = 1, pageSize = 50): PostbackListDto {
  const db = getDb();
  const q = filter.q.toLowerCase();
  const matches: PostbackLog[] = [];
  for (let i = db.postbacks.length - 1; i >= 0; i--) {
    const log = db.postbacks[i];
    if (filter.kind && log.kind !== filter.kind) continue;
    if (filter.status && log.status !== filter.status) continue;
    if (filter.provider && log.provider !== filter.provider) continue;
    if (filter.source && log.source !== filter.source) continue;
    if (q) {
      const user = log.userId ? db.users.get(log.userId) : undefined;
      const haystack = [log.id, log.transactionId, log.userId, user?.nickname, user?.email, log.params.offer_id, log.params.custom_data]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) continue;
    }
    matches.push(log);
  }
  const size = Math.min(200, Math.max(10, Math.floor(pageSize) || 50));
  const pageCount = Math.max(1, Math.ceil(matches.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return {
    rows: matches.slice((current - 1) * size, current * size).map((log) => toPostbackLogDto(db, log)),
    total: matches.length,
    page: current,
    pageCount,
    pageSize: size,
    filter,
    kpis: postbackKpis(db),
  };
}

export function webhookEndpoints(origin: string): WebhookEndpointDto[] {
  return [
    {
      key: "admob",
      label: "Google AdMob（リワード動画）",
      provider: "admob",
      method: "GET",
      url: `${origin}${ADMOB_WEBHOOK_PATH}`,
      note: "AdMob管理画面の広告ユニット設定「サーバーサイド認証（SSV）のコールバックURL」に登録します。",
    },
    {
      key: "skyflag",
      label: "skyflag（オファーウォール）",
      provider: "skyflag",
      method: "GET / POST",
      url: `${origin}${offerwallWebhookPath("skyflag")}`,
      note: "skyflag管理画面の成果通知（ポストバック）URLに登録します。",
    },
    {
      key: "tapjoy",
      label: "Tapjoy（オファーウォール）",
      provider: "tapjoy",
      method: "GET / POST",
      url: `${origin}${offerwallWebhookPath("tapjoy")}`,
      note: "Tapjoyダッシュボードの Callback URL に登録します。",
    },
  ];
}

export function postbackTestOptions(): PostbackTestOptionsDto {
  const db = getDb();
  const priority = (u: User) => (u.id === "u_demo" ? 0 : u.id === "u_admin" ? 1 : 2);
  const users = visibleUsers(db)
    .sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id))
    .map((u) => ({
      id: u.id,
      label: `${u.nickname}（${u.email}）`,
      videoToday: getVideoStatus(u).todayCount,
      tickets: u.tickets,
    }));
  const offers = [...db.offers.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({ id: o.id, title: o.title, provider: o.provider, repeatable: o.repeatable, active: o.active }));
  return { users, offers, videoDailyLimit: db.rewardSettings.videoDailyLimit };
}

// ---------------------------------------------------------------------------
// テスト送信 — real HTTP requests to our own webhook endpoints
// ---------------------------------------------------------------------------

const TEST_KINDS: readonly PostbackTestKind[] = ["video", "offer"];
const TEST_SCENARIOS: readonly PostbackTestScenario[] = ["valid", "bad_signature", "expired", "duplicate", "limit"];
const TEN_MINUTES = 10 * 60_000;

/** Server-internal base URL for the loopback request (fixed, so the Host header can't redirect it). */
function loopbackBase(): string {
  return process.env.WEBHOOK_TEST_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;
}

interface Delivery {
  httpStatus: number;
  body: unknown;
  transport: "http" | "in-process";
  log: PostbackLog | null;
}

function findPostbackById(db: Db, id: string): PostbackLog | null {
  for (let i = db.postbacks.length - 1; i >= 0; i--) if (db.postbacks[i].id === id) return db.postbacks[i];
  return null;
}

/**
 * Sends the notification to the real webhook route over HTTP; falls back to the in-process handler.
 * With a shared state store (Vercel) the loopback could reach another instance — or wait on this
 * request's own state lock — so the handler runs in-process there.
 */
async function deliver(kind: PostbackTestKind, provider: string, params: Record<string, string>): Promise<Delivery> {
  if (!statePersistenceEnabled()) {
    const path = kind === "video" ? ADMOB_WEBHOOK_PATH : offerwallWebhookPath(provider);
    const url = `${loopbackBase()}${path}?${new URLSearchParams(params).toString()}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { [TEST_NONCE_HEADER]: issueTestNonce(), "user-agent": "POIGACHA-Admin-WebhookTest/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => null)) as { postbackId?: unknown } | null;
      const id = body && typeof body.postbackId === "string" ? body.postbackId : null;
      return { httpStatus: res.status, body, transport: "http", log: id ? findPostbackById(getDb(), id) : null };
    } catch {
      // Fall through to the in-process handler.
    }
  }
  const ctx = { method: "GET" as const, source: "admin_test" as const };
  const outcome: WebhookOutcome =
    kind === "video" ? await processVideoCallback(params, ctx) : await processOfferPostback(provider, params, ctx);
  return { httpStatus: outcome.httpStatus, body: outcome.body, transport: "in-process", log: outcome.log };
}

/** Creates a started ad session for the test (as if an ad had just been served). */
async function createTestSession(userId: string) {
  return withLocks([lockKeys.user(userId)], () => {
    const session = {
      id: newId("as"),
      userId,
      network: "admob" as const,
      status: "started" as const,
      // Pretend the ad started 16 seconds ago (a full 15-second view).
      createdAt: new Date(Date.now() - 16_000).toISOString(),
      completedAt: null,
      transactionId: null,
      tickets: 0,
    };
    getDb().adSessions.set(session.id, session);
    return session;
  });
}

function latestGranted(db: Db, kind: PostbackKind, userId: string): PostbackLog | undefined {
  let fallback: PostbackLog | undefined;
  for (let i = db.postbacks.length - 1; i >= 0; i--) {
    const log = db.postbacks[i];
    if (log.kind !== kind || log.status !== "granted" || !log.params.signature) continue;
    if (log.userId === userId) return log;
    fallback ??= log;
  }
  return fallback;
}

export async function runPostbackTest(admin: User, body: Record<string, unknown>, publicOrigin: string): Promise<PostbackTestResultDto> {
  const kind = vOneOf(body.kind ?? "video", "kind", "通知の種類", TEST_KINDS);
  const scenario = vOneOf(body.scenario, "scenario", "シナリオ", TEST_SCENARIOS);
  const userId = vString(body.userId ?? "u_demo", "userId", "対象ユーザー", { max: 64 });
  const offerId = vString(body.offerId, "offerId", "案件", { optional: true, max: 64 });
  const input: PostbackTestInput = { kind, scenario, userId, offerId: offerId || undefined };

  const db = getDb();
  const user = db.users.get(input.userId!);
  if (!user || user.isVirtual) throw new ApiError(404, "NOT_FOUND", "対象ユーザーが見つかりません");

  const notes: string[] = [];
  const warmup: PostbackTestResultDto["warmup"] = [];
  let provider = "admob";
  let params: Record<string, string>;

  if (kind === "video") {
    if (scenario === "duplicate") {
      const previous = latestGranted(db, "video", user.id);
      if (!previous) throw new ApiError(409, "NO_PREVIOUS", "再送できる付与済みの通知がありません。先に「正常」を送信してください。");
      params = resign("admob", { ...previous.params, timestamp: String(Date.now()) });
      notes.push(`付与済みの transaction_id「${previous.transactionId}」をそのまま再送しました（再送時刻で再署名）。`);
    } else {
      if (scenario === "limit") {
        const status = getVideoStatus(user);
        const fill = Math.min(status.remaining, 100);
        for (let i = 0; i < fill; i++) {
          const session = await createTestSession(user.id);
          const res = await deliver("video", "admob", buildAdmobCallback(session));
          warmup.push({ status: res.log?.status ?? "granted", httpStatus: res.httpStatus, tickets: res.log?.ticketsGranted ?? 0 });
        }
        notes.push(
          fill > 0
            ? `本日の残り${fill}回分を正常な通知で消化してから、上限を超える通知を送信しました。`
            : `本日はすでに上限（${status.dailyLimit}回）に達しているため、そのまま通知を送信しました。`,
        );
      }
      const session = await createTestSession(user.id);
      if (scenario === "expired") {
        params = buildAdmobCallback(session, { timestampMs: Date.now() - TEN_MINUTES });
        notes.push("timestamp を10分前の時刻にして送信しました（古い通知の再送・リプレイを再現）。");
      } else {
        params = buildAdmobCallback(session);
        if (scenario === "bad_signature") {
          const original = params.reward_amount;
          params = { ...params, reward_amount: "100" };
          notes.push(`署名後に reward_amount を「${original}」→「100」に書き換えて送信しました（改ざんを再現）。`);
        } else if (scenario === "valid") {
          notes.push("広告ネットワークと同じ形式・同じ秘密鍵で署名した正しい通知を送信しました。");
        }
      }
    }
  } else {
    const activeOffers = [...db.offers.values()].filter((o) => o.active).sort((a, b) => a.sortOrder - b.sortOrder);
    const selected = input.offerId ? db.offers.get(input.offerId) : undefined;
    if (input.offerId && !selected) throw new ApiError(404, "NOT_FOUND", "案件が見つかりません");
    if (scenario === "duplicate") {
      const previous = latestGranted(db, "offer", user.id);
      if (!previous) throw new ApiError(409, "NO_PREVIOUS", "再送できる付与済みの通知がありません。先に「正常」を送信してください。");
      provider = previous.provider;
      params = resign(provider as OfferProvider, { ...previous.params, ts: String(Math.floor(Date.now() / 1000)) });
      notes.push(`付与済みの tid「${previous.transactionId}」をそのまま再送しました（再送時刻で再署名）。`);
    } else {
      let offer: Offer | undefined;
      if (scenario === "limit") {
        offer = selected ?? activeOffers.find((o) => offerCompletionState(db, user.id, o).completed);
        if (!offer) {
          throw new ApiError(409, "NO_COMPLETED_OFFER", "このユーザーには達成済みの案件がありません。先に「正常」を送信してください。");
        }
        notes.push(`達成済みの案件「${offer.title}」の成果通知を、新しい tid で送信しました。`);
      } else {
        offer = selected ?? activeOffers.find((o) => !offerCompletionState(db, user.id, o).completed) ?? activeOffers[0];
        if (!offer) throw new ApiError(409, "NO_OFFER", "掲載中の案件がありません");
      }
      provider = offer.provider;
      params = buildOfferPostback(offer, user.id, scenario === "expired" ? { timestampMs: Date.now() - TEN_MINUTES } : {});
      if (scenario === "expired") notes.push("ts を10分前の時刻にして送信しました（古い通知の再送・リプレイを再現）。");
      if (scenario === "bad_signature") {
        const original = params.payout;
        params = { ...params, payout: "99999" };
        notes.push(`署名後に payout を「${original}」→「99999」に書き換えて送信しました（改ざんを再現）。`);
      }
      if (scenario === "valid") notes.push(`案件「${offer.title}」（${OFFER_PROVIDER_LABELS[offer.provider]}）の正しい成果通知を送信しました。`);
    }
  }

  const delivery = await deliver(kind, provider, params);
  if (delivery.transport === "in-process") {
    notes.push("HTTPでの送信に失敗したため、同じ処理関数をサーバー内で直接実行しました。");
  }
  const path = kind === "video" ? ADMOB_WEBHOOK_PATH : offerwallWebhookPath(provider);
  const fresh = getDb();
  const label = kind === "video" ? "リワード動画" : "オファーウォール";
  const scenarioLabel: Record<PostbackTestScenario, string> = {
    valid: "正常",
    bad_signature: "署名不正",
    expired: "期限切れ",
    duplicate: "重複",
    limit: kind === "video" ? "上限超過" : "達成済み",
  };
  recordAudit(
    fresh,
    admin,
    "成果通知をテスト送信",
    `${label}・${scenarioLabel[scenario]}`,
    `${user.nickname} → HTTP ${delivery.httpStatus}${delivery.log ? `（${POSTBACK_STATUS_LABELS[delivery.log.status]}）` : ""}`,
  );
  return {
    kind,
    scenario,
    request: { method: "GET", url: `${publicOrigin}${path}?${new URLSearchParams(params).toString()}`, params },
    response: { httpStatus: delivery.httpStatus, body: delivery.body },
    transport: delivery.transport,
    log: delivery.log ? toPostbackLogDto(fresh, delivery.log) : null,
    notes,
    warmup,
  };
}
