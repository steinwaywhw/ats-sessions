%{#
#include "./runtime.h"
%}

staload "./set.sats"
staload "./blackboard.sats"
staload "./msg.sats"

absvtype endpoint = ptr

fun ep_make {full,self:set|full>self} (set full, set self, !board): endpoint = "mac#"
fun ep_free (endpoint): void = "mac#"

fun ep_get_self (!endpoint): [s:set] set s = "mac#"
fun ep_get_full (!endpoint): [s:set] set s = "mac#"

fun ep_link (endpoint, endpoint): endpoint = "mac#"

(* Linear send, transfer ownership to the message. *)
fun {a:vt@ype} ep_send  {s:set} (!endpoint, msglabel, int, a): void 

(* Nonlinear send, receivers copy. *)
fun {a:t@ype}  ep_bsend {s:set} (!endpoint, msglabel, a): void

(* Linear receive, transfer ownership from the message. *)
fun {a:vt@ype} ep_recv  {s:set} (!endpoint, msglabel, int): a

(* Nonlinear receive, copy. *)
fun {a:t@ype}  ep_brecv {s:set} (!endpoint, msglabel, int): a 
