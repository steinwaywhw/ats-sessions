"use strict"

const nanomsg  = require("nanomsg")
const assert   = require("assert")
const _        = require("./collection.js")
const util     = require('./util.js')
const recorder = require('./recorder.js')

class Transport {

	constructor() {

	}

	connect(address) {

	}

	disconnect(address) {

	}

	listen(address) {

	}

	close() {

	}

	send(msg) {

	}

	receive() {

	}

	toJSON() {

	}
}


class NanomsgTransport extends Transport {

	constructor(ep) {
		super()
		
		this.ep = ep

		this.sock = nanomsg.socket('bus')
		this.sock.setEncoding('utf8')

		// JS is single threaded. Safe to use just an array.
		this.buffer = [] 

		this.sock.on('data', msg => {
			msg = JSON.parse(msg)
			this.buffer.push(msg)

			// console.log(this.toJSON())
			recorder.log(this.ep)
		})

		this.quit = false
	}

	toJSON() {
		return {trans: this.buffer.map(m => m.label), ep: [this.ep.name, JSON.stringify(this.ep.roles)]}
	}

	connect(address) {
		this.sock.connect(address)
		assert(this.sock.connected[address] >= 0)
	}

	disconnect(address) {
		if (address in this.sock.connected) {
			this.sock.shutdown(this.sock.connected[address])
		}
	}

	listen(address) {
		this.sock.bind(address)
		assert(this.sock.bound[address] >= 0)
	}

	close() {
		this.sock.close()
	}

	send(msg) {
		const packet = JSON.stringify(msg)
		const sent = this.sock.send(packet)
		assert (sent == packet.length)

		console.debug(`Sent:     ${JSON.stringify(msg)}`)
	}

	cancel() {
		this.quit = true
	}

	resume() {
		this.quit = false
	}

	flush() {
		this.buffer.length = 0
	}

	async receive() {
		while (this.buffer.length == 0 && !this.quit) 
			await util.sleep(1)

		if (this.buffer.length == 0)
			throw new Error('Cancelled')
		else {
			const msg = this.buffer.shift()
			// console.log(this.toJSON())
			recorder.log(this.ep)
			// recorder.current()
			return msg
		}
	}
}

class NanomsgBroker {
	constructor(address) {
		this.sock = nanomsg.socket('bus', {raw: true})
		this.sock.bind(address)
		this.device = nanomsg.device(this.sock)

		// omit the error
		this.device.on('error', e => {})
	}

	close() {
		this.sock.close()
		this.sock   = null
		this.device = null
	}
}

module.exports = {
	Nanomsg       : ep   => new NanomsgTransport(ep),
	NanomsgBroker : addr => new NanomsgBroker(addr)
}