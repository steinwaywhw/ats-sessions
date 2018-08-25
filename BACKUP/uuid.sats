
abstype uuid


fun uuid (): uuid

fun print_uuid (uuid): void 
fun eq_uuid_uuid (uuid, uuid): bool

overload print with print_uuid
overload =     with eq_uuid_uuid