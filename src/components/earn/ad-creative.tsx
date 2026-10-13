"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/format";
import styles from "./earn.module.css";

interface Creative {
  brand: string;
  icon: string;
  background: string;
  particles: "gems" | "embers" | "bokeh";
  lines: [string, string, string];
  cta: string;
  tagline: string;
  accent: string;
}

/** Fictional advertisers for the mock rewarded ad (rotated per ad session). */
const CREATIVES: Creative[] = [
  {
    brand: "ジュエルパズル・クエスト",
    icon: "/demo/offer/puzzle.svg",
    background: "radial-gradient(120% 75% at 50% 0%, #8a6bff 0%, #4325c4 42%, #150a4d 100%)",
    particles: "gems",
    lines: ["宝石をそろえて\n爽快連鎖！", "いま始めると\n★5キャラ確定", "今すぐ無料で\nプレイしよう"],
    cta: "無料インストール",
    tagline: "★4.7｜100万ダウンロード突破",
    accent: "#ffd23f",
  },
  {
    brand: "ドラゴンソウル RPG",
    icon: "/demo/offer/rpg.svg",
    background: "radial-gradient(120% 75% at 50% 0%, #e2541b 0%, #8f1d1d 45%, #1d0909 100%)",
    particles: "embers",
    lines: ["美麗グラフィックの\n本格ファンタジーRPG", "事前登録\n100万人突破！", "さあ、\n竜の世界へ"],
    cta: "今すぐダウンロード",
    tagline: "★4.6｜新作RPG",
    accent: "#ffb547",
  },
  {
    brand: "シネマストリーム",
    icon: "/demo/offer/vod.svg",
    background: "radial-gradient(120% 75% at 50% 0%, #1fb6ff 0%, #1d3fa6 48%, #070d2b 100%)",
    particles: "bokeh",
    lines: ["映画・ドラマ・アニメが\n見放題", "はじめての方は\n31日間無料", "いつでも\n解約OK"],
    cta: "無料で試してみる",
    tagline: "見放題作品 30万本以上",
    accent: "#7ee0ff",
  },
];

const GEM_COLORS = ["#ff4d6d", "#35d0ff", "#ffd23f", "#2fd38a", "#b05cff", "#ff8a3d"];

/** Stable creative for a session id (no randomness during render). */
export function creativeIndexFor(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0;
  return hash % CREATIVES.length;
}

function Particles({ kind }: { kind: Creative["particles"] }) {
  if (kind === "gems") {
    return (
      <>
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            className={styles.gem}
            style={
              {
                left: `${(i * 37 + 5) % 96}%`,
                "--gem-size": `${18 + ((i * 7) % 18)}px`,
                "--gem-color": GEM_COLORS[i % GEM_COLORS.length],
                "--gem-duration": `${3.6 + ((i * 13) % 25) / 10}s`,
                "--gem-delay": `${-((i * 0.83) % 5)}s`,
              } as CSSProperties
            }
          />
        ))}
      </>
    );
  }
  if (kind === "embers") {
    return (
      <>
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className={styles.ember}
            style={
              {
                left: `${(i * 53 + 3) % 97}%`,
                "--ember-size": `${5 + (i % 5) * 2}px`,
                "--ember-duration": `${3 + ((i * 11) % 30) / 10}s`,
                "--ember-delay": `${-((i * 0.61) % 4)}s`,
                "--ember-drift": `${((i % 2 ? 1 : -1) * (10 + ((i * 17) % 40)))}px`,
              } as CSSProperties
            }
          />
        ))}
      </>
    );
  }
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={styles.ember}
          style={
            {
              left: `${(i * 41 + 6) % 94}%`,
              background: "radial-gradient(circle, rgba(126,224,255,0.55) 0%, rgba(126,224,255,0.12) 55%, transparent 70%)",
              "--ember-size": `${30 + (i % 4) * 16}px`,
              "--ember-duration": `${6 + ((i * 7) % 40) / 10}s`,
              "--ember-delay": `${-((i * 1.3) % 6)}s`,
              "--ember-drift": `${(i % 2 ? 1 : -1) * 20}px`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

/** One mock ad creative; `progress` (0–1) switches between its three scenes. */
export function AdCreative({ index, progress, className }: { index: number; progress: number; className?: string }) {
  const creative = CREATIVES[index % CREATIVES.length];
  const scene = Math.min(2, Math.floor(progress * 3));
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <div className={cn("absolute inset-0", styles.adBackdrop)} style={{ background: creative.background }} />
      <div className={cn("absolute inset-0", styles.adCanvas)}>
        <Particles kind={creative.particles} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/70 to-transparent" />
      <div className="relative flex h-full flex-col items-center justify-center px-6 pb-24 pt-20 text-center text-white">
        <img
          src={creative.icon}
          alt=""
          className={cn("size-24 rounded-[26px] shadow-2xl shadow-black/50 ring-2 ring-white/25 sm:size-28", styles.iconBounce)}
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
        <p className="mt-4 text-sm font-bold tracking-wide text-white/85">{creative.brand}</p>
        <p
          key={scene}
          className={cn("mt-3 whitespace-pre-line font-display text-[28px] leading-tight drop-shadow-[0_3px_0_rgba(0,0,0,0.35)] sm:text-[32px]", styles.headline)}
          style={{ color: scene === 1 ? creative.accent : undefined }}
        >
          {creative.lines[scene]}
        </p>
        <p className="mt-4 text-xs font-medium text-white/70">{creative.tagline}</p>
        {scene === 2 && (
          <span
            className={cn("mt-5 inline-flex h-11 items-center rounded-full px-6 text-sm font-black text-[#1a1033] shadow-lg", styles.ctaPulse)}
            style={{ background: creative.accent }}
          >
            {creative.cta}
          </span>
        )}
      </div>
    </div>
  );
}
