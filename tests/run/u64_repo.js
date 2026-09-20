// Repository file budgets plus fail-closed token-tool regression controls.
// Usage: bun tests/run/u64_repo.js (requires ttok 0.3 on PATH).
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bend-repo-gate-'));
const report = [];
function run(cmd, args, cwd, env = process.env) {
  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8',
    timeout: 120000, maxBuffer: 8 << 20 });
  assert.equal(r.error, undefined, String(r.error));
  assert.equal(r.signal, null, 'Process terminated by signal: ' + r.signal);
  return { status: r.status, text: (r.stdout + r.stderr).trim() };
}
function pass(result) {
  assert.equal(result.status, 0, result.text);
  const m = /^PASS: (\d+) \/ (\d+)$/.exec(result.text);
  assert.ok(m, result.text);
  assert.equal(m[1], m[2], result.text);
}
try {
  pass(run(process.execPath, ['gates/repo.ts'], root));
  report.push({ repository_budgets: 'PASS' });
  const fixture = path.join(temp, 'fixture');
  const bin = path.join(temp, 'bin');
  fs.mkdirSync(path.join(fixture, 'gates'), { recursive: true });
  fs.mkdirSync(path.join(fixture, 'bend2'));
  fs.mkdirSync(bin);
  for (const f of ['repo.ts', '_lib.ts']) {
    fs.copyFileSync(path.join(root, 'gates', f), path.join(fixture, 'gates', f));
  }
  // Large enough that the gate must invoke ttok, not use its byte shortcut.
  fs.writeFileSync(path.join(fixture, 'bend2/comp.ts'), 'x '.repeat(65000));
  const which = run('which', ['git'], root);
  assert.equal(which.status, 0, which.text);
  fs.symlinkSync(which.text, path.join(bin, 'git'));
  for (const args of [['init', '-q'], ['add', 'gates', 'bend2']]) {
    const r = run('git', args, fixture);
    assert.equal(r.status, 0, r.text);
  }
  const env = { ...process.env, PATH: bin };
  const tool = path.join(bin, 'ttok');
  const cases = [
    ['exact-cap', 'echo 64000', true],
    ['over-cap', 'echo 64001', false],
    ['empty-output', 'exit 0', false],
    ['non-numeric', 'echo NaN', false],
    ['negative-count', 'echo -1', false],
    ['zero-count', 'echo 0', false],
    ['fractional-count', 'echo 1.5', false],
    ['unsafe-integer', 'echo 9007199254740992', false],
    ['failed-tool', 'echo 1; exit 1', false],
    ['missing-tool', null, false],
  ];
  for (const [name, body, ok] of cases) {
    if (body === null) fs.rmSync(tool, { force: true });
    else fs.writeFileSync(tool, '#!/bin/sh\ninput=$(/bin/cat)\ncase "$input" in\n'
      + '  "x "*) ' + body + ' ;;\n  *) echo 1 ;;\nesac\n', { mode: 0o755 });
    const r = run(process.execPath, ['gates/repo.ts'], fixture, env);
    if (ok) pass(r);
    else {
      assert.notEqual(r.status, 0, name + ' must fail closed: ' + r.text);
      assert.match(r.text, name === 'over-cap' ? /64001 > 64000/ : /ttok failed for/);
    }
    report.push({ control: name, expected: ok ? 'accept' : 'reject', passed: true });
  }
  console.log(JSON.stringify({ repository_gate: 'PASS', report }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
