# Visuals themes and rendering Implementation Plan

> Execute inline with TDD; one independent read-only review.

**Goal:** add the missing Light Mono variant and adaptive Canvas60/30/15 without changing capture/continuous measurement ownership.
**Architecture:** pure render clock keeps30Hz analyser snapshot cadence independent of paint target. Spectrogram history ingestion leaves paint(). IntersectionObserver/viewport clipping and explicit hidden lifecycle suspend Canvas RAF; audio worklets remain independent. Three global themes remain; mono gets a session-only dark/light subselector and grayscale warnings.
**Tech Stack:** existing native JS/CSS/HTML, Node22, Playwright.
**Spec:** owner roadmap §6 / ZAT-88, docs/testing/visuals-themes-performance.md.

## Global Constraints

Base main@3e16ba0cb5605524b6b865057632478ed840bee3. No dependencies, new audio sources, protocol/device operations, integration of unmerged PR188–192, merge or deploy. Reuse App/device colors and verified identity; do not claim device palette/owner acceptance. No invented MBP CPU/RAM thresholds or endurance PASS.

## Review Focus

- Fifteen FPS paint must not turn the independent30Hz snapshot clock into15Hz; no fabricated catch-up frames.
- Tab/auto-hide/offscreen suspension cancels RAF, not capture/worklet processing; resume resets timing and shows real sampling gaps.
- Horizontal clipping prevents work for nonvisible panels and resumes on scrolling; stale observer callbacks cannot restart closed sessions.
- Exactly3 global themes; both mono variants, warning/error styles and native control accent are grayscale without mutating layout/source/session.
- Sustained overload downshifts one step/window, sustained recovery avoids thrashing; heuristics are not hardware benchmark thresholds.

## Task 1: Theme/render delta

Files: js/visuals/renderClock.js, app.js, css/visuals.css; focused Node/E2E, matrix/readme/testing/contract.
Interface: createRenderClock({initialFps=60}).step(time)->{sample,paint,fps}, recordPaint(ms), suspend(), reset(); rectVisible(rect,clip,width,height).

- [x] RED: cadence and30Hz independence, load/recovery hysteresis, no catch-up/backward clock, clipped rectangles; real mono variants/warning and actual Canvas overload/offscreen behavior.
- [x] GREEN: adaptive60/30/15 render budget heuristics, independent snapshots/history, clipped-panel paints and explicit RAF suspension/resume; no audio graph change.
- [x] UI: B&W Dark/Light subordinate to one of3 global themes; grayscale alert, unchanged App/device identity and layouts.
- [ ] Focused/full Node/build/verify/source/dist; one reviewer and targeted fix pass.
- [ ] Commit/push/PR exact-head mandatory CI and checkpoint; no merge/deploy.

Engineering defaults:2s evaluation windows, downgrade when average paint cost exceeds65% of current frame budget or RAF gap exceeds180%; upgrade only after3 stable windows with cost below40% and RAF gap below130% of the next higher budget. They are implementation heuristics, not measured MBP acceptance limits. Analyser snapshots remain best-effort main-thread sampling; continuous trigger/LUFS/recording worklets do not depend on Canvas. Endurance/real-device/owner acceptance remains pending.

Execution checkpoint18-Nov: one original read-only review, one Important Canvas visibility finding, no Critical findings. Header-only and zero-height regressions RED→GREEN; targeted browser11/11 after fix. Final original review report recovered without another audit; no re-review of fix. Author owns final suites, exact-head CI and PR checkpoint.
