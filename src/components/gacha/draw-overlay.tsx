"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DrawResponse } from "@/lib/api-types";
import type { DrawResultItem } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getPortalRoot, useIsClient } from "@/components/ui/use-is-client";
import { CapsuleIntro, INTRO_MS } from "./capsule-intro";
import { readSkipConfirm, readSoundPref, writeSkipConfirm, writeSoundPref } from "./client-utils";
import type { DrawOption } from "./draw-options";
import { LastOneBanner, ResultsBody, revealDurationMs } from "./draw-results";
import { builtinStyleForOrder, EffectPlayer, preloadEffect } from "./effect-player";
import { LastOneScreen } from "./lastone-screen";
import type { GachaDetailDto, RankDto } from "./types";
import styles from "./draw-overlay.module.css";

export interface DrawSession {
  key: number;
  count: number;
  status: "pending" | "done" | "error";
  response: DrawResponse | null;
  error: string | null;
}

type Phase = "intro" | "effect" | "results" | "lastoneEffect" | "lastone";
type View = Phase | "pending" | "error";

/** The rank whose effect plays at the climax: the best rank won. */
function bestResult(results: DrawResultItem[]): DrawResultItem | null {
  return results.reduce<DrawResultItem | null>((best, r) => (!best || r.rankOrder < best.rankOrder ? r : best), null);
}

function rankForResult(ranks: RankDto[], item: DrawResultItem): RankDto {
  const known = ranks.find((r) => r.id === item.rankId);
  if (known) return known;
  return {
    id: item.rankId,
    name: item.rankName,
    subtitle: "",
    color: item.rankColor,
    order: item.rankOrder,
    logoUrl: null,
    effect: { type: "builtin", url: null, builtinStyle: builtinStyleForOrder(item.rankOrder) },
    isLastOne: false,
  };
}

const FALLBACK_LAST_RANK: RankDto = {
  id: "_last",
  name: "ラストワン賞",
  subtitle: "LAST ONE",
  color: "#FFB800",
  order: 0,
  logoUrl: null,
  effect: { type: "builtin", url: null, builtinStyle: "lastone" },
  isLastOne: true,
};

// ---------------------------------------------------------------------------
// Shell: portal, scroll lock, sound preference
// ---------------------------------------------------------------------------

export function DrawOverlay(props: {
  session: DrawSession;
  gacha: GachaDetailDto;
  /** Options for 「もう一度引く」 (same count, or all remaining slots). */
  againOptions: DrawOption[];
  onDrawAgain: (count: number) => void;
  onClose: () => void;
}) {
  const isClient = useIsClient();
  const [sound, setSound] = useState(readSoundPref);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      focused?.focus?.();
    };
  }, []);

  const toggleSound = () => {
    setSound((on) => {
      writeSoundPref(!on);
      return !on;
    });
  };

  if (!isClient) return null;
  return createPortal(
    <div
      ref={dialogRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`${props.gacha.title} 抽選`}
      tabIndex={-1}
    >
      <div className={styles.backdrop} aria-hidden="true" />
      <DrawSequence key={props.session.key} {...props} sound={sound} onToggleSound={toggleSound} />
    </div>,
    getPortalRoot(),
  );
}

// ---------------------------------------------------------------------------
// Sequence: pending → intro → effect → results → (last one effect → last one screen)
// ---------------------------------------------------------------------------

function DrawSequence({
  session,
  gacha,
  againOptions,
  onDrawAgain,
  onClose,
  sound,
  onToggleSound,
}: {
  session: DrawSession;
  gacha: GachaDetailDto;
  againOptions: DrawOption[];
  onDrawAgain: (count: number) => void;
  onClose: () => void;
  sound: boolean;
  onToggleSound: () => void;
}) {
  const response = session.response;
  const draw = response?.draw ?? null;
  const [phase, setPhase] = useState<Phase>("intro");
  const [skipped, setSkipped] = useState(false);
  const [lastOneSeen, setLastOneSeen] = useState(false);
  const [resultsSeen, setResultsSeen] = useState(false);
  const [revealDone, setRevealDone] = useState(false);

  const hasLastOne = !!draw?.lastOne;
  const best = useMemo(() => (draw ? bestResult(draw.results) : null), [draw]);
  const climax = useMemo(() => (best ? rankForResult(gacha.ranks, best) : null), [gacha.ranks, best]);
  const lastRank = gacha.lastOneRank ?? FALLBACK_LAST_RANK;

  let view: View;
  if (session.status === "error") view = "error";
  else if (!draw) view = "pending";
  else if (skipped && (phase === "intro" || phase === "effect")) view = hasLastOne && !lastOneSeen ? "lastone" : "results";
  else view = phase;

  const instant = skipped || resultsSeen || revealDone;
  const skippable = view === "pending" || view === "intro" || view === "effect" || view === "lastoneEffect";

  // Warm up the effect files while the capsule opens.
  useEffect(() => {
    if (!draw || !climax) return;
    preloadEffect(climax.effect, climax.logoUrl);
    if (draw.lastOne) preloadEffect(lastRank.effect, lastRank.logoUrl);
  }, [draw, climax, lastRank]);

  // Capsule → effect.
  useEffect(() => {
    if (!draw || skipped || phase !== "intro") return;
    const t = window.setTimeout(() => setPhase("effect"), INTRO_MS);
    return () => window.clearTimeout(t);
  }, [draw, skipped, phase]);

  // The result reveal animation finished.
  useEffect(() => {
    if (view !== "results" || instant || !draw) return;
    const t = window.setTimeout(() => setRevealDone(true), revealDurationMs(draw.count));
    return () => window.clearTimeout(t);
  }, [view, instant, draw]);

  // Results → ラストワン賞 (once).
  useEffect(() => {
    if (view !== "results" || !hasLastOne || lastOneSeen || resultsSeen || !draw) return;
    const wait = (instant ? 0 : revealDurationMs(draw.count)) + 1600;
    const t = window.setTimeout(() => {
      setResultsSeen(true);
      setPhase("lastoneEffect");
    }, wait);
    return () => window.clearTimeout(t);
  }, [view, hasLastOne, lastOneSeen, resultsSeen, instant, draw]);

  const skip = () => {
    if (view === "lastoneEffect") setPhase("lastone");
    else if (view === "results") setRevealDone(true);
    else setSkipped(true);
  };

  const goLastOne = () => {
    setResultsSeen(true);
    setPhase(lastOneSeen ? "lastone" : "lastoneEffect");
  };

  const showResults = () => {
    setLastOneSeen(true);
    setPhase("results");
  };

  // Keyboard: Esc = skip while an effect plays, close otherwise.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (skippable) skip();
    else if (view !== "pending") onClose();
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const soundButton = (
    <button
      type="button"
      onClick={onToggleSound}
      className="grid size-10 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
      aria-label={sound ? "サウンドをオフにする" : "サウンドをオンにする"}
      aria-pressed={sound}
      title={sound ? "サウンド: オン" : "サウンド: オフ"}
    >
      <Icon name={sound ? "volume" : "volumeOff"} size={18} />
    </button>
  );

  // ------------------------------------------------------------------ error
  if (view === "error") {
    return (
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-[#ff5470]/15 text-[#ff5470]">
          <Icon name="signal" size={30} />
        </span>
        <h2 className="mt-5 text-xl font-black text-white">通信エラーが発生しました</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/70">
          {session.error ?? "通信エラーが発生しました。"}
          <br />
          結果はマイページの「ガチャ履歴」で確認できます。
        </p>
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/45">
          同じリクエストIDで再送しているため、チケットが二重に消費されることはありません。
        </p>
        <div className="mt-7 flex w-full max-w-xs flex-col gap-2.5">
          <ButtonLink href="/mypage?tab=draws" variant="primary" size="lg" leftIcon="history" fullWidth>
            ガチャ履歴を見る
          </ButtonLink>
          <Button variant="secondary" size="lg" onClick={onClose} fullWidth>
            閉じる
          </Button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------- intro / effect
  if (view === "pending" || view === "intro" || view === "effect" || view === "lastoneEffect") {
    const effectRank = view === "lastoneEffect" ? lastRank : climax;
    return (
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          {(view === "pending" || view === "intro") && (
            <div className="absolute inset-0 flex">
              <CapsuleIntro
                revealed={view === "intro"}
                color={best?.rankColor ?? "#8f88c7"}
                rainbow={!!best && best.rankOrder <= 1}
                crown={hasLastOne}
                count={session.count}
                sound={sound}
              />
            </div>
          )}
          {(view === "effect" || view === "lastoneEffect") && effectRank && (
            <EffectPlayer
              key={view}
              effect={effectRank.effect}
              rankName={effectRank.name}
              rankColor={effectRank.color}
              logoUrl={effectRank.logoUrl}
              sound={sound}
              className="absolute inset-0"
              onEnd={() => setPhase((p) => (p === "effect" ? "results" : p === "lastoneEffect" ? "lastone" : p))}
            />
          )}
        </div>
        {/* top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
          <div className="pointer-events-auto">{soundButton}</div>
          <p className="truncate rounded-full bg-black/35 px-3 py-1 text-[11px] font-bold text-white/70 backdrop-blur">
            {view === "lastoneEffect" ? "LAST ONE" : `${gacha.title} ／ ${session.count}回`}
          </p>
          <button
            type="button"
            onClick={skip}
            className="pointer-events-auto inline-flex h-10 items-center gap-1.5 rounded-full bg-white/15 pl-4 pr-3 text-sm font-black text-white ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            スキップ
            <Icon name="skip" size={16} filled />
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------- last one
  if (view === "lastone" && draw) {
    return (
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <LastOneScreen
          draw={draw}
          gacha={gacha}
          sound={sound}
          celebrate={skipped && !resultsSeen}
          onShowResults={showResults}
          onClose={onClose}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
          <div className="pointer-events-auto">{soundButton}</div>
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto grid size-10 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur hover:bg-white/20 hover:text-white"
            aria-label="閉じる"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- results
  if (!draw || !response) return null;
  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#07051a]/85 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-[#ff3e8a] to-[#ff8a3d] text-white shadow-lg shadow-[#ff3e8a]/30">
            <Icon name="sparkles" size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.3em] text-white/45">RESULT</p>
            <h2 className="truncate font-display text-lg leading-tight text-white">
              抽選結果<span className="ml-2 text-sm text-white/60">{formatNumber(draw.count)}回</span>
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!instant && (
            <button
              type="button"
              onClick={skip}
              className="inline-flex h-10 items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-bold text-white/85 hover:bg-white/20"
            >
              すべて表示
              <Icon name="skip" size={13} filled />
            </button>
          )}
          {soundButton}
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
            aria-label="閉じる"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {response.replayed && (
          <p className="mx-auto mt-3 flex max-w-5xl items-start gap-2 px-4 text-xs leading-relaxed text-[#8fe3ff] sm:px-6">
            <Icon name="shieldCheck" size={15} className="mt-px shrink-0" />
            通信の再送を検知したため、すでに確定している抽選結果を表示しています（チケットの二重消費はありません）。
          </p>
        )}
        {hasLastOne && draw.lastOne && <LastOneBanner name={draw.lastOne.name} onClick={goLastOne} />}
        <ResultsBody draw={draw} gacha={gacha} instant={instant} sound={sound} />
      </div>

      <ResultsFooter count={draw.count} options={againOptions} onDrawAgain={onDrawAgain} onClose={onClose} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer: 「もう一度引く」 / 「閉じる」 (with an inline confirmation for multi-draws)
// ---------------------------------------------------------------------------

function ResultsFooter({
  count,
  options,
  onDrawAgain,
  onClose,
}: {
  count: number;
  options: DrawOption[];
  onDrawAgain: (count: number) => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState<DrawOption | null>(null);
  const [dontAsk, setDontAsk] = useState(false);

  const same = options.find((o) => o.kind === "count" && o.count === count) ?? options.find((o) => o.count === count);
  const all = options.find((o) => o.kind === "all");
  const primary = same && !same.disabled ? same : all && !all.disabled ? all : (same ?? null);

  const start = (option: DrawOption) => {
    if (option.count > 1 && !readSkipConfirm()) {
      setConfirming(option);
      return;
    }
    onDrawAgain(option.count);
  };

  return (
    <footer className="border-t border-white/10 bg-[#07051a]/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6">
      <div className="mx-auto max-w-5xl">
        {confirming ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/85">
              <p className="font-bold">
                ガチャチケット<span className="tabular mx-1 text-[#35d0ff]">{formatNumber(confirming.cost)}枚</span>を使って
                {confirming.kind === "all" ? confirming.label : `もう一度${confirming.count}回引きますか？`}
              </p>
              <label className="mt-1.5 inline-flex cursor-pointer items-center gap-2 text-xs text-white/60">
                <input type="checkbox" className="size-4 accent-[#ff3e8a]" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} />
                次回から確認しない
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setConfirming(null)} className="flex-1 sm:flex-none">
                やめる
              </Button>
              <Button
                variant={confirming.kind === "all" ? "gold" : "primary"}
                className="flex-[2] sm:flex-none"
                onClick={() => {
                  if (dontAsk) writeSkipConfirm(true);
                  onDrawAgain(confirming.count);
                }}
              >
                {confirming.count}回引く
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" size="lg" onClick={onClose} className="shrink-0 px-5">
              閉じる
            </Button>
            {primary && (
              <div className="min-w-0 flex-1">
                <Button
                  variant={primary.highlight ? "gold" : "primary"}
                  size="lg"
                  fullWidth
                  leftIcon="refresh"
                  disabled={primary.disabled}
                  onClick={() => start(primary)}
                >
                  {primary.disabled
                    ? primary.reason === "unavailable"
                      ? "完売・販売終了"
                      : `もう一度引く（${primary.reasonLabel}）`
                    : primary.kind === "all"
                      ? primary.label
                      : `もう一度${primary.count}回引く`}
                  {!primary.disabled && <span className="tabular ml-1 text-xs font-bold opacity-85">{formatNumber(primary.cost)}枚</span>}
                </Button>
              </div>
            )}
          </div>
        )}
        {!confirming && primary?.reason === "tickets" && (
          <p className="mt-2 text-center text-xs text-white/55">
            チケットが足りません。
            <Link href="/earn" className="font-bold text-[#35d0ff] underline-offset-2 hover:underline">
              動画視聴や案件でチケットを貯める
            </Link>
          </p>
        )}
      </div>
    </footer>
  );
}
