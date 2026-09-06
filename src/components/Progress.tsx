import { useMemo, useState } from 'react';
import { useApp } from '../state';
import { toISODate, weekForDate } from '../lib/plan';
import { adherence, estimated1RM, historyFor, movingAverage, weeklyKmActual, weeklyTrend } from '../lib/progression';
import { formatDuration, formatPaceRange } from '../lib/vdot';
import { UPPER_A, LOWER_A, LOWER_B, UPPER_B } from '../lib/exercises';
import { LineChart, BarChart } from './charts';
import { fmtDate } from './common';

const dayIndex = (iso: string) => Math.round(new Date(iso).getTime() / 86400000);

export default function Progress() {
  const { state, dispatch, plan } = useApp();
  const profile = state.profile!;
  const today = toISODate(new Date());

  const ma = movingAverage(state.weights);
  const trend = weeklyTrend(state.weights);
  const x0 = ma.length ? dayIndex(ma[0].date) : 0;
  const weightSeries = useMemo(
    () => [
      { points: ma.map((e) => ({ x: dayIndex(e.date) - x0, y: e.kg })), color: '#8b9bb8', width: 1, dots: true, dashed: true },
      { points: ma.map((e) => ({ x: dayIndex(e.date) - x0, y: e.avg })), color: '#f97316', width: 2.5 },
    ],
    [ma, x0],
  );

  const km = plan ? weeklyKmActual(state, plan) : [];
  const currentWeek = plan ? weekForDate(plan, today)?.index : undefined;
  const adh = plan ? adherence(state, plan, today) : { done: 0, planned: 0 };

  const allDefs = [...UPPER_A, ...LOWER_A, ...LOWER_B, ...UPPER_B];
  const exerciseOptions = allDefs.filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i && !(d.bodyweight && d.increment === 0));
  const [exId, setExId] = useState(exerciseOptions[0].id);
  const hist = historyFor(state, exId);
  const hx0 = hist.length ? dayIndex(hist[0].date) : 0;
  const liftSeries = [
    { points: hist.map((h) => ({ x: dayIndex(h.date) - hx0, y: Math.max(...h.sets.map((s) => s.weightKg)) })), color: '#a78bfa', width: 2, dots: true },
    { points: hist.map((h) => ({ x: dayIndex(h.date) - hx0, y: Math.round(estimated1RM(h.sets) * 10) / 10 })), color: '#8b9bb8', width: 1, dashed: true },
  ];

  const lost = state.weights.length ? profile.weightKg - state.weights[state.weights.length - 1].kg : 0;
  const paces = plan?.paces;

  return (
    <div>
      <h1>Progress</h1>

      <div className="grid3" style={{ marginBottom: '.8rem' }}>
        <div className="stat"><div className="v">{lost >= 0 ? '−' : '+'}{Math.abs(lost).toFixed(1)}</div><div className="l">kg since start</div></div>
        <div className="stat"><div className="v">{trend === null ? '–' : trend.toFixed(2)}</div><div className="l">kg/week trend</div></div>
        <div className="stat"><div className="v">{adh.planned ? Math.round((100 * adh.done) / adh.planned) : 0}%</div><div className="l">adherence</div></div>
      </div>

      <div className="card">
        <div className="row between"><h3>Bodyweight</h3><small>dots = daily · line = 7-day average</small></div>
        <LineChart
          series={weightSeries}
          yRef={{ y: profile.targetWeightKg, label: `target ${profile.targetWeightKg} kg` }}
          xLabels={ma.length ? [{ x: 0, label: fmtDate(ma[0].date) }, { x: dayIndex(ma[ma.length - 1].date) - x0, label: fmtDate(ma[ma.length - 1].date) }] : []}
        />
        {state.weights.length > 0 && (
          <details>
            <summary className="muted" style={{ cursor: 'pointer', fontSize: '.85rem' }}>Entries ({state.weights.length})</summary>
            <table className="table" style={{ marginTop: '.4rem' }}>
              <tbody>
                {[...state.weights].reverse().slice(0, 30).map((w) => (
                  <tr key={w.date}>
                    <td>{fmtDate(w.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td className="num">{w.kg.toFixed(1)} kg</td>
                    <td className="num"><button className="small ghost" onClick={() => dispatch({ type: 'deleteWeight', date: w.date })}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>

      <div className="card">
        <div className="row between"><h3>Weekly running</h3><small>faint = planned · solid = logged</small></div>
        <BarChart
          bars={km.map((k) => ({ label: `${k.week}`, values: [k.planned, k.actual], highlight: k.week === currentWeek }))}
          colors={['#38bdf8', '#38bdf8']}
        />
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: '.5rem' }}>
          <h3>Lifts</h3>
          <select value={exId} onChange={(e) => setExId(e.target.value)} style={{ width: 'auto' }}>
            {exerciseOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <small>solid = top set weight · dashed = estimated 1RM</small>
        <LineChart series={liftSeries} xLabels={hist.length ? [{ x: 0, label: fmtDate(hist[0].date) }, { x: dayIndex(hist[hist.length - 1].date) - hx0, label: fmtDate(hist[hist.length - 1].date) }] : []} />
        {hist.length > 0 && (
          <table className="table">
            <thead><tr><th>Date</th><th>Sets</th><th className="num">e1RM</th></tr></thead>
            <tbody>
              {[...hist].reverse().slice(0, 8).map((h) => (
                <tr key={h.date}>
                  <td>{fmtDate(h.date)}</td>
                  <td>{h.sets.map((s) => `${s.reps}×${s.weightKg}`).join(', ')}</td>
                  <td className="num">{estimated1RM(h.sets).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {paces && (
        <div className="card">
          <h3>Running benchmarks</h3>
          <small>From your {formatDuration(profile.marathonSeconds)} marathon (VDOT {paces.vdot.toFixed(1)}). Update the marathon time in Settings after the week-14 time trial to recalibrate paces.</small>
          <table className="table" style={{ marginTop: '.5rem' }}>
            <thead><tr><th>Zone</th><th className="num">Pace</th></tr></thead>
            <tbody>
              {(['recovery', 'easy', 'marathon', 'threshold', 'interval', 'repetition'] as const).map((z) => (
                <tr key={z}><td style={{ textTransform: 'capitalize' }}>{z}</td><td className="num">{formatPaceRange(paces.zones[z])}</td></tr>
              ))}
            </tbody>
          </table>
          <table className="table" style={{ marginTop: '.5rem' }}>
            <thead><tr><th>Predicted</th><th className="num">Time</th></tr></thead>
            <tbody>
              <tr><td>5 km</td><td className="num">{formatDuration(paces.predictions['5k'])}</td></tr>
              <tr><td>10 km</td><td className="num">{formatDuration(paces.predictions['10k'])}</td></tr>
              <tr><td>Half</td><td className="num">{formatDuration(paces.predictions.half)}</td></tr>
              <tr><td>Marathon</td><td className="num">{formatDuration(paces.predictions.marathon)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
