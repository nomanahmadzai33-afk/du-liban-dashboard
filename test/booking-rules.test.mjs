import test from 'node:test';
import assert from 'node:assert/strict';
import { availableSlots, durationMinutes, isOpenDate, overlaps, slotsForService, SERVICES } from '../booking-rules.mjs';

test('party-size duration follows the active Standard mode', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 12].map(durationMinutes), [90, 90, 120, 120, 150, 150, 180, 180, 210, 210]);
  assert.throws(() => durationMinutes(13), RangeError);
});

test('closed Monday and invalid dates have no availability', () => {
  assert.equal(isOpenDate('2026-09-21'), false);
  assert.equal(isOpenDate('2026-09-22'), true);
  assert.equal(isOpenDate('2026-02-30'), false);
  assert.deepEqual(availableSlots({ date: '2026-09-21', area: 'interior', partySize: 2, tables: [], reservations: [] }), []);
});

test('public slots are every 15 minutes and keep the shisha period outdoors', () => {
  assert.deepEqual(slotsForService(SERVICES[0]), ['13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45', '15:00', '15:15']);
  const base = { date: '2026-09-22', partySize: 2, reservations: [] };
  const indoor = availableSlots({ ...base, area: 'interior', tables: [{ id: 'i', area: 'interior', capacity: 2, active: true }] });
  assert.equal(indoor.some(s => s.service === 'shisha'), false);
  const terrace = availableSlots({ ...base, area: 'covered', tables: [{ id: 't', area: 'covered', capacity: 2, active: true }] });
  assert.equal(terrace.some(s => s.service === 'shisha'), true);
  assert.deepEqual(availableSlots({ ...base, area: 'terrace_bar', tables: [] }), []);
});

test('overlap blocks a table for the whole party-size duration', () => {
  assert.equal(overlaps('13:00', 120, '14:30', 90), true);
  assert.equal(overlaps('13:00', 90, '14:30', 90), false);
  const slots = availableSlots({ date: '2026-09-22', area: 'interior', partySize: 4,
    tables: [{ id: 'one', area: 'interior', capacity: 4, active: true }],
    reservations: [{ date: '2026-09-22', time: '13:00', tableId: 'one', partySize: 2, status: 'confirmada' }] });
  assert.equal(slots.some(s => s.time === '14:00'), false);
  assert.equal(slots.some(s => s.time === '14:30'), true);
});

test('pacing counts covers across areas, ignores canceled bookings', () => {
  const base = { date: '2026-09-22', area: 'covered', partySize: 2,
    tables: [{ id: 't', area: 'covered', capacity: 4, active: true }] };
  const reservation = { date: base.date, time: '13:00', tableId: 'another-area', partySize: 14, status: 'confirmada' };
  assert.equal(availableSlots({ ...base, reservations: [reservation] }).some(s => s.time === '13:00'), false);
  assert.equal(availableSlots({ ...base, reservations: [{ ...reservation, status: 'cancelada' }] }).some(s => s.time === '13:00'), true);
});
