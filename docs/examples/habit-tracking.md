# Habit tracking

## Description

A daily routine that includes a weights session — except on rest days, when that phase is skipped entirely.
Opens the day's habit note when the weights phase starts, and logs elapsed time when it ends, however it ends.

## Domain mapping

| Phase | id | kind | duration | taskSourceId | completionPolicy | logTarget | hooks |
|---|---|---|---|---|---|---|---|
| Weights | `weights` | `exercise` | 20m | `null` | `null` | `activeItem` | `onEnter: openHabitNote`, `onExit: logElapsed` |
| Cardio | `cardio` | `exercise` | 20m | `null` | `null` | `activeItem` | none |

Transitions from `weights` (declared in this order — order matters, see "Where it strains"):

1. `weights` → `cardio` under `{ kind: 'custom', predicate: isRestDay }`
2. `weights` → `cardio` under `always` (fallback)

The routine ends after `cardio`; the user stops the session rather than the graph auto-advancing further.

## Walk-through

This is the one use case in this doc that can't be walked through against the live engine — `resolveNextPhaseId` throws immediately on a `custom` condition, before any `onEnter`/`onExit` sequencing would matter.
Narrated as intended, ignoring that gap:

1. Session starts at `weights`. `onEnter(weights)` fires — intended to open the day's habit note as a side effect (a `FileMutation`, e.g. `append`, not literally "open a file in the editor," since Hooks return `FileMutation[]`, not UI commands).
2. `weights` runs its 20m timer and completes normally. Because `completionPolicy` is `null`, `completePhase` advances directly to `cardio` within the same `tick` — `onComplete(weights)`, `onExit(weights)`, `onEnter(cardio)` all fire together, same derivation as the pomodoro example.
   `onExit`'s hook is intended to log elapsed time regardless of whether the phase completed or was skipped.
3. On a rest day, the graph should instead resolve `weights` → `cardio` directly via the `custom` transition, without ever entering `weights` — so `onEnter(weights)`/`onExit(weights)` should never fire that day.

## Where it strains

- `TransitionCondition: { kind: 'custom' }` is fully specified in the schema, but `resolveNextPhaseId` throws on it unconditionally today (its own comment: "custom predicates aren't resolvable yet, since HookRegistry only resolves to Hooks that return `FileMutation[]`, not boolean-returning predicates").
  This is flow-b74.
  This use case cannot be built end to end right now — not a rough edge, a hard stop.
- Declaring the custom transition first is necessary — `resolveNextPhaseId` takes the first candidate whose condition is satisfied, and satisfaction can't be checked without evaluating the predicate first.
  That means it throws on every exit from `weights`, rest day or not.
  Reordering to put `always` first would avoid the throw but silently defeat the skip logic entirely, since `always` matches unconditionally and the loop returns as soon as one candidate matches.
- The type mismatch is structural, not just "the registry is empty": `HookRegistry.resolve` returns a `Hook`, `(context) => FileMutation[]`.
  A transition predicate needs `(context) => boolean`.
  Populating `HookRegistry` with entries doesn't fix this — `TransitionCondition.predicate` is typed as `HookName`, borrowing the same namespace as Hooks, but needs a different resolution target entirely (a predicate registry, or some other shape) if `custom` is ever going to work.
- `onEnter`/`onExit` firing "regardless of how the phase ends" (per `phase.ts`'s own doc comment on `onExit`) is exactly what's wanted for "log elapsed time either way" — this part of the model already fits.
  The friction here is entirely in the transition condition, not the phase-level hook events.
- Skipping a phase you never entered (rest day) is different from skipping a phase you did enter and abandoned partway (see `workout.md`).
  The domain model has only one `onSkip` event, fired only when a phase you were *in* gets abandoned via `advance-phase`.
  A phase skipped by never being entered at all (this use case) doesn't fire `onSkip` — it just never fires `onEnter` either.
  Whether that asymmetry matters depends on whether a hook ever needs to react to "a phase was bypassed today" as its own event, distinct from both "entered and finished" and "entered and abandoned."
