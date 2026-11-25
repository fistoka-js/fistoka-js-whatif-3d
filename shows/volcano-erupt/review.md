# Review: Why do volcanoes really erupt?

- Topic: Why do volcanoes erupt?
- Slug: volcano-erupt
- Status: ok
- Show: first try
- Picture check (QA): warn
- Voice: 52.94 s, 185 words
- Mode: files; model priced as claude-sonnet-5-5
- Written: 2026-11-24 07:40 UTC

## Script
Why do volcanoes erupt? A volcano erupts when trapped magma and gas push harder than the rock above can hold. Here is what really happens. Deep below the cone, a chamber of rock slowly fills with glowing magma. Down there the heat is about one thousand degrees Celsius, hot enough to melt rock. Melted rock is lighter than solid rock, so it starts to rise. As the chamber fills, the pressure climbs and the walls squeeze tighter. The magma also holds dissolved gas, locked in like the fizz in a bottle. Higher up, the pressure drops, so the gas forms bubbles that swell and shove the magma up a narrow pipe. Think of a pressure cooker, where the needle keeps climbing until the lid gives way. When pressure beats the rock's strength, the pipe blows open. Magma, ash and gas burst out and spray high into the sky. Once the gas escapes, the pressure drops and the eruption slowly fades. These eruptions also build new islands and feed the soil with minerals. Which surprises you more, the heat or the gas? Comment your answer below.

## Picture plan (the beat list that goes with the script above)
- S1: magma_chamber | the chamber glows a little and a first bubble rises in the pipe | dial: fill
- S2: magma_chamber | the magma level climbs and the chamber glows brighter under the rock | dial: fill
- S3: magma_chamber | the cutaway reveals the glowing chamber deep under the cone | dial: fill
- S4: magma_chamber | the chamber fills with more and more glowing magma | dial: fill
- S5: magma_chamber | the magma turns from dull red to bright orange-yellow | dial: heat
- S6: magma_chamber | the magma level rises and bubbles lift up the pipe | dial: fill
- S7: magma_chamber | the chamber fills to the top and glows hotter | dial: pressure
- S8: magma_chamber | tiny bubbles appear inside the magma and multiply | dial: pressure
- S9: magma_chamber | bubbles swell and the magma is pushed up the pipe toward the crater | dial: pressure
- S10: gauge | the needle swings from green up into the red zone | dial: pressure
- S11: magma_chamber | the top of the pipe cracks open and the first eruption flares | dial: pressure
- S12: magma_chamber | the eruption spray shoots high above the crater | dial: pressure
- S13: magma_chamber | the spray dies down and the magma level and glow sink | dial: pressure
- S14: magma_chamber | the cone grows taller as the cooled magma glow fades to dark rock | dial: pressure
- S15: magma_chamber | the chamber glows hot again and bubbles start to rise | dial: pressure
- S16: magma_chamber | the chamber fills and glows brighter again as bubbles rise | dial: pressure

## Storyboard (see storyboard.md)
- Reviewer verdict: pass, after 0 repair round(s)
- storyboard: review pass (2 point(s))
- Reviewer notes:
  - S8 (story): S8 "The magma also holds dissolved gas, locked in like the fizz in a bottle.": the gas is shown by a small particles prop beside the chamber, not inside the magma, so the dissolved idea is only suggested. Fix: Optional: place the bubbles inside the chamber magma.
  - S10 (story): S10 "Think of a pressure cooker...": a gauge stands in for the cooker; no cooker is drawn. Fix: Optional: none needed, the needle carries the analogy.

### Props wanted (drawn with a stand-in for now; for the prop-building backlog)
- none

## Claims to check (tick each one you have verified)
- [ ] A volcano erupts when trapped magma and gas build up pressure greater than the overlying rock can hold
- [ ] Magma collects in a chamber of molten rock under a volcano
- [ ] Rock at that depth is about one thousand degrees Celsius, hot enough to melt
- [ ] Molten rock is less dense than solid rock, so it rises
- [ ] Magma contains dissolved gas, like the carbon dioxide in a fizzy drink
- [ ] As magma rises and pressure drops, the gas forms expanding bubbles that push magma up the conduit
- [ ] Eruptions blast magma, ash and gas out of the vent
- [ ] After gas escapes the pressure drops and the eruption wanes
- [ ] Eruptions build new islands and volcanic soil is rich in minerals

## Automatic fact check (final audit)
- simplified: A volcano erupts when trapped magma and gas build pressure beyond what the overlying rock can hold (Note: True in essence; eruptions are driven by overpressure from magma and expanding gas.)
- simplified: A chamber of molten rock fills under a volcano (Note: Magma reservoirs are often mushy zones rather than open caves, but a chamber is a standard simplification.)
- supported: The heat there is about one thousand degrees Celsius, enough to melt rock (Note: Magma is commonly about seven hundred to twelve hundred degrees Celsius, so about one thousand is right.)
- supported: Molten rock is less dense than solid rock so it rises (Note: Buoyancy of magma is a main driver of its ascent.)
- supported: Pressure rises as the chamber fills (Note: Recharge of a reservoir raises its pressure, general knowledge.)
- supported: Magma holds dissolved gas, like a fizzy drink (Note: Water and carbon dioxide dissolve in magma under pressure, general knowledge, not in the research.)
- supported: As magma rises and pressure drops the gas forms bubbles that push magma up (Note: Gas exsolution and bubble growth drive explosive ascent.)
- simplified: A pressure cooker needle climbs as pressure builds until the lid gives way (Note: A cooker has a safety valve, but the analogy is a fair simplification.)
- supported: The eruption starts when pressure beats the strength of the rock (Note: Overpressure fracturing the cap rock is a standard trigger.)
- supported: Eruptions throw magma, ash and gas high into the sky (Note: Eruption columns carry ash and gas high.)
- simplified: The eruption fades once gas escapes and pressure drops (Note: Eruptions can also end when the magma supply runs low, but this is a fair simplification.)
- supported: Eruptions build new islands and enrich soil with minerals (Note: Volcanic islands such as Hawaii and fertile volcanic soils are well known.)
- Redrafted: no

## Description
Volcanoes erupt when pressure from trapped magma and dissolved gas grows bigger than the rock above can hold. Follow the magma from a glowing chamber, up a narrow pipe, to the blast at the top.

#volcano #science #geology #shorts #earthscience

## Tags
volcano, why do volcanoes erupt, magma, eruption, geology, earth science, pressure, science explained, science shorts

## How the show was made
- show: valid (0 warning(s))

## Picture check findings
- WARN shot "island" at 45.138 s: prop "isl" is 86% inside the caption zone (bottom 28% of the frame, y from 691) Fix: lift it (raise y in its "at", now [1.3,0,0.9]) or use a "high" camera "angle"; the captions will cover it otherwise.

## Cost (estimate)
| call | input | output | cache read | cache write | $ |
|---|---|---|---|---|---|
| script | 4046 | 1382 | 0 | 0 | 0.0219 |
| audit | 1202 | 813 | 0 | 0 | 0.0105 |
| storyboard | 4735 | 2650 | 0 | 0 | 0.0360 |
| storyboard-review | 5921 | 139 | 0 | 0 | 0.0132 |
| show | 20549 | 2044 | 0 | 0 | 0.0615 |
| **total** | 36453 | 7028 | 0 | 0 | 0.1432 |

files mode: tokens are characters / 4, priced as claude-sonnet-5-5; nothing was paid.

## Files
review.md, script.txt, show.json, storyboard.json, storyboard.md, voice.mp3, voice.stats.json, words.json, writer.json, llm/ (every prompt and reply)

<!-- pipeline-run:start -->
## Pipeline run

- Topic: Why do volcanoes erupt?
- Final video: `E:/Youtube Project/whatif-3d/shows/volcano-erupt/out/volcano-erupt-final.mp4`
- Length: 55.133333 s, loudness: -16 LUFS
- Picture check: **warn** (1 findings, see `out/qa.json` and `out/qa-sheet.jpg`)
- Writer status: ok
- Upload: not uploaded
<!-- pipeline-run:end -->
