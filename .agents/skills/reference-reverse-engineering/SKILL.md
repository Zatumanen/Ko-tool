---
name: reference-reverse-engineering
description: Analyze owner-supplied reference app artifacts, extracted JS, ASAR, WASM, binaries or passive captures for Ko-tool using evidence-first static methods and optionally REA; do not run for ordinary source navigation.
---

# Reference investigation (REA, opt-in)

Use only when the owner supplies an actual target and an allowed question, e.g. official sample tool file format, audio behavior, or device protocol evidence. A URL mentioned as context does not authorize downloading/executing third-party software.

1. Inventory artifact type, source/provenance, version, permissions and SHA-256. Keep the original unchanged. Work on a copy outside the public repository.
2. First use minimal local static inspection. For extracted JS/Electron/ASAR, REA's `analyze-javascript-application` may help. Node 22.x >= 22.19 is required. Obtain permission before an npm download, setup or MCP registration; prefer a version-pinned temporary CLI. In a controlled environment, the documented form is `npx -y rea-agents@<reviewed-version> analyze-javascript-application /absolute/path/to/target --json`.
3. For WASM, native Mach-O/PE, APK, firmware or captures, check supported prerequisites and separate scope first. Do not claim decompilation, packet decoding or real-device verification without the required provider and source data.
4. Do not execute unknown binaries, attach to a live process, bypass protection, write to the EP, publish proprietary assets or copy protected source into Ko-tool.
5. For each finding, record: observed behavior; artifact+offset/path; evidence category (source/static inference/passive trace/synthetic/physical test); confidence; unknowns; implications for an independently implemented Ko-tool feature.
6. Compare the hypothesized behavior against existing js/ep133/ evidence registry, docs/testing contracts and golden fixtures. Treat spec changes and hardware permissions as separately authorized work.
7. Return a concise evidence report. Keep raw binaries, private device logs and unredacted captures outside Git. Do not automatically publish to GitHub or Linear.

Upstream: https://github.com/morluto/rea ; intake protocol: docs/REFERENCE_ANALYSIS.md.
