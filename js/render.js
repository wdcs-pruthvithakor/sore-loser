// Canvas renderer: a cute pastel platformer on top, a glitching cheater underneath.
(function (G) {
'use strict';
const SL = G.SL;
const T = SL.TILE, H = SL.ROWS, TC = SL.TC, VH = SL.VIEW_H;
// View width in world pixels. Phones held upright get a narrower, zoomed-in view.
let VW = SL.VIEW_W;

// One palette per tier: bright morning to glitchy night.
const PAL = [
  { skyA: '#8ed0ff', skyB: '#fff1f7', far: '#bfe7d2', near: '#93d6ad', grass: '#6dd08b', grassD: '#3fa968', dirt: '#e2a96f', dirtD: '#b8793f', dot: '#c88d55', sun: '#fff4b8', cloud: '#ffffff', plat: '#ff9cc0', platD: '#d8709a', ink: '#3b2a40', body: '#ffcb3d', door: '#9d74ff', doorD: '#6b47cf' },
  { skyA: '#ffbf86', skyB: '#fff0dc', far: '#e8cfa0', near: '#c5c37e', grass: '#8cc96b', grassD: '#5e9d48', dirt: '#d89a63', dirtD: '#a96c37', dot: '#bf8550', sun: '#fff0a0', cloud: '#fff8ef', plat: '#ff9c8a', platD: '#d26f60', ink: '#3b2a40', body: '#ffcb3d', door: '#9d74ff', doorD: '#6b47cf' },
  { skyA: '#ff7f97', skyB: '#ffd29e', far: '#d98ea2', near: '#b0708c', grass: '#77b57a', grassD: '#4c8657', dirt: '#b97a5b', dirtD: '#8a5238', dot: '#a3684b', sun: '#ffe08a', cloud: '#ffe1e1', plat: '#ffb36b', platD: '#cc7f3c', ink: '#3b2a40', body: '#ffcb3d', door: '#9d74ff', doorD: '#6b47cf' },
  { skyA: '#4e3f86', skyB: '#d58aa5', far: '#7c5a96', near: '#5a3f78', grass: '#58a08a', grassD: '#376e60', dirt: '#7a5468', dirtD: '#55374b', dot: '#6a475a', sun: '#ffd9ee', cloud: '#d9b7e0', plat: '#c66cf0', platD: '#8f43b8', ink: '#22172b', body: '#ffcb3d', door: '#ff6fa8', doorD: '#c23f78' },
  { skyA: '#0d0b22', skyB: '#3a1a4f', far: '#2a1d47', near: '#1d1535', grass: '#4df0b8', grassD: '#22a07a', dirt: '#3b2350', dirtD: '#24133a', dot: '#4a2d63', sun: '#e9e4ff', cloud: '#5a3c7a', plat: '#ff4fa3', platD: '#b02a70', ink: '#0c0716', body: '#ffcb3d', door: '#ff4f6e', doorD: '#b22a46' }
];
SL.PAL = PAL;

// ---------- themes ----------
// Each theme is a daytime palette and a night palette; levels blend toward night as tiers rise.
// Normal, Hard and Rage each start in their own world, and every New Game+ moves that mode somewhere new.
const keys = ['skyA', 'skyB', 'far', 'near', 'grass', 'grassD', 'dirt', 'dirtD', 'dot', 'sun', 'cloud', 'plat', 'platD', 'ink', 'door', 'doorD'];
const mk = a => { const o = { body: '#ffcb3d' }; keys.forEach((k, i) => { o[k] = a[i]; }); return o; };
SL.THEMES = {
  meadow: { name: 'The Meadow', ambient: null, tiers: PAL },
  canyon: { name: 'Sunburnt Canyon', ambient: 'dust',
    day: mk(['#ffb38a', '#ffe8c8', '#e8a27a', '#cc7a52', '#d9a441', '#a8762a', '#c8643c', '#94401f', '#a8502c', '#fff2b0', '#fff4e6', '#7ec8c0', '#4c9a92', '#3b2a40', '#3fb5a8', '#23857a']),
    night: mk(['#2a1638', '#a0485a', '#5a2a40', '#3e1c30', '#c27a3a', '#8a4f22', '#6a2c2c', '#45181c', '#5a2224', '#ffd6c0', '#7a3a52', '#4fd1c5', '#2a8a80', '#1a0f20', '#4fd1c5', '#2a8a80']) },
  inferno: { name: 'The Inferno', ambient: 'embers',
    day: mk(['#3a0a12', '#c2401c', '#5a1418', '#3a0c10', '#ff7a1a', '#c43c0a', '#2a1a1e', '#160c10', '#3c2228', '#ffcf70', '#5a1e1e', '#ffb020', '#c0700a', '#120608', '#ff4f3a', '#a82418']),
    night: mk(['#0a0204', '#5a0a0a', '#240608', '#160406', '#ff3a10', '#a01808', '#150a0c', '#080304', '#24100f', '#ff8a5a', '#2a0808', '#ff7a1a', '#a8400a', '#050102', '#ff2a2a', '#901010']) },
  candy: { name: 'Candy Land', ambient: 'sprinkles',
    day: mk(['#ffc4e8', '#e4f6ff', '#c8b4ff', '#ffa8d4', '#9ff2e0', '#5cc8b4', '#ffd4a8', '#e8a07a', '#ff8fc0', '#fff8c8', '#ffffff', '#8ed0ff', '#5a9ce0', '#4a2a5a', '#ff6fb0', '#c43f80']),
    night: mk(['#2e1a5a', '#c86aa8', '#5a3a8a', '#7a3a7a', '#6fe8d0', '#30a894', '#a86a8a', '#704060', '#ff8fc0', '#ffe4f4', '#8a5aa8', '#ff8fc0', '#c0508a', '#1e0e2e', '#ffd84d', '#c49a1c']) },
  frost: { name: 'Frostbite Peaks', ambient: 'snow',
    day: mk(['#a8d8ff', '#f0f8ff', '#c8e0f0', '#a0c4dc', '#f4fbff', '#b8d8ec', '#7a9ab8', '#4f6c8a', '#6a88a8', '#ffffff', '#ffffff', '#c9f1ff', '#7ab8d8', '#23314a', '#5aa0ff', '#2f6ac0']),
    night: mk(['#0a1430', '#3a5a8a', '#1e2e50', '#142240', '#d8ecff', '#7a9cc0', '#2a3a5a', '#18243c', '#34486c', '#e4f0ff', '#3a4e78', '#8ed0ff', '#3a7ab0', '#060a18', '#8ed0ff', '#3a7ab0']) },
  deep: { name: 'The Deep', ambient: 'bubbles',
    day: mk(['#0e8aa0', '#7ee0d8', '#1a9a9a', '#147a80', '#ff8f7a', '#d0584a', '#e8d4a0', '#b89c64', '#c8a870', '#d8fff8', '#a8f0e8', '#ffb04a', '#c87a1a', '#0e2a36', '#ffcb3d', '#c4921a']),
    night: mk(['#02101c', '#0a4a5a', '#06303a', '#04222c', '#ff5a8a', '#b02a5a', '#3a3a4a', '#20202c', '#4a4a5c', '#7ef0ff', '#0a3a48', '#4df0b8', '#1a9a70', '#000a10', '#4df0b8', '#1a9a70']) },
  synth: { name: 'Synthwave', ambient: 'grid',
    day: mk(['#1a0a3a', '#ff5ab0', '#5a1a7a', '#2a0a4a', '#4df0ff', '#1a90c0', '#20103a', '#100620', '#3a1a5a', '#ffd84d', '#7a2a9a', '#ff4fd8', '#a01a90', '#08020f', '#4df0ff', '#1a90c0']),
    night: mk(['#05010d', '#5a0a6a', '#2a0a40', '#140420', '#ff4fd8', '#a01a90', '#10061e', '#06020c', '#2a0e40', '#ff9ad8', '#3a0a50', '#4df0ff', '#1a90c0', '#020005', '#ff4fd8', '#a01a90']) }
};
SL.THEMES.graveyard = { name: 'Dead Hollow', ambient: 'fog',
  day: mk(['#5a6a6a', '#a8b4a8', '#4a5a54', '#36443e', '#7a8a5a', '#4e5c3a', '#4a4440', '#2e2a28', '#3c3632', '#e8eedc', '#8a9690', '#a49dba', '#6e6788', '#151815', '#8fbf7a', '#557a48']),
  night: mk(['#0c1210', '#34443c', '#1c2622', '#121a16', '#4e6a3a', '#2c3e22', '#221e1c', '#121010', '#1e1a18', '#c8f0c0', '#2a3630', '#7a7090', '#4a4466', '#050605', '#7aff9a', '#2f8a4a']) };
SL.THEMES.hive = { name: 'The Hive', ambient: 'drip',
  day: mk(['#3a0a1a', '#a8304a', '#5a1428', '#3e0c1c', '#e0506a', '#a02a44', '#5a1a28', '#3a0e18', '#7a2436', '#ffd0c0', '#6a1e30', '#ffb0a0', '#c86a64', '#140408', '#ffd84d', '#c49a1c']),
  night: mk(['#0e0206', '#4a0a18', '#24060e', '#160308', '#c02040', '#700a20', '#2a0810', '#160406', '#40101c', '#ff8a8a', '#30081a', '#ff6a7a', '#a02a3a', '#060102', '#ffd84d', '#a07a10']) };
SL.THEMES.void = { name: 'The Void', ambient: 'static',
  day: mk(['#08080c', '#24202e', '#14121a', '#0c0a10', '#e8e8f0', '#9a98a8', '#16141c', '#0a090e', '#22202a', '#ff2a3a', '#1c1a24', '#ff2a3a', '#901020', '#000000', '#ff2a3a', '#901020']),
  night: mk(['#000000', '#120a12', '#08060a', '#040306', '#ff2a3a', '#901020', '#0c0a10', '#050407', '#16121a', '#ff0018', '#100c14', '#ffffff', '#8a8a96', '#000000', '#ffffff', '#8a8a96']) };
// ---- worlds only Hard and Rage visit ----
SL.THEMES.swamp = { name: 'Rotmire Swamp', ambient: 'fog',
  day: mk(['#4a5a3a', '#9aa86a', '#3e4e2e', '#2e3c22', '#7a9a3a', '#4e6a22', '#3a3424', '#241f14', '#4a4028', '#e4f0a0', '#7a8a5a', '#c8a04a', '#8a6a24', '#121808', '#b8e04a', '#6a8a1a']),
  night: mk(['#0a1006', '#2a3a1a', '#16200e', '#0e1608', '#4e7a1a', '#2a4a0a', '#1a1810', '#0c0a06', '#24200e', '#c8ff6a', '#1e2a12', '#a07a2a', '#5a4010', '#030502', '#9aff3a', '#3a8a0a']) };
SL.THEMES.rust = { name: 'The Rust Works', ambient: 'embers',
  day: mk(['#6a4a3a', '#c8946a', '#5a3e30', '#3e2a22', '#a86a3a', '#6e3e1a', '#4a3e3a', '#2a2220', '#6a5048', '#ffd8a0', '#8a6a5a', '#8ab8c8', '#4a7a8a', '#160e0a', '#ffb020', '#b8700a']),
  night: mk(['#140a08', '#4a2a1e', '#24140e', '#160c08', '#c8501a', '#7a2a0a', '#221a18', '#100c0a', '#30241e', '#ffa060', '#2a1a14', '#5a9ab0', '#2a5a6a', '#050302', '#ff7a1a', '#a03a0a']) };
SL.THEMES.storm = { name: 'Stormbreak Cliffs', ambient: 'rain',
  day: mk(['#3a4a5e', '#8a9aae', '#324050', '#24303e', '#6a8a7a', '#3e5a4e', '#4a4e58', '#2a2e36', '#5a5e6a', '#e8f0ff', '#6a7a8e', '#e0c060', '#a08020', '#0c1018', '#ffe04a', '#c0a010']),
  night: mk(['#06080e', '#1e2a3e', '#10161e', '#0a0e14', '#3a5a4e', '#1e3a2e', '#1a1e26', '#0a0c10', '#24282e', '#b0c8ff', '#141c28', '#ffd040', '#a07a10', '#020306', '#ffe04a', '#a08a10']) };
SL.THEMES.cathedral = { name: 'Blood Cathedral', ambient: 'drip',
  day: mk(['#1a0610', '#6a1a2a', '#2a0a14', '#1a060c', '#d4a040', '#8a6418', '#2a1a1e', '#140a0e', '#3a2228', '#ffd27a', '#3a0e1a', '#d4a040', '#8a6418', '#080204', '#ff2a3a', '#8a0a18']),
  night: mk(['#050103', '#2a0610', '#120306', '#0a0204', '#a07820', '#5a400a', '#140c0e', '#080406', '#22121a', '#ff5a3a', '#1a050a', '#b08020', '#6a4a0a', '#020001', '#ff0a2a', '#700010']) };
SL.THEMES.bones = { name: 'The Ossuary', ambient: 'dust',
  day: mk(['#2a2622', '#7a6e62', '#3a342e', '#26221e', '#e8dcc8', '#a8987e', '#3e3832', '#22201c', '#cfc2aa', '#fff4e0', '#5a524a', '#e8dcc8', '#a8987e', '#0c0a08', '#ff3a2a', '#901a10']),
  night: mk(['#060504', '#2a2420', '#14110e', '#0a0806', '#c8b89c', '#7a6a52', '#1a1612', '#0a0806', '#9a8a70', '#ff4a3a', '#1e1a16', '#c8b89c', '#7a6a52', '#000000', '#ff1a1a', '#800808']) };

// Every mode has its own five worlds, never shared with another mode:
// Normal gets the cute ones, Hard the grim ones, Rage the evil ones. One step per New Game+.
SL.THEME_ROUTE = {
  normal: ['meadow', 'candy', 'frost', 'deep', 'synth'],
  hard: ['canyon', 'swamp', 'graveyard', 'rust', 'storm'],
  rage: ['inferno', 'void', 'hive', 'cathedral', 'bones']
};
// After all five, the route loops, but each loop is a twisted version: shifted colours and a darker name.
SL.LOOP_NAMES = ['', 'Corrupted', 'Fallen', 'Shattered', 'Forsaken', 'Hollow', 'Final'];
SL.themeFor = (diff, ng) => { const r = SL.THEME_ROUTE[diff] || SL.THEME_ROUTE.normal; return r[(ng || 0) % r.length]; };
SL.themeLoop = (diff, ng) => Math.floor((ng || 0) / (SL.THEME_ROUTE[diff] || SL.THEME_ROUTE.normal).length);
SL.themeName = function (diff, ng) {
  const base = SL.THEMES[SL.themeFor(diff, ng)].name.replace(/^The /, ''), loop = SL.themeLoop(diff, ng);
  if (!loop) return SL.THEMES[SL.themeFor(diff, ng)].name;
  const word = SL.LOOP_NAMES[Math.min(loop, SL.LOOP_NAMES.length - 1)];
  return `${word} ${base}${loop > SL.LOOP_NAMES.length - 1 ? ' ' + (loop - SL.LOOP_NAMES.length + 2) : ''}`;
};
// Menace: how evil the world looks. Hard starts mean, Rage starts nasty, and every New Game+ adds more. No cap.
SL.menaceFor = (diff, ng) => ({ normal: 0, hard: 2, rage: 4 }[diff] || 0) + (ng || 0) * 1.5;
const BLOOD = mk(['#12000a', '#5a0814', '#2a060e', '#1a0408', '#8a1422', '#5a0a16', '#2a1014', '#160608', '#3a1418', '#ff3040', '#3a0a12', '#000000', '#000000', '#000000', '#000000', '#000000']);
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map(sh => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
function hueShift(hex, deg) {
  let r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, sat = 0;
  if (mx !== mn) {
    const d = mx - mn; sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  h = (h + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * sat, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m0 = l - c / 2;
  const [rr, gg, bb] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [rr, gg, bb].map(v => Math.round((v + m0) * 255).toString(16).padStart(2, '0')).join('');
}
SL.paletteFor = function (themeId, tier, menace, loop) {
  const th = SL.THEMES[themeId] || SL.THEMES.meadow;
  let o;
  if (th.tiers) o = Object.assign({}, th.tiers[tier]);
  else { const t = Math.pow(tier / 4, 0.9); o = { body: '#ffcb3d' }; for (const k of keys) o[k] = mixHex(th.day[k], th.night[k], t); }
  // a looped world comes back twisted: its colours turned around the wheel
  if (loop) { const deg = [0, 150, 70, 220, 290, 110][loop % 6] + Math.floor(loop / 6) * 37; for (const k of ['skyA', 'skyB', 'far', 'near', 'grass', 'grassD', 'dirt', 'dirtD', 'dot', 'cloud', 'plat', 'platD']) o[k] = hueShift(o[k], deg); }
  // menace bleeds the world toward blood and dark (platforms, doors and outlines stay readable)
  const a = Math.min(0.32, (menace || 0) * 0.06);
  if (a > 0) for (const k of ['skyA', 'skyB', 'far', 'near', 'grass', 'grassD', 'dirt', 'dirtD', 'dot', 'sun', 'cloud']) o[k] = mixHex(o[k], BLOOD[k], a);
  return o;
};

function cellHash(c, r) { let h = (c * 374761393 + r * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

function Renderer(cv) {
  this.cv = cv; this.ctx = cv.getContext('2d');
  this.k = 1; this.cam = 0; this.time = 0;
  this.parts = []; this.shake = 0; this.glitch = 0;
  this.bubble = null;
}
SL.Renderer = Renderer;
const R = Renderer.prototype;

R.setViewW = function (w) { VW = w; this.viewW = w; };
R.viewW = SL.VIEW_W;
R.resize = function (cssW, cssH) {
  const dpr = Math.min(2, G.devicePixelRatio || 1);
  this.k = (cssW / VW) * dpr;
  this.cv.width = Math.round(VW * this.k);
  this.cv.height = Math.round(VH * this.k);
  this.cv.style.width = cssW + 'px';
  this.cv.style.height = cssH + 'px';
};

// How visible a tell is: by tier on Normal, always faint on Hard, gone on Rage.
R.tell = function (arr) {
  const L = this.w.L;
  if (this.w.lens) return Math.max.apply(null, arr) * 0.9; // Snitch Lens shows everything
  if (L.diff === 'rage') return 0;
  if (L.diff === 'hard') return arr[arr.length - 1] * 0.75;
  return arr[L.tier];
};

R.setWorld = function (w) {
  this.w = w; this.parts = [];
  const L = w.L;
  this.themeId = L.theme || SL.themeFor(L.diff, L.ng);
  this.theme = SL.THEMES[this.themeId];
  this.menace = L.menace !== undefined ? L.menace : SL.menaceFor(L.diff, L.ng);
  this.pal = SL.paletteFor(this.themeId, L.tier, this.menace, L.theme ? 0 : SL.themeLoop(L.diff, L.ng));
  const er = SL.rng(L.seed ^ 0x2c1b3c6d);
  this.eyes = [];
  for (let i = 0; i < Math.min(40, Math.floor(Math.max(0, this.menace - 2.5) * 5)); i++) this.eyes.push({ x: er() * 2400, y: 150 + er() * 200, s: 0.6 + er() * 0.8, ph: er() * 20, p: 0.12 + er() * 0.2 });
  this.amb = [];
  const r = SL.rng(L.seed ^ 0x5bd1e995);
  this.clouds = [];
  for (let i = 0; i < 9; i++) this.clouds.push({ x: r() * 1600, y: 30 + r() * 140, s: 0.6 + r() * 0.9, p: 0.08 + r() * 0.18 });
  this.hillSeed = r() * 100;
  this.cam = Math.max(0, Math.min(L.w * T - VW, w.p.x - VW * 0.35));
};

// ---------- particles ----------
R.burst = function (x, y, n, color, speed, life, kind) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = (0.3 + Math.random() * 0.7) * (speed || 200);
    this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: life || 0.6, max: life || 0.6, color, size: 3 + Math.random() * 4, kind: kind || 'dot', g: 600 });
  }
};
R.dust = function (x, y, n) {
  for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 90, vy: -Math.random() * 50, life: 0.35, max: 0.35, color: 'rgba(255,255,255,0.85)', size: 3 + Math.random() * 3, kind: 'dot', g: 100 });
};

R.event = function (e) {
  const pal = this.pal;
  switch (e.type) {
    case 'jump': this.dust(e.x, e.y, 4); break;
    case 'land': this.dust(e.x, e.y, 5); break;
    case 'death': this.deathFx(e); break;
    case 'coin': this.burst(e.x, e.y, 10, '#ffd84d', 150, 0.5, 'star'); this.parts.push({ x: e.x, y: e.y - 14, vx: 0, vy: -50, life: 0.8, max: 0.8, color: '#ffd84d', size: 14, kind: 'text', text: '+5', g: 0 }); break;
    case 'flee': this.glitch = 0.28; this.burst(e.x, e.y - 20, 10, '#ffffff', 160, 0.5, 'star'); break;
    case 'crumble': this.glitch = 0.18; break;
    case 'platFall': this.burst(e.x, e.y, 12, pal.platD, 160, 0.6); break;
    case 'bonk': this.shake = 0.2; this.burst(e.x, e.y, 8, '#ffffff', 180, 0.4, 'star'); break;
    case 'bonkDrop': this.glitch = 0.15; break;
    case 'pop': this.burst(e.x, e.y, 6, '#ffffff', 120, 0.3); break;
    case 'checkpoint': this.burst(this.w.L.checkpoint.x, this.w.L.checkpoint.y - 50, 14, '#7ee0a1', 160, 0.6, 'star'); if (!e.real) this.glitch = 0.12; break;
    case 'discover': this.burst(this.w.p.x + 10, this.w.p.y, 30, '#ffe066', 280, 1, 'star'); break;
    case 'dodge': this.glitch = 0.12; this.burst(e.x, e.y, 8, '#ffffff', 140, 0.4, 'star'); break;
    case 'swap': this.glitch = 0.22; this.burst(e.x, e.y, 16, '#c9a7ff', 200, 0.6, 'star'); break;
    case 'shake': this.shake = 0.25; this.dust(e.x, e.y, 8); break;
    case 'floorDrop': this.burst(e.x, e.y + 8, 10, pal.dirt, 140, 0.7); this.burst(e.x, e.y, 6, pal.grass, 120, 0.6); break;
    case 'tooth': this.parts.push({ x: e.x, y: e.y + 2, vx: 0, vy: 30, life: 0.3, max: 0.3, color: pal.dirtD, size: 3, kind: 'dot', g: 300 }); break;
    case 'toothLand': this.burst(e.x, e.y, 6, '#eef2fb', 120, 0.3); break;
    case 'wake': this.glitch = 0.2; break;
    case 'reveal': this.shake = 0.18; this.burst(e.x, e.y, 10, '#ffffff', 160, 0.4, 'star'); break;
    case 'lunge': this.dust(e.x, e.y, 8); break;
    case 'wallWake': this.glitch = 0.25; break;
    case 'quake': this.shake = 0.45; break;
    case 'unplug': this.shake = 0.5; this.glitch = 0.4; this.burst(e.x, e.y - 10, 24, '#ffd84d', 300, 0.8, 'star'); break;
    case 'bossSaw': this.glitch = 0.08; break;
    case 'bubblePop': this.burst(e.x, e.y, 18, 'rgba(150,220,255,0.9)', 220, 0.6, 'ring'); this.shake = 0.2; break;
    case 'plant': this.burst(e.x, e.y - 30, 12, '#6fdc98', 140, 0.6, 'star'); break;
    case 'coinsLost': this.burst(this.w.p.x + 10, this.w.p.y, 12, '#ffd84d', 200, 0.7); break;
  }
};

R.deathFx = function (e) {
  const look = SL.look || {}, skin = SL.ITEM[look.skin] || SL.ITEM.sunny;
  const body = skin.body === 'glitch' ? '#ff4fa3' : skin.body;
  this.shake = 0.3;
  switch (look.death) {
    case 'confetti': for (const c of ['#ff7aa8', '#ffcb3d', '#6fdc98', '#8ed0ff', '#9d74ff']) this.burst(e.x, e.y, 8, c, 320, 1.1, 'square'); break;
    case 'pixels': this.burst(e.x, e.y, 34, body, 220, 0.9, 'square'); this.glitch = 0.15; break;
    case 'oof': this.burst(e.x, e.y, 16, body, 220, 0.6); this.parts.push({ x: e.x, y: e.y - 20, vx: 0, vy: -40, life: 1, max: 1, color: '#fffaf2', size: 26, kind: 'text', text: 'OOF', g: 0 }); break;
    case 'soul': this.burst(e.x, e.y, 14, body, 200, 0.6); this.parts.push({ x: e.x, y: e.y - 6, vx: 0, vy: -70, life: 1.1, max: 1.1, color: 'rgba(240,244,255,0.9)', size: 9, kind: 'soul', g: 0 }); break;
    case 'splat': for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, sp = 120 + Math.random() * 220; this.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.2, max: 1.2, color: body, size: 5 + Math.random() * 6, kind: 'dot', g: 200 }); } break;
    case 'stars': this.burst(e.x, e.y, 10, body, 200, 0.6); for (let i = 0; i < 5; i++) this.parts.push({ x: e.x + Math.cos(i * 1.26) * 18, y: e.y - 20 + Math.sin(i * 1.26) * 6, vx: -Math.sin(i * 1.26) * 60, vy: Math.cos(i * 1.26) * 20 - 20, life: 1.1, max: 1.1, color: '#ffd84d', size: 7, kind: 'star', g: 0 }); break;
    case 'blackhole': this.parts.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.9, max: 0.9, color: '#0c0716', size: 26, kind: 'dot', g: 0 }); this.burst(e.x, e.y, 30, '#9d74ff', 120, 0.5, 'star'); this.shake = 0.5; this.glitch = 0.3; break;
    case 'firework': this.burst(e.x, e.y, 10, body, 200, 0.5); for (const c of ['#ff4f6e', '#ffd84d', '#4df0b8', '#8ed0ff']) this.burst(e.x, e.y - 50, 12, c, 260, 1, 'star'); this.shake = 0.4; break;
    case 'nope': this.burst(e.x, e.y, 20, body, 240, 0.7); this.parts.push({ x: e.x, y: e.y - 20, vx: 0, vy: -30, life: 1.2, max: 1.2, color: '#ff4f6e', size: 20, kind: 'text', text: 'I QUIT', g: 0 }); this.glitch = 0.2; break;
    default: this.burst(e.x, e.y, 26, body, 260, 0.8); this.burst(e.x, e.y, 10, this.pal.ink, 200, 0.6);
  }
};

R.drawCoin = function (ctx, cn, i) {
  const t = this.time + i * 0.7, wob = Math.abs(Math.cos(t * 3)), y = cn.y + Math.sin(t * 2.5) * 3;
  ctx.fillStyle = '#d9a514'; ctx.beginPath(); ctx.ellipse(cn.x, y + 1.5, 9 * wob + 1.5, 9, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.ellipse(cn.x, y, 9 * wob + 1, 9, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3b2a40'; ctx.lineWidth = 2; ctx.stroke();
  if (wob > 0.5) { ctx.fillStyle = '#3b2a40'; ctx.fillRect(cn.x - 3.5 * wob, y - 2, 2, 2); ctx.fillRect(cn.x + 1.5 * wob, y - 2, 2, 2); ctx.fillRect(cn.x - 2.5 * wob, y + 3, 5 * wob, 1.5); }
};

// ---------- frame ----------
R.draw = function (dt, opts) {
  opts = opts || {};
  const ctx = this.ctx, w = this.w, L = w.L, pal = this.pal, p = w.p;
  this.time += dt;
  const tier = L.tier;

  // camera
  if (opts.camX !== undefined) this.cam = opts.camX;
  else {
    const target = Math.max(0, Math.min(L.w * T - VW, p.x + p.face * 70 - VW * (VW < 700 ? 0.3 : 0.42)));
    this.cam += (target - this.cam) * Math.min(1, dt * 6);
  }
  let sx = 0, sy = 0;
  if (this.shake > 0) { this.shake -= dt; sx = (Math.random() - 0.5) * 8 * this.shake / 0.3; sy = (Math.random() - 0.5) * 8 * this.shake / 0.3; }
  if (L.twist === 'shaky') { sx += (Math.random() - 0.5) * 1.6; sy += (Math.random() - 0.5) * 1.6; }
  if (L.twist === 'mirror') ctx.setTransform(-this.k, 0, 0, this.k, this.cv.width, 0);
  else ctx.setTransform(this.k, 0, 0, this.k, 0, 0);

  this.drawSky(ctx, pal, tier);
  ctx.save();
  ctx.translate(-Math.round(this.cam) + sx, sy);
  const c0 = Math.max(0, Math.floor(this.cam / T) - 1), c1 = Math.min(L.w - 1, Math.floor((this.cam + VW) / T) + 1);
  this.drawTiles(ctx, w, c0, c1);
  this.drawPlats(ctx, w);
  this.drawSaws(ctx, w);
  for (const cr of L.crushers) if (cr.x > this.cam - 80 && cr.x < this.cam + VW + 20) this.drawCrusher(ctx, cr, w.t);
  for (const wv of L.waves) if (wv.c1 * T > this.cam - 40 && wv.c0 * T < this.cam + VW + 40) this.drawWave(ctx, wv, w.t);
  this.drawCheckpoint(ctx, w);
  w.L.mimics.forEach((m, i) => { if (m.x > this.cam - 60 && m.x < this.cam + VW + 60) this.drawMimic(ctx, w, m, i); });
  for (const th of w.teeth) this.drawTooth(ctx, th);
  L.coins.forEach((cn, i) => { if (!w.coinsGot.has(i) && cn.x > this.cam - 30 && cn.x < this.cam + VW + 30) this.drawCoin(ctx, cn, i); });
  for (const lg of w.lunge) if (lg.x > this.cam - 40 && lg.x < this.cam + VW + 40) this.drawLunger(ctx, lg);
  for (const s of L.signs) if (s.x > this.cam - 60 && s.x < this.cam + VW + 60) this.drawSign(ctx, s);
  if (L.boss) this.drawBoss(ctx, w); else this.drawDoor(ctx, w);
  if (w.cpReal && w.respawnAt && (!L.checkpoint || Math.abs(w.respawnAt.x + SL.PW / 2 - L.checkpoint.x) > 4)) this.drawPocketFlag(ctx, w.respawnAt.x + SL.PW / 2, w.respawnAt.y + SL.PH);
  for (const b of w.bonks) this.drawBonk(ctx, b);
  if (w.ghost && p.alive && !opts.hidePlayer) this.drawGhost(ctx, w);
  if (p.alive && !opts.hidePlayer) this.drawPlayer(ctx, w);
  if (p.alive && !opts.hidePlayer && (w.shield > 0 || w.invuln > 0)) {
    ctx.globalAlpha = w.invuln > 0 ? 0.35 + 0.35 * Math.sin(this.time * 30) : 0.5;
    ctx.strokeStyle = '#8ed0ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x + SL.PW / 2, p.y + SL.PH - 13, 20, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(190,235,255,0.18)'; ctx.fill(); ctx.globalAlpha = 1;
  }
  this.drawParts(ctx, dt);
  if (w.wall.on) this.drawWall(ctx, w);
  for (const s of L.signs) if (s.near && p.alive) this.drawBubble(ctx, s);
  ctx.restore();
  this.drawAmbient(ctx, dt);
  if (L.twist === 'dark') {
    const px = (p.x + SL.PW / 2 - this.cam), py = p.y + SL.PH / 2;
    const g = ctx.createRadialGradient(px, py, 40, px, py, 190);
    g.addColorStop(0, 'rgba(8,4,14,0)'); g.addColorStop(1, 'rgba(8,4,14,0.97)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }
  ctx.setTransform(this.k, 0, 0, this.k, 0, 0);

  // post: tier gloom + glitches
  if (tier >= 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < VH; y += 3) ctx.fillRect(0, y, VW, 1);
  }
  const ambient = (tier >= 2 || (this.menace || 0) >= 3) && Math.random() < [0, 0, 0.002, 0.006, 0.012][tier] + Math.max(0, (this.menace || 0) - 3) * 0.003;
  if (ambient) this.glitch = Math.max(this.glitch, 0.06);
  if (this.glitch > 0) { this.glitch -= dt; this.drawGlitch(ctx); }
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  const mn = this.menace || 0;
  vg.addColorStop(1, mn >= 1 ? `rgba(${Math.min(90, 20 + mn * 10)},0,${Math.max(5, 30 - mn * 4)},${Math.min(0.6, 0.12 + tier * 0.07 + mn * 0.05)})` : `rgba(20,0,30,${0.08 + tier * 0.07})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
};

R.drawSky = function (ctx, pal, tier) {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, pal.skyA); g.addColorStop(1, pal.skyB);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // sun or moon
  const sunX = 680 - this.cam * 0.03, sunY = 90 + tier * 12;
  const m = this.menace || 0;
  if (m >= 2) {
    // a blood moon instead of a sun, with a glow that grows with menace
    const g = ctx.createRadialGradient(sunX, sunY, 20, sunX, sunY, 70 + m * 8);
    g.addColorStop(0, 'rgba(255,40,50,0.45)'); g.addColorStop(1, 'rgba(255,40,50,0)');
    ctx.fillStyle = g; ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  }
  ctx.fillStyle = m >= 2 ? '#c8202c' : pal.sun;
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(sunX, sunY, 38, 0, Math.PI * 2); ctx.fill();
  if (tier >= 3) { ctx.fillStyle = pal.skyA; ctx.beginPath(); ctx.arc(sunX + 16, sunY - 8, 32, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (tier >= 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 40; i++) { const x = (cellHash(i, 1) * 2000 - this.cam * 0.05) % VW; ctx.fillRect((x + VW) % VW, cellHash(i, 2) * 220, 2, 2); }
  }
  // clouds
  for (const c of this.clouds) {
    const x = ((c.x - this.cam * c.p + this.time * 6 * c.p) % 1700 + 1700) % 1700 - 200;
    this.cloud(ctx, x, c.y, c.s, pal.cloud);
  }
  const amb = this.theme && this.theme.ambient;
  if (amb === 'grid') {
    // synthwave sun stripes and a perspective grid behind the hills
    ctx.fillStyle = pal.skyA;
    for (let i = 0; i < 5; i++) ctx.fillRect(sunX - 40, sunY + 4 + i * 7, 80, 2 + i * 0.6);
    ctx.strokeStyle = 'rgba(255,79,216,0.35)'; ctx.lineWidth = 1.5;
    const hz = 300, off = (this.cam * 0.4) % 60;
    for (let i = -12; i <= 24; i++) { ctx.beginPath(); ctx.moveTo(VW / 2 + (i * 60 - off - VW / 2) * 0.2, hz); ctx.lineTo(i * 60 - off, VH); ctx.stroke(); }
    for (let j = 0; j < 8; j++) { const y = hz + Math.pow(j / 8, 1.8) * (VH - hz); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }
  }
  if (amb === 'bubbles') {
    // light shafts from the surface
    for (let i = 0; i < 4; i++) {
      const x = ((i * 260 - this.cam * 0.1 + Math.sin(this.time * 0.4 + i) * 30) % (VW + 200) + VW + 200) % (VW + 200) - 100;
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x + 160, VH); ctx.lineTo(x + 60, VH); ctx.closePath(); ctx.fill();
    }
  }
  // hills (thorny once menace kicks in)
  this.hills(ctx, 0.15, 300, 60, pal.far, 0.004, m >= 1 ? Math.min(14, 4 + m * 2) : 0);
  // eyes in the dark behind the near hills
  for (const e of this.eyes) {
    const x = ((e.x - this.cam * e.p) % 2400 + 2400) % 2400 - 200;
    if (x < -20 || x > VW + 20) continue;
    const open = Math.sin(this.time * 0.7 + e.ph) > -0.6 && (this.time + e.ph) % 5 > 0.15;
    ctx.fillStyle = 'rgba(255,30,50,0.85)';
    if (open) { ctx.beginPath(); ctx.ellipse(x, e.y, 3 * e.s, 2 * e.s, 0, 0, 7); ctx.ellipse(x + 10 * e.s, e.y, 3 * e.s, 2 * e.s, 0, 0, 7); ctx.fill(); }
  }
  this.hills(ctx, 0.35, 360, 50, pal.near, 0.007, m >= 1 ? Math.min(18, 6 + m * 2.5) : 0);
  // lightning at high menace
  if (m >= 4 || this.themeId === 'storm') {
    this.boltT = (this.boltT === undefined ? 3 : this.boltT) - 1 / 60;
    if (this.boltT <= 0) { this.boltT = Math.max(1.5, 9 - m) + Math.random() * 4; this.flash = 0.18; }
    if (this.flash > 0) { this.flash -= 1 / 60; ctx.fillStyle = `rgba(255,240,255,${this.flash * 2})`; ctx.fillRect(0, 0, VW, VH); }
  }
};
// Weather: screen-space particles that give each theme its feel.
R.drawAmbient = function (ctx, dt) {
  const m = this.menace || 0;
  if (m >= 2) {
    this.ash = this.ash || [];
    this.ashAcc = (this.ashAcc || 0) + Math.min(3, (m - 1) * 0.35) * dt * 15;
    while (this.ashAcc >= 1 && this.ash.length < 60) { this.ashAcc -= 1; this.ash.push({ x: Math.random() * VW, y: -5, vx: -20 + Math.random() * 10, vy: 30 + Math.random() * 30, s: 1 + Math.random() * 2, life: 14 }); }
    ctx.fillStyle = m >= 5 ? 'rgba(255,90,90,0.5)' : 'rgba(170,160,160,0.5)';
    this.ash = this.ash.filter(a => { a.life -= dt; a.x += (a.vx + Math.sin(this.time + a.y * 0.02) * 10) * dt; a.y += a.vy * dt; if (a.life <= 0 || a.y > VH + 5) return false; ctx.fillRect(a.x, a.y, a.s, a.s); return true; });
  }
  const kind = this.theme && this.theme.ambient;
  if (!kind || kind === 'grid') return;
  const rate = { dust: 0.5, embers: 1.2, sprinkles: 0.7, snow: 1.4, bubbles: 0.5, fog: 0.12, drip: 0.6, static: 2.5, rain: 4 }[kind] || 0;
  this.ambAcc = (this.ambAcc || 0) + rate * dt * 60 * 0.25;
  while (this.ambAcc >= 1 && this.amb.length < 90) {
    this.ambAcc -= 1;
    const x = Math.random() * VW; // screen space: weather does not scroll with the level
    if (kind === 'snow') this.amb.push({ x, y: -6, vx: -10 + Math.random() * 20, vy: 30 + Math.random() * 40, s: 1.5 + Math.random() * 2.5, c: '#ffffff', life: 14 });
    else if (kind === 'embers') this.amb.push({ x, y: VH + 6, vx: -15 + Math.random() * 30, vy: -(40 + Math.random() * 60), s: 1.5 + Math.random() * 2, c: Math.random() < 0.5 ? '#ffb020' : '#ff5a1f', life: 9 });
    else if (kind === 'bubbles') this.amb.push({ x, y: VH + 6, vx: 0, vy: -(25 + Math.random() * 35), s: 2 + Math.random() * 4, c: 'ring', life: 16 });
    else if (kind === 'sprinkles') this.amb.push({ x, y: -6, vx: -8 + Math.random() * 16, vy: 25 + Math.random() * 25, s: 3, c: ['#ff6fb0', '#8ed0ff', '#ffd84d', '#6fe8d0', '#c8b4ff'][Math.floor(Math.random() * 5)], rot: Math.random() * 3, life: 18 });
    else if (kind === 'rain') this.amb.push({ x: x + 60, y: -10, vx: -120, vy: 620 + Math.random() * 160, s: 10, c: 'rain', life: 2 });
    else if (kind === 'fog') this.amb.push({ x: -120, y: 260 + Math.random() * 200, vx: 15 + Math.random() * 20, vy: 0, s: 60 + Math.random() * 80, c: 'fog', life: 60 });
    else if (kind === 'drip') this.amb.push({ x, y: -6, vx: 0, vy: 140 + Math.random() * 120, s: 2 + Math.random() * 1.5, c: '#a0101e', life: 6 });
    else if (kind === 'static') this.amb.push({ x, y: Math.random() * VH, vx: 0, vy: 0, s: 1 + Math.random() * 1.5, c: Math.random() < 0.15 ? '#ff2a3a' : 'rgba(255,255,255,0.55)', life: 0.08 });
    else if (kind === 'dust') this.amb.push({ x, y: 120 + Math.random() * 320, vx: 30 + Math.random() * 40, vy: -4 + Math.random() * 8, s: 1.5 + Math.random() * 1.5, c: 'rgba(255,230,190,0.6)', life: 6 });
  }
  const keep = [];
  for (const q of this.amb) {
    q.life -= dt; if (q.life <= 0 || q.y < -20 || q.y > VH + 20) continue;
    q.x += (q.vx + (q.c === 'ring' || q.c === '#ffffff' ? Math.sin(this.time * 2 + q.y * 0.03) * 12 : 0)) * dt; q.y += q.vy * dt;
    if (q.c === 'fog') { const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.s); g.addColorStop(0, 'rgba(200,220,210,0.16)'); g.addColorStop(1, 'rgba(200,220,210,0)'); ctx.fillStyle = g; ctx.fillRect(q.x - q.s, q.y - q.s, q.s * 2, q.s * 2); if (q.x > VW + 150) q.life = 0; keep.push(q); continue; }
    if (q.c === 'rain') { ctx.strokeStyle = 'rgba(190,210,255,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - 2, q.y + q.s); ctx.stroke(); keep.push(q); continue; }
    if (q.c === 'ring') { ctx.strokeStyle = 'rgba(220,250,255,0.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, 7); ctx.stroke(); }
    else if (q.rot !== undefined) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + this.time); ctx.fillStyle = q.c; ctx.fillRect(-3, -1, 6, 2); ctx.restore(); }
    else { ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, 7); ctx.fill(); }
    keep.push(q);
  }
  this.amb = keep;
};

R.cloud = function (ctx, x, y, s, col) {
  ctx.fillStyle = col; ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x, y, 20 * s, 0, Math.PI * 2); ctx.arc(x + 22 * s, y - 10 * s, 26 * s, 0, Math.PI * 2);
  ctx.arc(x + 48 * s, y, 20 * s, 0, Math.PI * 2); ctx.rect(x, y, 48 * s, 20 * s);
  ctx.fill(); ctx.globalAlpha = 1;
};
R.hills = function (ctx, par, base, amp, col, freq, thorns) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, VH);
  const off = this.cam * par + this.hillSeed * 100;
  for (let x = 0; x <= VW; x += 12) {
    const wx = x + off;
    const y = base - Math.sin(wx * freq) * amp - Math.sin(wx * freq * 2.7 + 1.3) * amp * 0.35;
    if (thorns) { const k = Math.floor(wx / 12); ctx.lineTo(x - 6, y); ctx.lineTo(x - 3, y - thorns * (0.5 + cellHash(k, 3) * 0.8)); }
    ctx.lineTo(x, y);
  }
  ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
};

R.drawTiles = function (ctx, w, c0, c1) {
  const L = w.L, pal = this.pal, tier = L.tier, t = this.time;
  const code = (c, r) => w.code(c, r);
  // a spike buried under a false floor counts as dirt, so the trap draws no outline
  const solidLook = (c, r) => { const k = code(c, r); return SL.looksSolid(k) || (k === TC.SPIKE && code(c, r - 1) === TC.FALSE); };
  for (let c = c0; c <= c1; c++) for (let r = 0; r < H; r++) {
    const k = code(c, r);
    const x = c * T, y = r * T;
    if (SL.looksSolid(k)) {
      const topOpen = !SL.looksSolid(code(c, r - 1)) || c < 0;
      ctx.fillStyle = pal.dirt; ctx.fillRect(x - 0.5, y - 0.5, T + 1, T + 1);
      // speckles
      ctx.fillStyle = pal.dot;
      const h1 = cellHash(c, r);
      if (h1 > 0.3) ctx.fillRect(x + 6 + h1 * 14, y + 12 + h1 * 10, 4, 4);
      if (h1 > 0.65) ctx.fillRect(x + 20 - h1 * 8, y + 22, 3, 3);
      if ((this.menace || 0) >= 3 && h1 > 0.9 && r > 1) this.skull(ctx, x + 8 + (h1 - 0.9) * 120, y + 14);
      // side shading against open air
      ctx.fillStyle = pal.dirtD;
      if (!solidLook(c - 1, r) && c > 0) ctx.fillRect(x, y, 3, T);
      if (!solidLook(c + 1, r) && c < L.w - 1) ctx.fillRect(x + T - 3, y, 3, T);
      if (!solidLook(c, r + 1) && r < H - 1) ctx.fillRect(x, y + T - 4, T, 4);
      if (topOpen) {
        ctx.fillStyle = pal.grassD; ctx.fillRect(x, y, T, 11);
        ctx.fillStyle = pal.grass; ctx.fillRect(x, y, T, 8);
        ctx.beginPath();
        if ((this.menace || 0) >= 2) { for (let i = 0; i < 4; i++) { ctx.moveTo(x + i * 8, y + 7); ctx.lineTo(x + 4 + i * 8, y + 13 + cellHash(c, i) * 3); ctx.lineTo(x + 8 + i * 8, y + 7); } }
        else for (let i = 0; i < 3; i++) ctx.arc(x + 5 + i * 11, y + 9, 5, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y + 1, T, 2);
      }
      if (k === TC.HOLE) {
        const popped = w.popped.get(r * L.w + c);
        const a = this.tell([1, 0.85, 0.7, 0.6, 0.5]);
        ctx.fillStyle = `rgba(40,20,40,${a})`;
        if (a > 0) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + 8 + i * 8, y + 4, 2.4, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
        if (popped !== undefined && popped > 0.02) {
          const hgt = Math.min(1, (popped - 0.02) / 0.08) * (popped > 1.1 ? Math.max(0, (1.3 - popped) / 0.2) : 1) * 24;
          this.spikeRow(ctx, x + 2, y, T - 4, hgt, 3, 1);
        }
      }
      if (k === TC.SEAM) {
        // the tell: a dark seam and a hint of a tooth tip under the block
        const a = this.tell([0.85, 0.7, 0.55, 0.45, 0.36]);
        ctx.fillStyle = `rgba(40,20,40,${a})`;
        ctx.fillRect(x + 3, y + T - 7, T - 6, 2);
        ctx.beginPath(); ctx.moveTo(x + T / 2 - 4, y + T); ctx.lineTo(x + T / 2, y + T + 3); ctx.lineTo(x + T / 2 + 4, y + T); ctx.fill();
      }
      if (k === TC.FALSE && topOpen) {
        // the tell: false floor has no grass blades and no specks
        const a = L.forks.some(f => x >= f.trapX0 && x < f.trapX1) ? 0 : this.tell([0.9, 0.75, 0.6, 0.5, 0.4]);
        if (a > 0) {
          ctx.globalAlpha = a;
          ctx.fillStyle = pal.dirt; ctx.fillRect(x, y + 11, T, 12);
          ctx.fillStyle = pal.grass; ctx.fillRect(x, y, T, 11);
          ctx.globalAlpha = 1;
        }
      }
      if (k === TC.SWIRL && topOpen && this.tell([1, 1, 1, 1, 1]) > 0) {
        ctx.fillStyle = '#9d74ff'; ctx.fillRect(x, y, T, 11);
        ctx.fillStyle = '#c9a7ff'; ctx.fillRect(x, y, T, 8);
        ctx.strokeStyle = '#4b2a8a'; ctx.lineWidth = 2; ctx.beginPath();
        const sp = t * 3;
        for (let i = 0; i <= 24; i++) { const a = sp + i * 0.5, rr = i * 0.42; const px = x + T / 2 + Math.cos(a) * rr, py = y + 14 + Math.sin(a) * rr * 0.75; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
      }
      if (k === TC.CRUMBLE) {
        const left = w.crumbled.get(r * L.w + c);
        ctx.strokeStyle = 'rgba(40,20,30,0.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x + 4, y + 12); ctx.lineTo(x + 12, y + 20); ctx.lineTo(x + 9, y + 30); ctx.moveTo(x + 22, y + 12); ctx.lineTo(x + 18, y + 24); ctx.stroke();
        if (left !== undefined && left > 0) { ctx.fillStyle = `rgba(0,0,0,${0.4 - left})`; ctx.fillRect(x, y, T, T); }
      }
      if (k === TC.CRACK) {
        ctx.strokeStyle = `rgba(50,25,40,${this.tell([0.9, 0.75, 0.6, 0.5, 0.42])})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + 13, y + 9); ctx.lineTo(x + 9, y + 16); ctx.lineTo(x + 15, y + 26);
        ctx.moveTo(x + 13, y + 9); ctx.lineTo(x + 22, y + 13); ctx.lineTo(x + 26, y + 22); ctx.stroke();
      }
    } else if (k === TC.SPIKE && code(c, r - 1) === TC.FALSE) {
      // a spike buried under a false floor: drawn as dirt until you fall in
      ctx.fillStyle = pal.dirt; ctx.fillRect(x - 0.5, y - 0.5, T + 1, T + 1);
    } else if (k === TC.INVIS) {
      const a = this.tell([0.35, 0.28, 0.22, 0.16, 0.12]);
      if (a > 0) { ctx.strokeStyle = `rgba(255,255,255,${a * (0.6 + 0.4 * Math.sin(t * 3 + c))})`; ctx.setLineDash([3, 5]); ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, T - 6, T - 6); ctx.setLineDash([]); }
    } else if (k === TC.SPIKED) {
      this.spikeRowDown(ctx, x + 2, y, T - 4, 17, 2);
    } else if (k === TC.SPIKE) {
      this.spikeRow(ctx, x + 2, y + T, T - 4, 18, 2, 1);
    } else if (k === TC.PAPER) {
      // Paper spikes blink. Real ones never do. Subtler with each tier.
      const period = [1.5, 2.1, 2.9, 3.7, 4.6][tier];
      const off = tier >= 3 ? cellHash(c, 7) * period : 0;
      const ph = (t + off) % period;
      this.spikeRow(ctx, x + 2, y + T, T - 4, 18, 2, ph < 0.14 ? 0.18 : 1);
    } else if (k === TC.BRIDGE) {
      const rate = this.tell([0.7, 0.5, 0.34, 0.24, 0.16]);
      if (Math.random() < rate * 0.016) this.parts.push({ x: x + Math.random() * T, y: y + 2, vx: 0, vy: -18, life: 1.1, max: 1.1, color: '#ffffff', size: 5, kind: 'star', g: 0 });
      if (w.revealed.has(r * L.w + c)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, T - 4, T - 4); ctx.setLineDash([]);
      }
    }
  }
};
R.skull = function (ctx, x, y) {
  ctx.fillStyle = 'rgba(235,225,210,0.75)';
  ctx.beginPath(); ctx.arc(x, y, 4.5, Math.PI, 0); ctx.lineTo(x + 3.5, y + 4); ctx.lineTo(x - 3.5, y + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(30,10,15,0.8)'; ctx.fillRect(x - 3, y - 1, 2, 2); ctx.fillRect(x + 1, y - 1, 2, 2);
};
R.spikeRow = function (ctx, x, base, width, hgt, n, alpha) {
  if (hgt <= 0) return;
  ctx.globalAlpha = alpha;
  const sw = width / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * sw, base); ctx.lineTo(x + i * sw + sw / 2, base - hgt); ctx.lineTo(x + (i + 1) * sw, base); ctx.closePath();
    ctx.fillStyle = '#eef2fb'; ctx.fill();
    ctx.strokeStyle = '#6f7591'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(x + i * sw + sw / 2 - 1, base - hgt + 4, 2, hgt * 0.4);
  }
  ctx.globalAlpha = 1;
};

R.spikeRowDown = function (ctx, x, top, width, hgt, n) {
  const sw = width / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * sw, top); ctx.lineTo(x + i * sw + sw / 2, top + hgt); ctx.lineTo(x + (i + 1) * sw, top); ctx.closePath();
    ctx.fillStyle = '#eef2fb'; ctx.fill();
    ctx.strokeStyle = '#6f7591'; ctx.lineWidth = 2; ctx.stroke();
  }
};

R.drawSaws = function (ctx, w) {
  for (const sw of w.L.saws) {
    const q = SL.sawPos(sw, w.t);
    if (q.x < this.cam - 40 || q.x > this.cam + VW + 40) continue;
    // track
    ctx.strokeStyle = 'rgba(59,42,64,0.25)'; ctx.lineWidth = 3; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(sw.x0, sw.y0); ctx.lineTo(sw.x1, sw.y1); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(w.t * 14);
    ctx.fillStyle = '#d8dbe8'; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? 10 : 15; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#3b2a40'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ff4f6e'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
};

R.drawSlide = function (ctx, pl, x, y) {
  const pal = this.pal;
  ctx.fillStyle = pal.dirt; ctx.fillRect(x - 0.5, y, pl.w + 1, VH - y);
  ctx.fillStyle = pal.dot;
  for (let i = 0; i < pl.w / T; i++) for (let j = 0; j < (VH - y) / T; j++) { const h1 = cellHash(i + 91, j); if (h1 > 0.3) ctx.fillRect(x + i * T + 6 + h1 * 14, y + j * T + 12 + h1 * 10, 4, 4); }
  ctx.fillStyle = pal.grassD; ctx.fillRect(x, y, pl.w, 11);
  ctx.fillStyle = pal.grass; ctx.fillRect(x, y, pl.w, 8);
  ctx.beginPath(); for (let i = 0; i < pl.w / 11; i++) ctx.arc(x + 5 + i * 11, y + 9, 5, 0, Math.PI); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y + 1, pl.w, 2);
  // the tell: hairline seams down both sides
  const a = this.tell([0.8, 0.65, 0.5, 0.4, 0.32]);
  if (a > 0) { ctx.fillStyle = `rgba(40,20,40,${a})`; ctx.fillRect(x, y + 11, 2, VH - y); ctx.fillRect(x + pl.w - 2, y + 11, 2, VH - y); }
};

R.drawLunger = function (ctx, lg) {
  const a = this.tell([1, 0.8, 0.6, 0.5, 0.4]);
  this.spikeRow(ctx, lg.x + 2, lg.y + T, T - 4, 18, 2, 1);
  // the tell: a little red tip
  if (a > 0) { ctx.fillStyle = `rgba(255,79,110,${a})`; ctx.beginPath(); ctx.arc(lg.x + 9.5, lg.y + T - 17, 2.2, 0, 7); ctx.arc(lg.x + 22.5, lg.y + T - 17, 2.2, 0, 7); ctx.fill(); }
  if (lg.moving) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(lg.x + T + 4, lg.y + T - 4 - i * 6); ctx.lineTo(lg.x + T + 18, lg.y + T - 4 - i * 6); } ctx.stroke(); }
};

R.drawWall = function (ctx, w) {
  const x = w.wall.x;
  if (x < this.cam - 60) {
    // off screen: a red glow on the left edge says it is coming
    const g = ctx.createLinearGradient(this.cam, 0, this.cam + 60, 0);
    g.addColorStop(0, 'rgba(255,40,80,0.35)'); g.addColorStop(1, 'rgba(255,40,80,0)');
    ctx.fillStyle = g; ctx.fillRect(this.cam, 0, 60, VH);
    return;
  }
  ctx.fillStyle = '#2a0f22'; ctx.fillRect(x - 400, 0, 400, VH);
  ctx.fillStyle = '#4a1735'; ctx.fillRect(x - 14, 0, 14, VH);
  for (let y = 0; y < VH; y += 24) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y + 12); ctx.lineTo(x, y + 24); ctx.closePath();
    ctx.fillStyle = '#eef2fb'; ctx.fill(); ctx.strokeStyle = '#6f7591'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.fillStyle = '#ff4f6e';
  const ey = VH * 0.45 + Math.sin(this.time * 2) * 20;
  ctx.beginPath(); ctx.arc(x - 30, ey, 7, 0, 7); ctx.arc(x - 30, ey + 26, 7, 0, 7); ctx.fill();
};

R.drawPocketFlag = function (ctx, x, y) {
  ctx.fillStyle = '#5c5470'; ctx.fillRect(x - 1.5, y - 34, 3, 34);
  ctx.fillStyle = '#6fdc98'; ctx.beginPath(); ctx.moveTo(x + 1.5, y - 34); ctx.lineTo(x + 18, y - 28); ctx.lineTo(x + 1.5, y - 22); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3b2a40'; ctx.lineWidth = 1.5; ctx.stroke();
};

// The Game itself: a big angry TV with three plugs running to the pillars.
R.drawBoss = function (ctx, w) {
  const L = w.L, b = L.boss, bs = w.bossState, t = this.time;
  const left = bs.pressed.filter(v => !v).length;
  const bx = b.x + Math.sin(t * 1.3) * 40 + (bs.hurt > 0 ? (Math.random() - 0.5) * 10 : 0), by = b.y + Math.sin(t * 2.1) * 8;
  // cables
  L.switches.forEach((sw, i) => {
    ctx.strokeStyle = bs.pressed[i] ? 'rgba(59,42,64,0.25)' : '#3b2a40'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx + (i - 1) * 30, by + 50);
    if (bs.pressed[i]) ctx.quadraticCurveTo(bx + (i - 1) * 40, by + 140, bx + (i - 1) * 50, by + 120);
    else ctx.quadraticCurveTo((bx + sw.x) / 2, by + 220, sw.x, sw.y - 10);
    ctx.stroke();
    // the plug on the pillar
    ctx.save(); ctx.translate(sw.x, sw.y);
    if (!bs.pressed[i]) {
      ctx.fillStyle = '#ffcb3d'; SL.rrect(ctx, -12, -22, 24, 16, 4); ctx.fill(); ctx.strokeStyle = '#3b2a40'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#3b2a40'; ctx.fillRect(-6, -8, 3, 8); ctx.fillRect(3, -8, 3, 8);
      ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 8 + i)})`; ctx.font = '700 10px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PULL', 0, -28); ctx.textAlign = 'left';
    } else { ctx.fillStyle = 'rgba(59,42,64,0.3)'; ctx.fillRect(-12, -4, 24, 4); }
    ctx.restore();
  });
  // body
  ctx.save(); ctx.translate(bx, by);
  const glitchy = left === 1 || bs.hurt > 0;
  ctx.fillStyle = '#ffcb3d'; SL.rrect(ctx, -70, -50, 140, 100, 28); ctx.fill(); ctx.strokeStyle = '#3b2a40'; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = glitchy ? '#3a0f2a' : '#2a1d38'; SL.rrect(ctx, -56, -38, 112, 74, 18); ctx.fill();
  ctx.strokeStyle = left === 3 ? '#fffaf2' : '#ff8fa8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  // angry face: brows, eyes, mouth
  ctx.beginPath(); ctx.moveTo(-40, -22); ctx.lineTo(-14, -12); ctx.moveTo(40, -22); ctx.lineTo(14, -12); ctx.stroke();
  ctx.fillStyle = ctx.strokeStyle;
  const ex = Math.max(-6, Math.min(6, (w.p.x - bx) / 40));
  if (bs.hurt > 0) { ctx.beginPath(); ctx.moveTo(-34, -6); ctx.lineTo(-20, 6); ctx.moveTo(-20, -6); ctx.lineTo(-34, 6); ctx.moveTo(20, -6); ctx.lineTo(34, 6); ctx.moveTo(34, -6); ctx.lineTo(20, 6); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(-27 + ex, 0, 6, 0, 7); ctx.arc(27 + ex, 0, 6, 0, 7); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(-22, 24); for (let i = 0; i <= 8; i++) ctx.lineTo(-22 + i * 5.5, 24 + (i % 2 ? -5 : 3) * (glitchy ? 1.6 : 1)); ctx.stroke();
  ctx.lineCap = 'butt';
  // health: plugs left
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i < left ? '#ff4f6e' : 'rgba(255,255,255,0.25)'; SL.rrect(ctx, -30 + i * 22, -66, 16, 9, 3); ctx.fill(); }
  ctx.restore();
  // boss saws
  for (const sw of bs.saws) {
    ctx.save(); ctx.translate(sw.x, sw.y); ctx.rotate(t * 20 * Math.sign(sw.vx));
    ctx.fillStyle = '#d8dbe8'; ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? 10 : 15; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#3b2a40'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  if (glitchy && Math.random() < 0.05) this.glitch = Math.max(this.glitch, 0.08);
};

R.drawCrusher = function (ctx, cr, t) {
  const y = SL.crusherY(cr, t), x = cr.x, w = cr.w;
  ctx.fillStyle = '#4a4458'; ctx.fillRect(x + w / 2 - 4, cr.top, 8, y - cr.top);
  ctx.fillStyle = '#5c5470'; SL.rrect(ctx, x, y, w, 28, 5); ctx.fill();
  ctx.strokeStyle = '#1c1226'; ctx.lineWidth = 2.5; ctx.stroke();
  // spikes underneath and an angry face
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 2 + i * (w - 4) / 4, y + 28); ctx.lineTo(x + 2 + (i + 0.5) * (w - 4) / 4, y + 40); ctx.lineTo(x + 2 + (i + 1) * (w - 4) / 4, y + 28); ctx.fillStyle = '#eef2fb'; ctx.fill(); ctx.strokeStyle = '#6f7591'; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.strokeStyle = '#ff4f6e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + 14, y + 8); ctx.lineTo(x + 26, y + 13); ctx.moveTo(x + w - 14, y + 8); ctx.lineTo(x + w - 26, y + 13); ctx.stroke();
  ctx.fillStyle = '#ff4f6e'; ctx.fillRect(x + 18, y + 15, 4, 4); ctx.fillRect(x + w - 22, y + 15, 4, 4);
};
R.drawWave = function (ctx, wv, t) {
  const up = SL.waveUp(wv, t);
  for (let c = wv.c0; c < wv.c1; c++) {
    const base = (wv.row + 1) * T, wig = up > 0 && up < 1 ? Math.sin(t * 60 + c) * 1.5 : 0;
    ctx.fillStyle = 'rgba(40,20,40,0.6)';
    for (let i = 0; i < 3; i++) ctx.fillRect(c * T + 6 + i * 9, base - 2, 4, 2);
    if (up > 0) this.spikeRow(ctx, c * T + 2 + wig, base, T - 4, 20 * up, 2, 1);
  }
};

R.drawTooth = function (ctx, th) {
  if (th.boss && th.wait > 0) {
    // warning: a red mark on the floor and a shaking tooth up top
    const fy = this.w.L.arena.floor;
    ctx.fillStyle = `rgba(255,79,110,${0.35 + 0.3 * Math.sin(this.time * 30)})`;
    ctx.beginPath(); ctx.ellipse(th.x, fy - 2, 12, 4, 0, 0, 7); ctx.fill();
    th = { x: th.x + (Math.random() - 0.5) * 3, y: th.y };
  }
  ctx.beginPath(); ctx.moveTo(th.x - 8, th.y); ctx.lineTo(th.x, th.y + 20); ctx.lineTo(th.x + 8, th.y); ctx.closePath();
  ctx.fillStyle = '#eef2fb'; ctx.fill(); ctx.strokeStyle = '#6f7591'; ctx.lineWidth = 2; ctx.stroke();
};

R.drawGhost = function (ctx, w) {
  const g = w.ghost, cx = g.x + SL.PW / 2, cy = g.y + SL.PH - 13;
  ctx.globalAlpha = 0.55 + Math.sin(this.time * 9) * 0.1;
  ctx.fillStyle = '#2a1d38'; ctx.beginPath(); ctx.ellipse(cx, cy, 13, 13, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff4f6e';
  ctx.beginPath(); ctx.arc(cx + g.face * 3.5 - 4.5, cy - 2, 2, 0, 7); ctx.arc(cx + g.face * 3.5 + 4.5, cy - 2, 2, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
};

R.drawMimic = function (ctx, w, m, i) {
  const pal = this.pal, chomp = w.chomp && w.chomp.i === i;
  const near = Math.abs(w.p.x - m.x) < 70;
  ctx.save(); ctx.translate(m.x, m.y);
  ctx.fillStyle = pal.doorD; rrect(ctx, -19, -50, 38, 50, 16); ctx.fill();
  ctx.fillStyle = pal.door; rrect(ctx, -15, -46, 30, 46, 13); ctx.fill();
  // the tell: handle on the left (on Rage it copies the real door exactly)
  const fake = (w.L.diff === 'rage' ? 1 : -1) * (w.remix && w.remix.mimic ? -1 : 1);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; rrect(ctx, fake > 0 ? -11 : 3, -42, 8, 20, 4); ctx.fill();
  ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(9 * fake, -20, 2.6, 0, 7); ctx.fill();
  const p = w.p, dx = Math.max(-1, Math.min(1, (p.x + 10 - m.x) / 200));
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-6, -30, 4.5, 5, 0, 0, 7); ctx.ellipse(6, -30, 4.5, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = pal.ink;
  ctx.beginPath(); ctx.arc(-6 + dx * 2, -30, 2.2, 0, 7); ctx.arc(6 + dx * 2, -30, 2.2, 0, 7); ctx.fill();
  ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.6; ctx.beginPath();
  if (chomp || (near && p.alive && w.L.diff !== 'rage')) {
    ctx.fillStyle = '#3b0f1f'; rrect(ctx, -11, -22, 22, 14, 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath();
    for (let k = 0; k < 4; k++) { ctx.moveTo(-10 + k * 5.5, -22); ctx.lineTo(-7.5 + k * 5.5, -17); ctx.lineTo(-5 + k * 5.5, -22); }
    ctx.fill();
  } else { ctx.arc(0, -23, 3, 0.2, Math.PI - 0.2); ctx.stroke(); }
  ctx.restore();
  ctx.font = '700 11px Fredoka, sans-serif'; ctx.fillStyle = 'rgba(59,42,64,0.75)'; ctx.textAlign = 'center';
  ctx.fillText('EXIT', m.x, m.y - 56); ctx.textAlign = 'left';
};

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
SL.rrect = rrect;

R.drawPlats = function (ctx, w) {
  const pal = this.pal;
  for (const pl of w.L.plats) {
    if (pl.x + pl.w < this.cam - 40 || pl.x > this.cam + VW + 40) continue;
    let x = pl.x, y = pl.y + pl.fy;
    if (pl.shake > 0) x += (Math.random() - 0.5) * 4;
    if (y > VH + 40) continue;
    if (pl.kind === 'slide') { this.drawSlide(ctx, pl, x, y); continue; }
    ctx.fillStyle = pal.platD; rrect(ctx, x, y + 3, pl.w, 13, 6); ctx.fill();
    ctx.fillStyle = pal.plat; rrect(ctx, x, y, pl.w, 12, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x + 6, y + 3, pl.w - 12, 2);
    if (pl.rotten && w.has.rotten) {
      const a = this.tell([0.9, 0.75, 0.6, 0.5, 0.4]);
      if (a > 0) { ctx.fillStyle = `rgba(110,150,60,${a})`; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 8 + i * (pl.w - 16) / 2, y + 6 + (i % 2) * 2, 2.6, 0, 7); ctx.fill(); } }
    }
    if (pl.kind === 'shy' && this.tell([1, 0.8, 0.6, 0.5, 0.4]) > 0) {
      ctx.globalAlpha = this.tell([1, 0.8, 0.6, 0.5, 0.4]);
      const scared = pl.dodgeT >= 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(x + pl.w / 2 - 7, y + 6, 3.5, scared ? 4.5 : 3.5, 0, 0, 7); ctx.ellipse(x + pl.w / 2 + 7, y + 6, 3.5, scared ? 4.5 : 3.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = pal.ink;
      const lx = Math.max(-1.5, Math.min(1.5, (w.p.x - x) / 120));
      ctx.beginPath(); ctx.arc(x + pl.w / 2 - 7 + lx, y + 6, 1.8, 0, 7); ctx.arc(x + pl.w / 2 + 7 + lx, y + 6, 1.8, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (pl.kind === 'move') { ctx.fillStyle = pal.platD; ctx.beginPath(); ctx.arc(x + 10, y + 7, 2.5, 0, 7); ctx.arc(x + pl.w - 10, y + 7, 2.5, 0, 7); ctx.fill(); }
    if (pl.shake > 0 || pl.fallen) {
      ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(x + pl.w * 0.4, y); ctx.lineTo(x + pl.w * 0.5, y + 7); ctx.lineTo(x + pl.w * 0.45, y + 12); ctx.stroke();
    }
  }
};

R.drawSign = function (ctx, s) {
  const x = s.x, y = s.y;
  ctx.fillStyle = '#8a5a3a'; ctx.fillRect(x - 3, y - 30, 6, 30);
  ctx.fillStyle = '#6e4329'; rrect(ctx, x - 17, y - 44, 34, 22, 4); ctx.fill();
  ctx.fillStyle = '#c99263'; rrect(ctx, x - 16, y - 46, 32, 20, 4); ctx.fill();
  ctx.fillStyle = 'rgba(70,40,25,0.6)';
  ctx.fillRect(x - 10, y - 40, 20, 2); ctx.fillRect(x - 10, y - 35, 14, 2);
  if (/!$/.test(s.text)) { ctx.fillRect(x + 8, y - 41, 2, 7); ctx.fillRect(x + 8, y - 32, 2, 2); }
  else if (/\.\.\.$/.test(s.text)) { ctx.fillRect(x + 5, y - 32, 2, 2); ctx.fillRect(x + 8, y - 32, 2, 2); ctx.fillRect(x + 11, y - 32, 2, 2); }
};
R.drawBubble = function (ctx, s) {
  ctx.font = '600 15px Fredoka, system-ui, sans-serif';
  const words = s.text.split(' '), lines = [];
  let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > 210 && cur) { lines.push(cur); cur = wd; } else cur = t; }
  lines.push(cur);
  const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 24, bh = lines.length * 19 + 14;
  let bx = s.x - bw / 2; const by = s.y - 64 - bh;
  bx = Math.max(this.cam + 6, Math.min(this.cam + VW - bw - 6, bx));
  ctx.fillStyle = 'rgba(59,42,64,0.25)'; rrect(ctx, bx + 3, by + 4, bw, bh, 12); ctx.fill();
  ctx.fillStyle = '#fffaf2'; rrect(ctx, bx, by, bw, bh, 12); ctx.fill();
  ctx.strokeStyle = '#3b2a40'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s.x - 7, by + bh - 1); ctx.lineTo(s.x, by + bh + 9); ctx.lineTo(s.x + 7, by + bh - 1); ctx.fillStyle = '#fffaf2'; ctx.fill();
  ctx.fillStyle = '#3b2a40'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + 12, by + 8 + i * 19));
};

R.drawCheckpoint = function (ctx, w) {
  const cp = w.L.checkpoint;
  if (!cp) return;
  const x = cp.x, y = cp.y, on = w.cpReal || w.cpFake;
  ctx.fillStyle = '#5c5470'; ctx.fillRect(x - 2, y - 58, 4, 58);
  ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(x, y - 60, 4, 0, 7); ctx.fill();
  const wave = Math.sin(this.time * 6) * 3;
  ctx.fillStyle = on ? '#6fdc98' : '#d9d2e6';
  ctx.beginPath(); ctx.moveTo(x + 2, y - 56); ctx.quadraticCurveTo(x + 16, y - 52 + wave, x + 30, y - 47 + wave); ctx.lineTo(x + 2, y - 38); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3b2a40'; ctx.lineWidth = 1.5; ctx.stroke();
  if (on) { ctx.fillStyle = '#fff'; ctx.font = '700 10px Fredoka, sans-serif'; ctx.fillText('★', x + 9, y - 52); }
};

R.drawDoor = function (ctx, w) {
  const d = w.door, pal = this.pal, p = w.p;
  const x = d.x, y = d.y;
  const hopping = !!d.hop;
  const cornered = w.has.coldFeet && d.hopsLeft === 0;
  ctx.save();
  ctx.translate(x, y);
  if (hopping) ctx.rotate(Math.sin(d.hop.t * Math.PI * 2) * 0.12);
  // feet
  ctx.fillStyle = pal.ink;
  if (hopping) { ctx.fillRect(-11, -4, 4, 8); ctx.fillRect(7, -4, 4, 8); ctx.fillRect(-14, 3, 8, 3); ctx.fillRect(6, 3, 8, 3); }
  // frame and door
  ctx.fillStyle = pal.doorD; rrect(ctx, -19, -50, 38, 50, 16); ctx.fill();
  ctx.fillStyle = pal.door; rrect(ctx, -15, -46, 30, 46, 13); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; rrect(ctx, -11, -42, 8, 20, 4); ctx.fill();
  ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(w.remix && w.remix.mimic ? -9 : 9, -20, 2.6, 0, 7); ctx.fill();
  // face: eyes follow you
  const dx = Math.max(-1, Math.min(1, (p.x + 10 - x) / 200)), dy = Math.max(-1, Math.min(1, (p.y - (y - 30)) / 200));
  const scared = hopping || cornered;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-6, -30, 4.5, scared ? 6 : 5, 0, 0, 7); ctx.ellipse(6, -30, 4.5, scared ? 6 : 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = pal.ink;
  ctx.beginPath(); ctx.arc(-6 + dx * 2, -30 + dy * 2, 2.2, 0, 7); ctx.arc(6 + dx * 2, -30 + dy * 2, 2.2, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,160,0.55)';
  ctx.beginPath(); ctx.ellipse(-10, -23, 3, 2, 0, 0, 7); ctx.ellipse(10, -23, 3, 2, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.6; ctx.beginPath();
  if (scared) ctx.arc(0, -19, 3, Math.PI, 0); else ctx.arc(0, -23, 3, 0.2, Math.PI - 0.2);
  ctx.stroke();
  if (cornered) { ctx.fillStyle = '#8fd8ff'; ctx.beginPath(); ctx.ellipse(15, -40, 2.5, 4, 0, 0, 7); ctx.fill(); }
  ctx.restore();
  // a "exit" tag so nobody wonders what it is
  if (!hopping) {
    ctx.font = '700 11px Fredoka, sans-serif'; ctx.fillStyle = 'rgba(59,42,64,0.75)'; ctx.textAlign = 'center';
    ctx.fillText('EXIT', x, y - 56); ctx.textAlign = 'left';
  }
};

R.drawBonk = function (ctx, b) {
  ctx.fillStyle = '#7c7590'; rrect(ctx, b.x, b.y, 30, 30, 5); ctx.fill();
  ctx.fillStyle = '#a49dba'; rrect(ctx, b.x + 2, b.y + 2, 26, 24, 4); ctx.fill();
  ctx.strokeStyle = '#2b2236'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(b.x + 7, b.y + 9); ctx.lineTo(b.x + 13, b.y + 12); ctx.moveTo(b.x + 23, b.y + 9); ctx.lineTo(b.x + 17, b.y + 12); ctx.stroke();
  ctx.fillStyle = '#2b2236'; ctx.fillRect(b.x + 9, b.y + 14, 3, 3); ctx.fillRect(b.x + 18, b.y + 14, 3, 3);
  ctx.fillRect(b.x + 10, b.y + 21, 10, 2);
};

R.drawPlayer = function (ctx, w) {
  const p = w.p, pal = this.pal;
  const cx = p.x + SL.PW / 2, by = p.y + SL.PH;
  const sx = 1 / Math.sqrt(p.sq), sy = p.sq;
  const rx = 13 * sx, ry = 13 * sy;
  const cy = by - ry;
  if (w.swapped) {
    ctx.strokeStyle = '#9d74ff'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -this.time * 30;
    ctx.beginPath(); ctx.arc(cx, by - 13, 21, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#4b2a8a'; ctx.font = '700 12px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('⇄', cx, by - 40); ctx.textAlign = 'left';
  }
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(cx, by + 1, 11, 3, 0, 0, 7); ctx.fill();
  const look = SL.look || {};
  SL.drawBlob(ctx, { cx, by, sq: p.sq, face: p.face, vy: p.vy, time: this.time, ink: pal.ink, skin: look.skin, hat: look.hat, dye: look.dye, pin: look.pin });
  // trail
  const moving = Math.abs(p.vx) > 60 || !p.grounded;
  this.trailT = (this.trailT || 0) - 1;
  if (moving && look.trail && look.trail !== 'dust' && this.trailT <= 0) {
    this.trailT = look.trail === 'rainbow' ? 0 : 2;
    const q = SL.trailPart(look.trail, cx - p.face * 8, by, this.time);
    if (q) this.parts.push(q);
  }
  void sx; void sy; void rx;
};

R.drawParts = function (ctx, dt) {
  const keep = [];
  for (const q of this.parts) {
    q.life -= dt; if (q.life <= 0) continue;
    q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    const a = Math.max(0, q.life / q.max);
    ctx.globalAlpha = a; ctx.fillStyle = q.color;
    if (q.kind === 'star') {
      const s = q.size * (0.5 + a * 0.5);
      ctx.beginPath(); ctx.moveTo(q.x, q.y - s); ctx.lineTo(q.x + s * 0.3, q.y - s * 0.3); ctx.lineTo(q.x + s, q.y); ctx.lineTo(q.x + s * 0.3, q.y + s * 0.3);
      ctx.lineTo(q.x, q.y + s); ctx.lineTo(q.x - s * 0.3, q.y + s * 0.3); ctx.lineTo(q.x - s, q.y); ctx.lineTo(q.x - s * 0.3, q.y - s * 0.3); ctx.closePath(); ctx.fill();
    } else if (q.kind === 'ring') {
      ctx.strokeStyle = q.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.stroke();
    } else if (q.kind === 'heart') {
      const z = q.size * 0.5; ctx.beginPath(); ctx.moveTo(q.x, q.y + z * 1.6); ctx.bezierCurveTo(q.x - z * 2.4, q.y, q.x - z, q.y - z * 1.6, q.x, q.y - z * 0.4); ctx.bezierCurveTo(q.x + z, q.y - z * 1.6, q.x + z * 2.4, q.y, q.x, q.y + z * 1.6); ctx.fill();
    } else if (q.kind === 'square') {
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    } else if (q.kind === 'text') {
      ctx.font = `700 ${q.size}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#3b2a40'; ctx.strokeText(q.text, q.x, q.y); ctx.fillText(q.text, q.x, q.y); ctx.textAlign = 'left';
    } else if (q.kind === 'soul') {
      ctx.beginPath(); ctx.arc(q.x, q.y, 9, Math.PI, 0); ctx.lineTo(q.x + 9, q.y + 10); for (let i = 0; i < 3; i++) { ctx.lineTo(q.x + 6 - i * 6, q.y + 6); ctx.lineTo(q.x + 3 - i * 6, q.y + 10); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3b2a40'; ctx.fillRect(q.x - 4, q.y - 2, 2, 3); ctx.fillRect(q.x + 2, q.y - 2, 2, 3);
    } else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * a, 0, 7); ctx.fill(); }
    keep.push(q);
  }
  ctx.globalAlpha = 1;
  this.parts = keep;
};

R.drawGlitch = function (ctx) {
  const cv = this.cv, k = this.k;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 5; i++) {
    const h = Math.floor((6 + Math.random() * 30) * k), y = Math.floor(Math.random() * (cv.height - h));
    const dx = Math.floor((Math.random() - 0.5) * 40 * k);
    ctx.drawImage(cv, 0, y, cv.width, h, dx, y, cv.width, h);
  }
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255,0,120,0.12)'; ctx.fillRect(4 * k, 0, cv.width, cv.height);
  ctx.fillStyle = 'rgba(0,220,255,0.10)'; ctx.fillRect(-4 * k, 0, cv.width, cv.height);
  ctx.restore();
};

})(typeof window !== 'undefined' ? window : globalThis);
