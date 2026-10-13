"use client";

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import type { DrawRecord } from "@/lib/types";
import { PRIZE_TYPE_LABELS } from "@/lib/constants";
import { cn, formatNumber } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Amount } from "@/components/ui/currency";
import { Icon } from "@/components/ui/icon";
import { ParticleField, prefersReducedMotion } from "./particles";
import { PrizeImage } from "./prize-image";
import { sfxFanfare, sfxSparkle } from "./sfx";
import type { GachaDetailDto } from "./types";
import styles from "./draw-overlay.module.css";

const GOLD = ["#ffd23f", "#fff1a8", "#ffb800", "#ffffff", "#ffe58a"];

/** Endless gold particles behind the last-one screen. */
function GoldParticles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let field: ParticleField;
    try {
      field = new ParticleField(canvas, { maxParticles: 600 });
    } catch {
      return;
    }
    field.density = prefersReducedMotion() ? 0.3 : field.size.width < 480 ? 0.7 : 1;
    field.start();
    field.spawn({ kind: "confetti", count: 160, colors: GOLD, x: 0.5, y: 0.3, speed: [350, 1000], life: [2.2, 3.4] });
    field.spawn({ kind: "coin", count: 26, colors: GOLD, x: 0.5, y: 0.3, speed: [400, 900], angle: -90, cone: 140, life: [1.6, 2.4] });
    field.emit({ kind: "dust", rate: 22, count: 0, colors: GOLD, x: 0.5, y: -0.02, spreadX: 0.55, speed: [12, 50], angle: 90, cone: 30, life: [4, 7], duration: Infinity });
    field.emit({ kind: "sparkle", rate: 9, count: 0, colors: GOLD, x: 0.5, y: 0.4, spreadX: 0.48, spreadY: 0.38, speed: [0, 20], life: [0.8, 1.6], duration: Infinity });
    field.emit({ kind: "confetti", rate: 10, count: 0, colors: GOLD, x: 0.5, y: -0.04, spreadX: 0.55, speed: [30, 110], angle: 90, cone: 40, life: [4, 6], gravity: 90, duration: Infinity, delay: 600 });
    return () => field.destroy();
  }, []);
  return <canvas ref={ref} className={styles.loCanvas} aria-hidden="true" />;
}

export function LastOneScreen({
  draw,
  gacha,
  sound,
  celebrate,
  onShowResults,
  onClose,
}: {
  draw: DrawRecord;
  gacha: GachaDetailDto;
  sound: boolean;
  /** Play the fanfare (when the last-one effect was skipped). */
  celebrate: boolean;
  onShowResults: () => void;
  onClose: () => void;
}) {
  const lastOne = draw.lastOne!;
  const rank = gacha.lastOneRank;
  const [logoBroken, setLogoBroken] = useState(false);
  const logo = rank?.logoUrl && !logoBroken ? rank.logoUrl : null;
  const lastSlot = draw.results[draw.results.length - 1]?.slotNumber ?? gacha.totalSlots;
  const soundOn = useEffectEvent(() => sound);

  useEffect(() => {
    if (!soundOn()) return;
    if (celebrate) sfxFanfare("grand", 0.05);
    sfxSparkle(8, 0.3);
  }, [celebrate]);

  const title = "ラストワン賞 獲得！";

  return (
    <div className={styles.loStage}>
      <div className={styles.loRays} aria-hidden="true" />
      <GoldParticles />
      <div className="absolute inset-0 z-10 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-14 text-center sm:pt-16">
          <div className={cn(styles.loLogo, "flex h-24 w-full items-center justify-center sm:h-28")}>
            {logo ? (
              <img src={logo} alt={rank?.name ?? "ラストワン賞"} className="h-full w-auto max-w-[88%] object-contain" onError={() => setLogoBroken(true)} />
            ) : (
              <span className="font-display text-3xl tracking-[0.2em] text-[#ffd23f]">LAST ONE</span>
            )}
          </div>

          <h2 className={cn(styles.loTitle, "mt-3 text-[2.15rem] sm:text-5xl")}>
            <span className={styles.loTitleShine} data-text={title}>
              {title}
            </span>
          </h2>
          <p className={cn(styles.fadeUp, "mt-2 text-sm font-bold text-[#ffe9a8]/85")} style={{ "--delay": "0.55s" } as CSSProperties}>
            おめでとうございます！最後の1口を引き当てました
          </p>

          <div className={cn(styles.loPrize, "mt-7 size-52 sm:size-60")}>
            <div className={styles.loPrizeHalo} />
            <div className={styles.loPrizeRingDashed} />
            <div
              className={cn(styles.loPrizeRing, "grid place-items-center")}
              style={{ background: "radial-gradient(closest-side, rgba(60,40,0,0.85), rgba(20,12,0,0.95))" }}
            >
              <PrizeImage src={lastOne.imageUrl} alt={lastOne.name} className={cn(styles.loPrizeImg, "size-[78%]")} iconSize={64} loading="eager" />
            </div>
          </div>

          <p className="mt-7 text-[11px] font-bold tracking-[0.35em] text-[#ffd23f]">LAST ONE PRIZE</p>
          <h3 className="mt-1 text-2xl font-black leading-tight text-white sm:text-3xl">{lastOne.name}</h3>
          <div className="mt-2.5 flex items-center justify-center gap-2">
            <span className="rounded-full bg-[#ffd23f]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#ffd23f] ring-1 ring-[#ffd23f]/40 ring-inset">
              {PRIZE_TYPE_LABELS[lastOne.type]}
            </span>
            {lastOne.type === "point" && <Amount kind="point" value={lastOne.pointValue} signed size="sm" />}
          </div>
          {lastOne.description && <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/60">{lastOne.description}</p>}

          <div className={cn(styles.loCard, "mt-6 w-full rounded-2xl p-4 text-left")} style={{ "--delay": "0.9s" } as CSSProperties}>
            <p className="flex items-start gap-2 text-sm leading-relaxed text-white/90">
              <Icon name="crown" size={18} filled className="mt-0.5 shrink-0 text-[#ffd23f]" />
              <span>
                <span className="font-bold">{gacha.title}</span>の最後の1口（No.{formatNumber(lastSlot)}口目）を引き当て、総口数
                {formatNumber(gacha.totalSlots)}口が完売しました。
              </span>
            </p>
            <div className="mt-3 border-t border-[#ffd23f]/20 pt-3 text-sm leading-relaxed text-white/80">
              {lastOne.type === "physical" && (
                <p className="flex items-start gap-2">
                  <Icon name="truck" size={18} className="mt-0.5 shrink-0 text-[#ffd23f]" />
                  <span>マイページの「獲得景品」からお届け先を入力して、発送をご依頼ください。</span>
                </p>
              )}
              {lastOne.type === "digital" && (
                <p className="flex items-start gap-2">
                  <Icon name="gift" size={18} className="mt-0.5 shrink-0 text-[#ffd23f]" />
                  <span>ギフトコードはマイページの「獲得景品」でいつでも確認できます。</span>
                </p>
              )}
              {lastOne.type === "point" && (
                <p className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Icon name="checkCircle" size={18} className="shrink-0 text-[#2fd38a]" />
                    ポイント残高に付与しました
                  </span>
                  <Amount kind="point" value={lastOne.pointValue} signed size="lg" />
                </p>
              )}
            </div>
          </div>

          <div className={cn(styles.fadeUp, "mt-6 flex w-full flex-col gap-2.5")} style={{ "--delay": "1.1s" } as CSSProperties}>
            {lastOne.type === "physical" && (
              <ButtonLink href="/mypage?tab=prizes" variant="gold" size="xl" fullWidth leftIcon="truck">
                マイページで発送手続きへ
              </ButtonLink>
            )}
            {lastOne.type === "digital" && (
              <ButtonLink href="/mypage?tab=prizes" variant="gold" size="xl" fullWidth leftIcon="gift">
                獲得景品を確認する
              </ButtonLink>
            )}
            <Button variant={lastOne.type === "point" ? "gold" : "outline"} size="lg" fullWidth leftIcon="list" onClick={onShowResults} className={lastOne.type === "point" ? undefined : "border-[#ffd23f]/40 text-[#ffe9a8] hover:bg-[#ffd23f]/10"}>
              抽選結果を見る（{draw.results.length}件）
            </Button>
            <button type="button" onClick={onClose} className="mx-auto mt-1 h-10 px-4 text-sm font-bold text-white/55 transition-colors hover:text-white">
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
