import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { call, connect, fakeMoonraker, ids, textOf } from './helpers.mjs';

const TOKEN = 'tok_SECRET_do_not_leak_123';
const KEY = 'key_SECRET_do_not_leak_456';

// Every path the server may ask Moonraker for. All are documented read endpoints.
const READ_PATHS = [
  /^\/server\/files\/klippy\.log$/,
  /^\/server\/files\/logs\/klippy\.log$/,
  /^\/server\/files\/config\/[^/]+$/,
  /^\/printer\/info$/,
  /^\/printer\/objects\/query$/,
];

function assertReadOnly(requests) {
  assert.ok(requests.length > 0, 'expected at least one request');
  for (const r of requests) {
    assert.equal(r.method, 'GET', `non-GET request: ${r.method} ${r.url}`);
    const path = new URL(r.url, 'http://x').pathname;
    assert.ok(READ_PATHS.some((re) => re.test(path)), `request to a path outside the read allowlist: ${r.url}`);
  }
}

describe('Moonraker fetch', () => {
  test('diagnose_log, lint_config and printer_status fetch over GET read endpoints only', async () => {
    const m = await fakeMoonraker();
    const c = await connect({ MOONRAKER_URL: m.url });
    try {
      const d = await call(c.client, 'diagnose_log', { moonraker: true });
      assert.ok(!d.isError, textOf(d));
      assert.deepEqual(ids(d.structuredContent.report.crash), ['heater-verify']);
      assert.equal(d.structuredContent.source, 'moonraker');

      const l = await call(c.client, 'lint_config', { moonraker: true });
      assert.ok(!l.isError, textOf(l));
      assert.ok(ids(l.structuredContent.report.config).includes('safe-z-home-conflict'));

      const s = await call(c.client, 'printer_status', {});
      assert.ok(!s.isError, textOf(s));
      assert.equal(s.structuredContent.klippy.state, 'shutdown');
      assert.equal(s.structuredContent.print.state, 'error');
      assert.equal(s.structuredContent.print.message, 'Heater extruder not heating at expected rate');

      assertReadOnly(m.requests);
      assert.ok(m.requests.some((r) => r.url.startsWith('/server/files/klippy.log') || r.url.startsWith('/server/files/logs/klippy.log')));
      assert.ok(m.requests.some((r) => r.url === '/server/files/config/printer.cfg'));
      assert.ok(m.requests.some((r) => r.url === '/printer/info'));
    } finally { await c.close(); await m.close(); }
  });

  test('every tool, run with Moonraker configured, still only sends GETs', async () => {
    const m = await fakeMoonraker();
    const c = await connect({ MOONRAKER_URL: m.url });
    try {
      await call(c.client, 'list_rules', {});
      await call(c.client, 'explain_rule', { id: 'heater-verify' });
      await call(c.client, 'diagnose_log', { moonraker: true });
      await call(c.client, 'lint_config', { moonraker: true });
      await call(c.client, 'printer_status', {});
      assertReadOnly(m.requests);
    } finally { await c.close(); await m.close(); }
  });

  test('a config file name that tries to leave the config root is refused before any request', async () => {
    const m = await fakeMoonraker();
    const c = await connect({ MOONRAKER_URL: m.url });
    try {
      for (const file of ['../logs/klippy.log', '/etc/passwd', 'a/../../b.cfg', '..']) {
        const r = await call(c.client, 'lint_config', { moonraker: true, config_file: file });
        assert.equal(r.isError, true, file);
      }
      assert.equal(m.requests.length, 0);
    } finally { await c.close(); await m.close(); }
  });

  test('config_file reads another file in the config root', async () => {
    const m = await fakeMoonraker();
    const c = await connect({ MOONRAKER_URL: m.url });
    try {
      const r = await call(c.client, 'lint_config', { moonraker: true, config_file: 'macros/start.cfg' });
      assert.ok(!r.isError, textOf(r));
      assert.equal(m.requests[0].url, '/server/files/config/macros/start.cfg');
    } finally { await c.close(); await m.close(); }
  });

  test('falls back to the logs root when /server/files/klippy.log is not there', async () => {
    const m = await fakeMoonraker({ noLog: true });
    const c = await connect({ MOONRAKER_URL: m.url });
    try {
      const r = await call(c.client, 'diagnose_log', { moonraker: true });
      assert.ok(!r.isError, textOf(r));
      assert.deepEqual(ids(r.structuredContent.report.crash), ['heater-verify']);
      assert.deepEqual(m.requests.map((q) => q.url), ['/server/files/klippy.log', '/server/files/logs/klippy.log']);
      assertReadOnly(m.requests);
    } finally { await c.close(); await m.close(); }
  });

  test('sends the API key and bearer token as headers, and never echoes either', async () => {
    const m = await fakeMoonraker({ requireKey: KEY });
    const c = await connect({ MOONRAKER_URL: m.url, MOONRAKER_API_KEY: KEY, MOONRAKER_TOKEN: TOKEN });
    try {
      const r = await call(c.client, 'diagnose_log', { moonraker: true });
      assert.ok(!r.isError, textOf(r));
      assert.ok(m.requests.every((q) => q.headers['x-api-key'] === KEY));
      assert.ok(m.requests.every((q) => q.headers['authorization'] === `Bearer ${TOKEN}`));
      const everything = JSON.stringify(r) + JSON.stringify(await call(c.client, 'printer_status', {}));
      assert.doesNotMatch(everything, /SECRET_do_not_leak/);
    } finally { await c.close(); await m.close(); }
  });

  test('a rejected key is a tool error that does not contain the key', async () => {
    const m = await fakeMoonraker({ requireKey: KEY });
    const c = await connect({ MOONRAKER_URL: m.url, MOONRAKER_API_KEY: 'key_WRONG_SECRET_789', MOONRAKER_TOKEN: TOKEN });
    try {
      const r = await call(c.client, 'diagnose_log', { moonraker: true });
      assert.equal(r.isError, true);
      assert.match(textOf(r), /401/);
      assert.doesNotMatch(JSON.stringify(r), /SECRET/);
    } finally { await c.close(); await m.close(); }
  });

  test('an unreachable Moonraker is a tool error, not a crash, and the server keeps working', async () => {
    const c = await connect({ MOONRAKER_URL: 'http://127.0.0.1:1' });
    try {
      const r = await call(c.client, 'printer_status', {});
      assert.equal(r.isError, true);
      assert.match(textOf(r), /127\.0\.0\.1:1/);
      const ok = await call(c.client, 'list_rules', {});
      assert.ok(!ok.isError);
    } finally { await c.close(); }
  });

  test('an invalid MOONRAKER_URL is reported without echoing credentials in the URL', async () => {
    const c = await connect({ MOONRAKER_URL: 'ftp://user:pa55w0rd@host' });
    try {
      const r = await call(c.client, 'printer_status', {});
      assert.equal(r.isError, true);
      assert.doesNotMatch(JSON.stringify(r), /pa55w0rd/);
    } finally { await c.close(); }
  });
});

describe('the client refuses write endpoints', () => {
  test('the Moonraker client has no way to send anything but a GET to a read path', async () => {
    const { MoonrakerClient, READ_ONLY_PATHS } = await import('../dist/moonraker.js');
    const m = await fakeMoonraker();
    try {
      const client = new MoonrakerClient({ url: m.url });
      assert.ok(READ_ONLY_PATHS.length >= 4);
      for (const p of [
        '/printer/gcode/script', '/printer/print/start', '/printer/print/pause', '/printer/print/resume', '/printer/print/cancel',
        '/printer/restart', '/printer/firmware_restart', '/printer/emergency_stop', '/machine/reboot', '/machine/shutdown',
        '/server/files/upload', '/server/files/delete_file', '/server/files/config/../../../etc/passwd', '/access/login',
      ]) {
        await assert.rejects(() => client.getText(p), /read-only|not allowed/i, p);
      }
      assert.equal(m.requests.length, 0, 'a refused path must not reach the network');
      assert.equal(typeof client.post, 'undefined');
      assert.equal(typeof client.put, 'undefined');
      assert.equal(typeof client.delete, 'undefined');
    } finally { await m.close(); }
  });
});

describe('slow and stalled downloads', () => {
  test('a body that takes longer than the timeout in total, but keeps flowing, is fetched', async () => {
    const { MoonrakerClient } = await import('../dist/moonraker.js');
    const m = await fakeMoonraker({ drip: 60 }); // about 600 ms in total
    try {
      const client = new MoonrakerClient({ url: m.url, timeoutMs: 300 });
      const text = await client.fetchKlippyLog();
      assert.match(text, /not heating at expected rate/);
    } finally { await m.close(); }
  });

  test('a body that stalls halfway is a Moonraker error that says the download stopped', async () => {
    const { MoonrakerClient, MoonrakerError } = await import('../dist/moonraker.js');
    const m = await fakeMoonraker({ stall: true, drip: 10 });
    try {
      const client = new MoonrakerClient({ url: m.url, timeoutMs: 300 });
      await assert.rejects(() => client.fetchKlippyLog(), (e) => e instanceof MoonrakerError && /download .* stopped/i.test(e.message));
    } finally { await m.close(); }
  });
});
