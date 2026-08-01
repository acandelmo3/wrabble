import test from 'node:test';
import assert from 'node:assert/strict';
import { zonedToEpoch, epochToZoned, lastOccurrence, nextOccurrence, roundSchedule } from '../src/time.js';

const NY = 'America/New_York';
const iso = (e) => new Date(e * 1000).toISOString();

test('zonedToEpoch handles standard time', () => {
  // 2025-01-15 09:00 EST = 14:00 UTC
  assert.equal(iso(zonedToEpoch({ year: 2025, month: 1, day: 15, hour: 9 }, NY)),
    '2025-01-15T14:00:00.000Z');
});

test('zonedToEpoch handles daylight time', () => {
  // 2025-07-15 09:00 EDT = 13:00 UTC
  assert.equal(iso(zonedToEpoch({ year: 2025, month: 7, day: 15, hour: 9 }, NY)),
    '2025-07-15T13:00:00.000Z');
});

test('round trip through epochToZoned', () => {
  const e = zonedToEpoch({ year: 2025, month: 3, day: 12, hour: 20 }, NY);
  const z = epochToZoned(e, NY);
  assert.deepEqual(
    { y: z.year, m: z.month, d: z.day, h: z.hour },
    { y: 2025, m: 3, d: 12, h: 20 },
  );
  assert.equal(z.dow, 3); // Wednesday
});

test('lastOccurrence finds the Monday 9am that already happened', () => {
  // Wednesday 2025-01-15 12:00 EST
  const from = zonedToEpoch({ year: 2025, month: 1, day: 15, hour: 12 }, NY);
  const got = epochToZoned(lastOccurrence(from, 1, 9, NY), NY);
  assert.deepEqual({ m: got.month, d: got.day, h: got.hour, dow: got.dow },
    { m: 1, d: 13, h: 9, dow: 1 });
});

test('lastOccurrence on the boundary day before the hour goes back a week', () => {
  // Monday 2025-01-13 08:00, before the 9am boundary
  const from = zonedToEpoch({ year: 2025, month: 1, day: 13, hour: 8 }, NY);
  const got = epochToZoned(lastOccurrence(from, 1, 9, NY), NY);
  assert.deepEqual({ m: got.month, d: got.day }, { m: 1, d: 6 });
});

test('nextOccurrence is strictly forward, even standing exactly on it', () => {
  const on = zonedToEpoch({ year: 2025, month: 1, day: 13, hour: 9 }, NY);
  const got = epochToZoned(nextOccurrence(on, 1, 9, NY), NY);
  assert.deepEqual({ m: got.month, d: got.day, h: got.hour }, { m: 1, d: 20, h: 9 });
});

test('spring-forward week keeps wall-clock hours intact', () => {
  // DST starts Sun 2025-03-09. A round opening Mon 03-03 09:00 EST must still
  // close Thu 03-06 20:00 and reveal Sun 03-09 21:00 EDT (a 23-hour day).
  const open = zonedToEpoch({ year: 2025, month: 3, day: 3, hour: 9 }, NY);
  const group = { tz: NY, close_dow: 4, close_hour: 20, reveal_dow: 0, reveal_hour: 21 };
  const s = roundSchedule(open, group);
  const c = epochToZoned(s.closes_at, NY);
  const r = epochToZoned(s.reveals_at, NY);
  assert.deepEqual({ d: c.day, h: c.hour }, { d: 6, h: 20 });
  assert.deepEqual({ d: r.day, h: r.hour }, { d: 9, h: 21 });
});

test('fall-back week keeps wall-clock hours intact', () => {
  // DST ends Sun 2025-11-02.
  const open = zonedToEpoch({ year: 2025, month: 10, day: 27, hour: 9 }, NY);
  const group = { tz: NY, close_dow: 4, close_hour: 20, reveal_dow: 0, reveal_hour: 21 };
  const s = roundSchedule(open, group);
  const r = epochToZoned(s.reveals_at, NY);
  assert.deepEqual({ m: r.month, d: r.day, h: r.hour }, { m: 11, d: 2, h: 21 });
});

test('schedule ordering holds: open < close < reveal', () => {
  const group = { tz: NY, close_dow: 4, close_hour: 20, reveal_dow: 0, reveal_hour: 21 };
  // Walk a full year of Mondays; every week must produce a sane schedule.
  let open = zonedToEpoch({ year: 2025, month: 1, day: 6, hour: 9 }, NY);
  for (let i = 0; i < 52; i++) {
    const s = roundSchedule(open, group);
    assert.ok(s.opens_at < s.closes_at, `week ${i}: open < close`);
    assert.ok(s.closes_at < s.reveals_at, `week ${i}: close < reveal`);
    const span = (s.reveals_at - s.opens_at) / 86400;
    assert.ok(span > 5.5 && span < 7.5, `week ${i}: span ${span}d out of range`);
    open = nextOccurrence(open, 1, 9, NY);
  }
});

test('works in a half-hour-offset zone', () => {
  const IN = 'Asia/Kolkata';
  const e = zonedToEpoch({ year: 2025, month: 6, day: 2, hour: 9 }, IN);
  assert.equal(iso(e), '2025-06-02T03:30:00.000Z');
  const z = epochToZoned(e, IN);
  assert.deepEqual({ h: z.hour, dow: z.dow }, { h: 9, dow: 1 });
});
