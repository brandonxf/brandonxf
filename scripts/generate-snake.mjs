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

// Simula el juego: la serpiente va hacia la contribucion mas cercana esquivando su propio cuerpo.
function simulate(cell, w0, INIT, MAXLEN) {
  const COLS = 53, ROWS = 7;
  const inGrid = (w, d) => w >= 0 && w < COLS && d >= 0 && d < ROWS;
  const K = (w, d) => w * 10 + d;
  const food = new Set();
  for (const k in cell) if (cell[k] > 0) { const [w, d] = k.split(',').map(Number); food.add(K(w, d)); }
  const sw = Math.max(0, w0 - 6), sd = 3;
  let body = [];
  for (let k = 0; k < INIT; k++) body.push([sw + INIT - 1 - k, sd]);
  const path = body.slice().reverse().map((p) => p.slice());
  let heading = [1, 0];
  const eatenAt = [];
  const dirs = (h) => [h, [h[1], -h[0]], [-h[1], h[0]]];
  let guard = 0;
  while (food.size > 0 && guard++ < 3000) {
    const head = body[0], len = body.length;
    const blocked = new Map();
    body.forEach((b, j) => blocked.set(K(b[0], b[1]), len - 1 - j));
    const prev = new Map(), seen = new Set([K(head[0], head[1])]);
    let queue = [[head[0], head[1], 0, heading]];
    const founds = [];
    for (let qi = 0; qi < queue.length; qi++) {
      const [w, d, dist, h] = queue[qi];
      for (const dv of dirs(h)) {
        const nw = w + dv[0], nd = d + dv[1], nk = K(nw, nd);
        if (!inGrid(nw, nd) || seen.has(nk)) continue;
        if (blocked.has(nk) && dist + 1 <= blocked.get(nk)) continue;
        seen.add(nk); prev.set(nk, [w, d]);
        if (food.has(nk)) { founds.push([nw, nd]); continue; }
        queue.push([nw, nd, dist + 1, dv]);
      }
    }
    // espacio libre alcanzable desde la cabeza (evita quedar atrapada)
    const room = (bd) => {
      const occ = new Set(bd.slice(0, bd.length - 1).map((b) => K(b[0], b[1])));
      const st = [bd[0]], sn = new Set([K(bd[0][0], bd[0][1])]);
      let n = 0;
      while (st.length) {
        const [w, d] = st.pop();
        for (const dv of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nw = w + dv[0], nd = d + dv[1], nk = K(nw, nd);
          if (!inGrid(nw, nd) || sn.has(nk) || occ.has(nk)) continue;
          sn.add(nk); n++; st.push([nw, nd]);
        }
      }
      return n;
    };
    let steps = [];
    for (const f of founds) {
      const st = [];
      let cur = f;
      while (!(cur[0] === head[0] && cur[1] === head[1])) { st.unshift(cur); cur = prev.get(K(cur[0], cur[1])); }
      let nb = body.map((b) => b.slice());
      for (const p of st) {
        nb.unshift(p);
        if (!(food.has(K(p[0], p[1])) && true)) nb.pop();
        else if (nb.length > MAXLEN) nb.pop();
      }
      if (room(nb) >= nb.length + 2) { steps = st; break; }
    }
    if (!steps.length) {
      let best = -1;
      for (const dv of dirs(heading)) {
        const nw = head[0] + dv[0], nd = head[1] + dv[1];
        if (!inGrid(nw, nd) || (blocked.has(K(nw, nd)) && 1 <= blocked.get(K(nw, nd)))) continue;
        const nb = [[nw, nd], ...body.slice(0, body.length - 1)];
        const r = room(nb);
        if (r > best) { best = r; steps = [[nw, nd]]; }
      }
      if (!steps.length) { console.error("TRAPPED food left", food.size, "len", body.length); break; }
    }
    for (const s of steps) {
      heading = [s[0] - body[0][0], s[1] - body[0][1]];
      body.unshift(s);
      path.push([s[0], s[1]]);
      if (food.has(K(s[0], s[1]))) {
        food.delete(K(s[0], s[1]));
        eatenAt.push({ w: s[0], d: s[1], i: path.length - 1 });
        if (body.length > MAXLEN) body.pop();
      } else body.pop();
    }
  }
  // sigue recto hasta chocar con la pared
  for (let n = 0; n < 60; n++) {
    const head = body[0], nw = head[0] + heading[0], nd = head[1] + heading[1];
    if (!inGrid(nw, nd)) { path.push([head[0] + heading[0] * 0.45, head[1] + heading[1] * 0.45]); break; }
    body.unshift([nw, nd]); body.pop(); path.push([nw, nd]);
  }
  return { path, eatenAt, idx0: INIT - 1 };
}

function render(days) {
  const W = 880, H = 215, CELL = 12, PITCH = 15, COLS = 53;
  const gx = Math.round((W - COLS * PITCH) / 2), gy = 52;
  const STEP = 0.07, INIT = 3, MAXLEN = 25;
  const cx = (w) => gx + w * PITCH, cy = (d) => gy + d * PITCH;
  const LV = ['#1e2a4a', '#0e4429', '#006d32', '#26a641', '#39d353'];
  const lvl = (c) => (c === 0 ? 0 : c <= 3 ? 1 : c <= 9 ? 2 : c <= 19 ? 3 : 4);
  const cell = {};
  let maxw = 0;
  for (const d of days) { cell[d.w + ',' + d.d] = d.c; if (d.w > maxw) maxw = d.w; }
  let w0 = 0;
  while (w0 <= maxw) { let any = false; for (let d = 0; d < 7; d++) if ((cell[w0 + ',' + d] || 0) > 0) any = true; if (any) break; w0++; }
  if (w0 > maxw) w0 = 0;
  const sim = simulate(cell, w0, INIT, MAXLEN);
  const path = sim.path;
  const P = path.length - 1;
  const idx0 = sim.idx0;
  const eaten = sim.eatenAt.map((e) => ({ w: e.w, d: e.d, c: cell[e.w + ',' + e.d], i: e.i }));
  const score = eaten.reduce((s, e) => s + e.c, 0);
  const NSEG = Math.min(INIT + eaten.length, MAXLEN);
  const tPlay = (P - idx0) * STEP;
  const tFade = tPlay + NSEG * STEP + 0.4, tFadeEnd = tFade + 0.5, tText = tFadeEnd + 0.15, tTextEnd = tText + 4.5;
  const T = Math.max(tTextEnd + 0.5, P * STEP + 0.5);
  const pc = (t) => (t / T * 100).toFixed(3) + '%';
  let css = '';
  css += '@keyframes mv{';
  path.forEach((p, i) => { css += pc(i * STEP) + '{transform:translate(' + (cx(p[0])).toFixed(1) + 'px,' + (cy(p[1])).toFixed(1) + 'px)}'; });
  css += '100%{transform:translate(' + cx(path[P][0]).toFixed(1) + 'px,' + cy(path[P][1]).toFixed(1) + 'px)}}\n';
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
        const n = eatIdx[key], te = (eaten[n].i - idx0) * STEP;
        css += '@keyframes e' + n + '{0%,' + pc(te) + '{fill:' + col + '}' + pc(te + 0.05) + ',100%{fill:' + LV[0] + '}}\n';
        cells += '<rect x="' + cx(w) + '" y="' + cy(d) + '" width="' + CELL + '" height="' + CELL + '" rx="2" fill="' + col + '" style="animation:e' + n + ' ' + T.toFixed(2) + 's linear infinite"/>';
      } else {
        cells += '<rect x="' + cx(w) + '" y="' + cy(d) + '" width="' + CELL + '" height="' + CELL + '" rx="2" fill="' + LV[lvl(c)] + '"/>';
      }
    }
  }
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const hexc = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  let segs = '';
  for (let k = NSEG - 1; k >= 0; k--) {
    const tv = k < INIT ? 0 : (eaten[k - INIT].i - idx0) * STEP;
    const f = NSEG > 1 ? k / (NSEG - 1) : 0;
    const col = k === 0 ? '#bae6fd' : hexc(lerp(56, 29, f), lerp(189, 111, f), lerp(248, 165, f));
    css += '@keyframes v' + k + '{0%' + (tv > 0 ? ',' + pc(tv) : '') + '{opacity:' + (tv > 0 ? 0 : 1) + '}' + (tv > 0 ? pc(tv + 0.001) + '{opacity:1}' : '') + pc(tFade) + '{opacity:1}' + pc(tFadeEnd) + ',100%{opacity:0}}\n';
    segs += '<rect width="' + CELL + '" height="' + CELL + '" rx="3" fill="' + col + '" style="animation:mv ' + T.toFixed(2) + 's linear ' + ((k - idx0) * STEP).toFixed(3) + 's infinite backwards,v' + k + ' ' + T.toFixed(2) + 's linear infinite;transform:translate(' + cx(path[0][0]) + 'px,' + cy(path[0][1]) + 'px)"/>';
  }
  css += '@keyframes tx{0%,' + pc(tText) + '{opacity:0}' + pc(tText + 0.35) + ',' + pc(tTextEnd) + '{opacity:1}100%{opacity:0}}\n';
  let bl = '@keyframes bl{0%,' + pc(tText) + '{opacity:0}';
  for (let t = tText; t < tTextEnd - 0.1; t += 0.8) { bl += pc(t + 0.001) + '{opacity:1}' + pc(t + 0.5) + '{opacity:1}' + pc(t + 0.501) + '{opacity:0}' + pc(t + 0.8) + '{opacity:0}'; }
  bl += pc(tTextEnd) + ',100%{opacity:0}}\n';
  css += bl;
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
    + '  <g class="go"><g style="animation:bl ' + T.toFixed(2) + 's linear infinite;opacity:0">' + px + '</g></g>\n'
    + '  <text class="sc go" x="' + (W / 2) + '" y="' + (gy + 7 * PITCH + 36) + '" text-anchor="middle">GAME OVER · PUNTAJE ' + score + '</text>\n'
    + '</svg>\n';
}

const days = process.env.FIXTURE ? JSON.parse(fs.readFileSync(process.env.FIXTURE, 'utf8')).days : await fetchDays();
fs.mkdirSync(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });
fs.writeFileSync(OUT, render(days));
console.log('OK ' + OUT);
