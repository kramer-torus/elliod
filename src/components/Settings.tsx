import { useRef, useState } from 'react';
import { useApp } from '../state';
import { DEFAULT_PROFILE, exportJSON, importJSON } from '../lib/storage';
import { mondayOf, TOTAL_WEEKS } from '../lib/plan';
import { computePaces, formatDuration, formatPaceRange, parseTime } from '../lib/vdot';
import type { Profile } from '../lib/types';

export function ProfileForm({
  initial,
  onSave,
  submitLabel,
}: {
  initial: Profile;
  onSave: (p: Profile) => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState({
    heightCm: initial.heightCm.toString(),
    weightKg: initial.weightKg.toString(),
    age: initial.age.toString(),
    sex: initial.sex,
    marathon: formatDuration(initial.marathonSeconds),
    startDate: initial.startDate,
    targetWeightKg: initial.targetWeightKg.toString(),
    dailyDeficitKcal: initial.dailyDeficitKcal.toString(),
    optionalRun: initial.optionalRun,
  });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const marathonSeconds = parseTime(form.marathon);
  const paces = marathonSeconds ? computePaces(marathonSeconds) : null;
  const snapped = form.startDate ? mondayOf(form.startDate) : '';
  const valid = marathonSeconds !== null && Number(form.heightCm) > 100 && Number(form.weightKg) > 30 && Number(form.age) > 10 && !!form.startDate;

  const submit = () => {
    if (!valid || marathonSeconds === null) return;
    onSave({
      heightCm: Number(form.heightCm),
      weightKg: Number(form.weightKg),
      age: Number(form.age),
      sex: form.sex,
      marathonSeconds,
      startDate: snapped,
      targetWeightKg: Number(form.targetWeightKg) || Number(form.weightKg),
      dailyDeficitKcal: Math.max(0, Math.min(800, Number(form.dailyDeficitKcal) || 0)),
      optionalRun: form.optionalRun,
    });
  };

  return (
    <div className="stack">
      <div className="grid3">
        <div><label>Height (cm)</label><input type="number" inputMode="numeric" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} /></div>
        <div><label>Weight (kg)</label><input type="number" inputMode="decimal" step="0.1" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} /></div>
        <div><label>Age</label><input type="number" inputMode="numeric" value={form.age} onChange={(e) => set('age', e.target.value)} /></div>
      </div>
      <div className="grid2">
        <div>
          <label>Sex (for calorie estimate)</label>
          <select value={form.sex} onChange={(e) => set('sex', e.target.value as Profile['sex'])}>
            <option value="male">Male</option><option value="female">Female</option>
          </select>
        </div>
        <div><label>Recent marathon (h:mm:ss)</label><input value={form.marathon} onChange={(e) => set('marathon', e.target.value)} placeholder="3:23:00" /></div>
      </div>
      <div className="grid2">
        <div>
          <label>Plan start (snaps to Monday)</label>
          <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          {snapped && snapped !== form.startDate && <small>→ {snapped}</small>}
        </div>
        <div><label>Target weight (kg)</label><input type="number" inputMode="decimal" step="0.5" value={form.targetWeightKg} onChange={(e) => set('targetWeightKg', e.target.value)} /></div>
      </div>
      <div className="grid2">
        <div><label>Daily deficit (kcal, cutting phases)</label><input type="number" inputMode="numeric" step="50" value={form.dailyDeficitKcal} onChange={(e) => set('dailyDeficitKcal', e.target.value)} /></div>
        <div>
          <label>Sunday recovery run</label>
          <div className="row" style={{ paddingTop: '.5rem' }}>
            <input type="checkbox" checked={form.optionalRun} onChange={(e) => set('optionalRun', e.target.checked)} />
            <span>Add optional 4–6 km</span>
          </div>
        </div>
      </div>

      {paces && (
        <div className="card" style={{ marginBottom: 0 }}>
          <h4>Paces from this time (VDOT {paces.vdot.toFixed(1)})</h4>
          <div className="grid2">
            <small>Easy {formatPaceRange(paces.zones.easy)}</small>
            <small>Marathon {formatPaceRange(paces.zones.marathon)}</small>
            <small>Threshold {formatPaceRange(paces.zones.threshold)}</small>
            <small>Interval {formatPaceRange(paces.zones.interval)}</small>
          </div>
        </div>
      )}
      {!paces && form.marathon && <small style={{ color: 'var(--bad)' }}>Enter the marathon time as h:mm:ss.</small>}

      <button className="primary" disabled={!valid} onClick={submit}>{submitLabel}</button>
    </div>
  );
}

export function Onboarding() {
  const { dispatch } = useApp();
  return (
    <div className="screen" style={{ paddingBottom: '2rem' }}>
      <div className="topbar"><div className="brand">ELLI<span>OD</span></div></div>
      <h1>Run strong. Lift heavy. Get lean.</h1>
      <p className="muted">
        A {TOTAL_WEEKS}-week hybrid block built for a marathoner who wants to keep the engine, add strength (shoulders and posture first) and drop fat.
        Everything stays on this device. Check your numbers and press start.
      </p>
      <ProfileForm initial={DEFAULT_PROFILE} onSave={(p) => dispatch({ type: 'setProfile', profile: p })} submitLabel="Start the block" />
    </div>
  );
}

export default function Settings({ toast }: { toast: (m: string) => void }) {
  const { state, dispatch } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const doExport = () => {
    const blob = new Blob([exportJSON(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elliod-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      dispatch({ type: 'import', state: importJSON(text) });
      toast('Imported');
    } catch {
      toast('Import failed');
    }
  };

  return (
    <div>
      <h1>Settings</h1>
      <div className="card">
        <h3>Profile</h3>
        <p className="muted" style={{ fontSize: '.85rem' }}>Changing the start date regenerates the calendar. Logs are keyed by week and day, so they move with it.</p>
        <ProfileForm initial={state.profile!} onSave={(p) => { dispatch({ type: 'setProfile', profile: p }); toast('Saved'); }} submitLabel="Save profile" />
      </div>

      <div className="card stack">
        <h3>Data</h3>
        <small>{Object.keys(state.logs).length} session logs · {state.weights.length} weigh-ins. Stored only in this browser — export a backup now and then.</small>
        <div className="row">
          <button onClick={doExport}>Export JSON</button>
          <button onClick={() => fileRef.current?.click()}>Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </div>
        {!confirmReset ? (
          <button className="danger" onClick={() => setConfirmReset(true)}>Reset everything</button>
        ) : (
          <div className="row">
            <button className="danger" onClick={() => { dispatch({ type: 'reset' }); setConfirmReset(false); }}>Yes, delete all data</button>
            <button onClick={() => setConfirmReset(false)}>Cancel</button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Install</h3>
        <small>iPhone: Share → Add to Home Screen. Android: menu → Install app. It works offline afterwards.</small>
      </div>
    </div>
  );
}
