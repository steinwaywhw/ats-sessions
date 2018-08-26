

abstype  sockopt
absvtype socket

fun sock_create  (sockopt): sock 

fun sock_bind     (!sock, address): void
fun sock_connect  (!sock, address): void

fun sock_close    (sock): void
fun sock_link     (!sock, !sock): void

datatype POLL_EVENT = CAN_SEND | CAN_RECEIVE
fun sock_poll     (!sock, POLL_EVENT): bool


fun {a:vt@ype} sock_send    (!sock, a): void 
fun {a:vt@ype} sock_receive (!sock): a