#define ATS_DYNLOADFLAG 0

staload "./endpoint.sats"
staload "./set.sats"
staload "./msg.sats"

staload UN = "prelude/SATS/unsafe.sats"

local (**) 

typedef set = [s:set] set s 
extern fun _send (!endpoint, msglabel, set, set, ptr): void = "mac#ep_send"
extern fun _recv (!endpoint, msglabel, set, set): ptr = "mac#ep_recv"
extern fun _sync (!endpoint, msglabel, set): void = "mac#ep_sync"

in (**)

implement {a} ep_send (ep, label, sender, receiver, a) = 
	_send (ep, label, emp()+g1ofg0(sender), emp()+g1ofg0(receiver), $UN.castvwtp0{ptr} a)

implement ep_bsend<int> (ep, label, sender, a) = 
	_send (ep, label, emp()+g1ofg0(sender), ep_get_full(ep)-ep_get_self(ep), $UN.cast{ptr} a)

// Unsafe. Can only send constant string.
implement ep_bsend<string> (ep, label, sender, a) = 
	_send (ep, label, emp()+g1ofg0(sender), ep_get_full(ep)-ep_get_self(ep), $UN.cast{ptr} a)

implement {a} ep_recv (ep, label, sender, receiver) = 
	$UN.castvwtp0{a} (_recv (ep, label, emp()+g1ofg0(sender), emp()+g1ofg0(receiver)))

implement ep_brecv<int> (ep, label, sender) = 
	$UN.cast{int} (_recv (ep, label, emp()+g1ofg0(sender), ep_get_self ep))

implement ep_brecv<string> (ep, label, sender) = 
	$UN.cast{string} (_recv (ep, label, emp()+g1ofg0(sender), ep_get_self ep))

implement ep_sync_recv (ep, label, syncer) = 
	_sync (ep, label, emp()+g1ofg0(syncer))
	
implement {a} ep_sync_send (ep, label, syncer, a) = 
	_send (ep, label, ep_get_self ep, emp()+g1ofg0(syncer), $UN.cast{ptr} a)

end (**)