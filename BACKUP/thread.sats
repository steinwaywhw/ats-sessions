
absvtype thread
abstype  thread_id
typedef  thread_fn = (thread_id) -<lincloptr1> void

fun {} thread_create (thread_fn): thread_id
fun {} thread_self   (): thread_id
fun {} thread_exit   (): void
