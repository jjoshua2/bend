# Import the checked theorem module in an application.
import Base
import ./LAWS.bend as Contracts
import ./PROOF.bend as Proven

def restore_masked(+occupied: U64, +mask: U64) -> U64:
  U64.pdep(U64.pext(occupied, mask), mask)

law restores_only_masked:
  for +occupied: U64
  for +mask: U64
  {restore_masked(occupied, mask) == U64.and(occupied, mask) : U64}

def restores_only_masked(occupied, mask):
  Contracts.pext_pdep_roundtrip(occupied, mask)
