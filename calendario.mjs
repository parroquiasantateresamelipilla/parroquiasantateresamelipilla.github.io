// Lee el calendario público "Misas y Liturgias" de Google Calendar y guarda los próximos 8 días en calendario.json.
import IcalExpander from 'ical-expander';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const CAL = '1usjj85vnqo3ak83b641ds853g@group.calendar.google.com';
const URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CAL)}/public/basic.ics`;
const TZ = 'America/Santiago';
// Lugares conocidos: si el título termina con uno de ellos, se separa como lugar
const LUGARES = [
  ['parroquia', 'Templo parroquial'],
  ['huechun', 'Capilla Huechún'], ['huechún', 'Capilla Huechún'],
  ['san francisco', 'Capilla San Francisco'], ['san fco.', 'Capilla San Francisco'], ['san fco', 'Capilla San Francisco'],
  ['el bajo', 'Capilla El Bajo'],
  ['huilco', 'Capilla Huilco'], ['hulco', 'Capilla Huilco'],
];
const lugarDe = s => { const t = s.toLowerCase().trim(); const m = LUGARES.find(([k]) => t === k); return m ? m[1] : null; };

const res = await fetch(URL);
if (!res.ok) { console.log(`No se pudo leer el calendario (HTTP ${res.status}). ¿Está compartido como público?`); process.exit(res.status === 404 ? 1 : 0); }
const ics = await res.text();

const ahora = new Date();
const inicio = new Date(ahora.getTime() - 6 * 3600e3);
const fin = new Date(ahora.getTime() + 8 * 86400e3);
const { events, occurrences } = new IcalExpander({ ics, maxIterations: 2000 }).between(inicio, fin);

const fmtFecha = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

const lista = [
  ...events.map(e => ({ titulo: e.summary, desc: e.description, loc: e.location, start: e.startDate, estado: e.component.getFirstPropertyValue('status') })),
  ...occurrences.map(o => ({ titulo: o.item.summary, desc: o.item.description, loc: o.item.location, start: o.startDate, estado: o.item.component.getFirstPropertyValue('status') })),
];

const eventos = [];
for (const ev of lista) {
  if (!ev.start) continue;
  if (String(ev.estado || '').toUpperCase() === 'CANCELLED') continue;
  let titulo = String(ev.titulo || '').replace(/\s+/g, ' ').trim();
  if (!titulo) continue;
  let lugar = String(ev.loc || '').split(',')[0].trim();
  lugar = lugar ? (lugarDe(lugar) || lugar) : '';
  // Si el título termina en un lugar conocido ("Misa Huechun"), separarlo
  for (const [k, v] of LUGARES) {
    if (titulo.toLowerCase().endsWith(' ' + k)) { titulo = titulo.slice(0, -k.length).trim(); if (!lugar) lugar = v; break; }
  }
  const d = ev.start.toJSDate();
  const todoDia = ev.start.isDate;
  const fecha = todoDia ? ev.start.toString().slice(0, 10) : fmtFecha.format(d);
  const tipo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
  eventos.push({ inicio: todoDia ? fecha + 'T03:00:00.000Z' : d.toISOString(), fecha, hora: todoDia ? '' : fmtHora.format(d), tipo, lugar });
}
eventos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.lugar.localeCompare(b.lugar));

const data = { actualizado: fmtFecha.format(ahora), eventos };
const next = JSON.stringify(data, null, 1) + '\n';
const prev = existsSync('calendario.json') ? readFileSync('calendario.json', 'utf8') : '';
if (prev === next) { console.log('Sin cambios'); process.exit(0); }
writeFileSync('calendario.json', next);
console.log(`Actualizado: ${eventos.length} celebraciones`);
