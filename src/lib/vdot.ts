/**
 * Jack Daniels / Gilbert VDOT model.
 * Oxygen cost of running at velocity v (m/min) and the fraction of VO2max
 * sustainable for a race of duration t (minutes).
 */
import type { PaceZone, Paces } from './types';

const oxygenCost = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v;

const fractionOfMax = (tMin: number) =>
  0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);

/** Velocity (m/min) that requires a given VO2. Inverse of oxygenCost. */
const velocityForVo2 = (vo2: number) => {
  const a = 0.000104;
  const b = 0.182258;
  const c = -(4.6 + vo2);
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
};

export function vdotFromRace(distanceM: number, seconds: number): number {
  const tMin = seconds / 60;
  const v = distanceM / tMin;
  return oxygenCost(v) / fractionOfMax(tMin);
}

/** Seconds per km when running at a given percentage of VDOT. */
export function paceAtPercent(vdot: number, pct: number): number {
  const v = velocityForVo2(vdot * pct);
  return 1000 / v * 60;
}

/** Predict race time (seconds) for a distance at a given VDOT via bisection. */
export function predictRace(vdot: number, distanceM: number): number {
  let lo = 60; // seconds
  let hi = 6 * 3600;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const achievable = vdotFromRace(distanceM, mid);
    if (achievable > vdot) lo = mid; // running that fast would need a higher vdot → slow down
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Zone intensities as a fraction of VDOT. Daniels' tables, slightly
 * conservative on the easy end because this plan sits on top of a
 * strength programme and a calorie deficit.
 */
const ZONES: Record<PaceZone, [number, number]> = {
  recovery: [0.59, 0.65],
  easy: [0.65, 0.74],
  marathon: [0.80, 0.84],
  threshold: [0.85, 0.88],
  interval: [0.96, 1.0],
  repetition: [1.05, 1.1],
};

export function computePaces(marathonSeconds: number): Paces {
  const vdot = vdotFromRace(42195, marathonSeconds);
  const zones = {} as Paces['zones'];
  (Object.keys(ZONES) as PaceZone[]).forEach((z) => {
    const [lo, hi] = ZONES[z];
    // higher % → faster → fewer seconds per km, so min pace is at hi %
    zones[z] = { min: paceAtPercent(vdot, hi), max: paceAtPercent(vdot, lo) };
  });
  return {
    vdot,
    zones,
    predictions: {
      '5k': predictRace(vdot, 5000),
      '10k': predictRace(vdot, 10000),
      half: predictRace(vdot, 21097.5),
      marathon: predictRace(vdot, 42195),
    },
  };
}

export function formatPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function formatPaceRange(z: { min: number; max: number }): string {
  return `${formatPace(z.min)}–${formatPace(z.max)} /km`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Parse "h:mm:ss" or "mm:ss" into seconds. Returns null on bad input. */
export function parseTime(text: string): number | null {
  const parts = text.trim().split(':').map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p) || p < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}
