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
- **Phase 2, Live:** respond to real EP playback and events only after supported MIDI/hardware capabilities are demonstrated on specified firmware; no invented playhead and no faster FILE polling as a substitute.

The existing `projectReader.js`, read-only inspector and gated 16-step `SEQUENCER` provide starting points, **not proof that a finished read-only piano roll or live sync exists**. See [SEQUENCER.md](SEQUENCER.md).

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

**P2 — creative views.** Safe saved-project Step Sequencer/Piano Roll, followed by researched live sync; optional audio-reactive performance workspace using a real audio input, and a source-backed, context-sensitive help assistant.

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

1. Should the Step/Piano Roll viewer live inside My EP or become a separate desktop icon?
2. Should project archives open offline, without a connected EP?
3. Which audio capture sources and performance view modes are acceptable across Mac and Windows?
4. Should community sharing begin as downloadable packs before hosted uploads/accounts?
5. What donation provider, if any, and which (if any) nonessential supporter features?

Do not edit application code, Linear issues, hardware state, or deploy solely because this research exists.
