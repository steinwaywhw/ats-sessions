
module.exports = {
	"A": { roles: [1], types: "send send recv 4 recv 5"},
	"B": { roles: [2], types: "recv 1 recv 1 recv 4 recv 5"},
	"C": { roles: [3,4,5], types: "recv 1 recv 1 send send"}
	// "a": { roles: [3], types: "recv 1 recv 1 recv 4 recv 5"},
	// "b": { roles: [4], types: "recv 1 recv 1 send recv 5"},
	// "c": { roles: [1,2,5], types: "send send recv 4"}
}