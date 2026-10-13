"use client";

import { useEffect, useRef, useState } from "react";

/**
 * COIN CATCH — the sample mini game embedded via iframe (/embed/coin-catch).
 * 30 seconds: move the basket (drag / mouse / ← →), catch coins, avoid bombs.
 * When a round ends the score is posted to the parent window:
 *   window.parent.postMessage({ type: "poigacha:score", score }, origin)
 */

type Phase = "ready" | "playing" | "over";

interface Item {
  x: number;
  y: number;
  vy: number;
  r: number;
  kind: "coin" | "big" | "bomb";
  spin: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}
interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

const ROUND_MS = 30_000;
const BEST_KEY = "poigacha:coin-catch:best";

function readBest(): number {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

interface Engine {
  start: () => void;
  setTarget: (x: number) => void;
  destroy: () => void;
}

/** Plain (non-React) game loop: keeps per-frame state out of React renders. */
function createCoinCatch(canvas: HTMLCanvasElement, wrap: HTMLElement, onEnd: (score: number) => void): Engine {
  const g = {
    w: 360,
    h: 480,
    dpr: 1,
    basketX: 180,
    targetX: 180,
    keys: { left: false, right: false },
    items: [] as Item[],
    particles: [] as Particle[],
    texts: [] as FloatText[],
    score: 0,
    combo: 0,
    startedAt: 0,
    lastSpawn: 0,
    lastFrame: 0,
    shake: 0,
    running: false,
    raf: 0,
  };

  function resize() {
    const rect = wrap.getBoundingClientRect();
    g.w = Math.max(240, rect.width);
    g.h = Math.max(240, rect.height);
    g.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(g.w * g.dpr);
    canvas.height = Math.round(g.h * g.dpr);
    canvas.style.width = `${g.w}px`;
    canvas.style.height = `${g.h}px`;
    g.basketX = Math.min(Math.max(g.basketX, 40), g.w - 40);
    g.targetX = g.basketX;
  }

  function draw(now: number) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = g;
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1b1450");
    bg.addColorStop(1, "#0a0820");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97.3) % w;
      const sy = (i * 53.7 + now * 0.004 * ((i % 3) + 1)) % h;
      ctx.globalAlpha = 0.25 + ((i * 13) % 10) / 20;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    for (const it of g.items) {
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.kind === "bomb") {
        ctx.fillStyle = "#1f1f2e";
        ctx.beginPath();
        ctx.arc(0, 0, it.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ff5470";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffb020";
        ctx.beginPath();
        ctx.arc(it.r * 0.5, -it.r * 0.9, 3 + Math.sin(now / 60) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff5470";
        ctx.font = `900 ${it.r}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✕", 0, 1);
      } else {
        const sx = Math.abs(Math.cos(it.spin));
        ctx.scale(Math.max(0.25, sx), 1);
        const grad = ctx.createRadialGradient(-it.r * 0.3, -it.r * 0.3, 1, 0, 0, it.r);
        grad.addColorStop(0, it.kind === "big" ? "#fff6c9" : "#ffe58a");
        grad.addColorStop(1, it.kind === "big" ? "#f0960e" : "#e8a317");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, it.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(120,60,0,0.6)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "rgba(120,60,0,0.85)";
        ctx.font = `900 ${Math.round(it.r * 0.8)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("pt", 0, 1);
      }
      ctx.restore();
    }

    const bw = Math.min(110, w * 0.26);
    const by = h - 54;
    const bx = g.basketX;
    const basket = ctx.createLinearGradient(0, by, 0, by + 36);
    basket.addColorStop(0, "#ff3e8a");
    basket.addColorStop(1, "#ff8a3d");
    ctx.fillStyle = basket;
    ctx.beginPath();
    ctx.moveTo(bx - bw / 2, by);
    ctx.lineTo(bx + bw / 2, by);
    ctx.lineTo(bx + bw / 2 - 12, by + 36);
    ctx.lineTo(bx - bw / 2 + 12, by + 36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(bx - bw / 2, by, bw, 5);

    for (const p of g.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;
    for (const t of g.texts) {
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.fillStyle = t.color;
      ctx.font = "900 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (g.running) {
      const left = Math.max(0, ROUND_MS - (now - g.startedAt));
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, w, 44);
      ctx.fillStyle = "#ffd23f";
      ctx.font = "900 20px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`SCORE ${g.score}`, 14, 22);
      ctx.textAlign = "right";
      ctx.fillStyle = left < 5000 ? "#ff5470" : "#ffffff";
      ctx.fillText(`${Math.ceil(left / 1000)}s`, w - 14, 22);
      ctx.fillStyle = "#35d0ff";
      ctx.fillRect(0, 42, (left / ROUND_MS) * w, 3);
      if (g.combo >= 3) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ff8a3d";
        ctx.font = "900 14px sans-serif";
        ctx.fillText(`${g.combo} COMBO!`, w / 2, 22);
      }
    }
  }

  function tick(now: number) {
    if (!g.running) return;
    const dt = Math.min(50, now - (g.lastFrame || now));
    g.lastFrame = now;
    const elapsed = now - g.startedAt;
    if (elapsed >= ROUND_MS) {
      g.running = false;
      draw(now);
      onEnd(g.score);
      return;
    }

    const speed = 0.7 * dt;
    if (g.keys.left) g.targetX -= speed;
    if (g.keys.right) g.targetX += speed;
    g.targetX = Math.min(Math.max(g.targetX, 40), g.w - 40);
    g.basketX += (g.targetX - g.basketX) * Math.min(1, dt / 60);

    const progress = elapsed / ROUND_MS;
    const interval = 620 - progress * 360;
    if (now - g.lastSpawn > interval) {
      g.lastSpawn = now;
      const roll = Math.random();
      const kind: Item["kind"] = roll < 0.12 + progress * 0.12 ? "bomb" : roll > 0.9 ? "big" : "coin";
      const r = kind === "big" ? 20 : 15;
      g.items.push({ x: r + Math.random() * (g.w - r * 2), y: -r, vy: 0.12 + progress * 0.16 + Math.random() * 0.08, r, kind, spin: Math.random() * 6 });
    }

    const bw = Math.min(110, g.w * 0.26);
    const by = g.h - 54;
    g.items = g.items.filter((it) => {
      it.y += it.vy * dt;
      it.spin += dt * 0.01;
      const caught = it.y + it.r >= by && it.y - it.r <= by + 20 && Math.abs(it.x - g.basketX) <= bw / 2 + it.r * 0.4;
      if (caught) {
        if (it.kind === "bomb") {
          g.score = Math.max(0, g.score - 30);
          g.combo = 0;
          g.shake = 12;
          g.texts.push({ x: it.x, y: by - 10, text: "-30", life: 1, color: "#ff5470" });
          for (let i = 0; i < 18; i++) g.particles.push({ x: it.x, y: by, vx: (Math.random() - 0.5) * 0.5, vy: -Math.random() * 0.5, life: 1, color: "#ff5470" });
        } else {
          g.combo += 1;
          const value = (it.kind === "big" ? 50 : 10) * (g.combo >= 5 ? 2 : 1);
          g.score += value;
          g.texts.push({ x: it.x, y: by - 10, text: `+${value}`, life: 1, color: it.kind === "big" ? "#ffd23f" : "#ffffff" });
          for (let i = 0; i < 10; i++) g.particles.push({ x: it.x, y: by, vx: (Math.random() - 0.5) * 0.4, vy: -Math.random() * 0.45, life: 1, color: "#ffd23f" });
        }
        return false;
      }
      if (it.y - it.r > g.h) {
        if (it.kind !== "bomb") g.combo = 0;
        return false;
      }
      return true;
    });
    for (const p of g.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.0012 * dt;
      p.life -= dt / 700;
    }
    g.particles = g.particles.filter((p) => p.life > 0);
    for (const t of g.texts) {
      t.y -= dt * 0.05;
      t.life -= dt / 900;
    }
    g.texts = g.texts.filter((t) => t.life > 0);
    g.shake = Math.max(0, g.shake - dt * 0.05);

    draw(now);
    g.raf = requestAnimationFrame(tick);
  }

  const onResize = () => {
    resize();
    draw(performance.now());
  };
  const onKey = (e: KeyboardEvent, down: boolean) => {
    if (e.key === "ArrowLeft" || e.key === "a") g.keys.left = down;
    if (e.key === "ArrowRight" || e.key === "d") g.keys.right = down;
  };
  const onDown = (e: KeyboardEvent) => onKey(e, true);
  const onUp = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  resize();
  // Start centered whatever the embed width is.
  g.basketX = g.targetX = g.w / 2;
  draw(performance.now());

  return {
    start() {
      cancelAnimationFrame(g.raf);
      g.items = [];
      g.particles = [];
      g.texts = [];
      g.score = 0;
      g.combo = 0;
      g.shake = 0;
      g.startedAt = performance.now();
      g.lastSpawn = 0;
      g.lastFrame = 0;
      g.running = true;
      g.raf = requestAnimationFrame(tick);
    },
    setTarget(x: number) {
      g.targetX = x;
    },
    destroy() {
      g.running = false;
      cancelAnimationFrame(g.raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    },
  };
}

export function CoinCatchGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [result, setResult] = useState<{ score: number; best: number; isBest: boolean } | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;
    const engine = createCoinCatch(canvasRef.current, wrapRef.current, (score) => {
      const best = readBest();
      const isBest = score > best;
      if (isBest) {
        try {
          window.localStorage.setItem(BEST_KEY, String(score));
        } catch {
          // ignore
        }
      }
      setResult({ score, best: Math.max(best, score), isBest });
      setPhase("over");
      try {
        window.parent?.postMessage({ type: "poigacha:score", score }, window.location.origin);
      } catch {
        // not embedded
      }
    });
    engineRef.current = engine;
    return () => engine.destroy();
  }, []);

  function start() {
    setResult(null);
    setPhase("playing");
    engineRef.current?.start();
  }

  function onPointer(e: React.PointerEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    engineRef.current?.setTarget(e.clientX - rect.left);
  }

  return (
    <div ref={wrapRef} className="relative h-dvh w-full touch-none select-none overflow-hidden bg-[#0a0820]" onPointerMove={onPointer} onPointerDown={onPointer}>
      <canvas ref={canvasRef} className="block" />
      {phase !== "playing" && (
        <div className="absolute inset-0 grid place-items-center bg-black/45 p-6 text-center">
          <div className="max-w-xs">
            <p className="font-display text-4xl tracking-wider text-[#ffd23f] drop-shadow-[0_4px_0_rgba(0,0,0,0.4)]">COIN CATCH</p>
            {phase === "over" && result ? (
              <>
                <p className="mt-4 text-sm font-bold text-white/80">スコア</p>
                <p className="font-display text-5xl text-white">{result.score}</p>
                <p className="mt-1 text-xs font-bold text-white/70">{result.isBest ? "🎉 ベストスコア更新！" : `ベスト ${result.best}`}</p>
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                30秒間でコインをたくさんキャッチ！
                <br />
                爆弾はマイナス30点。5連続でスコア2倍！
                <br />
                <span className="text-xs text-white/60">ドラッグ / マウス / ← → キーで操作</span>
              </p>
            )}
            <button
              type="button"
              onClick={start}
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-linear-to-r from-[#ff3e8a] to-[#ff8a3d] px-8 text-base font-black text-white shadow-lg shadow-[#ff3e8a]/40 transition active:scale-95"
            >
              {phase === "over" ? "もう一度あそぶ" : "スタート"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
