# Sore Loser

A cute little browser platformer that cheats. The exit runs away, signs lie, spikes are fake,
platforms drop and checkpoints pretend to save. Every cheat follows a hidden rule that never
changes, so you can learn it and beat it. Levels are endless and generated from a seed.

## Run locally

Open `index.html` in a browser, or serve the folder (`python3 -m http.server`). No build step, no dependencies.

Controls: arrows or A/D to move, Space / Up / W / Z to jump, R restart, C Cheat Sheet, Esc pause. Touch buttons on phones.

## Package for itch.io

```
./build-itch.sh
```

Upload `dist/sore-loser.zip` as an HTML project and tick "This file will be played in the browser".

## How it works

- **Level generator** (`js/core.js`): builds each level left to right from segments that stay inside the
  player's jump range, then a validator checks there is a route to every spot the exit can flee to.
  Level `n` of a run is always the same for the same seed.
- **Cheats** (18): Cold Feet, False Floor, Rotten Platforms, Pinholes, Mimic, Invisible Block, Shouting Signs,
  Ceiling Teeth, Runaway Floor, Headache Block, Lunging Spike, Shy Ledge, Secret Floor, Wrong Way, Impatient Floor,
  Backwards Flag, Copycat, Spike Wall. Rules are in `SL.CHEATS`.
- **Difficulty modes** (`SL.DIFFS`): Normal (tells fade as levels rise), Hard (faint tells, +1 cheat, layouts one
  tier meaner), Rage (no tells at all, +2 cheats, layouts two tiers meaner, signs drop their punctuation).
- **Twists** (`SL.TWISTS`): from level 6 a level may get ice, lights out, low gravity, fast forward, earthquake or
  (late) a mirrored screen.
- **Hazards**: spike-bed pits, sawblades, hanging-spike ceilings and corridors that need a short hop, single-block
  stairs, 1-wide pillars, and 5-tile gaps that need an edge jump. Pinholes, cracks, false floors, invisible blocks
  and lunging spikes are also hidden in ordinary terrain.
- **Difficulty curve**: level 1 one cheat, 2-5 two, 6-15 two or three, 16-30 three, 31-50 three or four,
  51+ four or five (plus the mode bonus). New cheats are introduced one per level. Respawn is instant.
- **Mobile**: multi-touch controls (slide a finger between buttons), a zoomed-in view when held upright, corner
  controls in landscape, fullscreen and landscape lock on Play where the browser allows. `?touch=1` forces touch UI.
- **Behaviour tracking, no AI** (`js/profile.js`): counts jumps, standing still, sign trust, checkpoint use and
  death causes. The Cheat Director weights cheats by those habits. The Dossier screen shows what it sees.
- **Cheat Sheet**: a cheat is "spotted" when it triggers on you and "cracked" when you beat it on purpose.
- `js/game.js` physics and cheat logic, `js/render.js` canvas art, `js/voice.js` what the game says,
  `js/audio.js` synthesized sound, `js/main.js` UI, saving and the loop.

Saves use `localStorage` key `soreloser_v1`.

## Checks

```
node tools/check.js [levels]
```

Builds hundreds of levels across seeds and tiers, validates routes and runs a random bot through each.

## Credits

Fonts: Fredoka and DM Mono, SIL Open Font License (`fonts/OFL-*.txt`).
