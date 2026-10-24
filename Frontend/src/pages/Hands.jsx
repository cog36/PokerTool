import { useState } from 'react';
import PlayingCard from '../components/PlayingCard';
import { hands } from '../data';

export default function Hands() {
  const [handIndex, setHandIndex] = useState(0);
  const [streetIndex, setStreetIndex] = useState(0);
  const hand = hands[handIndex], street = hand.streets[streetIndex];
  return <section className="page" id="hands">
    <div className="page-title"><div><p className="eyebrow">FOLLOW THE ACTION</p><h1>Hand Library<span>.</span></h1><p>Slow the hand down. Notice what changes.</p></div><span className="pill outlined">Sample hand replays</span></div>
    <div className="library-layout"><div className="hand-list">{hands.map((item, index) => <button type="button" key={item.title} className={`hand-preview${index === handIndex ? ' selected' : ''}`} aria-pressed={index === handIndex} onClick={() => { setHandIndex(index); setStreetIndex(0); }}><span>SAMPLE HAND 0{index + 1}</span><h3>{item.title}</h3><p>{item.subtitle}</p><b>{item.hand}</b></button>)}</div>
      <section className="panel replay-panel"><div className="panel-title"><div><span className="eyebrow">HAND REPLAY</span><h2>{hand.title}</h2></div><span className="tag">ILLUSTRATIVE</span></div>
        <div className="replay-board"><span className="pill">{street.name.toUpperCase()}</span><div className="table-cards" key={`${handIndex}-${streetIndex}`}>{street.board.length ? street.board.map(([rank, suit], index) => <PlayingCard key={rank + suit} rank={rank} suit={suit} index={index} />) : <span className="no-board">The action starts before the flop.</span>}</div><p>Pot · {street.pot}</p></div>
        <div className="replay-events" aria-live="polite">{street.events.map(text => <div className="replay-event" key={text}><span />{text}</div>)}</div>
        <div className="street-progress" aria-label="Replay streets">{hand.streets.map((item, index) => <button key={item.name} type="button" aria-current={index === streetIndex ? 'step' : undefined} onClick={() => setStreetIndex(index)} className={index <= streetIndex ? 'reached' : ''}>{item.name}</button>)}</div>
        <div className="replay-controls"><button type="button" className="button" disabled={streetIndex === 0} onClick={() => setStreetIndex(value => value - 1)}>← Previous</button><span>{streetIndex + 1} / {hand.streets.length}</span><button type="button" className="button primary" disabled={streetIndex === hand.streets.length - 1} onClick={() => setStreetIndex(value => value + 1)}>Next street →</button></div>
        <div className="replay-takeaway"><span>✳ STUDY QUESTION</span><p>{hand.question}</p></div>
      </section>
    </div>
  </section>;
}
