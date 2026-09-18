// Standalone, opt-in local/CI validation. No cluster, npm dependencies or GPU.
// Usage: bun tests/run/u64_verify.js [--regressions] [--bench]
// BENCH_N changes the opt-in benchmark length; CC selects Clang.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const root = path.resolve(import.meta.dirname, '../..');
process.chdir(root);
const bun = process.execPath, cc = process.env.CC || 'clang';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bend-u64-'));
const mask64 = (1n << 64n) - 1n;
const cli = [path.join(root, 'bend2/main.ts')];
const report = [];
function run(cmd, args, timeout = 120000) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout, maxBuffer: 32 << 20 });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r.stdout.trim();
}
function compile(src, stem) {
  run(bun, [...cli, src, '-o', stem + '.c', '-o', stem + '.js']);
}
function build(stem, name, flags = []) {
  run(cc, ['-O3', '-std=c11', ...flags, stem + '.c', '-pthread', '-lm', '-o', name]);
}
const fixtures = ['tests/base/u64_ops.bend', 'tests/base/u64_bmi.bend',
  'tests/base/u64_scans.bend', 'tests/compile/u64_storage.bend'];
for (const [i, src] of fixtures.entries()) {
  const want = fs.readFileSync(src, 'utf8').split('\n').filter(s => s.startsWith('#|'))
    .map(s => s.slice(2)).join('\n').trim();
  assert.equal(run(bun, [...cli, src]), want, src + ' normalizer');
  const stem = path.join(dir, 't' + i);
  compile(src, stem);
  assert.equal(run(bun, [stem + '.js']), want, src + ' JS');
  for (const [tag, flags] of [['generic', []], ['portable', ['-DBEND_U64_PORTABLE']],
    ['native', ['-march=native']], ['ubsan', ['-fsanitize=undefined', '-fno-sanitize-recover=all']]]) {
    const out = stem + '-' + tag;
    build(stem, out, flags);
    assert.equal(run(out, []), want, src + ' ' + tag);
  }
  report.push({ fixture: src, lanes: 'normalize, JS, generic C, portable C, native C, UBSan C' });
}

if (process.argv.includes('--regressions')) {
  const files = ['base', 'compile'].flatMap(ns => fs.readdirSync('tests/' + ns)
    .filter(f => /^(u32|array|closure)[a-z0-9_]*\.bend$/.test(f))
    .map(f => 'tests/' + ns + '/' + f));
  for (const [i, src] of files.entries()) {
    const text = fs.readFileSync(src, 'utf8');
    const want = text.split('\n').filter(s => s.startsWith('#|')).map(s => s.slice(2)).join('\n').trim();
    if (want.startsWith('Error:')) {
      const r = spawnSync(bun, [...cli, src], { encoding: 'utf8', timeout: 30000 });
      assert.equal(r.status, 1, src + ' expected rejection');
      assert.equal((r.stdout + r.stderr).trim() + '\nexit 1', want);
      continue;
    }
    assert.equal(run(bun, [...cli, src]), want, src + ' regression normalizer');
    const stem = path.join(dir, 'reg' + i);
    compile(src, stem);
    assert.equal(run(bun, [stem + '.js']), want, src + ' regression JS');
    build(stem, stem);
    assert.equal(run(stem, []), want, src + ' regression C');
  }
  report.push({ existing_regression_files: files.length, lanes: 'normalize, JS, C' });
}

const u = x => `U64.from_parts(${Number((x >> 32n) & 0xffffffffn)}, ${Number(x & 0xffffffffn)})`;
const show = x => `${x >> 32n}:${x & 0xffffffffn}`;
function next(x) { x ^= (x << 13n) & mask64; x ^= x >> 7n; return (x ^ (x << 17n)) & mask64; }
function pext(x, m) {
  let r = 0n, b = 1n;
  for (let i = 0n; i < 64n; i++) if ((m >> i) & 1n) {
    if ((x >> i) & 1n) r |= b;
    b <<= 1n;
  }
  return r;
}
function pdep(x, m) {
  let r = 0n, b = 1n;
  for (let i = 0n; i < 64n; i++) if ((m >> i) & 1n) {
    if (x & b) r |= 1n << i;
    b <<= 1n;
  }
  return r;
}
function scans(x) {
  const bits = x.toString(2);
  return [BigInt(bits.split('1').length - 1),
    x === 0n ? 64n : BigInt(bits.length - bits.lastIndexOf('1') - 1),
    x === 0n ? 64n : BigInt(64 - bits.length)];
}
const common = `import Base

def seed() -> IO(U32):
  import "./seed.c"
  import "./seed.js"

def show(a: U64) -> String:
  match a:
    case U64{lo, hi}:
      U32.show(hi) ++ ":" ++ U32.show(lo)

def next(+x: U64) -> U64:
  +a = U64.xor(x, U64.shln(x, 13n))
  +b = U64.xor(a, U64.shrn(a, 7n))
  U64.xor(b, U64.shln(b, 17n))
`;
fs.writeFileSync(path.join(dir, 'seed.c'), `Term seed_run(Env e, Term* f, IoWork* w) {
  volatile u32 x = 123456789u;
  return x;
}
static void __attribute__((constructor)) seed_use(void) { io_eff(CID_SEED, seed_run, 0); }
`);
fs.writeFileSync(path.join(dir, 'seed.js'), 'function seed() { return 123456789; }\n');
const exprs = ['U64.pext(x, m)', 'U64.pdep(x, m)', 'U64.mul(x, m)',
  'U64.and_not(x, m)', 'U64.lsb(x)', 'U64.clear_lsb(x)',
  'U64.shln(x, n)', 'U64.shrn(x, n)', 'U64.set_bit(x, n)',
  'U64.clear_bit(x, n)', 'U64.toggle_bit(x, n)',
  'U64.from_u32(U64.popcnt(x))', 'U64.from_u32(U64.ctz(x))',
  'U64.from_u32(U64.clz(x))'];
const src = path.join(dir, 'dynamic.bend');
fs.writeFileSync(src, common + `
def observe(+x: U64, +m: U64, +n: Nat) -> List<U64>:
  [${exprs.join(',\n    ')}]

def samples(n: Nat, x: U64) -> List<U64>:
  match n:
    case 0n:
      []
    case 1n+p:
      +a = next(x)
      +m = next(a)
      List.append(&1, U64, observe(a, m, U32.to_nat(U32.and(U64.low(m), 127))), samples(p, m))

def main() -> IO(Unit):
  do IO<Unit>:
    s : U32 <- seed()
    IO.print(List.show(~&1, ~U64, ~show, samples(64n, U64.from_parts(2882400018, s))))
`);
let x = (2882400018n << 32n) | 123456789n;
const expected = [];
for (let i = 0; i < 64; i++) {
  x = next(x); const a = x; x = next(x); const m = x, n = m & 127n;
  const bit = n >= 64n ? 0n : 1n << n;
  expected.push(pext(a,m), pdep(a,m), (a*m)&mask64, a & (~m & mask64),
    a & -a, a & (a-1n), n >= 64n ? 0n : (a<<n)&mask64,
    n >= 64n ? 0n : a>>n, a|bit, a & (~bit & mask64), a^bit, ...scans(a));
}
const want = '[' + expected.map(show).join(', ') + ']';
const stem = path.join(dir, 'dynamic');
compile(src, stem);
// Recognizing intrinsics only at emission is too late: ANF used to leave
// recursive U64 shifts in the hot path. Pin analysis/codegen, not only counts.
assert.ok(!/^#define FID_U64_(?:SHLN|SHRN|PEXT|PDEP)_GO/m.test(
  fs.readFileSync(stem + '.c', 'utf8')), 'U64 intrinsic leaked a source loop');
assert.equal(run(bun, [stem + '.js']), want, 'dynamic JS vs independent BigInt');
for (const [tag, flags] of [['generic', []], ['portable', ['-DBEND_U64_PORTABLE']],
  ['native', ['-march=native']], ['ubsan', ['-fsanitize=undefined', '-fno-sanitize-recover=all']]]) {
  const out = stem + '-' + tag;
  build(stem, out, flags);
  assert.equal(run(out, []), want, 'dynamic ' + tag + ' vs independent BigInt');
  if (process.arch === 'x64' && tag !== 'ubsan') {
    const asm = run('objdump', ['-d', out]);
    const hasPext = /\tpext\s/.test(asm), hasPdep = /\tpdep\s/.test(asm);
    if (tag === 'generic') { assert.ok(hasPext); assert.ok(hasPdep); assert.ok(/\tpopcnt\s/.test(asm)); }
    if (tag === 'portable') { assert.ok(!hasPext); assert.ok(!hasPdep); }
    report.push({ dynamic: tag, values: expected.length, pext_instruction: hasPext, pdep_instruction: hasPdep });
  }
}
report.push({ dynamic: 'JS + four C variants', independent_oracle_values: expected.length });

if (process.argv.includes('--bench')) {
  const n = Number(process.env.BENCH_N || 2000000);
  assert.ok(Number.isSafeInteger(n) && n > 0 && n <= 100000000);
  const mask = 0x000101010101017en; // a1 rook relevant occupancy, 12 bits
  fs.writeFileSync(path.join(dir, 'bench.bend'), common + `
def loop(n: Nat, x: U64, acc: U64) -> U64:
  match n:
    case 0n:
      acc
    case 1n+p:
      +a = next(x)
      loop(p, a, U64.add(acc, U64.pext(a, ${u(mask)})))

def main() -> IO(Unit):
  do IO<Unit>:
    s : U32 <- seed()
    IO.print(show(loop(U32.to_nat(${n}), U64.from_u32(s), U64.zero())))
`);
  const b = path.join(dir, 'bench');
  compile(b + '.bend', b);
  const compilerSource = fs.readFileSync(path.join(root, 'bend2/comp.ts'), 'utf8');
  const helpers = compilerSource.slice(compilerSource.indexOf('// BEND_U64_PORTABLE'),
    compilerSource.indexOf('INLINE f32 f32_unbox'));
  const twin = path.join(dir, 'twin');
  fs.writeFileSync(twin + '.c', `#include <stdint.h>
#include <stdio.h>
#define DEVICE 0
#define INLINE static inline
typedef uint64_t u64;
typedef uint32_t u32;
${helpers}
int main(void) {
  volatile uint32_t seed_value = 123456789u;
  u64 x = seed_value, acc = 0;
  for (uint32_t i = 0; i < ${n}u; i++) {
    x ^= x << 13; x ^= x >> 7; x ^= x << 17;
    acc += u64_pext(x, 0x${mask.toString(16)}ull);
  }
  printf("%llu:%llu\\n", (unsigned long long)(acc >> 32),
    (unsigned long long)(uint32_t)acc);
  return 0;
}
`);
  let gold = null;
  for (const [tag, flags] of [['portable', ['-DBEND_U64_PORTABLE']], ['generic', []], ['native', ['-march=native']]]) {
    const out = b + '-' + tag;
    build(b, out, flags);
    const times = [];
    for (let j = 0; j < 3; j++) {
      const start = performance.now();
      const result = run(out, ['--threads', '1']);
      times.push((performance.now() - start)/1000);
      gold ??= result;
      assert.equal(result, gold, 'benchmark checksum ' + tag);
    }
    times.sort((a,b) => a-b);
    report.push({ benchmark: 'Bend xorshift + rook-mask PEXT + sum', mode: tag, iterations: n,
      process_wall_seconds_median: times[1], checksum: gold, threads: 1 });
    const twinOut = twin + '-' + tag;
    build(twin, twinOut, flags);
    const ct = [];
    for (let j = 0; j < 3; j++) {
      const start = performance.now();
      assert.equal(run(twinOut, []), gold, 'C twin checksum ' + tag);
      ct.push((performance.now() - start)/1000);
    }
    ct.sort((a,b) => a-b);
    report.push({ benchmark: 'C twin: same xorshift + PEXT + sum', mode: tag, iterations: n,
      process_wall_seconds_median: ct[1], checksum: gold, threads: 1 });
  }
}
console.log(JSON.stringify({ compiler: run(cc, ['--version']).split('\n')[0], report }, null, 2));
if (process.env.U64_KEEP_TMP) console.error('U64 temp: ' + dir);
else fs.rmSync(dir, { recursive: true, force: true });
