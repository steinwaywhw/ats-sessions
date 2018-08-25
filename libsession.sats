//#include "share/atspre_staload.hats"
staload "./set.sats"
staload "./maybe.sats"

sortdef role  = int
sortdef roles = set

(* session types *)
datasort stype = (* external *)
| pinit   of (role)	             
| pend    of (role)                
| pmsg    of (role, role, vt@ype)  
| pbmsg   of (role, t@ype)         
| pseq    of (stype, stype)        
| ppara   of (role, stype, stype)  
| pbranch of (role, stype, stype)  
| pfix    of (stype -> stype)      
| pquan   of (role, int -> stype)  
| pquan2  of (role, stype -> stype)
| pserve  of (role, stype)         

//stacst pinit   : (role)	              -> stype = "ext#"
//stacst pend    : (role)                 -> stype = "ext#"
//stacst pmsg    : (role, role, vt@ype)   -> stype = "ext#"
//stacst pbmsg   : (role, t@ype)          -> stype = "ext#"
//stacst pseq    : (stype, stype)         -> stype = "ext#"
//stacst ppara   : (role, stype, stype)   -> stype = "ext#"
//stacst pbranch : (role, stype, stype)   -> stype = "ext#"
//stacst pfix    : (stype -> stype)       -> stype = "ext#"
//stacst pquan   : (role, int -> stype)   -> stype = "ext#"
//stacst pquan2  : (role, stype -> stype) -> stype = "ext#"
//stacst pserve  : (role, stype)          -> stype = "ext#"

stadef :: = pseq
stadef popt (r:role, s:stype) = pbranch(r,s,pend(r))
stadef prpt (r:role, a:t@ype) = pfix(lam (p:stype):stype => popt(r, pbmsg(r,a)::p))
stadef prpt (r1:role, r2:role, a:vt@ype) = pfix(lam (p:stype):stype => popt(r1, pmsg(r1,r2,a)::p))

datavtype choice (stype, p:stype, q:stype) = 
| Left  (p, p, q) of ()
| Right (q, p, q) of ()

(* endpoint type *)
absvtype chan (roles, roles, stype) = ptr

(* session api *)
fun {a:vt@ype} session_send
    {full,self:roles|full>self} {from,to:role|mem(self,from)*mem(full-self,to)} {s:stype}
	(!chan(full,self,pmsg(from,to,a)::s)>>chan(full,self,s), int to, a): void

fun {a:vt@ype} session_recv
	{full,self:roles|full>self} {from,to:role|mem(full-self,from)*mem(self,to)} {s:stype}
	(!chan(full,self,pmsg(from,to,a)::s)>>chan(full,self,s), int from): a

prfun session_skip 
	{full,self:roles|full>self} {from,to:role|(mem(self,from)*mem(self,to))+(mem(full-self,from)*mem(full-self,to))} {a:vt@ype} {s:stype}
	(!chan(full,self,pmsg(from,to,a)::s)>>chan(full,self,s)): void

fun {a:t@ype} session_bsend
    {full,self:roles|full>self} {from:role|mem(self,from)} {s:stype}
	(!chan(full,self,pbmsg(from,a)::s)>>chan(full,self,s), a): void

fun {a:t@ype} session_brecv
	{full,self:roles|full>self} {from:role|mem(full-self,from)} {s:stype}
	(!chan(full,self,pbmsg(from,a)::s)>>chan(full,self,s), int from): a

fun session_close
	{full,self:roles|full>self} {r:role|mem(self,r)}
	(chan(full,self,pend(r))): void 

fun session_wait
	{full,self:roles|full>self} {r:role|mem(full-self,r)}
	(chan(full,self,pend(r)), int r): void

fun session_fork
	{rs1,rs2:roles} {s:stype} 
	(set rs1, set rs2, chan(rs1+rs2,rs1,s) -<lincloptr1> void): chan(rs1+rs2,rs2,s)

fun session_make
	{full,self:roles|full>self} {s:stype}
	(set full, set self): chan(full,self,s)

fun session_accept
	{full,self:roles|full>self} {r:role|mem(self,r)} {s:stype}
	(!chan(full,self,pinit(r)::s)>>chan(full,self,s)): void

fun session_request
	{full,self:roles|full>self} {r:role|mem(full-self,r)} {s:stype}
	(chan(full,self,pinit(r)::s), chan(full,self,s) -<lincloptr1> void): void

castfn session_exify 
	   {full,self:roles|full>self} {r:role|mem(full-self,r)} {fp:int->stype} 
	   (chan(full,self,pquan(r,fp))): [n:int] chan(full,self,fp(n))

castfn session_unify 
	   {full,self:roles|full>self} {r:role|mem(self,r)} {fp:int->stype} 
	   (chan(full,self,pquan(r,fp))): {n:int} chan(full,self,fp(n))

prfun session_unroll
	  {full,self:roles|full>self} {f:stype->stype} 
	  (!chan(full,self,pfix(f))>>chan(full,self,f(pfix(f)))): void

(* session combinators *)
fun session_paraconn
	{full,self:roles|full>self} {r:role|mem(self,r)} {s1,s2:stype} 
	(chan(full,self,ppara(r,s1,s2))): @(chan(full,self,s1),chan(full,self,s2))

fun session_paradisj
	{full,self:roles|full>self} {r:role|mem(full-self,r)} {s1,s2:stype} 
	(chan(full,self,ppara(r,s1,s2)), chan(full,self,s1) -<lincloptr1> void, chan(full,self,s2) -<lincloptr1> void): void

fun session_choose
	{full,self:roles|full>self} {r:role|mem(self,r)} {s,s1,s2:stype}
	(!chan(full,self,pbranch(r,s1,s2))>>chan(full,self,s), choice(s,s1,s2)): void 

fun session_offer
	{full,self:roles|full>self} {r:role|mem(full-self,r)} {s1,s2:stype}
	(!chan(full,self,pbranch(r,s1,s2))>>chan(full,self,s)): #[s:stype] choice (s,s1,s2)

fun session_link
	{full,rs1,rs2:roles|(full>rs1)*(full>rs2)*disj(full-rs1,full-rs2)} {s:stype} 
	(chan(full,rs1,s), chan(full,rs2,s)): chan(full,rs1*rs2,s)

fun session_client
	{full,self:roles|full>self} {r:role|mem(self,r)} {cont,s:stype}
	(!chan(full,self,pserve(r,s))>>chan(full,self,cont), choice(cont,pserve(r,s),pend(r))): maybe(chan(full,self,s))

fun session_server
	{full,self:roles|full>self} {r:role|mem(full-self,r)} {s:stype}
	(!chan(full,self,pserve(r,s))>>chan(full,self,cont), chan(full,self,s) -<fun> void): #[cont:stype] choice(cont,pserve(r,s),pend(r))

fun session_emp
	{full:roles} {s:stype}
	(chan(full,emp,s)): void

fun session_full
	{full:roles} {s:stype}
	(set full): chan(full,full,s)

fun session_split
	{full,rs1,rs2:roles|(full>rs1)*(full>rs2)*disj(rs1,rs2)} {s:stype}
	(!chan(full,rs1+rs2,s)>>chan(full,rs2,s), chan(full,rs1,s) -<lincloptr1> void): void

