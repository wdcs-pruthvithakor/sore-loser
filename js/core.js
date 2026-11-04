// Core: constants, seeded RNG, cheat definitions, the level generator and the route validator.
// No DOM. Runs in the browser and in node (tools/check.js).
(function (G) {
'use strict';
const SL = G.SL = G.SL || {};

const T = 32, H = 15;
SL.TILE = T; SL.ROWS = H; SL.VIEW_W = 864; SL.VIEW_H = H * T;

// Tile codes.
const E = 0, GROUND = 1, SPIKE = 2, FALSE = 3, BRIDGE = 4, HOLE = 5, CRACK = 6, PAPER = 7, SEAM = 8, SWIRL = 9, SPIKED = 10;
SL.TC = { E, GROUND, SPIKE, FALSE, BRIDGE, HOLE, CRACK, PAPER, SEAM, SWIRL, SPIKED };
SL.isSolid = c => c === GROUND || c === BRIDGE || c === HOLE || c === CRACK || c === SEAM || c === SWIRL;
SL.looksSolid = c => c === GROUND || c === FALSE || c === HOLE || c === CRACK || c === SEAM || c === SWIRL;

// ---------- RNG ----------
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.chance = p => f() < p;
  f.shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  return f;
}
SL.hashStr = hashStr; SL.rng = rng;
SL.newSeed = () => {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};

// ---------- difficulty ----------
// Level 1 has one cheat. 2-5 two, 6-15 two or three, 16-30 three, 31-50 three or four (subtler tells), 51+ four or five.
SL.tierOf = lv => lv <= 5 ? 0 : lv <= 15 ? 1 : lv <= 30 ? 2 : lv <= 50 ? 3 : 4;
SL.cheatCount = (lv, r) => {
  const t = SL.tierOf(lv);
  if (lv === 1) return 1;
  return t === 0 ? 2 : t === 1 ? (r.chance(0.5) ? 3 : 2) : t === 2 ? 3 : t === 3 ? (r.chance(0.5) ? 4 : 3) : (r.chance(0.5) ? 5 : 4);
};
// Pairs that would make a level unfair together.
SL.CLASH = { copycat: ['backwardsFlag'], backwardsFlag: ['copycat'] };
SL.MOODS = ['sweet', 'smug', 'rattled', 'unhinged', 'broken'];

// ---------- the cheats ----------
// Every cheat has a symptom (what you see) and a rule (why it happens). The rule never changes.
SL.CHEATS = {
  coldFeet: {
    name: 'Cold Feet',
    symptom: 'The exit runs away when you get close.',
    rule: 'The exit hears footsteps. It only flees while your feet are on the ground. Arrive in the air.',
    crack: 'Jump into the exit from a distance.'
  },
  paperSpikes: {
    name: 'Paper Spikes',
    symptom: 'A long bed of spikes blocks the only way forward.',
    rule: 'Fake spikes blink every few seconds. Real spikes never blink. Walk on the blinkers.',
    crack: 'Stand on a spike that should have killed you.'
  },
  thirdTime: {
    name: 'Third Time Unlucky',
    symptom: 'A floating platform falls away under you.',
    rule: 'Every third platform you land on falls. The count restarts when you respawn. Hop off the third one fast.',
    crack: 'Survive two falling platforms.'
  },
  pinholes: {
    name: 'Pinholes',
    symptom: 'Perfectly normal floor stabs you.',
    rule: 'Floor tiles with three little holes are spike traps. Step on one and it fires. Jump over them.',
    crack: 'After one gets you, clear a pinhole tile on purpose.'
  },
  shouting: {
    name: 'Shouting Signs',
    symptom: 'A sign sent you down the road that kills you.',
    rule: 'Signs that end with "!" lie. Signs that end with "..." tell the truth. That goes for every sign.',
    crack: 'Ignore a lying sign and take the other road.'
  },
  headache: {
    name: 'Headache Block',
    symptom: 'A block drops on your head mid-jump.',
    rule: 'Jumping from a cracked tile drops a block on you. Take off from the tile before it.',
    crack: 'After a bonk, clear a cracked gap by jumping early.'
  },
  secretFloor: {
    name: 'Secret Floor',
    symptom: 'A pit far too wide to jump.',
    rule: 'If a pit is too wide to jump, it has an invisible floor. Look for sparkles, then just walk.',
    crack: 'Walk on the invisible floor.'
  },
  backwardsFlag: {
    name: 'Backwards Flag',
    symptom: 'The checkpoint said "saved". It lied.',
    rule: 'The checkpoint only saves if you touch it while walking left, from behind. Run past, then back up into it.',
    crack: 'Touch the checkpoint from behind.'
  },
  mimic: {
    name: 'Mimic',
    symptom: 'The exit ate you.',
    rule: 'A real exit has its handle on the RIGHT. A door with its handle on the left is a mouth. Jump over it.',
    crack: 'Jump over a mimic.'
  },
  ceilingTeeth: {
    name: 'Ceiling Teeth',
    symptom: 'The ceiling bit you.',
    rule: 'Ceiling blocks with a dark seam drop a tooth a beat after you pass under. Keep running and never stop beneath one.',
    crack: 'Run through two toothy tunnels.'
  },
  shyLedge: {
    name: 'Shy Ledge',
    symptom: 'A ledge ducked out of the way of your jump.',
    rule: 'A ledge with eyes ducks the first jump you make toward it, then creeps back. Hop once, wait for it, then go.',
    crack: 'Land on a shy ledge after it ducks.'
  },
  swapZone: {
    name: 'Wrong Way',
    symptom: 'Left became right.',
    rule: 'Each purple swirl swaps left and right, once. The next swirl swaps them back. Count the swirls.',
    crack: 'Jump while swapped and reach the swirl that fixes it.'
  },
  impatient: {
    name: 'Impatient Floor',
    symptom: 'The floor dropped out from under you.',
    rule: 'Stand still on the ground for a second and a half and it falls away. It shakes first. The start and the flag are safe.',
    crack: 'Feel the floor shake and step off in time.'
  },
  copycat: {
    name: 'Copycat',
    symptom: 'Your shadow killed you.',
    rule: 'Once you leave the start, a shadow copies your moves two seconds late. Touching it kills you. Never stop, never double back.',
    crack: 'Finish a level with your shadow behind you.'
  }
};
SL.CHEAT_IDS = Object.keys(SL.CHEATS);
SL.INTRO_ORDER = ['coldFeet', 'paperSpikes', 'thirdTime', 'pinholes', 'mimic', 'shouting', 'ceilingTeeth', 'headache', 'shyLedge', 'secretFloor', 'swapZone', 'backwardsFlag', 'impatient', 'copycat'];

// ---------- sign text (all signs obey the Shouting Signs rule) ----------
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five'];
const SIGNS = {
  lieHigh: ['The HIGH road is totally safe!', 'Go up! Trust me!', 'Up top! Definitely up top!', 'Climb! The tunnel is cursed!'],
  lieLow: ['Stay LOW! It is safe!', 'Take the tunnel!', 'Down here! Not up there!', 'Low road! Promise!'],
  truthHigh: ['the high road...', 'go up... trust me...', 'climb... the tunnel bites...', 'up top is fine...'],
  truthLow: ['take the tunnel...', 'stay low...', 'the low road is fine...', 'down here... not up there...'],
  lieFlavor: ['No tricks in this one!', 'This level is 100% fair!', 'Nothing weird ahead!', 'I fixed all the bugs!', 'Relax! Just walk!'],
};

// ---------- generator ----------
// Builds a level left to right from segments that stay inside the jump envelope, then checks the route.
function buildOnce(runSeed, level, cheats, salt) {
  const seed = hashStr(runSeed + ':' + level + ':' + salt);
  const r = rng(seed);
  const tier = SL.tierOf(level);
  const has = id => cheats.indexOf(id) >= 0;
  const MAXW = 520;
  const g = new Uint8Array(MAXW * H);
  const L = {
    level, seed, tier, cheats: cheats.slice(), plats: [], signs: [], forks: [], saws: [], mimics: [], tunnels: [],
    carpets: [], bridges: [], gotchas: [], checkpoint: null, doorSpots: [], hops: 0, start: null
  };
  const get = (c, row) => (c >= 0 && c < MAXW && row >= 0 && row < H) ? g[row * MAXW + c] : E;
  const set = (c, row, v) => { if (c >= 0 && c < MAXW && row >= 0 && row < H) g[row * MAXW + c] = v; };
  const col = (c, top, topCode) => { for (let row = top; row < H; row++) set(c, row, GROUND); if (topCode) set(c, top, topCode); };
  const clampH = v => Math.max(7, Math.min(12, v));
  const protect = new Set();
  let x = 0, h = 11;
  const flat = n => { for (let i = 0; i < n; i++) col(x + i, h); x += n; };
  // Pits have a bed of spikes, so falls look as bad as they are.
  const pit = n => { for (let i = 0; i < n; i++) set(x + i, H - 1, SPIKE); x += n; };
  const sign = (c, text) => { L.signs.push({ x: c * T + T / 2, y: h * T, text, lie: /!$/.test(text) }); protect.add(c); };
  const maxGap = [3, 4, 4, 5, 5][tier];
  const sawSpeed = [1, 1.15, 1.3, 1.45, 1.6][tier];

  // ----- ordinary segments -----
  const segGap = () => {
    flat(1);
    const n = r.int(2, maxGap);
    pit(n);
    let dh = r.int(-1, 1);
    if (n >= 4 && dh < 0) dh = 0;
    h = clampH(h + dh);
    flat(r.int(tier >= 3 ? 1 : 2, 3));
  };
  const segStep = () => { h = clampH(h + r.pick([-2, -1, 1, 2])); flat(r.int(2, 3)); };
  const segSpikes = () => {
    flat(2);
    const n = r.int(1, [2, 3, 3, 4, 4][tier]);
    for (let i = 0; i < n; i++) { col(x + i, h); set(x + i, h - 1, SPIKE); }
    x += n;
    flat(2);
  };
  const segPlats = (count) => {
    flat(1);
    const n = count || r.int(3, 4);
    let row = h, c = x;
    for (let i = 0; i < n; i++) {
      c += r.int(1, tier >= 2 ? 4 : 3);
      const nr = Math.max(5, Math.min(12, row + r.int(-1, 1)));
      const w = tier >= 2 ? r.int(1, 2) : 2;
      L.plats.push({ x: c * T, y: nr * T, w: w * T, kind: 'static' });
      c += w; row = nr;
    }
    for (let i = x; i < c; i++) set(i, H - 1, SPIKE);
    c += r.int(1, 3);
    x = c;
    h = clampH(row + r.int(-1, 1));
    flat(r.int(2, 3));
  };
  const segMover = () => {
    flat(1);
    const n = r.int(6, 8);
    const x0 = x * T, x1 = (x + n - 2) * T;
    const speed = 70 + tier * 12;
    L.plats.push({ x: x0, y: h * T, w: (tier >= 3 ? 1.5 : 2) * T, kind: 'move', x0, x1, omega: Math.PI * speed / (x1 - x0), phase: r() * Math.PI * 2 });
    pit(n);
    flat(2);
  };
  const segPillars = () => {
    const n = r.int(2, 4 + Math.min(2, tier));
    for (let i = 0; i < n; i++) { pit(r.int(1, Math.min(4, maxGap - 1))); h = clampH(h + r.int(-1, 1)); flat(tier >= 2 ? 1 : r.int(1, 2)); }
    pit(r.int(1, 2)); h = clampH(h + r.int(-1, 1)); flat(2);
  };
  // A slab of hanging spikes over a gap: only a short hop gets under it.
  let ceilTaught = tier > 0 ? 9 : 0;
  const segCeil = () => {
    flat(2);
    // early levels: a truthful sign (it ends in "...") teaches the short hop
    if (ceilTaught < 1) { ceilTaught++; sign(x - 2, 'tap jump and let go fast for a tiny hop...'); }
    const n = r.int(2, tier >= 1 ? 3 : 2);
    const a = x - 1, b = x + n;
    for (let c = a; c <= b; c++) { for (let row = Math.max(0, h - 7); row <= h - 5; row++) set(c, row, GROUND); set(c, h - 4, SPIKED); }
    pit(n);
    flat(2);
  };
  // A sawblade: rolling along the floor, or rising and falling through a pit.
  const segSaw = () => {
    if (r.chance(0.5)) {
      flat(1);
      const n = r.int(6, 8);
      const x0 = (x + 1) * T, x1 = (x + n - 1) * T;
      L.saws.push({ x0, y0: h * T - 13, x1, y1: h * T - 13, omega: sawSpeed * Math.PI * 2 / r.pick([1.3, 1.6, 1.9]), phase: r() * 6.28 });
      flat(n);
      flat(1);
    } else {
      flat(2);
      const n = r.int(3, Math.min(4, maxGap));
      const cx = (x + n / 2) * T;
      L.saws.push({ x0: cx, y0: h * T + 40, x1: cx, y1: h * T - 120, omega: sawSpeed * Math.PI * 2 / r.pick([1.3, 1.6, 1.9]), phase: r() * 6.28 });
      pit(n);
      flat(2);
    }
  };

  // ----- cheat segments -----
  const segCarpet = () => {
    flat(2);
    const n = r.int(7, 10);
    const real = new Set();
    if (tier >= 1) { let p = r.int(2, 4); while (p < n - 2) { real.add(p); p += r.int(tier >= 3 ? 2 : 3, 5); } }
    for (let i = 0; i < n; i++) { col(x + i, h); set(x + i, h - 1, real.has(i) ? SPIKE : PAPER); }
    L.carpets.push({ x0: x, x1: x + n, row: h });
    x += n;
    flat(2);
  };
  const segHoles = () => {
    flat(2);
    const k = r.int(2, 3 + Math.min(1, tier));
    for (let j = 0; j < k; j++) {
      const n = r.int(1, tier >= 2 ? 3 : 2);
      for (let i = 0; i < n; i++) col(x + i, h, HOLE);
      x += n;
      flat(r.int(tier >= 2 ? 1 : 2, 3));
    }
  };
  const segGotcha = () => {
    flat(3);
    set(x - 1, h, CRACK);
    const n = r.int(2, Math.min(4, maxGap));
    L.gotchas.push({ x0: x, x1: x + n, row: h });
    pit(n);
    if (r.chance(0.4)) h = clampH(h + 1);
    flat(3);
  };
  const segBridge = () => {
    flat(2);
    const n = r.int(6, 9);
    for (let i = 0; i < n; i++) set(x + i, h, BRIDGE);
    // later tiers: a spike sits on the invisible floor, so you have to hop on air
    if (tier >= 2 && n >= 7) set(x + r.int(2, n - 3), h - 1, SPIKE);
    L.bridges.push({ x0: x, x1: x + n, row: h });
    x += n;
    flat(2);
  };
  // A fork: a high road over a solid mass and a low tunnel under it. One of them hides a false floor.
  const segFork = () => {
    if (h < 11) h = 11;
    flat(2);
    const signCol = x;
    protect.add(signCol);
    flat(2);
    const s = x;
    flat(7);
    set(s + 1, h - 2, GROUND); set(s + 3, h - 4, GROUND); set(s + 5, h - 6, GROUND);
    const m0 = s + 7, M = 15, u = h - 7, TW = 5;
    const trapAt = m0 + r.int(4, 7);
    const safe = r.chance(0.5) ? 'high' : 'low';
    for (let i = 0; i < M; i++) { col(m0 + i, h); for (let row = u; row <= h - 4; row++) set(m0 + i, row, GROUND); }
    for (let i = 0; i < TW; i++) {
      const c = trapAt + i;
      protect.add(c);
      // false floors are filled all the way down so the trap looks like solid ground
      if (safe === 'high') { for (let row = h; row < H; row++) set(c, row, FALSE); }
      else { set(c, u, FALSE); set(c, u + 1, FALSE); set(c, u + 2, SPIKE); }
    }
    const lie = r.chance(0.5);
    const claim = lie ? (safe === 'high' ? 'low' : 'high') : safe;
    const pool = lie ? (claim === 'high' ? SIGNS.lieHigh : SIGNS.lieLow) : (claim === 'high' ? SIGNS.truthHigh : SIGNS.truthLow);
    L.signs.push({ x: signCol * T + T / 2, y: h * T, text: r.pick(pool), lie, fork: L.forks.length });
    L.forks.push({ trapX0: trapAt * T, trapX1: (trapAt + TW) * T, ceilY: (h - 4) * T, safe, claim, lie, x0: m0 * T });
    x = m0 + M;
    flat(2);
  };
  const segCheckpoint = () => { flat(2); L.checkpoint = { x: (x + 1) * T + T / 2, y: h * T }; for (let c = x - 2; c < x + 4; c++) protect.add(c); flat(4); };
  // A door in the middle of the level. Its handle is on the wrong side.
  const segMimic = () => {
    flat(3);
    L.mimics.push({ x: x * T + T / 2, y: h * T });
    for (let c = x - 2; c < x + 3; c++) protect.add(c);
    flat(r.int(3, 4));
  };
  // A low tunnel with seamed ceiling blocks that drop teeth.
  const segTeeth = () => {
    flat(2);
    const n = r.int(6, 8 + tier);
    const x0 = x;
    flat(n);
    const seams = new Set();
    if (tier >= 2) for (let i = 1; i < n - 1; i++) seams.add(i);
    else { let p = r.int(1, 2); while (p < n - 1) { seams.add(p); p += r.int(2, 3); } }
    for (let i = 0; i < n; i++) {
      for (let row = Math.max(0, h - 7); row <= h - 4; row++) set(x0 + i, row, GROUND);
      if (seams.has(i)) set(x0 + i, h - 4, SEAM);
    }
    if (tier >= 2) set(x0 + r.int(2, n - 3), h - 1, SPIKE);
    L.tunnels.push({ x0, x1: x0 + n });
    for (let c = x0; c < x0 + n; c++) protect.add(c);
    flat(2);
  };
  // A floating ledge with eyes over a pit too wide to jump without it.
  const segShy = () => {
    flat(2);
    const a = r.int(2, 3), b = r.int(2, 3);
    pit(a);
    const y = (h - r.int(0, 1)) * T;
    L.plats.push({ x: x * T, y, w: 2 * T, kind: 'shy' });
    pit(2 + b);
    flat(3);
  };
  // Two swirls with a little gauntlet between them, run with your controls swapped.
  const segSwirl = () => {
    flat(2);
    col(x, h, SWIRL); protect.add(x); x++;
    flat(1);
    const k = tier >= 2 ? 2 : 1;
    for (let i = 0; i < k; i++) r.pick([segGap, segSpikes])();
    flat(1);
    col(x, h, SWIRL); protect.add(x); x++;
    flat(2);
  };

  // ----- start -----
  col(0, 0); x = 1; h = 11;
  flat(level === 1 ? 14 : 7);
  for (let c = 0; c < x; c++) protect.add(c);
  L.start = { x: 2.5 * T, y: h * T };
  if (level === 1) {
    sign(4, 'walk with ← → or A D...');
    sign(9, 'Press ↓ to jump!');
  } else {
    const n = cheats.length;
    sign(5, r.chance(0.5) ? r.pick(SIGNS.lieFlavor) : `${NUM[n]} trick${n > 1 ? 's' : ''} in this one...`);
  }
  const bodyStart = x;

  // ----- body -----
  // Short and dense: more cheats means fewer filler segments, not a longer level.
  const targetW = level === 1 ? 46 : 54 + Math.round(Math.min(level, 40) * 0.6);
  const queue = [];
  const twice = cheats.length <= 2;
  const add = (fn, n) => { for (let i = 0; i < n; i++) queue.push(fn); };
  if (has('paperSpikes')) add(segCarpet, 1);
  if (has('pinholes')) add(segHoles, twice ? 2 : 1);
  if (has('thirdTime')) add(() => segPlats(r.int(3, 5)), twice ? 2 : 1);
  if (has('shouting')) add(segFork, 1);
  if (has('headache')) add(segGotcha, twice ? 2 : 1);
  if (has('secretFloor')) add(segBridge, 1);
  if (has('mimic')) add(segMimic, 1);
  if (has('ceilingTeeth')) add(segTeeth, 1);
  if (has('shyLedge')) add(segShy, twice ? 2 : 1);
  if (has('swapZone')) add(segSwirl, 1);
  r.shuffle(queue);
  const fillers = level === 1 ? [segGap, segStep, segSpikes, segPillars, segCeil, segSaw] :
    tier === 0 ? [segGap, segStep, segSpikes, segPlats, segPillars, segCeil, segSaw] :
    [segGap, segSpikes, segPlats, segPillars, segMover, segCeil, segSaw, segSaw];
  let midPlaced = level === 1;
  while (queue.length || x < targetW) {
    const nf = x >= targetW ? 1 : r.int(1, 2);
    for (let i = 0; i < nf; i++) r.pick(fillers)();
    if (!midPlaced && x > targetW / 2) { segCheckpoint(); midPlaced = true; }
    if (queue.length) queue.shift()();
  }
  if (!midPlaced) segCheckpoint();
  const bodyEnd = x;

  // ----- sprinkles: pinholes and cracks hidden in ordinary floor -----
  const holeP = has('pinholes') ? [0.05, 0.1, 0.14, 0.18, 0.22][tier] : 0;
  const crackP = has('headache') ? [0.3, 0.45, 0.55, 0.65, 0.75][tier] : 0;
  for (let c = bodyStart + 1; c < bodyEnd - 1; c++) {
    if (protect.has(c) || protect.has(c - 1) || protect.has(c + 1)) continue;
    for (let row = 4; row < H - 1; row++) {
      if (get(c, row) !== GROUND || get(c, row - 1) !== E) continue;
      const lft = get(c - 1, row) === GROUND && get(c - 1, row - 1) === E;
      const rgt = get(c + 1, row) === GROUND && get(c + 1, row - 1) === E;
      if (lft && rgt && holeP && r.chance(holeP)) set(c, row, HOLE);
      else if (lft && get(c + 1, row) === E && get(c + 1, row - 1) === E && crackP && r.chance(crackP)) set(c, row, CRACK);
      break;
    }
  }

  // ----- end zone: the exit and the pillars it can flee to -----
  flat(5);
  L.doorSpots.push({ x: (x - 2) * T + T / 2, y: h * T });
  for (let i = 0; i < 3; i++) {
    pit(r.int(2, tier >= 2 ? 4 : 3));
    h = clampH(h + r.int(-1, 1));
    L.doorSpots.push({ x: (x + 1) * T, y: h * T });
    flat(2);
  }
  pit(2); h = clampH(h + r.int(-1, 1));
  flat(5);
  L.doorSpots.push({ x: (x - 3) * T + T / 2, y: h * T });
  col(x, 0); col(x + 1, 0); x += 2;
  L.hops = has('coldFeet') ? Math.min(L.doorSpots.length - 1, 2 + Math.floor(tier / 2)) : 0;

  // compact
  L.w = x;
  L.tiles = new Uint8Array(L.w * H);
  for (let row = 0; row < H; row++) for (let c = 0; c < L.w; c++) L.tiles[row * L.w + c] = g[row * MAXW + c];
  return L;
}

// ---------- validator ----------
// A coarse reachability check over standable cells using the player's jump envelope.
// Measured envelope at full speed: 5-tile gaps on the level, 4 going up one, 3 going up two.
SL.validate = function (L) {
  const W = L.w, tl = L.tiles;
  const reach = L.tier >= 3 ? 6 : 5; // 5-tile gaps only from tier 3, and they need an edge jump
  const at = (c, row) => (c < 0 || c >= W) ? GROUND : (row < 0 || row >= H) ? E : tl[row * W + c];
  const platCells = new Set();
  for (const p of L.plats) {
    const a = Math.floor((p.kind === 'move' ? p.x0 : p.x) / T);
    const b = Math.ceil(((p.kind === 'move' ? p.x1 : p.x) + p.w) / T) - 1;
    for (let c = a; c <= b; c++) platCells.add(c + ',' + (p.y / T - 1));
  }
  const standable = (c, row) => {
    if (c < 0 || c >= W || row < 0 || row >= H) return false;
    const here = at(c, row);
    if (SL.isSolid(here) || here === SPIKE || here === SPIKED) return false;
    if (at(c, row - 1) === SPIKED) return false;
    if (platCells.has(c + ',' + row)) return true;
    const below = at(c, row + 1);
    return row + 1 < H && SL.isSolid(below) && below !== HOLE;
  };
  const cell = p => [Math.floor((p.x - 1) / T), p.y / T - 1];
  const [sc, sr] = cell(L.start);
  if (!standable(sc, sr)) return false;
  const seen = new Set([sc + ',' + sr]);
  const q = [[sc, sr]];
  while (q.length) {
    const [c, row] = q.pop();
    const fromCrack = at(c, row + 1) === CRACK && !platCells.has(c + ',' + row);
    for (let dc = -7; dc <= 7; dc++) {
      if (!dc) continue;
      const adx = Math.abs(dc);
      for (let r2 = 0; r2 < H; r2++) {
        const up = row - r2;
        let ok;
        if (fromCrack) ok = (up === 0 && adx === 1) || (up < 0 && adx <= 3);
        else ok = up > 3 ? false : up === 3 ? adx <= 2 : up === 2 ? adx <= 4 : up === 1 ? adx <= 5 : up === 0 ? adx <= reach : up === -1 ? adx <= 6 : adx <= 7;
        if (!ok) continue;
        const k = (c + dc) + ',' + r2;
        if (seen.has(k) || !standable(c + dc, r2)) continue;
        seen.add(k); q.push([c + dc, r2]);
      }
    }
  }
  return L.doorSpots.every(s => { const [c, row] = cell(s); return seen.has(c + ',' + row); });
};

SL.buildLevel = function (runSeed, level, cheats) {
  for (let salt = 0; salt < 80; salt++) {
    const L = buildOnce(runSeed, level, cheats, salt);
    if (SL.validate(L)) { L.salt = salt; return L; }
  }
  throw new Error('no valid level for ' + runSeed + ' #' + level);
};

})(typeof window !== 'undefined' ? window : globalThis);
