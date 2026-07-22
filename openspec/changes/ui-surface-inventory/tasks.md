## 1. Audit

- [x] 1.1 Read `src/views/timer-view.ts`, `src/views/write-back-modal.ts`, `src/views/routine-replace-modal.ts`, `src/main.ts`, `src/settings.ts` in full; grep for `addRibbonIcon`/`addCommand`/`addStatusBarItem`/`ItemView`/`isMobile`/`Platform` to confirm which surfaces exist and which don't.
- [x] 1.2 Confirm `styles.css`'s current content targets none of the plugin's own CSS classes (cross-check against flow-gu1.61's finding).
- [x] 1.3 Cross-reference every surface found against flow-gu1.11/.56/.57/.58/.59/.20.1's existing descriptions to determine which are already tracked and which are newly identified.

## 2. Capture

- [x] 2.1 Write `design.md`'s per-surface inventory: current state, what it communicates, information hierarchy, states, first-pass design direction — for all 12 identified surfaces/states.
- [x] 2.2 Write `design.md`'s "Confirmed absent" section documenting negative findings (no ribbon icon, no commands, no mobile-specific code, native-chrome-only surfaces).

## 3. File and link beads

- [x] 3.1 File flow-gu1.62 (`RoutineReplaceModal: visual design pass`) for the newly identified confirmation-dialog surface.
- [x] 3.2 Append a cross-reference note to flow-gu1.20 pointing at this change.
- [x] 3.3 Append a cross-reference note to flow-gu1.20.1 pointing at this change.
- [x] 3.4 Close flow-gu1.20.1 once the above are complete.

## 4. Model the surfaces (taxonomy / relationships / jobs / interactions)

- [x] 4.1 Write `surface-model.md` §1: taxonomy classifying all 12 surfaces by Obsidian primitive and lifecycle.
- [x] 4.2 Write `surface-model.md` §2: relationships — concurrency matrix, mutual exclusion, grounded triggers/lifecycle table, sequencing; resolve `design.md`'s surface #9-vs-#1 open question (§2.5).
- [x] 4.3 Write `surface-model.md` §3: per-surface jobs-to-be-done.
- [x] 4.4 Write `surface-model.md` §4: grounded interactions inventory with file:line references and keyboard-behavior note; mark #9–#12 interactions proposed.
- [x] 4.5 Reference `surface-model.md` from `design.md`; strike-through the now-resolved open question. Re-run `openspec validate ui-surface-inventory --strict`.
