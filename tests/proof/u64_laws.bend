# Standard test-suite entry: importing PROOF checks every U64 law.
import Base
import ../../demos/proof_u64/LAWS.bend as Laws
import ../../demos/proof_u64/PROOF.bend as Proof

def main() -> {U64.pdep(U64.pext(U64.bit(63n), U64.bit(63n)), U64.bit(63n)) == U64.and(U64.bit(63n), U64.bit(63n)) : U64}:
  Laws.pext_pdep_roundtrip(U64.bit(63n), U64.bit(63n))

#|{==}
