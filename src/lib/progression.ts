import type { AppState, Exercise, LiftLog, Plan, SetLog } from './types';

export interface Suggestion {
  weightKg: number | null;
  reason: string;
  lastSets?: SetLog[];
}

/** Every lift log for an exercise id, oldest first. */
export function historyFor(state: AppState, exerciseId: string): { date: string; sets: SetLog[] }[] {
  return Object.values(state.logs)
    .filter((l): l is LiftLog => l.kind === 'lift' && l.completed && !!l.sets[exerciseId]?.length)
    .map((l) => ({ date: l.date, sets: l.sets[exerciseId] }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Double progression: when every set of the last session reached the top of
 * the rep range, add the exercise's increment. If any set fell below the
 * bottom of the range, drop 5%. Otherwise, repeat the weight and chase reps.
 */
export function suggest(state: AppState, ex: Exercise): Suggestion {
  if (ex.bodyweight && ex.increment === 0) {
    return { weightKg: null, reason: 'Bodyweight. Progress by adding reps or slowing the eccentric.' };
  }
  const hist = historyFor(state, ex.id);
  if (hist.length === 0) {
    return {
      weightKg: null,
      reason: `No history. Warm up, then find a weight where ${ex.repsMin}–${ex.repsMax} feels like RPE ${ex.rpe}.`,
    };
  }
  const last = hist[hist.length - 1];
  const working = last.sets.filter((s) => s.weightKg > 0 || ex.bodyweight);
  if (working.length === 0) {
    return { weightKg: null, reason: 'Last session had no loaded sets.', lastSets: last.sets };
  }
  const topWeight = Math.max(...working.map((s) => s.weightKg));
  const topSets = working.filter((s) => s.weightKg === topWeight);
  const allAtTop = topSets.length >= ex.sets - 1 && topSets.every((s) => s.reps >= ex.repsMax);
  const anyBelow = topSets.some((s) => s.reps < ex.repsMin);

  if (allAtTop) {
    return {
      weightKg: round(topWeight + ex.increment),
      reason: `All sets hit ${ex.repsMax} at ${topWeight} kg last time — add ${ex.increment} kg.`,
      lastSets: last.sets,
    };
  }
  if (anyBelow) {
    return {
      weightKg: round(topWeight * 0.95),
      reason: `Fell below ${ex.repsMin} reps at ${topWeight} kg. Back off 5% and rebuild.`,
      lastSets: last.sets,
    };
  }
  return {
    weightKg: topWeight,
    reason: `Repeat ${topWeight} kg and add reps toward ${ex.repsMax}.`,
    lastSets: last.sets,
  };
}

const round = (kg: number) => Math.round(kg * 4) / 4;

/** Epley estimated 1RM for the best set in a log. */
export function estimated1RM(sets: SetLog[]): number {
  return Math.max(0, ...sets.map((s) => (s.reps === 1 ? s.weightKg : s.weightKg * (1 + s.reps / 30))));
}

/* ---------- weight trend ---------- */

/** 7-day trailing average for each entry. */
export function movingAverage(entries: { date: string; kg: number }[], window = 7): { date: string; kg: number; avg: number }[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((e, i) => {
    const slice = sorted.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((s, x) => s + x.kg, 0) / slice.length;
    return { ...e, avg };
  });
}

/** Least-squares slope in kg/week over the last `days` days. Null if too little data. */
export function weeklyTrend(entries: { date: string; kg: number }[], days = 14): number | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 4) return null;
  const lastDate = new Date(sorted[sorted.length - 1].date).getTime();
  const recent = sorted.filter((e) => lastDate - new Date(e.date).getTime() <= days * 86400000);
  if (recent.length < 4) return null;
  const xs = recent.map((e) => (new Date(e.date).getTime() - lastDate) / 86400000);
  const ys = recent.map((e) => e.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return (num / den) * 7;
}

/* ---------- adherence & volume ---------- */

export function weeklyKmActual(state: AppState, plan: Plan): { week: number; planned: number; actual: number }[] {
  return plan.weeks.map((w) => {
    let actual = 0;
    for (const d of w.days) {
      for (const s of d.sessions) {
        const log = state.logs[s.id];
        if (log?.kind === 'run' && log.completed) actual += log.distanceKm ?? 0;
      }
    }
    return { week: w.index, planned: w.targetKm, actual: Math.round(actual * 10) / 10 };
  });
}

export function adherence(state: AppState, plan: Plan, uptoDate: string): { done: number; planned: number } {
  let done = 0;
  let planned = 0;
  for (const w of plan.weeks) {
    for (const d of w.days) {
      if (d.date > uptoDate) continue;
      for (const s of d.sessions) {
        if (s.kind === 'rest') continue;
        if (s.kind === 'run' && s.optional) continue;
        planned++;
        if (state.logs[s.id]?.completed) done++;
      }
    }
  }
  return { done, planned };
}
