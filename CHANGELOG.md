# Changelog

All notable changes to this project are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

First version, not yet published.

### Added
- MCP server over stdio with five read-only tools: `diagnose_log`, `lint_config`, `list_rules`, `explain_rule` and `printer_status`.
- Input as pasted text, a local file path, or fetched from Moonraker (`MOONRAKER_URL`, with optional `MOONRAKER_API_KEY` and `MOONRAKER_TOKEN`).
- A read-only Moonraker client: `GET` only, to `klippy.log`, a file in the config root, `/printer/info` and `/printer/objects/query`. Everything else is refused before a request is made.
- `KLIPPER_DOCTOR_ALLOWED_DIRS` to restrict the `path` option.
- Tests that run every tool over stdio against synthetic fixtures, and that record every request to a fake Moonraker.
- `server.json` draft for the MCP registry (not submitted).
