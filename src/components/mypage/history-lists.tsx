"use client";

import { useState } from "react";
import type { DrawRecord, LedgerEntry, Order } from "@/lib/types";
import { formatAddress } from "@/lib/address";
import { LEDGER_REASON_LABELS, ORDER_SOURCE_LABELS, ORDER_STATUS_LABELS } from "@/lib/constants";
import { cn, formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/time";
import { Badge, RankBadge, type BadgeTone } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/misc";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { PrizeImage } from "@/components/gacha/prize-image";

const ORDER_TONE: Record<Order["status"], BadgeTone> = { pending: "warning", shipped: "success", cancelled: "neutral" };

export function OrdersList({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <EmptyState icon="truck" title="交換・発送の履歴はまだありません" description="ポイント交換や、ガチャで当たった実物景品の発送依頼がここに表示されます。" className="rounded-2xl border border-line bg-surface" />;
  }
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex gap-3.5">
            <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-surface-2">
              <PrizeImage src={o.imageUrl} alt="" className="size-12" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={ORDER_TONE[o.status]}>{o.itemType === "digital" && o.status === "shipped" ? "発行済" : ORDER_STATUS_LABELS[o.status]}</Badge>
                <Badge tone="neutral" size="xs">
                  {ORDER_SOURCE_LABELS[o.source]}
                </Badge>
                <span className="text-[11px] text-subtle">注文番号 {o.id.slice(-8).toUpperCase()}</span>
              </div>
              <p className="mt-1 truncate text-sm font-black text-fg">{o.itemName}</p>
              <p className="text-[11px] text-subtle">
                {formatDateTime(o.createdAt)} 申込
                {o.shippedAt && ` ・ ${formatDateTime(o.shippedAt)} ${o.itemType === "digital" ? "発行" : "発送"}`}
              </p>
            </div>
            {o.pointsSpent > 0 && (
              <span className="tabular shrink-0 text-sm font-black text-point">-{formatNumber(o.pointsSpent)}pt</span>
            )}
          </div>
          <div className="mt-3 space-y-2 border-t border-line pt-3 text-xs">
            {o.address && (
              <p className="flex gap-1.5 text-muted">
                <Icon name="mapPin" size={13} className="mt-px shrink-0" />
                <span>
                  {formatAddress(o.address)} {o.address.fullName} 様
                </span>
              </p>
            )}
            {o.trackingNumber && (
              <p className="flex items-center gap-1.5 text-fg">
                <Icon name="truck" size={13} className="text-muted" />
                追跡番号 <span className="font-mono font-bold">{o.trackingNumber}</span>
              </p>
            )}
            {o.digitalCode && (
              <div className="flex items-center gap-2">
                <span className="text-muted">ギフトコード</span>
                <code className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-ticket">{o.digitalCode}</code>
                <CopyButton text={o.digitalCode} />
              </div>
            )}
            {o.status === "pending" && <p className="text-muted">発送準備中です。発送までしばらくお待ちください。</p>}
            {o.status === "cancelled" && (
              <p className="text-muted">{o.source === "exchange" ? "この交換はキャンセルされ、ポイントは返還されました。" : "この発送依頼はキャンセルされました。"}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LedgerList({ entries }: { entries: LedgerEntry[] }) {
  const [currency, setCurrency] = useState<"all" | "ticket" | "point">("all");
  const filtered = currency === "all" ? entries : entries.filter((e) => e.currency === currency);
  const { pageItems, page, pageCount, setPage, total } = usePaged(filtered, 20);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["all", "ticket", "point"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCurrency(c)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold transition-colors",
              currency === c
                ? c === "ticket"
                  ? "border-ticket/50 bg-ticket/15 text-ticket"
                  : c === "point"
                    ? "border-point/50 bg-point/15 text-point"
                    : "border-transparent bg-surface-3 text-fg"
                : "border-line bg-surface text-muted hover:text-fg",
            )}
          >
            {c !== "all" && <Icon name={c === "ticket" ? "ticket" : "coin"} size={14} />}
            {c === "all" ? "すべて" : c === "ticket" ? "ガチャチケット" : "ポイント"}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon="history" title="履歴はまだありません" className="rounded-2xl border border-line bg-surface" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <ul className="divide-y divide-line">
            {pageItems.map((e) => {
              const ticket = e.currency === "ticket";
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", ticket ? "bg-ticket/12 text-ticket" : "bg-point/12 text-point")}>
                    <Icon name={ticket ? "ticket" : "coin"} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{e.description}</p>
                    <p className="text-[11px] text-subtle">
                      {formatDateTime(e.createdAt)} ・ {LEDGER_REASON_LABELS[e.reason]}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("tabular text-sm font-black", e.amount >= 0 ? (ticket ? "text-ticket" : "text-point") : "text-fg/70")}>
                      {e.amount > 0 ? "+" : "-"}
                      {formatNumber(Math.abs(e.amount))}
                      <span className="ml-0.5 text-[10px]">{ticket ? "枚" : "pt"}</span>
                    </p>
                    <p className="tabular text-[10px] text-subtle">
                      残高 {formatNumber(e.balanceAfter)}
                      {ticket ? "枚" : "pt"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line px-4 py-3">
            <Pagination page={page} pageCount={pageCount} onChange={setPage} total={total} />
          </div>
        </div>
      )}
    </div>
  );
}

export function DrawHistory({ draws }: { draws: DrawRecord[] }) {
  if (draws.length === 0) {
    return <EmptyState icon="capsule" title="ガチャ履歴はまだありません" description="ガチャを引くと、結果がここに保存されます。" className="rounded-2xl border border-line bg-surface" />;
  }
  return (
    <ul className="space-y-3">
      {draws.map((d) => {
        const best = d.results.reduce((top, r) => (r.rankOrder < top.rankOrder ? r : top), d.results[0]);
        const counts = new Map<string, { name: string; color: string; order: number; n: number }>();
        for (const r of d.results) {
          const c = counts.get(r.rankId) ?? { name: r.rankName, color: r.rankColor, order: r.rankOrder, n: 0 };
          c.n += 1;
          counts.set(r.rankId, c);
        }
        return (
          <li key={d.id}>
            <details className="group rounded-2xl border border-line bg-surface">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2">
                  <PrizeImage src={best?.prizeImageUrl} alt="" className="size-9" iconSize={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-fg">
                    {d.gachaTitle} <span className="font-bold text-muted">× {d.count}回</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {[...counts.values()]
                      .sort((a, b) => a.order - b.order)
                      .map((c) => (
                        <RankBadge key={c.name} name={`${c.name}×${c.n}`} color={c.color} size="xs" />
                      ))}
                    {d.lastOne && (
                      <Badge tone="gold" icon="crown" size="xs">
                        ラストワン賞
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-xs font-bold text-fg/80">-{formatNumber(d.ticketsSpent)}枚</p>
                  {d.pointsGained > 0 && <p className="tabular text-xs font-black text-point">+{formatNumber(d.pointsGained)}pt</p>}
                  <p className="text-[10px] text-subtle">{formatDateTime(d.createdAt)}</p>
                </div>
                <Icon name="chevronDown" size={16} className="shrink-0 text-subtle transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-line p-4">
                {d.lastOne && (
                  <p className="mb-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-bold text-accent">
                    <Icon name="crown" size={13} filled className="mr-1 inline" />
                    ラストワン賞「{d.lastOne.name}」を獲得しました
                  </p>
                )}
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {d.results.map((r) => (
                    <li key={r.index} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2" style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${r.rankColor} 35%, transparent)` }}>
                      <PrizeImage src={r.prizeImageUrl} alt="" className="size-8 shrink-0" iconSize={14} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black" style={{ color: r.rankColor }}>
                          {r.rankName}
                        </p>
                        <p className="truncate text-[11px] text-fg">{r.prizeName}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-subtle">
                  No.{formatNumber(d.results[0]?.slotNumber ?? 0)}〜{formatNumber(d.results[d.results.length - 1]?.slotNumber ?? 0)}口目 ・ サーバー抽選処理 {d.serverMs}ms
                </p>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
