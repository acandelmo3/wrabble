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
    title: 'Launch week 2',
    date: '2026-08-13',
    added: [
      'React to entries with Wrobby\'s face. Once the week is revealed, leave a '
      + 'reaction on anyone\'s entry ~ happy, love, gasp, sad, flustered, '
      + 'deadpan or dizzy. Tap one again to take it back. Reactions stay shut '
      + 'until the reveal, so nobody can use them to hint at who wrote what '
      + 'while guessing is still open.',
    ],
  },
  {
    title: 'Launch week 1',
    date: '2026-08-12',
    added: [
      'Introduced Wrobby, the inch worm! More coming soon...',
      'Pick your own name. Set one global nickname and/or one for each group '
      + 'in settings.',
      'A Rankings button on each group, so the standings are one tap away.',
      'This screen!',
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
