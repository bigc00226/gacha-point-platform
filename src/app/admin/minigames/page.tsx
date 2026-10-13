import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { listMiniGames } from "@/lib/server/services/minigames";
import { PageHeader } from "@/components/ui/misc";
import { MiniGamesManager } from "@/components/admin/minigames/minigames-manager";

export const metadata: Metadata = { title: "ミニゲーム枠" };

export default async function AdminMiniGamesPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        icon="gamepad"
        title="ミニゲーム枠"
        description="外部のポイ活ミニゲーム（GMO等のゲーム枠）を埋め込むための枠を管理します。将来の機能追加を見据えた拡張ポイントです。"
      />
      <MiniGamesManager initial={listMiniGames(true)} />
    </>
  );
}
