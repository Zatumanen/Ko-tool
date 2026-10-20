# EP-series firmware/device compatibility matrix (ZAT-14)

This document is based on the repository's existing evidence registry, firmware
minimums, device UI profiles and native project format contracts. It does **not**
claim additional hardware verification.

## One source of model compatibility

`js/ep133/deviceCompatibilityMatrix.js` is the single source for:

- recognized EP-series SKUs and display/profile names;
- handshake minimum firmware on beta and production channels;
- sample-bank fallback tabs and default play modes;
- native project format sizes/dialects and project feature flags;
- semantic capability keys shared by the evidence registry and profiles.

| Model | SKU | Beta handshake floor | Production handshake floor | Project pad bytes | Pattern dialect |
| --- | --- | --- | --- | --- | --- |
| EP-133 K.O. II | `TE032AS001` | `0.100.38` | `2.0.5` | 26 | `ep133` |
| EP-1320 Medieval | `TE032AS005` | `0.2.13` | `1.0.2` | unverified | unverified |
| EP-40 Riddim | `TE032AS006` | `0.4.7` | `1.0.5` | 29 | `ep40` |

These floors are the **minimum version used in the device connection check**.
They are not a grant to modify samples or projects. The previous broad
`0.1.0*` firmware exemption was intentionally removed: a malformed,
undocumented or older-than-minimum firmware must not bypass the handshake gate.

## Evidence-based operation permissions

The existing `js/ep133/evidenceRegistry.js` remains authoritative for the
actual read/preserve/write permissions of individual capabilities. The registry
uses SKU and capability keys from the matrix; the
`js/ep133/deviceCapabilities.js` facade resolves evidence against the exact
connected firmware. Both `deviceProfile.js` and `projectProfile.js` use
the same facade, instead of repeating capability lookups.

Evidence for this release consists of ten named capability categories
per known SKU (30 records total). Every resolved permission carries
`evidenceId`, `sourceType`, `recordedAt`, optional `artifactId`,
`firmwareRange`, and `reason`, as defined by the registry.

### Important examples

| Model / firmware | Sample transfers | Project authoring | Native live + patterns |
| --- | --- | --- | --- |
| EP-133 `2.5.1` | hardware-verified, write enabled | hardware-verified, write enabled | unverified |
| EP-40 `2.5.1` | hardware-verified, write enabled | hardware-verified, write enabled | capture-observed: read/preserve, no write |
| EP-1320 `1.0.2` | unverified: read/preserve, no write | unverified: no write | unverified |
| EP-133 / EP-40 unknown or `2.5.2` | evidence downgraded; no write | evidence downgraded; no write | no new write authority |
| Unknown SKU | no verified evidence | no verified evidence | no verified evidence |

A firmware can pass the minimum handshake and still have **all authoring
disabled** because the exact firmware lacks hardware-scoped evidence. This is
intentional. The raw FILE capability bitmask also **does not** authorize
higher-level mutations independently of evidence.

### Live pad metadata boundary

`project.pad-metadata` is distinct from sample-library metadata, archive authoring
and active-selection/reload. All three known SKUs start **unverified** with
shared-protocol read/preserve and no writes, including EP-133 / EP-40 `2.5.1`.
Unknown identities and malformed/obsolete firmware cannot use the pad facade;
a recognized newer firmware still gains no pad-write permission.

The secondary protocol source is pinned to
[`891a905c5faf8b5c7b0ae1bdfee260c21f7417eb`](https://github.com/kmorrill/ep-series-sysex/blob/891a905c5faf8b5c7b0ae1bdfee260c21f7417eb/docs/file-protocol.md),
reviewed 2026-10-19. This is public **documentation**, not an imported capture
or new hardware acceptance. It lists these pad fields:

```text
sym, sound.playmode, sample.start, sample.end, envelope.attack,
envelope.release, sound.pitch, sound.amplitude, sound.pan, sound.mutegroup,
time.mode, midi.channel
```

It documents string play modes `oneshot` / `key` / `legato`, string time modes
`off` / `bar` / `bpm`, and pairing play-mode writes with `envelope.release`.
It warns that partial pad writes can resynchronize sample defaults and clobber
pad overrides. It does not establish a complete safe pad payload for each model
and firmware, a pad numeric-enum mapping, or pad `loop` support on EP-40.
Existing registry HIL assertions and FILE captures remain scoped to their
previous operations; none is promoted into pad-write evidence.

`padMetadata.js` therefore builds only **pure candidate payloads**: all twelve
fields must be present, unknown fields refuse, and protected values are copied
exactly. Only pitch, play mode, time mode and an explicit play-mode release
companion can change. No default fields or enum maps are guessed. Its optional
`profile.playModes` can restrict the documented string modes; it cannot add
encodings. Normalization may accept a partial read snapshot, but payload
preparation refuses every incomplete snapshot. Verification compares intended
and preserved fields against readback and rejects protected-field changes
already present in a candidate. Synthetic contract vectors establish only these
software checks. Runtime writes remain disabled pending scoped discovery,
complete payload, persistence, readback and physical playback acceptance.

### Evidence and fixture references

- Capability IDs, source descriptions and firmware scopes:
  `js/ep133/evidenceRegistry.js`. An evidence record with
  `sourceType: hil` is an existing assertion in that registry, not a new
  test performed by ZAT-14.
- Protocol-level real-device FILE captures, with recorded provenance:
  `tests/fixtures/ep-series/file-traces/v1/manifest.json`,
  `tests/fixtures/ep-series/file-traces/v1/source-evidence.json`.
  Captures support only their explicitly indexed commands. For example,
  original EP-133 2.0.5 INIT/LIST/METADATA evidence does not establish
  EP-40 2.5.1 project authoring or unspecified firmware compatibility.
- Synthetic failures in the same fixture directory test failure handling,
  **not** device-specific capability verification.
- `docs/testing/ep-file-capture-workflow.md` enumerates still-missing real
  GET/MOVE/failure captures. None is silently treated as verified here.

## Adding another model or firmware

1. Add the SKU and minimum firmware, UI and native project profile once in
   `DEVICE_COMPATIBILITY_MATRIX`; unverified fields should remain null/empty.
2. Add ten evidence registry entries for the SKU; start new operations as
   `unverified` or `preserve-only` until real evidence supports stronger
   permissions. Validation requires a complete registry scope.
3. Add evidence provenance to those records. Scope a hardware-verified
   operation to an exact firmware or proven range; never auto-upgrade an
   untested release.
4. Update the compatibility matrix tests and project format fixtures as
   warranted; run `npm test`, `npm run test:e2e` and
   `npm run build:pages`.
5. Hardware authoring is a separate verification task; the matrix is not a
   substitute for a real device test.

`isSupportedEpSku`, firmware handshake checks, `getEpDeviceProfile`,
`getEpProjectProfile` and evidence-registry coverage all derive their
model identities from the same record. Previously recognized SKU behavior and
UI defaults are preserved; only the undocumented `0.1.0*` minimum-firmware
exemption is deliberately removed.
