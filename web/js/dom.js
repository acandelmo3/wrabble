// Minimal DOM builder. Everything user-authored (entries, names, prompts) goes
// in as a text node, never as HTML — that's the whole point of not using
// innerHTML here, since submissions are arbitrary player text.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'html') el.innerHTML = v; // only ever called with our own markup
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const mount = (node) => {
  const app = document.getElementById('app');
  app.replaceChildren(node);
};

export function fmtDate(epoch, tz) {
  return new Date(epoch * 1000).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: tz || undefined,
  });
}

/** "2d 4h" / "3h 12m" / "under a minute" */
export function countdown(epoch, nowSec) {
  let s = epoch - (nowSec ?? Math.floor(Date.now() / 1000));
  if (s <= 0) return 'now';
  const d = Math.floor(s / 86400); s -= d * 86400;
  const hr = Math.floor(s / 3600); s -= hr * 3600;
  const mi = Math.floor(s / 60);
  if (d) return `${d}d ${hr}h`;
  if (hr) return `${hr}h ${mi}m`;
  if (mi) return `${mi}m`;
  return 'under a minute';
}

export const wordCount = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);

async function writeClipboard(text) {
  // navigator.clipboard needs a secure context; localhost and the deployed
  // https site both qualify, but fall back rather than fail silently.
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/**
 * The invite code, as a button that copies itself. Used inside group cards
 * (which are links), so it has to swallow the click.
 */
export function codePill(code, { label = 'Invite code' } = {}) {
  const btn = h('button', {
    class: 'code-pill',
    type: 'button',
    title: `Copy ${label.toLowerCase()}`,
    'aria-label': `${label} ${code}. Click to copy.`,
  }, code);

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await writeClipboard(code);
    if (!ok) {
      // Clipboard access can be refused outright. Select the code instead so a
      // manual copy is one keystroke rather than a careful re-type.
      const range = document.createRange();
      range.selectNodeContents(btn);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return toast('Clipboard blocked ~ the code is selected, press Ctrl/Cmd+C.', 'error');
    }

    // Swap the label briefly, keeping the button's width so nothing shifts.
    btn.style.minWidth = `${btn.offsetWidth}px`;
    btn.classList.add('copied');
    btn.textContent = 'Copied';
    toast(`${label} ${code} copied. Send it to your friends.`, 'success');
    setTimeout(() => {
      btn.textContent = code;
      btn.classList.remove('copied');
      btn.style.minWidth = '';
    }, 1400);
  });

  return btn;
}

export function toast(message, kind = 'info') {
  const el = h('div', { class: `toast toast-${kind}` }, message);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
