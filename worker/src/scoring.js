// Scoring rules. Tunable in one place so a group can be re-scored consistently.
export const POINTS = {
  correctGuess: 3,       // per submission you correctly attribute
  fooledSomeone: 1,      // per player who wrongly attributes YOUR submission
  promptAuthorBonus: 2,  // correctly naming who wrote this week's prompt
  submitted: 1,          // participation: you turned something in before cutoff
  guessed: 1,            // participation: you submitted a full guess sheet
};

/**
 * Pure function: given a round's raw play, return per-user points + breakdown.
 *
 * @param {Array<{id, user_id}>} submissions
 * @param {Array<{guesser_id, submission_id, guessed_user_id}>} guesses
 * @param {Array<{guesser_id, guessed_user_id}>} promptGuesses
 * @param {string|null} promptAuthorId
 * @param {string[]} memberIds
 */
export function scoreRound({ submissions, guesses, promptGuesses, promptAuthorId, memberIds }) {
  const authorOf = new Map(submissions.map((s) => [s.id, s.user_id]));
  const tally = new Map();

  // A zero amount still creates the row (that's how members with no activity
  // stay on the leaderboard) but never adds a breakdown line.
  const bump = (userId, key, amount) => {
    if (!userId) return;
    if (!tally.has(userId)) tally.set(userId, { points: 0, breakdown: {} });
    if (!amount) return;
    const row = tally.get(userId);
    row.points += amount;
    row.breakdown[key] = (row.breakdown[key] || 0) + amount;
  };

  // Everyone who is in the group shows up on the board, even with zero.
  for (const id of memberIds) bump(id, '_', 0);

  for (const s of submissions) bump(s.user_id, 'submitted', POINTS.submitted);

  // A guesser who filled out a sheet gets participation credit once.
  const guessers = new Set(guesses.map((g) => g.guesser_id));
  for (const id of guessers) bump(id, 'guessed', POINTS.guessed);

  for (const g of guesses) {
    const trueAuthor = authorOf.get(g.submission_id);
    if (!trueAuthor) continue;
    // You never score off your own entry, in either direction.
    if (g.guesser_id === trueAuthor) continue;
    if (g.guessed_user_id === trueAuthor) {
      bump(g.guesser_id, 'correctGuess', POINTS.correctGuess);
    } else {
      bump(trueAuthor, 'fooledSomeone', POINTS.fooledSomeone);
    }
  }

  // No points for having your prompt drawn — that is luck, not play. The
  // author only features in the bonus round others guess at.
  if (promptAuthorId) {
    for (const pg of promptGuesses) {
      if (pg.guesser_id === promptAuthorId) continue;
      if (pg.guessed_user_id === promptAuthorId) {
        bump(pg.guesser_id, 'promptAuthorBonus', POINTS.promptAuthorBonus);
      }
    }
  }

  return [...tally.entries()].map(([user_id, { points, breakdown }]) => {
    delete breakdown._;
    return { user_id, points, breakdown };
  });
}
