import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { AppState, Plan, Profile, SessionLog, WeightEntry } from './lib/types';
import { load, save } from './lib/storage';
import { buildPlan } from './lib/plan';

type Action =
  | { type: 'setProfile'; profile: Profile }
  | { type: 'upsertLog'; log: SessionLog }
  | { type: 'deleteLog'; sessionId: string }
  | { type: 'addWeight'; entry: WeightEntry }
  | { type: 'deleteWeight'; date: string }
  | { type: 'import'; state: AppState }
  | { type: 'reset' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setProfile':
      return { ...state, profile: action.profile };
    case 'upsertLog':
      return { ...state, logs: { ...state.logs, [action.log.sessionId]: action.log } };
    case 'deleteLog': {
      const logs = { ...state.logs };
      delete logs[action.sessionId];
      return { ...state, logs };
    }
    case 'addWeight': {
      const weights = state.weights.filter((w) => w.date !== action.entry.date);
      weights.push(action.entry);
      weights.sort((a, b) => a.date.localeCompare(b.date));
      return { ...state, weights };
    }
    case 'deleteWeight':
      return { ...state, weights: state.weights.filter((w) => w.date !== action.date) };
    case 'import':
      return action.state;
    case 'reset':
      return { version: 1, profile: null, logs: {}, weights: [] };
  }
}

interface Ctx {
  state: AppState;
  dispatch: (a: Action) => void;
  plan: Plan | null;
}

const StateContext = createContext<Ctx | null>(null);

export function StateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => save(state), [state]);
  const plan = useMemo(() => (state.profile ? buildPlan(state.profile) : null), [state.profile]);
  return <StateContext.Provider value={{ state, dispatch, plan }}>{children}</StateContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useApp outside provider');
  return ctx;
}

/** Latest logged bodyweight, falling back to the profile's start weight. */
export function currentWeight(state: AppState): number {
  if (state.weights.length) return state.weights[state.weights.length - 1].kg;
  return state.profile?.weightKg ?? 0;
}
