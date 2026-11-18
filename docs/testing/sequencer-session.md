# Sequencer shared-session foundation

Owner authorization: 18 November 2026, ZAT-63 software work may proceed before
final Visuals HIL. This first sequential change provides a separate classic
desktop icon/window and observes the existing My EP runtime. It does not yet
provide Saved Step/Piano Roll. The legacy editor remains unchanged.

## Source-first boundary

- `js/ep133/deviceRuntimeState.js` derives ready only from verified identity,
  owned session, safe state, hydrated recovery and idle operation. The new
  `js/sequencer/session.js` fails closed on incomplete snapshots too.
- `js/ep133/deviceRuntime.js` is the same singleton used by My EP; the new app
  subscribes to it without acquiring MIDI, FILE leases or another connection.
- `js/ep133/projectReader.js` and `projectFilesystem.js` already parse and read
  saved archives; the next sequential Saved-view change should reuse them,
  without importing authoring permission gates from the legacy editor.
- `tests/sequencer-session.test.mjs` covers authorization/safety/busy/disconnect.
  `tests/e2e/sequencer.spec.mjs` covers keyboard opening, shared connection,
  close/reopen, disconnect invalidation, no extra MIDI/FILE requests and no
  writes. Fake EP is synthetic evidence only.

## Next Saved boundary

Use one read-only canonical event model from `readProjectModel`; retain raw
ticks and unknown records. Explicit project selection/Refresh must use the
existing filesystem facade and scheduler. Bind every result to the captured
device session/epoch and request generation; disconnect, replacement or close
must invalidate pending results. Opening the app or changing Step/Piano Roll
must neither read FILE nor mutate the model. AUTO stays opt-in and approximately
20 seconds, with visibility/busy/session guards. No offline archive picker.

## Live architecture and evidence limits

Pinned [G02 ep-series-sysex](https://github.com/kmorrill/ep-series-sysex/tree/891a905c5faf8b5c7b0ae1bdfee260c21f7417eb),
`docs/project-format.md`, documents saved 96 PPQN/24-tick steps.
Its `docs/midi-reference.md` describes MIDI clock/transport and notes; its
`docs/live-deployment.md` experimental capture-relative boundary does not
establish absolute bar phase. These are external leads, not K.O. Tool HIL.
The saved TAR member named `live` is not an unsaved event stream.

The current `js/ep133/device.js` receiver ignores non-SysEx messages; no
hardware-authoritative Sequencer Live event adapter exists. A future adapter
must share the existing owned port/session, tag input with epoch, classify
only independently evidenced device messages, and invalidate on loss of
ownership, source or synchronization. Saved archive state and observed Live
state must remain distinct. Each outgoing operation needs its own exact-model,
firmware and permission evidence; no writer is added by this foundation.

Live remains disabled, HIL PENDING. Do not infer notes, unsaved edits or absolute
playhead from a timer, saved data or faster FILE polling. Real-device validation
of clock/transport origin, note routing/echo, absolute-position availability
and bidirectional operations remains separately scoped. No physical EP or
firmware operation is part of these software tests.
