
staload "./libsession.sats"
staload "./set.sats"

//#include "share/atspre_staload.hats"


(* 0: client *)
(* 1: auth *)
(* 2: server *)

absvtype token = ptr

stadef protoauth     = pmsg(0,1,string)::pmsg(0,1,string)::pmsg(1,0,token)
stadef protosrv_ok   = pmsg(0,2,int)::pmsg(0,2,int)::pmsg(2,0,bool)::pend(0)
stadef protosrv_fail = pmsg(2,0,string)::pend(2)
stadef protosrv      = pmsg(0,2,token)::paddi(2,protosrv_ok,protosrv_fail)

stadef proto = protoauth :: protosrv

extern fun authenticate (string, string): token 
extern fun validate (token): bool

extern fun auth (session(1+emp,protoauth)): void
extern fun srv (session(2+emp,protosrv)): void 
extern fun cli (session(0+emp,proto)): void

implement auth (ch) = let 
	val usn = session_recv_cont ch 
	val pwd = session_recv_cont ch 
	val token = authenticate (usn, pwd)
in
	session_send (ch, token)
end

implement srv (ch) = let 
	val token = session_recv_cont ch

	fun fail (ch: session(2+emp,protosrv_fail)): void = let 
		val _ = session_send_cont (ch, "Validation failed.")
	in 
		session_close ch
	end 

	fun ok (ch: session(2+emp,protosrv_ok)): void = let 
		val a = session_recv_cont ch 
		val b = session_recv_cont ch 
		val _ = session_send_cont (ch, a = b)
	in 
		session_wait ch 
	end 
in 
	if validate token
	then 
		let val _ = session_aconj (ch, Left ())
		in ok ch end
	else
		let val _ = session_aconj (ch, Right ())
		in fail ch end
end

implement cli (ch) = let 
	fun do_auth (ch: session(0+emp, protoauth)): token = let 
		val _ = session_send_cont (ch, "admin")
		val _ = session_send_cont (ch, "password")
	in 
		session_recv ch
	end

	val token = session_seq (ch, llam ch => do_auth ch)
	val _ = session_send_cont (ch, token)
	val choice = session_adisj ch

	fun fail (ch: session(0+emp, protosrv_fail)): void = let 
		val msg = session_recv_cont ch
	in 
		session_wait ch 
	end

	fun ok (ch: session(0+emp, protosrv_ok)): void = let 
		val a = 1
		val b = 1
		val _ = session_send_cont (ch, a)
//		val _ = session_send_cont (ch, b)
		val r = session_recv_cont ch 
	in 
		session_close ch
	end
in 
	case+ choice of 
	| ~Left ()  => ok ch 
	| ~Right () => fail ch
end

extern fun test (): void


implement test () = let 
	val full = emp() + 0 + 1 + 2

	val rttiauth: rtstype(protoauth) = Seq(Msg(0,1),Seq(Msg(0,1),Msg(1,0)))
	val rttisrvok: rtstype(protosrv_ok) = Seq(Msg(0,2),Seq(Msg(0,2), Seq(Msg(2,0), End(0))))
	val rttisrvfail: rtstype(protosrv_fail) = Seq(Msg(2,0),End(2))
	val rttisrv: rtstype(protosrv) = Seq(Msg(0,2),Addi(2,rttisrvok,rttisrvfail))
	val rtti:rtstype(proto) = Seq(rttiauth,rttisrv)

	fun hook (ch:session(emp+1+2,proto)): void = let 

		val () = session_seq (ch, llam ch => 
					session_split {emp+1,emp+2} (ch, 
						llam ch => auth ch, 
						llam ch => session_skip ch))

		val _ = session_split {emp+1,emp+2} (ch, 
					llam ch => session_skip ch, 
					llam ch => srv ch)
	in 
	end

	val session = session_full (full, rtti)
	val _ = session_split {emp+0, emp+1+2} (session,
				llam ch => cli ch, 
				llam ch => hook ch)
in 
end
