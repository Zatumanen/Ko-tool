# Output Meters Implementation Plan

> For agentic workers: use executing-plans inline; one independent read-only final review.

**Goal:** continuous independent L/R sample Peak, Peak Hold and latched CLIP for the selected input.
**Architecture:** bounded scalar meter core in a separate AudioWorklet; Canvas consumes summaries, never measures audio. Existing trigger, spectrum and capture permissions stay intact.
**Tech Stack:** native JavaScript, Web Audio, Canvas, Node 22, existing Playwright.
**Spec:** owner roadmap §6 / ZAT-86; exact engineering contract in docs/testing/visuals-output-meters.md.

## Global Constraints

No dependencies, RMS/True Peak, system-output capture, EP operations, merge or deployment. Isolated branch from main@3e16ba0cb5605524b6b865057632478ed840bee3. Existing PRs #188–#190 are independent, unmerged checkpoints.

## Review Focus

- Short single-sample impulse while rendering/messages stall: retain maximum and CLIP.
- Independent channels, mono and channel drift: never invent a right channel.
- Silence, nonfinite data and missing AudioWorklet: explicit accurate state.
- Reset/stop/source switch: no old capture summary after restart.
- 96px module and monochrome theme: visible hold marker, textual CLIP, no color-only warning.

## Task 1: Continuous core and browser integration

Files: js/visuals/outputMeters.js, outputMetersWorklet.js, audio.js, app.js; tests/visuals-output-meters.test.mjs, tests/e2e/visuals-output-meters.spec.mjs; matching docs/matrix.
Interface: createOutputMeters(sampleRate).push(channels), take(), reset(); packet status/channelCount/peak/hold/clip; audio.sample().output includes latest scalar packet or explicit pending/unsupported/stale state.

- [x] RED: impulse, independent channels, hold timing/decay, clip threshold/latch, silence, mono, invalid format/data, reset, partition invariance; actual AudioWorklet browser capture and stop.
- [x] GREEN: sample-clock 1s hold then 20dB/s decay; pending peak maxima retained until publication; bounded ACK publication at 30Hz, no per-sample allocations; no drawing dependence.
- [x] Integrate dBFS rails, hold ticks, text CLIP and explicit reset; no RMS/True Peak; mono right N/A; stop/error clears display.
- [ ] Focused tests, full Node/build/verify/source and dist Chromium; independent read-only review.
- [ ] Commit/push/PR with six gate headings, exact-head four-job CI; checkpoint. No merge/deploy.

Ruling: defaults are engineering choices (1s/20dB/s, latched CLIP); owner contract specifies behavior, not timings. Local prior instructions authorize direct sequential software execution without another interview.

Execution checkpoint: one independent read-only review completed. All three material findings fixed with failing regressions then passing focused19/19 and full Node1012/1012. Deferred minors and physical/visual limits are recorded in the contract; exact final GitHub SHA/CI checkpoint lives in the PR.
