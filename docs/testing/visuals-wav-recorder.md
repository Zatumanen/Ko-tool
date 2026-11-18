# Visuals WAV Recorder — ZAT-87 bounded software contract

## Source-first baseline

main@3e16ba0cb5605524b6b865057632478ed840bee3, audited17-Nov. Owner roadmap
[§6](../roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md) and Linear ZAT-87 specify
PCM16/24, START/STOP/PAUSE/RESUME, sample timer, input level/CLIP, preview/discard/save,
actual sample rate/channel count and honest memory limits. Linear read: Backlog;
owner permits sequential software completion while hardware is deferred.
Open PRs188–191 are independent unmerged checkpoints, not recorder dependencies.

| Criterion | Baseline evidence | Decision |
| --- | --- | --- |
| Recorder/controls/PCM transport | MISSING: `js/visuals/audio.js` only analyser snapshots + trigger, `app.js` has no recording route | BUILD continuous worklet, controller, UI |
| Correct PCM quantization | IMPLEMENTED16: `js/audio/audioEngine.js:audioBufferToS16`; FX-MIC plain encoder is16-only and tied to its stock profile | Reuse unchanged rounding through shared pure `js/audio/pcm.js`, extend24; no second resampler/TE metadata path |
| Pause/stop/failure, bounded queues/payload | MISSING | BUILD strict ordered chunks and counters, explicit incomplete results |
| Actual USB Audio / long endurance / owner acceptance | HIL PENDING / UNVERIFIED | No physical tests or release claim |

No external code/assets/library imported. RIFF PCM container is independently
implemented and byte-tested. No resampling, normalization, x2, TE metadata/provenance
or source-file overwrites. Converter's existing s16 rounding remains unchanged.

## Measurement, transport and file

The existing authorized Visuals AudioContext/source supplies the recorder node;
RECORD never requests another getUserMedia stream or silently selects an input.
The worklet uses actual AudioContext sampleRate, confirmed mono/stereo track metadata
and clamped channel count. Unknown/unsupported layouts cannot start recording;
changed metadata/topology interrupts before accepting affected chunks.

`recorderPcm.js` consumes every input quantum on the audio thread, validates finite
samples and interleaves L then R. Shared rounding saturates negative samples against
32768/8388608 and nonnegative samples against32767/8388607. Signed little-endian
PCM16/24, RIFF format1, actual rate/channels, block alignment and odd data padding
are preserved. There is no dither or True Peak calculation.

PAUSE flushes the current partial chunk before acknowledgement. Paused samples
are excluded; RESUME appends subsequent quanta with no duplicated boundary.
STOP flushes then reports final frames/bytes/sequence. Timer uses confirmed recorded
frames/rate, not wall time. Input peak/latched CLIP continues while paused; the
INPUT warning describes monitored audio, not necessarily clipped samples in the file.

Chunks contain at most4096frames and transfer their ArrayBuffers. Up to1MiB of
unacknowledged PCM may be in flight; pending input is never overwritten or silently
dropped. A stalled receiver, invalid PCM/format or bad sequence/counters interrupts
recording, preserving only the accepted contiguous prefix and marking it explicitly.
Level messages have a separate single-message ACK gate. Main capture generations
and cleanup reject stale node/module messages. Global STOP is owned by the original
capture generation; a new START/source/Visuals instance cannot be stopped by its
late completion. Terminal processors return false; active discard/teardown sends
explicit disposal before closing the message port, releasing audio-thread lifetime. Missing command ACK (2s), stalled
audio (5s) and worklet module load failure/timeout (5s) cannot become normal success.

## Memory/lifetime and UX

Engineering choice: maximum PCM payload64MiB, stop at the last complete frame and
show LIMITED. Limit is visible before recording, with approximate duration once
format is known. At48kHz stereo this is about5m50s PCM16 /3m53s PCM24. This is an
in-memory v1, **not unlimited or stream-to-disk recording**. PCM cap is not a total
process-RAM guarantee: chunks, Blob creation, preview decoding and browser overhead
can require additional memory. No4-hour recording/endurance claim is made.

The separate in-browser REC panel preserves all seven meter modules. Recording,
pause, resume, stop, input level/CLIP and timer are visible; bit depth is fixed per
take. The result is an immutable WAV Blob with HTML audio preview and explicit
SAVE WAV/DISCARD. Save requests a browser download; it does not prove an OS save.
Another take requires explicit DISCARD of the current take. No persistence or
recovery after page/process crash is promised; beforeunload warns while data exists.
Object URLs are revoked on discard/close; preview does not monitor live audio.

Visuals STOP first requests normal recorder STOP, then releases the selected stream.
Unplanned capture loss, source replacement, collapse/all-hidden/pagehide interrupt
without pretending to flush an inaccessible worklet tail. Only confirmed prefix
chunks survive, with interrupted status; they may be explicitly previewed/saved.
Closing Visuals with a take asks before discarding it. Hiding the REC panel or
auto-hiding drawings does not stop audio processing. Background browser suspension
can interrupt; safe error reporting is not an uninterrupted-background guarantee.

## Verification and acceptance

`tests/visuals-recorder-pcm.test.mjs`: PCM/header/padding, signed extrema, parity
with canonical s16, partition invariance, pause boundaries, exact aligned payload
cap, invalid data/layout, ACK budget and real structured-clone transferable rules.
`tests/visuals-recorder.test.mjs`: supplied graph, asynchronous START teardown,
ordered chunks, final counters, timeout, unknown/changed metadata, retained prefixes.
`tests/visuals-audio.test.mjs`: exact existing graph handoff/detachment.
`tests/e2e/visuals-recorder.spec.mjs`: real synthetic selected browser stream,
24-bit stereo download with paused full-scale audio excluded,16-bit mono interruption,
preview/discard/close confirmation, repeat take, capture cleanup and denied permission.
Versioned /Ko-tool/ dist also starts/stops/previews/discards a24-bit recording.

Evidence is CODE/CI and synthetic BROWSER only. Physical EP USB Audio, real-device
channel topology, MBP2017 performance,15min/1h/4h endurance, owner visual acceptance
and other browser coverage remain open. No physical operations, merge or deployment.
Exact SHA, CI and remaining checkpoint are recorded in the PR;1.0 RC is not complete.

Independent read-only review identified processor lifetime and stale STOP continuation defects; both were reproduced by regressions and fixed in one pass. Deferred minor: theme/layout/refresh remounts reset preview playback position. Owner visual acceptance includes this known limitation.
