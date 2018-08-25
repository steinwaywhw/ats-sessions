//staload "./endpoint.sats"
//staload "./mailbox.sats"
//staload "./socket.sats"
//staload "./thread.sats"
//staload "./payload.sats"
//staload "./uuid.sats"


//assume endpoint = $rec{sock=socket, mbox=mailbox, self=set(roles), id=uuid, rtstype=}


//datatype epcommand = 
//| EPInit 
//| EPSend
//| EPRecv
//| EPLink
//| EPClose

//implement {} endpoint_create (socket) = let 
//	val mailbox = mailbox_create ()
//	val uuid = uuid ()

////	fun endpoint_loop ():<cloref1> = let 
////		val _ = mailbox_get

////	in 
////		endpoint_loop ()
////	end
//in 
//	$rec{sock=socket, mbox=mailbox, self=emp, id=uuid}
//end



//implement {a} endpoint_send (!ep, payload) = let 
//	val payload = payload_encode<$tup{uuid,payload(a)}> ($tup(ep.id, payload))
//	val _ = sock_send (ep.sock, payload)
//	val _ = mbox_put (ep.mbox, payload)
//in 
//end 

//implement {a} endpoint_receive (!ep) = let 
//	val payload = sock_receive (ep.sock)
//	val $tup(uuid, payload) = payload_decode<$tup{uuid,payload(a)}> (payload)
//	val 

