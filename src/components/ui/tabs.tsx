"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "./icon";
import { useScrollFade } from "./use-scroll-fade";

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  icon?: IconName;
  count?: number;
}

/**
 * Controlled tabs. `pill` = segmented control, `underline` = classic tabs.
 * By default the bar scrolls sideways when it doesn't fit (with faded edges).
 * Phones can instead show every tab:
 *   - `fullWidth`: equal-width tabs in one row (2–3 tabs); long labels wrap
 *   - `mobileColumns`: a grid with that many columns (many tabs)
 * In both, icons are dropped below `sm` to leave room for the labels.
 */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  variant = "pill",
  fullWidth = false,
  mobileColumns,
  className,
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  variant?: "pill" | "underline";
  fullWidth?: boolean;
  mobileColumns?: 2 | 3;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const fits = fullWidth || !!mobileColumns;
  const fade = useScrollFade(listRef, !fullWidth);

  useEffect(() => {
    // Keep the selected tab in view — horizontally only (scrollIntoView would also scroll the page).
    const el = listRef.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !tab || el.scrollWidth <= el.clientWidth) return;
    const box = el.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    if (t.left < box.left) el.scrollLeft -= box.left - t.left + 12;
    else if (t.right > box.right) el.scrollLeft += t.right - box.right + 12;
  }, [value]);

  return (
    <div
      ref={listRef}
      role="tablist"
      style={fade}
      className={cn(
        "no-scrollbar flex overflow-x-auto",
        variant === "pill" ? "gap-1 rounded-2xl border border-line bg-surface-2 p-1" : "gap-1 border-b border-line",
        fullWidth && "w-full",
        mobileColumns === 2 && "max-sm:grid max-sm:grid-cols-2",
        mobileColumns === 3 && "max-sm:grid max-sm:grid-cols-3",
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
              fullWidth && "min-w-0 flex-1",
              fits && "max-sm:min-w-0 max-sm:whitespace-normal max-sm:text-center max-sm:leading-tight max-sm:[&>svg]:hidden",
              variant === "pill"
                ? cn("h-9 rounded-xl px-3.5", fits && "max-sm:h-auto max-sm:min-h-9 max-sm:px-1.5 max-sm:py-1.5", active ? "bg-surface text-fg shadow-sm ring-1 ring-line" : "text-muted hover:text-fg")
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
