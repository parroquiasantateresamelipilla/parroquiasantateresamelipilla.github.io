// Lee los calendarios públicos de Google Calendar:
//  - "Misas y Liturgias" -> calendario.json
//  - Actividades parroquiales -> actividades.json
import IcalExpander from 'ical-expander';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const CALENDARIOS = [
  ['1usjj85vnqo3ak83b641ds853g@group.calendar.google.com', 'calendario.json'],
  ['2t63c2pp34hua9hma59rj33ffo@group.calendar.google.com', 'actividades.json'],
];
const TZ = 'America/Santiago';
// Lugares conocidos: si el título termina con uno de ellos, se separa como lugar
const LUGARES = [
  ['parroquia', 'Templo parroquial'],
  ['huechun', 'Capilla Huechún'], ['huechún', 'Capilla Huechún'],
  ['san francisco', 'Capilla San Francisco'], ['san fco.', 'Capilla San Francisco'], ['san fco', 'Capilla San Francisco'],
  ['capilla el carmen del bajo', 'Capilla El Bajo'], ['el carmen del bajo', 'Capilla El Bajo'], ['el bajo', 'Capilla El Bajo'],
  ['huilco', 'Capilla Huilco'], ['hulco', 'Capilla Huilco'],
];
const lugarDe = s => { const t = s.toLowerCase().trim(); const m = LUGARES.find(([k]) => t === k); return m ? m[1] : null; };

async function procesar(CAL, SALIDA) {
const URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CAL)}/public/basic.ics`;
const res = await fetch(URL);
if (!res.ok) { console.log(`${SALIDA}: no se pudo leer el calendario (HTTP ${res.status}). ¿Está compartido como público?`); return; }
const ics = await res.text();

const ahora = new Date();
const inicio = new Date(ahora.getTime() - 6 * 3600e3);
const fin = new Date(ahora.getTime() + 62 * 86400e3);
const { events, occurrences } = new IcalExpander({ ics, maxIterations: 2000 }).between(inicio, fin);

const fmtFecha = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

const lista = [
  ...events.map(e => ({ titulo: e.summary, desc: e.description, loc: e.location, start: e.startDate, estado: e.component.getFirstPropertyValue('status'), rec: !!e.component.getFirstPropertyValue('recurrence-id') })),
  ...occurrences.map(o => ({ titulo: o.item.summary, desc: o.item.description, loc: o.item.location, start: o.startDate, estado: o.item.component.getFirstPropertyValue('status'), rec: true })),
];

const eventos = [];
for (const ev of lista) {
  if (!ev.start) continue;
  if (String(ev.estado || '').toUpperCase() === 'CANCELLED') continue;
  let titulo = String(ev.titulo || '').replace(/\s+/g, ' ').trim();
  if (!titulo) continue;
  let lugar = String(ev.loc || '').split(',')[0].trim();
  lugar = lugar ? (lugarDe(lugar) || lugar) : '';
  // Si el título nombra un lugar conocido ("Misa Huechun", "Misa el Bajo y Adoración"), separarlo
  for (const [k, v] of LUGARES) {
    const re = new RegExp('\\s(?:capilla\\s+)?' + k.replace(/[.]/g, '\\.') + '(?=$|[\\s+\\-–,])', 'i');
    const m = titulo.match(re);
    if (m && m.index > 0) { titulo = (titulo.slice(0, m.index) + ' ' + titulo.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); if (!lugar) lugar = v; break; }
  }
  titulo = titulo.replace(/\s+capilla$/i, '').trim();
  const d = ev.start.toJSDate();
  const todoDia = ev.start.isDate;
  const fecha = todoDia ? ev.start.toString().slice(0, 10) : fmtFecha.format(d);
  titulo = titulo.replace(/[\s\-–—:,]+$/, '');
  const tipo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
  eventos.push({ inicio: todoDia ? fecha + 'T03:00:00.000Z' : d.toISOString(), fecha, hora: todoDia ? '' : fmtHora.format(d), tipo, lugar, rec: ev.rec });
}
eventos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.lugar.localeCompare(b.lugar));

const data = { actualizado: fmtFecha.format(ahora), eventos };
const next = JSON.stringify(data, null, 1) + '\n';
const prev = existsSync(SALIDA) ? readFileSync(SALIDA, 'utf8') : '';
if (prev === next) { console.log(`${SALIDA}: sin cambios`); return; }
writeFileSync(SALIDA, next);
console.log(`${SALIDA}: ${eventos.length} eventos`);
}

for (const [cal, salida] of CALENDARIOS) {
  try { await procesar(cal, salida); } catch (e) { console.log(`${salida}: error ${e.message}`); }
}
