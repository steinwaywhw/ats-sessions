staload "./thread.sats"

datasort transport = nn | redis

absvtype transport (t:transport) = ptr

fun {t:transport} trans_make (): transport t
fun {t:transport} trans_term (transport t): void 

fun {t:transport} trans_listen     (!transport t, string): void
fun {t:transport} trans_connect    (!transport t, string): void
//fun {t:transport} trans_disconnect (!transport sublt, string): void

fun {a:vt@ype} {t:transport} trans_send       (!transport t, a): void 
fun {a:vt@ype} {t:transport} trans_recv_sync  (!transport t): a
fun {a:vt@ype} {t:transport} trans_recv_async (!transport t, a -<lincloptr1> void): void

overload trans_recv with trans_recv_sync 
overload trans_recv with trans_recv_async

fun trans_nn_broker (string): (tid, transport nn)