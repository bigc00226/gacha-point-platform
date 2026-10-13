import { getMediaBlob } from "@/lib/server/services/media";

export const dynamic = "force-dynamic";

/**
 * Serves uploaded media. Supports HTTP Range requests (206), which Safari requires
 * for MP4 playback. Uploaded SVGs cannot run scripts: the response is sandboxed by CSP.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  const found = getMediaBlob(id);
  if (!found) return new Response("Not Found", { status: 404 });
  const { asset, bytes } = found;
  const total = bytes.byteLength;
  const headers = new Headers({
    "Content-Type": asset.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
  });

  const range = req.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = match && match[1] !== "" ? Number(match[1]) : NaN;
    let end = match && match[2] !== "" ? Number(match[2]) : NaN;
    if (match && match[1] === "" && match[2] !== "") {
      // Suffix range: the last N bytes.
      start = Math.max(0, total - Number(match[2]));
      end = total - 1;
    } else if (!Number.isNaN(start) && Number.isNaN(end)) {
      end = total - 1;
    }
    if (!match || Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
      headers.set("Content-Range", `bytes */${total}`);
      return new Response(null, { status: 416, headers });
    }
    end = Math.min(end, total - 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(new Uint8Array(bytes.subarray(start, end + 1)), { status: 206, headers });
  }

  headers.set("Content-Length", String(total));
  return new Response(new Uint8Array(bytes), { status: 200, headers });
}
