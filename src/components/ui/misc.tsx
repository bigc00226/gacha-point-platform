import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "./icon";

/** Horizontal progress bar. `tone` colors the fill. */
export function ProgressBar({
  value,
  max = 100,
  tone = "primary",
  size = "md",
  className,
  label,
}: {
  value: number;
  max?: number;
  tone?: "primary" | "gold" | "ticket" | "success" | "danger" | "rainbow";
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fills = {
    primary: "bg-linear-to-r from-primary to-primary-2",
    gold: "bg-linear-to-r from-[#ffe58a] via-[#ffc93d] to-[#f0960e]",
    ticket: "bg-linear-to-r from-ticket to-info",
    success: "bg-success",
    danger: "bg-danger",
    rainbow: "bg-linear-to-r from-[#ff4d6d] via-[#ffd43b] to-[#35d0ff]",
  } as const;
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-surface-3",
        size === "sm" ? "h-1.5" : size === "md" ? "h-2.5" : "h-4",
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", fills[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  icon = "archive",
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="grid size-14 place-items-center rounded-2xl bg-surface-3 text-subtle">
        <Icon name={icon} size={26} />
      </span>
      <p className="mt-4 text-sm font-bold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden="true" />;
}

/** KPI tile for dashboards. */
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "primary",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: IconName;
  tone?: "primary" | "ticket" | "point" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    primary: "bg-primary/12 text-primary",
    ticket: "bg-ticket/12 text-ticket",
    point: "bg-point/12 text-point",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
    danger: "bg-danger/12 text-danger",
    info: "bg-info/12 text-info",
  } as const;
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-muted">{label}</p>
        {icon && (
          <span className={cn("grid size-8 place-items-center rounded-lg", tones[tone])}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <p className="tabular mt-2 text-2xl font-black tracking-tight text-fg">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** Page title block used at the top of admin pages. */
export function PageHeader({
  title,
  description,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <Icon name={icon} size={20} />
          </span>
        )}
        <div>
          <h1 className="text-xl font-black tracking-tight text-fg sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Section heading used on the user-facing site. */
export function SectionTitle({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-3", className)}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-primary to-primary-2 text-white shadow-lg shadow-primary/30">
            <Icon name={icon} size={18} />
          </span>
        )}
        <div>
          <h2 className="font-display text-lg leading-tight text-fg sm:text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Inline notice box. */
export function Notice({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  const tones = {
    info: "border-info/30 bg-info/8 text-info",
    success: "border-success/30 bg-success/8 text-success",
    warning: "border-warning/35 bg-warning/8 text-warning",
    danger: "border-danger/30 bg-danger/8 text-danger",
    neutral: "border-line bg-surface-2 text-muted",
  } as const;
  const icons = { info: "info", success: "checkCircle", warning: "alert", danger: "xCircle", neutral: "info" } as const;
  return (
    <div className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm", tones[tone], className)}>
      <Icon name={icon ?? icons[tone]} size={18} className="mt-px shrink-0" />
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn("text-fg/85", title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

/** Small key/value list. */
export function DescriptionList({
  items,
  className,
}: {
  items: Array<{ label: ReactNode; value: ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-line text-sm", className)}>
      {items.map((item, i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-muted">{item.label}</dt>
          <dd className="min-w-0 text-right font-medium text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
