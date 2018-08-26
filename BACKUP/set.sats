datasort Set = (* hook into smt2 *)
sortdef set = Set

stacst set_emp: set                = "ext#smt_set_emp"
//
stacst set_add: (set, int) -> set  = "ext#smt_set_add"
stacst set_del: (set, int) -> set  = "ext#smt_set_del"
//
stacst set_cap: (set, set) -> set  = "ext#smt_set_cap"
stacst set_cup: (set, set) -> set  = "ext#smt_set_cup"
stacst set_dif: (set, set) -> set  = "ext#smt_set_dif"
stacst set_com: (set) -> set       = "ext#smt_set_com"
//
stacst set_mem: (set, int) -> bool = "ext#smt_set_mem"
stacst set_sub: (set, set) -> bool = "ext#smt_set_sub"
stacst set_sup: (set, set) -> bool = "ext#smt_set_sup"
stacst set_eq:  (set, set) -> bool = "ext#smt_set_eq"

stadef emp                 = set_emp
stadef + (e:int, s:set)    = set_add (s, e)
stadef +                   = set_add
stadef -                   = set_del
stadef +                   = set_cup
stadef *                   = set_cap
stadef -                   = set_dif
stadef ~                   = set_com
stadef mem                 = set_mem
stadef sub                 = set_sub
stadef >                   = set_sub
stadef sup                 = set_sup
stadef <                   = set_sup
stadef ==                  = set_eq
stadef disj (a:set, b:set) = a * b == emp


abstype set (set)

fun set_emp (): set emp 

fun set_add {s:set} {n:int} (set s, int n): set (s + n)
fun set_del {s:set} {n:int} (set s, int n): set (s - n)

fun set_cap {s1,s2:set} (set s1, set s2): set (s1 * s2)
fun set_cup {s1,s2:set} (set s1, set s2): set (s1 + s2)
fun set_dif {s1,s2:set} (set s1, set s2): set (s1 - s2)

// TODO: need to have a concrete representation of co-finite set 
// consider set(co:bool, set:s)
fun set_com {s:set}     (set s): set (~s)

fun set_mem {s:set} {n:int} (set s, int n):   bool (mem (s, n))
fun set_sub {s1,s2:set}     (set s1, set s2): bool (sub (s1, s2))
fun set_sup {s1,s2:set}     (set s1, set s2): bool (sup (s1, s2))
fun set_eq  {s1,s2:set}     (set s1, set s2): bool (s1 == s2)

fun set_disj {s1,s2:set}    (set s1, set s2): bool (disj (s1, s2))

overload + with set_add 
overload - with set_del 
overload + with set_cup 
overload * with set_cap 
overload - with set_dif 
overload ~ with set_com 
overload = with set_eq 

overload emp  with set_emp 
overload mem  with set_mem 
overload sub  with set_sub 
overload sup  with set_sup 
overload disj with set_disj

praxi lemma_set_com_disj  {s:set} (): [disj(s,~s)] unit_p
praxi lemma_set_disj_comm {s1,s2:set|disj(s1,s2)} (): [disj(s2,s1)] unit_p
////
praxi lemma_set_sub_emp  {g:set} (): [sub(g,emp)] unit_p
praxi lemma_set_sub_cap  {g,g1,g2:set|sub(g,g1)&&sub(g,g2)} (): [sub(g,g1*g2)] unit_p


praxi lemma_set_sub_self {g:set} (): [sub(g,g)] unit_p
praxi lemma_set_sub_sub  {g1,g2,g3:set|sub(g1,g2)&&sub(g2,g3)} (): [sub(g1,g3)] unit_p
praxi lemma_set_sub_cup  {g,g1,g2:set|sub(g,g1)&&sub(g,g2)} (): [sub(g,g1+g2)] unit_p
praxi lemma_set_sub_cup2 {g1,g2:set} (): [sub(g1+g2,g1)&&sub(g1+g2,g2)] unit_p
praxi lemma_set_sub_cap2 {g1,g2:set} (): [sub(g1,g1*g2)&&sub(g2,g1*g2)] unit_p

praxi lemma_set_size_nat {g:set} (): [size(g) >= 0] unit_p
praxi lemma_set_size_empty (): [size(snil)==0] unit_p
praxi lemma_set_size_add {g:set} {e:int} (): [(mem(g,e)&&size(g+e)==size(g))+(not(mem(g,e))&&size(g+e)==size(g)+1)] unit_p

praxi lemma_set_com_law {u,g:set|sub(u,g)} (): [(g+(u-g)==u)&&(g*(u-g)==snil)] unit_p
praxi lemma_set_com_sub {u,g1,g2:set|sub(u,g1)&&sub(u,g2)&&(sub(g1,g2))} (): [sub(u-g2,u-g1)] unit_p
praxi lemma_set_com_emp {u:set} (): [u-snil==u] unit_p
praxi lemma_set_com_uni {u:set} (): [u-u==snil] unit_p
praxi lemma_set_com_inv {u,g:set|sub(u,g)} (): [u-(u-g)==g] unit_p

praxi lemma_set_com_demorgan {u,g1,g2:set|sub(u,g1)&&sub(u,g2)} (): [(u-(g1+g2)==(u-g1)*(u-g2))&&(u-(g1*g2)==(u-g1)+(u-g2))] unit_p


