import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { root } from './helpers.mjs';

const script = join(root, 'scripts', 'release.mjs');
const run = (args, env = {}) =>
  spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: '', NPM_TOKEN: '', ...env } });
const plan = (version, published, releaseExists, token = true) =>
  run(['plan', '--version', version, '--published', published, '--release-exists', String(releaseExists), '--has-token', String(token)]);
const read = (p) => readFileSync(join(root, p), 'utf8');

test('plan: a new version above everything published is published and released', () => {
  const j = JSON.parse(plan('0.3.0', '0.1.0,0.2.0', false).stdout);
  assert.equal(j.publish, true);
  assert.equal(j.release, true);
  assert.equal(j.skip, false);
});

test('plan: a version npm already has is not published again', () => {
  const j = JSON.parse(plan('0.2.0', '0.1.0,0.2.0', true).stdout);
  assert.equal(j.publish, false);
  assert.equal(j.release, false);
});

test('plan: published but no release yet finishes the release without publishing', () => {
  const j = JSON.parse(plan('0.2.0', '0.1.0,0.2.0', false).stdout);
  assert.equal(j.publish, false);
  assert.equal(j.release, true);
});

test('plan: first ever publish with a token goes ahead', () => {
  const j = JSON.parse(plan('0.2.0', '', false, true).stdout);
  assert.equal(j.publish, true);
  assert.equal(j.skip, false);
});

test('plan: first ever publish with no token skips, exits 0 and does nothing, so a merge never turns main red', () => {
  const r = plan('0.2.0', '', false, false);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.deepEqual([j.skip, j.publish, j.release], [true, false, false]);
  assert.match(j.reason, /NPM_TOKEN/);
});

test('plan: the token only matters before the package exists on npm', () => {
  const j = JSON.parse(plan('0.3.0', '0.2.0', false, false).stdout);
  assert.equal(j.skip, false);
  assert.equal(j.publish, true);
});

test('plan: with no --has-token flag it looks at $NPM_TOKEN and never prints it', () => {
  const secret = 'npm_SECRET_VALUE_1234';
  const none = run(['plan', '--version', '0.2.0', '--published', '', '--release-exists', 'false']);
  assert.equal(JSON.parse(none.stdout).skip, true);
  const set = run(['plan', '--version', '0.2.0', '--published', '', '--release-exists', 'false'], { NPM_TOKEN: secret });
  assert.equal(JSON.parse(set.stdout).skip, false);
  assert.ok(!set.stdout.includes(secret) && !set.stderr.includes(secret));
});

test('plan: compares numbers, not strings, and refuses to publish below the newest version', () => {
  assert.equal(JSON.parse(plan('0.10.0', '0.9.0', false).stdout).publish, true);
  assert.notEqual(plan('0.9.1', '0.10.0', false).status, 0);
  assert.equal(plan('0.1.5', '0.1.0,0.2.0', false).status, 1);
});

test('plan: anything but x.y.z fails', () => {
  for (const v of ['1.0', '1.0.0-rc.1', 'v1.0.0', '', '1.0.0+build']) assert.equal(plan(v, '0.1.0', false).status, 1, v);
});

test('plan writes skip=, publish= and release= to GITHUB_OUTPUT', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kdm-release-'));
  const out = join(dir, 'out');
  writeFileSync(out, '');
  const r = run(['plan', '--version', '0.3.0', '--published', '0.2.0', '--release-exists', 'false', '--has-token', 'false'], { GITHUB_OUTPUT: out });
  const text = readFileSync(out, 'utf8');
  rmSync(dir, { recursive: true });
  assert.equal(r.status, 0, r.stderr);
  assert.match(text, /^skip=false$/m);
  assert.match(text, /^publish=true$/m);
  assert.match(text, /^release=true$/m);
});

const CHANGELOG = '# Changelog\n\n## [Unreleased]\n\n## [0.3.0] - 2026-12-01\n\n### Added\n- the thing\n\n## [0.2.0] - 2026-11-02\n\n- old\n\n[0.3.0]: https://example.invalid/0.3.0\n';
function notes(version, text = CHANGELOG) {
  const dir = mkdtempSync(join(tmpdir(), 'kdm-notes-'));
  const file = join(dir, 'CHANGELOG.md');
  writeFileSync(file, text);
  const r = run(['notes', version, '--changelog', file]);
  rmSync(dir, { recursive: true });
  return r;
}

test('notes: prints that version\'s section and nothing from its neighbours', () => {
  const r = notes('0.3.0');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /- the thing/);
  assert.doesNotMatch(r.stdout, /old|example\.invalid|## \[/);
});

test('notes: a missing or empty section fails', () => {
  assert.equal(notes('9.9.9').status, 1);
  assert.equal(notes('0.3.0', '## [0.3.0] - 2026-12-01\n\n## [0.2.0]\n- x\n').status, 1);
});

test('notes: works on the real CHANGELOG for the current version', () => {
  const { version } = JSON.parse(read('package.json'));
  const r = run(['notes', version]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.trim().length > 0);
});

const publish = read('.github/workflows/publish.yml');

test('publish.yml runs on a package.json change on main and by hand, never on a tag', () => {
  assert.doesNotMatch(publish, /^\s*tags:/m);
  assert.match(publish, /^on:\n  push:\n    branches: \[main\]\n    paths: \[package\.json\]\n  workflow_dispatch:/m);
});

test('publish.yml has the permissions the release needs and no more', () => {
  assert.match(publish, /^permissions:\n  contents: write\n  id-token: write\n(?! +\w)/m);
});

test('publish.yml plans first, tells you when it skips, then checks, then publishes, then releases', () => {
  const order = ['release.mjs plan', 'steps.plan.outputs.skip', 'npm run check', 'npm test', 'release.mjs notes', 'npm publish --provenance --access public', 'gh release create'].map((s) => {
    const at = publish.indexOf(s);
    assert.ok(at >= 0, `publish.yml is missing: ${s}`);
    return at;
  });
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.match(publish, /::notice::/);
});

test('publish.yml never echoes the token and keeps setup-node from writing a placeholder', () => {
  assert.match(publish, /secrets\.NPM_TOKEN/);
  assert.doesNotMatch(publish, /echo[^\n]*\$\{?NPM_TOKEN/);
  assert.doesNotMatch(publish, /registry-url/);
});

test('publish.yml cannot run twice at once', () => {
  assert.match(publish, /^concurrency:\n  group: publish\n  cancel-in-progress: false/m);
});
