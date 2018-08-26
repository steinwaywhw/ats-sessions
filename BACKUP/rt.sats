//staload "util"

absvtype rtchan
abstype  rtstype
abstype  transport

datatype rttype = 
| INT 
| BOOL 
| STRING 
| STYPE 
| CHAN   of (set int, set int, rtstype)

//datavtype rtdata = 
//| INT    of int 
//| BOOL   of bool
//| STRING of string 
//| STYPE  of rtstype
//| CHAN   of rtchan

datatype rtstype_t = 
|           Init  of (int) 
|           Msg   of (int, int, rttype)
|           BMsg  of (int, rttype)
|           Seq   of (rtstype, rtstype)
|           End   of (int) 
| {a:t@ype} Quan  of (int, a -> rtstype)

datavtype rtchan_t = Chan of (set int, set int, rtstype, transport)

assume rtchan  = rtchan_t
assume rtstype = rtstype_t


fun session_accept  (name: string, addr: string, full: set int, self: set int): rtchan
fun session_request (name: string, addr: string, full: set int, self: set int): rtchan  

fun {a:vt@ype} session_send (!rtchan, a): void
fun {a:vt@ype} session_recv (!rtchan): a
fun            session_skip (!rtchan): void

fun {a:t@ype} session_bsend (!rtchan, a): void 
fun {a:t@ype} session_brecv (!rtchan): a

fun {a:t@ype} session_unify (!rtchan, a): void 
fun {a:t@ype} session_exify (!rtchan): a