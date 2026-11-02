// Fails when a tracked text file contains an em dash. The repo's writing rule is
// commas, colons and full stops instead. Run by `npm run check`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EM_DASH = String.fromCharCode(0x2014);
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !/(^|\/)package-lock\.json$|\.png$/.test(f));

let bad = 0;
for (const f of files) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, i) => {
    if (line.includes(EM_DASH)) {
      console.error(`${f}:${i + 1}: em dash`);
      bad++;
    }
  });
}
if (bad) process.exit(1);
console.log(`text check: ${files.length} files, no em dashes`);
