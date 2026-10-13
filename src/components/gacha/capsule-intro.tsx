"use client";

import { useEffect, useEffectEvent, type CSSProperties } from "react";
import { cn } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { lighten } from "./particles";
import { sfxPop, sfxRattle } from "./sfx";
import styles from "./draw-overlay.module.css";

/** Duration of the capsule sequence after the result is known (shake → open). */
export const INTRO_MS = 1050;

/**
 * Capsule shaking while the request is in flight ("pending"), then — once the
 * result is known — it lights up in the color of the best rank (a hint!),
 * shakes harder and bursts open.
 */
export function CapsuleIntro({
  revealed,
  color,
  rainbow,
  crown,
  count,
  sound,
}: {
  /** The draw result has arrived. */
  revealed: boolean;
  /** Color of the best rank won (used once revealed). */
  color: string;
  /** 特賞-class: animated rainbow capsule. */
  rainbow: boolean;
  /** The draw took the last slot (ラストワン賞): a crown pops above the capsule. */
  crown: boolean;
  count: number;
  sound: boolean;
}) {
  const soundOn = useEffectEvent(() => sound);

  useEffect(() => {
    const timers: number[] = [];
    if (!revealed) {
      const id = window.setInterval(() => {
        if (soundOn()) sfxRattle();
      }, 300);
      return () => window.clearInterval(id);
    }
    for (let t = 0; t < 560; t += 110) timers.push(window.setTimeout(() => soundOn() && sfxRattle(), t));
    timers.push(window.setTimeout(() => soundOn() && sfxPop(), 620));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [revealed]);

  const cap = revealed ? color : "#8f88c7";
  const vars = {
    "--cap": cap,
    "--cap-light": lighten(cap, 0.55),
    "--cap-dark": `color-mix(in srgb, ${cap} 70%, #000)`,
  } as CSSProperties;

  return (
    <div className={cn(styles.introStage, revealed && styles.revealed)} style={vars}>
      <div className={styles.introRays} aria-hidden="true" />
      <div className={styles.capsuleArea}>
        <div className={styles.aura} aria-hidden="true" />
        <div className={styles.capsule} aria-hidden="true">
          {revealed && crown && (
            <span className={styles.crown}>
              <Icon name="crown" size={44} filled />
            </span>
          )}
          <div className={cn(styles.half, styles.bottom)} />
          <div className={cn(styles.half, styles.top)}>
            <div className={cn(styles.topColor, rainbow && styles.topRainbow)} />
            <div className={styles.topShine} />
            <div className={styles.topEdge} />
          </div>
          <div className={styles.band}>
            <div className={styles.knob} />
          </div>
          <div className={styles.openBurst} />
        </div>
        <div className={styles.floor} aria-hidden="true" />
        <p className={styles.introLabel} role="status">
          {count > 1 ? `${count}連 ` : ""}抽選中<span className={styles.dots} />
        </p>
      </div>
    </div>
  );
}
