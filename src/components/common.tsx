import type { Session } from '../lib/types';
import { useApp } from '../state';

export const Icon = {
  today: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
  ),
  plan: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
  ),
  progress: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19V5M4 19h16M8 15l4-5 3 3 5-7" /></svg>
  ),
  guide: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 0-3 3z" /><path d="M4 4v16" /></svg>
  ),
  settings: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
  ),
  back: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M15 5l-7 7 7 7" /></svg>
  ),
};

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

export function sessionSummary(s: Session): string {
  if (s.kind === 'run') return `${s.distanceKm} km`;
  if (s.kind === 'lift') return `${s.exercises.length} exercises · ${s.subtitle}`;
  return 'Posture routine';
}

export function SessionCard({ session, onOpen }: { session: Session; onOpen?: () => void }) {
  const { state } = useApp();
  const log = state.logs[session.id];
  const done = !!log?.completed;
  const kindLabel = session.kind === 'run' ? (session.type === 'race' ? 'Race' : session.optional ? 'Optional run' : 'Run') : session.kind === 'lift' ? 'Strength' : 'Rest';
  return (
    <div className={`card ${session.kind} ${done ? 'done' : ''} ${onOpen ? 'clickable' : ''}`} onClick={onOpen}>
      <div className="row between">
        <div>
          <span className={`pill ${session.kind === 'run' && session.optional ? 'optional' : session.kind}`}>{kindLabel}</span>
          <h3 style={{ marginTop: '.35rem' }}>{session.title}</h3>
          <small>{sessionSummary(session)}</small>
        </div>
        {session.kind !== 'rest' && <span className={`check ${done ? 'on' : ''}`}>{done ? '✓' : ''}</span>}
      </div>
    </div>
  );
}
