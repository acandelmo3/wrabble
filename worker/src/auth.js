// Discord OAuth + stateless session tokens.
//
// The web app lives on github.io and the API on workers.dev — cross-origin, so
// we avoid cookies entirely and hand the browser a signed bearer token that it
// keeps in localStorage. Token = base64url(payload).base64url(HMAC-SHA256).

const enc = new TextEncoder();

function b64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
  );
}

export async function signToken(payload, secret, ttlSeconds = 60 * 60 * 24 * 30) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = b64urlEncode(enc.encode(JSON.stringify(body)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(data));
  return `${data}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  let ok;
  try {
    ok = await crypto.subtle.verify(
      'HMAC', await hmacKey(secret), b64urlDecode(sig), enc.encode(data),
    );
  } catch {
    return null;
  }
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(data)));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function oauthRedirectUrl(env, state) {
  const u = new URL('https://discord.com/api/oauth2/authorize');
  u.searchParams.set('client_id', env.DISCORD_CLIENT_ID);
  u.searchParams.set('redirect_uri', `${env.API_BASE_URL}/auth/callback`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'identify');
  u.searchParams.set('state', state);
  return u.toString();
}

export async function exchangeCode(env, code) {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${env.API_BASE_URL}/auth/callback`,
    }),
  });
  if (!res.ok) throw new Error(`discord token exchange failed: ${res.status}`);
  const { access_token } = await res.json();

  const me = await fetch('https://discord.com/api/users/@me', {
    headers: { authorization: `Bearer ${access_token}` },
  });
  if (!me.ok) throw new Error(`discord identify failed: ${me.status}`);
  return me.json();
}
