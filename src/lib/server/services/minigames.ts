import "server-only";
import type { MiniGameSlot, User } from "@/lib/types";
import { recordAudit } from "../audit";
import { ApiError } from "../http";
import { newId } from "../ids";
import { withLock } from "../lock";
import { getDb } from "../store";
import { validationFail, vBool, vInt, vOneOf, vOptionalUrl, vString } from "../validate";

/** Mini-game slots: external ポイ活 game frames (GMO etc.) embedded by URL. */
const ASPECTS = ["16:9", "9:16", "1:1", "4:3"] as const;

export function listMiniGames(includeInactive = false): MiniGameSlot[] {
  return [...getDb().miniGames.values()]
    .filter((g) => includeInactive || g.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function parse(body: Record<string, unknown>) {
  const embedUrl = vOptionalUrl(body.embedUrl, "embedUrl", "埋め込みURL");
  if (embedUrl && embedUrl.startsWith("http://") && !embedUrl.startsWith("http://localhost")) {
    validationFail("embedUrl", "埋め込みURLは https:// で始まるURLを指定してください");
  }
  return {
    title: vString(body.title, "title", "タイトル", { max: 40 }),
    description: vString(body.description, "description", "説明", { optional: true, max: 200 }),
    provider: vString(body.provider, "provider", "提供元", { optional: true, max: 40 }),
    embedUrl: embedUrl ?? "",
    thumbnailUrl: vOptionalUrl(body.thumbnailUrl, "thumbnailUrl", "サムネイル"),
    aspectRatio: vOneOf(body.aspectRatio, "aspectRatio", "縦横比", ASPECTS),
    active: vBool(body.active ?? true, "active", "公開"),
    sortOrder: vInt(body.sortOrder ?? 0, "sortOrder", "表示順", { min: -1000, max: 100_000 }),
  };
}

export async function saveMiniGame(admin: User, id: string | null, body: Record<string, unknown>): Promise<MiniGameSlot> {
  const input = parse(body);
  return withLock("minigames", () => {
    const db = getDb();
    const now = new Date().toISOString();
    if (id) {
      const game = db.miniGames.get(id);
      if (!game) throw new ApiError(404, "NOT_FOUND", "ミニゲーム枠が見つかりません");
      Object.assign(game, input, { updatedAt: now });
      recordAudit(db, admin, "ミニゲーム枠を更新", game.title, game.embedUrl ? "埋め込みURLあり" : "準備中");
      return game;
    }
    const game: MiniGameSlot = { id: newId("mg"), ...input, createdAt: now, updatedAt: now };
    db.miniGames.set(game.id, game);
    recordAudit(db, admin, "ミニゲーム枠を追加", game.title);
    return game;
  });
}

export async function deleteMiniGame(admin: User, id: string): Promise<void> {
  await withLock("minigames", () => {
    const db = getDb();
    const game = db.miniGames.get(id);
    if (!game) throw new ApiError(404, "NOT_FOUND", "ミニゲーム枠が見つかりません");
    db.miniGames.delete(id);
    recordAudit(db, admin, "ミニゲーム枠を削除", game.title);
  });
}
