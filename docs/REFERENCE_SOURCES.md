# Owner-supplied reference sources

Reviewed: 2026-10-19 (Europe/Moscow). K.O. Tool comparison base: `dac76e4`.
Owner priority: **the official EP Sample Tool is the primary implementation-behavior reference**. Other applications are secondary sources of useful workflows and feature ideas. This research does not authorize feature implementation or change the approved product boundaries.

## Retained materials

Local library: `/workspace/work/ko-tool-references/2026-10-19/`.

- `originals/`: both original uploaded ZIP files, unchanged.
- `artifacts/part-1/` and `artifacts/part-2/`: 19 extracted files, read-only copies.
- `manifest.json`: byte sizes, SHA-256 for both archives and every file, and exact matches with existing K.O. Tool WASM.
- `README.md`: navigation and retention limits.

This is local cloud-workspace retention, not a remote backup. If this workspace is deleted or replaced, restore the library from the owner's original archives. Raw third-party files stay outside the public repository. No third-party application, uploaded JS/WASM, installer or firmware has been executed in this review. REA has not been installed or invoked.

## Primary: official EP Sample Tool

Source: user-provided `ep-sample-tool.txt` (HTML), which directly references `index-C1wBjhTa.js` and identifies its canonical page as <https://teenage.engineering/apps/ep-sample-tool>. Bundle SHA-256: `d032b3a1d9398663f313c54b671e366c5625f3612a2285ceaacad636cb5d7a98`.
This identifies the supplied snapshot; it is not a verification of the current live release. The referenced `index-C1wBjhTa.js.map` is missing.

### Exact existing binary matches

All five supplied WASM files are **byte-identical** to existing K.O. Tool modules:

| Supplied file | Existing file in `js/ep133/wasm/` |
| --- | --- |
| `resample-BWif2rvd.wasm` | `resample.wasm` |
| `001bd6c2.wasm` | `libsndfile.wasm` |
| `0001eda2.wasm` | `libtag_c.wasm` |
| `002d35b6.wasm` | `libtag.wasm` |
| `005a3d5a.wasm` | `libsamplerate.wasm` |

The main bundle directly references the named resampler; the existing K.O. Tool loader names the other four dynamic libraries in `js/ep133/resampler.js`. All hashes were recomputed after preservation. Matching binaries do not establish equivalence of JS wrappers, browser decoding, UX or hardware behavior.

### Behavior comparison

Evidence anchors below are searchable symbols in the supplied bundle, rather than unstable line numbers in minified code.

| Reference evidence | Current K.O. Tool evidence | Implementation use |
| --- | --- | --- |
| `DeviceService.getTargetSampleRate`: supported PCM format, maximum/native rate, fallback 46875 | `js/ep133/audio.js`: `getTargetSampleRate` follows the same selection structure | Regression reference for supported rates/channels; no second audio pipeline |
| `DeviceService.uploadSound`: 40-second limit, input rate 3000–768000, direct extraction of compatible s16 WAV, resampling otherwise | `prepareEp133Sample` / `inspectEpReadyWav` in `js/ep133/audio.js` implement corresponding checks and fast path | Compare fixtures for direct PCM, AIFF/browser decode and malformed input; not yet full output-equivalence proof |
| `prepareTeenageMeta`, `cleanTeenageMeta`, `validators`: embedded JSON, loop-point scaling, root note/BPM and parameter checks | `prepareTeenageMetadata` in `js/ep133/audio.js`; writable/create metadata handling in `sampleFilesystem.js` | Compare edge cases and round trips without broadening writable keys |
| `DeviceService.downloadSoundAsWav`: reconstruct WAV with loop/pitch/envelope and other metadata | `js/audio/audioEngine.js`: `buildReferenceAudioMeta`, `encodeReferenceEpWav`; sample read/export controllers | Preserve playback metadata through export/import; reuse existing WAV writer |
| FILE handlers, CRC routines, upload then metadata update and session initialization | `fileTransport.js`, `sampleFilesystem.js`, `sampleTransactionRuntime.js`, upload/verification controllers | Map exact FILE transitions before optimization; keep our firmware permissions, readback and recovery checks |
| Official direct upload has no explicit x2/−12 step in the inspected path | `js/audio/processor.js` implements converter x2/−12; My EP upload is separate | Preserve the product distinction; this review does not implement future REPITCH |

Relevant existing verification surfaces: `tests/audio-pipeline-golden.test.mjs`, `filesystem-metadata.behavior.test.mjs`, `sample-upload-name-normalization.test.mjs`, and FILE golden fixture/replay tests. Their presence is not a new passing test or hardware result.

Follow-up comparison (2026-10-19): native s16 WAV upload skipped standard `smpl` root-note/loop metadata while retaining TE JSON. A synthetic WAV was checked with the repository's existing reference WASM: root note 60, loop start 4 and loop end 19. The fast path now extracts those fields before the existing metadata-precedence/validation rules; `tests/ep-wav-sampler-metadata.test.mjs` covers chunks before/after PCM, TE JSON precedence and unchanged PCM bytes. This is a software regression baseline, not EP hardware acceptance.

## Secondary references

| Source and evidence level | Already present in K.O. Tool | Useful next research / limits |
| --- | --- | --- |
| [Best Friend pad settings](https://epbf.app/docs/edit-pad-settings) and [bank navigation](https://epbf.app/docs/see-a-bank-of-pads): developer documentation reviewed 2026-10-19; owner-selected pad behavior reference | Sample-library defaults and a guarded inactive-project editor exist; these are separate from live assigned-pad editing | Target selection, per-pad pitch/play/time parameters, hardware-event refresh and gesture-release writes. [Design](superpowers/specs/2026-10-19-my-ep-pad-properties-design.md). App binary/source was not supplied; documentation is UX evidence, not new firmware/write certification |
| CHOPCHOP: static HTML/JS in `chopchop.txt`; `detectTransients`, `recomputeSlices`, `playSlice`, `runUploadRange`, `startRecording` | `js/audio/chopEngine.js`: transient/even/manual cuts; `chop.js`: per-range WAV rendering; waveform preview; My EP slot planner/upload | Compare the continuous slice → audition → assign slot → send workflow. Do not classify slicing itself as missing. Capture/recording is a separate behavior to scope, not permission to add microphone capture |
| TRKLS: `trkls_ep.html`, inline application and tour code; AGPL-v3-or-later notice | Sample browser, preview, drag/drop, properties and upload exist | Contextual onboarding and discoverability. No AI assistant is established by tour code. `trkls.js` appears to be Google tag/analytics code and is excluded as an EP implementation reference |
| [EP-133 Export to DAW](https://github.com/phones24/ep133-export-to-daw): repository README reviewed; AGPL-3.0 shown | Project reader, saved-project sequencer model, dependency/archive handling | DAW/MIDI export and mapping scenes/groups/pads; full export parity is not established. Its offline archive mode conflicts with our current connected-EP product boundary and is not adopted |
| [AudioBatchConverter](https://github.com/JanSchulten/AudioBatchConverter): README reviewed | Batch input, x2/−12, channel modes, trim and WAV output | Per-item speed/reverse/fades and sample chains are research candidates. README's ffmpeg/Qt implementation is not a browser DSP replacement; no general sample-chain implementation found in the inspected converter surface |
| [GWAAN-DAW](https://github.com/wadadawadada/GWAAN-DAW): README reviewed; MIT shown | Visuals has explicit browser audio-input selection; project sequencer exists | Multitrack recording, transport and clock UX are separate research topics. Visuals analysis is not a recorder; repository USB Audio claims do not certify our OS/browser/device combinations |
| [ep-series-sysex](https://github.com/kmorrill/ep-series-sysex): README reviewed; MIT shown; author describes firmware-scoped captures and confidence levels | Protocol spec, capability evidence, project reader, write preflight, recovery and HIL contracts | High-value secondary cross-check of saved records, FILE errors, scenes/patterns and evidence gaps. Verify source captures before adopting claims; no transport replacement or inherited hardware certification |
| [fx-mic-tool](https://github.com/oxo-yuta/fx-mic-tool): repository overview/README reviewed | No EP-2350-specific editor found in inspected project scope | Separate device/config editor and Web Audio preview; future scope, not an EP-133 feature to enable implicitly |
| EPToolkit `EPToolkit-1.9.1-macos.dmg`; EP-PatchStudio `EP-PatchStudio-universal.dmg` | No functionality inferred from package names | Retained for later extraction/static inspection. Application contents, actual versions, architectures and feature lists remain unverified; no suitable DMG unpacker found in this environment |
| EP-133/EP-40 `.tfw` named 2.5.1 | Exact-firmware compatibility and HIL evidence already exist independently | Retained firmware containers; filenames and header bytes do not verify authenticity or device behavior. No flashing or firmware feature work |

Remote repositories were read through their public project pages, not cloned or pinned to a commit. Recheck/pin the relevant source file and license before implementation. No third-party code or artwork is imported by this document.

## Recommended investigation order

1. Official Sample Tool: compare upload preparation, WAV metadata round trips and FILE transition/error paths with current implementations and fixtures. Record source function/offset and expected result per case.
2. `ep-series-sysex` for independent protocol/record evidence; reconcile discrepancies with exact model/firmware captures. Keep ZAT-48 stabilization and ZAT-9 HIL ahead of feature growth.
3. CHOPCHOP/TRKLS for slice-to-slot UX and contextual help; focus on gaps around already implemented capabilities.
4. Export-to-DAW for saved-project representation and portability; other tools for individually scoped future features. Inspect both DMGs before making functional comparisons.

For every implementation finding record: source ID + hash/commit + function/offset → observation → current K.O. Tool module → gap → regression check → any separate hardware verification. Static source evidence is not a physical-device test.
