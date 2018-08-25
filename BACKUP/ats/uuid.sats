
absvtype uuid = ptr
typedef uuid_string = @[char][37]

fun uuid_generate (): uuid
fun uuid_equal    (!uuid, !uuid): bool
fun uuid_copy     (!uuid): uuid
fun uuid_free     (uuid): void

fun uuid_parse   (&uuid_string): uuid
fun uuid_unparse (!uuid, &uuid_string? >> _): void