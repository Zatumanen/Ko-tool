# FX-MIC Studio — stage 05 implementation and acceptance

## Authorization and scope

On 2026-11-15 the owner explicitly approved starting ZAT-50 ahead of
ZAT-63/ZAT-48/ZAT-9, on a separate branch. This changes the start order, not
the outstanding acceptance of those issues. Physical EP-2350 writes, merge
and Pages deployment still require separate authorization. ZAT-50 remains
incomplete until physical USB Live and owner acceptance.

Baseline: main bbb8260b649e06374252cd8d6c2113896f870523. Static HTML/CSS/native
JavaScript, Node 22; no new dependencies, firmware changes or arbitrary REPL.

## Evidence and profiles

| Reference | Revision | Finding and boundary |
| --- | --- | --- |
| [Official guide](https://teenage.engineering/guides/ep-2350) §§6–7 | viewed 2026-11-15 | Four slots; mono/stereo WAV PCM8/16/24 or float32, <=96kHz; approximately 1MB; name/samples/presets, row modulation, BUS1/2. Exact usable capacity unspecified. |
| [Downloads](https://teenage.engineering/downloads/ep-2350) | stock OS1.1.2, 2026-09-07 | JSON parser regression fix since1.0.9; no public Live guarantee. |
| [A Thing for Ting](https://ting.supervisedmusic.com/) / [source](https://github.com/brunomarinho/labs-te-ting-preset/tree/0afd1aafc5daafe2ed1e05b60c202707a95eed57) | G11 0afd1aafc5daafe2ed1e05b60c202707a95eed57 | events.js:1076 release-only sliders; webusb.js:269 prompt-or-timeout response, :395 fx.param without mandatory readback. Connect sends Ctrl+C and imports select slot0; not safe read-only connection semantics to copy. No root license found. |
| [BUS report](https://github.com/brunomarinho/labs-te-ting-preset/blob/0afd1aafc5daafe2ed1e05b60c202707a95eed57/docs/BUS-ROUTING-PLAN.md#L165) | third-party fw1.0.8 | BUS live writes freeze; conflicting audio routing observations. Not our HIL or evidence for1.1.2. |
| [Tadao314](https://github.com/Tadao314/ep2350-config-editor/tree/687df5695894262d2c4bd9be6e3b64a45fef94a1) | 687df5695894262d2c4bd9be6e3b64a45fef94a1 | index.html:621 row remap; :1054 import drops/clamps fields, not lossless. EQ q case uncertain. MIT. |
| [oxo-yuta](https://github.com/oxo-yuta/fx-mic-tool/tree/a61bb5550c84800a63758d3f0fbdbcff6dc4f491) | G10 a61bb5550c84800a63758d3f0fbdbcff6dc4f491 | web/spec.js, web/validate.js and packs/_template/config.json: useful range/slot/once validation, but 1,000,000 byte budget is a conservative policy, not measured capacity. EQ Q differs from Tadao. No root license found. |
| [open-ting](https://github.com/au42/open-ting/tree/7af7469fb956b2fac3251ae6ef881c82a141dc81) | 7af7469fb956b2fac3251ae6ef881c82a141dc81 | Extracted1.0.8 rom/main.py:114 loops16 rows; pos defaults to index. README says MSC only/no CDC; device/probe.txt identifies1.0.4. Does not settle1.1.2 serial availability. No reuse license established. |
| [fx-mic-mod](https://github.com/dougjberman/fx-mic-mod/tree/83a9f565a85242bbcc04b9b7cc8cc8f673530727) | 83a9f565a85242bbcc04b9b7cc8cc8f673530727, mod1.2.0 | CONFIG_FORMAT.md, docs/editor.html:1537 and docs/ting-dsp.js: CircuitPython10, CIRCUITPY, s16 mono24k default, sample_fx/effects_only and different FX. Version/conflict checks before whole-config save; approximate DSP. MIT/Adafruit attribution required for reuse. Not stock format/transport. |

No third-party source, firmware, presets or audio is copied. Browser preview is
an approximation with explicit per-effect coverage. Stock-guide validation is
documentation-level; the conservative 16-row/1,000,000-byte authoring budget
does not certify a particular firmware. BUS/trigger/EQ casing and physical
free space require exact-firmware verification. Experimental values must not
silently become supported Live operations.

## Implementation plan

Execute inline with test-first checks; existing isolated checkout, no worktree.
Persistent local ledger: work/fx-mic-progress.md.

1. `js/fxMic/profile.js`, `config.js`, pack store in `pack.js`: strict stock-guide schema,
   four slots, stable row remapping, atomic edits/import and local snapshots.
   Tests: malformed types/nonfinite numbers/duplicates, parameter ranges,
   modulation references, incompatible CircuitPython and preservation on failure.
2. `wav.js`, `pack.js`, shared `js/archive/zipReader.js`: strict RIFF bounds,
   PCM format/duration/size; existing canonical audio resampling with speed1;
   ZIP CRC/limits/path protection and byte-preserving roundtrip. Keep My EP
   PAK constraints unchanged. Tests include corrupt/truncated/duplicate ZIP,
   oversize packs, invalid WAV, failed import leaves working data intact.
3. `emulation.js`, `app.js`, CSS/icon: offline four-slot builder, crop,
   four presets, modulation, approximate audition and local pack storage.
   UI tests open/close, edit/reorder, export/import, invalid import, audio
   cancellation and close cleanup. Untouched input WAVs remain original bytes.
4. `liveSession.js`, `serialTransport.js`: isolated typed command surface,
   exact identity/profile gating, serialized operations, readback, session
   invalidation and bounded responses. No arbitrary script/eval or automatic Ctrl+C,
   firmware install, filesystem writes, structural edits or retry after
   ambiguity. Production write evidence starts empty. Fake tests cover denied
   permissions, incompatible firmware, timeout, disconnect and mismatch.
5. Documentation, one independent read-only review, full npm test/build/
   verify/source Chromium/dist smoke; PR CI at final SHA. No merge until approval.

Review focus: malformed binary lengths and ZIP paths; stale asynchronous import
overwriting edits; preset references after reorder/delete; late serial replies
crossing session boundaries; preview audio/timers surviving close or mode change.

## Follow-up: Studio workspace, local drafts and browser-mic audition

The pinned A Thing for Ting reference offers 4 editable preset slots, preset names/comments, sample controls, parameter/modulation editing, local JSON import/export and Live device configuration transfer. K.O. TOOL offers an explicit Presets/Samples/Audition workspace with an opt-in All sections view. Browser-only operations include preset copy/reset/notes, native drag-and-drop effect row reordering with preserved modulation assignments and keyboard-accessible up/down controls, clear a custom WAV assignment to return to the built-in sound with undo, and explicit saved-config download while the read-only device session is active. Audition additionally supports focused keyboard shortcuts: Space playback toggle, H handle 0/1 and hold S for Shake; shortcuts never run from editable controls. A separate guide links the official USB storage install workflow, with mandatory owner backup and explicit warning that file copying is a hardware write outside the browser app.

Stock 1.1.2 read-only diagnostics can be turned into a **local editable draft only after schema validation**. Any unknown/unsupported effect parameters, incomplete saved preset, or custom WAV reference blocks this conversion rather than silently dropping sound data. The flow prompts before replacing the working pack, disconnects Web Serial, and preserves Undo. Downloaded saved config JSON contains no audio and must not be called a full device backup; obtaining the device's original WAVs requires a separate authorized file transfer.

Browser microphone audition uses an explicit user click and browser getUserMedia consent, does not use EP-2350 USB Serial for audio, does not claim DSP parity, and must stop every stream track and close the AudioContext on Stop/close/mode switch, denial or late completion. Headphones and low output are recommended due to acoustic feedback. Preview BUS, HARMONY, SSB and other documented approximations retain honest coverage notices.

No production 1.1.2 parameter write, structural device edit, filesystem restore, or firmware reset was enabled. The reference's automatic `Ctrl+C`, slot selection and device config writes are not safe to clone without operation-specific HIL and owner approval. Verified owner-observed READ success is not evidence of writable Live compatibility.

## Physical acceptance (not executed)

Record EP-2350 identity, exact stock firmware, Chrome/macOS versions, commit,
USB mode and audio interface. Back up config and WAVs; close other managers.
Use a pre-existing expendable simple preset with an unmodulated, evidenced
parameter. Establish safe connection, using an existing REPL where possible; opt-in Ctrl+C preparation interrupts the running firmware program and is not part of an unattended hardware check;
read active state, authorize one bounded change, send, read back and compare at
the proven numeric resolution, listen to the analog output via an interface,
restore original parameter and verify. Disconnect safely and verify hardware
buttons/audio still operate. If CDC/identity/readback/session entry or exit is
not established, stop before writes. No BUS, chain rebuild, firmware update,
arbitrary REPL, forced USB interruption, auto-delete or speculative rollback.
Fake transport and CI do not satisfy this acceptance.

## Manual hardware trial

Open FX-MIC Studio → Live in desktop Chrome. **Without Ctrl+C consent, session entry is passive only:** the adapter waits for a clean, complete `>>> ` prompt emitted by the device. It does not send a newline or any command before that prompt, and fails closed when no prompt is observed. Consent to Ctrl+C is single-use, cleared on attempt/mode switch/close. Serial framing requires the complete prompt including its trailing space; trailing CR/LF, close latency and write pacing are covered by synthetic tests. Back up the device and select an
expendable preset with just one unmodulated LOWPASS row. Keep a record of the
original cutoff. Select the exact stock OS version and connect using an already
available serial prompt. Alternatively, a separate unchecked-by-default option
allows two Ctrl+C characters and a fresh newline, following the documented
reference startup sequence. This interrupts the running Python application,
can stop the audio until the device restarts, and never happens automatically.
Such physical intervention requires separate scenario-specific authorization.
A selected stock version is labelled unverified if not reported by the runtime;
unverified versions cannot enable the 1.0.8 write trial.
For stock 1.1.2, the read-only diagnostic now follows the reference's **primary** import path: read `/fat/config.json` using fixed `json.load`/`json.dumps` commands, bounded 512-character escaped chunks, and recheck `teenage.fx_pos` afterwards. No automatic `fx.list_preset` or `fx.load_preset`, `teenage.fx_pos` assignment, device filesystem write, or retry. Show all four stored slots (including empty slots and unknown numeric parameters) separately from the active DSP chain. A missing active FX slot (`-1`) remains readable. Firmware data are summarized and are NOT passed through the offline pack authoring validator or promoted to a write capability. The 1.0.8 guarded write trial continues to read `fx.list_loaded(slot)` as active readback. Python exceptions surface only a fixed stage and exception class, without raw trace or private config content. The 64 KiB limits are measured in UTF-8 bytes. The raw file size is checked via read-only `os.stat` before `json.load`; the serialized byte length is verified before transfer. The file is explicitly closed even after a MicroPython JSON parser exception while the REPL is still responsive; late transport losses remain unrecoverable. The saved-config detail view contains full sanitized effect parameters and modulation for every saved slot, independent of the active hardware slot, without ever granting write permissions. Per-command timeouts remain conservative diagnostic limits. Synthetic tests use the public reference's Broken Radio Pack schema; they are NOT a capture of the owner's physical 1.1.2. Real hardware acceptance remains open. The
CircuitPython mod is a separate firmware and is outside this trial.

Stock 1.0.8 has one guarded, user-confirmed cutoff trial based on the pinned
reference. Stock 1.1.2 is offered for diagnostics only. Neither profile is
registered as hardware-accepted. After a successful read, confirm the backup,
apply one change and confirm the matching readback plus physical analog output.
Use Restore original cutoff to write back and verify the original value. Then
disconnect and confirm that the microphone's controls and output still operate.
If setting or restoration fails, no retry or rollback runs. Restore manually on
the device and confirm recovery only after checking its state.

The manual trial keeps the fixed commands and mandatory readback, requires a
clean prompt and rechecks active preset state immediately before each write.
A void setter return is allowed in the trial only; matching device readback
establishes success. Neither BUS nor rewriting the preset is available.

## Software verification scope

The regression suite covers strict config/WAV/ZIP validation, byte-preserving
roundtrips, row remaps, failed and cancelled imports, late serial operations,
timeouts, mismatched readback and disconnected sessions. Browser tests exercise
four slots, crop/export/import/local persistence, inherited-key rejection without
state replacement, modulation reorder, BUS preview gating, actual Web Audio
cleanup, replacing a playing chain and separate desktop/mobile icon placement.
One independent read-only review identified inherited parameter keys, stale
JSON-import audio and stale serial-open cleanup; all have dedicated regressions.
LFO range warnings account for both halves of the bipolar waveform.
This covers software behavior, not firmware capacity, analog sound equivalence,
safe physical serial entry/exit or complete cross-browser/accessibility acceptance.
