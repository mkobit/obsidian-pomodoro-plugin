# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ccf33ec3 -->
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

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until it's merged into `main` on the remote.

**`main` is branch-protected** — GitHub rejects direct pushes to it ("Changes must be made through a pull request"). Code/doc changes MUST go through a branch + PR, not `git push` to main directly. `bd dolt push` is unaffected — it targets a separate ref (`refs/dolt/data`), not `main`, so push it directly as usual.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUBLISH TO REMOTE** - This is MANDATORY:
   ```bash
   bd dolt push                                    # beads data — direct push is fine, separate ref
   git checkout -b <branch-name>                   # if not already on a feature branch
   git push -u origin <branch-name>
   gh pr create --title "..." --body "..."
   gh pr checks <pr-number> --watch --fail-fast     # wait for CI, don't sleep-poll manually
   gh pr merge <pr-number> --squash --delete-branch
   git checkout main && git pull
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches, delete merged local branches
6. **Verify** - All changes committed AND merged into main on the remote
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until the PR is merged into `main` on the remote
- NEVER stop before merging - that leaves work stranded on a branch or local-only
- NEVER say "ready to merge when you are" - YOU must open, watch, and merge the PR
- A rejected direct push to main is expected, not an error to force past — open a PR instead
- If a CI check fails, investigate before retrying; a bare re-run is only appropriate for a check already known to be flaky (e.g. flow-gu1.18)
<!-- END BEADS INTEGRATION -->


## Build & Test

_Add your build and test commands here_

```bash
# Example:
# npm install
# npm test
```

`bun run vault:dev` launches the provisioned Obsidian on the real display, for a human to interact with; it detaches and hands the shell back immediately.
For agent-driven verification, use `bun run vault:dev:headless` instead -- it wraps the same launch in Xvfb so no window appears on the real desktop. Unlike `vault:dev`, it blocks until Obsidian exits (Xvfb tears down as soon as the wrapped command returns, so it can't detach) -- run it with a backgrounding tool and send SIGTERM to end it.

## Architecture Overview

_Add a brief overview of your project architecture_

## Conventions & Patterns

_Add your project-specific conventions here_
