import { useEffect, useRef, useState } from 'react';
import PlayingCard from '../components/PlayingCard';
import { planAction, dealHand, handLabels, personalities, tellQuestions } from '../arena';

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

function BotSeat({ player, reveal, muted, dealStep, thinking, event, winner }) {
  const persona = personalities[player.id - 1];
  return <article className={`arena-bot ${persona.colour}${player.folded ? ' folded' : ''}${thinking ? ' thinking' : ''}${winner ? ' celebrating' : ''}`}
    aria-label={`${persona.name}, ${persona.title}`} data-actor={player.id}>
    {!muted && <div className={`speech-bubble${thinking ? ' thought-bubble' : ''}`} key={`${thinking}-${player.bubble}`}>
      {thinking ? <><div className="thinking-dots" aria-label={`${persona.name} is thinking`}><i /><i /><i /></div><span>THINKING…</span></> : <><p>{player.bubble}</p><span>TABLE TALK</span></>}
    </div>}
    <div className={`bot-avatar ${event || ''}`} aria-hidden="true">{persona.avatar}</div>
    <h3>{persona.name}{winner && ' ★'}</h3><p className="bot-personality">{persona.title}</p><strong className="bot-stack">{bb(player.stack)} bb</strong>
    <div className={`bot-cards${player.folded ? ' mucked-cards' : ''}`}>
      {player.cards.map(([rank, suit], index) => reveal && !player.folded
        ? <span className="showdown-flip" key={index}><PlayingCard rank={rank} suit={suit} index={index} /></span>
        : <CardBack key={index} delivered={dealStep > player.id - 1 + index * 4} />)}
    </div>
    {player.folded && <span className="fold-label">FOLDED</span>}
    {thinking && <span className="turn-label">DECIDING</span>}
  </article>;
}

function RiverGame({ active }) {
  const [game, setGame] = useState(() => ({ hand: dealHand(), played: 0, wins: 0 }));
  const [muted, setMuted] = useState(false);
  const [quick, setQuick] = useState(false);
  const [dealStep, setDealStep] = useState(0);
  const [frame, setFrame] = useState(null);
  const [queue, setQueue] = useState([]);
  const locked = useRef(false);
  const reduced = useReducedMotion();
  const hand = frame?.hand || game.hand;
  const dealing = dealStep < 13;
  const busy = dealing || frame !== null;
  const complete = hand.phase === 'complete';
  const reveal = complete || frame?.event === 'showdown';
  const needsReset = complete && hand.players.some(player => player.stack < 11);
  const winner = complete && hand.winners.includes(0);

  // The deal pauses when this screen is hidden and resumes when the player returns.
  useEffect(() => {
    if (!active || dealStep >= 13) return;
    const timer = setTimeout(() => setDealStep(step => step + 1), reduced ? 15 : quick ? 70 : 180);
    return () => clearTimeout(timer);
  }, [active, dealStep, quick, reduced]);

  // Play immutable engine snapshots in order. Only the final frame commits a score.
  useEffect(() => {
    if (!active || !frame) return;
    const duration = reduced ? 25 : quick ? 100 : frame.event === 'thinking' ? 650 : frame.event === 'showdown' ? 1000 : frame.event === 'award' ? 850 : 450;
    const timer = setTimeout(() => {
      if (queue.length) {
        setFrame(queue[0]);
        setQueue(previous => previous.slice(1));
      } else {
        const finished = frame.hand.phase === 'complete';
        setGame(previous => ({ hand: frame.hand, played: previous.played + Number(finished), wins: previous.wins + Number(finished && frame.hand.winners.includes(0)) }));
        setFrame(null);
        locked.current = false;
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [active, frame, queue, quick, reduced]);

  function move(action) {
    if (busy || locked.current) return;
    const frames = planAction(game.hand, action);
    if (!frames.length) return;
    locked.current = true;
    setFrame(frames[0]);
    setQueue(frames.slice(1));
  }

  function nextHand() {
    if (busy || locked.current || !complete) return;
    setDealStep(0);
    if (needsReset) setGame({ hand: dealHand(), played: 0, wins: 0 });
    else setGame(previous => ({ ...previous, hand: dealHand(previous.hand.players.map(player => player.stack), previous.hand.number + 1) }));
  }

  const event = frame?.event;
  const actor = frame?.actor;
  const announcement = dealing ? `Dealer is handing out cards · ${dealStep} / 13`
    : event === 'thinking' ? `${hand.players[actor].name} is thinking…`
    : event === 'showdown' ? 'Showdown. Turn the cards over…'
    : event === 'award' ? 'Sending the pot to the winning hand…'
    : frame ? hand.log.at(-1)
    : complete ? 'Hand complete. Ready for the next deal?'
    : hand.phase === 'facing' ? `${hand.players[hand.bettor].name} bets 4bb. Call or fold?`
    : 'Your turn. Check or choose a bet.';
  const recipient = dealStep < 8 ? [1, 2, 3, 0][dealStep % 4] : 'board';
  const targetX = recipient === 'board' ? `calc(50% + ${(dealStep - 10) * 43}px)` : ['50%', '17%', '50%', '83%'][recipient];
  const targetY = recipient === 0 ? '84%' : recipient === 'board' ? '66%' : recipient === 2 ? '42%' : '49%';

  return <div className="arena-layout"><section className="panel arena-game">
    <div className="panel-title"><div><span className="eyebrow">FOUR SEATS. THREE PERSONALITIES.</span><h2>River showdown <span className="muted">· Hand {hand.number}</span></h2></div><div className="arena-table-controls">
      <button type="button" className="button" aria-pressed={quick} onClick={() => setQuick(value => !value)}>{quick ? 'Quick play' : 'Cinematic play'}</button>
      <button type="button" className="button bubble-toggle" aria-pressed={!muted} onClick={() => setMuted(value => !value)}>{muted ? 'Show table talk' : 'Mute table talk'}</button>
    </div></div>
    <div className={`dealer-status${!busy ? ' your-turn' : ''}`} role="status"><span className="dealer-token" aria-hidden="true">D</span>{announcement}</div>
    <div className={`arena-stage animated-table${muted ? ' quiet-table' : ''}${dealing ? ' is-dealing' : ''}`} data-dealing={dealing} data-playing={frame !== null}>
      <div className="arena-felt"><span className="arena-wordmark">PokerTool</span></div>
      <div className="dealer-deck" aria-label="Dealer deck"><span>♠</span><small>DEALER</small></div>
      {dealing && !reduced && <span key={`${hand.number}-${dealStep}`} className="flying-deal-card" aria-hidden="true" style={{ '--target-x': targetX, '--target-y': targetY, '--flight-time': quick ? '65ms' : '170ms' }}>♠</span>}
      <div className="arena-seats">{hand.players.slice(1).map(player => <BotSeat key={player.id} player={player} reveal={reveal} muted={muted} dealStep={dealStep} thinking={event === 'thinking' && actor === player.id} event={actor === player.id ? event : ''} winner={complete && hand.winners.includes(player.id)} />)}</div>
      <div className="arena-community"><span className="arena-pot" key={`${hand.number}-${hand.pot}`}>{complete ? `POT AWARDED · ${bb(hand.awarded)} BB` : `POT · ${bb(hand.pot)} BB`}</span>
        <div className="table-cards">{hand.board.map(([rank, suit], index) => dealStep > 8 + index ? <PlayingCard key={`${hand.number}-${index}`} rank={rank} suit={suit} index={0} /> : <span key={index} className="board-card-space" />)}</div>
        <span className="arena-street">RIVER · NO-LIMIT HOLD’EM STUDY VARIANT</span>
      </div>
      {frame?.amount > 0 && <div className={`travelling-chips from-seat-${actor}`} key={`${hand.log.length}-${actor}`} aria-hidden="true"><span /><span /><span /><b>{frame.amount} bb</b></div>}
      {event === 'award' && hand.winners.map(id => <div className={`pot-award to-seat-${id}`} key={id} aria-hidden="true">● ● ●</div>)}
      <div className={`arena-hero${winner ? ' winner' : ''}${!busy && !complete ? ' hero-active' : ''}`}>
        <div className="table-cards">{hand.players[0].cards.map(([rank, suit], index) => dealStep > 3 + index * 4 ? <PlayingCard key={`${hand.number}-${index}`} rank={rank} suit={suit} index={0} /> : <span key={index} className="hero-card-space" />)}</div>
        <strong>{winner ? '★ YOU WIN' : 'YOU'} <span>{bb(hand.players[0].stack)} bb</span></strong>{hand.players[0].folded && <span className="fold-label">FOLDED</span>}
      </div>
      {winner && <div className="winner-sparks" aria-hidden="true">✦ <span>✧</span> ✦</div>}
    </div>
    <div className="arena-decision" aria-live="polite">
      {complete ? <div className={`arena-outcome ${winner ? 'won' : 'lost'}`}><strong>{winner ? '✦ You take a share of the pot!' : 'This pot goes to the opposition.'}</strong><p>{hand.result}</p>{!hand.players[0].folded && <span>Your hand: {handLabels[hand.players[0].rank[0]]}</span>}</div>
        : <p>{busy ? 'Watch the table action above.' : hand.phase === 'facing' ? `${hand.players[hand.bettor].name} bets 4bb. Call or fold?` : 'The river is dealt. You’re first to act: check or choose a bet.'}</p>}
    </div>
    <div className="arena-actions" aria-label="Table actions">
      {!complete && hand.phase === 'player' && <><button type="button" className="button" disabled={busy} onClick={() => move('check')}>Check</button><button type="button" className="button primary" disabled={busy} onClick={() => move('bet4')}>Bet 4 bb</button><button type="button" className="button primary" disabled={busy} onClick={() => move('bet8')}>Bet 8 bb</button></>}
      {!complete && hand.phase === 'facing' && <><button type="button" className="button arena-fold" disabled={busy} onClick={() => move('fold')}>Fold</button><button type="button" className="button primary" disabled={busy} onClick={() => move('call')}>Call 4 bb</button></>}
      {complete && <button type="button" className="button primary" disabled={busy} onClick={nextHand}>{needsReset ? 'Refill all stacks · new match' : 'Deal next hand →'}</button>}
    </div>
  </section><aside className="arena-sidebar"><section className="panel"><div className="panel-title"><h2>Your match</h2><span className="tag">VIRTUAL CHIPS</span></div><div className="practice-metrics"><div><strong>{game.played}</strong><span>Hands finished</span></div><div><strong>{game.wins}</strong><span>Pots shared / won</span></div><div><strong>{bb(hand.players[0].stack - 100)}</strong><span>Net bb {complete ? '' : '(in play)'}</span></div></div></section>
    <section className="panel arena-action-log"><div className="panel-title"><h2>Table action</h2><span className="live-dot" /></div><ol aria-live="polite">{hand.log.map((line, index) => <li key={`${hand.number}-${index}`}>{line}</li>)}</ol></section>
    <section className="learning-note"><span>✳</span><h3>Learn the player. Read the spot.</h3><p>Watch the dealer distribute cards, then act when your seat lights up. Opponents think and respond in turn. Pick Quick play for shorter waits.</p><p>Each hand starts on the river with a 12bb pot: 3bb contributed by each player. Opponents can call, fold, or make one 4bb bet after a check. No raises or side pots.</p><p>Speech bubbles are fictional table talk, not hidden cards or an AI model’s private reasoning. Bots use local rules; the AI Coach is separate.</p><p>Showdowns use the best five of seven cards and split tied pots. Chips are virtual. Leaving this screen pauses the action; returning resumes it.</p></section>
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
  const [mode, setMode] = useState('river');
  return <section className="page" id="arena"><div className="page-title"><div><p className="eyebrow">REAL PERSONALITIES. PLAYFUL RIVALRIES.</p><h1>AI Arena<span>.</span></h1><p>Meet your opponents. Find your edge. Enjoy the table talk.</p></div><span className="pill outlined">Local simulated bots · no API needed</span></div>
    <div className="arena-mode-switch segmented" role="group" aria-label="Arena game"><button type="button" className={mode === 'river' ? 'selected' : ''} aria-pressed={mode === 'river'} onClick={() => setMode('river')}>♠ River showdown</button><button type="button" className={mode === 'read' ? 'selected' : ''} aria-pressed={mode === 'read'} onClick={() => setMode('read')}>☏ Read the opponent</button></div>
    <div hidden={mode !== 'river'}><RiverGame active={active && mode === 'river'} /></div><div hidden={mode !== 'read'}><ReadGame /></div>
  </section>;
}
