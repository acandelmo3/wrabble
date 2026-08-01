# Wrabble — all user-facing copy

Every string a player can see, grouped by where it appears. Rewrite the text
under each heading and hand this file back; the `file:line` refs are so the
edits can be applied precisely.

`${...}` are values filled in at runtime — keep them (you can move them around).
Dashes inside copy are `~` by convention — em dashes are not used in player-facing text.

---

## 1. Browser tab & metadata

**Page title** — `web/index.html:6`
> Wrabble | Weekly Game

**Search/social description** — `web/index.html:7`
> Answer one prompt, then guess who wrote what.

---

## 2. Header & shell (every screen)

**Wordmark** — `web/index.html:26`
> Wrabble

**Loading, first paint** — `web/index.html:29`
> Finding your seat…

**Loading, between screens** — `web/js/app.js:57`
> Loading…

**Footer** — `web/index.html:31`
> One prompt a week. 10 letters, 10 pages, or anywhere in between.

**Sign in button (header)** — `web/js/app.js:35`
> Sign in with Discord

**Sign out button** — `web/js/app.js:34`
> Sign out

**Theme toggle tooltip** — `web/js/app.js:15`
> Switch between daylight and lamplight

**Theme toggle screen-reader label** — `web/js/app.js:16`
> Switch theme

---

## 3. Landing page (signed out)

**Headline** — `web/js/views.js:13`
> One prompt a week.

**Intro paragraph** — `web/js/views.js:15-17`
> Everybody in your group answers the same question. 
> Your answer could be 10 letters, 10 pages, or anywhere in between. 
> Thursday night the answers are sent out.
> Guess who wrote what and earn points for correct answers.

**Main button** — `web/js/views.js:19`
> Sign in with Discord

### The four "how it works" steps — `web/js/views.js:21-27`

Each step is a label plus a line of explanation.

**Step 1 label**
> Monday

**Step 1 text**
> A prompt is drawn at random from your group's pool.

**Step 2 label**
> By Thursday

**Step 2 text**
> Everyone submits. Answers are hidden.

**Step 3 label**
> Thursday night

**Step 3 text**
> Answers appear anonymized. Guess who wrote what.

**Step 4 label**
> Sunday night

**Step 4 text**
> Names revealed, points tallied, standings updated.

---

## 4. Home — your groups

**Greeting** — `web/js/views.js:41`
> Hey, ${username}

**Empty state** — `web/js/views.js:49`
> You are not in a group yet. Make one, or join with a code.

**Create card title** — `web/js/views.js:52`
> Start a group

**Create card field label** — `web/js/views.js:52`
> Name

**Create card placeholder** — `web/js/views.js:52`
> Sunday Night Writers

**Create button** — `web/js/views.js:52`
> Create

**Join card title** — `web/js/views.js:58`
> Join a group

**Join card field label** — `web/js/views.js:58`
> Invite code

**Join card placeholder** — `web/js/views.js:58`
> ABC234

**Join button** — `web/js/views.js:58`
> Join

---

## 5. Group header & phase bar

**Invite code prefix** — `web/js/views.js:98`
> Invite code

**Player count** — `web/js/views.js:99`
> ${n} player / ${n} players

**Past weeks link** — `web/js/views.js:101`
> Past weeks

**Settings link** — `web/js/views.js:101`
> Settings

**No round yet** — `web/js/views.js:108`
> No round yet ~ check back shortly.

**Phase pills** — `web/js/views.js:130-132`
> Writing
> Guessing
> Revealed

**Week badge** — `web/js/views.js:138`
> Week ${n}

**Countdown label, before the prompt drops** — `web/js/views.js:141`
> Prompt drops in

**Countdown label, during writing** — `web/js/views.js:142`
> Submissions close in

**Countdown label, during guessing** — `web/js/views.js:142`
> Reveal in

**After the reveal** — `web/js/views.js:146`
> Next prompt drops ${weekday}

**Prompt card eyebrow** — `web/js/views.js:152`
> This week

---

## 6. Waiting for the first Monday

Shown when a group is created mid-week and its first round is scheduled.

**Heading** — `web/js/views.js:167`
> Week ${n} opens ${weekday}

**Body** — `web/js/views.js:169-171`
> Your first prompt drops ${date} ~ that is ${countdown} from now. Everyone writes,
> then Thursday night you guess who wrote what.

**Hint** — `web/js/views.js:173`
> Share the invite code meanwhile so the whole group is in before it starts.

---

## 7. Writing phase

**Panel heading** — `web/js/views.js:208`
> Your answer

**Textarea placeholder** — `web/js/views.js:179`
> Write anything. 10 letters, 10 pages, or anywhere in between.

**Counter** — `web/js/views.js:185`
> ${n} words · ${n} characters

**Submitted badge** — `web/js/views.js:209`
> Submitted

**Submit button, first time** — `web/js/views.js:191`
> Submit my entry

**Submit button, editing** — `web/js/views.js:191`
> Update my entry

**Progress line** — `web/js/views.js:213-214`
> ${n} of ${n} in so far. Nobody can read any answers until the cutoff.

---

## 8. Guessing phase

**Section heading** — `web/js/views.js:272-273`
> ${n} anonymous entry / ${n} anonymous entries

**Entry label** — `web/js/views.js:236`
> Entry ${n}

**Entry word count** — `web/js/views.js:237`
> ${n} words

**Your own entry badge** — `web/js/views.js:238`
> Yours

**Dropdown, someone else's entry** — `web/js/views.js:228`
> Who wrote this?

**Dropdown, your own entry (disabled)** — `web/js/views.js:228`
> This one is yours

**Your own name in the dropdown** — `web/js/views.js:231`
> ${username} (me)

**Bonus card title** — `web/js/views.js:252`
> Bonus round

**Bonus card text** — `web/js/views.js:253`
> Someone in this group wrote the prompt itself. Name them for extra points.

**Bonus dropdown** — `web/js/views.js:246`
> Who wrote this week's prompt?

**Submit button** — `web/js/views.js:257`
> Lock in my guesses

---

## 9. Suggest next week's prompt

**Card title** — `web/js/views.js:284`
> Write next week's prompt

**Explanation (before you've suggested)** — `web/js/views.js:314-315`
> Prompts are drawn at random from what the group submits. You'll guess who wrote the selected prompt next week.

**Input placeholder** — `web/js/views.js:297`
> e.g. "Describe a room you have never told anyone about."

**Button** — `web/js/views.js:300`
> Add to the pool

**After you've suggested — intro** — `web/js/views.js:290`
> Your prompt is in the pool for future weeks:

**After you've suggested — note** — `web/js/views.js:292`
> One suggestion each per week.

---

## 10. Reveal

**Section heading** — `web/js/views.js:357`
> Who wrote what

**Author byline separator (before each revealed name)** — `web/js/views.js:343`
> ~

**Prompt byline** — `web/js/views.js:327`
> Prompt written by ${name}

**You guessed the prompt author right** — `web/js/views.js:330`
> You called it

**You guessed the prompt author wrong** — `web/js/views.js:331`
> You missed this one

**House-supplied prompt (nobody wrote it)** — `web/js/views.js:333`
> This week's prompt came from the house deck.

**Your score card** — `web/js/views.js:354`
> You scored ${n} this week

**Correct attribution badge** — `web/js/views.js:348`
> Correct

**Wrong attribution badge** — `web/js/views.js:349`
> Wrong

### Score breakdown labels — `web/js/views.js:363-370`

> Correct guesses
> Players you fooled
> Named the prompt author
> Submitted an entry
> Turned in guesses

---

## 11. Standings

**Card title** — `web/js/views.js:375`
> Standings

---

## 12. Past weeks

**Back link** — `web/js/views.js:386`
> ← Back

**Page title** — `web/js/views.js:387`
> Past weeks

**Round heading** — `web/js/views.js:391`
> Week ${n}

**Empty state** — `web/js/views.js:399`
> Nothing revealed yet ~ come back after your first Sunday.

---

## 13. Settings (group owner only)

**Back link** — `web/js/views.js:448`
> ← Back

**Page title** — `web/js/views.js:449`
> Group settings

**Schedule section title** — `web/js/views.js:451`
> Schedule

**Timezone label** — `web/js/views.js:452`
> Time zone

**Timezone hint** — `web/js/views.js:452`
> An IANA name, like America/New_York or Europe/Berlin.

**Schedule row labels** — `web/js/views.js:454-461`
> Prompt drops
> Writing closes
> Results reveal
> at

**Discord section title** — `web/js/views.js:463`
> Discord notifications

**Discord instructions** — `web/js/views.js:465-467`
> In Discord: Channel settings → Integrations → Webhooks → New Webhook → Copy URL.
> The bot posts when a prompt opens, when writing is about to close, when guessing
> starts, and when results land.

**Webhook field label** — `web/js/views.js:468`
> Webhook URL

**Webhook placeholder when one is saved** — `web/js/views.js:431`
> •••• saved ~ paste a new one to replace

**Webhook connected badge** — `web/js/views.js:469`
> Webhook connected

**Save button** — `web/js/views.js:434`
> Save settings

---

## 14. Toasts (the little pop-up confirmations)

**Group created** — `web/js/views.js:54`
> Created! Invite code: ${code}

**Group joined** — `web/js/views.js:60`
> Joined ${name}

**Entry saved** — `web/js/views.js:197`
> Saved. You can keep editing until the cutoff.

**Tried to submit an empty entry** — `web/js/views.js:193`
> Write something first.

**Guesses saved** — `web/js/views.js:262`
> Guesses saved. Change them any time before the reveal.

**Prompt suggestion added** — `web/js/views.js:307`
> Added to the pool.

**Settings saved** — `web/js/views.js:441`
> Saved. New timings apply from the next round.

**Invite code copied** — `web/js/dom.js:101`
> ${label} ${code} copied. Send it to your friends.

**Clipboard blocked** — `web/js/dom.js:94`
> Clipboard blocked ~ the code is selected, press Ctrl/Cmd+C.

**Copy button tooltip** — `web/js/dom.js:78`
> Copy invite code

**Copy button screen-reader label** — `web/js/dom.js:79`
> ${label} ${code}. Click to copy.

**Copied confirmation on the pill** — `web/js/dom.js:99`
> Copied

---

## 15. Error screens & messages

**Error screen title** — `web/js/views.js:476`
> Something went sideways

**Retry button** — `web/js/views.js:479`
> Try again

**Sign out button** — `web/js/views.js:480`
> Sign out

**Server unreachable** — `web/js/api.js:46`
> Could not reach the server. Is the API deployed and reachable?

**Session expired** — `web/js/api.js:49`
> Your session expired.

**Generic failure** — `web/js/api.js:51`
> Request failed (${status})

### Messages from the server — `worker/src/index.js`

These surface inside the error screen or a toast.

> not signed in `(:35)`
> group not found, or you are not a member `(:48)`
> no group with that code `(:171)`
> only the group owner can change settings `(:192)`
> nothing to update `(:199)`
> round not found `(:211, :241)`
> this week has not started yet `(:213)`
> submissions are closed for this round `(:215)`
> write something first `(:218)`
> that is longer than 100k characters `(:219)`
> guessing is not open for this round `(:243)`
> prompt text required `(:279)`
> keep prompts under 500 characters `(:280)`
> You already suggested a prompt this week ~ one each. Yours: "${text}" `(:294)`
> time travel is disabled `(:334)`

---

## 16. Time words — `web/js/dom.js:38-46`

Used in every countdown.

> now
> under a minute
> ${d}d ${h}h
> ${h}h ${m}m
> ${m}m

---

## 17. Discord posts — `worker/src/discord.js`

Four posts a week. Each has a **title** and a **body**. `**bold**` and `> quote`
are Discord markdown. `${timestamp}` renders in each reader's own timezone.

### Monday — a new prompt

**Title** `(:34)`
> Week ${n}: a new prompt is live

**Body** `(:35)`
> > ${prompt}
>
> Write anything ~ 10 letters, 10 pages, or anywhere in between. Submissions close ${timestamp}.

### Wednesday — last call

**Title** `(:45)`
> Last call ~ submissions close soon

**Body** `(:46-48)`
> > ${prompt}
>
> Closes ${timestamp}.
>
> Still missing: ${names}
>
> _(or, if everyone has submitted:)_ Everyone is in.

### Thursday — guessing opens

**Title** `(:57)`
> Answers are in ~ time to guess

**Body** `(:58)`
> ${n} entries for week ${n}. Read them and pin a name to each one.
>
> Results reveal ${timestamp}. **Suggest next week's prompt while you're in there.**

### Sunday — results

**Title** `(:74)`
> Week ${n} revealed

**Body** `(:76-84)`
> > ${prompt}
>
> _Prompt by **${author}**_
>
> **Who wrote what**
> **${author}** ~ guessed right by ${n}/${n}
>
> **Standings**
> ${rank}. **${name}** ~ ${n} pts _(+${n} this week)_

**When there are no entries** `(:80)`
> _no entries_

**When there are no scores** `(:83)`
> _no scores yet_

---

## 18. Starter prompts — `worker/src/rounds.js:11-20`

Used only when the group's own prompt pool is empty, so a week never stalls.

> Describe a place you can no longer go back to.
> What is the worst advice you ever followed?
> Write about a stranger you still think about.
> The most embarrassing thing you did before age 12.
> Something you believed for far too long.
> Describe your ideal Tuesday, hour by hour.
> A meal that meant more than the food.
> What would your 10-year-old self be disappointed by?
> The last time you were genuinely surprised.
> Write an apology you never sent.

---

## 19. Setup page — `worker/src/index.js:65-93`

Only seen if the app is deployed before Discord sign-in is configured.

**Title**
> Discord sign-in isn't set up yet

**Body**
> The app is running, but it has no Discord application to sign you in with. Three steps:
>
> 1. Create an app at discord.com/developers/applications.
> 2. Under **OAuth2**, add this exact redirect URL: ${url}
> 3. Put the **Client ID** into `DISCORD_CLIENT_ID` in `wrangler.toml`, and set the **Client Secret** with `wrangler secret put DISCORD_CLIENT_SECRET` (locally: add it to `worker/.dev.vars`).
>
> Testing locally without Discord? Run `npm run players` in `worker/` for sign-in links that skip OAuth entirely.
