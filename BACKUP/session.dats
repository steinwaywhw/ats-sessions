staload "./libsession.sats"
staload "./session.sats"
staload "./set.sats"

staload UNSAFE = "prelude/SATS/unsafe.sats"

(* session type implementation *)
datavtype session_t (self:roles, s:stype) = 
| Session (self, s) of (set self, rtstype s, endpt (self, s))

assume session (self:roles, s:stype) = session_t (self, s)

implement {} session_send {self} {from,to} {a} (session, v) = let 
	val+ ~Session (self, rtti, ep) = session
	val+ Msg (from, to) = rtti 
	val _ = assertloc (mem(self,from) andalso ~mem(self,to))

	val _ = endpt_send (ep, from, to, v)
in 

end

implement {} session_recv {self} {from,to} {a} (session) = let 
	val+ ~Session (self, rtti, ep) = session 
	val+ Msg (from, to) = rtti
	val v = endpt_recv (ep, from, to)
in 
	v 
end

implement {} session_seq {self} {s1,s2} {a} (session, f) = let 
	val+ @Session (self, rtti, ep) = session 
	val+ Seq (rt1, rt2) = rtti 

	val s1  = Session (self, rt1, $UNSAFE.castvwtp1{endpt(self,s1)}(ep))
	val ret = f s1
	val _ = cloptr_free ($UNSAFE.castvwtp0{cloptr(void)} f)

	val _ = rtti := rt2
	val _ = ep := $UNSAFE.castvwtp0{endpt(self,s2)}(ep)
	prval _ = fold@ session 
in 
	ret
end



//implement {} rtchan_send_message {self} {from,to} {a} {s} (rtchan, payload) = let 
//	val+ @RTChan (rtstype, chan) = rtchan 
//	val+ Message (rtcont, from, to) = rtstype

//	val _ = chan_send_message (chan, from, to, payload)
//	val _ = rtstype := rtcont
//in 
//	fold@ rtchan 
//end

//implement {} chan_create {s} {a,b} (a, b, f) = let 
//	val mboxA = mbox_create ()
//	val mboxB = mbox_create ()
//	val sockA = sock_create ()
//	val sockB = sock_create ()


//in 
//end


//implement {} rtchan_create {s} {a,b} (a, b, s, f) = let 
//	val chan = chan_create (a, b, llam chan =>
//				let 
//					val _ = f (RTChan (s, chan))
//				in 
//					cloptr_free ($UNSAFE.castvwtp0{cloptr(void)} f)
//				end)
//in 
//	RTChan (s, chan)
//end

//implement {} session_create {s} {self} (self, s, f) = let 
//	prval _ = lemma_set_com_disj {self} ()
//	prval _ = lemma_set_disj_comm {self,~self} ()
	
//	val rtchan = rtchan_create (~self, self, s, llam rtchan => 
//					let 
//						val _ = f (Session (~self, rtchan))
//					in 
//						cloptr_free ($UNSAFE.castvwtp0{cloptr(void)} f)
//					end)
	
//in 
//	Session (self, rtchan) 
//end