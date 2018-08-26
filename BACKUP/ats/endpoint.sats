staload "./uuid.sats"
staload "libats/ML/SATS/basis.sats"

absvtype endpoint (transport) = ptr

fun ep_make (): endpoint

//fun ep_get_id (!endpoint): uuid
//fun ep_set_id (!endpoint, uuid): void

fun ep_set_roles (!endpoint, set int): void
fun ep_get_roles (!endpoint): set int

fun {t:transport} ep_set_transport (transport t): void

fun ep_accept  (!endpoint, set int): bool
fun ep_request (!endpoint): bool

fun ep_close (endpoint): void
fun ep_wait  (endpoint): void

fun ep_broadcast (!endpoint, msg): void
fun ep_receive   (!endpoint): msg

fun _ep_encode (!endpoint, msg_ss): msg_ep
fun _ep_decode (!endpoint, msg_ep): msg_ss

fun ep_cut (endpoint, endpoint): endpoint