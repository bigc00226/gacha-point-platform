/**
 * Plain, serializable DTOs for the gacha screens (built by
 * `@/lib/server/services/gacha` and passed to client components).
 * Client-safe: type-only, no server imports.
 */
import type { GachaStatus, LastOnePrize, PrizeType, RankEffect } from "@/lib/types";

export interface RankDto {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  /** 1 = highest prize rank; the ラストワン賞 rank has order 0. */
  order: number;
  logoUrl: string | null;
  effect: RankEffect;
  isLastOne: boolean;
}

export interface PrizeDto {
  id: string;
  rankId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  type: PrizeType;
  pointValue: number;
  /** Configured probability (ppb). */
  probabilityPpb: number;
  /** Probability right now: sold-out prizes are 0, the fallback prize gets the remainder. */
  effectivePpb: number;
  isFallback: boolean;
  /** null = unlimited. */
  stock: number | null;
  remainingStock: number | null;
  soldOut: boolean;
  wonCount: number;
}

export interface GachaCardDto {
  id: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  badge: string | null;
  featured: boolean;
  status: GachaStatus;
  ticketCost: number;
  totalSlots: number;
  remainingSlots: number;
  endsAt: string | null;
  /** endsAt has passed (computed when the DTO was built). */
  ended: boolean;
  /** Active and ≤1% or ≤100 slots left. */
  nearLastOne: boolean;
  /** Draws are possible right now (active, not ended, slots left). */
  available: boolean;
  sortOrder: number;
  lastOnePrize: LastOnePrize | null;
  lastOneWinner: { nickname: string; at: string } | null;
  /** The best prize still available (highest rank), for card previews. */
  topPrize: { name: string; imageUrl: string | null; rankName: string; rankColor: string } | null;
}

export interface PrizeGroupDto {
  rank: RankDto;
  prizes: PrizeDto[];
}

export interface GachaDetailDto extends GachaCardDto {
  description: string;
  prizeGroups: PrizeGroupDto[];
  /** Every rank (incl. ラストワン賞), highest first — used to pick effects. */
  ranks: RankDto[];
  lastOneRank: RankDto | null;
  /** Expected points per draw from point prizes (current effective probabilities). */
  expectedPointsPerDraw: number;
}

export interface BigWinDto {
  drawId: string;
  nickname: string;
  gachaId: string;
  gachaTitle: string;
  rankName: string;
  rankColor: string;
  rankOrder: number;
  prizeName: string;
  prizeImageUrl: string | null;
  at: string;
  isLastOne?: boolean;
}

/** The signed-in viewer as the gacha page needs it (null when signed out). */
export interface GachaViewerDto {
  id: string;
  nickname: string;
  tickets: number;
  points: number;
  isAdmin: boolean;
}
