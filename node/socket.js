"use strict"

let nanomsg = require("nanomsg")

class Socket {
	constructor(proto) {
		this.sock = nanomsg.socket(proto)
		this.sock.setEncoding("utf8")
		this.handler = null
	}

	bind(addr) {
		try {
			this.sock.bind(addr)
		} catch(e) {
			console.log(e)
		}
	}

	connect(addr) {
		try {
			this.sock.connect(addr)
		} catch(e) {
			console.log(e)
		}
	}

	close() {
		this.sock.close()
	}

	set onmessage(handler) {
		this.sock.removeAllListeners("data")
		this.handler = handler
		this.sock.on("data", msg => {
			console.log(`recv: ${msg}`)
			this.handler(JSON.parse(msg))
		})
	}

	get onmessage() {
		return this.handler
	}

	send(payload) {
		console.log(`send: ${JSON.stringify(payload)}`)
		this.sock.send(JSON.stringify(payload))
	}
}

module.exports = Socket