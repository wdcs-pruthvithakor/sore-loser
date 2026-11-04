// Canvas renderer: a cute pastel platformer on top, a glitching cheater underneath.
(function (G) {
'use strict';
const SL = G.SL;
const T = SL.TILE, H = SL.ROWS, TC = SL.TC, VW = SL.VIEW_W, VH = SL.VIEW_H;

// One palette per tier: bright morning to glitchy night.
const PAL = [
  { skyA: '#8ed0ff', skyB: '#fff1f7', far: '#bfe7d2', near: '#93d6ad', grass: '#6dd08b', grassD: '#3fa968', dirt: '#e2a96f', dirtD: '#b8793f', dot: '#c88d55', sun: '#fff4b8', cloud: '#ffffff', plat: '#ff9cc0', platD: '#d8709a', ink: '#3b2a40', body: '#ffcb3d', door: '#9d74ff', doorD: '#6b47cf' },
  { skyA: '#ffbf86', skyB: '#fff0dc', far: '#e8cfa0', near: '#c5c37e', grass: '#8cc96b', grassD: '#5e9d48', dirt: '#d89a63', dirtD: '#a96c37', dot: '#bf8550', sun: '#fff0a0', cloud: '#fff8ef', plat: '#ff9c8a', platD: '#d26f60', ink: '#3b2a40', body: '#ffcb3d', door: '#9d74ff', doorD: '#6b47cf' },
  { skyA: '#ff7f97', skyB: '#ffd29e', far: '#d98ea2', near: '#b0708c', grass: '#77b57a', grassD: '#4c8657', dirt: '#b97a5b', dirtD: '#8a5238', dot: '#a3684b', sun: '#ffe08a', cloud: '#ffe1e1', plat: '#ffb36b', platD: '#cc7f3c', ink: '#3b2a40', body: '#ffcb3d', door: '#9d74ff', doorD: '#6b47cf' },
  { skyA: '#4e3f86', skyB: '#d58aa5', far: '#7c5a96', near: '#5a3f78', grass: '#58a08a', grassD: '#376e60', dirt: '#7a5468', dirtD: '#55374b', dot: '#6a475a', sun: '#ffd9ee', cloud: '#d9b7e0', plat: '#c66cf0', platD: '#8f43b8', ink: '#22172b', body: '#ffcb3d', door: '#ff6fa8', doorD: '#c23f78' },
  { skyA: '#0d0b22', skyB: '#3a1a4f', far: '#2a1d47', near: '#1d1535', grass: '#4df0b8', grassD: '#22a07a', dirt: '#3b2350', dirtD: '#24133a', dot: '#4a2d63', sun: '#e9e4ff', cloud: '#5a3c7a', plat: '#ff4fa3', platD: '#b02a70', ink: '#0c0716', body: '#ffcb3d', door: '#ff4f6e', doorD: '#b22a46' }
];
SL.PAL = PAL;

function cellHash(c, r) { let h = (c * 374761393 + r * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

function Renderer(cv) {
  this.cv = cv; this.ctx = cv.getContext('2d');
  this.k = 1; this.cam = 0; this.time = 0;
  this.parts = []; this.shake = 0; this.glitch = 0;
  this.bubble = null;
}
SL.Renderer = Renderer;
const R = Renderer.prototype;

R.resize = function (cssW, cssH) {
  const dpr = Math.min(2, G.devicePixelRatio || 1);
  this.k = (cssW / VW) * dpr;
  this.cv.width = Math.round(VW * this.k);
  this.cv.height = Math.round(VH * this.k);
  this.cv.style.width = cssW + 'px';
  this.cv.style.height = cssH + 'px';
};

R.setWorld = function (w) {
  this.w = w; this.parts = [];
  const L = w.L;
  this.pal = PAL[L.tier];
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
    case 'death': this.burst(e.x, e.y, 26, pal.body, 260, 0.8); this.burst(e.x, e.y, 10, pal.ink, 200, 0.6); this.shake = 0.3; break;
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
  }
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
    const target = Math.max(0, Math.min(L.w * T - VW, p.x + p.face * 70 - VW * 0.42));
    this.cam += (target - this.cam) * Math.min(1, dt * 6);
  }
  let sx = 0, sy = 0;
  if (this.shake > 0) { this.shake -= dt; sx = (Math.random() - 0.5) * 8 * this.shake / 0.3; sy = (Math.random() - 0.5) * 8 * this.shake / 0.3; }
  ctx.setTransform(this.k, 0, 0, this.k, 0, 0);

  this.drawSky(ctx, pal, tier);
  ctx.save();
  ctx.translate(-Math.round(this.cam) + sx, sy);
  const c0 = Math.max(0, Math.floor(this.cam / T) - 1), c1 = Math.min(L.w - 1, Math.floor((this.cam + VW) / T) + 1);
  this.drawTiles(ctx, w, c0, c1);
  this.drawPlats(ctx, w);
  this.drawSaws(ctx, w);
  this.drawCheckpoint(ctx, w);
  w.L.mimics.forEach((m, i) => { if (m.x > this.cam - 60 && m.x < this.cam + VW + 60) this.drawMimic(ctx, w, m, i); });
  for (const th of w.teeth) this.drawTooth(ctx, th);
  for (const s of L.signs) if (s.x > this.cam - 60 && s.x < this.cam + VW + 60) this.drawSign(ctx, s);
  this.drawDoor(ctx, w);
  for (const b of w.bonks) this.drawBonk(ctx, b);
  if (w.ghost && p.alive && !opts.hidePlayer) this.drawGhost(ctx, w);
  if (p.alive && !opts.hidePlayer) this.drawPlayer(ctx, w);
  this.drawParts(ctx, dt);
  for (const s of L.signs) if (s.near && p.alive) this.drawBubble(ctx, s);
  ctx.restore();

  // post: tier gloom + glitches
  if (tier >= 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < VH; y += 3) ctx.fillRect(0, y, VW, 1);
  }
  const ambient = tier >= 2 && Math.random() < [0, 0, 0.002, 0.006, 0.012][tier];
  if (ambient) this.glitch = Math.max(this.glitch, 0.06);
  if (this.glitch > 0) { this.glitch -= dt; this.drawGlitch(ctx); }
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(20,0,30,${0.08 + tier * 0.07})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
};

R.drawSky = function (ctx, pal, tier) {
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, pal.skyA); g.addColorStop(1, pal.skyB);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // sun or moon
  const sunX = 680 - this.cam * 0.03, sunY = 90 + tier * 12;
  ctx.fillStyle = pal.sun;
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
  // hills
  this.hills(ctx, 0.15, 300, 60, pal.far, 0.004);
  this.hills(ctx, 0.35, 360, 50, pal.near, 0.007);
};
R.cloud = function (ctx, x, y, s, col) {
  ctx.fillStyle = col; ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x, y, 20 * s, 0, Math.PI * 2); ctx.arc(x + 22 * s, y - 10 * s, 26 * s, 0, Math.PI * 2);
  ctx.arc(x + 48 * s, y, 20 * s, 0, Math.PI * 2); ctx.rect(x, y, 48 * s, 20 * s);
  ctx.fill(); ctx.globalAlpha = 1;
};
R.hills = function (ctx, par, base, amp, col, freq) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, VH);
  const off = this.cam * par + this.hillSeed * 100;
  for (let x = 0; x <= VW; x += 12) {
    const wx = x + off;
    ctx.lineTo(x, base - Math.sin(wx * freq) * amp - Math.sin(wx * freq * 2.7 + 1.3) * amp * 0.35);
  }
  ctx.lineTo(VW, VH); ctx.closePath(); ctx.fill();
};

R.drawTiles = function (ctx, w, c0, c1) {
  const L = w.L, pal = this.pal, tier = L.tier, t = this.time;
  const code = (c, r) => w.code(c, r);
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
      // side shading against open air
      ctx.fillStyle = pal.dirtD;
      if (!SL.looksSolid(code(c - 1, r)) && c > 0) ctx.fillRect(x, y, 3, T);
      if (!SL.looksSolid(code(c + 1, r)) && c < L.w - 1) ctx.fillRect(x + T - 3, y, 3, T);
      if (!SL.looksSolid(code(c, r + 1)) && r < H - 1) ctx.fillRect(x, y + T - 4, T, 4);
      if (topOpen) {
        ctx.fillStyle = pal.grassD; ctx.fillRect(x, y, T, 11);
        ctx.fillStyle = pal.grass; ctx.fillRect(x, y, T, 8);
        ctx.beginPath();
        for (let i = 0; i < 3; i++) ctx.arc(x + 5 + i * 11, y + 9, 5, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y + 1, T, 2);
      }
      if (k === TC.HOLE) {
        const popped = w.popped.get(r * L.w + c);
        const a = [1, 0.85, 0.7, 0.6, 0.5][tier];
        ctx.fillStyle = `rgba(40,20,40,${a})`;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + 8 + i * 8, y + 4, 2.4, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
        if (popped !== undefined && popped > 0.02) {
          const hgt = Math.min(1, (popped - 0.02) / 0.08) * (popped > 1.1 ? Math.max(0, (1.3 - popped) / 0.2) : 1) * 24;
          this.spikeRow(ctx, x + 2, y, T - 4, hgt, 3, 1);
        }
      }
      if (k === TC.SEAM) {
        // the tell: a dark seam and a hint of a tooth tip under the block
        const a = [0.85, 0.7, 0.55, 0.45, 0.36][tier];
        ctx.fillStyle = `rgba(40,20,40,${a})`;
        ctx.fillRect(x + 3, y + T - 7, T - 6, 2);
        ctx.beginPath(); ctx.moveTo(x + T / 2 - 4, y + T); ctx.lineTo(x + T / 2, y + T + 3); ctx.lineTo(x + T / 2 + 4, y + T); ctx.fill();
      }
      if (k === TC.SWIRL && topOpen) {
        ctx.fillStyle = '#9d74ff'; ctx.fillRect(x, y, T, 11);
        ctx.fillStyle = '#c9a7ff'; ctx.fillRect(x, y, T, 8);
        ctx.strokeStyle = '#4b2a8a'; ctx.lineWidth = 2; ctx.beginPath();
        const sp = t * 3;
        for (let i = 0; i <= 24; i++) { const a = sp + i * 0.5, rr = i * 0.42; const px = x + T / 2 + Math.cos(a) * rr, py = y + 14 + Math.sin(a) * rr * 0.75; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.stroke();
      }
      if (k === TC.CRACK) {
        ctx.strokeStyle = `rgba(50,25,40,${[0.9, 0.75, 0.6, 0.5, 0.42][tier]})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + 13, y + 9); ctx.lineTo(x + 9, y + 16); ctx.lineTo(x + 15, y + 26);
        ctx.moveTo(x + 13, y + 9); ctx.lineTo(x + 22, y + 13); ctx.lineTo(x + 26, y + 22); ctx.stroke();
      }
    } else if (k === TC.SPIKE && code(c, r - 1) === TC.FALSE) {
      // a spike buried under a false floor: drawn as dirt until you fall in
      ctx.fillStyle = pal.dirt; ctx.fillRect(x - 0.5, y - 0.5, T + 1, T + 1);
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
      const rate = [0.7, 0.5, 0.34, 0.24, 0.16][tier];
      if (Math.random() < rate * 0.016) this.parts.push({ x: x + Math.random() * T, y: y + 2, vx: 0, vy: -18, life: 1.1, max: 1.1, color: '#ffffff', size: 5, kind: 'star', g: 0 });
      if (w.revealed.has(r * L.w + c)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, T - 4, T - 4); ctx.setLineDash([]);
      }
    }
  }
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

R.drawTooth = function (ctx, th) {
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
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; rrect(ctx, 3, -42, 8, 20, 4); ctx.fill();
  // the tell: handle on the left
  ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(-9, -20, 2.6, 0, 7); ctx.fill();
  const p = w.p, dx = Math.max(-1, Math.min(1, (p.x + 10 - m.x) / 200));
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-6, -30, 4.5, 5, 0, 0, 7); ctx.ellipse(6, -30, 4.5, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = pal.ink;
  ctx.beginPath(); ctx.arc(-6 + dx * 2, -30, 2.2, 0, 7); ctx.arc(6 + dx * 2, -30, 2.2, 0, 7); ctx.fill();
  ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.6; ctx.beginPath();
  if (chomp || (near && p.alive)) {
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
    ctx.fillStyle = pal.platD; rrect(ctx, x, y + 3, pl.w, 13, 6); ctx.fill();
    ctx.fillStyle = pal.plat; rrect(ctx, x, y, pl.w, 12, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x + 6, y + 3, pl.w - 12, 2);
    if (pl.kind === 'shy') {
      const scared = pl.dodgeT >= 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(x + pl.w / 2 - 7, y + 6, 3.5, scared ? 4.5 : 3.5, 0, 0, 7); ctx.ellipse(x + pl.w / 2 + 7, y + 6, 3.5, scared ? 4.5 : 3.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = pal.ink;
      const lx = Math.max(-1.5, Math.min(1.5, (w.p.x - x) / 120));
      ctx.beginPath(); ctx.arc(x + pl.w / 2 - 7 + lx, y + 6, 1.8, 0, 7); ctx.arc(x + pl.w / 2 + 7 + lx, y + 6, 1.8, 0, 7); ctx.fill();
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
  else { ctx.fillRect(x + 5, y - 32, 2, 2); ctx.fillRect(x + 8, y - 32, 2, 2); ctx.fillRect(x + 11, y - 32, 2, 2); }
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
  ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(9, -20, 2.6, 0, 7); ctx.fill();
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
  // sprout
  ctx.strokeStyle = '#3fa968'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy - ry + 2); ctx.quadraticCurveTo(cx - 1, cy - ry - 6, cx + 1, cy - ry - 8); ctx.stroke();
  ctx.fillStyle = '#6dd08b'; ctx.beginPath(); ctx.ellipse(cx + 5, cy - ry - 8, 5, 3, -0.4, 0, 7); ctx.fill();
  // body
  ctx.fillStyle = pal.body; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = pal.ink; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(cx - 5, cy - 6, 4, 2.5, -0.5, 0, 7); ctx.fill();
  // eyes look where you go
  const ex = p.face * 3.5, ey = Math.max(-2, Math.min(2, p.vy / 300));
  ctx.fillStyle = pal.ink;
  const blink = (this.time % 3.4) < 0.1;
  for (const o of [-4.5, 4.5]) {
    if (blink) ctx.fillRect(cx + ex + o - 2.5, cy - 2 + ey, 5, 1.8);
    else { ctx.beginPath(); ctx.ellipse(cx + ex + o, cy - 2 + ey, 2.3, 3.4, 0, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,110,140,0.5)';
  ctx.beginPath(); ctx.ellipse(cx + ex - 8, cy + 4, 2.6, 1.6, 0, 0, 7); ctx.ellipse(cx + ex + 8, cy + 4, 2.6, 1.6, 0, 0, 7); ctx.fill();
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
