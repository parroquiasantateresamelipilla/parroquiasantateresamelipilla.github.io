// Lee la cita del Evangelio del día desde Eucaristía Diaria y la guarda en evangelio.json.
// Solo guarda datos de referencia (fecha, cita, celebración y color), nunca el texto bíblico.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const URL = 'https://www.eucaristiadiaria.cl/dia.php';
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const COLORES = ['verde','blanco','morado','rojo','rosado','negro'];

const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }); // AAAA-MM-DD
const [y, m, d] = hoy.split('-').map(Number);

const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 (sitio parroquial)' } });
if (!res.ok) { console.log('La página respondió', res.status); process.exit(0); }
const buf = Buffer.from(await res.arrayBuffer());
let html = new TextDecoder('utf-8').decode(buf);
if (html.includes('�')) html = new TextDecoder('latin1').decode(buf);

const text = html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>|<\/(p|div|h\d|li|tr)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&aacute;/g,'á').replace(/&eacute;/g,'é').replace(/&iacute;/g,'í')
  .replace(/&oacute;/g,'ó').replace(/&uacute;/g,'ú').replace(/&ntilde;/g,'ñ').replace(/&Aacute;/g,'Á')
  .replace(/&Eacute;/g,'É').replace(/&Iacute;/g,'Í').replace(/&Oacute;/g,'Ó').replace(/&Uacute;/g,'Ú').replace(/&Ntilde;/g,'Ñ')
  .replace(/&#(\d+);/g, (x, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (x, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&');
const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

// 1. Comprobar que la página corresponde a hoy
const fechaRe = new RegExp(`Liturgia del \\S+ ${d} de ${MESES[m - 1]} de ${y}`, 'i');
if (!lines.some(l => fechaRe.test(l))) { console.log('La página aún no muestra la liturgia de hoy', hoy); process.exit(0); }

// 2. Cita del Evangelio
const citaLine = lines.find(l => /Evangelio de nuestro Señor Jesucristo según san/i.test(l));
const mc = citaLine && citaLine.match(/según san (Mateo|Marcos|Lucas|Juan)\s+(.+)$/i);
if (!mc) { console.log('No se encontró la cita del Evangelio'); process.exit(0); }
const cita = `${mc[1]} ${mc[2].trim()}`;

// 3. Celebración y color: líneas entre el día ("VIERNES 13 DE NOVIEMBRE") y el color
const iDia = lines.findIndex(l => new RegExp(`^\\S+ ${d} DE ${MESES[m - 1]}$`, 'i').test(l));
let celebracion = '', color = '';
if (iDia >= 0) {
  const partes = [];
  for (let i = iDia + 1; i < Math.min(iDia + 6, lines.length); i++) {
    const l = lines[i];
    const c = COLORES.find(k => new RegExp(`^${k}\\b`, 'i').test(l) && l.length < 30);
    if (c) { color = l.toLowerCase(); break; }
    if (l.length < 140) partes.push(l);
  }
  const frase = s => s.toLowerCase().replace(/(^|[\s(])([a-záéíóúñ])/g, (x, a, b) => a + b)
    .replace(/^./, c => c.toUpperCase())
    .replace(/\b(xxxiv|xxxiii|xxxii|xxxi|xxx|xx[ivx]*|x[ivx]*|i[vx]|v?i{1,3}|v)\b/gi, r => r.toUpperCase())
    .replace(/\b(tiempo ordinario|adviento|navidad|cuaresma|pascua)\b/g, t => t.replace(/\b\w/g, c => c.toUpperCase()));
  celebracion = partes.map(frase).join(' · ');
  if (!celebracion) celebracion = '';
}

const data = { fecha: hoy, cita, celebracion, color, url: URL };
const prev = existsSync('evangelio.json') ? readFileSync('evangelio.json', 'utf8') : '';
const next = JSON.stringify(data, null, 1) + '\n';
if (prev === next) { console.log('Sin cambios'); process.exit(0); }
writeFileSync('evangelio.json', next);
console.log('Actualizado:', data);
