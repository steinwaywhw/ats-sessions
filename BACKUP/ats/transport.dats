#define ATS_DYNLOADFLAG 0

%{^
#include <nng/nng.h>
#include <nng/protocol/bus0/bus.h>
%}

staload "./transport.sats"
staload "./json.sats"
staload "./thread.sats"

staload UN = "prelude/SATS/unsafe.sats"
staload _ = "./json.dats"
staload _ = "./thread.dats"


local (***********************)

#include "share/atspre_staload.hats"
typedef nng_socket = $extype "nng_socket" 
vtypedef cstring = [l:addr|l>null] strptr l

extern fun to_nng_socket (t: !transport nn): nng_socket 
implement to_nng_socket (t) = !($UN.castvwtp1{ref(nng_socket)} t)

extern fun from_nng_socket (sock: nng_socket): transport nn 
implement from_nng_socket (sock) = $UN.castvwtp0{transport nn} (ref<nng_socket> sock)

in    (***********************)

implement trans_make<nn> () = let 
	var sock: nng_socket
	extern fun nng_bus0_open (sock: &nng_socket? >> _): int = "mac#nng_bus0_open"
	val ret = nng_bus0_open sock
	val _   = assert_errmsg (ret = 0, "trans_make (nanomsg) failed.")
in 
	from_nng_socket sock
end

implement trans_term<nn> (t) = let 
	val ret = $extfcall (int, "nng_close", to_nng_socket t)
	val _   = assert_errmsg (ret = 0, "trans_close (nanomsg) failed.")
in 
	$UN.castvwtp0{void} t
end

implement trans_listen<nn> (t, addr) = let 
	val ret = $extfcall (int, "nng_listen", to_nng_socket t, addr, 0, 0)
	val _   = assert_errmsg (ret = 0, "trans_listen (nanomsg) failed.")
in 
end

implement trans_connect<nn> (t, addr) = let 
	val ret = $extfcall (int, "nng_dial", to_nng_socket t, addr, 0, 0)
	val _   = assert_errmsg (ret = 0, "trans_connect (nanomsg) failed.")
in 
end

implement trans_send<json><nn> (t, json) = let 
	val str = json_dumps json
	val len = length str
	val ret = $extfcall (int, "nng_send", to_nng_socket t, $UN.strptr2string str, len, 0)
	val _   = assert_errmsg (ret = 0, "trans_send (nanomsg) failed.")
	val _   = free str
in 
end

implement trans_recv_sync<json><nn> (t) = let 

	var buffer: ptr
	var size:   size_t

	extern fun nng_recv (nng_socket, &ptr >> ptr l, &size_t? >> size_t n, int): 
			   #[n:nat] #[l:agz] (@[byte][n] @ l | int) = "mac#nng_recv"

	macdef NNG_FLAG_ALLOC = $extval (int, "NNG_FLAG_ALLOC")
	val (pf | ret) = nng_recv (to_nng_socket t, buffer, size, NNG_FLAG_ALLOC)
	val _   = assert_errmsg (ret = 0, "trans_recv (nanomsg) failed.")
	
	val json = json_loadb (pf | buffer, sz2i size)

	extern fun nng_free {n:nat} {l:agz} (@[byte][n] @ l | ptr l, size_t n): void = "mac#nng_free"
	val _ = nng_free (pf | buffer, size)
		
in 
	json
end

implement trans_recv_async<json><nn> (t, cont) = let 
	typedef nng_aio = $extype "nng_aio"
	typedef nng_aio_ref = ref nng_aio

	extern fun nng_aio_result (nng_aio_ref): int = "mac#nng_aio_result"
	extern fun nng_aio_alloc (&nng_aio_ref? >> _, (ref nng_aio_ref) -<lincloptr1> void, ptr): void = "mac#nng_aio_alloc"
	extern fun nng_recv_aio (nng_socket, nng_aio_ref): void = "mac#nng_recv_aio"
	extern fun nng_aio_free (nng_aio_ref): void = "mac#nng_aio_free"

	fun work (aio: ref nng_aio_ref, cont: json -<lincloptr1> void): void = let 
		val aio = !aio
		val ret = nng_aio_result aio 
		val _   = assert_errmsg (ret = 0, "trans_recv_async failed.")

		val msg  = $extfcall (ptr, "nng_aio_get_msg", aio)
		val str  = $extfcall (cstring, "nng_msg_body", msg)
		val json = json_loads str
		val _    = $extfcall (void, "nng_msg_free", msg)
		val _    = $UN.cast2void str

		val _ = cont json
		val _ = cloptr_free ($UN.castvwtp0{cloptr0} cont)
	in 
		nng_aio_free aio (* defered free *)
	end

	var aio: nng_aio_ref 
	val _ = nng_aio_alloc (aio, llam aio => work (aio, cont), addr@aio)
	val _ = nng_recv_aio (to_nng_socket t, aio)
in 
end

%{
	nng_socket empty = NNG_SOCKET_INITIALIZER;
%}

implement trans_nn_broker (addr) = let 
	var sock: nng_socket

	(* open a bus socket *)
	extern fun nng_bus0_open_raw (sock: &nng_socket? >> _): int = "mac#nng_bus0_open_raw"
	val ret = nng_bus0_open_raw sock
	val _   = assert_errmsg (ret = 0, "trans_nn_broker (nanomsg) failed.")
	val sock = sock

	(* listen *)
	val ret = $extfcall (int, "nng_listen", sock, addr, 0, 0)
	val _   = assert_errmsg (ret = 0, "trans_nn_broker (nanomsg) failed.")

	(* make it a device *)
	val empty = $extval (nng_socket, "empty")
	val tid = thread_spawn (llam () => $extfcall (void, "nng_device", sock, empty))
in 
	(tid, from_nng_socket sock)
end 

end   (***********************)