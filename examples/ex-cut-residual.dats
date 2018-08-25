

/**
 *
 *  This is a complicated multiparty session where all boards are busy. 
 *  In a binary case, there must be one board that is completely blocked and no new 
 *  message can write into the board. That's not the case here for MPST.  
 *  
 *  0, 1, 23456 <-> 012, 3, 456 <-> 01234, 5, 6
 *  => 
 *  0, 1, 2, 3, 4, 5, 6
 *
 *  Hanwen
 *  Aug 2018
 */


stadef ss = pmsg(0,1,string)::
			pmsg(0,2,string)::
			pmsg(0,4,string)::
			pmsg(0,5,string)::
			pmsg(6,1,string)::
			pmsg(6,2,string)::
			pmsg(6,4,string)::
			pmsg(6,5,string)::
			pmsg(3,0,string)::
			pmsg(3,1,string)::
			pmsg(3,2,string)::
			pmsg(3,4,string)::
			pmsg(3,5,string)::
			pmsg(3,6,string)::
			pend(3)

stadef full = emp+0+1+2+3+4+5+6

vtypedef chan (rs:set) = chan(emp+0+1+2+3+4+5+6, rs, ss)

extern fun p0 (chan(emp+0)): void
extern fun p1 (chan(emp+1)): void
extern fun p2 (chan(emp+2)): void
extern fun p3 (chan(emp+3)): void
extern fun p4 (chan(emp+4)): void
extern fun p5 (chan(emp+5)): void
extern fun p6 (chan(emp+6)): void

extern fun test (string): void

implement test (msg) = let 
	val _ = println! msg 

	val board = board_make "A"
	val ch0 = session_make<board> {pinit(2)::ss} (emp()+0+1+2+3+4+5+6, emp()+0, board)
	val ch1 = session_make<board> {pinit(2)::ss} (emp()+0+1+2+3+4+5+6, emp()+1, board)
	val ch23456 = session_make<board> {pinit(2)::ss} (emp()+0+1+2+3+4+5+6, emp()+2+3+4+5+6, board)
	val _ = board_free board 

	val board = board_make "B"
	val ch012 = session_make<board> {pinit(4)::ss} (emp()+0+1+2+3+4+5+6, emp()+0+1+2, board)
	val ch3   = session_make<board> {pinit(4)::ss} (emp()+0+1+2+3+4+5+6, emp()+3, board)
	val ch456 = session_make<board> {pinit(4)::ss} (emp()+0+1+2+3+4+5+6, emp()+4+5+6, board)
	val _ = board_free board 

	val board = board_make "C"
	val ch01234 = session_make<board> {pinit(4)::ss} (emp()+0+1+2+3+4+5+6, emp()+0+1+2+3+4, board)
	val ch5 = session_make<board> {pinit(4)::ss} (emp()+0+1+2+3+4+5+6, emp()+5, board)
	val ch6 = session_make<board> {pinit(4)::ss} (emp()+0+1+2+3+4+5+6, emp()+6, board)
	val _ = board_free board 

	val _ = session_request (ch0, 2, llam ch => p0 ch)
	val _ = session_request (ch1, 2, llam ch => p1 ch)
	val _ = session_accept ch23456

	val _ = session_request (ch3, 4, llam ch => p3 ch)
	val _ = session_request (ch5, 4, llam ch => p5 ch)
	val _ = session_request (ch6, 4, llam ch => p6 ch)

	val _ = session_request (ch012, 4, llam ch => p2 (session_link (ch, ch23456)))
		
	val _ = session_accept ch01234
	val _ = session_accept ch456
in 
	p4 (session_link (ch456, ch01234))
end 






implement p0 (ch) = let 
	val _ = session_send (ch, 1, "0->1")
	val _ = session_send (ch, 2, "0->2")
	val _ = session_send (ch, 4, "0->4")
	val _ = session_send (ch, 5, "0->5")
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 3))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
in 
	session_wait (ch, 3)
end

implement p1 (ch) = let 
	val _ = println! (session_recv<string> (ch, 0))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 6))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 3))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
in 
	session_wait (ch, 3)
end

implement p2 (ch) = let 
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 0))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 6))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 3))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
in 
	session_wait (ch, 3)
end

implement p3 (ch) = let 
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = session_send (ch, 0, "3->0")
	val _ = session_send (ch, 1, "3->1")
	val _ = session_send (ch, 2, "3->2")
	val _ = session_send (ch, 4, "3->4")
	val _ = session_send (ch, 5, "3->5")
	val _ = session_send (ch, 6, "3->6")
in 
	session_close ch
end

implement p4 (ch) = let 
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 0))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 6))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 3))
	prval _ = session_skip ch
	prval _ = session_skip ch
in 
	session_wait (ch, 3)
end

implement p5 (ch) = let 
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 0))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 6))
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 3))
	prval _ = session_skip ch
in 
	session_wait (ch, 3)
end

implement p6 (ch) = let 
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = session_send (ch, 1, "6->1")
	val _ = session_send (ch, 2, "6->2")
	val _ = session_send (ch, 4, "6->4")
	val _ = session_send (ch, 5, "6->5")
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	prval _ = session_skip ch
	val _ = println! (session_recv<string> (ch, 3))
in 
	session_wait (ch, 3)
end