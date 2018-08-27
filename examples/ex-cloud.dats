
//staload "set.sats"
//staload "libsession.sats"
//staload "blackboard.sats"
staload UN = "prelude/SATS/unsafe.sats"


#define C 0 // Cloud 
#define S 1 // Services Provider 
#define U 2 // Service User

stadef full = emp+0+1+2
stadef SC   = emp+S+C
stadef UC   = emp+U+C 

vtypedef chanS (p:stype) = chan(full, emp+S, p)
vtypedef chanC (p:stype) = chan(full, emp+C, p)
vtypedef chanU (p:stype) = chan(full, emp+U, p)

stadef ints   = pfix(lam p => pbranch(S,pmsg(C,S,int)::p, pend(S)))
stadef primes = pfix(lam p => pbranch(U,pmsg(C,U,int)::p, pend(U))) 

vtypedef cloudfn (p:stype) = (chan(SC,emp+S,ints), chan(full,emp+C,p)) -<lincloptr1> void
stadef cloud = pquan2(S, lam p => pmsg(S,C,cloudfn(p)) :: p)


extern fun cloud             (chan(full,emp+C,cloud)): void
extern fun primes            (chan(SC,emp+S,ints), chan(full,emp+C,primes)): void
extern fun service {p:stype} (chan(full,emp+S+U,cloud), cloudfn p, chan(full,emp+S,p)->void): chan(full,emp+U,p)
extern fun primeuser         (chan(full,emp+U,primes)): void

implement cloud (chC) = let 
	val [p:stype] chC = session_exify2 chC
	val f = session_recv<cloudfn(p)> (chC, S, C)

	fun from (n: int): chan(SC,emp+S,ints) = let 
		fun server (ch:chan(SC,emp+C,ints), n:int): void = let 
			prval _ = session_unroll ch 
			val choice = session_offer (ch, S) 
		in 
			case+ choice of 
			| ~Left()  => (session_send (ch, C, S, n); server (ch, n+1))
			| ~Right() => session_wait (ch, S)
		end
	in 
		session_fork (emp()+C, emp()+S, llam ch => server (ch, n))
	end

	val _ = f (from 2, chC) 
	val _ = $UN.castvwtp0{void} f
in 
end


implement primes (chS, chC) = let 
	fun filter (inp: chan(SC,emp+S,ints), p: int -<cloref1> bool): chan(SC,emp+S,ints) = let 
		fun get (inp: !chan(SC,emp+S,ints)): int = let 
			prval _ = session_unroll inp 
			val _ = session_choose (inp, S, Left ())
			val n = session_recv (inp, C, S) 
		in 
			if p n
			then n 
			else get inp 
		end 

		fun server (out: chan(SC,emp+C,ints), inp: chan(SC,emp+S,ints)): void = let 
			prval _ = session_unroll out 
			val c = session_offer (out, S)
		in 
			case+ c of 
			| ~Left()  => (session_send (out, C, S, get inp); server (out, inp))
			| ~Right() => 
				let 
					val _ = session_wait (out, S)
					prval _ = session_unroll inp 
					val _ = session_choose (inp, S, Right())
				in 
					session_close (inp, S)
				end
		end 
	in 
		session_fork (emp()+C, emp()+S, llam out => server (out, inp))
	end

	fun sieve (out: chanC(primes), inp: chan(SC,emp+S,ints)): void = let 
		prval _ = session_unroll out
		val c = session_offer (out, U) 
	in 
		case+ c of 
		| ~Right() => 
			let 
				prval _ = session_unroll inp
				val _ = session_choose (inp, S, Right())
				val _ = session_close (inp, S)
			in 
				session_wait (out, U)
			end
		| ~Left() => 
			let 
				prval _ = session_unroll inp 
				val _ = session_choose (inp, S, Left())
				val n = session_recv (inp, C, S) 
				val _ = session_send (out, C, U, n)
			in 
				sieve (out, filter (inp, lam p => p mod n > 0))
			end 
	end 

in 
	sieve (chC, chS)
end


implement service {p} (chSU, f, dummy) = let 
	val chSU = session_unify2 chSU
	val _ = session_send (chSU, S, C, llam (chIn, chOut) => let val _ = f (chIn, chOut) in $UN.castvwtp0{void} f end)
	val _ = session_split {full,emp+U,emp+S} {p} (emp()+U, emp()+S, chSU, llam chS => dummy chS)
in 
	chSU
end


implement primeuser (chU) = let 
	fun loop (ch: chanU(primes), n:int): void = 
		if n <= 0
		then 
			let 
				prval _ = session_unroll ch 
				val _ = session_choose (ch, U, Right())
			in 
				session_close (ch, U) 
			end 
		else 
			let 
				prval _ = session_unroll ch 
				val _ = session_choose (ch, U, Left())
				val _ = println! (session_recv (ch, C, U))
			in 
				loop (ch, n-1)
			end 
in 
	loop (chU, 5)
end


extern fun test (string): void
implement test (msg) = let 
	val _ = println! msg

	fun dummyPrimes (chS: chanS(primes)): void = let 
		prval _ = session_unroll chS 
		val c = session_offer (chS, U)
	in 
		case+ c of 
		| ~Left()  => let prval _ = session_skip chS in dummyPrimes chS end
		| ~Right() => session_wait (chS, U)
	end

	val board = board_make "A"
	val chC  = session_make<board> {pinit(U)::cloud} (emp()+S+C+U, emp()+C,   board)
	val chSU = session_make<board> {pinit(U)::cloud} (emp()+S+C+U, emp()+S+U, board)
	val _ = board_free board

	val _ = session_request (chC, U, llam chC => cloud chC)
	val _ = session_accept (chSU, U)
	val chU = service {primes} (chSU, llam (inp, out) => primes (inp, out), dummyPrimes)
in 
	primeuser chU
end