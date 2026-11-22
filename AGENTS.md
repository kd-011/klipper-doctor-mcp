---
slug: klipper-doctor-mcp-agents
name: klipper-doctor-mcp agent guide
repo: .
status: active
last_verified: 2026-11-22
---

# klipper-doctor-mcp: guide for coding agents

The doc index is docs/README.md. Read docs/ARCHITECTURE.md before changing structure.

## Commands

- Install: `npm ci`. It also builds, because `prepare` runs the build. <!-- src: package.json#scripts.prepare -->
- Build: `npm run build` (tsc to `dist/`, then marks `dist/cli.js` executable). <!-- src: package.json#scripts.build -->
- Test: `npm test`. `pretest` builds first, then Node's built-in runner runs `test/*.test.mjs`. <!-- src: package.json#scripts.test, package.json#scripts.pretest -->
- Check before a PR: `npm run check` (typecheck with no emit, the em dash scan, and a check that `docs/example.md` is current). CI runs `npm ci`, `npm run check`, `npm test` on Node 18 and 22. <!-- src: package.json#scripts.check, .github/workflows/ci.yml -->
- Refresh the demo block in `docs/example.md`: `npm run demo`. <!-- src: package.json#scripts.demo, scripts/render-demo.mjs -->
- Rebuild fixtures: `npm run fixtures`. <!-- src: package.json#scripts.fixtures, scripts/make-fixtures.mjs:1-5 -->
- Redraw the README pictures from `assets/session.json`: `npm run assets` (needs a headless Chromium). Re-record the session with `npm run record` (needs a signed-in `claude` CLI). <!-- src: package.json#scripts.assets, package.json#scripts.record, scripts/render-assets.mjs:1-5, scripts/record-session.mjs:1-5 -->
- Run the server by hand: `node dist/cli.js` speaks MCP over stdio, so start it from an MCP client. `--help` and `--version` print and exit. <!-- src: src/cli.ts:8-41 -->
- Needs Node 18 or newer. <!-- src: package.json#engines.node -->
- No lint or format command exists. <!-- src: package.json#scripts -->

## Conventions

- TypeScript source in `src/`, ES modules on NodeNext, strict mode with `noUncheckedIndexedAccess`; tests are plain `.mjs` files that spawn the built `dist/cli.js` over stdio. <!-- src: tsconfig.json, test/helpers.mjs:13-24 -->
- The server stays read-only. No tool may move the printer, heat anything, start, stop or pause a print, run G-code, restart Klipper or write a file on the printer. <!-- src: CONTRIBUTING.md:12 -->
- A new Moonraker endpoint goes in `READ_ONLY_PATHS` with a link to the Moonraker docs, and the PR says why it only reads. <!-- src: src/moonraker.ts:9-16, CONTRIBUTING.md:12 -->
- Never log or return the Moonraker key or token. <!-- src: CONTRIBUTING.md:13 -->
- Add a tool only if the engine or Moonraker really does the thing. No generic printer control. <!-- src: CONTRIBUTING.md:14 -->
- Dependencies stay at the MCP SDK, klipper-doctor and zod. <!-- src: CONTRIBUTING.md:15, package.json#dependencies -->
- This repo adds no rules. A wrong diagnosis or missing rule is a klipper-doctor change. <!-- src: CONTRIBUTING.md:7, src/server.ts:3 -->
- Fixtures are synthetic: build them in `scripts/make-fixtures.mjs` from Klipper source message formats and never commit a real person's log or config. <!-- src: CONTRIBUTING.md:16, scripts/make-fixtures.mjs:1-5 -->
- Prose is plain English with no em dashes and no marketing words. <!-- src: CONTRIBUTING.md:17, scripts/check-text.mjs:1-2 -->
- A release is a merge: add a `## [x.y.z]` section to `CHANGELOG.md`, run `npm version <patch|minor|major> --no-git-tag-version`, set both version fields in `server.json`. <!-- src: CONTRIBUTING.md:31, .github/workflows/publish.yml:1-5 -->
- Name any AI tool that wrote or edited part of a PR in its description, and keep PRs to one logical change. <!-- src: CONTRIBUTING.md:37-39 -->

## Traps

- stdout is the MCP protocol channel. Anything the server prints for humans goes to stderr, and never includes the key or token. <!-- src: src/cli.ts:39-40 -->
- `npm test` spawns `dist/cli.js`, so a test run against stale `dist/` tests old code. `npm test` rebuilds through `pretest`; `node --test` on its own does not. <!-- src: test/helpers.mjs:14-19, package.json#scripts.pretest -->
- `scripts/check-text.mjs` fails `npm run check` on an em dash in any tracked or untracked text file, docs included. <!-- src: scripts/check-text.mjs:6-20 -->
- `docs/example.md` between the `demo:start` and `demo:end` markers is generated. A test fails when it differs from the server's real output, which changes when the output of `diagnose_log` or the klipper-doctor version changes. Run `npm run demo`. <!-- src: test/readme.test.mjs:10-15, scripts/render-demo.mjs:19-35 -->
- `assets/session.json` is checked against what the server returns on `test/fixtures/heater-verify.log`; when it drifts, run `npm run record` then `npm run assets`. <!-- src: test/readme.test.mjs:17-30 -->
- `README.md` must name every registered tool in backticks, state the read-only rule and carry the log privacy warning, or a test fails. <!-- src: test/readme.test.mjs:37-50 -->
- `package.json` and `server.json` versions must match, `server.json` name must equal `mcpName`, and `CHANGELOG.md` needs a section for the current version. <!-- src: test/stranger.test.mjs:77-89 -->
- Dependencies must be plain semver ranges (no git or file dependency), and `klipper-doctor` must be a `^0.x.y` range resolved from the npm registry in the lockfile. <!-- src: test/stranger.test.mjs:64-75 -->
- A merge to main that changes `package.json` triggers `publish.yml`. It publishes only when the version is above everything on npm and a token or trusted publishing is available; with no `NPM_TOKEN` and the package not yet on npm it ends green and publishes nothing. <!-- src: .github/workflows/publish.yml:7-8, scripts/release.mjs:1-12 -->
- `KLIPPER_DOCTOR_ALLOWED_DIRS` set to directories that all fail to resolve allows nothing, not everything. <!-- src: src/source.ts:81-94 -->
- The allowed-dirs check runs on the real path after symlinks are followed, and after `~` expands to the home of the user running the server. <!-- src: src/source.ts:59-69 -->
- The Moonraker client refuses redirects so the key and token cannot be forwarded to another host. <!-- src: src/moonraker.ts:97-102 -->
- The download timeout is per wait (headers, then each gap between body chunks), not for the whole download, so a large log on a slow link can finish. <!-- src: src/moonraker.ts:80-92 -->
- The `INSTRUCTIONS` string and the `diagnose_log` description are tested for the words an agent needs to call it before reading `klippy.log` itself. Rewording them can fail `test/stranger.test.mjs`. <!-- src: src/server.ts:63-74, test/stranger.test.mjs:93-111 -->

## Unverified

- Whether Claude Desktop and Cursor can run the server: the docs say only Claude Code has been run. <!-- src: docs/clients.md:5 -->
- Commit message style: the log shows short imperative subject lines, but no written rule exists.
