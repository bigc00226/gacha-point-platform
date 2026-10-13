/**
 * Coupon code normalization, shared by the admin issuer and the user redeem form.
 * Users may type full-width characters, lower case, spaces or omit hyphens:
 * "ｐｇ－７ｋ２ｍ　９ｑｘａ" and "PG-7K2M-9QXA" both normalize to "PG7K2M9QXA".
 * The katakana long vowel mark "ー" is kept because keywords may contain it.
 */
export function normalizeCouponCode(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\s\-‐‑‒–—―_]/g, "")
    .toUpperCase();
}
