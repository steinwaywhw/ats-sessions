"use strict"

let Socket = require("./socket.js")
let Endpoint = require("./endpoint.js")
let Msg = require("./msg.js")


async function main() {
	let socket = new Socket("bus")
	socket.bind("ws://127.0.0.1:440")
	let ep = new Endpoint(socket, [2,3])
	await ep.init([1,2,3])
	let msg = await ep.receive(1)
	let msg2 = await ep.receive(1)
	ep.send("world")
	ep.close()
}

// main()









let nanomsg = require("nanomsg")
let config  = require("./config.js")

async function test(proc) {

	console.log(`${proc} started`)
	let socket = new Socket("bus")

	socket.bind(`ipc:///tmp/test${proc}.ipc`)
	Object.keys(config).forEach(p => p != proc ? socket.connect("ipc:///tmp/test${p}.ipc") : "")

	let ep = new Endpoint(socket, config[proc].roles)
	await ep.init([1,2,3,4,5])

	let type = config[proc].types.split(" ")
	for (index in type) {
		switch (type[index]) {
		case "send":
			ep.send(`sent from ${proc}`)
			break 
		case "recv":
			let reply = await ep.receive(type[index+1])
			console.log(`${proc} received a msg ${reply}`)
			break 
		}
	}

	ep.close()
}


test(process.argv[2])


