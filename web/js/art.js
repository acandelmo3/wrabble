// Hand-drawn spot art. Every piece is inline SVG built here — no image files,
// no icon font. They inherit `currentColor` for line work so a drawing picks up
// whatever the surrounding text color is in either theme.
//
// The wobbly look comes from deliberately imperfect paths: lines that overshoot
// their corners slightly and curves that aren't quite symmetrical.

const svg = (viewBox, inner, cls = '') =>
  `<svg class="art ${cls}" viewBox="${viewBox}" fill="none" aria-hidden="true"
     stroke="currentColor" stroke-width="2.4"
     stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

/** A leaning stack of library books. The masthead drawing. */
export const books = () => svg('0 0 120 90', `
  <rect x="14" y="62" width="86" height="17" rx="3" fill="var(--art-warm)"/>
  <path d="M14 70.5h86"/>
  <rect x="20" y="44" width="74" height="18" rx="3" fill="var(--art-cool)"
        transform="rotate(-1.5 57 53)"/>
  <path d="M21 53.5l73-2"/>
  <rect x="27" y="26" width="62" height="18" rx="3" fill="var(--art-pink)"
        transform="rotate(1.8 58 35)"/>
  <path d="M28 35l61 2"/>
  <path d="M63 26c1-7 5-11 11-12" />
  <path d="M74 14c3.5.3 5.6 2.4 6 5.5" fill="var(--art-leaf)"/>
  <path d="M74 14c-3.2 1.4-4.6 4-4 7.2 3.4.4 6-1 7.2-4" fill="var(--art-leaf)"/>
`, 'art-books');

/** Sun with drifting rays — the summer half of the theme. */
export const sun = () => svg('0 0 100 100', `
  <circle cx="50" cy="50" r="21" fill="var(--art-sun)"/>
  <g class="art-rays">
    <path d="M50 16V6M50 94V84M84 50h10M6 50h10M74 26l7-7M19 81l7-7M74 74l7 7M19 19l7 7"/>
  </g>
`, 'art-sun');

/** Crescent moon with a couple of sparks — Sunday night, the reveal.
    Both arcs share the endpoints (50,16) and (50,84): the outer is r=34 about
    (50,50), the inner r=39.4 about (70,50), so the crescent's thickness is the
    gap between their left edges (x=16 vs x=30.6). */
export const moon = () => svg('0 0 100 100', `
  <path d="M50 16A34 34 0 0 0 50 84A39.4 39.4 0 0 1 50 16z" fill="var(--art-cream)"/>
  <path d="M76 26l2.6 6.4 6.4 2.6-6.4 2.6-2.6 6.4-2.6-6.4-6.4-2.6 6.4-2.6z"
        fill="var(--art-sun)" stroke-width="2"/>
  <path d="M84 58l1.9 4.6 4.6 1.9-4.6 1.9-1.9 4.6-1.9-4.6-4.6-1.9 4.6-1.9z"
        fill="var(--art-sun)" stroke-width="2"/>
`, 'art-moon');

/** Open window onto a summer sky — the "prompt drops" drawing. Frame, four
    panes, a sun, a sill. Nothing else: any extra mark reads as a scratch. */
export const window_ = () => svg('0 0 92 92', `
  <rect x="12" y="10" width="68" height="62" rx="4" fill="var(--art-sky)"/>
  <circle cx="30" cy="27" r="7.5" fill="var(--art-sun)"/>
  <path d="M46 10v62M12 41h68"/>
  <rect x="12" y="10" width="68" height="62" rx="4" stroke-width="3"/>
  <path d="M6 80h80" stroke-width="3.5"/>
`, 'art-window');

/** Paper airplane — submitting an entry.
    The wing tips are constructed as mirror images about the spine (notch ->
    nose), so the crease bisects the shape by construction: the two halves come
    out 891 vs 896. Eyeballed vertices were 1134 vs 798 and read as crooked.
    The trail recedes straight back along that same spine. */
export const plane = () => svg('0 0 100 80', `
  <path d="M14 19L90 6 46 70 40 38z" fill="var(--art-cool)"/>
  <path d="M40 38L90 6M14 19L40 38"/>
  <path d="M32 43L16 53" stroke-dasharray="2.6 5.4"/>
`, 'art-plane');

/** Domino mask — the guessing phase.
    The top edge stays FLAT and only the bottom is notched for the nose.
    Curving both edges inward at the centre pinches it into two lobes and it
    reads as an infinity sign. Eye holes cut through to the card behind. */
export const mask = () => svg('0 0 112 48', `
  <path d="M5 16C5 6 14 3 26 3h60c12 0 21 3 21 13 0 14-9 28-23 27-12-1-21-8-28-16
           -7 8-16 15-28 16C14 44 5 30 5 16z"
        fill="var(--art-pink)"/>
  <ellipse cx="29" cy="20" rx="10" ry="6" transform="rotate(-8 29 20)"
           fill="var(--surface)"/>
  <ellipse cx="83" cy="20" rx="10" ry="6" transform="rotate(8 83 20)"
           fill="var(--surface)"/>
`, 'art-mask');

/** Steaming teacup — the cozy note on empty states.
    Cup body spans x=20..72, so its centre is x=46; the steam and saucer are
    centred on that, not on the drawing's bounding box (the handle would drag
    the apparent centre to the right). */
export const teacup = () => svg('0 0 100 90', `
  <path d="M20 40h52v18c0 11-9 20-20 20H40c-11 0-20-9-20-20V40z" fill="var(--art-warm)"/>
  <path d="M72 46h8a9 9 0 010 18h-8"/>
  <path d="M14 78h64"/>
  <path d="M34 30c-4-5 4-9 0-14M46 30c-4-5 4-9 0-14M58 30c-4-5 4-9 0-14" stroke-width="2"/>
`, 'art-teacup');

/** Quill standing in an inkwell — the writing phase. */
export const quill = () => svg('0 0 90 90', `
  <path d="M33 62h26v11a8 8 0 01-8 8H41a8 8 0 01-8-8V62z" fill="var(--art-cool)"/>
  <path d="M29 62h34"/>
  <path d="M46 62c1-16 7-32 15-42 6-8 13-12 18-13 1 7-1 16-5 25-7 15-17 27-28 30z"
        fill="var(--art-cream)"/>
  <path d="M47 60c6-12 12-24 19-32" stroke-width="2"/>
`, 'art-quill');

/** Trophy for the standings. Handle arcs start and end on the cup's edge and
    bow outward only — sweeping them inward draws over the cup body. */
export const trophy = () => svg('0 0 90 90', `
  <path d="M26 14h38v20c0 11-8.5 19-19 19s-19-8-19-19V14z" fill="var(--art-sun)"/>
  <path d="M26 18c-10 0-14 6-12 12 2 5 7 6 12 5" stroke-width="2.8"/>
  <path d="M64 18c10 0 14 6 12 12-2 5-7 6-12 5" stroke-width="2.8"/>
  <path d="M45 53v12"/>
  <path d="M34 65h22l2 13H32z" fill="var(--art-warm)"/>
  <path d="M30 78h30" stroke-width="3"/>
`, 'art-trophy');

/** Lightbulb for prompt suggestions. */
export const bulb = () => svg('0 0 80 90', `
  <path d="M40 10c14 0 24 10 24 23 0 9-5 14-9 19-3 3-4 6-4 9H29c0-3-1-6-4-9-4-5-9-10-9-19 0-13 10-23 24-23z"
        fill="var(--art-sun)"/>
  <path d="M29 70h22M32 79h16"/>
  <path d="M40 34v14" stroke-width="2"/>
`, 'art-bulb');

/** Desk lamp — evening mode. Shade, stem, base: the silhouette has to survive
    at 20px in the theme toggle, so no detail that vanishes when small. */
export const lamp = () => svg('0 0 60 60', `
  <path d="M12 28l9-17h18l9 17z" fill="var(--art-sun)" stroke-width="3.5"/>
  <path d="M30 28v19" stroke-width="3.5"/>
  <path d="M17 51h26" stroke-width="4.5"/>
  <path d="M20 36l-4 5M40 36l4 5" stroke-width="3"/>
`, 'art-lamp');

/** Simplified sun for the toggle — fewer, fatter rays than the full drawing. */
export const sunSmall = () => svg('0 0 60 60', `
  <circle cx="30" cy="30" r="12" fill="var(--art-sun)" stroke-width="4"/>
  <path d="M30 6v5M30 49v5M54 30h-5M11 30H6M46 14l-3.5 3.5M17.5 42.5L14 46M46 46l-3.5-3.5M17.5 17.5L14 14"
        stroke-width="4"/>
`, 'art-sun-small');

/**
 * Injects a drawing. `html` is only ever fed these hand-authored strings —
 * never anything a player typed.
 */
export function art(fn, cls = '') {
  const span = document.createElement('span');
  span.className = `art-wrap ${cls}`;
  span.innerHTML = fn();
  return span;
}
