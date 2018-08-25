//https://d28rh4a8wq0iu5.cloudfront.net/bitcointech/readings/princeton_bitcoin_book.pdf
//Figure 4.8: Payment process involving a user, merchant, and payment service.
staload "./libsession.sats"
staload "./set.sats"

#define C 0
#define M 1
#define P 2

typedef tid (n:int) = int n



stadef proto = pquan(M, lam (n:int) => pmsg(M,C,@(tid(n),int))::
									   pmsg(C,P,@(tid(n),int))::
//									   pquan2(P, lam (pi:stype) => pmsg(P,C,rtstype(pi)) :: pi)
									   pbcast(P,@(tid(n),string))::
									   pmsg(P,M,@(tid(n),string))::
									   pend(M))

extern fun client   (session(C+emp,proto)): void
extern fun server   (session(M+P+emp,proto)): void
extern fun merchant (session(M+emp,proto)): void
extern fun payment  (session(P+emp,proto)): void


implement client (ch) = let 
	val   [tid:int] ch = session_exify ch
	val @(tid, amount) = session_recv_cont ch 
	val             () = session_send_cont (ch, @(tid, amount))
	val @(tid, status) = session_brecv_cont ch 
	val             () = session_skip_cont ch
in 
	session_wait ch
end

//implement server (chMP) = let 
//	val rtti = Quan(M,  lam {n:int} (n: int(n)) => 
//			   		   Seq(Msg(M,C), 
//			   		   Seq(Msg(C,P),
//			   		   Seq(BCast(P), 
//			   		   Seq(Msg(P,M),
//			   		   End(M)))))): rtstype(proto) 

//	val chfull = session_full (emp()+M+P+C, rtti)
//in
//	session_split {emp+P,emp+M} (chfull, 
//		llam chP => payment chP, 
//		llam chMC => merchant (session_cut (chMC, chMP)))
//end

implement merchant (ch) = let 
	val tid = 100 : tid(100)

	val           ch = session_unify ch
	val           () = session_send_cont (ch, @(tid, 199))
	val           () = session_skip_cont ch 
	val @(_, status) = session_brecv_cont ch 
	val @(_, status) = session_recv_cont ch 
in 
	session_close ch 
end

implement payment (ch) = let 
	val   [tid:int] ch = session_exify ch
	val             () = session_skip_cont ch 
	val @(tid, amount) = session_recv_cont ch 
	val             () = session_bcast_cont (ch, @(tid, "ok"))
	val             () = session_send_cont (ch, @(tid, "confirmed"))
in 
	session_wait ch 
end 

