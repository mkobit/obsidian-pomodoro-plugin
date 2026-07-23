## Why

`openspec/changes/ui-surface-inventory/design.md` briefs all 12 UI surfaces independently but explicitly leaves undefined the *cross*-surface visual language they'd all draw from: a color system for states, a typographic scale, a spacing scale, an iconography set. Without it, briefing each surface to Stitch (or implementing it directly) risks 12 visually inconsistent one-off screens rather than one coherent plugin — flagged as flow-gu1.19.2's explicit prerequisite for per-surface mockup generation (flow-gu1.19.6 and the flow-gu1.19.8–13 mockup beads all depend on it).

`ui-surface-inventory` itself is marked Complete in OpenSpec's tracking, and its own `proposal.md` scoped only `design.md`/`surface-model.md` — adding a new deliverable there would exceed that change's stated Impact. This is therefore a new, separate change.

## What Changes

- Add `DESIGN.md`: the shared visual-language foundation all 12 surfaces draw from — a semantic state-color mapping, a typographic scale, a spacing scale, and an iconography set, all expressed as Obsidian CSS custom-property references (theme-native) rather than resolved hex/px values.
- Settles the central open decision `design.md` posed (theme-native vs. custom brand identity): theme-native base chrome, with exactly one minimal accent layer reserved for a real communication gap (distinguishing "paused" from "running," which Obsidian's own semantic vars don't cover) — confirmed with Mike, 2026-07-23.
- Establishes principles for user CSS-snippet/theme compatibility (Mike, 2026-07-23): all visual values route through CSS custom properties (Obsidian's own, or a plugin-defined fallback), one stable documented class namespace, no inline JS-driven styling for anything a snippet should target.
- No `src/` or `styles.css` changes. Documentation/foundations artifact only, same convention as `ui-surface-inventory`.

## Capabilities

### New Capabilities
- `design-foundations`: the shared color/typography/spacing/iconography vocabulary all 12 UI-surface mockup and implementation passes draw from, referenced by `ui-surface-inventory`'s #1–#12 surface numbering.

### Modified Capabilities
(none — no existing capability's runtime requirements change; this is a documentation artifact, not a behavior change)

## Impact

- New: `openspec/changes/design-foundations/` (this change), including `DESIGN.md` and `specs/design-foundations/spec.md`.
- bd: flow-gu1.19.2 closed on completion; unblocks flow-gu1.19.6 and the six mockup beads (flow-gu1.19.8–13).
- No `src/` or `styles.css` changes.
