# a redex whose body is an annotated lambda-match applied on: the beta
# steps keep the annotation, which is what lets the match infer (a
# lambda-match applied in an expression is the checker's alone: the
# compiler refuses it, so no Base and no build here)
type Nat is Data:
  Zero{}
  Succ{pred: Nat}

def main() -> Nat:
  (x => {\{Zero: 1n; Succ: p => 2n} : Nat -> Nat})(0n)(3n)

#|2n
