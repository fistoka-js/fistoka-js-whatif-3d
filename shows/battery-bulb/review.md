# Review: How does a battery really light a bulb?

- Topic: How does a battery light a bulb?
- Slug: battery-bulb
- Status: ok
- Show: first try
- Picture check (QA): not_run (QA ERROR: only 0.8 GB of memory is free; browser jobs need 2 GB. Close something and try again.)
- Voice: 51.4 s, 167 words
- Mode: files; model priced as claude-sonnet-5-5
- Written: 2026-11-17 04:21 UTC

## Script
Does a battery pour electricity into a bulb until it runs out? Not quite. Here is what really happens. Inside the battery, a chemical reaction pushes electrons toward one end. Connect a wire, and the electrons already sitting in the metal all start to shuffle forward at once. They creep along slowly, often less than a millimetre each second. But the push travels around the loop at close to the speed of light, so the bulb responds instantly. In the thin tungsten filament, the electrons must squeeze through a much narrower path. They bump into the atoms, and every bump shakes the atoms harder. The filament heats up to well over two thousand degrees Celsius. Hot metal glows, so the bulb lights. The electrons are not used up. They flow on back to the battery, carrying less energy. It is like a bicycle chain: every link moves together, and the energy is delivered at the wheel. So what else around you works like a loop? Comment below.

## Picture plan (the beat list that goes with the script above)
- S1: battery | the charge window drains as the battery empties | dial: charge
- S2: battery | the charge window refills and turns green | dial: charge
- S3: particles | electrons gather into a ring stream around the loop | dial: speed
- S4: particles | the electrons bunch together and drift toward one side | dial: speed
- S5: particles | the whole ring of electrons starts moving forward together | dial: speed
- S6: particles | the electrons slow to a gentle crawl | dial: speed
- S7: lightbulb | the bulb switches on and glows at once | dial: on
- S8: particles | the electron stream narrows and crowds together | dial: spread
- S9: particles | the crowded dots jitter more and more | dial: spread
- S10: lightbulb | the bulb glows brighter and warmer | dial: on
- S11: lightbulb | the bulb lights fully bright | dial: on
- S12: particles | the electron ring keeps circling and none disappear | dial: speed
- S13: particles | the electrons dim and stream back into the battery end | dial: speed
- S14: gear | the linked gears all turn together and drive the last gear
- S15: gear | the gears speed up and spin in a closed loop
- S16: gear | the gears slow and settle together

## Claims to check (tick each one you have verified)
- [ ] a battery uses a chemical reaction to push electrons
- [ ] electrons already in the wire move together when a circuit is closed
- [ ] electron drift speed is often under a millimetre per second
- [ ] the electrical push travels at close to the speed of light
- [ ] a tungsten filament is thin and resists the current
- [ ] electron collisions with atoms heat the filament
- [ ] a filament runs well over two thousand degrees Celsius
- [ ] hot metal glows
- [ ] electrons are not used up and return to the battery with less energy

## Automatic fact check (final audit)
- supported: A battery does not simply pour out electricity that is then used up. (Note: General knowledge, not in the research: a battery drives a current round a loop.)
- simplified: A chemical reaction in a battery pushes electrons toward one terminal. (Note: True in essence: the reaction builds up a voltage that drives electrons round the outside circuit.)
- supported: The electrons already in the wire all start moving together when the circuit is closed. (Note: General knowledge, not in the research.)
- supported: Electrons drift slowly, often less than a millimetre per second. (Note: Typical drift speeds in household-scale wires are well under a millimetre per second.)
- simplified: The electrical push travels round the loop at close to the speed of light. (Note: The signal travels at a large fraction of light speed in a wire, not exactly light speed.)
- simplified: The bulb responds almost instantly. (Note: Delay is far too small to notice.)
- supported: The tungsten filament is thin and gives the electrons a narrower path. (Note: General knowledge, not in the research.)
- simplified: Electrons collide with atoms and make the atoms vibrate more. (Note: This is the standard simple picture of resistive heating.)
- supported: The filament gets hotter than two thousand degrees Celsius. (Note: Incandescent filaments run at about 2500 degrees Celsius.)
- supported: Hot metal glows. (Note: Thermal radiation, general knowledge.)
- supported: Electrons are not used up and return to the battery with less energy. (Note: Charge is conserved in a loop; energy is given up in the bulb.)
- Redrafted: no

## Description
A battery does not pour electricity into a bulb. It pushes electrons already in the wire around a loop, and the thin filament heats until it glows.

#science #electricity #physics #howitworks #shorts

## Tags
battery, lightbulb, electricity, electrons, circuit, voltage, physics, science explained, how it works, filament, current

## How the show was made
- show: valid (0 warning(s))

## Cost (estimate)
| call | input | output | cache read | cache write | $ |
|---|---|---|---|---|---|
| script | 3601 | 1207 | 0 | 0 | 0.0193 |
| audit | 1182 | 699 | 0 | 0 | 0.0094 |
| show | 15631 | 1986 | 0 | 0 | 0.0511 |
| **total** | 20414 | 3892 | 0 | 0 | 0.0797 |

files mode: tokens are characters / 4, priced as claude-sonnet-5-5; nothing was paid.

## Files
review.md, script.txt, show.json, voice.mp3, voice.stats.json, words.json, writer.json, llm/ (every prompt and reply)

<!-- pipeline-run:start -->
## Pipeline run

- Topic: How does a battery light a bulb?
- Final video: `E:/Youtube Project/whatif-3d/shows/battery-bulb/out/battery-bulb-final.mp4`
- Length: 51.433333 s, loudness: -16 LUFS
- Picture check: **pass** (0 findings, see `out/qa.json` and `out/qa-sheet.jpg`)
- Writer status: ok
- Upload: not uploaded
<!-- pipeline-run:end -->
