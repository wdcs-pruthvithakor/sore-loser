// Headless checks: builds many levels across tiers and cheat mixes, validates routes,
// and runs the world with a jittery random bot to catch crashes.
// Usage: node tools/check.js [levelsPerSeed]
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, JSON };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['core', 'profile', 'game']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
const SL = ctx.SL;

const N = +process.argv[2] || 120;
const twists = {}, used = {};
let built = 0, salts = 0, maxSalt = 0, maxW = 0, fails = 0, events = {};
const t0 = Date.now();
for (const diff of ['normal', 'hard', 'rage']) for (const seed of ['ALPHA', 'BRAVO', 'C3PO7', 'DELTA', 'ECHO9']) {
  const sheet = {}, prof = SL.Profile.blank();
  let last = [];
  for (let lv = 1; lv <= N; lv++) {
    const pick = SL.Profile.choose(lv, sheet, prof, last, seed, diff);
    if (pick.intro) sheet[pick.intro] = { met: true };
    last = pick.cheats;
    if (new Set(pick.cheats).size !== pick.cheats.length) throw new Error('duplicate cheat ' + pick.cheats);
    let L;
    try { L = SL.buildLevel(seed, lv, pick.cheats, diff); } catch (e) { fails++; console.log('FAIL', e.message, pick.cheats); continue; }
    built++; salts += L.salt; maxSalt = Math.max(maxSalt, L.salt); maxW = Math.max(maxW, L.w);
    // also every single cheat alone at this level
    if (lv % 10 === 0) for (const id of SL.CHEAT_IDS) SL.buildLevel(seed + id, lv, [id], diff);
    const w = new SL.World(L, { bonks: 0, crumbleSurvive: 0, causes: {} });
    twists[L.twist] = (twists[L.twist] || 0) + 1; for (const id of pick.cheats) used[id] = (used[id] || 0) + 1;
    const r = SL.rng(lv * 7 + 1);
    let inp = { left: false, right: true, jump: false, jumpPressed: false };
    for (let i = 0; i < 60 * 40; i++) {
      if (i % 9 === 0) inp = { left: r() < 0.15, right: r() < 0.8, jump: r() < 0.5, jumpPressed: r() < 0.35, down: false };
      w.update(1 / 60, inp);
      inp.jumpPressed = false;
      for (const e of w.events) events[e.type] = (events[e.type] || 0) + 1;
      w.events.length = 0;
      if (!isFinite(w.p.x) || !isFinite(w.p.y)) throw new Error('NaN player at level ' + lv);
      if (w.won) break;
    }
    SL.Profile.merge(prof, w.stats); prof.levels++;
  }
}
console.log(`built ${built} levels, ${fails} failures, avg salt ${(salts / built).toFixed(2)}, max salt ${maxSalt}, max width ${maxW} tiles, ${Date.now() - t0}ms`);
console.log('events', JSON.stringify(events));
console.log('twists', JSON.stringify(twists));
console.log('cheats', JSON.stringify(used));
if (fails) process.exit(1);
