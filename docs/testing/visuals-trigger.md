# Visuals Waveform trigger — ZAT-80 software contract

Baseline main@da62cd0ce496a2822d596c0ad8a49fecdbfdf009. Roadmap23-Oct
section6 and ZAT-80 require an attack-centered held waveform, flat left portion,
decay to the right, sensitivity/time/amplitude/hold. The previous app paints
only an untriggered Analyser snapshot; no trigger implementation exists there.
Decision BUILD, authorized by the17-Nov software-completion instruction.

Continuous AudioWorklet PCM drives a sample-clock detector, independently of
Canvas FPS. Absolute amplitude crosses the sensitivity threshold after rearming
below half threshold. A frame has a blank left half and captures actual incoming
PCM into its right half; it persists until a later eligible attack. Hold is a
minimum interval from attack (and never shorter than capture), not an expiry of
the held display. No synthetic decay or device transport/playhead is generated.
Stereo is averaged to mono for this waveform. Time10–1000ms is the full display;
amplitude0.1–10 affects display only. Threshold0.001–1 (lower is more sensitive)
and hold0–3000ms are session controls; edits reset acquisition, not audio capture.

Worklet output is silent, connected through the existing zero-gain sink. Stop,
close, input loss and source changes close the context and worklet port; stale
messages cannot cross capture generations. Worklet load failure fails capture
closed. Browsers without AudioWorklet cannot provide this trigger; this scope
makes no physical EP USB Audio or timing/latency guarantee.

Node vectors cover polarity, silence, boundary-spanning attacks, hold/rearm,
unchanged input and settings reset. Browser tests must establish a real worklet
trigger count with synthetic selected audio and exercise controls and stop.
Full suites and exact-head CI are recorded in the PR. The original owner video
has not been independently recovered for pixel/subjective matching; owner visual
acceptance and physical input acceptance remain UNVERIFIED/HIL PENDING.

Independent review found unbounded transferable snapshots and an invalid threshold
step; fixed with one-inflight ACK/latest-state coalescing and step0.001. A stalled
consumer regression asserts one message across2000audio blocks. Min/max display
columns preserve single-sample attacks when the Canvas is narrower than PCM.
