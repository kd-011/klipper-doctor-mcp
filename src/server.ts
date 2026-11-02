import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyze, countBySeverity, rulesMetadata, toMarkdown, verdict } from 'klipper-doctor';
import type { Finding, Report } from 'klipper-doctor';
import { z } from 'zod';
import { MoonrakerError } from './moonraker.js';
import { InputError, load, moonrakerOrThrow } from './source.js';
import type { Context } from './source.js';

export const VERSION: string = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;

const sourceShape = {
  text: z.string().optional().describe('The file contents, pasted.'),
  path: z.string().optional().describe('Path to a file on the machine running this server.'),
  moonraker: z.boolean().optional().describe('Fetch the file from Moonraker (needs MOONRAKER_URL in the server config).'),
};

const finding = z.object({
  id: z.string(),
  severity: z.enum(['error', 'warning', 'note']),
  title: z.string(),
  detail: z.string(),
  fix: z.string(),
  docs: z.string().optional(),
  evidence: z.array(z.object({ line: z.number(), text: z.string() })),
});
const reportMeta = z.object({
  inputKind: z.enum(['klippy.log', 'printer.cfg']),
  klipperVersion: z.string().optional(),
  mcus: z.array(z.object({ name: z.string(), version: z.string().optional() })),
  sessions: z.number(),
  linesRead: z.number(),
  analysedSession: z.number(),
});
const counts = z.object({ error: z.number(), warning: z.number(), note: z.number() });
const common = {
  source: z.enum(['text', 'path', 'moonraker']),
  summary: z.string().describe('One line: how many errors, warnings and notes.'),
  counts,
};

/** The engine's markdown, plus the rule ids it does not print, so an agent can call explain_rule. */
function markdownWithIds(report: Report): string {
  const ids = [...new Set([...report.crash, ...report.config].map((f) => f.id))];
  return ids.length > 0 ? `${toMarkdown(report)}\n\nRule ids: ${ids.join(', ')} (explain_rule gives the full text).` : toMarkdown(report);
}

const fail = (message: string) => ({ isError: true as const, content: [{ type: 'text' as const, text: message }] });

/** Run a handler; turn expected problems into tool errors and hide anything else. */
async function guard<T>(fn: () => Promise<T>): Promise<T | ReturnType<typeof fail>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof InputError || e instanceof MoonrakerError) return fail(e.message);
    return fail('Unexpected error while analysing the input. The input was not changed; nothing was written anywhere.');
  }
}

export function createServer(ctx: Context): McpServer {
  const server = new McpServer({ name: 'klipper-doctor-mcp', version: VERSION });

  server.registerTool(
    'diagnose_log',
    {
      title: 'Diagnose a klippy.log',
      description:
        'Read a Klipper klippy.log and explain why the print or session died, plus lint the printer.cfg that Klipper wrote into the log. Give exactly one of text, path or moonraker. Read-only: it never touches the printer.',
      inputSchema: sourceShape,
      outputSchema: { ...common, report: z.object({ meta: reportMeta, crash: z.array(finding), config: z.array(finding) }) },
      annotations: READ_ONLY,
    },
    (args) =>
      guard(async () => {
        const { text, source } = await load(args, ctx, 'klippy.log');
        const report = analyze(text, { filename: 'klippy.log' });
        return {
          content: [{ type: 'text' as const, text: markdownWithIds(report) }],
          structuredContent: { source, summary: verdict(report), counts: countBySeverity(report), report },
        };
      }),
  );

  server.registerTool(
    'lint_config',
    {
      title: 'Lint a printer.cfg',
      description:
        'Lint a Klipper printer.cfg (or the config inside a klippy.log) and return config findings only, no crash report. Give exactly one of text, path or moonraker. With moonraker, config_file picks a file in the config root (default printer.cfg). Read-only.',
      inputSchema: {
        ...sourceShape,
        config_file: z.string().optional().describe('With moonraker: a file path inside the config root. Default printer.cfg.'),
      },
      outputSchema: { ...common, report: z.object({ meta: reportMeta, config: z.array(finding) }) },
      annotations: READ_ONLY,
    },
    (args) =>
      guard(async () => {
        const { text, source } = await load(args, ctx, 'printer.cfg');
        const full = analyze(text, { filename: 'printer.cfg' });
        const report: Pick<Report, 'meta' | 'config'> = { meta: full.meta, config: full.config };
        const forText: Report = { ...report, crash: [] };
        return {
          content: [{ type: 'text' as const, text: markdownWithIds(forText) }],
          structuredContent: { source, summary: verdict(forText), counts: countBySeverity(forText), report },
        };
      }),
  );

  server.registerTool(
    'list_rules',
    {
      title: 'List klipper-doctor rules',
      description: 'List every rule the klipper-doctor engine can fire, with its id, severity and one-line title. Use explain_rule for the full text.',
      inputSchema: { kind: z.enum(['crash', 'config']).optional().describe('Only rules of this report.') },
      outputSchema: {
        rules: z.array(z.object({ id: z.string(), kind: z.enum(['crash', 'config']), severity: z.enum(['error', 'warning', 'note']), title: z.string(), docs: z.string() })),
      },
      annotations: READ_ONLY,
    },
    ({ kind }) => {
      const rules = rulesMetadata()
        .filter((r) => !kind || r.kind === kind)
        .map((r) => ({ id: r.id, kind: r.kind, severity: r.severity, title: r.title, docs: r.docs }));
      const lines = rules.map((r) => `- \`${r.id}\` (${r.kind}, ${r.severity}): ${r.title}`);
      return { content: [{ type: 'text' as const, text: lines.join('\n') }], structuredContent: { rules } };
    },
  );

  server.registerTool(
    'explain_rule',
    {
      title: 'Explain a rule',
      description: 'Explain one klipper-doctor rule by id: what it catches, the usual fix, and the Klipper docs page it comes from. Ids come from list_rules or from a finding.',
      inputSchema: { id: z.string().describe('A rule id such as heater-verify.') },
      outputSchema: {
        rule: z.object({ id: z.string(), kind: z.enum(['crash', 'config']), severity: z.enum(['error', 'warning', 'note']), title: z.string(), detail: z.string(), fix: z.string(), docs: z.string() }),
      },
      annotations: READ_ONLY,
    },
    ({ id }) => {
      const rule = rulesMetadata().find((r) => r.id === id.trim());
      if (!rule) return fail(`No rule with id "${id}". Call list_rules for the ids.`);
      const text = `**${rule.title}** (\`${rule.id}\`, ${rule.kind} report, ${rule.severity})\n\n${rule.detail}\n\nFix: ${rule.fix}\n\nSource: ${rule.docs}`;
      return { content: [{ type: 'text' as const, text }], structuredContent: { rule } };
    },
  );

  server.registerTool(
    'printer_status',
    {
      title: "Moonraker's reported printer state",
      description:
        "Ask Moonraker for Klippy's state and state message (which holds the last error when Klippy is in error or shutdown) and the print state. Needs MOONRAKER_URL. Read-only: two GET requests.",
      inputSchema: {},
      outputSchema: {
        klippy: z.object({ state: z.string().optional(), state_message: z.string().optional(), software_version: z.string().optional() }),
        print: z.object({ state: z.string().optional(), message: z.string().optional(), filename: z.string().optional() }).optional(),
        warnings: z.array(z.string()),
      },
      annotations: READ_ONLY,
    },
    () =>
      guard(async () => {
        const s = await moonrakerOrThrow(ctx).printerStatus();
        const lines = [`Klippy: ${s.klippy.state ?? 'unknown'}${s.klippy.state_message ? `. ${s.klippy.state_message}` : ''}`];
        if (s.print) lines.push(`Print: ${s.print.state ?? 'unknown'}${s.print.filename ? ` (${s.print.filename})` : ''}${s.print.message ? `. ${s.print.message}` : ''}`);
        for (const w of s.warnings) lines.push(w);
        return { content: [{ type: 'text' as const, text: lines.join('\n') }], structuredContent: { ...s } };
      }),
  );

  return server;
}

export type { Finding };
