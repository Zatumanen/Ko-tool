---
name: audio-regression
description: Use when a change touches SpeedUpperCut DSP, x2/resampling, WAV or pitch metadata, channels/playmode, audio import/export names, waveform edits, or audio-result regressions.
---

# Audio regression

Read the relevant [audio contract](../../../docs/testing/audio-x2-pipeline.md)
and [TESTING selection](../../../docs/TESTING.md) rows, then affected functions,
callers and vectors. Do not load device internals for a converter-only task.

1. Use canonical processor/audioEngine; verify approved input/output before editing.
   Preserve x2, resampling, PCM, metadata, channels/playmode, cancellation and HI/MID/LO.
   Verify WASM ABI/hash; no unverified fallback or source-file overwrite.
2. Converter exports retain numeric prefixes. My EP may strip a 1–3-digit slot
   prefix (1–999) followed by whitespace or `_` for device filenames/slots; never
   apply device naming to converter WAV/ZIP paths. Skip macOS sidecars and report
   per-file decoder failures while retaining successful results.
3. Reproduce and add the smallest failing behavioral/vector test. Assert the output
   contract: rate, frames/duration, channels, PCM/tolerance, pitch/playmode metadata
   and names. Do not change golden expectations without an authorized semantic change
   and evidence. Synthetic vectors do not become real hardware captures.
4. Match existing tests: audio-pipeline-golden, processor, resampler-zip,
   audio-import-policy, output-name, waveform or corresponding browser spec.
   DSP/PCM or audio-metadata semantic changes require full npm test, npm run build:pages,
   npm run test:e2e plus applicable TESTING hardware gates. A label/doc change alone
   does not justify those suites; filename-only fixes start with naming/import and
   matching download checks. Store long logs in scratch, report summaries.

My EP direct upload is a separate path from converter x2/−12. REPITCH is
implemented with an ON-by-default toggle, provenance-aware preflight and guarded
import; physical playback acceptance remains open in ZAT-77. Incoming −12 alone
is not proof of prior x2 processing. Preserve original audio and fail transparently
on malformed metadata; never apply x2 twice. Report evidence and HIL limits.
