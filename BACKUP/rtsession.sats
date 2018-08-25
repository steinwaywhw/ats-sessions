







(* runtime types *)
datatype rtti (a:vt@ype) = 
| INT     (int)
| STRING  (string) 
| BOOL    (bool)
| RTSTYPE (rtstype)
| RTTI    (rtti a)  of (rtti a)

(* runtime stypes *)
and rtstype (stype) = 
| {r:role}                 Init  (pinit r)        of (int r)
| {r:role}                 End   (pend r)         of (int r)
| {r1,r2:role} {a:vt@ype}  Msg   (pmsg(r1,r2,a))  of (int r1, int r2, rtti a)
| {r:role} {a:t@ype}       BCast (pbcast(r,a))    of (int r, rtti a)
| {s1,s2:stype}            Seq   (pseq(s1,s2))    of (rtstype s1, rtstype s2)

(* rtsession *)
absvtype rtsession = ptr


fun {} rtsession_make (roleset, rtstype): rtsession
fun {} rtsession_free (rtsession): void 

fun {} rtsession_roles (!rtsession): roleset 
fun {} rtsession_stype (!rtsession): rtstype

fun {} rtsession_accept  (!rtsession): bool
fun {} rtsession_request (!rtsession): bool

fun {a:vt@ype} rtsession_send (!rtsession, rtti a, a): void 
fun {a:vt@ype} rtsession_recv (!rtsession, rtti a): a

fun {} rtsession_close (rtsession): void
fun {} rtsession_wait  (rtsession): void 