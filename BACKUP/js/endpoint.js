"use strict"

import { Socket }  from "./socket.js"
import { Mailbox } from "./mbox.js"
import { Msg }     from "./msg.js"

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

class Endpoint {
    /**
     * local states: 
     *  - id:    endpoint id
     *  - roles: self roles within the session
     *  - peers: peer roles and peer endpoint id's
     *  - mbox:  message box for received msgs
     *  - sock:  pre-connected socket in "bus/broadcast" mode
     */


    /**
     * Construct an endpoint that wraps around a pre-connected 
     * broadcasting socket.
     * @param  {Socket} sock  
     * @param  {[int]}  roles      
     */
    constructor(sock, roles) {
        this.id = uuidv4();
        this.roles = roles.sort();
        this.peers = {} // a map where peers[role] = peer_uuid
        this.mbox = new Mailbox()
        this.sock = sock
        this.state = "init" // init | ready | active | closing

        this.sock.onmessage = msg => {
            if (Object.values(this.peers).includes(msg.sender)) {
                this.mbox.put(msg)
            }
        }

    }

    init(fullroles) {

        // save old continuation 
        let old_onmessage = this.sock.onmessage

        // remove self roles from full roles
        let others = fullroles.filter(key => !this.roles.includes(key)).map(key => key.toString()).sort()

        // callback to gather all init replies
        let on_init_reply = msg => {

            // skip init reply that is not for myself
            if (this.id != msg.payload.init) {
                return
            }

            // skip when there's overlapping roles
            let roles = msg.payload.roles
            if (!roles.every(role => !(role in this.peers))) {
                return
            }

            // add role => uuid mappings
            for ( const role of roles ) {
                this.peers[role] = msg.sender
            }

            // check for the presence of all roles in the session
            let keys = Object.keys(this.peers).sort()
            if (keys.length == others.length &&
                    keys.reduce((acc, cur, idx) => acc && (cur == others[idx]), true)) {

                this.state = "active"
            }
        }

        // callback to reply init requests
        let on_init = msg => {
            let reply = new Msg("init-reply", this.id, {
                roles: this.roles,
                init: msg.sender
            })
            this.sock.send(reply)
        }

        // announce self with id and roles until initialization is finished
        let msg = new Msg("init", this.id, this.roles)
        let interval = setInterval(() => this.sock.send(msg), 1000)

        this.sock.onmessage = msg => {
            // skip non-init/non-init-reply messages
            if (!["init", "init-reply"].includes(msg.label)) {
                return
            }

            switch (msg.label) {
            case "init":
                on_init(msg)
                break
            case "init-reply":
                on_init_reply(msg)
                break
            }
        }

        // wait until the state has changed away from "init"
        return new Promise(async resolve => {
            let sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
            while (this.state == "init") {
                await sleep(1)
            }

            this.sock.onmessage = old_onmessage
            clearInterval(interval)

            resolve()
        })
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
        let msg = await this.mbox.match("send", this.peers[sender])
        return msg
    }
}

export { Endpoint }
