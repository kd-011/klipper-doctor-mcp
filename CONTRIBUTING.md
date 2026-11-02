# Contributing

The most useful things are bug reports and a wrong or missing diagnosis. Use the issue templates, and remove anything private from a log before you paste it (hostnames, usernames, serial numbers, IP addresses).

## Where changes go

- **A wrong diagnosis, a missing rule or a bad config finding:** the rules live in [klipper-doctor](https://github.com/kd-011/klipper-doctor), not here. Open the issue or PR there. Its [CONTRIBUTING.md](https://github.com/kd-011/klipper-doctor/blob/main/CONTRIBUTING.md) explains how a rule is added; the one hard requirement is a Klipper docs page or source file behind it. A fix there reaches this server when it picks up the new klipper-doctor.
- **The MCP server itself** (tools, input handling, Moonraker fetch, docs): open it here.

## Ground rules

- **The server stays read-only.** No tool may move the printer, heat anything, start, stop or pause a print, run G-code, restart Klipper or write a file on the printer. The Moonraker client only sends `GET` to a short list of read endpoints, and a test enforces it. A change that adds an endpoint has to add it to that list with a link to the Moonraker docs, and say in the PR why it only reads.
- **Never log or return the Moonraker key or token.**
- **Fewer correct tools beat many shaky ones.** A tool must do something the engine or Moonraker really does. Do not add generic printer control; other servers cover that.
- **Minimal dependencies.** The MCP SDK, klipper-doctor and zod.
- **Fixtures are synthetic.** Build them in `scripts/make-fixtures.mjs` from the message formats in the Klipper source, then run `npm run fixtures`. Never commit a real person's log or config.
- Writing is plain English. No em dashes, no marketing words.

## Before you open a PR

```sh
npm ci
npm run check
npm test
```

If the output of `diagnose_log` changes, run `npm run assets` and commit the refreshed README demo.

## AI-assisted contributions

AI tools are fine to use. The rules are:

1. **Say so.** Name the tool in the PR description if an AI wrote or edited any part of the change.
2. **A human reviews it first.** You are responsible for every line you submit. Read it, run it and be able to explain it. Unreviewed generated output will be closed.
3. **Small PRs.** One logical change per PR. A large generated diff that mixes a fix, a refactor and new files will be asked to split.
4. **No invented behaviour.** Do not describe a Klipper or Moonraker behaviour you have not checked in their docs or source. Link the source.
5. **Tests that show the change works,** not tests written to match the code.

By contributing you agree your work is released under the MIT licence.
