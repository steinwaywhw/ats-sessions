"use strict"

const assert   = require('assert')

const Endpoint = require('./endpoint.js')
const _        = require('./collection.js')
const Msg      = require('./msg.js')
const util     = require('./util.js')

class Session {
	constructor(name, protocol, roles) {
		this.name     = name 
		this.protocol = protocol
		this.roles    = new Set(roles)
		this.full     = null 
		this.ep       = new Endpoint(name, this.roles)
	}

	async request(address) {
		this.ep.state = 'init'
		await this.ep.request(address)
		this.full = new Set(this.ep.peers.keys())
		this.ep.state = 'ready'
	}

	async accept(address, full) {
		this.ep.state = 'init'
		this.full = new Set(full)
		await this.ep.accept(address, full)
		this.ep.state = 'ready'
	}

	send(sender, receivers, payload) {
		this.ep.state = 'sending'
		assert(typeof(sender) === 'number')
		assert(this.roles.has(sender))
		assert(Array.isArray(receivers))
		assert(receivers.every(r => this.full.has(r)))

		const msg = new Msg('msg', [sender], (new Set(receivers)).toJSON(), payload)
		this.ep.send(this.ep.encodeMsg(msg))
		this.ep.state = 'ready'
	}

	async receive(sender) {
		assert(typeof(sender) === 'number')

		const oldstate = this.ep.state 
		this.ep.state = 'receiving'
		
		while (true) {
			// Match session-level 'msg' before endpoint-level 'link'.
			const patterns = [...this.ep.encodePatterns([util.pattern('msg', sender, null)]),
					 		  util.pattern('link', null, null)]

			const msg = await this.ep.receive(patterns)

			if (msg.label == 'msg')
				return this.ep.decodeMsg(msg).payload

			assert(msg.label == 'link')
			await this.ep._asleaf(msg)
		}
	}

	close() {
		this.ep.close()
	}

	// async sync(label, msg) {
		// const sync = await this.ep.sync(label, this.full, {msg: this.ep.encodeMsg(msg)})
		// return sync.map(msg => this.ep.decodeMsg(msg))
	// }

	static async link(s1, s2) {
		assert(s1.protocol == s2.protocol)
		assert(s1.full.equal(s2.full))
		assert(Set.union(s1.roles, s2.roles).isSupersetOf(s1.full))

		s1.ep.state = 'linking'
		s2.ep.state = 'linking'

		const [keepep, killep] = await Endpoint.link(s1.ep, s2.ep)
		const [keep, kill] = keepep.id == s1.ep.id ? [s1, s2] : [s2, s1]

		keep.ep.state = 'ready'
		keep.roles = keep.ep.roles

		kill.close()
		return [keep, kill]
	}
}

module.exports = Session