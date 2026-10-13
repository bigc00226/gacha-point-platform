/**
 * Tiny canvas particle engine for the draw effects (no dependencies).
 *
 * - confetti : paper rectangles that flip, tumble and fall with drag
 * - sparkle  : twinkling four-point stars (additive glow)
 * - streak   : light streaks rushing into the center (charge-up)
 * - shard    : fast light shards radiating from the center (burst)
 * - coin     : spinning gold coins
 * - dust     : glowing dust motes (slow fall / float)
 * - ember    : glowing embers that rise
 *
 * Glow sprites are pre-rendered once per color, so a few hundred particles stay
 * at 60fps on phones. Coordinates are CSS pixels; the canvas is DPR-aware.
 * Browser only — create it from an effect.
 */

export type ParticleKind = "confetti" | "sparkle" | "streak" | "shard" | "coin" | "dust" | "ember";

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  vr: number;
  flip: number;
  vflip: number;
  color: string;
  twinkle: number;
}

export interface SpawnOptions {
  kind: ParticleKind;
  count: number;
  colors: string[];
  /** Origin in relative coordinates (0..1). */
  x?: number;
  y?: number;
  /** Random spread of the origin in relative units. */
  spreadX?: number;
  spreadY?: number;
  /** Speed range in px/s. */
  speed?: [number, number];
  /** Direction in degrees (0 = right, 90 = down) and the cone width. */
  angle?: number;
  cone?: number;
  gravity?: number;
  drag?: number;
  size?: [number, number];
  life?: [number, number];
}

export interface EmitterOptions extends SpawnOptions {
  /** Particles per second. */
  rate: number;
  /** Emitter lifetime in ms (Infinity = until cleared). */
  duration: number;
  /** Delay before the emitter starts, ms. */
  delay?: number;
}

interface Emitter {
  opts: EmitterOptions;
  startAt: number;
  endAt: number;
  carry: number;
}

const TAU = Math.PI * 2;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const spriteCache = new Map<string, HTMLCanvasElement>();

function glowSprite(color: string): HTMLCanvasElement {
  const key = `glow:${color}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, color);
  grad.addColorStop(0.45, withAlpha(color, 0.35));
  grad.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  spriteCache.set(key, c);
  return c;
}

function starSprite(color: string): HTMLCanvasElement {
  const key = `star:${color}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const size = 96;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const m = size / 2;
  // soft halo
  const halo = g.createRadialGradient(m, m, 0, m, m, m * 0.55);
  halo.addColorStop(0, withAlpha(color, 0.75));
  halo.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);
  // four-point star
  g.fillStyle = "#ffffff";
  g.beginPath();
  const long = m * 0.95;
  const thin = m * 0.09;
  g.moveTo(m, m - long);
  g.quadraticCurveTo(m + thin, m - thin, m + long, m);
  g.quadraticCurveTo(m + thin, m + thin, m, m + long);
  g.quadraticCurveTo(m - thin, m + thin, m - long, m);
  g.quadraticCurveTo(m - thin, m - thin, m, m - long);
  g.fill();
  spriteCache.set(key, c);
  return c;
}

/** "#rrggbb" or "#rgb" + alpha → rgba(). Other color strings are returned unchanged. */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) return color;
  const full = hex.length === 3 ? hex.split("").map((ch) => ch + ch).join("") : hex;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Mix a hex color with white (amount 0..1). */
export function lighten(color: string, amount: number): string {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const n = parseInt(hex, 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amount);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export class ParticleField {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private emitters: Emitter[] = [];
  private raf = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private running = false;
  private readonly maxParticles: number;
  private readonly resizeObserver: ResizeObserver | null = null;
  /** Multiplier for spawn counts (lower on reduced motion / small screens). */
  density = 1;

  constructor(canvas: HTMLCanvasElement, options: { maxParticles?: number } = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");
    this.ctx = ctx;
    this.maxParticles = options.maxParticles ?? 900;
    this.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.step(dt, now);
      this.draw(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.particles = [];
    this.emitters = [];
  }

  clear(): void {
    this.particles = [];
    this.emitters = [];
  }

  spawn(opts: SpawnOptions): void {
    const count = Math.round(opts.count * this.density);
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      this.particles.push(this.make(opts));
    }
  }

  emit(opts: EmitterOptions): void {
    const now = performance.now();
    const startAt = now + (opts.delay ?? 0);
    this.emitters.push({ opts, startAt, endAt: startAt + opts.duration, carry: 0 });
  }

  /** Streaks rushing into (cx, cy) from outside — the "charge" before a burst. */
  converge(opts: { count: number; colors: string[]; x?: number; y?: number; duration?: number }): void {
    const cx = (opts.x ?? 0.5) * this.width;
    const cy = (opts.y ?? 0.5) * this.height;
    const radius = Math.hypot(this.width, this.height) * 0.6;
    const life = (opts.duration ?? 700) / 1000;
    const count = Math.round(opts.count * this.density);
    for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
      const a = Math.random() * TAU;
      const r = radius * rand(0.75, 1.15);
      const t = life * rand(0.55, 1);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      this.particles.push({
        kind: "streak",
        x,
        y,
        vx: (cx - x) / t,
        vy: (cy - y) / t,
        gravity: 0,
        drag: 0,
        life: 0,
        maxLife: t * 0.98,
        size: rand(1.2, 2.6),
        rot: 0,
        vr: 0,
        flip: 0,
        vflip: 0,
        color: pick(opts.colors),
        twinkle: 0,
      });
    }
  }

  private make(o: SpawnOptions): Particle {
    const x = ((o.x ?? 0.5) + rand(-(o.spreadX ?? 0), o.spreadX ?? 0)) * this.width;
    const y = ((o.y ?? 0.5) + rand(-(o.spreadY ?? 0), o.spreadY ?? 0)) * this.height;
    const angle = ((o.angle ?? 0) + rand(-(o.cone ?? 360) / 2, (o.cone ?? 360) / 2)) * (Math.PI / 180);
    const [smin, smax] = o.speed ?? [100, 400];
    const speed = rand(smin, smax);
    const [zmin, zmax] = o.size ?? defaultSize(o.kind);
    const [lmin, lmax] = o.life ?? [1.2, 2.4];
    return {
      kind: o.kind,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: o.gravity ?? defaultGravity(o.kind),
      drag: o.drag ?? defaultDrag(o.kind),
      life: 0,
      maxLife: rand(lmin, lmax),
      size: rand(zmin, zmax),
      rot: Math.random() * TAU,
      vr: rand(-8, 8),
      flip: Math.random() * TAU,
      vflip: rand(4, 11),
      color: pick(o.colors),
      twinkle: rand(5, 11),
    };
  }

  private step(dt: number, now: number): void {
    // emitters
    for (const e of this.emitters) {
      if (now < e.startAt || now > e.endAt) continue;
      e.carry += e.opts.rate * this.density * dt;
      while (e.carry >= 1 && this.particles.length < this.maxParticles) {
        e.carry -= 1;
        this.particles.push(this.make(e.opts));
      }
    }
    this.emitters = this.emitters.filter((e) => now <= e.endAt);

    // particles
    const next: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.life >= p.maxLife) continue;
      const drag = Math.max(0, 1 - p.drag * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vflip * dt;
      if (p.y > this.height + 60 && p.vy > 0 && p.kind !== "streak") continue;
      next.push(p);
    }
    this.particles = next;
  }

  private draw(now: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    const t = now / 1000;

    // normal blending: confetti & coins
    ctx.globalCompositeOperation = "source-over";
    for (const p of this.particles) {
      if (p.kind === "confetti") this.drawConfetti(p);
      else if (p.kind === "coin") this.drawCoin(p);
    }

    // additive blending: light
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      switch (p.kind) {
        case "sparkle":
          this.drawSparkle(p, t);
          break;
        case "streak":
          this.drawStreak(p);
          break;
        case "shard":
          this.drawShard(p);
          break;
        case "dust":
        case "ember":
          this.drawGlow(p, t);
          break;
      }
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  private fade(p: Particle, fadeIn = 0.08, fadeOut = 0.3): number {
    const k = p.life / p.maxLife;
    if (k < fadeIn) return k / fadeIn;
    if (k > 1 - fadeOut) return Math.max(0, (1 - k) / fadeOut);
    return 1;
  }

  private drawConfetti(p: Particle): void {
    const ctx = this.ctx;
    const flip = Math.cos(p.flip);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, flip);
    ctx.globalAlpha = this.fade(p, 0.02, 0.2);
    ctx.fillStyle = flip > 0 ? p.color : shade(p.color);
    ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
    ctx.restore();
  }

  private drawCoin(p: Particle): void {
    const ctx = this.ctx;
    const w = Math.max(0.15, Math.abs(Math.cos(p.flip)));
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot * 0.15);
    ctx.globalAlpha = this.fade(p, 0.02, 0.2);
    ctx.scale(w, 1);
    const r = p.size;
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, "#fff6c2");
    grad.addColorStop(0.45, "#ffd23f");
    grad.addColorStop(1, "#c77d0a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.lineWidth = r * 0.16;
    ctx.strokeStyle = "#b86e06";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, TAU);
    ctx.strokeStyle = "rgba(255,246,194,0.7)";
    ctx.lineWidth = r * 0.1;
    ctx.stroke();
    ctx.restore();
  }

  private drawSparkle(p: Particle, t: number): void {
    const sprite = starSprite(p.color);
    const pulse = 0.55 + 0.45 * Math.sin(t * p.twinkle + p.flip);
    const s = p.size * (0.6 + 0.6 * pulse) * 2.2;
    const ctx = this.ctx;
    ctx.globalAlpha = this.fade(p, 0.15, 0.4) * (0.6 + 0.4 * pulse);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot * 0.05);
    ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
    ctx.restore();
  }

  private drawGlow(p: Particle, t: number): void {
    const sprite = glowSprite(p.color);
    const flicker = p.kind === "ember" ? 0.75 + 0.25 * Math.sin(t * p.twinkle * 2 + p.flip) : 1;
    const s = p.size * 4;
    this.ctx.globalAlpha = this.fade(p, 0.15, 0.45) * flicker;
    this.ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
  }

  private drawStreak(p: Particle): void {
    const ctx = this.ctx;
    const k = 0.07;
    const x2 = p.x - p.vx * k;
    const y2 = p.y - p.vy * k;
    const grad = ctx.createLinearGradient(p.x, p.y, x2, y2);
    grad.addColorStop(0, withAlpha(p.color, 1));
    grad.addColorStop(1, withAlpha(p.color, 0));
    ctx.globalAlpha = Math.min(1, (p.life / p.maxLife) * 3);
    ctx.strokeStyle = grad;
    ctx.lineWidth = p.size;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private drawShard(p: Particle): void {
    const ctx = this.ctx;
    const len = Math.hypot(p.vx, p.vy) * 0.09;
    const a = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.globalAlpha = this.fade(p, 0.02, 0.6);
    const grad = ctx.createLinearGradient(0, 0, -len, 0);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, withAlpha(p.color, 0.9));
    grad.addColorStop(1, withAlpha(p.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-len, -p.size);
    ctx.lineTo(-len, p.size);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function shade(color: string): string {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const n = parseInt(hex, 16);
  const ch = (v: number) => Math.round(v * 0.62);
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function defaultSize(kind: ParticleKind): [number, number] {
  switch (kind) {
    case "confetti":
      return [4, 8];
    case "sparkle":
      return [6, 16];
    case "coin":
      return [7, 13];
    case "shard":
      return [2, 5];
    case "dust":
      return [1.5, 4];
    case "ember":
      return [2, 4.5];
    default:
      return [1.5, 3];
  }
}

function defaultGravity(kind: ParticleKind): number {
  switch (kind) {
    case "confetti":
      return 260;
    case "coin":
      return 620;
    case "ember":
      return -40;
    case "dust":
      return 18;
    default:
      return 0;
  }
}

function defaultDrag(kind: ParticleKind): number {
  switch (kind) {
    case "confetti":
      return 1.6;
    case "coin":
      return 0.35;
    case "shard":
      return 1.2;
    case "sparkle":
      return 2.2;
    case "dust":
      return 0.6;
    case "ember":
      return 0.9;
    default:
      return 0;
  }
}

/** True when the user prefers reduced motion (browser only). */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
