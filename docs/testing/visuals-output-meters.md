# Output Meters — ZAT-86 software contract

## Baseline and source-first decision

Audited main@3e16ba0cb5605524b6b865057632478ed840bee3. Owner roadmap
[§6](../roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md) and ZAT-86 specify
independent L/R sample Peak, Peak Hold and CLIP, for the selected input only.
Linear read on 17-Nov: Backlog; owner explicitly permits sequential software
completion while hardware acceptance is deferred. Open PRs #188–#190 remain
independent unmerged work, not baseline features.

| Criterion | Baseline | Evidence / decision |
| --- | --- | --- |
| Selected-source L/R peak display | PARTIAL | `audio.js` measures 2048-sample analyser snapshots only when Canvas paints; `app.js` draws percentages. Short impulses between snapshots can be missed. FIX continuous measurement. |
| Peak Hold | MISSING | No held peak state or marker in output paint branch. BUILD. |
| CLIP | MISSING | No threshold, warning or reset for Output Meters. BUILD. |
| Mono and format drift | PARTIAL | Snapshot duplicates mono into R; metadata cached per capture. Explicit single-channel display and fail-closed drift stop required. |
| Owner visual / physical USB Audio acceptance | HIL PENDING | Synthetic streams and green CI cannot establish these. |

No third-party algorithm/code/assets imported. This is sample peak (max absolute
PCM), with independently defined display ballistics, not a proprietary meter
emulation, RMS, True Peak, device-internal clipping detector or system-loopback
capture. No external library or new dependency is required.

## Engineering choices and behavior

`outputMeters.js` consumes every channel sample in `outputMetersWorklet.js`.
One or two channels only; each independent `peak = max(abs(sample))`; dBFS is
`20 log10(peak)`, silence −∞. Values above unity retain their positive dBFS
numbers; only bar coordinates clamp at 0 dBFS. A mono track is explicitly MONO
with R unavailable, never two purported independent channels.

Engineering defaults (not owner-specified timings): hold a newly reached maximum
for 1 second of audio samples, then release at 20 dB/s until a larger current
sample replaces it. A repeated equal maximum refreshes hold. Bars use the maximum
since the previous publication; held markers preserve brief peaks. CLIP latches
independently at any `abs(sample) >= 1`, including a single negative full-scale
sample. RESET clears hold/CLIP, not the source; a continuing clipping signal
immediately relatches. STOP, close and source change clear all capture state.

Measurement runs on the audio sample clock, independently of Canvas, module
visibility or message handling. Summaries publish at at most 30 Hz with ACK
backpressure: while a message is in flight, bounded scalar pending maxima and
CLIP continue accumulating. No history arrays/PCM copies or per-sample allocations.
RESET during node loading is a no-op because no measurement exists yet.
Reset epochs reject already queued packets from before RESET. Capture generation
checks reject stale sessions. No reconfiguration/writes to physical EP.

The worklet input is clamped to the selected track's negotiated channel count:
Web Audio can otherwise expose duplicated mono as two channels. Initially known
unsupported counts are rejected with capture cleanup. If channel metadata is absent,
Output explicitly shows CHANNEL FORMAT UNKNOWN and does not create a downmixing
meter node; other legacy panels retain their existing fallback. A changed known
track count (including a change to >2) stops capture and requires START; a devicechange event cannot silently
restart that format. Invalid/nonfinite PCM or invalid channel shape yields INVALID
INPUT until RESET/new capture. Pending/unsupported/stale (>500ms without packet)
measurement is explicit, with no snapshot fallback. Worklet load errors release
capture using existing error handling. Audio output remains zero-gain.

Canvas provides L/R dBFS bars, contrasting hold ticks and textual CLIP warnings
(including the monochrome theme). At very short canvas heights, compact side-by-side
rails retain both channels rather than clipping R below the viewport. Full numeric
peak/hold values and CLIP remain in the accessible label. The reset control is a
small named button in the existing module title; no new settings panel.

## Verification and limits

- `tests/visuals-output-meters.test.mjs`: impulse/negative polarity, independent
  channels, exact threshold and latched CLIP, silence, hold timing and partition
  invariance, mono, invalid data/format, reset, bounded worklet messages with a
  delayed ACK and retained later impulse.
- `tests/visuals-audio.test.mjs`: unsupported worklet, reset epoch/session ownership,
  release and format drift, including unsupported/missing counts and RESET during module loading.
- `tests/e2e/visuals-output-meters.spec.mjs`: actual synthetic selected MediaStream,
  numerical L/R data and Canvas bar pixels, audio-clock single-sample impulse while
  the main thread is blocked, hold/CLIP/reset, monochrome, genuine negotiated mono,
  90px dock rails, format drift/no reconnect and track cleanup. No metadata override.

These establish CODE/CI and synthetic BROWSER behavior only. Owner visual acceptance,
MBP 2017 load/endurance and real selected USB Audio from each EP remain unverified.
The browser may resample/limit audio before this analyser; this meter describes
received PCM, not analog or device-internal overload. Merge and Pages publication
are separately gated. Exact SHA/CI and next checkpoint belong in the PR.

Independent read-only review identified RESET during START and unsupported/unknown-channel guards; targeted regressions reproduced all findings before correction. Deferred minor acceptance gaps: compact mono text uses R N/A (MONO is in the accessible label); monochrome hold-marker pixels are source-reviewed, not explicitly asserted in E2E. Owner visual acceptance remains pending.
