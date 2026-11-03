import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';
import { root } from './helpers.mjs';

const readme = readFileSync(join(root, 'README.md'), 'utf8');
const example = readFileSync(join(root, 'docs', 'example.md'), 'utf8');

test('docs/example.md demo block is the real, current output of the server on the fixture', async () => {
  const { demoText } = await import('../scripts/render-demo.mjs');
  const m = /<!-- demo:start -->\n```markdown\n([\s\S]*?)\n```\n<!-- demo:end -->/.exec(example);
  assert.ok(m, 'docs/example.md needs a demo block between demo:start and demo:end markers');
  assert.equal(m[1].trim(), await demoText(), 'docs/example.md is stale: run npm run demo');
});

test('the recorded Claude Code session matches what this server returns on its fixture today', async () => {
  const { call, connect, fixturePath } = await import('./helpers.mjs');
  const session = JSON.parse(readFileSync(join(root, 'assets', 'session.json'), 'utf8'));
  assert.equal(session.fixture, 'test/fixtures/heater-verify.log');
  const c = await connect();
  try {
    for (const step of session.steps) {
      assert.equal(step.tool, 'diagnose_log');
      const r = await call(c.client, step.tool, { path: fixturePath('heater-verify.log') });
      assert.equal(r.structuredContent.summary, step.result, 'assets/session.json is out of date: run npm run record, then npm run assets');
    }
  } finally { await c.close(); }
  assert.ok(session.answer.length > 0 && session.prompt.length > 0);
});

test('README points at the real picture files and every image has alt text', () => {
  for (const m of readme.matchAll(/(?:src|srcset)="([^"]+\.png)"/g)) assert.ok(existsSync(join(root, m[1])), `README references missing ${m[1]}`);
  for (const m of readme.matchAll(/<img [^>]*>/g)) assert.match(m[0], /alt="[^"]{10,}"/);
});

test('README states the read-only rule and the log privacy warning', () => {
  assert.match(readme, /read-only/i);
  assert.match(readme, /hostnames/i);
  assert.match(readme, /does not (move|heat)|never (move|heat)/i);
});

test('README rows match the registered tools', async () => {
  const { connect } = await import('./helpers.mjs');
  const c = await connect();
  try {
    const { tools } = await c.client.listTools();
    for (const t of tools) assert.ok(readme.includes('`' + t.name + '`'), `README missing tool ${t.name}`);
  } finally { await c.close(); }
});
