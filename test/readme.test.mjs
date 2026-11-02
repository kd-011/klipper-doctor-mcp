import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { join } from 'node:path';
import { root } from './helpers.mjs';

const readme = readFileSync(join(root, 'README.md'), 'utf8');

test('README demo block is the real, current output of the server on the fixture', async () => {
  const { demoText } = await import('../scripts/render-demo.mjs');
  const m = /<!-- demo:start -->\n```markdown\n([\s\S]*?)\n```\n<!-- demo:end -->/.exec(readme);
  assert.ok(m, 'README needs a demo block between demo:start and demo:end markers');
  assert.equal(m[1].trim(), await demoText(), 'README demo is stale: run npm run assets');
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
