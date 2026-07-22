## ADDED Requirements

### Requirement: Grounded surface inventory
`design.md` SHALL enumerate every distinct UI surface a user can see in the plugin as implemented today, each entry citing the concrete `src/` file and line(s) it comes from. The inventory SHALL cover the 6 screens already tracked as flow-gu1 children (flow-gu1.20.1's `PomodoroTimerView`/`WriteBackModal` scope, flow-gu1.11, flow-gu1.56, flow-gu1.57, flow-gu1.58, flow-gu1.59) plus any additional surface found by auditing `src/views/`, `src/main.ts`, and `src/settings.ts` that is not yet named by one of those beads.

#### Scenario: Every tracked screen has an inventory entry
- **WHEN** a reader cross-references `design.md`'s inventory against the descriptions of flow-gu1.11, flow-gu1.56, flow-gu1.57, flow-gu1.58, and flow-gu1.59
- **THEN** each of those screens has a corresponding inventory entry in `design.md`

#### Scenario: Newly identified surfaces are itemized, not folded into an existing entry
- **WHEN** a reader looks for `PomodoroTimerView`'s error, loading, inert, empty-queue, and no-queue rendering states, and for `RoutineReplaceModal`
- **THEN** each has its own inventory entry (not merged into a single generic "timer view" entry), citing the exact file:line the state or component is implemented at

### Requirement: Honest current-state grounding
Each inventory entry SHALL state whether the surface exists in shipped code today or is an as-yet-unbuilt proposal (per its tracking bead), and SHALL NOT describe proposed visual treatment as already decided or implemented.

#### Scenario: Shipped-but-unstyled surface
- **WHEN** a reader reads the inventory entry for a surface that exists in `src/` today (e.g. `PomodoroTimerView`, `WriteBackModal`, `RoutineReplaceModal`, `PomodoroSettingTab`)
- **THEN** the entry states its current styling is unstyled/raw Obsidian defaults, consistent with `styles.css` containing no rules for any `pomodoro-*` class or `is-active-task`

#### Scenario: Not-yet-built surface
- **WHEN** a reader reads the inventory entry for a surface with no implementation yet (e.g. flow-gu1.11's workspace-wide view, flow-gu1.56's OS notifications, flow-gu1.57's phase-transition Notice toasts, flow-gu1.59's onboarding)
- **THEN** the entry states plainly that no code exists yet, and any visual/behavioral detail offered is marked as this change's own proposed direction, not an audit finding

### Requirement: Per-surface design-direction brief
Each inventory entry SHALL include a first-pass design direction covering: what the surface needs to communicate to the user, its information hierarchy, and its distinct states — expressed as prose suitable as an input brief for AI UI design tooling (Stitch), not as CSS rules or pixel/color values.

#### Scenario: Design direction has no implementation-level detail
- **WHEN** a reader searches `design.md`'s per-surface design-direction subsections for CSS property names, hex/color values, or pixel measurements
- **THEN** none are found — direction is expressed only as communication goals, hierarchy, and states
