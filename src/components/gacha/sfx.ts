/**
 * Synthesized sound effects (Web Audio API — no audio files needed).
 * Used by the built-in effects and the draw overlay; video effects carry their
 * own soundtrack. Every function is a silent no-op when audio is unavailable.
 * Browser only.
 */

type Ctx = AudioContext;

let context: Ctx | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function audio(): { ctx: Ctx; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  try {
    if (!context) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      context = new AC();
      master = context.createGain();
      master.gain.value = 0.32;
      const comp = context.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(context.destination);
    }
    if (context.state === "suspended") void context.resume().catch(() => {});
    return { ctx: context, out: master! };
  } catch {
    return null;
  }
}

function noise(ctx: Ctx): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const length = ctx.sampleRate * 1.5;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

function tone(
  a: { ctx: Ctx; out: GainNode },
  opts: { type?: OscillatorType; from: number; to?: number; start?: number; duration: number; gain?: number; attack?: number },
): void {
  const { ctx, out } = a;
  const t0 = ctx.currentTime + (opts.start ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.from, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.duration);
  const peak = opts.gain ?? 0.3;
  const attack = opts.attack ?? 0.01;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  osc.connect(gain);
  gain.connect(out);
  osc.start(t0);
  osc.stop(t0 + opts.duration + 0.05);
}

function noiseBurst(
  a: { ctx: Ctx; out: GainNode },
  opts: { start?: number; duration: number; gain?: number; filter?: BiquadFilterType; freq?: number; freqTo?: number },
): void {
  const { ctx, out } = a;
  const t0 = ctx.currentTime + (opts.start ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = opts.filter ?? "lowpass";
  filter.frequency.setValueAtTime(opts.freq ?? 1200, t0);
  if (opts.freqTo) filter.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + opts.duration);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(opts.gain ?? 0.4, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t0);
  src.stop(t0 + opts.duration + 0.05);
}

/** Make sure the AudioContext exists — call from a click handler (autoplay policies). */
export function unlockAudio(): void {
  audio();
}

/** Rising charge-up whoosh. */
export function sfxCharge(durationMs: number, intensity = 1): void {
  const a = audio();
  if (!a) return;
  const d = durationMs / 1000;
  tone(a, { type: "sawtooth", from: 110, to: 440 + 360 * intensity, duration: d, gain: 0.05 + 0.04 * intensity, attack: d * 0.8 });
  tone(a, { type: "sine", from: 220, to: 880 + 600 * intensity, duration: d, gain: 0.07, attack: d * 0.85 });
  noiseBurst(a, { duration: d, gain: 0.05 + 0.05 * intensity, filter: "bandpass", freq: 400, freqTo: 4000 });
}

/** Impact: low thump + bright noise crack. */
export function sfxImpact(intensity = 1): void {
  const a = audio();
  if (!a) return;
  tone(a, { type: "sine", from: 150, to: 38, duration: 0.55 + 0.25 * intensity, gain: 0.45 + 0.3 * intensity, attack: 0.005 });
  noiseBurst(a, { duration: 0.35 + 0.3 * intensity, gain: 0.25 + 0.25 * intensity, filter: "lowpass", freq: 6000, freqTo: 300 });
}

/** Sparkly glints. */
export function sfxSparkle(count = 5, start = 0): void {
  const a = audio();
  if (!a) return;
  for (let i = 0; i < count; i++) {
    const f = 1800 + Math.random() * 2200;
    tone(a, { type: "sine", from: f, to: f * 1.01, start: start + i * (0.06 + Math.random() * 0.05), duration: 0.35, gain: 0.05 });
  }
}

const SCALES: Record<"grand" | "bright" | "soft", number[]> = {
  grand: [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98],
  bright: [587.33, 739.99, 880, 1174.66],
  soft: [659.25, 987.77],
};

/** Celebration arpeggio + chord. */
export function sfxFanfare(kind: "grand" | "bright" | "soft" = "bright", start = 0): void {
  const a = audio();
  if (!a) return;
  const notes = SCALES[kind];
  const step = kind === "grand" ? 0.075 : 0.09;
  notes.forEach((f, i) => {
    tone(a, { type: "triangle", from: f, start: start + i * step, duration: 0.5, gain: 0.12 });
    tone(a, { type: "sine", from: f * 2, start: start + i * step, duration: 0.35, gain: 0.03 });
  });
  const chordAt = start + notes.length * step;
  const chord = kind === "grand" ? [523.25, 659.25, 783.99, 1046.5] : kind === "bright" ? [587.33, 739.99, 880] : [659.25, 987.77];
  for (const f of chord) {
    tone(a, { type: "triangle", from: f, start: chordAt, duration: kind === "soft" ? 0.6 : 1.4, gain: 0.08, attack: 0.02 });
  }
}

/** Capsule pop. */
export function sfxPop(): void {
  const a = audio();
  if (!a) return;
  tone(a, { type: "sine", from: 420, to: 1300, duration: 0.14, gain: 0.25, attack: 0.004 });
  noiseBurst(a, { duration: 0.12, gain: 0.18, filter: "highpass", freq: 2500 });
}

/** Capsule rattle tick while shaking. */
export function sfxRattle(): void {
  const a = audio();
  if (!a) return;
  noiseBurst(a, { duration: 0.05, gain: 0.08, filter: "bandpass", freq: 2200 });
}

/** Card flip tick (10-draw reveal). */
export function sfxFlip(pitch = 1): void {
  const a = audio();
  if (!a) return;
  tone(a, { type: "triangle", from: 900 * pitch, to: 1400 * pitch, duration: 0.08, gain: 0.07, attack: 0.003 });
}
