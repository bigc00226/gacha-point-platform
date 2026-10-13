/**
 * Probabilities are stored as integers in parts per billion (ppb) so that the
 * lottery uses exact integer arithmetic: 1/100 = 10,000,000 ppb.
 * The operator types "1/100", "1/100,000", "0.5%" or "0.005" in the admin form.
 */
import { formatNumber } from "@/lib/format";

export const PPB = 1_000_000_000;

export type ParsedProbability =
  | { ok: true; ppb: number; normalized: string }
  | { ok: false; error: string };

const FORMAT_ERROR = "確率は「1/100」「0.5%」のような形式で入力してください";

export function parseProbability(raw: string): ParsedProbability {
  const input = raw.normalize("NFKC").replace(/[\s,]/g, "").replace(/分の/g, "/");
  if (!input) return { ok: false, error: "確率を入力してください" };

  let ratio: number;
  let normalized: string;
  const fraction = input.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  const percent = input.match(/^(\d+(?:\.\d+)?)%$/);
  const decimal = input.match(/^(\d+(?:\.\d+)?)$/);

  if (fraction) {
    const num = Number(fraction[1]);
    const den = Number(fraction[2]);
    if (den <= 0) return { ok: false, error: "分母は1以上で入力してください" };
    ratio = num / den;
    normalized = `${fraction[1]}/${fraction[2]}`;
  } else if (percent) {
    ratio = Number(percent[1]) / 100;
    normalized = `${percent[1]}%`;
  } else if (decimal) {
    ratio = Number(decimal[1]);
    if (ratio > 1) return { ok: false, error: FORMAT_ERROR };
    normalized = decimal[1];
  } else {
    return { ok: false, error: FORMAT_ERROR };
  }

  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { ok: false, error: "0より大きい確率を入力してください" };
  }
  if (ratio > 1) return { ok: false, error: "確率は100%以下で入力してください" };
  const ppb = Math.round(ratio * PPB);
  if (ppb < 1) return { ok: false, error: "確率が小さすぎます（10億分の1まで設定できます）" };
  return { ok: true, ppb, normalized };
}

/** 10,000,000 → "1%" ; 10,000 → "0.001%" */
export function ppbToPercent(ppb: number, maxFractionDigits = 4): string {
  const percent = (ppb / PPB) * 100;
  return `${percent.toLocaleString("ja-JP", { maximumFractionDigits: maxFractionDigits })}%`;
}

/** 10,000,000 → "1/100" ; non-integer denominators → "約1/7" */
export function ppbToFraction(ppb: number): string {
  if (ppb <= 0) return "0";
  if (ppb >= PPB) return "1/1";
  const den = PPB / ppb;
  if (Number.isInteger(den)) return `1/${formatNumber(den)}`;
  return `約1/${formatNumber(Math.round(den))}`;
}

/** "1/100（1%）" */
export function describeProbability(ppb: number): string {
  return `${ppbToFraction(ppb)}（${ppbToPercent(ppb)}）`;
}

export interface ProbabilityPrize {
  probabilityPpb: number;
  isFallback: boolean;
  stock: number | null;
  wonCount: number;
}

/** True when a stock-limited prize has been fully won. */
export function isSoldOutPrize(prize: Pick<ProbabilityPrize, "stock" | "wonCount">): boolean {
  return prize.stock !== null && prize.wonCount >= prize.stock;
}

/**
 * Effective probability of every prize right now: sold-out prizes are 0 and
 * their mass (plus everything not assigned) goes to the fallback prize.
 */
export function effectivePpb<T extends ProbabilityPrize>(prizes: T[]): Map<T, number> {
  const result = new Map<T, number>();
  let assigned = 0;
  for (const prize of prizes) {
    if (prize.isFallback) continue;
    const ppb = isSoldOutPrize(prize) ? 0 : prize.probabilityPpb;
    result.set(prize, ppb);
    assigned += ppb;
  }
  for (const prize of prizes) {
    if (prize.isFallback) result.set(prize, Math.max(0, PPB - assigned));
  }
  return result;
}

/** Sum of the configured (non-fallback) probabilities, for validation. */
export function assignedPpb(prizes: Pick<ProbabilityPrize, "probabilityPpb" | "isFallback">[]): number {
  return prizes.reduce((sum, p) => (p.isFallback ? sum : sum + p.probabilityPpb), 0);
}
