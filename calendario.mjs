// Lee el calendario público "Misas y Liturgias" de Google Calendar y guarda los próximos 8 días en calendario.json.
import IcalExpander from 'ical-expander';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const CAL = '1usjj85vnqo3ak83b641ds853g@group.calendar.google.com';
const URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CAL)}/public/basic.ics`;
const TZ = 'America/Santiago';
// Solo estos tipos aparecen en la agenda de Misas del sitio
const TIPOS = [['misa', 'Misa'], ['liturgia', 'Liturgia'], ['adoraci', 'Adoración']];
const LUGARES = [
  [/^parroquia$/i, 'Templo parroquial'],
  [/^huech[uú]n$/i, 'Capilla Huechún'],
  [/^(san fco\.?|san francisco)$/i, 'Capilla San Francisco'],
  [/^el bajo$/i, 'Capilla El Bajo'],
  [/^hu[iu]lco$/i, 'Capilla Huilco'],
];

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
  if (!ev.start || ev.start.isDate) continue; // sin hora (todo el día)
  if (String(ev.estado || '').toUpperCase() === 'CANCELLED') continue;
  const titulo = String(ev.titulo || '').replace(/\s+/g, ' ').trim();
  const tipo = TIPOS.find(([k]) => titulo.toLowerCase().startsWith(k));
  if (!tipo) continue;
  const d = ev.start.toJSDate();
  let resto = titulo.replace(/^\S+\s*/, '').trim();
  let lugar = String(ev.loc || '').trim() || resto;
  const m = LUGARES.find(([re]) => re.test(lugar));
  lugar = m ? m[1] : (lugar ? (/^capilla|^templo/i.test(lugar) ? lugar : 'Capilla ' + lugar) : 'Templo parroquial');
  eventos.push({ inicio: d.toISOString(), fecha: fmtFecha.format(d), hora: fmtHora.format(d), tipo: tipo[1], lugar });
}
eventos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.lugar.localeCompare(b.lugar));

const data = { actualizado: fmtFecha.format(ahora), eventos };
const next = JSON.stringify(data, null, 1) + '\n';
const prev = existsSync('calendario.json') ? readFileSync('calendario.json', 'utf8') : '';
if (prev === next) { console.log('Sin cambios'); process.exit(0); }
writeFileSync('calendario.json', next);
console.log(`Actualizado: ${eventos.length} celebraciones`);
