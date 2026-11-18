# Stereo Meter — ZAT-85 software contract

Baseline main@3e16ba0cb5605524b6b865057632478ed840bee3.23-Oct roadmap
section6 and ZAT-85 require a read-only MSED-like Plasma Vector Scope as the main
view, compact Correlometer/Stereo Balance and mono disabled. Existing code has
L/R bars and correlation only (including misleading0for silence): decision BUILD/FIX.

## Reference and implementation boundary

[Official Voxengo MSED page](https://www.voxengo.com/product/msed/), viewed17-Nov:
plasma is frequency-aware, with low frequencies outside/high frequencies toward
the center, plus correlation/balance meters. This is a visual/functional reference,
not a public algorithm specification. No Voxengo source, graphics or assets copied;
no exact rendering/algorithm equivalence claim. The independent projection below
is reviewable and numerically specified; owner aesthetic acceptance remains open.

## Numerical contract

Correlation is dot(L,R)/sqrt(sum(L²)sum(R²)), clamped to[−1,1]. It is undefined
if either channel has zero energy. Balance is (RMS_R−RMS_L)/(RMS_R+RMS_L), negative
left and positive right. Silence has undefined correlation/balance; mono disables
the whole stereo scope/metrics. Nonfinite/mismatched input is invalid, never a
fabricated neutral measurement. All input buffers are read-only.

Independently authored radix2 FFT2048 with periodic Hann window gives complex
L/R bins. For20Hz..min(20kHz,Nyquist), each bin's relative L/R amplitudes/phase form
an ellipse sampled at16phases. Display coordinates are ((R−L)/2,(R+L)/2), with
vertical common-mode and horizontal antiphase. Each bin ellipse is normalized by
its stronger channel **for display only**, then scaled by a logarithmic frequency
radius0.1..1(low outside, high inside). Brightness uses relative band energy.
This is not an absolute PCM level/SPL plot; correlation/balance use original PCM.

Density is bounded64×64,180ms exponential persistence from monotonic elapsed time.
Compact rendering max-reduces to32×32 before smooth Canvas enlargement so thin
traces survive. Reset on stop/source-format change; silence fades the old image
while numeric values become undefined. No audio Mid/Side processing or panning.
Raw stereo data already existed; no new capture/permission/transport is introduced.

## Channel format and tests

A diagnosed synthetic-browser race reported2channels initially then1 after graph
negotiation. The fake source now waits for its real configured channel count;
no metadata override or inference from equal channel values. Production sampling
also stops capture and disarms automatic reconnection if a known mono/stereo
channel format changes and requires START,
preventing stale analysis profiles. Capture generations/lifecycle remain intact.

Node vectors: phase/antiphase, one-sided, quadrature, silence/mono/invalid, no input
mutation, time decay/bounds, frequency radius/FFT phase and compact peak preservation.
Chromium synthetic signals verify actual plasma pixel geometry, correlation,
balance, silence, genuine negotiated mono and stop/close cleanup. FullNode/build/
source/dist and exact-head CI results are maintained in the PR checkpoint.
Owner aesthetic acceptance, sustained MBP2017/endurance and physical EP USB Audio
remain UNVERIFIED/HIL PENDING. No physical PASS or complete release is claimed.

Independent read-only review found noCritical/Important issue; extra probes
covered8/44.1/48/96/192kHz finite/bounded coordinates, density and normalized
weights. Removed unused per-sample point allocations from the metrics path;
geometry remains covered through the actual FFT projection and Canvas pixels.
