import type { PhaseKey, Profile } from './types';

export interface NutritionTargets {
  bmr: number;
  maintenance: number;
  target: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** extra carbs (g) recommended on long-run day */
  longRunCarbBoostG: number;
  note: string;
}

/** Mifflin–St Jeor resting energy. */
export function bmr(p: Pick<Profile, 'weightKg' | 'heightCm' | 'age' | 'sex'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'male' ? base + 5 : base - 161;
}

/**
 * Maintenance calories. Non-exercise activity multiplier of 1.35 (desk job,
 * normal daily movement) plus the training load itself, averaged over the week:
 * running ≈ 1 kcal per kg per km; a lifting session ≈ 250 kcal.
 */
export function maintenance(
  p: Pick<Profile, 'weightKg' | 'heightCm' | 'age' | 'sex'>,
  weeklyKm: number,
  liftsPerWeek: number,
): number {
  const training = weeklyKm * p.weightKg * 1.0 + liftsPerWeek * 250;
  return bmr(p) * 1.35 + training / 7;
}

export function targetsFor(
  p: Profile,
  currentWeightKg: number,
  phase: PhaseKey,
  isDeload: boolean,
  weeklyKm: number,
  liftsPerWeek: number,
): NutritionTargets {
  const person = { ...p, weightKg: currentWeightKg };
  const b = bmr(person);
  const m = maintenance(person, weeklyKm, liftsPerWeek);

  let deficit = p.dailyDeficitKcal;
  let note = 'Cutting phase: modest deficit, high protein. Keep the deficit off the long-run day.';
  if (phase === 'recovery') {
    deficit = 0;
    note = 'Post-marathon recovery: eat at maintenance. Repair first, cut later.';
  } else if (phase === 'raceprep') {
    deficit = 0;
    note = 'Race prep: no deficit. Eat at maintenance; carb-load Thursday to Saturday of race week (8–10 g carbs per kg).';
  } else if (isDeload) {
    deficit = Math.min(deficit, 200);
    note = 'Deload week: ease the deficit so you actually recover.';
  }

  const target = Math.round(m - deficit);
  // Protein 2.0 g/kg protects muscle in a deficit and supports recovery from running.
  const proteinG = Math.round(currentWeightKg * 2.0);
  const fatG = Math.round(currentWeightKg * 0.8);
  const carbsG = Math.max(0, Math.round((target - proteinG * 4 - fatG * 9) / 4));

  return {
    bmr: Math.round(b),
    maintenance: Math.round(m),
    target,
    proteinG,
    fatG,
    carbsG,
    longRunCarbBoostG: 60,
    note,
  };
}

/**
 * Compare the measured weekly weight trend to the expected rate of loss.
 * Returns a suggested calorie adjustment (kcal/day), positive = eat more.
 * Expected ≈ 7700 kcal per kg of fat.
 */
export function calorieAdjustment(
  measuredKgPerWeek: number | null,
  dailyDeficitKcal: number,
): { adjust: number; message: string } {
  if (measuredKgPerWeek === null) {
    return { adjust: 0, message: 'Log bodyweight most mornings for two weeks before adjusting intake.' };
  }
  const expected = -(dailyDeficitKcal * 7) / 7700;
  const diff = measuredKgPerWeek - expected; // positive = losing slower than expected
  if (Math.abs(diff) < 0.15) return { adjust: 0, message: 'On track. Hold intake steady.' };
  if (measuredKgPerWeek < -0.75) {
    return { adjust: 200, message: 'Losing faster than 0.75 kg/week risks strength and running quality. Add ~200 kcal/day.' };
  }
  if (diff > 0) return { adjust: -150, message: 'Losing slower than planned. Trim ~150 kcal/day (carbs on rest days first).' };
  return { adjust: 100, message: 'Losing a little faster than planned. Add ~100 kcal/day.' };
}
