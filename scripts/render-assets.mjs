// Draws the README pictures from assets/session.json, the recording made by scripts/record-session.mjs.
// Usage: node scripts/render-assets.mjs
// Writes assets/session.png (wide) and assets/session-hero.png (narrow, for phones).
// Needs a headless Chromium. Set CHROME_BIN, or have chromium, google-chrome or a Playwright
// chrome-headless-shell on the machine. Font: JetBrains Mono, with system monospace fallbacks.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { root } from '../test/helpers.mjs';

const session = JSON.parse(readFileSync(join(root, 'assets', 'session.json'), 'utf8'));

function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const pw = join(homedir(), '.cache/ms-playwright');
  if (existsSync(pw)) {
    for (const d of readdirSync(pw).sort().reverse()) {
      if (!d.startsWith('chromium_headless_shell')) continue;
      for (const sub of readdirSync(join(pw, d))) {
        const bin = join(pw, d, sub, 'chrome-headless-shell');
        if (existsSync(bin)) return bin;
      }
    }
  }
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    for (const dir of (process.env.PATH ?? '').split(':')) if (existsSync(join(dir, name))) return join(dir, name);
  }
  throw new Error('no headless Chromium found. Set CHROME_BIN.');
}

const C = { bg: '#0d1117', bar: '#161b22', line: '#21262d', fg: '#e6edf3', dim: '#8b949e', green: '#7ee787', blue: '#79c0ff', amber: '#f0a040' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// **bold** and `code` from the model's markdown; everything else is plain text.
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<span class="code">$1</span>');
const plainLen = (s) => s.replace(/\*\*/g, '').replace(/`/g, '').length;

function wrap(text, width, indent = '') {
  const out = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (cur && plainLen(cur) + 1 + plainLen(word) > width) { out.push(cur); cur = indent + word; }
    else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) out.push(cur);
  return out;
}

function transcript(cols, { firstParagraphOnly }) {
  const step = session.steps[0];
  const args = Object.entries(step.input).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ');
  const lines = [];
  for (const l of wrap(session.prompt, cols - 2, '  ')) lines.push(`<span class="you">${lines.length ? '' : '&gt; '}${esc(l)}</span>`);
  lines.push('');
  lines.push(`<span class="ok">●</span> <b>klipper-doctor</b> <span class="dim">${esc(step.tool)}(${esc(args)})</span>`);
  for (const [i, l] of wrap(step.result, cols - 5, '').entries()) lines.push(`  <span class="dim">${i === 0 ? '⎿' : ' '}  ${esc(l)}</span>`);
  lines.push('');
  const paras = session.answer.split(/\n\s*\n/);
  for (const [i, para] of (firstParagraphOnly ? paras.slice(0, 1) : paras).entries()) {
    if (i > 0) lines.push('');
    for (const raw of para.split('\n')) {
      const m = /^(\s*(?:\d+\.|-)\s+)(.*)$/.exec(raw);
      const lead = m ? m[1] : '';
      for (const [j, l] of wrap(m ? m[2] : raw, cols - lead.length).entries()) lines.push(inline((j === 0 ? lead : ' '.repeat(lead.length)) + l));
    }
  }
  if (firstParagraphOnly) lines.push('', `<span class="dim">…</span>`);
  return lines;
}

function card({ width, size, lh, pad, cols, firstParagraphOnly }) {
  const lines = transcript(cols, { firstParagraphOnly });
  const bar = Math.round(lh * 1.9);
  const height = bar + pad * 2 + lh * lines.length;
  const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{background:transparent}
body{font-family:'JetBrains Mono','Fira Mono','DejaVu Sans Mono',ui-monospace,Menlo,Consolas,monospace;font-size:${size}px;line-height:${lh}px;color:${C.fg};font-variant-ligatures:none}
.card{width:${width}px;height:${height}px;background:${C.bg};border-radius:${Math.round(size * 0.8)}px;overflow:hidden;border:1px solid ${C.line}}
.bar{height:${bar}px;background:${C.bar};border-bottom:1px solid ${C.line};display:flex;align-items:center;padding:0 ${pad}px;gap:${Math.round(size * 0.5)}px}
.dot{width:${Math.round(size * 0.75)}px;height:${Math.round(size * 0.75)}px;border-radius:50%;background:#30363d}
.title{flex:1;text-align:center;color:${C.dim};font-size:${Math.round(size * 0.85)}px;margin-right:${Math.round(size * 3)}px}
.body{padding:${pad}px}
pre{font:inherit;white-space:pre}
b{font-weight:700}.dim{color:${C.dim}}.ok{color:${C.green}}.you{color:${C.amber}}.code{color:${C.blue}}
</style><div class="card"><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><div class="title">Claude Code, with klipper-doctor-mcp ${esc(session.server)}</div></div>
<div class="body"><pre>${lines.join('\n')}</pre></div></div>`;
  return { html, w: width, h: height };
}

const chrome = findChrome();
const tmp = mkdtempSync(join(tmpdir(), 'kdm-assets-'));
function shoot(name, { html, w, h }, scale) {
  const page = join(tmp, `${name}.html`);
  writeFileSync(page, html);
  const out = join(root, 'assets', `${name}.png`);
  execFileSync(chrome, ['--headless', '--no-sandbox', '--hide-scrollbars', '--default-background-color=00000000', `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, `--screenshot=${out}`, `file://${page}`], { stdio: 'ignore' });
  console.log(`wrote assets/${name}.png (${w * scale}x${h * scale})`);
}
shoot('session', card({ width: 820, size: 14, lh: 21, pad: 28, cols: 92, firstParagraphOnly: false }), 2);
shoot('session-hero', card({ width: 680, size: 20, lh: 30, pad: 32, cols: 48, firstParagraphOnly: true }), 2);
rmSync(tmp, { recursive: true, force: true });
