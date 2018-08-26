
absvtype mailbox

fun mbox_create (): mailbox
fun mbox_destroy (mailbox): void 

fun {a:vt@ype} mbox_put   (!mailbox, a): void 
fun {a:vt@ype} mbox_get   (!mailbox): maybe a
fun {a:vt@ype} mbox_match (!mailbox, a -<cloref1> bool): maybe a

fun mbox_count {n:nat} (!mailbox n): int n


