## ADDED Requirements

### Requirement: Theme-native base with a single minimal accent layer
`DESIGN.md` SHALL establish that base chrome (backgrounds, text, borders, existing interactive elements) maps 1:1 to Obsidian's own CSS custom properties, and that no more than one additional accent layer is introduced, reserved only for a state-communication gap Obsidian's own semantic vocabulary does not cover.

#### Scenario: Base chrome uses only Obsidian variables
- **WHEN** a reader checks any base-chrome color mapping (backgrounds, text, borders) in `DESIGN.md`
- **THEN** it references an Obsidian CSS custom property, not a plugin-authored hex value

#### Scenario: Accent layer is singular and justified
- **WHEN** a reader looks for custom (non-Obsidian) color values in `DESIGN.md`
- **THEN** at most one exists (the paused-state accent), and its need is justified by an explicit gap in Obsidian's semantic color vocabulary

### Requirement: No resolved hex or pixel values
Because the visual language is theme-native, `DESIGN.md` SHALL express colors, type sizes, and spacing as Obsidian CSS variable references or scale positions, not resolved hex/px literals — theme-native values are only meaningful once resolved against a specific running Obsidian theme.

#### Scenario: Values are deferred to generation/implementation time
- **WHEN** a reader searches `DESIGN.md` for hardcoded hex colors or literal pixel sizes outside of a documented fallback chain
- **THEN** none are found; `DESIGN.md` instead directs implementers to pull resolved values from a running Obsidian instance

### Requirement: User theming and CSS-snippet compatibility
`DESIGN.md` SHALL state principles that keep the plugin's UI overridable by user-authored CSS snippets and themes: all visual values route through CSS custom properties (Obsidian's own, or a plugin-defined fallback), one stable documented class namespace, and no inline JS-driven styling for anything a snippet should be able to target.

#### Scenario: Fallback values remain overridable
- **WHEN** a reader checks how `DESIGN.md` handles a variable that might be undefined in some themes (e.g. the paused-state accent)
- **THEN** the fallback is itself a CSS custom property with a `var(..., fallback)` chain, not an unconditional literal

### Requirement: Cross-surface state, typography, spacing, and iconography vocabulary
`DESIGN.md` SHALL define one shared mapping table each for semantic state colors, typographic roles, spacing roles, and iconography, referenced by surface number (per `ui-surface-inventory`'s #1–#12 numbering), so that per-surface Stitch briefs and implementation draw from a single consistent vocabulary rather than inventing one per surface.

#### Scenario: Every referenced surface state maps to the shared vocabulary
- **WHEN** a reader looks up a state color, type role, spacing role, or icon used by any of surfaces #1–#8 (shipped)
- **THEN** it traces to an entry in `DESIGN.md`'s shared tables, not a one-off value invented for that surface alone
