// Core: constants, seeded RNG, cheat definitions, the level generator and the route validator.
// No DOM. Runs in the browser and in node (tools/check.js).
(function (G) {
'use strict';
const SL = G.SL = G.SL || {};

const T = 32, H = 15;
SL.TILE = T; SL.ROWS = H; SL.VIEW_W = 864; SL.VIEW_H = H * T;

// Tile codes.
const E = 0, GROUND = 1, SPIKE = 2, FALSE = 3, BRIDGE = 4, HOLE = 5, CRACK = 6, PAPER = 7, SEAM = 8, SWIRL = 9, SPIKED = 10, INVIS = 11;
SL.TC = { E, GROUND, SPIKE, FALSE, BRIDGE, HOLE, CRACK, PAPER, SEAM, SWIRL, SPIKED, INVIS };
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
// Level 1 has one cheat. 2-5 two, 6-15 two or three, 16-30 three, 31-50 three or four, 51+ four or five.
// Hard and Rage add cheats, build levels from a harder tier, and fade (Hard) or remove (Rage) every tell.
SL.DIFFS = {
  normal: { name: 'Normal', bump: 0, extra: 0, blurb: 'Every trap has a tell. Learn them.' },
  hard: { name: 'Hard', bump: 1, extra: 1, blurb: 'Faint tells, one more cheat, meaner levels.' },
  rage: { name: 'Rage', bump: 2, extra: 2, blurb: 'No tells at all. Traps look like everything else. Memorise or die.' }
};
SL.tierOf = lv => lv <= 5 ? 0 : lv <= 15 ? 1 : lv <= 30 ? 2 : lv <= 50 ? 3 : 4;
SL.cheatCount = (lv, r, diff) => {
  const t = SL.tierOf(lv);
  const extra = (SL.DIFFS[diff] || SL.DIFFS.normal).extra;
  if (lv === 1) return 1 + Math.min(1, extra);
  return extra + (t === 0 ? 2 : t === 1 ? (r.chance(0.5) ? 3 : 2) : t === 2 ? 3 : t === 3 ? (r.chance(0.5) ? 4 : 3) : (r.chance(0.5) ? 5 : 4));
};
// Pairs that would make a level unfair together.
SL.CLASH = { copycat: ['backwardsFlag'], backwardsFlag: ['copycat', 'spikeWall'], spikeWall: ['backwardsFlag'] };
SL.MOODS = ['sweet', 'smug', 'rattled', 'unhinged', 'broken'];

// Level twists: one per level from level 6, so later levels never feel the same.
SL.TWISTS = {
  ice: { name: 'Ice', say: 'Today\'s special: ice. Good luck stopping.' },
  dark: { name: 'Lights out', say: 'I turned the lights off. Saves power.' },
  floaty: { name: 'Floaty', say: 'Low gravity today. Mind the ceiling.' },
  fast: { name: 'Fast forward', say: 'Everything is a bit faster. Including you. Mostly them.' },
  mirror: { name: 'Mirror', say: 'This level is backwards. So is your screen.' },
  shaky: { name: 'Earthquake', say: 'Hold on. The world is having a moment.' }
};

// ---------- the cheats ----------
// Every cheat has a symptom (what you see) and a rule (why it happens). The rule never changes.
SL.CHEATS = {
  coldFeet: {
    name: 'Cold Feet',
    symptom: 'The exit runs away when you get close.',
    rule: 'The exit hears footsteps. It only flees while your feet are on the ground. Arrive in the air.',
    crack: 'Jump into the exit from a distance.'
  },
  falseFloor: {
    name: 'False Floor',
    symptom: 'Solid ground was not solid.',
    rule: 'Some floor is painted air. Its grass has no blades and its dirt has no specks. On Rage it looks exactly like the rest.',
    crack: 'After one drops you, jump over a false floor on purpose.'
  },
  rotten: {
    name: 'Rotten Platforms',
    symptom: 'A floating platform gave way under you.',
    rule: 'Some platforms are rotten and drop a quarter-second after you land. Which ones is random per level, but you always have time to hop off. Hold jump as you land.',
    crack: 'Bounce off two rotten platforms.'
  },
  pinholes: {
    name: 'Pinholes',
    symptom: 'Perfectly normal floor stabs you.',
    rule: 'Floor tiles with three little holes are spike traps. Step on one and it fires. Jump over them.',
    crack: 'After one gets you, clear a pinhole tile on purpose.'
  },
  mimic: {
    name: 'Mimic',
    symptom: 'The exit ate you.',
    rule: 'A real exit has its handle on the RIGHT. A door with its handle on the left is a mouth. Jump over it.',
    crack: 'Jump over a mimic.'
  },
  invisBlock: {
    name: 'Invisible Block',
    symptom: 'You hit your head on thin air and fell in.',
    rule: 'Invisible blocks hang over the start of some gaps. A full jump bonks you into the pit. Cross with a short hop.',
    crack: 'After one gets you, short-hop a gap without hitting it.'
  },
  shouting: {
    name: 'Shouting Signs',
    symptom: 'A sign sent you down the road that kills you.',
    rule: 'Signs that end with "!" lie. Signs that end with "..." tell the truth. On Rage the signs stop shouting, so remember the road.',
    crack: 'Ignore a lying sign and take the other road.'
  },
  ceilingTeeth: {
    name: 'Ceiling Teeth',
    symptom: 'The ceiling bit you.',
    rule: 'Ceiling blocks with a dark seam drop a tooth a beat after you pass under. Keep running and never stop beneath one.',
    crack: 'Run through two toothy tunnels.'
  },
  runaway: {
    name: 'Runaway Floor',
    symptom: 'The ground slid away mid-jump.',
    rule: 'A floating chunk of ground slides away from the first jump you make toward it, then slides back. Fake a hop, wait, then go.',
    crack: 'Land on runaway floor after it slides.'
  },
  headache: {
    name: 'Headache Block',
    symptom: 'A block drops on your head mid-jump.',
    rule: 'Jumping from a cracked tile drops a block on you. Take off from the tile before it.',
    crack: 'After a bonk, clear a cracked gap by jumping early.'
  },
  lunger: {
    name: 'Lunging Spike',
    symptom: 'A spike ran at you.',
    rule: 'A spike standing alone on flat ground charges when you come within three tiles. Jump the moment it moves.',
    crack: 'Jump over a charging spike.'
  },
  shyLedge: {
    name: 'Shy Ledge',
    symptom: 'A ledge ducked out of the way of your jump.',
    rule: 'A ledge with eyes ducks the first jump you make toward it, then creeps back. Hop once, wait for it, then go.',
    crack: 'Land on a shy ledge after it ducks.'
  },
  secretFloor: {
    name: 'Secret Floor',
    symptom: 'A pit far too wide to jump.',
    rule: 'If a pit is too wide to jump, it has an invisible floor. Look for sparkles, then just walk.',
    crack: 'Walk on the invisible floor.'
  },
  swapZone: {
    name: 'Wrong Way',
    symptom: 'Left became right.',
    rule: 'Each purple swirl swaps left and right, once. The next swirl swaps them back. On Rage the swirls look like grass.',
    crack: 'Jump while swapped and reach the swirl that fixes it.'
  },
  impatient: {
    name: 'Impatient Floor',
    symptom: 'The floor dropped out from under you.',
    rule: 'Stand still on the ground for a second and a half and it falls away. It shakes first (not on Rage). The start and the flag are safe.',
    crack: 'Feel the floor shake and step off in time.'
  },
  backwardsFlag: {
    name: 'Backwards Flag',
    symptom: 'The checkpoint said "saved". It lied.',
    rule: 'The checkpoint only saves if you touch it while walking left, from behind. Run past, then back up into it.',
    crack: 'Touch the checkpoint from behind.'
  },
  copycat: {
    name: 'Copycat',
    symptom: 'Your shadow killed you.',
    rule: 'Once you leave the start, a shadow copies your moves two seconds late. Touching it kills you. Never stop, never double back.',
    crack: 'Finish a level with your shadow behind you.'
  },
  spikeWall: {
    name: 'Spike Wall',
    symptom: 'A wall of spikes chased you down.',
    rule: 'Once you leave the start, a wall of spikes follows at about half your speed. Any long pause and it catches you.',
    crack: 'Finish a level with the wall on screen.'
  }
};
SL.CHEAT_IDS = Object.keys(SL.CHEATS);
SL.INTRO_ORDER = ['coldFeet', 'falseFloor', 'rotten', 'pinholes', 'mimic', 'invisBlock', 'shouting', 'ceilingTeeth', 'runaway', 'headache',
  'lunger', 'shyLedge', 'secretFloor', 'swapZone', 'impatient', 'backwardsFlag', 'copycat', 'spikeWall'];

// ---------- sign text (all signs obey the Shouting Signs rule) ----------
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const SIGNS = {
  lieHigh: ['The HIGH road is totally safe!', 'Go up! Trust me!', 'Up top! Definitely up top!', 'Climb! The tunnel is cursed!'],
  lieLow: ['Stay LOW! It is safe!', 'Take the tunnel!', 'Down here! Not up there!', 'Low road! Promise!'],
  truthHigh: ['the high road...', 'go up... trust me...', 'climb... the tunnel bites...', 'up top is fine...'],
  truthLow: ['take the tunnel...', 'stay low...', 'the low road is fine...', 'down here... not up there...'],
  lieFlavor: ['No tricks in this one!', 'This level is 100% fair!', 'Nothing weird ahead!', 'I fixed all the bugs!', 'Relax! Just walk!'],
};

// ---------- generator ----------
// Builds a level left to right from segments that stay inside the jump envelope, then checks the route.
function buildOnce(runSeed, level, cheats, salt, diff) {
  diff = SL.DIFFS[diff] ? diff : 'normal';
  const seed = hashStr(runSeed + ':' + diff + ':' + level + ':' + salt);
  const r = rng(seed);
  const tier = Math.min(4, SL.tierOf(level) + SL.DIFFS[diff].bump);  // how mean the layout is
  const rage = diff === 'rage';
  const has = id => cheats.indexOf(id) >= 0;
  const MAXW = 560;
  const g = new Uint8Array(MAXW * H);
  const L = {
    level, seed, diff, tier: SL.tierOf(level), gt: tier, cheats: cheats.slice(), plats: [], signs: [], forks: [], saws: [], mimics: [],
    tunnels: [], lungers: [], invis: [], coins: [], carpets: [], bridges: [], gotchas: [], checkpoint: null, doorSpots: [], hops: 0, start: null, twist: null
  };
  const get = (c, row) => (c >= 0 && c < MAXW && row >= 0 && row < H) ? g[row * MAXW + c] : E;
  const set = (c, row, v) => { if (c >= 0 && c < MAXW && row >= 0 && row < H) g[row * MAXW + c] = v; };
  const col = (c, top, topCode) => { for (let row = top; row < H; row++) set(c, row, GROUND); if (topCode) set(c, top, topCode); };
  const falseCol = (c, top) => { for (let row = top; row < H - 1; row++) set(c, row, FALSE); set(c, H - 1, SPIKE); };
  const clampH = v => Math.max(7, Math.min(12, v));
  const protect = new Set();
  let x = 0, h = 11;
  const flat = n => { for (let i = 0; i < n; i++) col(x + i, h); x += n; };
  // Pits have a bed of spikes, so falls look as bad as they are.
  const pit = n => { for (let i = 0; i < n; i++) set(x + i, H - 1, SPIKE); x += n; };
  // On Rage the signs stop shouting: no "!" and no "...", so you cannot tell a lie from the truth.
  const strip = t => rage ? t.replace(/(!|\.\.\.)$/, '').replace(/\.\.\./g, ',') : t;
  const sign = (c, text) => { L.signs.push({ x: c * T + T / 2, y: h * T, text: strip(text), lie: /!$/.test(text) }); protect.add(c); };
  const maxGap = [3, 4, 4, 5, 5][tier];
  // Spite Coins sit in risky spots: over gaps, over spikes, on platforms, under spike ceilings.
  const coin = (px, py, p) => { if (L.coins.length < 7 && r.chance(p)) L.coins.push({ x: px, y: py }); };
  const sawSpeed = [1, 1.15, 1.3, 1.45, 1.6][tier];

  // ----- ordinary segments -----
  const segGap = () => {
    flat(1);
    const n = r.int(2, maxGap);
    coin((x + n / 2) * T, (h - 2.6) * T, 0.55);
    pit(n);
    let dh = r.int(-1, 1);
    if (n >= 4 && dh < 0) dh = 0;
    h = clampH(h + dh);
    flat(r.int(tier >= 3 ? 1 : 2, 3));
  };
  const segStep = () => { h = clampH(h + r.pick([-2, -1, 1, 2])); coin((x + 1) * T, (h - 2.2) * T, 0.3); flat(r.int(2, 3)); };
  const segSpikes = () => {
    flat(2);
    const n = r.int(1, [2, 3, 3, 4, 4][tier]);
    coin((x + n / 2) * T, (h - 3) * T, 0.55);
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
      coin((c + w / 2) * T, nr * T - 22, 0.3);
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
    coin((x + n / 2) * T, (h - 2.4) * T, 0.6);
    pit(n);
    flat(2);
  };
  const segPillars = () => {
    const n = r.int(2, 4 + Math.min(2, tier));
    for (let i = 0; i < n; i++) { pit(r.int(1, Math.min(4, maxGap - 1))); h = clampH(h + r.int(-1, 1)); coin((x + 0.5) * T, (h - 1.6) * T, 0.18); flat(tier >= 2 ? 1 : r.int(1, 2)); }
    pit(r.int(1, 2)); h = clampH(h + r.int(-1, 1)); flat(2);
  };
  // A slab of hanging spikes over a gap: only a short hop gets under it.
  let ceilTaught = (SL.tierOf(level) > 0 || diff !== 'normal') ? 9 : 0;
  const segCeil = () => {
    flat(2);
    if (ceilTaught < 1) { ceilTaught++; sign(x - 2, 'tap jump and let go fast for a tiny hop...'); }
    const n = r.int(2, tier >= 1 ? 3 : 2);
    const a = x - 1, b = x + n;
    for (let c = a; c <= b; c++) { for (let row = Math.max(0, h - 7); row <= h - 5; row++) set(c, row, GROUND); set(c, h - 4, SPIKED); }
    coin((x + n / 2) * T, (h - 1.9) * T, 0.7);
    pit(n);
    flat(2);
  };
  // A corridor: spikes on the floor and spikes on the ceiling. Short hops only.
  const segCorridor = () => {
    flat(2);
    const n = r.int(5, 7);
    const x0 = x;
    flat(n);
    for (let i = -1; i <= n; i++) { for (let row = Math.max(0, h - 7); row <= h - 5; row++) set(x0 + i, row, GROUND); set(x0 + i, h - 4, SPIKED); }
    let p = r.int(1, 2);
    while (p < n - 1) { set(x0 + p, h - 1, SPIKE); p += r.int(3, 4); }
    for (let c = x0 - 1; c <= x0 + n; c++) protect.add(c);
    flat(2);
  };
  // Stairs up made of single blocks, with spikes in the gaps.
  const segStairs = () => {
    const n = r.int(3, 4);
    for (let i = 0; i < n; i++) { pit(r.int(1, 2)); h = clampH(h - 1); flat(1); }
    flat(1);
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
  const segFalse = () => {
    flat(2);
    const n = r.int(2, Math.min(maxGap, 4));
    for (let i = 0; i < n; i++) falseCol(x + i, h);
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
    for (let i = 0; i < M; i++) { col(m0 + i, h); for (let row = u; row <= h - 4; row++) set(m0 + i, row, GROUND); protect.add(m0 + i); }
    for (let i = 0; i < TW; i++) {
      const c = trapAt + i;
      // false floors are filled all the way down so the trap looks like solid ground
      if (safe === 'high') { for (let row = h; row < H; row++) set(c, row, FALSE); }
      else { set(c, u, FALSE); set(c, u + 1, FALSE); set(c, u + 2, SPIKE); }
    }
    const lie = r.chance(0.5);
    const claim = lie ? (safe === 'high' ? 'low' : 'high') : safe;
    const pool = lie ? (claim === 'high' ? SIGNS.lieHigh : SIGNS.lieLow) : (claim === 'high' ? SIGNS.truthHigh : SIGNS.truthLow);
    L.signs.push({ x: signCol * T + T / 2, y: h * T, text: strip(r.pick(pool)), lie, fork: L.forks.length });
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
  // A floating chunk of ground that slides away from your first jump.
  const segRunaway = () => {
    flat(2);
    const a = r.int(2, 3);
    pit(a);
    L.plats.push({ x: x * T, y: h * T, w: 3 * T, kind: 'slide' });
    pit(3);
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
  // A lone spike on a long flat. It charges.
  const segLunge = () => {
    flat(3);
    const n = r.int(8, 10);
    const x0 = x;
    flat(n);
    L.lungers.push({ c: x0 + n - 2, row: h - 1 });
    for (let c = x0 - 1; c < x0 + n; c++) protect.add(c);
    flat(1);
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
    sign(5, r.chance(0.5) ? r.pick(SIGNS.lieFlavor) : `${NUM[Math.min(n, NUM.length - 1)]} trick${n > 1 ? 's' : ''} in this one...`);
  }
  const bodyStart = x;

  // ----- twist -----
  if (level >= 6) {
    const pool = ['ice', 'dark', 'floaty', 'fast', 'shaky'];
    if (tier >= 3) pool.push('mirror', 'dark');
    const p = rage ? 0.7 : [0, 0.4, 0.55, 0.65, 0.75][SL.tierOf(level)];
    if (r.chance(p)) L.twist = r.pick(pool);
  }

  // ----- body -----
  // Short and dense: more cheats means fewer filler segments, not a longer level.
  const targetW = level === 1 ? 46 : 54 + Math.round(Math.min(level, 40) * 0.6);
  const queue = [];
  const twice = cheats.length <= 2;
  const add = (fn, n) => { for (let i = 0; i < n; i++) queue.push(fn); };
  if (has('falseFloor')) add(segFalse, twice ? 2 : 1);
  if (has('pinholes')) add(segHoles, twice ? 2 : 1);
  if (has('rotten')) add(() => segPlats(r.int(4, 5)), twice ? 2 : 1);
  if (has('shouting')) add(segFork, 1);
  if (has('headache')) add(segGotcha, twice ? 2 : 1);
  if (has('secretFloor')) add(segBridge, 1);
  if (has('mimic')) add(segMimic, 1);
  if (has('ceilingTeeth')) add(segTeeth, 1);
  if (has('shyLedge')) add(segShy, twice ? 2 : 1);
  if (has('runaway')) add(segRunaway, twice ? 2 : 1);
  if (has('swapZone')) add(segSwirl, 1);
  if (has('lunger')) add(segLunge, twice ? 2 : 1);
  r.shuffle(queue);
  const fillers = level === 1 ? [segGap, segStep, segSpikes, segPillars, segCeil, segSaw] :
    tier === 0 ? [segGap, segStep, segSpikes, segPlats, segPillars, segCeil, segSaw, segStairs] :
    [segGap, segSpikes, segPlats, segPillars, segMover, segCeil, segSaw, segSaw, segStairs, segCorridor];
  // never the same filler twice in a row
  let lastFill = null;
  const filler = () => { let f; do { f = r.pick(fillers); } while (f === lastFill && fillers.length > 1); lastFill = f; f(); };
  let midPlaced = level === 1;
  while (queue.length || x < targetW) {
    const nf = x >= targetW ? 1 : r.int(1, 2);
    for (let i = 0; i < nf; i++) filler();
    if (!midPlaced && x > targetW / 2) { segCheckpoint(); midPlaced = true; }
    if (queue.length) queue.shift()();
  }
  if (!midPlaced) segCheckpoint();
  const bodyEnd = x;

  // ----- sprinkles: traps hidden in ordinary floor -----
  const holeP = has('pinholes') ? [0.05, 0.1, 0.14, 0.18, 0.22][tier] : 0;
  const crackP = has('headache') ? [0.3, 0.45, 0.55, 0.65, 0.75][tier] : 0;
  const falseP = has('falseFloor') ? [0.04, 0.07, 0.1, 0.13, 0.16][tier] : 0;
  const invisP = has('invisBlock') ? [0.35, 0.45, 0.55, 0.65, 0.75][tier] : 0;
  const lungeP = has('lunger') ? [0.3, 0.4, 0.5, 0.6, 0.7][tier] : 0;
  for (let c = bodyStart + 1; c < bodyEnd - 1; c++) {
    if (protect.has(c) || protect.has(c - 1) || protect.has(c + 1)) continue;
    for (let row = 4; row < H - 1; row++) {
      if (get(c, row) !== GROUND || get(c, row - 1) !== E) continue;
      const lft = get(c - 1, row) === GROUND && get(c - 1, row - 1) === E;
      const rgt = get(c + 1, row) === GROUND && get(c + 1, row - 1) === E;
      const edge = lft && get(c + 1, row) === E && get(c + 1, row - 1) === E;
      // gap width to the right of an edge
      let gw = 0; if (edge) { while (gw < 6 && !SL.isSolid(get(c + 1 + gw, row)) && !SL.isSolid(get(c + 1 + gw, row - 1)) && !SL.isSolid(get(c + 1 + gw, row + 1))) gw++; }
      const clearAbove = [c, c + 1, c + 2].every(k => get(k, row - 2) === E && get(k, row - 3) === E && get(k, row - 4) === E && get(k, row - 5) === E);
      if (lft && rgt && holeP && r.chance(holeP)) set(c, row, HOLE);
      else if (lft && rgt && falseP && get(c, row + 1) === GROUND && r.chance(falseP)) falseCol(c, row);
      else if (edge && invisP && gw >= 2 && gw <= (tier >= 2 ? 3 : 2) && clearAbove && r.chance(invisP)) { set(c + 1, row - 4, INVIS); L.invis.push({ c: c + 1, row: row - 4, gap: gw, edge: c }); protect.add(c); }
      else if (edge && crackP && r.chance(crackP)) set(c, row, CRACK);
      break;
    }
  }
  // lone spikes in spike segments can become lungers
  if (lungeP) {
    for (let c = bodyStart + 3; c < bodyEnd - 1; c++) {
      if (protect.has(c)) continue;
      for (let row = 4; row < H - 1; row++) {
        if (get(c, row) !== SPIKE || get(c - 1, row) === SPIKE || get(c + 1, row) === SPIKE) continue;
        if (get(c, row + 1) !== GROUND) break;
        let run = 0; while (run < 4 && get(c - 1 - run, row + 1) === GROUND && get(c - 1 - run, row) === E) run++;
        if (run >= 4 && r.chance(lungeP)) { set(c, row, E); L.lungers.push({ c, row }); }
        break;
      }
    }
  }
  // Rotten platforms: a random set, never two in a row, so a hop-off is always possible
  if (has('rotten')) {
    let prev = false;
    for (const pl of L.plats) {
      if (pl.kind !== 'static') { prev = false; continue; }
      pl.rotten = !prev && r.chance([0.35, 0.4, 0.45, 0.5, 0.55][tier]);
      prev = pl.rotten;
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
  const reach = L.gt >= 3 ? 6 : 5; // 5-tile gaps only from tier 3, and they need an edge jump
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

SL.buildLevel = function (runSeed, level, cheats, diff) {
  for (let salt = 0; salt < 80; salt++) {
    const L = buildOnce(runSeed, level, cheats, salt, diff);
    if (SL.validate(L)) { L.salt = salt; return L; }
  }
  throw new Error('no valid level for ' + runSeed + ' #' + level);
};

})(typeof window !== 'undefined' ? window : globalThis);
