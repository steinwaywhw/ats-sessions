staload "./libsession.sats"
staload "./set.sats"

(* typed endpoints *)
absvtype endpt (roles, stype) = ptr

(* API for endpoints *)
fun {} endpt_send
	{self:roles} {from,to:role|mem(self,from)*not(mem(self,to))} {a:vt@ype}
	(endpt(self,pmsg(from,to,a)), int from, int to, a): void 

fun {} endpt_recv
	{self:roles} {from,to:role|not(mem(self,from))*mem(self,to)} {a:vt@ype}
	(endpt(self,pmsg(from,to,a)), int from, int to): a

//fun {} endpt_accept 
//    {self:roles} {r:role|mem(self,r)} {s:stype}
//    (socket, set self, rtstype(pinit(r)::s)): endpt(self,s)

//fun {} endpt_request 
//	{self:roles} {r:role|not(mem(self,r))} {s:stype}
//	(socket, set self, rtstype(pinit(r)::s)): endpt(self,s)



//fun {} chan_create
//	{s:stype} {a,b:roles|disj(a,b)} 
//	(set a, set b, chan (a, s) -<lincloptr1> void): chan (b, s)

//fun {} chan_lock_acquire
//    {self:roles} {r:role|mem(self,r)} {s:stype}
//    (!chan(self,plock(r)::s))

//fun {} chan_lock_accept
//       {self:roles} {r:role|not(mem(self,r))} {s:stype}
//       (!chan(self,plock(r,s)) >> chan(self,s)): 

//fun {} chan_unlock_accept
//       {self:roles} {r:role|not(mem(self,r))} {s:stype}
//       (LOCK s | !chan(self,unlock(r)) >> chan(self,s)): void

//fun {} chan_lock_request
//       {self:roles} {r:role|mem(self,r)} {s:stype}
//       (!chan(self,plock(r)::s) >> chan(self,s)): (LOCK s | void)

//fun {} chan_unlock_request
//       {self:roles} {r:role|mem(self,r)} {s:stype}
//       (LOCK s | !chan(self,unlock(r)) >> chan(self,s)): void


//FORK = rpt(plock(0)::punlock(0))

//fun {} chan_service_provide
//    {self:roles} {r:role|mem(self,r)} {s:stype}
//    (!chan(self,prpt(r)::s)): void 

//fun {} chan_service_stop
//    {self:roles} {r:role|mem(self,r)} {s:stype}
//    (chan(self,prpt(r)::s)): void 

//fun {} chan_service_request
//    {self:roles} {r:role|not(mem(self,r))} {s:stype}
//    (!chan(self,prpt(r)::s)): chan(self,s)


(* API for rtchan *)
//fun {} rtchan_send
//    {self:roles} {from,to:role|mem(self,from)*not(mem(self,to))} {a:vt@ype} {s:stype}
//	(!rtchan(self,pmsg(from,to,a)::s) >> rtchan(self,s), payload a): void

//fun {} rtchan_create
//	{s:stype} {a,b:roles|disj(a,b)} 
//	(set a, set b, rtstype s, rtchan (a, s) -<lincloptr1> void): rtchan (b, s)




