/**
 * Browser-side fetch wrapper for our Route Handlers.
 * Unwraps the `{ ok, data | error }` envelope and throws ApiClientError on failure.
 */
import type { ApiResponse } from "@/lib/api-types";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const NETWORK_ERROR_MESSAGE =
  "通信エラーが発生しました。電波状況をご確認のうえ、もう一度お試しください。";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiFetchOptions {
  method?: Method;
  /** JSON body (ignored when `formData` is given). */
  body?: unknown;
  /** Multipart body, e.g. file uploads. */
  formData?: FormData;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = options.body !== undefined || options.formData ? "POST" : "GET" } = options;
  const init: RequestInit = { method, signal: options.signal, cache: "no-store", credentials: "same-origin" };
  if (options.formData) {
    init.body = options.formData;
  } else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = { "Content-Type": "application/json" };
  }

  let res: Response;
  try {
    res = await fetch(path, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiClientError("NETWORK_ERROR", NETWORK_ERROR_MESSAGE, 0);
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    json = null;
  }

  if (!json) {
    if (res.status === 413) {
      throw new ApiClientError("PAYLOAD_TOO_LARGE", "ファイルサイズが大きすぎます。", res.status);
    }
    throw new ApiClientError("BAD_RESPONSE", `サーバーから不正な応答がありました（${res.status}）`, res.status);
  }
  if (!json.ok) {
    throw new ApiClientError(json.error.code, json.error.message, res.status, json.error.details);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiFetch<T>(path, { method: "GET", signal }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body: body ?? {} }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, formData: FormData) => apiFetch<T>(path, { method: "POST", formData }),
};

/** Human readable message for any thrown error. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "予期しないエラーが発生しました";
}
