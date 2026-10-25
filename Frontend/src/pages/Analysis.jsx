import LibraryUpload from '../components/LibraryUpload';
import { displayPosition, positionText } from '../positions';
import { useEffect, useMemo, useState } from 'react';
import { normalizeAnalysis } from '../analysisReport';

const PAGE_SIZE = 25;
const severityOrder = { CRITICAL: 0, MAJOR: 1, MINOR: 2, NONE: 3, UNASSESSED: 4 };

function formatChips(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} chips`;
}

export default function Analysis({ analysis: rawAnalysis, onAnalysis, active }) {
  const analysis = useMemo(() => normalizeAnalysis(rawAnalysis), [rawAnalysis]);
  const [files, setFiles] = useState([]);
  const [fileId, setFileId] = useState('');
  const [catalogVersion, setCatalogVersion] = useState(0);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    fetch('/api/hand-files', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.files)) throw new Error('Could not list saved games. Restart the Python API.');
      setFiles(data.files); setFileId(previous => data.files.some(file => file.id === previous) ? previous : data.files[0]?.id || '');
    }).catch(failure => { if (failure.name !== 'AbortError') setError(failure.message); });
    return () => controller.abort();
  }, [active, catalogVersion]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);

  const filteredHands = useMemo(() => {
    if (!analysis) return [];
    return analysis.hands
      .filter(hand => filter === 'all'
        || (filter === 'mistakes' ? hand.decision_assessment === 'INCORRECT'
          : filter === 'correct' ? hand.decision_assessment === 'CORRECT'
            : filter === 'unassessed' ? hand.decision_assessment === 'UNASSESSED'
              : hand.severity === filter))
      .sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity]);
  }, [analysis, filter]);
  const visibleHands = filteredHands.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.ceil(filteredHands.length / PAGE_SIZE);

  async function submit(event) {
    event.preventDefault();
    if (!fileId || busy) return;
    setBusy(true);
    setError('');
    setStatus('');
    const form = new FormData();
    form.append('file_id', fileId);
    try {
      const response = await fetch('/api/analyze-saved', { method: 'POST', body: form });
      const contentType = response.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
      if (!response.ok) {
        if (typeof data?.detail === 'string') throw new Error(data.detail);
        if (response.status >= 500) {
          throw new Error('The Python API is not responding correctly. Start it on port 8000 and check its terminal for startup errors.');
        }
        throw new Error('Could not analyze this file. Please check the file and try again.');
      }
      const report = normalizeAnalysis(data);
      if (!report) {
        throw new Error('The analysis API returned no hand details. Please try again.');
      }
      onAnalysis(report);
      setFilter('all');
      setPage(0);
      setStatus(`Analyzed ${report.total_hands_analyzed.toLocaleString()} hands from ${report.filename}.`);
    } catch (failure) {
      setError(failure.message === 'Failed to fetch'
        ? 'Cannot reach the Python API. Start it on port 8000 and try again.'
        : failure.message);
    } finally {
      setBusy(false);
    }
  }

  const breakdown = analysis?.leak_breakdown;
  const leaks = breakdown ? [
    ['Played weak hands', breakdown.played_weak_hands],
    ['Folded playable hands', breakdown.folded_playable_hands],
    ['Passive calls with premiums', breakdown.passive_calls_on_premiums],
  ] : [];
  const maxLeak = Math.max(1, ...leaks.map(([, count]) => count ?? 0));

  return <section className="page" id="analysis">
    <div className="page-title">
      <div><p className="eyebrow">TURN HAND HISTORIES INTO STUDY NOTES</p><h1>Session Analysis<span>.</span></h1><p>Choose a saved game, then review Hero’s preflop decisions with their action context.</p></div>
      <span className="pill outlined">GG Poker · PokerStars · .txt · up to 10 MB</span>
    </div>

    <section className="panel analysis-upload">
      <div className="panel-title"><div><h2>Analyze a hand-history file</h2><p className="caption">Select a saved game to review Hero’s first preflop decision in each hand.</p></div><span className="tag">LOCAL API</span></div>
      <form onSubmit={submit} className="analysis-upload-form">
        <label className="field">Saved game<select value={fileId} onChange={event => { setFileId(event.target.value); setError(''); setStatus(''); }} disabled={busy || !files.length}><option value="" disabled>Select a game</option>{files.map(file => <option key={file.id} value={file.id}>{file.id}</option>)}</select></label>
        <button className="button primary" type="submit" disabled={!fileId || busy}>{busy ? 'Analyzing…' : 'Analyze session ↗'}</button>
      </form>
      {error && <p className="analysis-message error" role="alert">{error}</p>}
      {status && <p className="analysis-message" role="status">{status}</p>}
      <p className="caption">Supported formats: GG Poker histories dealt to Hero and PokerStars/Betfair histories dealt to bullets685. Saved files stay in your local hand_histories folder.</p>
    </section>

    <LibraryUpload kind="hands" onImported={() => setCatalogVersion(value => value + 1)} />
    {!analysis ? <section className="analysis-empty panel"><span>♧</span><h2>Your session results will appear here.</h2><p>Select a saved game above to see decision totals and hand-by-hand feedback.</p></section> : <>
      {analysis.incomplete && <p className="analysis-message" role="status">This response is missing assessment details. Those hands are marked unassessed. Restart the Python API to load the latest analyzer.</p>}
      <div className="analysis-stats" aria-label="Session summary">
        <article className="panel"><span>HANDS ANALYZED</span><strong>{analysis.total_hands_analyzed.toLocaleString()}</strong></article>
        <article className="panel"><span>CORRECT</span><strong>{(analysis.decisions_scored - analysis.total_mistakes_detected).toLocaleString()}</strong></article>
        <article className="panel"><span>INCORRECT</span><strong>{analysis.total_mistakes_detected.toLocaleString()}</strong></article>
        <article className="panel"><span>NOT ASSESSED</span><strong>{analysis.decisions_unscored.toLocaleString()}</strong></article>
        <article className="panel"><span>LEGACY FALLBACK</span><strong>{analysis.legacy_logic_hands.toLocaleString()}</strong></article>
      </div>

      <section className="panel analysis-leaks">
        <div className="panel-title"><div><h2>Leak breakdown</h2><p className="caption">Incorrect decisions flagged against a chart-supported action.</p></div><span className="tag">{analysis.room ? `${analysis.room} · ` : ''}{analysis.filename}</span></div>
        {leaks.map(([label, count]) => <div className="leak-row" key={label}>
          <span>{label}</span><div className="leak-track"><i style={{ width: `${(count ?? 0) / maxLeak * 100}%` }} /></div><strong>{count === null ? '—' : count.toLocaleString()}</strong>
        </div>)}
      </section>

      <section className="analysis-hands">
        <div className="section-heading">
          <div><p className="eyebrow">HAND-BY-HAND REVIEW</p><h2>Audited hands</h2></div>
          <label className="analysis-filter">Show
            <select value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}>
              <option value="all">All hands</option><option value="mistakes">Incorrect only</option><option value="CRITICAL">Critical</option><option value="MAJOR">Major</option><option value="MINOR">Minor</option><option value="correct">Correct</option><option value="unassessed">Unassessed</option>
            </select>
          </label>
        </div>
        {!filteredHands.length ? <p className="panel analysis-empty">No hands match this filter.</p> : <div className="analysis-hand-list">
          {visibleHands.map((hand, index) => <details className="panel analysis-hand" key={`${hand.hand_id}-${page * PAGE_SIZE + index}`}>
            <summary>
              <span className={`decision-status decision-${hand.decision_assessment.toLowerCase()}`}>{hand.decision_assessment} · {hand.analysis_source === 'CHART' ? 'CHART' : hand.analysis_source === 'LEGACY_LOGIC' ? 'LEGACY LOGIC' : 'SOURCE UNAVAILABLE'}</span>
              <strong>{hand.matrix_key} · {displayPosition(hand.position)}</strong>
              <span>{hand.deviation_type}</span>
              <span className="analysis-hand-id">{hand.hand_id}</span>
            </summary>
            <div className="analysis-hand-content">
              <div className="analysis-decision-point"><strong>Decision point: Preflop</strong><p>Hero’s first decision{hand.hero_first_action ? `: ${hand.hero_first_action}` : ''}, after {hand.actions_before_hero.length} recorded prior actions. Later streets are context only and are not graded here.</p></div>
              <p>{positionText(hand.feedback)}</p>
              <div className="analysis-hand-facts">
                <span>Cards<strong>{hand.raw_cards}</strong></span>
                <span>Stack<strong>{hand.stack_depth_bb} bb</strong></span>
                <span>Chart<strong>{hand.analysis_source === 'CHART' ? `${hand.chart_stack_bb} bb` : 'Not used'}</strong></span>
                <span>Assessment source<strong>{hand.analysis_source === 'CHART' ? `Preflop chart (${hand.chart_stack_bb} bb)` : hand.analysis_source === 'LEGACY_LOGIC' ? 'Legacy heuristic (not chart-based)' : 'Not available'}</strong></span>
                <span>Preflop context<strong>{hand.facing_action.replaceAll('_', ' ').toLowerCase()}</strong></span>
                <span>Suggested<strong>{positionText(hand.recommended_action)}</strong></span>
                <span>Net result<strong>{formatChips(hand.net_profit)}</strong></span>
                <span>Final recorded board (later in hand)<strong>{hand.board || 'No board'}</strong></span>
              </div>
              {hand.actions_before_hero.length > 0 && <p className="caption">Actions before Hero: {hand.actions_before_hero.map(action => `${displayPosition(action.position)} ${action.action}${action.is_all_in ? ' (all-in)' : ''}`).join(' · ')}</p>}
            </div>
          </details>)}
        </div>}
        {pageCount > 1 && <div className="analysis-pagination"><button className="button" type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>← Previous</button><span>Page {page + 1} of {pageCount} · {filteredHands.length.toLocaleString()} hands</span><button className="button" type="button" disabled={page >= pageCount - 1} onClick={() => setPage(value => value + 1)}>Next →</button></div>}
      </section>
      <p className="caption analysis-disclaimer">Study aid only: decisions are compared with the supplied preflop chart frequencies at the nearest available stack depth. Unsupported situations are marked unassessed; a hand’s result is not the same as the quality of its decision.</p>
    </>}
  </section>;
}
