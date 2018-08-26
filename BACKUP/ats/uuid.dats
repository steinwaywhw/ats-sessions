#define ATS_DYNLOADFLAG 0
staload "./uuid.sats"

local (*************************)

%{^
#include <uuid/uuid.h>
#include <stdlib.h>
%}

%{

unsigned char* uuid_alloc() {
	unsigned char* ptr = (unsigned char*)malloc(sizeof(uuid_t));
	return ptr;
}

void uuid_free(uuid_t ptr) {
	free(ptr);
}

%}

#include "share/atspre_staload.hats"

//typedef uuid_t = @[byte][16]

(* unsafe types for linux uuid api *)
extern fun _generate (!uuid): void = "mac#uuid_generate"
extern fun _copy     (!uuid, !uuid): void = "mac#uuid_copy"
extern fun _parse    (&uuid_string, !uuid): int = "mac#uuid_parse" 
extern fun _unparse  (!uuid, &uuid_string? >> _): void = "mac#uuid_unparse"

extern fun uuid_alloc (): uuid
implement uuid_alloc () = let 
	val uuid = $extfcall (uuid, "uuid_alloc")
	val _ = assert_errmsg ($UNSAFE.castvwtp1{ptr} (uuid) > the_null_ptr, "uuid_generate failed.")
in 
	uuid 
end

in    (*************************)

implement uuid_generate () = let 
	val uuid = uuid_alloc ()
	val _ = _generate uuid
in
	uuid 
end

implement uuid_copy (src) = let 
	val target = uuid_alloc ()
	val _ = _copy (target, src)
in 
	target 
end

implement uuid_equal (a, b) = let
	extern fun uuid_compare (!uuid, !uuid): int = "mac#uuid_compare"
in 
	uuid_compare (a, b) = 0
end

implement uuid_free (uuid) = 
	$extfcall (void, "uuid_free", $UNSAFE.castvwtp0{ptr} uuid)

implement uuid_parse (buf) = let 
	val uuid = uuid_alloc ()
	val ret = _parse (buf, uuid)
	val _ = assert_errmsg (ret = 0, "uuid_parse failed.")
in 
	uuid
end

implement uuid_unparse (uuid, buf) = _unparse (uuid, buf) 

end   (*************************)