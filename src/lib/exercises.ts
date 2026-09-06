import type { Exercise, ExerciseRole, Focus, LoadUnit } from './types';

type Def = Omit<Exercise, 'sets' | 'repsMin' | 'repsMax' | 'rpe' | 'restSec'> & {
  base: { sets: number; repsMin: number; repsMax: number; restSec: number };
};

const def = (
  id: string,
  name: string,
  role: ExerciseRole,
  focus: Focus,
  sets: number,
  repsMin: number,
  repsMax: number,
  cue: string,
  opts: Partial<{ unit: LoadUnit; perSide: boolean; alt: string; bodyweight: boolean; increment: number; restSec: number }> = {},
): Def => ({
  id,
  name,
  role,
  focus,
  unit: opts.unit ?? 'reps',
  perSide: opts.perSide,
  cue,
  alt: opts.alt,
  bodyweight: opts.bodyweight,
  increment: opts.increment ?? (role === 'main' ? 2.5 : 1.25),
  base: { sets, repsMin, repsMax, restSec: opts.restSec ?? (role === 'main' ? 150 : role === 'secondary' ? 90 : 60) },
});

/* Monday — Upper A: push emphasis, posture accessories */
export const UPPER_A: Def[] = [
  def('ohp', 'Barbell Overhead Press', 'main', 'shoulders', 4, 5, 8,
    'Glutes and ribs tight, bar travels straight up, push the head through at lockout. No lower-back arch.',
    { alt: 'Seated dumbbell shoulder press' }),
  def('incline_db', 'Incline Dumbbell Press (30°)', 'secondary', 'push', 3, 8, 12,
    'Shoulder blades pinned back and down; elbows ~45° from torso.', { increment: 2 }),
  def('cs_row', 'Chest-Supported Row', 'secondary', 'posture', 3, 10, 12,
    'Drive elbows toward hips, squeeze the blades together, hold one second at the top.',
    { alt: 'Seal row or incline-bench dumbbell row', increment: 2.5 }),
  def('face_pull', 'Face Pull', 'accessory', 'posture', 3, 15, 20,
    'Rope at eye level, pull to the face with elbows high, finish with thumbs pointing back (external rotation).',
    { alt: 'Band face pull' }),
  def('lat_raise', 'Lateral Raise', 'accessory', 'shoulders', 3, 12, 15,
    'Lead with the elbows, slight forward lean, stop at shoulder height. Light and strict.', { increment: 1 }),
  def('scap_pullup', 'Scapular Pull-ups + Dead Hang', 'accessory', 'shoulders', 3, 8, 10,
    'Straight arms; pull shoulder blades down and back to lift the body an inch. Finish each set with a 20s hang.',
    { bodyweight: true, increment: 0 }),
  def('pallof', 'Pallof Press', 'accessory', 'core', 3, 10, 12,
    'Cable at chest height, press out and resist rotation. Ribs down.', { perSide: true, alt: 'Band Pallof press' }),
];

/* Wednesday — Lower A (odd weeks): deadlift-led */
export const LOWER_A: Def[] = [
  def('trapbar_dl', 'Trap-Bar Deadlift', 'main', 'legs', 4, 5, 8,
    'Hips back, chest up, push the floor away. Lockout with glutes, not lower back.',
    { alt: 'Conventional deadlift or kettlebell deadlift', increment: 5 }),
  def('bss', 'Bulgarian Split Squat', 'secondary', 'legs', 3, 8, 10,
    'Long stance, torso slightly forward, front knee tracks over the toes. Runners need this one.',
    { perSide: true, increment: 2 }),
  def('hip_thrust', 'Barbell Hip Thrust', 'accessory', 'run-support', 3, 10, 12,
    'Chin tucked, ribs down, full glute squeeze at the top for one second.', { increment: 5 }),
  def('nordic', 'Nordic Hamstring Curl', 'accessory', 'run-support', 3, 4, 6,
    'Lower as slowly as you can, push back up with hands if needed. Hamstring injury insurance.',
    { bodyweight: true, increment: 0, alt: 'Lying hamstring curl 3×10' }),
  def('calf_raise', 'Single-Leg Calf Raise', 'accessory', 'run-support', 3, 12, 15,
    'Full range on a step, pause at the top, control the descent.', { perSide: true, increment: 2.5 }),
  def('copenhagen', 'Copenhagen Plank', 'accessory', 'core', 3, 20, 30,
    'Top leg on a bench, lift the hips into a straight line. Adductor and hip strength.',
    { unit: 'seconds', perSide: true, bodyweight: true, increment: 0 }),
];

/* Wednesday — Lower B (even weeks): squat-led */
export const LOWER_B: Def[] = [
  def('front_squat', 'Front Squat', 'main', 'legs', 4, 5, 8,
    'Elbows high, upright torso, sit between the heels. Builds posture as much as legs.',
    { alt: 'Goblet squat or back squat' }),
  def('rdl', 'Romanian Deadlift', 'secondary', 'posture', 3, 8, 10,
    'Soft knees, push the hips back until the hamstrings load, bar stays on the thighs.', { increment: 2.5 }),
  def('step_up', 'Weighted Step-Up', 'accessory', 'legs', 3, 8, 10,
    'Knee-height box, drive through the whole foot, no push-off from the trailing leg.',
    { perSide: true, increment: 2 }),
  def('nordic', 'Nordic Hamstring Curl', 'accessory', 'run-support', 3, 4, 6,
    'Lower as slowly as you can, push back up with hands if needed.',
    { bodyweight: true, increment: 0, alt: 'Lying hamstring curl 3×10' }),
  def('calf_raise', 'Single-Leg Calf Raise', 'accessory', 'run-support', 3, 12, 15,
    'Full range on a step, pause at the top, control the descent.', { perSide: true, increment: 2.5 }),
  def('leg_raise', 'Hanging Leg Raise', 'accessory', 'core', 3, 8, 12,
    'Posterior pelvic tilt first, then lift. No swinging.', { bodyweight: true, increment: 0, alt: 'Reverse crunch' }),
];

/* Friday — Upper B: pull emphasis, shoulders and posture */
export const UPPER_B: Def[] = [
  def('chinup', 'Weighted Chin-Up', 'main', 'pull', 4, 5, 8,
    'Start from a dead hang, pull the chest to the bar, control the descent. Add load on a belt when 4×8 bodyweight is easy.',
    { alt: 'Lat pulldown', increment: 2.5 }),
  def('landmine_press', 'Half-Kneeling Landmine Press', 'secondary', 'shoulders', 3, 8, 10,
    'Glute of the kneeling side tight, press up and forward, reach at the top so the shoulder blade wraps around.',
    { perSide: true, alt: 'Arnold press', increment: 2.5 }),
  def('db_row', 'Single-Arm Dumbbell Row', 'secondary', 'pull', 3, 8, 12,
    'Hips square, row to the hip, pause at the top. Heavy but strict.', { perSide: true, increment: 2 }),
  def('rear_delt', 'Rear-Delt Fly', 'accessory', 'posture', 3, 12, 15,
    'Bent over or on a reverse pec-deck; lead with the elbows, pinkies up. Light and slow.',
    { increment: 1 }),
  def('ytw', 'Prone Y-T-W Raises', 'accessory', 'posture', 2, 8, 10,
    'Face down on an incline bench: Y, then T, then W, thumbs up on all three. Reps are per letter.',
    { increment: 0.5 }),
  def('carry', "Farmer's Carry", 'accessory', 'posture', 3, 40, 40,
    'Heavy dumbbells, tall posture, ribs stacked over hips, eyes on the horizon. 40 metres per set.',
    { unit: 'metres', increment: 4 }),
  def('band_pullapart', 'Band Pull-Apart', 'accessory', 'posture', 3, 15, 20,
    'Straight arms, pull the band to the chest, squeeze the blades. Do these daily too.',
    { bodyweight: true, increment: 0 }),
];

export const DAILY_POSTURE = [
  'Thoracic extension over a foam roller — 10 slow reps',
  'Wall slides — 10 reps, ribs down, forearms on the wall',
  'Band pull-aparts — 20 reps',
  'Half-kneeling hip-flexor stretch — 45 s each side',
  'Dead hang — 30 s',
];

export type { Def as ExerciseDef };
