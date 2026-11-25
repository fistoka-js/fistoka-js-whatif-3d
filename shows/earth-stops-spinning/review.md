# Review: What If Earth Suddenly Stopped Spinning?

- Topic: What if Earth stopped spinning?
- Slug: earth-stops-spinning
- Status: ok
- Show: repaired 1 time(s)
- Picture check (QA): pass
- Voice: 51.62 s, 185 words
- Mode: files; model priced as claude-sonnet-5-5
- Written: 2026-11-24 18:21 UTC

## Script
What if Earth stopped spinning? Right now, Earth's surface races along at about one thousand miles an hour at the equator. Here is what really happens: the ground would stop, but the air and the oceans would not. Everything loose would keep its old speed and slide eastward across the ground. Near the equator, winds of about one thousand miles an hour would sweep across the land, stripping away soil, trees and buildings. The oceans would slosh forward, then drain toward the poles, because Earth would stay slightly bulged at the equator. That would leave a huge belt of dry land around the middle of the planet. A single day would last a whole year, so one side would bake in sunlight for about six months while the other froze in darkness. It is like a bus braking hard: the bus stops, but everything inside keeps flying forward. Earth's slow, steady turn keeps our winds gentle, our oceans spread evenly, and our days short enough for life to thrive. If you had to survive it, where on Earth would you stand? Comment your answer below.

## Picture plan (the beat list that goes with the script above)
- S1: planet | the ocean bump drifts to the side as the planet's day side keeps its lit half | dial: spin
- S2: gauge | the needle swings up to one thousand miles an hour and the arc fills | dial: speed
- S3: planet | the air glow thickens and the ocean bump slides forward past the stopped surface | dial: spin
- S4: rock | the boulder lurches eastward and slides along the ground
- S5: planet | the air glow flares bright and streaks sideways as the winds scour the surface | dial: wind
- S6: planet | the ocean bump slides from the equator up toward the north pole and grows | dial: ocean
- S7: planet | the ocean shrinks away from the equator and bare land shows around the middle | dial: ocean
- S8: planet | the sun side stays lit and bright while the far side goes dark and cold | dial: daylength
- S9: car | the bus brakes to a halt while the crates inside slide forward
- S10: planet | the ocean bump spreads evenly again and the air glow settles to a calm soft haze | dial: ocean
- S11: planet | the planet's land belt and poles light up as possible places to stand
- S12: planet | the whole planet glows warmer and the air glow brightens softly

## Storyboard (see storyboard.md)
- Reviewer verdict: pass, after 2 repair round(s)
- storyboard: 1 problem(s) found by the code check (no review call)
- storyboard-repair1: review problems (2 point(s))
- storyboard-repair2: review pass (1 point(s))
- Reviewer notes:
  - S3 (text): S3 "the ground would stop, but the air and the oceans would not": the text "1,000 mph at the equator" from S2 stays up while the gauge needle drops to zero, which could read as a mismatch. Fix: Note only: keep the text but make sure the gauge is clearly the ground speed.

### Props wanted (drawn with a stand-in for now; for the prop-building backlog)
- none

## Claims to check (tick each one you have verified)
- [ ] Earth's surface moves at about one thousand miles an hour at the equator.
- [ ] If the ground stopped suddenly, the air and oceans would keep moving eastward.
- [ ] Winds near the equator would be extremely strong, roughly the speed of the old surface motion.
- [ ] Earth would stay slightly bulged at the equator, so oceans would drain toward the poles.
- [ ] That would expose a belt of land around the equator.
- [ ] Without spin, a day would last about a year, with about six months of sunlight and six months of darkness at any spot.

## Automatic fact check (final audit)
- supported: Earth's surface moves at about one thousand miles an hour at the equator. (Note: The equatorial speed is about 1,037 miles an hour.)
- supported: If the ground stopped suddenly, the air and oceans would keep moving. (Note: Inertia would carry the air and water onward, as widely explained.)
- supported: Loose things would slide eastward, the direction of the spin. (Note: Earth turns eastward, so loose things would keep going east.)
- simplified: Near the equator the winds would be about one thousand miles an hour and strip away soil, trees and buildings. (Note: Right for a sudden stop at the equator; winds would be weaker nearer the poles and would fade as friction slows the air.)
- supported: The oceans would drain toward the poles because Earth keeps its equatorial bulge. (Note: The solid Earth would keep its bulge, so water would move toward the poles.)
- supported: A belt of dry land would be left around the middle of the planet. (Note: Widely cited result of the ocean moving poleward.)
- simplified: A day would last about a year, with about six months of sunlight and six months of darkness at a place. (Note: True for the length of a sunrise-to-sunrise day, ignoring the Moon and axial tilt effects.)
- simplified: Earth's spin keeps winds gentle, oceans spread evenly and days short. (Note: Spin is a main reason for the shape of the oceans and short days; winds are also driven by the Sun.)
- Redrafted: no

## Description
What would really happen if Earth suddenly stopped spinning? The ground would halt, but the air and oceans would keep moving, with huge winds, drained seas and days that last a year.

#earth #science #whatif #physics #space

## Tags
what if earth stopped spinning, earth rotation, science explained, what if, planet earth, physics, oceans, winds, day and night, space facts, science shorts

## How the show was made
- show: 0 validator error(s), 1 story problem(s)
- repair1: valid (1 warning(s))
- qa-repair: picture check now pass (0 fails, was 5)

## Checker warnings on the accepted show
- story.stillness: nothing on screen changes from 4.40 to 7.65 s (3.25 s; at most 3.5 s allowed, 2.5 s is better) while the narrator says "an hour at the equator. Here is what really happens: the ground would". Add a change in that stretch: a "set", "move", "scale", "color" or "glow" on a prop (give it "until": a later phrase so it runs from word to word), or a dial key there with the dial bound to a prop on screen. Camera moves, spin, bob, orbit, pulse, shake, labels and text do not count.
- story.subject (accepted by hand): the longest subject ("sea", shots drain, belt, day) is on screen 15.50 s of 53.81 s, 29% against the 30% limit. This is a trade-off. Options considered to add 0.65 s: start the sea earlier (this cuts the winds text), start the bus shot later (this cuts the bus braking move), or put Earth into the bus scene (it hides the bus idea). None was taken. The old bus shot was a continuing shot ("continue") and used to carry the sea through it, which is why the sea counted longer before the bus fix made it a separate scene. A viewer will not notice a 1% miss, so it stays.

## Cost (estimate)
| call | input | output | cache read | cache write | $ |
|---|---|---|---|---|---|
| script | 4048 | 1237 | 0 | 0 | 0.0205 |
| audit | 1207 | 587 | 0 | 0 | 0.0083 |
| storyboard | 4623 | 1825 | 0 | 0 | 0.0275 |
| storyboard-repair1 | 6552 | 1825 | 0 | 0 | 0.0314 |
| storyboard-review | 5057 | 233 | 0 | 0 | 0.0124 |
| storyboard-repair2 | 6700 | 2007 | 0 | 0 | 0.0335 |
| storyboard-review | 5238 | 91 | 0 | 0 | 0.0114 |
| show | 20347 | 2575 | 0 | 0 | 0.0664 |
| repair1 | 23236 | 2654 | 0 | 0 | 0.0730 |
| qa-repair | 23476 | 2670 | 0 | 0 | 0.0736 |
| **total** | 100484 | 15704 | 0 | 0 | 0.3580 |

files mode: tokens are characters / 4, priced as claude-sonnet-5-5; nothing was paid.

## Files
review.md, script.txt, show.json, storyboard.json, storyboard.md, voice.mp3, voice.stats.json, words.json, writer.json, llm/ (every prompt and reply)

<!-- pipeline-run:start -->
## Pipeline run

- Topic: What if Earth stopped spinning?
- Final video: `E:/Youtube Project/whatif-3d/shows/earth-stops-spinning/out/earth-stops-spinning-final.mp4`
- Length: 53.8 s, loudness: -16 LUFS
- Picture check: **pass** (0 findings, see `out/qa.json` and `out/qa-sheet.jpg`)
- Writer status: ok
- Upload: not uploaded
<!-- pipeline-run:end -->
