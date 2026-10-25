import { useEffect, useRef } from 'react';
import { STREETS } from '../arena';
import PlayerPortrait from './PlayerPortrait';
import { profileFor } from '../archetypes';
import { arenaPosition, arenaText } from '../positions';

const amount = chips => `${(chips / 2).toLocaleString(undefined, { maximumFractionDigits: 2 })} bb`;

export default function PlayerDetails({ player, hand, onClose }) {
  const dialog = useRef(null);
  const profile = profileFor(player.archetype);
  useEffect(() => { dialog.current.showModal(); }, []);
  const action = player.lastAction;
  const actionText = action ? `${action.label}${['raise', 'call', 'blind'].includes(action.type) ? ` ${action.type === 'raise' ? 'to ' : ''}${amount(action.type === 'raise' ? action.total : action.amount)}` : ''}${action.allIn ? ' · All-in' : ''}` : 'No action yet';
  return <dialog ref={dialog} className="player-details" aria-labelledby="player-details-title" onClose={onClose}>
    <header><PlayerPortrait type={player.archetype} /><div><span className="eyebrow">OPPONENT PROFILE</span><h2 id="player-details-title">{player.name}</h2></div><button type="button" className="button" onClick={() => dialog.current.close()}>Close</button></header>
    <strong className="player-details-type">{profile.label}</strong><p>{profile.description}</p>
    <dl><div><dt>Position</dt><dd>{arenaPosition(player.position)}{hand.button === player.id ? ' · Dealer' : ''}</dd></div><div><dt>Stack remaining</dt><dd>{amount(player.stack)}</dd></div><div><dt>In this street</dt><dd>{amount(player.streetBet)}</dd></div><div><dt>Status</dt><dd>{!player.inHand ? 'Sitting out' : player.folded ? 'Folded' : player.allIn ? 'All-in' : 'In hand'}</dd></div></dl>
    <section><h3>Latest action{action ? ` · ${STREETS[action.street]}` : ''}</h3><p>{arenaText(actionText)}</p></section>
    <p className="caption">Live public information only. The hand continues while this panel is open.</p>
  </dialog>;
}
