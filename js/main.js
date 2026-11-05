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
    stats2: { clean: 0, hard: 0, rage: 0, maxDeathsCleared: 0, fastest: 0, twists: {}, grabbed: 0 }, sheet: {},
    xp: 0, rankSeen: 1, mastery: {}, inv: {}, dyes: [], boxPity: 0, pacts: {}, ng: 0, daily: null, streak: 0, lastDaily: null, profile: SL.Profile.blank(), history: { bonks: 0, crumbleSurvive: 0, causes: {} }, cur: null, last: [], allCrackedSaid: false
  };
}
// ---------- tamper check ----------
// Every save is written with a fingerprint, plus a second fingerprinted copy of the last honest save.
// If someone edits the save in their browser's storage, the fingerprint stops matching: the honest copy
// comes back and the Game lets them know it noticed. If both copies were edited, the save is kept but
// stamped MODIFIED. It stops casual editing; the formula is in this file, so it is not real security.
const CODE_SALT = 'sore-loser:grudge:v2';
const fingerprint = json => (SL.hashStr(CODE_SALT + json) ^ SL.hashStr(json + json.length + CODE_SALT)).toString(36);
const KEY_FP = KEY + '_fp', KEY_CACHE = 'soreloser_cache';
let tamper = null; // 'restored' | 'modified' | null
// The honest backup is scrambled with a keystream and carries its own fingerprint inside, so it reads as
// noise and changing any character of it breaks it. (The key is in this file: it raises the bar, nothing more.)
const SCRAMBLE_KEY = 'grudge-cache:7f3a';
function scramble(text, nonce) {
  const bytes = new TextEncoder().encode(text), r = SL.rng(SL.hashStr(SCRAMBLE_KEY + nonce));
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= Math.floor(r() * 256);
  let bin = ''; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return btoa(bin);
}
function unscramble(b64, nonce) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length), r = SL.rng(SL.hashStr(SCRAMBLE_KEY + nonce));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ Math.floor(r() * 256);
  return new TextDecoder().decode(bytes);
}
function writeCache(json) {
  const nonce = Math.random().toString(36).slice(2, 10);
  localStorage.setItem(KEY_CACHE, nonce + '.' + scramble(fingerprint(json) + '|' + json, nonce));
}
// Returns the honest JSON from the scrambled backup, or null if it is missing or has been touched.
function readCache() {
  try {
    const raw = localStorage.getItem(KEY_CACHE); if (!raw) return null;
    const dot = raw.indexOf('.'); const text = unscramble(raw.slice(dot + 1), raw.slice(0, dot));
    const bar = text.indexOf('|'); const fp = text.slice(0, bar), json = text.slice(bar + 1);
    return fingerprint(json) === fp ? json : null;
  } catch (e) { return null; }
}
function writeSave(obj) {
  const json = JSON.stringify(obj);
  localStorage.setItem(KEY, json); localStorage.setItem(KEY_FP, fingerprint(json));
  writeCache(json);
  localStorage.removeItem(KEY + '_good'); localStorage.removeItem(KEY + '_good_fp'); // the old plain backup
}
function load() {
  try {
    const json = localStorage.getItem(KEY);
    if (!json) return fresh();
    const s = JSON.parse(json);
    if (!s || s.v !== 1) return fresh();
    const fp = localStorage.getItem(KEY_FP);
    if (fp === null) return Object.assign(fresh(), s); // saves from before fingerprints: trusted once
    if (fingerprint(json) === fp) return Object.assign(fresh(), s);
    // edited: bring back the last honest copy if it is intact
    let good = readCache();
    // saves from the previous version kept a plain backup; still honour it once
    if (!good) { const g = localStorage.getItem(KEY + '_good'), gf = localStorage.getItem(KEY + '_good_fp'); if (g && gf && fingerprint(g) === gf) good = g; }
    if (good) {
      const g = JSON.parse(good);
      g.caught = (g.caught || 0) + 1;
      tamper = 'restored';
      return Object.assign(fresh(), g);
    }
    // both copies edited: keep it, but it is marked forever
    tamper = 'modified';
    s.modified = true; s.caught = (s.caught || 0) + 1;
    return Object.assign(fresh(), s);
  } catch (e) { /* storage blocked or corrupt */ }
  return fresh();
}
let save = load();
try { if (localStorage.getItem(KEY) && !tamper && (localStorage.getItem(KEY_FP) === null || !localStorage.getItem(KEY_CACHE))) persist(); } catch (e) { /* storage blocked */ } // older saves get a fingerprint and a scrambled backup right away
// Older saves can name cheats that were retired; drop them.
if (!SL.DIFFS[save.diff]) save.diff = 'normal';
save.stats2 = Object.assign({ clean: 0, hard: 0, rage: 0, maxDeathsCleared: 0, fastest: 0, twists: {}, grabbed: 0, dailies: 0, bestStreak: 0, maxPacts: 0, boxes: 0, endings: 0, maxNgBeaten: -1 }, save.stats2);
save.equip = Object.assign({ skin: 'sunny', hat: 'sprout', trail: 'dust', death: 'pop', pin: 'nopin', dye: 'none' }, save.equip);
for (const k of ['skin', 'hat', 'trail', 'death', 'pin']) if (!SL.ITEM[save.equip[k]]) save.equip[k] = SL.ITEMS.find(i => i.slot === k && i.free).id;
if (!SL.DYE[save.equip.dye]) save.equip.dye = 'none';
for (const k of ['mastery', 'inv', 'pacts']) if (!save[k] || typeof save[k] !== 'object') save[k] = {};
if (!Array.isArray(save.dyes)) save.dyes = [];
if (!save.playerId) { save.playerId = SL.newSeed() + SL.newSeed().slice(0, 3); persist(); } // stays the same forever
save.settings = Object.assign({ music: 0.55, sfx: 0.8, shake: true, flashes: true, narrator: true }, save.settings);
save.unlocked = save.unlocked || {};
SL.FX = save.settings;
// ---------- one run per difficulty ----------
// The active run lives in the top-level fields; the other modes' runs wait in save.runs.
const RUN_FIELDS = ['runSeed', 'level', 'best', 'cur', 'last', 'ng', 'runAssisted'];
const newRun = () => ({ runSeed: SL.newSeed(), level: 1, best: 1, cur: null, last: [], ng: 0, runAssisted: false });
if (!save.runs || typeof save.runs !== 'object') save.runs = {};
if (!save.bestAll) save.bestAll = save.best || 1;
function switchDiff(d) {
  if (d === save.diff) return;
  const out = {}; for (const k of RUN_FIELDS) out[k] = save[k];
  save.runs[save.diff] = out;
  const next = save.runs[d] || newRun();
  for (const k of RUN_FIELDS) save[k] = next[k] !== undefined ? next[k] : newRun()[k];
  save.diff = d;
  persist();
}
const bestIn = d => d === save.diff ? save.best : ((save.runs[d] && save.runs[d].best) || 1);
const levelIn = d => d === save.diff ? save.level : ((save.runs[d] && save.runs[d].level) || 1);
if (!save.xp && (save.cleared || save.totalDeaths)) { save.xp = save.cleared * 35 + Math.min(save.totalDeaths, 2000) * 2; save.rankSeen = SL.rankOf(save.xp).lvl; }
// long-time players: pity coins start from where they are, not from zero
if (!save.pityPaid) save.pityPaid = Math.floor(save.totalDeaths / 50);
SL.look = save.equip;
const owns = id => { const it = SL.ITEM[id]; return !!it && (it.free || save.owned.indexOf(id) >= 0); };
save.last = (save.last || []).filter(id => SL.CHEATS[id]);
if (save.cur && (save.cur.cheats || []).some(id => !SL.CHEATS[id])) save.cur = null;
function persist() { try { writeSave(save); } catch (e) { /* ignore */ } }
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
  if (!save.settings.narrator && !(opts && opts.force)) return;
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
// ---------- gradual unlocks: a new player sees Play, and the rest arrives over the first levels ----------
const UNLOCKS = [
  { id: 'sheet', els: ['t-sheet', 't-dossier', 't-new'], test: () => save.cleared >= 1, say: 'I keep notes on you now. Cheat Sheet and Dossier are open.' },
  { id: 'shop', els: ['t-shop'], test: () => save.cleared >= 2 || save.coins >= 60, say: 'You have coins. I opened a shop. Everything is overpriced.' },
  { id: 'trophies', els: ['t-trophies'], test: () => Object.keys(save.trophies).length >= 1, say: 'You earned a trophy. I made a shelf for it. Reluctantly.' },
  { id: 'daily', els: ['t-daily'], test: () => save.cleared >= 3, say: 'Daily Grudge unlocked. One level, everyone, every day.' },
  { id: 'modes', els: ['t-diff-wrap'], test: () => save.cleared >= 5 || save.bestAll >= 6, say: 'Hard and Rage are open. Each mode keeps its own run.' },
  { id: 'pacts', els: ['t-pacts'], test: () => (save.bestAll || 1) >= 8, say: 'Pacts unlocked. Make it worse on purpose, earn more.' }
];
function applyUnlocks() {
  for (const u of UNLOCKS) { const on = !!save.unlocked[u.id] || u.test(); for (const id of u.els) { const el = $(id); if (el) el.classList.toggle('locked-ui', !on); } }
}
function announceUnlocks() {
  // saves from before unlocks existed: open everything they already earned, quietly
  if (!save.unlockInit) { save.unlockInit = true; for (const u of UNLOCKS) if (u.test()) save.unlocked[u.id] = true; persist(); }
  for (const u of UNLOCKS) {
    if (save.unlocked[u.id] || !u.test()) continue;
    save.unlocked[u.id] = true; persist();
    if (save.cleared > 0) { toast('crack', 'Unlocked', u.say, TROPHY_ICON); say(u.say, 'smug', { hold: 2.8 }); }
  }
  applyUnlocks();
}
function refreshCounts() {
  applyUnlocks();
  const n = crackedCount() + '/' + IDS.length;
  $('h-sheet-n').textContent = n; $('t-sheet-n').textContent = n;
  for (const id of ['t-coins', 'h-coins']) $(id).textContent = save.coins;
  $('t-best').textContent = save.best; $('t-deaths').textContent = save.totalDeaths; $('t-seed').textContent = save.runSeed;
  $('t-play').textContent = (save.level > 1 ? `Continue · Level ${save.level}` : 'Play') + (save.ng ? ` · NG+${save.ng}` : '');
  const rk = SL.rankOf(save.xp);
  $('t-rank').textContent = `Loser Rank ${rk.lvl} · ${rk.title}`;
  $('t-rank-bar').style.width = Math.round(rk.into / rk.need * 100) + '%';
  const pm = SL.pactMult(save.pacts);
  $('t-pacts-n').textContent = pm > 1 ? '×' + pm : 'off';
  const today = SL.todayKey(), dd = save.daily && save.daily.key === today ? save.daily : null;
  $('t-daily-n').textContent = dd && dd.done ? '✓ ' + dd.best + '💀' : (save.streak && save.lastDaily === yesterdayKey() ? '🔥' + save.streak : 'new');
  for (const b of document.querySelectorAll('#t-diff button')) {
    b.setAttribute('aria-pressed', String(b.dataset.d === save.diff));
    const lv = levelIn(b.dataset.d);
    b.innerHTML = `${SL.DIFFS[b.dataset.d].name}<small>${lv > 1 ? 'Lv ' + lv : 'new'}</small>`;
  }
  $('t-diff-blurb').textContent = SL.DIFFS[save.diff].blurb + ' World: ' + SL.themeName(save.diff, save.ng) + '.';
  const snd = save.sound ? 'Sound on' : 'Sound off';
  for (const id of ['t-sound', 'p-sound']) { $(id).textContent = snd; $(id).setAttribute('aria-pressed', String(save.sound)); }
}

// Adds one more cheat the level does not have yet (pacts and New Game+), respecting clashes.
function addCheat(cheats, key) {
  const r = SL.rng(SL.hashStr(key));
  const pool = IDS.filter(id => cheats.indexOf(id) < 0 && !cheats.some(c => (SL.CLASH[c] || []).indexOf(id) >= 0));
  if (pool.length) cheats.push(r.pick(pool));
}
function forceCheat(cheats, id) {
  if (cheats.indexOf(id) >= 0) return;
  for (const c of SL.CLASH[id] || []) { const i = cheats.indexOf(c); if (i >= 0) cheats.splice(i, 1); }
  cheats.push(id);
}
function levelPlan(level) {
  const pk = JSON.stringify(save.pacts) + ':' + save.ng;
  if (save.cur && save.cur.level === level && save.cur.seed === save.runSeed && save.cur.diff === save.diff && save.cur.pk === pk) return save.cur;
  let cheats = [], reasons = [], intro = null;
  if (level !== 100) {
    const pick = SL.Profile.choose(level, save.sheet, save.profile, save.last, save.runSeed, save.diff);
    cheats = pick.cheats; reasons = pick.reasons; intro = pick.intro;
    if (save.ng && level > 1) addCheat(cheats, save.runSeed + ':ng:' + level);
    if (save.pacts.extra) addCheat(cheats, save.runSeed + ':pact:' + level);
    if (save.pacts.shadow) forceCheat(cheats, 'copycat');
    if (save.pacts.wall) forceCheat(cheats, 'spikeWall');
  }
  save.cur = { level, seed: save.runSeed, diff: save.diff, pk, cheats, reasons, intro };
  if (intro) sheetOf(intro).met = true;
  persist();
  return save.cur;
}

function makeWorld(level) {
  const plan = levelPlan(level);
  const L = SL.buildLevel(save.runSeed, level, plan.cheats, save.diff, { ng: save.ng, pacts: save.pacts });
  const w = new SL.World(L, save.history);
  w.greedy = !!save.pacts.greedy;
  return { world: w, plan };
}

// ---------- Daily Grudge: one seeded level a day, the same for everyone ----------
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return SL.todayKey(d); };
const dailyNumber = key => Math.floor((Date.parse(key + 'T00:00:00Z') - Date.parse('2026-11-01T00:00:00Z')) / 864e5) + 1;
function dailyPlan() {
  const key = SL.todayKey(), seed = 'DAILY-' + key, r = SL.rng(SL.hashStr(seed));
  const cheats = [];
  for (const id of r.shuffle(IDS.slice())) {
    if (cheats.length >= 4) break;
    if (cheats.some(c => (SL.CLASH[c] || []).indexOf(id) >= 0)) continue;
    cheats.push(id);
  }
  return { key, seed, level: 40, diff: 'hard', cheats };
}
let session = 'run';   // run | daily
function startDaily(restart) {
  if (world && !world.won && mode !== 'clear') commitStats();
  const dp = dailyPlan();
  const L = SL.buildLevel(dp.seed, dp.level, dp.cheats, dp.diff, {});
  world = new SL.World(L, save.history); levelInfo = { reasons: [] }; levelTime = 0; session = 'daily';
  enterPlay(`Daily #${dailyNumber(dp.key)}`, restart);
  if (!restart) say(SL.say(SL.VOICE.daily), 'smug', { hold: 2.8 });
}

function setupAttract() {
  try {
    const { world: w } = makeWorld(Math.min(save.level, 99));
    attract = w; attractCam = 0;
    R.setWorld(attract); R.attract = true;
  } catch (e) { attract = null; }
}

const SCREENS = ['s-title', 's-pause', 's-clear', 's-sheet', 's-dossier', 's-shop', 's-trophies', 's-pacts', 's-end', 's-card', 's-settings'];
function enterPlay(levelLabel, restart) {
  R.setWorld(world); R.attract = false;
  SL.Audio.music(SL.Audio.trackFor(R.themeId, world.L.diff, world.L.ng || 0, { boss: !!world.L.boss }));
  $('stage').classList.toggle('boss', !!world.L.boss);
  mode = 'play'; overlay = null;
  for (const s of SCREENS) show(s, false);
  show('hud', true); show('touch', touchy);
  $('h-level').textContent = levelLabel; $('h-deaths').textContent = 0; $('h-seed').textContent = session === 'daily' ? 'DAILY' : save.runSeed;
  const L = world.L;
  $('h-diff').textContent = SL.DIFFS[L.diff].name + (L.ng ? ' · NG+' + L.ng : ''); $('h-diff').parentNode.className = 'chip diff-' + L.diff;
  const tw = L.twist ? SL.TWISTS[L.twist] : null;
  show('h-twist-chip', !!tw); if (tw) $('h-twist').textContent = tw.name;
  hushVoice();
  refreshCounts();
}
function startLevel(level, restart) {
  if (world && !world.won && mode !== 'clear') commitStats();
  const made = makeWorld(level);
  world = made.world; levelInfo = made.plan; levelTime = 0; session = 'run';
  enterPlay(level, restart);
  if (level === 100) { if (!restart) for (const [t, m] of SL.VOICE.boss) say(t, m, { hold: 2.6, prio: 2 }); return; }
  const tier = SL.tierOf(level), mood = SL.MOODS[tier];
  if (!save.booted) {
    save.booted = true; persist();
    for (const [t, m] of SL.VOICE.firstBoot) say(t, m, { hold: 2.2 });
  } else if (!restart) {
    say(SL.say(SL.VOICE.start[mood], { n: level }), moodForTier(tier), { hold: 2.4 });
    if (levelInfo.reasons && levelInfo.reasons.length) say(levelInfo.reasons[0], 'smug', { hold: 3.2 });
  }
  if (!restart && world.L.twist) say(SL.TWISTS[world.L.twist].say, 'smug', { hold: 2.6 });
  if (!restart && save.ng && level === 1) say(SL.say(SL.VOICE.ngStart, { n: save.ng }), 'glitch', { hold: 3, prio: 2 });
}
const restartCurrent = () => { if (session === 'daily') startDaily(true); else startLevel(world.L.level, true); };

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
    case 'dodge': SL.Audio.play('swap'); quip(SL.VOICE.trigger.dodge, 'smug'); break;
    case 'swap': SL.Audio.play('swap'); quip(e.on ? SL.VOICE.trigger.swapOn : SL.VOICE.trigger.swapOff, e.on ? 'smug' : 'angry'); break;
    case 'shake': SL.Audio.play('shake'); quip(SL.VOICE.trigger.shake, 'smug'); break;
    case 'floorDrop': SL.Audio.play('drop'); break;
    case 'wake': SL.Audio.play('seen'); if (!world.saidWake) { world.saidWake = true; say(SL.say(SL.VOICE.trigger.wake), 'smug', { prio: 2 }); } break;
    case 'tooth': SL.Audio.play('drop'); break;
    case 'unplug': SL.Audio.play('unplug'); say(SL.say(e.left === 2 ? SL.VOICE.unplug1 : e.left === 1 ? SL.VOICE.unplug2 : SL.VOICE.unplug3), 'glitch', { prio: 3, hold: 2 }); break;
    case 'bossTooth': SL.Audio.play('bossTooth'); break;
    case 'bossSaw': SL.Audio.play('bossSaw'); break;
    case 'bubblePop': SL.Audio.play('shieldPop'); say('Bubble popped. Lucky.', 'angry', { prio: 2 }); break;
    case 'plant': SL.Audio.play('plant'); break;
    case 'coinsLost': SL.Audio.play('coinsLost'); $('h-coins').textContent = save.coins; quip(SL.VOICE.coinsLost, 'smug'); break;
    case 'coin': SL.Audio.play('coin'); $('h-coins').textContent = save.coins + world.coinsGot.size * 5; bumpEl('h-coin-chip'); break;
    case 'reveal': SL.Audio.play('reveal'); quip(SL.VOICE.trigger.reveal, 'smug'); break;
    case 'lunge': SL.Audio.play('lunge'); quip(SL.VOICE.trigger.lunge, 'smug'); break;
    case 'wallWake': SL.Audio.play('wall'); if (!world.saidWall) { world.saidWall = true; say(SL.say(SL.VOICE.trigger.wallWake), 'smug', { prio: 2 }); } break;
    case 'quake': SL.Audio.play('quake'); quip(SL.VOICE.trigger.quake, 'smug'); break;
    case 'toothLand': SL.Audio.play('pop'); break;
    case 'creak': SL.Audio.play('creak'); break;
    case 'tileFall': SL.Audio.play('tileFall'); break;
    case 'slam': SL.Audio.play('slam'); break;
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
      if (e.boss) { say(SL.VOICE.bossDown, 'glitch', { prio: 4, hold: 2 }); setTimeout(finishLevel, 1600); break; }
      setTimeout(finishLevel, 650);
      break;
    }
  }
  void mood;
}
function bumpEl(id) { const b = $(id); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
function bump() { const b = $('h-sheet'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }

// ---------- XP and mastery ----------
function addXP(n) {
  save.xp += Math.max(0, Math.round(n));
  const rk = SL.rankOf(save.xp);
  while (save.rankSeen < rk.lvl) {
    save.rankSeen++;
    const bonus = 10 + save.rankSeen * 3;
    save.coins += bonus;
    toast('trophy', `Rank up · +${bonus} coins`, `Loser Rank ${save.rankSeen}: ${SL.rankOf(save.xp).title}`, TROPHY_ICON);
    SL.Audio.play('rankUp');
  }
}
function addMastery(cheats) {
  for (const id of cheats) {
    const before = SL.masteryTier(save.mastery[id] || 0);
    save.mastery[id] = (save.mastery[id] || 0) + 1;
    const after = SL.masteryTier(save.mastery[id]);
    if (after > before) {
      const t = SL.MASTERY[after - 1];
      save.coins += t.coins;
      if (t.pin && save.owned.indexOf('pin_' + id) < 0) save.owned.push('pin_' + id);
      toast('crack', `${t.name} mastery · +${t.coins}${t.pin ? ' + pin' : ''}`, SL.CHEATS[id].name, ICON[id]);
    }
  }
}
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + String(s).padStart(2, '0'); }

function finishLevel(opts) {
  opts = opts || {};
  const L = world.L, st = world.stats;
  const deaths = st.deaths, jumps = st.jumps;
  const assisted = world.assisted || !!opts.skipped;
  const grabbed = opts.skipped ? 0 : world.coinsGot.size;
  const daily = session === 'daily', boss = !!L.boss;
  let pay = { rows: [], total: 0 };
  if (opts.skipped) pay = { rows: [['Skipped. No coins. Coward.', 0]], total: 0 };
  else if (daily) {
    const dp = dailyPlan(), first = !(save.daily && save.daily.key === dp.key && save.daily.done);
    if (first) {
      save.streak = save.lastDaily === yesterdayKey() ? save.streak + 1 : 1;
      save.lastDaily = dp.key;
      save.stats2.dailies++; save.stats2.bestStreak = Math.max(save.stats2.bestStreak, save.streak);
      const streakBonus = Math.min(100, (save.streak - 1) * 10);
      pay = { rows: [['Daily Grudge cleared', 60]].concat(grabbed ? [[`${grabbed} coins grabbed`, grabbed * 5]] : []).concat(streakBonus ? [[`${save.streak}-day streak`, streakBonus]] : []), total: 60 + grabbed * 5 + streakBonus };
      addXP(60);
    } else pay = { rows: [['Already paid today. Showing off?', 0]], total: 0 };
    const prev = save.daily && save.daily.key === dp.key ? save.daily : null;
    save.daily = { key: dp.key, done: true, best: prev && prev.done ? Math.min(prev.best, deaths) : deaths, bestTime: prev && prev.done ? Math.min(prev.bestTime, levelTime) : levelTime, last: deaths, lastTime: levelTime };
  } else {
    pay = SL.payout(L.level, deaths, grabbed, L.diff, L.twist, { pacts: save.pacts, ng: L.ng, assisted, boss });
  }
  save.coins += pay.total;
  const s2 = save.stats2;
  if (!opts.skipped) {
    s2.grabbed += grabbed;
    if (!assisted) {
      if (!deaths) s2.clean++;
      if (L.diff === 'hard') s2.hard++;
      if (L.diff === 'rage') s2.rage++;
      s2.maxDeathsCleared = Math.max(s2.maxDeathsCleared, deaths);
      if (!s2.fastest || levelTime < s2.fastest) s2.fastest = levelTime;
      if (L.twist) s2.twists[L.twist] = true;
      if (L.diff === 'rage' && !deaths) s2.rageClean = (s2.rageClean || 0) + 1;
      if (L.diff === 'rage' && L.twist === 'mirror') s2.rageMirror = true;
      if (!daily && L.level >= 50 && SL.PACTS.filter(pc => save.pacts[pc.id]).length >= 4) s2.deepPacts = true;
      if (boss && !deaths) s2.bossClean = true;
      if (!daily) s2.maxPacts = Math.max(s2.maxPacts, SL.PACTS.filter(pc => save.pacts[pc.id]).length);
      addMastery(L.cheats);
    }
    if (!daily) addXP(20 + L.tier * 6 + Math.min(30, deaths * 2) + (boss ? 500 : 0));
  }
  if (boss) { s2.endings++; s2.maxNgBeaten = Math.max(s2.maxNgBeaten, L.ng || 0); s2.bossBy = s2.bossBy || {}; s2.bossBy[L.diff] = (s2.bossBy[L.diff] || 0) + 1; }
  commitStats();
  if (!daily) {
    save.profile.levels++;
    if (L.checkpoint) save.profile.cpLevels++;
    save.cleared++;
    save.last = L.cheats.slice();
    save.level = L.level + 1;
    save.best = Math.max(save.best, save.level);
    save.bestAll = Math.max(save.bestAll || 1, save.best);
    if (save.level > 50 && !save.runAssisted) s2.cleanRun50 = true;
    save.cur = null;
  }
  persist();
  hushVoice();
  if (boss) { showEnding(pay); return; }
  // card
  const tier = L.tier;
  $('c-eyebrow').textContent = daily ? `Daily Grudge #${dailyNumber(save.daily.key)}` : 'Level ' + L.level + (L.ng ? ' · NG+' + L.ng : '');
  $('c-quote').textContent = '"' + (opts.skipped ? SL.say(SL.VOICE.skipped) : assisted ? SL.say(SL.VOICE.assisted) : SL.say(SL.VOICE.win[SL.MOODS[tier]], { n: L.level })) + '"';
  $('c-time').textContent = fmtTime(levelTime);
  $('c-deaths').textContent = deaths; $('c-jumps').textContent = jumps;
  $('c-pay').innerHTML = pay.rows.map(([k, v]) => `<div><span>${k}</span><b>${v < 0 ? v : '+' + v}</b></div>`).join('') + `<div class="pay-total"><span>Spite Coins${assisted && !opts.skipped ? ' · Assisted' : ''}</span><b>+${pay.total}</b></div>`;
  setTimeout(() => { checkTrophies(save.totalDeaths); announceUnlocks(); }, 400);
  $('c-used').innerHTML = '';
  for (const id of L.cheats) {
    const sh = sheetOf(id), C = SL.CHEATS[id];
    const row = document.createElement('div');
    const met = world.seen[id] || sh.cracked;
    row.className = 'used-row ' + (sh.cracked ? 'cracked' : met ? 'seen' : 'unknown');
    row.innerHTML = `<div class="ci">${met ? ICON[id] : UNKNOWN_ICON}</div><div><b></b><span></span></div>`;
    row.querySelector('b').textContent = sh.cracked ? C.name : '???';
    row.querySelector('span').textContent = sh.cracked ? ruleFor(id) : met ? C.symptom + ' Rule not cracked yet.' : 'It was here. You never noticed.';
    $('c-used').appendChild(row);
  }
  lastClear = { level: L.level, diff: L.diff, ng: L.ng || 0, deaths, time: levelTime, coins: pay.total, cheats: L.cheats.length, twist: L.twist ? SL.TWISTS[L.twist].name : '', world: SL.themeName(L.diff, L.ng || 0) };
  show('c-share', !opts.skipped); show('c-pacts', !daily);
  $('c-next').innerHTML = daily ? 'Back to title' : (L.level + 1 === 100 ? 'Face the Game <kbd>Enter</kbd>' : 'Next level <kbd>Enter</kbd>');
  mode = 'clear';
  show('hud', false); show('touch', false);
  show('s-clear', true);
  refreshCounts();
  setTimeout(() => $('c-next').focus(), 50);
}

// The text people paste into chats after the Daily.
// 5 squares: green is good, red is a lot of deaths.
const gradeOf = deaths => deaths === 0 ? 'ggggg' : deaths < 5 ? 'gggyy' : deaths < 15 ? 'gyyrr' : deaths < 40 ? 'yrrrr' : 'rrrrr';
const gradeEmoji = deaths => gradeOf(deaths).replace(/g/g, '🟩').replace(/y/g, '🟨').replace(/r/g, '🟥');
let shareQuote = '', cardKind = 'daily', lastClear = null;
function cardFileName() {
  if (cardKind === 'daily') return `sore-loser-daily-${dailyNumber(save.daily.key)}.png`;
  if (cardKind === 'level') return `sore-loser-level-${lastClear.level}-${lastClear.diff}.png`;
  return 'sore-loser-profile.png';
}
function shareText() { return shareTextRaw() + (save.modified ? '\n(modified save)' : save.imported ? '\n(imported save)' : '') + '\nPlayer #' + save.playerId; }
function shareTextRaw() {
  if (cardKind === 'daily') {
    const d = save.daily;
    return `Sore Loser · Daily #${dailyNumber(d.key)}\n💀 ${d.last}  ⏱ ${fmtTime(d.lastTime)}${save.streak > 1 ? '  🔥' + save.streak : ''}\n${gradeEmoji(d.last)}\n"${shareQuote}"`;
  }
  if (cardKind === 'level') {
    const c = lastClear;
    return `Sore Loser · Level ${c.level} · ${SL.DIFFS[c.diff].name}${c.ng ? ' NG+' + c.ng : ''}\n💀 ${c.deaths}  ⏱ ${fmtTime(c.time)}  🪙 +${c.coins}\n${gradeEmoji(c.deaths)}\n"${shareQuote}"`;
  }
  const rk = SL.rankOf(save.xp);
  return `Sore Loser · Loser Rank ${rk.lvl} (${rk.title})\nNormal ${bestIn('normal')} · Hard ${bestIn('hard')} · Rage ${bestIn('rage')}\n💀 ${save.totalDeaths}  🏆 ${Object.keys(save.trophies).length}/${SL.TROPHIES.length}\n"${shareQuote}"`;
}

// ---------- share cards: 1080×1080 images for the Daily, any cleared level, and your profile ----------
function drawShareCard() {
  const S = 1080, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d'), rr = SL.rrect, ink = '#3b2a40', F = w => `${w} Fredoka, system-ui, sans-serif`;
  // the world behind the card: today's Daily world, the level's world, or your current mode's world
  const diff = cardKind === 'daily' ? 'hard' : cardKind === 'level' ? lastClear.diff : save.diff;
  const ng = cardKind === 'daily' ? 0 : cardKind === 'level' ? lastClear.ng : save.ng;
  const menace = SL.menaceFor(diff, ng);
  const pal = SL.paletteFor(SL.themeFor(diff, ng), 2, menace, SL.themeLoop(diff, ng));
  const seed = cardKind === 'daily' ? dailyNumber(save.daily.key) : 7;
  const g = ctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, pal.skyA); g.addColorStop(1, pal.skyB);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  if (menace >= 2) { const gl = ctx.createRadialGradient(840, 190, 30, 840, 190, 260); gl.addColorStop(0, 'rgba(255,40,50,0.5)'); gl.addColorStop(1, 'rgba(255,40,50,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, S, S); }
  ctx.fillStyle = menace >= 2 ? '#c8202c' : pal.sun; ctx.beginPath(); ctx.arc(840, 190, 70, 0, 7); ctx.fill();
  for (const [col, base, amp, f] of [[pal.far, 700, 70, 0.006], [pal.near, 800, 60, 0.01]]) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, S);
    for (let x = 0; x <= S; x += 14) { const y = base - Math.sin(x * f + seed) * amp - Math.sin(x * f * 2.7 + 1) * amp * 0.35; if (menace >= 1) { ctx.lineTo(x - 7, y); ctx.lineTo(x - 3, y - 12); } ctx.lineTo(x, y); }
    ctx.lineTo(S, S); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = pal.dirt; ctx.fillRect(0, 990, S, 90);
  ctx.fillStyle = pal.grass; ctx.fillRect(0, 990, S, 16);
  for (let i = 0; i < 18; i++) { const x = i * 60 + 10; ctx.beginPath(); ctx.moveTo(x, 990); ctx.lineTo(x + 20, 955); ctx.lineTo(x + 40, 990); ctx.fillStyle = '#eef2fb'; ctx.fill(); ctx.strokeStyle = '#6f7591'; ctx.lineWidth = 4; ctx.stroke(); }
  // logo + subtitle
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  const outlined = (t, x, y, font, col, lw) => { ctx.font = font; ctx.lineWidth = lw; ctx.strokeStyle = ink; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y); };
  outlined('SORE LOSER', S / 2, 150, F('700 120px'), '#ffcb3d', 14);
  const sub = cardKind === 'daily' ? `DAILY GRUDGE #${dailyNumber(save.daily.key)} · ${save.daily.key}`
    : cardKind === 'level' ? `LEVEL ${lastClear.level} · ${SL.DIFFS[lastClear.diff].name.toUpperCase()}${lastClear.ng ? ' NG+' + lastClear.ng : ''} · ${lastClear.world.toUpperCase()}`
    : 'PLAYER PROFILE';
  outlined(sub, S / 2, 215, F('600 ' + (sub.length > 44 ? 32 : 40) + 'px'), '#fffaf2', 8);
  // panel
  ctx.fillStyle = 'rgba(28,18,38,0.35)'; rr(ctx, 96, 268, S - 192, 600, 48); ctx.fill();
  ctx.fillStyle = '#fffaf2'; rr(ctx, 90, 258, S - 180, 600, 48); ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = ink; ctx.stroke();
  ctx.save(); ctx.translate(250, 520); ctx.scale(6, 6);
  SL.drawBlob(ctx, { cx: 0, by: 0, face: 1, time: 1, skin: save.equip.skin, hat: save.equip.hat, dye: save.equip.dye, pin: save.equip.pin });
  ctx.restore();
  const stat = (x, label, value, col) => {
    ctx.textAlign = 'center';
    ctx.fillStyle = col; rr(ctx, x, 300, 200, 170, 28); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.stroke();
    ctx.fillStyle = ink; ctx.font = F('600 28px'); ctx.fillText(label, x + 100, 345);
    ctx.font = F('700 ' + (String(value).length > 4 ? 56 : 74) + 'px'); ctx.fillText(value, x + 100, 435);
  };
  const squares = deaths => { const gr = gradeOf(deaths), cols = { g: '#6fdc98', y: '#ffcb3d', r: '#ff5a6e' }; for (let i = 0; i < 5; i++) { ctx.fillStyle = cols[gr[i]]; rr(ctx, 420 + i * 88, 500, 76, 76, 16); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.stroke(); } };
  const lines = (a, b) => { ctx.textAlign = 'left'; ctx.font = F('700 40px'); ctx.fillStyle = ink; ctx.fillText(a, 420, 640); ctx.font = F('500 30px'); ctx.fillStyle = '#6d5a73'; ctx.fillText(b, 420, 684); };
  let foot;
  if (cardKind === 'daily') {
    const d = save.daily;
    stat(420, 'DEATHS', d.last, '#ffd6de'); stat(650, 'TIME', fmtTime(d.lastTime), '#d8f0ff'); squares(d.last);
    lines(save.streak > 1 ? `${save.streak}-day streak` : 'Day one of the grudge', `Hard · ${dailyPlan().cheats.length} cheats`);
    foot = 'Same level for everyone today. Beat me.';
  } else if (cardKind === 'level') {
    const c = lastClear;
    stat(420, 'DEATHS', c.deaths, '#ffd6de'); stat(650, 'TIME', fmtTime(c.time), '#d8f0ff'); squares(c.deaths);
    lines(`+${c.coins} Spite Coins`, `${c.cheats} cheat${c.cheats === 1 ? '' : 's'} used on me${c.twist ? ' · ' + c.twist : ''}`);
    foot = 'I beat it. The game is furious.';
  } else {
    const rk = SL.rankOf(save.xp);
    stat(420, 'RANK', rk.lvl, '#fff4c2'); stat(650, 'DEATHS', save.totalDeaths, '#ffd6de');
    // best level per mode instead of grade squares
    const modes = [['normal', '#6fdc98'], ['hard', '#ffcb3d'], ['rage', '#ff5a6e']];
    modes.forEach(([m, col], i) => {
      const x = 420 + i * 148; ctx.fillStyle = col; rr(ctx, x, 498, 136, 82, 16); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = ink; ctx.font = F('600 22px'); ctx.fillText(SL.DIFFS[m].name.toUpperCase(), x + 68, 526);
      const ngm = m === save.diff ? save.ng : ((save.runs[m] && save.runs[m].ng) || 0);
      ctx.font = F('700 36px'); ctx.fillText('Lv ' + bestIn(m) + (ngm ? '+' : ''), x + 68, 566);
    });
    lines(rk.title, `${Object.keys(save.trophies).length}/${SL.TROPHIES.length} trophies · ${crackedCount()}/${IDS.length} cheats cracked`);
    foot = 'Think you can lose better than me?';
  }
  // the Game's comment
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffcb3d'; rr(ctx, 130, 730, 104, 84, 22); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = ink; ctx.stroke();
  ctx.fillStyle = '#2a1d38'; rr(ctx, 144, 742, 76, 58, 12); ctx.fill();
  ctx.strokeStyle = '#ff8fa8'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(156, 756); ctx.lineTo(172, 762); ctx.moveTo(208, 756); ctx.lineTo(192, 762); ctx.moveTo(160, 786); ctx.quadraticCurveTo(182, 776, 204, 786); ctx.stroke(); ctx.lineCap = 'butt';
  ctx.fillStyle = ink; ctx.font = F('500 24px'); ctx.fillText('THE GAME', 260, 760);
  ctx.font = F('700 ' + (shareQuote.length > 30 ? 32 : 40) + 'px'); ctx.fillText(`"${shareQuote}"`, 260, 806);
  ctx.textAlign = 'center';
  outlined(foot, S / 2, 930, F('600 34px'), '#fffaf2', 8);
  // who this is, and whether the save was earned here
  ctx.textAlign = 'right'; ctx.font = F('500 26px'); ctx.fillStyle = '#6d5a73';
  ctx.fillText('Player #' + save.playerId, S - 120, 846);
  if (save.imported || save.modified) {
    const stampText = save.modified ? 'MODIFIED SAVE' : 'IMPORTED SAVE';
    ctx.save(); ctx.translate(252, 640); ctx.rotate(-0.14);
    ctx.strokeStyle = '#d6243a'; ctx.lineWidth = 6; rr(ctx, -125, -36, 250, 72, 12); ctx.stroke();
    ctx.fillStyle = '#d6243a'; ctx.textAlign = 'center'; ctx.font = F('700 30px'); ctx.fillText(stampText, 0, 11);
    ctx.restore();
  }
  return cv;
}
let cardBlob = null;
async function openShareCard(kind) {
  cardKind = kind || 'daily';
  shareQuote = SL.say(cardKind === 'profile' ? SL.VOICE.profileQuote : cardKind === 'level' ? SL.VOICE.levelQuote : SL.VOICE.shareQuote);
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* draw anyway */ }
  const cv = drawShareCard();
  $('card-img').src = cv.toDataURL('image/png');
  $('card-title').textContent = { daily: 'Your Daily card', level: 'Your level card', profile: 'Your profile card' }[cardKind];
  cardBlob = await new Promise(res => cv.toBlob(res, 'image/png'));
  const file = cardBlob && new File([cardBlob], cardFileName(), { type: 'image/png' });
  show('card-share', !!(file && navigator.canShare && navigator.canShare({ files: [file] })));
  show('card-copy', !!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write));
  $('card-note').textContent = '';
  if (overlay) closeOverlay();
  openOverlay('card');
}
function cardNote(t) { $('card-note').textContent = t; }

// ---------- the ending ----------
function showEnding(pay) {
  const ng = world.L.ng || 0;
  $('e-title').textContent = ng ? `You beat me. Again. (NG+${ng})` : 'Fine. You win.';
  $('e-text').innerHTML = SL.VOICE.ending.map(t => `<p>${t}</p>`).join('');
  $('e-stats').innerHTML = [['Deaths, all time', save.totalDeaths], ['Levels cleared', save.cleared], ['Loser Rank', SL.rankOf(save.xp).lvl], ['Paid for this', '+' + pay.total]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('e-ng').textContent = `Start New Game+${ng + 1}`;
  const nextWorld = SL.themeName(world.L.diff, ng + 1);
  $('e-ng-sub').textContent = `New world: ${nextWorld}. ` + (ng + 1 <= 2 ? 'Harder levels, +1 cheat everywhere, bigger pay, and I rewrite some of my own rules.' : 'Harder again. Bigger pay again. I am running out of ideas but not out of spite.');
  mode = 'clear';
  SL.Audio.music(SL.Audio.titleTrack());
  show('hud', false); show('touch', false); show('s-end', true);
  SL.Audio.play('crack');
  setTimeout(() => checkTrophies(save.totalDeaths), 600);
}
function startNG() {
  save.ng++; save.level = 1; save.runSeed = SL.newSeed(); save.cur = null; save.last = []; persist();
  show('s-end', false);
  startLevel(1);
}

// ---------- cheat sheet ----------
const ruleFor = id => (SL.REMIX_RULES[id] && SL.remixFor(save.ng)[id]) ? SL.REMIX_RULES[id] : SL.CHEATS[id].rule;
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
    if (st === 'cracked') rule.textContent = ruleFor(id);
    else { const r = document.createElement('span'); r.className = 'redact'; r.textContent = C.rule.replace(/\S/g, 'x'); rule.appendChild(r); }
    const mn = save.mastery[id] || 0, mt = SL.masteryTier(mn), nextT = SL.MASTERY[mt];
    card.querySelector('.how').textContent = (st === 'cracked' ? `Cracked on level ${s.crackedAt || '?'}` : st === 'seen' ? 'To crack: ' + C.crack : '') +
      (s.met ? ` · Mastery: ${mt ? SL.MASTERY[mt - 1].name : 'none'} (${mn}${nextT ? '/' + nextT.n : ''})` : '');
    if (mt) card.classList.add('m' + mt);
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
  const stats = [['Levels cleared', save.cleared], ['Best level', save.best], ['Deaths', save.totalDeaths], ['Jumps', p.jumps], ['Minutes played', hrs], ['Cheats cracked', crackedCount() + '/' + IDS.length], ['Player', '#' + save.playerId + (save.modified ? ' (modified save)' : save.imported ? ' (imported save)' : '')], ['Times caught', save.caught || 0], ['Loser Rank', SL.rankOf(save.xp).lvl + ' · ' + SL.rankOf(save.xp).title], ['Daily streak', save.streak || 0], ['New Game+', save.ng]];
  $('d-stats').innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}

// ---------- shop ----------
const COIN_ICON = '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="#ffd84d" stroke="#3b2a40" stroke-width="3"/><rect x="14" y="15" width="3" height="3" fill="#3b2a40"/><rect x="23" y="15" width="3" height="3" fill="#3b2a40"/><path d="M14 25q6 3 12-1" stroke="#3b2a40" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>';
let shopTab = 'today';
function preview(cv, look) {
  const ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = 72 * dpr; cv.height = 72 * dpr;
  ctx.setTransform(dpr * 1.35, 0, 0, dpr * 1.35, 0, 0);
  ctx.clearRect(0, 0, 72, 72);
  SL.drawBlob(ctx, { cx: 26.7, by: 47, face: 1, time: performance.now() / 1000, skin: look.skin, hat: look.hat, dye: look.dye, pin: look.pin });
}
function lookFor(it) {
  const l = Object.assign({}, save.equip);
  if (it.slot === 'skin') l.skin = it.id; if (it.slot === 'hat') l.hat = it.id; if (it.slot === 'pin') l.pin = it.id;
  return l;
}
const FX_GLYPH = { dust: '··', sparkle: '✦', bubbles: '○', hearts: '♥', rainbow: '≋', flames: '🔥', notes: '♪', leaves: '🍂', money: '$', pop: '✺', confetti: '✱', oof: 'OOF', pixels: '▦', soul: '👻', nope: 'QUIT', splat: '✸', stars: '★', firework: '❋' };
function card(cls, inner, onClick) {
  const c = document.createElement('button');
  c.type = 'button'; c.className = 'item ' + cls; c.innerHTML = inner; c.onclick = onClick;
  $('shop-items').appendChild(c);
  return c;
}
function itemCard(it, tagOverride) {
  const own = owns(it.id), on = save.equip[it.slot] === it.id;
  let tag;
  if (on) tag = 'Wearing';
  else if (own) tag = 'Wear';
  else if (tagOverride) tag = tagOverride;
  else if (it.trophy) tag = 'Trophy: ' + SL.TROPHIES.find(t => t.id === it.trophy).name;
  else if (it.mastery) tag = `Gold mastery (${save.mastery[it.mastery] || 0}/75)`;
  else if (it.box) tag = 'Grudge Box only';
  else tag = `<i>${it.price}</i>`;
  const locked = !own && (it.trophy || it.mastery || it.box);
  const c = card((on ? ' on' : '') + (own ? ' own' : '') + (locked ? ' locked' : ''), `<canvas width="72" height="72"></canvas><b></b><span class="tag">${tag}</span>`, () => buy(it));
  c.querySelector('b').textContent = it.name;
  const cv = c.querySelector('canvas');
  if (it.slot === 'skin' || it.slot === 'hat' || it.slot === 'pin') preview(cv, lookFor(it));
  else cv.replaceWith(Object.assign(document.createElement('div'), { className: 'fx-ico', textContent: FX_GLYPH[it.id] || '?' }));
}
function renderShop() {
  $('shop-coins').textContent = save.coins;
  $('shop-tabs').innerHTML = SL.SLOTS.map(([k, n]) => `<button type="button" data-tab="${k}" aria-pressed="${k === shopTab}">${n}</button>`).join('');
  for (const b of $('shop-tabs').querySelectorAll('button')) b.onclick = () => { shopTab = b.dataset.tab; SL.Audio.play('click'); renderShop(); };
  $('shop-items').innerHTML = '';
  $('shop-note').textContent = '';
  if (shopTab === 'today') {
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const mins = Math.round((mid - now) / 60000);
    $('shop-note').textContent = `Today's stock. New items in ${Math.floor(mins / 60)}h ${mins % 60}m. Miss one and it might not be back for a while.`;
    for (const id of SL.todayStock(SL.todayKey())) itemCard(SL.ITEM[id]);
  } else if (shopTab === 'dye') {
    $('shop-note').textContent = 'Dyes recolour whichever hat you wear.';
    for (const d of SL.DYES) {
      const own = d.free || save.dyes.indexOf(d.id) >= 0, on = save.equip.dye === d.id;
      const c = card((on ? ' on' : '') + (own ? ' own' : ''), `<canvas width="72" height="72"></canvas><b></b><span class="tag">${on ? 'Using' : own ? 'Use' : '<i>' + d.price + '</i>'}</span>`, () => buyDye(d));
      c.querySelector('b').textContent = d.name;
      preview(c.querySelector('canvas'), Object.assign({}, save.equip, { dye: d.id, hat: save.equip.hat === 'sprout' || save.equip.hat === 'bald' ? 'party' : save.equip.hat }));
    }
  } else if (shopTab === 'use') {
    $('shop-note').textContent = 'Use these from the pause menu. Any of them makes the level Assisted: half pay, no trophies, no mastery. Not allowed in the Daily.';
    for (const c of SL.CONSUMABLES) {
      const n = save.inv[c.id] || 0;
      const el = card(' consumable', `<div class="fx-ico">${{ lens: '🔍', bubble: '🫧', flag: '⚑', skip: '🎟' }[c.id]}</div><b></b><span class="tag"><i>${c.price}</i> · have ${n}</span><span class="desc"></span>`, () => buyCons(c));
      el.querySelector('b').textContent = c.name; el.querySelector('.desc').textContent = c.desc;
    }
  } else if (shopTab === 'box') {
    const exL = SL.ITEMS.filter(i => i.box && !owns(i.id)).length;
    $('shop-note').textContent = `Odds, honestly: coins 40% (often less than you paid), item 27%, dye 20%, rotating cosmetic 10%, box exclusive 3%. Pity: an exclusive is guaranteed within ${SL.BOX.pity - save.boxPity} more box${SL.BOX.pity - save.boxPity === 1 ? '' : 'es'}${exL ? '' : ' (you have them all)'}.`;
    const el = card(' box', `<div class="fx-ico big">🎁</div><b>Grudge Box</b><span class="tag"><i>${SL.BOX.price}</i></span>`, openBox);
    void el;
    for (const it of SL.ITEMS.filter(i => i.box)) itemCard(it);
  } else {
    // permanent stock; rotating items only show here once you own them
    for (const it of SL.ITEMS.filter(i => i.slot === shopTab && (!i.rotate || owns(i.id)))) itemCard(it);
    if (shopTab === 'skin') for (const t of SL.TROLL_ITEMS) {
      const el = card(' troll', `<div class="fx-ico">?</div><b></b><span class="tag">${t.sold ? 'Sold out' : '<i>' + t.price + '</i>'}</span>`, () => { SL.Audio.play('bonk'); shopSay(t.say); });
      el.querySelector('b').textContent = t.name;
    }
  }
}
function shopSay(text) { const el = $('shop-say'); el.textContent = '“' + text + '”'; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function spend(price) {
  if (save.coins < price) { SL.Audio.play('head'); shopSay(SL.say(SL.VOICE.broke, { n: price - save.coins })); return false; }
  save.coins -= price; return true;
}
function buy(it) {
  if (owns(it.id)) { save.equip[it.slot] = it.id; SL.look = save.equip; persist(); SL.Audio.play('click'); renderShop(); return; }
  if (it.trophy) { SL.Audio.play('head'); shopSay('Not for sale. Earn it. Check the trophies.'); return; }
  if (it.mastery) { SL.Audio.play('head'); shopSay('Pins are earned. Clear 75 levels with that cheat in them.'); return; }
  if (it.box) { SL.Audio.play('head'); shopSay('Only in the Grudge Box. Gamble like everyone else.'); return; }
  if (it.rotate && SL.todayStock(SL.todayKey()).indexOf(it.id) < 0) { shopSay('Not in stock today.'); return; }
  if (!spend(it.price)) return;
  save.owned.push(it.id); save.equip[it.slot] = it.id; SL.look = save.equip; persist();
  SL.Audio.play('buy'); shopSay(SL.say(SL.VOICE.bought));
  refreshCounts(); renderShop(); checkTrophies(save.totalDeaths);
}
function buyDye(d) {
  const own = d.free || save.dyes.indexOf(d.id) >= 0;
  if (!own) { if (!spend(d.price)) return; save.dyes.push(d.id); SL.Audio.play('crack'); shopSay(SL.say(SL.VOICE.bought)); }
  else SL.Audio.play('click');
  save.equip.dye = d.id; SL.look = save.equip; persist(); refreshCounts(); renderShop();
}
function buyCons(c) {
  if ((save.inv[c.id] || 0) >= 9) { shopSay('You have nine. That is enough cheating.'); return; }
  if (!spend(c.price)) return;
  save.inv[c.id] = (save.inv[c.id] || 0) + 1; persist();
  SL.Audio.play('coin'); shopSay(SL.say(SL.VOICE.boughtCons)); refreshCounts(); renderShop();
}
// The Grudge Box. Honest odds, rigged vibes, real pity timer.
function openBox() {
  if (!spend(SL.BOX.price)) return;
  save.stats2.boxes++;
  const r = Math.random();
  let kind = 'coins', acc = 0;
  for (const [k, p] of SL.BOX.odds) { acc += p; if (r < acc) { kind = k; break; } }
  const exclusives = SL.ITEMS.filter(i => i.box && !owns(i.id));
  save.boxPity++;
  if (save.boxPity >= SL.BOX.pity && exclusives.length) kind = 'exclusive';
  let msg;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  if (kind === 'item') {
    const c = pick(SL.CONSUMABLES.filter(x => x.id !== 'skip').concat(Math.random() < 0.15 ? [SL.CONS.skip] : []));
    save.inv[c.id] = Math.min(9, (save.inv[c.id] || 0) + 1); msg = `A ${c.name}. Use it wisely. Or at all.`;
  } else if (kind === 'dye') {
    const d = SL.DYES.filter(x => !x.free && save.dyes.indexOf(x.id) < 0);
    if (d.length) { const x = pick(d); save.dyes.push(x.id); msg = `${x.name} dye! Your hat will thank you.`; } else kind = 'coins';
  } else if (kind === 'stock') {
    const st = SL.ITEMS.filter(i => i.rotate && !owns(i.id));
    if (st.length) { const x = pick(st); save.owned.push(x.id); msg = `${x.name}! Fresh off the rotation.`; } else kind = 'coins';
  } else if (kind === 'exclusive') {
    if (exclusives.length) { const x = pick(exclusives); save.owned.push(x.id); save.boxPity = 0; msg = `!!! ${x.name} !!! I did not mean to give you that.`; } else kind = 'coins';
  }
  if (kind === 'coins') { const n = 40 + Math.floor(Math.random() * 141); save.coins += n; msg = n < SL.BOX.price ? `${n} coins. You lost ${SL.BOX.price - n} on that. Hehe.` : `${n} coins. Lucky. Do not get used to it.`; }
  persist(); SL.Audio.play('box'); setTimeout(() => SL.Audio.play(kind === 'exclusive' ? 'jackpot' : 'buy'), 380);
  shopSay(msg); refreshCounts(); renderShop(); checkTrophies(save.totalDeaths);
}

// ---------- settings ----------
function renderSettings() {
  const st = save.settings;
  $('set-music').value = Math.round(st.music * 100); $('set-sfx').value = Math.round(st.sfx * 100);
  for (const k of ['shake', 'flashes', 'narrator']) $('set-' + k).checked = !!st[k];
  $('set-code').value = '';
  $('set-note').textContent = '';
}
function setSetting(k, v) {
  save.settings[k] = v; SL.FX = save.settings; persist();
  if (k === 'music' || k === 'sfx') SL.Audio.setVolumes(save.settings.music, save.settings.sfx);
  if (k === 'narrator' && !v) hushVoice();
}
// Save codes: the whole save as text, so a run can move between browsers or survive clearing site data.
// There is no server, so this cannot stop sharing. It stops editing (a fingerprint over the contents) and it
// makes borrowed progress useless for bragging: an imported save is stamped on every share card for good,
// and its Daily streak does not come along.
function exportSave() {
  const json = JSON.stringify(save);
  const code = 'SL2.' + btoa(unescape(encodeURIComponent(json))) + '.' + fingerprint(json);
  $('set-code').value = code; $('set-code').select();
  const msg = 'Save code copied. It is a backup for you: a save loaded from a code is marked IMPORTED on every share card.';
  if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => $('set-note').textContent = msg, () => $('set-note').textContent = msg);
  else $('set-note').textContent = msg;
}
function importSave() {
  const code = $('set-code').value.trim().replace(/\s+/g, '');
  try {
    const m = /^SL2\.([A-Za-z0-9+/=]+)\.([a-z0-9-]+)$/.exec(code);
    if (!m) throw new Error(code.startsWith('SL1.') ? 'old' : 'bad');
    const json = decodeURIComponent(escape(atob(m[1])));
    if (fingerprint(json) !== m[2]) throw new Error('edited');
    const data = JSON.parse(json);
    if (!data || data.v !== 1 || typeof data.level !== 'number') throw new Error('bad');
    if (!$('set-import').dataset.armed) {
      $('set-import').dataset.armed = '1'; $('set-import').textContent = 'Really replace?';
      $('set-note').textContent = `This replaces your current save with one at level ${data.level} (${data.totalDeaths} deaths). It will be marked IMPORTED on share cards and its Daily streak resets. Press again to confirm.`;
      return;
    }
    data.imported = (data.imported || 0) + 1;
    data.importedAt = Date.now();
    data.streak = 0; data.lastDaily = null; // streaks are earned on this device only
    writeSave(data);
    location.reload();
  } catch (e) {
    $('set-note').textContent = e.message === 'edited' ? 'This code has been edited, so I will not load it. Nice try.'
      : e.message === 'old' ? 'That is an old-style code from an earlier version. Make a new one from the original browser.'
      : 'That code does not look right. Paste the whole thing, starting with SL2.';
  }
}

// ---------- pacts ----------
function renderPacts() {
  $('pact-mult').textContent = '×' + SL.pactMult(save.pacts);
  $('pact-list').innerHTML = '';
  for (const pc of SL.PACTS) {
    const on = !!save.pacts[pc.id];
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pact' + (on ? ' on' : ''); b.setAttribute('aria-pressed', String(on));
    b.innerHTML = `<span class="tick">${on ? '✓' : ''}</span><div><b></b><span></span></div><em>+${pc.mult}</em>`;
    b.querySelector('b').textContent = pc.name; b.querySelector('div span').textContent = pc.desc;
    b.onclick = () => { save.pacts[pc.id] = !on; if (!save.pacts[pc.id]) delete save.pacts[pc.id]; save.cur = null; persist(); SL.Audio.play(on ? 'click' : 'seen'); renderPacts(); refreshCounts(); };
    $('pact-list').appendChild(b);
  }
}

// ---------- consumables (pause menu) ----------
function renderItems() {
  const box = $('p-items'); box.innerHTML = '';
  const daily = session === 'daily';
  for (const c of SL.CONSUMABLES) {
    const n = save.inv[c.id] || 0;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn small item-use';
    b.disabled = !n || daily || (c.id === 'skip' && world.L.boss) || (c.id === 'lens' && world.lens) || (c.id === 'bubble' && world.shield > 0);
    b.innerHTML = `${{ lens: '🔍', bubble: '🫧', flag: '⚑', skip: '🎟' }[c.id]} <span></span> <i>${n}</i>`;
    b.querySelector('span').textContent = c.name;
    b.title = c.desc;
    b.onclick = () => useItem(c.id);
    box.appendChild(b);
  }
  $('p-items-note').textContent = daily ? 'No items in the Daily Grudge.' : 'Using an item makes this level Assisted (half pay, no trophies).';
}
function useItem(id) {
  if (!(save.inv[id] > 0) || session === 'daily') return;
  if (id === 'flag' && !world.plantFlag()) { $('p-items-note').textContent = 'Stand on solid ground to plant a flag.'; return; }
  if (id === 'lens') world.lens = true;
  if (id === 'bubble') world.shield = 1;
  save.inv[id]--; world.assisted = true; save.runAssisted = true; persist();
  SL.Audio.play('save');
  resume();
  if (id === 'skip') { world.won = true; finishLevel({ skipped: true }); return; }
  say(SL.say(SL.VOICE.usedItem), 'smug', { prio: 2 });
}

// ---------- trophies ----------
function checkTrophies(liveDeaths) {
  const view = Object.assign({}, save, { totalDeaths: liveDeaths !== undefined ? liveDeaths : save.totalDeaths,
    best: save.bestAll || save.best, bestIn: { normal: bestIn('normal'), hard: bestIn('hard'), rage: bestIn('rage') } });
  const n = crackedCount();
  for (const t of SL.TROPHIES) {
    if (save.trophies[t.id] || !t.test(view, n)) continue;
    save.trophies[t.id] = { at: Date.now() };
    save.coins += t.coins || 0;
    if (t.item && save.owned.indexOf(t.item) < 0) save.owned.push(t.item);
    persist(); refreshCounts();
    SL.Audio.play('trophy');
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
  ({ sheet: renderSheet, dossier: renderDossier, shop: renderShop, trophies: renderTrophies, pacts: renderPacts, card: () => {}, settings: renderSettings })[which]();
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
  $('p-sub').textContent = `${session === 'daily' ? 'Daily Grudge' : 'Level ' + world.L.level} · ${world.stats.deaths} death${world.stats.deaths === 1 ? '' : 's'}${world.assisted ? ' · Assisted' : ''}`;
  renderItems();
  show('s-pause', true);
  setTimeout(() => $('p-resume').focus(), 30);
}
function resume() { if (mode !== 'pause') return; show('s-pause', false); mode = 'play'; }
function toTitle() {
  if (world && !world.won) commitStats();
  world = null; mode = 'title'; overlay = null;
  for (const s of SCREENS) if (s !== 's-title') show(s, false);
  show('hud', false); show('touch', false); show('s-title', true); show('t-confirm', false);
  hushVoice();
  setupAttract();
  SL.Audio.music(SL.Audio.titleTrack());
  refreshCounts();
  announceUnlocks();
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
  if (e.code === 'KeyR' && mode === 'play' && !overlay) { restartCurrent(); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && mode === 'clear' && !overlay && document.activeElement === document.body && !$('s-clear').hidden) { e.preventDefault(); nextFromClear(); }
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
  $('t-confirm-msg').textContent = `Restart your ${SL.DIFFS[save.diff].name} run from level 1 with a new seed? Your other modes, coins, cosmetics, trophies and Cheat Sheet are not touched.`;
  show('t-confirm', true); $('t-confirm-yes').focus();
};
click('t-new', () => confirmNew());
for (const b of document.querySelectorAll('#t-diff button')) {
  b.addEventListener('click', () => {
    SL.Audio.unlock(); SL.Audio.play('click');
    const d = b.dataset.d;
    if (d === save.diff) return;
    switchDiff(d); show('t-confirm', false); refreshCounts(); setupAttract();
  });
}
click('t-confirm-no', () => show('t-confirm', false));
click('t-confirm-yes', () => {
  void pendingDiff;
  save.runSeed = SL.newSeed(); save.level = 1; save.cur = null; save.last = []; save.runAssisted = false; persist();
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
const toggleSound = () => { save.sound = !save.sound; SL.Audio.setOn(save.sound); persist(); refreshCounts(); };
click('t-sound', toggleSound); click('p-sound', toggleSound);
click('t-settings', () => openOverlay('settings'));
click('p-settings', () => openOverlay('settings'));
$('set-music').addEventListener('input', e => setSetting('music', e.target.value / 100));
$('set-sfx').addEventListener('input', e => setSetting('sfx', e.target.value / 100));
$('set-sfx').addEventListener('change', () => SL.Audio.play('coin'));
for (const k of ['shake', 'flashes', 'narrator']) $('set-' + k).addEventListener('change', e => setSetting(k, e.target.checked));
click('set-export', exportSave);
click('set-import', importSave);
$('set-code').addEventListener('input', () => { delete $('set-import').dataset.armed; $('set-import').textContent = 'Load save code'; });
click('h-sheet', () => { pause(); openOverlay('sheet'); });
click('h-pause', pause);
click('p-resume', resume);
click('p-restart', restartCurrent);
click('p-sheet', () => openOverlay('sheet'));
click('p-dossier', () => openOverlay('dossier'));
click('p-title', toTitle);
function nextFromClear() { if (session === 'daily') toTitle(); else startLevel(save.level); }
click('c-next', nextFromClear);
click('h-restart', () => { if (mode === 'play') restartCurrent(); });
click('t-daily', () => { goBig(); show('s-title', false); startDaily(); });
click('t-pacts', () => openOverlay('pacts'));
click('c-pacts', () => openOverlay('pacts'));
click('c-share', () => openShareCard(session === 'daily' ? 'daily' : 'level'));
click('d-share', () => openShareCard('profile'));
click('card-share', () => {
  const file = new File([cardBlob], cardFileName(), { type: 'image/png' });
  navigator.share({ files: [file], text: shareText() }).catch(() => {});
});
click('card-save', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(cardBlob); a.download = cardFileName();
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  cardNote('Saved to your downloads.');
});
click('card-copy', () => {
  navigator.clipboard.write([new ClipboardItem({ 'image/png': cardBlob })]).then(() => cardNote('Image copied. Paste it anywhere.'), () => cardNote('Your browser blocked copying images. Use Save image.'));
});
click('card-text', () => {
  const txt = shareText();
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => cardNote('Text copied.'), () => window.prompt('Copy this:', txt));
  else window.prompt('Copy this:', txt);
});
click('e-ng', startNG);
click('e-keep', () => { show('s-end', false); startLevel(save.level); });
click('e-title', () => { show('s-end', false); toTitle(); });
click('c-sheet', () => openOverlay('sheet'));
click('c-dossier', () => openOverlay('dossier'));
click('c-title', toTitle);
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { SL.Audio.play('click'); closeOverlay(); });
for (const s of ['s-sheet', 's-dossier', 's-shop', 's-trophies', 's-pacts', 's-card', 's-settings']) $(s).addEventListener('click', e => { if (e.target === $(s)) closeOverlay(); });

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
// Caught editing the save: the Game reacts on the title screen.
function caughtScene() {
  if (!tamper) return;
  persist(); // the honest copy (or the stamped one) becomes the save again
  document.body.classList.add('caught');
  const el = $('caught'); el.hidden = false;
  el.querySelector('b').textContent = tamper === 'restored' ? 'I SAW THAT.' : 'THESE NUMBERS ARE NOT YOURS.';
  const lines = tamper === 'restored' ? SL.VOICE.caughtRestored : SL.VOICE.caughtModified;
  setTimeout(() => { el.hidden = true; document.body.classList.remove('caught'); lines.forEach(t => say(SL.say(t, { n: save.caught }), 'glitch', { hold: 2.6, prio: 4, force: true })); }, 2600);
  R.glitch = 1.2;
  setTimeout(() => SL.Audio.play('unplug'), 100);
  setTimeout(() => checkTrophies(), 3000);
}
SL.Audio.setOn(save.sound);
SL.Audio.setVolumes(save.settings.music, save.settings.sfx);
SL.Audio.music(SL.Audio.titleTrack()); // starts on the first tap or key press
layout();
setupAttract();
refreshCounts();
setTimeout(() => { checkTrophies(); announceUnlocks(); }, 900); // anything already earned pays out on boot
caughtScene();
requestAnimationFrame(frame);
})();
