
datatype msglabel = MSG | BRANCH | CLOSE | INIT | SYNC_CLOSE | SYNC_INIT | KEEP | KILL

////
absvtype msg = ptr

fun msg_make {a,b:set} (label: msglabel, sender: set a, receiver: set b, payload: ptr): msg 

fun msg_add_sender (!msg, int): void
fun msg_del_sender (!msg, int): void 
fun msg_add_receiver (!msg, int): void 
fun msg_del_receiver (!msg, int): void 
fun msg_set_label (!msg, msglabel): void
fun msg_get_label (!msg): msglabel
fun msg_set_payload (!msg, ptr): void 
fun msg_get_payload (!msg): ptr

fun msg_free (msg): void