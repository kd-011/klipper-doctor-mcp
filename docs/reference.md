# Reference

## Tools

| Tool | What it does | Input |
| --- | --- | --- |
| `diagnose_log` | Explains why the print or session died, and lints the config Klipper wrote into the log. | One of `text`, `path`, or `moonraker: true` |
| `lint_config` | Config findings only, no crash report. | One of `text`, `path`, or `moonraker: true` (optional `config_file`) |
| `list_rules` | Every rule the engine can fire. | Optional `kind`: `crash` or `config` |
| `explain_rule` | What one rule catches, the usual fix and the Klipper docs page behind it. | `id` |
| `printer_status` | What Moonraker reports: Klippy's state and message, and the print state. | None. Needs `MOONRAKER_URL`. |

`path` reads a file on the machine that runs the server. `~` and `~/...` mean the home directory of the user running the server. `text` takes the file contents pasted in, which is fine for a short config and a poor fit for a large log, so let the agent pass a path or use Moonraker.

The rules themselves live in [klipper-doctor](https://github.com/kd-011/klipper-doctor). This server adds none.

## Configuration

| Variable | Purpose |
| --- | --- |
| `MOONRAKER_URL` | Base URL of Moonraker, for example `http://printer.local:7125`. Turns on `moonraker: true` and `printer_status`. No username or password in the URL. |
| `MOONRAKER_API_KEY` | Sent as the `X-Api-Key` header, if your Moonraker needs one. |
| `MOONRAKER_TOKEN` | Sent as `Authorization: Bearer ...`, if your Moonraker needs one. |
| `KLIPPER_DOCTOR_ALLOWED_DIRS` | Colon-separated directories. When set, the `path` option can only read files inside them. Unset means any file this process can read. |

The key and token are only ever sent as request headers. They are not logged, not returned by any tool and not written to disk. Redirects are not followed, so they cannot be forwarded to another host.

## What read-only means here

The server never moves the printer, heats anything, starts, stops or pauses a print, runs G-code, restarts Klipper or writes a file on the printer. The code enforces it:

- The Moonraker client has no way to send anything except `GET`, and only to a short list of documented read endpoints: `/server/files/klippy.log`, `/server/files/logs/klippy.log`, `/server/files/config/<file>`, `/printer/info` and `/printer/objects/query?print_stats&webhooks`. Any other path is refused before a request is made.
- A test runs every tool against a local fake Moonraker that records each request, and fails on any method other than `GET` or any path outside that list. Another test tries the Moonraker write and control endpoints (G-code, print start and cancel, restart, emergency stop, file upload and delete) and checks none of them reach the network.
- Every tool is marked `readOnlyHint` in its MCP annotations.
- The `path` option reads local files and writes nothing.

## Privacy

Logs can contain hostnames, usernames, file paths, serial numbers and IP addresses. Whatever the agent reads goes to your AI provider. Check what you are sharing, and use `KLIPPER_DOCTOR_ALLOWED_DIRS` to limit which files the agent can open.

## Limits

- It reads `klippy.log` and `printer.cfg`. Moonraker's own log is not parsed.
- It cannot see a failure that left no trace in the log.
- With a raw `printer.cfg`, options in `[include]`d files are not checked. A `klippy.log` has the includes already merged, so prefer that.
- Message wording differs between Klipper versions. When no rule matches, the engine says so.
- Moonraker's `/server/files/klippy.log` is only there when Klipper writes its log where Moonraker can serve it. If it is missing, the server tries the `logs` root.
- Klipper rotates `klippy.log` at midnight and keeps a few older files, so a failure from a few days ago may be in `klippy.log.<date>`. Point `path` at that file.
