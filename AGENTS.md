# Obsidian Pomodoro Plugin

This repository contains a customizable Pomodoro timer plugin integrated with Obsidian Bases.
It is built with strict TypeScript enforcement.

## Code style and rules

The project enforces strict Functional Programming principles via `eslint`.
- **No mutations**: Use pure reducer functions for state transformations.
- **Dependency separation**: State reducer, state store, and execution tickers live in isolated modules.
- **Dependency Injection**: Inject dispatch handlers and settings instead of binding to global managers.
- **Date/Time**: Use the `Temporal` API for logic instead of the native `Date`.

## Commands

No CLI is installed globally.
Run devDependency binaries (e.g. `openspec`) via `bun x <name>`, never assume it's on `PATH`.

| Command | Description |
| :--- | :--- |
| `bun run build` | Compiles the plugin using esbuild. |
| `bun test` | Executes unit tests via bun test. |
| `bun run test:e2e` | Runs E2E tests using Playwright. |
| `bun run typecheck` | Type-checks with `tsc --noEmit`. |
| `bun run lint` | Lints with `eslint .`. |
| `bun run vault:dev` | Launches sandboxed Obsidian against the testing vault. |
| `bun x openspec` | Runs the OpenSpec CLI (proposal/apply/archive workflow). |

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
