# SpeedUppercut x2 audio pipeline (ZAT-12)

Status: canonical processing contract, synthetic golden fixture suite v1.

## Scope and entry points

The desktop SpeedUppercut converter uses **one** authoritative path for a
selected file or a directory batch:

- `js/app.js` calls `processAudioInputs(files, options, hooks)`;
- `processAudioInputs` iterates in source order and calls **the same**
  `processAudio` once per file;
- the results are previewed/exported as EP-ready, s16 PCM WAV;
- `processAudio` can also be called directly (including by the tests).

Do not add a second DSP implementation inside the folder UI, ZIP writer, or
single-file UI. ZIP only packages the already-processed WAV blobs.

**My EP's direct sample upload is a separate product path**, not a second
implementation of x2: it can fast-path an already compatible WAV or resample
the source to the supported device rate without x2 or -12 semitone repitch.
Both products delegate actual resampling and WAV encoding to the shared
`js/audio/audioEngine.js` reference ABI.

## Ordered canonical stages

`EP_AUDIO_PIPELINE_STAGES` in `js/audio/processor.js` is the authoritative
stage list, in this order:

1. **Decode** — built-in PCM WAV decoder for RIFF/WAVE 8/16/24/32-bit integer
   and 32-bit float; Web Audio `decodeAudioData` for other supported inputs.
2. **Optional silence trim** — -60 dB threshold, 100 ms minimum quiet edge.
3. **Channel layout** — mono averages available source channels; stereo
   duplicates mono or uses source L/R.
4. **Speed ×2 and resample** — call the shared TE reference
   `resampleAudioData`, with effective source rate `sourceRate * 2` and
   preset target rate `46875` (HI), `32000` (MID), or `26250` (LO).
5. **Peak normalization** — normalize to 1 only for non-silent peak below 1.
6. **s16 quantization** — saturate to [-1, 1] then round negative samples
   against 32768 and nonnegative samples against 32767.
7. **Reference WAV encoding** — s16 PCM little endian with TE metadata;
   `sound.pitch=-12`, `time.mode=off` and chosen playmode.

The reference resampler's own PCM/s16 round-trip is intentional and happens
inside step 4, **before** step 5. Reordering those steps changes sample bytes.

The x2 factor and -12 semitone compensation are fixed. UI does not accept an
arbitrary per-file speed override. Stage cancellation is checked between work
and in long-running CPU loops.

## Decoding, WASM, and equivalence rules

- **Production resampling:** the dynamic Emscripten TE WASM reference module
  is required. `getReferenceAudioModule` fails on a missing/incompatible
  module. There is **no silent linear/interpolation substitute** in production.
  Source/binary/ABI integrity is separately pinned in
  `tests/resampler-zip.test.mjs`.
- **Browser decode fallback:** for codecs outside the built-in WAV decoder,
  browsers supply decoded PCM through `AudioContext.decodeAudioData`. Byte
  equivalence is required **only when the decoded PCM, sample rate, and channel
  layout are identical**. Lossy codecs and browser decoder variations may
  differ in PCM values, leading to different normalized/quantized WAV bytes;
  the test suite does **not** claim a cross-browser bit-exact MP3/AAC decode.
- **Deterministic test adapter:** `tests/helpers/reference-audio-module.mjs`
  implements a lightweight deterministic s16 test double for the reference
  module. It is deliberately **not** an accurate replacement for production
  libsamplerate and never becomes a runtime fallback.
- **Golden corpus:** `tests/fixtures/audio/x2-pipeline-v1.json` pins six
  small synthetic input vectors (WAV u8, s16, s24, s32 and float32; HI/MID/LO;
  mono/stereo) and their **literal expected PCM bytes**, frame counts, sample
  rates and playmodes. `tests/audio-pipeline-golden.test.mjs` generates those
  WAV inputs independently and checks the deterministic adapter's output
  byte-for-byte, including output WAV headers and TE metadata. It also compares
  single-file against batch results, checks order, and verifies a decoded-PCM
  equivalent browser path.
- **Not hardware evidence:** these are *synthetic* audio golden vectors,
  not recordings of an EP device or captured WASM output. Do not treat fake
  reference output as proof of actual libsamplerate/firmware bit identity.

## Updating the pipeline

1. Run `npm test`, `npm run build:pages`, and `npm run test:e2e`.
2. If a fixture changes, do not silently regenerate the expected bytes.
   Explain which DSP contract changed, why, and how it affects existing
   exported samples. Review both PCM and metadata separately.
3. For reference WASM changes, verify the pinned binary/ABI tests and add an
   explicit independent WASM output baseline before declaring byte equivalence.
4. For additional codecs, add a representative decoder fixture or browser test;
   distinguish PCM decode drift from resampling/quantization drift.
5. Avoid changing My EP direct-upload behavior as a side effect of x2 changes.

## Golden-test coverage limits

The suite detects output drift for the pinned *deterministic adapter* vectors,
including channel mixing and normalization. It does not currently prove
bitwise output identity of the real TE WASM reference implementation across
machines or across alternative browser decoders. That is a separate evidence
task, and no fallback equivalence is asserted where the two implementations
are not equivalent.
