#define ATS_DYNLOADFLAG 0

staload "./json.sats"

local (*********************)

#include "share/atspre_staload.hats"
staload JSON = "contrib/atscntrb/atscntrb-hx-libjansson/SATS/jansson.sats"
staload _    = "contrib/atscntrb/atscntrb-hx-libjansson/DATS/jansson.dats"
staload UN   = "prelude/SATS/unsafe.sats"

macdef JSON_DECODE_ANY = $extval (int, "JSON_DECODE_ANY")

assume json = $JSON.JSONptr1

in    (*********************)

implement json_loads (str) = let 
	var err: $JSON.json_error_t 
	val json = $JSON.json_loads ($UN.strptr2string str, JSON_DECODE_ANY, err)
	val _ = assert_errmsg ($JSON.JSONptr_isnot_null json, "json_loads failed.")
in 
	json 
end

implement json_loadb {n} {l} (pf | buf, size) = let 
	var err: $JSON.json_error_t
	val json = $JSON.json_loadb (pf | buf, i2sz size, JSON_DECODE_ANY, err)
	val _ = assert_errmsg ($JSON.JSONptr_isnot_null json, "json_loadb failed.")
in 
	json
end

implement json_dumps (json) = let 
	val str = $JSON.json_dumps (json, $JSON.JSON_ENCODE_ANY)
	val _   = assert_errmsg (isneqz str, "json_dump failed.")
	val _   = $JSON.json_decref json
in 
	str
end

implement json_free (json) = $JSON.json_decref json

implement to_json<string> (str) = let 
	val json = $JSON.json_string str
	val _    = assert_errmsg ($JSON.JSONptr_isnot_null json, "to_json<string> failed.")
in 
	json
end

implement from_json<cstring> (json) = let 
	val (pf | s) = $JSON.json_string_value json
	val str = copy s
	prval _ = minus_addback (pf, s | json)
in 
	str
end

end   (*********************)