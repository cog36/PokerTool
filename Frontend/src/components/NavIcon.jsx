// A small, consistent line-icon set for the study tools.
const paths = {
 overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 analysis: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
 ranges: 'M3 3h18v18H3z M9 3v18 M15 3v18 M3 9h18 M3 15h18',
 arena: 'M12 3C10 6 3 10 3 14a5 5 0 0 0 9 3 5 5 0 0 0 9-3c0-4-7-8-9-11z M12 17v4 M8 21h8',
 hands: 'M7 3h13v16H7z M4 6H3v15h13v-1 M11 8h5 M11 12h5',
 notebook: 'M5 3h14v18H5z M2 7h5 M2 12h5 M2 17h5 M10 8h5 M10 12h5',
 coach: 'M4 4h16v12H9l-5 4V4z M8 8h8 M8 12h5',
};
export default function NavIcon({ name }) {
 return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
