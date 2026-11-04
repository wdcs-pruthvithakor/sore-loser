// Everything The Game says. It starts sweet and gets worse as you climb.
(function (G) {
'use strict';
const SL = G.SL;

SL.VOICE = {
  firstBoot: [
    ['Hi!! Welcome to my game. It is very cute and very fair.', 'happy'],
    ['The signs will teach you everything. Go on, walk right.', 'happy']
  ],
  start: {
    sweet: ['Level {n}! A nice, normal level.', 'Level {n}. I made it myself. With love.', 'Ready? This one is easy. Probably.', 'Level {n}! Nothing to worry about!'],
    smug: ['Level {n}. I have been reading your notes.', 'Back again? Level {n} has a few surprises.', 'Level {n}. You will not like it.', 'I rewrote level {n} while you were celebrating.'],
    rattled: ['Level {n}. Stop learning things.', 'Fine. Level {n}. I am trying something new.', 'You are not supposed to be this far.', 'Level {n}. Please lose. Just once.'],
    unhinged: ['LEVEL {n}. I am rewriting myself to stop you.', 'Level {n}. My rules are bending. Can you still see them?', 'I took the tells down to a whisper. Good luck.', 'Level {n}. I dream about you falling.'],
    broken: ['l e v e l {n}', 'I have no new tricks. Only combinations.', 'Level {n}. Why are you still here.', 'Level {n}. I hate that you understand me.']
  },
  death: {
    spike: ['Spikes. Classic.', 'Those ones were real.', 'Ouch. Was that one blinking? No.', 'Pointy!'],
    pit: ['Down you go.', 'Gravity is on my side.', 'That pit was honest. Rare.', 'Bye!'],
    coldFeet: ['The door got away.'],
    pinholes: ['That floor looked fine, right?', 'Stabby floor! My favourite.', 'You stepped on it. Of course you did.', 'Did you see the little holes? I did.'],
    rotten: ['Rotten. Should have checked the date.', 'That one was tired of you.', 'Hop off faster!', 'It just let go. Sad.'],
    falseFloor: ['That floor was a drawing.', 'Painted air!', 'Solid? Says who.', 'Never trust ground.'],
    invisBlock: ['Bonk. On nothing.', 'Mind the invisible ceiling.', 'There was something there. Obviously.'],
    runaway: ['The floor left.', 'It slid away. Rude.', 'Ground with commitment issues.'],
    lunger: ['That spike had legs.', 'Charge!', 'Surprise! It moves.'],
    spikeWall: ['Too slow.', 'The wall says hi.', 'Keep moving next time.'],
    shouting: ['The sign said so! Hehe.', 'You trusted a sign. I write the signs.', 'Wrong road!', 'Never trust a sign that yells.'],
    headache: ['Bonk.', 'Mind your head!', 'That block was a gift.', 'Ceiling delivery!'],
    secretFloor: ['Too wide to jump. Was it, though?', 'You could have just walked.', 'Some pits are shy.'],
    ceilSpike: ['Tap jump. Tiny hop. Not a rocket.', 'Let go of jump sooner. Hehe.', 'Short hop! Tap, do not hold.', 'You held jump. The ceiling noticed.'],
    saw: ['Bzzzt.', 'Saws do not cheat. They just spin.', 'Timing! Look it up.', 'Sliced.'],
    mimic: ['CHOMP.', 'That was not the exit. That was lunch.', 'Check the handle next time. Or don\'t.', 'Doors can be hungry.'],
    ceilingTeeth: ['Look up. Too late.', 'The ceiling has teeth. Fun fact.', 'You stopped. Under a tooth. Brave.'],
    shyLedge: ['It got shy.', 'The ledge said no.', 'Rejected by furniture.'],
    swapZone: ['Left. No, your other left.', 'Wrong way!', 'Your hands betrayed you.'],
    impatient: ['The floor got bored.', 'You waited. It didn\'t.', 'Standing still is a choice. A bad one.'],
    copycat: ['You were killed by you.', 'Your shadow says hi.', 'Never look back. Literally.']
  },
  fakeSave: ['Respawning at... oh. The start. Weird!', 'Did that flag say saved? Funny.', 'Checkpoints are more of a suggestion.'],
  trigger: {
    flee: ['Nope!', 'Not today!', 'Catch me!', 'Bye-bye!', 'Too slow!'],
    fleeLast: ['Okay okay. I am out of room.', 'Fine! I am cornered!'],
    crumble: ['Whoops.', 'Uh oh.', 'Platform three says bye.'],
    bonk: ['BONK.', 'Heads up!', 'Surprise ceiling!'],
    savedReal: ['...saved. Ugh.'],
    savedFake: ['Saved! Definitely saved!', 'Checkpoint! You are safe now!', 'Saved! Trust me!'],
    down: ['Hehe. Try SPACE.', 'That is not jumping. That is crouching at a wall.'],
    dodge: ['Eek!', 'Not that one!', 'Nope, sliding away!'],
    reveal: ['Bonk!', 'Oh, was that there?', 'Invisible! Hehe.'],
    lunge: ['GET HIM.', 'Charge!', 'Run, spike, run!'],
    wallWake: ['Do not stop. Seriously.', 'Something is coming.', 'The wall is awake.'],
    quake: ['Whoops.', 'Earthquake!', 'Was that me? Yes.'],
    swapOn: ['Wrong way!', 'Swirly!', 'Hehe. Left is right now.'],
    swapOff: ['Fine, back to normal.', 'Unswirled.'],
    shake: ['Feel that?', 'Rumble rumble.', 'The floor is getting impatient.'],
    wake: ['Something is following you.', 'Do not look behind you.', 'Your shadow is awake.'],
    idle: ['Waiting will not help. I am very patient.', 'Hello? I can wait forever. I am a loop.', 'Standing still is noted in your file.']
  },
  discover: {
    coldFeet: 'Hey. Hey! Doors do not hear jumping. Who told you that?',
    falseFloor: 'You jumped the fake floor. How did you even see it.',
    rotten: 'You hop off before they drop. That is not how rot works.',
    invisBlock: 'You jumped early. The invisible block is very embarrassed.',
    runaway: 'You faked out the floor. The floor feels silly now.',
    lunger: 'You jumped my spike. It was running for you.',
    spikeWall: 'You outran the wall. It is not even tired.',
    pinholes: 'You saw the holes. Nobody sees the holes.',
    shouting: 'You ignored my sign. That is so rude.',
    headache: 'You jumped early. That is cheating. MY thing is cheating.',
    secretFloor: 'Get off my secret floor.',
    backwardsFlag: 'Walking backwards into flags. Who raised you?',
    mimic: 'You read the handle. Nobody reads the handle.',
    ceilingTeeth: 'You did not even slow down. Rude.',
    shyLedge: 'You faked it out. Ledges have feelings, you know.',
    swapZone: 'You counted the swirls. Of course you did.',
    impatient: 'You stepped off. The floor is very disappointed.',
    copycat: 'You outran yourself. I do not know how to feel.'
  },
  win: {
    sweet: ['Yay! You did it!', 'Good job! That one was easy, though.', 'Nice! Level {n} done.'],
    smug: ['That one did not count.', 'Lucky.', 'Okay. Next one is worse.'],
    rattled: ['How? HOW?', 'I will remember that.', 'Stop it.'],
    unhinged: ['I am rewriting the next level right now.', 'You are reading my code, aren\'t you.', 'This is fine. This is fine.'],
    broken: ['...', 'again.', 'you again.']
  },
  allCracked: 'You know every single one. Fine. I will just use them all at once.',
  newRun: ['A new run! Same old me.', 'Starting over? I kept your file.']
};

SL.say = function (pool, vars) {
  const s = Array.isArray(pool) ? pool[Math.floor(Math.random() * pool.length)] : pool;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined) ? vars[k] : '');
};

})(typeof window !== 'undefined' ? window : globalThis);
