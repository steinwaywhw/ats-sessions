



(* endpoint version *)
datasort epver = redis | nanomsg

(* endpoint *)
absvtype endpoint (epver) = ptr


fun {v:epver} endpt_make (id:string, roles:roleset): endpoint (epver)
fun {v:epver} endpt_free (endpoint v): void 

fun {v:epver} endpt_id    (!endpoint v): string
fun {v:epver} endpt_roles (!endpoint v): roleset

fun {v:epver} endpt_accept  (!endpoint v, addr:string): bool
fun {v:epver} endpt_request (!endpoint v, addr:string): bool

fun {v:epver} {a:vt@ype} endpt_send (!endpoint v, a): void
fun {v:epver} {a:vt@ype} endpt_recv (!endpoint v): a

fun {v:epver} {a:vt@ype} endpt_cut (endpoint v, endpoint v): endpoint v

fun {v:epver} endpt_dbg_seqnum (!endpoint v): int


