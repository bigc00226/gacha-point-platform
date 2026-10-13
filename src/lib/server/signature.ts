import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook signatures for ad-network / offerwall callbacks.
 *
 * Real providers each define their own scheme (AdMob SSV: ECDSA with Google's
 * rotating public keys; offerwalls: MD5/SHA hash of params + secret). The demo
 * uses HMAC-SHA256 over the canonical query string, with the same verification
 * flow: signature → freshness → idempotency (transaction id) → business rules.
 */
export type WebhookProvider = "admob" | "skyflag" | "tapjoy";

const DEFAULT_SECRETS: Record<WebhookProvider, string> = {
  admob: "demo-admob-ssv-secret",
  skyflag: "demo-skyflag-postback-secret",
  tapjoy: "demo-tapjoy-postback-secret",
};

const ENV_KEYS: Record<WebhookProvider, string> = {
  admob: "ADMOB_SSV_SECRET",
  skyflag: "SKYFLAG_POSTBACK_SECRET",
  tapjoy: "TAPJOY_POSTBACK_SECRET",
};

export function webhookSecret(provider: WebhookProvider): string {
  return process.env[ENV_KEYS[provider]] || DEFAULT_SECRETS[provider];
}

/** "a=1&b=2" with keys sorted; the `signature` param itself is excluded. */
export function canonicalize(params: Record<string, string>, exclude: string[] = ["signature"]): string {
  return Object.keys(params)
    .filter((key) => !exclude.includes(key))
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

export function signParams(provider: WebhookProvider, params: Record<string, string>): string {
  return createHmac("sha256", webhookSecret(provider)).update(canonicalize(params)).digest("hex");
}

export function verifyParams(
  provider: WebhookProvider,
  params: Record<string, string>,
  signature: string | null | undefined,
): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signParams(provider, params), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
