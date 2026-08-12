import { API_BASE } from './config.js';

const TOKEN_KEY = 'wrabble.token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// The Worker redirects back with #token=... after Discord OAuth; stash it and
// scrub the fragment so the token doesn't sit in the address bar or history.
export function captureTokenFromUrl() {
  const m = location.hash.match(/[#&]token=([^&]+)/);
  if (!m) return false;
  setToken(decodeURIComponent(m[1]));
  history.replaceState(null, '', location.pathname + location.search + '#/');
  return true;
}

export function login() {
  const back = location.origin + location.pathname;
  location.href = `${API_BASE}/auth/login?return=${encodeURIComponent(back)}`;
}

export function logout() {
  clearToken();
  location.hash = '#/';
  location.reload();
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function req(method, path, body) {
  const headers = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is the API deployed and reachable?');
  }

  if (res.status === 401) { clearToken(); throw new ApiError(401, 'Your session expired.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  me: () => req('GET', '/api/me'),
  setDisplayName: (name) => req('PUT', '/api/me', { display_name: name }),
  setNickname: (groupId, name) => req('PUT', `/api/groups/${groupId}/nickname`, { nickname: name }),
  group: (id) => req('GET', `/api/groups/${id}`),
  history: (id) => req('GET', `/api/groups/${id}/history`),
  createGroup: (name, tz) => req('POST', '/api/groups', { name, tz }),
  joinGroup: (code) => req('POST', '/api/groups/join', { code }),
  saveSettings: (id, patch) => req('PUT', `/api/groups/${id}/settings`, patch),
  submit: (roundId, text) => req('PUT', `/api/rounds/${roundId}/submission`, { body: text }),
  guess: (roundId, guesses, promptAuthor) =>
    req('POST', `/api/rounds/${roundId}/guesses`, { guesses, prompt_author: promptAuthor }),
  suggestPrompt: (groupId, text) => req('POST', `/api/groups/${groupId}/prompts`, { text }),
  advance: (groupId, to) => req('POST', `/api/groups/${groupId}/advance`, { to }),
};
