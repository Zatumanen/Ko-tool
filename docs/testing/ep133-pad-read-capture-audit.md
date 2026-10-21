# EP-133 OS 2.5.1 — scoped pad READ evidence

Provenance: owner-supplied audited summary of two private hardware captures,
EP-133 SKU `TE032AS001`, OS `2.5.1`. Recorded in this registry update on
2026-10-21. Raw files were not supplied to this checkout: hashes and audit facts
are supplied by the owner, not independently recomputed here. No serial, raw
trace bytes or project content is published.

| Capture | SHA-256 | Outbound READ | Successful RX |
| --- | --- | --- | --- |
| A | `e962c91cf1ac5fe274c89bad257dcc536f97702b98c2357082b0ba53001d9126` | 21 | 20 |
| B | `f25620432bdf565002bf453a7adda6a31fc53ea624d8ad4ed6ac81de40a85688` | 21 | 20 |

Neither capture contains write commands. A complete METADATA GET pair for FID
`3201` confirms 12 fields. The final RX for FID `3202` is absent from each raw
trace, although the application summary reports 12 fields for both pads. The
summary does not replace the missing RX. These are **incomplete captures**; no
missing frame is reconstructed or claimed.

This supports `capture-observed` READ, not `hardware-verified`: production pad
READ is permitted only for EP-133 with exact `metadata.os_version === '2.5.1'`,
supported compatibility and matching READ evidence. Firmware-only fallbacks,
unknown OS, other firmware, EP-40, EP-1320 and unknown SKUs remain denied before
FILE traffic. Generic capability resolution is unchanged.

The viewer only receives LIST/INFO/METADATA GET inside the existing FILE session
lease (which may INIT). It does not receive SET, restore, recovery, PUT, DELETE,
MOVE, PLAY, project activation or TAR saving. WRITE remains false on every SKU.
These captures do not establish accuracy of every displayed UI field relative
to the saved project, full UI hardware acceptance, or EP-40/EP-1320 support.

Browser pad-node fixtures are synthetic protocol-consistent LIST/INFO/GET data,
not a replay or completion of Capture A/B. Their parent/FID/flags checks remain
mandatory; `sym:0` is UNVERIFIED and library defaults never replace pad metadata.
