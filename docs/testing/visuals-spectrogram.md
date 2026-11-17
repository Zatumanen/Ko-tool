# Spectrogram time history — ZAT-82

Baseline main@da62cd0ce496a2822d596c0ad8a49fecdbfdf009. ZAT-82 and23-Oct
roadmap section6 require new columns on the right, history moving left and
adaptive duration/detail, surviving resize and FPS changes. Existing paint uses
2CSSpx per paint and a Canvas bitmap destroyed on resize: decision FIX/BUILD.

Store timestamped copies of the existing1024byte FFT output; no device data or
fake playback. Bound to512frames/16seconds, at most one snapshot per30Hz bucket.
Each snapshot covers at most100ms; longer missing sampling intervals are blank,
not fabricated continuous audio. Hidden modules do not add history. Capture stop,
input change/disconnect and new sample rate reset history. Named-layout rerender,
theme, DPR and width changes recolor/reproject the same retained FFT measurements.

Visible duration is clamp(module CSS width/40,4,16)seconds. Raster detail is
bounded to512horizontal by128vertical samples. Timestamps determine horizontal
position independently of repaint count: newest right, older left. Vertical
log20Hz..min20kHz,lastbin uses peak magnitude per row band. Existing Web Audio
2048FFT byte normalization/smoothing is retained; no additional frequency
resolution, calibrated SPL, continuous recorder or lossless audio history claim.

Use bounded offscreen ImageData, reproject on resize, then draw at CSS dimensions
with the main Canvas DPR transform. Empty/zero FFT is background. This avoids
in-place drawImage(canvas) physical-pixel/CSS-coordinate drift.

Regression scope: timing/direction, repeated paints, narrow/wide history retention,
silence/gaps, sample-rate/reset, copy isolation/bounds, upward tone sweep. Browser
synthetic selected input checks actual pixels move upward with220→2200Hz, queue
survives viewport resize and stop releases the track. Node/build/browser/exact-head
CI results are kept in the PR checkpoint. Owner visual acceptance, performance on
MBP2017/endurance and physical EP USB Audio remain unverified/HIL PENDING.

Independent read-only review found no Critical/Important issue; extra vectors
covered60Hz coalescing,16s retention, capped raster,32kHz endpoint and blank gaps.
The browser resize case establishes retained queue count, while pure raster
vectors establish historical position/content across dimensions; an exhaustive
pixel-by-pixel resize comparison and sustained CPU profiling are not claimed.
