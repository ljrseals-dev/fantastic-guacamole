# Talking Voder

The 1939 Bell Labs Voder as a playable, scriptable browser instrument. No dependencies: open `index.html`.

- **Phrase to score**: type text, get ARPAbet phonemes (editable), then a piano roll of 20 ms cells: ten band keys, three stop-consonant keys, a buzz/hiss wrist-bar row, and a pitch line.
- **Edit and play**: click or drag cells to paint or erase, then Speak. Output is rendered offline and played. `index.html` also saves WAV.
- **Play it yourself**: live band keys, stop keys, wrist bar and pedal (A S D F G H J K L ; and Z X C, Space for hiss).

Layout: `src/core.js` (bands, WAV), `src/engine.js` (Web Audio engine, `voderTV`), `src/score.js` (phonemizer, compiler, offline renderer), `demo/template.html` + `build.py` -> `index.html`, `artifact.html`. Tests: `node tests/score.test.cjs` and `NODE_PATH=$(npm root -g) node tests/browser.test.cjs` (Playwright, Chromium).

## Verified against a source
CCRMA's Voder page (J. O. Smith): ten fingers controlled the bandpass gains; three additional keys controlled transient excitation of selected filters for stop consonants; a wrist bar selected buzz or hiss; a foot pedal controlled pitch. Ten bands and buzz/hiss sources: Dudley, BSTJ 19(4), 1940.

## Assumed, not verified
- Which filters each stop key excites (here: P/B bands 1-3, T/D bands 6-9, K/G bands 3-6).
- Formant values (typed from memory of Peterson and Barney 1952), the letter-to-sound rules, phoneme durations, intonation shape, which keys make each fricative and nasal.
- The Voder could not buzz and hiss at once, so voiced fricatives are buzz only.
- How the band-key gains were scaled by real operators; here keys are on/off.

## Measured (headless Chromium, offline rendering)
- Each band key alone puts its peak energy in its own band, all ten.
- Each stop key: silent before, onset within 8 ms of its trigger time, near silence 60 ms later. Burst brightness (spectral centroid) T about 2.4 kHz > K about 1.5 kHz > P about 0.8 kHz.
- A burst scheduled on a score cell lands within 8 ms of that cell's time.
- The same phrase gives the same score hash and the same audio (max sample difference 2.4e-7, float rounding).
- S is brighter than IY and mostly unvoiced; IY is buzzy and its pitch matches the contour start.
- Editing a cell changes the score, and the roll, stop keys and wrist bar respond; no horizontal scroll at 400 px.

## Not checked
How it sounds. Nobody has listened to this. Intelligibility is untested, and the letter rules are crude.

See CREDITS.md for citations.
