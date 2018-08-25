; uninterpreted sort
(define-sort Elt () Int)
(define-sort Set () (Array Elt Bool))

(define-const smt_set_emp (Set)                    ((as const Set) false))
(define-fun   smt_set_add ((s Set)  (x Elt))  Set  (store s x true))
(define-fun   smt_set_del ((s Set)  (x Elt))  Set  (store s x false))
(define-fun   smt_set_cap ((s1 Set) (s2 Set)) Set  ((_ map and) s1 s2))
(define-fun   smt_set_cup ((s1 Set) (s2 Set)) Set  ((_ map or)  s1 s2))
(define-fun   smt_set_com ((s Set)) Set            ((_ map not) s))
(define-fun   smt_set_mem ((s Set)  (x Elt))  Bool (select s x))

; s1 - s2
(define-fun smt_set_dif ((s1 Set) (s2 Set)) Set  (smt_set_cap s1 (smt_set_com s2)))
; s1 <: s2
(define-fun smt_set_sub ((s1 Set) (s2 Set)) Bool (= smt_set_emp (smt_set_dif s1 s2)))
; s1 :> s2
(define-fun smt_set_sup ((s1 Set) (s2 Set)) Bool (= smt_set_emp (smt_set_dif s2 s1)))
; s1 = s2
(define-fun smt_set_eq  ((s1 Set) (s2 Set)) Bool (and (smt_set_sub s1 s2) (smt_set_sup s1 s2)))


; uninterpreted sort
(declare-sort stype 0)
;(define-fun S2Eextkind ((s s2rt_tkind)) s2rt_int)

; uninterpreted fun
(declare-fun pinit   (s2rt_int) stype)
(declare-fun pend    (s2rt_int) stype)
(declare-fun pmsg    (s2rt_int s2rt_int s2rt_vt0ype) stype)
(declare-fun pbmsg   (s2rt_int s2rt_t0ype) stype)
(declare-fun pseq    (stype stype) stype)
(declare-fun ppara   (s2rt_int stype stype) stype)
(declare-fun pbranch (s2rt_int stype stype) stype)
(declare-fun pfix    ((Array stype stype)) stype)
(declare-fun pquan   (s2rt_int (Array s2rt_int stype)) stype)
(declare-fun pquan2  (s2rt_int (Array stype stype)) stype)
(declare-fun pserve  (s2rt_int stype) stype)
