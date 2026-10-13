import type { MediaKind } from "@/lib/types";
import { requireApiAdmin } from "@/lib/server/auth";
import { ApiError, jsonOk, route } from "@/lib/server/http";
import { listMedia, MEDIA_MAX_UPLOAD_MB, uploadMedia } from "@/lib/server/services/media";

export const dynamic = "force-dynamic";

const KINDS: MediaKind[] = ["image", "video", "lottie"];

/** GET /api/admin/media?kind=image|video|lottie */
export const GET = route(async (req) => {
  await requireApiAdmin();
  const kind = new URL(req.url).searchParams.get("kind");
  return jsonOk({
    assets: listMedia(KINDS.includes(kind as MediaKind) ? (kind as MediaKind) : undefined),
    maxUploadMb: MEDIA_MAX_UPLOAD_MB,
  });
});

/** POST /api/admin/media — multipart, one or more `file` fields. */
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "INVALID_FORM", "ファイルを読み取れませんでした");
  }
  const files = form.getAll("file").filter((f): f is File => typeof f !== "string");
  if (files.length === 0) throw new ApiError(400, "NO_FILE", "ファイルを選択してください");
  if (files.length > 20) throw new ApiError(400, "TOO_MANY_FILES", "一度にアップロードできるのは20ファイルまでです");

  const assets = [];
  const errors: Array<{ name: string; message: string }> = [];
  for (const file of files) {
    try {
      assets.push(await uploadMedia(admin, file));
    } catch (err) {
      if (err instanceof ApiError) errors.push({ name: file.name, message: err.message });
      else throw err;
    }
  }
  if (assets.length === 0) throw new ApiError(400, "UPLOAD_FAILED", errors.map((e) => e.message).join(" / "), { errors });
  return jsonOk({ assets, errors });
});
