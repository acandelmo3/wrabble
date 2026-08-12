import { h, fmtDate, countdown, wordCount, toast, codePill } from './dom.js';
import { api, login, logout } from './api.js';
import * as art from './art.js';

const DOWS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ----------------------------------------------------------------- landing

export function landingView() {
  return h('div', { class: 'stack center-col' },
    art.art(art.books, 'art-hero art-float'),
    h('section', { class: 'hero' },
      h('h1', {}, 'One prompt a week.'),
      h('p', { class: 'lede' },
        'Everybody in your group answers the same question. ',
        'Your answer could be 10 letters, 10 pages, or anywhere in between. ',
        'Thursday night the answers are sent out. ',
        'Guess who wrote what and earn points for correct answers.'),
      h('button', { class: 'btn btn-primary btn-lg', onclick: login },
        'Sign in with Discord'),
    ),
    h('section', { class: 'how' },
      ...[
        [art.window_, 'Monday', 'A prompt is drawn at random from your group\'s pool.'],
        [art.plane, 'By Thursday', 'Everyone submits. Answers are hidden.'],
        [art.mask, 'Thursday night', 'Answers appear anonymized. Guess who wrote what.'],
        [art.moon, 'Sunday night', 'Names revealed, points tallied, standings updated.'],
      ].map(([drawing, when, what]) => h('div', { class: 'how-step' },
        art.art(drawing, 'art-tile'),
        h('div', {},
          h('div', { class: 'how-when' }, when),
          h('p', {}, what)))),
    ),
  );
}

// -------------------------------------------------------------- group list

export function homeView(me, onRefresh) {
  const groups = me.groups || [];
  return h('div', { class: 'stack' },
    h('h1', {}, `Hey, ${me.user.username}`),
    groups.length
      // The card is a div with a stretched link rather than a big <a>: the copy
      // button has to live here too, and a <button> inside an <a> is invalid.
      ? h('div', { class: 'card-grid' }, ...groups.map((g) =>
        h('div', { class: 'card group-card' },
          h('a', { class: 'stretched', href: `#/g/${g.id}` }, h('h3', {}, g.name)),
          codePill(g.invite_code))))
      : h('p', { class: 'muted' }, 'You are not in a group yet. Make one, or join with a code.'),

    h('div', { class: 'two-col' },
      formCard('Start a group', 'Name', 'Sunday Night Writers', 'Create', async (v) => {
        const res = await api.createGroup(v, Intl.DateTimeFormat().resolvedOptions().timeZone);
        toast(`Created! Invite code: ${res.invite_code}`, 'success');
        location.hash = `#/g/${res.id}`;
        onRefresh();
      }),
      formCard('Join a group', 'Invite code', 'ABC234', 'Join', async (v) => {
        const res = await api.joinGroup(v);
        toast(`Joined ${res.name}`, 'success');
        location.hash = `#/g/${res.id}`;
        onRefresh();
      }),
    ),

    nameCard({
      title: 'Your name',
      blurb: 'What your groups call you on entries, guesses, and the standings.',
      value: me.user.display_name,
      fallback: me.user.discord_name,
      hint: 'You can use a different name in any single group ~ open that group to set it.',
      onSave: async (v) => { await api.setDisplayName(v); onRefresh(); },
    }),
  );
}

// ------------------------------------------------------------------- names

const MAX_NAME = 32;

/**
 * Edit a name. Used twice: once for your name everywhere (home), once for the
 * name you use in one group. Blank saves as "clear it", which is why the
 * placeholder shows what you'd fall back to rather than just being decorative.
 */
function nameCard({ title, blurb, value, fallback, hint, onSave }) {
  const input = h('input', {
    class: 'input',
    value: value || '',
    placeholder: fallback,
    maxLength: MAX_NAME,
    'aria-label': title,
  });
  const btn = h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Save');

  // Only offer the reset when there is something to reset to.
  const clear = value
    ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Use ' + fallback)
    : null;
  if (clear) {
    clear.addEventListener('click', () => { input.value = ''; form.requestSubmit(); });
  }

  const form = h('form', {
    class: 'card form-card',
    onsubmit: async (e) => {
      e.preventDefault();
      const next = input.value.trim();
      if (next === (value || '')) return toast('That is already your name.', 'info');
      btn.disabled = true;
      try {
        await onSave(next);
        toast(next ? `You are now ${next}.` : `Back to ${fallback}.`, 'success');
      } catch (err) { toast(err.message, 'error'); }
      finally { btn.disabled = false; }
    },
  },
    h('h3', {}, title),
    blurb ? h('p', { class: 'muted' }, blurb) : null,
    input,
    h('div', { class: 'row' }, btn, clear),
    hint ? h('p', { class: 'hint' }, hint) : null);

  return form;
}

function formCard(title, label, placeholder, cta, onSubmit) {
  const input = h('input', { class: 'input', placeholder, required: true });
  const btn = h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, cta);
  const form = h('form', {
    class: 'card form-card',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      btn.disabled = true;
      try { await onSubmit(input.value.trim()); }
      catch (err) { toast(err.message, 'error'); }
      finally { btn.disabled = false; }
    },
  }, h('h3', {}, title), h('label', { class: 'label' }, label), input, btn);
  return form;
}

// ------------------------------------------------------------- group view

let refreshView = () => {};

export function groupView(data, refresh) {
  refreshView = refresh;
  const { group, round, members, leaderboard, me } = data;
  const body = h('div', { class: 'stack' });

  body.append(h('div', { class: 'group-head' },
    h('div', {},
      h('h1', {}, group.name),
      h('p', { class: 'muted' },
        'Invite code ', codePill(group.invite_code),
        ` · ${members.length} ${members.length === 1 ? 'player' : 'players'}`)),
    h('div', { class: 'row' },
      h('a', { class: 'btn btn-ghost', href: `#/g/${group.id}/history` }, 'Past weeks'),
      group.role === 'owner'
        ? h('a', { class: 'btn btn-ghost', href: `#/g/${group.id}/settings` }, 'Settings')
        : null),
  ));

  if (!round) {
    body.append(h('p', { class: 'muted' }, 'No round yet ~ check back shortly.'));
    return body;
  }

  body.append(phaseBar(round, group, data.server_time));

  if (round.phase === 'writing') body.append(writingPanel(data, refresh));
  if (round.phase === 'guessing') body.append(guessingPanel(data, refresh));
  if (round.phase === 'revealed') body.append(revealedPanel(data, refresh));

  body.append(leaderboardCard(leaderboard, me));
  body.append(nameCard({
    title: `Your name in ${group.name}`,
    blurb: 'Just here. Your other groups keep calling you what they already do.',
    value: me.nickname,
    // Falls back to the overall name, not the Discord one ~ that is what
    // clearing this actually leaves you with.
    fallback: me.display_name || me.discord_name,
    onSave: async (v) => { await api.setNickname(group.id, v); refresh(); },
  }));
  return body;
}

// serverTime anchors the countdown to the API's clock, so a skewed laptop
// clock can't show "closed" while the server still accepts entries.
function phaseBar(round, group, serverTime) {
  const steps = [
    ['writing', 'Writing', round.closes_at],
    ['guessing', 'Guessing', round.reveals_at],
    ['revealed', 'Revealed', null],
  ];
  const idx = steps.findIndex(([k]) => k === round.phase);
  const next = steps[idx][2];

  return h('div', { class: 'card phase-card' },
    h('div', { class: 'phase-steps' }, ...steps.map(([key, label], i) =>
      h('div', { class: `phase-step ${i === idx ? 'active' : ''} ${i < idx ? 'done' : ''}` },
        label))),
    h('div', { class: 'phase-meta' },
      h('span', { class: 'week-badge' }, `Week ${round.week_index}`),
      next
        ? h('span', {},
          round.not_open_yet ? 'Prompt drops in '
            : round.phase === 'writing' ? 'Submissions close in ' : 'Reveal in ',
          h('strong', {}, countdown(round.not_open_yet ? round.opens_at : next, serverTime)),
          h('span', { class: 'muted' },
            ` · ${fmtDate(round.not_open_yet ? round.opens_at : next, group.tz)}`))
        : h('span', { class: 'muted' }, 'Next prompt drops ' + DOWS[group.open_dow])),
  );
}

function promptCard(round, extra) {
  return h('div', { class: 'card prompt-card' },
    h('div', { class: 'prompt-label' }, 'This week'),
    h('blockquote', {}, round.prompt),
    extra || null);
}

// --- writing -------------------------------------------------------------

function writingPanel(data, refresh) {
  const { round } = data;

  // Scheduled but not open: no prompt to show and nothing to write into yet.
  if (round.not_open_yet) {
    return h('div', { class: 'stack' },
      h('div', { class: 'card center-col stack upcoming-card' },
        art.art(art.window_, 'art-hero art-float'),
        h('h2', {}, `Week ${round.week_index} opens ${DOWS[data.group.open_dow]}`),
        h('p', { class: 'muted' },
          'Your first prompt drops ', h('strong', {}, fmtDate(round.opens_at, data.group.tz)),
          ' ~ that is ', h('strong', {}, countdown(round.opens_at, data.server_time)),
          ' from now. Everyone writes, then Thursday night you guess who wrote what.'),
        h('p', { class: 'hint' },
          'Share the invite code meanwhile so the whole group is in before it starts.')),
      suggestCard(data));
  }

  const ta = h('textarea', {
    class: 'textarea',
    placeholder: 'Write anything. 10 letters, 10 pages, or anywhere in between.',
    rows: 14,
    value: round.my_submission || '',
  });
  const counter = h('span', { class: 'muted' });
  const update = () => {
    counter.textContent = `${wordCount(ta.value)} words · ${ta.value.length} characters`;
  };
  ta.addEventListener('input', update);
  update();

  const save = h('button', { class: 'btn btn-primary' },
    round.my_submission ? 'Update my entry' : 'Submit my entry');
  save.addEventListener('click', async () => {
    if (!ta.value.trim()) return toast('Write something first.', 'error');
    save.disabled = true;
    try {
      await api.submit(round.id, ta.value);
      toast('Saved. You can keep editing until the cutoff.', 'success');
      refresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { save.disabled = false; }
  });

  return h('div', { class: 'stack' },
    promptCard(round),
    h('div', { class: 'card' },
      h('div', { class: 'row space-between' },
        h('div', { class: 'panel-head' },
          art.art(art.quill, 'art-tile'), h('h3', {}, 'Your answer')),
        round.my_submission ? h('span', { class: 'tag tag-ok' }, 'Submitted') : null),
      ta,
      h('div', { class: 'row space-between' }, counter, save)),
    h('p', { class: 'muted center' },
      `${round.submission_count} of ${data.members.length} in so far. `,
      'Nobody can read any answers until the cutoff.'),
  );
}

// --- guessing ------------------------------------------------------------

function guessingPanel(data, refresh) {
  const { round, members, me } = data;
  const others = members.filter((m) => m.id !== me.id);
  const picks = { ...round.my_guesses };
  let promptPick = round.my_prompt_guess;

  const entryCards = round.entries.map((e, i) => {
    const select = h('select', { class: 'select', disabled: e.mine },
      h('option', { value: '' }, e.mine ? 'This one is yours' : 'Who wrote this?'),
      ...members.map((m) => h('option', {
        value: m.id, selected: picks[e.id] === m.id,
      }, m.id === me.id ? `${m.username} (me)` : m.username)));
    select.addEventListener('change', () => { picks[e.id] = select.value; });

    return h('article', { class: `card entry ${e.mine ? 'entry-mine' : ''}` },
      h('div', { class: 'entry-head' },
        h('span', { class: 'entry-num' }, `Entry ${i + 1}`),
        h('span', { class: 'muted' }, `${wordCount(e.body)} words`),
        e.mine ? h('span', { class: 'tag' }, 'Yours') : null),
      h('div', { class: 'entry-body' }, e.body),
      h('div', { class: 'entry-foot' }, select));
  });

  const bonus = round.has_prompt_author
    ? (() => {
      const sel = h('select', { class: 'select' },
        h('option', { value: '' }, 'Who wrote this week\'s prompt?'),
        ...members.map((m) => h('option', {
          value: m.id, selected: promptPick === m.id,
        }, m.username)));
      sel.addEventListener('change', () => { promptPick = sel.value; });
      return h('div', { class: 'card bonus-card' },
        h('div', { class: 'panel-head' }, art.art(art.sun, 'art-tile'), h('h3', {}, 'Bonus round')), h('p', { class: 'muted' },
          'Someone in this group wrote the prompt itself. Name them for extra points.'), sel);
    })()
    : null;

  const save = h('button', { class: 'btn btn-primary btn-lg' }, 'Lock in my guesses');
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      await api.guess(round.id, picks, promptPick || null);
      toast('Guesses saved. Change them any time before the reveal.', 'success');
      refresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { save.disabled = false; }
  });

  return h('div', { class: 'stack' },
    promptCard(round),
    h('div', { class: 'panel-head' },
      art.art(art.mask, 'art-tile'),
      h('h2', {}, `${round.entries.length} anonymous `
        + `${round.entries.length === 1 ? 'entry' : 'entries'}`)),
    ...entryCards,
    bonus,
    suggestCard(data),
    h('div', { class: 'center' }, save),
  );
}

function suggestCard(data) {
  const already = data.round?.my_prompt_suggestion;
  const head = h('div', { class: 'panel-head' },
    art.art(art.bulb, 'art-tile'), h('h3', {}, 'Write next week\'s prompt'));

  // One per person per week, so once it's in, show it back rather than
  // offering an input that the server would only reject.
  if (already) {
    return h('div', { class: 'card suggest-card' }, head,
      h('p', { class: 'muted' }, 'Your prompt is in the pool for future weeks:'),
      h('blockquote', { class: 'suggested' }, already),
      h('p', { class: 'hint' }, 'One suggestion each per week.'));
  }

  const input = h('input', {
    class: 'input',
    placeholder: 'e.g. "Describe a room you have never told anyone about."',
    maxLength: 500,
  });
  const btn = h('button', { class: 'btn' }, 'Add to the pool');
  btn.addEventListener('click', async () => {
    if (!input.value.trim()) return;
    btn.disabled = true;
    try {
      await api.suggestPrompt(data.group.id, input.value.trim());
      input.value = '';
      toast('Added to the pool.', 'success');
      refreshView();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; }
  });
  return h('div', { class: 'card suggest-card' }, head,
    h('p', { class: 'muted' },
      'Prompts are drawn at random from what the group submits. ',
      'You\'ll guess who wrote the selected prompt next week.'),
    h('div', { class: 'row' }, input, btn));
}

// --- revealed ------------------------------------------------------------

function revealedPanel(data, refresh) {
  const { round, me } = data;
  const mine = round.round_scores.find((s) => s.user_id === me.id);

  const promptLine = round.prompt_author
    ? h('p', { class: 'prompt-byline' },
      'Prompt written by ', h('strong', {}, round.prompt_author),
      round.my_prompt_guess
        ? (round.my_prompt_guess === round.prompt_author_id
          ? h('span', { class: 'tag tag-ok' }, 'You called it')
          : h('span', { class: 'tag tag-bad' }, 'You missed this one'))
        : null)
    : h('p', { class: 'muted' }, 'This week\'s prompt came from the house deck.');

  const entries = round.entries.map((e, i) => h('article', {
    // Your own entry is never right/wrong — it just gets the "yours" treatment.
    class: `card entry ${e.mine ? 'entry-mine'
      : e.my_guess ? (e.my_guess_correct ? 'entry-right' : 'entry-wrong') : ''}`,
  },
    h('div', { class: 'entry-head' },
      h('span', { class: 'entry-num' }, `Entry ${i + 1}`),
      h('span', { class: 'reveal-author' }, '~ ', h('strong', {}, e.author)),
      e.mine ? h('span', { class: 'tag' }, 'Yours') : null,
      e.my_guess && !e.mine
        ? (e.my_guess_correct
          ? h('span', { class: 'tag tag-ok' }, 'Correct')
          : h('span', { class: 'tag tag-bad' }, 'Wrong'))
        : null),
    h('div', { class: 'entry-body' }, e.body)));

  return h('div', { class: 'stack' },
    promptCard(round, promptLine),
    mine ? h('div', { class: 'card score-card' },
      h('h3', {}, `You scored ${mine.points} this week`),
      h('ul', { class: 'breakdown' }, ...Object.entries(mine.breakdown).map(([k, v]) =>
        h('li', {}, h('span', {}, LABELS[k] || k), h('strong', {}, `+${v}`))))) : null,
    h('div', { class: 'panel-head' }, art.art(art.mask, 'art-tile'), h('h2', {}, 'Who wrote what')),
    ...entries,
    suggestCard(data),
  );
}

const LABELS = {
  correctGuess: 'Correct guesses',
  fooledSomeone: 'Players you fooled',
  promptAuthorBonus: 'Named the prompt author',
  submitted: 'Submitted an entry',
  guessed: 'Turned in guesses',
};

function leaderboardCard(rows, me) {
  return h('div', { class: 'card' },
    h('div', { class: 'panel-head' }, art.art(art.trophy, 'art-tile'), h('h3', {}, 'Standings')),
    h('ol', { class: 'leaderboard' }, ...rows.map((r, i) =>
      h('li', { class: r.id === me.id ? 'is-me' : '' },
        h('span', { class: 'rank' }, `${i + 1}`),
        h('span', { class: 'lb-name' }, r.username),
        h('span', { class: 'lb-pts' }, `${r.total}`)))));
}

// ---------------------------------------------------------------- history

export function historyView(groupId, data) {
  return h('div', { class: 'stack' },
    h('a', { class: 'btn btn-ghost', href: `#/g/${groupId}` }, '← Back'),
    h('h1', {}, 'Past weeks'),
    ...(data.rounds.length
      ? data.rounds.map((r) => h('section', { class: 'card' },
        h('div', { class: 'row space-between' },
          h('h3', {}, `Week ${r.week_index}`),
          h('span', { class: 'muted' }, fmtDate(r.reveals_at))),
        h('blockquote', {}, r.prompt),
        ...r.entries.map((e) => h('details', { class: 'past-entry' },
          h('summary', {}, e.author),
          h('div', { class: 'entry-body' }, e.body)))))
      : [h('div', { class: 'center-col stack' },
          art.art(art.teacup, 'art-hero'),
          h('p', { class: 'muted' }, 'Nothing revealed yet ~ come back after your first Sunday.'))]),
  );
}

// --------------------------------------------------------------- settings

export function settingsView(data, refresh) {
  const { group } = data;
  const fields = {};
  const row = (label, node, hint) => h('div', { class: 'field' },
    h('label', { class: 'label' }, label), node,
    hint ? h('p', { class: 'hint' }, hint) : null);

  const dowSelect = (name, val) => {
    const s = h('select', { class: 'select' },
      ...DOWS.map((d, i) => h('option', { value: i, selected: i === val }, d)));
    fields[name] = () => Number(s.value);
    return s;
  };
  const hourSelect = (name, val) => {
    const s = h('select', { class: 'select' }, ...Array.from({ length: 24 }, (_, i) =>
      h('option', { value: i, selected: i === val },
        `${((i + 11) % 12) + 1}:00 ${i < 12 ? 'am' : 'pm'}`)));
    fields[name] = () => Number(s.value);
    return s;
  };

  const tz = h('input', { class: 'input', value: group.tz });
  fields.tz = () => tz.value.trim();

  const webhook = h('input', {
    class: 'input', type: 'url',
    placeholder: group.has_webhook ? '•••• saved ~ paste a new one to replace' : 'https://discord.com/api/webhooks/…',
  });

  const save = h('button', { class: 'btn btn-primary' }, 'Save settings');
  save.addEventListener('click', async () => {
    save.disabled = true;
    const patch = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f()]));
    if (webhook.value.trim()) patch.webhook_url = webhook.value.trim();
    try {
      await api.saveSettings(group.id, patch);
      toast('Saved. New timings apply from the next round.', 'success');
      refresh();
    } catch (err) { toast(err.message, 'error'); }
    finally { save.disabled = false; }
  });

  return h('div', { class: 'stack' },
    h('a', { class: 'btn btn-ghost', href: `#/g/${group.id}` }, '← Back'),
    h('h1', {}, 'Group settings'),
    h('div', { class: 'card' },
      h('h3', {}, 'Schedule'),
      row('Time zone', tz, 'An IANA name, like America/New_York or Europe/Berlin.'),
      h('div', { class: 'two-col' },
        row('Prompt drops', dowSelect('open_dow', group.open_dow)),
        row('at', hourSelect('open_hour', group.open_hour))),
      h('div', { class: 'two-col' },
        row('Writing closes', dowSelect('close_dow', group.close_dow)),
        row('at', hourSelect('close_hour', group.close_hour))),
      h('div', { class: 'two-col' },
        row('Results reveal', dowSelect('reveal_dow', group.reveal_dow)),
        row('at', hourSelect('reveal_hour', group.reveal_hour)))),
    h('div', { class: 'card' },
      h('h3', {}, 'Discord notifications'),
      h('p', { class: 'muted' },
        'In Discord: Channel settings → Integrations → Webhooks → New Webhook → Copy URL. ',
        'The bot posts when a prompt opens, when writing is about to close, when guessing ',
        'starts, and when results land.'),
      row('Webhook URL', webhook),
      group.has_webhook ? h('span', { class: 'tag tag-ok' }, 'Webhook connected') : null),
    h('div', { class: 'center' }, save),
  );
}

export function errorView(message, retry) {
  return h('div', { class: 'stack center-col' },
    h('h2', {}, 'Something went sideways'),
    h('p', { class: 'muted' }, message),
    h('div', { class: 'row' },
      retry ? h('button', { class: 'btn', onclick: retry }, 'Try again') : null,
      h('button', { class: 'btn btn-ghost', onclick: logout }, 'Sign out')));
}
