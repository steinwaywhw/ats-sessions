#define ATS_DYNLOADFLAG 0

staload "./endpoint.sats"
staload "./set.sats"
staload UN = "prelude/SATS/unsafe.sats"

local (**)

//typedef set = [s:set] set s
//vtypedef ep_t = $extype_struct "struct ep_t" of {board=ptr, self=set, full=set}

in (**)

//implement ep_send<int> {s} (ep, label, receivers, a) = 	let
//	val _ = $extfcall(void, "ep_send", $UN.castvwtp1{ptr} ep, label, emp()+g1ofg0(receivers), a)	
//in 
//end

//implement ep_send<string> {s} (ep, label, receivers, a) = 	let
//	val _ = $extfcall(void, "ep_send", $UN.castvwtp1{ptr} ep, label, emp()+g1ofg0(receivers), a)	
//in 
//end

//implement {a} ep_send {s} (ep, label, receivers, a) = let 
//	val a = ref a
//	val _ = $extfcall(void, "ep_send", $UN.castvwtp1{ptr} ep, label, emp()+g1ofg0(receivers), ref_get_ptr a)	
//in 
//end

implement {a} ep_send {s} (ep, label, receivers, a) = let 
//	val a = ref a
	val _ = $extfcall(void, "ep_send", $UN.castvwtp1{ptr} ep, label, emp()+g1ofg0(receivers), $UN.castvwtp0{ptr} a)	
in 
end


implement ep_bsend<int> {s} (ep, label, a) = let 
//	val p = $UN.castvwtp1{ref(ep_t)} ep 
	val _ = $extfcall(void, "ep_send", $UN.castvwtp1{ptr} ep, label, set_dif(ep_get_full(ep), ep_get_self(ep)), a)	
in 
end

implement ep_bsend<string> {s} (ep, label, a) = let 
	// Unsafe. Can only send constant string.
//	val p = $UN.castvwtp1{ref(ep_t)} ep 
	val _ = $extfcall(void, "ep_send", $UN.castvwtp1{ptr} ep, label, set_dif(ep_get_full(ep), ep_get_self(ep)), a)	
in 
end

implement {a} ep_recv {s} (ep, label, sender) = let 
	val a = $extfcall(a, "ep_recv", $UN.castvwtp1{ptr} ep, label, emp()+g1ofg0(sender))
in 
//	$UN.ptr0_get a
	a
end

implement ep_brecv<int> {s} (ep, label, sender) = let 
	val a = $extfcall(int, "ep_recv", $UN.castvwtp1{ptr} ep, label, emp()+g1ofg0(sender))
in 
	a
end

implement ep_brecv<string> {s} (ep, label, sender) = let 
	val a = $extfcall(string, "ep_recv", $UN.castvwtp1{ptr} ep, label, emp()+g1ofg0(sender))
in 
	a
end


end (**)