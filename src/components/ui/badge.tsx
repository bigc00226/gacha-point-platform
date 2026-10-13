import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "./icon";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "gold"
  | "ticket"
  | "point";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-muted ring-line-strong/60",
  primary: "bg-primary/12 text-primary ring-primary/30",
  success: "bg-success/12 text-success ring-success/30",
  warning: "bg-warning/12 text-warning ring-warning/30",
  danger: "bg-danger/12 text-danger ring-danger/30",
  info: "bg-info/12 text-info ring-info/30",
  gold: "bg-accent/15 text-accent ring-accent/35",
  ticket: "bg-ticket/12 text-ticket ring-ticket/30",
  point: "bg-point/12 text-point ring-point/30",
};

export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
  size = "sm",
}: {
  tone?: BadgeTone;
  icon?: IconName;
  className?: string;
  children: ReactNode;
  size?: "xs" | "sm";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-bold ring-1 ring-inset",
        size === "xs" ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-xs",
        TONES[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={size === "xs" ? 10 : 12} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

/** Badge colored with a rank's hex color (特賞 / A賞 ...). */
export function RankBadge({
  name,
  color,
  size = "sm",
  className,
}: {
  name: string;
  color: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md font-black tracking-wide",
        size === "xs" && "px-1.5 py-px text-[10px]",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        className,
      )}
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)`,
      }}
    >
      {name}
    </span>
  );
}
