"use strict"

let nanomsg = require("nanomsg")
let Socket = require("./socket.js")
let uuidv4 = require("uuid/v4")
let Msg = require("./msg.js")

let sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class MailboxWorker {
    constructor(addr) {
        this.mbox = []
        // setInterval(() => console.log(this.mbox), 1000)
        this.sock = new Socket("pair")
        this.sock.connect(addr)
        this.sock.onmessage = msg => this.dispatch(msg)
    }
    
    on_put(msg) {
        this.mbox.push(msg.payload)
    }

    async on_get() {
        while (this.mbox.length == 0) {
            await sleep(1)
        }
        return this.mbox.shift()
    }

    async on_match(msg) {
        let label  = msg.payload.label,
            sender = msg.payload.sender

        while (true) {
            let index = this.mbox.findIndex(m => m.label == label && m.sender == sender)
            while (index < 0) {
                await sleep(1)
                index = this.mbox.findIndex(m => m.label == label && m.sender == sender)
            }
            return this.mbox.splice(index, 1)[0]
        }
    }

    on_close() {
        delete this.mbox
        this.sock.close()
    }

    async dispatch(msg) {
        switch (msg.label) {
            case "put":
                this.on_put(msg)
                break
            case "get":
                this.sock.send(await this.on_get())
                break
            case "match":
                this.sock.send(await this.on_match(msg))
                break
            case "close":
                this.on_close()
                break
            case "length":
                this.sock.send(this.mbox.length)
        }
    }
}


class Mailbox {
	constructor() {
		let addr = `inproc://${uuidv4()}`

		this.sock = new Socket("pair")
		this.sock.bind(addr)

		this.worker = new MailboxWorker(addr)
	}

	put(msg) {
		this.sock.send(new Msg("put", null, msg))
	}

	get() {
		let request = new Promise((resolve, reject) => {
			this.sock.onmessage = msg => resolve(msg)
			this.sock.send(new Msg("get", null, null))
		})

		return request
	}

	match(label, sender) {
		let request = new Promise((resolve, reject) => {
			this.sock.onmessage = msg => resolve(msg)
			this.sock.send(new Msg("match", null, {label:label, sender:sender}))
		})

		return request
	}

	close() {
		this.sock.send(new Msg("close", null, null))
		this.sock.close()
	}

    isempty() {
        return new Promise((resolve, reject) => {
            this.sock.onmessage = msg => resolve(msg == 0)
            this.sock.send(new Msg("length", null, null))            
        })
    }
}

module.exports = Mailbox


