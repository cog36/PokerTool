// One card component is shared by the range inspector, practice table, and replay.
export default function PlayingCard({ rank, suit, index = 0 }) {
  return <span className={`card dealt-card${['♥', '♦'].includes(suit) ? ' red' : ''}`}
    style={{ '--deal-delay': `${index * 70}ms` }} aria-label={`${rank}${suit}`}>
    {rank}<small>{suit}</small>
  </span>;
}
