// Checked laws, reusable application example, and fail-closed negative controls.
// Usage: BEND_NO_TELEMETRY=1 bun tests/run/u64_proofs.js
// This validates source proofs, not the native C lowering; also run u64_verify.js.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const suite = path.join(root, 'demos/proof_u64');
const cli = path.join(root, 'bend2/main.ts');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bend-u64-proofs-'));
const report = [];
const success = 'All terms check.';

function invoke(file, checker = cli) {
  const r = spawnSync(process.execPath, [checker, file], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 8 << 20,
    env: { ...process.env, BEND_NO_TELEMETRY: '1' },
  });
  assert.equal(r.error, undefined, 'Checker failed to execute: ' + r.error);
  assert.equal(r.signal, null, 'Checker terminated by a signal: ' + r.signal);
  return { status: r.status, text: (r.stdout + r.stderr).trim() };
}
function clean(result) {
  // Exit status alone accepts unsafe/foreign proofs in the current CLI.
  assert.equal(result.status, 0, result.text);
  assert.equal(result.text, success, result.text);
}
function policy(dir) {
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.bend'))) {
    const code = fs.readFileSync(path.join(dir, file), 'utf8')
      .split('\n').map(line => line.split('#')[0]).join('\n');
    assert.doesNotMatch(code, /@unsafe|\?/, file + ': unsafe code or proof hole');
    for (const m of code.matchAll(/^\s*import\s+(\S+)/gm)) {
      const dep = m[1];
      assert.ok(dep === 'Base' || (/^\.\/[A-Za-z0-9_]+\.bend$/.test(dep)
        && fs.existsSync(path.join(dir, dep))), file + ': unexpected import ' + dep);
    }
  }
}
function variant(name, edit, expected) {
  const dir = path.join(temp, name);
  fs.cpSync(suite, dir, { recursive: true });
  edit(dir);
  const result = invoke(path.join(dir, 'PROOF.bend'));
  assert.equal(result.status, 1, name + ': must be rejected\n' + result.text);
  assert.match(result.text, expected, name + ': wrong reason for rejection');
  report.push({ negative: name, rejected: true });
}
function replace(file, before, after) {
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes(before), 'Mutation anchor missing: ' + before);
  fs.writeFileSync(file, text.replace(before, after));
}

try {
  policy(suite);
  clean(invoke(path.join(suite, 'PROOF.bend')));
  const laws = [...fs.readFileSync(path.join(suite, 'LAWS.bend'), 'utf8')
    .matchAll(/^law ([A-Za-z0-9_]+):/gm)].map(m => m[1]);
  assert.ok(laws.includes('pext_pdep_roundtrip') && laws.includes('popcount_bound'));
  report.push({ source_laws: laws, checked: true, unsafe_or_foreign: false });
  clean(invoke(path.join(suite, 'main.bend')));
  report.push({ importing_application: 'demos/proof_u64/main.bend', checked: true });
  const fixture = invoke(path.join(root, 'tests/proof/u64_laws.bend'));
  assert.equal(fixture.status, 0, fixture.text);
  assert.equal(fixture.text, '{==}');
  report.push({ standard_test_fixture: 'tests/proof/u64_laws.bend', checked: true });


  variant('missing-proof', dir => replace(path.join(dir, 'PROOF.bend'),
    'def Laws.popcount_zero():\n  {==}\n', ''), /TODO found/);
  variant('false-bound', dir => replace(path.join(dir, 'LAWS.bend'),
    'U64.popcount(x), 64', 'U64.popcount(x), 63'), /expected[\s\S]*observed/);
  variant('missing-laws-import', dir => fs.writeFileSync(path.join(dir, 'PROOF.bend'),
    'import Base\n'), /PROOF\.bend must import/);
  variant('proof-hole', dir => replace(path.join(dir, 'PROOF.bend'),
    'def Laws.popcount_zero():\n  {==}', 'def Laws.popcount_zero():\n  ?TODO'), /TODO found/);

  const unsafe = path.join(temp, 'unsafe-proof');
  fs.cpSync(suite, unsafe, { recursive: true });
  replace(path.join(unsafe, 'PROOF.bend'), 'def Laws.popcount_zero():',
    '@unsafe\ndef Laws.popcount_zero():');
  assert.throws(() => policy(unsafe), /unsafe code/);
  const warned = invoke(path.join(unsafe, 'PROOF.bend'));
  assert.match(warned.text, /unsafe or foreign/);
  assert.throws(() => clean(warned));
  report.push({ negative: 'unsafe-proof', rejected: true, raw_cli_status: warned.status });

  // A source implementation regression must break the proof, not just tests.
  // Copy only the checker inputs; never modify the actual checkout.
  const mutated = path.join(temp, 'mutated-checker');
  fs.mkdirSync(mutated);
  for (const file of ['bend.ts', 'comp.ts', 'main.ts', 'base.bend']) {
    fs.copyFileSync(path.join(root, 'bend2', file), path.join(mutated, file));
  }
  replace(path.join(mutated, 'base.bend'),
    'U32{Word.drop(32n, 32n, w)}', 'U32{Word.take(32n, 32n, w)}');
  const broken = invoke(path.join(suite, 'PROOF.bend'), path.join(mutated, 'main.ts'));
  assert.equal(broken.status, 1, 'Corrupt high-half packing must fail');
  assert.match(broken.text, /expected[\s\S]*observed/);
  report.push({ negative: 'corrupted-high-half', rejected: true });

  console.log(JSON.stringify({ proof_gate: 'PASS', report }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
