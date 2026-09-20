// Genera assets/snake-game.svg: una serpiente que crece al comer contribuciones y termina con GAME OVER.
// Uso: GITHUB_TOKEN=... node scripts/generate-snake.mjs
import fs from 'node:fs';

const USER = process.env.GH_USER || 'brandonxf';
const OUT = process.env.OUT || 'assets/snake-game.svg';

async function fetchDays() {
  const query = 'query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{contributionCount date weekday}}}}}}';
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: 'bearer ' + process.env.GITHUB_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  if (!json.data) throw new Error('GraphQL error: ' + JSON.stringify(json));
  const days = [];
  json.data.user.contributionsCollection.contributionCalendar.weeks.forEach((wk, w) => wk.contributionDays.forEach((d) => days.push({ w, d: d.weekday, c: d.contributionCount, date: d.date })));
  return days;
}

const GLYPHS = {
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
};

function render(days) {
  const W = 880, H = 215, CELL = 12, PITCH = 15, COLS = 53;
  const gx = Math.round((W - COLS * PITCH) / 2), gy = 52;
  const STEP = 0.055, INIT = 3;
  const cx = (w) => gx + w * PITCH, cy = (d) => gy + d * PITCH;
  const LV = ['#1e2a4a', '#0e4429', '#006d32', '#26a641', '#39d353'];
  const lvl = (c) => (c === 0 ? 0 : c <= 3 ? 1 : c <= 9 ? 2 : c <= 19 ? 3 : 4);
  const cell = {};
  let maxw = 0;
  for (const d of days) { cell[d.w + ',' + d.d] = d.c; if (d.w > maxw) maxw = d.w; }
  let w0 = 0;
  while (w0 <= maxw) { let any = false; for (let d = 0; d < 7; d++) if ((cell[w0 + ',' + d] || 0) > 0) any = true; if (any) break; w0++; }
  if (w0 > maxw) w0 = 0;
  // ruta de la cabeza (en celdas): entra por la fila 0 y barre columna por columna
  const path = [[w0 - 3, 0], [w0 - 2, 0], [w0 - 1, 0]];
  for (let w = w0; w <= maxw; w++) {
    const down = (w - w0) % 2 === 0;
    for (let k = 0; k < 7; k++) path.push([w, down ? k : 6 - k]);
  }
  const lastDown = (maxw - w0) % 2 === 0;
  path.push([maxw, lastDown ? 6.45 : -0.45]); // choca con la pared
  const P = path.length - 1;
  const tPlay = P * STEP;
  const tFade = tPlay + 0.7, tFadeEnd = tFade + 0.5, tText = tFadeEnd + 0.15, tTextEnd = tText + 4.5, T = tTextEnd + 0.5;
  const pc = (t) => (t / T * 100).toFixed(3) + '%';
  // celdas comidas
  const idxOf = {};
  path.forEach((p, i) => { if (Number.isInteger(p[1]) && p[0] >= 0) { const k = p[0] + ',' + p[1]; if (!(k in idxOf)) idxOf[k] = i; } });
  const eaten = [];
  for (const d of days) { if (d.c > 0 && (d.w + ',' + d.d) in idxOf) eaten.push({ w: d.w, d: d.d, c: d.c, i: idxOf[d.w + ',' + d.d] }); }
  eaten.sort((a, b) => a.i - b.i);
  const score = eaten.reduce((s, e) => s + e.c, 0);
  const NSEG = INIT + eaten.length;
  let css = '';
  // movimiento de la cabeza
  css += '@keyframes mv{';
  path.forEach((p, i) => { css += pc(i * STEP) + '{transform:translate(' + (cx(p[0])).toFixed(1) + 'px,' + (cy(p[1])).toFixed(1) + 'px)}'; });
  css += '100%{transform:translate(' + cx(path[P][0]).toFixed(1) + 'px,' + cy(path[P][1]).toFixed(1) + 'px)}}\n';
  // celdas: dibujar
  let cells = '';
  const eatIdx = {};
  eaten.forEach((e, n) => { eatIdx[e.w + ',' + e.d] = n; });
  for (let w = 0; w < COLS; w++) {
    for (let d = 0; d < 7; d++) {
      const c = cell[w + ',' + d];
      if (c === undefined) continue;
      const key = w + ',' + d;
      const col = LV[lvl(c)];
      if (key in eatIdx) {
        const n = eatIdx[key], te = eaten[n].i * STEP;
        css += '@keyframes e' + n + '{0%,' + pc(te) + '{fill:' + col + '}' + pc(te + 0.05) + ',100%{fill:' + LV[0] + '}}\n';
        cells += '<rect x="' + cx(w) + '" y="' + cy(d) + '" width="' + CELL + '" height="' + CELL + '" rx="2" fill="' + col + '" style="animation:e' + n + ' ' + T.toFixed(2) + 's linear infinite"/>';
      } else {
        cells += '<rect x="' + cx(w) + '" y="' + cy(d) + '" width="' + CELL + '" height="' + CELL + '" rx="2" fill="' + LV[lvl(c)] + '"/>';
      }
    }
  }
  // segmentos de la serpiente (la cabeza va al final para quedar encima)
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const hexc = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  let segs = '';
  for (let k = NSEG - 1; k >= 0; k--) {
    const tv = k < INIT ? 0 : eaten[k - INIT].i * STEP;
    const f = NSEG > 1 ? k / (NSEG - 1) : 0;
    const col = k === 0 ? '#bae6fd' : hexc(lerp(56, 29, f), lerp(189, 111, f), lerp(248, 165, f));
    css += '@keyframes v' + k + '{0%' + (tv > 0 ? ',' + pc(tv) : '') + '{opacity:' + (tv > 0 ? 0 : 1) + '}' + (tv > 0 ? pc(tv + 0.001) + '{opacity:1}' : '') + pc(tFade) + '{opacity:1}' + pc(tFadeEnd) + ',100%{opacity:0}}\n';
    segs += '<rect width="' + CELL + '" height="' + CELL + '" rx="3" fill="' + col + '" style="animation:mv ' + T.toFixed(2) + 's linear ' + (k * STEP).toFixed(3) + 's infinite backwards,v' + k + ' ' + T.toFixed(2) + 's linear infinite;transform:translate(' + cx(path[0][0]) + 'px,' + cy(path[0][1]) + 'px)"/>';
  }
  css += '@keyframes tx{0%,' + pc(tText) + '{opacity:0}' + pc(tText + 0.35) + ',' + pc(tTextEnd) + '{opacity:1}100%{opacity:0}}\n';
  // GAME OVER con celdas verdes
  const word = 'GAME OVER';
  let px = '';
  let col0 = 1;
  for (const ch of word) {
    if (ch === ' ') { col0 += 3; continue; }
    const g = GLYPHS[ch];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '#') px += '<rect x="' + cx(col0 + c) + '" y="' + cy(r) + '" width="' + CELL + '" height="' + CELL + '" rx="2" fill="#39d353"/>';
    col0 += 6;
  }
  const first = days[0].date, last = days[days.length - 1].date;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Serpiente que come mis contribuciones y termina en Game Over">\n'
    + '  <defs>\n    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">\n      <stop offset="0" stop-color="#0b1220"/>\n      <stop offset="1" stop-color="#101c3a"/>\n    </linearGradient>\n  </defs>\n'
    + '  <style>\n'
    + "    .ti { font: 600 13px 'Courier New', monospace; fill: #38bdf8; }\n"
    + "    .dt { font: 500 11px 'Courier New', monospace; fill: #64748b; }\n"
    + "    .sc { font: 700 15px 'Courier New', monospace; fill: #39d353; letter-spacing: 2px; }\n"
    + '    .go { animation: tx ' + T.toFixed(2) + 's linear infinite; opacity: 0; }\n'
    + css
    + '  </style>\n'
    + '  <rect width="' + W + '" height="' + H + '" rx="16" fill="url(#bg)"/>\n'
    + '  <text class="ti" x="28" y="32">SNAKE · CADA CONTRIBUCIÓN LA HACE CRECER</text>\n'
    + '  <text class="dt" x="' + (W - 28) + '" y="32" text-anchor="end">' + first + ' / ' + last + '</text>\n'
    + '  <g>' + cells + '</g>\n'
    + '  <g>' + segs + '</g>\n'
    + '  <g class="go">' + px + '</g>\n'
    + '  <text class="sc go" x="' + (W / 2) + '" y="' + (gy + 7 * PITCH + 36) + '" text-anchor="middle">GAME OVER · PUNTAJE ' + score + '</text>\n'
    + '</svg>\n';
}

const days = process.env.FIXTURE ? JSON.parse(fs.readFileSync(process.env.FIXTURE, 'utf8')).days : await fetchDays();
fs.mkdirSync(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });
fs.writeFileSync(OUT, render(days));
console.log('OK ' + OUT);
