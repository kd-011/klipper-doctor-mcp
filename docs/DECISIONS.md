# klipper-doctor-mcp: decisions

Why the project is the way it is, newest first. One entry per decision: the date it was made, what was decided, and why. Entries are records: when a decision stops being true, leave it and add `Superseded YYYY-MM-DD: <what replaced it>.` to its end, then add the new decision above.

- 2026-11-22: Docs live in the repo (AGENTS.md, docs/), and the owner's project notes point at them. Why: coding agents in a worktree see the repo and never the notes.
- 2026-11-03: The engine is `klipper-doctor` from npm as a plain semver range, not a GitHub dependency. Why: `npx` then works without git, and a test pins it. Still true: `package.json#dependencies`, `test/stranger.test.mjs`.
- 2026-11-03: Publishing is a merge that raises the version, run by `publish.yml`; with no `NPM_TOKEN` and the package not on npm it ends green and does nothing. Why: only a token can make the first publish, and a merge to main must not go red. Still true: `.github/workflows/publish.yml`.
- 2026-11-02: The repo went public once the first build was green and a secret scan of the tree and history was clean. npm publish, registry submission and launch posts stay the owner's decisions. Why: the owner authorised going public on those conditions only. Carried over from the project notes; the repo cannot show it.
- 2026-11-02: Read-only is enforced in code, not by policy: a GET-only client with a path allowlist, `readOnlyHint` on every tool, and tests that fail on any other request. Why: the README and SECURITY.md promise it never moves, heats or writes anything on the printer, so the code has to hold that. Still true: `src/moonraker.ts`, `test/moonraker.test.mjs`.
- 2026-11-02: This server adds no rules and wraps the klipper-doctor engine. Why: the rules live in klipper-doctor, so a wrong diagnosis is reported and fixed there (README, CONTRIBUTING). Still true: `src/server.ts`, `CONTRIBUTING.md`.
