// A small vector hand keeps the dealing animation crisp without a video or GIF.
export default function DealerHand({ style, fast, revealing }) {
  return <span className={`dealer-hand${revealing ? ' revealing' : ''}`} aria-hidden="true" style={{ ...style, '--hand-duration': fast ? '75ms' : revealing ? '600ms' : '250ms' }}>
    <svg viewBox="0 0 150 100" fill="none">
      <path d="M0 65L38 39 61 69 18 100H0Z" fill="#292534" stroke="#7e718f" strokeWidth="2" />
      <path d="M36 40L48 33 75 67 62 77Z" fill="#f2edf5" stroke="#b6a9c2" strokeWidth="2" />
      <path d="M50 36L68 24Q77 17 88 23L118 38Q126 43 122 49Q119 54 112 51L93 43 126 58Q133 62 129 68Q126 73 119 70L88 57 116 72Q122 76 118 81Q114 85 108 82L80 68 98 81Q104 85 100 89Q96 94 89 89L65 77Q55 71 54 61L50 36Z" fill="#d5a37d" stroke="#916349" strokeWidth="2" strokeLinejoin="round" />
      <path d="M63 35L85 43Q93 46 91 52Q88 58 80 55L67 51" fill="#e7b893" stroke="#916349" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 30L84 34M65 61L74 66" stroke="#bc8965" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </span>;
}
