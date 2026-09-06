import { useMemo, useState } from 'react';
import { useApp } from '../state';
import { findSession } from '../lib/plan';
import { suggest } from '../lib/progression';
import { formatPace, formatPaceRange } from '../lib/vdot';
import { DAILY_POSTURE } from '../lib/exercises';
import type { Exercise, LiftLog, LiftSession, RunLog, RunSession, SetLog } from '../lib/types';
import { Icon, fmtDate, WEEKDAYS } from './common';
import type { Route } from '../hooks';

export default function SessionView({ id, navigate, toast }: { id: string; navigate: (r: Route) => void; toast: (m: string) => void }) {
  const { plan } = useApp();
  const found = plan ? findSession(plan, id) : null;
  const back = () => window.history.length > 1 ? window.history.back() : navigate({ view: 'today' });
  if (!found) {
    return (
      <div className="overlay"><div className="inner">
        <button className="ghost" onClick={back}><Icon.back /> Back</button>
        <p>Session not found.</p>
      </div></div>
    );
  }
  const { session, week, day } = found;
  return (
    <div className="overlay">
      <div className="inner">
        <div className="row between">
          <button className="ghost" onClick={back}><Icon.back /> Back</button>
          <small>{WEEKDAYS[day.weekday]} {fmtDate(day.date)} · week {week.index}</small>
        </div>
        {session.kind === 'run' && <RunForm session={session} date={day.date} onSaved={() => { toast('Saved'); back(); }} />}
        {session.kind === 'lift' && <LiftForm session={session} date={day.date} onSaved={() => { toast('Saved'); back(); }} />}
        {session.kind === 'rest' && (
          <div>
            <span className="pill rest">Rest</span>
            <h1 style={{ marginTop: '.4rem' }}>{session.title}</h1>
            <p>{session.description}</p>
            <div className="card">
              <h4>Daily posture routine (5 min)</h4>
              <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                {DAILY_POSTURE.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- run ---------- */

function RunForm({ session, date, onSaved }: { session: RunSession; date: string; onSaved: () => void }) {
  const { state, dispatch, plan } = useApp();
  const existing = state.logs[session.id];
  const prior = existing?.kind === 'run' ? existing : undefined;
  const [distance, setDistance] = useState(prior?.distanceKm?.toString() ?? '');
  const [duration, setDuration] = useState(prior?.durationMin?.toString() ?? '');
  const [rpe, setRpe] = useState(prior?.rpe?.toString() ?? '');
  const [notes, setNotes] = useState(prior?.notes ?? '');
  const zones = plan!.paces.zones;

  const avgPace = Number(distance) > 0 && Number(duration) > 0 ? (Number(duration) * 60) / Number(distance) : null;

  const save = (completed: boolean) => {
    const log: RunLog = {
      kind: 'run',
      sessionId: session.id,
      date,
      completed,
      distanceKm: distance ? Number(distance) : undefined,
      durationMin: duration ? Number(duration) : undefined,
      rpe: rpe ? Number(rpe) : undefined,
      notes: notes || undefined,
    };
    dispatch({ type: 'upsertLog', log });
    onSaved();
  };

  return (
    <div>
      <span className="pill run">{session.optional ? 'Optional run' : 'Run'}</span>
      <h1 style={{ marginTop: '.4rem' }}>{session.title}</h1>
      <p>{session.description}</p>

      <div className="card">
        <h4>Targets</h4>
        {session.segments.map((seg, i) => (
          <div className="segment" key={i}>
            <div>
              <b>{seg.label}</b>
              <div className="muted" style={{ fontSize: '.85rem' }}>
                {seg.reps ? `${seg.reps} × ` : ''}
                {seg.distanceKm ? `${seg.distanceKm >= 1 ? `${seg.distanceKm} km` : `${Math.round(seg.distanceKm * 1000)} m`}` : ''}
                {seg.minutes ? (seg.minutes < 1 ? `${Math.round(seg.minutes * 60)} s` : `${seg.minutes} min`) : ''}
                {seg.recovery ? ` · ${seg.recovery}` : ''}
              </div>
            </div>
            <div className="pace">{formatPaceRange(zones[seg.zone])}</div>
          </div>
        ))}
      </div>

      <div className="card stack">
        <h4>Log</h4>
        <div className="grid2">
          <div>
            <label>Distance (km)</label>
            <input type="number" inputMode="decimal" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder={session.distanceKm.toString()} />
          </div>
          <div>
            <label>Time (minutes)</label>
            <input type="number" inputMode="decimal" step="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </div>
        <div className="grid2">
          <div>
            <label>RPE (1–10)</label>
            <input type="number" inputMode="numeric" min={1} max={10} value={rpe} onChange={(e) => setRpe(e.target.value)} />
          </div>
          <div>
            <label>Average pace</label>
            <div className="stat"><div className="v mono">{avgPace ? `${formatPace(avgPace)} /km` : '–'}</div></div>
          </div>
        </div>
        <div>
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel? Niggles?" />
        </div>
      </div>

      <div className="sticky-actions">
        {existing && <button className="danger" onClick={() => { dispatch({ type: 'deleteLog', sessionId: session.id }); onSaved(); }}>Clear</button>}
        <button onClick={() => save(false)}>Save draft</button>
        <button className="primary" onClick={() => save(true)}>Mark done</button>
      </div>
    </div>
  );
}

/* ---------- lift ---------- */

type SetInput = { reps: string; weightKg: string };

function LiftForm({ session, date, onSaved }: { session: LiftSession; date: string; onSaved: () => void }) {
  const { state, dispatch } = useApp();
  const existing = state.logs[session.id];
  const prior = existing?.kind === 'lift' ? existing : undefined;

  const suggestions = useMemo(
    () => Object.fromEntries(session.exercises.map((ex) => [ex.id, suggest(state, ex)])),
    // Recompute only when the session changes; live edits should not shift the suggestion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.id],
  );

  const initial = (): Record<string, SetInput[]> =>
    Object.fromEntries(
      session.exercises.map((ex) => {
        const priorSets = prior?.sets[ex.id];
        const sug = suggestions[ex.id].weightKg;
        return [
          ex.id,
          Array.from({ length: ex.sets }, (_, i) => ({
            reps: priorSets?.[i]?.reps?.toString() ?? '',
            weightKg: priorSets?.[i]?.weightKg?.toString() ?? (sug !== null ? sug.toString() : ''),
          })),
        ];
      }),
    );

  const [sets, setSets] = useState<Record<string, SetInput[]>>(initial);
  const [rpe, setRpe] = useState(prior?.rpe?.toString() ?? '');
  const [notes, setNotes] = useState(prior?.notes ?? '');

  const update = (exId: string, i: number, field: keyof SetInput, value: string) => {
    setSets((prev) => {
      const arr = prev[exId].map((s, j) => (j === i ? { ...s, [field]: value } : s));
      // Fill empty later sets with the same weight for convenience.
      if (field === 'weightKg' && i === 0) {
        for (let j = 1; j < arr.length; j++) if (arr[j].weightKg === '' || arr[j].weightKg === prev[exId][0].weightKg) arr[j] = { ...arr[j], weightKg: value };
      }
      return { ...prev, [exId]: arr };
    });
  };

  const fillReps = (ex: Exercise) => {
    setSets((prev) => ({ ...prev, [ex.id]: prev[ex.id].map((s) => ({ ...s, reps: s.reps || ex.repsMax.toString() })) }));
  };

  const save = (completed: boolean) => {
    const out: Record<string, SetLog[]> = {};
    for (const ex of session.exercises) {
      const logged = sets[ex.id]
        .filter((s) => s.reps !== '')
        .map((s) => ({ reps: Number(s.reps), weightKg: s.weightKg === '' ? 0 : Number(s.weightKg) }));
      if (logged.length) out[ex.id] = logged;
    }
    const log: LiftLog = {
      kind: 'lift',
      sessionId: session.id,
      date,
      completed,
      sets: out,
      rpe: rpe ? Number(rpe) : undefined,
      notes: notes || undefined,
    };
    dispatch({ type: 'upsertLog', log });
    onSaved();
  };

  const unitLabel = (ex: Exercise) => (ex.unit === 'seconds' ? 's' : ex.unit === 'metres' ? 'm' : 'reps');

  return (
    <div>
      <span className="pill lift">Strength</span>
      <h1 style={{ marginTop: '.4rem' }}>{session.title} <span className="muted" style={{ fontWeight: 400, fontSize: '1rem' }}>{session.subtitle}</span></h1>
      <p>{session.description}</p>

      <div className="card">
        {session.exercises.map((ex) => {
          const sug = suggestions[ex.id];
          return (
            <div className="exercise" key={ex.id}>
              <div className="row between">
                <div>
                  <b>{ex.name}</b>
                  <div className="target">
                    {ex.sets} × {ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`} {unitLabel(ex)}{ex.perSide ? ' / side' : ''} · RPE {ex.rpe} · rest {ex.restSec}s
                  </div>
                </div>
                <span className={`pill ${ex.focus === 'shoulders' || ex.focus === 'posture' ? 'phase' : 'rest'}`}>{ex.focus}</span>
              </div>
              <div className="cue">{ex.cue}{ex.alt ? ` Alt: ${ex.alt}.` : ''}</div>
              <div className="suggest">
                {sug.weightKg !== null ? `Suggested: ${sug.weightKg} kg. ` : ''}{sug.reason}
                {sug.lastSets && ` Last: ${sug.lastSets.map((s) => `${s.reps}×${s.weightKg}`).join(', ')}.`}
              </div>
              <div className="sets">
                <div className="h">Set</div>
                <div className="h row between">{unitLabel(ex)} <button className="small ghost" onClick={() => fillReps(ex)}>fill {ex.repsMax}</button></div>
                <div className="h">{ex.bodyweight ? 'added kg' : 'kg'}</div>
                {sets[ex.id].map((s, i) => (
                  <SetRow key={i} index={i} set={s} onChange={(f, v) => update(ex.id, i, f, v)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card stack">
        <div className="grid2">
          <div>
            <label>Session RPE (1–10)</label>
            <input type="number" inputMode="numeric" min={1} max={10} value={rpe} onChange={(e) => setRpe(e.target.value)} />
          </div>
        </div>
        <div>
          <label>Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shoulder felt…" />
        </div>
      </div>

      <div className="sticky-actions">
        {existing && <button className="danger" onClick={() => { dispatch({ type: 'deleteLog', sessionId: session.id }); onSaved(); }}>Clear</button>}
        <button onClick={() => save(false)}>Save draft</button>
        <button className="primary" onClick={() => save(true)}>Mark done</button>
      </div>
    </div>
  );
}

function SetRow({ index, set, onChange }: { index: number; set: SetInput; onChange: (f: keyof SetInput, v: string) => void }) {
  return (
    <>
      <div className="muted">{index + 1}</div>
      <input type="number" inputMode="numeric" value={set.reps} onChange={(e) => onChange('reps', e.target.value)} />
      <input type="number" inputMode="decimal" step="0.5" value={set.weightKg} onChange={(e) => onChange('weightKg', e.target.value)} />
    </>
  );
}

