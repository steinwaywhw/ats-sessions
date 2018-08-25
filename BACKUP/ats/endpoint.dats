#define ATS_DYNLOADFLAG 0

staload "./endpoint.sats"


local (************************)

#include "share/atspre_staload_libats_ML.hats"

typedef list (a:t@ype) = list0 a
typedef peer = (string (* uuid *), int (* role *))

datavtype ep_t (t:transport) = Ep of (transport t, 
	 						   		  set int (* full *), set int (* self *), 
	 						   		  uuid (* session *), uuid (* self *),
	 						  		  list peer)


assume endpoint = [t:transport] ep_t t

in    (************************)


implement ep_request (ep) = let 
	val @Ep (trans, full, self, idss, idself, peers) = ep 
	


	val _ = fold@ep
in 
end


end   (************************)