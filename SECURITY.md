# Security

klipper-doctor-mcp is read-only by design. It never moves the printer, heats anything, starts, stops or pauses a print, runs G-code, restarts Klipper or writes a file on the printer. The Moonraker client only sends `GET` to a short list of read endpoints.

## What to know before you run it

- **Local files.** The `path` option reads any file the server process can read and returns findings from it. Set `KLIPPER_DOCTOR_ALLOWED_DIRS` to restrict it to the directories you choose. Findings quote log lines as evidence, so a prompt-injected agent could use `path` to read lines of other files that happen to match a rule, which is why the allowlist exists.
- **Logs are sensitive.** A `klippy.log` can contain hostnames, usernames, file paths, serial numbers and IP addresses. Whatever the agent reads is sent to your AI provider.
- **Moonraker credentials.** `MOONRAKER_API_KEY` and `MOONRAKER_TOKEN` are sent only as request headers to `MOONRAKER_URL`. They are not logged or returned by any tool, and redirects are not followed. Keep them in the MCP client's `env` block, not in prompts. Use a Moonraker account or key you are happy to give read access.
- **Network.** The server makes requests only to `MOONRAKER_URL`, and only if you set it. It does not phone home.

## Reporting a problem

If you find a security problem, for example a way to make a tool write or control something, leak the key or token, read outside the allowlist, or hang or crash the server with crafted input, use GitHub's private vulnerability reporting on this repository (the Security tab), not a public issue.

A wrong diagnosis is not a security problem. Report it in [klipper-doctor](https://github.com/kd-011/klipper-doctor).
