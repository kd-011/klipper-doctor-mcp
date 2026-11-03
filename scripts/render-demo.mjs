// Writes the demo block from the server's real output.
// Starts the built server over stdio, calls diagnose_log on test/fixtures/heater-verify.log
// and puts the text the agent receives between the demo markers in docs/example.md.
// Usage: npm run demo          (builds first via the npm script chain)
//        node scripts/render-demo.mjs --check   exits 1 if docs/example.md is stale
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { call, connect, fixturePath, root, textOf } from '../test/helpers.mjs';

export async function demoText() {
  const c = await connect();
  try {
    const r = await call(c.client, 'diagnose_log', { path: fixturePath('heater-verify.log') });
    if (r.isError) throw new Error(textOf(r));
    return textOf(r).trim();
  } finally {
    await c.close();
  }
}

const readmePath = join(root, 'docs', 'example.md');
const MARK = /(<!-- demo:start -->\n```markdown\n)[\s\S]*?(\n```\n<!-- demo:end -->)/;

if (import.meta.url === `file://${process.argv[1]}`) {
  const readme = readFileSync(readmePath, 'utf8');
  if (!MARK.test(readme)) throw new Error('docs/example.md has no demo:start / demo:end block');
  const next = readme.replace(MARK, (_, a, b) => a + '\u0000' + b).replace('\u0000', await demoText());
  if (process.argv.includes('--check')) {
    if (next !== readme) { console.error('docs/example.md is stale: run npm run demo'); process.exit(1); }
    console.log('docs/example.md is current');
  } else {
    writeFileSync(readmePath, next);
    console.log('docs/example.md updated');
  }
}
