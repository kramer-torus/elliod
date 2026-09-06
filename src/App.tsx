import { StateProvider, useApp } from './state';
import { useRoute, useToast, type Route } from './hooks';
import { Icon } from './components/common';
import Today from './components/Today';
import PlanView from './components/PlanView';
import SessionView from './components/SessionView';
import Progress from './components/Progress';
import Guide from './components/Guide';
import Settings, { Onboarding } from './components/Settings';

const TABS: { view: Route['view']; label: string; icon: () => JSX.Element }[] = [
  { view: 'today', label: 'Today', icon: Icon.today },
  { view: 'plan', label: 'Plan', icon: Icon.plan },
  { view: 'progress', label: 'Progress', icon: Icon.progress },
  { view: 'guide', label: 'Guide', icon: Icon.guide },
  { view: 'settings', label: 'Settings', icon: Icon.settings },
];

function Shell() {
  const { state } = useApp();
  const [route, navigate] = useRoute();
  const [toastMsg, toast] = useToast();

  if (!state.profile) return <Onboarding />;

  return (
    <div className="app">
      <div className="screen">
        <div className="topbar">
          <div className="brand">ELLI<span>OD</span></div>
          <small>hybrid block</small>
        </div>
        {route.view === 'today' && <Today navigate={navigate} toast={toast} />}
        {route.view === 'plan' && <PlanView week={route.week} navigate={navigate} />}
        {route.view === 'progress' && <Progress />}
        {route.view === 'guide' && <Guide />}
        {route.view === 'settings' && <Settings toast={toast} />}
      </div>
      {route.view === 'session' && <SessionView id={route.id} navigate={navigate} toast={toast} />}
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.view} className={route.view === t.view ? 'active' : ''} onClick={() => navigate({ view: t.view } as Route)}>
            <t.icon />
            {t.label}
          </button>
        ))}
      </nav>
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}

export default function App() {
  return (
    <StateProvider>
      <Shell />
    </StateProvider>
  );
}
