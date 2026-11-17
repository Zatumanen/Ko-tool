# BS.1770 Loudness — ZAT-84 software contract

Baseline main@3e16ba0cb5605524b6b865057632478ed840bee3. The23-Oct roadmap
section6 and ZAT-84 require real LUFS: M400ms, S3s, I/reset; existing Loudness
paints RMS dBFS. Decision BUILD, authorized by17-Nov software completion scope.

## Sources and provenance

- [ITU-R BS.1770-5, November2023](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en),
  [normative PDF](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-5-202311-I!!PDF-E.pdf):
  Annex1, K-filter tables1/2, equations2–7, channel gains,400ms/75%overlap,
  absolute−70 and relative−10LU gates. Relevant first14pages read via PDF retrieval;
  no claim of implementing immersive/true-peak annexes.
- [EBU Tech3341 v4, November2023](https://tech.ebu.ch/docs/tech/tech3341.pdf):
  supplementary EBU meter specification; M/S windows follow the approved contract.
- Registered G13 lcweden/loudness-worklet@887c0dd60503a357d766f7db5837c6937d19e3db:
  biquadratic-filter.ts, common/constants.ts, utils/k-weighting.ts and
  utils/loudness.ts reviewed, MIT. No source copied.
- Independent oracle: FFmpeg7.1.5-0+deb13u1 `ebur128=metadata=1,ametadata=print`.
  Native code/tool is used only to generate results, not imported into the app.
  `node scripts/generate-loudness-golden.mjs` rechecks the oracle when FFmpeg
  is installed; `--write` explicitly regenerates. No FFmpeg CI/runtime dependency.
  Fixture JSON stores signal specifications, PCM SHA256, reference edition and
  M/S/I values. PCM generators are independently authored synthetic sine/noise.

## Algorithm and bounds

Separate silent AudioWorklet consumes every PCM frame independent of display FPS
or hidden panels. Known mono/stereo channels only; each has independent K filter.
Published48k coefficients are bilinear-remapped for supported rates16/22.05/24/32/
44.1/48/88.2/96/176.4/192kHz. Other rates/channel layouts show unavailable.

100ms energy hops form complete400ms M and3s S windows. I uses400ms blocks with
75% overlap,−70LUFS absolute gate then exact relative gate10LU below the absolute-
gated mean. One-LU index buckets store exact energies/sums: boundary bucket values
are tested individually, not rounded/quantized for gating. Mono is not doubled;
stereo sums channel energies irrespective of phase. Silence is−infinity, incomplete
windows WAIT. Nonfinite/mismatched input invalidates results until Reset.

Session storage is bounded to four measured hours. The last supported sample is
valid; exceeding the bound displays an error requiring Reset, never silently
truncates Integrated. Maximum ~144k gating blocks; recent energy ring30hops.
Delivery is at most one unacknowledged summary; audio computation continues while
UI stalls. Reset epochs and capture generations reject old results. Stop/source
change closes worklet port/context and clears UI; processor failure stays unavailable
until capture restart. Reset does not request permission or replace the stream.

## Verification and limits

18 independent FFmpeg vectors: ten sample rates, stereo/antiphase, absolute and
relative gating, densely populated threshold bucket, noise, bass/treble. Tolerance
0.1LU; observed maximum error0.026824LU. Analytic997Hz full-scale mono≈−3.01LUFS.
Tests cover block partitioning, no input mutation, silence/warmup, invalid data,
ACK backpressure, reset/capture fences, processor failure and four-hour sample cap.
The accelerated four-hour PCM test is **not browser endurance or hardware HIL**.
Real Chromium synthetic mono997Hz tests verify M/S/I, Reset without new access,
track cleanup and explicit lack of AudioWorklet. FullNode/build/source/dist/CI
results and exact SHA are recorded in the PR checkpoint.

This is mono/stereo LUFS software, not SPL calibration, LRA or true-peak support.
Official EBU compliance-suite certification, owner visuals, MBP2017 load/endurance
and physical EP USB Audio remain unverified/HIL PENDING. No deployment or device
operation follows from passing synthetic tests.
