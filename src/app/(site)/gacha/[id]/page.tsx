import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { getGachaDetail, getRemainingInfo, recentBigWins, toGachaViewerDto } from "@/lib/server/services/gacha";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/misc";
import { DrawPanel, GachaPlayProvider, MobileDrawBar, RemainingCounter } from "@/components/gacha/gacha-play";
import { GachaHero, GachaNotes, LastOnePrizeCard, PrizeLineup, RecentWins } from "@/components/gacha/gacha-sections";

export const metadata: Metadata = { title: "ガチャ" };

export default async function GachaPage({ params }: PageProps<"/gacha/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const gacha = getGachaDetail(id, { allowDraft: user?.role === "admin" });
  if (!gacha) notFound();

  const remaining = getRemainingInfo(gacha.id);
  const serverNow = Date.parse(remaining.fetchedAt);
  const wins = recentBigWins(8, gacha.id);

  return (
    <GachaPlayProvider gacha={gacha} viewer={toGachaViewerDto(user)} initialRemaining={remaining}>
      <nav aria-label="パンくずリスト" className="mb-4 flex items-center gap-1 text-xs text-muted">
        <Link href="/" className="inline-flex items-center gap-1 font-bold hover:text-fg">
          <Icon name="chevronLeft" size={14} />
          ガチャ一覧
        </Link>
        <span className="text-subtle">/</span>
        <span className="truncate text-fg/80">{gacha.title}</span>
      </nav>

      {gacha.status === "draft" && (
        <Notice tone="warning" title="このガチャは下書きです" className="mb-4">
          管理者のみ表示しています。公開するには管理画面でステータスを「公開中」にしてください。
        </Notice>
      )}
      {gacha.status === "paused" && (
        <Notice tone="warning" title="現在一時停止中です" className="mb-4">
          再開までしばらくお待ちください。景品ラインナップは引き続きご覧いただけます。
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <GachaHero gacha={gacha} serverNow={serverNow} />
        </div>

        <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="space-y-4 lg:sticky lg:top-20">
            <RemainingCounter />
            <DrawPanel />
          </div>
        </aside>

        <div className="min-w-0 space-y-8 lg:col-start-1 lg:row-start-2">
          <LastOnePrizeCard gacha={gacha} rank={gacha.lastOneRank} />
          <PrizeLineup groups={gacha.prizeGroups} expectedPoints={gacha.expectedPointsPerDraw} />
          <RecentWins wins={wins} now={serverNow} />
          <GachaNotes ticketCost={gacha.ticketCost} />
        </div>
      </div>

      <MobileDrawBar />
    </GachaPlayProvider>
  );
}
