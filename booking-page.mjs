import { isOpenDate } from './booking-rules.mjs';

const widget = 'https://www.sevenrooms.com/explore/duliban/reservations/create/search/';
const date = document.getElementById('date');
const party = document.getElementById('party');
const link = document.getElementById('reserve-link');
const message = document.getElementById('message');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
date.min = today;
date.value = today;
for (let n = 1; n <= 12; n++) party.add(new Option(`${n} ${n === 1 ? 'persona' : 'personas'}`, String(n)));
party.value = '2';

function validate() {
  const valid = date.value >= today && isOpenDate(date.value);
  link.href = valid ? widget : '#';
  link.setAttribute('aria-disabled', String(!valid));
  message.textContent = valid ? '' : 'Los lunes cerramos. Elige otra fecha.';
}
date.addEventListener('change', validate);
validate();
link.addEventListener('click', event => {
  if (link.getAttribute('aria-disabled') === 'true') event.preventDefault();
});
