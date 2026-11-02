# klipper-doctor-mcp

[![ci](https://github.com/kd-011/klipper-doctor-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/kd-011/klipper-doctor-mcp/actions/workflows/ci.yml)
[![licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![node: 18 or newer](https://img.shields.io/badge/node-%E2%89%A518-339933)](package.json)

A read-only MCP server that lets an AI agent work out why a Klipper print died and what is wrong with `printer.cfg`.

It wraps the rule engine from [klipper-doctor](https://github.com/kd-011/klipper-doctor). Every finding comes from a rule that cites the Klipper docs or source it is based on.

## Demo

You ask your agent "why did my print stop?". It calls `diagnose_log` on the printer's `klippy.log` and gets this back. The text below is the output of this server on `test/fixtures/heater-verify.log`, a synthetic log built from the message formats in the Klipper source. It is regenerated with `npm run assets`, and a test fails if it goes stale.

<!-- demo:start -->
```markdown
**klipper-doctor**: 2 errors, 0 warnings, 2 notes (Klipper v0.12.0-250-g1a2b3c4d)

**Errors (2)**
- **Heater extruder not heating at expected rate** (crash, line 102): Klipper's verify_heater check shut the printer down because extruder was not heating as expected. Fix: Check the heater cartridge or bed wiring, that the thermistor reads sensibly and is seated, and that the heater actually warms up. Change verify_heater only as a last step.
- **pid_integral_max was removed from Klipper in [extruder]** (config, line 70): Config_Changes lists pid_integral_max as removed on 2021-11-02. Fix: Delete the line.

**Notes (2)**
- **[tmc2209 stepper_x] has stealthchop_threshold 500** (config, line 87): [tmc2209 stepper_x] sets stealthchop_threshold to 500, so the driver is in stealthChop below 500 mm/s and spreadCycle above it. Fix: Remove stealthchop_threshold from [tmc2209 stepper_x] or set it to 999999.
- **No [input_shaper] section** (config): Input shaping is optional. Fix: See Resonance Compensation if you see ringing on prints.

Checked with [klipper-doctor](https://github.com/kd-011/klipper-doctor) 0.1.0

Rule ids: heater-verify, removed-option, tmc-stealthchop-threshold, no-input-shaper (explain_rule gives the full text).
```
<!-- demo:end -->

The same call also returns the full report as structured JSON: every finding with its rule id, severity, fix, docs link and the log lines it came from.

## Install

Node 18 or newer. The server speaks MCP over stdio, so your MCP client starts it for you.

> Not on npm yet. Until it is, build it from a clone (see [Develop](#develop)) and use `node /path/to/klipper-doctor-mcp/dist/cli.js` in place of `npx -y klipper-doctor-mcp` below. The `klipper-doctor` engine is installed from GitHub for now and moves to the npm package once that is published.

Claude Code:

```sh
claude mcp add klipper-doctor -- npx -y klipper-doctor-mcp
# with a printer on your network:
claude mcp add klipper-doctor -e MOONRAKER_URL=http://printer.local:7125 -- npx -y klipper-doctor-mcp
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "klipper-doctor": {
      "command": "npx",
      "args": ["-y", "klipper-doctor-mcp"],
      "env": { "MOONRAKER_URL": "http://printer.local:7125" }
    }
  }
}
```

Cursor (`.cursor/mcp.json`, or `~/.cursor/mcp.json` for all projects):

```json
{
  "mcpServers": {
    "klipper-doctor": {
      "command": "npx",
      "args": ["-y", "klipper-doctor-mcp"],
      "env": { "MOONRAKER_URL": "http://printer.local:7125" }
    }
  }
}
```

`MOONRAKER_URL` is optional. Without it you can still hand the server a log as pasted text or a file path.

## Tools

| Tool | What it does | Input |
| --- | --- | --- |
| `diagnose_log` | Explains why the print or session died, and lints the config Klipper wrote into the log. | One of `text`, `path`, or `moonraker: true` |
| `lint_config` | Config findings only, no crash report. | One of `text`, `path`, or `moonraker: true` (optional `config_file`) |
| `list_rules` | Every rule the engine can fire. | Optional `kind`: `crash` or `config` |
| `explain_rule` | What one rule catches, the usual fix and the Klipper docs page behind it. | `id` |
| `printer_status` | What Moonraker reports: Klippy's state and message, and the print state. | None. Needs `MOONRAKER_URL`. |

`diagnose_log` and `lint_config` return a short markdown summary as text and the full report as structured JSON. You can paste the log, point at a file, or let the server fetch it from Moonraker.

## Configuration

| Variable | Purpose |
| --- | --- |
| `MOONRAKER_URL` | Base URL of Moonraker, for example `http://printer.local:7125`. Turns on `moonraker: true` and `printer_status`. No username or password in the URL. |
| `MOONRAKER_API_KEY` | Sent as the `X-Api-Key` header, if your Moonraker needs one. |
| `MOONRAKER_TOKEN` | Sent as `Authorization: Bearer ...`, if your Moonraker needs one. |
| `KLIPPER_DOCTOR_ALLOWED_DIRS` | Colon-separated directories. When set, the `path` option can only read files inside them. Unset means any file this process can read. |

The key and token are only ever sent as request headers. They are not logged, not returned by any tool and not written to disk. Redirects are not followed, so they cannot be forwarded to another host.

## Safety

It never moves the printer, heats anything, starts, stops or pauses a print, runs G-code, restarts Klipper or writes a file on the printer. The code enforces this:

- The Moonraker client has no way to send anything except `GET`, and only to a short list of documented read endpoints: `/server/files/klippy.log`, `/server/files/logs/klippy.log`, `/server/files/config/<file>`, `/printer/info` and `/printer/objects/query?print_stats&webhooks`. Any other path is refused before a request is made.
- A test runs every tool against a local fake Moonraker that records each request, and fails on any method other than `GET` or any path outside that list. Another test tries the Moonraker write and control endpoints (G-code, print start and cancel, restart, emergency stop, file upload and delete) and checks none of them reach the network.
- Every tool is marked `readOnlyHint` in its MCP annotations.
- The `path` option reads local files and writes nothing.

Logs can contain hostnames, usernames, file paths, serial numbers and IP addresses. Whatever the agent reads goes to your AI provider. Check what you are sharing, and use `KLIPPER_DOCTOR_ALLOWED_DIRS` to limit which files the agent can open.

## How it differs from other Klipper MCP servers

The other Klipper and Moonraker MCP servers control the printer and report its status; this one only diagnoses it, and it can run next to them.

## Limits

- It reads `klippy.log` and `printer.cfg`. Moonraker's own log is not parsed.
- It cannot see a failure that left no trace in the log.
- With a raw `printer.cfg`, options in `[include]`d files are not checked. A `klippy.log` has the includes already merged, so prefer that.
- Message wording differs between Klipper versions. When no rule matches, the engine says so.
- Moonraker's `/server/files/klippy.log` is only there when Klipper writes its log where Moonraker can serve it. If it is missing, the server tries the `logs` root.

## Develop

```sh
git clone https://github.com/kd-011/klipper-doctor-mcp
cd klipper-doctor-mcp
npm ci            # also builds
npm run check     # typecheck, text rules, README demo is current
npm test          # builds, then runs the tests
npm run fixtures  # rebuild test/fixtures
npm run assets    # refresh the README demo
```

The rules live in [klipper-doctor](https://github.com/kd-011/klipper-doctor). See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT. See [LICENSE](LICENSE). Release notes are in [CHANGELOG.md](CHANGELOG.md).
