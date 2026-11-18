# Review: How Does a Battery Really Light a Bulb?

- Topic: How does a battery light a bulb?
- Slug: battery-bulb
- Status: ok
- Show: repaired 2 time(s)
- Picture check (QA): warn
- Voice: 52.5 s, 169 words (shortened once (7 words asked))
- Mode: files; model priced as claude-sonnet-5-5
- Written: 2026-11-18 00:18 UTC

## Script
What if a battery poured electricity into a bulb until it ran out? Here is what really happens. The wire is already full of tiny electrons, even before you connect anything. Close the loop, and the battery starts pushing electrons out of its negative end. Every electron shoves the next, so the whole line creeps slowly around the loop. But the push arrives almost instantly, so the bulb lights as soon as you connect. Inside the bulb, the electrons must squeeze through a hair-thin filament. It is so narrow that they crash into its atoms, again and again. Each crash shakes the atoms harder, heating the filament past two thousand degrees Celsius. Hot metal glows, and that glow is the light you see. Think of a bicycle chain. Pedal at one end, and the wheel at the other turns, while each link only goes round. The battery is the pedal, and the bulb is the wheel. Break the loop anywhere, and the glow dies. Which part surprised you most?

## Picture plan (the beat list that goes with the script above)
- S1: battery | the charge window slowly drains lower | dial: charge
- S2: lightbulb | the bulb lights up warm and bright | dial: current
- S3: particles | glowing electrons fill the whole length of the wire evenly | dial: spread
- S4: particles | the electrons start streaming away from the battery end | dial: current
- S5: particles | the whole line of electrons shifts forward together at a slow crawl | dial: current
- S6: lightbulb | the bulb switches on at once | dial: current
- S7: lightbulb | the filament starts to glow dull orange | dial: heat
- S8: lightbulb | the filament glow flickers brighter with hot spots | dial: heat
- S9: lightbulb | the filament turns from orange to white-hot | dial: heat
- S10: lightbulb | the whole glass fills with bright warm light | dial: heat
- S11: gear | the linked gears start to turn together | dial: speed
- S12: gear | the far gear speeds up to match the first | dial: speed
- S13: gear | the gears turn faster and faster together | dial: speed
- S14: lightbulb | the light fades out and the bulb goes dark | dial: current
- S15: lightbulb | the bulb flickers back on to a soft glow | dial: current

## Claims to check (tick each one you have verified)
- [ ] A wire is already full of electrons before a battery is connected
- [ ] A battery pushes electrons out of its negative end around a closed loop
- [ ] Electrons drift slowly through a wire
- [ ] The push through the wire arrives almost instantly
- [ ] A bulb filament is very thin and resists the flow, so electrons collide with its atoms
- [ ] Collisions heat a tungsten filament past two thousand degrees Celsius
- [ ] Hot metal glows, producing the light
- [ ] Breaking the circuit anywhere stops the current and the bulb goes dark

## Automatic fact check (final audit)
- supported: A wire is already full of electrons before a battery is connected (Note: Metals contain free electrons throughout; general knowledge, not in the research.)
- supported: A battery pushes electrons out of its negative end around a closed loop (Note: Electrons leave the negative terminal in a closed circuit.)
- simplified: Electrons push each other so the whole line moves slowly together (Note: Drift is slow and the whole charge flow starts together, a fair simplification.)
- supported: The push through the wire arrives almost instantly (Note: The electric field spreads at a large fraction of light speed.)
- simplified: The bulb filament is very thin (Note: Filaments are around a hair's width or finer.)
- simplified: Electrons collide with the filament's atoms (Note: Resistance is scattering of electrons off the lattice, shown here as crashes.)
- supported: The collisions heat the filament past two thousand degrees Celsius (Note: Tungsten filaments run at roughly 2500 degrees Celsius.)
- supported: Hot metal glows and this is the light of the bulb (Note: Incandescent glow is thermal radiation.)
- supported: Breaking the circuit anywhere stops the bulb (Note: An open circuit carries no current.)
- Redrafted: no

## Description
A battery does not pour electricity into a bulb. It pushes electrons that are already in the wire around a loop, and the thin filament heats until it glows. See how it works in under a minute.

#science #physics #electricity #shorts

## Tags
battery, lightbulb, how does a battery work, electricity, electrons, circuit, filament, physics, science explained, science shorts

## How the show was made
- show: 8 validator error(s), 0 story problem(s)
- repair1: 1 validator error(s), 0 story problem(s)
- repair2: valid (0 warning(s))

## Picture check findings
- WARN shot "chain" at 42.321 s: the subject is too small: visible props cover only 4% of the frame Fix: raise the props' "size" or use "framing": "close" in the shot's camera; list only the props that matter under "focus".
- WARN shot "pedal-wheel" at 46.835 s: the subject is too small: visible props cover only 4% of the frame Fix: raise the props' "size" or use "framing": "close" in the shot's camera; list only the props that matter under "focus".

## Cost (estimate)
| call | input | output | cache read | cache write | $ |
|---|---|---|---|---|---|
| script | 3637 | 1259 | 0 | 0 | 0.0199 |
| audit | 1194 | 634 | 0 | 0 | 0.0087 |
| shorten | 4027 | 1043 | 0 | 0 | 0.0185 |
| audit-shorten | 1182 | 544 | 0 | 0 | 0.0078 |
| show | 16313 | 2108 | 0 | 0 | 0.0537 |
| repair1 | 18815 | 2136 | 0 | 0 | 0.0590 |
| repair2 | 18746 | 2133 | 0 | 0 | 0.0588 |
| **total** | 63914 | 9857 | 0 | 0 | 0.2264 |

files mode: tokens are characters / 4, priced as claude-sonnet-5-5; nothing was paid.

## Files
review.md, script.txt, show.json, voice.mp3, voice.stats.json, words.json, writer.json, llm/ (every prompt and reply)

<!-- pipeline-run:start -->
## Pipeline run

- Topic: How does a battery light a bulb?
- Final video: `E:/Youtube Project/whatif-3d/shows/battery-bulb/out/battery-bulb-final.mp4`
- Length: 52.566667 s, loudness: -16 LUFS
- Picture check: **warn** (2 findings, see `out/qa.json` and `out/qa-sheet.jpg`)
- Writer status: ok
- Upload: not uploaded
<!-- pipeline-run:end -->
