// Presentation labels only: chart lookup keys and parser positions stay intact.
export const displayPosition = position => ({ EP1: 'UTG', EP2: 'UTG1', EP3: 'UTG2' }[position] || position);
export const arenaPosition = position => ({ UTG: 'UTG1', 'UTG+1': 'UTG2' }[position] || displayPosition(position));

export const positionText = text => String(text ?? '').replace(/\bEP2\b/g, 'UTG1').replace(/\bEP3\b/g, 'UTG2');
export const arenaText = text => positionText(text).replace(/\bUTG\+1\b/g, 'UTG2').replace(/\bUTG\b/g, 'UTG1');
