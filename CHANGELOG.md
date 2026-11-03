# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-11-03

First release meant to be installed. The engine now comes from npm, so `npx` works without git.

### Added
- `path` accepts `~` and `~/...`, using the home directory of the user running the server. Agents write `~/printer_data/logs/klippy.log` and the server used to answer "no such file". The `KLIPPER_DOCTOR_ALLOWED_DIRS` fence applies after the path is expanded.
- The error for a call with no input names the usual place of `klippy.log` and says `moonraker: true` needs `MOONRAKER_URL`.
- `list_rules` and `explain_rule` report `suppressible`, and a report's `meta` carries `suppressed`, both new in klipper-doctor 0.4.
- `docs/` with the tool reference and setup for other clients, `scripts/record-session.mjs` and `scripts/render-assets.mjs` for the README picture, and a recorded Claude Code session in `assets/session.json`.
- `publish.yml` and `scripts/release.mjs`: a merge that raises the version publishes to npm and cuts the GitHub Release. Until the first publish it needs an `NPM_TOKEN` secret and ends green with a notice when there is none.

### Changed
- `klipper-doctor` is `^0.4.0` from npm, where it was `github:kd-011/klipper-doctor`.
- TypeScript 7 and `@types/node` 26, actions/checkout and actions/setup-node 7 (the open Dependabot bumps).
- The README is shorter. Reference material moved to `docs/`.

## [0.1.0] - 2026-11-02

First version, run from a clone.

### Added
- MCP server over stdio with five read-only tools: `diagnose_log`, `lint_config`, `list_rules`, `explain_rule` and `printer_status`.
- Input as pasted text, a local file path, or fetched from Moonraker (`MOONRAKER_URL`, with optional `MOONRAKER_API_KEY` and `MOONRAKER_TOKEN`).
- A read-only Moonraker client: `GET` only, to `klippy.log`, a file in the config root, `/printer/info` and `/printer/objects/query`. Everything else is refused before a request is made.
- `KLIPPER_DOCTOR_ALLOWED_DIRS` to restrict the `path` option.
- Tests that run every tool over stdio against synthetic fixtures, and that record every request to a fake Moonraker.
- `server.json` draft for the MCP registry (not submitted).
