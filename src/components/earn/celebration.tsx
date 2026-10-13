import type { CSSProperties } from "react";
import { cn, formatNumber } from "@/lib/format";
import styles from "./earn.module.css";

const COLORS = ["#ff3e8a", "#ff8a3d", "#ffd23f", "#35d0ff", "#2fd38a", "#b05cff", "#ffffff"];

/** One-shot confetti burst from the center of the nearest positioned parent. */
export function Burst({ count = 32, spread = 1, className }: { count?: number; spread?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn(styles.burst, className)}>
      {Array.from({ length: count }, (_, i) => {
        const style = {
          "--angle": `${(i * 137.508) % 360}deg`,
          "--distance": `${Math.round((70 + ((i * 53) % 95)) * spread)}px`,
          "--delay": `${(i % 6) * 35}ms`,
          "--size": `${6 + (i % 4) * 2}px`,
          "--color": COLORS[i % COLORS.length],
          "--spin": `${(i % 2 ? 1 : -1) * (200 + ((i * 47) % 260))}deg`,
        } as CSSProperties;
        return <span key={i} className={styles.particle} style={style} />;
      })}
    </div>
  );
}

/** Slowly rotating light rays (place inside a relative, overflow-hidden box). */
export function Rays({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn(styles.rays, className)} />;
}

/** The pink "GACHA TICKET" illustration used for rewards. */
export function TicketArt({
  amount,
  size = "md",
  className,
  float = false,
  tilt = -8,
}: {
  amount?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  float?: boolean;
  tilt?: number;
}) {
  const dims = {
    sm: "h-12 w-24 text-[8px]",
    md: "h-20 w-40 text-[11px]",
    lg: "h-28 w-56 text-sm",
  }[size];
  const digits = amount === undefined ? 0 : formatNumber(amount).length;
  const amountSize = {
    sm: digits <= 1 ? "text-base" : digits === 2 ? "text-sm" : "text-xs",
    md: digits <= 1 ? "text-3xl" : digits === 2 ? "text-2xl" : "text-lg",
    lg: digits <= 1 ? "text-5xl" : digits === 2 ? "text-4xl" : "text-2xl",
  }[size];
  return (
    <div
      aria-hidden="true"
      className={cn(float && styles.ticketFloat, className)}
      style={{ "--tilt": `${tilt}deg`, transform: float ? undefined : `rotate(${tilt}deg)` } as CSSProperties}
    >
      <div className={cn(styles.ticket, dims, "text-white")}>
        <div className="absolute inset-y-0 left-0 flex w-[64%] flex-col items-center justify-center leading-[1.1]">
          <p className="font-display tracking-wider">GACHA</p>
          <p className="font-display tracking-wider opacity-90">TICKET</p>
        </div>
        <span className="pointer-events-none absolute inset-y-[18%] left-[64%] border-l-2 border-dashed border-white/50" />
        <div className="absolute inset-y-0 right-0 flex w-[36%] items-center justify-center pr-[3%]">
          {amount !== undefined ? (
            <p className={cn("font-display tabular leading-none drop-shadow-[0_2px_0_rgba(120,0,40,0.35)]", amountSize)}>
              <span className="text-[0.6em]">×</span>
              {formatNumber(amount)}
            </p>
          ) : (
            <span className="aspect-square w-[46%] rounded-full bg-white/85 ring-4 ring-white/30" />
          )}
        </div>
      </div>
    </div>
  );
}
