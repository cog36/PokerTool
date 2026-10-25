import { useEffect, useRef, useState } from 'react';
import PlayingCard from '../components/PlayingCard';
import { scenarios } from '../data';

export default function Practice({ session, onAnswer, active }) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  // The ref closes the tiny gap before React renders a disabled action button.
  const locked = useRef(false);
  const spot = scenarios[index];
  const accuracy = session.attempts ? `${Math.round(session.correct / session.attempts * 100)}%` : '—';
  const answered = choice !== null;
  const result = answered ? (choice === spot.answer ? 'correct' : 'incorrect') : '';
  function answer(action) {
    if (locked.current) return;
    locked.current = true;
    setChoice(action);
    onAnswer(action === spot.answer);
  }
  useEffect(() => {
    function onKey(event) {
      if (!active || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, button, a, [contenteditable]')) return;
      const action = { 1: 'fold', 2: 'call', 3: 'raise' }[event.key];
      if (action) { event.preventDefault(); answer(action); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
  function nextSpot() {
    setIndex(value => (value + 1) % scenarios.length);
    setChoice(null);
    locked.current = false;
  }
  return <section className="page" id="practice">
    <div className="page-title"><div><h1>Practice Room<span>.</span></h1></div><span className="pill outlined">Fundamentals · 3 sample spots</span></div>
    <div className="practice-layout"><section className="panel table-panel"><div className="panel-title"><h2>{spot.title}</h2><span className="tag">SPOT {index + 1} OF {scenarios.length}</span></div>
      <div className="poker-stage"><div className="poker-table"><span className="felt-logo">PokerTool</span><div className="pot-label">POT <strong>1.5 bb</strong></div>
        {[['top', 'Big Blind', '♟'], ['left', 'Small Blind', '♟'], ['right', 'Folded', '↘']].map(([place, label, icon]) => <div key={place} className={`seat seat-${place}`}><span className="seat-avatar">{icon}</span><strong>{label}</strong><small>100 bb</small></div>)}
        <div className="hero-position">{spot.position === 'BTN' && <span className="dealer-chip">D</span>}<div className="table-cards" key={index}>{spot.cards.map(([rank, suit], i) => <PlayingCard key={rank + suit} rank={rank} suit={suit} index={i} />)}</div><span className="hero-label">YOU · {spot.position} · 100 bb</span></div>
      </div></div><div className="decision-area"><p>{spot.prompt}</p><div className="action-buttons">{['fold', 'call', 'raise'].map((action, i) => <button key={action} data-action={action} type="button" disabled={answered} className={choice === action ? `chosen ${result}` : ''} onClick={() => answer(action)}><span>{i + 1}</span>{action[0].toUpperCase() + action.slice(1)}</button>)}</div><span className="caption">Choose an action · keyboard shortcuts 1, 2, 3</span></div>
    </section><aside className="practice-aside"><section className="panel"><div className="panel-title"><h2>Session progress</h2><span className="live-dot" /></div><div className="practice-metrics"><div><strong>{session.correct * 100}</strong><span>Points</span></div><div><strong>{session.streak}</strong><span>Streak</span></div><div><strong>{accuracy}</strong><span>Accuracy</span></div></div></section>
      <section className={`panel feedback-panel${answered ? ` answered ${result}` : ''}`}><p className="eyebrow">THE REASONING</p><div role="status" key={`${index}-${choice}`}>
        {answered && <div className={`answer-indicator ${result}`}><span aria-hidden="true">{result === 'correct' ? '✓' : '✕'}</span>{result === 'correct' ? 'Correct — matches the example' : 'Incorrect — review this concept'}</div>}
        <h3>{answered ? choice === spot.answer ? 'That’s the idea.' : `Consider a ${spot.answer}.` : 'What would you do?'}</h3><p className="feedback-copy">{answered ? spot.explanation : 'Consider your position, your hand strength, and the players still to act. Then choose your action.'}</p></div><button type="button" className="button primary" disabled={!answered} onClick={nextSpot}>{index === scenarios.length - 1 ? 'Repeat the examples ↻' : 'Next decision →'}</button></section>
      <p className="caption">Curated teaching examples, not live solver evaluations. Scores reflect matches with the sample answer.</p>
    </aside></div>
  </section>;
}
