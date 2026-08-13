import { h, mount } from './dom.js';
import { api, getToken, captureTokenFromUrl, login, logout, ApiError } from './api.js';
import {
  landingView, homeView, groupView, historyView, settingsView, notesView, errorView,
} from './views.js';
import * as art from './art.js';
import { isDirty, pruneDrafts } from './drafts.js';

let me = null;

// One dead key per finished week otherwise.
pruneDrafts();

// Day <-> evening. The inline script in index.html sets the initial value
// before first paint; this only handles deliberate switches.
function themeToggle() {
  const btn = h('button', {
    class: 'btn theme-toggle',
    title: 'Switch between daylight and lamplight',
    'aria-label': 'Switch theme',
  }, art.art(document.documentElement.dataset.theme === 'evening' ? art.sunSmall : art.lamp));

  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'evening' ? 'day' : 'evening';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('wrabble.theme', next);
    renderNav();
  });
  return btn;
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.replaceChildren(
    h('div', { class: 'row' },
      me ? h('a', { class: 'btn btn-ghost', href: '#/' }, me.user.username) : null,
      me
        ? h('button', { class: 'btn btn-ghost', onclick: logout }, 'Sign out')
        : h('button', { class: 'btn btn-primary', onclick: login }, 'Sign in with Discord'),
      themeToggle()),
  );
}

// The masthead drawing is static, so it lives outside the router.
document.getElementById('brand').prepend(art.art(art.books));

const parseRoute = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);

async function router() {
  // Also runs on hashchange: pasting a #token=... link into an already-open tab
  // is a same-document navigation, so there is no reload to catch it at startup.
  if (captureTokenFromUrl()) me = null;
  const parts = parseRoute();

  // Patch notes are static and interesting to a signed-out visitor too, so
  // they come before the token check rather than behind it.
  if (parts[0] === 'notes') {
    renderNav();
    return mount(notesView());
  }

  if (!getToken()) {
    me = null;
    renderNav();
    return mount(landingView());
  }

  mount(h('div', { class: 'loading' }, 'Loading…'));

  try {
    if (!me) me = await api.me();
    renderNav();

    if (parts[0] === 'g' && parts[1]) {
      const id = parts[1];
      if (parts[2] === 'history') return mount(historyView(id, await api.history(id)));
      const data = await api.group(id);
      if (parts[2] === 'settings') return mount(settingsView(data, refresh));
      return mount(groupView(data, refresh));
    }

    return mount(homeView(me, refresh));
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return router();
    return mount(errorView(err.message, refresh));
  }
}

function refresh() {
  me = null;
  router();
}

captureTokenFromUrl();
addEventListener('hashchange', router);
router();

// The phase can flip while a tab sits open (Thursday 8pm arrives). Re-checking
// on focus means someone who left the tab up doesn't act on a stale phase.
//
// But re-checking means re-mounting, and re-mounting used to throw away
// whatever was in the textarea: alt-tabbing to look something up destroyed a
// long answer outright. The draft is saved to localStorage now, so nothing is
// lost either way ~ this just declines to yank the page out from under someone
// mid-sentence. The write itself is still guarded at the API, which refuses a
// submission once the round has closed.
addEventListener('focus', () => {
  if (!getToken() || isDirty()) return;
  router();
});

// Closing the tab with unsaved work prompts. The draft would survive it, but a
// silent discard still reads as lost writing.
addEventListener('beforeunload', (e) => {
  if (!isDirty()) return;
  e.preventDefault();
  e.returnValue = '';
});
