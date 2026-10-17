# SIFIship: Hangar Launch (V.2)

A sci-fi take on the "bus jam" puzzle for Android phones. It has the same rules with a different theme.

**Install:** copy `dist/SIFIship-V.2.apk` to an Android 7+ phone, allow "install unknown apps" for your file manager or browser, and open the file. V.2 installs over V.1 and keeps your progress. The game works offline and keeps its progress on the phone. It asks only for vibration.

## How it plays

- **Hangar grid (bottom):** rockets packed in a grid, each with an arrow. Tap a rocket to launch it the way its arrow points. If another rocket is in the way, it bumps into it and the blocker flashes red. Rockets of the color the wave needs next have a soft glow underneath (the glow says nothing about whether they are free).
- **Launch bays (middle):** a launched rocket docks in one of **5 bays**. The badge under it shows its shots: 4 for short rockets, 6 for long ones and 8 for 4-cell cruisers. A sixth bay is locked and opens with the +1 Bay booster.
- **Enemy wave (top):** saucers line up in order. A docked rocket automatically shoots the **front** enemy when the colors match. When a rocket runs out of shots it warps away and frees its bay.
- **Lose by jamming:** if every bay holds a rocket that can't hit the front enemy, the hangar jams. You can rescue the run with +1 Bay or Undo instead of restarting.
- **Lose by breach:** from sector 3 on, the wave closes in (meter on the left). Every kill pushes it back. If it reaches the shield line, the shield bar drains.
- **Win:** destroy the whole wave. You get 1 to 3 stars: one for clearing, one for shield above 70%, and one for never using more than 3 bays at once.

## Boosters

| Booster | What it does |
|---|---|
| **+1 Bay** | Opens the locked sixth bay for the rest of the sector. You can also tap the 🔒 bay. |
| **Undo** | Sends the last launched rocket back to the hangar, if it hasn't fired yet. |
| **Radar** | Highlights a free rocket whose color the wave needs soonest. |

You start with 2 / 3 / 3. You earn more once per sector:
- one booster for the first 3-star clear of a sector,
- one of each for the first clear of a boss sector,
- one Radar for the first clear of every 5th sector.

## What keeps players going

| Moment | What happens |
|---|---|
| Chain launch | Quick launches in a row show `CHAIN xN` and give bonus points |
| Combo | Kills in quick succession raise the multiplier up to x5 |
| Near fail | Red alert vignette, alarm and vibration; the locked bay glows if you have a +1 Bay to spend |
| Boss sector | Every 10th sector (☠ on the map) is the peak of its block, with a mothership |
| Pilot rank | All stars earned add up to a rank: Cadet → Pilot (10★) → Ace (25) → Captain (50) → Commander (90) → Admiral (150) → Legend (240). The menu and win screen show the bar to the next rank. |
| Sector map | Every sector with its stars, so you can replay any of them for 3 stars |
| Onboarding | Sector 1 frames the rocket to tap. Sectors 1–2 frame a good rocket after 4 idle seconds. |

The Android back button pauses the game, then resumes it. On the menu, back closes the app. The game also pauses when you leave the app.

## The difficulty curve

Each sector's layout is generated from its number, so the same sector is always the same. Every sector is guaranteed to have a solution.

**Growth:** `t = 1 − e^(−(n−1)/18)`. It rises fast early and flattens out: about 0.4 at sector 10, 0.65 at 20 and 0.9 at 40. New players climb quickly, and veterans meet a steady ceiling.

**Swing:** `e = t + cycle[(n−1) mod 5]`, with `cycle = [0, +0.05, +0.10, +0.18, −0.08]`, plus 0.25 on every 10th (boss) sector. Four sectors build tension, the fifth is a breather, and every boss is the hardest sector of its block.

| What | Formula | Range |
|---|---|---|
| Grid | `5 + round(3t)` × `6 + round(4t)` | 5×6 → 8×10 |
| Colors | `3 + floor(5t)` | 3 → 6 |
| Hangar covered | `55% + 27%·e` | 55% → 82% |
| Rockets blocked at start | `30% + 35%·e` (none in sector 1) | — |
| Chain bias | `0.3 + 0.6·e` | — |
| Bays the solution needs | 2 if `e < 0.3`, 3 if `e < 0.7`, else 4 | margin 3 → 1 |
| Thinking time per rocket | `4.5 − 2.3·e` seconds | — |

**Chain bias:** the chance that each placement picks the spots blocking the most rockets already placed. This builds long launch-order chains instead of scattered single blocks.

**Rockets per sector:** about 7 in sector 1, about 15 by sector 10 and 22–28 from sector 30. The cap is about 82% coverage: past that, interior gaps would have no rocket left that can ever fly out.

**Placement:** each rocket must have a clear way out past the rockets placed before it. Launching in reverse placement order therefore always works.

**The wave:** it holds exactly the shots the rockets carry. It is shuffled only as long as that solution still clears it within the bay budget.

**Wave pressure:** kills push the wave back by 0.6 in total over the sector. Closing in adds 1.45 over the expected play time (rockets × thinking time). A player at that pace finishes with the wave near 85% of the way to the shield. A faster player has room to spare, and a slower one breaches.

## Files

- `web/logic.js`: the rules, difficulty curve, level generator and Radar logic. It has no DOM, so Node can test it.
- `web/game.js`, `web/index.html`: canvas drawing, touch input, effects, synthesized sounds, boosters, ranks, sector map and screens.
- `android/`: a small fullscreen portrait `WebView` app that serves `web/` from its assets.
- `test/logic.check.mjs`: checks that sectors 1–150 build and can be solved, that the curve grows, and that Radar picks correctly. Run `node --test sifiship/test/logic.check.mjs`.

## Build

`bash sifiship/build-apk.sh` runs the checks and writes `dist/SIFIship-V.2.apk`. You need the Debian/Ubuntu tools `aapt dalvik-exchange apksigner zipalign android-sdk-platform-23` and a JDK. The first build creates `android/sifiship.keystore`, which git ignores. Keep it: an update installs over an older version only if both are signed with the same key.

To try the game in a desktop browser, serve the folder and open it in phone-sized dev tools: `cd sifiship/web && python3 -m http.server`.
