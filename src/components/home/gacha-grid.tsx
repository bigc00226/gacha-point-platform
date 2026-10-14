"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/format";
import { Icon, type IconName } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/misc";
import { useScrollFade } from "@/components/ui/use-scroll-fade";
import type { GachaCardDto } from "@/components/gacha/types";
import { GachaCard } from "./gacha-card";

type FilterKey = "all" | "featured" | "last" | "limited" | "soldout";

const FILTERS: Array<{ key: FilterKey; label: string; icon: IconName; test: (g: GachaCardDto) => boolean }> = [
  { key: "all", label: "すべて", icon: "grid", test: () => true },
  { key: "featured", label: "注目", icon: "star", test: (g) => g.featured && g.status !== "soldout" },
  { key: "last", label: "ラストワン間近", icon: "crown", test: (g) => g.nearLastOne && g.available },
  { key: "limited", label: "期間限定", icon: "clock", test: (g) => !!g.endsAt && g.available },
  { key: "soldout", label: "完売", icon: "archive", test: (g) => g.status === "soldout" },
];

export function GachaGrid({ gachas, serverNow }: { gachas: GachaCardDto[]; serverNow: number }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const chipsRef = useRef<HTMLDivElement>(null);
  const chipsFade = useScrollFade(chipsRef);
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = gachas.filter(active.test);

  return (
    <div>
      <div ref={chipsRef} style={chipsFade} className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="ガチャの絞り込み">
        {FILTERS.map((f) => {
          const count = gachas.filter(f.test).length;
          if (f.key !== "all" && count === 0) return null;
          const selected = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition-colors",
                selected
                  ? "border-transparent bg-linear-to-r from-primary to-primary-2 text-white shadow-lg shadow-primary/25"
                  : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
              )}
            >
              <Icon name={f.icon} size={14} />
              {f.label}
              <span className={cn("tabular text-[11px]", selected ? "text-white/80" : "text-subtle")}>{count}</span>
            </button>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon="capsule" title="該当するガチャはありません" className="rounded-2xl border border-line bg-surface" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g, i) => (
            <GachaCard key={g.id} gacha={g} serverNow={serverNow} priority={i < 3} />
          ))}
        </div>
      )}
    </div>
  );
}
