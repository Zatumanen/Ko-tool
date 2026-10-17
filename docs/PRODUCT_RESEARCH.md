# K.O. Tool — user needs and UX research

**Status:** background research and product proposals, not a confirmed implementation plan. User-facing docs: [README](../README.md). Technical rules: [AGENTS](../AGENTS.md). Sequencer: [SEQUENCER](SEQUENCER.md).

## Product philosophy — from the project owner

**K.O. Tool** is the product: a musician-oriented virtual desktop whose separate apps include **SpeedUpperCut** (audio preparation) and **My EP** (physical device companion). Future icons may open further tools.

The owner defined these priorities:

1. **Save sample memory** by x2 audio preparation with `sound.pitch=-12` playback compensation.
2. Make sample transfer, organization, and device management comfortable.
3. Be a genuine **companion to physical Teenage Engineering EP hardware**, not a DAW replacement.
4. Visualize sequences and patterns.
5. Aim for the useful capabilities of the official sample tool, with better UX.
6. Make plugging in the EP and using K.O. Tool enjoyable enough to encourage practice, recording and sharing performances.
7. Explore MiniMeters-style visualizers and a contextual assistant inspired by TRKLS.
8. Consider community sample/project sharing and voluntary donation support. Paid subscriptions remain undecided.

These goals are **owner input**, not claims about existing features or community consensus.

## Owner-approved product decisions — 17 October 2026

### My EP — REPITCH toggle

The proposed `REPITCH` control is **ON by default** and can be switched OFF. When ON, new local WAV imports are inspected for Teenage Engineering `LIST/INFO/TNGE` metadata:

| Incoming audio | Proposed action |
| --- | --- |
| Valid metadata includes `sound.pitch=-12` | Consider already repitched. Skip x2; preserve -12 through any necessary **format-only** conversion. |
| No exact `sound.pitch=-12` marker (including other input formats) | Apply x2, attach `sound.pitch=-12`, then upload. |
| REPITCH OFF | Keep today's direct My EP upload route, without automatic x2. |

`-12` is a **convention, not proof** that audio was previously sped up. Reject malformed metadata transparently. Do not rewrite the local source or apply REPITCH to device-side MOVE/COPY, backup, or restore. **This is not implemented yet in My EP**: `js/audio/processor.js` performs the existing converter's x2/-12 transformation while `js/ep133/audio.js` is a distinct direct-upload path.

### Sequencer — both representations, two delivery phases

- **Phase 1, Saved:** a high-quality safe **read-only** display of archived projects, patterns, pads, notes and scenes.
- **Phase 1 UI:** **Step Sequencer and Piano Roll**, switchable views backed by the same event data, not two separate editors. Step view favors rhythmic pads and a 16-step grid. Piano Roll shows pitch, timing and note duration.
- **Placement (owner-approved):** the sequencer lives **inside My EP**, accessed through **My EP → Projects → select project → Sequencer**. No independent desktop icon. It shares the selected project context and My EP safety permissions.
- **Connected-device-only projects (owner-approved choice B):** browsing projects and Step Sequencer/Piano Roll require a physically connected EP via My EP. Do not offer an offline local-project-archive viewer/editor; on disconnection, clearly invalidate actionable project state and preserve device-write safety. SpeedUpperCut remains usable independently of EP hardware.
- **Phase 2, Live:** respond to real EP playback and events only after supported MIDI/hardware capabilities are demonstrated on specified firmware; no invented playhead and no faster FILE polling as a substitute.

The existing `projectReader.js`, read-only inspector and gated 16-step `SEQUENCER` provide starting points, **not proof that a finished read-only piano roll or live sync exists**. See [SEQUENCER.md](SEQUENCER.md).

### Visuals — separate desktop application (owner-approved option A)

- **Placement:** a separate **Visuals** application inside the **K.O. Tool browser virtual desktop**, launched from its own **in-page icon**. It must **not** become a My EP tab or a native host-OS desktop application. The existing browser `index.html` has icons for SpeedUpperCut and My EP; no Visuals implementation is shipped.
- **Purpose:** engaging audio-reactive visuals for performances and filming the physical EP on camera. MiniMeters is a **reference for exploring** spectrum, waveform, oscilloscope and flexible layouts, not a source of licensed artwork or code.
- **Audio source policy (owner-approved option C):** **user-selectable browser audio input**. Prefer EP USB Audio when the connected model/OS/browser really exposes it as a capture input, or use another available audio input (USB/interface/line-in/microphone). Visuals **does not require the EP** if another compatible source is selected. Show the active input, get explicit permission, and never silently fall back on disconnection. See [VISUALS.md](VISUALS.md).
- **Layout (owner-approved choice B):** a long, docked **bottom-edge meter strip**, like the owner's on-screen reference, inside the K.O. Tool browser viewport.
- **Platform scope (owner-approved choice A):** Visuals must remain **inside the K.O. Tool browser virtual desktop only**. No native macOS/Windows application, OS-level always-on-top overlay over other music programs, or separate future native phase is approved. A dedicated icon means an icon **inside K.O. Tool**, not a computer desktop icon.
- **V1 modules (owner-approved choice C):** **Waveform, Spectrum, Loudness, Stereo Meter, Output Meters, Oscilloscope and Spectrogram**. All seven are selectable, but users may hide modules.
- **Configuration (separate owner-approved choice C):** rearrange modules by dragging, resize widths, hide/restore panels, select built-in beatmaking/mixing/live-video presets, and save/recall personal strip layouts. Exact built-in preset contents are not yet chosen.
- **Layout storage (owner-approved choice A):** save named personal layouts in **browser-local site storage only**, available when reopening Visuals in the same browser profile/origin. Preserve module visibility, order and intended widths. No export/import preset files, accounts, cloud backend or cross-device sync. Browser data clearing, evictions, private mode and different profiles may lose or not share presets; the exact storage API/schema remains to be chosen. Strip height is **not saved** (owner-approved height memory choice A).
- **Strip height (owner-approved choice B):** resize the entire strip freely by dragging its **upper border**, moving it vertically while keeping the bottom edge docked inside K.O. Tool. Do not require the three size modes Compact/Standard/Expanded. **Height memory choice A:** adjusted height applies only for the running Visuals session; closing/reopening Visuals or reloading K.O. Tool restores the standard launch height. **Standard-height choice B: 150 CSS px** each time Visuals starts. Do not save height in browser preferences or user layouts. **Owner-approved height bounds choice A:** **90 CSS px minimum and 40% of the browser viewport's CSS height maximum**. Start at 150 CSS px if possible, otherwise cap it at 40% on smaller viewports where both bounds can be met. **Very-short viewport choice A:** below **225 CSS px**, prioritize the **90 CSS px minimum** even though it exceeds the nominal 40% cap; do not auto-collapse the strip to satisfy that percentage. **Owner-approved same-session preset switch choice A:** preserve the currently adjusted strip height across all built-in/custom layout changes, constrained only by applicable viewport bounds. Do not reset to 150 CSS px or store height in layouts. Keep meters legible and other app controls reachable.
- **Viewport height recovery (owner choice A):** keep the latest manually chosen height as a session-only preferred value. When the browser viewport shrinks, clamp displayed height but leave that preference intact; automatically restore it when the viewport grows enough (e.g., 250px preferred → 200px at 500px viewport → 250px at 800px viewport). Explicit further manual resizing changes the preference. The height still resets to the 150px launch target on a new Visuals session, is excluded from local layout presets, and obeys the approved 90px minimum / 40% cap with the below-225px minimum-priority exception.
- **Strip visibility (owner-approved choice C):** visible by default; optionally auto-hide and reveal on pointer approach to the bottom edge, or manually collapse and restore. These actions must not discard the chosen module arrangement.
- **Responsive layout (owner-approved choice C):** fit visible modules by shrinking to a usable minimum width, then expose horizontal scrolling for overflow. No automatic module hiding or order changes; resizing the viewport must not overwrite saved layout widths.
- **Default Balanced composition (owner-approved choice C):** large/prominent **Waveform** and **Spectrum**, medium **Spectrogram**, compact **Loudness**, **Stereo Meter**, **Output Meters** and **Oscilloscope**. Show all seven initially, with horizontal overflow if necessary; do not invent a left-to-right order or numerical widths. Workflow presets and user customizations remain available.
- **Visual themes (new owner decision, superseding the earlier four):** exactly **Retro/WIN**, **EP-133**, **EP-40**, **Minimal**; preserve per-module color selection and manual theme switching. Retro matches the existing K.O. Tool Win95-like CSS palette (`#008080`, `#c0c0c0`, `#000080`). It is the no-identified-device baseline. Once My EP validates the connected device, automatically select **EP-133 for resolved `TE032AS001`** or **EP-40 for `TE032AS006`**, using existing device identity logic, not microphone/USB Audio input labels. **Owner-approved EP-1320 fallback (choice A):** resolved EP-1320 Medieval (`TE032AS005`) selects existing **Retro/WIN** in Auto Theme, retaining the correct EP-1320 device label and without a fifth theme. **Owner choice B:** Auto Theme ON initially, but manual selection disables automatic switching within the current Visuals session until the user explicitly re-enables it; connecting a new EP must not override that choice. **Owner restart choice A:** reopening Visuals or reloading K.O. Tool resets to Auto Theme ON (verified-model theme or Retro/WIN baseline) rather than persisting the previous manual theme. **Owner disconnect choice A:** real EP disconnection while Auto Theme is ON promptly returns to **Retro/WIN** without disabling Auto Theme; manual choice remains unchanged with Auto Theme OFF. Do not mix theme updates with audio-input switching. Exact EP-themed palettes remain open. See [VISUALS.md](VISUALS.md).
- **Not decided:** exact default left-to-right order and numerical width ratios, layouts of the other workflow presets, minimum sizes, scrolling interaction and browser-local layout storage implementation, **exact EP-133/EP-40/Minimal palettes, unknown/ambiguous identity fallback, whether independent module color overrides are stored; strip height is explicitly not stored**, hide/reveal transitions, hidden-state audio capture policy, full-screen alternatives, latency/performance budget and any recording/export functionality. Do not assume audio is available over Web MIDI/SysEx; capture permissions and model/OS/browser compatibility need proof.
- **Boundary:** this approval is documentation of a product choice, **not permission to implement or deploy Visuals**.

## Qualitative community needs (not population statistics)

Selected community discussions and specific reported pain points, to be validated against current firmware and supported devices:

| Public discussion | Signal and possible design response |
| --- | --- |
| [Offline EP sample tool](https://www.reddit.com/r/teenageengineering/comments/1g1dipp/) | More legible labels and lists, sample group organization, and convenient drag/move; consider scalable text and robust multi-select. |
| [TRKLS app update](https://www.reddit.com/r/teenageengineering/comments/1tvyha6/ep133_sample_app_update_trklsnet/) | Positive response to guided tutorials; requests for keyboard preview and navigation. Favor contextual, dismissible help and shortcuts. |
| [EP sample packs](https://www.reddit.com/r/teenageengineering/comments/1f6gatm/ko_ii_sample_packs/) | Users search for ready-to-use packs and encounter memory/transfer friction; provide previews and a device-capacity budget. |
| [Library sharing](https://www.reddit.com/r/teenageengineering/comments/1wxln6h/ko_2_library_sharing/) | Interest in exchanging coherent kits and projects. Verify licenses, compatibility, dependency completeness and moderation costs. |
| [Backup archives](https://www.reddit.com/r/teenageengineering/comments/1wd36lk/ko2_backups_pak/) | Desire to share complete setups; inspect project-to-sample references and preview required storage before applying a pack. |
| [Live visual performance](https://www.reddit.com/r/teenageengineering/comments/1ph8n83/my_realtime_visuals_jamming_on_ep133/) | Visuals can make on-camera EP performances more appealing; prioritize optional low-latency, distraction-free modes. |

Reddit comments and votes here are **qualitative examples**, not a representative poll, reliable compatibility certification, or sufficient evidence to promise a feature.

## Interface and repository references

| Reference | What to examine | Boundary |
| --- | --- | --- |
| [Official Teenage Engineering apps](https://teenage.engineering/apps) | Sample-oriented device workflow, pad affordances, waveform, settings | Do not claim official affiliation or duplicate proprietary artwork/code. |
| [TRKLS](https://trkls.net/) | Onboarding tours, discovery cues, draggable audio workflows | User-supplied HTML contains tour-like behavior; do not present it as proven conversational AI. |
| [Best Friend](https://epbf.app/) and [Bank Snapshots](https://epbf.app/bank-snapshots) | All-pad overview, bulk file handling, external sample bank sharing | Community sharing is **not** a novel unserved category; differentiate through seamless device transfers and preview. |
| [ep133-krate](https://github.com/icherniukh/ep133-krate) | Keyboard-first browsing, sample audition, batch actions, status feedback | Reverse-engineered operations still require firmware-scoped hardware evidence. |
| [EP-133 KO II Studio](https://github.com/propann/EP-133-KO-II-Studio) | Pattern/piano-roll/song presentation | Inspect design ideas only; do not copy licensed UI/code or infer project writing safety. |
| [Offline sample tool](https://github.com/garrettjwilke/ep_133_sample_tool) | Zoom, sample organization and backup scopes | Match original functionality only where allowed by confirmed code and protocol. |
| [MiniMeters](https://minimeters.app/) | Spectrum, spectrogram, waveform, oscilloscope, level meter, themes and modular panels | Use independent UI and branding; an audio signal is required. Web MIDI does not carry audio. |
| [EP-133 Export to DAW](https://github.com/phones24/ep133-export-to-daw) | Export and portability workflows | Assess what projects actually preserve before advertising export parity. |

**Sources and verification rules:** treat external descriptions as research input; inspect primary repositories before implementation. Check current official OS release notes for USB Audio behavior, then test actual OS/browser routing and permissions. Do not assume all EP models or firmware expose the same stream.

## Suggested roadmap order (proposal, not new Linear commitments)

**P0 — stable foundation.** Keep [ZAT-48](https://linear.app/clouded/issue/ZAT-48) and [ZAT-9](https://linear.app/clouded/issue/ZAT-9) ahead of a broad OS redesign. Verify actual samples/projects on a backed-up physical EP, not just Chromium fake EP.

**P1 — everyday companion.** Smooth input-to-pad path, smarter capacity forecasts, firmware-aware destination checks, consistent shortcut navigation, clear progress, metadata and recovery. REPITCH feature only after explicit separate permission and acceptance tests.

**P2 — creative views.** Safe saved-project Step Sequencer/Piano Roll inside My EP, followed by researched live sync; **separate Visuals desktop app** using an appropriate audio input, and a source-backed, context-sensitive help assistant.

**P3 — community.** Searchable catalog with preview, downloadable sample packs and complete project dependencies; verify content licensing, malicious file handling, author rights, privacy, moderation and hosting cost **before** accepting uploads.

## Money and community

The owner is considering **donations** rather than putting essential functionality behind a subscription. This is not yet a pricing decision. Potential design: an unobtrusive “Support K.O. Tool” link to a verified payment platform, never required for sample transfers, backup, or recovery. Subscription/paid extras should only be adopted after cost, UX and user demand are evaluated. No payment code or cloud costs are authorized by this document.

## UX principles to validate

- **Connect and create:** device identity, synchronization state and next action should be obvious; use joyful design without blocking playing or loading.
- **No surprise writes:** occupied destinations and referenced-delete consequences visible before confirmation; cancellation has no mutation.
- **Readable and quick:** clear labels, keyboard access, drag-and-drop, fewest practical steps, fast audio previews.
- **Honest provenance:** saved project vs live device, fake EP vs hardware HIL, MIDI vs audio, tentative compatibility vs verified behavior.
- **Respect source creators:** link and credit references, obey licenses, avoid copying non-free assets.

## Questions not yet decided

1. What exact left-to-right order should the seven Visuals modules use in the initial Balanced layout? Height restoration after window expansion is now settled (owner choice A); very tiny viewport accessibility, unknown/ambiguous device handling and exact module widths remain undecided.
2. Should community sharing begin as downloadable packs before hosted uploads/accounts?
3. What donation provider, if any, and which (if any) nonessential supporter features?

Do not edit application code, Linear issues, hardware state, or deploy solely because this research exists.
