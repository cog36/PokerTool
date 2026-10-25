import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { canSkipReviewedHand, reviewMessage } from '../arenaReview';
import useArenaSound from '../useArenaSound';
import PlayingCard from '../components/PlayingCard';
import PlayerPortrait from '../components/PlayerPortrait';
import PlayerDetails from '../components/PlayerDetails';
import DealerHand from '../components/DealerHand';
import { arenaPosition, arenaText } from '../positions';
import CoachReply from '../components/CoachReply';
import { planAction, planOpening, createTournamentHand, decisionView, legalActions, STREETS, handLabels, personalities, tellQuestions } from '../arena';
import { profileFor } from '../archetypes';

// Rotate the view around the human; poker positions still follow the shuffled seats.
const seatCoordinates = [[50, 81], [23, 75], [10, 48], [28, 25], [50, 20], [72, 25], [90, 48], [77, 75]];
const newArenaMatch = (number, previous = null) => createTournamentHand({ number: number || 1, previous });

const displaySeat = (hand, player) => ((player.seat ?? player.id) - hand.players[0].seat + 8) % 8;

const compactType = profile => ({ exploit: 'Exploitative reg', gto: 'GTO reg', tricky: 'Deceptive', station: 'Calling station', fitfold: 'Fit or fold', abc: 'ABC' }[profile.id] || profile.label);

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

// The chip pile is the current street total; a Call label shows the extra amount paid.
function SeatWager({ player, street, complete }) {
  const action = player.lastAction?.street === street ? player.lastAction : null;
  const amount = complete ? 0 : player.streetBet;
  if (!action && !amount) return null;
  const label = action ? `${action.type === 'blind' ? action.label === 'Small blind' ? 'SB' : 'BB' : action.label}${['raise', 'call', 'blind'].includes(action.type) ? ` ${action.type === 'raise' ? 'to ' : ''}${bb((action.type === 'raise' ? action.total : action.amount) / 2)}bb` : ''}${action.allIn ? ' · All-in' : ''}` : '';
  return <div className="seat-wager" data-player={player.id} aria-label={`${player.name}: ${label}${amount ? `; ${bb(amount / 2)}bb in front this street` : ''}`}>
    {label && <span className={`wager-action${action?.type === 'fold' ? ' folded-action' : ''}`}>{label}</span>}
    {amount > 0 && <div className="wager-pile"><span className="chip-pile" aria-hidden="true"><i /><i /><i /></span><strong>{bb(amount / 2)}<small>bb</small></strong></div>}
  </div>;
}

function BotSeat({ player, hand, reveal, muted, dealStep, thinking, event, winner, onInspect }) {
  const persona = profileFor(player.archetype);
  const [x, y] = seatCoordinates[displaySeat(hand, player)];
  return <article className={`arena-bot ${persona.colour}${player.folded || !player.inHand ? ' folded' : ''}${thinking ? ' thinking' : ''}${winner ? ' celebrating' : ''}${event && event !== 'thinking' ? ' speaking' : ''}`}
    role="button" onClick={() => onInspect(player.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onInspect(player.id); } }} aria-haspopup="dialog" tabIndex={0} style={{ '--seat-x': `${x}%`, '--seat-y': `${y}%` }}
    aria-label={`${persona.name}, ${persona.label}`} data-seat={player.id} data-physical-seat={displaySeat(hand, player)}>
    {!muted && <div className={`speech-bubble${thinking ? ' thought-bubble' : ''}`} key={`${thinking}-${player.bubble}`}>
      {thinking ? <><div className="thinking-dots" aria-label={`${persona.name} is thinking`}><i /><i /><i /></div><span>THINKING…</span></> : <><p>{player.inHand ? player.bubble : 'Out of chips. Watching this hand.'}</p><span>TABLE TALK</span></>}
    </div>}
    <div className={`bot-avatar ${event || ''}`} aria-hidden="true"><PlayerPortrait type={player.archetype} /></div>
    <h3>{hand.button === player.id && <span className="seat-dealer" aria-label="Dealer button">D</span>}{persona.name}{winner && ' ★'}</h3><span className="archetype-tag" title={persona.description}>{compactType(persona)}</span>
    <p className="bot-personality">{arenaPosition(player.position)} {hand.button === player.id ? '· DEALER' : ''}</p><strong className="bot-stack">{bb(player.stack / 2)} bb</strong>
    <div className={`bot-cards${player.folded ? ' mucked-cards' : ''}`}>
      {player.cards.map(([rank, suit], index) => reveal && !player.folded
        ? <span className="showdown-flip" key={index}><PlayingCard rank={rank} suit={suit} index={index} /></span>
        : <CardBack key={index} delivered={dealStep > (index ? hand.dealOrder.lastIndexOf(player.id) : hand.dealOrder.indexOf(player.id))} />)}
    </div>
    {(player.folded || player.allIn || !player.inHand) && <span className="fold-label">{!player.inHand ? 'SITTING OUT' : player.folded ? 'FOLDED' : 'ALL-IN'}</span>}
    {thinking && <span className="turn-label">DECIDING</span>}
    <SeatWager player={player} street={hand.street} complete={hand.phase === 'complete'} />
  </article>;
}

function BettingControls({ legal, busy, onMove, currentBet, pot }) {
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
    {legal.canRaise && <div className="pot-presets" aria-label="Pot bet presets">{[33, 50, 75, 100].map(percent => {
      // Presets are raise-to totals based on the pot now, rounded to a half blind.
      const requested = Math.round(pot * percent / 100);
      const amount = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, requested));
      return <button type="button" className="button" disabled={busy} key={percent} onClick={() => setTarget(amount / 2)}>{percent}% pot · {bb(amount / 2)}bb</button>;
    })}</div>}
    <p className="caption">Presets use the current pot and adjust to the legal minimum or your stack. Type a custom amount above.</p>
    <p className="caption">{!legal.canRaise && legal.toCall ? 'Raising is not available: action has not reopened, or no opponent can contest a further bet.' : legal.shortAllIn ? 'Your remaining stack permits only a short all-in raise.' : 'Amounts labelled “raise to” include chips you have already put in this street.'}</p>
  </div>;
}

function HoldemGame({ active }) {
  const sound = useArenaSound(active);
  const soundedFrames = useRef(new WeakSet());
  const lastDealSound = useRef('');
  const [game, setGame] = useState(() => ({ hand: newArenaMatch(), played: 0, wins: 0, net: 0 }));
  const [inspectedPlayer, setInspectedPlayer] = useState(null);
  useEffect(() => { setInspectedPlayer(null); }, [game.hand.number, active]);
  const [reviews, setReviews] = useState([]);
  const [liveFeedback, setLiveFeedback] = useState(null);
  const seenFeedback = useRef(new Set());
  function showFeedback(items) {
    const fresh = items.filter(item => item && !seenFeedback.current.has(item.id));
    if (!fresh.length) return;
    fresh.forEach(item => seenFeedback.current.add(item.id));
    setLiveFeedback(fresh.at(-1));
    setReviews(previous => [...fresh.slice().reverse().map(item => ({ ...item, status: 'local' })), ...previous].slice(0, 12));
  }
  const reviewRequests = useRef(new Set());
  useEffect(() => () => reviewRequests.current.forEach(controller => controller.abort()), []);
  const [muted, setMuted] = useState(true);
  const [quick, setQuick] = useState(false);
  const [dealStep, setDealStep] = useState(0);
  const [opening, setOpening] = useState(true);
  const [frame, setFrame] = useState(null);
  const [queue, setQueue] = useState([]);
  const [flight, setFlight] = useState(null);
  const [collected, setCollected] = useState([]);
  const [decisionPrompt, setDecisionPrompt] = useState(null);
  useEffect(() => { if (decisionPrompt) setInspectedPlayer(null); }, [decisionPrompt]);
  const [tableScale, setTableScale] = useState(1);
  const locked = useRef(false);
  const stage = useRef(null);
  const tableViewport = useRef(null);
  useLayoutEffect(() => {
    if (!active || !tableViewport.current) return;
    const viewport = tableViewport.current;
    const fit = () => setTableScale(Math.min(1, viewport.clientWidth / 760, viewport.clientHeight / 620));
    const observer = new ResizeObserver(fit); observer.observe(viewport); fit();
    return () => observer.disconnect();
  }, [active]);
  useLayoutEffect(() => {
    if (!active) return;
    const centre = () => {
      const viewport = tableViewport.current;
      if (viewport) viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
    };
    centre();
    window.addEventListener('resize', centre);
    return () => window.removeEventListener('resize', centre);
  }, [active]);
  const reduced = useReducedMotion();
  const hand = frame?.hand || game.hand;
  const dealing = dealStep < hand.dealOrder.length;
  const busy = dealing || frame !== null || opening;
  const complete = hand.phase === 'complete';
  const reveal = hand.showdown && (complete || frame?.event === 'showdown');
  const winner = complete && hand.winners.includes(0);
  const heroLegal = legalActions(hand, 0) || legalActions(game.hand, 0);
  const event = frame?.event;
  const actor = frame?.actor;
  const heroReview = reviews.find(item => item.actor === 0 && item.id.startsWith(`${hand.number}-`));

  useEffect(() => {
    if (!active || !dealing) return;
    const key = `${hand.number}:${dealStep}`;
    if (lastDealSound.current === key) return;
    lastDealSound.current = key;
    sound.play('deal');
  }, [active, dealing, dealStep, hand.number, sound.play]);

  useEffect(() => {
    if (!active || !frame || soundedFrames.current.has(frame)) return;
    soundedFrames.current.add(frame);
    if (['fold', 'check', 'call', 'raise'].includes(frame.event)) sound.play(frame.event);
    else if (frame.event === 'street') sound.play('deal');
  }, [active, frame, sound.play]);


  useEffect(() => {
    if (active && frame?.feedback) showFeedback([frame.feedback]);
  }, [active, frame]);

  function startFrames(frames) {
    if (!frames.length) return;
    locked.current = true;
    setFrame(frames[0]); setQueue(frames.slice(1));
  }
  function commit(final) {
    setGame(previous => {
      // Skip and the last playback timer may arrive together; count a hand only once.
      const finished = final.phase === 'complete' && !(previous.hand.phase === 'complete' && previous.hand.number === final.number);
      return { hand: final, played: previous.played + Number(finished), wins: previous.wins + Number(finished && final.winners.includes(0)), net: previous.net + (finished ? final.players[0].stack - final.startingStacks[0] : 0) };
    });
    setFrame(null); setQueue([]); locked.current = false;
  }

  useEffect(() => {
    if (!active || !dealing) return;
    const timer = setTimeout(() => setDealStep(step => step + 1), reduced ? 12 : quick ? 80 : 260);
    return () => clearTimeout(timer);
  }, [active, dealing, dealStep, quick, reduced]);

  useEffect(() => {
    if (!active || dealing || !opening || frame) return;
    setOpening(false);
    startFrames(planOpening(game.hand));
  }, [active, dealing, opening, frame, game.hand]);

  useEffect(() => {
    if (!active || !frame || decisionPrompt) return;
    const duration = reduced ? 12 : quick ? 65 : event === 'thinking' ? 450 : event === 'showdown' ? 900 : event === 'street' ? 650 : event === 'award' ? 700 : 300;
    const timer = setTimeout(() => {
      if (queue.length) { setFrame(queue[0]); setQueue(previous => previous.slice(1)); }
      else commit(frame.hand);
    }, duration);
    return () => clearTimeout(timer);
  }, [active, frame, queue, quick, reduced, decisionPrompt]);

  // Measure the actual card targets, including the horizontally scrollable mobile seats.
  useLayoutEffect(() => {
    if (!active || !stage.current) return;
    const update = () => {
      const bounds = stage.current.getBoundingClientRect();
      const scale = bounds.width / stage.current.offsetWidth || 1;
      const px = value => `${value / scale}px`;
      const deck = stage.current.querySelector('.dealer-deck').getBoundingClientRect();
      const id = dealing ? hand.dealOrder[dealStep] : actor;
      const cards = stage.current.querySelector(`[data-seat="${id}"] .${id === 0 ? 'table-cards' : 'bot-cards'}`);
      const index = dealing && dealStep >= hand.dealOrder.length / 2 ? 1 : 0;
      const target = cards?.children[index]?.getBoundingClientRect();
      const wager = stage.current.querySelector(`[data-seat="${id}"] .wager-pile`)?.getBoundingClientRect();
      if (event === 'collect') {
        setCollected(hand.players.filter(player => player.streetBet > 0).flatMap(player => {
          const pile = stage.current.querySelector(`[data-seat="${player.id}"] .seat-wager`)?.getBoundingClientRect();
          return pile ? [{ id: player.id, '--from-x': px(pile.left - bounds.left + pile.width / 2), '--from-y': px(pile.top - bounds.top) }] : [];
        }));
      } else setCollected([]);
      if (target) setFlight({ '--origin-x': px(deck.left - bounds.left), '--origin-y': px(deck.top - bounds.top), '--target-x': px(target.left - bounds.left + target.width / 2), '--target-y': px(target.top - bounds.top), '--start-x': px(target.left - bounds.left), '--start-y': px(target.top - bounds.top), '--bet-end-x': px(wager ? wager.left - bounds.left + wager.width / 2 : target.left - bounds.left), '--bet-end-y': px(wager ? wager.top - bounds.top : target.top - bounds.top) });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active, dealStep, dealing, actor, hand.number, frame, tableScale]);

  useEffect(() => {
    if (!active || !(actor > 0)) return;
    const seats = stage.current?.querySelector('.arena-seats');
    const seat = seats?.querySelector(`[data-seat="${actor}"]`);
    if (seat && seats.scrollWidth > seats.clientWidth) seats.scrollTo({ left: seat.offsetLeft - (seats.clientWidth - seat.offsetWidth) / 2, behavior: 'instant' });
  }, [active, actor]);

  function move(action) {
    if (busy || locked.current) return;
    const before = game.hand;
    const frames = planAction(before, action);
    startFrames(frames);
    // Capture the decision BEFORE future cards or opponents' actions are revealed.
    const snapshot = decisionView(before, 0);
    const id = frames.find(item => item.feedback?.actor === 0)?.feedback.id;
    if (!id) return;
    const review = frames.find(item => item.feedback?.actor === 0)?.feedback;
    setDecisionPrompt(review);
    showFeedback([review]);
    const context = {
      preflopChart: frames.find(item => item.feedback?.actor === 0)?.feedback.chart || null,
      evaluationSource: frames.find(item => item.feedback?.actor === 0)?.feedback.source,
      decisionVerdict: review.assessment,
      legacyEstimate: review.estimated || false,
      legacyFallback: frames.find(item => item.feedback?.actor === 0)?.feedback.fallback || false,
      hand: before.number, street: STREETS[before.street], position: before.players[0].position,
      cards: snapshot.cards, board: snapshot.board, stackBB: before.players[0].stack / 2,
      potBB: before.pot / 2, toCallBB: snapshot.legal.callCost / 2,
      opponents: before.players.filter(p => p.id && p.inHand && !p.folded).map(p => ({ position: p.position, type: profileFor(p.archetype).label, stackBB: p.stack / 2 })),
      action: typeof action === 'object' ? { type: action.type, totalBB: action.to / 2 } : action,
      history: before.history.map(entry => entry.text).slice(-25),
    };
    setReviews(previous => previous.map(item => item.id === id ? { ...item, context, status: 'loading' } : item));
    requestReview(id, context);
  }
  async function requestReview(id, context) {
    const controller = new AbortController();
    reviewRequests.current.add(controller);
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ mode: 'constructive', messages: [{ role: 'user', content: `Review my MTT/SNG chip-EV decision in at most TWO short sentences, maximum 45 words: explain the main tradeoff and one improvement if warranted. No headings or emojis. For preflop, use preflopChart as the authoritative assessment: respect its assessment without replacing it with your own grade. Explain the move in plain poker language without mentioning charts or internal evaluation sources. If legacyFallback is true, use the existing heuristic analysis instead. Focus on the recommended move and its reason; do not mention charts, legacy logic or internal evaluation sources. Express uncertain advice as a suggestion; never invent a chart verdict, frequency or exact EV. Charts assess action category, not custom sizing, exact EV or ICM. For postflop (preflopChart is null), retain ordinary heuristic coaching. No live solver is connected: do not invent frequencies or exact EV. Qualify assumptions about opponent ranges. Sizes are big blinds, raises are totals. Use only this decision-time snapshot, not future results: ${JSON.stringify(context)}`.slice(0, 6000) }] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.detail?.message || 'The coach is unavailable. Start the Python API and check its configuration.');
      if (!data.reply?.trim()) throw new Error('The coach returned no feedback.');
      setReviews(previous => previous.map(item => item.id === id ? { ...item, status: 'ready', aiText: data.reply.trim() } : item));
    } catch (error) {
      setReviews(previous => previous.map(item => item.id === id ? { ...item, status: 'error', error: error.name === 'AbortError' ? 'Review timed out. Try again.' : error.message } : item));
    } finally { clearTimeout(timeout); reviewRequests.current.delete(controller); }
  }
  function skipHand() {
    setDecisionPrompt(null); setLiveFeedback(null); setDealStep(0); setOpening(true); setFrame(null); setQueue([]); locked.current = false;
    setGame(previous => ({ ...previous, hand: newArenaMatch(previous.hand.number + 1, previous.hand) }));
  }
  function freshTable() {
    if (busy) return;
    reviewRequests.current.forEach(controller => controller.abort());
    seenFeedback.current.clear(); setReviews([]); setLiveFeedback(null);
    setDealStep(0); setOpening(true); setFrame(null); setQueue([]); locked.current = false;
    setGame({ hand: newArenaMatch(1, game.hand), played: 0, wins: 0, net: 0 });
  }
  function dealNext() {
    if (busy || !complete) return;
    setDecisionPrompt(null); setLiveFeedback(null);
    setDealStep(0); setOpening(true);
    setGame(previous => ({ ...previous, hand: newArenaMatch(previous.hand.number + 1, previous.hand) }));
  }
  function skip() {
    if (dealing) setDealStep(hand.dealOrder.length);
    else if (frame) { showFeedback([frame, ...queue].map(item => item.feedback)); commit(queue.at(-1)?.hand || frame.hand); }
  }

  const announcement = dealing ? `Dealer is handing out hole cards · ${dealStep} / ${hand.dealOrder.length}`
    : event === 'thinking' ? `${hand.players[actor].name} (${profileFor(hand.players[actor].archetype).label}) is thinking…`
    : event === 'collect' ? 'Collecting the street bets into the pot…'
    : event === 'showdown' ? 'Showdown. Turn the cards over…'
    : event === 'award' ? 'Awarding the main pot and any side pots…'
    : frame ? hand.log.at(-1) : complete ? 'Hand complete. Review every street below.'
    : `Your turn · ${STREETS[hand.street]} · ${heroLegal?.toCall ? `${bb(heroLegal.callCost / 2)}bb to call` : 'You may check'}.`;

  return <div className="arena-layout arena-lounge"><section className="panel arena-game eight-seat-room">
    <div className="panel-title"><div className="arena-club-brand"><span className="club-mark" aria-hidden="true">♠</span><div><h2>Full-hand challenge <span className="muted">· Hand {hand.number}</span></h2></div></div><div className="arena-table-controls">
      <button type="button" className="button" aria-pressed={quick} onClick={() => setQuick(value => !value)}>{quick ? 'Quick play' : 'Cinematic play'}</button>
      <button type="button" className="button arena-sound-toggle" aria-pressed={sound.enabled} disabled={!sound.supported} title={sound.error || 'Card-dealing sounds and action chimes'} onClick={sound.toggle}>{sound.enabled ? 'Mute sounds' : 'Enable sound'}</button>
      <button type="button" className="button bubble-toggle" aria-pressed={!muted} onClick={() => setMuted(value => !value)}>{muted ? 'Show table talk' : 'Mute table talk'}</button>
      <button type="button" className="button" onClick={event => { const room = event.currentTarget.closest('.eight-seat-room'); if (document.fullscreenElement) document.exitFullscreen?.(); else room.requestFullscreen?.().catch(() => {}); }}>Fullscreen</button>
      <button type="button" className="button" disabled={busy} onClick={freshTable}>New random table</button>
    </div></div>
    {sound.error && <span className="arena-audio-error" role="status">{sound.error}</span>}
    <ol className="arena-streets" aria-label="Hand progress">{STREETS.map((street, index) => <li key={street} aria-current={index === hand.street ? 'step' : undefined} className={index <= hand.street ? 'reached' : ''}>{street}</li>)}</ol>
    <div className={`dealer-status${!busy ? ' your-turn' : ''}`} role="status"><span className="dealer-token" aria-hidden="true">D</span><span>{arenaText(announcement)}</span>{busy && <button type="button" className="skip-playback" onClick={skip}>Skip animations →</button>}</div>
    <section className="decision-reviews" aria-label="Live decision feedback">
      <header><span className="feedback-dot" /><h2>Table insight</h2><span className="caption">Live feedback</span></header>
      <div className="live-feedback" role="status" aria-live="polite">
        {liveFeedback ? <><strong>{liveFeedback.name} · {arenaPosition(liveFeedback.position)} · {liveFeedback.label}</strong><p>{arenaText(reviewMessage(liveFeedback))}</p></> : <p>Short feedback appears here as each player acts.</p>}
      </div>
      {heroReview?.chart && !heroReview.fallback && <div className={`hero-chart-note ${heroReview.chart.assessment.toLowerCase()}`} data-assessment={heroReview.chart.assessment}><strong>Your preflop review · {heroReview.chart.assessment === 'APPROVED' ? 'Good decision' : 'Consider another move'}</strong><p>{arenaText(reviewMessage(heroReview))}</p></div>}
      {heroReview?.aiText && <div className="hero-coach-note"><strong>Your coach</strong><CoachReply text={arenaText(heroReview.aiText)} animate /></div>}
      {reviews.some(item => item.status === 'loading') && <span className="caption">Coach is reviewing your move…</span>}
      {reviews.find(item => item.status === 'error') && <div className="review-retry"><span className="caption">AI coach unavailable. Live feedback is still active.</span><button className="button" onClick={() => { const item = reviews.find(item => item.status === 'error'); setReviews(previous => previous.map(review => review.id === item.id ? { ...review, status: 'loading' } : review)); requestReview(item.id, item.context); }}>Retry coach</button></div>}
      {reviews.length > 0 && <details className="feedback-history"><summary>Recent actions <span>{reviews.length}</span></summary>{reviews.map(review => <article key={review.id}><strong>{review.name} · {STREETS[review.street]} · {review.label}</strong><p>{arenaText(reviewMessage(review))}</p></article>)}</details>}
    </section>
    <div className="tournament-mode-note"><span>MTT / SNG · CHIP EV</span><span>{hand.stackDepthBB}bb starting stacks · no ICM or payouts · new roster &amp; seats each hand</span></div>
    <p className="table-scroll-hint">Tap a player for their profile, stack and latest action.</p>
    <div ref={tableViewport} style={{ '--table-scale': tableScale }} className="arena-table-viewport" tabIndex={0} role="region" aria-label="Poker table. Scroll sideways to see all seats.">
    <div ref={stage} className={`arena-stage animated-table holdem-table${muted ? ' quiet-table' : ''}${dealing ? ' is-dealing' : ''}${event === 'collect' ? ' is-collecting' : ''}`} data-dealing={dealing} data-playing={frame !== null} aria-label="Eight-seat poker table">
      <div className="arena-felt"><span className="arena-wordmark">PokerTool</span></div>
      <div className="dealer-deck" aria-label="Dealer deck"><span>♠</span><small>DEALER</small></div>
      {dealing && !reduced && flight && <span key={`${hand.number}-${dealStep}`} className="flying-deal-card" aria-hidden="true" style={{ ...flight, '--flight-time': quick ? '75ms' : '250ms' }}>♠</span>}
      {!reduced && (dealing || event === 'street' || event === 'showdown') && <DealerHand key={`hand-${hand.number}-${dealStep}-${hand.street}-${event}`} fast={quick} revealing={!dealing} style={dealing ? flight || {} : { '--origin-x': '5%', '--origin-y': '70%', '--target-x': '50%', '--target-y': '56%' }} />}
      <div className="arena-seats">{hand.players.slice(1).map(player => <BotSeat key={player.id} player={player} hand={hand} reveal={reveal} muted={muted} dealStep={dealStep} thinking={event === 'thinking' && actor === player.id} event={actor === player.id ? event : ''} winner={complete && hand.winners.includes(player.id)} onInspect={setInspectedPlayer} />)}</div>
  
      <div className="arena-community"><span className="arena-pot" key={`${hand.number}-${hand.pot}`}><small>{complete ? 'POT AWARDED' : 'TOTAL POT'}</small><strong>{bb((complete ? hand.awarded : hand.pot) / 2)}<em>bb</em></strong></span>
        <div className="table-cards" aria-label={`${STREETS[hand.street]} board`}>{Array.from({ length: 5 }, (_, index) => hand.board[index] ? <PlayingCard key={`${hand.number}-${index}`} rank={hand.board[index][0]} suit={hand.board[index][1]} index={index} className="arena-reveal-card" /> : <span key={index} className="board-card-space" aria-label="Community card not dealt" />)}</div>
        <span className="arena-street">{STREETS[hand.street].toUpperCase()} · BLINDS 0.5 / 1 BB</span>
      </div>
      {event === 'collect' && collected.map(({ id, ...position }) => <span className="collecting-chip" key={`${hand.number}-${hand.street}-${id}`} style={position} aria-hidden="true">● ● ●</span>)}
      {frame?.amount > 0 && <div className="travelling-chips" key={`${hand.log.length}-${actor}`} style={flight || {}} aria-hidden="true"><span /><span /><span /><b>{bb(frame.amount / 2)} bb</b></div>}
      <div data-seat="0" data-physical-seat={0} style={{ '--seat-x': `${seatCoordinates[0][0]}%`, '--seat-y': `${seatCoordinates[0][1]}%` }} className={`arena-hero reseated-hero${winner ? ' winner' : ''}${!busy && !complete ? ' hero-active' : ''}`}>
        <div className="table-cards">{hand.players[0].cards.map(([rank, suit], index) => dealStep > (index ? hand.dealOrder.lastIndexOf(0) : hand.dealOrder.indexOf(0)) ? <PlayingCard key={`${hand.number}-${index}`} rank={rank} suit={suit} index={0} className="arena-reveal-card" /> : <span key={index} className="hero-card-space" />)}</div>
        <strong>{hand.button === 0 && <span className="seat-dealer" aria-label="Dealer button">D</span>}{winner ? '★ YOU WIN' : `YOU · ${arenaPosition(hand.players[0].position)}`} <span>{bb(hand.players[0].stack / 2)} bb</span></strong>{hand.players[0].folded && <span className="fold-label">FOLDED</span>}{hand.players[0].allIn && <span className="fold-label">ALL-IN</span>}
        <SeatWager player={hand.players[0]} street={hand.street} complete={complete} />
      </div>
      <div className="arena-bankroll"><span>YOUR STACK</span><strong>{bb(hand.players[0].stack / 2)}<small>bb</small></strong></div>
      <span className={`arena-turn-indicator${!busy && !complete ? ' active' : ''}`}><i />{complete ? 'Hand complete' : busy ? 'Table in motion' : 'Your turn'}</span>
      {winner && <div className="winner-sparks" aria-hidden="true">✦ <span>✧</span> ✦</div>}
    </div>
      {decisionPrompt && <div className={`arena-review-prompt ${decisionPrompt.assessment.toLowerCase()}`} role="dialog" aria-modal="false" aria-label="Your decision review"><strong>{decisionPrompt.assessment === 'CORRECT' ? 'Correct decision' : 'Incorrect decision'}</strong><p>{arenaText(reviewMessage(decisionPrompt))}</p>{decisionPrompt.recommendedType && <p className="caption">Suggested move: {decisionPrompt.recommendedType}.</p>}<div><button className="button primary" onClick={() => setDecisionPrompt(null)}>Continue hand</button>{canSkipReviewedHand(decisionPrompt) && <button className="button" onClick={skipHand}>Skip to next hand</button>}</div>{canSkipReviewedHand(decisionPrompt) && <small>Skipped hands are excluded from session results.</small>}</div>}
    </div>
    <div className="phone-player-picker"><label>Inspect a player<select aria-label="Inspect a player" value="" onChange={event => { if (event.target.value !== '') setInspectedPlayer(Number(event.target.value)); }}><option value="">Choose an opponent…</option>{hand.players.slice(1).map(player => <option value={player.id} key={player.id}>{player.name} · {arenaPosition(player.position)}</option>)}</select></label><p>Tap a seat or choose a player for readable details. Rotate your phone for a wider table.</p></div>
    {active && inspectedPlayer !== null && !decisionPrompt && <PlayerDetails key={`${hand.number}-${inspectedPlayer}`} player={hand.players.find(player => player.id === inspectedPlayer)} hand={hand} onClose={() => setInspectedPlayer(null)} />}
    <div className="decision-context"><span>Your position<strong>{arenaPosition(hand.players[0].position)}</strong></span><span>Already in this street<strong>{bb(hand.players[0].streetBet / 2)} bb</strong></span><span>Current bet total<strong>{bb(hand.currentBet / 2)} bb</strong></span><span>To call<strong>{complete ? '—' : `${bb(Math.min(hand.players[0].stack, Math.max(0, hand.currentBet - hand.players[0].streetBet)) / 2)} bb`}</strong></span></div>
    <div className="arena-decision" aria-live="polite">{complete ? <div className={`arena-outcome ${winner ? 'won' : 'lost'}`}><strong>{winner ? 'You win a pot!' : 'This hand goes to the opposition.'}</strong><p>{hand.result}</p>{hand.showdown && !hand.players[0].folded && <span>Your hand: {handLabels[hand.players[0].rank[0]]}</span>}{hand.pots?.filter(pot => !pot.refund).length > 1 && <span> · Main pot and side pots are detailed in the action history.</span>}</div> : <p>{busy ? 'Follow the table action, or skip to your next decision.' : `It’s your decision on the ${STREETS[hand.street].toLowerCase()}. Review the action history before you act.`}</p>}</div>
    {complete ? <div className="arena-actions"><button type="button" className="button primary" disabled={busy} onClick={dealNext}>Deal next hand →</button></div> : heroLegal ? <BettingControls legal={heroLegal} busy={busy} onMove={move} currentBet={hand.currentBet} pot={hand.pot} /> : <div className="arena-actions"><button type="button" className="button" disabled>Waiting for the table…</button></div>}
  </section><aside className="arena-sidebar">
    <section className="panel arena-session-summary"><div className="panel-title"><h2>Your drill session</h2><span className="tag">VIRTUAL CHIPS</span></div><div className="practice-metrics"><div><strong>{game.played}</strong><span>Hands finished</span></div><div><strong>{game.wins}</strong><span>Pots shared / won</span></div><div><strong>{bb(game.net / 2)}</strong><span>Realised net bb</span></div></div></section>
    <section className="panel arena-action-log"><div className="panel-title"><h2>Full hand history</h2><span className="tag">EVERY STREET</span></div>{STREETS.map(street => { const entries = hand.history.filter(entry => entry.street === street); return entries.length > 0 && <section className="history-street" key={street}><h3>{street}</h3><ol>{entries.map((entry, index) => <li key={index}>{arenaText(entry.text)}</li>)}</ol></section>; })}</section>
    <section className="panel roster-guide"><div className="panel-title"><h2>At your table</h2><span className="tag">7 OPPONENTS</span></div><p className="roster-intro">Know the tendencies. Watch the decisions.</p><div className="roster-list">{hand.players.slice(1).map(player => { const profile = profileFor(player.archetype); return <article key={player.id}><PlayerPortrait type={player.archetype} className="roster-portrait" /><div><div className="roster-heading"><strong>{player.name}</strong><span>{arenaPosition(player.position)}</span></div><span className="roster-type">{profile.label}</span><p>{profile.description}</p></div><span className={`roster-status${player.folded ? ' is-folded' : ''}`}>{player.folded ? 'Folded' : player.allIn ? 'All-in' : 'In hand'}</span></article>; })}</div></section>
    <details className="arena-drill-guide"><summary>How these drills work <span>Format, chip EV &amp; coaching</span></summary><div className="drill-guide-grid"><section><h3>The format</h3><p>Eight players with a randomly chosen starting depth of 5, 10, 20, 40 or 100bb each hand. Everyone starts at the same depth, with 0.5 / 1bb blinds. Each hand draws seven archetypes and new poker positions. Your view stays bottom centre.</p></section><section><h3>Reading opponents</h3><p>Bots use their own cards, the visible board, position and observed actions. Archetypes influence decisions; speech bubbles are fictional table talk.</p></section><section><h3>Understanding feedback</h3><p>Feedback suggests a move and explains the tradeoff using your cards, position and the action so far. Advice can be approximate and does not guarantee a winning result. Custom bet sizes are not graded. Realised net chips are tracked separately. These independent MTT/SNG drills do not model payouts or ICM.</p></section></div></details>
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
    <div className={`read-persona ${persona.colour}`}><span className="bot-avatar" aria-hidden="true"><PlayerPortrait type={['lag', 'gto', 'lp'][question.bot]} /></span><div><h3>{persona.name}</h3><p>{persona.title}</p></div></div>
    <div className="read-speech">“{question.line}”</div><h3 className="read-question">{question.question}</h3><div className="read-options">{question.options.map((text, value) => <button type="button" key={text} disabled={answered} className={answered && value === question.answer ? 'right-answer' : choice === value ? 'wrong-answer' : ''} onClick={() => choose(value)}><span>{value + 1}</span>{text}{answered && value === question.answer && ' ✓'}</button>)}</div>
    {answered && <div className={`answer-indicator ${correct ? 'correct' : 'incorrect'}`} role="status">{correct ? '✓ Correct.' : '✕ Not quite.'} {question.explanation}</div>}
    <div className="read-footer"><p className="caption">Personality is a clue, never proof of a hand. These are curated teaching questions.</p>{answered && <button type="button" className="button primary" onClick={() => { setChoice(null); if (index === tellQuestions.length - 1) { setIndex(0); setScore(0); } else setIndex(value => value + 1); }}>{index === tellQuestions.length - 1 ? 'Play again ↻' : 'Next opponent →'}</button>}</div>
  </section>;
}

export default function Arena({ active }) {
  const [mode, setMode] = useState('holdem');
  return <section className="page" id="arena"><header className="arena-intro">
      <div className="arena-intro-copy"><h1>AI Arena<span>.</span></h1></div>
      <div className="arena-intro-opponents"><div className="intro-portrait-line">{['tag', 'maniac', 'tricky', 'nit', 'gto'].map(type => <PlayerPortrait type={type} key={type} />)}</div><div><strong>Opponent profiles</strong><p>8 seats <span>·</span> 5–100bb stacks <span>·</span> Chip-EV drills</p></div></div>
    </header>
    <div className="arena-mode-switch segmented" role="group" aria-label="Arena game"><button type="button" className={mode === 'holdem' ? 'selected' : ''} aria-pressed={mode === 'holdem'} onClick={() => setMode('holdem')}>♠ Full-hand challenge</button><button type="button" className={mode === 'read' ? 'selected' : ''} aria-pressed={mode === 'read'} onClick={() => setMode('read')}>☏ Read the opponent</button></div>
    <div hidden={mode !== 'holdem'}><HoldemGame active={active && mode === 'holdem'} /></div><div hidden={mode !== 'read'}><ReadGame /></div>
  </section>;
}
