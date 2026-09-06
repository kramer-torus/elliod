import { useEffect, useState } from 'react';

export type Route =
  | { view: 'today' }
  | { view: 'plan'; week?: number }
  | { view: 'progress' }
  | { view: 'guide' }
  | { view: 'settings' }
  | { view: 'session'; id: string };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  switch (parts[0]) {
    case 'plan':
      return { view: 'plan', week: parts[1] ? Number(parts[1]) : undefined };
    case 'progress':
      return { view: 'progress' };
    case 'guide':
      return { view: 'guide' };
    case 'settings':
      return { view: 'settings' };
    case 'session':
      return parts[1] ? { view: 'session', id: parts[1] } : { view: 'today' };
    default:
      return { view: 'today' };
  }
}

export function toHash(r: Route): string {
  switch (r.view) {
    case 'plan':
      return r.week ? `#/plan/${r.week}` : '#/plan';
    case 'session':
      return `#/session/${r.id}`;
    default:
      return `#/${r.view}`;
  }
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = (r: Route) => {
    window.location.hash = toHash(r);
  };
  return [route, navigate];
}

export function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 1800);
    return () => clearTimeout(t);
  }, [msg]);
  return [msg, setMsg];
}
