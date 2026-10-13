"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/format";
import { Icon } from "./icon";

/** Client-side paging over an in-memory list. Resets to page 1 when the list length changes. */
export function usePaged<T>(items: T[], pageSize = 20) {
  const [state, setState] = useState({ page: 1, length: items.length });
  const page = state.length === items.length ? state.page : 1;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );
  return {
    page: current,
    pageCount,
    pageItems,
    total: items.length,
    setPage: (p: number) => setState({ page: p, length: items.length }),
  };
}

export function Pagination({
  page,
  pageCount,
  onChange,
  total,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  total?: number;
  className?: string;
}) {
  if (pageCount <= 1) {
    return total !== undefined ? <p className={cn("text-xs text-muted", className)}>全{total.toLocaleString()}件</p> : null;
  }
  const pages: Array<number | "…"> = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const btn = "grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-bold transition-colors";
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      {total !== undefined && <p className="text-xs text-muted">全{total.toLocaleString()}件</p>}
      <nav className="flex items-center gap-1" aria-label="ページ送り">
        <button type="button" className={cn(btn, "text-muted hover:bg-surface-3 disabled:opacity-40")} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="前のページ">
          <Icon name="chevronLeft" size={16} />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-subtle">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(btn, p === page ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-3")}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className={cn(btn, "text-muted hover:bg-surface-3 disabled:opacity-40")} onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label="次のページ">
          <Icon name="chevronRight" size={16} />
        </button>
      </nav>
    </div>
  );
}
