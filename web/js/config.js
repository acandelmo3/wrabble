// Point the static site at its Worker.
//
// Only the published site talks to the deployed Worker. Everything else — a
// laptop on localhost, a homelab box reached over Tailscale — talks to a
// Worker on the same host it was served from.
//
// Deriving this from `location` rather than listing known dev hostnames is
// deliberate: an unrecognised host used to fall through to production, so a
// dev page served from anywhere but localhost would quietly read and write the
// real database. Failing toward the local Worker is the safe direction.
const PROD_HOST = 'acandelmo3.github.io';
const PROD_API = 'https://wrabble-api.acandelmo3.workers.dev';

// `wrangler dev` serves plain http on 8787. Behind `tailscale serve` the page
// arrives over https, and the API is expected on 8443 (see README).
const DEV_PORT = location.protocol === 'https:' ? 8443 : 8787;

export const API_BASE = location.hostname === PROD_HOST
  ? PROD_API
  : `${location.protocol}//${location.hostname}:${DEV_PORT}`;
