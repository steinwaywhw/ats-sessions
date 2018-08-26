staload "./endpoint.sats"

assume endpoint (redis) = $rec{id=string, roles=roleset}

implement endpt_make<redis> (id, roles) = 
	$rec{id=id, roles=roles}

//implememt endpt_free<redis> (ep) = 

implement endpt_accept<redis> (ep, addr) = let 

in 
end
