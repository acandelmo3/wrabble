import { h } from './dom.js';

/* Wrobby's peek over the phase card.
 *
 * The walk itself is untouched — one unbroken crossing defined entirely in
 * CSS. All this does is stop that animation where it stands once he has got as
 * far as the Guessing | Revealed seam, play the peek, and set him going again.
 * Pausing rather than re-timing is why the walk keeps its fixed 58px stride at
 * every window size.
 *
 * Stopping him there also hides him for free: his head reaches the seam while
 * his body is still well inside the card, and the card is opaque, so the pause
 * is always spent out of sight. That is the whole trick — the head that pops
 * up is a separate drawing, and the worm it belongs to is parked behind the
 * box exactly where you would expect him to be.
 */

/** How long the head-up / wag / head-down sequence runs. Owned here rather
 *  than in the stylesheet so the timeout and the keyframes cannot disagree;
 *  the CSS reads it back off --wrobby-peek-len. */
const PEEK_MS = 9000;

/** He hops once every 1.5s, so a fifth of a second is plenty to notice him
 *  arriving and costs nothing between visits. */
const POLL_MS = 200;

/** The head he pops over the phase card, plus the behaviour that drives it.
 *  Deliberately not inside .wrobby-track: the track is clipped and full-bleed,
 *  while this has to hang off the card's own top edge. */
export function wrobbyPeek() {
  const el = h('div', { class: 'wrobby-peek' },
    h('div', { class: 'wrobby-peek-tail' }),
    h('div', { class: 'wrobby-peek-head' }));
  // Built detached, so nothing can be measured yet. Wire up once the router
  // has put it on the page and it has a box.
  requestAnimationFrame(() => wire(el));
  return el;
}

function wire(el) {
  if (!el.isConnected) return;
  // Same rule as the rest of the motion in here: none of it under
  // prefers-reduced-motion. The CSS leaves him hidden, so bailing is enough.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const anchor = el.closest('.wrobby-anchor');
  const worm = anchor?.querySelector('.wrobby');
  if (!worm) return;

  el.style.setProperty('--wrobby-peek-len', `${PEEK_MS}ms`);

  // The seam is a gap between two grid cells, which CSS cannot name and which
  // moves when the pills wrap. Measure it and hand it back as a px offset.
  let seam = null;
  const place = () => {
    const pills = anchor.querySelectorAll('.phase-step');
    if (pills.length < 3) return;
    const gap = (pills[1].getBoundingClientRect().right
      + pills[2].getBoundingClientRect().left) / 2;
    seam = gap;
    el.style.setProperty('--wrobby-peek-x',
      `${gap - anchor.getBoundingClientRect().left}px`);
  };
  place();
  addEventListener('resize', place);

  // He is drawn facing left and flipped to travel right, so the leading edge
  // of his box is his head. Armed only once he is short of the seam, which is
  // what stops him peeking a second time on the way out and re-arms him for
  // the next crossing.
  let armed = false;
  let peeking = false;

  const id = setInterval(() => {
    if (!el.isConnected) {
      clearInterval(id);
      removeEventListener('resize', place);
      return;
    }
    if (peeking) return;
    if (seam == null) { place(); return; }

    const box = worm.getBoundingClientRect();
    if (box.right < seam) { armed = true; return; }
    if (!armed) return;

    armed = false;
    // He may have sailed well past the seam between two polls: a backgrounded
    // tab clamps this interval to a second or worse while the CSS animation
    // keeps running, so the crossing can be noticed long after it happened.
    // The peek only reads if his body is behind the card, so if he is not
    // there, skip this crossing rather than freeze him in the open with a head
    // popping up somewhere he isn't.
    const card = anchor.getBoundingClientRect();
    if (box.left < card.left || box.right > card.right) return;
    peeking = true;
    // The class freezes the travel and the frame swap together — leaving the
    // crawl running would scrunch him in place behind the card while he is
    // meant to be still — and brings the head up. All of it is in the CSS.
    anchor.classList.add('is-peeking');
    setTimeout(() => {
      anchor.classList.remove('is-peeking');
      peeking = false;
    }, PEEK_MS);
  }, POLL_MS);
}
