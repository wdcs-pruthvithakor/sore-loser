// Core: constants, seeded RNG, cheat definitions, the level generator and the route validator.
// No DOM. Runs in the browser and in node (tools/check.js).
(function (G) {
'use strict';
const SL = G.SL = G.SL || {};

const T = 32, H = 15;
SL.TILE = T; SL.ROWS = H; SL.VIEW_W = 864; SL.VIEW_H = H * T;

// Tile codes.
// BELT_L / BELT_R are conveyor floors that carry you left or right while you stand on them.
const E = 0, GROUND = 1, SPIKE = 2, FALSE = 3, BRIDGE = 4, HOLE = 5, CRACK = 6, PAPER = 7, SEAM = 8, SWIRL = 9, SPIKED = 10, INVIS = 11, CRUMBLE = 12, BELT_L = 13, BELT_R = 14;
SL.TC = { E, GROUND, SPIKE, FALSE, BRIDGE, HOLE, CRACK, PAPER, SEAM, SWIRL, SPIKED, INVIS, CRUMBLE, BELT_L, BELT_R };
SL.isSolid = c => c === GROUND || c === BRIDGE || c === HOLE || c === CRACK || c === SEAM || c === SWIRL || c === CRUMBLE || c === BELT_L || c === BELT_R;
SL.looksSolid = c => c === GROUND || c === FALSE || c === HOLE || c === CRACK || c === SEAM || c === SWIRL || c === CRUMBLE || c === BELT_L || c === BELT_R;
SL.BELT_SPEED = 110;

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
// Boss levels: every 25th level is a run that ends in an arena fight. Level 100 is the final one.
// Each phase adds an attack (1 teeth + saws, 2 fists, 3 rising floor, 4 blackouts, 5 your own shadow); hp is plugs per phase.
SL.BOSSES = {
  25: { phases: 2, perPhase: 3, speed: 1, name: 'The Game (Preview Build)' },
  50: { phases: 3, perPhase: 3, speed: 1.05, name: 'The Game (Beta)' },
  75: { phases: 4, perPhase: 3, speed: 1.1, name: 'The Game (Release Candidate)' },
  100: { phases: 5, perPhase: 3, speed: 1.18, name: 'The Game', final: true }
};
SL.BOSS_LIVES = 3;
SL.isBossLevel = lv => !!SL.BOSSES[lv];
// Chasers and the fleeing exit make no sense in an arena.
SL.BOSS_BAN = ['coldFeet', 'spikeWall', 'copycat', 'peekaboo'];
// New traps arrive late in a run (and from level 5 on New Game+), so there is always something new.
SL.TRAPS = {
  lasers: { level: 55, name: 'Laser Gates', say: 'New toy: laser gates. They blink. You do not.' },
  belts: { level: 65, name: 'Conveyor Belts', say: 'Conveyor belts. The floor walks for you now. Badly.' },
  blades: { level: 75, name: 'Swinging Blades', say: 'I hung some blades. They swing on a beat. Learn it.' }
};
SL.trapsFor = (level, ng) => Object.keys(SL.TRAPS).filter(k => (ng ? level + 50 : level) >= SL.TRAPS[k].level && level > 1);
SL.cheatCount = (lv, r, diff) => {
  const t = SL.tierOf(lv);
  const extra = (SL.DIFFS[diff] || SL.DIFFS.normal).extra;
  if (lv === 1) return 1 + Math.min(1, extra);
  return extra + (t === 0 ? 2 : t === 1 ? (r.chance(0.5) ? 3 : 2) : t === 2 ? 3 : t === 3 ? (r.chance(0.5) ? 4 : 3) : (r.chance(0.5) ? 5 : 4));
};
// Pairs that would make a level unfair together.
SL.CLASH = { copycat: ['backwardsFlag', 'peekaboo'], backwardsFlag: ['copycat', 'spikeWall'], spikeWall: ['backwardsFlag', 'peekaboo'], peekaboo: ['copycat', 'spikeWall'] };
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
  },
  // The late cheats: they only show up from their level on, so the deep end always has something new.
  peekaboo: {
    name: 'Peekaboo',
    minLevel: 90,
    symptom: 'Something grabbed you from behind.',
    rule: 'Once you leave the start, a ghost drifts after you, but only while your back is turned. Face it and it freezes. On Rage you only see it while you look at it.',
    crack: 'Freeze the ghost up close, then finish the level.'
  },
  lagZone: {
    name: 'Lag Spike',
    minLevel: 95,
    symptom: 'You pressed jump. You jumped late.',
    rule: 'Inside the static, every key arrives a quarter-second late. Press early, about two tiles before you mean it. On Rage the static is invisible.',
    crack: 'After lag gets you, clear a gap from inside the static.'
  }
};
SL.CHEAT_IDS = Object.keys(SL.CHEATS);
SL.INTRO_ORDER = ['coldFeet', 'falseFloor', 'rotten', 'pinholes', 'mimic', 'invisBlock', 'shouting', 'ceilingTeeth', 'runaway', 'headache',
  'lunger', 'shyLedge', 'secretFloor', 'swapZone', 'impatient', 'backwardsFlag', 'copycat', 'spikeWall', 'peekaboo', 'lagZone'];

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
function buildOnce(runSeed, level, cheats, salt, diff, opts) {
  diff = SL.DIFFS[diff] ? diff : 'normal';
  opts = opts || {};
  const ng = opts.ng || 0;
  const seed = hashStr(runSeed + ':' + diff + ':' + level + ':' + salt + (ng ? ':ng' + ng : ''));
  const r = rng(seed);
  const tier = Math.min(4, SL.tierOf(level) + SL.DIFFS[diff].bump + Math.min(2, ng));  // how mean the layout is
  const rage = diff === 'rage';
  const has = id => cheats.indexOf(id) >= 0;
  const MAXW = 560;
  const g = new Uint8Array(MAXW * H);
  const L = {
    level, seed, diff, tier: SL.tierOf(level), gt: tier, cheats: cheats.slice(), plats: [], signs: [], forks: [], saws: [], mimics: [],
    tunnels: [], lungers: [], invis: [], coins: [], crushers: [], waves: [], carpets: [], bridges: [], gotchas: [], checkpoints: [], doorSpots: [], hops: 0, start: null, twist: null,
    lasers: [], blades: [], lags: [], trapKinds: [], ng, remix: SL.remixFor(ng)
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
  // Floaty gravity makes even a quick tap rise ~90px, the exact clearance under a normal slab,
  // so hang spike ceilings one tile higher there. A full jump still hits them.
  const ceilLift = () => L.twist === 'floaty' ? 1 : 0;
  // A slab of hanging spikes over a gap: only a short hop gets under it.
  let ceilTaught = (SL.tierOf(level) > 0 || diff !== 'normal') ? 9 : 0;
  const segCeil = () => {
    flat(2);
    if (ceilTaught < 1) { ceilTaught++; sign(x - 2, 'tap jump and let go fast for a tiny hop...'); }
    const n = r.int(2, tier >= 1 ? 3 : 2);
    const a = x - 1, b = x + n;
    const up = ceilLift(); for (let c = a; c <= b; c++) { for (let row = Math.max(0, h - 7 - up); row <= h - 5 - up; row++) set(c, row, GROUND); set(c, h - 4 - up, SPIKED); }
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
    const up = ceilLift(); for (let i = -1; i <= n; i++) { for (let row = Math.max(0, h - 7 - up); row <= h - 5 - up; row++) set(x0 + i, row, GROUND); set(x0 + i, h - 4 - up, SPIKED); }
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

  // ----- mode-only segments: Hard (and Normal NG+1) gets crushers and saw gauntlets,
  // Rage (and NG+2) also gets rising spike floors and crumbling bridges -----
  const evil = SL.DIFFS[diff].bump + ng;
  const segCrusher = () => {
    flat(2);
    const n = r.int(2, 3), x0 = x;
    flat(n * 3 + 1);
    for (let c = x0 - 1; c <= x0 + n * 3 + 1; c++) for (let row = Math.max(0, h - 7); row <= h - 5; row++) set(c, row, GROUND);
    for (let i = 0; i < n; i++) {
      L.crushers.push({ x: (x0 + 1 + i * 3) * T, w: 2 * T, top: (h - 4) * T, floor: h * T, period: [2.4, 2.2, 2, 1.8, 1.7][tier], phase: i * 0.55 + r() * 0.2 });
    }
    for (let c = x0 - 1; c <= x0 + n * 3 + 1; c++) protect.add(c);
    flat(2);
  };
  const segGauntlet = () => {
    flat(1);
    const n = r.int(9, 11), x0 = x;
    flat(n);
    const k = tier >= 3 ? 3 : 2, seg = (n - 1) / k;
    for (let i = 0; i < k; i++) {
      const a = (x0 + 0.5 + i * seg) * T, b = (x0 + 0.5 + (i + 1) * seg) * T;
      L.saws.push({ x0: a, y0: h * T - 13, x1: b, y1: h * T - 13, omega: sawSpeed * Math.PI * 2 / 1.5, phase: i * Math.PI * 0.7 });
    }
    for (let c = x0; c < x0 + n; c++) protect.add(c);
    flat(1);
  };
  const segWaves = () => {
    flat(2);
    const n = r.int(6, 7), x0 = x; // short enough to sprint across in one down phase
    flat(n);
    L.waves.push({ c0: x0, c1: x0 + n, row: h - 1, up: tier >= 4 ? 0.55 : 0.5, down: 1.2, phase: r() * 1.6 });
    for (let c = x0 - 1; c <= x0 + n; c++) protect.add(c);
    flat(2);
  };
  const segCrumble = () => {
    flat(2);
    const n = r.int(8, 11);
    for (let i = 0; i < n; i++) { set(x + i, h, CRUMBLE); set(x + i, H - 1, SPIKE); }
    for (let c = x; c < x + n; c++) protect.add(c);
    x += n;
    flat(2);
  };

  // ----- late traps: every mode, unlocked by level (SL.TRAPS) -----
  const trapOn = k => { if (L.trapKinds.indexOf(k) < 0) L.trapKinds.push(k); };
  // Laser gates: a beam from a ceiling emitter to the floor, too tall to jump, blinking on a shared beat.
  const segLasers = () => {
    trapOn('lasers');
    flat(2);
    const n = r.int(2, tier >= 3 ? 3 : 2), gap = 3, x0 = x, len = n * gap + 1;
    flat(len);
    const period = [2.6, 2.5, 2.4, 2.3, 2.2][tier];
    for (let i = 0; i < n; i++) {
      const c = x0 + 1 + i * gap;
      for (let row = Math.max(0, h - 7); row <= h - 5; row++) set(c, row, GROUND);
      L.lasers.push({ x: c * T + T / 2, top: (h - 4) * T, bottom: h * T, period, on: 0.9, phase: i * 0.45 + r() * 0.15 });
    }
    coin((x0 + len / 2) * T, (h - 1.5) * T, 0.5);
    for (let c = x0 - 1; c <= x0 + len; c++) protect.add(c);
    flat(2);
  };
  // Conveyor belts: one carries you on into spikes, the next drags you back toward them.
  const segBelts = () => {
    trapOn('belts');
    flat(2);
    const x0 = x, a = r.int(4, 6), sp = r.int(2, 3), b = r.int(4, 5);
    for (let i = 0; i < a; i++) col(x + i, h, BELT_R);
    x += a;
    coin((x + sp / 2) * T, (h - 3) * T, 0.5);
    for (let i = 0; i < sp; i++) { col(x + i, h); set(x + i, h - 1, SPIKE); }
    x += sp;
    for (let i = 0; i < b; i++) col(x + i, h, BELT_L);
    x += b;
    pit(r.int(2, Math.min(3, maxGap)));
    for (let c = x0 - 1; c <= x; c++) protect.add(c);
    flat(2);
  };
  // Swinging blades: a blade on a chain sweeps low across the walkway on a steady beat.
  const segBlades = () => {
    trapOn('blades');
    flat(2);
    const k = r.int(1, tier >= 3 ? 2 : 1) + (level >= 85 ? 1 : 0), x0 = x, len = k * 7 + 2;
    flat(len);
    const period = r.pick([2.2, 2.4, 2.6]);
    for (let i = 0; i < k; i++) {
      const c = x0 + 4 + i * 7;
      for (let row = Math.max(0, h - 8); row <= h - 7; row++) set(c, row, GROUND);
      L.blades.push({ ax: c * T + T / 2, ay: (h - 6) * T, len: 5.3 * T, amp: 0.9, omega: Math.PI * 2 / period, phase: i * Math.PI + r() * 0.6 });
    }
    for (let c = x0 - 1; c <= x0 + len; c++) protect.add(c);
    flat(2);
  };
  const TRAP_SEG = { lasers: segLasers, belts: segBelts, blades: segBlades };

  // ----- cheat segments -----
  // Lag Spike: a stretch of static over a run of gaps. Every key arrives late inside it.
  const segLag = () => {
    flat(2);
    const x0 = x;
    flat(2);
    const k = r.int(2, tier >= 2 ? 3 : 2);
    for (let i = 0; i < k; i++) { pit(r.int(2, Math.min(3, maxGap))); h = clampH(h + r.int(-1, 0)); flat(r.int(3, 4)); }
    L.lags.push({ x0: x0 * T, x1: x * T });
    for (let c = x0 - 1; c <= x; c++) protect.add(c);
    flat(2);
  };
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
    // the way across is to jump from the tile before the crack, so the gap is one shorter than it looks
    const n = r.int(2, Math.min(3, maxGap));
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
    // remixed (New Game+): "..." lies and "!" tells the truth, so the pools swap
    const shout = !L.remix.shouting === lie;
    const pool = shout ? (claim === 'high' ? SIGNS.lieHigh : SIGNS.lieLow) : (claim === 'high' ? SIGNS.truthHigh : SIGNS.truthLow);
    L.signs.push({ x: signCol * T + T / 2, y: h * T, text: strip(r.pick(pool)), lie, fork: L.forks.length });
    L.forks.push({ trapX0: trapAt * T, trapX1: (trapAt + TW) * T, ceilY: (h - 4) * T, safe, claim, lie, x0: m0 * T });
    x = m0 + M;
    flat(2);
  };
  // A checkpoint is a camp: a flat stone pad with a lantern, placed right after a challenge at an even step
  // through the level. n of `of` drives the little banner; an honest one (the boss door) ignores Backwards Flag.
  const segCheckpoint = (n, of, honest) => {
    flat(2);
    L.checkpoints.push({ x: (x + 2) * T + T / 2, y: h * T, n, of, honest: !!honest });
    for (let c = x - 2; c < x + 7; c++) protect.add(c);
    flat(6);
  };
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
  const boss = SL.BOSSES[level] || null;
  if (boss) L.twist = null; // the arena is hard enough with the lights on
  if (opts.twist !== undefined) L.twist = opts.twist; // test harness only

  // ----- body -----
  // Levels keep growing the whole way to 99. Longer ones are cut into sections by checkpoint camps,
  // so each stretch stays a bite-sized challenge. A boss level is a shorter run that ends in the arena.
  const baseW = level === 1 ? 46 : 54 + Math.round(Math.min(level, 40) * 0.6) + Math.round(Math.max(0, level - 40) * 0.45);
  const targetW = boss ? Math.round(baseW * 0.7) : baseW;
  const sections = level === 1 ? 1 : boss ? 2 : baseW < 75 ? 2 : baseW < 98 ? 3 : 4;
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
  if (has('lagZone')) add(segLag, twice ? 2 : 1);
  // the newest trap you have unlocked always shows up; older ones join the filler pool
  const traps = SL.trapsFor(level, ng);
  if (traps.length) add(TRAP_SEG[traps[traps.length - 1]], 1);
  r.shuffle(queue);
  const fillers = level === 1 ? [segGap, segStep, segSpikes, segPillars, segCeil, segSaw] :
    tier === 0 ? [segGap, segStep, segSpikes, segPlats, segPillars, segCeil, segSaw, segStairs] :
    [segGap, segSpikes, segPlats, segPillars, segMover, segCeil, segSaw, segSaw, segStairs, segCorridor];
  if (level > 1 && evil >= 1) fillers.push(segCrusher, segGauntlet);
  if (level > 1 && evil >= 2) fillers.push(segWaves, segCrumble, segCrusher);
  for (const k of traps) fillers.push(TRAP_SEG[k]);
  const hardFill = [segGap, segSaw, segSpikes].concat(traps.map(k => TRAP_SEG[k]));
  // never the same filler twice in a row
  let lastFill = null;
  const filler = () => { let f; do { f = r.pick(fillers); } while (f === lastFill && fillers.length > 1); lastFill = f; f(); };
  // Camps sit at even steps through the level, and each one is earned: a short challenge comes first.
  // The plan: cheat segments and camps take about 16 tiles each; fillers top the level up to its target length.
  let nextCp = 1;
  const cost = () => x + (queue.length + sections - nextCp) * 16;
  const planned = Math.max(targetW, cost());
  const campDue = () => nextCp < sections && x > bodyStart + (planned - bodyStart) * nextCp / sections - 3;
  const camp = () => { r.pick(hardFill)(); segCheckpoint(nextCp, sections - 1 + (boss ? 1 : 0)); nextCp++; };
  while (queue.length || x < targetW) {
    const nf = cost() >= targetW ? (queue.length ? 0 : 1) : r.int(1, 2);
    for (let i = 0; i < nf && !campDue(); i++) filler();
    if (campDue()) camp();
    if (queue.length) queue.shift()();
    if (campDue()) camp();
  }
  while (nextCp < sections) camp();
  const bodyEnd = x;

  // ----- sprinkles: traps hidden in ordinary floor -----
  const holeP = has('pinholes') ? [0.05, 0.1, 0.14, 0.18, 0.22][tier] : 0;
  const crackP = has('headache') ? [0.3, 0.45, 0.55, 0.65, 0.75][tier] : 0;
  const falseP = has('falseFloor') ? [0.04, 0.07, 0.1, 0.13, 0.16][tier] : 0;
  const invisP = has('invisBlock') ? [0.35, 0.45, 0.55, 0.65, 0.75][tier] : 0;
  const lungeP = has('lunger') ? [0.3, 0.4, 0.5, 0.6, 0.7][tier] : 0;
  const spikedOver = (c0, c1, row) => { for (let c = c0; c <= c1; c++) for (let rr = Math.max(0, row - 7); rr < row; rr++) if (get(c, rr) === SPIKED) return true; return false; };
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
      // a crack forces the jump to start a tile early: only on gaps that still leave room for that,
      // and never under a spike ceiling, where only a short hop from the very edge fits
      else if (edge && crackP && gw <= 3 && !spikedOver(c - 1, c + gw + 1, row) && r.chance(crackP)) set(c, row, CRACK);
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

  if (boss) { buildArena(); finish(); return L; }

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
  finish();
  return L;

  // ----- the boss arena: a camp at the door, then a walled room with pillars, ledges and plug spots -----
  function buildArena() {
    while (h !== 11) { h += h < 11 ? 1 : -1; flat(2); }
    segCheckpoint(sections, sections, true);
    sign(x - 3, level === 100 ? 'the Game is through here...' : 'something big is through here...');
    const a0 = x, AW = 46;
    for (let c = a0; c < a0 + AW; c++) col(c, 11);
    col(a0 + AW, 0); col(a0 + AW + 1, 0);
    const pillars = [[6, 9], [14, 8], [23, 8], [32, 8], [40, 9]];
    for (const [dc, top] of pillars) { col(a0 + dc, top); col(a0 + dc + 1, top); }
    const ledges = [[10, 6], [26, 6], [36, 6]];
    for (const [dc, row] of ledges) L.plats.push({ x: (a0 + dc) * T, y: row * T, w: 2 * T, kind: 'static' });
    // plugs come out one at a time, from these spots
    L.plugSpots = [[3, 11], [7, 9], [11, 6], [15, 8], [19, 11], [24, 8], [27, 6], [33, 8], [37, 6], [41, 9], [AW - 3, 11]]
      .map(([dc, row]) => ({ x: (a0 + dc) * T, y: row * T }));
    // phase 3: the floor between the pillars takes turns growing spikes
    const strips = [[1, 6], [8, 14], [16, 23], [25, 32], [34, 40], [42, AW]];
    strips.forEach(([c0, c1], i) => L.waves.push({ c0: a0 + c0, c1: a0 + c1, row: 10, up: 1.0, down: 1.5, phase: (i % 2) * 1.25, bossPhase: 3 }));
    L.arena = { x0: a0 * T, x1: (a0 + AW) * T, floor: 11 * T };
    L.boss = Object.assign({ x: (a0 + AW / 2) * T, y: 2.6 * T, level }, boss);
    // for the validator: the arena and every plug spot must be reachable
    L.doorSpots = [{ x: (a0 + 3) * T + T / 2, y: 11 * T }].concat(L.plugSpots.map(sp => ({ x: sp.x + 4, y: sp.y })));
    L.hops = 0;
    x = a0 + AW + 2;
  }
  // signs, pacts and packing the tiles, shared by normal and boss levels
  function finish() {
    // remixed signs: every other sign swaps its ending, so "!" is now the honest one
    if (L.remix.shouting) for (const sg of L.signs) if (sg.fork === undefined) sg.text = sg.text.replace(/!$/, '\u0000').replace(/\.\.\.$/, '!').replace(/\u0000$/, '...');
    // pacts (No Safety Net keeps only the boss door camp)
    if (opts.pacts && opts.pacts.noflag) L.checkpoints = L.checkpoints.filter(cp => cp.honest);
    if (opts.pacts && opts.pacts.dark) L.twist = 'dark';

    // compact
    L.w = x;
    L.tiles = new Uint8Array(L.w * H);
    for (let row = 0; row < H; row++) for (let c = 0; c < L.w; c++) L.tiles[row * L.w + c] = g[row * MAXW + c];
  }
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

// New Game+ rewrites some rules. NG+1 flips two cheats, NG+2 two more.
SL.remixFor = ng => ({ coldFeet: ng >= 1, shouting: ng >= 1, mimic: ng >= 2, backwardsFlag: ng >= 2 });
SL.REMIX_RULES = {
  coldFeet: 'REMIXED: the exit now flees while you are in the AIR. Walk right into it.',
  shouting: 'REMIXED: signs ending with "..." lie now, and signs that shout "!" tell the truth.',
  mimic: 'REMIXED: the real exit\'s handle is on the LEFT now. A handle on the right is a mouth.',
  backwardsFlag: 'REMIXED: the checkpoint only saves if you touch it in mid-air.'
};

SL.buildLevel = function (runSeed, level, cheats, diff, opts) {
  for (let salt = 0; salt < 80; salt++) {
    const L = buildOnce(runSeed, level, cheats, salt, diff, opts);
    if (SL.validate(L)) { L.salt = salt; return L; }
  }
  throw new Error('no valid level for ' + runSeed + ' #' + level);
};

})(typeof window !== 'undefined' ? window : globalThis);
