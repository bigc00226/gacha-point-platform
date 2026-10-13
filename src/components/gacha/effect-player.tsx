"use client";

import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import type { AnimationItem } from "lottie-web";
import type { BuiltinEffectStyle, RankEffect } from "@/lib/types";
import { cn } from "@/lib/format";
import { lighten, ParticleField, prefersReducedMotion } from "./particles";
import { sfxCharge, sfxFanfare, sfxImpact, sfxSparkle } from "./sfx";
import styles from "./effect-player.module.css";

/**
 * Plays a rank's win effect inside its parent (fills it; renders its own dark stage,
 * so it also works inside the light admin theme):
 *  - effect.type "video": <video playsInline autoPlay> — tries with sound, falls back to muted
 *  - effect.type "lottie": Lottie JSON via lottie-web (dynamically imported)
 *  - effect.type "builtin": canvas + CSS effect chosen by effect.builtinStyle
 * Any load error falls back to the builtin style. The rank logo (or the rank name)
 * slams in at the climax. Calls onEnd() once when the effect completes.
 * A skip control is rendered by the caller.
 */
export interface EffectPlayerProps {
  effect: RankEffect;
  rankName: string;
  rankColor: string;
  logoUrl: string | null;
  /** Called once when the effect completes (or immediately if it cannot play). */
  onEnd: () => void;
  /** Autoplay with sound when allowed (default true); falls back to muted. */
  sound?: boolean;
  className?: string;
}

interface FxConfig {
  duration: number;
  burst: number;
  palette: string[];
  bg: [string, string];
  rays: "rainbow" | "solid" | "soft" | "none";
  rings: number;
  shake: "hard" | "medium" | "light" | "none";
  flash: "white" | "soft" | "gold" | "rainbow";
  streaks: number;
  confetti: number;
  rain: number;
  sparkles: number;
  shards: number;
  coins: number;
  embers: number;
  dust: boolean;
  spotlights: boolean;
  intensity: number;
  fanfare: "grand" | "bright" | "soft";
}

const RAINBOW = ["#ff4d6d", "#ffd43b", "#3ddc97", "#35d0ff", "#b05cff", "#ffffff", "#ff8a3d"];

/** Built-in effects, most dramatic first. Durations ~2.2–4.0 s. */
const FX: Record<BuiltinEffectStyle, FxConfig> = {
  rainbow: {
    duration: 3700, burst: 900, palette: RAINBOW, bg: ["#35105c", "#0e0524"], rays: "rainbow", rings: 3,
    shake: "hard", flash: "rainbow", streaks: 70, confetti: 240, rain: 70, sparkles: 70, shards: 80, coins: 0,
    embers: 0, dust: false, spotlights: false, intensity: 1, fanfare: "grand",
  },
  gold: {
    duration: 3400, burst: 800, palette: ["#fff6c2", "#ffd23f", "#ffb800", "#ffe58a", "#ffffff"], bg: ["#3d2600", "#0d0802"],
    rays: "solid", rings: 2, shake: "medium", flash: "gold", streaks: 55, confetti: 170, rain: 40, sparkles: 55,
    shards: 50, coins: 34, embers: 0, dust: true, spotlights: false, intensity: 0.85, fanfare: "grand",
  },
  red: {
    duration: 3200, burst: 750, palette: ["#ff4d6d", "#ff8fa3", "#ffd1dc", "#ffffff", "#ff3e8a"], bg: ["#46081b", "#0e0206"],
    rays: "solid", rings: 2, shake: "medium", flash: "white", streaks: 48, confetti: 150, rain: 26, sparkles: 48,
    shards: 40, coins: 0, embers: 46, dust: false, spotlights: false, intensity: 0.75, fanfare: "bright",
  },
  purple: {
    duration: 2900, burst: 650, palette: ["#b05cff", "#d7a8ff", "#ffffff", "#7b5cff", "#f0ddff"], bg: ["#260a45", "#08030f"],
    rays: "soft", rings: 2, shake: "light", flash: "soft", streaks: 36, confetti: 80, rain: 0, sparkles: 52,
    shards: 26, coins: 0, embers: 0, dust: true, spotlights: false, intensity: 0.6, fanfare: "bright",
  },
  blue: {
    duration: 2600, burst: 560, palette: ["#3da5ff", "#9fd3ff", "#ffffff", "#35d0ff"], bg: ["#082447", "#02070f"],
    rays: "soft", rings: 1, shake: "none", flash: "soft", streaks: 26, confetti: 36, rain: 0, sparkles: 40,
    shards: 14, coins: 0, embers: 0, dust: false, spotlights: false, intensity: 0.45, fanfare: "soft",
  },
  basic: {
    duration: 2200, burst: 460, palette: ["#f1f4fb", "#c7cede", "#ffffff"], bg: ["#20232f", "#07080c"],
    rays: "none", rings: 1, shake: "none", flash: "soft", streaks: 16, confetti: 0, rain: 0, sparkles: 26,
    shards: 0, coins: 0, embers: 0, dust: false, spotlights: false, intensity: 0.3, fanfare: "soft",
  },
  lastone: {
    duration: 4000, burst: 1250, palette: ["#ffd23f", "#fff1a8", "#ffb800", "#ffffff", "#ffe58a"], bg: ["#2a1d00", "#000000"],
    rays: "solid", rings: 3, shake: "hard", flash: "gold", streaks: 64, confetti: 200, rain: 46, sparkles: 70,
    shards: 64, coins: 40, embers: 0, dust: true, spotlights: true, intensity: 1, fanfare: "grand",
  },
};

/** Builtin style for a rank order when nothing else is known (1 = 特賞 ...). */
export function builtinStyleForOrder(order: number): BuiltinEffectStyle {
  if (order <= 0) return "lastone";
  if (order === 1) return "rainbow";
  if (order === 2) return "red";
  if (order === 3) return "purple";
  if (order === 4) return "blue";
  return "basic";
}

// ---------------------------------------------------------------------------
// Preloading (the draw overlay calls this as soon as the result is known)
// ---------------------------------------------------------------------------

const lottieCache = new Map<string, Promise<unknown>>();

function loadLottieJson(url: string): Promise<unknown> {
  let promise = lottieCache.get(url);
  if (!promise) {
    promise = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<unknown>;
    });
    promise.catch(() => lottieCache.delete(url));
    lottieCache.set(url, promise);
  }
  return promise;
}

/** Warm up the effect file and the rank logo (fire-and-forget, never throws). */
export function preloadEffect(effect: RankEffect | null | undefined, logoUrl?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (logoUrl) {
      const img = new Image();
      img.decoding = "async";
      img.src = logoUrl;
    }
    if (!effect?.url) return;
    if (effect.type === "lottie") {
      void import("lottie-web").catch(() => {});
      void loadLottieJson(effect.url).catch(() => {});
    } else if (effect.type === "video") {
      void fetch(effect.url).catch(() => {});
    }
  } catch {
    // best effort
  }
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

export function EffectPlayer({ effect, rankName, rankColor, logoUrl, onEnd, sound = true, className }: EffectPlayerProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const mediaUrl = effect.type !== "builtin" && effect.url && effect.url !== failedUrl ? effect.url : null;
  const fallbackStyle: BuiltinEffectStyle = FX[effect.builtinStyle] ? effect.builtinStyle : "basic";
  const color = /^#[0-9a-f]{6}$/i.test(rankColor) ? rankColor : "#ffd43b";

  return (
    <div
      className={cn(styles.stage, className)}
      style={{ "--fx": color } as CSSProperties}
      role="img"
      aria-label={`${rankName}の当選演出`}
    >
      {mediaUrl && effect.type === "video" ? (
        <VideoEffect
          key={mediaUrl}
          url={mediaUrl}
          rankName={rankName}
          logoUrl={logoUrl}
          sound={sound}
          onDone={onEnd}
          onFail={() => setFailedUrl(mediaUrl)}
        />
      ) : mediaUrl && effect.type === "lottie" ? (
        <LottieEffect
          key={mediaUrl}
          url={mediaUrl}
          rankName={rankName}
          logoUrl={logoUrl}
          onDone={onEnd}
          onFail={() => setFailedUrl(mediaUrl)}
        />
      ) : (
        <BuiltinEffect
          key={fallbackStyle}
          style={fallbackStyle}
          color={color}
          rankName={rankName}
          logoUrl={logoUrl}
          sound={sound}
          onDone={onEnd}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rank logo (image with a gloss sweep, or the rank name in display type)
// ---------------------------------------------------------------------------

function textUnits(text: string): number {
  let units = 0;
  for (const ch of text) units += /[\x20-\x7e]/.test(ch) ? 0.62 : 1;
  return Math.max(units, 1.6);
}

const cssUrl = (url: string) => `url("${url.replace(/["\\\n\r]/g, "")}")`;

function RankLogo({ rankName, logoUrl, immediate = false }: { rankName: string; logoUrl: string | null; immediate?: boolean }) {
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = !!logoUrl && broken !== logoUrl;
  const units = textUnits(rankName);
  return (
    <div className={cn(styles.logoWrap, immediate && styles.logoWrapNow)}>
      <div className={styles.logoInner}>
        {showImage ? (
          <>
            <img src={logoUrl} alt={rankName} className={styles.logoImg} draggable={false} onError={() => setBroken(logoUrl)} />
            <span className={styles.logoShine} style={{ "--logo": cssUrl(logoUrl) } as CSSProperties} aria-hidden="true" />
          </>
        ) : (
          <span className={styles.logoText} style={{ fontSize: `min(${Math.floor(84 / units)}cqw, 30cqh)` }}>
            {rankName}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Builtin (canvas particles + layered CSS light)
// ---------------------------------------------------------------------------

function BuiltinEffect({
  style,
  color,
  rankName,
  logoUrl,
  sound,
  onDone,
}: {
  style: BuiltinEffectStyle;
  color: string;
  rankName: string;
  logoUrl: string | null;
  sound: boolean;
  onDone: () => void;
}) {
  const cfg = FX[style];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const done = useEffectEvent(() => onDone());
  const soundOn = useEffectEvent(() => sound);

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduced = prefersReducedMotion();
    let field: ParticleField | null = null;
    try {
      if (canvas) field = new ParticleField(canvas, { maxParticles: 1100 });
    } catch {
      field = null;
    }
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const palette = [...cfg.palette, color, lighten(color, 0.45)];
    const lights = [color, lighten(color, 0.5), "#ffffff"];
    const center = { x: 0.5, y: 0.46 };

    if (field) {
      field.density = reduced ? 0.35 : field.size.width < 480 ? 0.75 : 1;
      field.start();
      // Charge-up: light rushing into the center.
      field.converge({ count: cfg.streaks, colors: lights, ...center, duration: cfg.burst });
      if (cfg.spotlights) {
        field.emit({ kind: "dust", rate: 26, count: 0, colors: ["#ffd23f", "#fff1a8"], x: 0.5, y: 0, spreadX: 0.5, speed: [10, 50], angle: 90, cone: 40, life: [2.4, 4], duration: cfg.duration });
      }
    }
    if (soundOn()) sfxCharge(cfg.burst, cfg.intensity);

    at(cfg.burst, () => {
      if (soundOn()) {
        sfxImpact(cfg.intensity);
        sfxFanfare(cfg.fanfare, 0.14);
        sfxSparkle(Math.round(4 + cfg.intensity * 6), 0.5);
      }
      if (!field) return;
      if (cfg.shards) field.spawn({ kind: "shard", count: cfg.shards, colors: lights, ...center, speed: [900, 1900], life: [0.35, 0.7], size: [1.5, 4] });
      if (cfg.confetti) field.spawn({ kind: "confetti", count: cfg.confetti, colors: palette, ...center, speed: [380, 1150], life: [2.2, 3.4], size: [4, 8.5] });
      if (cfg.sparkles) field.spawn({ kind: "sparkle", count: cfg.sparkles, colors: palette, ...center, spreadX: 0.04, spreadY: 0.04, speed: [80, 520], life: [0.7, 1.6] });
      if (cfg.coins) field.spawn({ kind: "coin", count: cfg.coins, colors: ["#ffd23f"], ...center, speed: [420, 980], angle: -90, cone: 150, life: [1.6, 2.6] });
      // Afterglow: twinkles around the logo, confetti rain, embers, dust.
      field.emit({ kind: "sparkle", rate: 10 + cfg.sparkles * 0.35, count: 0, colors: palette, ...center, spreadX: 0.42, spreadY: 0.3, speed: [0, 30], life: [0.6, 1.3], duration: cfg.duration });
      if (cfg.rain) field.emit({ kind: "confetti", rate: cfg.rain, count: 0, colors: palette, x: 0.5, y: -0.04, spreadX: 0.55, speed: [40, 160], angle: 90, cone: 50, life: [3, 4.5], gravity: 120, duration: cfg.duration, delay: 250 });
      if (cfg.embers) field.emit({ kind: "ember", rate: cfg.embers, count: 0, colors: [color, "#ffb3c1", "#ffffff"], x: 0.5, y: 1.02, spreadX: 0.5, speed: [60, 190], angle: -90, cone: 30, life: [1.6, 2.8], duration: cfg.duration });
      if (cfg.dust) field.emit({ kind: "dust", rate: 30, count: 0, colors: [color, "#ffffff"], ...center, spreadX: 0.5, spreadY: 0.4, speed: [5, 40], life: [1.4, 2.6], duration: cfg.duration });
    });

    at(cfg.duration, () => done());

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      field?.destroy();
    };
  }, [cfg, color]);

  const shakeClass =
    cfg.shake === "hard" ? styles.shakeHard : cfg.shake === "medium" ? styles.shakeMedium : cfg.shake === "light" ? styles.shakeLight : undefined;

  return (
    <div
      className={styles.scene}
      style={{ "--burst": `${cfg.burst}ms`, "--bg1": cfg.bg[0], "--bg2": cfg.bg[1] } as CSSProperties}
    >
      <div className={cn(styles.shaker, shakeClass)}>
        <div className={styles.bgPulse} />
        {cfg.spotlights && (
          <>
            <div className={styles.floorGlow} />
            <div className={cn(styles.spot, styles.spotL)} />
            <div className={cn(styles.spot, styles.spotR)} />
          </>
        )}
        {cfg.rays !== "none" && (
          <>
            <div className={cn(styles.rays, cfg.rays === "rainbow" && styles.raysRainbow, cfg.rays === "soft" && styles.raysSoft)} />
            {cfg.rays !== "soft" && <div className={styles.rays2} />}
          </>
        )}
        <div className={cn(styles.orb, cfg.rays === "rainbow" && styles.orbRainbow)} />
        <div className={styles.orbCore} />
        {Array.from({ length: cfg.rings }, (_, i) => (
          <div key={i} className={styles.ring} style={{ "--ring-delay": `${i * 140}ms` } as CSSProperties} />
        ))}
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <RankLogo rankName={rankName} logoUrl={logoUrl} />
      </div>
      <div className={cn(styles.flash, cfg.flash === "soft" && styles.flashSoft, cfg.flash === "gold" && styles.flashGold)} />
      {cfg.flash === "rainbow" && <div className={styles.flashRainbow} />}
      <div className={styles.vignette} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Video (MP4 / WebM)
// ---------------------------------------------------------------------------

/** The rank logo appears at this point of the media timeline. */
const LOGO_AT = 0.55;
const HOLD_AFTER_MS = 900;
const STALL_TIMEOUT_MS = 6000;

function VideoEffect({
  url,
  rankName,
  logoUrl,
  sound,
  onDone,
  onFail,
}: {
  url: string;
  rankName: string;
  logoUrl: string | null;
  sound: boolean;
  onDone: () => void;
  onFail: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const holdRef = useRef<number | null>(null);
  const [started, setStarted] = useState(false);
  const [logo, setLogo] = useState(false);
  const fail = useEffectEvent(() => onFail());
  const wantSound = useEffectEvent(() => sound);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const stall = window.setTimeout(() => {
      if (!cancelled && video.currentTime === 0) fail();
    }, STALL_TIMEOUT_MS);
    video.muted = !wantSound();
    video
      .play()
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError") {
          // Autoplay with sound was blocked: play muted instead.
          video.muted = true;
          return video.play();
        }
        if (name === "AbortError") return undefined;
        throw err;
      })
      .catch(() => {
        if (!cancelled) fail();
      });
    return () => {
      cancelled = true;
      window.clearTimeout(stall);
      if (holdRef.current !== null) window.clearTimeout(holdRef.current);
      video.pause();
    };
  }, [url]);

  // Live mute toggle from the caller.
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.muted === sound) video.muted = !sound;
  }, [sound]);

  return (
    <>
      <video
        ref={videoRef}
        src={url}
        className={styles.media}
        playsInline
        autoPlay
        preload="auto"
        onPlaying={() => setStarted(true)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (!logo && v.duration > 0 && v.currentTime / v.duration >= LOGO_AT) setLogo(true);
        }}
        onEnded={() => {
          if (holdRef.current !== null) return;
          const hold = logo ? HOLD_AFTER_MS : HOLD_AFTER_MS + 700;
          setLogo(true);
          holdRef.current = window.setTimeout(onDone, hold);
        }}
        onError={onFail}
      />
      {!started && <div className={styles.loading} aria-hidden="true" />}
      {logo && (
        <>
          <div className={styles.mediaLogoFlash} />
          <RankLogo rankName={rankName} logoUrl={logoUrl} immediate />
        </>
      )}
      <div className={styles.vignette} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Lottie (JSON via lottie-web)
// ---------------------------------------------------------------------------

function LottieEffect({
  url,
  rankName,
  logoUrl,
  onDone,
  onFail,
}: {
  url: string;
  rankName: string;
  logoUrl: string | null;
  onDone: () => void;
  onFail: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [logo, setLogo] = useState(false);
  const done = useEffectEvent(() => onDone());
  const fail = useEffectEvent(() => onFail());

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let cancelled = false;
    let anim: AnimationItem | null = null;
    let logoShown = false;
    let hold: number | null = null;
    const stall = window.setTimeout(() => {
      if (!cancelled && !anim) fail();
    }, STALL_TIMEOUT_MS);
    const revealLogo = () => {
      if (logoShown) return;
      logoShown = true;
      setLogo(true);
    };

    Promise.all([import("lottie-web"), loadLottieJson(url)])
      .then(([mod, data]) => {
        if (cancelled) return;
        if (!data || typeof data !== "object" || !("layers" in data)) throw new Error("not a Lottie file");
        const current = mod.default.loadAnimation({
          container: box,
          renderer: "svg",
          loop: false,
          autoplay: true,
          // lottie-web mutates the data: give it a private copy (the JSON is cached for replays).
          animationData: structuredClone(data),
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        });
        anim = current;
        current.addEventListener("DOMLoaded", () => setReady(true));
        current.addEventListener("enterFrame", () => {
          if (current.totalFrames > 0 && current.currentFrame / current.totalFrames >= LOGO_AT) revealLogo();
        });
        current.addEventListener("complete", () => {
          if (hold !== null) return;
          const extra = logoShown ? HOLD_AFTER_MS : HOLD_AFTER_MS + 700;
          revealLogo();
          hold = window.setTimeout(() => done(), extra);
        });
        current.addEventListener("data_failed", () => fail());
      })
      .catch(() => {
        if (!cancelled) fail();
      });

    return () => {
      cancelled = true;
      window.clearTimeout(stall);
      if (hold !== null) window.clearTimeout(hold);
      anim?.destroy();
    };
  }, [url]);

  return (
    <>
      <div className={styles.mediaGlow} />
      <div ref={boxRef} className={styles.lottieBox} />
      {!ready && <div className={styles.loading} aria-hidden="true" />}
      {logo && (
        <>
          <div className={styles.mediaLogoFlash} />
          <RankLogo rankName={rankName} logoUrl={logoUrl} immediate />
        </>
      )}
      <div className={styles.vignette} />
    </>
  );
}
