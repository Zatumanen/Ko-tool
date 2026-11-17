# Software RC checkpoint — 2026-11-17

Baseline main: da62cd0ce496a2822d596c0ad8a49fecdbfdf009. Owner authorized
software implementation and PRs across the approved roadmap; hardware, merge
and deployment remain separately gated. Follow IMPLEMENTATION_GATE each iteration.

## DONE

Current-state diff: merged FX-MIC workspace (#176), canonical runtime lazy load
(#178), existing PAK staging surfaced (#179), source pitch guard (#180), full
batch mapping confirmation (#181), source-first audit gate (#182). Open drafts
#139 (pad writes) and paused #110 must not be duplicated/activated.

This iteration: FIX Visuals ACCESS permission discovery retaining its temporary
capture until enumerateDevices resolves. Release tracks immediately after the
permission grant, before enumeration. Selected-input START behavior unchanged.

## VERIFIED

Before fix, pending enumeration regression fails (7/8 Node cases pass).
After fix, focused Visuals audio suite passes8/8. Full Node985/985, Visuals Chromium5/5, Pages build/verify and local preflight
passed. PR #183 records exact-head CI; initial structural PR-body check required
main@SHA syntax and an explicit inspected source path, corrected without
changing runtime behavior.

## PENDING SOFTWARE

Visuals advanced waveform trigger (ZAT-80), spectrum/spectrogram/XY/stereo/peak
behavior, true BS.1770 loudness and16/24-bit recorder remain to be inspected per
criterion before implementation. Standalone connected Sequencer and EP-136
integration remain later stages. No software RC completeness claim.

## HIL PENDING

Upload/COPY/MOVE/DELETE, REPITCH, project writes/recovery, PAK interoperability,
pad writes, Sequencer Live, FX-MIC Live and EP-136 USB Audio retain their scoped
hardware gates. Existing read-only/HIL registry evidence is not a fresh test.

## BLOCKED

Physical operations, merge and Pages deployment lack authorization for this
iteration. Unknown layouts/firmware and official PAK Restore stay blocked.
Interruption tests remain deferred. No full release candidate SHA yet.

## NEXT

Inspect ZAT-80 approved trigger contract, current Canvas path and impulse fixtures;
classify exact gaps and implement a separately verified Visuals trigger iteration.
Do not repeat the completed baseline audit or rebuild existing My EP/SUC paths.
