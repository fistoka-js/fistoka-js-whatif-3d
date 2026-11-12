# Review: Why is the sky blue? It's not the ocean

- Topic: Why is the sky blue?
- Slug: sky-blue
- Status: ok
- Show: repaired 1 time(s)
- Picture check (QA): not_run (QA ERROR: only 0.4 GB of memory is free; browser jobs need 2 GB. Close something and try again.)
- Voice: 38.3 s, 130 words
- Mode: files; model priced as claude-sonnet-5-5
- Written: 2026-11-12 16:30 UTC

## Script
Why is the sky blue? The answer has nothing to do with the ocean. Sunlight looks white, but it is really a mix of every colour. Each colour is a wave, and blue waves are short while red waves are long. When sunlight hits the air, it bumps into tiny molecules of nitrogen and oxygen. Those molecules scatter short blue waves several times more than long red ones. So blue light gets bounced all over the sky and into your eyes from every direction. Then why isn't the sky violet? Violet scatters even more, but the sun gives off less of it, and our eyes see it poorly. At sunset the light travels through much more air, the blue is scattered away, and red is left. Follow for more science.

## Claims to check (tick each one you have verified)
- [ ] The sky's blue colour is not caused by reflection of the ocean
- [ ] Sunlight appears white but is a mix of all colours
- [ ] Light travels as waves; blue light has a shorter wavelength than red
- [ ] Sunlight scatters off nitrogen and oxygen molecules in the air
- [ ] Air molecules scatter blue light several times more than red light
- [ ] Scattered blue light reaches our eyes from all directions of the sky
- [ ] Violet light scatters even more than blue
- [ ] The sun emits less violet than blue and our eyes are less sensitive to violet
- [ ] At sunset sunlight passes through more air, scattering the blue away and leaving red

## Automatic fact check (final audit)
- supported: The sky's blue colour is not caused by the ocean (Note: general knowledge, not in the research)
- supported: Sunlight is a mix of all colours (Note: general knowledge, not in the research)
- supported: Blue light has a shorter wavelength than red (Note: general knowledge, not in the research)
- supported: Sunlight scatters off nitrogen and oxygen molecules (Note: general knowledge, not in the research)
- supported: Air molecules scatter blue light several times more than red (Note: Rayleigh scattering is about 5 to 6 times stronger for blue than red)
- supported: Scattered blue light reaches the eyes from all directions (Note: general knowledge, not in the research)
- supported: Violet scatters even more than blue (Note: shorter wavelength scatters more)
- simplified: The sun gives off less violet and our eyes see it poorly (Note: true in essence; atmospheric absorption also plays a part)
- supported: At sunset light passes through more air, scattering away blue and leaving red (Note: general knowledge, not in the research)
- Redrafted: no

## Description
The sky is blue because air molecules scatter short blue light waves far more than long red ones. Here is the quick, simple version, including why it is not violet and why sunsets are red.

#science #sky #physics #shorts

## Tags
why is the sky blue, sky, blue sky, rayleigh scattering, light, sunlight, sunset, science explained, physics, atmosphere

## How the show was made
- show: 1 validator error(s)
- repair1: valid (0 warning(s))

## Cost (estimate)
| call | input | output | cache read | cache write | $ |
|---|---|---|---|---|---|
| script | 2957 | 466 | 0 | 0 | 0.0106 |
| audit | 1116 | 478 | 0 | 0 | 0.0070 |
| show | 13659 | 1715 | 0 | 0 | 0.0445 |
| repair1 | 15481 | 1718 | 0 | 0 | 0.0481 |
| **total** | 33213 | 4377 | 0 | 0 | 0.1102 |

files mode: tokens are characters / 4, priced as claude-sonnet-5-5; nothing was paid.

## Files
review.md, script.txt, show.json, voice.mp3, voice.stats.json, words.json, writer.json, llm/ (every prompt and reply)

<!-- pipeline-run:start -->
## Pipeline run

- Topic: Why is the sky blue?
- Final video: `E:/Youtube Project/whatif-3d/shows/sky-blue/out/sky-blue-final.mp4`
- Length: 38.4 s, loudness: -15.9 LUFS
- Picture check: **pass** (0 findings, see `out/qa.json` and `out/qa-sheet.jpg`)
- Writer status: ok
- Upload: not uploaded
<!-- pipeline-run:end -->
