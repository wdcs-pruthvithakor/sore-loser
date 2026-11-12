// Headless solver: plays levels through the real World physics with a beam search over
// human-sized inputs (0.1s steps, so a "short hop" is a 0.1s tap) and reports any level
// no route can finish. Catches combinations the static validator cannot see: twists that
// change jump height, timed hazards next to "keep moving" cheats, and so on.
// On a boss level the run counts as solved once you reach the arena; `boss` mode fights the boss itself.
// Usage: node tools/solve.js [quick|full|boss] [jobsFilter]
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
          if (w.won || (w.bossState && w.bossState.started)) return { ok: true, depth, t: depth * STEP * DT };
          if (!w.p.alive) { dead = true; const c = w.events.find(e => e.type === 'death'); if (c) deathCauses[c.cause] = (deathCauses[c.cause] || 0) + 1; break; }
        }
        w.events.length = 0;
        if (dead) continue;
        const p = w.p;
        const key = [Math.floor(p.x / 4), Math.floor(p.y / 4), Math.round(p.vx / 40), Math.round(p.vy / 80), a.j === 1 ? 1 : a.j === 2 ? Math.min(node.held + 1, MINHOLD + 1) : 0,
          w.swapped ? 1 : 0, w.dropped.size, w.door.spot, w.cpReal ? 1 : 0, w.shown.size,
          // inside lag, the next quarter-second is already decided by queued keys: they are part of the state
          w.lagNow ? w.inBuf.slice(-30).map(i => (i.jump ? 1 : 0) + (i.jumpPressed ? 2 : 0) + (i.right ? 4 : 0) + (i.left ? 8 : 0)).join('') : ''].join(',');
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

// The boss: start at the door camp, then search plug by plug. Each search runs until the boss loses
// a hit, scoring states by distance to the plug that is out. Deaths are pruned, so a win here means
// the whole fight can be done without losing a life, at human input timing.
function solveBoss(ctx, L, opts) {
  const SL = ctx.SL, T = SL.TILE;
  const w = new SL.World(L, { bonks: 0, crumbleSurvive: 0, causes: {} });
  const cp = L.checkpoints[L.checkpoints.length - 1];
  w.respawnAt = { x: cp.x - SL.PW / 2, y: cp.y - SL.PH }; w.reset();
  const CAP = opts.cap || 260, PER = opts.per || 3;
  let s0 = [{ s: snap(ctx, w), held: 0 }], t = 0;
  const log = [];
  const deathCauses = {};
  for (let leg = 0; leg < 40; leg++) {
    restore(ctx, w, s0[0].s);
    const hp0 = w.bossState.hp;
    // the next search starts from every way the last hit happened, not just the first one found:
    // the first can be a doomed moment (a tooth already falling on the plug), which a player would avoid
    let beam = s0, found = null, depth = 0, firstHit = -1;
    let lastDeaths = {};
    for (; depth < 160 && !(found && depth > firstHit + 6); depth++) {
      const seen = new Set(), kids = [];
      lastDeaths = {};
      for (const node of beam) {
        for (const a of ACTS) {
          if (a.j === 2 && !node.held) continue;
          restore(ctx, w, node.s);
          let dead = false;
          for (let f = 0; f < 12; f++) {
            w.update(DT, { left: a.dir < 0, right: a.dir > 0, jump: a.j > 0, jumpPressed: a.j === 1 && f === 0, down: false });
            if (!w.p.alive) { dead = true; const c = w.events.find(e => e.type === 'death'); if (c) { deathCauses[c.cause] = (deathCauses[c.cause] || 0) + 1; lastDeaths[c.cause] = (lastDeaths[c.cause] || 0) + 1; } break; }
            if (w.won || w.bossState.hp < hp0) break;
          }
          w.events.length = 0;
          if (dead) continue;
          const p = w.p, bs = w.bossState;
          if (w.won || bs.hp < hp0) { if (!found) firstHit = depth; (found = found || []).push({ s: snap(ctx, w), held: a.j > 0 ? 1 : 0, won: w.won }); continue; }
          // with a plug out, head for it; while waiting for one, keep off the floor like a player would
          const tg = bs.plug || (!bs.started ? { x: L.arena.x0 + 3 * T, y: L.arena.floor } : null);
          // a started fight always outranks loitering at the door
          const score = (bs.started ? 1e5 : 0) + (tg ? -(Math.abs(p.x + SL.PW / 2 - tg.x) + 2.2 * Math.abs(p.y + SL.PH - tg.y)) : -Math.abs(p.y + SL.PH - 8 * T));
          const key = [Math.floor(p.x / 6), Math.floor(p.y / 6), Math.round(p.vx / 60), Math.round(p.vy / 120), a.j > 0 ? 1 : 0, bs.plug ? 1 : 0].join(',');
          if (seen.has(key)) continue;
          seen.add(key);
          kids.push({ s: snap(ctx, w), held: a.j > 0 ? 1 : 0, score, cell: Math.floor(p.x / T) * 100 + Math.floor(p.y / T) });
        }
        if (found && found.length >= 60) break;
      }
      if (found && (found.length >= 60 || found.some(f => f.won))) break;
      if (!kids.length && found) break;
      if (!kids.length) {
        const pg = w.bossState.plug, a0 = L.arena.x0 / T;
        return { ok: false, t: t + depth * 0.1, hp: hp0, phase: w.bossState.phase, deathCauses, log, lastDeaths, plug: pg ? [Math.round(pg.x / T - a0), pg.y / T] : null };
      }
      kids.sort((a, b) => b.score - a.score);
      const per = new Map(); beam = [];
      for (const k of kids) { const n = per.get(k.cell) || 0; if (n >= PER) continue; per.set(k.cell, n + 1); beam.push(k); if (beam.length >= CAP) break; }
    }
    if (!found) return { ok: false, t, hp: hp0, phase: w.bossState.phase, deathCauses, log, timeout: true };
    t += (depth + 1) * 0.1; log.push(Math.round(t));
    if (found.some(f => f.won)) return { ok: true, t, log, deathCauses };
    s0 = found;
  }
  return { ok: false, t, log, deathCauses };
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
      res = job.boss ? solveBoss(ctx, L, job.opts || {}) : solve(ctx, L, job.opts || {});
      if (!res.ok) res.map = ascii(SL, L, Math.floor(res.best / SL.TILE));
    } catch (e) { res = { ok: false, err: e.message }; }
    parentPort.postMessage({ job, res, ms: Date.now() - t0, w: L && L.w, twist: L && L.twist });
  });
} else if (require.main !== module) {
  module.exports = { loadSL, snap, restore, solve, solveBoss };
} else {
  const ctx = loadSL(), SL = ctx.SL;
  const mode = process.argv[2] || 'quick';
  const jobs = [];
  const twists = [null, 'ice', 'floaty', 'fast', 'shaky'];
  const diffs = ['normal', 'hard', 'rage'];
  if (mode === 'one') {
    jobs.push(JSON.parse(process.argv[3]));
  } else if (mode === 'new') {
    // what changed most recently: late traps, the late cheats, boss-level runs, and real late-game mixes
    for (const diff of diffs) for (const tw of twists) {
      for (const lv of [58, 68, 78, 88]) jobs.push({ seed: 'TRAP' + lv, level: lv, cheats: [], diff, twist: tw });
      for (const id of ['peekaboo', 'lagZone']) for (const lv of [92, 98]) jobs.push({ seed: 'LATE' + lv, level: lv, cheats: [id], diff, twist: tw });
    }
    for (const diff of diffs) for (const seed of ['4GZA7', 'K9Q2X', 'MOLE5']) {
      const sheet = {}, prof = SL.Profile.blank(); let last = [];
      for (let lv = 2; lv <= 100; lv++) {
        const pick = SL.Profile.choose(lv, sheet, prof, last, seed, diff);
        if (pick.intro) sheet[pick.intro] = { met: true }; last = pick.cheats;
        if (SL.isBossLevel(lv) || (lv >= 57 && lv % 7 === 0)) jobs.push({ seed, level: lv, cheats: pick.cheats, diff, ng: lv % 2 ? 0 : 1 });
      }
    }
  } else if (mode === 'early') {
    // levels 2-56 as a real run would build them: camps, length budget, every mode
    for (const diff of diffs) for (const seed of ['4GZA7', 'K9Q2X', 'MOLE5']) {
      const sheet = {}, prof = SL.Profile.blank(); let last = [];
      for (let lv = 2; lv <= 56; lv++) {
        const pick = SL.Profile.choose(lv, sheet, prof, last, seed, diff);
        if (pick.intro) sheet[pick.intro] = { met: true }; last = pick.cheats;
        if (lv % 3 === 0 && !SL.isBossLevel(lv)) jobs.push({ seed, level: lv, cheats: pick.cheats, diff, twist: lv % 9 === 0 ? 'ice' : undefined });
      }
    }
  } else if (mode === 'boss') {
    for (const diff of diffs) for (const lv of [25, 50, 75, 100]) for (const seed of ['BOSS1', 'BOSS2']) jobs.push({ seed, level: lv, cheats: [], diff, boss: true });
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
  const filt = ['quick', 'full', 'new', 'boss', 'early'].includes(mode) && process.argv[3];
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
      if (m.job.boss) console.log(`${m.res.ok ? 'BEATEN' : 'NOT BEATEN'} level ${m.job.level} ${m.job.diff} ${m.job.seed}: ${m.res.t.toFixed(0)}s of fight, hits at ${m.res.log.join(',')}s${m.res.ok ? '' : ' stuck at hp ' + m.res.hp + ' phase ' + m.res.phase + (m.res.timeout ? ' (timeout)' : '') + ' last deaths ' + JSON.stringify(m.res.lastDeaths) + ' plug ' + JSON.stringify(m.res.plug)} deaths pruned ${JSON.stringify(m.res.deathCauses)}`);
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
