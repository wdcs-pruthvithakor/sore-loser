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

// The boss's dice: a seed kept in its state (so the fight can be saved and replayed), not a closure.
const roll = bs => { let t = (bs.rs = (bs.rs + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
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
  this.coinsGot = new Set(); // coins stay grabbed through deaths; banked when you clear
  this.remix = L.remix || {};
  this.lens = false; this.shield = 0; this.invuln = 0; this.assisted = false; this.greedy = false;
  this.lastSafe = null;
  this.seen = {};
  this.discovered = {};
  this.attempt = 0;
  this.idleRun = 0;
  for (const p of L.plats) { p.baseX = p.x; p.homeY = p.y; }
  this.cps = L.checkpoints.map(() => ({ real: false, fake: false }));
  this.inBuf = []; this.lagNow = false; this.lagJump = false;
  // The boss keeps its health between your deaths; your lives only exist once the fight starts.
  if (L.boss) {
    const b = L.boss, maxHp = b.phases * b.perPhase;
    this.bossState = { maxHp, hp: maxHp, phase: 1, lives: SL.BOSS_LIVES, livesLost: 0, wipe: false, seen: false, lastSpot: -1, rs: (L.seed ^ 0xb055) >>> 0 };
  } else this.bossState = null;
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
  if (v === TC.CRUMBLE && this.crumbled) { const k = this.crumbled.get(r * L.w + c); if (k !== undefined && k <= 0) return TC.E; }
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
  this.peek = { on: false, x: 0, y: 0, frozen: false, close: false };
  this.inBuf.length = 0; this.lagNow = false;
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
  this.crumbled = new Map(); // tile -> seconds left before it drops (<= 0: gone)
  this.spawnSafe = 0.8; // a beat after respawning where moving hazards cannot get you
  const bs = this.bossState;
  if (bs) {
    if (bs.wipe) { bs.hp = bs.maxHp; bs.phase = 1; bs.lives = SL.BOSS_LIVES; bs.wipe = false; this.emit('bossReset'); }
    Object.assign(bs, { started: false, plug: null, plugT: 0, toothT: 2, sawT: 3.5, fistT: 2.5, darkT: 4, dark: 0, calm: 0, hurt: 0, saws: [], fists: [] });
  }
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
  if (!p.alive || this.won || this.invuln > 0) return;
  if (this.spawnSafe > 0 && ['spikeWall', 'crusher', 'saw', 'wave', 'boss', 'copycat', 'lunger', 'ceilingTeeth', 'laser', 'blade', 'peekaboo', 'bossSaw', 'bossFist', 'bossTooth'].indexOf(cause) >= 0) return;
  // inside the static, a fall or a spike is the lag's fault
  if (this.lagNow && (cause === 'pit' || cause === 'spike' || cause === 'ceilSpike')) cause = 'lagZone';
  // Bubble consumable: pops instead of you, and puts you back on the last safe ground
  if (this.shield > 0) {
    this.shield--; this.invuln = 1.2;
    this.emit('bubblePop', { x: p.x + PW / 2, y: Math.min(p.y + PH / 2, H * T - 8) });
    if (this.lastSafe) { p.x = this.lastSafe.x; p.y = this.lastSafe.y; }
    p.vx = 0; p.vy = 0;
    return;
  }
  p.alive = false; p.deadT = 0.45;
  const bs = this.bossState;
  if (bs && bs.started) {
    bs.lives--; bs.livesLost++;
    if (bs.lives <= 0) bs.wipe = true;
    this.emit('bossLife', { lives: Math.max(0, bs.lives), wipe: bs.wipe });
  }
  if (this.greedy && this.coinsGot.size) { this.coinsGot = new Set(); this.emit('coinsLost'); }
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
  if (this.invuln > 0) this.invuln -= dt;
  if (this.spawnSafe > 0) this.spawnSafe -= dt;

  // ----- Lag Spike: inside the static, every key arrives a quarter-second late -----
  if (this.has.lagZone) {
    this.inBuf.push({ left: input.left, right: input.right, jump: input.jump, jumpPressed: input.jumpPressed, down: input.down });
    if (this.inBuf.length > 40) this.inBuf.shift();
    const pcx = p.x + SL.PW / 2;
    this.lagNow = L.lags.some(z => pcx >= z.x0 && pcx < z.x1);
    if (this.lagNow) input = this.inBuf.length > 30 ? this.inBuf[this.inBuf.length - 31] : { left: false, right: false, jump: false, jumpPressed: false };
  }

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
    p.sq = 1.25; p.takeoffX = p.x + PW / 2; this.lagJump = this.lagNow;
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

  // ride moving platforms, and conveyor belts
  if (p.groundPlat && !p.groundPlat.fallen) p.x += p.groundPlat.dx;
  const carry = p.grounded && !p.groundPlat && (p.groundCode === TC.BELT_L || p.groundCode === TC.BELT_R) ? (p.groundCode === TC.BELT_R ? 1 : -1) * SL.BELT_SPEED * dt : 0;
  p.x += carry;

  // ----- move X -----
  p.x += p.vx * dt;
  const r0 = Math.floor(p.y / T), r1 = Math.floor((p.y + PH - 0.001) / T);
  if (p.vx > 0 || carry > 0 || (p.groundPlat && p.groundPlat.dx > 0)) {
    const c = Math.floor((p.x + PW - 0.001) / T);
    for (let r = r0; r <= r1; r++) if (this.solid(c, r)) { p.x = c * T - PW; p.vx = Math.min(0, p.vx); break; }
  }
  if (p.vx < 0 || carry < 0 || (p.groundPlat && p.groundPlat.dx < 0)) {
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
    // Lag Spike: a real jump made from inside the static, after the lag has got you once
    if (p.takeoffX !== null && this.lagJump && this.has.lagZone && Math.abs(p.x + PW / 2 - p.takeoffX) > 2.5 * T && this.history.causes && this.history.causes.lagZone) this.discover('lagZone');
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
  if (p.grounded && !p.groundPlat && (p.groundCode === TC.GROUND || p.groundCode === TC.SWIRL || p.groundCode === TC.BRIDGE)) this.lastSafe = { x: p.x, y: p.y };
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

  // The boss: each phase adds an attack. 1 teeth and saws, 2 fists, 3 the floor (see waves), 4 blackouts.
  const bs = this.bossState;
  if (bs && bs.started && bs.hp > 0) {
    const B = L.boss, ph = bs.phase, rate = (this.rage ? 0.82 : 1) / B.speed;
    if (bs.hurt > 0) bs.hurt -= dt;
    if (bs.dark > 0) bs.dark -= dt;
    if (bs.calm > 0) bs.calm -= dt;
    else {
      bs.toothT -= dt;
      if (bs.toothT <= 0) {
        bs.toothT = [1.25, 1.05, 0.95, 0.85][ph - 1] * rate;
        // a volley: one where you are heading, the others either side of it
        const lead = p.x + PW / 2 + p.vx * 0.45;
        for (const off of [[0], [-56, 0, 56], [-70, 0, 70], [-84, -28, 28, 84]][ph - 1]) {
          const tx = Math.max(L.arena.x0 + 16, Math.min(L.arena.x1 - 16, lead + off + (roll(bs) - 0.5) * 10));
          this.teeth.push({ x: tx, y: 90, vy: 0, wait: 0.38, boss: true });
        }
        this.emit('bossTooth', { x: lead });
      }
      bs.sawT -= dt;
      if (bs.sawT <= 0) {
        bs.sawT = [4.4, 4.0, 3.6, 3.2][ph - 1] * rate;
        const fromLeft = roll(bs) < 0.5;
        // it peeks out of the wall for half a second before it rolls
        bs.saws.push({ x: fromLeft ? L.arena.x0 + 6 : L.arena.x1 - 6, y: L.arena.floor - 13, vx: (fromLeft ? 1 : -1) * (320 + ph * 50), wait: 0.5 });
        this.emit('bossSaw');
      }
      if (ph >= 2) {
        bs.fistT -= dt;
        if (bs.fistT <= 0) {
          bs.fistT = [0, 2.6, 2.3, 2.0][ph - 1] * rate;
          const fx = Math.max(L.arena.x0 + 24, Math.min(L.arena.x1 - 24, p.x + PW / 2 + p.vx * 0.3));
          let land = L.arena.floor;
          for (let r = 3; r < H; r++) if (this.solid(Math.floor(fx / T), r)) { land = r * T; break; }
          for (const pl of L.plats) if (fx > pl.x && fx < pl.x + pl.w && pl.y < land && pl.y > 3 * T) land = pl.y;
          bs.fists.push({ x: fx, land, t: 0 });
          this.emit('bossFist', { x: fx });
        }
      }
      if (ph >= 4) {
        bs.darkT -= dt;
        if (bs.darkT <= 0) { bs.darkT = 4.2 * rate; bs.dark = 0.9; this.emit('bossDark'); }
      }
    }
    for (const sw of bs.saws) {
      if (sw.wait > 0) { sw.wait -= dt; continue; }
      sw.x += sw.vx * dt;
      const nx = Math.max(pr.x, Math.min(sw.x, pr.x + pr.w)), ny = Math.max(pr.y, Math.min(sw.y, pr.y + pr.h));
      if ((nx - sw.x) * (nx - sw.x) + (ny - sw.y) * (ny - sw.y) < 11 * 11) return this.die('bossSaw');
    }
    bs.saws = bs.saws.filter(sw => sw.x > L.arena.x0 - 40 && sw.x < L.arena.x1 + 40);
    for (const f of bs.fists) {
      const before = SL.fistY(f, B.y + 60);
      f.t += dt;
      const y = SL.fistY(f, B.y + 60);
      if (y >= f.land - 1 && before < f.land - 1) this.emit('slam', { x: f.x, y: f.land });
      if (f.t > 0.75 && overlap(pr, { x: f.x - 22, y: y - 34, w: 44, h: 34 })) return this.die('bossFist');
    }
    bs.fists = bs.fists.filter(f => f.t < 1.75);
  }

  // Crumbling bridge (Rage): every tile you touch drops a moment later
  if (p.grounded && !p.groundPlat) {
    const r = Math.floor((p.y + PH + 2) / T);
    for (let c = Math.floor(p.x / T); c <= Math.floor((p.x + PW - 1) / T); c++) {
      const k = r * L.w + c;
      if (L.tiles[k] === TC.CRUMBLE && !this.crumbled.has(k)) { this.crumbled.set(k, 0.32); this.emit('creak', { x: c * T + T / 2, y: r * T }); }
    }
  }
  for (const [k, t] of this.crumbled) {
    if (t > 0) { const nt = t - dt; this.crumbled.set(k, nt); if (nt <= 0) this.emit('tileFall', { x: (k % L.w) * T + T / 2, y: Math.floor(k / L.w) * T }); }
  }

  // Crushers (Hard): slam down fast, hold, then grind back up
  for (const cr of L.crushers) {
    const y = SL.crusherY(cr, this.t);
    const down = y >= cr.floor - 41;
    if (down && !cr._down && Math.abs(cr.x - p.x) < 520) this.emit('slam', { x: cr.x + cr.w / 2, y: cr.floor });
    cr._down = down;
    if (overlap(pr, { x: cr.x + 3, y: cr.top, w: cr.w - 6, h: y + 40 - cr.top })) return this.die('crusher');
  }

  // Rising spike floors (Rage): every spike in the strip pops up together, then sinks
  for (const wv of L.waves) {
    if (!this.waveOn(wv)) continue;
    const up = SL.waveUp(wv, this.waveTime(wv));
    if (up > 0.5 && p.x + PW > wv.c0 * T + 4 && p.x < wv.c1 * T - 4 && p.y + PH > (wv.row + 1) * T - 16 * up) return this.die('wave');
  }

  // Laser gates: deadly while lit
  for (const lz of L.lasers) if (SL.laserState(lz, this.t) === 1 && overlap(pr, { x: lz.x - 3, y: lz.top, w: 6, h: lz.bottom - lz.top })) return this.die('laser');
  // Swinging blades
  for (const bl of L.blades) {
    const q = SL.bladePos(bl, this.t);
    const nx = Math.max(pr.x, Math.min(q.x, pr.x + pr.w)), ny = Math.max(pr.y, Math.min(q.y, pr.y + pr.h));
    if ((nx - q.x) * (nx - q.x) + (ny - q.y) * (ny - q.y) < 15 * 15) return this.die('blade');
  }

  // Peekaboo: a ghost that only drifts after you while your back is turned
  if (this.has.peekaboo) {
    const g = this.peek, pcx = p.x + PW / 2, pcy = p.y + PH / 2;
    if (!g.on && p.x > this.respawnAt.x + 3 * T) { g.on = true; g.x = pcx - 8 * T; g.y = pcy - 30; this.markSeen('peekaboo'); this.emit('peekWake'); }
    if (g.on) {
      const away = (g.x < pcx) === (p.face > 0), d = Math.hypot(pcx - g.x, pcy - g.y) || 1;
      g.frozen = !away;
      if (away) { const sp = [120, 130, 140, 150, 160][L.gt]; g.x += (pcx - g.x) / d * sp * dt; g.y += (pcy - g.y) / d * sp * dt; }
      else if (d < 4 * T) g.close = true;
      if (d < 16) return this.die('peekaboo');
    }
  }

  // Spite Coins
  for (let i = 0; i < L.coins.length; i++) {
    if (this.coinsGot.has(i)) continue;
    const cn = L.coins[i];
    if (overlap(pr, { x: cn.x - 10, y: cn.y - 10, w: 20, h: 20 })) { this.coinsGot.add(i); this.emit('coin', { x: cn.x, y: cn.y, n: this.coinsGot.size }); }
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
    if (overlap(pr, { x: th.x - 7, y: th.y + 2, w: 14, h: 18 })) return this.die(th.boss ? 'bossTooth' : 'ceilingTeeth');
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
    const safe = c < 8 || L.checkpoints.some(cp => Math.abs(c - Math.floor(cp.x / T)) <= 2) || p.groundPlat || (L.arena && p.x > L.arena.x0 - 2 * T);
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

  if (L.boss) { if (this.bossChecks(dt, pr)) return; }
  else {
    // ----- exit (Cold Feet) -----
    const d = this.door;
    const feetOn = this.remix.coldFeet ? !p.grounded : p.grounded; // remixed: it flees from jumps instead
    if (d.hop) {
      d.hop.t += dt / 0.42;
      const k = Math.min(1, d.hop.t);
      d.x = d.hop.fx + (d.hop.tx - d.hop.fx) * k;
      d.y = d.hop.fy + (d.hop.ty - d.hop.fy) * k - Math.sin(k * Math.PI) * 70;
      if (k >= 1) { d.hop = null; d.x = L.doorSpots[d.spot].x; d.y = L.doorSpots[d.spot].y; }
    } else {
      const dr = { x: d.x - 15, y: d.y - 44, w: 30, h: 44 };
      if (overlap(pr, dr)) {
        if (!feetOn && this.fled > 0) this.discover('coldFeet');
        if (this.has.copycat && this.ghost) this.discover('copycat');
        if (this.has.spikeWall && this.wall.on && p.x - this.wall.x < SL.VIEW_W) this.discover('spikeWall');
        if (this.has.peekaboo && this.peek.close) this.discover('peekaboo');
        this.won = true;
        this.emit('win', { airborne: !p.grounded });
        return;
      }
      if (this.has.coldFeet && d.hopsLeft > 0 && feetOn && Math.abs(pcx - d.x) < 3 * T && Math.abs(pcy - (d.y - 20)) < 3 * T) {
        d.spot++; d.hopsLeft--;
        const s = L.doorSpots[d.spot];
        d.hop = { t: 0, fx: d.x, fy: d.y, tx: s.x, ty: s.y };
        this.fled++;
        this.markSeen('coldFeet');
        this.emit('flee', { x: d.x, y: d.y, left: d.hopsLeft });
      }
    }
    d.scared = Math.max(0, d.scared - dt);
  }

  // ----- checkpoint camps (Backwards Flag) -----
  L.checkpoints.forEach((cp, i) => {
    const st = this.cps[i];
    if (st.real || !overlap(pr, { x: cp.x - 8, y: cp.y - 56, w: 16, h: 56 })) return;
    if (cp.x < this.respawnAt.x + PW / 2 - 4) return; // a camp behind your save point changes nothing
    const fromBehind = this.remix.backwardsFlag ? !p.grounded : p.vx < -20;
    if (cp.honest || !this.has.backwardsFlag || fromBehind) {
      st.real = true; this.cpReal = true; this.cpFake = false;
      this.respawnAt = { x: cp.x - PW / 2, y: cp.y - PH };
      this.stats.cpTouches++;
      if (this.has.backwardsFlag && !cp.honest) { this.markSeen('backwardsFlag'); this.discover('backwardsFlag'); }
      this.emit('checkpoint', { real: true, x: cp.x, y: cp.y, n: cp.n, of: cp.of, honest: cp.honest });
    } else if (!st.fake) {
      st.fake = true; this.cpFake = true;
      this.stats.cpTouches++;
      this.markSeen('backwardsFlag');
      this.emit('checkpoint', { real: false, x: cp.x, y: cp.y, n: cp.n, of: cp.of });
    }
  });

  this.cheatChecksRest(dt, input);
};

// The boss fight: walk in and it starts. Plugs come out one at a time; each one is a hit.
// Returns true when the fight is won.
W.bossChecks = function (dt, pr) {
  const L = this.L, bs = this.bossState, p = this.p;
  if (!bs.started && p.x > L.arena.x0 + T) {
    bs.started = true; bs.plugT = 1.2; bs.calm = 1.4;
    if (bs.phase >= 3) bs.waveT0 = this.t + 1.4;
    // the door camp always counts, so a death in here never sends you back through the run
    const cp = L.checkpoints[L.checkpoints.length - 1];
    if (cp && cp.honest) { this.respawnAt = { x: cp.x - PW / 2, y: cp.y - PH }; this.cpReal = true; this.cps[L.checkpoints.length - 1].real = true; }
    this.emit('arena', { first: !bs.seen, phase: bs.phase, lives: bs.lives });
    bs.seen = true;
  }
  if (!bs.started || bs.hp <= 0) return false;
  if (!bs.plug) { bs.plugT -= dt; if (bs.plugT <= 0) this.spawnPlug(); return false; }
  if (!overlap(pr, { x: bs.plug.x - 16, y: bs.plug.y - 26, w: 32, h: 26 })) return false;
  const at = bs.plug;
  bs.plug = null; bs.hp--; bs.hurt = 0.7; bs.plugT = 1.3;
  const B = L.boss, ph = Math.min(B.phases, Math.floor((bs.maxHp - bs.hp) / B.perPhase) + 1);
  const up = ph > bs.phase && bs.hp > 0;
  this.emit('unplug', { hp: bs.hp, maxHp: bs.maxHp, phaseUp: up, x: at.x, y: at.y });
  if (up) {
    bs.phase = ph; bs.calm = 2.2; bs.plugT = 2.4; bs.saws = []; bs.fists = []; this.teeth = [];
    if (ph >= 3) bs.waveT0 = this.t + 2.2;
    this.emit('bossPhase', { phase: ph });
  }
  if (bs.hp <= 0) { this.won = true; this.emit('win', { boss: true, final: !!B.final }); return true; }
  return false;
};
W.spawnPlug = function () {
  const bs = this.bossState, L = this.L, pcx = this.p.x + PW / 2;
  const all = L.plugSpots.map((s, i) => i).filter(i => i !== bs.lastSpot);
  const far = all.filter(i => Math.abs(L.plugSpots[i].x - pcx) > 7 * T);
  const pool = far.length ? far : all;
  const i = pool[Math.floor(roll(bs) * pool.length)];
  bs.lastSpot = i;
  bs.plug = { x: L.plugSpots[i].x, y: L.plugSpots[i].y };
  this.emit('plugOut', { x: bs.plug.x, y: bs.plug.y });
};
// Boss floor strips only run in their phase, on a clock that starts when the phase does.
W.waveOn = function (wv) {
  if (!wv.bossPhase) return true;
  const bs = this.bossState;
  return !!(bs && bs.started && bs.hp > 0 && bs.phase >= wv.bossPhase && this.t >= (bs.waveT0 || 0));
};
W.waveTime = function (wv) { return wv.bossPhase ? this.t - (this.bossState.waveT0 || 0) : this.t; };

W.cheatChecksRest = function (dt, input) {
  const p = this.p, L = this.L;
  const pcx = p.x + PW / 2, pcy = p.y + PH / 2;
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

// Pocket Flag: a checkpoint right where you stand.
W.plantFlag = function () {
  const p = this.p;
  if (!p.alive || !p.grounded || p.groundPlat) return false;
  this.respawnAt = { x: p.x, y: p.y }; this.cpReal = true;
  this.emit('plant', { x: p.x + PW / 2, y: p.y + PH });
  return true;
};

// A crusher's top edge over time: hold up, slam down in 0.12s, sit for 0.35s, rise over 0.7s.
SL.crusherY = function (cr, t) {
  const travel = cr.floor - 40 - cr.top, u = ((t + cr.phase) % cr.period + cr.period) % cr.period;
  const rest = cr.period - 1.17;
  if (u < rest) return cr.top;
  const k = u - rest;
  if (k < 0.12) return cr.top + travel * (k / 0.12);
  if (k < 0.47) return cr.top + travel;
  return cr.top + travel * (1 - (k - 0.47) / 0.7);
};
// How far the rising spikes are up, 0..1.
SL.waveUp = function (wv, t) {
  const per = wv.up + wv.down, u = ((t + wv.phase) % per + per) % per;
  if (u < wv.down - 0.25) return 0;
  if (u < wv.down) return (u - (wv.down - 0.25)) / 0.25 * 0.3; // a little warning wiggle
  return 1;
};

// A boss fist's bottom edge: a warning beat up top, a fast slam, a short rest, then back up.
SL.fistY = function (f, top) {
  const t = f.t;
  if (t < 0.75) return top;
  if (t < 0.87) return top + (f.land - top) * (t - 0.75) / 0.12;
  if (t < 1.25) return f.land;
  return f.land + (top - f.land) * Math.min(1, (t - 1.25) / 0.5);
};
// Laser gates: 1 lit (deadly), 0.5 the warning flicker just before, 0 off.
SL.laserState = function (lz, t) {
  const u = ((t + lz.phase) % lz.period + lz.period) % lz.period;
  if (u < lz.on) return 1;
  return u > lz.period - 0.35 ? 0.5 : 0;
};
// A swinging blade's centre.
SL.bladePos = function (bl, t) {
  const a = bl.amp * Math.sin(bl.phase + t * bl.omega);
  return { x: bl.ax + Math.sin(a) * bl.len, y: bl.ay + Math.cos(a) * bl.len, a };
};

SL.sawPos = function (sw, t) {
  const u = 0.5 - 0.5 * Math.cos(sw.phase + t * sw.omega);
  return { x: sw.x0 + (sw.x1 - sw.x0) * u, y: sw.y0 + (sw.y1 - sw.y0) * u };
};

})(typeof window !== 'undefined' ? window : globalThis);
