import { addDays, buildPlan, findSession, mondayOf, nextMonday, PHASES, TOTAL_WEEKS, weekForDate, weekMeta } from '../lib/plan';
import { DEFAULT_PROFILE } from '../lib/storage';

const profile = { ...DEFAULT_PROFILE, startDate: '2026-09-07' };

describe('dates', () => {
  it('snaps to Monday', () => {
    expect(mondayOf('2026-09-07')).toBe('2026-09-07'); // Monday
    expect(mondayOf('2026-09-10')).toBe('2026-09-07'); // Thursday
    expect(mondayOf('2026-09-13')).toBe('2026-09-07'); // Sunday
    expect(nextMonday('2026-09-06')).toBe('2026-09-07');
    expect(nextMonday('2026-09-07')).toBe('2026-09-07');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
  });
});

describe('plan structure', () => {
  const plan = buildPlan(profile);

  it('is 14 weeks of 7 days', () => {
    expect(TOTAL_WEEKS).toBe(14);
    expect(plan.weeks).toHaveLength(14);
    plan.weeks.forEach((w) => expect(w.days).toHaveLength(7));
    expect(plan.weeks[0].days[0].date).toBe('2026-09-07');
    expect(plan.weeks[13].days[6].date).toBe(addDays('2026-09-07', 97));
  });

  it('assigns phases and deloads correctly', () => {
    expect(weekMeta(1).phase.key).toBe('recovery');
    expect(weekMeta(2).isDeload).toBe(false);
    expect(weekMeta(3).phase.key).toBe('foundation');
    expect(weekMeta(6).isDeload).toBe(true);
    expect(weekMeta(7).phase.key).toBe('build');
    expect(weekMeta(10).isDeload).toBe(true);
    expect(weekMeta(11).phase.key).toBe('consolidate');
    expect(weekMeta(14).isDeload).toBe(true);
    expect(PHASES.reduce((s, p) => s + p.weeks, 0)).toBe(14);
  });

  it('has 3 lifts and 3 runs per week with a rest day', () => {
    for (const w of plan.weeks) {
      const kinds = w.days.flatMap((d) => d.sessions.map((s) => s.kind));
      expect(kinds.filter((k) => k === 'lift')).toHaveLength(3);
      expect(kinds.filter((k) => k === 'run')).toHaveLength(3);
      expect(kinds.filter((k) => k === 'rest')).toHaveLength(1);
    }
  });

  it('adds an optional Sunday run when enabled', () => {
    const p2 = buildPlan({ ...profile, optionalRun: true });
    const sun = p2.weeks[0].days[6].sessions[0];
    expect(sun.kind).toBe('run');
    expect(sun.kind === 'run' && sun.optional).toBe(true);
    expect(p2.weeks[0].targetKm).toBeGreaterThan(plan.weeks[0].targetKm);
  });

  it('keeps recovery weeks easy and volume in the intended band', () => {
    const [w1, w2] = plan.weeks;
    for (const w of [w1, w2]) {
      w.days.flatMap((d) => d.sessions).forEach((s) => {
        if (s.kind === 'run') expect(['easy', 'recovery']).toContain(s.type);
      });
      expect(w.targetKm).toBeLessThan(26);
    }
    const loading = plan.weeks.filter((w) => !w.isDeload && w.phase.key !== 'recovery');
    loading.forEach((w) => {
      expect(w.targetKm).toBeGreaterThanOrEqual(30);
      expect(w.targetKm).toBeLessThanOrEqual(42);
    });
    // long run never jumps more than 2 km week-on-week when both are loading weeks
    for (let i = 1; i < plan.weeks.length; i++) {
      const prev = plan.weeks[i - 1];
      const cur = plan.weeks[i];
      if (prev.isDeload || cur.isDeload || prev.phase.key === 'recovery') continue;
      const lr = (w: typeof cur) => w.days[5].sessions[0];
      const a = lr(prev);
      const b = lr(cur);
      if (a.kind === 'run' && b.kind === 'run') expect(b.distanceKm - a.distanceKm).toBeLessThanOrEqual(2);
    }
  });

  it('alternates lower A and lower B and scales set schemes by phase', () => {
    const lower = (w: number) => plan.weeks[w - 1].days[2].sessions[0];
    const tpl = (w: number) => { const s = lower(w); return s.kind === 'lift' ? s.template : null; };
    expect(tpl(1)).toBe('lowerA');
    expect(tpl(2)).toBe('lowerB');

    const mainOf = (w: number) => {
      const s = plan.weeks[w - 1].days[0].sessions[0];
      if (s.kind !== 'lift') throw new Error('expected lift');
      return s.exercises[0];
    };
    expect(mainOf(1)).toMatchObject({ sets: 2, rpe: 6 });
    expect(mainOf(3)).toMatchObject({ sets: 3, repsMin: 6, repsMax: 10 });
    expect(mainOf(7)).toMatchObject({ sets: 4, repsMin: 5, repsMax: 8 });
    expect(mainOf(11)).toMatchObject({ sets: 5, repsMin: 3, repsMax: 5 });
    // deload: one set fewer, two RPE points lighter
    expect(mainOf(6).sets).toBe(mainOf(5).sets - 1);
    expect(mainOf(6).rpe).toBe(mainOf(5).rpe - 2);
  });

  it('has a clear shoulder/posture bias in the upper sessions', () => {
    const upper = plan.weeks[2].days.flatMap((d) => d.sessions).filter((s) => s.kind === 'lift' && s.template.startsWith('upper'));
    const focus = upper.flatMap((s) => (s.kind === 'lift' ? s.exercises.map((e) => e.focus) : []));
    const shoulderPosture = focus.filter((f) => f === 'shoulders' || f === 'posture').length;
    expect(shoulderPosture / focus.length).toBeGreaterThanOrEqual(0.5);
  });

  it('finds sessions and weeks by id and date', () => {
    expect(weekForDate(plan, '2026-09-16')?.index).toBe(2);
    expect(weekForDate(plan, '2020-01-01')).toBeNull();
    const found = findSession(plan, 'w3d1-run');
    expect(found?.session.kind).toBe('run');
    expect(found?.week.index).toBe(3);
    expect(findSession(plan, 'nope')).toBeNull();
  });

  it('ends with a time trial', () => {
    const sat = plan.weeks[13].days[5].sessions[0];
    expect(sat.kind === 'run' && sat.type).toBe('time_trial');
  });
});
