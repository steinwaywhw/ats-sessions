

abstype address


fun addr_make (string): addres s 

fun print_addr (address): void 
fun eq_addr_addr (address, address): bool
overload print with print_addr 
overload =     with eq_addr_addr