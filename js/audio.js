// Every sound and every note of music is synthesized here at runtime. No audio files, no samples.
(function (G) {
'use strict';
const SL = G.SL;
let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const A = SL.Audio = { on: true, sfxVol: 0.8, musicVol: 0.55 };

function ctx() {
  if (!ac) {
    const C = G.AudioContext || G.webkitAudioContext;
    if (!C) return null;
    ac = new C();
    master = ac.createGain(); master.gain.value = A.on ? 0.36 : 0;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = A.sfxVol; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = A.musicVol * 0.5; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
A.unlock = () => { ctx(); if (A.wantTrack && !A.track) A.music(A.wantTrack); };
A.setOn = on => { A.on = on; if (master) master.gain.setTargetAtTime(on ? 0.36 : 0, ac.currentTime, 0.05); };
A.setVolumes = (music, sfx) => {
  A.musicVol = music; A.sfxVol = sfx;
  if (ac) { musicBus.gain.setTargetAtTime(music * 0.5, ac.currentTime, 0.05); sfxBus.gain.setTargetAtTime(sfx, ac.currentTime, 0.05); }
};

// ---------- building blocks ----------
function tone(f0, f1, dur, type, vol, delay, bus, at) {
  const c = ctx(); if (!c) return;
  const t = at !== undefined ? at : c.currentTime + (delay || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus || sfxBus);
  o.start(t); o.stop(t + dur + 0.03);
}
function noise(dur, vol, freq, delay, type, bus, at) {
  const c = ctx(); if (!c) return;
  const t = at !== undefined ? at : c.currentTime + (delay || 0);
  const s = c.createBufferSource(); s.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = type || 'highpass'; f.frequency.value = freq || 800;
  const g = c.createGain();
  g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus || sfxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

// ---------- sound effects ----------
const S = {
  jump: () => tone(330, 620, 0.12, 'square', 0.1),
  land: () => noise(0.05, 0.08, 1800),
  die: () => { tone(520, 90, 0.38, 'sawtooth', 0.15); noise(0.2, 0.12, 400); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.18, i * 0.08)),
  flee: () => { tone(900, 300, 0.22, 'triangle', 0.16); tone(1200, 500, 0.16, 'square', 0.06, 0.05); },
  crumble: () => { noise(0.3, 0.14, 300); tone(200, 80, 0.3, 'square', 0.05); },
  bonk: () => { tone(160, 70, 0.18, 'square', 0.2); noise(0.08, 0.15, 600); },
  drop: () => tone(1400, 400, 0.14, 'sine', 0.08),
  pop: () => { tone(1800, 900, 0.06, 'square', 0.1); noise(0.06, 0.1, 3000); },
  save: () => [784, 988].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.15, i * 0.07)),
  crack: () => [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f * 1.01, 0.14, 'square', 0.1, i * 0.06)),
  seen: () => { tone(220, 330, 0.18, 'triangle', 0.12); tone(233, 349, 0.18, 'triangle', 0.08, 0.02); },
  click: () => tone(660, 660, 0.04, 'square', 0.06),
  blip: () => tone(420 + Math.random() * 120, 400, 0.025, 'square', 0.025),
  head: () => tone(240, 180, 0.06, 'square', 0.07),
  coin: () => { tone(988, 988, 0.06, 'square', 0.08); tone(1319, 1319, 0.12, 'square', 0.08, 0.06); },
  // new
  slam: () => { tone(120, 40, 0.25, 'sine', 0.35); noise(0.18, 0.22, 200, 0, 'lowpass'); },
  creak: () => { tone(180, 120, 0.12, 'sawtooth', 0.05); noise(0.08, 0.05, 900, 0, 'bandpass'); },
  tileFall: () => { noise(0.25, 0.1, 250, 0, 'lowpass'); tone(300, 90, 0.2, 'triangle', 0.06); },
  lunge: () => { noise(0.18, 0.12, 2500); tone(500, 900, 0.12, 'square', 0.06); },
  reveal: () => { tone(200, 140, 0.12, 'square', 0.16); tone(1200, 1600, 0.08, 'sine', 0.06, 0.02); },
  wall: () => { tone(60, 45, 0.9, 'sawtooth', 0.12); tone(64, 48, 0.9, 'sawtooth', 0.1); noise(0.6, 0.06, 150, 0, 'lowpass'); },
  shieldPop: () => { tone(900, 1800, 0.08, 'sine', 0.14); noise(0.12, 0.08, 4000); },
  plant: () => { tone(523, 784, 0.1, 'triangle', 0.12); noise(0.05, 0.08, 500, 0.05, 'lowpass'); },
  coinsLost: () => [988, 784, 587, 392].forEach((f, i) => tone(f, f * 0.9, 0.1, 'square', 0.07, i * 0.06)),
  unplug: () => { tone(80, 30, 0.6, 'sawtooth', 0.2); noise(0.4, 0.18, 300, 0, 'lowpass'); [1200, 900, 600].forEach((f, i) => tone(f, f / 2, 0.12, 'square', 0.06, 0.1 + i * 0.08)); },
  bossTooth: () => tone(1600, 700, 0.18, 'sine', 0.06),
  bossSaw: () => { tone(300, 600, 0.5, 'sawtooth', 0.05); noise(0.5, 0.04, 2000); },
  swap: () => { tone(400, 800, 0.15, 'sine', 0.1); tone(800, 400, 0.15, 'sine', 0.08, 0.12); },
  shake: () => noise(0.4, 0.1, 120, 0, 'lowpass'),
  rankUp: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.14, i * 0.07)),
  trophy: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, f, 0.2, 'square', 0.08, i * 0.09)); tone(1568, 1568, 0.5, 'triangle', 0.08, 0.36); },
  buy: () => { tone(1319, 1319, 0.05, 'square', 0.07); tone(1760, 1760, 0.1, 'square', 0.07, 0.05); noise(0.05, 0.05, 6000, 0.02); },
  box: () => { for (let i = 0; i < 8; i++) tone(300 + i * 90, 300 + i * 90, 0.05, 'square', 0.05, i * 0.04); },
  jackpot: () => [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, f, 0.12, 'square', 0.09, i * 0.07)),
  quake: () => { tone(50, 35, 0.6, 'sine', 0.25); noise(0.5, 0.1, 160, 0, 'lowpass'); },
  thunder: () => { noise(1.4, 0.16, 300, 0, 'lowpass'); tone(45, 30, 1.2, 'sine', 0.12); }
};
A.play = name => { if (!A.on || !S[name]) return; ctx(); S[name](); };

// ---------- music: a small procedural composer ----------
// A track is a key, a scale, a chord progression, a tempo and a set of instruments. Melodies and
// arpeggio patterns are generated from a seed, so every world has its own tune and it never needs files.
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], locrian: [0, 1, 3, 5, 6, 8, 10]
};
const PROGS = {
  cute: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 4]],
  grim: [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 4]],
  evil: [[0, 1, 0, 6], [0, 5, 1, 4], [0, 1, 5, 6]]
};
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

function buildTrack(spec) {
  const r = SL.rng(SL.hashStr('music:' + spec.id));
  const mood = spec.mood, scale = SCALES[spec.scale || (mood === 'cute' ? 'major' : mood === 'grim' ? r.pick(['minor', 'dorian']) : r.pick(['phrygian', 'harmonic', 'locrian']))];
  const prog = r.pick(PROGS[mood]);
  const root = 45 + r.int(0, 7) + (mood === 'cute' ? 3 : 0); // A2..E3
  const deg = (d, oct) => { const n = scale.length; const o = Math.floor(d / n); return root + 12 * (o + (oct || 0)) + scale[((d % n) + n) % n]; };
  // melody: 2 phrases of 16 eighth-steps, mostly stepwise
  const phrase = () => { const out = []; let p = r.int(2, 6); for (let i = 0; i < 16; i++) { if (r.chance(mood === 'evil' ? 0.3 : 0.22)) { out.push(null); continue; } p += r.pick([-2, -1, -1, 0, 1, 1, 2, 3]); p = Math.max(0, Math.min(11, p)); out.push(p); } return out; };
  const arp = [0, 2, 4, 2, 0, 4, 2, 4].map(v => (r.chance(0.2) ? v + 7 : v));
  return {
    id: spec.id, tempo: spec.tempo, mood, prog, deg, mel: [phrase(), phrase()], arp,
    drums: spec.drums !== false, lead: spec.lead || (mood === 'cute' ? 'triangle' : mood === 'grim' ? 'square' : 'sawtooth'),
    dissonance: spec.dissonance || 0, bassType: mood === 'evil' ? 'sawtooth' : 'triangle', title: !!spec.title
  };
}

let seqTimer = null, nextTime = 0, step = 0;
function playStep(tr, t) {
  const bar = Math.floor(step / 16) % 4, s = step % 16, chord = tr.prog[bar];
  const spb = 60 / tr.tempo / 4; // seconds per 16th
  const M = musicBus;
  // drums
  if (tr.drums) {
    const kick = tr.mood === 'evil' ? (s % 4 === 0 || s === 14) : (s % 8 === 0 || (tr.mood === 'grim' && s === 11));
    if (kick) tone(150, 42, 0.22, 'sine', 0.55, 0, M, t);
    if (s === 4 || s === 12) noise(0.12, 0.22, 1800, 0, 'bandpass', M, t);
    if (s % 2 === 0) noise(0.03, s % 4 === 2 ? 0.07 : 0.04, 7000, 0, 'highpass', M, t);
  } else if (s % 4 === 0) noise(0.03, 0.03, 8000, 0, 'highpass', M, t);
  // bass on the beat
  if (s % 4 === 0 || (tr.mood !== 'cute' && s % 4 === 3)) tone(midi(tr.deg(chord, -1)), midi(tr.deg(chord, -1)), spb * 3, tr.bassType, 0.16, 0, M, t);
  // arpeggio on 16ths, quiet
  if (!tr.title || s % 2 === 0) { const a = tr.arp[s % 8]; tone(midi(tr.deg(chord + a, 1)), midi(tr.deg(chord + a, 1)), spb * 0.9, 'square', 0.035, 0, M, t); }
  // melody on 8ths
  if (s % 2 === 0) {
    const ph = tr.mel[Math.floor(step / 32) % 2], n = ph[(s / 2 + bar * 8) % 16];
    if (n !== null) {
      let note = tr.deg(chord + n - 2, 1);
      if (tr.dissonance && Math.random() < tr.dissonance) note += Math.random() < 0.5 ? 1 : 6; // menace: wrong notes creep in
      tone(midi(note), midi(note) * (tr.mood === 'evil' ? 0.99 : 1), spb * 1.8, tr.lead, tr.mood === 'evil' ? 0.06 : 0.08, 0, M, t);
    }
  }
}
function tick() {
  if (!ac || !A.track) return;
  const tr = A.track, spb = 60 / tr.tempo / 4;
  while (nextTime < ac.currentTime + 0.15) {
    if (A.on && A.musicVol > 0) playStep(tr, nextTime);
    nextTime += spb; step++;
  }
}
A.music = function (spec) {
  A.wantTrack = spec;
  if (!spec) { A.track = null; return; }
  if (A.track && A.track.id === spec.id) return;
  const c = ctx(); if (!c) return;
  A.track = buildTrack(spec);
  step = 0; nextTime = c.currentTime + 0.12;
  if (!seqTimer) seqTimer = setInterval(tick, 30);
};
A.stopMusic = () => { A.track = null; A.wantTrack = null; };

// Which track a level gets: its world sets the mood and key, menace speeds it up and adds wrong notes.
A.trackFor = function (themeId, diff, ng, opts) {
  opts = opts || {};
  const menace = SL.menaceFor ? SL.menaceFor(diff, ng) : 0;
  const cute = ['meadow', 'candy', 'frost', 'deep', 'synth'], grim = ['canyon', 'swamp', 'graveyard', 'rust', 'storm'];
  const mood = opts.boss ? 'evil' : cute.indexOf(themeId) >= 0 && menace < 3 ? 'cute' : grim.indexOf(themeId) >= 0 || menace < 4 ? 'grim' : 'evil';
  const base = { cute: 112, grim: 124, evil: 140 }[mood];
  return {
    id: (opts.boss ? 'boss:' : '') + themeId + ':' + diff + ':' + ng, mood,
    tempo: Math.min(176, base + (opts.boss ? 18 : 0) + Math.min(24, (ng || 0) * 3)),
    dissonance: Math.min(0.25, Math.max(0, menace - 2) * 0.03)
  };
};
A.titleTrack = () => ({ id: 'title', mood: 'cute', tempo: 96, drums: false, title: true });

})(typeof window !== 'undefined' ? window : globalThis);
