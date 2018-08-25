staload "../util/set.sats"

sortdef role  = int
sortdef roles = set

(* session types *)
datasort stype = 
| pinit  of (role)	
| pend   of (role)
| pmsg   of (role, role, vt@ype)
| pbcast of (role, t@ype)
| pseq   of (stype, stype)
| pmult  of (role, stype, stype)
| paddi  of (role, stype, stype)
| pneg   of (role, stype)
| pquan  of (role, int -> stype)
| pquan2 of (role, stype -> stype)

stadef :: = pseq


absvtype session (roles, stype) = ptr

(* session api *)
fun {} session_send_cont
    {self:roles} {from,to:role|mem(self,from)*not(mem(self,to))} {a:vt@ype} {s:stype}
	(!session(self,pmsg(from,to,a)::s) >> session(self,s), a): void

fun {} session_recv_cont
	{self:roles} {from,to:role|not(mem(self,from))*mem(self,to)} {a:vt@ype} {s:stype}
	(!session(self,pmsg(from,to,a)::s) >> session(self,s)): a

fun {} session_send
    {self:roles} {from,to:role|mem(self,from)*not(mem(self,to))} {a:vt@ype} 
	(session(self,pmsg(from,to,a)), a): void

fun {} session_recv
	{self:roles} {from,to:role|not(mem(self,from))*mem(self,to)} {a:vt@ype}
	(session(self,pmsg(from,to,a))): a

fun {} session_bcast_cont
    {self:roles} {from:role|mem(self,from)} {a:t@ype} {s:stype}
	(!session(self,pbcast(from,a)::s) >> session(self,s), a): void

fun {} session_brecv_cont
	{self:roles} {from:role|not(mem(self,from))} {a:t@ype} {s:stype}
	(!session(self,pbcast(from,a)::s) >> session(self,s)): a

fun {} session_bcast
    {self:roles} {from:role|mem(self,from)} {a:t@ype} 
	(session(self,pbcast(from,a)), a): void

fun {} session_brecv
	{self:roles} {from:role|not(mem(self,from))} {a:t@ype}
	(session(self,pbcast(from,a))): a

fun {} session_close
	{self:roles} {r:role|mem(self,r)}
	(session(self,pend(r))): void 

fun {} session_wait
	{self:roles} {r:role|not(mem(self,r))}
	(session(self,pend(r))): void


castfn session_exify 
	   {self:roles} {r:role|not(mem(self,r))} {fp:int->stype} 
	   (session(self,pquan(r,fp))): [n:int] session(self,fp(n))

castfn session_unify 
	   {self:roles} {r:role|mem(self,r)} {fp:int->stype} 
	   (session(self,pquan(r,fp))): {n:int} session(self,fp(n))

(* need to perform runtime check *)

fun {} session_skip_cont
	{self:roles} {s,ss:stype}
	(!session(self,s::ss)>>session(self,ss)): void

fun {} session_skip
	{self:roles} {s:stype}
	(session(self,s)): void

//fun {} session_create
//	{self:roles} {s:stype} 
//	(set self, rtstype s, session(~self,s) -<lincloptr1> void): session (self, s)


(* session combinators *)
fun {} session_seq
	{self:roles} {s1,s2:stype} {a:vt@ype}
	(!session(self,s1::s2) >> session(self,s2), session(self,s1) -<lincloptr1> a): a

fun {} session_mconj
	{self:roles} {r:role|mem(self,r)} {s1,s2:stype} 
	(session(self,pmult(r,s1,s2))): @(session(self,s1), session(self,s2))

fun {} session_mdisj
	{self:roles} {r:role|not(mem(self,r))} {s1,s2:stype} 
	(session(self,pmult(r,s1,s2)), session(self,s1) -<lincloptr1> void, session(self,s2) -<lincloptr1> void): void

datavtype choice (stype, p:stype, q:stype) = 
| Left  (p, p, q) of ()
| Right (q, p, q) of ()

fun {} session_aconj
	{self:roles} {r:role|mem(self,r)} {s,s1,s2:stype}
	(!session(self,paddi(r,s1,s2)) >> session(self,s), choice(s,s1,s2)): void 

fun {} session_adisj
	{self:roles} {r:role|not(mem(self,r))} {s1,s2:stype}
	(!session(self,paddi(r,s1,s2)) >> session(self,s)): #[s:stype] choice (s,s1,s2)

fun {} session_cut
	{rs1,rs2:roles|disj(~rs1,~rs2)} {s:stype} 
	(session(rs1,s), session(rs2,s)): session(rs1*rs2,s)

fun {} session_emp
	{s:stype}
	(session(emp,s)): void

//fun {} session_full
//	{full:roles} {s:stype}
//	(set full, rtstype s): session (full, s)

fun {} session_split
	{rs1,rs2:roles|disj(rs1,rs2)} {s:stype}
	(session(rs1+rs2,s), session(rs1,s) -<lincloptr1> void, session(rs2,s) -<lincloptr1> void): void

typedef negation_t = {rs1:roles} set rs1 -> [rs2:roles] set rs2

fun {} session_neg
	{self:roles} {r:role|mem(self,r)} {s:stype}
	(!session(self,pneg(r,s)) >> session(rs,s), negation_t): #[rs:roles] set rs

fun {} session_neg_follow
	{self:roles} {r:role|not(mem(self,r))} {s:stype}
	(!session(self,pneg(r,s)) >> session(rs,s)): #[rs:roles] set rs

