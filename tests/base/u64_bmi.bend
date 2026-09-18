# Exact edge cases; public definitions also normalize without C intrinsics.
import Base

def main() -> List<Bool>:
  [
    U64.is_eq(U64.pext(U64.from_parts(0, 53), U64.from_parts(0, 42)), U64.from_parts(0, 4)),
    U64.is_eq(U64.pdep(U64.from_parts(0, 5), U64.from_parts(0, 42)), U64.from_parts(0, 34)),
    U64.is_eq(U64.pext(U64.from_parts(4294967295, 4294967295), U64.from_parts(0, 0)), U64.from_parts(0, 0)),
    U64.is_eq(U64.pdep(U64.from_parts(4294967295, 4294967295), U64.from_parts(0, 0)), U64.from_parts(0, 0)),
    U64.is_eq(U64.pext(U64.from_parts(4294967295, 4294967295), U64.from_parts(4294967295, 4294967295)), U64.from_parts(4294967295, 4294967295)),
    U64.is_eq(U64.pdep(U64.from_parts(4294967295, 4294967295), U64.from_parts(4294967295, 4294967295)), U64.from_parts(4294967295, 4294967295)),
    U64.is_eq(U64.pext(U64.from_parts(2147483648, 0), U64.from_parts(2147483648, 0)), U64.from_parts(0, 1)),
    U64.is_eq(U64.pdep(U64.from_parts(0, 1), U64.from_parts(2147483648, 0)), U64.from_parts(2147483648, 0)),
    U64.is_eq(U64.mul(U64.from_parts(4294967295, 4294967295), U64.from_parts(4294967295, 4294967295)), U64.from_parts(0, 1)),
    U64.is_eq(U64.mul(U64.from_parts(305419896, 2596069104), U64.from_parts(4275878552, 1985229328)), U64.from_parts(594381054, 1444466432)),
    U64.is_eq(U64.mul(U64.from_parts(0, 4294967295), U64.from_parts(0, 4294967295)), U64.from_parts(4294967294, 1)),
    U64.is_eq(U64.mul(U64.from_parts(1, 0), U64.from_parts(1, 0)), U64.from_parts(0, 0)),
    U64.is_eq(U64.and_not(U64.from_parts(0, 60), U64.from_parts(0, 42)), U64.from_parts(0, 20)),
    U64.is_eq(U64.clear_lsb(U64.from_parts(0, 40)), U64.from_parts(0, 32)),
    U64.is_eq(U64.clear_lsb(U64.from_parts(0, 0)), U64.from_parts(0, 0)),
    U64.is_eq(U64.set_bit(U64.from_parts(0, 1), 63n), U64.from_parts(2147483648, 1)),
    U64.is_eq(U64.clear_bit(U64.from_parts(4294967295, 4294967295), 63n), U64.from_parts(2147483647, 4294967295)),
    U64.is_eq(U64.toggle_bit(U64.from_parts(4294967295, 4294967295), 64n), U64.from_parts(4294967295, 4294967295))
  ]

#|[True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}]
