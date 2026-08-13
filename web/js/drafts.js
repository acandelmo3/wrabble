// Unsaved entry drafts, kept in localStorage.
//
// The textarea used to be the only copy of what someone had written, which made
// losing it trivially easy: the router re-mounts the whole view on window focus
// to catch the Thursday phase flip, and `mount()` replaces the DOM wholesale.
// Alt-tabbing to look something up was enough to destroy a long answer, with no
// error and nothing to recover from.
//
// So the draft is written here on every keystroke instead. It survives the
// re-mount, a closed tab, a crashed browser, and a session that expired while
// someone was mid-sentence. It is cleared only once the server has confirmed
// the save.

const key = (roundId) => `wrabble.draft.${roundId}`;

/** True while a textarea holds edits the server has not accepted yet. */
let dirty = false;
export const isDirty = () => dirty;
export const setDirty = (v) => { dirty = v; };

export function saveDraft(roundId, text) {
  try {
    if (!text) localStorage.removeItem(key(roundId));
    else localStorage.setItem(key(roundId), text);
  } catch {
    // Quota, or Safari private mode refusing to write. Losing the backup is
    // survivable; taking the keystroke down with it is not.
  }
}

export function loadDraft(roundId) {
  try {
    return localStorage.getItem(key(roundId));
  } catch {
    return null;
  }
}

export function clearDraft(roundId) {
  try {
    localStorage.removeItem(key(roundId));
    localStorage.removeItem(`${key(roundId)}.at`);  // or the stamp outlives it
  } catch { /* see saveDraft */ }
  dirty = false;
}

/**
 * Old drafts, for rounds that are long finished. Called on load so the store
 * cannot grow forever ~ a weekly game leaves one dead key per week otherwise.
 */
export function pruneDrafts(keepRoundId) {
  try {
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('wrabble.draft.')) continue;
      if (keepRoundId && k === key(keepRoundId)) continue;
      const stamp = Number(localStorage.getItem(`${k}.at`) || 0);
      if (stamp && Date.now() - stamp > 30 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(k);
        localStorage.removeItem(`${k}.at`);
      }
    }
  } catch { /* see saveDraft */ }
}

/** Stamps a draft so pruneDrafts can age it out later. */
export function touchDraft(roundId) {
  try {
    localStorage.setItem(`${key(roundId)}.at`, String(Date.now()));
  } catch { /* see saveDraft */ }
}
