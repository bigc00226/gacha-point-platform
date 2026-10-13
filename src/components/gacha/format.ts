/** Display helpers for the gacha screens (client-safe). */
import { PPB, describeProbability, ppbToPercent } from "@/lib/probability";

/**
 * "1/100（1%）" for clean fractions and rare odds; just the percentage for large,
 * non-integer odds (e.g. the fallback prize: "87.5%" instead of "約1/1").
 */
export function formatProbability(ppb: number): string {
  if (ppb <= 0) return "0%";
  if (ppb >= PPB) return "100%";
  const den = PPB / ppb;
  if (Number.isInteger(den) || den >= 10) return describeProbability(ppb);
  return ppbToPercent(ppb, 2);
}

/** Short form for tight spaces: "1/100" or "87.5%". */
export function formatProbabilityShort(ppb: number): string {
  if (ppb <= 0) return "0%";
  if (ppb >= PPB) return "100%";
  const den = PPB / ppb;
  if (Number.isInteger(den)) return `1/${den.toLocaleString("ja-JP")}`;
  if (den >= 10) return `約1/${Math.round(den).toLocaleString("ja-JP")}`;
  return ppbToPercent(ppb, 2);
}
