import { useEffect, useState } from 'react';
import './Tournaments.css';
import LibraryUpload from '../components/LibraryUpload';
const dollars = cents => cents === null || cents === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const percent = value => value === null || value === undefined ? '—' : `${value.toFixed(2)}%`;

function ProfitGraph({ curve }) {
  const [selected, setSelected] = useState(null);
  const points = [{ id: 'Start', cumulative_cents: 0 }, ...curve];
  const value = point => point.cumulative_cents;
  const low = Math.min(0, ...points.map(value));
  const high = Math.max(100, ...points.map(value));
  const pad = Math.max(100, (high-low)*.1);
  const y = amount => 235 - (amount-low+pad)/(high-low+2*pad)*205;
  const x = index => 80 + index / Math.max(1, points.length-1)*780;
  const chosen = selected === null ? points.at(-1) : points[Math.min(selected, points.length-1)];
  return <div className="profit-chart"><div className="profit-chart-readout"><span>{chosen.id === 'Start' ? 'Before first tournament' : selected === null ? 'Latest cumulative result' : `Tournament #${chosen.id}`}</span><strong>{dollars(value(chosen))}</strong></div>
    <svg viewBox="0 0 900 280" role="group" aria-label="Cumulative tournament profit in USD. Focus a point to inspect its result.">
      {[low, (high+low)/2, high].map((amount, index) => <g key={index}><line x1="80" x2="860" y1={y(amount)} y2={y(amount)} className="chart-grid" /><text x="65" y={y(amount)+4} textAnchor="end">{dollars(amount)}</text></g>)}
      <line x1="80" x2="860" y1={y(0)} y2={y(0)} className="chart-zero" />
      <polyline points={points.map((point,index)=>`${x(index)},${y(value(point))}`).join(' ')} fill="none" className="profit-line" />
      {points.map((point,index)=><circle key={`${point.id}-${index}`} cx={x(index)} cy={y(value(point))} r="5" tabIndex="0" role="button" aria-label={`${point.id === 'Start' ? 'Start' : `Tournament ${point.id}`}: cumulative ${dollars(value(point))}`} onFocus={()=>setSelected(index)} onMouseEnter={()=>setSelected(index)} onMouseLeave={()=>setSelected(null)} onBlur={()=>setSelected(null)} onClick={()=>setSelected(index)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(index);}}}><title>{point.date?.replace('T',' ')} · {dollars(value(point))}</title></circle>)}
      <text x="80" y="270">Start · $0</text><text x="860" y="270" textAnchor="end">{curve.length} dated tournaments</text>
    </svg>
    <p className="caption">Ordered by recorded start time, not payout time. Timezones are not specified consistently across rooms. Hover or focus a point for its cumulative result.</p>
  </div>;
}

export default function Tournaments({ active }) {
  const [data,setData]=useState(null), [loading,setLoading]=useState(false), [error,setError]=useState(''), [refresh,setRefresh]=useState(0);
  const [search,setSearch]=useState('');
  useEffect(()=>{
    if(!active)return;
    const controller=new AbortController();setLoading(true);setError('');
    fetch('/api/tournaments',{cache:'no-store',signal:controller.signal}).then(async response=>{
      const result=await response.json().catch(()=>null);
      if(!response.ok||!result?.summary||!Array.isArray(result.tournaments))throw new Error('Could not load tournament summaries. Restart the Python API and try Refresh.');
      setData(result);
    }).catch(failure=>{if(failure.name!=='AbortError')setError(failure.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[active,refresh]);
  const s=data?.summary,q=data?.quality;
  const returns=s ? s.cash_return_cents:0;
  const profit=s ? returns-s.buyin_cents:0;
  const rows=data?.tournaments.filter(row=>`${row.id} ${row.name} ${row.room} ${row.hero}`.toLowerCase().includes(search.toLowerCase()))||[];
  return <section id="tournaments" className="page tournaments-page">
    <div className="page-title"><div><p className="eyebrow">THE TOURNAMENT LEDGER</p><h1>Tournaments</h1><p>Entry costs, reported prizes and the results behind the numbers.</p></div><button className="button" disabled={loading} onClick={()=>setRefresh(value=>value+1)}>{loading?'Reading summaries…':'Refresh summaries'}</button></div>
    <LibraryUpload kind="tournaments" onImported={() => setRefresh(value => value + 1)} />
    <div className="tournament-toolbar"><p><strong>Cash results only.</strong> Cash payouts include bounty cash. Noncash awards have no cash value in these figures. GG player: <strong>Hero</strong>; PokerStars/Betfair player: <strong>bullets685</strong>.</p></div>
    {error&&<p role="alert" className="analysis-message error">{error}</p>}
    {!data&&loading&&<p className="panel" role="status">Reading tournament summaries…</p>}
    {data&&<>
      <div className="tournament-stats" aria-label="Tournament statistics">{[
        ['Unique tournaments',s.tournaments,`${s.entries} total entries, including ${s.reentries} re-entries`],
        ['Total buy-ins',dollars(s.buyin_cents),'All components and reported re-entries'],
        ['Cash returns',dollars(returns),'Reported payouts, including bounty cash'],
        ['Net profit',dollars(profit),`${s.accounted_tournaments} completed tournaments accounted`],
        ['ROI',percent(s.roi_percent),'Net result ÷ total buy-ins'],
        ['ITM · cashed',percent(s.itm_percent),`${s.itm_count} / ${s.itm_assessed} tournaments returned cash${s.itm_unknown ? ` · ${s.itm_unknown} incomplete results excluded` : ''}`],
      ].map(([label,value,note])=><article className="panel" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
      <section className="panel tournament-graph"><div className="panel-title"><h2>Cumulative profit</h2><span className="tag">CASH RETURNS − BUY-INS</span></div>{data.curve.length?<ProfitGraph curve={data.curve}/>:<p>No complete, dated results to plot yet.</p>}</section>
      <section className="panel tournament-quality"><div className="panel-title"><h2>How much can these numbers tell us?</h2><span className="tag">DATA COVERAGE, NOT A SKILL RATING</span></div>
        <div className="quality-grid"><div><strong>{percent(q.financial_coverage_percent)}</strong><span>Entered tournaments with usable costs and final cash results</span></div><div><strong>{q.duplicates_removed}</strong><span>Duplicate files excluded from double counting</span></div><div><strong>{q.excluded_tournaments}</strong><span>Entered records excluded · {q.conflicts} conflicts · {q.parse_errors} parse errors</span></div><div><strong>{s.itm_assessed}</strong><span>Tournaments with a confirmed cash result</span></div></div>
        <p>{q.files_scanned} files → {q.unique_summaries} unique summaries. {s.tournaments} confirmed tournaments and {s.wins} recorded first-place finishes.</p>
        {data.history_crosscheck && <p className="tournament-crosscheck"><strong>Hand-history cross-check:</strong> summaries match {data.history_crosscheck.matched_summaries} of {data.history_crosscheck.known_history_tournaments} identifiable tournaments in the hand histories. {data.history_crosscheck.missing_summaries.length > 0 ? <>Missing summaries: {data.history_crosscheck.missing_summaries.map(item=>`${item.room} #${item.id}`).join(', ')}. These results are excluded, not assumed to be losses.</> : 'Every identifiable hand-history tournament has a summary.'} {data.history_crosscheck.history_parse_errors > 0 && `${data.history_crosscheck.history_parse_errors} hand-history parsing issues limit this check.`}</p>}
        <p>This is a {s.tournaments}-tournament sample, not a reliable estimate of long-run profitability. Complete accounting coverage only means these files contain the fields needed for this calculation; it does not confirm that every tournament, reward or cost is present.</p>
        <p>GG files use “$” without a currency code and are treated as USD. Buy-ins are reported entry costs; actual account debits and payment methods are not recorded in these summaries. {q.graph_excluded>0&&`${q.graph_excluded} results have no date and are excluded from the graph.`}</p>
      </section>
      <section className="panel tournament-ledger"><div className="panel-title"><div><h2>Buy-ins & payouts</h2><p className="caption">Search filters the table only. Totals and graph retain all included tournaments.</p></div><label className="field">Search tournaments<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="ID, room or tournament" /></label></div>
        <div className="tournament-table-scroll"><table><thead><tr>{['Tournament / start','Entered','Entries','Buy-in / entry','Total buy-ins','Cash return','Net result','Finish / ITM','Source & checks'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={`${row.room}-${row.id}`}><td><strong>#{row.id} · {row.name}</strong><small>{row.room} · {row.started_at?.replace('T',' ')||'Date unavailable'}</small></td><td>{row.entered?'Yes':'No entry found'}<small>{row.hero}</small></td><td>{row.entries}</td><td>{dollars(row.unit_buyin_cents)}</td><td>{dollars(row.buyin_cents)}</td><td>{dollars(row.cash_return_cents)}</td><td className={row.included ? row.profit_cents<0?'negative':'positive' : ''}>{row.included?dollars(row.profit_cents):'Excluded'}</td><td>{row.place??'—'}<small>Cashed: {row.itm===null?'Pending':row.itm?'Yes':'No'}</small></td><td><details><summary>{row.conflicted?'Conflicting summaries':row.included?'Accounted':'Not accounted'} · {row.source_files.length} file(s)</summary><ul>{row.warnings.map((warning,index)=><li key={index}>{warning}</li>)}{row.source_files.map(file=><li key={file}>{file}</li>)}</ul></details></td></tr>)}</tbody></table></div>
        {!rows.length&&<p>No tournament summaries match.</p>}
      </section>
      <details className="panel tournament-method"><summary>Calculation rules & limitations</summary><ul>{data.methodology.map(note=><li key={note}>{note}</li>)}</ul></details>
      {data.errors.length>0&&<section className="panel"><h2>Files requiring attention</h2>{data.errors.map(item=><p key={item.file}>{item.file}: {item.message}</p>)}</section>}
    </>}
  </section>;
}
