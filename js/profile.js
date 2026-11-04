// Behaviour tracker, player profiler and the Cheat Director. Plain counters and weights, no AI.
(function (G) {
'use strict';
const SL = G.SL;
const clamp01 = v => Math.max(0, Math.min(1, v));

const Profile = SL.Profile = {
  blank() {
    return {
      levels: 0, time: 0, jumps: 0, idle: 0, deaths: 0, causes: {},
      signFollow: 0, signDefy: 0, cpTouches: 0, cpLevels: 0, cpRespawns: 0,
      // lifetime history the world reads for discovery checks
      bonks: 0, crumbleSurvive: 0
    };
  },
  blankStats() {
    return { time: 0, jumps: 0, idle: 0, deaths: 0, causes: {}, signFollow: 0, signDefy: 0, cpTouches: 0, cpRespawns: 0 };
  },
  // Adds a world's running stats into the lifetime profile.
  merge(p, s) {
    for (const k of ['time', 'jumps', 'idle', 'deaths', 'signFollow', 'signDefy', 'cpTouches', 'cpRespawns']) p[k] += s[k] || 0;
    for (const k in s.causes) p.causes[k] = (p.causes[k] || 0) + s.causes[k];
  },

  // Tendencies, 0..1, with a small prior so the first level does not swing wildly.
  traits(p) {
    const jps = (p.jumps + 8) / (p.time + 10);
    const idleFrac = (p.idle + 1.5) / (p.time + 10);
    const c = p.causes || {};
    const dpl = (p.deaths + 2) / (p.levels + 1);
    return {
      jumpy: clamp01((jps - 0.4) / 1.2),
      caution: clamp01(idleFrac / 0.35),
      gullible: (p.signFollow + 1) / (p.signFollow + p.signDefy + 2),
      flagLove: (p.cpTouches + 1) / (p.cpLevels + 2),
      stubborn: clamp01(dpl / 8),
      spikey: ((c.spike || 0) + (c.ceilSpike || 0) + (c.pinholes || 0) + 1) / (p.deaths + 4),
      falls: ((c.pit || 0) + (c.secretFloor || 0) + (c.thirdTime || 0) + 1) / (p.deaths + 4),
      n: { jps, idlePct: Math.round(idleFrac * 100), trustPct: Math.round(100 * (p.signFollow + 1) / (p.signFollow + p.signDefy + 2)), dpl }
    };
  },

  // Which traits push which cheats, and what the game says about it.
  DRIVERS: {
    thirdTime: { trait: 'jumpy', k: 2.5, say: n => `You jump ${n.jps.toFixed(1)} times a second. The platforms have been counting.` },
    headache: { trait: 'jumpy', k: 2.0, say: () => 'You jump at every edge. I put something above them.' },
    pinholes: { trait: 'caution', k: 2.5, say: n => `You stand still ${n.idlePct}% of the time. The floor has been waiting too.` },
    coldFeet: { trait: 'caution', k: 1.5, say: () => 'You take your time. So does the exit.' },
    shouting: { trait: 'gullible', k: 3.0, say: n => `You believed ${n.trustPct}% of my signs. I wrote you more.` },
    backwardsFlag: { trait: 'flagLove', k: 2.5, say: () => 'You love checkpoints. I made one just for you.' },
    paperSpikes: { trait: 'spikey', k: 3.0, say: () => 'Spikes keep getting you. Now you will respect every one of them.' },
    secretFloor: { trait: 'falls', k: 3.0, say: () => 'You fall in a lot of pits. Here is one you cannot jump.' },
    mimic: { trait: 'gullible', k: 2.0, say: () => 'You trust anything that looks like an exit. Noted.' },
    ceilingTeeth: { trait: 'caution', k: 2.5, say: () => 'You stop to think. The ceiling likes thinkers.' },
    shyLedge: { trait: 'jumpy', k: 2.5, say: () => 'You jump the instant you can. Some ledges are shy about that.' },
    swapZone: { trait: 'stubborn', k: 2.5, say: n => `You die ${n.dpl.toFixed(1)} times a level. Let us see you do it backwards.` },
    impatient: { trait: 'caution', k: 3.0, say: n => `You stand still ${n.idlePct}% of the time. The floor is done waiting.` },
    copycat: { trait: 'stubborn', k: 2.0, say: () => 'You keep retrying the same way. Now your shadow does too.' }
  },

  // The Cheat Director: picks this level's cheats. New cheats are introduced one per level,
  // the rest are weighted by how you play, so the game targets your habits, not your skill.
  choose(level, sheet, p, lastCheats, runSeed) {
    const r = SL.rng(SL.hashStr(runSeed + ':director:' + level));
    if (level === 1) return { cheats: ['coldFeet'], reasons: [], intro: 'coldFeet' };
    const count = SL.cheatCount(level, r);
    const picks = [];
    let intro = null;
    const fresh = SL.INTRO_ORDER.filter(id => !(sheet[id] && sheet[id].met));
    if (fresh.length) { intro = fresh[0]; picks.push(intro); }
    const tr = Profile.traits(p);
    const weights = {};
    for (const id of SL.CHEAT_IDS) {
      if (picks.indexOf(id) >= 0) continue;
      if (fresh.indexOf(id) >= 0) continue; // unseen cheats wait for their intro
      if (picks.some(q => (SL.CLASH[q] || []).indexOf(id) >= 0)) continue;
      const d = Profile.DRIVERS[id];
      let w = 1 + Math.max(0, tr[d.trait] - 0.25) * d.k;
      if (lastCheats && lastCheats.indexOf(id) >= 0) w *= 0.55;
      weights[id] = w;
    }
    const reasons = [];
    while (picks.length < count) {
      const ids = Object.keys(weights);
      if (!ids.length) break;
      let total = 0;
      for (const id of ids) total += weights[id];
      let roll = r() * total, pick = ids[ids.length - 1];
      for (const id of ids) { roll -= weights[id]; if (roll <= 0) { pick = id; break; } }
      if (weights[pick] >= 1.7) reasons.push(Profile.DRIVERS[pick].say(tr.n));
      picks.push(pick);
      delete weights[pick];
      for (const c of SL.CLASH[pick] || []) delete weights[c];
    }
    return { cheats: picks, reasons, intro };
  }
};

})(typeof window !== 'undefined' ? window : globalThis);
