import { lazy, Suspense, useEffect, useState } from 'react';
import NavIcon from './components/NavIcon';
import ThemeToggle from './components/ThemeToggle';
import PhoneApp from './components/PhoneApp';
import Ranges from './pages/Ranges';
import Notebook from './pages/Notebook';
import Coach from './pages/Coach';
import Analysis from './pages/Analysis';
const Tournaments = lazy(() => import('./pages/Tournaments'));
import HandOverview from './pages/HandOverview';
import Arena from './pages/Arena';

const pages = { handOverview: ['Hand Overview', '▤'], tournaments: ['Tournaments', '♜'], analysis: ['Session Analysis', '⌁'], ranges: ['Preflop Charts', '▦'], arena: ['AI Arena', '♠'], notebook: ['Study Notebook', '▤'], coach: ['AI Coach', '✦'] };

function currentPage() {
  const name = location.hash.slice(1);
  if (name === 'overview' || !Object.hasOwn(pages, name)) return 'handOverview';
  return name;
}

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  useEffect(() => {
    const navigate = () => setPage(currentPage());
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    setMenuOpen(false);
    document.title = `${pages[page][0]} — PokerTool`;
    window.scrollTo(0, 0);
  }, [page]);
  return <>
    <aside className={`sidebar${menuOpen ? ' mobile-open' : ''}`}><a href="#handOverview" className="brand" aria-label="PokerTool Hand Overview"><span className="brand-mark">♠</span> PokerTool</a>
      <button type="button" className="mobile-menu-button" aria-controls="main-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? 'Close menu' : 'Menu'}</button>
      <nav id="main-navigation" aria-label="Main navigation" onClick={() => setMenuOpen(false)}>{Object.entries(pages).map(([key, [label]]) => <a key={key} href={`#${key}`} className={page === key ? 'active' : ''} aria-current={page === key ? 'page' : undefined}><span className="nav-icon"><NavIcon name={key} /></span>{label}</a>)}</nav>
    </aside>
    <div className="app-shell"><header className="topbar"><span className="breadcrumb">PokerTool <span>/</span> <strong>{pages[page][0]}</strong></span><div className="topbar-right"><ThemeToggle /><span className="local-badge"><i /> Personal workspace</span><span className="avatar small">♠</span></div></header>
      <PhoneApp />
      <main>
        {/* Keep screens mounted so filters, drafts, and replay position survive navigation. */}
        <div hidden={page !== 'handOverview'}><HandOverview active={page === 'handOverview'} /></div>
        <div hidden={page !== 'tournaments'}><Suspense fallback={<p role="status">Loading tournament ledger…</p>}><Tournaments active={page === 'tournaments'} /></Suspense></div>
        <div hidden={page !== 'analysis'}><Analysis active={page === 'analysis'} analysis={analysis} onAnalysis={setAnalysis} /></div>
        <div hidden={page !== 'ranges'}><Ranges /></div>
        <div hidden={page !== 'arena'}><Arena active={page === 'arena'} /></div>
        <div hidden={page !== 'notebook'}><Notebook /></div>
        <div hidden={page !== 'coach'}><Coach /></div>
      </main>
    </div>
  </>;
}
