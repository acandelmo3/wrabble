// What players see on the Patch notes screen, newest first.
//
// This is the player-facing copy. PATCHNOTES.md is the repo's changelog and
// stays the canonical record ~ when you add an entry there, add it here too.
// Kept as data rather than parsed from the markdown because `web/` ships as
// plain ES modules with no build step and no dependencies, and a markdown
// parser is a lot of machinery for a list of sentences.
//
// `date` is null while an entry is still unreleased.
export const NOTES = [
  {
    title: 'Launch week 1',
    date: null,
    added: [
      'Wrobby. A worm. He inches across your group page every so often, minds '
      + 'his own business, and leaves. He is hand-drawn, and he will be doing '
      + 'more later.',
      'Pick your own name. Set one on the home page and every group uses it, '
      + 'or set a different name inside a single group ~ useful when one group '
      + 'knows you by something the others don\'t. Clear either to fall back to '
      + 'the name underneath it.',
      'A Rankings button on each group, so the standings are one tap away.',
      'This screen.',
    ],
    changed: [
      'The name you use in one group now lives in that group\'s settings, '
      + 'instead of at the bottom of the group page.',
      'Past weeks show your current name, so nothing in the history is '
      + 'credited to a name nobody recognises.',
    ],
    fixed: [
      'The same player could appear under two different names on one screen ~ '
      + 'the standings used your Discord display name while the reveal used '
      + 'your handle.',
    ],
  },
  {
    title: 'Launch',
    date: '2026-08-09',
    text: 'Wrabble went live. One prompt a week, answers anonymized Thursday '
      + 'night, names and scores revealed Sunday night, standings carried over. '
      + 'Bonus round on who wrote the prompt.',
  },
];
