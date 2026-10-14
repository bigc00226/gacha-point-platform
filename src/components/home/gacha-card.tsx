import Link from "next/link";
import { cn, formatNumber, formatPercent } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/misc";
import { Countdown } from "@/components/gacha/countdown";
import { CoverImage, PrizeImage } from "@/components/gacha/prize-image";
import type { GachaCardDto } from "@/components/gacha/types";
import styles from "./home.module.css";

/** Gacha list card: artwork, remaining slots, cost, last-one prize. */
export function GachaCard({ gacha, serverNow, priority = false }: { gacha: GachaCardDto; serverNow: number; priority?: boolean }) {
  const soldOut = gacha.status === "soldout" || gacha.remainingSlots <= 0;
  const ratio = gacha.totalSlots > 0 ? gacha.remainingSlots / gacha.totalSlots : 0;
  const unavailableLabel = soldOut ? null : gacha.ended ? "販売終了" : gacha.status === "paused" ? "一時停止中" : null;

  return (
    <Link
      href={`/gacha/${gacha.id}`}
      prefetch={false}
      className={cn(
        "group cv-auto relative flex flex-col overflow-hidden rounded-2xl border bg-surface transition duration-200 [--cv-size:340px]",
        "hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-primary/10 focus-visible:outline-2 focus-visible:outline-primary",
        gacha.nearLastOne && !soldOut ? cn("border-accent/40", styles.cardGlow) : "border-line hover:border-line-strong",
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        <CoverImage
          src={gacha.thumbnailUrl}
          alt={gacha.title}
          className={cn("size-full transition-transform duration-500 group-hover:scale-[1.03]", soldOut && "grayscale-[60%]")}
          loading={priority ? "eager" : "lazy"}
        />
        {soldOut && (
          <div className="absolute inset-0 grid place-items-center bg-black/55">
            <span className={cn("rounded-lg bg-danger px-5 py-2 font-display text-2xl tracking-widest text-white", styles.soldStamp)}>
              SOLD OUT
            </span>
          </div>
        )}
        {unavailableLabel && (
          <div className="absolute inset-0 grid place-items-center bg-black/55">
            <span className="rounded-lg bg-surface-3 px-4 py-1.5 text-sm font-black text-fg">{unavailableLabel}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {gacha.badge && (
              <span className="rounded-md bg-linear-to-r from-primary to-primary-2 px-1.5 py-px text-[10px] font-black tracking-wider text-white">
                {gacha.badge}
              </span>
            )}
            {gacha.nearLastOne && !soldOut && !gacha.badge?.includes("ラストワン") && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-accent/15 px-1.5 py-px text-[10px] font-black text-accent ring-1 ring-inset ring-accent/40">
                <Icon name="crown" size={10} filled />
                ラストワン間近
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-muted">
              <Icon name="ticket" size={12} className="text-ticket" strokeWidth={2.4} />1回
              <span className="tabular font-black text-ticket">{formatNumber(gacha.ticketCost)}</span>枚
            </span>
          </div>
          <h3 className="truncate text-base font-black text-fg">{gacha.title}</h3>
          {gacha.subtitle && <p className="mt-0.5 truncate text-xs font-bold text-primary">{gacha.subtitle}</p>}
        </div>

        <div>
          <div className="flex items-end justify-between gap-2 text-xs">
            <span className="text-muted">
              残り
              <span className={cn("tabular mx-1 text-lg font-black", gacha.nearLastOne && !soldOut ? "text-accent" : "text-fg")}>
                {formatNumber(gacha.remainingSlots)}
              </span>
              口
            </span>
            <span className="tabular text-subtle">
              / {formatNumber(gacha.totalSlots)}口（{formatPercent(ratio, ratio < 0.01 && ratio > 0 ? 2 : 1)}）
            </span>
          </div>
          <ProgressBar
            value={gacha.remainingSlots}
            max={gacha.totalSlots}
            size="sm"
            tone={gacha.nearLastOne || soldOut ? "gold" : "rainbow"}
            className="mt-1.5"
            label="残り口数"
          />
        </div>

        <div className="mt-auto flex items-center gap-2.5 rounded-xl bg-surface-2 p-2">
          {gacha.lastOnePrize ? (
            <>
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-linear-to-br from-[#3a2a05] to-[#1d1405] ring-1 ring-accent/40">
                <PrizeImage src={gacha.lastOnePrize.imageUrl} alt="" className="size-8" iconSize={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black tracking-wider text-accent">ラストワン賞</p>
                <p className="truncate text-xs font-bold text-fg">
                  {soldOut && gacha.lastOneWinner ? `${gacha.lastOneWinner.nickname}さんが獲得` : gacha.lastOnePrize.name}
                </p>
              </div>
            </>
          ) : gacha.topPrize ? (
            <>
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-3">
                <PrizeImage src={gacha.topPrize.imageUrl} alt="" className="size-8" iconSize={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black" style={{ color: gacha.topPrize.rankColor }}>
                  {gacha.topPrize.rankName}
                </p>
                <p className="truncate text-xs font-bold text-fg">{gacha.topPrize.name}</p>
              </div>
            </>
          ) : (
            <p className="flex-1 text-xs text-muted">景品を準備中です</p>
          )}
          {gacha.endsAt && !soldOut && !gacha.ended && (
            <span className="shrink-0 rounded-lg bg-warning/12 px-2 py-1 text-[11px] font-bold text-warning">
              <Icon name="clock" size={11} className="mr-0.5 inline" />
              <Countdown endsAt={gacha.endsAt} serverNow={serverNow} prefix="あと" endedLabel="終了" />
            </span>
          )}
          {!gacha.endsAt && !soldOut && (
            <Icon name="chevronRight" size={18} className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
          )}
        </div>
      </div>
    </Link>
  );
}
