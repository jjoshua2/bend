# Bit scans use a defined sentinel, including zero; oversized shifts saturate.
import Base

def main() -> List<Bool>:
  [
    U32.is_eq(U64.clz(U64.zero()), 64),
    U32.is_eq(U64.clz(U64.one()), 63),
    U32.is_eq(U64.clz(U64.bit(63n)), 0),
    U32.is_eq(U64.clz(U64.bit(32n)), 31),
    U32.is_eq(U64.ctz(U64.bit(32n)), 32),
    U32.is_eq(U64.popcnt(U64.not(U64.zero())), 64),
    U64.is_zero(U64.shln(U64.one(), 65n)),
    U64.is_zero(U64.shrn(U64.not(U64.zero()), 65n)),
    U64.is_eq(U64.set_bit(U64.one(), 64n), U64.one()),
    U64.is_eq(U64.clear_bit(U64.one(), 65n), U64.one())
  ]

#|[True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}, True{}]
