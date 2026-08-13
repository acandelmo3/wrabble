// Wrobby's faces — the one place the reaction set is defined.
//
// The web app does NOT keep its own copy: it renders whatever this list says,
// off the `reaction_faces` field in the group payload, and builds image URLs as
// `img/face-<name>.png`. Adding a face is this array plus the PNG, nothing else.
// Dropping one hides it from the tray immediately while existing rows survive,
// so a face can be retired without a migration.
export const FACES = ['happy', 'love', 'gasp', 'sad', 'flustered', 'deadpan', 'dizzy'];

const ALLOWED = new Set(FACES);
export const isFace = (f) => typeof f === 'string' && ALLOWED.has(f);

/**
 * Reaction counts for every entry in a round, plus which ones are yours.
 * Returns { [submissionId]: { counts: {face: n}, mine: [face] } }.
 *
 * One query for the whole round rather than one per entry: a group of ten with
 * ten entries would otherwise be a hundred round trips to D1.
 */
export async function reactionsForRound(db, roundId, userId) {
  const res = await db.prepare(
    `SELECT r.submission_id AS sid, r.face AS face, COUNT(*) AS n,
            MAX(CASE WHEN r.user_id = ?2 THEN 1 ELSE 0 END) AS mine
       FROM reactions r
       JOIN submissions s ON s.id = r.submission_id
      WHERE s.round_id = ?1
      GROUP BY r.submission_id, r.face`,
  ).bind(roundId, userId).all();

  const out = {};
  for (const row of res.results || []) {
    const e = out[row.sid] || (out[row.sid] = { counts: {}, mine: [] });
    e.counts[row.face] = row.n;
    if (row.mine) e.mine.push(row.face);
  }
  // Stable order so the pills do not reshuffle between refreshes. Ties break by
  // the canonical face order rather than by whatever D1 happened to return.
  for (const e of Object.values(out)) {
    e.counts = Object.fromEntries(
      Object.entries(e.counts).sort(
        (a, b) => b[1] - a[1] || FACES.indexOf(a[0]) - FACES.indexOf(b[0]),
      ),
    );
  }
  return out;
}
