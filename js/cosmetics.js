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
  { id: 'nope', slot: 'death', name: 'Ragequit', trophy: 'die100' },
  // rotating stock: only some are on sale each day
  { id: 'lava', slot: 'skin', name: 'Lava', price: 220, rotate: true, body: '#ff5a1f', spots: '#ffcb3d' },
  { id: 'ice', slot: 'skin', name: 'Ice Cube', price: 220, rotate: true, body: '#c9f1ff', shine: true },
  { id: 'zebra', slot: 'skin', name: 'Zebra', price: 260, rotate: true, body: '#fffaf2', stripes: '#3b2a40' },
  { id: 'pumpkin', slot: 'skin', name: 'Pumpkin', price: 240, rotate: true, body: '#ff9a2e', stripes: '#d96f10' },
  { id: 'alien', slot: 'skin', name: 'Alien', price: 300, rotate: true, body: '#9be86b', eyes: '#1c1226', big: true },
  { id: 'cowboy', slot: 'hat', name: 'Cowboy Hat', price: 200, rotate: true },
  { id: 'chef', slot: 'hat', name: 'Chef Hat', price: 180, rotate: true },
  { id: 'viking', slot: 'hat', name: 'Viking Helmet', price: 260, rotate: true },
  { id: 'bow', slot: 'hat', name: 'Big Bow', price: 160, rotate: true },
  { id: 'phones', slot: 'hat', name: 'Headphones', price: 220, rotate: true },
  { id: 'wizard', slot: 'hat', name: 'Wizard Hat', price: 280, rotate: true },
  { id: 'notes', slot: 'trail', name: 'Music Notes', price: 200, rotate: true },
  { id: 'leaves', slot: 'trail', name: 'Leaves', price: 180, rotate: true },
  { id: 'splat', slot: 'death', name: 'Paint Splat', price: 180, rotate: true },
  { id: 'stars', slot: 'death', name: 'Seeing Stars', price: 200, rotate: true },
  // only from the Grudge Box
  { id: 'disco', slot: 'skin', name: 'Disco', box: true, body: 'disco' },
  { id: 'clown', slot: 'hat', name: 'Clown Wig', box: true },
  { id: 'money', slot: 'trail', name: 'Money Trail', box: true },
  { id: 'firework', slot: 'death', name: 'Firework', box: true },
  // the ending and New Game+
  { id: 'champ', slot: 'hat', name: 'Champion Crown', trophy: 'ending' },
  { id: 'hardhat', slot: 'hat', name: 'Hard Hat', trophy: 'hard50' },
  { id: 'inferno', slot: 'skin', name: 'Inferno', trophy: 'rage25', body: '#5a0f1a', spots: '#ff8a3d', eyes: '#ffcb3d' },
  { id: 'blackhole', slot: 'death', name: 'Black Hole', trophy: 'die5000' },
  { id: 'saint', slot: 'trail', name: 'Halo Dust', trophy: 'cleanRun' },
  { id: 'remix', slot: 'skin', name: 'Remixed', trophy: 'ng2', body: 'remix' },
  // pins: one per cheat, from gold mastery
  { id: 'nopin', slot: 'pin', name: 'No Pin', free: true }
];
// pin art: colour and a glyph per cheat
const PIN_ART = {
  coldFeet: ['#9d74ff', '🚪'], falseFloor: ['#e2a96f', '▭'], rotten: ['#6e963c', '☠'], pinholes: ['#c9c3d6', '∴'],
  mimic: ['#ff4f6e', 'W'], invisBlock: ['#ffffff', '?'], shouting: ['#ffcb3d', '!'], ceilingTeeth: ['#eef2fb', 'V'],
  runaway: ['#e2a96f', '»'], headache: ['#a49dba', '✱'], lunger: ['#ff7aa8', '▲'], shyLedge: ['#ff9cc0', '◔'],
  secretFloor: ['#8ed0ff', '✦'], swapZone: ['#c9a7ff', '⇄'], impatient: ['#ff9c6b', '⧗'], backwardsFlag: ['#6fdc98', '⚑'],
  copycat: ['#2a1d38', '◐'], spikeWall: ['#4a1735', '║']
};
SL.PIN_ART = PIN_ART;
for (const id of Object.keys(PIN_ART)) SL.ITEMS.push({ id: 'pin_' + id, slot: 'pin', name: 'Gold Pin', mastery: id });
SL.ITEM = {};
for (const it of SL.ITEMS) SL.ITEM[it.id] = it;
for (const it of SL.ITEMS) if (it.mastery) it.name = 'Pin: ' + (SL.CHEATS[it.mastery] ? SL.CHEATS[it.mastery].name : it.mastery);
SL.SLOTS = [['today', 'Today'], ['skin', 'Skins'], ['hat', 'Hats'], ['trail', 'Trails'], ['death', 'Deaths'], ['pin', 'Pins'], ['dye', 'Dyes'], ['use', 'Items'], ['box', 'Grudge Box']];

// Hat dyes: recolour the main colour of any hat you own.
SL.DYES = [
  { id: 'none', name: 'Original', color: null, free: true },
  { id: 'red', name: 'Cherry', color: '#ff4f6e', price: 40 }, { id: 'orange', name: 'Tangerine', color: '#ff9a2e', price: 40 },
  { id: 'yellow', name: 'Lemon', color: '#ffd84d', price: 40 }, { id: 'green', name: 'Lime', color: '#6fdc98', price: 40 },
  { id: 'teal', name: 'Teal', color: '#3fc4c0', price: 40 }, { id: 'blue', name: 'Ocean', color: '#5aa0ff', price: 40 },
  { id: 'purple', name: 'Grape', color: '#9d74ff', price: 40 }, { id: 'pink', name: 'Bubblegum', color: '#ff8fc0', price: 40 },
  { id: 'white', name: 'Snow', color: '#fffaf2', price: 60 }, { id: 'black', name: 'Ink', color: '#2a1d38', price: 60 },
  { id: 'gold', name: 'Gold Leaf', color: '#ffd84d', price: 150, shine: true }, { id: 'rainbow', name: 'Rainbow', color: 'rainbow', price: 400 }
];
SL.DYE = {}; for (const d of SL.DYES) SL.DYE[d.id] = d;

// Consumables. Using any of them marks the level Assisted: half pay, no trophies, no mastery, not in the Daily.
SL.CONSUMABLES = [
  { id: 'lens', name: 'Snitch Lens', price: 40, desc: 'Shows every trap\'s tell for this level, even on Rage.' },
  { id: 'bubble', name: 'Bubble', price: 60, desc: 'The next thing that kills you pops the bubble instead.' },
  { id: 'flag', name: 'Pocket Flag', price: 50, desc: 'Plant your own checkpoint right where you stand.' },
  { id: 'skip', name: 'Skip Ticket', price: 250, desc: 'Skip this level. No coins. Not on the boss.' }
];
SL.CONS = {}; for (const c of SL.CONSUMABLES) SL.CONS[c.id] = c;

// Grudge Box: the game's own loot box. It tells you the odds are bad. It still has a pity timer.
SL.BOX = { price: 120, pity: 12, odds: [['coins', 0.4], ['item', 0.27], ['dye', 0.2], ['stock', 0.1], ['exclusive', 0.03]] };

// Today's stock: four rotating items, the same for everyone on the same day.
SL.todayKey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
SL.todayStock = function (key) {
  const r = SL.rng(SL.hashStr('stock:' + key));
  return r.shuffle(SL.ITEMS.filter(i => i.rotate).map(i => i.id)).slice(0, 4);
};

// ---------- Grudge Pacts ----------
// Opt-in punishment for a bigger payout. Each adds to the coin multiplier.
SL.PACTS = [
  { id: 'extra', name: 'One More Trick', desc: '+1 cheat every level.', mult: 0.5 },
  { id: 'noflag', name: 'No Safety Net', desc: 'No checkpoints.', mult: 0.5 },
  { id: 'shadow', name: 'Shadowed', desc: 'Copycat is always on.', mult: 0.5 },
  { id: 'wall', name: 'Chased', desc: 'Spike Wall is always on.', mult: 0.5 },
  { id: 'dark', name: 'Blackout', desc: 'Every level has the lights out.', mult: 0.5 },
  { id: 'greedy', name: 'Butterfingers', desc: 'Dying drops the coins you grabbed this level.', mult: 0.25 }
];
SL.pactMult = pacts => 1 + SL.PACTS.filter(p => pacts && pacts[p.id]).reduce((a, p) => a + p.mult, 0);

// ---------- cheat mastery ----------
// Clearing a level that had a cheat in it counts toward that cheat. Gold gives its pin.
SL.MASTERY = [{ n: 5, name: 'Bronze', coins: 15 }, { n: 25, name: 'Silver', coins: 40 }, { n: 75, name: 'Gold', coins: 80, pin: true }];
SL.masteryTier = n => SL.MASTERY.filter(t => n >= t.n).length;

// ---------- Loser Rank ----------
// Account level from lifetime XP. Deaths give XP too. It never maxes out.
SL.RANK_TITLES = ['Fresh Meat', 'Mildly Inconvenienced', 'Spike Tester', 'Pit Enthusiast', 'Sign Reader', 'Door Chaser', 'Professional Victim',
  'Floor Inspector', 'Respawn Regular', 'Cheat Collector', 'Grudge Holder', 'Thorn in My Side', 'Persistent Pest', 'The Game\'s Nemesis', 'Unkillable Annoyance', 'Absolute Menace'];
SL.rankOf = function (xp) {
  let lvl = 1, need = 120, left = xp;
  while (left >= need) { left -= need; lvl++; need = Math.round(120 + lvl * 45); }
  return { lvl, into: left, need, title: SL.RANK_TITLES[Math.min(SL.RANK_TITLES.length - 1, Math.floor((lvl - 1) / 3))] };
};
// Things the game "sells" but never will.
SL.TROLL_ITEMS = [
  { id: 'win', name: 'Win Button', price: 99999, say: 'You cannot afford it. Nobody can. That is the point.' },
  { id: 'nocheat', name: 'Remove a Cheat', price: 0, sold: true, say: 'Sold out. Forever. Restocking never.' },
  { id: 'skip', name: 'Skip Level', price: 500, sold: true, say: 'I sold the last one to myself.' }
];

// ---------- payouts ----------
SL.DIFF_MULT = { normal: 1, hard: 1.5, rage: 2.5 };
SL.payout = function (level, deaths, coins, diff, twist, extra) {
  extra = extra || {};
  const rows = [[extra.boss ? 'Beat the Game' : 'Level cleared', extra.boss ? 500 : 8 + Math.min(level, 60)]];
  if (coins) rows.push([`${coins} coin${coins > 1 ? 's' : ''} grabbed`, coins * 5]);
  if (!deaths && !extra.assisted) rows.push(['No deaths', 15]);
  if (twist) rows.push(['Twist survived', 6]);
  let total = rows.reduce((a, r) => a + r[1], 0);
  const mults = [];
  const m = SL.DIFF_MULT[diff] || 1;
  if (m !== 1) mults.push([`${SL.DIFFS[diff].name} ×${m}`, m]);
  const pm = SL.pactMult(extra.pacts);
  if (pm !== 1) mults.push([`Pacts ×${pm}`, pm]);
  if (extra.ng) mults.push([`New Game+${extra.ng} ×${1 + extra.ng * 0.5}`, 1 + extra.ng * 0.5]);
  for (const [name, f] of mults) { const add = Math.round(total * (f - 1)); rows.push([name, add]); total += add; }
  if (extra.assisted) { const cut = Math.round(total / 2); rows.push(['Assisted (half pay)', -cut]); total -= cut; }
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
  { id: 'shop10', name: 'Retail Therapy', desc: 'Own 10 things from the shop.', coins: 80, test: s => s.owned.length >= 10 },
  { id: 'shop30', name: 'Hoarder', desc: 'Own 30 things.', coins: 200, test: s => s.owned.length >= 30 },
  { id: 'daily1', name: 'Daily Grudge', desc: 'Clear a Daily Grudge.', coins: 40, test: s => s.stats2.dailies >= 1 },
  { id: 'streak7', name: 'Week of Spite', desc: 'Clear the Daily 7 days in a row.', coins: 250, test: s => s.stats2.bestStreak >= 7 },
  { id: 'pact3', name: 'Signed in Blood', desc: 'Clear a level with 3 pacts on.', coins: 100, test: s => s.stats2.maxPacts >= 3 },
  { id: 'pactAll', name: 'Deal With the Devil', desc: 'Clear a level with every pact on.', coins: 400, test: s => s.stats2.maxPacts >= SL.PACTS.length },
  { id: 'gold1', name: 'Specialist', desc: 'Reach Gold mastery on any cheat.', coins: 100, test: s => Object.values(s.mastery || {}).some(n => n >= 75) },
  { id: 'rank10', name: 'Ranked', desc: 'Reach Loser Rank 10.', coins: 150, test: s => SL.rankOf(s.xp || 0).lvl >= 10 },
  { id: 'box10', name: 'Gambling Problem', desc: 'Open 10 Grudge Boxes.', coins: 60, test: s => (s.stats2.boxes || 0) >= 10 },
  { id: 'ending', name: 'Game Over (For It)', desc: 'Beat the Game at level 100.', coins: 0, item: 'champ', test: s => (s.stats2.endings || 0) >= 1 },
  { id: 'ng2', name: 'Again. And Again.', desc: 'Beat the Game on New Game+2.', coins: 500, item: 'remix', test: s => (s.stats2.maxNgBeaten || 0) >= 2 },
  // ---- the long tail ----
  { id: 'die1000', name: 'Frequent Flyer', desc: 'Die 1,000 times.', coins: 200, test: s => s.totalDeaths >= 1000 },
  { id: 'die5000', name: 'Event Horizon', desc: 'Die 5,000 times.', coins: 600, item: 'blackhole', test: s => s.totalDeaths >= 5000 },
  { id: 'clean50', name: 'Immaculate', desc: 'Clear 50 levels without dying.', coins: 400, test: s => s.stats2.clean >= 50 },
  { id: 'hard25', name: 'Hardened', desc: 'Reach level 25 on Hard.', coins: 150, test: s => s.bestIn.hard >= 25 },
  { id: 'hard50', name: 'Hard Worker', desc: 'Reach level 50 on Hard.', coins: 300, item: 'hardhat', test: s => s.bestIn.hard >= 50 },
  { id: 'rage10', name: 'Seeing Red', desc: 'Reach level 10 on Rage.', coins: 150, test: s => s.bestIn.rage >= 10 },
  { id: 'rage25', name: 'Inferno', desc: 'Reach level 25 on Rage.', coins: 400, item: 'inferno', test: s => s.bestIn.rage >= 25 },
  { id: 'rage50', name: 'Blind Fury', desc: 'Reach level 50 on Rage.', coins: 800, test: s => s.bestIn.rage >= 50 },
  { id: 'rageClean', name: 'Cold Blood', desc: 'Clear a Rage level without dying.', coins: 200, test: s => (s.stats2.rageClean || 0) >= 1 },
  { id: 'rageMirror', name: 'Through the Looking Glass', desc: 'Clear a Mirror level on Rage.', coins: 150, test: s => !!s.stats2.rageMirror },
  { id: 'bossHard', name: 'Hard Reset', desc: 'Beat the Game on Hard.', coins: 600, test: s => ((s.stats2.bossBy || {}).hard || 0) >= 1 },
  { id: 'bossRage', name: 'Unplugged', desc: 'Beat the Game on Rage.', coins: 1200, test: s => ((s.stats2.bossBy || {}).rage || 0) >= 1 },
  { id: 'bossClean', name: 'Flawless Victory', desc: 'Beat the Game without dying in the fight.', coins: 500, test: s => !!s.stats2.bossClean },
  { id: 'ng5', name: 'Sore Winner', desc: 'Beat the Game on New Game+5.', coins: 2000, test: s => (s.stats2.maxNgBeaten || 0) >= 5 },
  { id: 'cleanRun', name: 'No Help Needed', desc: 'Pass level 50 in a run without using a single item.', coins: 300, item: 'saint', test: s => !!s.stats2.cleanRun50 },
  { id: 'deepPacts', name: 'Contract Killer', desc: 'Clear a level 50+ with 4 or more pacts.', coins: 500, test: s => !!s.stats2.deepPacts },
  { id: 'streak30', name: 'Month of Spite', desc: 'Clear the Daily 30 days in a row.', coins: 1000, test: s => s.stats2.bestStreak >= 30 },
  { id: 'gold6', name: 'Expert Witness', desc: 'Gold mastery on 6 cheats.', coins: 400, test: s => Object.values(s.mastery || {}).filter(n => n >= 75).length >= 6 },
  { id: 'goldAll', name: 'I Wrote the Book', desc: 'Gold mastery on every cheat.', coins: 2500, test: s => Object.values(s.mastery || {}).filter(n => n >= 75).length >= SL.CHEAT_IDS.length },
  { id: 'rank25', name: 'Veteran Loser', desc: 'Reach Loser Rank 25.', coins: 400, test: s => SL.rankOf(s.xp || 0).lvl >= 25 },
  { id: 'rank50', name: 'Legendary Loser', desc: 'Reach Loser Rank 50.', coins: 1500, test: s => SL.rankOf(s.xp || 0).lvl >= 50 },
  { id: 'grab500', name: 'Dragon Hoard', desc: 'Grab 500 coins inside levels.', coins: 300, test: s => s.stats2.grabbed >= 500 },
  { id: 'box50', name: 'Problem Gambler', desc: 'Open 50 Grudge Boxes.', coins: 300, test: s => (s.stats2.boxes || 0) >= 50 },
  { id: 'speed20', name: 'Blink', desc: 'Clear a level in under 20 seconds.', coins: 150, test: s => s.stats2.fastest > 0 && s.stats2.fastest < 20 },
  { id: 'everything', name: 'Completionist', desc: 'Own every cosmetic in the game.', coins: 5000, test: s => SL.ITEMS.every(i => i.free || s.owned.indexOf(i.id) >= 0) }
];

// ---------- drawing the blob ----------
// look: { skin, hat } ids. Used by the game and by the shop previews.
SL.drawBlob = function (ctx, o) {
  const skin = SL.ITEM[o.skin] || SL.ITEM.sunny, hat = o.hat || 'sprout';
  const cx = o.cx, by = o.by, sq = o.sq || 1, face = o.face || 1, t = o.time || 0, ink = o.ink || '#3b2a40';
  const rx = 13 / Math.sqrt(sq), ry = 13 * sq, cy = by - ry;
  let body = skin.body;
  if (body === 'glitch') body = ['#ff4fa3', '#4df0b8', '#ffcb3d', '#8ed0ff'][Math.floor(t * 8) % 4];
  if (body === 'disco') body = `hsl(${(t * 140) % 360},85%,65%)`;
  if (body === 'remix') body = (Math.floor(t * 2) % 2) ? '#ff4fa3' : '#4df0b8';
  // dye: recolours the hat's main colour
  const dye = SL.DYE && SL.DYE[o.dye];
  const dc = def => !dye || !dye.color ? def : dye.color === 'rainbow' ? `hsl(${(t * 120) % 360},85%,62%)` : dye.color;
  // hats that sit behind the head
  if (hat === 'halo') { ctx.strokeStyle = dc('#ffd84d'); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(cx, cy - ry - 7 + Math.sin(t * 3) * 1.5, 9, 3, 0, 0, 7); ctx.stroke(); }
  // body
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
  if (skin.stripes) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.clip();
    ctx.strokeStyle = skin.stripes; ctx.lineWidth = 3;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 6 - 3, cy - ry); ctx.quadraticCurveTo(cx + i * 6 + 3, cy, cx + i * 6 - 2, cy + ry); ctx.stroke(); }
    ctx.restore();
  }
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
    else if (skin.big) { ctx.beginPath(); ctx.ellipse(cx + ex + off * 1.1, cy - 2 + ey, 3.6, 4.8, off > 0 ? 0.3 : -0.3, 0, 7); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(cx + ex + off, cy - 2 + ey, 2.3, 3.4, 0, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(255,110,140,0.5)';
  ctx.beginPath(); ctx.ellipse(cx + ex - 8, cy + 4, 2.6, 1.6, 0, 0, 7); ctx.ellipse(cx + ex + 8, cy + 4, 2.6, 1.6, 0, 0, 7); ctx.fill();
  if (o.pin && o.pin !== 'nopin') SL.drawPin(ctx, o.pin, cx, cy, face);
  // hats on top
  const top = cy - ry;
  ctx.lineWidth = 2; ctx.strokeStyle = ink;
  const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(cx + x, top + y) : ctx.moveTo(cx + x, top + y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); };
  switch (hat) {
    case 'sprout':
      ctx.strokeStyle = '#3fa968'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, top + 2); ctx.quadraticCurveTo(cx - 1, top - 6, cx + 1, top - 8); ctx.stroke();
      ctx.fillStyle = '#6dd08b'; ctx.beginPath(); ctx.ellipse(cx + 5, top - 8, 5, 3, -0.4, 0, 7); ctx.fill();
      break;
    case 'party': poly([[-7, 3], [7, 3], [1, -16]], dc('#ff7aa8')); ctx.fillStyle = '#ffcb3d'; ctx.beginPath(); ctx.arc(cx + 1, top - 16, 3, 0, 7); ctx.fill(); break;
    case 'beanie': ctx.fillStyle = dc('#5aa0ff'); ctx.beginPath(); ctx.ellipse(cx, top + 4, 11, 8, 0, Math.PI, 0); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fffaf2'; ctx.beginPath(); ctx.arc(cx, top - 5, 3.5, 0, 7); ctx.fill(); ctx.stroke(); break;
    case 'horns': poly([[-9, 4], [-5, 2], [-12, -8]], dc('#ff5a6e')); poly([[9, 4], [5, 2], [12, -8]], dc('#ff5a6e')); break;
    case 'tophat': ctx.fillStyle = dc('#2a1d38'); ctx.fillRect(cx - 10, top + 1, 20, 3); ctx.strokeRect(cx - 10, top + 1, 20, 3); ctx.fillRect(cx - 6, top - 12, 12, 13); ctx.strokeRect(cx - 6, top - 12, 12, 13); ctx.fillStyle = '#ff5a6e'; ctx.fillRect(cx - 6, top - 3, 12, 3); break;
    case 'propeller': {
      ctx.fillStyle = dc('#ffcb3d'); ctx.beginPath(); ctx.ellipse(cx, top + 3, 8, 5, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.fillRect(cx - 1, top - 6, 2, 6);
      const s = Math.cos(t * 20) * 11; ctx.fillStyle = '#ff7aa8'; ctx.beginPath(); ctx.ellipse(cx, top - 7, Math.abs(s) + 1, 2, 0, 0, 7); ctx.fill(); ctx.stroke();
      break;
    }
    case 'crown': poly([[-9, 3], [9, 3], [9, -7], [4.5, -2], [0, -9], [-4.5, -2], [-9, -7]], dc('#ffd84d')); break;
    case 'dunce': poly([[-6, 3], [6, 3], [-2, -20]], dc('#fffaf2')); ctx.fillStyle = ink; ctx.font = '700 7px Fredoka, sans-serif'; ctx.fillText('D', cx - 3, top - 2); break;
    case 'cowboy':
      ctx.fillStyle = dc('#b5713a'); ctx.beginPath(); ctx.ellipse(cx, top + 2, 15, 3.5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 8, top + 1); ctx.quadraticCurveTo(cx - 9, top - 10, cx - 3, top - 9); ctx.lineTo(cx, top - 6); ctx.lineTo(cx + 3, top - 9); ctx.quadraticCurveTo(cx + 9, top - 10, cx + 8, top + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'chef':
      ctx.fillStyle = dc('#ffffff'); ctx.fillRect(cx - 7, top - 4, 14, 7); ctx.strokeRect(cx - 7, top - 4, 14, 7);
      ctx.beginPath(); ctx.arc(cx - 5, top - 8, 5, 0, 7); ctx.arc(cx + 5, top - 8, 5, 0, 7); ctx.arc(cx, top - 12, 6, 0, 7); ctx.fill(); ctx.stroke();
      break;
    case 'viking':
      poly([[-12, -1], [-9, 1], [-15, -12]], '#fffaf2'); poly([[12, -1], [9, 1], [15, -12]], '#fffaf2');
      ctx.fillStyle = dc('#a49dba'); ctx.beginPath(); ctx.ellipse(cx, top + 4, 11, 9, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd84d'; ctx.fillRect(cx - 11, top + 1, 22, 3);
      break;
    case 'bow':
      poly([[0, 0], [-11, -6], [-11, 5]], dc('#ff4f6e')); poly([[0, 0], [11, -6], [11, 5]], dc('#ff4f6e'));
      ctx.fillStyle = dc('#ff4f6e'); ctx.beginPath(); ctx.arc(cx, top, 3, 0, 7); ctx.fill(); ctx.stroke();
      break;
    case 'phones':
      ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 14, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.fillStyle = dc('#ff7aa8'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx - 13, cy - 2, 4, 6, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + 13, cy - 2, 4, 6, 0, 0, 7); ctx.fill(); ctx.stroke();
      break;
    case 'wizard':
      ctx.fillStyle = dc('#5a3f9e'); ctx.beginPath(); ctx.ellipse(cx, top + 2, 13, 3, 0, 0, 7); ctx.fill(); ctx.stroke();
      poly([[-8, 2], [8, 2], [5, -12], [9, -18]], dc('#5a3f9e'));
      ctx.fillStyle = '#ffd84d'; ctx.font = '8px sans-serif'; ctx.fillText('★', cx - 3, top - 2);
      break;
    case 'clown': {
      for (let i = 0; i < 7; i++) { ctx.fillStyle = `hsl(${i * 50 + t * 60},85%,62%)`; ctx.beginPath(); ctx.arc(cx - 12 + i * 4, top + 1 - Math.sin(i / 6 * Math.PI) * 6, 5, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#ff2d4a'; ctx.beginPath(); ctx.arc(cx + face * 6, cy + 3, 3.4, 0, 7); ctx.fill(); ctx.stroke();
      break;
    }
    case 'hardhat':
      ctx.fillStyle = dc('#ffcb3d'); ctx.beginPath(); ctx.ellipse(cx, top + 4, 12, 10, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillRect(cx - 15, top + 2, 30, 3); ctx.strokeRect(cx - 15, top + 2, 30, 3); ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(cx - 1.5, top - 6, 3, 9);
      break;
    case 'champ': {
      poly([[-10, 3], [10, 3], [10, -8], [5, -2], [0, -11], [-5, -2], [-10, -8]], `hsl(${(t * 90) % 360},85%,62%)`);
      ctx.fillStyle = '#fff'; for (const [x, y] of [[-10, -8], [0, -11], [10, -8]]) { ctx.beginPath(); ctx.arc(cx + x, top + y, 2, 0, 7); ctx.fill(); }
      break;
    }
    case 'spite': {
      poly([[-9, 3], [9, 3], [9, -7], [4.5, -2], [0, -9], [-4.5, -2], [-9, -7]], '#ff4f6e');
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#ffcb3d' : '#ff8a3d'; ctx.beginPath(); ctx.ellipse(cx - 6 + i * 6, top - 10 - Math.abs(Math.sin(t * 9 + i)) * 4, 2.5, 4, 0, 0, 7); ctx.fill(); }
      break;
    }
  }
};

// A gold pin on the blob's side.
SL.drawPin = function (ctx, pin, cx, cy, face) {
  const it = SL.ITEM[pin];
  if (!it || !it.mastery) return;
  const [col, glyph] = SL.PIN_ART[it.mastery] || ['#ffd84d', '?'];
  const x = cx - face * 7, y = cy + 5;
  ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3b2a40'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 3.6, 0, 7); ctx.fill();
  ctx.fillStyle = '#3b2a40'; ctx.font = '700 5px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, x, y + 0.3); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
};

// Particles a trail leaves behind. Returns null for no particle this frame.
SL.trailPart = function (trail, x, y, t) {
  switch (trail) {
    case 'sparkle': return { x: x + (Math.random() - 0.5) * 14, y: y - Math.random() * 20, vx: 0, vy: -20, life: 0.5, max: 0.5, color: '#fff6a8', size: 4, kind: 'star', g: 0 };
    case 'bubbles': return { x: x + (Math.random() - 0.5) * 12, y: y - 8 - Math.random() * 12, vx: 0, vy: -40, life: 0.7, max: 0.7, color: 'rgba(150,220,255,0.8)', size: 3 + Math.random() * 3, kind: 'ring', g: -20 };
    case 'hearts': return { x: x + (Math.random() - 0.5) * 12, y: y - 10, vx: (Math.random() - 0.5) * 20, vy: -35, life: 0.7, max: 0.7, color: '#ff7aa8', size: 5, kind: 'heart', g: 0 };
    case 'rainbow': return { x, y: y - 12, vx: 0, vy: 0, life: 0.45, max: 0.45, color: `hsl(${(t * 360) % 360},90%,65%)`, size: 6, kind: 'dot', g: 0 };
    case 'notes': return { x: x + (Math.random() - 0.5) * 10, y: y - 14, vx: (Math.random() - 0.5) * 30, vy: -40, life: 0.8, max: 0.8, color: '#fffaf2', size: 12, kind: 'text', text: Math.random() < 0.5 ? '♪' : '♫', g: 0 };
    case 'leaves': return { x: x + (Math.random() - 0.5) * 12, y: y - 10, vx: (Math.random() - 0.5) * 40, vy: 10, life: 0.9, max: 0.9, color: Math.random() < 0.5 ? '#6dd08b' : '#ff9a2e', size: 4, kind: 'square', g: 60 };
    case 'saint': return { x: x + (Math.random() - 0.5) * 14, y: y - 6, vx: 0, vy: -15, life: 0.9, max: 0.9, color: '#fff6c8', size: 3, kind: 'star', g: -10 };
    case 'money': return { x: x + (Math.random() - 0.5) * 10, y: y - 10, vx: (Math.random() - 0.5) * 30, vy: -60, life: 0.7, max: 0.7, color: '#ffd84d', size: 4, kind: 'dot', g: 300 };
    case 'flames': return { x: x + (Math.random() - 0.5) * 12, y: y - 4, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 40, life: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#ff8a3d' : '#ffcb3d', size: 4 + Math.random() * 3, kind: 'dot', g: -40 };
    default: return null;
  }
};

})(typeof window !== 'undefined' ? window : globalThis);
