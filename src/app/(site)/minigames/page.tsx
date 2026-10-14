import type { Metadata } from "next";
import { listMiniGames } from "@/lib/server/services/minigames";
import { syncRequestState } from "@/lib/server/state/sync";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/misc";
import { MiniGameGrid } from "@/components/minigames/minigame-grid";

export const metadata: Metadata = { title: "ミニゲーム" };

export default async function MiniGamesPage() {
  await syncRequestState();
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-linear-to-br from-[#1b1450] via-surface to-[#3b1240] p-5 sm:p-7">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[11px] font-black tracking-widest text-primary ring-1 ring-inset ring-primary/35">
          <Icon name="gamepad" size={12} />
          MINI GAMES
        </p>
        <h1 className="mt-3 font-display text-2xl text-fg sm:text-3xl">ミニゲーム</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
          すきま時間に遊べるミニゲーム。外部のポイ活ミニゲーム（GMO等のゲーム枠）を、管理画面からURLを登録するだけで追加できます。
        </p>
      </section>
      <MiniGameGrid games={listMiniGames()} />
      <Notice tone="neutral" title="拡張性について">
        ミニゲームは iframe で安全に埋め込み（sandbox属性で権限を制限）、ゲーム結果は postMessage またはゲーム提供会社からの成果通知（Webhook）で受け取れます。チケット付与はオファーウォールと同じサーバー側の検証フローに乗せられるため、不正対策を共通化できます。
      </Notice>
    </div>
  );
}
