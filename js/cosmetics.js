// Spite Coins, the shop, trophies and how the player blob is drawn with them.
// Cosmetic only: nothing here changes how a level plays.
(function (G) {
'use strict';
const SL = G.SL;

// ---------- shop items ----------
// price: coins. trophy: only unlocked by that trophy. free: owned from the start.
SL.ITEMS = [
  // skins
  { id: 'sunny', slot: 'skin', name: 'Sunny', free: true, body: '#ffcb3d' },
  { id: 'bubblegum', slot: 'skin', name: 'Bubblegum', price: 60, body: '#ff8fc0' },
  { id: 'mint', slot: 'skin', name: 'Mint', price: 60, body: '#6fdc98' },
  { id: 'sky', slot: 'skin', name: 'Sky', price: 60, body: '#8ed0ff' },
  { id: 'tomato', slot: 'skin', name: 'Tomato', price: 120, body: '#ff6b5a', spots: '#ffb3a8' },
  { id: 'grape', slot: 'skin', name: 'Grape', price: 120, body: '#9d74ff' },
  { id: 'cow', slot: 'skin', name: 'Cow', price: 180, body: '#fffaf2', spots: '#3b2a40' },
  { id: 'ghost', slot: 'skin', name: 'Ghost', price: 250, body: 'rgba(240,244,255,0.7)' },
  { id: 'void', slot: 'skin', name: 'Void', price: 400, body: '#1c1226', eyes: '#ffffff' },
  { id: 'gold', slot: 'skin', name: 'Solid Gold', trophy: 'lvl50', body: '#ffd84d', shine: true },
  { id: 'glitch', slot: 'skin', name: 'Cheater', trophy: 'crackAll', body: 'glitch' },
  // hats
  { id: 'sprout', slot: 'hat', name: 'Sprout', free: true },
  { id: 'bald', slot: 'hat', name: 'Nothing', free: true },
  { id: 'party', slot: 'hat', name: 'Party Hat', price: 80 },
  { id: 'beanie', slot: 'hat', name: 'Beanie', price: 100 },
  { id: 'horns', slot: 'hat', name: 'Horns', price: 150 },
  { id: 'halo', slot: 'hat', name: 'Halo', price: 150 },
  { id: 'tophat', slot: 'hat', name: 'Top Hat', price: 180 },
  { id: 'propeller', slot: 'hat', name: 'Propeller', price: 200 },
  { id: 'crown', slot: 'hat', name: 'Crown', price: 300 },
  { id: 'dunce', slot: 'hat', name: 'Dunce Cap', trophy: 'die500' },
  { id: 'spite', slot: 'hat', name: 'Crown of Spite', trophy: 'rageClear' },
  // trails
  { id: 'dust', slot: 'trail', name: 'Dust', free: true },
  { id: 'sparkle', slot: 'trail', name: 'Sparkles', price: 100 },
  { id: 'bubbles', slot: 'trail', name: 'Bubbles', price: 120 },
  { id: 'hearts', slot: 'trail', name: 'Hearts', price: 150 },
  { id: 'rainbow', slot: 'trail', name: 'Rainbow', price: 300 },
  { id: 'flames', slot: 'trail', name: 'Rage Flames', trophy: 'stubborn' },
  // death effects
  { id: 'pop', slot: 'death', name: 'Pop', free: true },
  { id: 'confetti', slot: 'death', name: 'Confetti', price: 100 },
  { id: 'oof', slot: 'death', name: 'OOF', price: 120 },
  { id: 'pixels', slot: 'death', name: 'Pixels', price: 150 },
  { id: 'soul', slot: 'death', name: 'Little Ghost', price: 200 },
  { id: 'nope', slot: 'death', name: 'Ragequit', trophy: 'die100' }
];
SL.ITEM = {};
for (const it of SL.ITEMS) SL.ITEM[it.id] = it;
SL.SLOTS = [['skin', 'Skins'], ['hat', 'Hats'], ['trail', 'Trails'], ['death', 'Deaths']];
// Things the game "sells" but never will.
SL.TROLL_ITEMS = [
  { id: 'win', name: 'Win Button', price: 99999, say: 'You cannot afford it. Nobody can. That is the point.' },
  { id: 'nocheat', name: 'Remove a Cheat', price: 0, sold: true, say: 'Sold out. Forever. Restocking never.' },
  { id: 'skip', name: 'Skip Level', price: 500, sold: true, say: 'I sold the last one to myself.' }
];

// ---------- payouts ----------
SL.DIFF_MULT = { normal: 1, hard: 1.5, rage: 2.5 };
SL.payout = function (level, deaths, coins, diff, twist) {
  const m = SL.DIFF_MULT[diff] || 1;
  const rows = [['Level cleared', 8 + Math.min(level, 60)]];
  if (coins) rows.push([`${coins} coin${coins > 1 ? 's' : ''} grabbed`, coins * 5]);
  if (!deaths) rows.push(['No deaths', 15]);
  if (twist) rows.push(['Twist survived', 6]);
  let total = rows.reduce((a, r) => a + r[1], 0);
  if (m !== 1) { const extra = Math.round(total * (m - 1)); rows.push([`${SL.DIFFS[diff].name} bonus ×${m}`, extra]); total += extra; }
  return { rows, total };
};

// ---------- trophies ----------
// test(save) reads lifetime numbers in save.stats2; reward is coins and/or an item.
SL.TROPHIES = [
  { id: 'die1', name: 'First Blood', desc: 'Die once.', coins: 5, test: s => s.totalDeaths >= 1 },
  { id: 'die100', name: 'Regular', desc: 'Die 100 times.', coins: 40, item: 'nope', test: s => s.totalDeaths >= 100 },
  { id: 'die500', name: 'Professional Loser', desc: 'Die 500 times.', coins: 100, item: 'dunce', test: s => s.totalDeaths >= 500 },
  { id: 'clean1', name: 'Untouched', desc: 'Clear a level without dying.', coins: 25, test: s => s.stats2.clean >= 1 },
  { id: 'clean10', name: 'Spotless', desc: 'Clear 10 levels without dying.', coins: 120, test: s => s.stats2.clean >= 10 },
  { id: 'lvl10', name: 'Getting Somewhere', desc: 'Reach level 10.', coins: 40, test: s => s.best >= 10 },
  { id: 'lvl25', name: 'Still Here', desc: 'Reach level 25.', coins: 100, test: s => s.best >= 25 },
  { id: 'lvl50', name: 'Golden', desc: 'Reach level 50.', coins: 200, item: 'gold', test: s => s.best >= 50 },
  { id: 'crack5', name: 'Detective', desc: 'Crack 5 cheats.', coins: 40, test: (s, n) => n >= 5 },
  { id: 'crackAll', name: 'I Know Your Tricks', desc: 'Crack every cheat.', coins: 250, item: 'glitch', test: (s, n) => n >= SL.CHEAT_IDS.length },
  { id: 'hardClear', name: 'Hard Feelings', desc: 'Clear a level on Hard.', coins: 50, test: s => s.stats2.hard >= 1 },
  { id: 'rageClear', name: 'Spite', desc: 'Clear a level on Rage.', coins: 100, item: 'spite', test: s => s.stats2.rage >= 1 },
  { id: 'stubborn', name: 'Stubborn', desc: 'Die 25 times in one level, then clear it.', coins: 60, item: 'flames', test: s => s.stats2.maxDeathsCleared >= 25 },
  { id: 'speedy', name: 'In a Hurry', desc: 'Clear a level in under 35 seconds.', coins: 40, test: s => s.stats2.fastest > 0 && s.stats2.fastest < 35 },
  { id: 'dark', name: 'Night Owl', desc: 'Clear a Lights Out level.', coins: 30, test: s => !!(s.stats2.twists && s.stats2.twists.dark) },
  { id: 'twists', name: 'Plot Twist', desc: 'Clear a level with every twist.', coins: 120, test: s => Object.keys(SL.TWISTS).every(k => s.stats2.twists && s.stats2.twists[k]) },
  { id: 'coins50', name: 'Magpie', desc: 'Grab 50 coins inside levels.', coins: 50, test: s => s.stats2.grabbed >= 50 },
  { id: 'shop10', name: 'Retail Therapy', desc: 'Own 10 things from the shop.', coins: 80, test: s => s.owned.length >= 10 }
];

// ---------- drawing the blob ----------
// look: { skin, hat } ids. Used by the game and by the shop previews.
SL.drawBlob = function (ctx, o) {
  const skin = SL.ITEM[o.skin] || SL.ITEM.sunny, hat = o.hat || 'sprout';
  const cx = o.cx, by = o.by, sq = o.sq || 1, face = o.face || 1, t = o.time || 0, ink = o.ink || '#3b2a40';
  const rx = 13 / Math.sqrt(sq), ry = 13 * sq, cy = by - ry;
  let body = skin.body;
  if (body === 'glitch') body = ['#ff4fa3', '#4df0b8', '#ffcb3d', '#8ed0ff'][Math.floor(t * 8) % 4];
  // hats that sit behind the head
  if (hat === 'halo') { ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy - ry - 7 + Math.sin(t * 3) * 1.5, 9, 3, 0, 0, 7); ctx.stroke(); }
  // body
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
  if (skin.spots) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.clip();
    ctx.fillStyle = skin.spots;
    ctx.beginPath(); ctx.ellipse(cx - 7, cy + 5, 4, 3, 0.3, 0, 7); ctx.ellipse(cx + 8, cy - 6, 3.5, 2.5, -0.4, 0, 7); ctx.ellipse(cx + 3, cy + 9, 3, 2, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = skin.shine ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.ellipse(cx - 5, cy - 6, 4, 2.5, -0.5, 0, 7); ctx.fill();
  if (skin.shine && Math.sin(t * 2) > 0.7) { ctx.fillStyle = '#fff'; ctx.fillRect(cx + 6, cy - 9, 2, 6); ctx.fillRect(cx + 4, cy - 7, 6, 2); }
  // eyes
  const ex = face * 3.5, ey = Math.max(-2, Math.min(2, (o.vy || 0) / 300));
  ctx.fillStyle = skin.eyes || ink;
  const blink = (t % 3.4) < 0.1;
  for (const off of [-4.5, 4.5]) {
    if (blink) ctx.fillRect(cx + ex + off - 2.5, cy - 2 + ey, 5, 1.8);
    else { ctx.beginPath(); ctx.ellipse(cx + ex + off, cy - 2 + ey, 2.3, 3.4, 0, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,110,140,0.5)';
  ctx.beginPath(); ctx.ellipse(cx + ex - 8, cy + 4, 2.6, 1.6, 0, 0, 7); ctx.ellipse(cx + ex + 8, cy + 4, 2.6, 1.6, 0, 0, 7); ctx.fill();
  // hats on top
  const top = cy - ry;
  ctx.lineWidth = 2; ctx.strokeStyle = ink;
  const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(cx + x, top + y) : ctx.moveTo(cx + x, top + y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); };
  switch (hat) {
    case 'sprout':
      ctx.strokeStyle = '#3fa968'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, top + 2); ctx.quadraticCurveTo(cx - 1, top - 6, cx + 1, top - 8); ctx.stroke();
      ctx.fillStyle = '#6dd08b'; ctx.beginPath(); ctx.ellipse(cx + 5, top - 8, 5, 3, -0.4, 0, 7); ctx.fill();
      break;
    case 'party': poly([[-7, 3], [7, 3], [1, -16]], '#ff7aa8'); ctx.fillStyle = '#ffcb3d'; ctx.beginPath(); ctx.arc(cx + 1, top - 16, 3, 0, 7); ctx.fill(); break;
    case 'beanie': ctx.fillStyle = '#5aa0ff'; ctx.beginPath(); ctx.ellipse(cx, top + 4, 11, 8, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fffaf2'; ctx.beginPath(); ctx.arc(cx, top - 5, 3.5, 0, 7); ctx.fill(); ctx.stroke(); break;
    case 'horns': poly([[-9, 4], [-5, 2], [-12, -8]], '#ff5a6e'); poly([[9, 4], [5, 2], [12, -8]], '#ff5a6e'); break;
    case 'tophat': ctx.fillStyle = '#2a1d38'; ctx.fillRect(cx - 10, top + 1, 20, 3); ctx.strokeRect(cx - 10, top + 1, 20, 3); ctx.fillRect(cx - 6, top - 12, 12, 13); ctx.strokeRect(cx - 6, top - 12, 12, 13); ctx.fillStyle = '#ff5a6e'; ctx.fillRect(cx - 6, top - 3, 12, 3); break;
    case 'propeller': {
      ctx.fillStyle = '#ffcb3d'; ctx.beginPath(); ctx.ellipse(cx, top + 3, 8, 5, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.fillRect(cx - 1, top - 6, 2, 6);
      const s = Math.cos(t * 20) * 11; ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.ellipse(cx, top - 7, Math.abs(s) + 1, 2, 0, 0, 7); ctx.fill(); ctx.stroke();
      break;
    }
    case 'crown': poly([[-9, 3], [9, 3], [9, -7], [4.5, -2], [0, -9], [-4.5, -2], [-9, -7]], '#ffd84d'); break;
    case 'dunce': poly([[-6, 3], [6, 3], [-2, -20]], '#fffaf2'); ctx.fillStyle = ink; ctx.font = '700 7px Fredoka, sans-serif'; ctx.fillText('D', cx - 3, top - 2); break;
    case 'spite': {
      poly([[-9, 3], [9, 3], [9, -7], [4.5, -2], [0, -9], [-4.5, -2], [-9, -7]], '#ff4f6e');
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#ffcb3d' : '#ff8a3d'; ctx.beginPath(); ctx.ellipse(cx - 6 + i * 6, top - 10 - Math.abs(Math.sin(t * 9 + i)) * 4, 2.5, 4, 0, 0, 7); ctx.fill(); }
      break;
    }
  }
};

// Particles a trail leaves behind. Returns null for no particle this frame.
SL.trailPart = function (trail, x, y, t) {
  switch (trail) {
    case 'sparkle': return { x: x + (Math.random() - 0.5) * 14, y: y - Math.random() * 20, vx: 0, vy: -20, life: 0.5, max: 0.5, color: '#fff6a8', size: 4, kind: 'star', g: 0 };
    case 'bubbles': return { x: x + (Math.random() - 0.5) * 12, y: y - 8 - Math.random() * 12, vx: 0, vy: -40, life: 0.7, max: 0.7, color: 'rgba(150,220,255,0.8)', size: 3 + Math.random() * 3, kind: 'ring', g: -20 };
    case 'hearts': return { x: x + (Math.random() - 0.5) * 12, y: y - 10, vx: (Math.random() - 0.5) * 20, vy: -35, life: 0.7, max: 0.7, color: '#ff7aa8', size: 5, kind: 'heart', g: 0 };
    case 'rainbow': return { x, y: y - 12, vx: 0, vy: 0, life: 0.45, max: 0.45, color: `hsl(${(t * 360) % 360},90%,65%)`, size: 6, kind: 'dot', g: 0 };
    case 'flames': return { x: x + (Math.random() - 0.5) * 12, y: y - 4, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 40, life: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#ff8a3d' : '#ffcb3d', size: 4 + Math.random() * 3, kind: 'dot', g: -40 };
    default: return null;
  }
};

})(typeof window !== 'undefined' ? window : globalThis);
