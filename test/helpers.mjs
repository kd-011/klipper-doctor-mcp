import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const fixturePath = (name) => join(root, 'test', 'fixtures', name);
export const fixture = (name) => readFileSync(fixturePath(name), 'utf8');
export const ids = (findings) => findings.map((f) => f.id);

/** Spawn the real binary over stdio and connect an SDK client to it. */
export async function connect(env = {}) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(root, 'dist', 'cli.js')],
    env: { PATH: process.env.PATH ?? '', ...env },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(transport);
  return { client, close: () => client.close() };
}

/** Call a tool and return the whole result. */
export const call = (client, name, args = {}) => client.callTool({ name, arguments: args });
export const textOf = (result) => result.content.map((c) => c.text ?? '').join('\n');

/**
 * A fake Moonraker. It records every request (method, url, headers) and answers
 * the read endpoints the server is documented to use. Any method other than GET
 * is answered 405 and still recorded, so a test can see it was attempted.
 */
export async function fakeMoonraker(opts = {}) {
  const requests = [];
  const printer = opts.printer ?? { state: 'shutdown', state_message: 'Heater extruder not heating at expected rate' };
  const stats = opts.printStats ?? { state: 'error', message: 'Heater extruder not heating at expected rate', filename: 'benchy.gcode' };
  const json = (res, body, status = 200) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const server = createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, headers: req.headers });
    const url = new URL(req.url, 'http://x');
    if (req.method !== 'GET') return json(res, { error: 'method not allowed' }, 405);
    if (opts.requireKey && req.headers['x-api-key'] !== opts.requireKey) return json(res, { error: { code: 401, message: 'Unauthorized' } }, 401);
    if (url.pathname === '/server/files/klippy.log' || url.pathname === '/server/files/logs/klippy.log') {
      // noLog: the top-level fallback endpoint is missing, only the logs root has it.
      if (opts.noLog && url.pathname === '/server/files/klippy.log') return json(res, { error: { code: 404, message: 'Not Found' } }, 404);
      res.writeHead(200, { 'content-type': 'text/plain' });
      const body = opts.log ?? fixture('heater-verify.log');
      if (opts.drip || opts.stall) {
        // drip: send the body in 10 pieces, drip ms apart. stall: send half, then go quiet.
        const piece = Math.ceil(body.length / 10);
        let i = 0;
        const send = () => {
          if (opts.stall && i >= 5) return;
          if (i >= 10) return res.end();
          res.write(body.slice(i * piece, (i + 1) * piece));
          i++;
          setTimeout(send, opts.drip ?? 10);
        };
        res.on('close', () => { i = 99; });
        return send();
      }
      return res.end(body);
    }
    if (url.pathname.startsWith('/server/files/config/')) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end(opts.cfg ?? fixture('bad-printer.cfg'));
    }
    if (url.pathname === '/printer/info') return json(res, { result: { ...printer, klipper_path: '/home/pi/klipper', software_version: 'v0.12.0-250-g1a2b3c4d' } });
    if (url.pathname === '/printer/objects/query') return json(res, { result: { eventtime: 1, status: { print_stats: stats, webhooks: printer } } });
    return json(res, { error: { code: 404, message: 'Not Found' } }, 404);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, requests, close: () => new Promise((r) => server.close(r)) };
}
