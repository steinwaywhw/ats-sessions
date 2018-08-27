#define ATS_DYNLOADFLAG 0
#include "share/atspre_staload.hats"

staload "./libsession.sats"
staload "./set.sats"
staload "./blackboard.sats"
staload "./endpoint.sats"
staload "./msg.sats"

staload "libats/SATS/athread.sats"
staload _ = "libats/DATS/athread.dats"
staload _ = "libats/DATS/athread_posix.dats"


staload _ = "./endpoint.dats"

implement session_fork {rs1,rs2} {s} (rs1, rs2, f) = let 
	val board = board_make ("random")
	val ep1 = $UNSAFE.castvwtp0{chan(rs1+rs2,rs1,s)} (ep_make (rs1+rs2, rs1, board))
	val ep2 = $UNSAFE.castvwtp0{chan(rs1+rs2,rs2,s)} (ep_make (rs1+rs2, rs2, board))
	val _ = board_free board
	val _ = athread_create_cloptr_exn (llam () => let val _ = f ep1 in $UNSAFE.castvwtp0{void} f end)
in 
	ep2
end

implement session_close {full,self} {r} (ch, syncer) = let 
	val ep = $UNSAFE.castvwtp0{endpoint} ch
	val _ = ep_sync_recv (ep, SYNC_CLOSE, syncer)
	val _ = ep_bsend<int> (ep, CLOSE, syncer, 0)
	val _ = ep_free ep
in 
end

implement session_wait {full,self} {r} (ch, syncer) = let 
	val ep = $UNSAFE.castvwtp0{endpoint} ch
	val _ = ep_sync_send (ep, SYNC_CLOSE, syncer, $UNSAFE.cast{int}(ep_get_self ep))
	val _ = ep_brecv<int> (ep, CLOSE, syncer)
	val _ = ep_free ep
in 
end

implement {a} session_send {full,self} {from,to} {s} (ch, from, to, a) = let
	val ep = $UNSAFE.castvwtp1{endpoint} ch
	val _ = ep_send<a> (ep, MSG, from, to, a)
	extern praxi cast {x:stype} (!chan(full,self,x)>>chan(full,self,s)): unit_p
	val _ = $UNSAFE.castvwtp0{void} ep
	prval _ = cast ch
in 
end

implement {a} session_recv {full,self} {from,to} {s} (ch, from, to) = let
	val ep = $UNSAFE.castvwtp1{endpoint} ch
	val a = ep_recv<a> (ep, MSG, from, to)
	extern praxi cast {x:stype} (!chan(full,self,x)>>chan(full,self,s)): unit_p
	val _ = $UNSAFE.castvwtp0{void} ep
	prval _ = cast ch
in 
	a
end

implement {a} session_bsend {full,self} {from} {s} (ch, from, a) = let
	val ep = $UNSAFE.castvwtp1{endpoint} ch
	val _ = ep_bsend<a> (ep, MSG, from, a)
	extern praxi cast {x:stype} (!chan(full,self,x)>>chan(full,self,s)): unit_p
	val _ = $UNSAFE.castvwtp0{void} ep
	prval _ = cast ch
in 
end

implement {a} session_brecv {full,self} {from} {s} (ch, from) = let
	val ep = $UNSAFE.castvwtp1{endpoint} ch
	val a = ep_brecv<a> (ep, MSG, from)
	extern praxi cast {x:stype} (!chan(full,self,x)>>chan(full,self,s)): unit_p
	val _ = $UNSAFE.castvwtp0{void} ep
	prval _ = cast ch
in 
	a
end

implement session_link {full,rs1,rs2} {s} (ch1, ch2) = let 
	val ep1 = $UNSAFE.castvwtp0{endpoint} ch1
	val ep2 = $UNSAFE.castvwtp0{endpoint} ch2
	val ep  = ep_link(ep1, ep2)
in 
	$UNSAFE.castvwtp0{chan(full,rs1*rs2,s)} ep
end

implement session_emp {full} {s} (ch) = let 
	val ep = $UNSAFE.castvwtp0{endpoint} ch 
in 
	ep_free ep 
end

implement session_choose {full,self} {r} {s,s1,s2} (ch, chooser, choice) = let 
	fun snd (ep: endpoint, i: int): void = let
		val _ = ep_bsend<int> (ep, BRANCH, chooser, i)
		val _ = $UNSAFE.castvwtp0{void} ep
	in 
	end
	extern praxi cast1 {x:stype} (!chan(full,self,x)>>chan(full,self,s1)): unit_p
	extern praxi cast2 {x:stype} (!chan(full,self,x)>>chan(full,self,s2)): unit_p
in 
	case+ choice of 
	| ~Left ()  => 
		let 
			val _ = snd($UNSAFE.castvwtp1{endpoint} ch, 0)
			prval _ = cast1 ch
		in end
	| ~Right () => 
		let 
			val _ = snd($UNSAFE.castvwtp1{endpoint} ch, 1)
		 	prval _ = cast2 ch
		in end
end

implement session_offer {full,self} {r} {s1,s2} (ch, chooser) = let 
	val ep = $UNSAFE.castvwtp1{endpoint} ch
	val c  = ep_brecv<int> (ep, BRANCH, chooser)
	val _ = $UNSAFE.castvwtp0{void} ep
	extern praxi cast1 {x:stype} (!chan(full,self,x)>>chan(full,self,s1)): unit_p
	extern praxi cast2 {x:stype} (!chan(full,self,x)>>chan(full,self,s2)): unit_p
in 
	if c = 0
	then 
		let prval _ = cast1 ch
		in Left () end
	else 
		let prval _ = cast2 ch 
		in Right () end
end

implement session_make<board> {s} {full,self} (full, self, board) = let 
	val ep = $UNSAFE.castvwtp0{chan(full,self,s)} (ep_make (full, self, board))
in
	ep 
end

implement session_accept {full,self} {r} {s} (ch, accepter) = let
	val ep = $UNSAFE.castvwtp1{endpoint} ch
	val _ = ep_sync_recv (ep, SYNC_INIT, accepter)
	val _ = ep_bsend<int> (ep, INIT, accepter, 0)
	val _ = $UNSAFE.castvwtp0{void} ep
	extern praxi cast {x:stype} (!chan(full,self,x)>>chan(full,self,s)): unit_p
	prval _ = cast ch
in 
end

implement session_request {full,self} {r} {s} (ch, accepter, f) = let 

	fun threadfn (ch: chan(full,self,pinit(r)::s), f: chan(full,self,s) -<lincloptr1> void): void = let 
		val ep = $UNSAFE.castvwtp1{endpoint} ch
		val _ = ep_sync_send (ep, SYNC_INIT, accepter, $UNSAFE.cast{int}(ep_get_self ep))
		val _ = ep_brecv<int> (ep, INIT, accepter)
		val _ = $UNSAFE.castvwtp0{void} ep
		extern praxi cast {x:stype} (!chan(full,self,x)>>chan(full,self,s)): unit_p
		prval _ = cast ch
		val _ = f ch
		val _ = $UNSAFE.castvwtp0{void} f 
	in 
	end 

in 
	ignoret athread_create_cloptr_exn (llam () => threadfn (ch, f))
end

implement session_split {full,rs1,rs2} {s} (rs1, rs2, ch12, f2) = let 
	val ep12 = $UNSAFE.castvwtp1{endpoint} ch12
	val ep2 = ep_split (ep12, rs1)
	val _ = athread_create_cloptr_exn (llam () => let val _ = f2 ($UNSAFE.castvwtp0{chan(full,rs2,s)} ep2) in $UNSAFE.castvwtp0{void} f2 end)
	val _ = $UNSAFE.castvwtp0{void} ep12
	extern praxi cast {x:stype} (!chan(full,rs1+rs2,x)>>chan(full,rs1,x)): unit_p
	prval _ = cast ch12
in 
end