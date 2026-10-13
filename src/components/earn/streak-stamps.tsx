import { cn, formatNumber } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import styles from "./earn.module.css";

/**
 * 7-day login stamp card. `day` is today's position in the streak (the streak
 * including today when claimed, or the streak today's claim would make).
 */
export function StreakStamps({
  day,
  claimedToday,
  tickets,
  animateToday = false,
  className,
}: {
  day: number;
  claimedToday: boolean;
  tickets: number;
  animateToday?: boolean;
  className?: string;
}) {
  const position = ((Math.max(1, day) - 1) % 7) + 1;
  return (
    <ol className={cn("grid grid-cols-7 gap-1 sm:gap-1.5", className)} aria-label={`連続ログイン ${day}日目`}>
      {Array.from({ length: 7 }, (_, i) => {
        const n = i + 1;
        const isToday = n === position;
        const stamped = n < position || (isToday && claimedToday);
        return (
          <li
            key={n}
            className={cn(
              "relative flex min-w-0 flex-col items-center rounded-xl px-0.5 pb-1.5 pt-1 text-center ring-1 ring-inset",
              stamped && !isToday && "bg-primary/10 ring-primary/30",
              isToday && claimedToday && "bg-accent/12 ring-accent/50",
              isToday && !claimedToday && cn("bg-accent/15 ring-2 ring-accent", styles.todayPulse),
              !stamped && !isToday && "bg-surface-2 ring-line",
            )}
          >
            <span
              className={cn(
                "text-[9px] font-black leading-4 tracking-tight sm:text-[10px]",
                isToday ? "text-accent" : stamped ? "text-primary" : "text-subtle",
              )}
            >
              {isToday ? "TODAY" : `${n}日目`}
            </span>
            <span className="my-0.5 grid size-7 place-items-center">
              {stamped ? (
                <span
                  className={cn(
                    "grid size-7 rotate-[-8deg] place-items-center rounded-full border-2",
                    isToday ? "border-accent text-accent" : "border-primary text-primary",
                    isToday && animateToday && styles.stampIn,
                  )}
                >
                  <Icon name="check" size={15} strokeWidth={3.2} />
                </span>
              ) : (
                <Icon name="ticket" size={18} className={isToday ? "text-accent" : "text-subtle"} strokeWidth={2.2} />
              )}
            </span>
            <span
              className={cn(
                "tabular text-[10px] font-black leading-none",
                isToday ? "text-fg" : stamped ? "text-fg/70" : "text-subtle",
              )}
            >
              {formatNumber(tickets)}枚
            </span>
          </li>
        );
      })}
    </ol>
  );
}
