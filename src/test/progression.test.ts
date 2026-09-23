import { adherence, estimated1RM, movingAverage, suggest, weeklyKmActual, weeklyTrend } from '../lib/progression';
import { buildPlan } from '../lib/plan';
import { DEFAULT_PROFILE, EMPTY_STATE, importJSON, exportJSON, migrate } from '../lib/storage';
import type { AppState, Exercise, LiftLog } from '../lib/types';

const ex: Exercise = {
  id: 'ohp', name: 'OHP', role: 'main', focus: 'shoulders', sets: 3, repsMin: 6, repsMax: 10,
  unit: 'reps', rpe: 7.5, restSec: 150, cue: '', increment: 2.5,
};

const withLog = (sets: { reps: number; weightKg: number }[]): AppState => {
  const log: LiftLog = { kind: 'lift', sessionId: 'w3d0-upperA', date: '2026-09-21', completed: true, sets: { ohp: sets } };
  return { ...EMPTY_STATE, logs: { [log.sessionId]: log } };
};

describe('double progression', () => {
  it('asks for a starting weight with no history', () => {
    expect(suggest(EMPTY_STATE, ex).weightKg).toBeNull();
  });
  it('adds the increment when all sets hit the top', () => {
    const s = suggest(withLog([{ reps: 10, weightKg: 40 }, { reps: 10, weightKg: 40 }, { reps: 10, weightKg: 40 }]), ex);
    expect(s.weightKg).toBe(42.5);
  });
  it('repeats the weight when reps are mid-range', () => {
    const s = suggest(withLog([{ reps: 10, weightKg: 40 }, { reps: 8, weightKg: 40 }, { reps: 7, weightKg: 40 }]), ex);
    expect(s.weightKg).toBe(40);
  });
  it('backs off when reps fall below range', () => {
    const s = suggest(withLog([{ reps: 6, weightKg: 40 }, { reps: 5, weightKg: 40 }, { reps: 4, weightKg: 40 }]), ex);
    expect(s.weightKg).toBe(38);
  });
  it('handles bodyweight-only exercises', () => {
    expect(suggest(EMPTY_STATE, { ...ex, bodyweight: true, increment: 0 }).weightKg).toBeNull();
  });
  it('estimates 1RM with Epley', () => {
    expect(estimated1RM([{ reps: 5, weightKg: 60 }])).toBeCloseTo(70, 0);
    expect(estimated1RM([{ reps: 1, weightKg: 80 }])).toBe(80);
  });
});

describe('weight trend', () => {
  const entries = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-09-${(i + 1).toString().padStart(2, '0')}`,
    kg: 80 - i * 0.07 + (i % 2 ? 0.3 : -0.3), // ~-0.5 kg/week with noise
  }));
  it('computes a moving average', () => {
    const ma = movingAverage(entries);
    expect(ma).toHaveLength(14);
    expect(ma[13].avg).toBeLessThan(ma[0].avg);
  });
  it('estimates the weekly slope', () => {
    const slope = weeklyTrend(entries);
    expect(slope).not.toBeNull();
    expect(slope!).toBeGreaterThan(-0.7);
    expect(slope!).toBeLessThan(-0.3);
  });
  it('returns null with too little data', () => {
    expect(weeklyTrend(entries.slice(0, 3))).toBeNull();
  });
});

describe('volume and adherence', () => {
  const plan = buildPlan({ ...DEFAULT_PROFILE, startDate: '2026-09-07', race: null });
  it('sums actual km per week and counts adherence', () => {
    const state: AppState = {
      ...EMPTY_STATE,
      logs: {
        'w1d1-run': { kind: 'run', sessionId: 'w1d1-run', date: '2026-09-08', completed: true, distanceKm: 5.2 },
        'w1d0-upperA': { kind: 'lift', sessionId: 'w1d0-upperA', date: '2026-09-07', completed: true, sets: {} },
      },
    };
    expect(weeklyKmActual(state, plan)[0].actual).toBe(5.2);
    const a = adherence(state, plan, '2026-09-09');
    expect(a.planned).toBe(3); // Mon lift, Tue run, Wed lift
    expect(a.done).toBe(2);
  });
});

describe('storage', () => {
  it('round-trips export/import and tolerates partial data', () => {
    const state: AppState = { ...EMPTY_STATE, profile: DEFAULT_PROFILE, weights: [{ date: '2026-09-07', kg: 80 }] };
    const back = importJSON(exportJSON(state));
    expect(back.profile?.weightKg).toBe(80);
    expect(back.weights).toHaveLength(1);
    expect(migrate({}).profile).toBeNull();
    expect(() => importJSON('null')).toThrow();
  });
});

describe('race-prep nutrition and migration', () => {
  it('removes the deficit during race prep', async () => {
    const { targetsFor } = await import('../lib/nutrition');
    const t = targetsFor(DEFAULT_PROFILE, 80, 'raceprep', false, 40, 3);
    expect(t.target).toBe(t.maintenance);
  });
  it('fills a missing race key from defaults but respects an explicit null', () => {
    const { race: _r, ...noRace } = DEFAULT_PROFILE;
    expect(migrate({ profile: noRace as typeof DEFAULT_PROFILE }).profile?.race?.name).toBe('Melbourne Marathon');
    expect(migrate({ profile: { ...DEFAULT_PROFILE, race: null } }).profile?.race).toBeNull();
  });
});
