// UI, input, saving and the game loop.
(function () {
'use strict';
const SL = window.SL;
const $ = id => document.getElementById(id);
const KEY = 'soreloser_v1';
const IDS = SL.CHEAT_IDS;

// ---------- save ----------
function fresh() {
  return {
    v: 1, runSeed: SL.newSeed(), level: 1, best: 1, totalDeaths: 0, cleared: 0, playTime: 0, sound: true, booted: false,
    diff: 'normal', coins: 0, owned: [], equip: { skin: 'sunny', hat: 'sprout', trail: 'dust', death: 'pop' }, trophies: {}, pityPaid: 0,
    stats2: { clean: 0, hard: 0, rage: 0, maxDeathsCleared: 0, fastest: 0, twists: {}, grabbed: 0 }, sheet: {}, profile: SL.Profile.blank(), history: { bonks: 0, crumbleSurvive: 0, causes: {} }, cur: null, last: [], allCrackedSaid: false
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return Object.assign(fresh(), s);
  } catch (e) { /* storage blocked or corrupt */ }
  return fresh();
}
let save = load();
// Older saves can name cheats that were retired; drop them.
if (!SL.DIFFS[save.diff]) save.diff = 'normal';
save.stats2 = Object.assign({ clean: 0, hard: 0, rage: 0, maxDeathsCleared: 0, fastest: 0, twists: {}, grabbed: 0 }, save.stats2);
save.equip = Object.assign({ skin: 'sunny', hat: 'sprout', trail: 'dust', death: 'pop' }, save.equip);
for (const k in save.equip) if (!SL.ITEM[save.equip[k]]) save.equip[k] = SL.ITEMS.find(i => i.slot === k && i.free).id;
// long-time players: pity coins start from where they are, not from zero
if (!save.pityPaid) save.pityPaid = Math.floor(save.totalDeaths / 50);
SL.look = save.equip;
const owns = id => { const it = SL.ITEM[id]; return !!it && (it.free || save.owned.indexOf(id) >= 0); };
save.last = (save.last || []).filter(id => SL.CHEATS[id]);
if (save.cur && (save.cur.cheats || []).some(id => !SL.CHEATS[id])) save.cur = null;
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }
const sheetOf = id => (save.sheet[id] = save.sheet[id] || { met: false, seen: false, cracked: false });
const crackedCount = () => IDS.filter(id => save.sheet[id] && save.sheet[id].cracked).length;

// ---------- icons ----------
const ICON = {
  coldFeet: '<svg viewBox="0 0 40 40"><rect x="11" y="5" width="18" height="24" rx="8" fill="#9d74ff" stroke="#3b2a40" stroke-width="2.5"/><circle cx="16.5" cy="14" r="2" fill="#3b2a40"/><circle cx="23.5" cy="14" r="2" fill="#3b2a40"/><path d="M15 29l-3 6M25 29l3 6M9 35h6M25 35h6" stroke="#3b2a40" stroke-width="2.5" stroke-linecap="round"/><path d="M4 12h4M3 18h5" stroke="#3b2a40" stroke-width="2" stroke-linecap="round"/></svg>',
  pinholes: '<svg viewBox="0 0 40 40"><rect x="6" y="18" width="28" height="18" rx="3" fill="#e2a96f" stroke="#3b2a40" stroke-width="2.5"/><rect x="6" y="18" width="28" height="6" fill="#6dd08b" stroke="#3b2a40" stroke-width="2.5"/><circle cx="13" cy="21" r="1.8" fill="#3b2a40"/><circle cx="20" cy="21" r="1.8" fill="#3b2a40"/><circle cx="27" cy="21" r="1.8" fill="#3b2a40"/><path d="M11 16l2-9 2 9M18 16l2-9 2 9M25 16l2-9 2 9" fill="#eef2fb" stroke="#3b2a40" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  shouting: '<svg viewBox="0 0 40 40"><rect x="18" y="20" width="4" height="16" fill="#8a5a3a" stroke="#3b2a40" stroke-width="2"/><rect x="5" y="6" width="30" height="17" rx="4" fill="#c99263" stroke="#3b2a40" stroke-width="2.5"/><path d="M20 9v7" stroke="#3b2a40" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="19.5" r="1.6" fill="#3b2a40"/></svg>',
  headache: '<svg viewBox="0 0 40 40"><rect x="11" y="2" width="18" height="15" rx="3" fill="#a49dba" stroke="#3b2a40" stroke-width="2.5"/><path d="M15 7l4 2M25 7l-4 2" stroke="#3b2a40" stroke-width="2" stroke-linecap="round"/><ellipse cx="20" cy="30" rx="9" ry="8" fill="#ffcb3d" stroke="#3b2a40" stroke-width="2.5"/><path d="M8 20l3 2M32 20l-3 2M20 19v-1" stroke="#3b2a40" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="29" r="1.4" fill="#3b2a40"/><circle cx="23" cy="29" r="1.4" fill="#3b2a40"/></svg>',
  secretFloor: '<svg viewBox="0 0 40 40"><path d="M2 24h7v14H2zM31 24h7v14h-7z" fill="#e2a96f" stroke="#3b2a40" stroke-width="2.2"/><path d="M9 24h22" stroke="#3b2a40" stroke-width="2.2" stroke-dasharray="3 3"/><path d="M14 13l1.2 2.6 2.6 1.2-2.6 1.2L14 20.6l-1.2-2.6-2.6-1.2 2.6-1.2zM26 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#ffcb3d" stroke="#3b2a40" stroke-width="1.3"/></svg>',
  mimic: '<svg viewBox="0 0 40 40"><rect x="10" y="5" width="20" height="30" rx="9" fill="#9d74ff" stroke="#3b2a40" stroke-width="2.5"/><circle cx="14.5" cy="21" r="2" fill="#ffd84d"/><path d="M13 27l3-3 3 3 3-3 3 3 3-3" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M15 13l4 2M25 13l-4 2" stroke="#3b2a40" stroke-width="2.2" stroke-linecap="round"/></svg>',
  ceilingTeeth: '<svg viewBox="0 0 40 40"><rect x="3" y="4" width="34" height="11" rx="2" fill="#e2a96f" stroke="#3b2a40" stroke-width="2.5"/><path d="M14 15v-4M26 15v-4" stroke="#3b2a40" stroke-width="2"/><path d="M10 15l4 12 4-12zM22 15l4 8 4-8z" fill="#eef2fb" stroke="#3b2a40" stroke-width="2" stroke-linejoin="round"/><path d="M14 31v4M26 27v4" stroke="#3b2a40" stroke-width="2" stroke-linecap="round" stroke-dasharray="2 2"/></svg>',
  shyLedge: '<svg viewBox="0 0 40 40"><rect x="8" y="22" width="24" height="8" rx="4" fill="#ff9cc0" stroke="#3b2a40" stroke-width="2.5"/><circle cx="16" cy="26" r="1.8" fill="#3b2a40"/><circle cx="24" cy="26" r="1.8" fill="#3b2a40"/><path d="M20 6v10M16 12l4 4 4-4" fill="none" stroke="#3b2a40" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 35h28" stroke="#3b2a40" stroke-width="2" stroke-dasharray="3 3"/></svg>',
  swapZone: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="#c9a7ff" stroke="#3b2a40" stroke-width="2.5"/><path d="M20 20m-2 0a2 2 0 1 1 4 0a4 4 0 1 1-8 0a6 6 0 1 1 12 0a8 8 0 1 1-16 0" fill="none" stroke="#3b2a40" stroke-width="2" stroke-linecap="round"/></svg>',
  impatient: '<svg viewBox="0 0 40 40"><path d="M5 22h12l-2 14H7zM23 22h12l-2 6h-8z" fill="#e2a96f" stroke="#3b2a40" stroke-width="2.5" stroke-linejoin="round"/><path d="M5 22h12M23 22h12" stroke="#6dd08b" stroke-width="4"/><path d="M11 6v8M8 9l3-3 3 3M29 6l-2 4M33 9l-3 3" stroke="#3b2a40" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>',
  copycat: '<svg viewBox="0 0 40 40"><ellipse cx="14" cy="24" rx="9" ry="9" fill="#5a4a66" opacity=".75"/><ellipse cx="25" cy="23" rx="10" ry="10" fill="#ffcb3d" stroke="#3b2a40" stroke-width="2.5"/><circle cx="23" cy="21" r="1.8" fill="#3b2a40"/><circle cx="29" cy="21" r="1.8" fill="#3b2a40"/><circle cx="11" cy="22" r="1.5" fill="#ff4f6e"/><circle cx="16" cy="22" r="1.5" fill="#ff4f6e"/></svg>',
  falseFloor: '<svg viewBox="0 0 40 40"><path d="M3 18h12v18H3zM25 18h12v18H25z" fill="#e2a96f" stroke="#3b2a40" stroke-width="2.5"/><path d="M3 18h12M25 18h12" stroke="#6dd08b" stroke-width="4"/><path d="M15 18h10" stroke="#6dd08b" stroke-width="4" stroke-dasharray="3 3"/><path d="M20 22v10M16 28l4 4 4-4" fill="none" stroke="#3b2a40" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rotten: '<svg viewBox="0 0 40 40"><rect x="7" y="14" width="26" height="9" rx="4.5" fill="#ff9cc0" stroke="#3b2a40" stroke-width="2.5"/><circle cx="14" cy="18" r="2" fill="#6e963c"/><circle cx="24" cy="19" r="2.4" fill="#6e963c"/><path d="M17 23l2 5-3 4M24 23l-1 6 3 3" stroke="#3b2a40" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M12 8c2-2 4 2 6 0M22 7c2-2 4 2 6 0" stroke="#6e963c" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  invisBlock: '<svg viewBox="0 0 40 40"><rect x="13" y="4" width="16" height="16" rx="3" fill="none" stroke="#3b2a40" stroke-width="2.2" stroke-dasharray="3 3"/><circle cx="17" cy="31" r="7" fill="#ffcb3d" stroke="#3b2a40" stroke-width="2.5"/><path d="M14 22l-3-3M20 22l1-4M24 24l4-2" stroke="#3b2a40" stroke-width="2" stroke-linecap="round"/></svg>',
  runaway: '<svg viewBox="0 0 40 40"><path d="M18 16h18v20H18z" fill="#e2a96f" stroke="#3b2a40" stroke-width="2.5"/><path d="M18 16h18" stroke="#6dd08b" stroke-width="4"/><path d="M4 20h9M6 25h7M4 30h9" stroke="#3b2a40" stroke-width="2.2" stroke-linecap="round"/><path d="M26 8h8M31 5l3 3-3 3" fill="none" stroke="#3b2a40" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lunger: '<svg viewBox="0 0 40 40"><path d="M16 32l7-18 7 18z" fill="#eef2fb" stroke="#3b2a40" stroke-width="2.3" stroke-linejoin="round"/><circle cx="21" cy="25" r="1.5" fill="#ff4f6e"/><circle cx="25" cy="25" r="1.5" fill="#ff4f6e"/><path d="M3 22h9M5 27h8M3 32h9" stroke="#3b2a40" stroke-width="2.2" stroke-linecap="round"/><path d="M2 33h36" stroke="#3b2a40" stroke-width="2.5"/></svg>',
  spikeWall: '<svg viewBox="0 0 40 40"><rect x="2" y="3" width="12" height="34" fill="#4a1735" stroke="#3b2a40" stroke-width="2.5"/><path d="M14 5l8 4-8 4M14 15l8 4-8 4M14 25l8 4-8 4" fill="#eef2fb" stroke="#3b2a40" stroke-width="2" stroke-linejoin="round"/><circle cx="31" cy="24" r="6" fill="#ffcb3d" stroke="#3b2a40" stroke-width="2.3"/><path d="M27 15l6 3" stroke="#3b2a40" stroke-width="2" stroke-linecap="round"/></svg>',
  backwardsFlag: '<svg viewBox="0 0 40 40"><path d="M14 4v32" stroke="#3b2a40" stroke-width="3" stroke-linecap="round"/><path d="M15 5c6 2 10 0 16 3l-4 5 4 5c-6-3-10-1-16-3z" fill="#6fdc98" stroke="#3b2a40" stroke-width="2.2" stroke-linejoin="round"/><path d="M36 30H22m0 0l4-4m-4 4l4 4" stroke="#3b2a40" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const UNKNOWN_ICON = '<svg viewBox="0 0 40 40"><text x="20" y="28" font-size="24" font-weight="700" text-anchor="middle" fill="#3b2a40" font-family="Fredoka,sans-serif">?</text></svg>';

// ---------- the game's face ----------
const FACES = {
  happy: { eyes: 'M21 26a3.5 3.5 0 1 0 0.01 0zM43 26a3.5 3.5 0 1 0 0.01 0z', mouth: 'M24 35q8 7 16 0', brows: '' },
  smug: { eyes: 'M18 28h7v2h-7zM39 28h7v2h-7z', mouth: 'M25 37q9 2 15-4', brows: 'M18 24l7 1M39 25l7-1' },
  angry: { eyes: 'M21 29a3 3 0 1 0 0.01 0zM43 29a3 3 0 1 0 0.01 0z', mouth: 'M25 39q7-5 14 0', brows: 'M17 22l8 4M47 22l-8 4' },
  glitch: { eyes: 'M18 25l6 6M24 25l-6 6M40 25l6 6M46 25l-6 6', mouth: 'M24 38h4l2-3 3 5 2-3h5', brows: '' },
  shock: { eyes: 'M21 23a4 5 0 1 0 0.01 0zM43 23a4 5 0 1 0 0.01 0z', mouth: 'M29 37a3 3 0 1 0 0.01 0z', brows: 'M17 19l7-1M40 18l7 1' }
};
function setFace(mood) {
  const f = FACES[mood] || FACES.happy;
  $('f-eyes').setAttribute('d', f.eyes);
  $('f-mouth').setAttribute('d', f.mouth);
  $('f-brows').setAttribute('d', f.brows);
  const isLine = mood === 'smug' || mood === 'glitch';
  $('f-eyes').setAttribute('class', isLine ? 'f-line' : 'f-eye');
}
const moodForTier = t => ['happy', 'smug', 'angry', 'glitch', 'glitch'][t];

// ---------- voice box ----------
const voice = { q: [], cur: null, shown: 0, hold: 0, blip: 0 };
function say(text, mood, opts) {
  opts = opts || {};
  const item = { text, mood: mood || 'happy', hold: opts.hold || 2.4, prio: opts.prio || 1 };
  if (voice.cur && item.prio > voice.cur.prio) { voice.q.unshift(item); voice.cur = null; }
  else if (voice.q.length < 3) voice.q.push(item);
}
function voiceTick(dt) {
  const el = $('voice');
  if (!voice.cur && voice.q.length) {
    voice.cur = voice.q.shift(); voice.shown = 0; voice.hold = voice.cur.hold;
    setFace(voice.cur.mood);
    el.className = 'voice on talking mood-' + voice.cur.mood;
  }
  if (!voice.cur) { el.classList.remove('on', 'talking'); return; }
  const c = voice.cur;
  if (voice.shown < c.text.length) {
    const before = Math.floor(voice.shown);
    voice.shown = Math.min(c.text.length, voice.shown + dt * 46);
    if (Math.floor(voice.shown) !== before && Math.floor(voice.shown) % 3 === 0) SL.Audio.play('blip');
    $('vtext').textContent = c.text.slice(0, Math.floor(voice.shown));
    if (voice.shown >= c.text.length) el.classList.remove('talking');
  } else {
    voice.hold -= dt;
    if (voice.hold <= 0) voice.cur = null;
  }
}
function hushVoice() { voice.q = []; voice.cur = null; $('voice').classList.remove('on', 'talking'); }
let quipCd = 0;
function quip(pool, mood, vars) { if (quipCd > 0) return; quipCd = 2.2; say(SL.say(pool, vars), mood); }

// ---------- toasts ----------
function toast(kind, label, title, icon) {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = `<div class="ti">${icon}</div><div><small>${label}</small><b></b></div>`;
  t.querySelector('b').textContent = title;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

// ---------- layout ----------
const cv = $('cv');
const R = new SL.Renderer(cv);
function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = vh > vw;
  const pad = (vw < 700 || vh < 500) ? 0 : 24;
  // phones held upright: the game sits at the top and the controls get the space below it
  const reserve = touchy && portrait ? Math.min(220, vh * 0.34) : 0;
  // upright phones: show fewer tiles across (but all 15 rows) so everything stays big enough to read
  const availW = vw - pad * 2, availH = vh - pad * 2 - reserve;
  const viewW = touchy && portrait ? Math.round(Math.max(352, Math.min(SL.VIEW_W, SL.VIEW_H * availW / availH))) : SL.VIEW_W;
  R.setViewW(viewW);
  const s = Math.min(availW / viewW, availH / SL.VIEW_H);
  document.body.classList.toggle('portrait', portrait);
  const w = Math.floor(viewW * s), h = Math.floor(SL.VIEW_H * s);
  $('stage').style.width = w + 'px'; $('stage').style.height = h + 'px';
  $('stage').style.borderRadius = pad ? '18px' : '0';
  R.resize(w, h);
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => setTimeout(layout, 150));
let touchy = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || /[?&]touch=1/.test(location.search);
if (touchy) document.body.classList.add('touchy');

// ---------- state ----------
let mode = 'title';   // title | play | pause | clear
let overlay = null;   // sheet | dossier | null (on top of any mode)
let world = null, levelTime = 0, levelInfo = null, attract = null, attractCam = 0;
const input = { left: false, right: false, jump: false, jumpPressed: false, down: false };

function show(id, on) { $(id).hidden = !on; }
function refreshCounts() {
  const n = crackedCount() + '/' + IDS.length;
  $('h-sheet-n').textContent = n; $('t-sheet-n').textContent = n;
  for (const id of ['t-coins', 'h-coins']) $(id).textContent = save.coins;
  $('t-best').textContent = save.best; $('t-deaths').textContent = save.totalDeaths; $('t-seed').textContent = save.runSeed;
  $('t-play').textContent = save.level > 1 ? `Continue · Level ${save.level}` : 'Play';
  for (const b of document.querySelectorAll('#t-diff button')) b.setAttribute('aria-pressed', String(b.dataset.d === save.diff));
  $('t-diff-blurb').textContent = SL.DIFFS[save.diff].blurb;
  const snd = save.sound ? 'Sound on' : 'Sound off';
  for (const id of ['t-sound', 'p-sound']) { $(id).textContent = snd; $(id).setAttribute('aria-pressed', String(save.sound)); }
}

function levelPlan(level) {
  if (save.cur && save.cur.level === level && save.cur.seed === save.runSeed && save.cur.diff === save.diff) return save.cur;
  const pick = SL.Profile.choose(level, save.sheet, save.profile, save.last, save.runSeed, save.diff);
  save.cur = { level, seed: save.runSeed, diff: save.diff, cheats: pick.cheats, reasons: pick.reasons, intro: pick.intro };
  if (pick.intro) sheetOf(pick.intro).met = true;
  persist();
  return save.cur;
}

function makeWorld(level) {
  const plan = levelPlan(level);
  const L = SL.buildLevel(save.runSeed, level, plan.cheats, save.diff);
  return { world: new SL.World(L, save.history), plan };
}

function setupAttract() {
  try {
    const { world: w } = makeWorld(save.level);
    attract = w; attractCam = 0;
    R.setWorld(attract);
  } catch (e) { attract = null; }
}

function startLevel(level, restart) {
  if (world && !world.won && mode !== 'clear') commitStats();
  const made = makeWorld(level);
  world = made.world; levelInfo = made.plan; levelTime = 0;
  R.setWorld(world);
  mode = 'play'; overlay = null;
  for (const s of ['s-title', 's-pause', 's-clear', 's-sheet', 's-dossier', 's-shop', 's-trophies']) show(s, false);
  show('hud', true); show('touch', touchy);
  $('h-level').textContent = level; $('h-deaths').textContent = 0; $('h-seed').textContent = save.runSeed;
  $('h-diff').textContent = SL.DIFFS[save.diff].name; $('h-diff').parentNode.className = 'chip diff-' + save.diff;
  const tw = world.L.twist ? SL.TWISTS[world.L.twist] : null;
  show('h-twist-chip', !!tw); if (tw) $('h-twist').textContent = tw.name;
  hushVoice();
  const tier = SL.tierOf(level), mood = SL.MOODS[tier];
  if (!save.booted) {
    save.booted = true; persist();
    for (const [t, m] of SL.VOICE.firstBoot) say(t, m, { hold: 2.2 });
  } else if (!restart) {
    say(SL.say(SL.VOICE.start[mood], { n: level }), moodForTier(tier), { hold: 2.4 });
    if (levelInfo.reasons && levelInfo.reasons.length) say(levelInfo.reasons[0], 'smug', { hold: 3.2 });
  }
  if (!restart && world.L.twist) say(SL.TWISTS[world.L.twist].say, 'smug', { hold: 2.6 });
  refreshCounts();
}

// Folds the running world stats into the lifetime profile.
function commitStats() {
  if (!world) return;
  SL.Profile.merge(save.profile, world.stats);
  save.totalDeaths += world.stats.deaths;
  world.stats = SL.Profile.blankStats();
  persist();
}

// ---------- world events ----------
function handle(e) {
  R.event(e);
  const tier = world.L.tier, mood = SL.MOODS[tier];
  switch (e.type) {
    case 'jump': SL.Audio.play('jump'); break;
    case 'land': SL.Audio.play('land'); break;
    case 'head': SL.Audio.play('head'); break;
    case 'death': {
      SL.Audio.play('die');
      $('h-deaths').textContent = world.stats.deaths;
      const live = save.totalDeaths + world.stats.deaths;
      if (Math.floor(live / 50) > save.pityPaid) {
        save.pityPaid = Math.floor(live / 50); save.coins += 10; persist(); refreshCounts();
        toast('coin', 'Pity coins', '+10 Spite Coins', COIN_ICON);
        say(SL.say(SL.VOICE.pity, { n: live }), 'smug', { prio: 3, hold: 2.6 });
        break;
      }
      checkTrophies(live);
      const fake = world.cpFake && !world.cpReal;
      if (fake) say(SL.say(SL.VOICE.fakeSave), 'smug', { prio: 2 });
      else if (e.cause === 'ceilSpike') say(SL.say(SL.VOICE.death.ceilSpike), 'smug', { prio: 2 });
      else if (Math.random() < 0.7) quip(SL.VOICE.death[e.cause] || SL.VOICE.death.pit, e.cause === 'pit' || e.cause === 'spike' ? 'happy' : 'smug');
      break;
    }
    case 'flee':
      SL.Audio.play('flee');
      quip(e.left === 0 ? SL.VOICE.trigger.fleeLast : SL.VOICE.trigger.flee, e.left === 0 ? 'shock' : 'smug');
      break;
    case 'crumble': SL.Audio.play('crumble'); quip(SL.VOICE.trigger.crumble, 'smug'); break;
    case 'bonkDrop': SL.Audio.play('drop'); break;
    case 'bonk': SL.Audio.play('bonk'); quip(SL.VOICE.trigger.bonk, 'smug'); break;
    case 'pop': SL.Audio.play('pop'); break;
    case 'checkpoint':
      SL.Audio.play('save');
      if (!world.has.backwardsFlag) say('Checkpoint saved.', 'happy', { hold: 1.6 });
      else say(SL.say(e.real ? SL.VOICE.trigger.savedReal : SL.VOICE.trigger.savedFake), e.real ? 'angry' : 'happy', { prio: 2, hold: 1.8 });
      break;
    case 'sign': SL.Audio.play('click'); break;
    case 'down':
      if (world.L.level === 1 && !world.saidDown) { world.saidDown = true; say(SL.say(SL.VOICE.trigger.down), 'smug', { prio: 2 }); }
      break;
    case 'idle': quip(SL.VOICE.trigger.idle, 'smug'); break;
    case 'dodge': SL.Audio.play('flee'); quip(SL.VOICE.trigger.dodge, 'smug'); break;
    case 'swap': SL.Audio.play(e.on ? 'seen' : 'save'); quip(e.on ? SL.VOICE.trigger.swapOn : SL.VOICE.trigger.swapOff, e.on ? 'smug' : 'angry'); break;
    case 'shake': SL.Audio.play('crumble'); quip(SL.VOICE.trigger.shake, 'smug'); break;
    case 'floorDrop': SL.Audio.play('drop'); break;
    case 'wake': SL.Audio.play('seen'); if (!world.saidWake) { world.saidWake = true; say(SL.say(SL.VOICE.trigger.wake), 'smug', { prio: 2 }); } break;
    case 'tooth': SL.Audio.play('drop'); break;
    case 'coin': SL.Audio.play('coin'); $('h-coins').textContent = save.coins + world.coinsGot.size * 5; bumpEl('h-coin-chip'); break;
    case 'reveal': SL.Audio.play('bonk'); quip(SL.VOICE.trigger.reveal, 'smug'); break;
    case 'lunge': SL.Audio.play('flee'); quip(SL.VOICE.trigger.lunge, 'smug'); break;
    case 'wallWake': SL.Audio.play('seen'); if (!world.saidWall) { world.saidWall = true; say(SL.say(SL.VOICE.trigger.wallWake), 'smug', { prio: 2 }); } break;
    case 'quake': SL.Audio.play('crumble'); quip(SL.VOICE.trigger.quake, 'smug'); break;
    case 'toothLand': SL.Audio.play('pop'); break;
    case 'seen': {
      const s = sheetOf(e.id);
      if (!s.seen) {
        s.seen = true; persist();
        SL.Audio.play('seen');
        toast('spot', 'New cheat spotted', s.cracked ? SL.CHEATS[e.id].name : '???', ICON[e.id]);
        bump();
      }
      break;
    }
    case 'discover': {
      const s = sheetOf(e.id);
      s.seen = true;
      if (!s.cracked) {
        s.cracked = true; s.crackedAt = world.L.level; s.fresh = true; persist();
        SL.Audio.play('crack');
        toast('crack', 'Cheat cracked', SL.CHEATS[e.id].name, ICON[e.id]);
        say(SL.VOICE.discover[e.id], 'angry', { prio: 3, hold: 3 });
        bump(); refreshCounts();
        if (crackedCount() === IDS.length && !save.allCrackedSaid) { save.allCrackedSaid = true; persist(); say(SL.VOICE.allCracked, 'glitch', { hold: 3.4 }); }
      }
      break;
    }
    case 'win': {
      SL.Audio.play('win');
      setTimeout(finishLevel, 650);
      break;
    }
  }
  void mood;
}
function bumpEl(id) { const b = $(id); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
function bump() { const b = $('h-sheet'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }

function finishLevel() {
  const L = world.L, st = world.stats;
  const deaths = st.deaths, jumps = st.jumps;
  const grabbed = world.coinsGot.size;
  const pay = SL.payout(L.level, deaths, grabbed, L.diff, L.twist);
  save.coins += pay.total;
  const s2 = save.stats2;
  s2.grabbed += grabbed;
  if (!deaths) s2.clean++;
  if (L.diff === 'hard') s2.hard++;
  if (L.diff === 'rage') s2.rage++;
  s2.maxDeathsCleared = Math.max(s2.maxDeathsCleared, deaths);
  if (!s2.fastest || levelTime < s2.fastest) s2.fastest = levelTime;
  if (L.twist) s2.twists[L.twist] = true;
  commitStats();
  save.profile.levels++;
  if (L.checkpoint) save.profile.cpLevels++;
  save.cleared++;
  save.last = L.cheats.slice();
  save.level = L.level + 1;
  save.best = Math.max(save.best, save.level);
  save.cur = null;
  persist();
  hushVoice();
  // card
  const tier = L.tier;
  $('c-eyebrow').textContent = 'Level ' + L.level;
  $('c-quote').textContent = '"' + SL.say(SL.VOICE.win[SL.MOODS[tier]], { n: L.level }) + '"';
  const m = Math.floor(levelTime / 60), s = Math.floor(levelTime % 60);
  $('c-time').textContent = m + ':' + String(s).padStart(2, '0');
  $('c-deaths').textContent = deaths; $('c-jumps').textContent = jumps;
  $('c-pay').innerHTML = pay.rows.map(([k, v]) => `<div><span>${k}</span><b>+${v}</b></div>`).join('') + `<div class="pay-total"><span>Spite Coins</span><b>+${pay.total}</b></div>`;
  setTimeout(() => checkTrophies(save.totalDeaths), 400);
  $('c-used').innerHTML = '';
  for (const id of L.cheats) {
    const sh = sheetOf(id), C = SL.CHEATS[id];
    const row = document.createElement('div');
    const met = world.seen[id] || sh.cracked;
    row.className = 'used-row ' + (sh.cracked ? 'cracked' : met ? 'seen' : 'unknown');
    row.innerHTML = `<div class="ci">${met ? ICON[id] : UNKNOWN_ICON}</div><div><b></b><span></span></div>`;
    row.querySelector('b').textContent = sh.cracked ? C.name : '???';
    row.querySelector('span').textContent = sh.cracked ? C.rule : met ? C.symptom + ' Rule not cracked yet.' : 'It was here. You never noticed.';
    $('c-used').appendChild(row);
  }
  mode = 'clear';
  show('hud', false); show('touch', false);
  show('s-clear', true);
  refreshCounts();
  setTimeout(() => $('c-next').focus(), 50);
}

// ---------- cheat sheet ----------
function renderSheet() {
  const box = $('sheet-cards');
  box.innerHTML = '';
  const n = crackedCount();
  $('sheet-bar').style.width = (n / IDS.length * 100) + '%';
  $('sheet-count').textContent = `${n} of ${IDS.length} cracked`;
  for (const id of SL.INTRO_ORDER) {
    const s = save.sheet[id] || {}, C = SL.CHEATS[id];
    const st = s.cracked ? 'cracked' : s.seen ? 'seen' : 'locked';
    const card = document.createElement('article');
    card.className = 'card ' + st + (s.fresh ? ' fresh' : '');
    s.fresh = false;
    const label = { cracked: 'Cracked', seen: 'Spotted', locked: s.met ? 'Unseen' : 'Locked' }[st];
    card.innerHTML = `<span class="st">${label}</span><div class="ci">${st === 'locked' ? UNKNOWN_ICON : ICON[id]}</div><h4></h4><p class="sym"></p><p class="rule"></p><p class="how"></p>`;
    card.querySelector('h4').textContent = st === 'cracked' ? C.name : st === 'seen' ? '???' : 'Unknown cheat';
    card.querySelector('.sym').textContent = st === 'locked' ? (s.met ? 'It was in a level you played. You did not see it.' : 'Not met yet. Keep climbing.') : C.symptom;
    const rule = card.querySelector('.rule');
    if (st === 'cracked') rule.textContent = C.rule;
    else { const r = document.createElement('span'); r.className = 'redact'; r.textContent = C.rule.replace(/\S/g, 'x'); rule.appendChild(r); }
    card.querySelector('.how').textContent = st === 'cracked' ? `Cracked on level ${s.crackedAt || '?'}` : st === 'seen' ? 'To crack: ' + C.crack : '';
    box.appendChild(card);
  }
  persist();
}

// ---------- dossier ----------
function renderDossier() {
  const p = save.profile, tr = SL.Profile.traits(p), n = tr.n;
  const rows = [
    ['Jumpiness', tr.jumpy, `${n.jps.toFixed(2)} jumps/s`, '#ffcb3d', 'Feeds: Rotten Platforms, Headache Block, Shy Ledge, Runaway Floor, Invisible Block'],
    ['Caution', tr.caution, `${n.idlePct}% standing still`, '#8ed0ff', 'Feeds: Pinholes, Cold Feet, Ceiling Teeth, Impatient Floor, Spike Wall'],
    ['Gullibility', tr.gullible, `${n.trustPct}% signs believed`, '#ff7aa8', 'Feeds: Shouting Signs, Mimic'],
    ['Stubbornness', tr.stubborn, `${n.dpl.toFixed(1)} deaths/level`, '#ff9c6b', 'Feeds: Wrong Way, Copycat'],
    ['Flag reliance', tr.flagLove, `${p.cpTouches} flags touched`, '#6fdc98', 'Feeds: Backwards Flag'],
    ['Spike trouble', tr.spikey, `${(p.causes.spike || 0) + (p.causes.ceilSpike || 0) + (p.causes.pinholes || 0) + (p.causes.lunger || 0) + (p.causes.saw || 0)} spike deaths`, '#c9c3d6', 'Feeds: Lunging Spike'],
    ['Pit trouble', tr.falls, `${(p.causes.pit || 0) + (p.causes.secretFloor || 0) + (p.causes.rotten || 0) + (p.causes.falseFloor || 0) + (p.causes.runaway || 0)} falls`, '#9d74ff', 'Feeds: Secret Floor, False Floor']
  ];
  $('d-traits').innerHTML = '';
  for (const [name, v, num, col, feeds] of rows) {
    const d = document.createElement('div');
    d.className = 'trait';
    const masked = feeds.replace(/Feeds: /, '').split(', ').map(nm => {
      const id = IDS.find(i => SL.CHEATS[i].name === nm);
      return save.sheet[id] && save.sheet[id].cracked ? nm : '???';
    }).join(', ');
    d.innerHTML = `<div class="trait-top">${name}<span>${num}</span></div><div class="bar"><i style="width:0;background:${col}"></i></div><p>Feeds: ${masked}</p>`;
    $('d-traits').appendChild(d);
    requestAnimationFrame(() => { d.querySelector('i').style.width = Math.round(4 + v * 96) + '%'; });
  }
  // plan: the director's current weights, in words
  const plan = $('d-plan');
  plan.innerHTML = '';
  const lines = [];
  for (const id of IDS) {
    const D = SL.Profile.DRIVERS[id];
    const w = tr[D.trait];
    const known = save.sheet[id] && save.sheet[id].seen;
    lines.push({ w, text: D.say(n), name: known ? SL.CHEATS[id].name : '???' });
  }
  lines.sort((a, b) => b.w - a.w);
  const top = save.profile.levels < 1 ? [{ text: 'Not enough data. Play a level and I will start taking notes.', name: '' }] : lines.slice(0, 3);
  for (const l of top) {
    const li = document.createElement('li');
    li.textContent = l.text + ' ';
    if (l.name) { const b = document.createElement('b'); b.textContent = '→ ' + l.name; li.appendChild(b); }
    plan.appendChild(li);
  }
  const hrs = Math.floor((p.time) / 60);
  const stats = [['Levels cleared', save.cleared], ['Best level', save.best], ['Deaths', save.totalDeaths], ['Jumps', p.jumps], ['Minutes played', hrs], ['Cheats cracked', crackedCount() + '/' + IDS.length]];
  $('d-stats').innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}

// ---------- shop ----------
const COIN_ICON = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="#ffd84d" stroke="#3b2a40" stroke-width="3"/><rect x="14" y="15" width="3" height="3" fill="#3b2a40"/><rect x="23" y="15" width="3" height="3" fill="#3b2a40"/><path d="M14 25q6 3 12-1" stroke="#3b2a40" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>';
let shopTab = 'skin';
function preview(cv, look) {
  const ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = 72 * dpr; cv.height = 72 * dpr;
  ctx.setTransform(dpr * 1.35, 0, 0, dpr * 1.35, 0, 0);
  ctx.clearRect(0, 0, 72, 72);
  SL.drawBlob(ctx, { cx: 26.7, by: 47, face: 1, time: performance.now() / 1000, skin: look.skin, hat: look.hat });
}
function lookFor(it) {
  const l = Object.assign({}, save.equip);
  if (it.slot === 'skin') l.skin = it.id; if (it.slot === 'hat') l.hat = it.id;
  return l;
}
function renderShop() {
  $('shop-coins').textContent = save.coins;
  $('shop-tabs').innerHTML = SL.SLOTS.map(([k, n]) => `<button type="button" data-tab="${k}" aria-pressed="${k === shopTab}">${n}</button>`).join('');
  for (const b of $('shop-tabs').querySelectorAll('button')) b.onclick = () => { shopTab = b.dataset.tab; SL.Audio.play('click'); renderShop(); };
  const box = $('shop-items');
  box.innerHTML = '';
  for (const it of SL.ITEMS.filter(i => i.slot === shopTab)) {
    const own = owns(it.id), on = save.equip[it.slot] === it.id;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'item' + (on ? ' on' : '') + (own ? ' own' : '') + (it.trophy && !own ? ' locked' : '');
    const tr = it.trophy && SL.TROPHIES.find(t => t.id === it.trophy);
    const tag = on ? 'Wearing' : own ? 'Wear' : it.trophy ? 'Trophy: ' + tr.name : `<i>${it.price}</i>`;
    card.innerHTML = `<canvas width="72" height="72"></canvas><b></b><span class="tag">${tag}</span>`;
    card.querySelector('b').textContent = it.name;
    const cv = card.querySelector('canvas');
    if (it.slot === 'skin' || it.slot === 'hat') preview(cv, lookFor(it));
    else { cv.replaceWith(Object.assign(document.createElement('div'), { className: 'fx-ico', textContent: { dust: '··', sparkle: '✦', bubbles: '○', hearts: '♥', rainbow: '≋', flames: '🔥', pop: '✺', confetti: '✱', oof: 'OOF', pixels: '▦', soul: '👻', nope: 'QUIT' }[it.id] || '?' })); }
    card.onclick = () => buy(it);
    box.appendChild(card);
  }
  // the troll shelf
  for (const t of SL.TROLL_ITEMS) {
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'item troll';
    card.innerHTML = `<div class="fx-ico">?</div><b></b><span class="tag">${t.sold ? 'Sold out' : '<i>' + t.price + '</i>'}</span>`;
    card.querySelector('b').textContent = t.name;
    card.onclick = () => { SL.Audio.play('bonk'); shopSay(t.say); };
    box.appendChild(card);
  }
}
function shopSay(text) { const el = $('shop-say'); el.textContent = '“' + text + '”'; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function buy(it) {
  if (owns(it.id)) {
    save.equip[it.slot] = it.id; SL.look = save.equip; persist();
    SL.Audio.play('click'); renderShop(); return;
  }
  if (it.trophy) { SL.Audio.play('head'); shopSay('Not for sale. Earn it. Check the trophies.'); return; }
  if (save.coins < it.price) { SL.Audio.play('head'); shopSay(SL.say(SL.VOICE.broke, { n: it.price - save.coins })); return; }
  save.coins -= it.price; save.owned.push(it.id); save.equip[it.slot] = it.id; SL.look = save.equip; persist();
  SL.Audio.play('crack'); shopSay(SL.say(SL.VOICE.bought));
  refreshCounts(); renderShop(); checkTrophies(save.totalDeaths);
}

// ---------- trophies ----------
function checkTrophies(liveDeaths) {
  const view = Object.assign({}, save, { totalDeaths: liveDeaths !== undefined ? liveDeaths : save.totalDeaths });
  const n = crackedCount();
  for (const t of SL.TROPHIES) {
    if (save.trophies[t.id] || !t.test(view, n)) continue;
    save.trophies[t.id] = { at: Date.now() };
    save.coins += t.coins || 0;
    if (t.item && save.owned.indexOf(t.item) < 0) save.owned.push(t.item);
    persist(); refreshCounts();
    SL.Audio.play('crack');
    toast('trophy', 'Trophy · +' + (t.coins || 0) + (t.item ? ' + ' + SL.ITEM[t.item].name : ''), t.name, TROPHY_ICON);
  }
}
const TROPHY_ICON = '<svg viewBox="0 0 40 40"><path d="M12 6h16v8a8 8 0 0 1-16 0z" fill="#ffd84d" stroke="#3b2a40" stroke-width="2.5"/><path d="M12 9H6q0 7 7 7M28 9h6q0 7-7 7" fill="none" stroke="#3b2a40" stroke-width="2.5"/><path d="M20 22v6M13 34h14l-2-6H15z" fill="#ffd84d" stroke="#3b2a40" stroke-width="2.5" stroke-linejoin="round"/></svg>';
function renderTrophies() {
  const got = SL.TROPHIES.filter(t => save.trophies[t.id]).length;
  $('tro-count').textContent = `${got} of ${SL.TROPHIES.length}`;
  $('tro-bar').style.width = (got / SL.TROPHIES.length * 100) + '%';
  $('tro-list').innerHTML = '';
  for (const t of SL.TROPHIES) {
    const on = !!save.trophies[t.id];
    const row = document.createElement('div');
    row.className = 'trophy' + (on ? ' on' : '');
    const reward = [t.coins ? `+${t.coins} coins` : '', t.item ? SL.ITEM[t.item].name : ''].filter(Boolean).join(' · ');
    row.innerHTML = `<div class="ti">${on ? TROPHY_ICON : UNKNOWN_ICON}</div><div><b></b><span></span></div><em></em>`;
    row.querySelector('b').textContent = t.name;
    row.querySelector('span').textContent = t.desc;
    row.querySelector('em').textContent = reward;
    $('tro-list').appendChild(row);
  }
}

function openOverlay(which) {
  overlay = which;
  ({ sheet: renderSheet, dossier: renderDossier, shop: renderShop, trophies: renderTrophies })[which]();
  if (which === 'shop') $('shop-say').textContent = '“' + SL.say(SL.VOICE.shopHello) + '”';
  show('s-' + which, true);
  setTimeout(() => $('s-' + which).querySelector('[data-close]').focus(), 30);
  SL.Audio.play('click');
}
function closeOverlay() {
  if (!overlay) return;
  show('s-' + overlay, false);
  overlay = null;
  refreshCounts();
}

// ---------- pause / title ----------
function pause() {
  if (mode !== 'play') return;
  mode = 'pause';
  for (const k of ['left', 'right', 'jump', 'down']) input[k] = false;
  $('p-sub').textContent = `Level ${world.L.level} · ${world.stats.deaths} death${world.stats.deaths === 1 ? '' : 's'}`;
  show('s-pause', true);
  setTimeout(() => $('p-resume').focus(), 30);
}
function resume() { if (mode !== 'pause') return; show('s-pause', false); mode = 'play'; }
function toTitle() {
  if (world && !world.won) commitStats();
  world = null; mode = 'title'; overlay = null;
  for (const s of ['s-pause', 's-clear', 's-sheet', 's-dossier', 's-shop', 's-trophies']) show(s, false);
  show('hud', false); show('touch', false); show('s-title', true); show('t-confirm', false);
  hushVoice();
  setupAttract();
  refreshCounts();
}

// ---------- input ----------
const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyK: 'jump',
  ArrowDown: 'down', KeyS: 'down'
};
window.addEventListener('keydown', e => {
  SL.Audio.unlock();
  const k = KEYS[e.code];
  if (mode === 'play' && !overlay && k) {
    e.preventDefault();
    if (k === 'jump' && !input.jump) input.jumpPressed = true;
    input[k] = true;
    return;
  }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (overlay) closeOverlay();
    else if (mode === 'play') pause();
    else if (mode === 'pause') resume();
    return;
  }
  if (e.code === 'KeyC' && (mode === 'play' || mode === 'pause' || mode === 'clear' || mode === 'title')) {
    if (overlay === 'sheet') closeOverlay();
    else { if (mode === 'play') pause(); if (overlay) closeOverlay(); openOverlay('sheet'); }
    return;
  }
  if (e.code === 'KeyR' && mode === 'play' && !overlay) { startLevel(world.L.level, true); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && mode === 'clear' && !overlay && document.activeElement === document.body) { e.preventDefault(); startLevel(save.level); }
});
window.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) input[k] = false; });
window.addEventListener('blur', () => { for (const k of ['left', 'right', 'jump', 'down']) input[k] = false; if (mode === 'play') pause(); });

// Touch: every finger is tracked on its own, and sliding a finger from one button to another
// switches keys without lifting it (left to right, or thumb rolling onto jump).
const fingers = new Map(); // pointerId -> key
const touchBtns = [...document.querySelectorAll('#touch button')];
function keyAt(x, y) {
  let best = null, bestD = 1e9;
  for (const b of touchBtns) {
    const r = b.getBoundingClientRect();
    const pad = 18; // generous hit area around each button
    if (x < r.left - pad || x > r.right + pad || y < r.top - pad || y > r.bottom + pad) continue;
    const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
    if (d < bestD) { bestD = d; best = b.dataset.k; }
  }
  return best;
}
function syncTouch() {
  const held = new Set(fingers.values());
  for (const k of ['left', 'right', 'jump']) {
    const on = held.has(k);
    if (k === 'jump' && on && !input.jump) input.jumpPressed = true;
    input[k] = on;
  }
  for (const b of touchBtns) b.classList.toggle('down', held.has(b.dataset.k));
}
const touchEl = $('touch');
touchEl.addEventListener('pointerdown', e => {
  e.preventDefault(); SL.Audio.unlock();
  try { touchEl.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
  fingers.set(e.pointerId, keyAt(e.clientX, e.clientY)); syncTouch();
  if (navigator.vibrate && fingers.get(e.pointerId) === 'jump') try { navigator.vibrate(8); } catch (err) { /* ignore */ }
});
touchEl.addEventListener('pointermove', e => {
  if (!fingers.has(e.pointerId)) return;
  const k = keyAt(e.clientX, e.clientY);
  if (k !== fingers.get(e.pointerId)) { fingers.set(e.pointerId, k); syncTouch(); }
});
const lift = e => { if (fingers.delete(e.pointerId)) syncTouch(); };
touchEl.addEventListener('pointerup', lift); touchEl.addEventListener('pointercancel', lift);
touchEl.addEventListener('contextmenu', e => e.preventDefault());
// any real touch turns on the on-screen controls, even on laptops with touchscreens
window.addEventListener('touchstart', () => { if (!touchy) { touchy = true; document.body.classList.add('touchy'); if (mode === 'play') show('touch', true); layout(); } }, { passive: true });
// Phones: go fullscreen and ask for landscape when a run starts. Browsers that refuse just keep going.
function goBig() {
  if (!touchy) return;
  const el = document.documentElement;
  const fs = el.requestFullscreen || el.webkitRequestFullscreen;
  if (fs && !document.fullscreenElement) {
    try {
      const pr = fs.call(el, { navigationUI: 'hide' });
      if (pr && pr.then) pr.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
    } catch (err) { /* ignore */ }
  }
}

// buttons
const click = (id, fn) => $(id).addEventListener('click', () => { SL.Audio.unlock(); SL.Audio.play('click'); fn(); });
click('t-play', () => { goBig(); show('s-title', false); startLevel(save.level); });
let pendingDiff = null;
const confirmNew = (d) => {
  pendingDiff = d || save.diff;
  $('t-confirm-msg').textContent = d && d !== save.diff
    ? `Switch to ${SL.DIFFS[d].name}? That starts a new run from level 1. Your Cheat Sheet and Dossier stay.`
    : 'Start again from level 1 with a new seed? Your Cheat Sheet and Dossier stay.';
  show('t-confirm', true); $('t-confirm-yes').focus();
};
click('t-new', () => confirmNew());
for (const b of document.querySelectorAll('#t-diff button')) {
  b.addEventListener('click', () => {
    SL.Audio.unlock(); SL.Audio.play('click');
    const d = b.dataset.d;
    if (d === save.diff) return;
    if (save.level <= 1) { save.diff = d; save.cur = null; persist(); refreshCounts(); setupAttract(); }
    else confirmNew(d);
  });
}
click('t-confirm-no', () => show('t-confirm', false));
click('t-confirm-yes', () => {
  save.diff = pendingDiff || save.diff;
  save.runSeed = SL.newSeed(); save.level = 1; save.cur = null; save.last = []; persist();
  show('t-confirm', false); show('s-title', false);
  startLevel(1);
  say(SL.say(SL.VOICE.newRun), 'smug', { hold: 2 });
});
click('t-sheet', () => openOverlay('sheet'));
click('t-dossier', () => openOverlay('dossier'));
click('t-shop', () => openOverlay('shop'));
click('t-trophies', () => openOverlay('trophies'));
click('c-shop', () => openOverlay('shop'));
click('p-shop', () => openOverlay('shop'));
const toggleSound = () => { save.sound = !save.sound; SL.Audio.on = save.sound; persist(); refreshCounts(); };
click('t-sound', toggleSound); click('p-sound', toggleSound);
click('h-sheet', () => { pause(); openOverlay('sheet'); });
click('h-pause', pause);
click('p-resume', resume);
click('p-restart', () => startLevel(world.L.level, true));
click('p-sheet', () => openOverlay('sheet'));
click('p-dossier', () => openOverlay('dossier'));
click('p-title', toTitle);
click('c-next', () => startLevel(save.level));
click('h-restart', () => { if (mode === 'play') startLevel(world.L.level, true); });
click('c-sheet', () => openOverlay('sheet'));
click('c-dossier', () => openOverlay('dossier'));
click('c-title', toTitle);
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { SL.Audio.play('click'); closeOverlay(); });
for (const s of ['s-sheet', 's-dossier', 's-shop', 's-trophies']) $(s).addEventListener('click', e => { if (e.target === $(s)) closeOverlay(); });

// ---------- loop ----------
let last = performance.now(), acc = 0;
const STEP = 1 / 120;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  quipCd -= dt;
  if (mode === 'play' && !overlay && world) {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 12) {
      world.update(STEP, input);
      input.jumpPressed = false;
      for (const e of world.events) handle(e);
      world.events.length = 0;
      acc -= STEP; steps++;
      if (mode !== 'play') break;
    }
    if (!world.won) levelTime += dt;
    save.playTime += dt;
    R.draw(dt);
  } else if (world && (mode === 'pause' || mode === 'clear' || overlay)) {
    R.draw(0);
  } else if (mode === 'title' && attract) {
    attractCam += dt * 38;
    const maxCam = attract.L.w * SL.TILE - R.viewW;
    if (attractCam > maxCam) attractCam = 0;
    attract.platMove(0); attract.t += dt;
    R.draw(dt, { camX: attractCam, hidePlayer: attractCam > 300 });
  }
  voiceTick(dt);
  requestAnimationFrame(frame);
}

// ---------- boot ----------
SL.debug = { get world() { return world; }, input, get save() { return save; }, startLevel };
SL.Audio.on = save.sound;
layout();
setupAttract();
refreshCounts();
setTimeout(() => checkTrophies(), 900); // anything already earned pays out on boot
requestAnimationFrame(frame);
})();
