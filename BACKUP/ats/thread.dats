#define ATS_DYNLOADFLAG 0

%{^
#include <pthread.h>
%}

staload "./thread.sats"

local 

#include "share/atspre_staload.hats"

abst@ype pthread_t = $extype "pthread_t"
assume tid = pthread_t

in 

implement thread_self () = 
	$extfcall (tid, "pthread_self")

implement thread_spawn (f) = let 
	staload UN = "prelude/SATS/unsafe.sats"

	fun apply (f: () -<lincloptr1> void): ptr = let 
		val _ = f ()
		val _ = cloptr_free ($UN.castvwtp0{cloptr0} f)
	in 
		the_null_ptr
	end
	
	extern fun pthread_create (&pthread_t? >> _, 
							   int, 
							   (()-<lincloptr1> void) -> ptr, 
							   () -<lincloptr1> void): int = "mac#pthread_create"
	var tid: tid
	val g = $UN.castvwtp1{cloptr0} f
	val ret = pthread_create (tid, 0, apply, f)
in 
	if ret != 0
	then let 
			val _ = cloptr_free ($UN.castvwtp0{cloptr0} g)
			val _ = assert_errmsg (ret = 0, "thread_spawn_env: failed")
		 in tid end
	else let 
			val _ = $UN.castvwtp0{void} g
		 in tid end
end

implement thread_join (tid) = let 
	val ret = $extfcall (int, "pthread_join", tid, 0)
in 
	assert_errmsg (ret = 0, "thread_join failed.")
end

end