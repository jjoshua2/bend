# Keep arbitrary high bits safe through arrays, shared lists and closures.
# Includes patterns that would be runtime tags if stored as bare Terms.
import Base

def list_sum(xs: List<&2, U64>, acc: U64) -> U64:
  match xs:
    case Nil{}:
      acc
    case Con{x, tail}:
      list_sum(tail, U64.add(acc, x))

def list_twice(+xs: List<&2, U64>) -> U64:
  U64.add(list_sum(xs, U64.zero()), list_sum(xs, U64.zero()))

def apply(f: U64 -> U64, x: U64) -> U64:
  f(x)

def extract(mask: U64) -> U64 -> U64:
  x => U64.pext(x, mask)

def array_value(r: Array<U64> & U64) -> U64:
  (rest, value) = r
  value

def array_read(a: Array<U64>, i: U32) -> U64:
  array_value(Array.get(U64, a, i))

def array_test.pair(x: U64, r: Array<U64> & Array<U64>) -> Bool:
  (a, b) = r
  a = Array.set(U64, a, 2, U64.one())
  v0 = array_read(a, 2)
  v1 = array_read(b, 2)
  Bool.and(U64.is_eq(v0, U64.one()), U64.is_eq(v1, x))

def array_test(+x: U64) -> Bool:
  array_test.pair(x, Array.clone(U64, [x : U64*4n]))

def main() -> List<Bool>:
  [
    array_test(U64.from_parts(2181038080, 123456)),
    array_test(U64.not(U64.zero())),
    U64.is_eq(list_twice([U64.from_parts(2181038080, 1),
      U64.from_parts(50331648, 2)]), U64.from_parts(167772160, 6)),
    U64.is_eq(apply(extract(U64.bit(63n)), U64.bit(63n)), U64.one()),
    U64.is_eq(apply(U64.add(U64.not(U64.zero())), U64.one()), U64.zero())
  ]

#|[True{}, True{}, True{}, True{}, True{}]
