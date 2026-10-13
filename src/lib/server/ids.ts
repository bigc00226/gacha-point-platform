import "server-only";
import { randomBytes, randomInt } from "node:crypto";

/** "u_3f9a1c2b7d4e8f60" */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

/** Unambiguous alphabet for human-typed codes (no 0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(length: number, rand: (maxExclusive: number) => number = (m) => randomInt(0, m)): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
  return out;
}

/** One-time coupon code, e.g. "PG-7K2M-9QXA". */
export function generateCouponCode(prefix = "PG", rand?: (maxExclusive: number) => number): string {
  return `${prefix}-${randomCode(4, rand)}-${randomCode(4, rand)}`;
}

/** Dummy digital gift code, e.g. "GIFT-AB3D-9KQ2-XM7P". */
export function generateGiftCode(rand?: (maxExclusive: number) => number): string {
  return `GIFT-${randomCode(4, rand)}-${randomCode(4, rand)}-${randomCode(4, rand)}`;
}

/** Transaction id as an ad network / offerwall would send it. */
export function newTransactionId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}
