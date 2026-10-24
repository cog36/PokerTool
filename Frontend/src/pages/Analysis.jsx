import { useMemo, useState } from 'react';

const PAGE_SIZE = 25;
const severityOrder = { CRITICAL: 0, MAJOR: 1, MINOR: 2, NONE: 3, UNASSESSED: 4 };

function formatChips(value) {
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} chips`;
}

export default function Analysis({ analysis, onAnalysis }) {
  const [file, setFile] = useState(null);
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
    if (!file || busy) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose a file that is 10 MB or smaller.');
      setStatus('');
      return;
    }

    setBusy(true);
    setError('');
    setStatus('');
    const form = new FormData();
    form.append('file', file);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', body: form });
      const contentType = response.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
      if (!response.ok) {
        if (typeof data?.detail === 'string') throw new Error(data.detail);
        if (response.status >= 500) {
          throw new Error('The Python API is not responding correctly. Start it on port 8000 and check its terminal for startup errors.');
        }
        throw new Error('Could not analyze this file. Please check the file and try again.');
      }
      if (!Array.isArray(data?.hands) || !data.hands.length) {
        throw new Error('The analysis API returned no hand details. Please try again.');
      }
      onAnalysis(data);
      setFilter('all');
      setPage(0);
      setStatus(`Analyzed ${data.total_hands_analyzed.toLocaleString()} hands from ${data.filename}.`);
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
  const maxLeak = Math.max(1, ...leaks.map(([, count]) => count));

  return <section className="page" id="analysis">
    <div className="page-title">
      <div><p className="eyebrow">TURN HAND HISTORIES INTO STUDY NOTES</p><h1>Session Analysis<span>.</span></h1><p>Upload a GG Poker hand-history text file to review parsed hands and heuristic feedback.</p></div>
      <span className="pill outlined">GG Poker · .txt · up to 10 MB</span>
    </div>

    <section className="panel analysis-upload">
      <div className="panel-title"><div><h2>Analyze a hand-history file</h2><p className="caption">Files are processed in memory for this request and are not saved on the server.</p></div><span className="tag">LOCAL API</span></div>
      <form onSubmit={submit} className="analysis-upload-form">
        <label className="field">Choose a GG Poker hand-history file
          <input type="file" accept=".txt,text/plain" onChange={event => { setFile(event.target.files?.[0] ?? null); setError(''); setStatus(''); }} />
        </label>
        <button className="button primary" type="submit" disabled={!file || busy}>{busy ? 'Analyzing…' : 'Analyze session ↗'}</button>
      </form>
      {file && <p className="caption selected-file">{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</p>}
      {error && <p className="analysis-message error" role="alert">{error}</p>}
      {status && <p className="analysis-message" role="status">{status}</p>}
      <p className="caption">The current parser expects GG Poker histories with hands dealt to a player named Hero. Other room formats are not supported yet.</p>
    </section>

    {!analysis ? <section className="analysis-empty panel"><span>♧</span><h2>Your session results will appear here.</h2><p>Upload a history file to see session totals, common leaks, and hand-by-hand feedback.</p></section> : <>
      <div className="analysis-stats" aria-label="Session summary">
        <article className="panel"><span>HANDS ANALYZED</span><strong>{analysis.total_hands_analyzed.toLocaleString()}</strong></article>
        <article className="panel"><span>CORRECT</span><strong>{(analysis.decisions_scored - analysis.total_mistakes_detected).toLocaleString()}</strong></article>
        <article className="panel"><span>INCORRECT</span><strong>{analysis.total_mistakes_detected.toLocaleString()}</strong></article>
        <article className="panel"><span>NOT ASSESSED</span><strong>{analysis.decisions_unscored.toLocaleString()}</strong></article>
        <article className="panel"><span>LEGACY FALLBACK</span><strong>{analysis.legacy_logic_hands.toLocaleString()}</strong></article>
      </div>

      <section className="panel analysis-leaks">
        <div className="panel-title"><div><h2>Leak breakdown</h2><p className="caption">Incorrect decisions flagged against a chart-supported action.</p></div><span className="tag">{analysis.filename}</span></div>
        {leaks.map(([label, count]) => <div className="leak-row" key={label}>
          <span>{label}</span><div className="leak-track"><i style={{ width: `${count / maxLeak * 100}%` }} /></div><strong>{count.toLocaleString()}</strong>
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
              <span className={`decision-status decision-${hand.decision_assessment.toLowerCase()}`}>{hand.decision_assessment} · {hand.analysis_source === 'CHART' ? 'CHART' : 'LEGACY LOGIC'}</span>
              <strong>{hand.matrix_key} · {hand.position}</strong>
              <span>{hand.deviation_type}</span>
              <span className="analysis-hand-id">{hand.hand_id}</span>
            </summary>
            <div className="analysis-hand-content">
              <p>{hand.feedback}</p>
              <div className="analysis-hand-facts">
                <span>Cards<strong>{hand.raw_cards}</strong></span>
                <span>Stack<strong>{hand.stack_depth_bb} bb</strong></span>
                <span>Chart<strong>{hand.analysis_source === 'CHART' ? `${hand.chart_stack_bb} bb` : 'Not used'}</strong></span>
                <span>Assessment source<strong>{hand.analysis_source === 'CHART' ? `Preflop chart (${hand.chart_stack_bb} bb)` : 'Legacy heuristic (not chart-based)'}</strong></span>
                <span>Preflop context<strong>{hand.facing_action.replaceAll('_', ' ').toLowerCase()}</strong></span>
                <span>Suggested<strong>{hand.recommended_action}</strong></span>
                <span>Net result<strong>{formatChips(hand.net_profit)}</strong></span>
                <span>Board<strong>{hand.board || 'No board'}</strong></span>
              </div>
              {hand.actions_before_hero.length > 0 && <p className="caption">Actions before Hero: {hand.actions_before_hero.map(action => `${action.position} ${action.action}${action.is_all_in ? ' (all-in)' : ''}`).join(' · ')}</p>}
            </div>
          </details>)}
        </div>}
        {pageCount > 1 && <div className="analysis-pagination"><button className="button" type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>← Previous</button><span>Page {page + 1} of {pageCount} · {filteredHands.length.toLocaleString()} hands</span><button className="button" type="button" disabled={page >= pageCount - 1} onClick={() => setPage(value => value + 1)}>Next →</button></div>}
      </section>
      <p className="caption analysis-disclaimer">Study aid only: decisions are compared with the supplied preflop chart frequencies at the nearest available stack depth. Unsupported situations are marked unassessed; a hand’s result is not the same as the quality of its decision.</p>
    </>}
  </section>;
}
