// Standalone, opt-in local/CI validation. No cluster, npm dependencies or GPU.
// Usage: bun tests/run/u64_verify.js [--regressions] [--bench]
// BENCH_N changes the opt-in benchmark length; CC selects Clang.
// U64_CASES selects 1..4096 runtime-fed random pairs (default 256).
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
const cases = Number(process.env.U64_CASES || 256);
assert.ok(Number.isSafeInteger(cases) && cases >= 1 && cases <= 4096);
const modes = [['generic', []], ['portable', ['-DBEND_U64_PORTABLE']],
  ['native', ['-march=native']],
  ['ubsan', ['-fsanitize=undefined', '-fno-sanitize-recover=all']]];
// Match the upstream test gate: ignore trailing horizontal whitespace only.
function tidy(text) { return text.replace(/[ \t]+$/gm, '').trim(); }
function run(cmd, args, timeout = 120000) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout, maxBuffer: 32 << 20 });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return tidy(r.stdout);
}
function compile(src, stem) {
  run(bun, [...cli, src, '-o', stem + '.c', '-o', stem + '.js']);
}
function build(stem, name, flags = []) {
  run(cc, ['-O3', '-std=c11', '-Werror=shift-count-overflow', ...flags, stem + '.c', '-pthread', '-lm', '-o', name]);
}
const fixtures = ['tests/base/u64_ops.bend', 'tests/base/u64_bmi.bend',
  'tests/base/u64_scans.bend', 'tests/compile/u64_storage.bend',
  'tests/compile/u64_layout.bend', 'tests/base/u64_from_u32_variable.bend'];
for (const [i, src] of fixtures.entries()) {
  const want = tidy(fs.readFileSync(src, 'utf8').split('\n').filter(s => s.startsWith('#|'))
    .map(s => s.slice(2)).join('\n'));
  assert.equal(run(bun, [...cli, src]), want, src + ' normalizer');
  const stem = path.join(dir, 't' + i);
  compile(src, stem);
  assert.equal(run(bun, [stem + '.js']), want, src + ' JS');
  for (const [tag, flags] of modes) {
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
  // Recent upstream regressions at the same representation/template boundaries.
  files.push('tests/compile/record_deep_boxed.bend',
    'tests/compile/fold_fuel_loop.bend', 'tests/run/fork_shared_flat.bend',
    'tests/run/family_field_hot.bend', 'tests/run/fork_held_family.bend',
    'tests/import/shadow_base.bend', 'tests/proof/template_law.bend',
    'tests/check/template_inst_cycle.bend', 'tests/check/typed_let_mismatch.bend',
    'tests/parse/typed_let_sugar.bend', 'tests/run/unsafe_mutual.bend',
    'tests/cost/array_fill_readback.bend', 'tests/run/array_bounds_000.bend',
    'tests/run/array_bounds_001.bend', 'tests/run/array_slab.bend',
    'tests/run/array_struct_swap.bend');
  for (const [i, src] of files.entries()) {
    const text = fs.readFileSync(src, 'utf8');
    const want = tidy(text.split('\n').filter(s => s.startsWith('#|')).map(s => s.slice(2)).join('\n'));
    if (want.startsWith('Error:')) {
      const r = spawnSync(bun, [...cli, src], { encoding: 'utf8', timeout: 30000 });
      assert.equal(r.status, 1, src + ' expected rejection');
      assert.equal(tidy(r.stdout + r.stderr) + '\nexit 1', want);
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
fs.copyFileSync('tests/compile/u64_layout.bend', path.join(dir, 'u64_layout.bend'));
const common = `import Base
import ./u64_layout.bend as Layout

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
  'U64.from_u32(U64.clz(x))',
  ...['add', 'sub', 'and', 'or', 'xor'].map(op => `U64.${op}(x, m)`),
  ...['inc', 'not', 'shl', 'shr'].map(op => `U64.${op}(x)`),
  ...['is_eq', 'is_ne', 'is_lt', 'is_le', 'is_gt', 'is_ge']
    .map(op => `U64.from_u32(Bool.to_u32(U64.${op}(x, m)))`),
  ...['is_zero', 'is_odd'].map(op => `U64.from_u32(Bool.to_u32(U64.${op}(x)))`),
  'U64.from_u32(Bool.to_u32(U64.test_bit(x, n)))', 'U64.bit(n)',
  'cmp_code(U64.cmp(x, m))', 'U64.from_u32(U64.popcount(x))',
  'U64.from_u32(U64.low(x))', 'U64.from_u32(U64.high(x))',
  'U64.from_parts(U64.high(x), U64.low(x))',
  'Layout.boxed(x)', 'Layout.shared(x)', 'Layout.apply(U64.mul(x), m)'];
const edges = [
  [0n, 0n, 0n], [0n, mask64, 1n], [mask64, 0n, 64n],
  [mask64, 1n, 32n], [1n, mask64, 33n], [mask64, mask64, 63n],
  [0xffffffffn, 1n, 31n], [0x100000000n, 1n, 32n],
  [1n, 0x100000000n, 33n], [0x8000000000000000n, 1n, 63n],
  [0x7fffffffffffffffn, 0x8000000000000000n, 64n],
  [0x8300000003000000n, 0x55555555aaaaaaaan, 65n],
  [0x8000000000000000n, 0x8000000000000000n, 4294967295n],
  [mask64, mask64, 281474976710655n],
];
const nat = n => n <= 0xffffffffn ? `${n}n`
  : `Nat.add(Nat.mul(${n >> 32n}n, Nat.add(4294967295n, 1n)), ${n & 0xffffffffn}n)`;
const edgeCalls = edges.map(([a, m, n]) =>
  `print_observe(U64.xor(${u(a)}, salt), ${u(m)}, ${nat(n)})`);
const edgePrints = edgeCalls.map((call, i) =>
  '    ' + (i + 1 === edgeCalls.length ? '' : 'Unit <- ') + call).join('\n');
const src = path.join(dir, 'dynamic.bend');
fs.writeFileSync(src, common + `
def cmp_code(c: Cmp) -> U64:
  match c:
    case LT{}:
      U64.zero()
    case EQ{}:
      U64.one()
    case GT{}:
      U64.from_u32(2)

def observe(+x: U64, +m: U64, +n: Nat) -> List<U64>:
  [${exprs.join(',\n    ')}]

# One small row per print: a giant List.show would test the JS stack
# limit rather than the integer operations as the sample count increases.
def print_observe(x: U64, m: U64, n: Nat) -> IO(Unit):
  IO.print(List.show(~&1, ~U64, ~show, observe(x, m, n)))

def samples(n: Nat, x: U64) -> IO(Unit):
  match n:
    case 0n:
      IO.pure(Unit, Unit{})
    case 1n+p:
      +a = next(x)
      +m = next(a)
      do IO<Unit>:
        Unit <- print_observe(a, m, U32.to_nat(U32.and(U64.low(m), 127)))
        samples(p, m)

# Exhaust every source/destination single bit without putting an expensive
# normalizer walk into the default golden tests.
def basis(+n: Nat) -> IO(Unit):
  match n:
    case 0n:
      IO.pure(Unit, Unit{})
    case 1n+p:
      +x = U64.bit(p)
      do IO<Unit>:
        Unit <- print_observe(x, x, p)
        basis(p)

def main() -> IO(Unit):
  do IO<Unit>:
    +s : U32 <- seed()
    +salt : U64 = U64.from_u32(U32.xor(s, 123456789))
    Unit <- samples(${cases}n, U64.from_parts(2882400018, s))
    Unit <- basis(64n)
${edgePrints}
`);
let x = (2882400018n << 32n) | 123456789n;
const expected = [];
function oracle(a, m, n) {
  const bit = n >= 64n ? 0n : 1n << n;
  expected.push(pext(a,m), pdep(a,m), (a*m)&mask64, a & (~m & mask64),
    a & -a, a & (a-1n), n >= 64n ? 0n : (a<<n)&mask64,
    n >= 64n ? 0n : a>>n, a|bit, a & (~bit & mask64), a^bit, ...scans(a),
    (a+m)&mask64, (a-m)&mask64, a&m, a|m, a^m,
    (a+1n)&mask64, (~a)&mask64, (a<<1n)&mask64, a>>1n,
    ...[a===m, a!==m, a<m, a<=m, a>m, a>=m, a===0n, (a&1n)!==0n,
      (a&bit)!==0n].map(v => BigInt(v)), bit,
    a<m ? 0n : a===m ? 1n : 2n, scans(a)[0],
    a&0xffffffffn, a>>32n, a, a, a, (a*m)&mask64);
}
for (let i = 0; i < cases; i++) {
  x = next(x); const a = x; x = next(x);
  oracle(a, x, x & 127n);
}
for (let i = 63n; i >= 0n; i--) oracle(1n << i, 1n << i, i);
for (const [a, m, n] of edges) oracle(a, m, n);
assert.equal(expected.length, (cases + 64 + edges.length) * exprs.length);
const rows = [];
for (let i = 0; i < expected.length; i += exprs.length) {
  rows.push('[' + expected.slice(i, i + exprs.length).map(show).join(', ') + ']');
}
const stem = path.join(dir, 'dynamic');
compile(src, stem);
// Recognizing intrinsics only at emission is too late: ANF used to leave
// recursive U64 shifts in the hot path. Pin analysis/codegen, not only counts.
assert.ok(!/^#define FID_U64_(?:(?:SHLN|SHRN|PEXT|PDEP)_GO|PERMUTE)/m.test(
  fs.readFileSync(stem + '.c', 'utf8')), 'U64 intrinsic leaked a source loop');
function checkRows(got, lane) {
  const actual = got.split('\n');
  assert.equal(actual.length, rows.length, lane + ' row count');
  rows.forEach((row, i) => assert.equal(actual[i], row, lane + ' sample ' + i));
}
checkRows(run(bun, [stem + '.js']), 'dynamic JS vs independent BigInt');
for (const [tag, flags] of modes) {
  const out = stem + '-' + tag;
  build(stem, out, flags);
  for (const threads of ['1', '4']) {
    checkRows(run(out, ['--threads', threads]),
      'dynamic ' + tag + ' threads=' + threads + ' vs independent BigInt');
  }
  if (process.arch === 'x64' && tag !== 'ubsan') {
    const asm = run('objdump', ['-d', out]);
    const hasPext = /\tpext\s/.test(asm), hasPdep = /\tpdep\s/.test(asm);
    if (tag === 'generic') { assert.ok(hasPext); assert.ok(hasPdep); assert.ok(/\tpopcnt\s/.test(asm)); }
    if (tag === 'portable') { assert.ok(!hasPext); assert.ok(!hasPdep); }
    report.push({ dynamic: tag, values: expected.length, pext_instruction: hasPext, pdep_instruction: hasPdep });
  }
}
report.push({ dynamic: 'JS + four C variants at 1 and 4 threads',
  random_pairs: cases, single_bits: 64, edge_pairs: edges.length,
  expressions_per_pair: exprs.length, independent_oracle_values: expected.length });

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
  const compilerSource = fs.readFileSync(b + '.c', 'utf8');
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
