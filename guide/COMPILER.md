# Compiler and runtime design notes

These notes retain the detailed explanations formerly embedded in `bend2/comp.ts`.
The compiler and runtime implementations remain in that single file; concise
comments at each implementation point summarize its invariant. The relocation
changes documentation, not executable source or the existing compiler token cap.

Tuning numbers below are inherited historical observations, not new benchmarks
of the U64 fork. They explain choices that should not be removed casually.

## SPIN_FAR

A native with this many lines or more is a call on both lanes: the
device inlines every native into every caller (hvm5 under a bang: 32 s
of Metal compile, 2.6 s so); at 128 raytrace lost 31% on PAR-CPU.

## term_spine

A term's application view: the annotated head `h`, the head `t`, its
TLD, every argument, the live ones, and the call the term is: the direct
call when the live arguments meet the def's, else, when over-applied or
on a variable, Clo.apply over the outermost live application.

## term_nodes

The nodes of a term, its shared parts once. The fold's fuel is the size
of what an unfold adds, not a count of unfolds: a wide body and a narrow
one do not cost the same, and a loop whose bound is a literal folds every
turn, so counting unfolds alone unrolls the whole loop into its caller.

## ty_clo

A type may hold a closure: a function, a variable or a stuck type, or a
datatype whose live fields may (walked once per datatype); a word type,
a quantity (List<&2, U32>) or a kind holds none.

## lay_of

An Array is a block, an IO.OP holds the foreign requests beyond its
constructors, and a datatype past WIDE words (a record nested K deep is
F^K) is a node: boxes. Memoized on the type's term, which a fill shares.

## sig_def

A def's signature: its live parameters, the layouts a call passes (a
foreign def takes boxes and a continuation, Clo.apply a closure and
its argument) and its return layout (a box for those two).

## show_main

A pure main's value prints through a descriptor of its type, one node
per (type, boxed?) pair in cells: a word (0 U32, 1 F32, 2 Nat), 3 a
Char (boxed?), 4 a String, 5 an Eql, 6 an Array (element node, lgs), 7
a Data (boxed?, arms, then per arm its name, cid, field count and
(word offset, node) per field: offsets in the node for a boxed value,
inline for a flat one). A cell that is a name is the constructor's cid
on the C lane. Null for an IO main; a type the printer cannot walk (a
function, a Type, an erased or dependent field) refuses the build.

## carb_book

The reachable defs, raised, with the bangs and call-site counts, and
each one's source summary (SRCS): what it refers to, what it calls (a
reference used as a value is no call; Clo.apply is never flat), and
whether it is flat: no fork, no bang call, self-calls in tail position.

## Ownership fixed point

The emitter is the analysis. A def's boxed parameters start borrowed and
rooted (brwl); a rooted word at an owned position, a value nobody holds
lent to a parameter, or a parameter no holder asks to lend (lend) owns
it (own); an owned use of a value used later shares it and heats its
type (hot); a shared value of an erased parameter's type marks it
(poly). compile_book emits the book until a pass changes nothing.

## facts_ctr

A hot constructor's fields are hot at this instantiation: a hot type's
once, a hot build's at its site. Its own erased binder is not the def's
parameter: a field typed by it is unknown, never poly.

## bind_uses

A shared box of a flat type (a closure's or a polymorphic def's result)
unboxes before its first share: its words copy, its node does not. The
fresh binding decides this once; a rebinding (seg_open) decides nothing.

## emit_args

A call's arguments, evaluated, then laid out as the def takes them. A
nested one is evaluated first, the Var ones among its later uses, the
owned ones popped before the borrowed ones are read (a twin keeps); a
read is not popped: a holder asks a lend, else val_own, and a dead rooted
one is let go.

## emit_fork

A fork: in parallel a join task and a kid per call, or, for one call (a
cut), its continuation as the lane's task ahead of the jump; in sequence
(the emitter wound back) one frame read in place by every step, each
pushing its result, the last jumping into the joiner (a cut's one step
is its continuation). What the parallel join holds (hold) every step
holds too, so both paths open one joiner.

## emit_lits

A match's rows: Nat counts Succ down its chain, each row a case or the
level's default with its residual; U32 walks the 32 bits of its patterns
and asks for half of 0..max, and one same row from every default a bit
falls off the walk to (a bit pattern's variable is a default too).

## book_owned

The compiler knows base.bend's types by their names alone, and applies
a closure through CLO_APPLY, a def it synthesizes. SYNTH is the name no
file may declare; OWNED adds the types a file without `import Base` may
declare as its own, which check and run, and which the emitters, whose
native shape would not fit, refuse.

## Bank generations

One stack of exact generations per class; 2 heap_words / max(CHUNK,
2^c) entries cover the old ones plus a pass of returns. The host
pops and pushes at rd under bank_lock; a device pass pops down from
rd and pushes above top, and the host then compacts [top, wr) onto
rd, so a pass never sees what it handed.

## Heap generations

Per lane and class (a tile row on the device): HOT, a LIFO chain of
free slots (word 0 the head it replaced); LEN, its exact length in
words, off the chain; on the host COLD, one generation. A free is a
push and an add. A host free at KEEP_WORDS (a slot for a wide class)
runs heap_hand: COLD to the bank, HOT parked as COLD, generations
exact. A miss takes COLD, else a bank entry, else a quantum of at
most a generation, and sets LEN to what it took: no adoption past a
generation, no list re-aged. A device lane keeps its frees for the
pass; at the kernel end dev_cut hands its complete generations,
walking only those. KEEP_WORDS is CAP_WORDS, or CHUNK with the GPU
(fixed at boot), so a device lane may adopt every host entry.
Bounds: a host lane and class under 2 max(KEEP_WORDS, 2^c) words, a
device one under max(CHUNK, 2^c) after each kernel plus its own
frees within one, bank entries exact. The bump grows only when this
lane's HOT and COLD and the class's bank are empty. A zero row is an
empty lane.

## Array block ownership

A block owns one allocation in its physical class (an ARR of class
c 2^c Terms in 2^c words, a BUF 2^c u32 in 2^buf_wcls(c) words) and
blk_free returns it there. A match on ANode is blk_half twice: each
half allocated in its class and copied, the source freed shallow by
the high call (its elements moved; the emitter binds the low half
first). ANode{l, r} is blk_node: the merged class, l and r copied
and freed shallow. Array.clone is blk_copy: a BUF raw, an ARR's
elements retained through blk_keep. A match to the leaves copies
O(n log n) words where a view copied none; get, set, swap, size and
new open no half.

## monk_step

One turn on a ring: its head task below put0 runs (a growing lane skips
a fork-free one). The host grows a row ring by ring and works a ring
until it drains; a device lane does both.

## TG_HOLD tuning

TG_HOLD words of threadgroup memory (lane 0's write keeps them) hold
one group per Apple core: without them bitonic runs 1.35x, kmeans
1.19x, matmul 1.13x. A grow pass runs at most CUBE_T rounds, so a group
that never fills still cuts at a kernel end.

## bend_dev

One kernel, one pipeline: pass 0 grows the frontier (a task a lane a
turn, votes between barriers), pass 1 works it (a lane drains its
ring), pass 2 packs the banks; one call of monk_step, so the program
compiles once.

## window_pix

The Linux kit's fill, the Mac's window_msl in the runtime's dialect:
a ! build carries window_dev in its cubin, a host build walks the
pixels itself. An Image is a quadtree over 2^k x 2^k: a Qua at level
i splits its square in four (tl, tr, bl, br), a Qua under the pixels
follows tl, a Pix is 0xRRGGBB.

## GPU build cache

gpu_make compiles the device program and, given a path, writes it as
<binary>.gpu (--gpu-build, run by bend -o): Metal's binary archive
of the pipeline (keyed by the compiled function, so a wrong file
misses), CUDA's cubin behind a hash of the text. A launch loads it,
else notes and compiles (Metal's OS cache keeps that pipeline; CUDA
writes the file).

## gpu_shape

the bag from the device: a group of 128 lanes per 64 KB of L2, a power of
two from 16 to 128 groups. Apple keeps the 128 the bag was tuned on: on an
M4 (10 cores) 32 groups ran bitonic 1.85 -> 1.29 s, but the light one-pass
benches 1.25x, their lanes four times fewer.

## corpus_map

The cores map 8 GiB at a high base and double it in place, a hint then
a check (MAP_FIXED would replace a neighbour), so one base holds every
Loc and a run pays for the room it reaches. The banks lie past the pages
and move up at each step. The GPU maps its whole span once.

## I/O handles

A handle is its host value, a descriptor or a pointer, packed in one
word (a pointer split over the aux and loc bits). Its type is a law of
base, opaque and linear: a program cannot forge, copy or reuse one, so
nothing stands between the value and the host.

## IoAct

A computation's activation for its whole life: cont over item is its
next request; parked, work.word and time are its fd and deadline, evts
what the fd must be ready for, and work.pack resumes it (io_exec runs
cont, the request); work leads, so an effect's IoWork* is its activation.
IoAct ::=
  | IoAct(work, cont, item, time, evts, next)

## io_wait_on

Parks the effect's activation until fd is ready for evts (POLLIN or
POLLOUT; 0 for no fd), or until time (a tick; 0 for no deadline),
whichever comes first; the loop then calls more on its thread, whose
value readies the activation, or IO_PARK, a re-park.

## io_wait_on

Parks the effect's activation on row with item: a sent value, or
TERM_HOLE for a receiver.

## io_str

io_str decodes UTF-8 as WHATWG does: the lead byte sets the count of
continuation bytes and the range of the second; a byte that breaks the
sequence (or the end) yields one U+FFFD and is read again as a lead.

## Value printers

A pure main's value, spelled as term_show spells it: d is a node of
SHOW_DESC (see show_main), w the value's words. A boxed Data reads its
arm by cid off a Term (packed, or a node), an inline one by tag off
its words.

## Value printers

A pure main's value, spelled as term_show spells it: d is a node of
the descriptor D over the names N (see show_main), v the value, chain
the bracket of the [a, b] or (a, b) it continues, or 0.

## Channel handles

A channel is Data: its handle is copied and may outlive the row, so it
names the row by index and generation, a freed row waits on a list and
comes back one generation up, and a stale copy finds no row (closed).

## Darwin arm64 fcntl

fcntl is variadic. Apple arm64 passes variadic arguments on the
stack, where the fixed convention puts arguments past the eighth, so
there the flags ride as a ninth argument; elsewhere in a register.
