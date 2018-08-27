#include "share/atspre_staload.hats"

staload "./libsession.sats"
staload "./set.sats"
staload "./blackboard.sats"
staload "./endpoint.sats"
staload "./msg.sats"
staload "./thread.sats"

staload _ = "./thread.dats"
staload _ = "./endpoint.dats"
staload _ = "./libsession.dats"

%{^
#include "./runtime.h"
#include "./log.h"
%}

extern fun setup (): void
implement setup () = let 
	val LOG_INFO = $extval(int, "LOG_INFO")
	val _ = $extfcall(void, "install_handler")
 	val _ = $extfcall(void, "log_set_pthread")
 	val _ = $extfcall(void, "log_set_level", LOG_INFO)
in 
end

extern fun helloworld (): void 
implement helloworld () = let 
	stadef rs1 = emp+1
	stadef rs2 = emp+2
	stadef helloworld = pbmsg(1,string)::pbmsg(2,string)::pend(1)

	fun client (ch: chan(rs1+rs2,rs1,helloworld)): void = let
		val _ = session_bsend<string> (ch, 1, "hello")
		val _ = println! (session_brecv<string> (ch, 2))
	in
		session_close (ch, 1)
	end

	fun server (ch: chan(rs1+rs2,rs2,helloworld)): void = let 
		val _ = println! (session_brecv<string> (ch, 1))
		val _ = session_bsend (ch, 2, "world!")
	in 
		session_wait (ch, 1)
	end

	val ch = session_fork (emp()+1, emp()+2, llam ch => client ch)
	val _ = server ch
in 
end

extern fun simplelink (): void 
implement simplelink () = let 
	stadef rs1 = emp+1
	stadef rs2 = emp+2
	stadef helloworld = pbmsg(1,string)::pbmsg(2,string)::pbmsg(1,string)::pbmsg(2,string)::pend(1)

	fun client (ch: chan(rs1+rs2,rs1,helloworld)): void = let
		val _ = session_bsend<string> (ch, 1, "hello1")
		val _ = println! (session_brecv<string> (ch, 2))
		val _ = $extfcall(void, "sleep", 1)
		val _ = session_bsend<string> (ch, 1, "hello2")
		val _ = println! (session_brecv<string> (ch, 2))
	in
		session_close (ch, 1)
	end

	fun server (ch: chan(rs1+rs2,rs2,helloworld)): void = let 
		val _ = println! (session_brecv<string> (ch, 1))
		val _ = session_bsend (ch, 2, "world1!")
		val _ = $extfcall(void, "sleep", 1)
		val _ = println! (session_brecv<string> (ch, 1))
		val _ = session_bsend (ch, 2, "world2!")
	in 
		session_wait (ch, 1)
	end

	val ch1 = session_fork (emp()+1, emp()+2, llam ch => client ch)
	val ch2 = session_fork (emp()+2, emp()+1, llam ch => server ch)
	val ch =  session_link (ch1, ch2)
	val _ = session_emp ch
in 
end

//local (**)

//#include "./examples/ex-queue.dats"
//#include "./examples/ex-cut-residual.dats"
//#include "./examples/ex-sieve.dats"
#include "./examples/ex-cloud.dats"

//in (**)

implement main0 () = let 
	val _ = setup ()
	val _ = test("Test Queue")
	val _ = $extfcall(void, "sleep", 2)
//	val _ = $extfcall(void, "g_states")
in 
	
end 

//end (**)