# a compile-time argument naming a def declared later: the name is a
# forward reference, undefined at the call, as for any forward call
import Base

def app(~f: Nat -> Nat, x: Nat) -> Nat:
  f(x)

def main() -> Nat:
  app(~later, 3n)

def later(n: Nat) -> Nat:
  Nat.mul(n, 10n)

#|Error:
#|- expected : a defined name
#|- observed : later
#|Location: main
#| 8 | def main() -> Nat:
#| 9>|   app(~later, 3n)
#|10 |
#|exit 1
