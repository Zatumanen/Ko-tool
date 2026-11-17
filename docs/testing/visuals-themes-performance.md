# Visuals themes / adaptive Canvas — ZAT-88 software contract

## Source-first baseline

main@3e16ba0cb5605524b6b865057632478ed840bee3, owner roadmap §6 and Linear ZAT-88
read17-Nov (Backlog). Owner permits sequential software work before deferred HIL.
Open PR188–192 are independent unmerged checkpoints; this PR does not integrate them.

| Criterion | Baseline evidence / classification | Decision |
| --- | --- | --- |
| App/Device/B&W modes + verified model fallback | IMPLEMENTED in `layout.js:resolvedPalette` and `app.js:attachVerifiedIdentity`; fake-browser verified identity test | SKIP palette/identity rewrite; exact device colors still require owner visual acceptance |
| Dark/Light within one B&W theme | PARTIAL: CSS has dark mono only; global selector has exactly3 modes | BUILD subordinate Light Mono, preserve3 globals and session reset |
| Strict monochrome warnings | BROKEN: `.vis-unsaved` is hardcoded brown/yellow even in mono | FIX alert colors from mono variables, native control accent/color-scheme |
| Adaptive60/30/15 | MISSING: `app.js:tick` fixed32ms gate | BUILD measured render-cost/RAF cadence clock with hysteresis |
| Measurement independent of Canvas target | PARTIAL: `audio.sample()` and Spectrogram push are inside paint cycle | FIX separate30Hz snapshots/history ingestion; continuous trigger remains on audio thread |
| Offscreen render suspension | PARTIAL: hidden flags skip paint but keep requesting RAF, horizontally clipped modules still paint | FIX cancel RAF and per-panel intersection clipping |
| MBP2017 /15min/1h/4h acceptance | UNVERIFIED / HIL PENDING | No fabricated benchmark or endurance PASS |

No source/assets/dependencies imported. App and EP133/EP40 palette tokens and verified
SKU rules are retained, not newly certified against hardware/reference photography.
Audio device names never establish device color identity.

## Theme behavior

Exactly3 global modes remain App, Device and B&W. B&W has a subordinate Dark Mono /
Light Mono selector; it is not a fourth global theme. Both variants use grayscale
foreground/background/grid/accent/border/muted tokens, including the unsaved warning,
input accent and native control color scheme. Canvas receives these same tokens;
no colored error/CLIP exception is introduced. Owner visual acceptance of text,
platform-native control rendering and device palette fidelity remains open.

Mono tone is session-only, default dark on a new opening. Existing Auto Theme/manual
precedence and verified fallback remain unchanged. Theme/tone changes do not alter
source, permissions, layout order/weights/saved presets or capture. Existing session
restart policy still starts Auto Theme ON; manual B&W choice turns it OFF.

## Clock and visibility

`renderClock.js` schedules animation painting at60/30/15 while analyser snapshots
retain a separate30Hz deadline. Timings use monotonic timestamps and phase-preserving
deadlines; late frames create one actual snapshot, never a fabricated catch-up burst.
Spectrogram history ingestion happens on snapshots, not Canvas paints. It remains
bounded by its existing512-frame/16s policy and records real sampling gaps.

Engineering heuristics: evaluate2s windows. Downgrade one step if mean synchronous
Canvas paint cost exceeds65% of the current period, or mean RAF interval exceeds180%.
Upgrade one step only after3 stable windows with paint cost below40% and RAF interval
below130% of the next higher period. Suspension/backward/long clock gaps reset window
history without changing capture. These values are algorithm defaults, **not measured
CPU/GPU/RAM acceptance thresholds**. GPU work, GC, host load and screen refresh may
make achieved FPS lower than target. The UI says AUTO target, not measured display FPS.

Analyser snapshots are still best-effort main-thread measurements; severe main-thread
blocking can delay them. This PR does not claim continuous FFT or LUFS. Continuous
trigger processing is already independent in AudioWorklet. LUFS/PCM recording in
unmerged PRs must retain that separation when integrated; this scheduler neither
starts/stops capture nor changes sample rate/audio graph/quantization.

Viewport and module clipping (including native horizontal overflow) filter actual
Canvas bounds, not section headers. Canvas resize/toggle notifications recheck
zero-height transitions; observer callbacks use current geometry rather than stale entries. Partially visible panels continue; wholly clipped panels do not paint.
If no panels can render, tab is hidden or pointer auto-hide is active, cancel RAF.
Visibility/scroll/resize resumes from current data, with no replay of missed frames.
Observer revisions reject stale callbacks after rerender/close. Browser without
IntersectionObserver falls back to geometry checks plus scroll/resize events; arbitrary
external style changes without those events are not a cross-browser guarantee.
Manual collapse/all-hidden still stop capture per the pre-existing owner policy.

Root diagnostics expose target/render state, snapshot count and animation paint count;
per-Canvas count also includes explicit UI redraws. These are scheduling diagnostics,
not CPU measurements or proof of physical refresh rate. Explicit theme/layout redraws
may occur outside the animation cap.

## Verification and remaining acceptance

- `tests/visuals-render-clock.test.mjs`: exact60/30/15 cadence vs common30Hz snapshots,
  sustained load/recovery hysteresis, suspension/no catch-up, backward clock and clipping.
- `tests/e2e/visuals-themes-performance.spec.mjs`:3 global modes and mono variants,
  grayscale warning with real storage failure, unchanged layout/session reset; actual
  Canvas overload/recovery; native offscreen observer and horizontal clipping while
  genuine synthetic-input trigger worklet continues. No fake PCM/identity metadata.
- Related existing Visuals tests cover source ownership, capture cleanup, layout and
  verified MIDI identity without extra requests. Final exact SHA/CI belongs in PR.

Owner acceptance remains separate: selected MBP2017 i5/8GB macOS12 Chrome, exact host
and browser versions; individually compare7 modules and palettes, then15min with7
modules,1h switching/recording and4h endurance/leaks/heat/audio continuity. Recorder/
LUFS scenarios require their pending software integration first. Record initial and
steady CPU/GPU where observable, process RAM, target and observed FPS, frame/packet
gaps, temperature/fan observations and WAV integrity. Establish quantitative limits
from those measurements and baseline comparison, not synthetic pass counts.
No physical EP, host benchmark, long endurance, merge or Pages deployment performed.

18-Nov checkpoint: one independent read-only review found one Important header/zero-height Canvas visibility defect and no Critical findings. Header-only and zero-height regressions reproduced it before the fix; parent fixed it and verified targeted browser11/11. The original report was recovered after a quota interruption without repeating the review. The reviewer did not certify the revised fix; author verification and exact-head CI are separate evidence.
