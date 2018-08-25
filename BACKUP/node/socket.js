"use strict"

const nanomsg = require("nanomsg")
const assert  = require("assert")

const _       = require("./collections.js")
const Logger  = require("./recorder.js")

/**
 * A warpper for socket implementations.
 */
class Sock {

	/**
	 * @param  {String}   proto   - SP protocol string. Could be "bus", "pair", etc.
	 * @param  {Endpoint} ep      - Owning endpoint.
	 * @param  {Object}   opts={} - Options for the socket. e.g. `{raw: true}`
	 * @return {Sock}       
	 */
	constructor(proto, ep, opts={}) {

		/**
		 * @callback Sock.Handler
		 * @param  {Msg}  msg
		 * @return {Void}
		 */

		/**
		 * A copy of the installed handler.
		 * @type {Sock.Handler}
		 */
		this.handler  = null

		/**
		 * @type {Endpoint}
		 */	
		this.endpoint = ep

		/**
		 * @type {nanomsg.Socket}
		 */
		this.sock     = nanomsg.socket(proto, opts)
		this.sock.setEncoding("utf8")

		this.sock.on("error", e => {
			this.sock.close()
			console.error(e, "\n", e.stack.split("\n"))
		})
	}

	/**
	 * Bind the address.
	 * @param  {String} addr 
	 * @return {Int}    A nanomsg endpoint id. Returns -1 on error. 
	 */
	bind(addr) {
		try {
			const eid = this.sock.bind(addr)
			assert(this.sock.bound[addr] >= 0)
			return eid 
		} catch(e) {
			this.sock.close()
			console.error(e, e.stack.split("\n"))
			return -1
		}
	}

	/**
	 * Connect to an address.
	 * @param  {String} addr 
	 * @return {Int}    A nanomsg endpoint id. Returns -1 on error. 
	 */
	connect(addr) {
		try {
			const eid = this.sock.connect(addr)
			assert(this.sock.connected[addr] >= 0) 
			return eid 
		} catch(e) {
			this.sock.close()
			console.error(e, e.stack.split("\n"))
			return -1
		}
	}

	/**
	 * Disconnect from an address.
	 * @param  {String} addr 
	 * @return {Int}    A nanomsg endpoint id. Returns -1 if the address is not previously connected.
	 */
	disconnect(addr) {
		if (addr in this.sock.connected) {
			const eid = this.sock.connected[addr]
			this.sock.shutdown(eid)
			return eid
		}
		
		return -1
	}

	/**
	 * Close the socket.
	 * @return {Void} 
	 */
	close() {
		return this.sock.close()
	}

	/**
	 * Set/Get the message handler.
	 * 
	 * When installing, all previously installed handler will be replaced.
	 * 
	 * @param  {Sock.Handler} handler 
	 * @return {Void}         
	 */
	set onmessage(handler) {
		this.sock.removeAllListeners("data")
		this.handler = handler
		this.sock.on("data", msg => {
			this.handler(JSON.parse(msg))
		})
	}

	get onmessage() {
		return this.handler
	}

	/**
	 * Send a payload via the sokcet. 
	 * 
	 * @param  {Object} payload - A JSON-serializable payload.
	 * @return {Int}    Actual bytes sent.
	 */
	send(payload) {
		const sent = this.sock.send(JSON.stringify(payload))
		assert(sent > 0)
		return sent
	}
}

module.exports = Sock