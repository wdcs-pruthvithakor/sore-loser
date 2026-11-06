// Headless solver: plays levels through the real World physics with a beam search over
// human-sized inputs (0.1s steps, so a "short hop" is a 0.1s tap) and reports any level
// no route can finish. Catches combinations the static validator cannot see: twists that
// change jump height, timed hazards next to "keep moving" cheats, and so on.
// Usage: node tools/solve.js [quick|full] [jobsFilter]
const fs = require('fs'), vm = require('vm'), path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

function loadSL() {
  const M = Object.create(Math);
  const ctx = { console, JSON, Math: M, __r: 1 };
  M.random = () => { // seeded so a cloned state replays the same quake/boss rolls
    let t = (ctx.__r = (ctx.__r + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['core', 'profile', 'game']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  return ctx;
}

function snap(ctx, w) {
  const L = w.L, p = w.p, gp = p.groundPlat, lp = p.lastPlat;
  p.groundPlat = gp ? L.plats.indexOf(gp) : -1; p.lastPlat = lp ? L.plats.indexOf(lp) : -1;
  const o = {};
  for (const k of Object.keys(w)) if (k !== 'L' && k !== 'events' && k !== 'P') o[k] = w[k];
  const s = structuredClone({ o, plats: L.plats, near: L.signs.map(x => x.near), r: ctx.__r });
  p.groundPlat = gp; p.lastPlat = lp;
  return s;
}
function restore(ctx, w, s0) {
  const s = structuredClone(s0), L = w.L;
  Object.assign(w, s.o);
  s.plats.forEach((pl, i) => Object.assign(L.plats[i], pl));
  L.signs.forEach((x, i) => { x.near = s.near[i]; });
  w.p.groundPlat = w.p.groundPlat >= 0 ? L.plats[w.p.groundPlat] : null;
  w.p.lastPlat = w.p.lastPlat >= 0 ? L.plats[w.p.lastPlat] : null;
  w.events.length = 0;
  ctx.__r = s.r;
}

const DT = 1 / 120;
const ACTS = [];
for (const dir of [1, 0, -1]) for (const j of [0, 1, 2]) ACTS.push({ dir, j }); // j: 0 release, 1 press, 2 keep holding

function solve(ctx, L, opts) {
  const SL = ctx.SL, T = SL.TILE;
  const w = new SL.World(L, { bonks: 0, crumbleSurvive: 0, causes: {} });
  for (const id of opts.off || []) delete w.has[id]; // debugging: same layout, one cheat switched off
  const PER_COL = opts.perCol || 4, CAP = opts.cap || 600;
  // fine mode decides every 0.05s for tighter timing, but a tap is still held at least 0.1s
  const STEP = opts.fine ? 6 : 12, MINHOLD = opts.fine ? 2 : 1;
  let beam = [{ s: snap(ctx, w), held: 0, x: w.p.x }];
  const maxDepth = Math.ceil((L.w * T / 200 + 25) / (STEP * DT));
  let best = w.p.x, deathCauses = {};
  for (let depth = 0; depth < maxDepth; depth++) {
    const seen = new Set(), kids = [];
    for (const node of beam) {
      for (const a of ACTS) {
        if (a.j === 2 && !node.held) continue;
        if (node.held && node.held < MINHOLD && a.j !== 2) continue;
        restore(ctx, w, node.s);
        let dead = false;
        for (let f = 0; f < STEP; f++) {
          const inp = { left: a.dir < 0, right: a.dir > 0, jump: a.j > 0, jumpPressed: a.j === 1 && f === 0, down: false };
          w.update(DT, inp);
          if (w.won) return { ok: true, depth, t: depth * STEP * DT };
          if (!w.p.alive) { dead = true; const c = w.events.find(e => e.type === 'death'); if (c) deathCauses[c.cause] = (deathCauses[c.cause] || 0) + 1; break; }
        }
        w.events.length = 0;
        if (dead) continue;
        const p = w.p;
        const key = [Math.floor(p.x / 4), Math.floor(p.y / 4), Math.round(p.vx / 40), Math.round(p.vy / 80), a.j === 1 ? 1 : a.j === 2 ? Math.min(node.held + 1, MINHOLD + 1) : 0,
          w.swapped ? 1 : 0, w.dropped.size, w.door.spot, w.cpReal ? 1 : 0, w.shown.size].join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        kids.push({ s: snap(ctx, w), held: a.j === 1 ? 1 : a.j === 2 ? node.held + 1 : 0, x: p.x, y: p.y, vx: p.vx, g: p.grounded });
      }
    }
    if (!kids.length) return { ok: false, best, deathCauses, depth };
    // keep a spread: a few states per column, nearest the frontier first
    // grouped by column and height band, so a climb is not crowded out by the floor below it
    const cols = new Map();
    for (const k of kids) { const c = Math.floor(k.x / T) * 100 + Math.floor(k.y / T); if (!cols.has(c)) cols.set(c, []); cols.get(c).push(k); }
    const order = [...cols.keys()].sort((a, b) => b - a);
    const front = Math.floor(order[0] / 100);
    beam = [];
    for (const c of order) {
      if (Math.floor(c / 100) < front - 16 || beam.length >= CAP) break;
      const list = cols.get(c);
      // spread across speeds, fastest first: on ice a slow state cannot get its speed back in time
      list.sort((a, b) => b.vx - a.vx);
      const stride = Math.max(1, Math.floor(list.length / PER_COL));
      for (let i = 0, n = 0; i < list.length && n < PER_COL; i += stride, n++) beam.push(list[i]);
    }
    best = Math.max(best, front * T);
  }
  return { ok: false, best, deathCauses, timeout: true };
}

function ascii(SL, L, col) {
  const ch = { 0: '.', 1: '#', 2: '^', 3: 'f', 4: 'b', 5: 'o', 6: 'c', 7: 'p', 8: 's', 9: '@', 10: 'v', 11: 'i', 12: '%' };
  const a = Math.max(0, col - 10), b = Math.min(L.w - 1, col + 14), rows = [];
  for (let r = 0; r < SL.ROWS; r++) { let s = ''; for (let c = a; c <= b; c++) s += c === col && r === 0 ? '|' : ch[L.tiles[r * L.w + c]] || '?'; rows.push(s); }
  const extras = [];
  for (const p of L.plats) { const c = Math.floor(p.x / SL.TILE); if (c >= a && c <= b) extras.push(`${p.kind}${p.rotten ? '(rotten)' : ''}@${c},${p.y / SL.TILE}`); }
  for (const k of ['crushers', 'waves', 'saws', 'mimics', 'lungers', 'tunnels']) if (L[k] && L[k].length) extras.push(k + ':' + L[k].length);
  return `cols ${a}-${b}\n` + rows.join('\n') + '\n' + extras.join(' ');
}

if (!isMainThread) {
  const ctx = loadSL(), SL = ctx.SL;
  parentPort.on('message', job => {
    if (job === 'done') return process.exit(0);
    const t0 = Date.now();
    let L, res;
    try {
      L = SL.buildLevel(job.seed, job.level, job.cheats, job.diff, { ng: job.ng || 0, twist: job.twist, pacts: job.pacts });
      ctx.__r = 12345;
      res = solve(ctx, L, job.opts || {});
      if (!res.ok) res.map = ascii(SL, L, Math.floor(res.best / SL.TILE));
    } catch (e) { res = { ok: false, err: e.message }; }
    parentPort.postMessage({ job, res, ms: Date.now() - t0, w: L && L.w, twist: L && L.twist });
  });
} else if (require.main !== module) {
  module.exports = { loadSL, snap, restore, solve };
} else {
  const ctx = loadSL(), SL = ctx.SL;
  const mode = process.argv[2] || 'quick';
  const jobs = [];
  const twists = [null, 'ice', 'floaty', 'fast', 'shaky'];
  const diffs = ['normal', 'hard', 'rage'];
  if (mode === 'one') {
    jobs.push(JSON.parse(process.argv[3]));
  } else if (mode === 'retry' || mode === 'fine') {
    jobs.push(...JSON.parse(fs.readFileSync(path.join(__dirname, 'solve-fails.json'), 'utf8')).map(j => mode === 'fine' ? Object.assign(j, { opts: Object.assign({}, j.opts, { fine: true }) }) : j));
  } else {
    const levels = mode === 'full' ? [8, 25, 45, 70, 95] : [12, 55];
    // every cheat alone, under every physics twist, in every mode
    for (const diff of diffs) for (const tw of twists) for (const id of SL.CHEAT_IDS) for (const lv of levels)
      jobs.push({ seed: 'S' + id.slice(0, 3) + lv, level: lv, cheats: [id], diff, twist: tw });
    // realistic mixes from the profile picker, with NG+ and pacts sprinkled in
    for (const diff of diffs) for (const seed of ['4GZA7', 'K9Q2X', 'MOLE5']) {
      const sheet = {}, prof = SL.Profile.blank(); let last = [];
      for (let lv = 2; lv <= 99; lv++) {
        const pick = SL.Profile.choose(lv, sheet, prof, last, seed, diff);
        if (pick.intro) sheet[pick.intro] = { met: true }; last = pick.cheats;
        if (lv % (mode === 'full' ? 3 : 7)) continue;
        for (const tw of [undefined, twists[lv % 5]]) jobs.push({ seed, level: lv, cheats: pick.cheats, diff, twist: tw, ng: lv % 2 ? 0 : 1 + (lv % 4) });
      }
    }
  }
  const filt = ['quick', 'full'].includes(mode) && process.argv[3];
  const todo = filt ? jobs.filter(j => JSON.stringify(j).includes(filt)) : jobs;
  console.log(`${todo.length} levels to solve`);
  const N = Math.min(11, todo.length), fails = [];
  let done = 0, next = 0, slow = 0;
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const wk = new Worker(__filename);
    const feed = () => { if (next < todo.length) wk.postMessage(todo[next++]); else wk.postMessage('done'); };
    wk.on('message', m => {
      done++; slow = Math.max(slow, m.ms);
      if (!m.res.ok) { fails.push(m); console.log(`\nUNSOLVED ${JSON.stringify(m.job)} twist=${m.twist} w=${m.w} reached col ${Math.floor((m.res.best || 0) / 32)} deaths=${JSON.stringify(m.res.deathCauses)} ${m.res.err || ''}${m.res.timeout ? ' TIMEOUT' : ''}\n${m.res.map || ''}`); }
      if (done % 50 === 0) console.log(`  ${done}/${todo.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      feed();
    });
    feed();
  }
  process.on('exit', () => {
    console.log(`\nsolved ${done - fails.length}/${done}, unsolved ${fails.length}, slowest ${slow}ms, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    fs.writeFileSync(path.join(__dirname, 'solve-fails.json'), JSON.stringify(fails.map(f => f.job), null, 1));
  });
}
