// All portraits share one local atlas, so a full table needs only one image request.
const portraitIndex = { tag: 0, lag: 1, tp: 2, lp: 3, nit: 4, maniac: 5, station: 6, rock: 7, fitfold: 8, abc: 9, tricky: 10, exploit: 11, gto: 12, dealer: 13, hero: 14 };
export default function PlayerPortrait({ type = 'hero', className = '' }) {
  const index = portraitIndex[type] ?? 14;
  return <span className={`player-portrait ${className}`} aria-hidden="true" style={{ backgroundPosition: `${index % 4 / 3 * 100}% ${Math.floor(index / 4) / 3 * 100}%` }} />;
}
