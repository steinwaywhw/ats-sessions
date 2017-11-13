"use strict"

let nanomsg   = require("nanomsg")
let uuidv4    = require("uuid/v4")
let Mailbox   = require("./mailbox.js")
let Socket    = require("./socket.js")
let Msg       = require("./msg.js")
let Consensus = require("./consensus.js")

class Endpoint {
	/**
	 * local states: 
	 * 	- id:    endpoint id
	 * 	- roles: self roles within the session
	 * 	- peers: peer roles and peer endpoint id's
	 * 	- mbox:  message box for received msgs
	 * 	- sock:  pre-connected socket in "bus/broadcast" mode
	 */
	

	/**
	 * Construct an endpoint that wraps around a pre-connected 
	 * broadcasting socket.
	 * @param  {Socket} sock  
	 * @param  {[int]}  roles      
	 */
	constructor(sock, roles) {
		this.id    = uuidv4();
		this.roles = roles.sort();
		this.peers = {} // a map where peers[role] = peer_uuid
		this.mbox  = new Mailbox()
		this.sock  = sock
		this.state = "init" // init | ready | active 

        this.handler = 
            msg => 
                msg.sender in this.peers ? this.mbox.put(msg) : ""
	}


	async init(fullroles) {

        fullroles.sort()

        let req = new Promise((resolve, reject) => {
            let consensus = new Consensus(this.sock, this.id, this.roles, obj => {

                switch (obj.state) {

                // becomes a leader
                case "leader": 
                    // reset this.peers
                    this.peers = {}

                    // add peers, from the smallest id to the largest id
                    let keys = Object.keys(obj.members)
                    keys.sort()
                    keys.forEach(id => {
                        // non-overlapping roles
                        if (obj.members[id].every(role => !(role in this.peers))) {
                            obj.members[id].forEach(role => this.peers[role] = id)
                        }
                    })

                    // check for all the roles
                    keys = Object.keys(this.peers)
                    keys.sort()
                    if (keys.length == fullroles.length &&
                        keys.reduce((acc, cur, idx) => acc && (cur == fullroles[idx]), true)) {

                        // leader elected, stop the timer, replace message handler, and sync peers
                        clearTimeout(obj.timer)
                        clearInterval(obj.pinger)
                        this.sock.onmessage = this.handler
                        obj.syncmeta(this.peers, Object.values(this.peers))
                        resolve(obj)
                    } else {
                        obj.state = "candidate"
                    }
                    break 

                // some leader is elected, and received "sync" message
                default: 
                    clearTimeout(obj.timer)
                    clearInterval(obj.pinger)
                    this.peers = obj.meta
                    this.sock.onmessage = this.handler
                    resolve(obj)
                }
            })
        })


        let consensus = await req 
    }
        
    /**
     * Broadcast a payload to all 
     * @param  {anything} payload 
     * @return {void}         
     */
    broadcast(payload) {
        let msg = new Msg("send", this.id, payload)
        this.sock.send(msg)
    }

    /**
     * Receive a message from a particular sender.
     * @param  {role}     sender
     * @return {anything}        
     */
    async receive(sender) {
        let promises = [this.mbox.match("send", this.peers[sender.toString()]), 
                        this.mbox.match("link", null)]
        let msg = await promises.race()
        
        switch (msg.label) {
        case "send": 
            return msg 
        case "link": 
            this.peers = msg.payload 
            return this.receive(sender)
        }
    }

    close() {
        this.sock.close()
        this.mbox = null
    }

    static async partialcut(ep1, ep2) {
        let intersection_roles = ep1.roles.filter(role => ep2.includes(role))
        let direction = await ep1.mbox.isempty() // true: ep1 <- ep2, false: ep1 -> ep2

        let ep = new Endpoint(this.sock, intersection_roles)
        ep.sock.onmessage = ep.handler

        let peers = {}
        intersection_roles.forEach(role => peers[role] = ep.id)

        Object.keys(ep1.peers).forEach(role => (!ep1.roles.includes(role)) ? peers[role] = ep1.peers[role] : "")
        Object.keys(ep2.peers).forEach(role => (!ep2.roles.includes(role)) ? peers[role] = ep2.peers[role] : "")

        ep1.sock.send(new Msg("link", ep1.id, peers))
        ep2.sock.send(new Msg("link", ep2.id, peers))

        if (direction) {
            while (!ep2.mbox.isempty()) {
                let msg = await ep2.mbox.get()
                ep1.sock.send(msg)
            }
        } else {
            while (!ep1.mbox.isempty()) {
                let msg = await ep1.mbox.get()
                ep2.sock.send(msg)
            }
        }

        return ep
    }

}

module.exports = Endpoint