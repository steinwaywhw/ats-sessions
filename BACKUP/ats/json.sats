/*
 *  Simple interface for converting datatypes to json
 */

absvtype json

fun {a:vt@ype} to_json   (!a): json
fun {a:vt@ype} from_json (!json): a

vtypedef cstring = [l:addr|l>null] strptr l

fun json_loads (!cstring): json 
fun json_loadb {n:nat} {l:addr|l>null} (!(@[byte][n] @ l) | ptr l, int n): json
fun json_dumps (json): cstring
fun json_free  (json): void

