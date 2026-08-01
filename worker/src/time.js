// Timezone-aware scheduling helpers.
//
// D1 stores every instant as unix seconds (UTC). Groups configure their
// deadlines as local wall-clock (day-of-week + hour) in their own tz, so we
// need to convert wall-clock -> epoch across DST boundaries without pulling in
// a date library. Workers ships a full-ICU Intl, so we use the offset-probe
// trick: guess the epoch as if the zone were UTC, ask Intl what that instant
// looks like locally, and correct by the difference. Two passes settle it even
// when the guess lands on a DST jump.

const DAY = 86400;

function tzOffsetSeconds(epochSec, tz) {
  const d = new Date(epochSec * 1000);
  // 'en-CA' gives YYYY-MM-DD, which parses back predictably.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  // Intl renders midnight as hour "24" in some locales/zones; normalize.
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    hour, Number(parts.minute), Number(parts.second),
  ) / 1000;
  return asUTC - epochSec;
}

/** Epoch seconds for a local wall-clock time in `tz`. */
export function zonedToEpoch({ year, month, day, hour = 0, minute = 0 }, tz) {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0) / 1000;
  let epoch = naive - tzOffsetSeconds(naive, tz);
  epoch = naive - tzOffsetSeconds(epoch, tz);
  return epoch;
}

/** Local calendar fields for an instant, in `tz`. */
export function epochToZoned(epochSec, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', weekday: 'short',
  }).formatToParts(new Date(epochSec * 1000))
    .reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  const dows = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour === '24' ? 0 : Number(parts.hour),
    dow: dows[parts.weekday],
  };
}

/**
 * The most recent instant at or before `fromEpoch` matching dow/hour in tz.
 * Used to anchor a round to "the Monday 9am that just happened".
 */
export function lastOccurrence(fromEpoch, dow, hour, tz) {
  const z = epochToZoned(fromEpoch, tz);
  let backDays = (z.dow - dow + 7) % 7;
  let candidate = zonedToEpoch({ ...z, hour }, tz) - backDays * DAY;
  // Re-resolve: subtracting raw days can drift by an hour across DST, and if
  // backDays was 0 we may have landed later today than `fromEpoch`.
  candidate = snapToWallClock(candidate, hour, tz);
  if (candidate > fromEpoch) candidate = snapToWallClock(candidate - 7 * DAY, hour, tz);
  return candidate;
}

/** The first instant strictly after `fromEpoch` matching dow/hour in tz. */
export function nextOccurrence(fromEpoch, dow, hour, tz) {
  let candidate = lastOccurrence(fromEpoch, dow, hour, tz);
  while (candidate <= fromEpoch) candidate = snapToWallClock(candidate + 7 * DAY, hour, tz);
  return candidate;
}

// Re-anchors an approximate epoch onto the exact local wall-clock hour of the
// local day it falls in — this is what absorbs DST shifts.
function snapToWallClock(epoch, hour, tz) {
  const z = epochToZoned(epoch, tz);
  return zonedToEpoch({ ...z, hour }, tz);
}

/**
 * Full schedule for a round that opens at `openEpoch`.
 * closes/reveals are the next matching wall-clocks after the open.
 */
export function roundSchedule(openEpoch, group) {
  const closes = nextOccurrence(openEpoch, group.close_dow, group.close_hour, group.tz);
  const reveals = nextOccurrence(closes, group.reveal_dow, group.reveal_hour, group.tz);
  return { opens_at: openEpoch, closes_at: closes, reveals_at: reveals };
}
