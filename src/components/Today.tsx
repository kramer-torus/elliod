import { useState } from 'react';
import { useApp, currentWeight } from '../state';
import { toISODate, weekForDate } from '../lib/plan';
import { targetsFor, calorieAdjustment } from '../lib/nutrition';
import { weeklyTrend, adherence } from '../lib/progression';
import { SessionCard, fmtDate, WEEKDAYS } from './common';
import { parseISODate } from '../lib/plan';
import type { Route } from '../hooks';

export default function Today({ navigate, toast }: { navigate: (r: Route) => void; toast: (m: string) => void }) {
  const { state, dispatch, plan } = useApp();
  const profile = state.profile!;
  const today = toISODate(new Date());
  const week = plan ? weekForDate(plan, today) : null;
  const day = week?.days.find((d) => d.date === today);
  const [kg, setKg] = useState('');

  const weight = currentWeight(state);
  const trend = weeklyTrend(state.weights);
  const adj = calorieAdjustment(trend, profile.dailyDeficitKcal);
  const targets = week
    ? targetsFor(profile, weight, week.phase.key, week.isDeload, week.targetKm, 3)
    : null;
  const adh = plan ? adherence(state, plan, today) : { done: 0, planned: 0 };
  const todayWeight = state.weights.find((w) => w.date === today);
  const race = profile.race;
  const daysToRace = race ? Math.round((parseISODate(race.date).getTime() - parseISODate(today).getTime()) / 86400000) : null;

  const logWeight = () => {
    const v = Number(kg);
    if (!v || v < 30 || v > 250) return;
    dispatch({ type: 'addWeight', entry: { date: today, kg: Math.round(v * 10) / 10 } });
    setKg('');
    toast('Weight logged');
  };

  const nextUp = (() => {
    if (!plan) return null;
    for (const w of plan.weeks) for (const d of w.days) if (d.date > today) return { w, d };
    return null;
  })();

  return (
    <div>
      <div className="row between" style={{ marginBottom: '.6rem' }}>
        <div>
          <h1>{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
          {week ? (
            <div className="row wrap" style={{ gap: '.4rem' }}>
              <span className="pill phase">{week.phase.name} · {week.blockWeek ? `block week ${week.blockWeek}/14` : `week ${week.phaseWeek}/${week.phase.weeks}`}</span>
              {week.isDeload && week.phase.key !== 'raceprep' && <span className="pill deload">Deload</span>}
              {daysToRace !== null && daysToRace >= 0 && daysToRace <= 28 && (
                <span className="pill run">{daysToRace === 0 ? 'Race day' : `${race!.name} in ${daysToRace} day${daysToRace === 1 ? '' : 's'}`}</span>
              )}
            </div>
          ) : (
            <small>Outside the plan window.</small>
          )}
        </div>
      </div>

      {week && <p className="muted" style={{ marginBottom: '.9rem' }}>{week.focus}</p>}

      {!week && plan && (
        <div className="card">
          <h3>{today < plan.weeks[0].days[0].date ? 'Plan starts' : 'Plan finished'} {fmtDate(plan.weeks[0].days[0].date)}</h3>
          <p className="muted">
            {today < plan.weeks[0].days[0].date
              ? 'Until then: easy running only and eat at maintenance. Change the start date in Settings if needed.'
              : 'Fourteen weeks done. Reassess in Progress, take two weeks at maintenance, then set a new start date in Settings to run another block.'}
          </p>
          <button onClick={() => navigate({ view: 'settings' })}>Open settings</button>
        </div>
      )}

      {day?.sessions.map((s) => (
        <SessionCard key={s.id} session={s} onOpen={() => navigate({ view: 'session', id: s.id })} />
      ))}

      <div className="card">
        <div className="row between">
          <h3>Morning weight</h3>
          <small>{todayWeight ? `${todayWeight.kg} kg logged` : 'Not logged today'}</small>
        </div>
        <div className="row" style={{ marginTop: '.4rem' }}>
          <input type="number" inputMode="decimal" step="0.1" placeholder={`${weight.toFixed(1)} kg`} value={kg} onChange={(e) => setKg(e.target.value)} />
          <button className="primary" onClick={logWeight}>Log</button>
        </div>
        <div className="grid3" style={{ marginTop: '.6rem' }}>
          <div className="stat"><div className="v">{weight.toFixed(1)}</div><div className="l">kg now</div></div>
          <div className="stat"><div className="v">{trend === null ? '–' : `${trend > 0 ? '+' : ''}${trend.toFixed(2)}`}</div><div className="l">kg / week</div></div>
          <div className="stat"><div className="v">{profile.targetWeightKg}</div><div className="l">kg target</div></div>
        </div>
        <p className="muted" style={{ fontSize: '.85rem', marginTop: '.5rem', marginBottom: 0 }}>{adj.message}</p>
      </div>

      {targets && (
        <div className="card">
          <div className="row between">
            <h3>Fuel today</h3>
            <small>{week!.phase.name}{week!.isDeload ? ' · deload' : ''}</small>
          </div>
          <div className="grid3" style={{ marginTop: '.4rem' }}>
            <div className="stat"><div className="v">{targets.target + adj.adjust}</div><div className="l">kcal</div></div>
            <div className="stat"><div className="v">{targets.proteinG}g</div><div className="l">protein</div></div>
            <div className="stat"><div className="v">{targets.carbsG + Math.round(adj.adjust / 4)}g</div><div className="l">carbs</div></div>
          </div>
          <p className="muted" style={{ fontSize: '.85rem', marginTop: '.5rem', marginBottom: 0 }}>
            {targets.note} Maintenance ≈ {targets.maintenance} kcal.
            {day?.sessions.some((s) => s.kind === 'run' && (s.type === 'long' || s.type === 'long_mp')) && ` Long-run day: add ~${targets.longRunCarbBoostG} g carbs and skip the deficit.`}
          </p>
        </div>
      )}

      <div className="card">
        <div className="row between">
          <h3>Adherence</h3>
          <span className={`pill ${adh.planned && adh.done / adh.planned >= 0.85 ? 'good' : 'rest'}`}>
            {adh.planned ? Math.round((100 * adh.done) / adh.planned) : 0}%
          </span>
        </div>
        <small>{adh.done} of {adh.planned} planned sessions logged to date.</small>
        {nextUp && (
          <p className="muted" style={{ marginTop: '.5rem', marginBottom: 0 }}>
            Next: {WEEKDAYS[nextUp.d.weekday]} {fmtDate(nextUp.d.date)} — {nextUp.d.sessions.map((s) => s.title).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
