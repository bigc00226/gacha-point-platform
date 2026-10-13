"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState, type CSSProperties } from "react";
import type { DrawRecord, DrawResultItem } from "@/lib/types";
import { PRIZE_TYPE_LABELS } from "@/lib/constants";
import { cn, formatMs, formatNumber } from "@/lib/format";
import { Amount } from "@/components/ui/currency";
import { Icon } from "@/components/ui/icon";
import { PrizeImage } from "./prize-image";
import { sfxFlip } from "./sfx";
import type { GachaDetailDto, RankDto } from "./types";
import styles from "./draw-overlay.module.css";

/** Results up to this count use the flip-card grid; above it the compact bulk view. */
export const FLIP_GRID_MAX = 20;
const FLIP_STAGGER_MS = 115;

/** Time until the result reveal animation has finished (used to chain the last-one screen). */
export function revealDurationMs(count: number): number {
  if (count === 1) return 900;
  if (count <= FLIP_GRID_MAX) return 450 + count * FLIP_STAGGER_MS + 600;
  return 900;
}

function rankOf(ranks: RankDto[], item: Pick<DrawResultItem, "rankId">): RankDto | undefined {
  return ranks.find((r) => r.id === item.rankId);
}

function shortRank(name: string): string {
  return name.length > 4 ? name.slice(0, 4) : name;
}

const TYPE_ICON = { point: "coin", digital: "gift", physical: "package" } as const;

function TypeTag({ type, className }: { type: DrawResultItem["prizeType"]; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold",
        type === "point" ? "bg-[#ffc53d]/15 text-[#ffc53d]" : type === "digital" ? "bg-[#35d0ff]/15 text-[#35d0ff]" : "bg-[#ff8a3d]/15 text-[#ffb27a]",
        className,
      )}
    >
      <Icon name={TYPE_ICON[type]} size={11} strokeWidth={2.4} />
      {PRIZE_TYPE_LABELS[type]}
    </span>
  );
}

function RankChip({ name, color, size = "sm" }: { name: string; color: string; size?: "xs" | "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md font-black tracking-wide",
        size === "xs" && "px-1.5 py-px text-[10px]",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
      )}
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 50%, transparent)`,
      }}
    >
      {name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Results body
// ---------------------------------------------------------------------------

export function ResultsBody({
  draw,
  gacha,
  instant,
  sound,
}: {
  draw: DrawRecord;
  gacha: GachaDetailDto;
  instant: boolean;
  sound: boolean;
}) {
  const results = draw.results;
  const nonPointCount = results.filter((r) => r.prizeType !== "point").length + (draw.lastOne && draw.lastOne.type !== "point" ? 1 : 0);
  const best = results.reduce<DrawResultItem | null>((b, r) => (!b || r.rankOrder < b.rankOrder ? r : b), null);
  const first = results[0]?.slotNumber ?? 0;
  const last = results[results.length - 1]?.slotNumber ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-6 pt-4 sm:px-6">
      {/* meta line */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-white/45">
        <span className="font-bold text-white/70">{gacha.title}</span>
        <span>
          No.{formatNumber(first)}
          {results.length > 1 && `〜${formatNumber(last)}`}口目
        </span>
        <span className="inline-flex items-center gap-1" title="サーバー側での抽選処理時間（1リクエスト）">
          <Icon name="zap" size={11} />
          抽選処理 {formatMs(draw.serverMs)}
        </span>
      </div>

      {results.length === 1 ? (
        <SingleResult item={results[0]} rank={rankOf(gacha.ranks, results[0])} instant={instant} />
      ) : (
        <>
          <SummaryBar draw={draw} best={best} nonPointCount={nonPointCount} />
          {results.length <= FLIP_GRID_MAX ? (
            <FlipGrid results={results} instant={instant} sound={sound} />
          ) : (
            <BulkResults results={results} gacha={gacha} />
          )}
        </>
      )}

      {results.length === 1 && (draw.pointsGained > 0 || nonPointCount > 0) && (
        <div className={cn("mx-auto mt-5 max-w-sm", !instant && styles.fadeUp)} style={{ "--delay": "500ms" } as CSSProperties}>
          <AwardNotes pointsGained={draw.pointsGained} nonPointCount={nonPointCount} />
        </div>
      )}
    </div>
  );
}

function AwardNotes({ pointsGained, nonPointCount }: { pointsGained: number; nonPointCount: number }) {
  return (
    <div className="space-y-2">
      {pointsGained > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#ffc53d]/25 bg-[#ffc53d]/8 px-4 py-2.5">
          <span className="text-xs font-bold text-white/70">ポイント残高に付与しました</span>
          <Amount kind="point" value={pointsGained} signed size="md" />
        </div>
      )}
      {nonPointCount > 0 && (
        <Link
          href="/mypage?tab=prizes"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[#35d0ff]/25 bg-[#35d0ff]/8 px-4 py-2.5 text-xs font-bold text-[#8fe3ff] transition-colors hover:bg-[#35d0ff]/14"
        >
          <span className="inline-flex items-center gap-1.5">
            <Icon name="archive" size={15} />
            獲得景品BOXに{nonPointCount}件追加しました
          </span>
          <Icon name="chevronRight" size={16} />
        </Link>
      )}
    </div>
  );
}

function SummaryBar({ draw, best, nonPointCount }: { draw: DrawRecord; best: DrawResultItem | null; nonPointCount: number }) {
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-3">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <span className="text-xs font-bold text-white/60">最高ランク</span>
        {best ? <RankChip name={best.rankName} color={best.rankColor} size="md" /> : <span>—</span>}
      </div>
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#ffc53d]/25 bg-[#ffc53d]/8 px-4 py-3">
        <span className="text-xs font-bold text-white/60">獲得ポイント</span>
        <Amount kind="point" value={draw.pointsGained} signed={draw.pointsGained > 0} size="lg" />
      </div>
      {nonPointCount > 0 ? (
        <Link
          href="/mypage?tab=prizes"
          className="flex items-center justify-between gap-2 rounded-2xl border border-[#35d0ff]/25 bg-[#35d0ff]/8 px-4 py-3 transition-colors hover:bg-[#35d0ff]/14"
        >
          <span className="text-xs font-bold text-white/60">景品BOXに追加</span>
          <span className="inline-flex items-center gap-1 text-lg font-black text-[#8fe3ff]">
            {nonPointCount}
            <span className="text-xs font-bold">件</span>
            <Icon name="chevronRight" size={16} />
          </span>
        </Link>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <span className="text-xs font-bold text-white/60">使用チケット</span>
          <Amount kind="ticket" value={draw.ticketsSpent} size="lg" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single
// ---------------------------------------------------------------------------

function SingleResult({ item, rank, instant }: { item: DrawResultItem; rank: RankDto | undefined; instant: boolean }) {
  const [logoBroken, setLogoBroken] = useState(false);
  const logo = rank?.logoUrl && !logoBroken ? rank.logoUrl : null;
  const top = item.rankOrder <= 2;
  return (
    <div className="relative mx-auto w-full max-w-sm" style={{ "--rank": item.rankColor } as CSSProperties}>
      <div className={styles.singleRays} aria-hidden="true" />
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.75rem] border p-5 text-center shadow-2xl",
          !instant && styles.singlePop,
          top && styles.glowCard,
        )}
        style={{
          borderColor: `color-mix(in srgb, ${item.rankColor} 55%, transparent)`,
          background: `radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, ${item.rankColor} 30%, transparent), transparent 70%), linear-gradient(180deg, #1a1540, #0d0a24)`,
        }}
      >
        <div className="flex h-20 items-center justify-center">
          {logo ? (
            <img src={logo} alt={item.rankName} className="h-full w-auto max-w-[85%] object-contain drop-shadow-[0_0_14px_rgba(0,0,0,0.4)]" onError={() => setLogoBroken(true)} />
          ) : (
            <span className="font-display text-4xl" style={{ color: item.rankColor, textShadow: `0 0 18px ${item.rankColor}` }}>
              {item.rankName}
            </span>
          )}
        </div>
        <div
          className="relative mx-auto mt-3 grid aspect-square w-48 place-items-center rounded-full sm:w-52"
          style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${item.rankColor} 38%, transparent), transparent 80%)` }}
        >
          <PrizeImage src={item.prizeImageUrl} alt={item.prizeName} className="size-40 animate-float sm:size-44" iconSize={56} loading="eager" />
        </div>
        <p className="mt-3 text-[11px] font-bold tracking-[0.25em] text-white/45">GET!</p>
        <h3 className="mt-1 text-2xl font-black leading-tight text-white">{item.prizeName}</h3>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <TypeTag type={item.prizeType} />
          {item.prizeType === "point" && <Amount kind="point" value={item.pointValue} signed size="sm" />}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-white/55">
          {item.prizeType === "point"
            ? "ポイントは交換所で景品と交換できます。"
            : item.prizeType === "digital"
              ? "ギフトコードはマイページの「獲得景品」で確認できます。"
              : "マイページの「獲得景品」から発送をご依頼ください。"}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2–20 draws: flip cards revealed one by one
// ---------------------------------------------------------------------------

function FlipGrid({ results, instant, sound }: { results: DrawResultItem[]; instant: boolean; sound: boolean }) {
  const soundOn = useEffectEvent(() => sound);

  useEffect(() => {
    if (instant) return;
    const timers = results.map((r, i) =>
      window.setTimeout(() => {
        if (soundOn()) sfxFlip(r.rankOrder <= 2 ? 1.6 : r.rankOrder <= 3 ? 1.3 : 1);
      }, 280 + i * FLIP_STAGGER_MS),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [instant, results]);

  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5">
      {results.map((r, i) => (
        <li key={r.index} className={styles.cardFlip} style={{ "--delay": `${i * FLIP_STAGGER_MS}ms`, "--rank": r.rankColor } as CSSProperties}>
          <div className={cn(styles.cardInner, !instant && styles.cardInnerAnimated)}>
            <ResultCard item={r} />
            {!instant && (
              <div className={styles.cardBack} aria-hidden="true">
                <Icon name="capsule" size={30} className="text-white/80" />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResultCard({ item }: { item: DrawResultItem }) {
  const top = item.rankOrder <= 2;
  return (
    <div
      className={cn(styles.cardFace, "flex flex-col rounded-2xl border p-2 sm:p-2.5", top && styles.glowCard)}
      style={{
        borderColor: `color-mix(in srgb, ${item.rankColor} ${top ? 70 : 32}%, transparent)`,
        background: `linear-gradient(180deg, color-mix(in srgb, ${item.rankColor} ${top ? 26 : 14}%, #151036), #110d2c 70%)`,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <RankChip name={item.rankName} color={item.rankColor} size="xs" />
        <span className="tabular text-[9px] font-bold text-white/35">#{item.index}</span>
      </div>
      <div
        className="mt-1.5 grid aspect-square place-items-center rounded-xl"
        style={{ background: `radial-gradient(closest-side, color-mix(in srgb, ${item.rankColor} 30%, transparent), transparent)` }}
      >
        <PrizeImage src={item.prizeImageUrl} alt={item.prizeName} className="size-[78%]" iconSize={26} loading="eager" />
      </div>
      <p className="mt-1.5 line-clamp-2 min-h-[2.4em] text-center text-[11px] font-bold leading-tight text-white sm:text-xs">
        {item.prizeName}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 21–100 draws: per-rank summary, highlights and a compact grid
// ---------------------------------------------------------------------------

type SortKey = "order" | "rank";

function BulkResults({ results, gacha }: { results: DrawResultItem[]; gacha: GachaDetailDto }) {
  const [sort, setSort] = useState<SortKey>("order");

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of results) map.set(r.rankId, (map.get(r.rankId) ?? 0) + 1);
    return map;
  }, [results]);

  const rankRows = useMemo(() => {
    const rows = gacha.prizeGroups.map((g) => ({ id: g.rank.id, name: g.rank.name, color: g.rank.color, order: g.rank.order }));
    // Ranks that appear in the results but not in the current lineup (edited after the draw).
    for (const r of results) {
      if (!rows.some((row) => row.id === r.rankId)) rows.push({ id: r.rankId, name: r.rankName, color: r.rankColor, order: r.rankOrder });
    }
    return rows.sort((a, b) => a.order - b.order);
  }, [gacha.prizeGroups, results]);

  const highlights = useMemo(
    () => results.filter((r) => r.rankOrder <= 3).sort((a, b) => a.rankOrder - b.rankOrder || a.index - b.index).slice(0, 12),
    [results],
  );

  const sorted = useMemo(
    () => (sort === "order" ? results : [...results].sort((a, b) => a.rankOrder - b.rankOrder || a.index - b.index)),
    [results, sort],
  );

  return (
    <div className="space-y-5">
      {/* per-rank counts */}
      <div className="flex flex-wrap justify-center gap-2">
        {rankRows.map((row) => {
          const n = counts.get(row.id) ?? 0;
          return (
            <div
              key={row.id}
              className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", n === 0 && "opacity-45")}
              style={{
                borderColor: `color-mix(in srgb, ${row.color} 40%, transparent)`,
                background: `color-mix(in srgb, ${row.color} ${n > 0 ? 14 : 6}%, transparent)`,
              }}
            >
              <span className="text-sm font-black" style={{ color: row.color }}>
                {row.name}
              </span>
              <span className="tabular font-display text-lg leading-none text-white">×{n}</span>
            </div>
          );
        })}
      </div>

      {/* highlights */}
      {highlights.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-white/80">
            <Icon name="sparkles" size={15} className="text-[#ffd23f]" />
            注目の当選
          </h3>
          <ul className="no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 md:grid-cols-6">
            {highlights.map((r) => (
              <li key={r.index} className="w-28 shrink-0 snap-start sm:w-auto" style={{ "--rank": r.rankColor } as CSSProperties}>
                <ResultCard item={r} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* all results */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-white/80">
            すべての結果 <span className="tabular text-white/45">（{results.length}件）</span>
          </h3>
          <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-0.5" role="tablist" aria-label="並び順">
            {(
              [
                ["order", "引いた順"],
                ["rank", "ランク順"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={sort === key}
                onClick={() => setSort(key)}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-bold transition-colors",
                  sort === key ? "bg-white/15 text-white" : "text-white/50 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-10">
          {sorted.map((r) => (
            <li
              key={r.index}
              title={`#${r.index} ${r.rankName} ${r.prizeName}`}
              className="relative flex aspect-[4/5] flex-col items-center justify-between overflow-hidden rounded-lg border px-0.5 pb-1 pt-0.5"
              style={{
                borderColor: `color-mix(in srgb, ${r.rankColor} ${r.rankOrder <= 2 ? 80 : 30}%, transparent)`,
                background: `linear-gradient(180deg, color-mix(in srgb, ${r.rankColor} ${r.rankOrder <= 3 ? 24 : 10}%, #120e2e), #0e0b25)`,
                boxShadow: r.rankOrder <= 2 ? `0 0 12px color-mix(in srgb, ${r.rankColor} 55%, transparent)` : undefined,
              }}
            >
              <span className="tabular self-start pl-0.5 text-[8px] font-bold leading-none text-white/35">{r.index}</span>
              <PrizeImage src={r.prizeImageUrl} alt={r.prizeName} className="size-[62%]" iconSize={16} />
              <span className="max-w-full truncate px-0.5 text-[9px] font-black leading-none sm:text-[10px]" style={{ color: r.rankColor }}>
                {shortRank(r.rankName)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-center text-[11px] text-white/40">
          {sort === "order" ? "引いた順（No.の小さい順）" : "ランクの高い順"}に表示しています。各マスの詳細はマウスオーバー／長押しで確認できます。
        </p>
      </section>
    </div>
  );
}

/** Small "you also won the last one" banner shown on the results list. */
export function LastOneBanner({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto mb-1 mt-4 flex w-[calc(100%-2rem)] max-w-5xl items-center gap-3 rounded-2xl border border-[#ffd23f]/45 bg-linear-to-r from-[#3a2600] via-[#5a3c00] to-[#3a2600] px-4 py-3 text-left shadow-[0_0_30px_rgba(255,196,40,0.25)] transition hover:brightness-110 sm:w-[calc(100%-3rem)]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ffd23f]/20 text-[#ffd23f]">
        <Icon name="crown" size={22} filled />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold tracking-wider text-[#ffd23f]">LAST ONE</span>
        <span className="block truncate text-sm font-black text-white">ラストワン賞「{name}」も獲得しました！</span>
      </span>
      <Icon name="chevronRight" size={18} className="text-[#ffd23f]" />
    </button>
  );
}

