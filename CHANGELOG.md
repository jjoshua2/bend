# Changelog

Each release names what changed for a user. `bend update` installs the
latest one; the GitHub release carries the same notes.

## 2.0.21 (2026-09-20)

- A template instance that calls back into an instance whose body is
  still being checked is refused as a self-call that does not decrease:
  `loop(~k, u) = bounce(~loop(~k), u)` with `bounce(~f, u) = f(u)` once
  checked, and inhabited `Empty` (#902).

## 2.0.20 (2026-09-20)

- A `U32` match whose arm is a hand-written bit pattern answers that arm:
  since 2.0.19 the lookup table filled its gaps with the last default, so
  `case U32{WCon{True{}, r}}` (every odd word) between literal cases read
  the `_` case on every lane (#867).
- An erased let binds erased names only: `-y +z = a b` is a parse error at
  the `+`, not a let that erases the `+z` it was told to keep.
- The arena's page cap is published with a release store and read with an
  acquire load, so a core that sees the new cap also sees the banks at
  their new place (#881).

## 2.0.19 (2026-09-19)

- A Bend binary starts in 2 ms, not 12: the runtime reserves 8 GiB and
  grows it in place when a program needs more, instead of mapping the whole
  8 TiB address space at every run (#881).
- A record of records compiles: a datatype past 256 machine words is a heap
  node, the way a recursive type already was, and a constant the compiler
  folds emits once. Seven levels of an eight-field record took 50 s, 19 GB
  and 97 MB of C; it now takes 0.06 s, 122 MB and 82 KB (#843).
- A `match` on dense `U32` literals compiles to a lookup table, as one on
  `Nat` already did: 256 cases took 1.46 MB of C and 3.5 GB, and now take
  80 KB and 1.6 GB (#867).
- The Metal lane computes `sin`, `cos` and `tan` with the GPU's fast trig
  (#887).
- A `-` local is erased again: its name is dead in the body, and its value
  is checked dead, so it may spend a variable twice. Since 2.0.16 the mark
  was lost on both counts.

## 2.0.18 (2026-09-19)

- A dot inside a field name is a character on the JS lane too: `Outer{a:
  Inner, a.b: U32}` read its `Inner`'s field, not its own (#868).
- A value sent through a channel is never read as a parked receiver on the
  JS lane: sending an erased proof reported a deadlock (#871).
- A name the compiler encodes itself is refused, not miscompiled: no file
  may define `Clo.apply`, and a file without `import Base` that declares
  its own `Nat`, `Bool`, `Array` or another of base.bend's types checks and
  runs, but does not compile (#870, #875).
- The verdict names the defs that rely on a foreign def, as it names the
  ones that rely on `@unsafe`: the checker reads a foreign def's type,
  never its code (#874).
- A datatype whose arguments are written in `{}` says to write them in
  `<>` (#864).

## 2.0.17 (2026-09-19)

- **Breaking: an operator takes its type from the `( .. : T)` around its own
  expression, and from nothing else.** The annotation no longer reaches an
  operator inside a call argument, a lambda body, a constructor field, a list
  element, a match arm or a `~` argument, and a bare operator is no longer
  read as `Nat`: write `(a + b : Nat)`. The error names the repair.
- **A `~` template is a definition, and an instance of it is that definition
  at its `~` arguments.** Nothing re-reads the template's text, so the checker
  and the compiled binary cannot mean different things by one call. The body
  is checked once, at its definition, against opaque parameters, so a template
  is a theorem: a `law` may take `~` parameters, a proof may use a hypothesis
  as often as it needs, and an instance no longer counts as unsafe (#848).
- A template that instantiates itself without end stops at the 64th level and
  says so, instead of running the checker out of stack.
- An annotated lambda applied, `{(x => x) : Nat -> Nat}(1)`, is checked at its
  annotation.
- The verdict names the defs that rely on `@unsafe`, following the calls and
  the types, instead of counting the marks. Importing a module that holds an
  `@unsafe` def no longer marks a file that never calls it (#848).
- A nat literal in a pattern is checked against its constructor's arity: it
  was a closed proof of `Empty` (#852).
- A def with no return type that fills no law says which law is missing (#850).
- The C lane seals the fields a hot constructor holds at its own
  instantiation (#853), with five emitter fixes found by a fuzzer (#855).
- `TCP.poll(sock, max, ms)`, a receive with a deadline: a server can drop an
  idle connection (#858).
- `Nat.min` and `Nat.max` are structural, with order laws (#860).
- macOS: the click that brings a window forward reaches the program (#857).
- `bend <file.bend> --check-only` checks a file and its imports, and runs
  nothing (#856).
- `bend version` replaces `bend --version`.

## 2.0.16 (2026-09-19)

- The template memo and the compiler's show table key on the syntax tree
  (`term_key`), not on a printed term: two `~` arguments share an instance
  only when they are the same term (#838).
- A template instance is picked after the enclosing `( .. : T)` closes, so
  its operators carry that namespace (#841).
- A def that is a template instance counts as unsafe: a file with a
  template prints "All terms check, with N unsafe annotations." until the
  checker verifies template expansion itself.
- A template instance is the template's body at its `~` arguments, minted
  and checked by the call, never re-parsed from its text: the checker and
  the compiled program mean the same thing, so a lemma about `M.F(~1n, 2n)`
  is a lemma about what the binary runs. A `~` binder after a plain one, a
  `~` argument past the template's, and a foreign template are refused
  where they are written; a call may omit `~`. `(x = v; x + 1n : Nat)`
  annotates its body's operator again (#848).

## 2.0.15 (2026-09-19)

- `U32` literals as `~` arguments instantiate again (2.0.14 broke them).

## 2.0.14 (2026-09-19)

- Template keys carry no sugar, so NaN payloads that print alike no longer
  share an instance (#838).
- `bend guide shaders` states at the top that AIs wrote it.

## 2.0.13 (2026-09-18)

- `IO.random_u32`, a CSPRNG (#837).
- `File.read_at`, `File.size`, `File.write_bytes` (#823).
- A UTF-8 byte order mark survives on the JS lane (#833).
- A forky continuation that becomes ready during a grow turn runs in place
  (#831).
- A Nix flake: `nix profile install github:bendlang/bend` (#830).
- `bend guide effects` prints a note on the C and JS side of custom
  effects (#825).

## 2.0.12 (2026-09-18)

- Metal: `U32` division and remainder near 2^32 are exact (#824).
- Closure applies allocate no tasks in fork-free code (#832).
- The publisher refuses a file with no name before mining (#835).

## 2.0.11 (2026-09-18)

- Two `Array` shapes with the same leaves no longer share a template
  instance or a show descriptor (#834).

## 2.0.10 (2026-09-18)

- `bend guide shaders` prints "Shaders in Bend"; the guide's Extra section
  points to it.

## 2.0.9 (2026-09-18)

- `--help` is as before 2.0.8.

## 2.0.8 (2026-09-18)

- The installer downloads one executable per platform from a GitHub
  release, verified against a sha256 in the script, and installs nothing
  else. Bend never updates itself: `bend update` reruns the installer.
  Once a day `bend` asks bend-lang.com for the latest version, sending its
  version, OS and CPU type; `BEND_NO_TELEMETRY=1` turns that off.
- `+` on a pattern field is a quantity mark (#810).
- The hub client checks a file against the manifest's hash prefix again
  (2.0.6 refused every package).
- WONTFIX.txt gains a RUNTIME section.

## 2.0.7 (2026-09-18)

- `IO.args` answers the command line (#821).
- A `Nat` literal past `256n` is `U32.to_nat(n)` underneath (#779).
- The C runtime decodes UTF-8 as WHATWG does (#809).
- `String.length` is an intrinsic on JS (#798).
- An unbalanced `Array` traps on JS (#808).
- The verdict reads "All terms check, with N unsafe annotations."
- WONTFIX.txt lists what we will not change, and why.

## 2.0.6 (2026-09-18)

- Hub installs are atomic and pinned (#794, #787).
- The JS lane refuses names it cannot mangle apart (#790, #799) and scopes
  FFI to its file (#800); emit is linear in program size (#785).
- Nullary imported constructors (#815); `Char.to_upper`/`to_lower` on
  control chars (#803); `F32.read` follows one grammar on C and JS (#801).

## 2.0.5 (2026-09-17)

- `CUDA_HOME` names the CUDA install; `lib` and `lib64` both link (#771).
- `$CC` is tried first, then `clang` and `clang-NN` (#773).
- The runtime's reservation halves until it fits, down to 8 GiB (#774).
- comp.ts passes strict TypeScript (#778).

## 2.0.4 (2026-09-17)

- A `!`-free program on macOS builds as plain C (#769).
- The descent error states its left-to-right rule; the guide says it too
  (#770).

## 2.0.3 (2026-09-17)

- A plain parallel call forks on the CPU pool (#767).
- Hub paths are validated before any directory is made (#768).

## 2.0.2 (2026-09-17)

- The Metal bag stays at 128 groups; only CUDA sizes it to the L2.

## 2.0.1 (2026-09-17)

- The guide as revised on launch day.

## 2.0.0 (2026-09-17)

- Bend 2: a new type checker (an affine dependent type theory), a new
  compiler to C, Metal, CUDA and JavaScript, and a new runtime.
