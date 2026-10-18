# SIFIship: Hangar Launch (V.5)

A sci-fi take on the "bus jam" puzzle for Android phones. It has the same rules with a different theme.

**Install:** copy `dist/SIFIship-V.5.apk` to an Android 7+ phone, allow "install unknown apps" for your file manager or browser, and open the file. V.5 installs over V.1–V.4 and keeps your progress; stars you already earned are credited as XP once. The game works offline and keeps its progress on the phone. It asks only for vibration.

## How it plays

- **Hangar grid (bottom):** a dense hangar of about 60 rockets from sector 1 (up to ~74 later), each showing its direction with chevrons. Tap a rocket to launch it the way its chevrons point. If another rocket is in the way, it bumps into it and the blocker flashes red. Rockets of the color the wave needs next have a soft glow underneath (the glow says nothing about whether they are free).
- **Launch bays (middle):** a launched rocket docks in one of **5 bays**. The badge under it shows its shots: 3 for short rockets, 4 for long ones and 6 for 4-cell cruisers. A sixth bay is locked and opens with the +1 Bay booster.
- **Enemy wave (top):** saucers line up in order. A docked rocket automatically shoots the **front** enemy when the colors match. When a rocket runs out of shots it warps away and frees its bay.
- **Lose by jamming:** if every bay holds a rocket that can't hit the front enemy, the hangar jams. You can rescue the run with +1 Bay or Undo instead of restarting.
- **Lose by breach:** from sector 3 on, the wave closes in (meter on the left). Every kill pushes it back. If it reaches the shield line, the shield bar drains.
- **Win:** destroy the whole wave. You get 1 to 3 stars: one for clearing, one for shield above 70%, and one for never using more than 3 bays at once.

## Direction chevrons and hold-to-aim

- **Chevrons:** a rocket's direction is shown by chevrons drawn live on its hull, no longer printed into the sprite.
  - **Ready** (nothing between its nose and the hangar edge): three glowing white chevrons with a light pulse running toward the nose.
  - **Blocked:** two dark chevrons with a bright rim, so the direction still reads on any hull color.

  With 60+ rockets you see at a glance which ones can fly, and the puzzle becomes the order and the colors.
- **Ignition:** when a launch clears the way for other rockets, their chevrons ignite with a flash and a chime. A bigger cascade gets a brighter chime.
- **Hold to aim:**
  - Hold a rocket for about a quarter second to project its flight path to the hangar edge.
  - Green means clear ("CLEAR · RELEASE TO LAUNCH"). Otherwise the path turns red at the first blocker, every rocket in the way is outlined and numbered in order, and the label says "BLOCKED BY n".
  - Release on the rocket to launch, or slide off it to cancel.
  - A quick tap still launches, now on release, so a tap and a hold can be told apart.

## Warp storms and the golden rocket

- **Warp storms (from sector 3):** a meter above the hangar counts launches down to the next storm (every `round(12 − 5·e)` launches: 11 early, 7 at the top). It counts launches, not seconds, so it pressures your plan, not your reflexes. When it strikes, the rockets left in the hangar flip to new colors in a ripple from the center, and the saucers still to come flip with them.
- **Always winnable:** colors only swap between rockets of the same length, so each color keeps the same shots. The rest of the wave is then re-formed for the new colors with the same method as the level generator, so a launch plan that clears the sector from the pads as they are always exists. `warpStorm` in `web/logic.js` builds it, and `test/logic.check.mjs` checks it. The playtest also checks after every launch that the wave left equals the shots on the pads plus those in the hangar.
- **Golden rocket:** one rocket per sector glows gold with a spinning star, preferably a blocked one, so reaching it takes a plan. Launching it pays +500 score and +40 XP. Each storm moves the gold to another rocket.

## Boosters

| Booster | What it does |
|---|---|
| **+1 Pad** | Opens the locked sixth pad for the rest of the sector. You can also tap the 🔒 pad. |
| **Undo** | Sends the last launched rocket back to the hangar, if it hasn't fired yet. |
| **Shuffle** | A storm on your terms: of several valid shuffles it keeps the one that leaves the most free rockets in the colors the wave needs first. It doesn't move the storm meter. |
| **Radar** | Highlights a free rocket whose color the wave needs soonest. |

You start with 2 +1 Pad, 3 Undo, 2 Shuffle and 3 Radar. You earn more by leveling up: one per level (Radar, Shuffle, Undo, +1 Pad in turn), and one of each extra every 5th level. A jammed run can also be rescued with +1 Pad or Undo from the "Hangar jammed" screen.

## Pilot level, ranks and hulls

Every sector pays **XP** into a pilot level (`web/progress.js`):

- XP to go from level L to L+1 is `100 + 150·(L−1)^1.3`: 100, 250, 469, 729, 1009 … 2710 at level 10. Early levels come after about one sector each; by level 10 a level takes about five sectors, so a bar is always close to filling.
- A win pays `100 + 8·sector`, plus 40 per star, half the base again on a first clear, 150 for a boss and 10 × the best combo. All of that is multiplied by the **win streak**: ×1.1 per win in a row, up to ×1.5.
- A loss still banks XP for the share of the wave destroyed. Leaving the loss ends the streak; rescuing the run with a booster keeps it.
- Each level gives a booster (rotating), and every 5th level one of each extra.
- **Ranks:** Cadet → Pilot (Lv 3) → Ace (6) → Captain (10) → Commander (16) → Admiral (25) → Legend (40).
- **Hulls**, picked in the Hangar screen: Interceptor, Falcon (Lv 3), Phantom (Lv 6), Titan (Lv 10), Nova (Lv 16). They change how your whole squadron looks.

The win screen plays out in steps: stars pop in one by one, the score counts up, the XP breakdown appears, and the bar fills and rolls over each level gained. Each new level then gets its own level-up screen with its reward cards and any new hull.

## What keeps players going

| Moment | What happens |
|---|---|
| Sector intro | Rockets drop into the hangar row by row under a "SECTOR n · rockets · colors" banner |
| Chain launch | Quick launches in a row show `CHAIN xN` and give bonus points |
| Combo | Kills in quick succession raise the multiplier up to x5 |
| Near fail | Red alert vignette, alarm and vibration; the locked pad glows if you have an extra pad to spend |
| Boss sector | Every 10th sector (☠ on the map) is the peak of its block, with a mothership |
| Sector map | A path of planets you climb, with stars per sector; any cleared sector can be replayed |
| Onboarding | Sector 1 frames the rocket to tap. Sectors 1–2 frame a good rocket after 4 idle seconds. |

## Look and motion

- Rockets, saucers, landing pads, the steel-plate hangar floor and the nebula-and-planet backdrop are painted once into cached sprites (`web/render.js`) with metal shading, specular streaks, glass canopies, glowing engines and soft drop shadows, so 70 rockets draw cheaply on a phone.
- A tap squashes the rocket for a moment, then it burns out the way its chevrons point, with an engine trail. It banks along a curve to its pad, lands with a spring settle and turns to aim at each saucer it shoots.
- A blocked rocket surges forward, hits the blocker (sparks, the blocker wobbles and flashes) and springs back.
- Saucers explode with a flash, a shockwave, sparks and debris. An empty rocket warps out upward.
- Type: Orbitron and Exo 2, bundled (SIL Open Font License, see `web/fonts/`), so the game needs no internet.

## The difficulty curve

Each sector's layout is generated from its number, so the same sector is always the same. Every sector is guaranteed to have a solution.

**Growth:** `t = 1 − e^(−(n−1)/18)`. It rises fast early and flattens out: about 0.4 at sector 10, 0.65 at 20 and 0.9 at 40. New players climb quickly, and veterans meet a steady ceiling.

**Swing:** `e = t + cycle[(n−1) mod 5]`, with `cycle = [0, +0.05, +0.10, +0.18, −0.08]`, plus 0.25 on every 10th (boss) sector. Four sectors build tension, the fifth is a breather, and every boss is the hardest sector of its block.

| What | Formula | Range |
|---|---|---|
| Grid | `12 + round(t)` × `15 + round(t)` | 12×15 → 13×16 |
| Colors | `3 + floor(6t)` | 3 → 6 |
| Hangar covered | `72% + 4%·e` | 72% → 76% |
| Fewest rockets | `60 + 6t` | 60 → 66 |
| Rockets blocked at start | `25% + 30%·e` | — |
| Chain bias | `0.1 + 0.8·e` | — |
| Bays the solution needs | 2 if `e < 0.3`, 3 if `e < 0.7`, else 4 | margin 3 → 1 |
| Thinking time per rocket | `3.2 − 1.4·e` seconds | — |

**Chain bias:** the chance that each placement picks the spots blocking the most rockets already placed. This builds long launch-order chains instead of scattered single blocks.

**Rockets per sector:** about 60 in sector 1, 63–74 later. Coverage tops out near 76% on a grid this size: past that, interior gaps would have no rocket left that can ever fly out.

**Placement:** each rocket must have a clear way out past the rockets placed before it. Launching in reverse placement order therefore always works.

**The wave:** it holds exactly the shots the rockets carry. It is shuffled only as long as that solution still clears it within the bay budget.

**Wave pressure:** kills push the wave back by 0.6 in total over the sector. Closing in adds 1.45 over the expected play time (rockets × thinking time). A player at that pace finishes with the wave near 85% of the way to the shield. A faster player has room to spare, and a slower one breaches.

## Files

- `web/logic.js`: the rules, difficulty curve, level generator and Radar logic. It has no DOM, so Node can test it.
- `web/game.js`, `web/index.html`: game loop, motion, touch input, boosters, HUD, sector map, hangar and screens.
- `web/render.js`: the sprite painter (rockets, saucers, pads, hangar floor, backdrop). `web/progress.js`: XP, levels, ranks, rewards, hulls. `web/audio.js`: synthesized sound and haptics.
- `android/`: a small fullscreen portrait `WebView` app that serves `web/` from its assets.
- `test/logic.check.mjs`, `test/progress.check.mjs`: check that sectors 1–80 build with about 60+ rockets and can be solved, that the curve grows, that Radar picks correctly, and the XP, level, reward and unlock math. Run `cd sifiship && npm test`.

## Build

`bash sifiship/build-apk.sh` runs the checks and writes `dist/SIFIship-V.5.apk`. You need the Debian/Ubuntu tools `aapt dalvik-exchange apksigner zipalign android-sdk-platform-23` and a JDK. The first build creates `android/sifiship.keystore`, which git ignores. Keep it: an update installs over an older version only if both are signed with the same key.

To try the game in a desktop browser, serve the folder and open it in phone-sized dev tools: `cd sifiship/web && python3 -m http.server`.
