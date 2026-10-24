import { useMemo, useState } from 'react';
import PlayingCard from '../components/PlayingCard';
import { buildRange, positionNames } from '../model';

const descriptions = {
  raise: 'This hand belongs to the opening group in this simplified example. Change position to see how the illustrative range changes.',
  call: 'A study boundary hand: suitability depends on position and action. This colour does not recommend open-limping.',
  fold: 'Outside the opening group in this example. Passing on weak hands leaves room for stronger opportunities.',
};
const actions = { raise: 'Raise', call: 'Consider / mixed', fold: 'Fold' };

export default function Ranges() {
  const [position, setPosition] = useState('BTN');
  const [selected, setSelected] = useState('AKs');
  const [query, setQuery] = useState('');
  const cells = useMemo(() => buildRange(position), [position]);
  const current = cells.find(cell => cell.hand === selected);
  const suited = selected.endsWith('s');
  const pair = selected.length === 2;
  return <section className="page" id="ranges">
    <div className="page-title"><div><p className="eyebrow">PREFLOP REFERENCE</p><h1>Range Explorer<span>.</span></h1><p>Compare starting hands by position and inspect each range.</p></div><span className="pill outlined">Illustrative study ranges</span></div>
    <div className="range-layout"><section className="panel matrix-panel">
      <div className="panel-title"><h2>Starting-hand matrix</h2><span className="tag">6-MAX · 100BB</span></div>
      <div className="range-toolbar"><div className="segmented" aria-label="Position">
        {Object.keys(positionNames).reverse().map(value => <button key={value} type="button" aria-pressed={position === value} className={position === value ? 'selected' : ''} onClick={() => setPosition(value)}>{value}</button>)}
      </div><label className="hand-search"><span>⌕</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find AKs, 77…" aria-label="Find a starting hand" /></label></div>
      <div className="matrix-scroll"><div className="matrix" role="group" aria-label="169 starting hands">
        {cells.map(cell => <button type="button" key={cell.hand} aria-pressed={selected === cell.hand}
          aria-label={`${cell.hand}, illustrative ${actions[cell.action]}`}
          className={`hand ${cell.action}${query.trim() && !cell.hand.toLowerCase().includes(query.trim().toLowerCase()) ? ' dimmed' : ''}`}
          onClick={() => setSelected(cell.hand)}>{cell.hand}</button>)}
      </div></div>
      <div className="matrix-legend"><span><i className="raise" />Raise</span><span><i className="call" />Consider / mixed</span><span><i className="fold" />Fold</span><span className="coverage">{cells.filter(cell => cell.action === 'raise').length} / 169 raise categories</span></div>
      <p className="caption">Simplified examples for an unopened pot. Not validated GTO ranges or solver output.</p>
    </section><aside className="range-aside"><section className="panel inspector">
      <p className="eyebrow">HAND SPOTLIGHT</p><h2>{selected}</h2><p>{pair ? 'Pocket pair' : suited ? 'Suited starting hand' : 'Offsuit starting hand'}</p>
      <div className="spotlight-cards" key={selected}><PlayingCard rank={selected[0]} suit="♠" /><PlayingCard rank={selected[1]} suit={suited ? '♠' : '♥'} index={1} /></div>
      <div className="hand-verdict"><span>Illustrative action</span><strong>{actions[current.action]}</strong></div><p className="body-copy">{descriptions[current.action]}</p>
      <div className="inspector-meta"><span>Position<strong>{positionNames[position]}</strong></span><span>Combinations<strong>{pair ? 6 : suited ? 4 : 12}</strong></span></div>
    </section><section className="learning-note"><span>✳</span><h3>Read between the squares.</h3><p>Pairs sit on the diagonal. Suited hands are above it; offsuit hands below. Compare positions and watch the opening group change.</p></section></aside></div>
  </section>;
}
