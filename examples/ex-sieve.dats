//#include "share/atspre_staload.hats"
staload "../frontend/libsession.sats"
staload "../frontend/set.sats"

#define C 1
#define S 0

#define Crs (emp+C)
#define Srs (emp+S)
#define Frs (emp+C+S)

stadef ints = pfix(lam p => pbranch(C,pbmsg(S,int)::p, pend(C)))

extern fun from   (int): chan(Frs,Crs,ints)
extern fun filter (chan(Frs,Crs,ints), int -<cloref1> bool): chan(Frs,Crs,ints)
extern fun sieve  (chan(Frs,Crs,ints)): chan(Frs,Crs,ints)

implement from (n) = let 
	fun server (ch:chan(Frs,Srs,ints), n:int): void = let 
		prval _ = session_unroll ch 
		val choice = session_offer ch 
	in 
		case+ choice of 
		| ~Left()  => (session_bsend (ch, n); server (ch, n+1))
		| ~Right() => session_wait ch
	end
in 
	session_fork (emp()+S, emp()+C, llam ch => server (ch, n))
end

implement filter (inp, p) = let 
	fun get (inp: !chan(Frs,Crs,ints)): int = let 
		prval _ = session_unroll inp 
		val _ = session_choose (inp, Left ())
		val n = session_brecv inp 
	in 
		if p n
		then n 
		else get inp 
	end 

	fun server (out: chan(Frs,Srs,ints), inp: chan(Frs,Crs,ints)): void = let 
		prval _ = session_unroll out 
		val c = session_offer out 
	in 
		case+ c of 
		| ~Left()  => (session_bsend (out, get inp); server (out, inp))
		| ~Right() => 
			let 
				val _ = session_wait out
				prval _ = session_unroll inp 
				val _ = session_choose (inp, Right())
			in 
				session_close inp
			end
	end 
in 
	session_fork (emp()+S, emp()+C, llam out => server (out, inp))
end

implement sieve (inp) = let 
	fun server (out: chan(Frs,Srs,ints), inp: chan(Frs,Crs,ints)): void = let 
		prval _ = session_unroll out
		val c = session_offer out 
	in 
		case+ c of 
		| ~Right() => 
			let 
				prval _ = session_unroll inp
				val _ = session_choose (inp, Right())
				val _ = session_close inp
			in 
				session_wait out
			end
		| ~Left() => 
			let 
				prval _ = session_unroll inp 
				val _ = session_choose (inp, Left())
				val n = session_brecv inp 
				val _ = session_bsend (out, n)
			in 
				server (out, filter (inp, lam p => p mod n > 0))
			end 
	end 
in 
	session_fork (emp()+S, emp()+C, llam out => server (out, inp))
end

extern fun test (string): void
implement test (msg) = let 
	val _ = println! msg 
	val ch = sieve (from 2)

	fun loop (ch: chan(Frs,Crs,ints), n:int): void = 
		if n <= 0
		then 
			let 
				prval _ = session_unroll ch 
				val _ = session_choose (ch, Right())
			in 
				session_close ch 
			end 
		else 
			let 
				prval _ = session_unroll ch 
				val _ = session_choose (ch, Left())
				val _ = println! (session_brecv ch)
			in 
				loop (ch, n-1)
			end 
in 
	loop (ch, 20)
end
