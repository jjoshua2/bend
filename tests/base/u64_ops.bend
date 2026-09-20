# Full-width U64 semantics over two U32 words. This pins carry/borrow,
# cross-half shifts and the bitboard helpers that motivated the type.
import Base

def bu(b: Bool) -> U32:
  match b:
    case False{}:
      0
    case True{}:
      1

def main.out() -> U32:
  b0 = bu(U32.is_eq(U64.high(U64.from_parts(305419896, 2596069104)), 305419896))
  b1 = bu(U32.is_eq(U64.low(U64.from_parts(305419896, 2596069104)), 2596069104))
  b2 = bu(U64.is_eq(
    U64.add(U64.from_parts(0, 4294967295), U64.one()),
    U64.from_parts(1, 0)))
  b3 = bu(U64.is_zero(U64.add(
    U64.from_parts(4294967295, 4294967295), U64.one())))
  b4 = bu(U64.is_eq(
    U64.sub(U64.from_parts(1, 0), U64.one()),
    U64.from_parts(0, 4294967295)))
  b5 = bu(U64.is_eq(
    U64.sub(U64.zero(), U64.one()),
    U64.from_parts(4294967295, 4294967295)))
  b6 = bu(U64.is_eq(
    U64.not(U64.zero()),
    U64.from_parts(4294967295, 4294967295)))
  b7 = bu(U64.is_eq(
    U64.and(U64.from_parts(252645135, 4042322160),
      U64.from_parts(16711935, 4278255360)),
    U64.from_parts(983055, 4026593280)))
  b8 = bu(U64.is_eq(U64.shln(U64.one(), 32n), U64.from_parts(1, 0)))
  b9 = bu(U64.is_eq(U64.bit(63n), U64.from_parts(2147483648, 0)))
  ba = bu(U64.is_zero(U64.bit(64n)))
  bb = bu(U64.is_eq(U64.shrn(U64.bit(63n), 63n), U64.one()))
  bc = bu(U64.is_gt(U64.from_parts(1, 0), U64.from_parts(0, 4294967295)))
  bd = bu(U32.is_eq(
    U64.popcount(U64.from_parts(4294967295, 4294967295)), 64))
  be = bu(U32.is_eq(U64.ctz(U64.zero()), 64))
  bf = bu(U32.is_eq(U64.ctz(U64.bit(63n)), 63))
  bg = bu(U64.is_eq(U64.lsb(U64.from_u32(40)), U64.from_u32(8)))
  bh = bu(U64.test_bit(U64.from_parts(2147483648, 1), 63n))
  U32.add(U32.add(U32.add(U32.add(b0, b1), U32.add(b2, b3)),
    U32.add(U32.add(b4, b5), U32.add(b6, b7))),
    U32.add(U32.add(U32.add(b8, b9), U32.add(ba, bb)),
      U32.add(U32.add(U32.add(bc, bd), U32.add(be, bf)),
        U32.add(bg, bh))))

def main() -> U32:
  main.out()

#|18
