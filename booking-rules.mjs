// Booking rules observed in Du Liban's SevenRooms widget audit (20 September 2026).
// This module contains no guest data and does not write reservations.

export const AREAS = Object.freeze({
  interior: { label: 'Salón interior', bookable: true },
  covered: { label: 'Terraza cubierta', bookable: true },
  outdoor: { label: 'Terraza exterior', bookable: true },
  chillout: { label: 'Chillout', bookable: false }, // Public widget access remains unverified.
  vip: { label: 'VIP', bookable: false }, // Confirm guest access before enabling.
  terrace_bar: { label: 'Barra terraza', bookable: false },
});

export const SERVICES = Object.freeze([
  { id: 'lunch', label: 'Comida', start: '13:00', end: '15:15', areas: ['interior', 'covered', 'outdoor'] },
  { id: 'shisha', label: 'Shisha y cócteles', start: '15:30', end: '19:45', areas: ['covered', 'outdoor'] },
  { id: 'dinner', label: 'Cena', start: '20:00', end: '22:15', areas: ['interior', 'covered', 'outdoor'] },
]);

export const MAX_PARTY_SIZE = 12;
export const MAX_COVERS_PER_INTERVAL = 15;

export function durationMinutes(partySize) {
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > MAX_PARTY_SIZE) {
    throw new RangeError('La reserva debe ser de 1 a 12 personas');
  }
  if (partySize <= 2) return 90;
  if (partySize <= 4) return 120;
  if (partySize <= 6) return 150;
  if (partySize <= 8) return 180;
  return 210;
}

export function minutes(time) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(time)) {
    throw new TypeError('Hora no válida');
  }
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function isOpenDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const day = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(day.valueOf()) && day.toISOString().slice(0, 10) === date && day.getUTCDay() !== 1;
}

export function slotsForService(service) {
  const slots = [];
  for (let t = minutes(service.start); t <= minutes(service.end); t += 15) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return slots;
}

// Both arguments are local Madrid clock times on the same booking date.
// A blocked table cannot take overlapping reservations, even if starts differ.
export function overlaps(startA, durationA, startB, durationB) {
  const a = minutes(startA);
  const b = minutes(startB);
  return a < b + durationB && b < a + durationA;
}

/**
 * Pure availability calculation for an already reconciled floorplan.
 * tables: [{id, area, capacity, active}]
 * reservations: [{tableId, time, partySize, status, date}]
 * A booking service must rerun this check transactionally before inserting.
 */
export function availableSlots({ date, area, partySize, tables, reservations }) {
  if (!isOpenDate(date)) return [];
  const duration = durationMinutes(partySize);
  if (!AREAS[area]?.bookable) return [];
  const candidates = tables.filter(t => t.active && t.area === area && t.capacity >= partySize);
  const live = reservations.filter(r => r.date === date && !['cancelada', 'cancelled', 'no_show', 'se_fue'].includes(String(r.status).toLowerCase()));
  return SERVICES.filter(s => s.areas.includes(area)).flatMap(service =>
    slotsForService(service).filter(time => {
      const coversAtStart = live.filter(r => r.time?.slice(0, 5) === time).reduce((sum, r) => sum + Number(r.partySize || 0), 0);
      if (coversAtStart + partySize > MAX_COVERS_PER_INTERVAL) return false;
      return candidates.some(table => !live.some(r => r.tableId === table.id && overlaps(time, duration, r.time, durationMinutes(Number(r.partySize)))));
    }).map(time => ({ service: service.id, time }))
  );
}
