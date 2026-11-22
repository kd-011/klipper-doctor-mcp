---
slug: klipper-doctor-mcp-brand
name: klipper-doctor-mcp brand
repo: .
status: active
last_verified: 2026-11-22
needs_review: true
---

# klipper-doctor-mcp: brand

Who the project speaks as. DESIGN.md is how it looks; this is how it talks. Drafted only from copy already shipped, every line cited; the operator owns it and clears needs_review once checked.

## Name and casing

- The package, binary and repo are `klipper-doctor-mcp`, lower case with hyphens, always in code formatting in prose. <!-- src: package.json#name, README.md:1 -->
- The registry title is "Klipper Doctor" and the registry name is `io.github.kd-011/klipper-doctor-mcp`. <!-- src: server.json -->
- The MCP server name sent to clients is `klipper-doctor-mcp`. The engine it wraps is `klipper-doctor`, a separate project. <!-- src: src/server.ts:67, README.md:3 -->
- The report header the engine prints is `**klipper-doctor**`, lower case. <!-- src: docs/example.md:9 -->
- Klipper, Moonraker, Claude Code, Claude Desktop and Cursor keep their own casing. <!-- src: README.md, docs/clients.md -->

## One-liner

A read-only MCP server that lets an AI agent diagnose a Klipper 3D printer: why a print died, and what is wrong with printer.cfg. (`package.json` description.)

## Audience

People who run Klipper and use an AI agent (Claude Code, Claude Desktop, Cursor), who want it to say why a print stopped. The README addresses them as "you" and offers other routes to people with no Klipper, no agent or no willingness to send a log to an AI provider. <!-- src: README.md:3, README.md:44-51 -->

## Is and is not

- It is a diagnosis tool: it applies klipper-doctor's rules to `klippy.log` and `printer.cfg` and cites the Klipper docs or source behind each finding.
- It is read-only and enforced in code.
- It is not printer control. The README sends anyone who wants the agent to drive the printer to other servers.
- It is not for Marlin or Bambu printers, and not for failures that left no trace in `klippy.log`.

## Voice

Plain, candid, specific.

- Do: say what was and was not run ("I have run none of them, so this is from their READMEs", "I have not run them"), give numbers and file names, and name the limits. <!-- src: README.md:40, docs/clients.md:5 -->
- Do: use the first person singular for personal testing claims. <!-- src: README.md:22, README.md:40 -->
- Do not: use em dashes, which `npm run check` rejects, or marketing words, which CONTRIBUTING bans. <!-- src: scripts/check-text.mjs, CONTRIBUTING.md:17 -->
- Banned words: none are listed beyond "no marketing words". <!-- src: CONTRIBUTING.md:17 -->

## Copy bank

- README opener: "Ask your AI agent why a Klipper print stopped." <!-- src: README.md:3 -->
- Registry description: "Read-only Klipper diagnosis: explains why a print died and lints printer.cfg." <!-- src: server.json -->
- Tool descriptions open with when to use it: "Use when a Klipper print stopped, failed or shut down, or the printer shows an error." <!-- src: src/server.ts:73-75 -->
- Install CTA: "claude mcp add klipper-doctor -- npx -y github:kd-011/klipper-doctor-mcp". <!-- src: README.md:17 -->
- Section titles are plain nouns and questions: "Try it", "What it gives the agent", "Other tools", "When not to use it". <!-- src: README.md -->
- Error tone: say what is wrong and what to do next, for example "Moonraker is not configured. Set the MOONRAKER_URL environment variable (for example http://printer.local:7125) in the MCP server config." <!-- src: src/source.ts:30-36 -->
- Rejections state the reason without alarm: "Refusing <path>: this server is read-only and that path is not allowed." <!-- src: src/moonraker.ts:174-180 -->
- The social card is `.github/social-preview.png`; its text is not read here. <!-- src: .github/social-preview.png -->

## Assets

- Social preview card: `.github/social-preview.png`. <!-- src: .github/social-preview.png -->
- README pictures: `assets/session.png` (wide) and `assets/session-hero.png` (narrow, for phones). <!-- src: README.md:5-8, assets/session.json -->
- No logo and no favicon: this is a package with no site. <!-- src: package.json#files -->

## Contact and legal

- Licence: MIT, copyright "2026 kd-011". <!-- src: LICENSE:1-3 -->
- Bugs and feature requests go through the GitHub issue templates, with blank issues off. A wrong diagnosis goes to klipper-doctor. <!-- src: .github/ISSUE_TEMPLATE/config.yml -->
- Security reports go through GitHub private vulnerability reporting on the repo. <!-- src: SECURITY.md:12-14 -->
- No privacy or terms page and no email address are shipped. The privacy notice is the README and SECURITY.md warning that logs reach your AI provider. <!-- src: README.md:36, SECURITY.md:8 -->

## Unverified

- Whether "plain, candid, specific" is the voice the owner wants: it is read from the README and docs, not decided.
- The package.json author is `kd-011`; no business name appears in shipped copy.
- The text on `.github/social-preview.png` was not read, so it is not quoted.
- No logo, favicon or other brand mark exists; whether one is wanted is the owner's call.
- The Bugs and security contact is GitHub only; no email is shipped, so none is listed.
