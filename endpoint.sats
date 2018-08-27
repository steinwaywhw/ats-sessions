%{#
#include "./runtime.h"
%}

staload "./set.sats"
staload "./blackboard.sats"
staload "./msg.sats"

absvtype endpoint = ptr

fun ep_make {full,self:set|full>self} (set full, set self, !board): endpoint = "mac#"
fun ep_free (endpoint): void = "mac#"
fun ep_split {s:set} (!endpoint, set s): endpoint = "mac#"

fun ep_get_self (!endpoint): [s:set] set s = "mac#"
fun ep_get_full (!endpoint): [s:set] set s = "mac#"

fun ep_link (endpoint, endpoint): endpoint = "mac#"


fun {a:t@ype}  ep_bsend (!endpoint, msglabel, int, a): void
fun {a:t@ype}  ep_brecv (!endpoint, msglabel, int): a 
fun {a:vt@ype} ep_send  (!endpoint, msglabel, int, int, a): void 
fun {a:vt@ype} ep_recv  (!endpoint, msglabel, int, int): a
fun {a:t@ype}  ep_sync_send (!endpoint, msglabel, int, a): void
fun            ep_sync_recv (!endpoint, msglabel, int): void