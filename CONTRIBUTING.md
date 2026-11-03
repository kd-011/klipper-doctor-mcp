# Contributing

Bug reports and reports of a wrong or missing diagnosis help most. Use the issue templates, and remove anything private from a log before you paste it (hostnames, usernames, serial numbers, IP addresses).

## Where changes go

- A wrong diagnosis, a missing rule or a bad config finding goes in [klipper-doctor](https://github.com/kd-011/klipper-doctor), where the rules live. Open the issue or PR there. Its [CONTRIBUTING.md](https://github.com/kd-011/klipper-doctor/blob/main/CONTRIBUTING.md) explains how a rule is added; the one hard requirement is a Klipper docs page or source file behind it. A fix there reaches this server when it picks up the new klipper-doctor.
- Anything about the MCP server itself (tools, input handling, Moonraker fetch, docs) goes here.

## Ground rules

- The server stays read-only. No tool may move the printer, heat anything, start, stop or pause a print, run G-code, restart Klipper or write a file on the printer. The Moonraker client only sends `GET` to a short list of read endpoints, and a test enforces it. A change that adds an endpoint has to add it to that list with a link to the Moonraker docs, and say in the PR why it only reads.
- Never log or return the Moonraker key or token.
- Add a tool only if the engine or Moonraker really does the thing. Do not add generic printer control; other servers cover that.
- Dependencies stay at the MCP SDK, klipper-doctor and zod.
- Fixtures are synthetic. Build them in `scripts/make-fixtures.mjs` from the message formats in the Klipper source, then run `npm run fixtures`. Never commit a real person's log or config.
- Write plain English, with no em dashes and no marketing words.

## Before you open a PR

```sh
npm ci
npm run check
npm test
```

If the output of `diagnose_log` changes, run `npm run demo` and commit the refreshed `docs/example.md`.

## Release

Releasing is a merge. Add a `## [x.y.z]` section to `CHANGELOG.md`, run `npm version <patch|minor|major> --no-git-tag-version`, set the two version fields in `server.json` to match (a test fails if they differ), and merge. `.github/workflows/publish.yml` publishes to npm and creates the GitHub Release when package.json has a version npm does not. Before the package has ever been published it needs an `NPM_TOKEN` secret, and without one it ends green with a notice and does nothing. After that it can use npm trusted publishing.

## AI-assisted contributions

AI tools are fine to use, with these rules:

1. Name the tool in the PR description if an AI wrote or edited any part of the change.
2. Review it yourself before you submit it. You are responsible for every line: read it, run it and be able to explain it. Unreviewed generated output will be closed.
3. Keep PRs small, one logical change each. A large generated diff that mixes a fix, a refactor and new files will be asked to split.
4. Do not describe Klipper or Moonraker behaviour you have not checked in their docs or source. Link the source.
5. Tests need to show the change works. Ones written to match the code do not.

By contributing you agree your work is released under the MIT licence.
