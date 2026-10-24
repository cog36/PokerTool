import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PlayingCard from '../components/PlayingCard';
import { planAction, planOpening, createMatch, nextHand, legalActions, STREETS, handLabels, personalities, tellQuestions } from '../arena';
import { profileFor } from '../archetypes';

const bb = value => Number(value.toFixed(2)).toLocaleString(undefined, { maximumFractionDigits: 2 });

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

function CardBack({ delivered }) {
  return delivered
    ? <span className="hidden-card landed-card" aria-label="Hidden card">♠</span>
    : <span className="card-space" aria-label="Awaiting card" />;
}

function BotSeat({ player, hand, reveal, muted, dealStep, thinking, event, winner }) {
  const persona = profileFor(player.archetype);
  return <article className={`arena-bot ${persona.colour}${player.folded || !player.inHand ? ' folded' : ''}${thinking ? ' thinking' : ''}${winner ? ' celebrating' : ''}`}
    aria-label={`${persona.name}, ${persona.label}`} data-seat={player.id}>
    {!muted && <div className={`speech-bubble${thinking ? ' thought-bubble' : ''}`} key={`${thinking}-${player.bubble}`}>
      {thinking ? <><div className="thinking-dots" aria-label={`${persona.name} is thinking`}><i /><i /><i /></div><span>THINKING…</span></> : <><p>{player.inHand ? player.bubble : 'Out of chips. Watching this hand.'}</p><span>TABLE TALK</span></>}
    </div>}
    <div className={`bot-avatar ${event || ''}`} aria-hidden="true">{persona.avatar}</div>
    <h3>{persona.name}{winner && ' ★'}</h3><span className="archetype-tag" title={persona.description}>{persona.label}</span>
    <p className="bot-personality">{player.position} {hand.button === player.id ? '· DEALER' : ''}</p><strong className="bot-stack">{bb(player.stack / 2)} bb</strong>
    <div className={`bot-cards${player.folded ? ' mucked-cards' : ''}`}>
      {player.cards.map(([rank, suit], index) => reveal && !player.folded
        ? <span className="showdown-flip" key={index}><PlayingCard rank={rank} suit={suit} index={index} /></span>
        : <CardBack key={index} delivered={dealStep > (index ? hand.dealOrder.lastIndexOf(player.id) : hand.dealOrder.indexOf(player.id))} />)}
    </div>
    {(player.folded || player.allIn || !player.inHand) && <span className="fold-label">{!player.inHand ? 'SITTING OUT' : player.folded ? 'FOLDED' : 'ALL-IN'}</span>}
    {thinking && <span className="turn-label">DECIDING</span>}
  </article>;
}

function BettingControls({ legal, busy, onMove, currentBet }) {
  const [target, setTarget] = useState(legal.minRaiseTo / 2);
  useEffect(() => { setTarget(legal.minRaiseTo / 2); }, [legal.minRaiseTo, legal.maxRaiseTo, currentBet]);
  const chips = Number(target) * 2;
  const valid = target !== '' && Number.isInteger(chips) && chips >= legal.minRaiseTo && chips <= legal.maxRaiseTo;
  return <div className="holdem-controls">
    <div className="arena-actions" aria-label="Table actions">
      {legal.canFold && <button type="button" className="button arena-fold" disabled={busy} onClick={() => onMove('fold')}>Fold</button>}
      <button type="button" className="button primary" disabled={busy} onClick={() => onMove(legal.canCheck ? 'check' : 'call')}>
        {legal.canCheck ? 'Check' : `Call ${bb(legal.callCost / 2)} bb${legal.callCost < legal.toCall ? ' · all-in' : ''}`}
      </button>
      {legal.canRaise && <button type="button" className="button primary" disabled={busy || !valid} onClick={() => onMove({ type: 'raise', to: chips })}>{currentBet === 0 ? 'Bet' : 'Raise to'} {valid ? bb(chips / 2) : '…'} bb</button>}
      {legal.canRaise && legal.maxRaiseTo !== legal.minRaiseTo && <button type="button" className="button" disabled={busy} onClick={() => onMove('allin')}>All-in · {bb((legal.maxRaiseTo) / 2)} bb total</button>}
    </div>
    {legal.canRaise && <label className="raise-sizing">{currentBet ? 'Raise-to total this street' : 'Bet size'} (bb)
      <input aria-label="Raise-to amount in big blinds" type="number" step="0.5" min={legal.minRaiseTo / 2} max={legal.maxRaiseTo / 2} value={target} disabled={busy} onChange={event => setTarget(event.target.value)} />
      <input aria-label="Bet sizing slider" type="range" step="0.5" min={legal.minRaiseTo / 2} max={legal.maxRaiseTo / 2} value={valid ? target : legal.minRaiseTo / 2} disabled={busy} onChange={event => setTarget(event.target.value)} />
    </label>}
    <p className="caption">{!legal.canRaise && legal.toCall ? 'Raising is not available: action has not reopened, or no opponent can contest a further bet.' : legal.shortAllIn ? 'Your remaining stack permits only a short all-in raise.' : 'Amounts labelled “raise to” include chips you have already put in this street.'}</p>
  </div>;
}

function HoldemGame({ active }) {
  const [game, setGame] = useState(() => ({ hand: createMatch(), played: 0, wins: 0 }));
  const [muted, setMuted] = useState(false);
  const [quick, setQuick] = useState(false);
  const [dealStep, setDealStep] = useState(0);
  const [opening, setOpening] = useState(true);
  const [frame, setFrame] = useState(null);
  const [queue, setQueue] = useState([]);
  const [flight, setFlight] = useState(null);
  const locked = useRef(false);
  const stage = useRef(null);
  const reduced = useReducedMotion();
  const hand = frame?.hand || game.hand;
  const dealing = dealStep < hand.dealOrder.length;
  const busy = dealing || frame !== null || opening;
  const complete = hand.phase === 'complete';
  const reveal = hand.showdown && (complete || frame?.event === 'showdown');
  const matchOver = complete && (hand.players[0].stack === 0 || !hand.players.slice(1).some(player => player.stack > 0));
  const winner = complete && hand.winners.includes(0);
  const heroLegal = legalActions(hand, 0) || legalActions(game.hand, 0);
  const event = frame?.event;
  const actor = frame?.actor;

  function startFrames(frames) {
    if (!frames.length) return;
    locked.current = true;
    setFrame(frames[0]); setQueue(frames.slice(1));
  }
  function commit(final) {
    setGame(previous => {
      // Skip and the last playback timer may arrive together; count a hand only once.
      const finished = final.phase === 'complete' && !(previous.hand.phase === 'complete' && previous.hand.number === final.number);
      return { hand: final, played: previous.played + Number(finished), wins: previous.wins + Number(finished && final.winners.includes(0)) };
    });
    setFrame(null); setQueue([]); locked.current = false;
  }

  useEffect(() => {
    if (!active || !dealing) return;
    const timer = setTimeout(() => setDealStep(step => step + 1), reduced ? 12 : quick ? 50 : 140);
    return () => clearTimeout(timer);
  }, [active, dealing, dealStep, quick, reduced]);

  useEffect(() => {
    if (!active || dealing || !opening || frame) return;
    setOpening(false);
    startFrames(planOpening(game.hand));
  }, [active, dealing, opening, frame, game.hand]);

  useEffect(() => {
    if (!active || !frame) return;
    const duration = reduced ? 12 : quick ? 65 : event === 'thinking' ? 450 : event === 'showdown' ? 900 : event === 'street' ? 650 : event === 'award' ? 700 : 300;
    const timer = setTimeout(() => {
      if (queue.length) { setFrame(queue[0]); setQueue(previous => previous.slice(1)); }
      else commit(frame.hand);
    }, duration);
    return () => clearTimeout(timer);
  }, [active, frame, queue, quick, reduced]);

  // Measure the actual card targets, including the horizontally scrollable mobile seats.
  useLayoutEffect(() => {
    if (!active || !stage.current) return;
    const update = () => {
      const bounds = stage.current.getBoundingClientRect();
      const deck = stage.current.querySelector('.dealer-deck').getBoundingClientRect();
      const id = dealing ? hand.dealOrder[dealStep] : actor;
      const cards = stage.current.querySelector(`[data-seat="${id}"] .${id === 0 ? 'table-cards' : 'bot-cards'}`);
      const index = dealing && dealStep >= hand.dealOrder.length / 2 ? 1 : 0;
      const target = cards?.children[index]?.getBoundingClientRect();
      if (target) setFlight({ '--origin-x': `${deck.left - bounds.left}px`, '--origin-y': `${deck.top - bounds.top}px`, '--target-x': `${target.left - bounds.left + target.width / 2}px`, '--target-y': `${target.top - bounds.top}px`, '--start-x': `${target.left - bounds.left}px`, '--start-y': `${target.top - bounds.top}px` });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active, dealStep, dealing, actor, hand.number]);

  useEffect(() => {
    if (!active || !(actor > 0)) return;
    const seats = stage.current?.querySelector('.arena-seats');
    const seat = seats?.querySelector(`[data-seat="${actor}"]`);
    if (seat && seats.scrollWidth > seats.clientWidth) seats.scrollTo({ left: seat.offsetLeft - (seats.clientWidth - seat.offsetWidth) / 2, behavior: 'instant' });
  }, [active, actor]);

  function move(action) { if (!busy && !locked.current) startFrames(planAction(game.hand, action)); }
  function freshTable() {
    if (busy) return;
    setDealStep(0); setOpening(true); setFrame(null); setQueue([]); locked.current = false;
    setGame({ hand: createMatch(), played: 0, wins: 0 });
  }
  function dealNext() {
    if (busy || !complete) return;
    if (matchOver) { freshTable(); return; }
    setDealStep(0); setOpening(true);
    setGame(previous => ({ ...previous, hand: nextHand(previous.hand) }));
  }
  function skip() {
    if (dealing) setDealStep(hand.dealOrder.length);
    else if (frame) commit(queue.at(-1)?.hand || frame.hand);
  }

  const announcement = dealing ? `Dealer is handing out hole cards · ${dealStep} / ${hand.dealOrder.length}`
    : event === 'thinking' ? `${hand.players[actor].name} (${profileFor(hand.players[actor].archetype).label}) is thinking…`
    : event === 'showdown' ? 'Showdown. Turn the cards over…'
    : event === 'award' ? 'Awarding the main pot and any side pots…'
    : frame ? hand.log.at(-1) : complete ? 'Hand complete. Review every street below.'
    : `Your turn · ${STREETS[hand.street]} · ${heroLegal?.toCall ? `${bb(heroLegal.callCost / 2)}bb to call` : 'You may check'}.`;

  return <div className="arena-layout"><section className="panel arena-game">
    <div className="panel-title"><div><span className="eyebrow">{hand.players.length - 1} OPPONENT{hand.players.length > 2 ? 'S' : ''} · RANDOM ARCHETYPES</span><h2>Full-hand challenge <span className="muted">· Hand {hand.number}</span></h2></div><div className="arena-table-controls">
      <button type="button" className="button" aria-pressed={quick} onClick={() => setQuick(value => !value)}>{quick ? 'Quick play' : 'Cinematic play'}</button>
      <button type="button" className="button bubble-toggle" aria-pressed={!muted} onClick={() => setMuted(value => !value)}>{muted ? 'Show table talk' : 'Mute table talk'}</button>
      <button type="button" className="button" disabled={busy} onClick={freshTable}>New random table</button>
    </div></div>
    <ol className="arena-streets" aria-label="Hand progress">{STREETS.map((street, index) => <li key={street} aria-current={index === hand.street ? 'step' : undefined} className={index <= hand.street ? 'reached' : ''}>{street}</li>)}</ol>
    <div className={`dealer-status${!busy ? ' your-turn' : ''}`} role="status"><span className="dealer-token" aria-hidden="true">D</span><span>{announcement}</span>{busy && <button type="button" className="skip-playback" onClick={skip}>Skip animations →</button>}</div>
    <div ref={stage} className={`arena-stage animated-table holdem-table${muted ? ' quiet-table' : ''}${dealing ? ' is-dealing' : ''}`} data-dealing={dealing} data-playing={frame !== null} style={{ '--seat-count': Math.min(4, hand.players.length - 1) }}>
      <div className="arena-felt"><span className="arena-wordmark">PokerTool</span></div>
      <div className="dealer-deck" aria-label="Dealer deck"><span>♠</span><small>DEALER</small></div>
      {dealing && !reduced && flight && <span key={`${hand.number}-${dealStep}`} className="flying-deal-card" aria-hidden="true" style={{ ...flight, '--flight-time': quick ? '45ms' : '130ms' }}>♠</span>}
      <div className="arena-seats">{hand.players.slice(1).map(player => <BotSeat key={player.id} player={player} hand={hand} reveal={reveal} muted={muted} dealStep={dealStep} thinking={event === 'thinking' && actor === player.id} event={actor === player.id ? event : ''} winner={complete && hand.winners.includes(player.id)} />)}</div>
      <p className="mobile-seat-hint">Swipe the opponents to inspect every seat →</p>
      <div className="arena-community"><span className="arena-pot" key={`${hand.number}-${hand.pot}`}>{complete ? `AWARDED · ${bb(hand.awarded / 2)} BB` : `POT · ${bb(hand.pot / 2)} BB`}</span>
        <div className="table-cards" aria-label={`${STREETS[hand.street]} board`}>{Array.from({ length: 5 }, (_, index) => hand.board[index] ? <PlayingCard key={`${hand.number}-${index}`} rank={hand.board[index][0]} suit={hand.board[index][1]} index={index} /> : <span key={index} className="board-card-space" aria-label="Community card not dealt" />)}</div>
        <span className="arena-street">{STREETS[hand.street].toUpperCase()} · BLINDS 0.5 / 1 BB</span>
      </div>
      {frame?.amount > 0 && <div className="travelling-chips" key={`${hand.log.length}-${actor}`} style={flight || {}} aria-hidden="true"><span /><span /><span /><b>{bb(frame.amount / 2)} bb</b></div>}
      <div data-seat="0" className={`arena-hero${winner ? ' winner' : ''}${!busy && !complete ? ' hero-active' : ''}`}>
        <div className="table-cards">{hand.players[0].cards.map(([rank, suit], index) => dealStep > (index ? hand.dealOrder.lastIndexOf(0) : hand.dealOrder.indexOf(0)) ? <PlayingCard key={`${hand.number}-${index}`} rank={rank} suit={suit} index={0} /> : <span key={index} className="hero-card-space" />)}</div>
        <strong>{winner ? '★ YOU WIN' : `YOU · ${hand.players[0].position}`} <span>{bb(hand.players[0].stack / 2)} bb</span></strong>{hand.players[0].folded && <span className="fold-label">FOLDED</span>}{hand.players[0].allIn && <span className="fold-label">ALL-IN</span>}
      </div>
      {winner && <div className="winner-sparks" aria-hidden="true">✦ <span>✧</span> ✦</div>}
    </div>
    <div className="decision-context"><span>Your position<strong>{hand.players[0].position}</strong></span><span>Already in this street<strong>{bb(hand.players[0].streetBet / 2)} bb</strong></span><span>Current bet total<strong>{bb(hand.currentBet / 2)} bb</strong></span><span>To call<strong>{complete ? '—' : `${bb(Math.min(hand.players[0].stack, Math.max(0, hand.currentBet - hand.players[0].streetBet)) / 2)} bb`}</strong></span></div>
    <div className="arena-decision" aria-live="polite">{complete ? <div className={`arena-outcome ${winner ? 'won' : 'lost'}`}><strong>{winner ? '✦ You win a pot!' : 'This hand goes to the opposition.'}</strong><p>{hand.result}</p>{hand.showdown && !hand.players[0].folded && <span>Your hand: {handLabels[hand.players[0].rank[0]]}</span>}{hand.pots?.filter(pot => !pot.refund).length > 1 && <span> · Main pot and side pots are detailed in the action history.</span>}</div> : <p>{busy ? 'Follow the table action, or skip to your next decision.' : `It’s your decision on the ${STREETS[hand.street].toLowerCase()}. Review the action history before you act.`}</p>}</div>
    {complete ? <div className="arena-actions"><button type="button" className="button primary" disabled={busy} onClick={dealNext}>{matchOver ? 'New match · refill stacks' : 'Deal next hand →'}</button></div> : heroLegal ? <BettingControls legal={heroLegal} busy={busy} onMove={move} currentBet={hand.currentBet} /> : <div className="arena-actions"><button type="button" className="button" disabled>Waiting for the table…</button></div>}
  </section><aside className="arena-sidebar">
    <section className="panel"><div className="panel-title"><h2>Your match</h2><span className="tag">VIRTUAL CHIPS</span></div><div className="practice-metrics"><div><strong>{game.played}</strong><span>Hands finished</span></div><div><strong>{game.wins}</strong><span>Pots shared / won</span></div><div><strong>{bb((hand.players[0].stack - 200) / 2)}</strong><span>Net bb {complete ? '' : '(in play)'}</span></div></div></section>
    <section className="panel arena-action-log"><div className="panel-title"><h2>Full hand history</h2><span className="tag">EVERY STREET</span></div>{STREETS.map(street => { const entries = hand.history.filter(entry => entry.street === street); return entries.length > 0 && <section className="history-street" key={street}><h3>{street}</h3><ol>{entries.map((entry, index) => <li key={index}>{entry.text}</li>)}</ol></section>; })}</section>
    <details className="panel roster-guide"><summary>Meet this table’s archetypes</summary>{hand.players.slice(1).map(player => { const profile = profileFor(player.archetype); return <article key={player.id}><strong>{profile.avatar} {player.name} · {profile.label}</strong><p>{profile.description}</p></article>; })}</details>
    <section className="learning-note"><span>✳</span><h3>The whole hand. The whole story.</h3><p>Every hand starts preflop. The dealer button rotates, blinds are posted, and community cards arrive only after the betting round closes.</p><p>Opponents use their own hole cards, the visible board, position, price, and observed actions. Archetypes influence their decisions; speech bubbles are fictional table talk.</p><p>Betting includes legal raises, all-ins, main pots and side pots. “GTO-oriented” means mixed heuristic play, not a computed equilibrium. No bot is unbeatable.</p><p>Chips are virtual. Your table stays together between hands; New random table picks 1–8 new opponents.</p></section>
  </aside></div>;
}

function ReadGame() {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  const [score, setScore] = useState(0);
  const question = tellQuestions[index];
  const persona = personalities[question.bot];
  const answered = choice !== null;
  const correct = choice === question.answer;
  function choose(value) {
    if (answered) return;
    setChoice(value);
    if (value === question.answer) setScore(previous => previous + 1);
  }
  return <section className="panel read-game"><div className="panel-title"><h2>Read the opponent</h2><span className="tag">QUESTION {index + 1} / {tellQuestions.length} · {score} CORRECT</span></div>
    <div className={`read-persona ${persona.colour}`}><span className="bot-avatar" aria-hidden="true">{persona.avatar}</span><div><h3>{persona.name}</h3><p>{persona.title}</p></div></div>
    <div className="read-speech">“{question.line}”</div><h3 className="read-question">{question.question}</h3><div className="read-options">{question.options.map((text, value) => <button type="button" key={text} disabled={answered} className={answered && value === question.answer ? 'right-answer' : choice === value ? 'wrong-answer' : ''} onClick={() => choose(value)}><span>{value + 1}</span>{text}{answered && value === question.answer && ' ✓'}</button>)}</div>
    {answered && <div className={`answer-indicator ${correct ? 'correct' : 'incorrect'}`} role="status">{correct ? '✓ Correct.' : '✕ Not quite.'} {question.explanation}</div>}
    <div className="read-footer"><p className="caption">Personality is a clue, never proof of a hand. These are curated teaching questions.</p>{answered && <button type="button" className="button primary" onClick={() => { setChoice(null); if (index === tellQuestions.length - 1) { setIndex(0); setScore(0); } else setIndex(value => value + 1); }}>{index === tellQuestions.length - 1 ? 'Play again ↻' : 'Next opponent →'}</button>}</div>
  </section>;
}

export default function Arena({ active }) {
  const [mode, setMode] = useState('holdem');
  return <section className="page" id="arena"><div className="page-title"><div><p className="eyebrow">REAL PERSONALITIES. PLAYFUL RIVALRIES.</p><h1>AI Arena<span>.</span></h1><p>Meet your opponents. Find your edge. Enjoy the table talk.</p></div><span className="pill outlined">Local simulated bots · no API needed</span></div>
    <div className="arena-mode-switch segmented" role="group" aria-label="Arena game"><button type="button" className={mode === 'holdem' ? 'selected' : ''} aria-pressed={mode === 'holdem'} onClick={() => setMode('holdem')}>♠ Full-hand challenge</button><button type="button" className={mode === 'read' ? 'selected' : ''} aria-pressed={mode === 'read'} onClick={() => setMode('read')}>☏ Read the opponent</button></div>
    <div hidden={mode !== 'holdem'}><HoldemGame active={active && mode === 'holdem'} /></div><div hidden={mode !== 'read'}><ReadGame /></div>
  </section>;
}
