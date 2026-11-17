# Spectrum curve — ZAT-81 software contract

Baseline main@da62cd0ce496a2822d596c0ad8a49fecdbfdf009. Approved23-Oct
roadmap section6 specifies a soft continuous spectrum, FabFilter Pro-Q3 aesthetic
only, without EQ/Range/Tilt/Freeze. ZAT-81 requires correct axes, smoothing,
stable decay and synthetic/browser validation. No third-party code/assets reused.

Existing paint(spectrum) uses12–64rectangular bars over byte magnitudes with a
quadratic frequency mapping. Decision BUILD replaces that renderer with a line
on a labeled logarithmic20Hz–min(20kHz,last FFT bin) axis and−100..0dBFS FFT.
A separate8192-point AnalyserNode supplies float magnitudes with WebAudio FFT
windowing. Spectrogram retains the original2048-point byte analyser and smoothing.
The plotted curve is peak magnitude per log display band (not integrated band
power, SPL, LUFS or a calibrated measurement of physical EP output). Adjacent-bin
interpolation fills sub-bin display points without claiming extra resolution;
FFT resolution is sampleRate/8192. Silence/nonfinite bins map to−100dBFS.

An exponential40msattack/300msrelease uses elapsed monotonic time, not a fixed
per-paint decay. Equal-duration release is tested at15/30/60FPS. Reset on capture
stop/disconnect prevents a previous input's display from surviving a new session.
No frequency-dependent tilt, EQ control or copied reference assets are included.

Tests: isolated bin/tone peaks, log ratio and Nyquist bounds, nonfinite/range
handling, immutable input and FPS-independent release. Real-browser synthetic
220Hz selected stream validates float analyser→curve→Canvas and stop. Full suites,
exact PR SHA and CI run are kept in the PR checkpoint. Owner aesthetic acceptance,
music/listening comparison and physical EP USB Audio remain unverified/HIL PENDING.
