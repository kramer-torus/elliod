import type {
  Exercise,
  LiftSession,
  LiftTemplate,
  Phase,
  PhaseKey,
  Plan,
  PlanDay,
  PlanWeek,
  Profile,
  RestSession,
  RunSession,
  Session,
} from './types';
import { computePaces } from './vdot';
import { LOWER_A, LOWER_B, UPPER_A, UPPER_B, type ExerciseDef } from './exercises';

export const PHASES: Phase[] = [
  {
    key: 'recovery',
    name: 'Recovery',
    weeks: 2,
    goal: 'Absorb the marathon. Rebuild movement quality in the gym before adding load.',
    running: 'Easy only. ~20–25 km/week. No workouts — the legs are still damaged even when they feel fine.',
    lifting: 'All three sessions, two sets per exercise at RPE 6. Learn the lifts, find starting weights, groove technique.',
    nutrition: 'Eat at maintenance. No deficit while you are repairing muscle.',
  },
  {
    key: 'foundation',
    name: 'Foundation',
    weeks: 4,
    goal: 'Build muscle and work capacity. Re-introduce one threshold run.',
    running: '~35 km/week over 3 runs: threshold Tuesday, easy Thursday with strides, long Saturday.',
    lifting: 'Three sets of 8–12 at RPE 7–8. Double progression: hit the top of the range on every set, then add weight.',
    nutrition: 'Start the deficit (default 400 kcal/day). Protein 2 g/kg. Week 6 is a deload — ease the deficit.',
  },
  {
    key: 'build',
    name: 'Build',
    weeks: 4,
    goal: 'Get strong. Sharpen with VO2 intervals alternated with threshold.',
    running: '~38 km/week. Tuesday alternates intervals and threshold; long run creeps to 18 km.',
    lifting: 'Main lifts 4×5–8 at RPE 8, accessories 3×8–12. Loads should be climbing every session.',
    nutrition: 'Hold the deficit. Add 60 g carbs the day before and morning of the long run.',
  },
  {
    key: 'consolidate',
    name: 'Consolidate',
    weeks: 4,
    goal: 'Peak strength on the main lifts. Marathon-pace work inside the long run. Test everything in week 14.',
    running: '~40 km/week. Long runs carry 6–10 km at marathon pace. Week 14: 5 km time trial.',
    lifting: 'Main lifts 5×3–5 at RPE 8–9. Week 14 is a deload with rep-out tests to estimate new maxes.',
    nutrition: 'Final deficit block. Reassess weight, waist and lifts at the end, then return to maintenance for at least two weeks.',
  },
];

export const TOTAL_WEEKS = PHASES.reduce((s, p) => s + p.weeks, 0);

/* ---------- date helpers ---------- */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Snap any date to the Monday of its week. */
export function mondayOf(iso: string): string {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

/** Next Monday strictly after (or on) the given date. */
export function nextMonday(iso: string): string {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7;
  if (dow === 0) return iso;
  d.setDate(d.getDate() + (7 - dow));
  return toISODate(d);
}

/* ---------- phase lookup ---------- */

interface WeekMeta {
  phase: Phase;
  phaseWeek: number;
  isDeload: boolean;
}

export function weekMeta(weekIndex: number): WeekMeta {
  let cursor = 0;
  for (const phase of PHASES) {
    if (weekIndex <= cursor + phase.weeks) {
      const phaseWeek = weekIndex - cursor;
      const isDeload = phase.key !== 'recovery' && phaseWeek === phase.weeks;
      return { phase, phaseWeek, isDeload };
    }
    cursor += phase.weeks;
  }
  const last = PHASES[PHASES.length - 1];
  return { phase: last, phaseWeek: last.weeks, isDeload: true };
}

/* ---------- lifting ---------- */

interface Scheme {
  sets: number;
  repsMin: number;
  repsMax: number;
  rpe: number;
}

function schemeFor(role: Exercise['role'], phase: PhaseKey, isDeload: boolean, base: ExerciseDef['base']): Scheme {
  let s: Scheme;
  if (role === 'main') {
    switch (phase) {
      case 'recovery':
        s = { sets: 2, repsMin: 6, repsMax: 8, rpe: 6 };
        break;
      case 'foundation':
        s = { sets: 3, repsMin: 6, repsMax: 10, rpe: 7.5 };
        break;
      case 'build':
        s = { sets: 4, repsMin: 5, repsMax: 8, rpe: 8 };
        break;
      case 'consolidate':
        s = { sets: 5, repsMin: 3, repsMax: 5, rpe: 8.5 };
        break;
    }
  } else if (role === 'secondary') {
    switch (phase) {
      case 'recovery':
        s = { sets: 2, repsMin: base.repsMin, repsMax: base.repsMax, rpe: 6 };
        break;
      case 'foundation':
        s = { sets: 3, repsMin: 8, repsMax: 12, rpe: 7.5 };
        break;
      default:
        s = { sets: 3, repsMin: base.repsMin, repsMax: base.repsMax, rpe: 8 };
    }
  } else {
    s = {
      sets: phase === 'recovery' ? 2 : base.sets,
      repsMin: base.repsMin,
      repsMax: base.repsMax,
      rpe: phase === 'recovery' ? 6 : 8,
    };
  }
  if (isDeload) {
    s = { ...s, sets: Math.max(2, s.sets - 1), rpe: Math.max(5, s.rpe - 2) };
  }
  return s;
}

function buildExercises(defs: ExerciseDef[], phase: PhaseKey, isDeload: boolean): Exercise[] {
  return defs.map((d) => {
    const { base, ...rest } = d;
    // Time/distance-based accessories keep their own numbers.
    const timeBased = d.unit !== 'reps';
    const scheme = timeBased
      ? { sets: isDeload || phase === 'recovery' ? 2 : base.sets, repsMin: base.repsMin, repsMax: base.repsMax, rpe: 7 }
      : schemeFor(d.role, phase, isDeload, base);
    return { ...rest, ...scheme, restSec: base.restSec };
  });
}

const LIFT_TEMPLATES: Record<LiftTemplate, { title: string; subtitle: string; defs: ExerciseDef[]; description: string }> = {
  upperA: {
    title: 'Upper A',
    subtitle: 'Press + posture',
    defs: UPPER_A,
    description:
      'Overhead press leads. Every pull here is a posture drill: rows and face pulls done strictly, with a pause. Finish with scapular control work.',
  },
  lowerA: {
    title: 'Lower A',
    subtitle: 'Hinge-led',
    defs: LOWER_A,
    description:
      'Trap-bar deadlift builds the posterior chain that holds you upright at 35 km. Split squats and calves are running-injury insurance.',
  },
  lowerB: {
    title: 'Lower B',
    subtitle: 'Squat-led',
    defs: LOWER_B,
    description:
      'Front squat demands an upright thoracic spine — it is a posture lift disguised as a leg lift. RDLs load the hamstrings the way running does not.',
  },
  upperB: {
    title: 'Upper B',
    subtitle: 'Pull + shoulders',
    defs: UPPER_B,
    description:
      'Chin-ups lead. Landmine press is the shoulder-friendly overhead pattern; rear delts, Y-T-Ws and carries are the anti-desk, anti-runner-slump work.',
  },
};

function liftSession(id: string, template: LiftTemplate, phase: PhaseKey, isDeload: boolean, weekIndex: number): LiftSession {
  const t = LIFT_TEMPLATES[template];
  let description = t.description;
  if (phase === 'recovery') description += ' This phase: two sets per exercise, RPE 6, find your starting weights.';
  if (isDeload && weekIndex === TOTAL_WEEKS) {
    description += ' TEST WEEK: on the main lift, after warm-up sets, take your last working weight for as many clean reps as possible (stop 1–2 short of failure).';
  } else if (isDeload) {
    description += ' Deload: one fewer set, two RPE points lighter. Move well, leave the gym fresh.';
  }
  return {
    kind: 'lift',
    id,
    template,
    title: t.title,
    subtitle: t.subtitle,
    exercises: buildExercises(t.defs, phase, isDeload),
    description,
  };
}

/* ---------- running ---------- */

interface RunSpec {
  type: RunSession['type'];
  title: string;
  km: number;
  description: string;
  segments: RunSession['segments'];
}

function easyRun(km: number, strides = false): RunSpec {
  return {
    type: 'easy',
    title: strides ? 'Easy run + strides' : 'Easy run',
    km,
    description: strides
      ? `${km} km easy, conversational. Finish with 6 × 20 s strides (fast but relaxed, full recovery) to keep leg speed.`
      : `${km} km easy. Conversational pace — if in doubt, slower.`,
    segments: [
      { label: 'Easy', zone: 'easy', distanceKm: km },
      ...(strides ? [{ label: 'Strides', zone: 'repetition' as const, reps: 6, minutes: 0.33, recovery: 'walk/jog back' }] : []),
    ],
  };
}

function recoveryRun(km: number): RunSpec {
  return {
    type: 'recovery',
    title: 'Recovery run',
    km,
    description: `${km} km very easy. Shakeout only; skip it if the legs are heavy.`,
    segments: [{ label: 'Recovery', zone: 'recovery', distanceKm: km }],
  };
}

function thresholdRun(reps: number, minutes: number, restMin: number, totalKm: number): RunSpec {
  return {
    type: 'threshold',
    title: `Threshold ${reps} × ${minutes} min`,
    km: totalKm,
    description: `2 km warm-up, ${reps} × ${minutes} min at threshold with ${restMin} min easy jog between, 2 km cool-down. Comfortably hard — you could say a sentence, not a paragraph.`,
    segments: [
      { label: 'Warm-up', zone: 'easy', distanceKm: 2 },
      { label: 'Threshold', zone: 'threshold', reps, minutes, recovery: `${restMin} min jog` },
      { label: 'Cool-down', zone: 'easy', distanceKm: 2 },
    ],
  };
}

function intervalRun(reps: number, metres: number, restMin: number, totalKm: number): RunSpec {
  return {
    type: 'intervals',
    title: `Intervals ${reps} × ${metres} m`,
    km: totalKm,
    description: `2.5 km warm-up with 4 strides, ${reps} × ${metres} m at interval pace with ${restMin} min jog recovery, 2 km cool-down. Hard but even — the last rep should match the first.`,
    segments: [
      { label: 'Warm-up', zone: 'easy', distanceKm: 2.5 },
      { label: 'Interval', zone: 'interval', reps, distanceKm: metres / 1000, recovery: `${restMin} min jog` },
      { label: 'Cool-down', zone: 'easy', distanceKm: 2 },
    ],
  };
}

function mixedRun(totalKm: number): RunSpec {
  return {
    type: 'threshold',
    title: 'Threshold + reps',
    km: totalKm,
    description: '2 km warm-up, 2 × 10 min threshold (2 min jog), then 4 × 400 m at repetition pace (400 m jog), 2 km cool-down.',
    segments: [
      { label: 'Warm-up', zone: 'easy', distanceKm: 2 },
      { label: 'Threshold', zone: 'threshold', reps: 2, minutes: 10, recovery: '2 min jog' },
      { label: 'Reps', zone: 'repetition', reps: 4, distanceKm: 0.4, recovery: '400 m jog' },
      { label: 'Cool-down', zone: 'easy', distanceKm: 2 },
    ],
  };
}

function longRun(km: number, mpKm = 0): RunSpec {
  if (mpKm > 0) {
    return {
      type: 'long_mp',
      title: `Long run ${km} km with ${mpKm} km at MP`,
      km,
      description: `${km} km. Easy for the first ${km - mpKm - 2} km, then ${mpKm} km at marathon pace, 2 km easy to finish. Practise fuelling.`,
      segments: [
        { label: 'Easy', zone: 'easy', distanceKm: km - mpKm - 2 },
        { label: 'Marathon pace', zone: 'marathon', distanceKm: mpKm },
        { label: 'Easy', zone: 'easy', distanceKm: 2 },
      ],
    };
  }
  return {
    type: 'long',
    title: `Long run ${km} km`,
    km,
    description: `${km} km easy. Steady, relaxed, finish feeling like you could do more.`,
    segments: [{ label: 'Easy', zone: 'easy', distanceKm: km }],
  };
}

function timeTrial(): RunSpec {
  return {
    type: 'time_trial',
    title: '5 km time trial',
    km: 9,
    description:
      '2.5 km warm-up with strides, then 5 km all-out on a flat, measured course (or a parkrun). 1.5 km cool-down. Compare to the predicted time from your marathon.',
    segments: [
      { label: 'Warm-up', zone: 'easy', distanceKm: 2.5 },
      { label: 'Time trial', zone: 'interval', distanceKm: 5 },
      { label: 'Cool-down', zone: 'easy', distanceKm: 1.5 },
    ],
  };
}

/** Per-week running prescription: [Tuesday, Thursday, Saturday, optional Sunday]. */
function runsForWeek(weekIndex: number): [RunSpec, RunSpec, RunSpec, RunSpec] {
  switch (weekIndex) {
    // Recovery
    case 1:
      return [easyRun(5), easyRun(6), easyRun(8), recoveryRun(4)];
    case 2:
      return [easyRun(6), easyRun(7), easyRun(10), recoveryRun(5)];
    // Foundation
    case 3:
      return [thresholdRun(3, 8, 2, 10), easyRun(8, true), longRun(14), recoveryRun(5)];
    case 4:
      return [thresholdRun(4, 8, 2, 11), easyRun(8, true), longRun(15), recoveryRun(5)];
    case 5:
      return [thresholdRun(2, 15, 3, 11), easyRun(9, true), longRun(16), recoveryRun(5)];
    case 6:
      return [thresholdRun(2, 8, 2, 8), easyRun(7, true), longRun(12), recoveryRun(4)];
    // Build
    case 7:
      return [intervalRun(5, 1000, 2.5, 11), easyRun(9, true), longRun(16), recoveryRun(5)];
    case 8:
      return [thresholdRun(3, 10, 2, 11), easyRun(9, true), longRun(17), recoveryRun(6)];
    case 9:
      return [intervalRun(6, 1000, 2.5, 12), easyRun(9, true), longRun(18, 6), recoveryRun(6)];
    case 10:
      return [intervalRun(4, 800, 2.5, 9), easyRun(7, true), longRun(12), recoveryRun(4)];
    // Consolidate
    case 11:
      return [thresholdRun(3, 12, 2, 12), easyRun(9, true), longRun(18, 8), recoveryRun(6)];
    case 12:
      return [intervalRun(5, 1200, 3, 12), easyRun(9, true), longRun(16, 6), recoveryRun(6)];
    case 13:
      return [mixedRun(11), easyRun(9, true), longRun(18, 10), recoveryRun(6)];
    case 14:
    default:
      return [thresholdRun(2, 8, 2, 8), easyRun(6, true), timeTrial(), recoveryRun(4)];
  }
}

function runSession(id: string, spec: RunSpec, optional = false): RunSession {
  return {
    kind: 'run',
    id,
    type: spec.type,
    title: spec.title,
    distanceKm: spec.km,
    description: spec.description,
    segments: spec.segments,
    optional,
  };
}

function restSession(id: string): RestSession {
  return {
    kind: 'rest',
    id,
    title: 'Rest + posture routine',
    description: 'Full rest from training. Do the 5-minute daily posture routine and a walk. Sleep is the third training session.',
  };
}

/* ---------- assembly ---------- */

const WEEK_FOCUS: Record<number, string> = {
  1: 'Move easy. Find gym starting weights.',
  2: 'Still easy. Technique over load.',
  3: 'Deficit starts. First threshold session.',
  4: 'Add weight wherever every set hit the top of the range.',
  5: 'Longest threshold blocks of the phase.',
  6: 'Deload. Ease the deficit, sleep more.',
  7: 'First VO2 intervals. Main lifts go to 4 sets.',
  8: 'Threshold week. Loads should be climbing.',
  9: 'Peak build week: 6 × 1000 and MP in the long run.',
  10: 'Deload. Short, sharp intervals only.',
  11: 'Heavy fives begin. 8 km at MP.',
  12: 'Long intervals. Protect sleep.',
  13: 'Biggest long run of the block.',
  14: 'Test week: 5 km time trial and lift rep-outs.',
};

export function buildPlan(profile: Profile): Plan {
  const start = mondayOf(profile.startDate);
  const paces = computePaces(profile.marathonSeconds);
  const weeks: PlanWeek[] = [];

  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const meta = weekMeta(w);
    const [tue, thu, sat, sun] = runsForWeek(w);
    const lowerTemplate: LiftTemplate = w % 2 === 1 ? 'lowerA' : 'lowerB';
    const id = (d: number, k: string) => `w${w}d${d}-${k}`;

    const byDay: Session[][] = [
      [liftSession(id(0, 'upperA'), 'upperA', meta.phase.key, meta.isDeload, w)],
      [runSession(id(1, 'run'), tue)],
      [liftSession(id(2, lowerTemplate), lowerTemplate, meta.phase.key, meta.isDeload, w)],
      [runSession(id(3, 'run'), thu)],
      [liftSession(id(4, 'upperB'), 'upperB', meta.phase.key, meta.isDeload, w)],
      [runSession(id(5, 'run'), sat)],
      profile.optionalRun ? [runSession(id(6, 'run'), sun, true)] : [restSession(id(6, 'rest'))],
    ];

    const days: PlanDay[] = byDay.map((sessions, d) => ({
      date: addDays(start, (w - 1) * 7 + d),
      weekday: d,
      sessions,
    }));

    const targetKm = tue.km + thu.km + sat.km + (profile.optionalRun ? sun.km : 0);

    weeks.push({
      index: w,
      phase: meta.phase,
      phaseWeek: meta.phaseWeek,
      isDeload: meta.isDeload,
      days,
      targetKm,
      focus: WEEK_FOCUS[w] ?? '',
    });
  }

  return { weeks, paces };
}

/** Find the week containing a date, or null if outside the plan. */
export function weekForDate(plan: Plan, iso: string): PlanWeek | null {
  return plan.weeks.find((w) => w.days.some((d) => d.date === iso)) ?? null;
}

export function findSession(plan: Plan, sessionId: string): { session: Session; week: PlanWeek; day: PlanDay } | null {
  for (const week of plan.weeks) {
    for (const day of week.days) {
      const session = day.sessions.find((s) => s.id === sessionId);
      if (session) return { session, week, day };
    }
  }
  return null;
}
