// The world: player physics, hazards and every cheat's behaviour. No DOM.
// Emits events into world.events; the UI drains them each frame.
(function (G) {
'use strict';
const SL = G.SL;
const T = SL.TILE, H = SL.ROWS, TC = SL.TC;
const PW = 20, PH = 24;
SL.PW = PW; SL.PH = PH;
const P = {
  accel: 2600, airAccel: 1900, turn: 1.7, max: 235, fric: 2900, airDrag: 400,
  grav: 1900, gravRelease: 3800, gravFall: 2300, jumpV: 650, maxFall: 950,
  coyote: 0.09, buffer: 0.12
};
SL.PHYS = P;

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function World(L, history) {
  this.L = L;
  this.P = Object.assign({}, P);
  if (L.twist === 'ice') Object.assign(this.P, { accel: 900, fric: 260, turn: 1.0 });
  if (L.twist === 'floaty') Object.assign(this.P, { grav: P.grav * 0.8, gravRelease: P.gravRelease * 0.8, gravFall: P.gravFall * 0.8, maxFall: 700 });
  this.rage = L.diff === 'rage';
  this.has = {};
  for (const id of L.cheats) this.has[id] = true;
  this.history = history || { bonks: 0, crumbleSurvive: 0, causes: {} };
  this.history.tunnels = this.history.tunnels || 0;
  this.history.shakes = this.history.shakes || 0;
  this.history.reveals = this.history.reveals || 0;
  this.events = [];
  this.stats = SL.Profile.blankStats();
  this.t = 0;
  this.won = false;
  this.fled = 0;
  this.cpReal = false;
  this.respawnAt = { x: L.start.x - PW / 2, y: L.start.y - PH };
  this.revealed = new Set();
  this.seen = {};
  this.discovered = {};
  this.attempt = 0;
  this.idleRun = 0;
  for (const p of L.plats) { p.baseX = p.x; p.homeY = p.y; }
  this.p = { x: 0, y: 0, vx: 0, vy: 0, face: 1, grounded: false, coy: 0, buf: 0, alive: true, deadT: 0, sq: 1, trapT: 0, bonkT: 0, fallPlatT: 0 };
  this.reset();
}
SL.World = World;
const W = World.prototype;

W.emit = function (type, data) { this.events.push(Object.assign({ type }, data || {})); };
W.code = function (c, r) {
  const L = this.L;
  if (c < 0 || c >= L.w) return TC.GROUND;
  if (r < 0 || r >= H) return TC.E;
  if (this.dropped && this.dropped.size) { const d = this.dropped.get(c); if (d !== undefined && r >= d) return TC.E; }
  const v = L.tiles[r * L.w + c];
  if (v === TC.INVIS) return this.shown && this.shown.has(r * L.w + c) ? TC.GROUND : TC.INVIS;
  return v;
};
W.solid = function (c, r) { return SL.isSolid(this.code(c, r)); };
W.rect = function () { return { x: this.p.x, y: this.p.y, w: PW, h: PH }; };

// Back to the respawn point with every trap re-armed.
W.reset = function () {
  const p = this.p, L = this.L;
  Object.assign(p, {
    x: this.respawnAt.x, y: this.respawnAt.y, vx: 0, vy: 0, grounded: true, coy: 0, buf: 0, alive: true, deadT: 0,
    sq: 1, trapT: 0, bonkT: 0, fallPlatT: 0, groundPlat: null, lastPlat: null, groundCode: TC.GROUND, takeoffX: null, air: 0
  });
  for (const pl of L.plats) { pl.shake = 0; pl.fallen = false; pl.fy = 0; pl.fvy = 0; pl.dx = 0; pl.y = pl.homeY; pl.x = pl.baseX; pl.dodged = false; pl.dodgeT = -1; }
  this.door = { spot: 0, x: L.doorSpots[0].x, y: L.doorSpots[0].y, hopsLeft: L.hops, hop: null, scared: 0 };
  this.popped = new Map();
  this.bonks = [];
  this.landCount = 0;
  this.cpFake = false;
  this.forkState = L.forks.map(() => ({ read: false, route: null, done: false }));
  this.paperT = 0;
  this.swapped = false; this.swirlUsed = new Set(); this.swapJumps = 0;
  this.teeth = []; this.fired = new Set(); this.tunnelDone = L.tunnels.map(() => false);
  this.dropped = new Map(); this.still = { c: -1, t: 0, warned: false }; this.dropT = 0;
  this.trail = []; this.ghost = null; this.awakeT = -1; this.lifeT = 0;
  this.mimicPassed = L.mimics.map(() => false); this.chomp = null;
  this.shown = new Set(); this.falseT = 0;
  this.lunge = L.lungers.map(l => ({ x: l.c * T, y: l.row * T, moving: false, moved: 0, passed: false }));
  this.wall = { on: false, x: -1e9 };
  this.quakeT = 2.5;
  this.attempt++;
  this.platMove(0);
};

W.platMove = function (dt) {
  for (const pl of this.L.plats) {
    if (pl.kind === 'move') {
      const nx = pl.x0 + (pl.x1 - pl.x0) * (0.5 - 0.5 * Math.cos(pl.phase + this.t * pl.omega));
      pl.dx = nx - pl.x; pl.x = nx;
    }
    if ((pl.kind === 'shy' || pl.kind === 'slide') && pl.dodgeT >= 0) {
      pl.dodgeT += dt;
      const t = pl.dodgeT, D = 3.5 * T;
      const off = t < 0.14 ? D * t / 0.14 : t < 1.2 ? D : t < 1.6 ? D * (1 - (t - 1.2) / 0.4) : 0;
      if (pl.kind === 'shy') pl.y = pl.homeY + off;
      else { const nx = pl.baseX + off * 3 / 3.5; pl.dx = nx - pl.x; pl.x = nx; }
      if (t >= 1.6) { pl.dodgeT = -1; pl.dx = 0; }
    } else if (pl.kind === 'slide') pl.dx = 0;
    if (pl.shake > 0) {
      pl.shake -= dt;
      if (pl.shake <= 0) { pl.fallen = true; pl.fvy = 0; this.emit('platFall', { x: pl.x + pl.w / 2, y: pl.y }); }
    }
    if (pl.fallen) { pl.fvy += 1600 * dt; pl.fy += pl.fvy * dt; }
  }
};

W.die = function (cause) {
  const p = this.p;
  if (!p.alive || this.won) return;
  p.alive = false; p.deadT = 0.45;
  if (this.has[cause]) this.markSeen(cause);
  this.stats.deaths++;
  this.stats.causes[cause] = (this.stats.causes[cause] || 0) + 1;
  this.history.causes = this.history.causes || {};
  this.history.causes[cause] = (this.history.causes[cause] || 0) + 1;
  this.emit('death', { cause, x: p.x + PW / 2, y: Math.min(p.y + PH / 2, H * T - 8) });
};

W.discover = function (id) {
  if (this.discovered[id] || !this.has[id]) return;
  this.discovered[id] = true;
  this.emit('discover', { id });
};
W.markSeen = function (id) {
  if (this.seen[id] || !this.has[id]) return;
  this.seen[id] = true;
  this.emit('seen', { id });
};

// input: { left, right, jump, jumpPressed, down }
W.update = function (dt, input) {
  if (this.won) return;
  if (this.L.twist === 'fast') dt *= 1.2;
  this.t += dt;
  const p = this.p, L = this.L, P = this.P;
  this.platMove(dt);

  if (!p.alive) {
    p.deadT -= dt;
    if (p.deadT <= 0) {
      if (this.cpReal) this.stats.cpRespawns++;
      this.reset();
      this.emit('respawn', { atCheckpoint: this.cpReal });
    }
    return;
  }
  this.stats.time += dt;
  this.lifeT += dt;

  // ----- horizontal (Wrong Way swaps the keys) -----
  let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (this.swapped) dir = -dir;
  if (L.twist === 'mirror') dir = -dir;   // the screen is flipped, so keys follow the screen
  if (dir) {
    const a = (p.grounded ? P.accel : P.airAccel) * (Math.sign(p.vx) === -dir ? P.turn : 1);
    p.vx += dir * a * dt;
    if (Math.abs(p.vx) > P.max) p.vx = Math.sign(p.vx) * P.max;
    p.face = dir;
  } else {
    const f = (p.grounded ? P.fric : P.airDrag) * dt;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }
  if (p.grounded && !dir && !input.jump) { this.stats.idle += dt; this.idleRun += dt; } else this.idleRun = 0;
  if (this.idleRun > 9) { this.idleRun = -30; this.emit('idle'); }

  // ----- jump -----
  if (input.jumpPressed) p.buf = P.buffer; else p.buf -= dt;
  if (p.grounded) p.coy = P.coyote; else p.coy -= dt;
  if (p.buf > 0 && p.coy > 0) {
    p.vy = -P.jumpV; p.buf = 0; p.coy = 0; p.grounded = false;
    p.sq = 1.25; p.takeoffX = p.x + PW / 2;
    this.stats.jumps++;
    this.emit('jump', { x: p.x + PW / 2, y: p.y + PH });
    if (p.groundCode === TC.CRACK && this.has.headache) this.spawnBonk();
    if (this.swapped) this.swapJumps++;
    // Shy Ledge: the first jump toward a ledge with eyes makes it duck
    for (const pl of L.plats) {
      if ((pl.kind !== 'shy' && pl.kind !== 'slide') || pl.dodged || pl.fallen) continue;
      const ahead = pl.x - (p.x + PW / 2);
      if (ahead > -8 && ahead < 7 * T && Math.abs(pl.homeY - (p.y + PH)) < 4 * T) {
        pl.dodged = true; pl.dodgeT = 0;
        this.markSeen(pl.kind === 'shy' ? 'shyLedge' : 'runaway');
        this.emit('dodge', { x: pl.x + pl.w / 2, y: pl.y });
      }
    }
    if (p.lastPlat && p.lastPlat.shake > 0 && p.groundPlat === p.lastPlat) {
      this.history.crumbleSurvive = (this.history.crumbleSurvive || 0) + 1;
      if (this.history.crumbleSurvive >= 2) this.discover('rotten');
    }
  }
  if (input.down && p.grounded) this.emit('down');
  const grav = p.vy < 0 ? (input.jump ? P.grav : P.gravRelease) : P.gravFall;
  p.vy = Math.min(P.maxFall, p.vy + grav * dt);

  // ride moving platforms
  if (p.groundPlat && !p.groundPlat.fallen) p.x += p.groundPlat.dx;

  // ----- move X -----
  p.x += p.vx * dt;
  const r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + PH - 0.001) / T);
  if (p.vx > 0 || (p.groundPlat && p.groundPlat.dx > 0)) {
    const c = Math.floor((p.x + PW - 0.001) / T);
    for (let r = r0; r <= r1; r++) if (this.solid(c, r)) { p.x = c * T - PW; p.vx = Math.min(0, p.vx); break; }
  }
  if (p.vx < 0 || (p.groundPlat && p.groundPlat.dx < 0)) {
    const c = Math.floor(p.x / T);
    for (let r = r0; r <= r1; r++) if (this.solid(c, r)) { p.x = (c + 1) * T; p.vx = Math.max(0, p.vx); break; }
  }

  // ----- move Y -----
  const wasGrounded = p.grounded;
  const prevBottom = p.y + PH;
  p.y += p.vy * dt;
  p.grounded = false;
  let landedPlat = null;
  const c0 = Math.floor(p.x / T), c1 = Math.floor((p.x + PW - 0.001) / T);
  if (p.vy >= 0) {
    const r = Math.floor((p.y + PH - 0.001) / T);
    let hitCode = null;
    for (let c = c0; c <= c1; c++) {
      const code = this.code(c, r);
      if (SL.isSolid(code) && prevBottom <= r * T + 1) { hitCode = code; break; }
    }
    if (hitCode !== null) {
      p.y = r * T - PH; p.vy = 0; p.grounded = true;
      const cc = this.code(Math.floor((p.x + PW / 2) / T), r);
      p.groundCode = SL.isSolid(cc) ? cc : hitCode;
    } else {
      for (const pl of L.plats) {
        if (pl.fallen) continue;
        if (prevBottom <= pl.y + 1 && p.y + PH >= pl.y && p.x + PW > pl.x + 2 && p.x < pl.x + pl.w - 2) {
          p.y = pl.y - PH; p.vy = 0; p.grounded = true; landedPlat = pl; p.groundCode = TC.GROUND; break;
        }
      }
    }
  } else {
    const r = Math.floor(p.y / T);
    if (this.has.invisBlock) {
      for (let c = c0; c <= c1; c++) {
        const k = r * L.w + c;
        if (r >= 0 && c >= 0 && c < L.w && L.tiles[k] === TC.INVIS && !this.shown.has(k)) {
          this.shown.add(k); this.history.reveals++;
          p.vx *= 0.35;
          this.markSeen('invisBlock');
          this.emit('reveal', { x: c * T + T / 2, y: r * T + T });
        }
      }
    }
    for (let c = c0; c <= c1; c++) if (this.solid(c, r)) { p.y = (r + 1) * T; p.vy = 0; this.emit('head'); break; }
  }
  p.groundPlat = landedPlat;

  if (p.grounded && !wasGrounded) {
    p.sq = 0.72;
    this.emit('land', { x: p.x + PW / 2, y: p.y + PH, hard: prevBottom });
    // Headache Block: crossing a cracked gap on purpose
    if (p.takeoffX !== null) {
      for (const gq of L.gotchas) {
        if (p.takeoffX < gq.x0 * T && p.x + PW / 2 >= gq.x1 * T && p.x + PW / 2 < gq.x1 * T + 3 * T && (this.history.bonks || 0) > 0) this.discover('headache');
      }
    }
    // Invisible Block: clearing a gap whose block you did not touch, after one got you
    if (p.takeoffX !== null && this.history.reveals > 0) {
      for (const iv of L.invis) {
        const k = iv.row * L.w + iv.c;
        if (!this.shown.has(k) && p.takeoffX < iv.c * T && p.x >= (iv.c + iv.gap) * T - PW) this.discover('invisBlock');
      }
    }
    p.takeoffX = null;
  }
  if (landedPlat && landedPlat.kind === 'shy' && landedPlat.dodged && p.grounded && !wasGrounded) this.discover('shyLedge');
  if (landedPlat && landedPlat.kind === 'slide' && landedPlat.dodged && p.grounded && !wasGrounded) this.discover('runaway');
  if (landedPlat) p.lastPlat = landedPlat;
  // Rotten Platforms: a random set gives way a quarter-second after you land
  if (landedPlat && !wasGrounded && landedPlat.rotten && this.has.rotten && !landedPlat.shake && !landedPlat.fallen) {
    landedPlat.shake = 0.28;
    this.markSeen('rotten');
    this.emit('crumble', { x: landedPlat.x + landedPlat.w / 2, y: landedPlat.y });
  }
  if (!p.grounded) p.air += dt; else p.air = 0;
  p.sq += (1 - p.sq) * Math.min(1, dt * 12);

  this.hazards(dt);
  this.cheatChecks(dt, input);
};

W.spawnBonk = function () {
  const p = this.p;
  this.bonks.push({ x: p.x + PW / 2 - 15, y: p.y - 90, vy: 500, hit: false });
  this.markSeen('headache');
  this.emit('bonkDrop');
};

W.hazards = function (dt) {
  const p = this.p, L = this.L;
  const pr = { x: p.x + 2, y: p.y + 2, w: PW - 4, h: PH - 2 };
  const c0 = Math.floor(p.x / T) - 1, c1 = Math.floor((p.x + PW) / T) + 1;
  const r0 = Math.max(0, Math.floor(p.y / T) - 1), r1 = Math.min(H - 1, Math.floor((p.y + PH) / T) + 1);
  if (p.trapT > 0) p.trapT -= dt;
  if (this.falseT > 0) this.falseT -= dt;
  if (p.bonkT > 0) p.bonkT -= dt;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const code = this.code(c, r);
    if (code === TC.SPIKE && overlap(pr, { x: c * T + 6, y: r * T + 13, w: T - 12, h: T - 13 })) {
      return this.die(p.trapT > 0 ? 'shouting' : 'spike');
    }
    if (code === TC.SPIKED && overlap(pr, { x: c * T + 6, y: r * T, w: T - 12, h: 16 })) return this.die('ceilSpike');
    if (code === TC.FALSE && overlap(pr, { x: c * T, y: r * T, w: T, h: T })) {
      const inFork = L.forks.some(f => c * T >= f.trapX0 && c * T < f.trapX1);
      if (inFork) p.trapT = 2.5; else { this.falseT = 2.5; this.markSeen('falseFloor'); }
    }
  }

  // Lunging spikes: a lone spike charges when you come within three tiles
  for (const lg of this.lunge) {
    const pcx = p.x + PW / 2, feet = p.y + PH;
    if (!lg.moving && lg.moved === 0 && lg.x + T / 2 - pcx > 0 && lg.x + T / 2 - pcx < 3 * T + 8 && Math.abs(feet - (lg.y + T)) < 2 * T) {
      lg.moving = true; this.markSeen('lunger'); this.emit('lunge', { x: lg.x + T / 2, y: lg.y + T });
    }
    if (lg.moving) {
      const step = 520 * dt;
      const nx = lg.x - step, c = Math.floor((nx + 4) / T), row = Math.floor(lg.y / T);
      if (lg.moved > 6 * T || !SL.isSolid(this.code(c, row + 1)) || SL.isSolid(this.code(c, row))) lg.moving = false;
      else { lg.x = nx; lg.moved += step; }
    }
    if (overlap(pr, { x: lg.x + 6, y: lg.y + 13, w: T - 12, h: T - 13 })) return this.die('lunger');
    if (lg.moved > 0 && !lg.passed && pcx > lg.x + T + 4) { lg.passed = true; this.discover('lunger'); }
  }

  // Spike wall: follows at about half your speed once you leave the start
  if (this.has.spikeWall) {
    const wl = this.wall;
    if (!wl.on && p.x > this.respawnAt.x + 2 * T) { wl.on = true; wl.x = this.respawnAt.x - 8 * T; this.markSeen('spikeWall'); this.emit('wallWake'); }
    if (wl.on) {
      wl.x = Math.min(wl.x + [100, 110, 120, 130, 140][L.gt] * dt, (L.w - 4) * T);
      if (p.x < wl.x + 4) return this.die('spikeWall');
    }
  }

  // Earthquake twist: the world jolts you every few seconds
  if (L.twist === 'shaky') {
    this.quakeT -= dt;
    if (this.quakeT <= 0) { this.quakeT = 2.2 + Math.random() * 1.6; p.vx += (Math.random() < 0.5 ? -1 : 1) * 160; this.emit('quake'); }
  }

  // False Floor cracked: airborne over a false tile after one has dropped you
  if (!p.grounded && this.has.falseFloor && this.history.causes && this.history.causes.falseFloor) {
    const c = Math.floor((p.x + PW / 2) / T);
    for (let r = Math.floor((p.y + PH) / T); r < Math.floor((p.y + PH) / T) + 3 && r < H; r++) {
      const code = this.code(c, r);
      if (code === TC.FALSE && !L.forks.some(f => c * T >= f.trapX0 && c * T < f.trapX1)) { this.discover('falseFloor'); break; }
      if (SL.isSolid(code)) break;
    }
  }

  // Sawblades
  for (const sw of L.saws) {
    const q = SL.sawPos(sw, this.t);
    const nx = Math.max(pr.x, Math.min(q.x, pr.x + pr.w)), ny = Math.max(pr.y, Math.min(q.y, pr.y + pr.h));
    if ((nx - q.x) * (nx - q.x) + (ny - q.y) * (ny - q.y) < 11 * 11) return this.die('saw');
  }

  // Mimics
  L.mimics.forEach((m, i) => {
    if (!p.alive) return;
    if (overlap(pr, { x: m.x - 13, y: m.y - 42, w: 26, h: 42 })) { this.chomp = { i, t: 0 }; this.die('mimic'); return; }
    if (!this.mimicPassed[i] && p.x > m.x + 16) { this.mimicPassed[i] = true; this.markSeen('mimic'); this.discover('mimic'); }
  });
  if (!p.alive) return;
  if (this.chomp) this.chomp.t += dt;

  // Ceiling Teeth: a seam above you drops a tooth a beat later
  if (this.has.ceilingTeeth) {
    const c = Math.floor((p.x + PW / 2) / T);
    for (let r = Math.floor(p.y / T); r >= Math.max(0, Math.floor(p.y / T) - 4); r--) {
      const code = this.code(c, r);
      if (code === TC.SEAM) {
        const k = r * L.w + c;
        if (!this.fired.has(k)) { this.fired.add(k); this.teeth.push({ x: c * T + T / 2, y: (r + 1) * T, vy: 0, wait: 0.2 }); this.markSeen('ceilingTeeth'); this.emit('tooth', { x: c * T + T / 2, y: (r + 1) * T }); }
        break;
      }
      if (SL.isSolid(code)) break;
    }
  }
  for (const th of this.teeth) {
    if (th.done) continue;
    if (th.wait > 0) { th.wait -= dt; continue; }
    th.vy += 2600 * dt; th.y += th.vy * dt;
    if (overlap(pr, { x: th.x - 7, y: th.y + 2, w: 14, h: 18 })) return this.die('ceilingTeeth');
    if (SL.isSolid(this.code(Math.floor(th.x / T), Math.floor((th.y + 20) / T)))) { th.done = true; this.emit('toothLand', { x: th.x, y: th.y + 20 }); }
  }
  this.teeth = this.teeth.filter(th => !th.done && th.y < H * T + 40);
  L.tunnels.forEach((tn, i) => {
    if (!this.tunnelDone[i] && p.x > tn.x1 * T) {
      this.tunnelDone[i] = true;
      if (this.has.ceilingTeeth) { this.history.tunnels++; if (this.history.tunnels >= 2) this.discover('ceilingTeeth'); }
    }
  });

  // Impatient Floor: standing still on the ground shakes it, then drops it
  if (this.dropT > 0) this.dropT -= dt;
  if (this.has.impatient) {
    const st = this.still, c = Math.floor((p.x + PW / 2) / T);
    const cp = L.checkpoint;
    const safe = c < 8 || (cp && Math.abs(c - Math.floor(cp.x / T)) <= 2) || p.groundPlat;
    if (p.grounded && !safe && Math.abs(p.vx) < 30) {
      if (st.c !== c) { st.c = c; st.t = 0; st.warned = false; }
      st.t += dt;
      const limit = this.rage ? 1.2 : 1.5;
      if (st.t > 0.8 && !st.warned) {
        st.warned = true; this.history.shakes++;
        if (!this.rage) { this.markSeen('impatient'); this.emit('shake', { x: c * T + T / 2, y: p.y + PH }); }
      }
      if (st.t > limit) {
        const r = Math.floor((p.y + PH + 2) / T);
        for (let cc = Math.floor(p.x / T); cc <= Math.floor((p.x + PW - 1) / T); cc++) {
          if (cc >= 8) { this.dropped.set(cc, r); this.emit('floorDrop', { x: cc * T + T / 2, y: r * T }); }
        }
        this.dropT = 2; st.c = -1; st.t = 0;
        p.grounded = false;
      }
    } else if (st.c >= 0) {
      if (st.warned && st.t <= 1.5 && this.history.shakes >= 2 && p.alive && !this.rage) this.discover('impatient');
      st.c = -1; st.t = 0; st.warned = false;
    }
  }

  // Copycat: a shadow replays your moves two seconds late
  if (this.has.copycat) {
    if (this.awakeT < 0 && p.x > this.respawnAt.x + 3 * T) { this.awakeT = this.lifeT; this.emit('wake'); this.markSeen('copycat'); }
    if (this.awakeT >= 0) {
      this.trail.push({ t: this.lifeT, x: p.x, y: p.y, face: p.face });
      const want = this.lifeT - 2;
      while (this.trail.length > 1 && this.trail[1].t <= want) this.trail.shift();
      this.ghost = this.trail[0].t <= want ? this.trail[0] : null;
      if (this.ghost && overlap({ x: p.x + 4, y: p.y + 4, w: PW - 8, h: PH - 6 }, { x: this.ghost.x + 4, y: this.ghost.y + 4, w: PW - 8, h: PH - 6 })) return this.die('copycat');
    }
  }

  // Wrong Way: each swirl swaps the keys once per life
  if (p.grounded && !p.groundPlat) {
    const r = Math.floor((p.y + PH + 2) / T);
    const c = Math.floor((p.x + PW / 2) / T);
    if (this.code(c, r) === TC.SWIRL && this.has.swapZone && !this.swirlUsed.has(c)) {
      this.swirlUsed.add(c);
      this.swapped = !this.swapped;
      this.markSeen('swapZone');
      if (!this.swapped && this.swapJumps > 0) this.discover('swapZone');
      this.swapJumps = 0;
      this.emit('swap', { on: this.swapped, x: c * T + T / 2, y: r * T });
    }
  }

  // Pinholes: a holed tile under your feet fires after a beat
  if (p.grounded && !p.groundPlat) {
    const r = Math.floor((p.y + PH + 2) / T);
    for (let c = Math.floor((p.x + 4) / T); c <= Math.floor((p.x + PW - 4) / T); c++) {
      if (this.code(c, r) === TC.HOLE && this.has.pinholes) {
        const k = r * L.w + c;
        if (!this.popped.has(k)) { this.popped.set(k, 0); this.markSeen('pinholes'); this.emit('pop', { x: c * T + T / 2, y: r * T }); }
      }
    }
  }
  for (const [k, t] of this.popped) {
    const nt = t + dt;
    if (nt > 1.3) { this.popped.delete(k); continue; }
    this.popped.set(k, nt);
    if (nt >= 0.1) {
      const c = k % L.w, r = Math.floor(k / L.w);
      if (overlap(pr, { x: c * T + 3, y: (r - 1) * T + 8, w: T - 6, h: T - 8 })) return this.die('pinholes');
    }
  }

  // Headache blocks
  for (const b of this.bonks) {
    b.vy += 1400 * dt; b.y += b.vy * dt;
    if (!b.hit && overlap(pr, { x: b.x, y: b.y, w: 30, h: 30 })) {
      b.hit = true; p.vy = Math.max(p.vy, 380); p.vx *= 0.2; p.bonkT = 2.5;
      this.history.bonks = (this.history.bonks || 0) + 1;
      this.emit('bonk', { x: p.x + PW / 2, y: p.y });
    }
  }
  this.bonks = this.bonks.filter(b => b.y < H * T + 60);

  // Falling out of the world
  if (p.y > H * T + 48) {
    const cx = (p.x + PW / 2) / T;
    let cause = 'pit';
    if (p.trapT > 0) cause = 'shouting';
    else if (this.falseT > 0) cause = 'falseFloor';
    else if (this.dropT > 0) cause = 'impatient';
    else if (L.bridges.some(b => cx >= b.x0 - 1 && cx <= b.x1 + 1)) cause = 'secretFloor';
    else if (p.bonkT > 0) cause = 'headache';
    else if (p.lastPlat && p.lastPlat.fallen) cause = 'rotten';
    else if (p.lastPlat && (p.lastPlat.kind === 'slide' || p.lastPlat.kind === 'shy') && p.lastPlat.dodged) cause = p.lastPlat.kind === 'slide' ? 'runaway' : 'shyLedge';
    this.die(cause);
  }
};

W.cheatChecks = function (dt, input) {
  const p = this.p, L = this.L;
  const pcx = p.x + PW / 2, pcy = p.y + PH / 2;
  const pr = this.rect();

  // ----- exit (Cold Feet) -----
  const d = this.door;
  if (d.hop) {
    d.hop.t += dt / 0.42;
    const k = Math.min(1, d.hop.t);
    d.x = d.hop.fx + (d.hop.tx - d.hop.fx) * k;
    d.y = d.hop.fy + (d.hop.ty - d.hop.fy) * k - Math.sin(k * Math.PI) * 70;
    if (k >= 1) { d.hop = null; d.x = L.doorSpots[d.spot].x; d.y = L.doorSpots[d.spot].y; }
  } else {
    const dr = { x: d.x - 15, y: d.y - 44, w: 30, h: 44 };
    if (overlap(pr, dr)) {
      if (!p.grounded && this.fled > 0) this.discover('coldFeet');
      if (this.has.copycat && this.ghost) this.discover('copycat');
      if (this.has.spikeWall && this.wall.on && p.x - this.wall.x < SL.VIEW_W) this.discover('spikeWall');
      this.won = true;
      this.emit('win', { airborne: !p.grounded });
      return;
    }
    if (this.has.coldFeet && d.hopsLeft > 0 && p.grounded && Math.abs(pcx - d.x) < 3 * T && Math.abs(pcy - (d.y - 20)) < 3 * T) {
      d.spot++; d.hopsLeft--;
      const s = L.doorSpots[d.spot];
      d.hop = { t: 0, fx: d.x, fy: d.y, tx: s.x, ty: s.y };
      this.fled++;
      this.markSeen('coldFeet');
      this.emit('flee', { x: d.x, y: d.y, left: d.hopsLeft });
    }
  }
  d.scared = Math.max(0, d.scared - dt);

  // ----- checkpoint (Backwards Flag) -----
  const cp = L.checkpoint;
  if (cp && !this.cpReal && overlap(pr, { x: cp.x - 8, y: cp.y - 56, w: 16, h: 56 })) {
    const fromBehind = p.vx < -20;
    if (!this.has.backwardsFlag || fromBehind) {
      this.cpReal = true;
      this.respawnAt = { x: cp.x - PW / 2, y: cp.y - PH };
      this.stats.cpTouches++;
      if (this.has.backwardsFlag) { this.markSeen('backwardsFlag'); this.discover('backwardsFlag'); }
      this.emit('checkpoint', { real: true });
    } else if (!this.cpFake) {
      this.cpFake = true;
      this.stats.cpTouches++;
      this.markSeen('backwardsFlag');
      this.emit('checkpoint', { real: false });
    }
  }

  // ----- signs -----
  for (const s of L.signs) {
    const near = Math.abs(pcx - s.x) < 1.4 * T && Math.abs(pcy - (s.y - 20)) < 2 * T;
    if (near && !s.near) {
      this.emit('sign', { sign: s });
      if (s.fork !== undefined) { this.forkState[s.fork].read = true; this.markSeen('shouting'); }
    }
    s.near = near;
  }

  // ----- forks (Shouting Signs) -----
  L.forks.forEach((f, i) => {
    const st = this.forkState[i];
    if (!st.route && pcx >= f.trapX0 - T / 2 && pcx < f.trapX0) {
      st.route = p.y + PH <= f.ceilY ? 'high' : 'low';
      if (st.read) { if (st.route === f.claim) this.stats.signFollow++; else this.stats.signDefy++; }
    }
    if (st.route && !st.done && pcx > f.trapX1 + T / 2 && p.alive) {
      st.done = true;
      if (st.read && f.lie && st.route === f.safe) this.discover('shouting');
    }
  });

  // ----- Secret Floor -----
  for (const b of L.bridges) if (Math.abs(pcx / T - b.x0) < 8) this.markSeen('secretFloor');
  if (p.grounded && p.groundCode === TC.BRIDGE) {
    const r = Math.floor((p.y + PH + 2) / T);
    for (let c = Math.floor(p.x / T) - 1; c <= Math.floor((p.x + PW) / T) + 1; c++) if (this.code(c, r) === TC.BRIDGE) this.revealed.add(r * L.w + c);
    this.discover('secretFloor');
  }

  // ----- Pinholes cracked: airborne over a holed tile after one has got you -----
  if (!p.grounded && this.has.pinholes && (this.history.causes && this.history.causes.pinholes)) {
    const c = Math.floor(pcx / T);
    for (let r = Math.floor((p.y + PH) / T); r < Math.floor((p.y + PH) / T) + 3 && r < H; r++) {
      const code = this.code(c, r);
      if (code === TC.HOLE) { this.discover('pinholes'); break; }
      if (SL.isSolid(code)) break;
    }
  }
};

SL.sawPos = function (sw, t) {
  const u = 0.5 - 0.5 * Math.cos(sw.phase + t * sw.omega);
  return { x: sw.x0 + (sw.x1 - sw.x0) * u, y: sw.y0 + (sw.y1 - sw.y0) * u };
};

})(typeof window !== 'undefined' ? window : globalThis);
