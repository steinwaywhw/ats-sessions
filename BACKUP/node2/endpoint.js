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
		this.roles    = roles

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
		this.state = `${this.state}/accepting`

		// 2PC: vote.
		const vote = new Msg('vote', this.id, [], {roles: this.roles, name: this.name})
		const yes  = await this.sync('yes', full, {msg: vote, repeat: true, type: 'role'})

		// Update our peer map.
		yes.forEach(({sender, payload}) => payload.roles.forEach(r => this.peers.set(r, sender)))

		// 2PC: commit.
		const commit = new Msg('commit', this.id, this.peers.uniqueValues(), this.peers)
		await this.sync('committed', this.peers.uniqueValues(), {msg: commit})

		// Go.
		this.buffer.length = 0
		this.trans.flush()
		this.send(new Msg('go', this.id, this.peers.uniqueValues(), null))
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
		this.state = `${this.state}/requesting`
		req.payload.roles.forEach(r => this.peers.set(r, req.sender))
		
		// 2PC-1: Vote.
		// The message need to skip sender check since the leader has no peer map yet.
		const yes = new Msg('yes', this.id, [req.sender], {roles: this.roles}, true)
		this.send(yes)

		// 2PC-2: Commit.
		const { payload } = await this.receive(util.pattern('commit', req.sender))
		this.peers = new Map(payload)
		this.buffer.length = 0
		this.trans.flush()

		const committed = new Msg('committed', this.id, [req.sender], null)
		this.send(committed)

		// Wait for 'go'
		await this.receive(util.pattern('go', req.sender))
	}


	send(msg) {
		this.trans.send(msg)
	}

	/**
	 * Session-level receive.
	 * @param  {[type]} labels  [description]
	 * @param  {[type]} senders [description]
	 * @return {[type]}         [description]
	 */
	// async receive(patterns=[]) {		
	// 	if (!Array.isArray(patterns)) 
	// 		patterns = [patterns]
	// 	if (patterns.length == 0) 
	// 		patterns.push(util.pattern(null, null, null))

	// 	const encode_one = ({label, sender, pred}) => {
	// 		let uuid = this.peers.get(sender)
	// 		if (!uuid) 
	// 			uuid = null
			
	// 		if (pred == null)
	// 			pred = msg => true

	// 		return util.pattern(label, uuid, msg => Msg.isMsg(this.decode(msg)) && pred(this.decode(msg)))
	// 	}

	// 	// Push the `link` pattern as the last one.
	// 	patterns.push(util.pattern('link'))

	// 	while (true) {
	// 		const msg = this.decode(await this._receive(patterns.map(p => encode_one(p))))
	// 		// Regular message, just return it.
	// 		if (msg.label != 'link')
	// 			return msg

	// 		// Link message. 
	// 		this.send(new Msg('yes', this.roles, msg.sender, null))
	// 		await this._asleaf()
	// 		// console.log("LINK FINISHED")

	// 		recorder.log(this)
	// 		recorder.current()
	// 	}
	// }

	/**
	 * Endpoint-layer receive. 
	 * 
	 * @param  {[type]} labels  [description]
	 * @param  {[type]} senders [description]
	 * @return {[type]}         [description]
	 */
	async receive(patterns=null) {
		const pred = util.preds(patterns)

		// Receive and check.
		let index = this.buffer.findIndex(msg => pred(msg))
		while (index < 0) {
			const msg = await this.trans.receive()
			
			// In-session messages.
			if (msg.receivers.includes(this.id) && this.peers.hasvalue(msg.sender)) { 
				// Reply to in-session 'ping' at anytime.
				if (msg.label == 'ping') {
					this.send(new Msg('pong', this.id, [msg.sender], this.toJSON()))
				} else {
					this.buffer.push(msg) 
				}
			}

			// In-session before the acceptor has the peer map.
			else if (msg.receivers.includes(this.id) && Msg.skipSenderCheck(msg)) { this.buffer.push(msg) }

			// Init state, receive only the vote messages.
			else if (this.state == 'init' && msg.label == 'vote' && msg.payload.name == this.name) { this.buffer.push(msg) }

			// Otherwise, the msg is discarded.
			else { continue }

			index = this.buffer.findIndex(msg => pred(msg))
		}

		const [msg] = this.buffer.splice(index, 1)
		// console.debug(`Received: ${msg.label}`)
		
		return msg	
	}

	peak(patterns=null) {
		const pred = util.preds(patterns)

		const search = msg => {
			if (msg.receivers.includes(this.id) && this.peers.hasvalue(msg.sender))
				return pred(msg)
			else if (msg.receivers.includes(this.id) && Msg.skipSenderCheck(msg)) 
				return pred(msg)
			else if (this.state == 'init' && msg.label == 'vote' && msg.payload.name == this.name)
				return pred(msg)
			else 
				return false
		}

		return this.buffer.some(search) || this.trans.buffer.some(search)
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

	static async link(ep1, ep2) {

		const blocked = async (ep) => {
			let pongs
			do {
				recorder.current()
				const ping = new Msg('ping', ep.id, ep.peers.uniqueValues(), null)
				pongs = await ep.sync('pong', ep.peers.uniqueValues(), {msg: ping})
			} while (!pongs.every(({payload}) => ['linking', 'receiving'].includes(payload.state)))
		}

		await blocked(ep1)
		await blocked(ep2)

		const [keep, kill] = !(ep1.isempty()) ? [ep1, ep2] : [ep2, ep1]
		assert(kill.isempty())

		// By LMRL, there will be exactly one `keep` whose mailbox is non-empty.
		// TODO: Prove this in the thesis.
		if (!keep.isempty()) {
			const forward = [] 
			while (!keep.isempty()) {
				forward.push(keep.decodeMsg(await keep.receive()))
			}
			// console.log('AS ROOT')
			await Endpoint._asroot(keep, kill, forward)
		} else {
			// console.log('AS NODE')
			await Endpoint._asnode(keep, kill)
		}

		kill.close()
		return [keep, kill]
	}


	/**
	 * Nested 2PC, as Root.
	 * 
	 * @param  {[type]} keep [description]
	 * @param  {[type]} kill [description]
	 * @return {[type]}      [description]
	 */
	static async _asroot(keep, kill, forward) {

		const oldkeepstate = keep.state 
		const oldkillstate = kill.state 

		keep.state = `${oldkeepstate}/keep/root`
		kill.state = `${oldkillstate}/kill/root`

		const keepfull = keep.peers.uniqueValues()
		const killfull = kill.peers.uniqueValues()

		const newroles = Set.intersect(keep.roles, kill.roles)
		const newpeers = new Map()
		newroles.forEach(role => newpeers.set(role, keep.id))
		
		recorder.log(keep)
		recorder.log(kill)
		recorder.current()

		// Nested 2PC-1: Voting.
		let y1 = await keep.sync('yes', keepfull, {msg: new Msg('link', keep.id, keepfull, {id: keep.id, roles: keep.roles})})
		let y2 = await kill.sync('yes', killfull, {msg: new Msg('link', kill.id, killfull, {id: keep.id, roles: kill.roles})})
		const yes = [...y1, ...y2]

		// Compute the new peer map.
		yes.forEach(({payload}) => newpeers.extend(new Map(payload)))

		// Nested 2PC-2: Commit.
		keep.state = `${oldkeepstate}/keep/root/committed`
		kill.state = `${oldkillstate}/kill/root/committed`
		
		recorder.log(keep)
		recorder.log(kill)
		recorder.current()

		await kill.sync('committed', killfull, {msg: new Msg('commit', kill.id, killfull, newpeers)})
		await keep.sync('committed', keepfull, {msg: new Msg('commit', keep.id, keepfull, newpeers)})

		// Commit.	
		keep.peers = newpeers 
		keep.roles = newroles

		keep.state = `${oldkeepstate}/keep/root/forwarding`
		kill.state = `${oldkillstate}/kill/root/forwarding`

		recorder.log(keep)
		recorder.log(kill)
		recorder.current()

		// Forward.
		forward.forEach(msg => {
			const packet = keep.encodeMsg(msg)
			packet.sender = keep.peers.get(msg.sender[0])
			keep.send(packet)

			if (keep.roles.some(r => msg.receivers.includes(r)))
				keep.buffer.push(packet)
		})

		if (newroles.size == 0)
			keep.send(new Msg('go', keep.id, newpeers.uniqueValues(), null, true))
		else 
			keep.send(new Msg('go', keep.id, newpeers.uniqueValues(), null, false))
		
		recorder.log(keep)
		recorder.log(kill)
		recorder.current()
	}


	/**
	 * Nested 2PC, as Non-root Non-leaf Node.
	 * 
	 * @param  {[type]} keep [description]
	 * @param  {[type]} kill [description]
	 * @return {[type]}      [description]
	 */
	static async _asnode(keep, kill) {
		
		const oldkeepstate = keep.state
		const oldkillstate = kill.state

		keep.state = `${oldkeepstate}/keep/node`
		kill.state = `${oldkillstate}/kill/node`

		const newroles = Set.intersect(keep.roles, kill.roles)
		const newpeers = new Map()
		newroles.forEach(role => newpeers.set(role, keep.id))
		
		recorder.log(keep)
		recorder.log(kill)
		recorder.current()

		// Determin the parent and child, w.r.t. nested 2PC
		while (!keep.peak(util.pattern('link')) && kill.peak(util.pattern('link'))) 
			await util.sleep(1)

		const [parent, child] = keep.peak(util.pattern('link')) ? [keep, kill] : [kill, keep]

		const link = await parent.receive(util.pattern('link'))
		assert(link.payload.roles.every(e => child.roles.has(e)))
		assert(link.payload.roles.every(e => !parent.roles.has(e)))

		const childfull = child.peers.uniqueValues()

		keep.state = `${oldkeepstate}/keep/node/yes`
		kill.state = `${oldkillstate}/kill/node/yes`
		
		recorder.log(keep)
		recorder.log(kill)
		recorder.current()

		// Nested 2PC-1: Request votes from children.
		const childlink = new Msg('link', child.id, childfull, {id: link.payload.id, roles: child.roles})
		const yes = await child.sync('yes', childfull, {msg: childlink})

		// Compute the new peer map.
		yes.forEach(({payload}) => newpeers.extend(new Map(payload)))

		// Nested 2PC-1: Vote to the parent.
		parent.send(new Msg('yes', parent.id, [link.sender], newpeers))
		
		keep.state = `${oldkeepstate}/keep/node/commit`
		kill.state = `${oldkillstate}/kill/node/commit`
		recorder.log(keep)
		recorder.log(kill)
		recorder.current()

		// Nested 2PC-2: Commit the children.
		const commit = await parent.receive(util.pattern('commit', link.sender))
		const childcommit = new Msg('commit', child.id, childfull, commit.payload)
		await child.sync('committed', childfull, {msg: childcommit})

		// Nested 2PC-2: Commit myself.
		const committed = new Msg('committed', parent.id, [link.sender], null)
		keep.roles = newroles 
		keep.peers = new Map(commit.payload)

		// Nested 2PC-2: Committed.
		parent.send(committed)
		
		keep.state = `${oldkeepstate}/keep/node/go`
		kill.state = `${oldkillstate}/kill/node/go`
		recorder.log(keep)
		recorder.log(kill)
		recorder.current()

		// Go
		console.log(keep.toJSON())
		await keep.receive(util.pattern('go', link.payload.id))
		
		recorder.log(keep)
		recorder.log(kill)
		recorder.current()
	}

	

	async _asleaf(link) {

		const oldstate = this.state 

		this.state = `${oldstate}/linking/leaf`
		recorder.log(this)
		recorder.current()

		// Nested 2PC-1: Vote.
		const peers = new Map()
		this.roles.forEach(role => peers.set(role, this.id))
		this.send(new Msg('yes', this.id, [link.sender], peers))

		// 2PC-2: Commit.
		this.state = `${oldstate}/linking/commit`
		recorder.log(this)
		recorder.current()

		const { payload } = await this.receive(util.pattern('commit', link.sender))
		const committed = new Msg('committed', this.id, [link.sender], null)

		this.peers = new Map(payload)
		this.send(committed)
		
		this.state = `${oldstate}/linking/go`
		recorder.log(this)
		recorder.current()

		// Go.
		console.log(this.toJSON())
		await this.receive(util.pattern('go', link.payload.id))
		
		recorder.log(this)
		recorder.current()

	}


	/**
	 * This implements one round trip of a 2-phase commit.
	 * @param  {string}       label Expected label of response messages.
	 * @param  {Set<integer>} full  Expected full set of uuids or roles.
	 * @param  {Object}       opts  Options.
	 * @return {Array<Msg>}         The array of all responses.
	 */
	async sync(label, full, opts) {
		const {msg, repeat, type} = Object.assign({msg: null, repeat: false, type: 'uuid'}, opts)
		const all = full.clone()

		// Send the message first.
		let interval = null
		if (msg) 
			if (repeat)
				interval = setInterval(() => this.send(msg), 100)
			else
				this.send(msg) 

		const responses   = []
		const respondents = type == 'role' ? this.roles.clone() : new Set([this.id])

		switch (type) {
		case 'role': 
			// Block until all roles have responded.
			while (!all.every(role => respondents.has(role))) {
				let resp = await this.receive(util.pattern(label, null, null))
				if (respondents.some(r => resp.payload.roles.includes(r)))
					continue

				responses.push(resp)
				respondents.union(resp.payload.roles)
			}
			break
		case 'uuid':
			// Block until all uuids have responded.
			while (!all.every(uuid => respondents.has(uuid))) {
				let resp = await this.receive(util.pattern(label, null, null))
				if (respondents.has(resp.sender))
					continue

				responses.push(resp)
				respondents.add(resp.sender)
			}
			break
		default: 
			throw new Error(`Unexpected type: ${type}.`)
		}

		if (repeat)
			clearInterval(interval)

		return responses
	}	


	/**
	 * Encode an array of patterns for session-layer messages 
	 * to those for endpoint-layer messages.
	 * 
	 * @param  {Array<pattern>}  patterns 
	 * @return {Array<pattern>}
	 */
	encodePatterns(patterns) {
		assert(Array.isArray(patterns))

		const encode = ({label, sender, pred}) => {
			let uuid = this.peers.get(sender)
			assert(!!uuid)

			if (pred == null)
				return util.pattern(label, uuid, null)
			else
				return util.pattern(label, uuid, msg => pred(this.decode(msg)))
		}

		return patterns.map(p => encode(p))
	}


	/**
	 * Encode a session-layer message into an endpoint-layer message.
	 * 
	 * @param  {[type]} msg [description]
	 * @return {[type]}     [description]
	 */
	encodeMsg(msg) {
		assert(Msg.isMsg(msg))
		const {label, sender, receivers, payload} = msg 

		// Filter out `undefined` and duplicated ones.
		let uuids = [...receivers.map(r => this.peers.get(r)).filter(uuid => !!uuid)].dedup()

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
	decodeMsg(msg) {
		if (!Msg.isMsg(msg.payload))
			console.error(msg)

		assert(Msg.isMsg(msg))
		msg = msg.payload
		assert(Msg.isMsg(msg))

		return msg
	}
}

module.exports = Endpoint