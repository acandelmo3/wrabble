// Point the static site at your deployed Worker.
// Localhost automatically talks to `wrangler dev` so you can play offline.
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

export const API_BASE = LOCAL
  ? 'http://localhost:8787'
  : 'https://wrabble-api.acandelmo3.workers.dev';
