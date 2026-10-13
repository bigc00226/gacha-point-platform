import { cn } from "@/lib/format";
import { formatRelative } from "@/lib/time";
import { Icon } from "@/components/ui/icon";
import type { BigWinDto } from "@/components/gacha/types";
import styles from "./home.module.css";

function Item({ win, now }: { win: BigWinDto; now: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-white"
        style={{ background: `linear-gradient(135deg, ${win.rankColor}, color-mix(in srgb, ${win.rankColor} 40%, #1b1640))` }}
        aria-hidden="true"
      >
        {win.nickname.slice(0, 1)}
      </span>
      <span className="font-bold text-fg">{win.nickname}</span>
      <span className="text-muted">さんが</span>
      <span
        className="rounded px-1.5 py-px text-[11px] font-black"
        style={{ color: win.rankColor, backgroundColor: `color-mix(in srgb, ${win.rankColor} 16%, transparent)` }}
      >
        {win.isLastOne ? "ラストワン賞" : win.rankName}
      </span>
      <span className="font-bold text-fg">「{win.prizeName}」</span>
      <span className="text-muted">をGET！</span>
      <span className="text-[11px] text-subtle">{formatRelative(win.at, now)}</span>
    </span>
  );
}

/** Scrolling "recent big wins" bar. */
export function WinsTicker({ wins, now }: { wins: BigWinDto[]; now: number }) {
  if (wins.length === 0) return null;
  const duration = `${Math.max(30, wins.length * 7)}s`;
  return (
    <div
      className={cn("relative flex items-center overflow-hidden rounded-2xl border border-line bg-surface/80", styles.marqueeHost)}
      aria-label="最近の当選者"
    >
      <span className="relative z-10 inline-flex h-11 shrink-0 items-center gap-1.5 bg-linear-to-r from-primary to-primary-2 px-3.5 text-xs font-black tracking-wider text-white shadow-[8px_0_16px_-4px_rgba(10,8,32,0.9)]">
        <Icon name="trophy" size={15} />
        <span className="hidden sm:inline">当選速報</span>
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div
          className={cn("flex w-max gap-10 whitespace-nowrap py-2.5 pl-6", styles.marquee)}
          style={{ ["--marquee-duration" as string]: duration }}
        >
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-10" aria-hidden={copy === 1 ? true : undefined}>
              {wins.map((w) => (
                <Item key={`${copy}-${w.drawId}`} win={w} now={now} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
