"use client";

import Link from "next/link";
import { useState } from "react";
import type { ExchangeItem } from "@/lib/types";
import { cn, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/misc";
import { PrizeImage } from "@/components/gacha/prize-image";

type TypeFilter = "all" | "physical" | "digital";
type Sort = "recommended" | "asc" | "desc";

export function ExchangeCatalog({ items, points }: { items: ExchangeItem[]; points: number | null }) {
  const [type, setType] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<Sort>("recommended");
  const shown = items
    .filter((i) => type === "all" || i.type === type)
    .sort((a, b) => (sort === "asc" ? a.pointsRequired - b.pointsRequired : sort === "desc" ? b.pointsRequired - a.pointsRequired : a.sortOrder - b.sortOrder));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(
            [
              ["all", "すべて"],
              ["physical", "実物景品"],
              ["digital", "デジタル"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-sm font-bold transition-colors",
                type === key ? "border-transparent bg-linear-to-r from-[#ffd23f] to-[#f0960e] text-[#3a2100]" : "border-line bg-surface text-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="並び順" className="w-44">
          <option value="recommended">おすすめ順</option>
          <option value="asc">ポイントが少ない順</option>
          <option value="desc">ポイントが多い順</option>
        </Select>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="gift" title="該当する景品はありません" className="rounded-2xl border border-line bg-surface" />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => {
            const soldOut = item.stock <= 0;
            const short = points !== null ? item.pointsRequired - points : 0;
            const affordable = points !== null && short <= 0;
            return (
              <li key={item.id}>
                <Link
                  href={`/exchange/${item.id}`}
                  className={cn(
                    "group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-point/40",
                    soldOut && "opacity-70",
                  )}
                >
                  <div className="relative grid aspect-square place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(255,197,61,0.22),transparent_65%)]">
                    <PrizeImage src={item.imageUrl} alt={item.name} className="size-[72%] transition-transform duration-300 group-hover:scale-105" />
                    <Badge tone={item.type === "digital" ? "ticket" : "primary"} size="xs" className="absolute left-2 top-2">
                      {item.type === "digital" ? "デジタル" : "実物景品"}
                    </Badge>
                    {soldOut && (
                      <span className="absolute inset-x-0 bottom-0 bg-black/70 py-1.5 text-center text-xs font-black text-white">在庫切れ</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-fg">{item.name}</p>
                    <p className="tabular mt-auto font-display text-lg leading-none text-point">
                      {formatNumber(item.pointsRequired)}
                      <span className="ml-0.5 text-xs">pt</span>
                    </p>
                    <p className="text-[11px] text-muted">
                      {soldOut ? "再入荷をお待ちください" : `残り ${formatNumber(item.stock)}点`}
                      {!soldOut && points !== null && !affordable && <span className="ml-1 text-danger">（あと{formatNumber(short)}pt）</span>}
                      {!soldOut && affordable && (
                        <span className="ml-1 text-success">
                          <Icon name="check" size={11} className="inline" />
                          交換可能
                        </span>
                      )}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
