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

export const RACE_PREP_PHASE: Phase = {
  key: 'raceprep',
  name: 'Race prep',
  weeks: 3,
  goal: 'Get to the start line fresh on the fitness you already have. One long run, a sharpening week, a taper.',
  running: 'Easy runs genuinely easy (slow end of the easy zone). One 22 km long run three weeks out, marathon-pace segments the week after, then a short taper.',
  lifting: 'Upper sessions continue. Lower body goes light the week before race week and stops in race week. Nothing in the last five days.',
  nutrition: 'No deficit at all. Eat at maintenance, then carb-load Thursday to Saturday of race week (8–10 g carbs per kg). The cut resumes after the post-race recovery weeks.',
};

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

/* ---------- schedule (race-aware) ---------- */

export type WeekSlot =
  | { kind: 'block'; blockWeek: number; postRace: boolean }
  | { kind: 'prerace'; preWeek: number }
  | { kind: 'prep'; prepWeek: 1 | 2 | 3 };

/** Number of whole weeks between two Mondays. */
const weeksBetween = (fromMonday: string, toMonday: string) =>
  Math.round((parseISODate(toMonday).getTime() - parseISODate(fromMonday).getTime()) / (7 * 86400000));

/**
 * Lay out the plan as week slots. Without a race: 14 block weeks. With one:
 * any weeks before the prep window are easy pre-race weeks, the three weeks
 * ending on race week are prep, and the full block follows from the next Monday.
 */
export function buildSchedule(profile: Profile): WeekSlot[] {
  const start = mondayOf(profile.startDate);
  const race = profile.race;
  if (!race || race.date < start) {
    return Array.from({ length: TOTAL_WEEKS }, (_, i) => ({ kind: 'block', blockWeek: i + 1, postRace: false }));
  }
  const raceWeek = weeksBetween(start, mondayOf(race.date)) + 1; // 1-based
  const prepStart = Math.max(1, raceWeek - 2);
  const slots: WeekSlot[] = [];
  for (let w = 1; w < prepStart; w++) slots.push({ kind: 'prerace', preWeek: w });
  for (let w = prepStart; w <= raceWeek; w++) {
    // If the race is within two weeks of the start, drop the earliest prep templates.
    const prepWeek = (3 - (raceWeek - w)) as 1 | 2 | 3;
    slots.push({ kind: 'prep', prepWeek });
  }
  for (let b = 1; b <= TOTAL_WEEKS; b++) slots.push({ kind: 'block', blockWeek: b, postRace: b === 1 });
  return slots;
}

/* ---------- lifting ---------- */

interface Scheme {
  sets: number;
  repsMin: number;
  repsMax: number;
  rpe: number;
}

function schemeFor(role: Exercise['role'], phaseIn: PhaseKey, isDeload: boolean, base: ExerciseDef['base']): Scheme {
  const phase: Exclude<PhaseKey, 'raceprep'> = phaseIn === 'raceprep' ? 'foundation' : phaseIn;
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

function liftSession(
  id: string,
  template: LiftTemplate,
  phase: PhaseKey,
  isDeload: boolean,
  opts: { testWeek?: boolean; note?: string } = {},
): LiftSession {
  const t = LIFT_TEMPLATES[template];
  let description = t.description;
  if (phase === 'recovery') description += ' This phase: two sets per exercise, RPE 6, find your starting weights.';
  if (opts.note) description += ` ${opts.note}`;
  if (isDeload && opts.testWeek) {
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

function longRunFastFinish(km: number, fastKm: number): RunSpec {
  return {
    type: 'long_mp',
    title: `Long run ${km} km, last ${fastKm} km at MP`,
    km,
    description: `${km} km. Easy for ${km - fastKm} km, then ${fastKm} km at marathon pace to finish. Practise race-day breakfast and fuelling.`,
    segments: [
      { label: 'Easy', zone: 'easy', distanceKm: km - fastKm },
      { label: 'Marathon pace', zone: 'marathon', distanceKm: fastKm },
    ],
  };
}

function mpReps(reps: number, km: number, totalKm: number): RunSpec {
  return {
    type: 'threshold',
    title: `${reps} × ${km} km at MP`,
    km: totalKm,
    description: `2 km warm-up, ${reps} × ${km} km at marathon pace with 1 km easy between, 2 km cool-down. Controlled — this is rehearsal, not a workout.`,
    segments: [
      { label: 'Warm-up', zone: 'easy', distanceKm: 2 },
      { label: 'Marathon pace', zone: 'marathon', reps, distanceKm: km, recovery: '1 km easy' },
      { label: 'Cool-down', zone: 'easy', distanceKm: 2 },
    ],
  };
}

function mpTouches(totalKm: number): RunSpec {
  return {
    type: 'easy',
    title: 'Easy + 6 × 1 min at MP',
    km: totalKm,
    description: `${totalKm} km easy with 6 × 1 min at marathon pace spread through the middle. Just enough to remember the rhythm.`,
    segments: [
      { label: 'Easy', zone: 'easy', distanceKm: totalKm - 1 },
      { label: 'MP touches', zone: 'marathon', reps: 6, minutes: 1, recovery: '2 min easy' },
    ],
  };
}

function shakeout(km: number): RunSpec {
  return {
    type: 'recovery',
    title: `Shakeout ${km} km`,
    km,
    description: `${km} km very easy with 4 relaxed strides. Lay out kit, pin the bib, early night.`,
    segments: [{ label: 'Shakeout', zone: 'recovery', distanceKm: km }],
  };
}

function raceRun(name: string, distanceKm: number): RunSpec {
  const half = distanceKm < 30;
  return {
    type: 'race',
    title: name,
    km: distanceKm,
    description: half
      ? 'Race day. First 5 km at the slow end of half-marathon pace, hold to 15 km, then run the last 6 km as hard as you can sustain. One gel at 40 min is enough. Even splits beat a fast start here.'
      : 'Race day. First 10 km at or a few seconds slower than target pace, settle through halfway, and only decide whether to push from 32 km. Fuel from 45 min in. With a short build like this, patience early is what protects the last 10 km.',
    segments: [{ label: 'Race', zone: half ? 'threshold' : 'marathon', distanceKm }],
  };
}

function hmReps(reps: number, km: number, totalKm: number): RunSpec {
  return {
    type: 'threshold',
    title: `${reps} × ${km} km at half-marathon pace`,
    km: totalKm,
    description: `2 km warm-up, ${reps} × ${km} km at half-marathon pace with 3 min jog between, 2 km cool-down. This is the fitness test: the pace you hold here comfortably is your race pace. Try to run the middle rep faster and note how it felt.`,
    segments: [
      { label: 'Warm-up', zone: 'easy', distanceKm: 2 },
      { label: 'Half-marathon pace', zone: 'threshold', reps, distanceKm: km, recovery: '3 min jog' },
      { label: 'Cool-down', zone: 'easy', distanceKm: 2 },
    ],
  };
}

function longRunHmFinish(km: number, fastKm: number): RunSpec {
  return {
    type: 'long_mp',
    title: `Long run ${km} km, last ${fastKm} km at HM pace`,
    km,
    description: `${km} km. Easy for ${km - fastKm} km, then ${fastKm} km at half-marathon pace to finish. Practise the race-morning routine.`,
    segments: [
      { label: 'Easy', zone: 'easy', distanceKm: km - fastKm },
      { label: 'Half-marathon pace', zone: 'threshold', distanceKm: fastKm },
    ],
  };
}

function hmTouches(reps: number, totalKm: number): RunSpec {
  return {
    type: 'easy',
    title: `Easy + ${reps} × 1 km at HM pace`,
    km: totalKm,
    description: `${totalKm} km: 2 km easy, ${reps} × 1 km at half-marathon pace with 2 min jog, easy home. Sharp, not tiring.`,
    segments: [
      { label: 'Warm-up', zone: 'easy', distanceKm: 2 },
      { label: 'HM pace', zone: 'threshold', reps, distanceKm: 1, recovery: '2 min jog' },
      { label: 'Cool-down', zone: 'easy', distanceKm: totalKm - 2 - reps },
    ],
  };
}

/** Race-prep weeks: [Tue, Thu, Sat, Sun]. Week 3 is race week and Sunday is the race. */
function runsForPrepWeek(prepWeek: 1 | 2 | 3, race: { name: string; distanceKm: number }): [RunSpec, RunSpec, RunSpec, RunSpec] {
  if (race.distanceKm < 30) {
    switch (prepWeek) {
      case 1:
        return [easyRun(8), easyRun(8, true), longRunFastFinish(18, 4), recoveryRun(4)];
      case 2:
        return [hmReps(3, 2, 11), easyRun(8, true), longRunHmFinish(14, 6), recoveryRun(4)];
      case 3:
      default:
        return [hmTouches(4, 8), easyRun(5, true), shakeout(3), raceRun(race.name, race.distanceKm)];
    }
  }
  switch (prepWeek) {
    case 1:
      return [easyRun(8), easyRun(8, true), longRunFastFinish(22, 5), recoveryRun(4)];
    case 2:
      return [mpReps(3, 2, 10), easyRun(8), longRunFastFinish(16, 8), recoveryRun(4)];
    case 3:
    default:
      return [mpTouches(8), easyRun(5, true), shakeout(3), raceRun(race.name, race.distanceKm)];
  }
}

/** First week after a marathon: the block's recovery week 1 with the early days cut back. */
function runsForPostRaceWeek(): [RunSpec, RunSpec, RunSpec, RunSpec] {
  const walk: RunSpec = {
    type: 'recovery',
    title: 'Walk 30–40 min',
    km: 0,
    description: 'Two days after the race: walk, no running. Log it as done when you have moved.',
    segments: [],
  };
  return [walk, easyRun(4), easyRun(7), recoveryRun(4)];
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
  const schedule = buildSchedule(profile);
  const race = profile.race ? { name: profile.race.name, distanceKm: profile.race.distanceKm ?? 42.2 } : null;
  const weeks: PlanWeek[] = [];

  schedule.forEach((slot, i) => {
    const w = i + 1;
    const id = (d: number, k: string) => `w${w}d${d}-${k}`;
    let phase: Phase;
    let phaseWeek: number;
    let isDeload = false;
    let blockWeek: number | undefined;
    let runs: [RunSpec, RunSpec, RunSpec, RunSpec];
    let byDay: Session[][];
    let focus: string;
    let sundayIsRace = false;

    if (slot.kind === 'prep' && race) {
      phase = RACE_PREP_PHASE;
      phaseWeek = slot.prepWeek;
      isDeload = slot.prepWeek === 3;
      runs = runsForPrepWeek(slot.prepWeek, race);
      sundayIsRace = slot.prepWeek === 3;
      const pk: PhaseKey = 'raceprep';
      const lowerTemplate: LiftTemplate = w % 2 === 1 ? 'lowerA' : 'lowerB';
      if (slot.prepWeek === 1) {
        byDay = [
          [liftSession(id(0, 'upperA'), 'upperA', pk, false)],
          [runSession(id(1, 'run'), runs[0])],
          [liftSession(id(2, lowerTemplate), lowerTemplate, pk, false, { note: 'Last full lower session before the race.' })],
          [runSession(id(3, 'run'), runs[1])],
          [liftSession(id(4, 'upperB'), 'upperB', pk, false)],
          [runSession(id(5, 'run'), runs[2])],
          [restSession(id(6, 'rest'))],
        ];
        focus = 'Race prep 1. Easy runs slow, one proper long run Saturday. No deficit from today.';
      } else if (slot.prepWeek === 2) {
        byDay = [
          [liftSession(id(0, 'upperA'), 'upperA', pk, false)],
          [runSession(id(1, 'run'), runs[0])],
          [liftSession(id(2, lowerTemplate), lowerTemplate, 'recovery', false, { note: 'Light week: two sets, RPE 6, nothing heavy on the legs.' })],
          [runSession(id(3, 'run'), runs[1])],
          [liftSession(id(4, 'upperB'), 'upperB', pk, false)],
          [runSession(id(5, 'run'), runs[2])],
          [restSession(id(6, 'rest'))],
        ];
        focus = race.distanceKm < 30
          ? 'Race prep 2. Tuesday is the fitness test at half-marathon pace. Legs light in the gym.'
          : 'Race prep 2. Marathon-pace rehearsal Tuesday and Saturday. Legs light in the gym.';
      } else {
        byDay = [
          [liftSession(id(0, 'upperA'), 'upperA', pk, true, { note: 'Race week: light upper only, then nothing until after the race.' })],
          [runSession(id(1, 'run'), runs[0])],
          [restSession(id(2, 'rest'))],
          [runSession(id(3, 'run'), runs[1])],
          [restSession(id(4, 'rest'))],
          [runSession(id(5, 'run'), runs[2])],
          [runSession(id(6, 'run'), runs[3])],
        ];
        focus = race.distanceKm < 30
          ? `Race week. Normal eating with extra carbs Friday and Saturday, sleep, and run ${race.name} on even splits Sunday.`
          : `Race week. Carb-load Thu–Sat, sleep, and run ${race.name} patiently on Sunday.`;
      }
    } else if (slot.kind === 'prerace') {
      // Easy base weeks before the prep window: same content as the block's recovery weeks.
      phase = PHASES[0];
      phaseWeek = slot.preWeek;
      blockWeek = undefined;
      runs = runsForWeek(Math.min(2, slot.preWeek));
      const lowerTemplate: LiftTemplate = w % 2 === 1 ? 'lowerA' : 'lowerB';
      byDay = [
        [liftSession(id(0, 'upperA'), 'upperA', 'recovery', false)],
        [runSession(id(1, 'run'), runs[0])],
        [liftSession(id(2, lowerTemplate), lowerTemplate, 'recovery', false)],
        [runSession(id(3, 'run'), runs[1])],
        [liftSession(id(4, 'upperB'), 'upperB', 'recovery', false)],
        [runSession(id(5, 'run'), runs[2])],
        profile.optionalRun ? [runSession(id(6, 'run'), runs[3], true)] : [restSession(id(6, 'rest'))],
      ];
      focus = WEEK_FOCUS[Math.min(2, slot.preWeek)] ?? '';
    } else {
      const b = slot.kind === 'block' ? slot.blockWeek : 1;
      const postRace = slot.kind === 'block' && slot.postRace;
      const meta = weekMeta(b);
      phase = meta.phase;
      phaseWeek = meta.phaseWeek;
      isDeload = meta.isDeload;
      blockWeek = b;
      runs = postRace ? runsForPostRaceWeek() : runsForWeek(b);
      const lowerTemplate: LiftTemplate = b % 2 === 1 ? 'lowerA' : 'lowerB';
      const testWeek = b === TOTAL_WEEKS;
      if (postRace) {
        byDay = [
          [restSession(id(0, 'rest'))],
          [runSession(id(1, 'run'), runs[0])],
          [liftSession(id(2, 'upperA'), 'upperA', 'recovery', false, { note: 'Three days post-race: upper body only, two easy sets.' })],
          [runSession(id(3, 'run'), runs[1])],
          [liftSession(id(4, lowerTemplate), lowerTemplate, 'recovery', false, { note: 'First legs session after the race. Very light, technique only.' })],
          [runSession(id(5, 'run'), runs[2])],
          profile.optionalRun ? [runSession(id(6, 'run'), runs[3], true)] : [restSession(id(6, 'rest'))],
        ];
        focus = 'Post-race recovery. Walk, sleep, eat at maintenance. The block restarts from here.';
      } else {
        byDay = [
          [liftSession(id(0, 'upperA'), 'upperA', phase.key, isDeload, { testWeek })],
          [runSession(id(1, 'run'), runs[0])],
          [liftSession(id(2, lowerTemplate), lowerTemplate, phase.key, isDeload, { testWeek })],
          [runSession(id(3, 'run'), runs[1])],
          [liftSession(id(4, 'upperB'), 'upperB', phase.key, isDeload, { testWeek })],
          [runSession(id(5, 'run'), runs[2])],
          profile.optionalRun ? [runSession(id(6, 'run'), runs[3], true)] : [restSession(id(6, 'rest'))],
        ];
        focus = WEEK_FOCUS[b] ?? '';
      }
    }

    const days: PlanDay[] = byDay.map((sessions, d) => ({
      date: addDays(start, (w - 1) * 7 + d),
      weekday: d,
      sessions,
    }));

    const sundayKm = sundayIsRace ? runs[3].km : profile.optionalRun && slot.kind !== 'prep' ? runs[3].km : 0;
    const targetKm = runs[0].km + runs[1].km + runs[2].km + sundayKm;

    weeks.push({ index: w, phase, phaseWeek, isDeload, blockWeek, days, targetKm, focus });
  });

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
