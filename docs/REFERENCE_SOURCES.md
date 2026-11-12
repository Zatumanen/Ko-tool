# Owner-supplied reference sources

Original review: 2026-10-19 (Europe/Moscow); expanded registry: 2026-11-12 (see dated appendix). K.O. Tool comparison base: `dac76e4`.
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

## Secondary references

| Source and evidence level | Already present in K.O. Tool | Useful next research / limits |
| --- | --- | --- |
| CHOPCHOP: static HTML/JS in `chopchop.txt`; `detectTransients`, `recomputeSlices`, `playSlice`, `runUploadRange`, `startRecording` | `js/audio/chopEngine.js`: transient/even/manual cuts; `chop.js`: per-range WAV rendering; waveform preview; My EP slot planner/upload | Compare the continuous slice → audition → assign slot → send workflow. Do not classify slicing itself as missing. Capture/recording is a separate behavior to scope, not permission to add microphone capture |
| TRKLS: `trkls_ep.html`, inline application and tour code; AGPL-v3-or-later notice | Sample browser, preview, drag/drop, properties and upload exist | Contextual onboarding and discoverability. No AI assistant is established by tour code. `trkls.js` appears to be Google tag/analytics code and is excluded as an EP implementation reference |
| [EP-133 Export to DAW](https://github.com/phones24/ep133-export-to-daw): repository README reviewed; AGPL-3.0 shown | Project reader, saved-project sequencer model, dependency/archive handling | DAW/MIDI export and mapping scenes/groups/pads; full export parity is not established. Its offline archive mode conflicts with our current connected-EP product boundary and is not adopted |
| [AudioBatchConverter](https://github.com/JanSchulten/AudioBatchConverter): README reviewed | Batch input, x2/−12, channel modes, trim and WAV output | Per-item speed/reverse/fades and sample chains are research candidates. README's ffmpeg/Qt implementation is not a browser DSP replacement; no general sample-chain implementation found in the inspected converter surface |
| [GWAAN-DAW](https://github.com/wadadawadada/GWAAN-DAW): README reviewed; MIT shown | Visuals has explicit browser audio-input selection; project sequencer exists | Multitrack recording, transport and clock UX are separate research topics. Visuals analysis is not a recorder; repository USB Audio claims do not certify our OS/browser/device combinations |
| [ep-series-sysex](https://github.com/kmorrill/ep-series-sysex): README reviewed; MIT shown; author describes firmware-scoped captures and confidence levels | Protocol spec, capability evidence, project reader, write preflight, recovery and HIL contracts | High-value secondary cross-check of saved records, FILE errors, scenes/patterns and evidence gaps. Verify source captures before adopting claims; no transport replacement or inherited hardware certification |
| [fx-mic-tool](https://github.com/oxo-yuta/fx-mic-tool): repository overview/README reviewed | No EP-2350-specific editor found in inspected project scope | Separate device/config editor and Web Audio preview; future scope, not an EP-133 feature to enable implicitly |
| EPToolkit `EPToolkit-1.9.1-macos.dmg`; EP-PatchStudio `EP-PatchStudio-universal.dmg` | No functionality inferred from package names in the original October review | October environment lacked DMG extraction; later static-only review identified packages, with details and limits in appendix B. No functional execution or hardware evidence |
| EP-133/EP-40 `.tfw` named 2.5.1 | Exact-firmware compatibility and HIL evidence already exist independently | Retained firmware containers; filenames and header bytes do not verify authenticity or device behavior. No flashing or firmware feature work |

In the original 2026-10-19 review, remote repositories were read through their public project pages, not cloned or pinned to a commit. The 2026-11-12 appendix pins subsequently reviewed repositories. Recheck/pin the relevant source file and license before implementation. No third-party code or artwork is imported by this document.

## Recommended investigation order

1. Official Sample Tool: compare upload preparation, WAV metadata round trips and FILE transition/error paths with current implementations and fixtures. Record source function/offset and expected result per case.
2. `ep-series-sysex` for independent protocol/record evidence; reconcile discrepancies with exact model/firmware captures. Keep ZAT-48 stabilization and ZAT-9 HIL ahead of feature growth.
3. CHOPCHOP/TRKLS for slice-to-slot UX and contextual help; focus on gaps around already implemented capabilities.
4. Export-to-DAW for saved-project representation and portability; other tools for individually scoped future features. Inspect both DMGs before making functional comparisons.

For every implementation finding record: source ID + hash/commit + function/offset → observation → current K.O. Tool module → gap → regression check → any separate hardware verification. Static source evidence is not a physical-device test.

## Expanded reference registry — 2026-11-12

**Snapshot and scope.** This dated appendix expands, but does not supersede or delete, the 2026-10-19 owner-supplied source review above. Comparison base: [K.O. Tool main e2e05f80](https://github.com/Zatumanen/Ko-tool/tree/e2e05f80dea83001428690ed4a1ffd6526ddb1d8). The previous review's `dac76e4` remains a historical comparison SHA. Source links, repository HEADs and uploaded-file hashes were rechecked on 2026-11-12; new source evidence is **not** a new K.O. Tool HIL test, release approval, code-change authorization, license clearance or claim of identical firmware behavior.

**Evidence hierarchy:** (1) official TE guide/changelog for public product behavior; (2) pinned reference source and raw device traffic for implementation details; (3) K.O. Tool hardware evidence only when model, exact firmware, backup and authoritative readback are recorded; (4) external repository, another developer's HIL, and community posts as independent leads. An official bundle is an implementation snapshot, not itself the protocol spec. Never promote fake EP, CI, third-party HIL or Reddit to K.O. Tool physical acceptance.

### A. Official and normative references

| ID | Source | Scope | Evidence boundary |
| --- | --- | --- | --- |
| O01 | [EP Sample Tool](https://teenage.engineering/apps/ep-sample-tool) | My EP, FILE_MOVE, upload, PCM/WAV/PAK | Live page may differ from U02 snapshot; no source map |
| O02 | [EP-133 guide](https://teenage.engineering/guides/ep-133) | KO II behavior, projects, sample workflow | Verify model + firmware before trusting write behavior |
| O03 | [EP-133 downloads](https://teenage.engineering/downloads/ep-133) | Changelogs/firmware chronology | Firmware distribution does not prove FILE semantics |
| O04 | [EP-40 guide](https://teenage.engineering/guides/ep-40) | Riddim differences | Never inherit EP-133 write rights |
| O05 | [EP-1320 guide](https://teenage.engineering/guides/ep-1320) | Medieval profile and limits | Unknown capability fails closed |
| O06 | [EP-2350 guide](https://teenage.engineering/guides/ep-2350) | FX-MIC config, presets, storage | Browser emulation is not hardware Live |
| O07 | [EP-2350 downloads](https://teenage.engineering/downloads/ep-2350) | Firmware notes; OS 1.1.2 dated 2026-09-07 | G11 hardware findings are for 1.0.8 |
| O08 | [EP-136 guide](https://teenage.engineering/guides/ep-136) | Sidekick USB Audio + MIDI | Physical channels ≠ browser-exposed channels |
| O09 | [MDN Web MIDI / Web Serial](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) | Browser MIDI/SysEx authorization | Web Serial separately: https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API |
| O10 | [MDN AudioWorklet / MediaDevices](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) | Visuals capture and worklets | MediaDevices separately: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices |
| O11 | [ITU-R BS.1770](https://www.itu.int/rec/R-REC-BS.1770) | Numerical loudness/true-peak specification | Requires reference test vectors and numeric validation |

### B. Original owner-provided reference files (private, hash inventory)

These hashes and sizes were checked against the **currently mounted owner files** on 2026-11-12. This records file identity, not permission to publish file contents. The original 2026-10-19 archive at `/workspace/work/ko-tool-references/2026-10-19/` remains historical and was not independently re-opened from this environment. The current attachment mount is not a durable archive. Store originals privately with access control, checksum and provenance; no DMG, firmware, third-party WASM or private captures are to be uploaded to public GitHub without separate approval.

| ID | Owner file | Bytes | SHA-256 | Role / limitation |
| --- | --- | ---: | --- | --- |
| U01 | `ep-sample-tool.txt` | 961 | `a2c043e8ee236853d6ac47e5aa16d7f938d088900d941fcaf7828a9630aa0e53` | Official app HTML snapshot |
| U02 | `index-C1wBjhTa.js` | 1800331 | `d032b3a1d9398663f313c54b671e366c5625f3612a2285ceaacad636cb5d7a98` | Official minified bundle; missing source map |
| U03 | `resample-BWif2rvd.wasm` | 214055 | `013809682a99d529ac363d0d186a709f31dceb762cffb9c1e270fc7b04e2f32e` | resample.wasm byte match |
| U04 | `001bd6c2.wasm` | 456112 | `a6ce5621b1d443f161360ca6663bf090b1c1afe78f733e8303ce009402e489b4` | libsndfile.wasm byte match |
| U05 | `0001eda2.wasm` | 31592 | `6a3c4bb81570644d7d2c01708727d8cb0a76e8be188a5aea899d3c0fd6f663ef` | libtag_c.wasm byte match |
| U06 | `002d35b6.wasm` | 740717 | `eec9cc9f996c571924d0aea5f1e2509066994441369941c606f0311dddbe7ef8` | libtag.wasm byte match |
| U07 | `005a3d5a.wasm` | 1478486 | `ac3242a402b27d6bed9686dc32a10ada2f49511c9cd09dc03be303e5ef66fa9d` | libsamplerate.wasm byte match |
| U08 | `chopchop.txt` | 132885 | `9845cc0d98e9c8b72bd4472df7637a6c0c0ea0131d078882338acffc5ae33770` | CHOPCHOP source snapshot |
| U09 | `trkls_ep.html` | 867896 | `37a102a77215a0dfc58a767989cc77a86977f26cd6a328b31f425ee457a3aea5` | TRKLS interface/source snapshot |
| U10 | `trkls.js` | 533470 | `58dfab5f8cec9d348fd503afdadf21781469b2e875c24e0091c01010a014e2d0` | Google analytics, not EP behavior evidence |
| U11 | `EPToolkit-1.9.1-macos.dmg` | 14427967 | `89b3ab2c60e44e60bfb0db4edf10da12423453e7d8e3e82241cd6e386d4f9dcb` | Installer, static analysis only |
| U12 | `EP-PatchStudio-universal.dmg` | 26447487 | `20a24e0a6944148cd4cbcd7d01867627b376bde8e6c21d84fdabf9fcfedd8227` | Installer, static analysis only |
| U13 | `ep-133_firmware_2_5_1 (1).tfw` | 479768 | `94241d87078b6de0404c61d941f9f2214cabe4195d7d89a5a62e83910915b67d` | Firmware filename does not attest authenticity |
| U14 | `ep-40_firmware_2_5_1.tfw` | 479776 | `66ece60f0db566b0f38c7d862bc35c8ab3c15e61c2b97222f30f5df7567a98d5` | Firmware filename does not attest authenticity |
| U15 | `DAW.txt` | 41 | `33aab0c42fd9d47c6116bc3709af2211e3568d4314e19dbcdb1009cba86b0375` | Pointer to G09 |
| U16 | `секвенсер.txt` | 47 | `b3c70d4e415f3647fba81fce7e5aef78848bc7f2cca4d5ee1ce49ff47a3d719a` | Pointer to G06 |
| U17 | `ep-series-sysex.txt` | 43 | `43bc85c16a0188fc31bbb7b7d723fe48dde4057eea4884f847726696a331ac97` | Pointer to G02 |
| U18 | `EP–2350-config.json.txt` | 39 | `13a8b170a53eb62c8c048389b0a7bba212c42309cc6c3b97b4e62d709a95b19c` | Pointer to G10 |
| U19 | `This-is-a-free-audio-converter-that-can-quickly-pitch-audio-files-up-or-down-in-.txt` | 50 | `db08accfe90c05ca6958f454e28208cd4daa435301ba40c811dcfacf6802daed` | Pointer to G08 |

U03–U07 are the owner-supplied binaries previously found byte-identical to the five `js/ep133/wasm/` modules. Identity of binaries does not establish JS wrapper, UX or DSP-output equivalence. U11/U12 underwent **static-only** inspection in the later owner research (EP Toolkit 1.9.1 and EP-PatchStudio 1.6.0 identified from package metadata); neither application was executed or certified. U13/U14 were not flashed and their filenames do not attest firmware authenticity. U10 was identified as analytics/tag script, not a TE FILE reference.

### C. Pinned external GitHub repositories

URLs below identify the source snapshot examined in the research. `GitHub license` is the API-reported top-level SPDX identifier on 2026-11-12, **not** a complete license audit of source files, transitive dependencies or binary resources; `not reported` does not imply permission to reuse. The older review above records earlier README-only research and remains part of the history.

| ID | Pinned source | GitHub license | Relevance and trust limit |
| --- | --- | --- | --- |
| G01 | [bnjreece/awesome-te @ 02c9fb3c95](https://github.com/bnjreece/awesome-te/tree/02c9fb3c95b7fa4bae954be4d7ae795396d10e93) | CC0-1.0 | Directory of TE tools; discovery only |
| G02 | [kmorrill/ep-series-sysex @ 891a905c5f](https://github.com/kmorrill/ep-series-sysex/tree/891a905c5faf8b5c7b0ae1bdfee260c21f7417eb) | MIT | FILE/SysEx research, firmware-scoped evidence, source cross-check |
| G03 | [icherniukh/ep133-krate @ 40359e0004](https://github.com/icherniukh/ep133-krate/tree/40359e000484885e46b3402c0bf3eccb6e576825) | MIT | Independent EP sample FILE implementation |
| G04 | [trusch/ko2-io @ 3d5622f5f1](https://github.com/trusch/ko2-io/tree/3d5622f5f1629092e12a06b787933c831d055d3b) | MIT | Rust/FUSE filesystem, sample IO, project comparison |
| G05 | [garrettjwilke/ep_133_sysex_thingy @ d7325a7fb8](https://github.com/garrettjwilke/ep_133_sysex_thingy/tree/d7325a7fb88a8f3654657332a9809af63877a1b5) | not reported | Older SysEx examples; not firmware 2.5.1 evidence |
| G06 | [phones24/ep133-export-to-daw @ db8f439879](https://github.com/phones24/ep133-export-to-daw/tree/db8f4398792ad9d2dceec825033514c0453905d0) | AGPL-3.0 | Saved project scenes/patterns, DAW/MIDI export reference |
| G07 | [ZacharySBrown/ep133-ppak @ 93f0f6b1f6](https://github.com/ZacharySBrown/ep133-ppak/tree/93f0f6b1f6110701e6378e2702f39fd7e9a9d687) | MIT | PPAK/pattern generation and native TAR research |
| G08 | [JanSchulten/AudioBatchConverter @ f7c57a558c](https://github.com/JanSchulten/AudioBatchConverter/tree/f7c57a558cebe0d4bf205be64ce88fa81386ad39) | not reported | Batch UX; not a replacement for canonical DSP |
| G09 | [wadadawadada/GWAAN-DAW @ e76e054bf4](https://github.com/wadadawadada/GWAAN-DAW/tree/e76e054bf494de801377bcde1a4e65618d877337) | MIT | DAW UX, tracks and transport |
| G10 | [oxo-yuta/fx-mic-tool @ a61bb5550c](https://github.com/oxo-yuta/fx-mic-tool/tree/a61bb5550c84800a63758d3f0fbdbcff6dc4f491) | not reported | FX-MIC config validator and Web Audio preview; not physical Live |
| G11 | [brunomarinho/labs-te-ting-preset @ 0afd1aafc5](https://github.com/brunomarinho/labs-te-ting-preset/tree/0afd1aafc5daafe2ed1e05b60c202707a95eed57) | not reported | Web Serial + MicroPython REPL, device hardware tests for 1.0.8 |
| G12 | [hirbehozo/ep-rec-field-recorder @ 20636b90fc](https://github.com/hirbehozo/ep-rec-field-recorder/tree/20636b90fc9b1496c599689706705d34a6843af3) | not reported | EP-136 recorder, AudioWorklet and missing-frame diagnostics |
| G13 | [lcweden/loudness-worklet @ 887c0dd605](https://github.com/lcweden/loudness-worklet/tree/887c0dd60503a357d766f7db5837c6937d19e3db) | MIT | AudioWorklet loudness reference; verify BS.1770 numerically |
| G14 | [audiojs/loudness @ 40622e45de](https://github.com/audiojs/loudness/tree/40622e45deb6ef42e61219a53c575c807e84be99) | NOASSERTION | LUFS/true peak implementations; check subpackage licenses |
| G15 | [CrabbTech/ko-bridge @ d40fa3e275](https://github.com/CrabbTech/ko-bridge/tree/d40fa3e2752e1a2921a4fe9a8ec5e8ca27f36ff3) | MIT | EP-133 MCP/HIL methodology, checkpoints and readback |
| G16 | [wil-gerard/ep133-mcp @ 26395091de](https://github.com/wil-gerard/ep133-mcp/tree/26395091de84fb18be4a0a8caa7a45a8711b5dae) | MIT | EP-133 MCP, sample/project IO, backup and restore |
| G17 | [di-sukharev/vibe @ d3a028be36](https://github.com/di-sukharev/vibe/tree/d3a028be361e2cf8a28c832022a68c5548612457) | Apache-2.0 | Historical template; verify imported-content attribution |

**Additional field lead, not yet pinned as a GitHub repository:** [GOROman EP-136 MIDI CC gist](https://gist.github.com/GOROman/9d47019539823b119c663e1bb1034445). Treat controller maps as unofficial and firmware-unverified until a complete capture is assessed. The source and reuse conditions must be checked before any adoption.

### D. Reddit: reports to turn into test scenarios, not verified defects

These six URLs were collected in earlier research. Direct content retrieval in the 2026-11-12 documentation pass was **not successful**; entries are provisional pointers, not revalidated accounts of the linked posts. A URL's appearance here is not a bug reproduction, official claim, HIL record or permission for hardware actions.

| ID | Provisional discussion | Test candidate |
| --- | --- | --- |
| R01 | [EP-136 USB Audio / Ableton](https://www.reddit.com/r/teenageengineering/comments/1tpxdam/) | Device routing, USB OUT, macOS audio permissions |
| R02 | [EP-136 recording pops/clicks](https://www.reddit.com/r/teenageengineering/comments/1tmogf2/) | Record dropouts and channel diagnostics |
| R03 | [EP-133 / EP-40 firmware hotfix](https://www.reddit.com/r/teenageengineering/comments/1umg97l/) | Regression prompts after firmware updates |
| R04 | [PAK restore with issues](https://www.reddit.com/r/teenageengineering/comments/1wrtv54/) | Unresolved references / false-positive restore success |
| R05 | [EP-40 bugs and crashes](https://www.reddit.com/r/teenageengineering/comments/1v1oppw/) | Firmware-scoped trim/stretch stability |
| R06 | [EP-2350 config.json issues](https://www.reddit.com/r/teenageengineering/comments/1pv1tji/) | Backup/restore and configuration validation |

### E. Engineering use by release stage

| Approved stage | First sources | Specific questions and limits |
| --- | --- | --- |
| My EP (ZAT-76 / ZAT-9) | O01, U02, G02–G04, G15–G16 | Compare FILE_MOVE, source/target occupancy and CRC, timeout ambiguity, project remap and recovery. Do not auto-retry/reverse after a timeout, lower firmware gates or invent new device-write HIL. |
| SpeedUpperCut / REPITCH | U02–U08, G08, `docs/testing/audio-x2-pipeline.md` | Preserve byte-verified PCM/WAV/metadata, x2 with -12 metadata; pitch=-12 alone is insufficient proof that input PCM is already accelerated. |
| Visuals | O10–O11, G12–G14, `docs/VISUALS.md` | Current meter is RMS dBFS (not LUFS). Validate LUFS M/S/I with reference vectors, AudioWorklet capture, recorder frames and browser/OS constraints. |
| Standalone Sequencer | O02–O05, G02, G04, G06–G07, `docs/SEQUENCER.md` | Saved native scenes/patterns/TAR unknown members; standalone icon remains a connected-EP-only owner decision. External offline editors are references, not scope changes. |
| FX-MIC Studio EP-2350 | O06–O07, G10–G11, `docs/roadmap/KO_TOOL_1_0_DECISIONS_2026-10-23.md` | G11 implements Web Serial/MicroPython REPL. Its [BUS hardware report](https://github.com/brunomarinho/labs-te-ting-preset/blob/0afd1aafc5daafe2ed1e05b60c202707a95eed57/docs/BUS-ROUTING-PLAN.md) documents EP-2350 fw 1.0.8 and `fx.param(..., BUS, ...)` freezing the device; bus audio routing has **contradictory observations**. Official OS 1.1.2 is a separate firmware and requires fresh safety evidence. No arbitrary REPL writes. |
| EP-136 Sidekick | O08, O10, G12, GOROman gist, R01–R02 | USB Audio/MIDI for Visuals only, not EP-133 FILE. Physical channel count does not guarantee selectable multichannel inputs in Chrome/macOS. |

### F. Integrations, provenance and maintenance

- GitHub and Linear are authoritative for code/CI and ticket decisions respectively. Firecrawl/Context7 are research/documentation helpers; Figma is for UI, Superpowers for workflows. PostHog is a possible future privacy-scoped diagnostics service. No plugin or account connection means instrumentation, SDK, telemetry collection, browser recording or cloud deployment was enabled in K.O. Tool.
- Before each implementation: pin repo commit and file/function, record license of **actual** code/assets, compare to current K.O. Tool module/tests and firmware evidence, write a narrow regression scenario and identify needed HIL separately.
- For reproducibility record: source ID, URL or original file hash, observation at exact code location, applicability by device and firmware, conflicting findings, intended K.O. Tool module, regression, HIL state and Linear ticket.
- Security: preserve transaction ownership, readback, recovery and exact firmware gating; no third-party MCP server with EP write access without explicit scenario-specific owner authorization.
- Licensing remains unresolved for third-party binary redistribution and missing/ambiguous licenses. Preserve notices and verify any Vibe-derived work/Apache-2.0 conditions before release; no external source code, installers or firmware were added by this documentation update.
- Canonical home is this file; Linear [ZAT-70](https://linear.app/clouded/issue/ZAT-70) tracks documentation and licensing, while [ZAT-76](https://linear.app/clouded/issue/ZAT-76) tracks the MOVE-specific follow-up. This registry update does not close either issue or authorize application-code changes.
