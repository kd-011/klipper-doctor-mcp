import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { call, connect, fixturePath, ids, root, textOf } from './helpers.mjs';

const json = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

// What a stranger hits on the first run.
test('path accepts ~/ the way an agent writes it, using the HOME of the server process', async () => {
  const home = mkdtempSync(join(tmpdir(), 'kdm-home-'));
  mkdirSync(join(home, 'printer_data', 'logs'), { recursive: true });
  cpSync(fixturePath('heater-verify.log'), join(home, 'printer_data', 'logs', 'klippy.log'));
  const c = await connect({ HOME: home });
  try {
    const r = await call(c.client, 'diagnose_log', { path: '~/printer_data/logs/klippy.log' });
    assert.ok(!r.isError, textOf(r));
    assert.deepEqual(ids(r.structuredContent.report.crash), ['heater-verify']);
  } finally {
    await c.close();
    rmSync(home, { recursive: true });
  }
});

test('~/ obeys KLIPPER_DOCTOR_ALLOWED_DIRS like any other path', async () => {
  const home = mkdtempSync(join(tmpdir(), 'kdm-home-'));
  const other = mkdtempSync(join(tmpdir(), 'kdm-other-'));
  cpSync(fixturePath('heater-verify.log'), join(home, 'klippy.log'));
  const c = await connect({ HOME: home, KLIPPER_DOCTOR_ALLOWED_DIRS: other });
  try {
    const r = await call(c.client, 'diagnose_log', { path: '~/klippy.log' });
    assert.equal(r.isError, true);
    assert.match(textOf(r), /outside KLIPPER_DOCTOR_ALLOWED_DIRS/);
  } finally {
    await c.close();
    rmSync(home, { recursive: true });
    rmSync(other, { recursive: true });
  }
});

test('giving no input says where klippy.log usually is', async () => {
  const c = await connect();
  try {
    const r = await call(c.client, 'diagnose_log', {});
    assert.equal(r.isError, true);
    assert.match(textOf(r), /printer_data\/logs\/klippy\.log/);
    assert.match(textOf(r), /exactly one of/i);
  } finally { await c.close(); }
});

test('list_rules and explain_rule carry the suppressible flag the engine now reports', async () => {
  const c = await connect();
  try {
    const list = await call(c.client, 'list_rules', {});
    assert.ok(list.structuredContent.rules.every((x) => typeof x.suppressible === 'boolean'));
    const one = await call(c.client, 'explain_rule', { id: 'heater-verify' });
    assert.ok(!one.isError, textOf(one));
    assert.equal(one.structuredContent.rule.suppressible, false);
  } finally { await c.close(); }
});

// What makes it installable from npm.
test('package.json has no git or file dependency, and the engine is a normal semver range', () => {
  const pkg = json('package.json');
  for (const [name, range] of Object.entries({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
    assert.match(range, /^[\^~]?\d+\.\d+\.\d+$/, `${name} is "${range}", which is not a published version`);
  }
  assert.match(pkg.dependencies['klipper-doctor'], /^\^0\.\d+\.\d+$/);
});

test('package-lock.json resolves the engine from the npm registry', () => {
  const lock = json('package-lock.json');
  assert.match(lock.packages['node_modules/klipper-doctor'].resolved, /^https:\/\/registry\.npmjs\.org\//);
});

test('server.json versions match package.json, and the registry name matches mcpName', () => {
  const pkg = json('package.json');
  const server = json('server.json');
  assert.equal(server.version, pkg.version);
  assert.equal(server.packages[0].version, pkg.version);
  assert.equal(server.packages[0].identifier, pkg.name);
  assert.equal(server.name, pkg.mcpName);
});

test('CHANGELOG has a section for the current version', () => {
  const pkg = json('package.json');
  assert.match(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), new RegExp(`^## \\[${pkg.version.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm'));
});

// Found in the stranger test: asked "why did my print stop?" with a klippy.log in the folder, Claude Code never
// called the server. It read the log with Bash instead. The server now tells the client when to use it.
test('the server tells the client to call diagnose_log first for any Klipper stop', async () => {
  const c = await connect();
  try {
    const text = c.client.getInstructions() ?? '';
    assert.match(text, /diagnose_log/);
    assert.match(text, /klippy\.log/);
    assert.match(text, /before (reading|grepping)/i);
    assert.match(text, /read-only/i);
  } finally { await c.close(); }
});

test('diagnose_log says when to use it, in the words a user would say', async () => {
  const c = await connect();
  try {
    const { tools } = await c.client.listTools();
    const d = tools.find((t) => t.name === 'diagnose_log').description;
    assert.match(d, /print (stopped|failed|died)|shut ?down|error/i);
    assert.match(d, /klippy\.log/);
  } finally { await c.close(); }
});
