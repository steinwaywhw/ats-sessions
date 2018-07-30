"use strict"

const assert = require('assert')
const uuid   = require('uuid/v4')

const transport = require('./transport.js')
const _         = require('./collection.js')
const util      = require('./util.js')
const Msg       = require('./msg.js')
const recorder  = require('./recorder.js')


class Endpoint {
	constructor(name, roles) {
		this.name     = name
		this.id       = `${name}/${uuid()}`
		this.roles    = new Set(roles)

		/**
		 * A mapping from roles to endpoint id's
		 * @type {Map<Int, uuid>}
		 */
		this.peers    = new Map() 
		this.roles.forEach(r => this.peers.set(r, this.id))     

		/**
		 * State.
		 *
		 * 'init': Initiating a private session. Receving all possible messages on the network, no filtering.
		 * 'acp': Atomic committing protocol. Possibly changing peer maps. Can receive NoSenderCheck messages.
		 * 'ready': Only receive session-private messages.
		 * 
		 * @type {String}
		 */
		this.state    = 'init'
		this.trans    = transport.Nanomsg(this)
		this.broker   = null
		this.buffer   = []
	}

	toJSON() {
		return {
			id     : this.id,
			name   : this.name, 
			roles  : this.roles.toJSON(),
			peers  : this.peers.toJSON(),
			state  : this.state,
			buffer : this.buffer.map(m => JSON.stringify(m)),
			trans  : this.trans.toJSON()
		}
	}

	/**
	 * [accept description]
	 *
	 * 2PC transaction manager
	 *   
	 * @param  {[type]} address [description]
	 * @param  {[type]} full    [description]
	 * @return {[type]}         [description]
	 */
	async accept(address, full) {
		assert(this.state == 'init')
		this.trans.connect(address)

		// Stop receiving out-of-session messages.
		this.state = 'acp/vote'

		// 2PC: vote.
		const vote = new Msg('vote', this.roles, full, {name: this.name, id: this.id})
		const responses = await this.sync('yes', full, {msg: vote, repeat: true, layer: 'session'})

		this.state = 'acp/commit'

		// Update our peer map.
		responses.forEach(({sender, payload}) => sender.forEach(r => this.peers.set(r, payload)))

		// 2PC: commit.
		const commit = new Msg('commit', this.id, this.peers.uniquevalues(), this.peers)
		await this.sync('committed', this.peers.uniquevalues(), {msg: commit, layer: 'endpoint'})

		// Go.
		this.buffer.length = 0
		this.trans.flush()
		this.state = 'ready'
		this.trans.send(new Msg('go', this.id, this.peers.uniquevalues(), null))
	}

	/**
	 * [request description]
	 *
	 * 2PC follower.
	 *
	 * @param  {[type]} address [description]
	 * @return {[type]}         [description]
	 */
	async request(address) {
		assert(this.state == 'init')
		this.trans.connect(address)

		// 2PC-1: Wait for voting
		const req = await this.receive(util.pattern('vote', null, msg => msg.payload.name == this.name))

		// Stop receiving out-of-session messages.
		// But make sure we can communicate with the sender.
		req.sender.forEach(r => this.peers.set(r, req.payload.id))
		this.state = 'acp/yes'
		
		// 2PC-1: Vote.
		// The message need to skip sender check since the leader has no peer map yet.
		const yes = new Msg('yes', this.roles, req.sender, this.id, true)
		this.send(yes)

		// 2PC-2: Commit.
		const { payload } = await this._receive(util.pattern('commit', req.payload.id))
		this.peers = new Map(payload)
		this.buffer.length = 0
		this.trans.flush()

		this.state = 'acp/committed'

		const committed = new Msg('committed', this.id, req.payload.id, null)
		this.trans.send(committed)

		// Wait for 'go'
		await this._receive(util.pattern('go', req.payload.id))
		this.state = 'ready'
	}


	send(msg) {
		msg = this.encode(msg)
		this.trans.send(msg)
	}

	/**
	 * Session-level receive.
	 * @param  {[type]} labels  [description]
	 * @param  {[type]} senders [description]
	 * @return {[type]}         [description]
	 */
	async receive(patterns=[]) {		
		if (!Array.isArray(patterns)) 
			patterns = [patterns]
		if (patterns.length == 0) 
			patterns.push(util.pattern(null, null, null))

		const encode_one = ({label, sender, pred}) => {
			let uuid = this.peers.get(sender)
			if (!uuid) 
				uuid = null
			
			if (pred == null)
				pred = msg => true

			return util.pattern(label, uuid, msg => Msg.isMsg(this.decode(msg)) && pred(this.decode(msg)))
		}

		// Push the `link` pattern as the last one.
		patterns.push(util.pattern('link'))

		while (true) {
			const msg = this.decode(await this._receive(patterns.map(p => encode_one(p))))
			// Regular message, just return it.
			if (msg.label != 'link')
				return msg

			// Link message. 
			this.send(new Msg('yes', this.roles, msg.sender, null))
			await this._asleaf()
			// console.log("LINK FINISHED")

			recorder.log(this)
			recorder.current()
		}
	}

	/**
	 * Endpoint-layer receive. 
	 * 
	 * @param  {[type]} labels  [description]
	 * @param  {[type]} senders [description]
	 * @return {[type]}         [description]
	 */
	async _receive(patterns=[]) {

		const pred = util.preds(patterns)
		// console.log(patterns)

		// Receive and check.
		let index = this.buffer.findIndex(msg => pred(msg))
		while (index < 0) {
			const msg = await this.trans.receive()
			
			// In-session messages.
			if (msg.receivers.includes(this.id) && this.peers.hasvalue(msg.sender)) { this.buffer.push(msg) }

			// In-session before the acceptor has the peer map.
			else if (msg.receivers.includes(this.id) && Msg.skipSenderCheck(msg)) { this.buffer.push(msg) }

			// Init state, receive only the vote messages.
			else if (this.state == 'init' && msg.label == 'vote' && msg.payload.payload.name == this.name) { this.buffer.push(msg) }

			// Otherwise, the msg is discarded.
			else { continue }

			index = this.buffer.findIndex(msg => pred(msg))
		}

		// Delete and return.
		const [msg] = this.buffer.splice(index, 1)
		// console.debug(`Received: ${msg.label}`)
		return msg	
	}

	isempty() {
		let count = 0
		this.trans.buffer.forEach(msg => {
			if (msg.receivers.includes(this.id) && this.peers.hasvalue(msg.sender)) 
				count += 1
		})

		return this.buffer.length + count == 0
	}

	cancel() {
		this.trans.cancel()
	}

	resume() {
		this.trans.resume()
	}

	close() {
		this.trans.close()
	}

	/**
	 * Session-level forwarding. 
	 * 
	 * @param  {[type]} ep1 [description]
	 * @param  {[type]} ep2 [description]
	 * @return {[type]}     [description]
	 */
	static forward(ep1, ep2) {
		let forward = true

		const forward12 = new Promise(async (resolve, reject) => {
			while (forward) {
				setTimeout(() => ep1.cancel(), 100)
				try { ep2.send(await ep1.receive()) } catch(e) { ep1.resume() }
			}
			
			resolve()
		})	

		const forward21 = new Promise(async (resolve, reject) => {
			while (forward) {
				setTimeout(() => ep2.cancel(), 100)
				try { ep1.send(await ep2.receive()) } catch(e) { ep2.resume() }
			}
			
			resolve()
		})

		let stop = async () => {
			forward = false
			await Promise.all([forward12, forward21])
		}

		return stop
	}

	static async link(ep1, ep2, full) {

		this.state = 'link/block'

		ep1.receive(util.pattern('link')).then(msg => ep1.send('yes', ep1.roles, msg.sender, null))
		ep2.receive(util.pattern('link')).then(msg => ep2.send('yes', ep2.roles. msg.sender, null))

		// Make sure everyone is blocked.
		await ep1.sync('yes', full, {layer: 'session', msg: new Msg('link', ep1.roles, full, null)})
		await ep2.sync('yes', full, {layer: 'session', msg: new Msg('link', ep2.roles, full, null)})

		const [keep, kill] = !(ep1.isempty()) ? [ep1, ep2] : [ep2, ep1]

		// console.log('KEEP:')
		// console.log(keep.isempty())

		// console.log('KILL:')
		// console.log(kill.isempty())

		// recorder.current()

		assert(kill.isempty())

		// By LMRL, there will be exactly one `keep` whose mailbox is non-empty.
		// TODO: Prove this in the thesis.
		if (!keep.isempty()) {
			const forward = [] 
			while (!keep.isempty()) {
				forward.push(await keep.receive())
			}
			console.log('AS ROOT')
			await Endpoint._asroot(keep, kill, full, forward)
		} else {
			console.log('AS NODE')
			await Endpoint._asnode(keep, kill, full)
		}

		kill.close()
		return [keep, kill]
	}

	/**
	 * Nested 2PC, as Non-root Non-leaf Node.
	 * 
	 * @param  {[type]} keep [description]
	 * @param  {[type]} kill [description]
	 * @return {[type]}      [description]
	 */
	static async _asnode(keep, kill, full) {
		this.state = 'link/blocked'

		const newroles = Set.intersect(keep.roles, kill.roles)
		const newpeers = new Map()
		newroles.forEach(role => newpeers.set(role, keep.id))
		
		let parent, child
		let vote = null

		try {
			// Is this a bug? It doesn't work without this intermediate 'msg'
			let msg = await Promise.race([keep.receive(util.pattern('vote')),
			   		                      kill.receive(util.pattern('vote'))])
			vote = msg
			
			// Try to determin the parent side.
			[parent, child] = vote.sender.isSubsetOf(kill.roles) ? [keep, kill] : [kill, keep]
			assert(vote.sender.every(e => child.roles.has(e)))
			assert(vote.sender.every(e => !parent.roles.has(e)))

			// Unblock the child.
			child.cancel()
		} catch (e) {
			child.resume()
		}

		// Nested 2PC-1: Request votes from children.
		let yes = await child.sync('yes', full, {msg: new Msg('vote', child.roles, full, vote.payload), layer: 'session'})

		// Compute the new peer map.
		yes.forEach(({payload}) => newpeers.extend(new Map(payload)))

		// Nested 2PC-1: Vote to the parent.
		parent.send(new Msg('yes', parent.roles, vote.sender, newpeers))

		// Nested 2PC-2: Commit the children.
		const commit = await parent.receive(util.pattern('commit'))
		await child.sync('committed', full, {layer: 'session', msg: new Msg('commit', child.roles, full, commit.payload)})

		// Nested 2PC-2: Commit myself.
		const committed = parent.encode(new Msg('committed', parent.roles, vote.sender, null))
		keep.roles = newroles 
		keep.peers = newpeers

		// Nested 2PC-2: Committed.
		parent.trans.send(committed)

		// Go
		await keep._receive(util.pattern('go', vote.payload.id))
	}

	/**
	 * Nested 2PC, as Root.
	 * 
	 * @param  {[type]} keep [description]
	 * @param  {[type]} kill [description]
	 * @return {[type]}      [description]
	 */
	static async _asroot(keep, kill, full, forward) {

		keep.state = 'link/keep/vote'
		kill.state = 'link/kill/vote'

		const newroles = Set.intersect(keep.roles, kill.roles)
		const newpeers = new Map()
		newroles.forEach(role => newpeers.set(role, keep.id))

		// Nested 2PC-1: Voting.
		let y1 = await keep.sync('yes', full, {layer: 'session', msg: new Msg('vote', keep.roles, full, {id: keep.id})})
		let y2 = await kill.sync('yes', full, {layer: 'session', msg: new Msg('vote', kill.roles, full, {id: keep.id})})
		const yes = [...y1, ...y2]

		// Compute the new peer map.
		yes.forEach(({payload}) => newpeers.extend(new Map(payload)))

		// console.log(newpeers)

		// Nested 2PC-2: Commit.
		keep.state = 'link/keep/commit'
		kill.state = 'link/kill/commit'

		await kill.sync('committed', full, {layer: 'session', msg: new Msg('commit', kill.roles, full, newpeers)})
		await keep.sync('committed', full, {layer: 'session', msg: new Msg('commit', keep.roles, full, newpeers)})

		// Commit.	
		keep.peers = newpeers 
		keep.roles = newroles

		// Forward.
		forward.forEach(msg => {
			const packet = keep.encode(msg)
			packet.sender = keep.peers.get(msg.sender[0])
			keep.trans.send(packet)

			if (keep.roles.some(r => msg.receivers.includes(r)))
				keep.buffer.push(packet)
			
		})

		if (newroles.size == 0)
			keep.trans.send(new Msg('go', keep.id, newpeers.uniquevalues(), null, true))
		else 
			keep.trans.send(new Msg('go', keep.id, newpeers.uniquevalues(), null, false))

		keep.state = 'ready'
		kill.state = 'ready'
	}

	async _asleaf() {

		this.state = 'link/blocked'

		const vote = await this.receive(util.pattern('vote'))

		this.state = 'link/yes'

		// Nested 2PC-1: Vote.
		const peers = new Map()
		this.roles.forEach(role => peers.set(role, this.id))
		this.send(new Msg('yes', this.roles, vote.sender, peers))

		// 2PC-2: Commit.
		const { payload } = await this.receive(util.pattern('commit'))
		const committed = this.encode(new Msg('committed', this.roles, vote.sender, null))

		this.peers = new Map(payload)
		this.trans.send(committed)

		this.state = 'link/committed'

		// Go.
		await this._receive(util.pattern('go', vote.payload.id))

		this.state = 'ready'
	}


	/**
	 * This implements one round trip of a 2-phase commit.
	 * This is compatible with cross-session forwarding. 
	 * 
	 * @param  {String}                  label   The label of the expected reply message.
	 * @param  {Array<Int>|Array<uuid>}  full    Full set of roles/uuids. The set/array will be cloned upon invocation. 
	 * @param  {Object}                  opts    
	 * @return {Array<Msg>}   
	 */
	async sync(label, full, opts={msg: null, repeat: false, layer: 'session'}) {
		const {msg, repeat, layer} = opts
		const all = full.clone()

		// Send message first.
		let interval = null
		if (msg) 
			if (repeat)
				interval = setInterval(() => layer == 'session' ? this.send(msg) : this.trans.send(msg), 100)
			else
				layer == 'session' ? this.send(msg) : this.trans.send(msg)

		const responses   = []
		const respondents = layer == 'session' ? this.roles.clone() : new Set([this.id])

		switch (layer) {
		case 'session': 
			// Block until all roles have responded.
			while (!all.every((role) => respondents.has(role))) {
				let resp = await this.receive(util.pattern(label, null, null))
				if (respondents.some(r => resp.sender.includes(r)))
					continue

				responses.push(resp)
				respondents.union(resp.sender)
			}
			break
		case 'endpoint':
			// Block until all uuids have responded.
			while (!all.every((uuid) => respondents.has(uuid))) {
				let resp = await this._receive(util.pattern(label, null, null))
				if (respondents.has(resp.sender))
					continue

				responses.push(resp)
				respondents.add(resp.sender)
			}
			break
		default: 
			throw new Error(`Unexpected layer: ${layer}.`)
		}

		if (repeat)
			clearInterval(interval)

		return responses
	}	



	/**
	 * Encode a session-layer message into an endpoint-layer message.
	 * 
	 * @param  {[type]} msg [description]
	 * @return {[type]}     [description]
	 */
	encode(msg) {
		assert(Msg.isMsg(msg))
		const {label, sender, receivers, payload} = msg 

		// Filter out `undefined` and duplicated ones.
		let uuids
		if (receivers)
			uuids = (new Set(receivers.map(role => this.peers.get(role)).filter(uuid => uuid))).toJSON()
		else
			uuids = null

		const packet = new Msg(label, this.id, uuids, msg)
		if (Msg.skipSenderCheck(msg))
			packet.skipsendercheck = true
		return packet
	}

	/**
	 * Decode an endpoint-layer message into a session-layer message.
	 * 
	 * @param  {[type]} msg [description]
	 * @return {[type]}     [description]
	 */
	decode(msg) {
		if (!Msg.isMsg(msg.payload))
			console.log("HERE", msg)

		assert(Msg.isMsg(msg))
		msg = msg.payload
		assert(Msg.isMsg(msg))

		return msg
	}
}

module.exports = Endpoint