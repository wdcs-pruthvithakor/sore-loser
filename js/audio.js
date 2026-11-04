// Tiny synthesized sound effects. No files.
(function (G) {
'use strict';
const SL = G.SL;
let ac = null, master = null;
const A = SL.Audio = { on: true };

function ctx() {
  if (!ac) {
    const C = G.AudioContext || G.webkitAudioContext;
    if (!C) return null;
    ac = new C();
    master = ac.createGain(); master.gain.value = 0.32; master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
A.unlock = () => { if (A.on) ctx(); };

function tone(f0, f1, dur, type, vol, delay) {
  if (!A.on) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime + (delay || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, hp, delay) {
  if (!A.on) return;
  const c = ctx(); if (!c) return;
  const t = c.currentTime + (delay || 0);
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
  const g = c.createGain(); g.gain.value = vol || 0.2;
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t);
}

const S = {
  jump: () => tone(330, 620, 0.12, 'square', 0.12),
  land: () => noise(0.05, 0.08, 1800),
  die: () => { tone(520, 90, 0.38, 'sawtooth', 0.16); noise(0.2, 0.12, 400); },
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
  coin: () => { tone(988, 988, 0.06, 'square', 0.08); tone(1319, 1319, 0.12, 'square', 0.08, 0.06); },
  head: () => tone(240, 180, 0.06, 'square', 0.07)
};
A.play = name => { try { if (A.on && S[name]) S[name](); } catch (e) { /* audio is optional */ } };

})(typeof window !== 'undefined' ? window : globalThis);
