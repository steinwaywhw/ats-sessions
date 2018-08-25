"use strict"

const nanomsg = require("nanomsg")
const uuidv4  = require("uuid/v4")
const _       = require("./collections.js")
const util    = require("util")

const Msg      = require("./msg.js")
const Endpoint = require("./endpoint.js")
const Mailbox  = require("./mailbox.js")

const sleep  = ms   => new Promise((resolve, reject) => setTimeout(resolve, ms))


/**
 * A session event with label, data, and timestamp.
 *
 * {ep, {id, state, peer, roles}}
 * 
 */
class SessionEvent {
	constructor(label, data) {
		this.label = label 
		this.data  = data 
		this.time  = new Date()
	}

	static Endpoint(ep) {
		return new SessionEvent("endpoint", ep)
	}

	static CloseEndpoint(ep) {
		return new SessionEvent("closeendpoint", ep)	
	}

	static Mailbox(mbox) {
		return new SessionEvent("mailbox", mbox)
	}

	static CloseMailbox(mbox) {
		return new SessionEvent("closemailbox", mbox)
	}

	/**
	 * [Send description]
	 * @param {uuid}        f   [description]
	 * @param {Array<uuid>} ts  [description]
	 * @param {Msg}         msg [description]
	 */
	static Send(f, ts, msg) {
		return new SessionEvent("send", {msg: msg, from: f, to: ts.clone()})
	}

	/**
	 * [Recv description]
	 * @param {uuid} f   [description]
	 * @param {uuid} t   [description]
	 * @param {Msg}  msg [description]
	 */
	static Recv(f, t, msg) {
		return new SessionEvent("recv", {msg: msg, from: f, to: t})
	}


}


class SessionRecorderWorker {
	constructor(addr) {
		this.events    = []

		this.sock = nanomsg.socket("pair")
		this.sock.setEncoding("utf8")
		this.sock.connect(addr)

		this.sock.on("data", msg => {
			msg = JSON.parse(msg)
			this.dispatch(msg)
		})
	}

	dispatch(msg) {
		switch (msg.label) {
		case "endpoint": 
			this.events.push(SessionEvent.Endpoint(msg.payload))
			break 
		case "closeendpoint":
			this.events.push(SessionEvent.CloseEndpoint(msg.payload))
			break
		case "mailbox":
			this.events.push(SessionEvent.Mailbox(msg.payload))
			break
		case "closemailbox":
			this.events.push(SessionEvent.CloseMailbox(msg.payload))
			break
		case "send": 
			this.send(msg.payload.endpoint, msg.payload.msg)
			break 
		case "recv": 
			this.recv(msg.payload.endpoint, msg.payload.msg)
			break 
		}
	}

	send(ep, msg) {
		const f = ep.id 
		const peers = new Map(ep.peers).foldr([], (uuid, role, base) => { 
			if (uuid != f) base.push(uuid)
			return base
		})

		this.events.push(SessionEvent.Send(f, msg.receivers.length > 0 ? msg.receivers : peers, msg))
	}

	recv(ep, msg) {
		const f = msg.sender 
		const t = ep.id 

		this.events.push(SessionEvent.Recv(f, t, msg))
	}
}

class SessionRecorder {
	constructor() {
		const addr = `inproc://${uuidv4()}`
		this.sock = nanomsg.socket("pair")
		this.sock.setEncoding("utf8")
		this.sock.bind(addr)
		this.worker = new SessionRecorderWorker(addr)
	}

	endpoint(ep) {
		this.sock.send(JSON.stringify(new Msg("endpoint", null, ep)))
	}

	closeendpoint(ep) {
		this.sock.send(JSON.stringify(new Msg("closeendpoint", null, ep)))
	}

	mailbox(mbox) {
		this.sock.send(JSON.stringify(new Msg("mailbox", null, mbox)))
	}

	closemailbox(mbox) {
		this.sock.send(JSON.stringify(new Msg("closemailbox", null, mbox)))
	}

	send(ep, msg) {
		this.sock.send(JSON.stringify(new Msg("send", null, {endpoint: ep, msg: msg})))
	}

	recv(ep, msg) {
		this.sock.send(JSON.stringify(new Msg("recv", null, {endpoint: ep, msg: msg})))
	}

	events() {
		return this.worker.events
	}
}

const instance = new SessionRecorder()
module.exports = instance