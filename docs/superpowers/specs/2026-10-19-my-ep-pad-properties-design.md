# My EP: selected-pad properties

Updated: 2026-10-20 (Europe/Moscow). Status: owner approved this written design and its implementation plan in chat. Tasks 1–4 are implemented and reviewed; Task 5 adds focused browser/evidence regressions. Final cumulative checks/release review remain Task 6. Physical pad writes remain unverified and disabled by production evidence.

## Owner outcome and scope

The owner changes PITCH, PLAY MODE and TIME MODE in My EP and expects the assigned hardware pad to change. They explicitly requested project/group/pad selection and application in the same PR as the sample-menu, selection, waveform-layout and WAV-metadata fixes. Best Friend for K.O. II defines the intended pad behavior.

The library context menu currently edits `/sounds` defaults. Assigned pads own their project parameters. The new editor must identify its target, show authoritative pad values, send edits to that pad and reflect hardware changes back into My EP.

## Behavioral reference

[Best Friend: edit pad settings](https://epbf.app/docs/edit-pad-settings), reviewed 2026-10-19, describes per-pad pitch/play/time settings, hardware-to-editor synchronization, and trim/envelope writes on gesture release. [Its bank guide](https://epbf.app/docs/see-a-bank-of-pads) describes following the hardware's selected group and pad. These sources define UX; they do not certify our wire implementation or firmware support. Best Friend's executable/source is not among the retained uploaded references.

This change covers the three requested property families and explicit target selection. Broader waveform trimming, envelope tools, pad swaps, performance effects and the paused OS redesign keep their existing scope.

## Chosen path and alternatives

Extend the existing My EP property UI with a distinct PAD target and a live pad-metadata controller. Reusing the inactive-project TAR editor alone would preserve existing safety but would not provide the requested Best Friend behavior. Raw archive writes into an active project would bypass existing safeguards and are unsuitable.

## Target and interaction

1. Keep SAMPLE LIBRARY and PAD PARAMETERS visibly distinct.
2. From a library sample, choose a device project, group A–D and one of its 12 pads. Show the pad label and assigned sample before application. Resolve nodes from authoritative LIST/INFO; never calculate a destination solely from a sample slot or an assumed numbering formula.
3. Selecting a target only reads. `APPLY TO THIS PAD` copies the explicitly displayed, confirmed PITCH / PLAY MODE / TIME MODE values to the chosen pad. The target must already refer to the selected sample; reassigning a sample is a separate action.
4. The pad editor then displays the pad's own values. Button edits are serialized/debounced; a continuous value gesture sends its final value on release. Show SAVING until verification, SAVED after readback, or NOT SAVED with the actual refusal.
5. Hardware selection events identify the active pad. Change the editor target only when no pending draft exists; otherwise retain the explicit target and report the selection change. A sample's reuse on other pads must not cause writes to them.
6. Receive pad metadata events and perform guarded reads of the selected target. Saved-project polling remains opt-in and is not a live synchronization mechanism.

## Permission and protocol boundary

Add a distinct firmware-scoped pad-metadata capability. Existing `sample.metadata` authorizes the sample-library workflow; project archive authoring and active-selection metadata do not prove arbitrary live pad-parameter writes. Preserve all current firmware records and safety gates. Unknown/unsupported firmware presents read-only pad settings with a concrete reason.

Before enabling writes for a model/firmware, retain evidence for the exact pad-node operation: node discovery, full readable metadata, string enum encoding, SET payload, GET response, persistence and actual pad playback behavior. Preserve source provenance. Owner-provided physical traces/acceptance may supply evidence; synthetic tests and another app's marketing statements may not.

[The secondary protocol source](https://github.com/kmorrill/ep-series-sysex/blob/main/docs/file-protocol.md) warns that partial pad metadata can resynchronize fields from sample defaults and erase pad overrides. Pin its relevant revision before implementation. Establish the complete safe payload from operation evidence; refuse incomplete snapshots rather than supplying guessed defaults. Preserve the pad's assignment, trim, envelope, amplitude, pan, MIDI channel, mute group and all unrelated values.

## Runtime and recovery

- Use the existing session token, FILE scheduler, strict firmware debug guard and device runtime. Capture the token and target when the edit is created; verify both before dispatch and after readback. Cancel pending timers and drag listeners on disconnect/close.
- Add a pad-specific persistent recovery record identified by device, project, group, pad and wire FID. Store the pre-write metadata snapshot, desired values, phase and verification outcome. The sample journal's 1–999 `/sounds` recovery model must not receive pad FIDs.
- Validate target identity and assignment immediately before a write. Detect changes to protected fields since the preview and refuse stale edits.
- Verify edited fields and preserved fields after SET. An ambiguous timeout/disconnect stops writes and leaves a recovery requirement; do not retry automatically or replay the edit on another connection.
- Recovery starts with authoritative readback and presents the original/current/desired values. Restoring a snapshot is a separate explicit action. Do not rewrite a whole project or change the active project to recover one pad edit.

## Verification and acceptance

Unit tests: firmware permission denial, complete payload preservation, string enums and release pairing, unknown/missing fields, target mismatch, stale snapshot, serialization, session replacement, timeout, persisted recovery and acknowledged verification.

Browser fake-EP tests: explicit project/group/pad choice, read-only selection, apply to exactly one assigned pad, all three requested property families, hardware-event refresh, pending edits across hardware selection, denied firmware, failed readback, disconnect/reconnect without replay, and isolation from library defaults/other pads. Assert emitted wire requests and device model state.

Run full Node, Pages build and Chromium suites and independent review against the final PR head. Existing popup anchoring, outside deselection, waveform geometry and native WAV metadata regressions remain required.

Physical acceptance is a focused new pad-operation scenario: exact model/firmware/host, backed-up expendable content, one explicitly chosen pad, preservation of unrelated settings, wire readback and audible/device confirmation. This does not reinstate the deferred broad ZAT-9 interruption matrix. A permitted operation's code can be prepared and reviewed first; its evidence record must accurately identify what was physically verified.

## PR handoff

Keep the requested changes together in one PR. Do not merge the PR as a completed Best Friend pad editor while only the library fixes exist. Review this written design before implementing the new pad capability/recovery path; then write the implementation plan and execute it in this checkout. Merge only after final checks and review, with the remaining physical acceptance explicitly identified.
