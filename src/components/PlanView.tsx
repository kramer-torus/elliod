import { useState } from 'react';
import { useApp } from '../state';
import { toISODate, weekForDate } from '../lib/plan';
import { SessionCard, fmtDate, WEEKDAYS } from './common';
import type { Route } from '../hooks';

export default function PlanView({ week: routeWeek, navigate }: { week?: number; navigate: (r: Route) => void }) {
  const { plan } = useApp();
  const today = toISODate(new Date());
  const currentWeek = plan ? weekForDate(plan, today)?.index : undefined;
  const [selected, setSelected] = useState<number>(routeWeek ?? currentWeek ?? 1);
  if (!plan) return null;
  const week = plan.weeks[Math.min(Math.max(selected, 1), plan.weeks.length) - 1];

  return (
    <div>
      <h1>Plan</h1>
      <div className="weektabs">
        {plan.weeks.map((w) => (
          <button
            key={w.index}
            className={`${w.index === week.index ? 'active' : ''} ${w.isDeload ? 'deload' : ''} ${w.index === currentWeek ? 'current' : ''}`}
            onClick={() => setSelected(w.index)}
          >
            W{w.index}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="row between wrap">
          <div className="row wrap" style={{ gap: '.4rem' }}>
            <span className="pill phase">{week.phase.name} · {week.phaseWeek}/{week.phase.weeks}</span>
            {week.isDeload && <span className="pill deload">Deload</span>}
          </div>
          <b className="mono">{week.targetKm} km planned</b>
        </div>
        <p style={{ marginTop: '.5rem' }}>{week.focus}</p>
        <small>{fmtDate(week.days[0].date)} – {fmtDate(week.days[6].date)}</small>
      </div>

      {week.days.map((d) => (
        <div key={d.date} className={`day ${d.date === today ? 'today' : ''}`}>
          <div className="dn">
            <b>{WEEKDAYS[d.weekday]}</b>
            <small>{fmtDate(d.date, { day: 'numeric' })}</small>
          </div>
          <div>
            {d.sessions.map((s) => (
              <SessionCard key={s.id} session={s} onOpen={() => navigate({ view: 'session', id: s.id })} />
            ))}
          </div>
        </div>
      ))}

      <div className="card">
        <h4>{week.phase.name} phase</h4>
        <p>{week.phase.goal}</p>
        <p><b>Running.</b> {week.phase.running}</p>
        <p><b>Lifting.</b> {week.phase.lifting}</p>
        <p style={{ marginBottom: 0 }}><b>Nutrition.</b> {week.phase.nutrition}</p>
      </div>
    </div>
  );
}
