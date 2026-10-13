import { cn, formatNumber } from "@/lib/format";
import { Icon } from "./icon";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const TEXT: Record<Size, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-3xl",
};
const ICON: Record<Size, number> = { xs: 12, sm: 14, md: 16, lg: 20, xl: 28 };

/** Small round currency mark: ticket (cyan) or point (gold "P"). */
export function CurrencyIcon({ kind, size = 16, className }: { kind: "ticket" | "point"; size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full",
        kind === "ticket" ? "bg-ticket/15 text-ticket" : "bg-point/15 text-point",
        className,
      )}
      style={{ width: size + 8, height: size + 8 }}
      aria-hidden="true"
    >
      <Icon name={kind === "ticket" ? "ticket" : "coin"} size={size} strokeWidth={2.2} />
    </span>
  );
}

/**
 * Formatted amount with its unit. Tickets are always cyan and "枚", points are
 * always gold and "pt", so the two balances are never confused.
 */
export function Amount({
  kind,
  value,
  size = "md",
  signed = false,
  icon = false,
  className,
}: {
  kind: "ticket" | "point";
  value: number;
  size?: Size;
  signed?: boolean;
  icon?: boolean;
  className?: string;
}) {
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "-" : "") : value < 0 ? "-" : "";
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 font-black",
        kind === "ticket" ? "text-ticket" : "text-point",
        TEXT[size],
        className,
      )}
    >
      {icon && <Icon name={kind === "ticket" ? "ticket" : "coin"} size={ICON[size]} strokeWidth={2.2} />}
      <span>
        {sign}
        {formatNumber(Math.abs(value))}
      </span>
      <span className="text-[0.7em] font-bold opacity-80">{kind === "ticket" ? "枚" : "pt"}</span>
    </span>
  );
}
