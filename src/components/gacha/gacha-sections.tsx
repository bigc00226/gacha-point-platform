import type { CSSProperties } from "react";
import { GACHA_STATUS_LABELS, PRIZE_TYPE_LABELS } from "@/lib/constants";
import { cn, formatNumber, formatPoints } from "@/lib/format";
import { formatDateTime, formatRelative } from "@/lib/time";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Amount } from "@/components/ui/currency";
import { Icon, type IconName } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/misc";
import { Countdown } from "./countdown";
import { formatProbability } from "./format";
import { CoverImage, PrizeImage } from "./prize-image";
import type { BigWinDto, GachaDetailDto, PrizeDto, PrizeGroupDto, RankDto } from "./types";

const TYPE_TONE: Record<PrizeDto["type"], BadgeTone> = { point: "point", digital: "ticket", physical: "primary" };
const TYPE_ICON: Record<PrizeDto["type"], IconName> = { point: "coin", digital: "gift", physical: "package" };

export function PrizeTypeBadge({ type, size = "xs" }: { type: PrizeDto["type"]; size?: "xs" | "sm" }) {
  return (
    <Badge tone={TYPE_TONE[type]} icon={TYPE_ICON[type]} size={size}>
      {PRIZE_TYPE_LABELS[type]}
    </Badge>
  );
}

function SectionHeading({ icon, title, sub, id }: { icon: IconName; title: string; sub?: string; id?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 font-display text-lg text-fg sm:text-xl">
        <span className="grid size-8 place-items-center rounded-xl bg-linear-to-br from-primary to-primary-2 text-white shadow-lg shadow-primary/30">
          <Icon name={icon} size={16} />
        </span>
        {title}
      </h2>
      {sub && <p className="pb-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export function GachaHero({ gacha, serverNow }: { gacha: GachaDetailDto; serverNow: number }) {
  const soldOut = gacha.status === "soldout";
  const statusNote =
    gacha.status === "draft"
      ? "下書き（管理者のみ表示）"
      : gacha.status === "paused"
        ? "一時停止中"
        : gacha.ended
          ? "販売終了"
          : null;

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl shadow-black/40">
        <CoverImage src={gacha.thumbnailUrl} alt={gacha.title} className="aspect-video w-full" loading="eager" fetchPriority="high" />
        {(soldOut || statusNote) && (
          <div className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-[1px]">
            <span
              className={cn(
                "-rotate-6 rounded-xl border-4 px-6 py-2 font-display text-3xl tracking-widest sm:text-5xl",
                soldOut ? "border-danger text-danger" : "border-white/70 text-white/90",
              )}
            >
              {soldOut ? "SOLD OUT" : statusNote}
            </span>
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {gacha.featured && (
            <Badge tone="primary" icon="star">
              PICK UP
            </Badge>
          )}
          {gacha.nearLastOne && (
            <Badge tone="gold" icon="flame">
              ラストワン間近
            </Badge>
          )}
          <Badge tone={soldOut ? "danger" : gacha.available ? "success" : "neutral"}>
            {gacha.ended && !soldOut ? "販売終了" : GACHA_STATUS_LABELS[gacha.status]}
          </Badge>
          {gacha.endsAt && !gacha.ended && !soldOut && (
            <Badge tone="warning" icon="clock">
              <Countdown endsAt={gacha.endsAt} serverNow={serverNow} prefix="終了まで " />
            </Badge>
          )}
        </div>
        <h1 className="mt-2.5 font-display text-[1.7rem] leading-tight text-fg sm:text-3xl">{gacha.title}</h1>
        {gacha.subtitle && <p className="mt-1 text-sm font-bold text-primary">{gacha.subtitle}</p>}
        <p className="mt-3 text-sm leading-relaxed text-fg/85">{gacha.description}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-line bg-surface px-2 py-2.5">
            <dt className="text-[11px] font-bold text-muted">1回あたり</dt>
            <dd className="mt-0.5 text-sm font-black text-ticket">
              {gacha.ticketCost}
              <span className="ml-0.5 text-[11px]">枚</span>
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-surface px-2 py-2.5">
            <dt className="text-[11px] font-bold text-muted">総口数</dt>
            <dd className="tabular mt-0.5 text-sm font-black text-fg">{formatNumber(gacha.totalSlots)}口</dd>
          </div>
          <div className="rounded-xl border border-line bg-surface px-2 py-2.5">
            <dt className="text-[11px] font-bold text-muted">{gacha.endsAt ? "販売終了" : "販売期間"}</dt>
            <dd className="mt-0.5 text-sm font-black text-fg">
              {gacha.endsAt ? formatDateTime(gacha.endsAt).slice(5) : "なくなり次第"}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ラストワン賞
// ---------------------------------------------------------------------------

export function LastOnePrizeCard({ gacha, rank }: { gacha: GachaDetailDto; rank: RankDto | null }) {
  const prize = gacha.lastOnePrize;
  if (!prize) return null;
  const winner = gacha.lastOneWinner;
  return (
    <section aria-labelledby="lastone-heading" className="relative overflow-hidden rounded-3xl border border-[#ffd23f]/45 bg-[#0d0900] shadow-[0_0_40px_-12px_rgba(255,196,40,0.45)]">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 90% at 18% 50%, rgba(255,196,40,0.28), transparent 70%), repeating-conic-gradient(from 0deg at 18% 50%, rgba(255,210,63,0.09) 0deg 6deg, transparent 6deg 18deg)",
        }}
      />
      <div className="relative grid gap-4 p-5 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-6">
        <div className="relative mx-auto grid size-36 place-items-center sm:size-40">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgba(255,214,90,0.5),transparent)]" />
          <div className="absolute inset-2 rounded-full border border-[#ffd23f]/50 bg-[radial-gradient(closest-side,rgba(60,40,0,0.9),rgba(20,12,0,0.95))]" />
          <PrizeImage src={prize.imageUrl} alt={prize.name} className="relative size-28 animate-float sm:size-32" iconSize={48} />
        </div>
        <div className="min-w-0 text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            {rank?.logoUrl ? (
              <img src={rank.logoUrl} alt={rank.name} className="h-11 w-auto object-contain" loading="lazy" />
            ) : (
              <span className="font-display text-lg text-[#ffd23f]">ラストワン賞</span>
            )}
          </div>
          <h2 id="lastone-heading" className="sr-only">
            ラストワン賞
          </h2>
          <p className="mt-1 text-xl font-black leading-snug text-white sm:text-2xl">{prize.name}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
            <PrizeTypeBadge type={prize.type} size="sm" />
            {prize.type === "point" && <Amount kind="point" value={prize.pointValue} size="sm" />}
          </div>
          {prize.description && <p className="mt-2.5 text-sm leading-relaxed text-white/75">{prize.description}</p>}
          {winner ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#ffd23f]/15 px-3 py-1.5 text-xs font-bold text-[#ffd23f]">
              <Icon name="crown" size={14} filled />
              ラストワン賞は{winner.nickname}さんが獲得しました（{formatDateTime(winner.at)}）
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-[#ffe9a8]/80">
              最後の1口（No.{formatNumber(gacha.totalSlots)}口目）を引いた方に贈呈します。複数回ガチャで最後の口まで引いた場合も対象です。
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Prize lineup
// ---------------------------------------------------------------------------

function PrizeRow({ prize, color }: { prize: PrizeDto; color: string }) {
  return (
    <li
      className={cn(
        "cv-auto relative flex gap-3 overflow-hidden rounded-2xl border bg-surface-2/70 p-3 [--cv-size:96px]",
        prize.soldOut ? "border-line opacity-60" : "border-line",
      )}
    >
      <div
        className="grid size-[4.5rem] shrink-0 place-items-center rounded-xl sm:size-20"
        style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${color} 34%, transparent), color-mix(in srgb, ${color} 8%, transparent))` }}
      >
        <PrizeImage src={prize.imageUrl} alt={prize.name} className={cn("size-[82%]", prize.soldOut && "grayscale")} iconSize={26} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug text-fg">{prize.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <PrizeTypeBadge type={prize.type} />
          {prize.type === "point" ? (
            <Amount kind="point" value={prize.pointValue} size="xs" />
          ) : (
            prize.pointValue > 0 && <span className="text-[11px] text-subtle">参考価値 {formatPoints(prize.pointValue)}</span>
          )}
        </div>
        <dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1">
            <dt className="text-subtle">確率</dt>
            <dd className="tabular font-bold text-fg">
              {prize.soldOut ? "—" : formatProbability(prize.effectivePpb)}
              {prize.isFallback && <span className="ml-1 font-medium text-subtle">（残り確率）</span>}
            </dd>
          </div>
          <div className="flex items-center gap-1">
            <dt className="text-subtle">在庫</dt>
            <dd className="tabular font-bold text-fg">
              {prize.stock === null ? "無制限" : prize.soldOut ? "終了" : `残り${formatNumber(prize.remainingStock ?? 0)}個`}
            </dd>
          </div>
        </dl>
      </div>
      {prize.soldOut && (
        <span className="absolute right-2 top-2 rounded-md bg-danger/90 px-1.5 py-0.5 text-[10px] font-black text-white">終了</span>
      )}
    </li>
  );
}

function RankHeader({ group }: { group: PrizeGroupDto }) {
  const { rank, prizes } = group;
  const total = prizes.reduce((sum, p) => sum + p.effectivePpb, 0);
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${rank.color} 22%, transparent), transparent 80%)` }}
    >
      <div className="flex min-w-0 items-center gap-3">
        {rank.logoUrl ? (
          <img src={rank.logoUrl} alt={rank.name} className="h-10 w-auto shrink-0 object-contain sm:h-12" loading="lazy" />
        ) : (
          <span className="font-display text-2xl" style={{ color: rank.color }}>
            {rank.name}
          </span>
        )}
        {rank.subtitle && (
          <span className="hidden truncate text-xs font-bold sm:inline" style={{ color: rank.color }}>
            {rank.subtitle}
          </span>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-bold text-muted">当選確率（合計）</p>
        <p className="tabular text-xs font-black text-fg">{formatProbability(total)}</p>
      </div>
    </div>
  );
}

export function PrizeLineup({ groups, expectedPoints }: { groups: PrizeGroupDto[]; expectedPoints: number }) {
  return (
    <section aria-labelledby="lineup-heading">
      <SectionHeading icon="gift" title="景品ラインナップ" id="lineup-heading" sub={`全${groups.reduce((n, g) => n + g.prizes.length, 0)}種`} />
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState icon="gift" title="景品は準備中です" description="景品が登録されるまでしばらくお待ちください。" />
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group.rank.id}
              className="overflow-hidden rounded-2xl border bg-surface"
              style={{ borderColor: `color-mix(in srgb, ${group.rank.color} 35%, var(--line))` } as CSSProperties}
            >
              <RankHeader group={group} />
              <ul className="grid gap-2.5 p-3 sm:grid-cols-2">
                {group.prizes.map((prize) => (
                  <PrizeRow key={prize.id} prize={prize} color={group.rank.color} />
                ))}
              </ul>
            </div>
          ))}
          {expectedPoints > 0 && (
            <p className="flex items-center gap-1.5 px-1 text-[11px] text-subtle">
              <Icon name="info" size={12} />
              ポイント景品の期待値: 1回あたり 約{expectedPoints.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}pt（現在の在庫状況で計算）
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recent wins of this gacha
// ---------------------------------------------------------------------------

export function RecentWins({ wins, now }: { wins: BigWinDto[]; now: number }) {
  return (
    <section aria-labelledby="wins-heading">
      <SectionHeading icon="trophy" title="最近の当選" id="wins-heading" sub="B賞以上・ラストワン賞" />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {wins.length === 0 ? (
          <EmptyState icon="trophy" title="まだ大当たりは出ていません" description="最初の当選者になるチャンスです！" className="py-9" />
        ) : (
          <ul className="divide-y divide-line">
            {wins.map((w) => (
              <li key={w.drawId} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-black text-white"
                  style={{ background: `linear-gradient(135deg, ${w.rankColor}, color-mix(in srgb, ${w.rankColor} 45%, #1b1640))` }}
                  aria-hidden="true"
                >
                  {w.nickname.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">
                    <span className="font-bold">{w.nickname}</span>
                    <span className="text-muted">さん</span>
                  </p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                    <span
                      className="shrink-0 rounded px-1.5 py-px text-[10px] font-black"
                      style={{ color: w.rankColor, backgroundColor: `color-mix(in srgb, ${w.rankColor} 16%, transparent)` }}
                    >
                      {w.rankName}
                    </span>
                    <span className="truncate text-fg/85">{w.prizeName}</span>
                  </p>
                </div>
                <PrizeImage src={w.prizeImageUrl} alt="" className="size-10 shrink-0" iconSize={18} />
                <span className="w-14 shrink-0 text-right text-[11px] text-subtle">{formatRelative(w.at, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 注意事項
// ---------------------------------------------------------------------------

export function GachaNotes({ ticketCost }: { ticketCost: number }) {
  const notes: Array<[IconName, string]> = [
    ["percent", "各景品の当選確率は表示の通りです。在庫に上限がある景品がなくなった場合、その確率は「残り確率」の景品に振り替えられます。"],
    ["shieldCheck", "当選結果はサーバー側で確定します。抽選には暗号論的に安全な乱数（CSPRNG）を使用しており、画面の演出は確定した結果を表示するものです。"],
    ["history", "演出の途中で画面を閉じても結果は失われません。マイページの「ガチャ履歴」でいつでも確認できます。"],
    ["gift", "ポイント景品は即時にポイント残高へ付与されます。デジタル特典・実物景品はマイページの「獲得景品」に追加されます。"],
    ["truck", "実物景品は「獲得景品」からお届け先を入力して発送をご依頼ください。"],
    ["crown", "ラストワン賞は、最後の1口を引いた方に贈呈します（10回・100回ガチャで最後の口まで引いた場合も対象です）。"],
    ["ticket", `1回につきガチャチケットを${ticketCost}枚使用します。使用したチケットは返還できません。`],
    ["flask", "本サイトはデモです。実際の景品の発送・ギフトコードの発行は行われません。"],
  ];
  return (
    <section aria-labelledby="notes-heading">
      <SectionHeading icon="info" title="注意事項" id="notes-heading" />
      <ul className="space-y-2.5 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        {notes.map(([icon, text]) => (
          <li key={text} className="flex gap-2.5 text-xs leading-relaxed text-fg/85 sm:text-[13px]">
            <Icon name={icon} size={15} className="mt-0.5 shrink-0 text-muted" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
