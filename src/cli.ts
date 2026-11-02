#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MoonrakerClient, MoonrakerError } from './moonraker.js';
import { createServer, VERSION } from './server.js';
import { resolveAllowedDirs } from './source.js';
import type { Context } from './source.js';

const HELP = `klipper-doctor-mcp ${VERSION}
A read-only MCP server that lets an AI agent diagnose a Klipper printer.
It speaks MCP over stdio: start it from an MCP client, not by hand.

Environment:
  MOONRAKER_URL                 e.g. http://printer.local:7125. Enables fetching klippy.log,
                                printer.cfg and the printer state from Moonraker (GET only).
  MOONRAKER_API_KEY             Sent as the X-Api-Key header, if Moonraker needs one.
  MOONRAKER_TOKEN               Sent as "Authorization: Bearer", if Moonraker needs one.
  KLIPPER_DOCTOR_ALLOWED_DIRS   Colon-separated directories. When set, the path option can
                                only read files inside them.

Tools: diagnose_log, lint_config, list_rules, explain_rule, printer_status.
It never moves, heats, starts, stops or writes anything on the printer.`;

async function main(argv: string[]): Promise<void> {
  if (argv.includes('-h') || argv.includes('--help')) return void process.stdout.write(HELP + '\n');
  if (argv.includes('-v') || argv.includes('--version')) return void process.stdout.write(VERSION + '\n');

  const ctx: Context = { allowedDirs: await resolveAllowedDirs(process.env['KLIPPER_DOCTOR_ALLOWED_DIRS']) };
  const url = process.env['MOONRAKER_URL']?.trim();
  if (url) {
    try {
      ctx.moonraker = new MoonrakerClient({ url, apiKey: process.env['MOONRAKER_API_KEY'] || undefined, token: process.env['MOONRAKER_TOKEN'] || undefined });
    } catch (e) {
      // Keep the server up; the Moonraker tools will say what is wrong.
      ctx.moonraker = e instanceof MoonrakerError ? e.message : 'MOONRAKER_URL could not be used.';
    }
  }

  await createServer(ctx).connect(new StdioServerTransport());
  // stdout is the protocol channel. Status goes to stderr, and never includes the key or token.
  process.stderr.write(`klipper-doctor-mcp ${VERSION} ready (moonraker: ${typeof ctx.moonraker === 'object' ? 'configured' : 'not configured'})\n`);
}

main(process.argv.slice(2)).catch((e: unknown) => {
  process.stderr.write(`klipper-doctor-mcp: ${e instanceof Error ? e.message : 'failed to start'}\n`);
  process.exit(1);
});
