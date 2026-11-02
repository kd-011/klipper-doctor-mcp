import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { call, connect, fixture, fixturePath, ids, textOf } from './helpers.mjs';

describe('klipper-doctor-mcp over stdio', () => {
  let c;
  before(async () => { c = await connect(); });
  after(() => c.close());

  test('lists exactly the five tools, all marked read-only', async () => {
    const { tools } = await c.client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), ['diagnose_log', 'explain_rule', 'lint_config', 'list_rules', 'printer_status']);
    for (const t of tools) assert.equal(t.annotations?.readOnlyHint, true, `${t.name} must carry readOnlyHint`);
  });

  test('diagnose_log finds the heater-verify crash and config findings from pasted text', async () => {
    const r = await call(c.client, 'diagnose_log', { text: fixture('heater-verify.log') });
    assert.ok(!r.isError, textOf(r));
    const sc = r.structuredContent;
    assert.deepEqual(ids(sc.report.crash), ['heater-verify']);
    assert.equal(sc.report.crash[0].severity, 'error');
    assert.ok(sc.report.crash[0].evidence.some((e) => /not heating at expected rate/.test(e.text)));
    assert.ok(ids(sc.report.config).includes('removed-option'));
    assert.equal(sc.source, 'text');
    assert.match(textOf(r), /heater-verify/);
    assert.match(sc.summary, /error/);
  });

  test('diagnose_log reads a path', async () => {
    const r = await call(c.client, 'diagnose_log', { path: fixturePath('heater-verify.log') });
    assert.ok(!r.isError, textOf(r));
    assert.deepEqual(ids(r.structuredContent.report.crash), ['heater-verify']);
    assert.equal(r.structuredContent.source, 'path');
  });

  test('diagnose_log on a clean log says no failure found', async () => {
    const r = await call(c.client, 'diagnose_log', { text: fixture('clean.log') });
    assert.deepEqual(ids(r.structuredContent.report.crash), ['no-failure-found']);
  });

  test('diagnose_log needs exactly one source', async () => {
    const none = await call(c.client, 'diagnose_log', {});
    assert.equal(none.isError, true);
    assert.match(textOf(none), /exactly one/i);
    const two = await call(c.client, 'diagnose_log', { text: 'x', path: fixturePath('clean.log') });
    assert.equal(two.isError, true);
  });

  test('diagnose_log reports an unreadable path as a tool error', async () => {
    const r = await call(c.client, 'diagnose_log', { path: '/nonexistent/klippy.log' });
    assert.equal(r.isError, true);
    assert.match(textOf(r), /nonexistent/);
  });

  test('moonraker source without MOONRAKER_URL is a clear tool error', async () => {
    const r = await call(c.client, 'diagnose_log', { moonraker: true });
    assert.equal(r.isError, true);
    assert.match(textOf(r), /MOONRAKER_URL/);
  });

  test('lint_config finds the real problems in the bad printer.cfg and has no crash section', async () => {
    const r = await call(c.client, 'lint_config', { text: fixture('bad-printer.cfg') });
    assert.ok(!r.isError, textOf(r));
    const got = ids(r.structuredContent.report.config);
    for (const id of ['missing-required', 'safe-z-home-conflict', 'gcode-unindented', 'removed-option']) {
      assert.ok(got.includes(id), `expected ${id} in ${got.join(', ')}`);
    }
    assert.equal(r.structuredContent.report.crash, undefined);
    assert.doesNotMatch(textOf(r), /\bCRASH\b/);
  });

  test('lint_config reads a path', async () => {
    const r = await call(c.client, 'lint_config', { path: fixturePath('bad-printer.cfg') });
    assert.ok(ids(r.structuredContent.report.config).includes('safe-z-home-conflict'));
  });

  test('list_rules returns every rule the engine has, in both reports', async () => {
    const { rulesMetadata } = await import('klipper-doctor');
    const r = await call(c.client, 'list_rules', {});
    const rules = r.structuredContent.rules;
    assert.equal(rules.length, rulesMetadata().length);
    assert.ok(rules.some((x) => x.id === 'heater-verify' && x.kind === 'crash'));
    assert.ok(rules.some((x) => x.id === 'removed-option' && x.kind === 'config'));
    const crashOnly = await call(c.client, 'list_rules', { kind: 'crash' });
    assert.ok(crashOnly.structuredContent.rules.every((x) => x.kind === 'crash'));
  });

  test('explain_rule returns the engine text for a rule and a clear error for an unknown id', async () => {
    const r = await call(c.client, 'explain_rule', { id: 'heater-verify' });
    assert.ok(!r.isError, textOf(r));
    assert.equal(r.structuredContent.rule.id, 'heater-verify');
    assert.match(r.structuredContent.rule.docs, /^https:\/\/www\.klipper3d\.org\//);
    assert.match(textOf(r), /verify_heater/);
    const bad = await call(c.client, 'explain_rule', { id: 'no-such-rule' });
    assert.equal(bad.isError, true);
    assert.match(textOf(bad), /list_rules/);
  });

  test('printer_status without MOONRAKER_URL is a clear tool error', async () => {
    const r = await call(c.client, 'printer_status', {});
    assert.equal(r.isError, true);
    assert.match(textOf(r), /MOONRAKER_URL/);
  });
});

describe('path allowlist', () => {
  test('KLIPPER_DOCTOR_ALLOWED_DIRS blocks paths outside it', async () => {
    const c = await connect({ KLIPPER_DOCTOR_ALLOWED_DIRS: '/tmp/definitely-not-here' });
    try {
      const r = await call(c.client, 'diagnose_log', { path: fixturePath('heater-verify.log') });
      assert.equal(r.isError, true);
      assert.match(textOf(r), /KLIPPER_DOCTOR_ALLOWED_DIRS/);
    } finally { await c.close(); }
  });
  test('and allows paths inside it', async () => {
    const c = await connect({ KLIPPER_DOCTOR_ALLOWED_DIRS: fixturePath('') });
    try {
      const r = await call(c.client, 'diagnose_log', { path: fixturePath('heater-verify.log') });
      assert.ok(!r.isError, textOf(r));
    } finally { await c.close(); }
  });
});
