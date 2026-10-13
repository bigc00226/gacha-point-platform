import "server-only";
import type { ShippingAddress } from "@/lib/types";
import { normalizeAddress, validateAddress } from "@/lib/address";
import { ApiError } from "./http";

/**
 * Small input validators for Route Handlers. Each throws a 400 VALIDATION_ERROR
 * with a Japanese message and `details.field` so forms can highlight the field.
 */
function fail(field: string, message: string): never {
  throw new ApiError(400, "VALIDATION_ERROR", message, { field });
}

export function vString(
  value: unknown,
  field: string,
  label: string,
  opts: { min?: number; max?: number; optional?: boolean; trim?: boolean } = {},
): string {
  const { min = opts.optional ? 0 : 1, max = 1000, trim = true } = opts;
  if (value === undefined || value === null) {
    if (opts.optional) return "";
    fail(field, `${label}を入力してください`);
  }
  if (typeof value !== "string") fail(field, `${label}の形式が正しくありません`);
  const str = trim ? value.trim() : value;
  if (str.length < min) fail(field, min <= 1 ? `${label}を入力してください` : `${label}は${min}文字以上で入力してください`);
  if (str.length > max) fail(field, `${label}は${max}文字以内で入力してください`);
  return str;
}

export function vInt(
  value: unknown,
  field: string,
  label: string,
  opts: { min?: number; max?: number } = {},
): number {
  const num = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof num !== "number" || !Number.isFinite(num) || !Number.isInteger(num)) {
    fail(field, `${label}は整数で入力してください`);
  }
  if (opts.min !== undefined && num < opts.min) fail(field, `${label}は${opts.min.toLocaleString()}以上で入力してください`);
  if (opts.max !== undefined && num > opts.max) fail(field, `${label}は${opts.max.toLocaleString()}以下で入力してください`);
  return num;
}

export function vNumber(
  value: unknown,
  field: string,
  label: string,
  opts: { min?: number; max?: number } = {},
): number {
  const num = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) fail(field, `${label}は数値で入力してください`);
  if (opts.min !== undefined && num < opts.min) fail(field, `${label}は${opts.min}以上で入力してください`);
  if (opts.max !== undefined && num > opts.max) fail(field, `${label}は${opts.max}以下で入力してください`);
  return num;
}

export function vBool(value: unknown, field: string, label: string): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  fail(field, `${label}の形式が正しくありません`);
}

export function vOneOf<T extends string>(value: unknown, field: string, label: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    fail(field, `${label}の値が正しくありません`);
  }
  return value as T;
}

export function vEmail(value: unknown, field = "email"): string {
  const email = vString(value, field, "メールアドレス", { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(field, "メールアドレスの形式が正しくありません");
  return email;
}

/** Nullable ISO date (accepts "" / null as null). */
export function vOptionalDate(value: unknown, field: string, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) fail(field, `${label}の形式が正しくありません`);
  return new Date(value).toISOString();
}

/** Accepts null/"" as null; otherwise a URL path ("/...") or http(s) URL. */
export function vOptionalUrl(value: unknown, field: string, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") fail(field, `${label}の形式が正しくありません`);
  const url = value.trim();
  if (!url.startsWith("/") && !/^https?:\/\//.test(url)) fail(field, `${label}はURLで入力してください`);
  return url;
}

/** Validates a ShippingAddress; errors carry `details.field` = "address.<key>". */
export function vAddress(value: unknown): ShippingAddress {
  if (!value || typeof value !== "object") fail("address", "お届け先を入力してください");
  const address = normalizeAddress(value as ShippingAddress);
  const errors = validateAddress(address);
  const first = Object.entries(errors)[0];
  if (first) throw new ApiError(400, "VALIDATION_ERROR", first[1] as string, { field: `address.${first[0]}`, errors });
  return address;
}

export { fail as validationFail };
