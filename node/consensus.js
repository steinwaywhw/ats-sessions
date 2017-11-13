"use strict"

let Msg = require("./msg.js")
let Socket = require("./socket.js")


/**
 * Simple leader election. 
 */
class Consensus {

	/**
	 * @param  {Socket}   sock     a pre-connected bus socket
	 * @param  {uuid}     id       the uuid of myself
	 * @param  {object}   metadata anything that's attached to this id
	 * @param  {Function} callback invoked when it becomes leader, or when leader sends first command
	 */
	constructor(sock, id, metadata, callback) {
		this.sock     = sock

		this.id       = id
		this.meta     = metadata   // may contain roles and stype

		this.state    = "follower" // follower | candidate | leader
		this.members  = {}

		this.members[this.id] = this.meta

		this.timer    = this.reset_timer()
		this.pinger   = setInterval(() => this.ping(), 150)
		this.callback = callback

		// this will remove all other handlers
		// and use ours exclusively
		this.sock.onmessage = msg => this.on_message(msg)
	}

	/**
	 * Send ping messages to gossip what metadata I have
	 */
	ping() {
		this.sock.send(new Msg("ping", this.id, {meta: this.meta}))
	}

	/**
	 * Reset the election timer
	 */
	reset_timer() {
		clearTimeout(this.timer)

		if (this.state != "leader") {
			// [150, 300) ms recommended timeouts from RAFT
			this.timer = setTimeout(() => this.on_timeout(), Math.random() * 150 + 150) 
		} else {
			// 150 ms for leader heartbeat
			this.timer = setTimeout(() => this.on_timeout(), 150)
		}
	}

	/**
     * As a leader, send out a sync command to sync metadata about all the members.
	 * @param  {Object}        meta      metadata to by synced
	 * @param  {Array of uuid} receivers intended receivers
	 */
	syncmeta(meta, receivers) {
		this.meta = meta
		this.sock.send(new Msg("sync", this.id, {meta: this.meta, receivers: receivers}))
	}

	/**
	 * Election timeouts
	 */
	on_timeout() {
		switch (this.state) {
		// if a follower times out, it becomes candidate
		// if there is a leader, the heartbeat should keep it within follower
		case "follower":
			this.state = "candidate"
			this.sock.send(new Msg("candidate", this.id, {meta: this.meta}))
			this.reset_timer()
			break 

		// if a candidate times out, it becomes leader
		// if there is a leader, the hearbeat should force it to become a follower
		case "candidate":
			this.sock.send(new Msg("leader", this.id, {meta: this.meta}))
			this.state = "leader"
			this.reset_timer()
			break

		// if a leader times out, it heartbeats
		case "leader":
			this.sock.send(new Msg("leader", this.id, {meta: this.meta}))
			this.reset_timer()
			this.callback(this)
			break
		}
	}

	/**
	 * On consensus messages or leader commands
	 * @param  {Msg} msg 
	 */
	on_message(msg) {

		switch (msg.label) {
		// ping message to update members list
		// reset timer if it comes from a smaller id
		case "ping":
			this.members[msg.sender] = msg.payload.meta
			if (msg.sender < this.id) {
				this.state = "follower"
				this.reset_timer()
			}
			break 

		// if the sender is smaller, help it become leader
		// otherwise, promote myself to be the leader
		case "candidate": 
			// if the candidate is smaller than me
			if (msg.sender < this.id) {
				this.state = "follower"
			} else {
				this.state = "candidate"
				this.sock.send(new Msg("candidate", this.id, {meta: this.meta}))
			}
			this.reset_timer()
			break		

		// as long as I'm not a leader, I will be follower.
		// If I'm also a leader, we need to compare our id
		case "leader":
			if (this.state == "leader") {
				if (msg.sender < this.id) {
					// I should not be the leader
					this.state = "follower"
				} else {
					// I should, but let's re-elect
					this.state = "candidate"
					this.sock.send(new Msg("candidate", this.id, {meta: this.meta}))
				} 
			} else {
				// just follow the leader
				this.state = "follower"
			}
			this.reset_timer()
			break 

		// the leader sends out this command
		case "sync":
			if (this.state != "leader" && msg.payload.receivers.includes(this.id)) {
				this.meta = msg.payload.meta 
				clearTimeout(this.timer)
				clearInterval(this.pinger)
				this.callback(this)
			}
		}
	}
}

module.exports = Consensus