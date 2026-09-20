# Reusing a u32 C local must not defeat the widening before high-half extraction.
import Base

def fill(n: Nat, +i: U32, +value: U32, a: Array<U64>) -> Array<U64>:
  match n:
    case 0n: a
    case 1n+p:
      fill(p, U32.inc(i), U32.inc(value), Array.set(U64, a, i, U64.from_u32(value)))

def inspect(expected: U32, r: Array<U64> & U64) -> Array<U64> & U32:
  (a, +v) = r
  (a, Bool.to_u32(Bool.and(U32.is_zero(U64.high(v)), U32.is_eq(U64.low(v), expected))))

def add(n: U32, r: Array<U64> & U32) -> Array<U64> & U32:
  (a, ok) = r
  (a, U32.add(n, ok))

def step(+i: U32, expected: U32, r: Array<U64> & U32) -> Array<U64> & U32:
  (a, n) = r
  add(n, inspect(expected, Array.get(U64, a, i)))

def check(n: Nat, +i: U32, +expected: U32, r: Array<U64> & U32) -> U32:
  match n:
    case 0n:
      (a, good) = r
      good
    case 1n+p: check(p, U32.inc(i), U32.inc(expected), step(i, expected, r))

def batch(+initial: U32) -> U32:
  check(4n, 0, initial, (fill(4n, 0, initial, Array.new(U64, 2n, U64.zero())), 0))

def main() -> U32:
  U32.add(batch(2147483646), batch(4294967294))

#|8
