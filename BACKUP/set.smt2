; uninterpreted sort
(define-sort Elt () Int)
(define-sort Set () (Array Elt Bool))

(define-const smt_set_emp (Set) ((as const (Set)) false))
(define-fun smt_set_add ((s Set) (x Elt)) (Set) (store s x true))
(define-fun smt_set_del ((s Set) (x Elt)) (Set) (store s x false))
(define-fun smt_set_cap ((s1 Set) (s2 Set)) (Set) ((_ map and) s1 s2))
(define-fun smt_set_cup ((s1 Set) (s2 Set)) (Set) ((_ map or) s1 s2))
(define-fun smt_set_com ((s Set)) (Set) ((_ map not) s))
; s1 - s2
(define-fun smt_set_dif ((s1 Set) (s2 Set)) (Set) (smt_set_cap s1 (smt_set_com s2)))
(define-fun smt_set_mem ((s Set) (x Elt)) Bool (select s x))
; s1 <: s2
(define-fun smt_set_sub ((s1 (Set)) (s2 (Set))) Bool (= smt_set_emp (smt_set_dif s1 s2)))
; s1 :> s2
(define-fun smt_set_sup ((s1 (Set)) (s2 (Set))) Bool (= smt_set_emp (smt_set_dif s2 s1)))
(define-fun smt_set_eq ((s1 (Set)) (s2 (Set))) Bool (and (smt_set_sub s1 s2) (smt_set_sup s1 s2)))


; uninterpreted sort
(declare-sort stype 0)
;(define-fun S2Eextkind ((s s2rt_tkind)) s2rt_int)
