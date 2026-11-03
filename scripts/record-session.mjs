// Records a real Claude Code session that uses this server, into assets/session.json.
// It needs the `claude` CLI, signed in, and a built server (npm run build). Nothing is mocked: it runs
// `claude -p` against dist/cli.js in a scratch directory that holds only a copy of test/fixtures/heater-verify.log
// as klippy.log, with user settings turned off so none of the recorder's own configuration leaks in.
// The scratch directory's path is cut from the recorded tool input. Everything else is kept as it came back.
// Usage: node scripts/record-session.mjs        then: node scripts/render-assets.mjs
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixturePath, root } from '../test/helpers.mjs';

const PROMPT = 'My print stopped halfway. The log is klippy.log in this folder. Why did it stop, and what should I try? Keep it short.';

const dir = mkdtempSync(join(tmpdir(), 'kdm-session-'));
try {
  copyFileSync(fixturePath('heater-verify.log'), join(dir, 'klippy.log'));
  const mcp = join(dir, 'mcp.json');
  writeFileSync(mcp, JSON.stringify({ mcpServers: { 'klipper-doctor': { command: process.execPath, args: [join(root, 'dist', 'cli.js')] } } }));
  const args = ['-p', PROMPT, '--mcp-config', mcp, '--strict-mcp-config', '--setting-sources', 'project', '--allowedTools', 'mcp__klipper-doctor', '--output-format', 'stream-json', '--verbose', '--model', 'sonnet'];
  const run = spawnSync('claude', args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`claude exited ${run.status}: ${run.stderr}`);
  const events = run.stdout.trim().split('\n').map((l) => JSON.parse(l));
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init');
  const steps = [];
  const results = new Map();
  let answer = '';
  for (const e of events) {
    for (const c of e.message?.content ?? []) {
      if (c.type === 'tool_use' && c.name.startsWith('mcp__klipper-doctor__')) steps.push({ id: c.id, tool: c.name.replace('mcp__klipper-doctor__', ''), input: JSON.parse(JSON.stringify(c.input).split(dir + '/').join('')) });
      if (c.type === 'tool_result') results.set(c.tool_use_id, typeof c.content === 'string' ? c.content : c.content.map((x) => x.text ?? '').join(''));
      if (c.type === 'text' && e.type === 'assistant') answer = c.text;
    }
  }
  if (steps.length === 0) throw new Error('the agent never called a klipper-doctor tool');
  for (const s of steps) {
    const raw = results.get(s.id) ?? '';
    let summary = raw.slice(0, 120);
    try { summary = JSON.parse(raw).summary ?? summary; } catch { /* not JSON: keep the start of the text */ }
    s.result = summary;
    delete s.id;
  }
  const out = {
    recorded: new Date().toISOString().slice(0, 10),
    client: `Claude Code ${spawnSync('claude', ['--version'], { encoding: 'utf8' }).stdout.trim()}`,
    model: init?.model ?? 'unknown',
    server: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
    fixture: 'test/fixtures/heater-verify.log',
    prompt: PROMPT,
    steps,
    answer,
  };
  writeFileSync(join(root, 'assets', 'session.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(`recorded ${steps.length} tool call(s), answer ${answer.length} characters`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
