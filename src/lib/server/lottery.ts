import "server-only";
import { randomFillSync } from "node:crypto";
import { PPB } from "@/lib/probability";

/**
 * Pure lottery engine (no I/O), used by the draw service, the seed and the load test.
 *
 * Every draw picks one prize with an integer random number in [0, 1e9) from a
 * CSPRNG (crypto.randomInt). Prizes whose stock runs out — including during the
 * same 100-draw batch — drop out and their probability mass falls through to the
 * fallback prize, so a limited prize can never be over-awarded.
 */
export interface LotteryCandidate {
  id: string;
  probabilityPpb: number;
  isFallback: boolean;
  /** Remaining stock; null = unlimited. */
  stockLeft: number | null;
}

export type RandomIntFn = (maxExclusive: number) => number;

// CSPRNG bytes are drawn in 64 KB batches (one syscall instead of one per draw),
// then turned into uniform integers with rejection sampling (no modulo bias).
const POOL_BYTES = 64 * 1024;
let pool = Buffer.alloc(0);
let poolOffset = 0;

function nextUint32(): number {
  if (poolOffset + 4 > pool.length) {
    pool = randomFillSync(Buffer.allocUnsafe(POOL_BYTES));
    poolOffset = 0;
  }
  const value = pool.readUInt32LE(poolOffset);
  poolOffset += 4;
  return value;
}

export const secureRandomInt: RandomIntFn = (maxExclusive) => {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 0x1_0000_0000) {
    throw new RangeError(`maxExclusive out of range: ${maxExclusive}`);
  }
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  let value: number;
  do {
    value = nextUint32();
  } while (value >= limit);
  return value % maxExclusive;
};

/** Deterministic PRNG (mulberry32) for seed data and reproducible simulations. */
export function seededRandomInt(seed: number): RandomIntFn {
  let a = seed >>> 0;
  return (maxExclusive) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(r * maxExclusive);
  };
}

export function drawPrizes(candidates: LotteryCandidate[], count: number, rand: RandomIntFn = secureRandomInt): string[] {
  const fallback = candidates.find((c) => c.isFallback);
  if (!fallback) throw new Error("Lottery requires exactly one fallback prize");
  const regular = candidates.filter((c) => !c.isFallback && c.probabilityPpb > 0);
  const stockLeft = new Map<string, number | null>(regular.map((c) => [c.id, c.stockLeft]));

  const picks: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = rand(PPB);
    let cumulative = 0;
    let picked = fallback.id;
    for (const candidate of regular) {
      const left = stockLeft.get(candidate.id);
      if (left !== null && left !== undefined && left <= 0) continue;
      cumulative += candidate.probabilityPpb;
      if (r < cumulative) {
        picked = candidate.id;
        break;
      }
    }
    const left = stockLeft.get(picked);
    if (left !== null && left !== undefined) stockLeft.set(picked, left - 1);
    picks.push(picked);
  }
  return picks;
}
