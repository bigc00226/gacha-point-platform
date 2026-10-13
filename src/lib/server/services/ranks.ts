import "server-only";
import type { BuiltinEffectStyle, EffectType, Rank, User } from "@/lib/types";
import { BUILTIN_EFFECT_LABELS, EFFECT_TYPE_LABELS } from "@/lib/constants";
import { recordAudit } from "../audit";
import { ApiError } from "../http";
import { newId } from "../ids";
import { withLock } from "../lock";
import { getDb, sortedRanks } from "../store";
import { validationFail, vOneOf, vOptionalUrl, vString } from "../validate";

/** Ranks (特賞 / A賞 ... / ラストワン賞) with their logo and win effect. */
export interface RankAdminDto extends Rank {
  prizeCount: number;
}

const EFFECT_TYPES: EffectType[] = ["builtin", "video", "lottie"];
const BUILTIN_STYLES = Object.keys(BUILTIN_EFFECT_LABELS) as BuiltinEffectStyle[];
const LOCK = "ranks";

export function listRanksAdmin(): RankAdminDto[] {
  const db = getDb();
  const counts = new Map<string, number>();
  for (const p of db.prizes.values()) {
    const g = db.gachas.get(p.gachaId);
    if (g && !g.isSandbox) counts.set(p.rankId, (counts.get(p.rankId) ?? 0) + 1);
  }
  return sortedRanks(db).map((r) => ({ ...r, prizeCount: counts.get(r.id) ?? 0 }));
}

function parseRankInput(body: Record<string, unknown>) {
  const name = vString(body.name, "name", "ランク名", { max: 20 });
  const subtitle = vString(body.subtitle, "subtitle", "サブタイトル", { optional: true, max: 30 });
  const color = vString(body.color, "color", "カラー", { max: 7 });
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) validationFail("color", "カラーは「#FF4D6D」の形式で入力してください");
  const logoUrl = vOptionalUrl(body.logoUrl, "logoUrl", "ロゴ画像");
  const effect = (body.effect ?? {}) as Record<string, unknown>;
  const type = vOneOf(effect.type, "effect.type", "演出の種類", EFFECT_TYPES);
  const builtinStyle = vOneOf(effect.builtinStyle, "effect.builtinStyle", "内蔵アニメーション", BUILTIN_STYLES);
  const url = vOptionalUrl(effect.url, "effect.url", "演出ファイル");
  if (type !== "builtin" && !url) validationFail("effect.url", `${EFFECT_TYPE_LABELS[type]}のファイルを選択してください`);
  return { name, subtitle, color: color.toUpperCase(), logoUrl, effect: { type, url: type === "builtin" ? null : url, builtinStyle } };
}

export async function createRank(admin: User, body: Record<string, unknown>): Promise<Rank> {
  const input = parseRankInput(body);
  return withLock(LOCK, () => {
    const db = getDb();
    const now = new Date().toISOString();
    const maxOrder = Math.max(0, ...[...db.ranks.values()].filter((r) => !r.isLastOne).map((r) => r.order));
    const rank: Rank = { id: newId("r"), ...input, order: maxOrder + 1, isLastOne: false, createdAt: now, updatedAt: now };
    db.ranks.set(rank.id, rank);
    recordAudit(db, admin, "ランクを追加", rank.name, EFFECT_TYPE_LABELS[rank.effect.type]);
    return rank;
  });
}

export async function updateRank(admin: User, id: string, body: Record<string, unknown>): Promise<Rank> {
  const input = parseRankInput(body);
  return withLock(LOCK, () => {
    const db = getDb();
    const rank = db.ranks.get(id);
    if (!rank) throw new ApiError(404, "NOT_FOUND", "ランクが見つかりません");
    const changes: string[] = [];
    if (rank.name !== input.name) changes.push(`名称 ${rank.name} → ${input.name}`);
    if (rank.effect.type !== input.effect.type || rank.effect.url !== input.effect.url) {
      changes.push(`演出 ${EFFECT_TYPE_LABELS[input.effect.type]}${input.effect.url ? `（${input.effect.url.split("/").pop()}）` : ""}`);
    }
    if (rank.logoUrl !== input.logoUrl) changes.push("ロゴを変更");
    if (rank.color !== input.color) changes.push(`カラー ${input.color}`);
    Object.assign(rank, input, { updatedAt: new Date().toISOString() });
    recordAudit(db, admin, "ランク演出を変更", rank.name, changes.join(" / ") || "内容を更新");
    return rank;
  });
}

export async function deleteRank(admin: User, id: string): Promise<void> {
  await withLock(LOCK, () => {
    const db = getDb();
    const rank = db.ranks.get(id);
    if (!rank) throw new ApiError(404, "NOT_FOUND", "ランクが見つかりません");
    if (rank.isLastOne) throw new ApiError(400, "LASTONE_RANK", "ラストワン賞のランクは削除できません");
    const used = [...db.prizes.values()].filter((p) => p.rankId === id).length;
    if (used > 0) throw new ApiError(409, "RANK_IN_USE", `このランクは${used}件の景品で使用中のため削除できません`);
    db.ranks.delete(id);
    recordAudit(db, admin, "ランクを削除", rank.name);
  });
}

/** Re-number the prize ranks in the given order (1 = highest). ラストワン賞 stays at 0. */
export async function reorderRanks(admin: User, ids: unknown): Promise<void> {
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) validationFail("ids", "並び順の形式が正しくありません");
  await withLock(LOCK, () => {
    const db = getDb();
    const prizeRanks = [...db.ranks.values()].filter((r) => !r.isLastOne);
    const list = ids as string[];
    if (list.length !== prizeRanks.length || prizeRanks.some((r) => !list.includes(r.id))) {
      validationFail("ids", "すべてのランクを指定してください");
    }
    list.forEach((id, i) => {
      const rank = db.ranks.get(id)!;
      rank.order = i + 1;
      rank.updatedAt = new Date().toISOString();
    });
    recordAudit(db, admin, "ランクの並び順を変更", list.map((id) => db.ranks.get(id)!.name).join(" > "));
  });
}
