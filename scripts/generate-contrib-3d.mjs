// Genera assets/contrib-3d.svg con los datos reales de GitHub.
// Uso: GITHUB_TOKEN=... node scripts/generate-contrib-3d.mjs
import fs from 'node:fs';

const USER = process.env.GH_USER || 'brandonxf';
const OUT = process.env.OUT || 'assets/contrib-3d.svg';

async function fetchData() {
  const query = 'query($login:String!){user(login:$login){contributionsCollection{totalCommitContributions totalIssueContributions totalPullRequestContributions totalPullRequestReviewContributions totalRepositoryContributions contributionCalendar{totalContributions weeks{contributionDays{contributionCount date weekday}}}} repositories(ownerAffiliations:OWNER,isFork:false,first:100,privacy:PUBLIC){nodes{stargazerCount forkCount languages(first:15,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}}}}';
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: 'bearer ' + process.env.GITHUB_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  if (!json.data) throw new Error('GraphQL error: ' + JSON.stringify(json));
  const u = json.data.user;
  const cc = u.contributionsCollection;
  const langs = {};
  let stars = 0, forks = 0;
  for (const r of u.repositories.nodes) {
    stars += r.stargazerCount; forks += r.forkCount;
    for (const e of r.languages.edges) langs[e.node.name] = (langs[e.node.name] || 0) + e.size;
  }
  const days = [];
  cc.contributionCalendar.weeks.forEach((wk, w) => wk.contributionDays.forEach((d) => days.push({ w, d: d.weekday, c: d.contributionCount, date: d.date })));
  return {
    days, total: cc.contributionCalendar.totalContributions, stars, forks, langs,
    radar: [cc.totalCommitContributions, cc.totalIssueContributions, cc.totalPullRequestContributions, cc.totalPullRequestReviewContributions, cc.totalRepositoryContributions],
  };
}

function render(data) {
  const W = 900, H = 540, a = 11, b = 5.5, ox = 130, oy = 120;
  const shade = (hx, f) => {
    const n = parseInt(hx.slice(1), 16);
    return '#' + [n >> 16 & 255, n >> 8 & 255, n & 255].map((v) => Math.floor(v * f).toString(16).padStart(2, '0')).join('');
  };
  const lvl = (c) => (c === 0 ? 0 : c <= 3 ? 1 : c <= 9 ? 2 : c <= 19 ? 3 : 4);
  const TOP = { 1: '#1d6fa5', 2: '#2f9bd6', 3: '#38bdf8', 4: '#9be0ff' };
  const cells = {};
  let maxw = 0;
  for (const d of data.days) { cells[d.w + ',' + d.d] = d.c; if (d.w > maxw) maxw = d.w; }
  const grid = [];
  for (let s = 0; s < maxw + 7; s++) {
    for (let w = 0; w <= maxw; w++) {
      const d = s - w; const c = cells[w + ',' + d];
      if (c === undefined) continue;
      const x = ox + (w - d) * a, y = oy + (w + d) * b;
      if (c === 0) { grid.push('<path d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'l' + a + ' ' + b + 'l' + (-a) + ' ' + b + 'l' + (-a) + ' ' + (-b) + 'z" fill="#222d4d"/>'); continue; }
      const hg = Math.max(5, Math.min(c, 25) * 2.4), t = TOP[lvl(c)], yt = y - hg;
      grid.push('<g class="b" style="animation-delay:' + (w * 0.03).toFixed(2) + 's">'
        + '<path d="M' + (x - a).toFixed(1) + ' ' + (yt + b).toFixed(1) + 'l' + a + ' ' + b + 'v' + hg.toFixed(1) + 'l' + (-a) + ' ' + (-b) + 'z" fill="' + shade(t, 0.72) + '"/>'
        + '<path d="M' + x.toFixed(1) + ' ' + (yt + 2 * b).toFixed(1) + 'l' + a + ' ' + (-b) + 'v' + hg.toFixed(1) + 'l' + (-a) + ' ' + b + 'z" fill="' + shade(t, 0.5) + '"/>'
        + '<path d="M' + x.toFixed(1) + ' ' + yt.toFixed(1) + 'l' + a + ' ' + b + 'l' + (-a) + ' ' + b + 'l' + (-a) + ' ' + (-b) + 'z" fill="' + t + '"/></g>');
    }
  }
  // radar
  const cx = 765, cy = 150, R = 78, labels = ['Commit', 'Issue', 'PullReq', 'Review', 'Repo'], caps = [1000, 100, 100, 100, 50];
  const sc = data.radar.map((v, i) => Math.min(1, Math.log10(1 + v) / Math.log10(1 + caps[i])));
  const pt = (i, r) => { const g = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + r * Math.cos(g), cy + r * Math.sin(g)]; };
  const f1 = (n) => n.toFixed(1);
  let rings = '';
  for (const f of [0.33, 0.66, 1]) rings += '<polygon points="' + [0, 1, 2, 3, 4].map((i) => pt(i, R * f).map(f1).join(',')).join(' ') + '" fill="none" stroke="#38bdf8" stroke-opacity="0.22"/>';
  const axes = [0, 1, 2, 3, 4].map((i) => '<line x1="' + cx + '" y1="' + cy + '" x2="' + f1(pt(i, R)[0]) + '" y2="' + f1(pt(i, R)[1]) + '" stroke="#38bdf8" stroke-opacity="0.22"/>').join('');
  const P = sc.map((s, i) => pt(i, R * Math.max(s, 0.04)));
  const poly = P.map((p) => p.map(f1).join(',')).join(' ');
  const dots = P.map((p) => '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="3" fill="#9be0ff"/>').join('');
  const lab = labels.map((l, i) => { const [x, y] = pt(i, R + 16); const an = i === 0 ? 'middle' : (x > cx + 5 ? 'start' : x < cx - 5 ? 'end' : 'middle'); return '<text class="lb" x="' + f1(x) + '" y="' + f1(y + 4) + '" text-anchor="' + an + '">' + l + '</text>'; }).join('');
  // languages donut
  const PALETTE = ['#38bdf8', '#facc15', '#a78bfa', '#2dd4bf'];
  const sorted = Object.entries(data.langs).sort((x, y) => y[1] - x[1]);
  const langs = sorted.slice(0, 4).map(([n, v], i) => [n, v, PALETTE[i]]);
  const rest = sorted.slice(4).reduce((s, l) => s + l[1], 0);
  if (rest > 0) langs.push(['Otros', rest, '#64748b']);
  const tot = langs.reduce((s, l) => s + l[1], 0) || 1;
  const dcx = 92, dcy = 452, r = 42, sw = 26, circ = 2 * Math.PI * r;
  let seg = '', acc = 0, leg = '';
  langs.forEach(([n, v, col], k) => {
    const f = v / tot;
    seg += '<circle cx="' + dcx + '" cy="' + dcy + '" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-dasharray="' + Math.max(f * circ - 1.5, 0).toFixed(2) + ' ' + circ.toFixed(2) + '" stroke-dashoffset="' + (-acc * circ).toFixed(2) + '" transform="rotate(-90 ' + dcx + ' ' + dcy + ')"/>';
    acc += f;
    const ly = 415 + k * 20;
    leg += '<rect x="170" y="' + ly + '" width="11" height="11" rx="2" fill="' + col + '"/><text class="lg" x="188" y="' + (ly + 10) + '">' + n + '</text><text class="lp" x="300" y="' + (ly + 10) + '" text-anchor="end">' + Math.round(f * 100) + '%</text>';
  });
  const star = 'M0,-8 L2.4,-2.6 L8.2,-2.2 L3.7,1.6 L5.1,7.3 L0,4.2 L-5.1,7.3 L-3.7,1.6 L-8.2,-2.2 L-2.4,-2.6z';
  const first = data.days[0].date, last = data.days[data.days.length - 1].date;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafica 3D de contribuciones">\n'
    + '  <defs>\n    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">\n      <stop offset="0" stop-color="#0b1220"/>\n      <stop offset="1" stop-color="#101c3a"/>\n    </linearGradient>\n  </defs>\n'
    + '  <style>\n'
    + "    .lb { font: 600 12px 'Segoe UI', Arial, sans-serif; fill: #94a3b8; }\n"
    + "    .lg { font: 500 13px 'Segoe UI', Arial, sans-serif; fill: #cbd5e1; }\n"
    + "    .lp { font: 500 13px 'Courier New', monospace; fill: #7dd3fc; }\n"
    + "    .ti { font: 600 13px 'Courier New', monospace; fill: #38bdf8; }\n"
    + "    .dt { font: 500 11px 'Courier New', monospace; fill: #64748b; }\n"
    + "    .big { font: 700 34px 'Segoe UI', Arial, sans-serif; fill: #7dd3fc; }\n"
    + "    .bigl { font: 500 15px 'Segoe UI', Arial, sans-serif; fill: #94a3b8; }\n"
    + "    .num { font: 700 20px 'Segoe UI', Arial, sans-serif; fill: #e2e8f0; }\n"
    + '    .b { animation: rise 0.9s ease-out backwards; }\n'
    + '    .rd { transform-box: fill-box; transform-origin: center; animation: pop 1.2s 0.4s ease-out backwards; }\n'
    + '    @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }\n'
    + '    @keyframes pop { from { opacity: 0; transform: scale(0.2); } to { opacity: 1; transform: scale(1); } }\n'
    + '  </style>\n'
    + '  <rect width="' + W + '" height="' + H + '" rx="16" fill="url(#bg)"/>\n'
    + '  <text class="ti" x="28" y="34">CONTRIBUCIONES · ÚLTIMO AÑO</text>\n'
    + '  <text class="dt" x="' + (W - 28) + '" y="34" text-anchor="end">' + first + ' / ' + last + '</text>\n'
    + '  <g>\n    ' + grid.join('\n    ') + '\n  </g>\n'
    + '  <g>' + rings + axes + lab + '</g>\n'
    + '  <g class="rd"><polygon points="' + poly + '" fill="#38bdf8" fill-opacity="0.35" stroke="#7dd3fc" stroke-width="2"/>' + dots + '</g>\n'
    + '  <g>' + seg + '</g>\n  ' + leg + '\n'
    + '  <text class="big" x="' + (W - 28) + '" y="470" text-anchor="end">' + data.total + '</text>\n'
    + '  <text class="bigl" x="' + (W - 28) + '" y="492" text-anchor="end">contribuciones</text>\n'
    + '  <g transform="translate(' + (W - 152) + ' 518)"><path d="' + star + '" fill="#facc15" transform="translate(0 -6)"/><text class="num" x="14" y="0">' + data.stars + '</text>\n'
    + '  <g transform="translate(56 -12)" fill="none" stroke="#94a3b8" stroke-width="1.8"><circle cx="0" cy="0" r="2.6"/><circle cx="10" cy="0" r="2.6"/><circle cx="5" cy="14" r="2.6"/><path d="M0 2.6v3q0 3 5 5.4M10 2.6v3q0 3-5 5.4"/></g><text class="num" x="76" y="0">' + data.forks + '</text></g>\n'
    + '</svg>\n';
}

const data = process.env.FIXTURE ? JSON.parse(fs.readFileSync(process.env.FIXTURE, 'utf8')) : await fetchData();
fs.mkdirSync(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });
fs.writeFileSync(OUT, render(data));
console.log('OK ' + OUT + ' (' + data.total + ' contribuciones)');
