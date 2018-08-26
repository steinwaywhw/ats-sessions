datasort Set = (* hook into smt2 *)
sortdef  set = Set

stacst set_emp: set                = "ext#smt_set_emp"
stacst set_add: (set, int) -> set  = "ext#smt_set_add"
stacst set_del: (set, int) -> set  = "ext#smt_set_del"
stacst set_cap: (set, set) -> set  = "ext#smt_set_cap"
stacst set_cup: (set, set) -> set  = "ext#smt_set_cup"
stacst set_dif: (set, set) -> set  = "ext#smt_set_dif"
stacst set_com: (set)      -> set  = "ext#smt_set_com"
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
stadef <                   = set_sub
stadef sup                 = set_sup
stadef >                   = set_sup
stadef ==                  = set_eq
stadef disj (a:set, b:set) = a * b == emp

(* An naive natural number bit set. *)
%{#
#ifndef LIBSS_SET
#define LIBSS_SET 

#include <unistd.h>
#include <stdlib.h>
#include <stdint.h>

#define libss_set_emp()      (0)
#define libss_set_add(s, n)  ((s) | (1 << (n)))
#define libss_set_del(s, n)  ((s) & ~(1 << n))
#define libss_set_cap(a, b)  ((a) & (b))
#define libss_set_cup(a, b)  ((a) | (b))
#define libss_set_dif(a, b)  ((a) & ~(b))
#define libss_set_mem(s, n)  (((a) & (1 << (n))) > 0)
#define libss_set_sub(a, b)  ((a) | (b) == (b))
#define libss_set_sup(a, b)  ((a) | (b) == (a))
#define libss_set_eq(a, b)   ((a) == (b))
#define libss_set_disj(a, b) ((a) & (b) == 0)
#define libss_set_show(s)    for(unsigned int mask=0x8000;mask;mask>>=1){printf("%d",!!(mask & s));}

#endif 
%}

abst@ype set (set) = $extype "int32_t"

#define ATS_EXTERN_PREFIX "libss_"

fun set_emp (): set emp = "mac#%"
fun set_add {s:set} {n:int} (set s, int n): set (s + n) = "mac#%"
fun set_del {s:set} {n:int} (set s, int n): set (s - n) = "mac#%"
fun set_cap {s1,s2:set}     (set s1, set s2): set (s1 * s2) = "mac#%"
fun set_cup {s1,s2:set}     (set s1, set s2): set (s1 + s2) = "mac#%"
fun set_dif {s1,s2:set}     (set s1, set s2): set (s1 - s2) = "mac#%"
fun set_mem {s:set} {n:int} (set s, int n):   bool (mem (s, n)) = "mac#%"
fun set_sub {s1,s2:set}     (set s1, set s2): bool (s1 < s2) = "mac#%"
fun set_sup {s1,s2:set}     (set s1, set s2): bool (s1 > s2) = "mac#%"
fun set_eq  {s1,s2:set}     (set s1, set s2): bool (s1 == s2) = "mac#%"
fun set_disj {s1,s2:set}    (set s1, set s2): bool (disj (s1, s2)) = "mac#%"
fun set_show {s:set}        (set s): void = "mac#%"

overload + with set_add 
overload - with set_del 
overload + with set_cup 
overload * with set_cap 
overload - with set_dif 
overload = with set_eq 
overload emp  with set_emp 
overload mem  with set_mem 
overload sub  with set_sub 
overload <    with set_sub 
overload sup  with set_sup 
overload >    with set_sup
overload disj with set_disj


