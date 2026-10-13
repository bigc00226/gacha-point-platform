import "server-only";
import { unstable_rethrow } from "next/navigation";

/**
 * Error thrown by services / handlers; converted to a JSON error response.
 * Common codes: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR,
 * INSUFFICIENT_TICKETS, INSUFFICIENT_POINTS, SOLD_OUT, OUT_OF_STOCK, LIMIT_REACHED,
 * ALREADY_USED, RATE_LIMITED, CONFLICT.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFoundError = (what = "データ") => new ApiError(404, "NOT_FOUND", `${what}が見つかりません`);

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true, data }, init);
}

export function jsonError(status: number, code: string, message: string, details?: unknown): Response {
  return Response.json({ ok: false, error: { code, message, details } }, { status });
}

export function toErrorResponse(err: unknown): Response {
  unstable_rethrow(err);
  if (err instanceof ApiError) return jsonError(err.status, err.code, err.message, err.details);
  console.error("[api] unexpected error", err);
  return jsonError(500, "INTERNAL_ERROR", "サーバーエラーが発生しました。時間をおいて再度お試しください。");
}

/**
 * Wrap a Route Handler so thrown ApiErrors become JSON error responses.
 *
 *   export const POST = route<RouteContext<"/api/gachas/[id]/draw">>(async (req, { params }) => {
 *     const { id } = await params;
 *     return jsonOk(...);
 *   });
 */
export function route<C = unknown>(
  handler: (req: Request, ctx: C) => Promise<Response> | Response,
): (req: Request, ctx: C) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = (await req.json()) as unknown;
    if (body === null || typeof body !== "object") throw new Error("not an object");
    return body as T;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "リクエストの形式が正しくありません");
  }
}

/** True when the request came over HTTPS (directly or via a proxy). */
export function isSecureRequest(req: Request): boolean {
  return new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

/** Best-effort client IP for logs. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1"
  );
}
