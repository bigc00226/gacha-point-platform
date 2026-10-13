import type { Metadata } from "next";
import { CoinCatchGame } from "@/components/minigames/coin-catch-game";

export const metadata: Metadata = { title: "COIN CATCH（サンプルミニゲーム）" };

/** Standalone page (no site chrome) embedded by the mini-game slot via iframe. */
export default function CoinCatchPage() {
  return <CoinCatchGame />;
}
