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

implement session_close {full,self} {r} (ch) = let 
	val ep = $UNSAFE.castvwtp0{ptr} ch
	val _ = $extfcall(void, "ep_sync", ep, SYNC)
	val ep = $UNSAFE.castvwtp0{endpoint} ep
	val _ = ep_bsend<int> (ep, CLOSE, 0)
	val _ = ep_free ep
in 
end

implement session_wait {full,self} {r} (ch, r) = let 
	val ep = $UNSAFE.castvwtp0{endpoint} ch
	val _ = ep_send<int> (ep, SYNC, r, 0)
	val _ = ep_brecv<int> (ep, CLOSE, r)
	val _ = ep_free ep
in 
end

implement {a} session_send {full,self} {from,to} {s} (ch, to, a) = let
	val ep = $UNSAFE.castvwtp1{endpoint} ch
	val _ = ep_send<a> (ep, MSG, to, a)
	val _ = $UNSAFE.castvwtp0{void} ep
	extern praxi cast {x:stype} (!chan(full,self,x)>>chan(full,self,s)): unit_p
	prval _ = cast ch
in 
end

implement {a} session_recv {full,self} {from,to} {s} (ch, from) = let
	val ep = $UNSAFE.castvwtp1{endpoint} ch
	val a = ep_recv<a> (ep, MSG, from)
	val _ = $UNSAFE.castvwtp0{void} ep
	extern praxi cast {x:stype} (!chan(full,self,x)>>chan(full,self,s)): unit_p
	prval _ = cast ch
in 
	a
end

implement {a} session_bsend {full,self} {from} {s} (ch, a) = let
	val ep = $UNSAFE.castvwtp1{endpoint} ch
	val _ = ep_bsend<a> (ep, MSG, a)
	val _ = $UNSAFE.castvwtp0{void} ep
	extern praxi cast {x:stype} (!chan(full,self,x)>>chan(full,self,s)): unit_p
	prval _ = cast ch
in 
end

implement {a} session_brecv {full,self} {from} {s} (ch, from) = let
	val ep = $UNSAFE.castvwtp1{endpoint} ch
	val a = ep_brecv<a> (ep, MSG, from)
	val _ = $UNSAFE.castvwtp0{void} ep
	extern praxi cast {x:stype} (!chan(full,self,x)>>chan(full,self,s)): unit_p
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

