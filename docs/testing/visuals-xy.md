# Oscilloscope Stereo XY / Artistic XY — ZAT-83

Baseline main@3e16ba0cb5605524b6b865057632478ed840bee3.23-Oct roadmap
section6 and ZAT-83 approve direct StereoXY (L→X,R→Y), separately labeled
ArtisticXY for mono/aesthetics and natural phosphor afterglow without a trail
control. The prior Oscilloscope draws the mix time trace: decision BUILD.

Reuse the existing left/right time-domain analysers and selected-input lifecycle.
Technical StereoXY uses synchronous PCM L as horizontal, R as upward vertical,
equal units per pixel on both axes, display clipping at±1, no rotation, invented
second channel or interpolation. Without two reported input channels show
MONO/NO STEREO. Nonfinite samples break the path rather than bridging a gap.

ArtisticXY is explicitly DERIVED: mono mix versus its1.7msdelayed values within
the same snapshot. This is an aesthetic phase-space plot, not an independent
right channel or a measurement of physical stereo. Silent/cancelled mix stays
silent. Switching modes clears previous traces and never restarts capture.

Afterglow retains at most16frames and400ms, exponential90msdecay by elapsed time,
not per repaint. Clear history on capture stop, source change/disconnect and
mode change. Resize/theme redraw retained points on the current square axes.
No user trail control, MIDI/FILE change, foreign code/assets or new dependency.

Node vectors: phase, antiphase, one-sided, mono/derived separation, immutable
input, time-based aging, bound/reset. Real Chromium synthetic-channel tests
check phase/antiphase diagonal covariance from pixels, explicit mode switching,
mono refusal, Artistic availability and track cleanup. FullNode/build/E2E/dist
and exact-head CI evidence belongs in the PR checkpoint. Owner visual acceptance,
phosphor aesthetics, sustained CPU/endurance and physical EP USB Audio remain
UNVERIFIED/HIL PENDING; no completed release or hardware claim.

Independent read-only review found noCritical/Important issue. Extra vectors
covered asymmetric axes, nonfinite path breaks, snapshot isolation, expiry and
backward clock reset. Browser mode-switch test asserts request count and stream
identity stay unchanged; direct visual afterglow clearance is covered by the
model/reset path rather than a separate pixel comparison. Frequent repaints
coalesce into30Hzbuckets without adding audio measurements.
