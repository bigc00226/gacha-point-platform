import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/icon";
import { SectionTitle } from "@/components/ui/misc";

interface EarnStripProps {
  loginBonusTickets: number;
  videoTicketsPerView: number;
  videoDailyLimit: number;
  maxOfferTickets: number;
  multiplier: number;
}

/** "チケットを貯めよう" — the three ways to earn gacha tickets, with live reward values. */
export function EarnStrip({ loginBonusTickets, videoTicketsPerView, videoDailyLimit, maxOfferTickets, multiplier }: EarnStripProps) {
  const cards: Array<{ href: string; icon: IconName; title: string; reward: string; note: string; tone: string }> = [
    {
      href: "/earn#login-bonus",
      icon: "calendar",
      title: "ログインボーナス",
      reward: `+${formatNumber(loginBonusTickets)}枚`,
      note: "毎日ログインで受け取れます",
      tone: "from-[#ff3e8a] to-[#ff8a3d]",
    },
    {
      href: "/earn#video",
      icon: "tv",
      title: "動画を見る",
      reward: `+${formatNumber(videoTicketsPerView)}枚 × ${videoDailyLimit}回`,
      note: "1日の上限は毎日0:00にリセット",
      tone: "from-[#35d0ff] to-[#6b93ff]",
    },
    {
      href: "/earn#offerwall",
      icon: "smartphone",
      title: "案件に挑戦",
      reward: `最大${formatNumber(maxOfferTickets)}枚`,
      note: multiplier !== 1 ? `今だけ付与数${multiplier}倍キャンペーン中！` : "アプリ導入・アンケート・会員登録など",
      tone: "from-[#7b5cff] to-[#ff3e8a]",
    },
  ];

  return (
    <section aria-labelledby="earn-heading">
      <SectionTitle
        title="チケットを貯めよう"
        subtitle="ガチャチケットはすべて無料で貯められます"
        icon="ticket"
        action={
          <Link href="/earn" className="inline-flex items-center gap-0.5 text-xs font-bold text-primary hover:underline">
            すべて見る
            <Icon name="chevronRight" size={14} />
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-line-strong"
          >
            <div className={`absolute -right-6 -top-6 size-24 rounded-full bg-linear-to-br ${card.tone} opacity-20 blur-xl transition-opacity group-hover:opacity-35`} />
            <div className="relative flex items-center gap-3">
              <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br ${card.tone} text-white shadow-lg`}>
                <Icon name={card.icon} size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-fg">{card.title}</p>
                <p className="tabular font-display text-lg leading-tight text-ticket">{card.reward}</p>
              </div>
              <Icon name="chevronRight" size={18} className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="relative mt-2.5 text-xs text-muted">{card.note}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
