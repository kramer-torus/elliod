export interface Profile {
  heightCm: number;
  weightKg: number;
  age: number;
  sex: 'male' | 'female';
  /** Recent marathon finish time in seconds. Drives all pace zones. */
  marathonSeconds: number;
  /** ISO date (yyyy-mm-dd) of week 1 day 1. Always a Monday. */
  startDate: string;
  targetWeightKg: number;
  /** Daily calorie deficit during cutting phases. */
  dailyDeficitKcal: number;
  /** Include the optional Sunday recovery run. */
  optionalRun: boolean;
  /**
   * An optional marathon inside the plan window. The three weeks ending on
   * race day become a race-prep phase and the hybrid block restarts, with its
   * recovery phase, the day after.
   */
  race?: RaceEntry | null;
}

export interface RaceEntry {
  name: string;
  /** ISO date of race day (any weekday). */
  date: string;
  /** Distance in km. Defaults to 42.2. */
  distanceKm?: number;
}

export type PaceZone = 'recovery' | 'easy' | 'marathon' | 'threshold' | 'interval' | 'repetition';

export interface Paces {
  vdot: number;
  /** seconds per km for each zone (min/max range) */
  zones: Record<PaceZone, { min: number; max: number }>;
  /** predicted race times in seconds */
  predictions: { '5k': number; '10k': number; half: number; marathon: number };
}

export type RunType =
  | 'recovery'
  | 'easy'
  | 'threshold'
  | 'intervals'
  | 'long'
  | 'long_mp'
  | 'time_trial'
  | 'race';

export interface RunSegment {
  label: string;
  zone: PaceZone;
  reps?: number;
  distanceKm?: number;
  minutes?: number;
  recovery?: string;
}

export interface RunSession {
  kind: 'run';
  id: string;
  type: RunType;
  title: string;
  distanceKm: number;
  description: string;
  segments: RunSegment[];
  optional?: boolean;
}

export type Focus = 'shoulders' | 'posture' | 'push' | 'pull' | 'legs' | 'core' | 'run-support';
export type ExerciseRole = 'main' | 'secondary' | 'accessory';
export type LoadUnit = 'reps' | 'seconds' | 'metres';

export interface Exercise {
  /** Stable key used for progression across weeks. */
  id: string;
  name: string;
  role: ExerciseRole;
  focus: Focus;
  sets: number;
  repsMin: number;
  repsMax: number;
  unit: LoadUnit;
  perSide?: boolean;
  rpe: number;
  restSec: number;
  cue: string;
  alt?: string;
  bodyweight?: boolean;
  /** kg to add when top of rep range is hit on all sets */
  increment: number;
}

export type LiftTemplate = 'upperA' | 'lowerA' | 'lowerB' | 'upperB';

export interface LiftSession {
  kind: 'lift';
  id: string;
  template: LiftTemplate;
  title: string;
  subtitle: string;
  exercises: Exercise[];
  description: string;
}

export interface RestSession {
  kind: 'rest';
  id: string;
  title: string;
  description: string;
}

export type Session = RunSession | LiftSession | RestSession;

export type PhaseKey = 'recovery' | 'foundation' | 'build' | 'consolidate' | 'raceprep';

export interface Phase {
  key: PhaseKey;
  name: string;
  weeks: number;
  goal: string;
  running: string;
  lifting: string;
  nutrition: string;
}

export interface PlanDay {
  date: string;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  sessions: Session[];
}

export interface PlanWeek {
  index: number; // 1-based
  phase: Phase;
  phaseWeek: number; // 1-based within phase
  isDeload: boolean;
  /** Week of the hybrid block (1–14), undefined for race-prep weeks. */
  blockWeek?: number;
  days: PlanDay[];
  targetKm: number;
  focus: string;
}

export interface Plan {
  weeks: PlanWeek[];
  paces: Paces;
}

/* ---------- logging ---------- */

export interface SetLog {
  reps: number;
  weightKg: number;
}

export interface RunLog {
  kind: 'run';
  sessionId: string;
  date: string;
  completed: boolean;
  distanceKm?: number;
  durationMin?: number;
  rpe?: number;
  notes?: string;
}

export interface LiftLog {
  kind: 'lift';
  sessionId: string;
  date: string;
  completed: boolean;
  sets: Record<string, SetLog[]>;
  rpe?: number;
  notes?: string;
}

export type SessionLog = RunLog | LiftLog;

export interface WeightEntry {
  date: string;
  kg: number;
}

export interface AppState {
  version: 1;
  profile: Profile | null;
  logs: Record<string, SessionLog>;
  weights: WeightEntry[];
}
