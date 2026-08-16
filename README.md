# Don't Look Behind You

A minimalist 2D psychological horror / puzzle game. Something walks the halls. It **freezes whenever you look at it** — and the instant your eyes leave it, it moves again. Use your own vision as the only tool that keeps it still.

Built with **React + TypeScript + Vite** and a hand-rolled **HTML5 Canvas** engine. No images, no audio files — every wall, silhouette, fog bank, drone and heartbeat is generated procedurally at runtime.

## The Rule

> It only moves when you aren't looking.

- Your **vision cone** is the only light that matters. Walls and doors block it; so does the dark.
- The **Watcher** freezes whenever it is inside your vision cone. The moment it leaves (or you look away), it starts closing in.
- You move faster than it does. Not by much. Not for long.
- Mirrors count as looking. Use them. Fear them.

## Running

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

Production build (also emits the PWA service worker + manifest):

```bash
npm run build      # tsc -b && vite build
npm run preview    # serve the built dist/
```

Regenerate the install icons (only needed if the icon design changes):

```bash
node scripts/gen-icons.mjs
```

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / Arrows | Move |
| `Shift` | Sprint (drains stamina, makes noise) |
| `Ctrl` / `C` | Crouch (slow, near-silent) |
| Mouse | Look |
| `E` | Interact (keys, switches, levers, checkpoints) |
| `ESC` | Pause / resume |
| `F3` | Toggle debug overlay (FPS, positions, creature state, distance) |

**Every key is rebindable** in Settings → Controls.

**Mobile / touch:** the virtual joystick on the left aims your flashlight / facing direction (aligned at the same height as the movement keys), an on-screen **W/A/S/D D-pad** (bottom-right) moves you, and a tap on the right side interacts. Keyboard sprint/crouch remain desktop-only.

## Stamina & Composure

- **Sprint** is fast but loud — the Watcher can hear footsteps, and the noise carries further than you think.
- **Crouch** to move unheard. You crawl, but you can slip straight past it.
- Stamina drains while sprinting and refills while moving normally; once exhausted you must recover before sprinting again.
- A **graze** (the Watcher touching you) shatters your composure and knocks it back. Let it touch you too many times and it takes you.
- **Checkpoints** restore full composure, not just your position.

## The 8 Levels

1. **The Corridor** — Learn the core rule: a sensor door only opens while the creature is near it. Keep it in your sight or it will catch you.
2. **The Locked Door** — Find the key, keep it in view, unlock your way out.
3. **The Pressure Plate** — Two plates. One is for you. The other is for it — and it only steps on things when you aren't looking.
4. **The Dark Room** — Vision shrinks. Feed a battery to the generator and light the path out.
5. **Two Doors** — Two creature-triggered plates. One door latches, the other is timed. Precision placement matters.
6. **Mirror Room** — A mirror lets you watch it while your back is turned — and a door only opens while it is visible in the reflection.
7. **The Long Hall** — Faster creature, longer hall, three checkpoint lights. Stun it under a spotlight if you can.
8. **The Watcher** — Not a fight. Let it block the laser, let it press the plate, then stand in the light of the exit and **do not look away** until it opens.

## Architecture

```
src/
├── main.tsx / App.tsx        # React shell: screen state, save wiring, overlays
├── components/               # Menu, pause, settings, intros, death, victory UI
├── styles/global.css         # Dark theme + overlay styling
├── types/index.ts            # Shared contracts (GameObject union, LevelData, SaveData…)
├── levels/                   # 8 handcrafted, validated ASCII-map levels
├── game/
│   ├── Game.ts               # Orchestrator: state machine, vision, interactions, level logic
│   ├── Creature.ts           # Watcher AI state machine + steering
│   ├── Pathfinding.ts        # Grid A* with dynamic blocking (doors, lasers)
│   ├── Lighting.ts           # Vision polygon, darkness compositing, fog, vignette
│   ├── Renderer.ts           # All procedural drawing
│   ├── AudioManager.ts       # Procedural Web Audio: music layers, heartbeat, SFX
│   ├── LevelManager.ts       # ASCII map parser → LevelData, per-object overrides
│   ├── Achievements.ts       # Achievement registry
│   ├── Player.ts / Input.ts / Camera.ts / Collision.ts / ParticleSystem.ts / SaveManager.ts
└── scripts/gen-levels.mjs    # Map generator + BFS connectivity validator
└── scripts/gen-icons.mjs     # PWA icon generator (pure Node, no deps)
```

### Key design points

- **Vision**: a raycast-sampled polygon (radius + angle + LOS against walls) is punched out of a darkness canvas with `destination-out` compositing — not a black circle. When the Watcher is near or your composure is low, the vision cone **tunnels inward**.
- **Watcher AI**: `IDLE → VISIBLE → HIDDEN → CHASE → SEARCH → ATTACK → STUNNED`. It only paths toward you when unseen; a short reaction delay prevents teleport-glitch behaviour; distance tiers drive audio intensity and attack timing. When it cannot sense you it **prowls** its level's waypoint route instead of standing still. It senses you by hard proximity and by the **noise** you make — crouch to hide, sprint to be heard across the room. Pressure plates clatter loudly and give you away.
- **Pathfinding**: A* over a 48px grid; closed doors and active (unblocked) lasers are added as dynamic blockers so the creature respects the current puzzle state.
- **Levels are data**: ASCII maps define walls and object placement; a `overrides` map configures per-object behaviour (door sources, plate requirements, mirror faces, laser targets); a `prowl` route defines the creature's patrol waypoints. Adding a level is just another file in `src/levels/`.
- **Death**: a fade and a brief reveal with a reason, then respawn at your last checkpoint with the level's puzzle state reset. First contact is a graze that costs composure and knocks the Watcher back; the kill comes only when your composure is broken.
- **Atmosphere**: layered music (ambient → tension → danger → critical), an extra **presence layer** that swells only while the Watcher is visible, distance/pan-positioned SFX (footsteps, knocking, whispers, buzz, screams, growls), procedural fog, light flicker, camera bob, screen shake, and a CSS glitch filter driven by danger level. A heartbeat starts when it gets close. Random environmental events raise tension but never cause unavoidable deaths.
- **Performance**: the static floor layer (per-tile shading, grime, cracks, wall-contact shadows) is pre-rendered to an offscreen cache per level, so each frame only redraws dynamic geometry.

## Achievements

Seven achievements track daring play — escaping unseen, never being grazed, reading every note, sprinting a level in under a minute, and more. Unlock toasts appear in-game; the full list lives in the main menu.

## Save & Settings

Progress, sound/music volumes, and display preferences persist in `localStorage` (`dlby_save_v1`, `dlby_settings_v1`). The main menu offers **PLAY** (new game), **CONTINUE**, **LEVELS**, **ACHIEVEMENTS**, **SETTINGS** (volumes, screen shake, particles, distortion, high contrast, reduce-flicker, reduce-motion, colorblind shapes, key rebinding, reset progress), **HOW TO PLAY**, and **CREDITS**.

**Accessibility:**
- **Reduce motion** — disables camera bob and screen shake.
- **Colorblind shapes** — interactables gain distinct shapes (triangles, diamonds, raised blocks) so color is never the only signal.
- **Reduce flicker** — dampens light flicker and strobes.
- **Key rebinding** — every action accepts one or more keys.
- **PWA** — installable and playable offline via the generated service worker.

## Credits

- **Design & code** — procedural browser game built with React, TypeScript and the Canvas 2D API.
- **Art** — 100% drawn at runtime. No image assets.
- **Sound** — synthesized with the Web Audio API. No audio files.
- **Inspired by** the timeless playground rule: *it only moves when you aren't looking.*
