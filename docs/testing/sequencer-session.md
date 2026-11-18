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

The passive observer in `js/ep133/midiEvents.js` decodes complete Note On/Off
(including velocity-zero Note On), Clock, Start, Continue, Stop and 14-bit SPP.
The [official MIDI chart](https://teenage.engineering/guides/ep-133/system)
marks Song Position RX/TX; its timing and relation to EP scenes/loops still
require exact-device capture. A decoded SPP value is not a proven playhead.

`device.js` exports `subscribeMidiEvents(onBatch, {capacity, flushMs, onReset})`,
returning `{flush, clear, unsubscribe}`. `flush` delivers a currently queued
batch synchronously after revalidating context; it sends nothing. The observer
uses the existing receiver, selected input,
owned/verified/safe/hydrated runtime and matching model/firmware/epoch. Removed
listener callbacks, other inputs and stale sessions cannot publish. Observing
continues during FILE reads without acquiring a FILE lease or changing SysEx.

Batches contain frozen `events` and a `dropped` count. Each event contains type,
channel (1–16 or null), decoded fields, original MIDI bytes, Web MIDI event
`timeStamp` as `timestamp` in milliseconds, connectionEpoch, model, firmware and
an opaque local numeric `session`. No serial/port/device key is exposed.
Timestamp is receipt metadata, not inferred transport phase.

Subscription is explicit: no default capture, console logging or persistent storage.
Per-subscriber ring capacity defaults to128 (clamped1–1024); one-shot flush
defaults to100ms (clamped50–1000ms), so Clock does not trigger a UI callback per
message. Session/ownership/model/port/disconnect changes clear pending data and
call `onReset({reason:'session-changed'})`; manual clear reports `cleared`.
Unsubscribe cancels the timer and releases buffered events. Consumer exceptions
cannot disrupt FILE/SysEx. Node and fake-EP tests are synthetic evidence only.

Sequencer's separate **MIDI input · EVENTS ONLY** panel consumes this API only
after **Observe MIDI input**. It shows the latest64 delivered events, decoded
values/raw bytes, timestamps, public model/firmware and epoch/local session.
Observer drops and hidden older display rows have separate counters. Event
repaints are coalesced at250ms; control/session changes update immediately.
It never sends MIDI or reads FILE and never drives the Saved views.

**Stop observing** freezes the received rows; **Clear events** also clears any
queued observer batch. Close, document hiding, lost authorization or session
change stop collection and clear the history. Returning/reconnecting requires
another explicit Observe click. No automatic resume, upload or persistence.
The scene/pattern/playhead and hardware synchronization are not inferred.

**Download MIDI trace** is an explicit local JSON download after stopping.
A separate bounded prefix retains up to8192 delivered events (display remains64
rows); reaching the limit stops observation, not the EP. Manual Stop flushes the
last queued observer batch before unsubscribing. JSON schemaVersion1 contains
allowlisted event fields/raw bytes, receipt timestamps, public model/firmware,
epoch/local session, app asset build version (or `source`), browser wall-clock
start/stop and stop reason. Observer drops, capture limit and delivered events
not stored at the limit are explicit. Only the listed decoded message types
are captured; this is not a complete USB/MIDI bus capture.

Every export stays `UNVERIFIED` / `HIL PENDING`. It does not attest a physical
device, clock phase, unsaved state or hardware acceptance. Host details and
Clock/channel/thru settings still belong in the separate HIL report. No serial,
port key, private session token, full URL or automatic upload is included.
Start/Clear/close/hide/session loss discard the in-memory trace; explicit
downloads remain local files under the user's control.

Saved archive state and observed events stay separate. No outgoing operation,
FILE request, device signal inference or hardware-authoritative synchronization
is added by this observer. Each outgoing operation still needs its own exact-
model, firmware and permission evidence.

Live remains disabled, HIL PENDING. Do not infer notes, unsaved edits or absolute
playhead from a timer, saved data or faster FILE polling. Real-device validation
of clock/transport origin, note routing/echo, absolute-position availability
and bidirectional operations remains separately scoped. No physical EP or
firmware operation is part of these software tests.
