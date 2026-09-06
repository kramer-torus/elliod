import type { AppState, Profile } from './types';
import { nextMonday, toISODate } from './plan';

const KEY = 'elliod.v1';

export const DEFAULT_PROFILE: Profile = {
  heightCm: 185,
  weightKg: 80,
  age: 36,
  sex: 'male',
  marathonSeconds: 3 * 3600 + 23 * 60,
  startDate: nextMonday(toISODate(new Date())),
  targetWeightKg: 75,
  dailyDeficitKcal: 400,
  optionalRun: false,
};

export const EMPTY_STATE: AppState = { version: 1, profile: null, logs: {}, weights: [] };

export function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return migrate(parsed);
  } catch {
    return EMPTY_STATE;
  }
}

export function save(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage may be unavailable (private mode); the app still works in memory */
  }
}

export function migrate(parsed: Partial<AppState>): AppState {
  return {
    version: 1,
    profile: parsed.profile ? { ...DEFAULT_PROFILE, ...parsed.profile } : null,
    logs: parsed.logs ?? {},
    weights: Array.isArray(parsed.weights) ? parsed.weights : [],
  };
}

export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text: string): AppState {
  const parsed = JSON.parse(text) as Partial<AppState>;
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Not an Elliod export');
  return migrate(parsed);
}
