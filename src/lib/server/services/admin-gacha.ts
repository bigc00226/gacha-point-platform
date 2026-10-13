import "server-only";
import type { Gacha, GachaStatus, LastOnePrize, Prize, PrizeType, User } from "@/lib/types";
import { GACHA_STATUS_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { assignedPpb, parseProbability, ppbToPercent, PPB } from "@/lib/probability";
import { jstDateKey } from "@/lib/time";
import { recordAudit } from "../audit";
import { ApiError } from "../http";
import { newId } from "../ids";
import { lockKeys, withLock, withLocks } from "../lock";
import { drawPrizes, secureRandomInt } from "../lottery";
import { getDb, prizeRanks, prizesOfGacha, visibleGachas } from "../store";
import { validationFail, vBool, vInt, vOneOf, vOptionalDate, vOptionalUrl, vString } from "../validate";

// ---------------------------------------------------------------------------
// DTOs (client-safe shapes; mirrored in components/admin/gacha/types.ts)
// ---------------------------------------------------------------------------

export interface AdminGachaRowDto {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  status: GachaStatus;
  badge: string | null;
  featured: boolean;
  ticketCost: number;
  totalSlots: number;
  remainingSlots: number;
  prizeCount: number;
  lastOnePrizeName: string | null;
  lastOneWinner: { nickname: string; at: string } | null;
  endsAt: string | null;
  sortOrder: number;
  updatedAt: string;
  slotsToday: number;
}

export interface PrizeEditDto {
  id: string | null;
  rankId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  type: PrizeType;
  pointValue: number;
  probabilityInput: string;
  isFallback: boolean;
  stock: number | null;
  wonCount: number;
}

export interface GachaEditDto {
  id: string | null;
  title: string;
  subtitle: string;
  description: string;
  thumbnailUrl: string | null;
  ticketCost: number;
  totalSlots: number;
  remainingSlots: number;
  status: GachaStatus;
  badge: string | null;
  featured: boolean;
  sortOrder: number;
  endsAt: string | null;
  lastOnePrize: LastOnePrize | null;
  lastOneWinner: { nickname: string; at: string } | null;
  prizes: PrizeEditDto[];
}

export interface SimulationRowDto {
  key: string;
  name: string;
  rankName: string;
  rankColor: string;
  isFallback: boolean;
  stockLeft: number | null;
  configuredPpb: number;
  observed: number;
}

export interface SimulationDto {
  count: number;
  ms: number;
  rows: SimulationRowDto[];
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listAdminGachas(): AdminGachaRowDto[] {
  const db = getDb();
  const today = jstDateKey();
  const slotsToday = new Map<string, number>();
  for (let i = db.draws.length - 1; i >= 0; i--) {
    const d = db.draws[i];
    if (jstDateKey(d.createdAt) !== today) break;
    slotsToday.set(d.gachaId, (slotsToday.get(d.gachaId) ?? 0) + d.count);
  }
  return visibleGachas(db).map((g) => ({
    id: g.id,
    title: g.title,
    subtitle: g.subtitle,
    thumbnailUrl: g.thumbnailUrl,
    status: g.status,
    badge: g.badge,
    featured: g.featured,
    ticketCost: g.ticketCost,
    totalSlots: g.totalSlots,
    remainingSlots: g.remainingSlots,
    prizeCount: prizesOfGacha(db, g.id).length,
    lastOnePrizeName: g.lastOnePrize?.name ?? null,
    lastOneWinner: g.lastOneWinner ? { nickname: g.lastOneWinner.nickname, at: g.lastOneWinner.at } : null,
    endsAt: g.endsAt,
    sortOrder: g.sortOrder,
    updatedAt: g.updatedAt,
    slotsToday: slotsToday.get(g.id) ?? 0,
  }));
}

function toPrizeEdit(p: Prize): PrizeEditDto {
  return {
    id: p.id,
    rankId: p.rankId,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    type: p.type,
    pointValue: p.pointValue,
    probabilityInput: p.isFallback ? "" : p.probabilityInput || ppbToPercent(p.probabilityPpb, 6),
    isFallback: p.isFallback,
    stock: p.stock,
    wonCount: p.wonCount,
  };
}

export function getGachaEdit(id: string): GachaEditDto | null {
  const db = getDb();
  const g = db.gachas.get(id);
  if (!g || g.isSandbox) return null;
  return {
    id: g.id,
    title: g.title,
    subtitle: g.subtitle,
    description: g.description,
    thumbnailUrl: g.thumbnailUrl,
    ticketCost: g.ticketCost,
    totalSlots: g.totalSlots,
    remainingSlots: g.remainingSlots,
    status: g.status,
    badge: g.badge,
    featured: g.featured,
    sortOrder: g.sortOrder,
    endsAt: g.endsAt,
    lastOnePrize: g.lastOnePrize ? { ...g.lastOnePrize } : null,
    lastOneWinner: g.lastOneWinner ? { nickname: g.lastOneWinner.nickname, at: g.lastOneWinner.at } : null,
    prizes: prizesOfGacha(db, g.id).map(toPrizeEdit),
  };
}

/** Defaults for a new gacha: one prize per rank, the lowest rank receives the remaining probability. */
export function newGachaTemplate(): GachaEditDto {
  const db = getDb();
  const ranks = prizeRanks(db);
  const samples: Array<Partial<PrizeEditDto>> = [
    { name: "10,000pt", type: "point", pointValue: 10_000, probabilityInput: "1/1000" },
    { name: "3,000pt", type: "point", pointValue: 3_000, probabilityInput: "1/200" },
    { name: "1,000pt", type: "point", pointValue: 1_000, probabilityInput: "1/50" },
    { name: "100pt", type: "point", pointValue: 100, probabilityInput: "1/10" },
    { name: "10pt", type: "point", pointValue: 10, probabilityInput: "" },
  ];
  const prizes: PrizeEditDto[] = ranks.slice(0, samples.length).map((rank, i) => ({
    id: null,
    rankId: rank.id,
    name: samples[i].name!,
    description: "",
    imageUrl: i === 0 ? "/demo/prize/coin-xl.svg" : i === 1 ? "/demo/prize/coin-l.svg" : "/demo/prize/coin-m.svg",
    type: "point",
    pointValue: samples[i].pointValue!,
    probabilityInput: samples[i].probabilityInput!,
    isFallback: false,
    stock: null,
    wonCount: 0,
  }));
  if (prizes.length > 0) {
    const last = prizes[prizes.length - 1];
    last.isFallback = true;
    last.probabilityInput = "";
    last.imageUrl = "/demo/prize/coin-s.svg";
  }
  return {
    id: null,
    title: "",
    subtitle: "",
    description: "",
    thumbnailUrl: null,
    ticketCost: 1,
    totalSlots: 10_000,
    remainingSlots: 10_000,
    status: "draft",
    badge: null,
    featured: false,
    sortOrder: Math.max(0, ...visibleGachas(db).map((g) => g.sortOrder)) + 1,
    endsAt: null,
    lastOnePrize: { name: "50,000pt", description: "最後の1口を引いた方に贈呈します。", imageUrl: "/demo/prize/coin-xl.svg", type: "point", pointValue: 50_000 },
    lastOneWinner: null,
    prizes,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const PRIZE_TYPES: PrizeType[] = ["point", "digital", "physical"];
const EDITABLE_STATUSES: GachaStatus[] = ["draft", "active", "paused"];

interface ParsedPrize {
  id: string | null;
  rankId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  type: PrizeType;
  pointValue: number;
  probabilityPpb: number;
  probabilityInput: string;
  isFallback: boolean;
  stock: number | null;
}

function parsePrizes(raw: unknown, existing: Map<string, Prize>): ParsedPrize[] {
  const db = getDb();
  if (!Array.isArray(raw) || raw.length === 0) validationFail("prizes", "景品を1つ以上登録してください");
  if (raw.length > 30) validationFail("prizes", "景品は30件まで登録できます");
  const prizes = (raw as Array<Record<string, unknown>>).map((p, i): ParsedPrize => {
    const f = (name: string) => `prizes.${i}.${name}`;
    const rankId = vString(p.rankId, f("rankId"), "ランク");
    const rank = db.ranks.get(rankId);
    if (!rank || rank.isLastOne) validationFail(f("rankId"), "ランクを選択してください");
    const type = vOneOf(p.type, f("type"), "景品の種類", PRIZE_TYPES);
    const pointValue = vInt(p.pointValue ?? 0, f("pointValue"), "ポイント", { min: type === "point" ? 1 : 0, max: 10_000_000 });
    const isFallback = vBool(p.isFallback ?? false, f("isFallback"), "残り確率");
    const id = typeof p.id === "string" && existing.has(p.id) ? p.id : null;
    let probabilityPpb = 0;
    let probabilityInput = "";
    if (!isFallback) {
      const parsed = parseProbability(typeof p.probabilityInput === "string" ? p.probabilityInput : "");
      if (!parsed.ok) validationFail(f("probabilityInput"), parsed.error);
      probabilityPpb = parsed.ppb;
      probabilityInput = parsed.normalized;
    }
    const stockRaw = p.stock;
    const stock = stockRaw === null || stockRaw === undefined || stockRaw === "" ? null : vInt(stockRaw, f("stock"), "在庫", { min: 0, max: 10_000_000 });
    if (isFallback && stock !== null) validationFail(f("stock"), "「残り確率」の景品は在庫を無制限にしてください");
    const won = id ? existing.get(id)!.wonCount : 0;
    if (stock !== null && stock < won) validationFail(f("stock"), `在庫は当選済みの数（${won}）以上にしてください`);
    return {
      id,
      rankId,
      name: vString(p.name, f("name"), "景品名", { max: 60 }),
      description: vString(p.description, f("description"), "説明", { optional: true, max: 200 }),
      imageUrl: vOptionalUrl(p.imageUrl, f("imageUrl"), "画像"),
      type,
      pointValue,
      probabilityPpb,
      probabilityInput,
      isFallback,
      stock,
    };
  });
  const fallbacks = prizes.filter((p) => p.isFallback).length;
  if (fallbacks !== 1) validationFail("prizes", "「残り確率」を割り当てる景品を1つだけ選んでください");
  const assigned = assignedPpb(prizes);
  if (assigned > PPB) {
    validationFail("prizes", `確率の合計が100%を超えています（${ppbToPercent(assigned, 4)}）。確率を見直してください`);
  }
  return prizes;
}

function parseLastOne(raw: unknown): LastOnePrize | null {
  if (raw === null || raw === undefined) return null;
  const p = raw as Record<string, unknown>;
  const type = vOneOf(p.type, "lastOnePrize.type", "ラストワン賞の種類", PRIZE_TYPES);
  return {
    name: vString(p.name, "lastOnePrize.name", "ラストワン賞の名称", { max: 60 }),
    description: vString(p.description, "lastOnePrize.description", "ラストワン賞の説明", { optional: true, max: 200 }),
    imageUrl: vOptionalUrl(p.imageUrl, "lastOnePrize.imageUrl", "ラストワン賞の画像"),
    type,
    pointValue: vInt(p.pointValue ?? 0, "lastOnePrize.pointValue", "ラストワン賞のポイント", { min: type === "point" ? 1 : 0, max: 10_000_000 }),
  };
}

function parseGachaInput(body: Record<string, unknown>, existing: Map<string, Prize>) {
  const totalSlots = vInt(body.totalSlots, "totalSlots", "総口数", { min: 1, max: 10_000_000 });
  const remainingSlots = vInt(body.remainingSlots ?? totalSlots, "remainingSlots", "残り口数", { min: 0, max: totalSlots });
  const badge = vString(body.badge, "badge", "バッジ", { optional: true, max: 20 });
  return {
    title: vString(body.title, "title", "ガチャ名", { max: 60 }),
    subtitle: vString(body.subtitle, "subtitle", "キャッチコピー", { optional: true, max: 60 }),
    description: vString(body.description, "description", "説明", { optional: true, max: 2000 }),
    thumbnailUrl: vOptionalUrl(body.thumbnailUrl, "thumbnailUrl", "サムネイル"),
    ticketCost: vInt(body.ticketCost, "ticketCost", "1回あたりのチケット", { min: 1, max: 1000 }),
    totalSlots,
    remainingSlots,
    status: vOneOf(body.status, "status", "公開状態", EDITABLE_STATUSES),
    badge: badge || null,
    featured: vBool(body.featured ?? false, "featured", "注目"),
    sortOrder: vInt(body.sortOrder ?? 0, "sortOrder", "表示順", { min: -1000, max: 100_000 }),
    endsAt: vOptionalDate(body.endsAt, "endsAt", "販売終了日時"),
    lastOnePrize: parseLastOne(body.lastOnePrize),
    prizes: parsePrizes(body.prizes, existing),
  };
}

function writePrizes(gachaId: string, parsed: ParsedPrize[], existing: Map<string, Prize>) {
  const db = getDb();
  const keep = new Set(parsed.map((p) => p.id).filter(Boolean) as string[]);
  for (const id of existing.keys()) if (!keep.has(id)) db.prizes.delete(id);
  parsed.forEach((p, i) => {
    const id = p.id ?? `p_${newId("x").slice(2)}`;
    const prev = p.id ? existing.get(p.id) : undefined;
    db.prizes.set(id, {
      id,
      gachaId,
      rankId: p.rankId,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      type: p.type,
      pointValue: p.pointValue,
      probabilityPpb: p.probabilityPpb,
      probabilityInput: p.probabilityInput,
      isFallback: p.isFallback,
      stock: p.stock,
      wonCount: prev?.wonCount ?? 0,
      sortOrder: i + 1,
    });
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createGacha(admin: User, body: Record<string, unknown>): Promise<Gacha> {
  const input = parseGachaInput(body, new Map());
  const id = `g_${newId("x").slice(2, 12)}`;
  return withLocks([lockKeys.gacha(id)], () => {
    const db = getDb();
    const now = new Date().toISOString();
    const { prizes, ...fields } = input;
    const gacha: Gacha = {
      id,
      ...fields,
      status: fields.remainingSlots === 0 ? "soldout" : fields.status,
      lastOneWinner: null,
      createdAt: now,
      updatedAt: now,
    };
    db.gachas.set(id, gacha);
    writePrizes(id, prizes, new Map());
    recordAudit(db, admin, "ガチャを作成", gacha.title, `総口数 ${formatNumber(gacha.totalSlots)}口 / 1回 ${gacha.ticketCost}チケット / 景品 ${prizes.length}件`);
    return gacha;
  });
}

export async function updateGacha(admin: User, id: string, body: Record<string, unknown>): Promise<Gacha> {
  return withLocks([lockKeys.gacha(id)], () => {
    const db = getDb();
    const gacha = db.gachas.get(id);
    if (!gacha || gacha.isSandbox) throw new ApiError(404, "NOT_FOUND", "ガチャが見つかりません");
    const existing = new Map(prizesOfGacha(db, id).map((p) => [p.id, p]));
    const input = parseGachaInput(body, existing);
    const { prizes, ...fields } = input;
    const notes: string[] = [];
    if (gacha.remainingSlots !== fields.remainingSlots) notes.push(`残り口数 ${formatNumber(gacha.remainingSlots)} → ${formatNumber(fields.remainingSlots)}`);
    if (gacha.status !== fields.status) notes.push(`状態 ${GACHA_STATUS_LABELS[gacha.status]} → ${GACHA_STATUS_LABELS[fields.status]}`);

    let status: GachaStatus = fields.status;
    let lastOneWinner = gacha.lastOneWinner;
    if (fields.remainingSlots === 0) {
      status = "soldout";
    } else if (gacha.status === "soldout" || gacha.remainingSlots === 0) {
      // Reopened (e.g. slots added back): the previous last-one result no longer applies.
      lastOneWinner = null;
      notes.push("販売を再開");
    }
    Object.assign(gacha, fields, { status, lastOneWinner, updatedAt: new Date().toISOString() });
    writePrizes(id, prizes, existing);
    recordAudit(db, admin, "ガチャを更新", gacha.title, notes.join(" / ") || `景品 ${prizes.length}件`);
    return gacha;
  });
}

export async function deleteGacha(admin: User, id: string): Promise<void> {
  await withLocks([lockKeys.gacha(id)], () => {
    const db = getDb();
    const gacha = db.gachas.get(id);
    if (!gacha || gacha.isSandbox) throw new ApiError(404, "NOT_FOUND", "ガチャが見つかりません");
    for (const p of prizesOfGacha(db, id)) db.prizes.delete(p.id);
    db.gachas.delete(id);
    recordAudit(db, admin, "ガチャを削除", gacha.title, "抽選履歴・付与履歴は保持");
  });
}

export async function duplicateGacha(admin: User, id: string): Promise<Gacha> {
  const source = getGachaEdit(id);
  if (!source) throw new ApiError(404, "NOT_FOUND", "ガチャが見つかりません");
  const copy = await createGacha(admin, {
    ...source,
    title: `${source.title}（コピー）`.slice(0, 60),
    status: "draft",
    remainingSlots: source.totalSlots,
    prizes: source.prizes.map((p) => ({ ...p, id: null })),
  } as unknown as Record<string, unknown>);
  return copy;
}

export async function setGachaStatus(admin: User, id: string, status: unknown): Promise<Gacha> {
  const next = vOneOf(status, "status", "公開状態", EDITABLE_STATUSES);
  return withLocks([lockKeys.gacha(id)], () => {
    const db = getDb();
    const gacha = db.gachas.get(id);
    if (!gacha || gacha.isSandbox) throw new ApiError(404, "NOT_FOUND", "ガチャが見つかりません");
    if (gacha.status === "soldout") throw new ApiError(409, "SOLD_OUT", "完売したガチャは残り口数を追加してから公開してください");
    const before = gacha.status;
    gacha.status = next;
    gacha.updatedAt = new Date().toISOString();
    recordAudit(db, admin, "ガチャの公開状態を変更", gacha.title, `${GACHA_STATUS_LABELS[before]} → ${GACHA_STATUS_LABELS[next]}`);
    return gacha;
  });
}

/** Runs `count` draws with the given (possibly unsaved) prize settings. Nothing is written. */
export async function simulateGacha(body: Record<string, unknown>): Promise<SimulationDto> {
  const db = getDb();
  const gachaId = typeof body.gachaId === "string" ? body.gachaId : null;
  const existing = new Map(gachaId ? prizesOfGacha(db, gachaId).map((p) => [p.id, p]) : []);
  const prizes = parsePrizes(body.prizes, existing);
  const count = vInt(body.count ?? 100_000, "count", "回数", { min: 1000, max: 1_000_000 });
  const candidates = prizes.map((p, i) => {
    const won = p.id ? existing.get(p.id)!.wonCount : 0;
    return {
      key: String(i),
      p,
      stockLeft: p.stock === null ? null : Math.max(0, p.stock - won),
    };
  });
  const started = performance.now();
  const picks = await withLock("simulation", () =>
    drawPrizes(
      candidates.map((c) => ({ id: c.key, probabilityPpb: c.p.probabilityPpb, isFallback: c.p.isFallback, stockLeft: c.stockLeft })),
      count,
      secureRandomInt,
    ),
  );
  const ms = performance.now() - started;
  const observed = new Map<string, number>();
  for (const k of picks) observed.set(k, (observed.get(k) ?? 0) + 1);
  const assigned = assignedPpb(prizes);
  return {
    count,
    ms: Number(ms.toFixed(1)),
    rows: candidates.map((c) => {
      const rank = db.ranks.get(c.p.rankId);
      return {
        key: c.key,
        name: c.p.name,
        rankName: rank?.name ?? "",
        rankColor: rank?.color ?? "#999999",
        isFallback: c.p.isFallback,
        stockLeft: c.stockLeft,
        configuredPpb: c.p.isFallback ? PPB - assigned : c.p.probabilityPpb,
        observed: observed.get(c.key) ?? 0,
      };
    }),
  };
}
