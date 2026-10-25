import LibraryUpload from '../components/LibraryUpload';
import { displayPosition, positionText } from '../positions';
import { useEffect, useMemo, useState } from 'react';
import { normalizeAnalysis } from '../analysisReport';

const PAGE_SIZE = 25;
const severityOrder = { CRITICAL: 0, MAJOR: 1, MINOR: 2, NONE: 3, UNASSESSED: 4 };
const REVIEW_STREETS = ['Preflop', 'Flop', 'Turn', 'River'];

function formatBigBlinds(value, bigBlind) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not available';
  if (typeof bigBlind !== 'number' || !Number.isFinite(bigBlind) || bigBlind <= 0) return 'Not available';
  const amount = value / bigBlind;
  return `${amount > 0 ? '+' : ''}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} bb`;
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
  const [filter, setFilter] = useState('mistakes');
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
      setFilter(report.total_mistakes_detected ? 'mistakes' : 'all');
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

  return <section className="page" id="analysis">
    <div className="page-title">
      <div><p className="eyebrow">TURN HAND HISTORIES INTO STUDY NOTES</p><h1>Session Analysis<span>.</span></h1><p>See each flagged preflop decision in the full sequence of actions across the hand.</p></div>
      <span className="pill outlined">GG Poker · PokerStars · .txt · up to 10 MB</span>
    </div>

    <section className="panel analysis-upload">
      <div className="panel-title"><div><h2>Analyze a hand-history file</h2><p className="caption">Decision checks cover Hero’s first preflop action; the review shows every street to refresh the hand context.</p></div><span className="tag">LOCAL API</span></div>
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
        <article className="panel"><span>HANDS REVIEWED</span><strong>{analysis.total_hands_analyzed.toLocaleString()}</strong></article>
        <article className="panel"><span>FLAGGED TO REVIEW</span><strong>{analysis.total_mistakes_detected.toLocaleString()}</strong></article>
        <article className="panel"><span>ASSESSED OK</span><strong>{(analysis.decisions_scored - analysis.total_mistakes_detected).toLocaleString()}</strong></article>
        <article className="panel"><span>NOT ASSESSED</span><strong>{analysis.decisions_unscored.toLocaleString()}</strong></article>
      </div>

      <section className="analysis-hands">
        <div className="section-heading">
          <div><p className="eyebrow">DECISION + FULL HAND CONTEXT</p><h2>Review hands</h2><p className="caption">{analysis.room ? `${analysis.room} · ` : ''}{analysis.filename}</p></div>
          <label className="analysis-filter">Show
            <select value={filter} onChange={event => { setFilter(event.target.value); setPage(0); }}>
              <option value="all">All hands</option><option value="mistakes">Incorrect only</option><option value="CRITICAL">Critical</option><option value="MAJOR">Major</option><option value="MINOR">Minor</option><option value="correct">Correct</option><option value="unassessed">Unassessed</option>
            </select>
          </label>
        </div>
        {!filteredHands.length ? <p className="panel analysis-empty">No hands match this filter.</p> : <div className="analysis-hand-list">
          {visibleHands.map((hand, index) => <details className="panel analysis-hand" key={`${hand.hand_id}-${page * PAGE_SIZE + index}`}>
            <summary>
              <span className={`decision-status decision-${hand.decision_assessment.toLowerCase()}`}>{hand.decision_assessment === 'INCORRECT' ? 'REVIEW THIS DECISION' : hand.decision_assessment}</span>
              <strong>{hand.raw_cards} · {displayPosition(hand.position)}</strong>
              <span>{hand.deviation_type}</span>
              <span className="analysis-hand-id">{hand.hand_id}</span>
            </summary>
            <div className="analysis-hand-content">
              <div className="analysis-decision-point">
                <span className="eyebrow">FLAGGED DECISION · PREFLOP</span>
                <strong>{displayPosition(hand.position)} · {hand.raw_cards} · {hand.stack_depth_bb}bb</strong>
                {hand.decision_action_index !== null && hand.action_timeline[hand.decision_action_index]
                  ? <p>Hero {hand.action_timeline[hand.decision_action_index].text}.</p>
                  : <p>Hero’s recorded action: {hand.hero_first_action || 'unavailable'}.</p>}
                <p className="caption">After: {hand.decision_action_index !== null && hand.action_timeline.slice(0, hand.decision_action_index).some(action => action.action !== 'posts')
                  ? hand.action_timeline.slice(0, hand.decision_action_index).filter(action => action.action !== 'posts').map(action => `${displayPosition(action.position)} ${action.text || action.action}`).join(' · ')
                  : 'no raises or calls before Hero'}.</p>
              </div>
              <div className="analysis-reason"><strong>Why this decision was flagged</strong><p>{positionText(hand.feedback)}</p></div>
              <section className="analysis-timeline" aria-label={`Full hand timeline for hand ${hand.hand_id}`}>
                <div className="panel-title"><div><h3>Full hand timeline</h3><p className="caption">Positions and actions in sequence. All bet amounts are shown in big blinds; the flagged action is highlighted.</p></div><span className="tag">Result: {formatBigBlinds(hand.net_profit, hand.big_blind)}</span></div>
                {REVIEW_STREETS.map(street => {
                  const actions = hand.action_timeline.filter(action => action.street === street);
                  const board = hand.street_boards[street];
                  return <section className="analysis-street" key={street}>
                    <div className="analysis-street-heading"><strong>{street}</strong>{board && <span>{board}</span>}</div>
                    {actions.length ? <ol>{actions.map((action, actionIndex) => {
                      const isDecision = action.is_decision || hand.action_timeline.indexOf(action) === hand.decision_action_index;
                      return <li className={isDecision ? 'analysis-action is-decision' : ''} key={`${street}-${actionIndex}`}>
                        <span className="analysis-action-position">{displayPosition(action.position)}</span>
                        <span className="analysis-action-player">{action.player === hand.hero ? 'Hero' : 'Opponent'}</span>
                        <span className="analysis-action-text">{action.text}{action.is_all_in && !action.text.toLowerCase().includes('all-in') ? ' (all-in)' : ''}</span>
                        {isDecision && <span className="analysis-action-badge">FLAGGED DECISION</span>}
                      </li>;
                    })}</ol> : <p className="analysis-street-empty">{board ? 'No further betting on this street.' : 'No board cards or actions recorded.'}</p>}
                  </section>;
                })}
              </section>
              <details className="analysis-assessment-details"><summary>Assessment details</summary>
                <div className="analysis-hand-facts">
                  <span>Hand<strong>{hand.hand_id}</strong></span>
                  <span>Assessment source<strong>{hand.analysis_source === 'CHART' ? `Preflop chart (${hand.chart_stack_bb}bb)` : hand.analysis_source === 'LEGACY_LOGIC' ? 'Legacy heuristic' : 'Unavailable'}</strong></span>
                  <span>Available action<strong>{positionText(hand.recommended_action)}</strong></span>
                  <span>Final board<strong>{hand.board || 'No board'}</strong></span>
                </div>
              </details>
            </div>
          </details>)}
        </div>}
        {pageCount > 1 && <div className="analysis-pagination"><button className="button" type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>← Previous</button><span>Page {page + 1} of {pageCount} · {filteredHands.length.toLocaleString()} hands</span><button className="button" type="button" disabled={page >= pageCount - 1} onClick={() => setPage(value => value + 1)}>Next →</button></div>}
      </section>
      <p className="caption analysis-disclaimer">The flagged decision is Hero’s first preflop action. The timeline shows the rest of the hand to refresh context; later actions and the result do not change that decision assessment.</p>
    </>}
  </section>;
}
