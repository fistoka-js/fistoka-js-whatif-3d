# Review: What If Earth Suddenly Stopped Spinning?

- Topic: What if Earth stopped spinning?
- Slug: earth-stops-spinning
- Status: ok
- Show: first try
- Picture check (QA): pass
- Voice: 51.2 s, 175 words
- Mode: files; model priced as claude-sonnet-5-5
- Written: 2026-11-18 00:36 UTC

## Script
What if Earth suddenly stopped spinning? Many people imagine one calm, endless afternoon. Here is what really happens. Right now, the ground at the equator moves at about one thousand miles an hour. Stop the ground, and the air keeps going at that speed. The oceans keep sliding too, then surge toward the poles as the equator bulge fades. Dry land would rise near the equator, and new seas would swell near the poles. Now the Sun takes a year to cross the sky. So one side bakes in daylight for about six months. The other side freezes in darkness for the same time. It is like holding one side of a marshmallow over a fire. The spin also helps stir the liquid metal in Earth's core. That stirring makes our magnetic shield, so the shield would probably weaken. Then more harsh radiation from the Sun would reach the ground. Our daily spin gives us gentle days, steady air and a shield overhead. Would you rather live on the sunny side or the dark side?

## Picture plan (the beat list that goes with the script above)
- S1: planet | the planet's air glow thins and the lit and dark halves settle in place
- S2: planet | the air glow turns calm and bright across the lit half
- S3: planet | the air glow flares and turns stormy | dial: storm
- S4: planet | the air glow thickens and streams along the equator | dial: storm
- S5: particles | the air streams rush faster and spread out in one direction | dial: storm
- S6: planet | the air glow shifts and thickens toward the poles | dial: storm
- S7: planet | the air glow fades near the equator and swells near the poles | dial: storm
- S8: sun | the sun glows brighter and slows to a steady shine on one side | dial: heat
- S9: planet | the lit half glows hotter and its air glow brightens | dial: heat
- S10: planet | the dark half turns colder and its air glow vanishes | dial: heat
- S11: fire | the flames grow taller and glow hotter | dial: heat
- S12: planet | the air glow settles and the planet turns still
- S13: shield_dome | the dome's shimmer fades and thins | dial: shield
- S14: shield_dome | the dome grows fainter and more transparent | dial: shield
- S15: shield_dome | the dome shimmers strong again and fills out | dial: shield
- S16: planet | the lit half brightens while the dark half deepens | dial: heat

## Claims to check (tick each one you have verified)
- [ ] Ground at the equator moves at about one thousand miles an hour because of Earth's spin
- [ ] If the ground stopped suddenly, the air would keep moving at that speed
- [ ] The equatorial bulge would fade without spin, so oceans would flow toward the poles
- [ ] Without spin, the Sun would take a year to cross the sky, so day and night would each last about six months
- [ ] Earth's spin helps drive the liquid metal motion in the core that makes the magnetic field, so the field would probably weaken

## Automatic fact check (final audit)
- supported: Ground at the equator moves at about 1000 miles an hour (Note: Equatorial rotation speed is about 1,040 mph.)
- simplified: If the ground stopped, the air would keep moving at that speed (Note: Momentum would carry the air east; friction would slow it over time, but the initial effect is as stated.)
- simplified: Oceans would keep moving and then flow toward the poles as the equatorial bulge fades (Note: Without spin the centrifugal bulge goes and water redistributes poleward.)
- supported: Dry land would rise near the equator and new seas near the poles (Note: Widely cited consequence of the oceans moving poleward.)
- simplified: Without spin the Sun would take a year to cross the sky (Note: A day would last about a year, roughly six months of light then six of dark.)
- supported: One side would have about six months of daylight and the other about six months of darkness (Note: Follows from a day lasting a year; general knowledge.)
- supported: The dark side would freeze for the same time (Note: General knowledge.)
- simplified: Earth's spin helps stir the liquid metal in the core that makes the magnetic field (Note: Rotation organises core convection in the dynamo; widely accepted.)
- simplified: The magnetic field would probably weaken without spin (Note: Hedged with probably; the dynamo depends on rotation.)
- simplified: A weaker field would let more harsh solar radiation reach the ground (Note: Atmosphere also shields the ground, but more radiation would reach the surface overall.)
- Redrafted: no

## Description
What would really happen if Earth stopped spinning? Winds, oceans, a six-month day and a weaker magnetic shield, explained step by step with real physics.

#science #earth #whatif #space #physics

## Tags
earth stops spinning, what if earth stopped spinning, earth rotation, science explained, what if, planet earth, magnetic field, day and night, physics, space science

## How the show was made
- show: valid (1 warning(s))

## Checker warnings on the accepted show
- story.stillness: nothing on screen changes from 9.00 to 11.75 s (2.75 s; at most 3.5 s allowed, 2.5 s is better) while the narrator says "thousand miles an hour. Stop the ground, and the". Add a change in that stretch: a "set", "move", "scale", "color" or "glow" on a prop (give it "until": a later phrase so it runs from word to word), or a dial key there with the dial bound to a prop on screen. Camera moves, spin, bob, orbit, pulse, shake, labels and text do not count.

## Cost (estimate)
| call | input | output | cache read | cache write | $ |
|---|---|---|---|---|---|
| script | 3637 | 1245 | 0 | 0 | 0.0197 |
| audit | 1185 | 632 | 0 | 0 | 0.0087 |
| show | 16366 | 2597 | 0 | 0 | 0.0587 |
| **total** | 21188 | 4474 | 0 | 0 | 0.0871 |

files mode: tokens are characters / 4, priced as claude-sonnet-5-5; nothing was paid.

## Files
review.md, script.txt, show.json, voice.mp3, voice.stats.json, words.json, writer.json, llm/ (every prompt and reply)

<!-- pipeline-run:start -->
## Pipeline run

- Topic: What if Earth stopped spinning?
- Final video: `E:/Youtube Project/whatif-3d/shows/earth-stops-spinning/out/earth-stops-spinning-final.mp4`
- Length: 51.233333 s, loudness: -16 LUFS
- Picture check: **pass** (0 findings, see `out/qa.json` and `out/qa-sheet.jpg`)
- Writer status: ok
- Upload: not uploaded
<!-- pipeline-run:end -->
