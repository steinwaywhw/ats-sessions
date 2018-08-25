staload "./rtsession.sats"
staload "./endpoint.sats"

vtypedef msg (a:vt@ype) = $rec{from=role, to=roleset, label=string, payload=a}

datavtype _rtsession = RTSession of (roleset, rtstype, endpoint)
assume rtsession = _rtsession

implement {a} rtsession_send (s, proof, payload) = let 
	val @RTSession (roles, stype, ep) = s
in 
	case+ stype of 
	| Seq (Msg (from, to, rtti), s) when mem(roles, from) andalso not(mem(roles, to)) andalso proof = rtti =>
		let
			val msg = $rec{from=from, to=to, label="msg", payload=payload} : msg
			val _ = endpt_send (ep, msg) 
			val _ = stype := s
		in 
			fold@ s
		end

	| _ =>> assertloc ("Type Error!")
end 

implement {a} rtsession_recv (s, proof) = let 
	val @RTSession (roles, stype, ep) = s
in 
	case+ stype of 
	| Seq (Msg (from, to, rtti), s) when not(mem(roles, from)) andalso mem(roles, to) andalso proof = rtti =>
		let
			val msg =  : msg
			val $rec{from=from, to=to, label="msg", payload=payload} = endpt_recv (ep) : msg 
			val _ = stype := s
		in 
			fold@ s
		end

	| _ =>> assertloc ("Type Error!")
end 