import { useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 50;

function percent(value) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

export default function HandOverview({ active }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch('/api/hand-history-overview', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(typeof result?.detail === 'string'
            ? result.detail
            : 'Could not load the hand-history overview.');
        }
        if (!result || !Array.isArray(result.hands) || !result.summary) {
          throw new Error('The hand-history overview returned an unexpected response.');
        }
        setData(result);
      })
      .catch(failure => {
        if (failure.name !== 'AbortError') {
          setError(failure.message === 'Failed to fetch'
            ? 'Cannot reach the Python API. Start it on port 8000 and try again.'
            : failure.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [active, refreshKey]);

  const filteredHands = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data?.hands ?? [];
    return (data?.hands ?? []).filter(hand => [
      hand.hand_id,
      hand.tournament_id,
      hand.position,
      hand.cards,
      hand.board,
      hand.source_file,
    ].some(value => String(value ?? '').toLowerCase().includes(query)));
  }, [data, search]);
  const roomCounts = useMemo(() => {
    const counts = new Map();
    for (const hand of data?.hands ?? []) {
      counts.set(hand.room, (counts.get(hand.room) ?? 0) + 1);
    }
    return [...counts].sort(([roomA], [roomB]) => roomA.localeCompare(roomB));
  }, [data]);
  const summary = data?.summary;

  return <section id="hand-overview" className="page">
    <div className="page-title">
      <div>
        <p className="eyebrow">YOUR COMPLETE HAND-HISTORY LIBRARY</p>
        <h1>Hand Overview<span>.</span></h1>
        <p>Overall HUD statistics and hand details parsed from the local hand_histories folder.</p>
      </div>
      <button className="button" type="button" onClick={() => setRefreshKey(value => value + 1)} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh data ↻'}
      </button>
    </div>

    {error && <p className="analysis-message error" role="alert">{error}</p>}
    {loading && !data && <section className="panel analysis-empty" role="status"><p>Reading hand histories…</p></section>}
    {!loading && !data && !error && <section className="panel analysis-empty"><p>Open this tab to load your local hand-history summary.</p></section>}
    {data && <>
      <p className="hand-overview-caption">
        Parsed {data.total_hands.toLocaleString()} unique hands from {data.source_files.toLocaleString()} file(s);
        {' '}{data.files_scanned.toLocaleString()} files scanned
        {summary.tournaments ? ` · ${summary.tournaments.toLocaleString()} tournaments` : ''}
        {roomCounts.length > 0 && <> · {roomCounts.map(([room, count]) => `${room}: ${count.toLocaleString()}`).join(' · ')}</>}.
        {data.errors.length > 0 && ` ${data.errors.length} file/parse error(s) reported below.`}
      </p>

      {data.total_hands === 0 ? <section className="panel analysis-empty">
        <h2>No supported hands found.</h2>
        <p>Expected GG Poker hands dealt to Hero or PokerStars/Betfair hands dealt to bullets685.</p>
      </section> : <>
        <div className="analysis-stats hand-overview-stats" aria-label="Overall hand statistics">
          <article className="panel"><span>HANDS</span><strong>{data.total_hands.toLocaleString()}</strong></article>
          <article className="panel"><span>VPIP</span><strong>{percent(summary.vpip_percent)}</strong></article>
          <article className="panel"><span>PFR</span><strong>{percent(summary.pfr_percent)}</strong></article>
          <article className="panel"><span>VPIP − PFR</span><strong>{summary.vpip_pfr_gap.toFixed(1)} pp</strong></article>
          <article className="panel"><span>SAW FLOP</span><strong>{percent(summary.saw_flop_percent)}</strong></article>
        </div>

        <section className="panel hand-overview-section">
          <div className="panel-title"><div><h2>Overall HUD</h2><p className="caption">Observed frequencies from hands in the local library.</p></div></div>
          <div className="hand-overview-hud">
            <div><span>3-bet</span><strong>{percent(summary.three_bet_percent)}</strong><small>{summary.three_bets}/{summary.three_bet_opportunities} opportunities</small></div>
            <div><span>Flop c-bet</span><strong>{percent(summary.c_bet_percent)}</strong><small>{summary.c_bets}/{summary.c_bet_opportunities} opportunities</small></div>
            <div><span>WTSD (of flops seen)</span><strong>{percent(summary.went_to_showdown_percent)}</strong><small>{summary.showdowns}/{summary.saw_flop_hands} hands that saw a flop</small></div>
            <div><span>Showdown / all hands</span><strong>{percent(summary.showdown_hand_percent)}</strong><small>{summary.showdowns}/{data.total_hands} dealt hands</small></div>
            <div><span>Won at showdown</span><strong>{percent(summary.won_at_showdown_percent)}</strong><small>{summary.won_showdowns}/{summary.showdowns} showdowns</small></div>
            <div><span>Postflop bets + raises</span><strong>{summary.postflop_bets_raises.toLocaleString()}</strong><small>aggression actions</small></div>
            <div><span>Postflop calls</span><strong>{summary.postflop_calls.toLocaleString()}</strong><small>aggression ratio {summary.postflop_aggression_ratio.toFixed(2)}</small></div>
          </div>
        </section>

        <section className="panel hand-overview-section">
          <div className="panel-title"><div><h2>HUD by position</h2><p className="caption">Position estimates follow the table button and occupied seats.</p></div></div>
          <div className="hand-overview-table-wrap">
            <table className="hand-overview-table">
              <thead><tr><th>Position</th><th>Hands</th><th>VPIP</th><th>PFR</th><th>3-bet</th><th>3-bet opp.</th><th>Saw flop</th></tr></thead>
              <tbody>{data.position_stats.map(row => <tr key={row.position}>
                <th scope="row">{row.position}</th><td>{row.hands.toLocaleString()}</td><td>{percent(row.vpip_percent)}</td><td>{percent(row.pfr_percent)}</td>
                <td>{row.three_bet_percent === null ? '—' : percent(row.three_bet_percent)}</td><td>{row.three_bet_opportunities}</td><td>{percent(row.saw_flop_percent)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>

        <section className="panel hand-overview-section">
          <div className="panel-title"><div><h2>Leak flags to investigate</h2><p className="caption">Heuristics are prompts for review, not verdicts.</p></div></div>
          <div className="hand-overview-flags">{data.leak_flags.map(flag => <article key={flag.title}><strong>{flag.title}</strong><p>{flag.body}</p></article>)}</div>
        </section>

        <section className="panel hand-overview-section">
          <div className="panel-title">
            <div><h2>Parsed hands</h2><p className="caption">Search across hand IDs, cards, positions and source files.</p></div>
            <label className="analysis-filter">Search
              <input type="search" value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Hand, cards, position…" />
            </label>
          </div>
          <div className="hand-overview-table-wrap">
            <table className="hand-overview-table hand-list-table">
              <thead><tr><th>Hand / tournament</th><th>Position</th><th>Cards</th><th>Board</th><th>VPIP</th><th>PFR</th><th>3-bet</th><th>C-bet</th><th>Saw flop</th><th>Showdown</th><th>Place</th><th>Source</th></tr></thead>
              <tbody>{filteredHands.slice(0, visibleCount).map(hand => <tr key={`${hand.room}:${hand.hand_id}`}>
                <td><strong>{hand.hand_id}</strong><small>{hand.tournament_id ? `Tournament ${hand.tournament_id}` : 'Tournament ID unavailable'}</small>
                  <details className="hand-overview-hand-details"><summary>Hand details</summary>
                    <p>Preflop: {hand.preflop_actions || 'No preflop actions parsed'}</p>
                    <p>Blinds: {hand.small_blind ?? '—'} / {hand.big_blind ?? '—'} · Postflop bets/raises: {hand.post_bets_raises} · Postflop calls: {hand.post_calls}</p>
                  </details>
                </td>
                <td>{hand.position}</td><td>{hand.cards || 'Not shown'}</td><td>{hand.board || '—'}</td><td>{hand.vpip ? 'Yes' : 'No'}</td><td>{hand.pfr ? 'Yes' : 'No'}</td>
                <td>{hand.three_bet_opportunity ? (hand.three_bet ? 'Yes' : 'No') : '—'}</td>
                <td>{hand.cbet_opportunity ? (hand.cbet ? 'Yes' : 'No') : '—'}</td><td>{hand.saw_flop ? 'Yes' : 'No'}</td>
                <td>{hand.showdown ? (hand.won_showdown ? 'Won' : 'Lost') : 'No'}</td><td>{hand.place ?? '—'}</td><td>{hand.source_file}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="hand-overview-pagination">
            Showing {Math.min(visibleCount, filteredHands.length).toLocaleString()} of {filteredHands.length.toLocaleString()} hands
            {visibleCount < filteredHands.length && <button className="button" type="button" onClick={() => setVisibleCount(value => value + PAGE_SIZE)}>Load more</button>}
          </p>
        </section>
      </>}

      {data.errors.length > 0 && <details className="panel hand-overview-section hand-overview-errors">
        <summary>Files that could not be fully read or parsed ({data.errors.length})</summary>
        <ul>{data.errors.map((item, index) => <li key={`${item.file}-${index}`}><strong>{item.file}</strong>: {item.message}</li>)}</ul>
      </details>}

      <p className="caption hand-overview-disclaimer">Hand histories report observed outcomes and action frequencies; they do not provide a complete tournament results ledger or prove whether a decision was profitable. ROI is not calculated from these files.</p>
    </>}
  </section>;
}
