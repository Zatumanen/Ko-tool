# WAV Recorder Implementation Plan

> Execute inline using executing-plans/TDD; one independent read-only review at the end.

**Goal:** record the selected Visuals input as PCM16/24 WAV with explicit controls and honest limits.
**Architecture:** AudioWorklet encodes continuous interleaved PCM in bounded transferable chunks. Main controller validates sequence/frame counts, bounds payload to64MiB, creates RIFF/Blob only at completion, and preserves interrupted prefixes with explicit status. Existing capture owns the only stream; no second permission/source.
**Tech Stack:** native JS, Web Audio, Canvas UI/HTML audio, Node22, existing Playwright.
**Spec:** owner roadmap §6 / ZAT-87; contract docs/testing/visuals-wav-recorder.md.

## Global Constraints

Base main@3e16ba0cb5605524b6b865057632478ed840bee3. Separate branch; no integration of unmerged PR188–191. No dependencies, resampling/x2/metadata mutation, EP operations, merge or deploy. Extract the existing s16 rounding into a shared pure quantizer without changing converter behavior; extend it for24-bit. Unknown/unsupported recording channel formats fail closed.

## Review Focus

- Every recorded frame appears exactly once across arbitrary blocks and pause/resume.
- ACK stalls, sequence gaps, nonfinite PCM and memory limit are explicit interrupted/limited states, never normal success.
- STOP flushes and validates final counters; capture loss preserves only the known prefix, marked interrupted.
- Pending START/STOP and source/close races cannot attach stale worklets or erase another recording.
- Preview/save/discard revoke URLs and require explicit user action; close warns before data loss.

## Task 1: Bounded recorder end to end

Files: js/audio/pcm.js and canonical audioEngine.js; js/visuals/recorderPcm.js, recorderWorklet.js, recorder.js, audio.js, app.js; css/visuals.css; focused Node/E2E, matching contract/matrix/readme/testing.
Interfaces: createPcmRecorder({sampleRate,channels,bits,maxBytes},emit) command/push/ack; createWavRecorder({onChange,maxBytes}) attach/detach/start/pause/resume/stop/discard/result/snapshot. Source graph supplied by createVisualsAudio; UI never requests a second source.

- [x] RED:16/24 header/quantization/padding, stereo/mono, pause boundaries, packet order, queue/memory limits and invalid data; lifecycle races; actual browser record/download/preview/discard/permission/cleanup.
- [x] GREEN: encode continuously with sample-clock frames, bounded messages, explicit terminal errors; validated immutable WAV Blob.
- [x] UI: REC panel in browser desktop, bit depth, record/pause/resume/stop, frame timer, input peak/CLIP, audio preview, save/discard; visible64MiB limit; seven existing modules unchanged.
- [ ] Focused then full Node/build/verify/source/dist; one independent review and one targeted fix pass.
- [ ] Commit/push/PR and all four mandatory checks on exact head; checkpoint. No merge/deploy.

Engineering ruling:64MiB PCM payload cap is a conservative in-memory v1 choice; stop visibly at the cap. Blob/preview/browser overhead is additional. This is not unbounded/stream-to-disk recording or proof of4-hour endurance; hardware/owner/endurance acceptance stays pending.

Execution checkpoint: focused27/27; final full Node1020/1020; final build/verify and dist2/2. Independent read-only review identified two Important lifecycle findings, reproduced and fixed in one RED→GREEN pass. Preview-position reset minor deferred in contract. Full source/final exact-head CI and PR checkpoint tracked externally.
