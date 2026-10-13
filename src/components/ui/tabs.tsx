"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "./icon";

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  icon?: IconName;
  count?: number;
}

/** Controlled tabs. `pill` = segmented control, `underline` = classic tabs. */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  variant = "pill",
  fullWidth = false,
  className,
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  variant?: "pill" | "underline";
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "no-scrollbar flex overflow-x-auto",
        variant === "pill" ? "gap-1 rounded-2xl border border-line bg-surface-2 p-1" : "gap-1 border-b border-line",
        fullWidth && "w-full",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap text-sm font-bold transition-colors",
              fullWidth && "flex-1",
              variant === "pill"
                ? cn("h-9 rounded-xl px-3.5", active ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg")
                : cn("-mb-px h-11 border-b-2 px-3", active ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg"),
            )}
          >
            {item.icon && <Icon name={item.icon} size={16} />}
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-[11px] leading-5",
                  active ? "bg-primary/15 text-primary" : "bg-surface-3 text-muted",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
