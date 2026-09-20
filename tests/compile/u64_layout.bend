# U64 bits survive the >256-word record boundary and a shared family
# result split across fork frames. The dynamic oracle supplies runtime
# values too, so these checks cannot all disappear by constant folding.
import Base

type Eight<-a: Data> is Data:
  Eight{f0: a, f1: a, f2: a, f3: a, f4: a, f5: a, f6: a, f7: a}

def row(+x: U64) -> Eight<U64>:
  Eight{x, x, x, x, x, x, x, x}

def rows(+x: U64) -> Eight<Eight<U64>>:
  Eight{row(x), row(x), row(x), row(x), row(x), row(x), row(x), row(x)}

def cube(+x: U64) -> Eight<Eight<Eight<U64>>>:
  Eight{rows(x), rows(x), rows(x), rows(x), rows(x), rows(x), rows(x), rows(x)}

def pick(-a: Data, x: Eight<a>) -> a:
  match x:
    case Eight{f0, f1, f2, f3, f4, f5, f6, f7}:
      f6

def boxed(x: U64) -> U64:
  pick(U64, pick(Eight<U64>, pick(Eight<Eight<U64>>, cube(x))))

def Family(b: Bool) -> Data:
  match b:
    case False{}:
      Bool
    case True{}:
      U64

def wrap(b: Bool, x: U64) -> Family(b):
  match b:
    case False{}:
      U64.is_zero(x)
    case True{}:
      x

def use(x: U64) -> U64:
  U64.not(x)

def shared(x: U64) -> U64:
  +h = {wrap(True{}, x) : U64}
  a b = use(h) use(h)
  U64.xor(U64.xor(a, b), h)

def apply(f: U64 -> U64, x: U64) -> U64:
  f(x)

def main() -> List<Bool>:
  [U64.is_eq(boxed(U64.from_parts(4294967295, 2147483648)),
      U64.from_parts(4294967295, 2147483648)),
   U64.is_eq(shared(U64.from_parts(2181038080, 50331648)),
      U64.from_parts(2181038080, 50331648)),
   U64.is_eq(apply(U64.mul(U64.not(U64.zero())), U64.from_parts(0, 2)),
      U64.from_parts(4294967295, 4294967294))]

#|[True{}, True{}, True{}]
