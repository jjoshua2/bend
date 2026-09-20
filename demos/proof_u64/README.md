# U64 laws and checked proofs

Run from the repository root with this fork, not an upstream-only install:

```sh
BEND_NO_TELEMETRY=1 bun bend2/main.ts demos/proof_u64/PROOF.bend
BEND_NO_TELEMETRY=1 bun tests/run/u64_proofs.js
BEND_NO_TELEMETRY=1 U64_CASES=1024 bun tests/run/u64_verify.js --regressions
```

The first command must print exactly `All terms check.`. The second is the
fail-closed proof gate; the third independently validates the native lowering.

## What is proved

`LAWS.bend` contains 16 completed contracts: 13 universally quantified laws
and three closed population-count boundary equalities. `PROOF.bend` supplies
the proofs, with structurally recursive supporting lemmas in `Words.bend`.
There are no proof holes, unsafe functions, foreign proofs, or added axioms.

The central laws are:

- `pdep(pext(x, mask), mask) == and(x, mask)` for every U64 value and mask.
- `popcount(x) <= 64` for every U64 value.
- Splitting/rejoining the two U32 halves preserves all 64 bits in both
  directions; low/high projections and U32 zero-extension have exact laws.
- PEXT and PDEP with an empty mask return zero for every input.
- XOR with the same mask twice, or complement twice, restores the input.
- The population counts of zero, all ones, and bit 63 are 0, 64, and 1.

The round-trip proof is induction over arbitrary-width words, specialized to
64, and then transferred through proved split/join identities to the actual
`U64.pext` and `U64.pdep` functions. It does not enumerate input bitboards.
The count bound is induction over the word; a finite 65-case lemma bridges
the proved natural-number count range to U32's existing comparator. Those
65 count values are not sampling of the 2^64 possible input values.

## Reference definitions and native speed

The public PEXT/PDEP signatures, two-U32 storage, and C intrinsic lowering
are unchanged. Their Bend reference implementations now use structurally
recursive `Word.pext`/`Word.pdep`; population count uses `Word.count` followed
by a bounded U32 conversion. This makes these proofs directly about the
library functions, not about a disconnected model. The former `U64.permute`
helper and `Word.popcount` remain available for compatibility.

`Word.pdep(n, mask, value)` deliberately takes its mask before its value so
an unselected destination bit can ignore the source head. Public
`U64.pdep(value, mask)` retains the conventional argument order.

The C compiler still substitutes the existing POPCNT/BMI2 helpers at scalar
U64 operations. No compiler or kernel changes are needed for the proofs, and
no runtime proof checking is added. The normalizer and JavaScript backend
use the structural definitions. CPU tests remain necessary to check that
both interpretations agree.

## Reusing a theorem

Import both the law declarations and their proofs; imported aliases are not
implicitly re-exported under the proof module's alias:

```bend
import Base
import ./LAWS.bend as Contracts
import ./PROOF.bend as Proven
```

Then use `Contracts.pext_pdep_roundtrip(x, mask)` as an equality certificate.
`main.bend` is a checked application example proving that its composed
extract/deposit function returns the masked occupancy. The ordinary test
suite also imports the full proof module via `tests/proof/u64_laws.bend`.

## CI and failure controls

`.github/workflows/u64-correctness.yml` runs source proofs and native/reference
agreement as separate jobs. The proof gate also verifies rejection of a
missing proof, the false bound of 63, a missing LAWS import, a proof hole,
an unsafe proof, and a corrupted source-level high-half conversion.

Bend can return status 0 with an unsafe/foreign dependency warning. The gate
therefore requires both a successful status and the exact clean success
message; it also restricts the proof module's imports and rejects unsafe
annotations and holes. This is a CI guard, not protection against someone
who can edit the laws or CI itself. Review changes to the specifications.

Adding the workflow does not automatically make its checks mandatory under
GitHub branch protection; repository administrators control that policy.

## Trust boundary and remaining work

These are source-level proofs, checked by Bend's existing kernel. They are
not a proof of the TypeScript compiler, the C compiler, the CPU instructions,
or an entire chess engine. Native code generation is still trusted and
independently tested. The fork remains experimental; its existing strict
TypeScript diagnostic and compiler source-token budget failure are not fixed
or hidden by these additional checks. No existing source-token cap is raised.

Still separate work: general arithmetic/scanning laws, attack-table contents,
legal move generation, perft and make/unmake correctness, and end-to-end
compiler verification. In particular, this module does not claim that PEXT
constructs a correct chess attack table merely because its round trip is
proved. GPU and ARM execution remain outside the completed validation.

## Repository checks

`bun tests/run/u64_repo.js` runs the unchanged file budgets plus failure
controls for the token counter. Long compiler explanations now live in
`guide/COMPILER.md`; no executable compiler code was moved or changed by
that documentation cleanup. The compiler is below its existing 64,000-token cap.

The permanent workflow also runs strict TypeScript checking separately.
The pinned upstream checker (`6018e28ecc67cf1fffc0c20c64b11023474c2df8`)
currently produces TS2339 at `bend2/bend.ts` lines 2084 and 3751. The
human-maintained checker is kept byte-for-byte upstream: these failures
remain visible rather than suppressed. Passing source proofs, native tests
or the repository-size gate does not mean that strict TypeScript passes.

The proof gate additionally rejects upstream #902's cyclic template instance,
which otherwise could inhabit `Empty` and prove a false equality. Native
regressions include all nine new or updated upstream fixtures from this sync.
