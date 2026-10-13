import "server-only";
import type { MediaAsset, MediaKind, User } from "@/lib/types";
import { MEDIA_KIND_LABELS } from "@/lib/constants";
import { recordAudit } from "../audit";
import { ApiError } from "../http";
import { newId } from "../ids";
import { withLock } from "../lock";
import { getDb, type Db } from "../store";

/**
 * Media library: images, effect videos (MP4/WebM) and Lottie JSON uploaded by the
 * operator. The demo keeps bytes in memory and serves them from /api/media/<id>;
 * production would upload straight to S3 (presigned URL) and serve via a CDN.
 */
export const MEDIA_MAX_UPLOAD_MB = Math.max(1, Number(process.env.MEDIA_MAX_UPLOAD_MB) || 4);

const TYPES: Record<string, { kind: MediaKind; mime: string }> = {
  png: { kind: "image", mime: "image/png" },
  jpg: { kind: "image", mime: "image/jpeg" },
  jpeg: { kind: "image", mime: "image/jpeg" },
  webp: { kind: "image", mime: "image/webp" },
  gif: { kind: "image", mime: "image/gif" },
  svg: { kind: "image", mime: "image/svg+xml" },
  mp4: { kind: "video", mime: "video/mp4" },
  webm: { kind: "video", mime: "video/webm" },
  json: { kind: "lottie", mime: "application/json" },
};

export const ACCEPTED_EXTENSIONS = Object.keys(TYPES);

export interface MediaAssetDto extends MediaAsset {
  usages: string[];
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

/** Checks the file content matches its extension (magic bytes / parse), so a renamed file is rejected. */
function sniff(ext: string, bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  switch (ext) {
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) ? null : "PNG画像として読み込めません";
    case "jpg":
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]) ? null : "JPEG画像として読み込めません";
    case "gif":
      return ascii(0, 4) === "GIF8" ? null : "GIF画像として読み込めません";
    case "webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP" ? null : "WebP画像として読み込めません";
    case "mp4":
      return ascii(4, 8) === "ftyp" ? null : "MP4動画として読み込めません";
    case "webm":
      return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) ? null : "WebM動画として読み込めません";
    case "svg": {
      const head = new TextDecoder().decode(bytes.slice(0, 2048)).trimStart().toLowerCase();
      return head.startsWith("<svg") || head.startsWith("<?xml") ? null : "SVG画像として読み込めません";
    }
    case "json": {
      try {
        const data = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
        const ok =
          typeof data === "object" &&
          data !== null &&
          "v" in data &&
          typeof data.fr === "number" &&
          typeof data.ip === "number" &&
          typeof data.op === "number" &&
          Array.isArray(data.layers);
        return ok ? null : "Lottie形式のJSONではありません（v / fr / ip / op / layers が必要です）";
      } catch {
        return "JSONとして読み込めません";
      }
    }
    default:
      return "対応していないファイル形式です";
  }
}

/** Where a media URL is referenced (shown before deletion and in the library). */
export function findMediaUsages(db: Db, url: string): string[] {
  const usages: string[] = [];
  for (const g of db.gachas.values()) {
    if (g.isSandbox) continue;
    if (g.thumbnailUrl === url) usages.push(`ガチャ「${g.title}」のサムネイル`);
    if (g.lastOnePrize?.imageUrl === url) usages.push(`ガチャ「${g.title}」のラストワン賞`);
  }
  for (const p of db.prizes.values()) {
    if (p.imageUrl !== url) continue;
    const g = db.gachas.get(p.gachaId);
    if (g && !g.isSandbox) usages.push(`ガチャ「${g.title}」の景品「${p.name}」`);
  }
  for (const r of db.ranks.values()) {
    if (r.logoUrl === url) usages.push(`ランク「${r.name}」のロゴ`);
    if (r.effect.url === url) usages.push(`ランク「${r.name}」の演出`);
  }
  for (const item of db.exchangeItems.values()) if (item.imageUrl === url) usages.push(`交換景品「${item.name}」`);
  for (const offer of db.offers.values()) if (offer.iconUrl === url) usages.push(`案件「${offer.title}」のアイコン`);
  for (const game of db.miniGames.values()) if (game.thumbnailUrl === url) usages.push(`ミニゲーム「${game.title}」`);
  return usages;
}

export function listMedia(kind?: MediaKind): MediaAssetDto[] {
  const db = getDb();
  return [...db.media.values()]
    .filter((m) => !kind || m.kind === kind)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((m) => ({ ...m, usages: findMediaUsages(db, m.url) }));
}

export async function uploadMedia(admin: User, file: File): Promise<MediaAsset> {
  const name = (file.name || "file").normalize("NFC").slice(0, 120);
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const type = TYPES[ext];
  if (!type) {
    throw new ApiError(400, "UNSUPPORTED_TYPE", `「${name}」は対応していない形式です（画像: PNG/JPG/WebP/GIF/SVG、動画: MP4/WebM、Lottie: JSON）`);
  }
  if (file.size === 0) throw new ApiError(400, "EMPTY_FILE", `「${name}」は空のファイルです`);
  if (file.size > MEDIA_MAX_UPLOAD_MB * 1024 * 1024) {
    throw new ApiError(413, "FILE_TOO_LARGE", `「${name}」は上限（${MEDIA_MAX_UPLOAD_MB}MB）を超えています`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = sniff(ext, bytes);
  if (problem) throw new ApiError(400, "INVALID_FILE", `「${name}」: ${problem}`);

  return withLock("media", () => {
    const db = getDb();
    const id = newId("m");
    const asset: MediaAsset = {
      id,
      kind: type.kind,
      name,
      mime: type.mime,
      size: bytes.byteLength,
      url: `/api/media/${id}`,
      source: "upload",
      createdAt: new Date().toISOString(),
      uploadedBy: admin.nickname,
    };
    db.media.set(id, asset);
    db.mediaBlobs.set(id, bytes);
    recordAudit(db, admin, "メディアをアップロード", name, `${MEDIA_KIND_LABELS[type.kind]} / ${Math.ceil(bytes.byteLength / 1024)}KB`);
    return asset;
  });
}

export async function deleteMedia(admin: User, id: string): Promise<void> {
  await withLock("media", () => {
    const db = getDb();
    const asset = db.media.get(id);
    if (!asset) throw new ApiError(404, "NOT_FOUND", "ファイルが見つかりません");
    if (asset.source === "builtin") throw new ApiError(400, "BUILTIN_MEDIA", "サンプル素材は削除できません");
    const usages = findMediaUsages(db, asset.url);
    if (usages.length > 0) {
      throw new ApiError(409, "MEDIA_IN_USE", `このファイルは使用中のため削除できません（${usages.length}か所）`, { usages });
    }
    db.media.delete(id);
    db.mediaBlobs.delete(id);
    recordAudit(db, admin, "メディアを削除", asset.name);
  });
}

export function getMediaBlob(id: string): { asset: MediaAsset; bytes: Uint8Array } | null {
  const db = getDb();
  const asset = db.media.get(id);
  const bytes = db.mediaBlobs.get(id);
  return asset && bytes ? { asset, bytes } : null;
}
