---
name: ep-protocol-safety
description: Use when a task touches EP identity or firmware, MIDI/SysEx, FILE operations, project/device writes, recovery, deletion, or hardware-verification claims.
---

# EP protocol safety

Inspect current code at the affected boundary and immediate callers/tests.
Independent Visuals capture or an unrelated label does not require protocol internals.

1. Classify read-only versus mutation; identify operation, model/SKU, exact firmware
   and host. Read the relevant [matrix](../../../docs/testing/ep-device-compatibility-matrix.md)
   and [TESTING hardware gates](../../../docs/TESTING.md) sections.
2. Trace permission through evidenceRegistry/deviceCapabilities/profile, authoritative
   runtime, session ownership and FILE scheduler. Recognition, handshake and raw
   bitmask do not authorize writes; unknown/unsafe state fails closed. Preserve
   CRC/readback, dependency checks and recovery journals. No speculative retries
   after ambiguous results/disconnect, parser loosening or wider firmware approval.
3. Reproduce the bug before fixing it; add a focused failing behavioral test when
   feasible. Keep existing safety assertions and real/synthetic fixture provenance.
4. Physical writes/destruction/interruption require scenario-specific approval,
   backup and expendable slots/projects. Referenced deletion needs a second informed
   confirmation; cancel performs no write. Verify authoritative FILE info, metadata,
   CRC and dependencies after mutation. Never automate destructive HIL on valuable data.
5. Start with matching TESTING tests. Protocol/firmware/FILE/recovery/project-mutation
   changes retain full Node/build/E2E and applicable hardware gates. For evidence use
   the [capture workflow](../../../docs/testing/ep-file-capture-workflow.md).

Return boundary, permission/evidence scope, actual results and hardware gaps.
Fake EP, recorded traces and existing registry HIL assertions are not a new physical
test. Do not publish credentials, serials, private raw captures or user content.
