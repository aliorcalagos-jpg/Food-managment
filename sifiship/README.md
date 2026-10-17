# SIFIship: Hangar Launch (prototype V.1)

A sci-fi take on the "bus jam" puzzle for Android phones. It has the same rules with a different theme.

**Install:** copy `dist/SIFIship-V.1.apk` to an Android 7+ phone, allow "install unknown apps" for your file manager or browser, and open the file. The game works offline and keeps its progress on the phone. It asks only for vibration.

## How it plays

- **Hangar grid (bottom):** ships packed in a grid, each with an arrow. Tap a ship to launch it the way its arrow points. If another ship is in the way, it bumps into it and the blocker flashes red.
- **Launch bays (middle):** a launched ship docks in one of **5 bays**. The badge under it shows how many shots it carries (4 for short ships, 6 for long ones).
- **Enemy wave (top):** saucers line up in order. A docked ship automatically shoots the **front** enemy when the colors match. When a ship runs out of shots it warps away and frees its bay.
- **Lose by jamming:** if all 5 bays hold ships that can't hit the front enemy, the hangar jams.
- **Lose by breach:** from sector 3 on, the wave slowly closes in (meter on the left). Every kill pushes it back. If it reaches the shield line, the shield bar drains.
- **Win:** destroy the whole wave. You get 1 to 3 stars: one for clearing, one for shield above 70%, and one for never using more than 3 bays at once.

## What keeps players going

| Moment | What happens |
|---|---|
| Chain launch | Quick launches in a row show `CHAIN xN` and give bonus points |
| Combo | Kills in quick succession raise the multiplier up to x5 |
| Near fail | Red alert vignette, alarm and vibration when the bays are nearly full with the wrong colors, or the wave is close |
| Boss sector | Every 10th sector has a mothership and a bigger wave |
| Progress | Sector number, stars per sector and best score are saved on the phone |
| Onboarding | Sectors 1 and 2 pulse the next good ship after 4 idle seconds |

The Android back button pauses the game, then resumes it. On the menu, back closes the app. The game also pauses when you leave the app.

## Levels

Levels are generated from the sector number, so the same sector is always the same, and every level is guaranteed to have a solution:

- Each ship is placed so it has a clear way out past the ships placed before it. Launching in reverse placement order therefore always works, and earlier ships end up blocked.
- The wave holds exactly the shots the ships carry. It is shuffled only as long as that solution still clears it using at most 2 bays (sectors 1–3), 3 bays (4–12) or 4 bays (later). The remaining bays are your room for mistakes.
- The grid grows from 5×6 to 7×9, colors from 3 to 6, and ships from 6 to about 20. The wave closes in faster in later sectors.

## Files

- `web/logic.js`: the rules and level generator. It has no DOM, so Node can test it.
- `web/game.js`, `web/index.html`: canvas drawing, touch input, effects, synthesized sounds and screens.
- `android/`: a small fullscreen portrait `WebView` app that serves `web/` from its assets.
- `test/logic.check.mjs`: checks that sectors 1–150 build and can be solved. Run `node --test sifiship/test/logic.check.mjs`.

## Build

`bash sifiship/build-apk.sh` runs the checks and writes `dist/SIFIship-V.1.apk`. You need the Debian/Ubuntu tools `aapt dalvik-exchange apksigner zipalign android-sdk-platform-23` and a JDK. The first build creates `android/sifiship.keystore`, which git ignores. Keep it: an update installs over an older version only if both are signed with the same key.

To try the game in a desktop browser, serve the folder and open it in phone-sized dev tools: `cd sifiship/web && python3 -m http.server`.
