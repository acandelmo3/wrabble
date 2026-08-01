// Discord notifications via per-group incoming webhooks.
//
// A webhook (rather than a hosted bot) keeps this serverless: the group owner
// pastes a channel webhook URL once, and the cron worker POSTs to it. Nothing
// to keep alive, no gateway connection, no bot token in the hot path.

const COLORS = {
  opened: 0x5865f2,
  closing_soon: 0xfaa61a,
  guessing: 0xeb459e,
  revealed: 0x57f287,
};

// Posts the embed only — never a `content` string. Text in `content` is what
// triggers @here/@everyone pings; mentions inside an embed render as names
// without notifying anyone.
async function post(webhookUrl, embed) {
  if (!webhookUrl) return { skipped: 'no webhook configured' };
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
  });
  if (!res.ok) {
    return { error: `webhook ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }
  return { ok: true };
}

const ts = (epoch) => `<t:${epoch}:F>`; // Discord renders this in each reader's tz.

export function notifyOpened(group, round, appUrl) {
  return post(group.webhook_url, {
    title: `Week ${round.week_index}: a new prompt is live`,
    description: `> ${round.prompt_text}\n\nWrite anything ~ 10 letters, 10 pages, or anywhere in between. Submissions close ${ts(round.closes_at)}.`,
    color: COLORS.opened,
    url: `${appUrl}#/g/${group.id}`,
    footer: { text: group.name },
  });
}

export function notifyClosingSoon(group, round, appUrl, missing) {
  const names = missing.map((m) => `<@${m.id}>`).join(' ');
  return post(group.webhook_url, {
    title: 'Last call ~ submissions close soon',
    description: `> ${round.prompt_text}\n\nCloses ${ts(round.closes_at)}.${
      missing.length ? `\n\nStill missing: ${names}` : '\n\nEveryone is in.'
    }`,
    color: COLORS.closing_soon,
    url: `${appUrl}#/g/${group.id}`,
    footer: { text: group.name },
  });
}

export function notifyGuessing(group, round, appUrl, count) {
  return post(group.webhook_url, {
    title: 'Answers are in ~ time to guess',
    description: `${count} ${count === 1 ? 'entry' : 'entries'} for week ${round.week_index}. Read them and pin a name to each one.\n\nResults reveal ${ts(round.reveals_at)}. **Suggest next week's prompt while you're in there.**`,
    color: COLORS.guessing,
    url: `${appUrl}#/g/${group.id}`,
    footer: { text: group.name },
  });
}

export function notifyRevealed(group, round, appUrl, { results, leaderboard, promptAuthor }) {
  const board = leaderboard.slice(0, 10)
    .map((r, i) => `${i + 1}. **${r.name}** ~ ${r.total} pts _(+${r.round_points} this week)_`)
    .join('\n');
  const lines = results
    .map((r) => `**${r.author}** ~ guessed right by ${r.correct}/${r.attempts}`)
    .join('\n');

  return post(group.webhook_url, {
    title: `Week ${round.week_index} revealed`,
    description: [
      `> ${round.prompt_text}`,
      promptAuthor ? `_Prompt by **${promptAuthor}**_` : '',
      '',
      '**Who wrote what**',
      lines || '_no entries_',
      '',
      '**Standings**',
      board || '_no scores yet_',
    ].filter(Boolean).join('\n'),
    color: COLORS.revealed,
    url: `${appUrl}#/g/${group.id}`,
    footer: { text: group.name },
  });
}
