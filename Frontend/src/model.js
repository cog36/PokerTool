// Pure helpers keep the example strategy and session scoring easy to verify.
export const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const positionNames = { BTN: 'Button', CO: 'Cutoff', UTG: 'Under the gun' };
export const initialSession = { attempts: 0, correct: 0, streak: 0 };

export function actionFor(row, column, position) {
  const width = { UTG: 2, CO: 4, BTN: 6 }[position];
  if (row === column) return row <= width + 2 ? 'raise' : 'call';
  const high = Math.min(row, column), low = Math.max(row, column);
  if (high <= 2 && low <= width + (row < column ? 3 : 1)) return 'raise';
  if (row < column && low - high <= 2 && low <= width + 3) return 'call';
  return 'fold';
}

export function buildRange(position) {
  return ranks.flatMap((rank, row) => ranks.map((other, column) => ({
    hand: row === column ? rank + other : row < column ? rank + other + 's' : other + rank + 'o',
    action: actionFor(row, column, position),
  })));
}

export function scoreAnswer(session, correct) {
  return {
    attempts: session.attempts + 1,
    correct: session.correct + Number(correct),
    streak: correct ? session.streak + 1 : 0,
  };
}

export function readStored(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export function writeStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function validNotes(value) {
  return Array.isArray(value) ? value.filter(note => note &&
    typeof note.id === 'string' && typeof note.title === 'string' &&
    typeof note.body === 'string' && typeof note.category === 'string' &&
    typeof note.date === 'number' && Number.isFinite(note.date) &&
    Math.abs(note.date) <= 8640000000000000) : [];
}
