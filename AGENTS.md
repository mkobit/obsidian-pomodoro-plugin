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

| Command | Description |
| :--- | :--- |
| `bun run build` | Compiles the plugin using esbuild. |
| `bun test` | Executes unit tests via bun test. |
| `bun run test:e2e` | Runs E2E tests using Playwright. |
| `bun run vault:dev` | Launches sandboxed Obsidian against the testing vault. |
