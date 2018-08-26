#include "share/atspre_staload.hats"

%{^
#include <nng/nng.h>
#include <nng/protocol/bus0/bus.h>
#include <uuid/uuid.h>
%}

staload "./transport.sats"
staload "./json.sats"
staload "./thread.sats"
staload "./uuid.sats"

staload _ = "./transport.dats"
staload _ = "./json.dats"
staload _ = "./thread.dats"

staload "libats/libc/SATS/unistd.sats"

implement main0 () = let 

//	val uuid1 = uuid_generate ()
//	val uuid2 = uuid_copy uuid1

//	var uuidstr: uuid_string
//	val () = uuid_unparse (uuid2, uuidstr)

//	val _ = println! ($UNSAFE.cast{string} uuidstr)
//	val uuid3 = uuid_parse uuidstr

//	val _ = println! (uuid_equal (uuid1, uuid3))

//	val _ = uuid_free uuid1 
//	val _ = uuid_free uuid2
//	val _ = uuid_free uuid3 


	val (tbroker, sock) = trans_nn_broker ("inproc://bus")

	fun t1 (): void = let 
		val trans = trans_make<nn> ()
		val _     = println! "t1 connecting"
		val _     = trans_connect (trans, "inproc://bus")
		val _     = sleep 2
		val json  = to_json<string> "hello"
		val _     = println! "t1 sending"
		val _     = trans_send<json> (trans, json)
		val _     = println! "t1 sent"
	in 
		trans_term trans
	end

	fun t2 (): void = let 
		val trans = trans_make<nn> () 
		val _     = println! "t2 connecting"
		val _     = trans_connect (trans, "inproc://bus")
		val _     = println! "t2 receiving"
		val json  = trans_recv<json> (trans)
		val _     = println! "t2 received"
		val resp  = from_json<cstring> json
		val _     = println! resp
		val _     = free resp
		val _     = json_free json
		val _     = sleep 1
	in 
		trans_term trans
	end

	fun t3 (): void = let 
		val trans = trans_make<nn> ()
		val _     = trans_connect (trans, "inproc://bus")

		fun echo (json): void = let 
			val resp = from_json<cstring> json 
			val _    = println! resp 
			val _    = free resp 
			val _    = json_free json 
		in 
		end 

		val _ = trans_recv<json> (trans, llam json => echo json)
	in 
		trans_term trans 
	end 

	val tid1 = thread_spawn (llam () => t1 ())
	val _     = sleep 1
	val tid2 = thread_spawn (llam () => t2 ())
	val _ = thread_join tid1
	val _ = thread_join tid2

	val _ = trans_term sock 
	val _ = thread_join tbroker
in 
end