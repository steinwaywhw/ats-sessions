"use strict"

const Endpoint = require('./endpoint.js')


class Session {
	constructor(name, protocol, roles) {
		this.name     = name 
		this.protocol = protocol
		this.roles    = new Set(roles)
		this.full     = null 
		this.ep       = new Endpoint(name, roles)
	}

	async request(address) {
		await this.ep.request(address)
		this.state = 'ready'
	}

	async accept(address, full) {
		this.full = new Set(full)
		await this.ep.accept(address, full)
		this.state = 'ready'
	}

	send(sender, receivers, payload) {
		assert(typeof(sender) === 'number')
		assert(this.roles.has(sender))
		assert(Array.isArray(receivers))
		assert(receivers.every(r => this.full.has(r)))

		const msg = new Msg('msg', [sender], (new Set(receivers)).toJSON(), payload)
		this.ep.send(this.ep.encode(msg))
	}

	async receive(sender) {
		assert(typeof(sender) === 'number')

		const msg = await ep.receive([util.pattern('msg', sender, null),
				 				      util.pattern('link', null, null)])

		if (msg.label == 'msg')
			return msg

		assert(msg.label == 'link')

		this.ep.onlink(msg)
	}



}