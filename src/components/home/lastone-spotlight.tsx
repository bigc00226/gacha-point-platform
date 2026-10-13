import Link from "next/link";
import { cn, formatNumber } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { PrizeImage } from "@/components/gacha/prize-image";
import type { GachaCardDto } from "@/components/gacha/types";
import styles from "./home.module.css";

/** Gold call-out for a gacha that is about to sell out (ラストワン賞 chance). */
export function LastOneSpotlight({ gacha, rankLogoUrl }: { gacha: GachaCardDto; rankLogoUrl: string | null }) {
  const prize = gacha.lastOnePrize;
  if (!prize) return null;
  return (
    <Link
      href={`/gacha/${gacha.id}`}
      prefetch={false}
      className={cn(
        "group relative grid overflow-hidden rounded-3xl border border-accent/40 p-5 transition-transform hover:-translate-y-0.5 sm:grid-cols-[1.15fr_1fr] sm:p-7",
        styles.spotlight,
        styles.cardGlow,
      )}
    >
      <div className="relative z-10 flex flex-col">
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-[11px] font-black tracking-[0.2em] text-accent ring-1 ring-inset ring-accent/40">
          <Icon name="crown" size={12} filled />
          LAST ONE CHANCE
        </p>
        <h2 className="mt-3 font-display text-xl leading-tight text-fg sm:text-2xl">{gacha.title}</h2>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-sm font-bold text-muted">残り</span>
          <span className="tabular font-display text-6xl leading-none text-gradient-gold sm:text-7xl">
            {formatNumber(gacha.remainingSlots)}
          </span>
          <span className="pb-1 text-lg font-black text-accent">口</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-fg/90">
          最後の1口を引いた方に、ラストワン賞
          <span className="mx-1 font-black text-accent">「{prize.name}」</span>
          をプレゼント！
        </p>
        <span className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#fff1a8] via-[#ffc93d] to-[#f0960e] px-6 text-base font-black text-[#3a2100] shadow-lg shadow-[#ffb800]/30 transition group-hover:brightness-105 sm:w-fit">
          <Icon name="capsule" size={20} />
          今すぐ挑戦する
          <Icon name="arrowRight" size={18} />
        </span>
      </div>

      <div className="relative mt-4 grid min-h-44 place-items-center sm:mt-0 sm:min-h-56">
        <div className={cn("absolute aspect-square w-[130%] max-w-[420px] rounded-full", styles.rays)} aria-hidden="true" />
        <div className={cn("absolute bottom-3 h-10 w-3/4 rounded-full", styles.pedestal)} aria-hidden="true" />
        <PrizeImage
          src={prize.imageUrl}
          alt={prize.name}
          className="relative mt-10 size-36 animate-float drop-shadow-[0_18px_30px_rgba(0,0,0,0.55)] sm:mt-8 sm:size-64"
          iconSize={56}
          loading="eager"
        />
        {rankLogoUrl && (
          <img
            src={rankLogoUrl}
            alt="ラストワン賞"
            className="absolute -top-1 left-1/2 w-36 -translate-x-1/2 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] sm:w-52"
          />
        )}
      </div>
    </Link>
  );
}
