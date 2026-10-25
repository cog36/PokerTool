// Presentation only: keep evaluation and opponent behaviour unchanged.
export const canSkipReviewedHand = review => !(review.assessment === 'CORRECT' && ['call', 'raise', 'check'].includes(review.type));

export function reviewMessage(review) {
  if (!review) return '';
  if (review.chart && !review.fallback && review.chart.frequencies) {
    const choices = Object.entries(review.chart.frequencies).filter(([, frequency]) => frequency > .000001);
    const moves = choices.map(([action]) => action.toLowerCase());
    return review.assessment === 'CORRECT'
      ? `${review.label} is a good option here.${moves.length > 1 ? ` You can also consider ${moves.filter(move => move !== review.type).join(' or ')}.` : ''}`
      : `Consider ${moves.join(' or ')} instead in this situation.`;
  }
  return review.text.replace(/^Chart unavailable — using legacy analysis logic\.\s*/, '');
}
