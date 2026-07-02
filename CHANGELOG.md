# Changelog

## [0.1.0](https://github.com/mkobit/obsidian-pomodoro-plugin/compare/obsidian-pomodoro-plugin-0.0.1...obsidian-pomodoro-plugin-0.1.0) (2026-07-02)


### Features

* add minimal source skeleton ([1ac77c3](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/1ac77c3b8d79a80849b4e8d57a459d8928977900))
* add setting tab UI implementation ([8aa9c70](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/8aa9c70136b94cd54dec10792ae0fe33cea14971))
* **domain:** expand domain model v2 (PhaseGraph, CompletionPolicy, Hooks, FileMutation) ([#14](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/14)) ([1fe75f9](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/1fe75f948783241df60981f2a8b39664eea90d0b))
* **domain:** formalize Session/PhaseInstance/TaskSource/LogEntry types and switch durations to Temporal ([#9](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/9)) ([215e0a0](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/215e0a06a76e04b2078b72914e80a87704424fab))
* **domain:** implement FileMutation-apply mechanism (flow-2yp) ([#21](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/21)) ([9289dfc](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/9289dfc5156ffdb00a8fc4610169747a550181cb))
* **engine:** migrate reducer/store from Workflow to PhaseGraph (flow-gu1.17) ([#20](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/20)) ([478afd9](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/478afd92c3bd54395911a9c562acc07e6b1878ab))
* **engine:** wire CompletionPolicy execution into the reducer (flow-xn3) ([#22](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/22)) ([9285a2b](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/9285a2b12d5411c8754af47e15b66ca91f085064))
* **engine:** wire Hook execution into EngineStore dispatch (flow-qx9) ([#25](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/25)) ([8ab37af](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/8ab37af1b942224c9d6282298ff7ec92ea51c95d))
* implement frontmatter write-back on phase completion ([d22a0a0](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/d22a0a0301d38a2b7d7b58e1c0fd658891bb157a))
* implement PomodoroTimerView and register it in plugin entrypoint ([f8e7923](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/f8e79230bf9db16cae3e941a9499141d4af3747f))
* implement TimerManager core and unit tests ([62c683c](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/62c683c26e015078292076962d6bdeb7b43d65ee))
* **timer:** implement generic workflow and phase progression state machine ([#6](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/6)) ([b0a0c05](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/b0a0c05072aaa88dd3f1fc4e957fcdcf543819ae))
* **view:** filter task queue dynamically based on active phase query config ([#8](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/8)) ([304f500](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/304f5002c304d29f421f847487380d667db467ca))


### Bug fixes

* **ci:** fix artifact action versions, vault setup, lint config and type errors ([#5](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/5)) ([d05fdeb](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/d05fdebe3f83b42d674b9785c3888f3b8439044b))
* pre-commit lint-staged enforcement, tsc-files invocation, PhaseId brand collision ([#15](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/15)) ([61700e0](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/61700e04f11f54f57ede45967192cf47a2474175))


### Documentation

* add AGENTS.md instruction files for development guides ([9fe980d](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/9fe980d7e17da0e8b6aa94b371bb836ee1d156fa))
* add bootstrap and tooling implementation plan ([227c032](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/227c032141cdd3b47d9d447023785c5e6bc2545b))
* add design spec for pomodoro plugin ([157c94c](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/157c94c5bb3b2c03fcc16271873e10d59eb20732))
* add granular beads tasks with dependencies ([#4](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/4)) ([613291e](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/613291e3e8d7114443c1ceacb776de2a40434d55))
* add refactoring and settings implementation plan ([c8c3fc1](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/c8c3fc163632a405049c3ce639f2e802a7f31453))
* add timer engine and bases view implementation plan ([9670e23](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/9670e233b040118cfbee4eab3e813eb5a0d2b8b8))
* archive completion-policy-execution OpenSpec change (flow-xn3) ([#23](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/23)) ([03e5c42](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/03e5c42e6a2638ca2182a3673496f23201f52c53))
* document github repository policies ([8e855ec](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/8e855ec210f60394e3290e60f5317e4b8bea230e))
* propose hook-execution OpenSpec change (flow-qx9) ([#24](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/24)) ([f24649b](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/f24649bc8634fbaa30e91241ec5825cd9298a81f))
* sync beads task list ([#2](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/2)) ([d8408b1](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/d8408b171cba52c82eacb0ad885e574dd3cbdb23))
* sync beads task list (files flow-i43) ([#13](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/13)) ([bf3e008](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/bf3e008a14fc763a7b635095a4a52c1ddce50157))
* sync beads task list after closing flow-gu1.12 ([#10](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/10)) ([8688d9a](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/8688d9a1e1bb69d76a1d1fa7504a83cdf473728c))
* sync beads task list after closing flow-gu1.5 ([#7](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/7)) ([8df94d0](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/8df94d0cd412dba879b522c53455e81080327f7d))
* sync beads task list after closing flow-n1n ([#12](https://github.com/mkobit/obsidian-pomodoro-plugin/issues/12)) ([2e28881](https://github.com/mkobit/obsidian-pomodoro-plugin/commit/2e2888179d23a561e615afb890fc1ee45a165276))
