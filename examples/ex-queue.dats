//#include "share/atspre_staload.hats"
staload "../frontend/libsession.sats"
staload "../frontend/set.sats"

#define C 1
#define S 0

#define Crs emp+C 
#define Srs emp+S 
#define Frs emp+C+S

stadef queue (a:t@ype) = pfix (lam p => pbranch(C,pbmsg(C,a)::p,popt(S,pbmsg(S,a)::p)))

extern fun empty {a:t@ype} (): chan(Frs,Crs,queue(a))
extern fun elem  {a:t@ype} (chan(Frs,Crs,queue(a)), a): chan(Frs,Crs,queue(a))

extern fun {a:t@ype} enq  (!chan(Frs,Crs,queue(a)), a): void 
extern fun {a:t@ype} free (chan(Frs,Crs,queue(a))): void

implement empty {a} () = let 
	fun server (left: chan(Frs,Srs,queue(a))): void = let 
		prval _ = session_unroll left 
		val c = session_offer left 
	in 
		case+ c of 
		| ~Right() => (session_choose (left, Right()); session_close left)
		| ~Left()  => 
			let 
				val x = session_brecv left 
				val right = elem {a} (empty {a} (), x)
			in 
				session_emp (session_link (right, left))
			end
	end 
in 
	session_fork (emp()+S, emp()+C, llam left => server left)
end

implement elem {a} (right, x) = let 
	fun server (left: chan(Frs,Srs,queue(a)), right: chan(Frs,Crs,queue(a))): void = let 
		prval _ = session_unroll left 
		val c = session_offer left 
	in 	
		case+ c of 
		| ~Left() => 
			let 
				val y = session_brecv left 
				prval _ = session_unroll right 
				val _ = session_choose (right, Left())
				val _ = session_bsend (right, y)
			in 
				server (left, right)
			end 
		| ~Right() => 
			let
				val _ = session_choose (left, Left())
				val _ = session_bsend (left, x)
			in 
				session_emp (session_link (left, right))
			end 
	end 
in 
	session_fork (emp()+S, emp()+C, llam left => server (left, right))
end

implement {a} enq (ch, x) = let 
	prval _ = session_unroll ch 
	val _ = session_choose (ch, Left())
	val _ = session_bsend (ch, x)
in 
end 

implement free<int> (ch) = let 
	prval _ = session_unroll ch 
	val _ = session_choose (ch, Right())
	val c = session_offer ch 
in 
	case+ c of 
	| ~Right() => (println! ("nil"); session_wait ch)
	| ~Left()  => (println! (session_brecv ch); free<int> ch)
end

extern fun test (string): void 
implement test (msg) = let 
	val _ = println! msg 

	val queue = empty {int} ()
	val _ = (enq<int>(queue,1); enq<int>(queue,2); enq<int>(queue,3))
    val _ = (enq<int>(queue,4); enq<int>(queue,5); enq<int>(queue,6))
    val _ = (enq<int>(queue,7); enq<int>(queue,8); enq<int>(queue,9))
in 
	free<int> queue 
end