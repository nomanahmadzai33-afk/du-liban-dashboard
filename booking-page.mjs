import { AREAS, MAX_PARTY_SIZE, isOpenDate } from './booking-rules.mjs';

// Set this from a same-origin deployment only after the booking API has been
// authenticated, checked against the reconciled floorplan, and tested.
const API_BASE = '';
const $ = id => document.getElementById(id);
const state = { area: null, slot: null, available: [], request: 0 };
const party = $('party');
for (let n = 1; n <= MAX_PARTY_SIZE; n++) party.add(new Option(`${n} ${n === 1 ? 'persona' : 'personas'}`, String(n)));
party.value = '2';

const nowMadrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
$('date').min = nowMadrid;
$('date').value = nowMadrid;

for (const [key, area] of Object.entries(AREAS)) {
  if (!area.bookable || key === 'chillout') continue; // Chillout needs a confirmed public access rule.
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'area'; button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `<strong>${area.label}</strong><span>Consulta los horarios disponibles</span>`;
  button.addEventListener('click', () => {
    state.area = key; state.slot = null;
    document.querySelectorAll('.area').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    $('details').classList.add('hidden'); loadSlots();
  });
  $('areas').append(button);
}

function message(text, kind = '') {
  $('message').textContent = text;
  $('message').className = text ? `notice ${kind}` : '';
}

async function loadSlots() {
  const request = ++state.request;
  state.slot = null;
  $('details').classList.add('hidden');
  const date = $('date').value;
  if (!state.area || !date) return;
  if (!isOpenDate(date) || date < nowMadrid) {
    $('slots').textContent = 'No hay reservas disponibles para esta fecha.'; return;
  }
  if (!API_BASE) {
    $('slots').textContent = 'La reserva online no está disponible en este momento. Llámanos para reservar.';
    return;
  }
  $('slots').textContent = 'Consultando disponibilidad…';
  try {
    const params = new URLSearchParams({ date, area: state.area, party_size: party.value });
    const response = await fetch(`${API_BASE}/availability?${params}`);
    if (!response.ok) throw new Error('No hemos podido consultar la disponibilidad.');
    const data = await response.json();
    if (request !== state.request) return;
    if (!Array.isArray(data.slots)) throw new Error('Respuesta de disponibilidad no válida.');
    state.available = data.slots;
    $('slots').replaceChildren();
    if (!data.slots.length) { $('slots').textContent = 'No quedan mesas en esta zona. Prueba otra fecha o zona.'; return; }
    const labels = { lunch: 'Comida', shisha: 'Shisha y cócteles', dinner: 'Cena' };
    for (const service of ['lunch', 'shisha', 'dinner']) {
      const times = data.slots.filter(s => s.service === service);
      if (!times.length) continue;
      const heading = document.createElement('p'); heading.className = 'service'; heading.textContent = labels[service];
      const group = document.createElement('div'); group.className = 'slots';
      for (const slot of times) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'slot';
        b.textContent = slot.time; b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => {
          state.slot = slot;
          document.querySelectorAll('.slot').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          $('details').classList.remove('hidden'); message('');
        }); group.append(b);
      }
      $('slots').append(heading, group);
    }
  } catch (error) { if (request === state.request) $('slots').textContent = error.message; }
}

$('date').addEventListener('change', loadSlots);
party.addEventListener('change', loadSlots);
$('booking-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!API_BASE || !state.slot || !state.available.includes(state.slot)) return;
  const button = $('submit'); button.disabled = true; message('Estamos comprobando tu reserva…');
  try {
    const body = { date: $('date').value, area: state.area, time: state.slot.time,
      party_size: Number(party.value), name: $('name').value.trim(), phone: $('phone').value.trim(),
      email: $('email').value.trim(), notes: $('notes').value.trim() };
    const response = await fetch(`${API_BASE}/reservations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok || !result.confirmed || !result.reference) throw new Error(result.message || 'No se ha confirmado la reserva.');
    $('booking-form').replaceChildren();
    message(`Reserva confirmada para el ${body.date} a las ${body.time}. Referencia: ${result.reference}.`, 'success');
  } catch (error) { message(error.message, 'error'); button.disabled = false; await loadSlots(); }
});
