import { useEffect, useState } from 'react';
import ThemeToggle from './components/ThemeToggle';
import Overview from './pages/Overview';
import Ranges from './pages/Ranges';
import Hands from './pages/Hands';
import Notebook from './pages/Notebook';
import Coach from './pages/Coach';
import Analysis from './pages/Analysis';
import Arena from './pages/Arena';
import { initialSession, readStored, writeStored } from './model';

const pages = { overview: ['Overview', '◫'], analysis: ['Session Analysis', '⌁'], ranges: ['Range Explorer', '▦'], arena: ['AI Arena', '♠'], hands: ['Hand Library', '♧'], notebook: ['Study Notebook', '▤'], coach: ['AI Coach', '✦'] };

function currentPage() {
  const name = location.hash.slice(1);
  return Object.hasOwn(pages, name) ? name : 'overview';
}

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [session] = useState(initialSession);
  const [analysis, setAnalysis] = useState(null);
  const [tasks, setTasks] = useState(() => {
    const stored = readStored('river.tasks', {});
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  });
  const [taskStatus, setTaskStatus] = useState('');
  useEffect(() => {
    const navigate = () => setPage(currentPage());
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    document.title = `${pages[page][0]} — PokerTool`;
    window.scrollTo(0, 0);
  }, [page]);
  function toggleTask(name, checked) {
    const next = { ...tasks, [name]: checked };
    setTasks(next);
    setTaskStatus(writeStored('river.tasks', next) ? '' : 'Checklist updated for this visit; browser storage is unavailable.');
  }
  return <>
    <aside className="sidebar"><a href="#overview" className="brand" aria-label="PokerTool home"><span className="brand-mark">♠</span> PokerTool</a><div className="club-label">YOUR POKER STUDY CLUB</div>
      <nav aria-label="Main navigation">{Object.entries(pages).map(([key, [label, icon]]) => <a key={key} href={`#${key}`} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined}><span className="nav-icon">{icon}</span>{label}</a>)}</nav>
      <div className="sidebar-tip"><span className="tiny-label">A GOOD HABIT</span><div className="tip-symbol">✳</div><h3>Study small.<br />Play smarter.</h3><p>One focused decision is worth more than a hundred rushed hands.</p><a href="#arena">Take a seat <span>↗</span></a></div>
      <div className="profile"><span className="avatar">YO</span><div><strong>Your study space</strong><span>Browser-only edition</span></div><span className="online-dot" /></div>
    </aside>
    <div className="app-shell"><header className="topbar"><span className="breadcrumb">Study club <span>/</span> <strong>{pages[page][0]}</strong></span><div className="topbar-right"><ThemeToggle /><span className="local-badge"><i /> Local workspace</span><span className="avatar small">♠</span></div></header>
      <main>
        {/* Keep screens mounted so filters, drafts, and replay position survive navigation. */}
        <div hidden={page !== 'overview'}><Overview session={session} tasks={tasks} toggleTask={toggleTask} /><p className="caption" role="status">{taskStatus}</p></div>
        <div hidden={page !== 'analysis'}><Analysis analysis={analysis} onAnalysis={setAnalysis} /></div>
        <div hidden={page !== 'ranges'}><Ranges /></div>
        <div hidden={page !== 'arena'}><Arena active={page === 'arena'} /></div>
        <div hidden={page !== 'hands'}><Hands /></div>
        <div hidden={page !== 'notebook'}><Notebook /></div>
        <div hidden={page !== 'coach'}><Coach /></div>
        <footer className="page-footer"><span>♠ PokerTool <span>Your edge starts with understanding.</span></span><span>Built for study · React edition</span></footer>
      </main>
    </div>
  </>;
}
