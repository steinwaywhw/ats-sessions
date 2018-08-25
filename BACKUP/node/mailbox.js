"use strict"

const nanomsg = require("nanomsg")
const uuidv4  = require("uuid/v4")

const _      = require("./collections.js")
const Sock   = require("./socket.js")
const Msg    = require("./msg.js")
const Logger = require("./recorder.js")


/**
 * @ignore
 */
const sleep = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

/**
 * A `MailboxWorker` that actually holds the "concurrent" buffer.
 * 
 * The "concurrency" is achieved by queueing callbacks for mailbox commands
 * like "put" and "match". Many commands may arraive concurrently, but will be
 * serialized by the NodeJS core. Callbacks will then be invoked in order, and 
 * will not be interrupted unless the callback yields at `await`. 
 *
 * @package
 */
class MailboxWorker {

    /**
     * @param  {Mailbox} parent - The owning mailbox.           
     * @param  {String}  addr   - Socket address to connect to.
     * @return {MailboxWorker}
     */
    constructor(parent, addr) {
        /**
         * @type {Mailbox}
         */
        this.parent = parent

        /**
         * @type {Array}
         */
        this.mbox = []

        /**
         * @type {Sock}
         */
        this.sock = new Sock("pair")

        this.sock.connect(addr)
        this.sock.onmessage = msg => this.dispatch(msg)
    }
    
    /**
     * Handles the "put" command.
     * 
     * @param  {Mailbox.Put} msg 
     * @return {Void}
     */
    onput(msg) {
        this.mbox.push(msg.payload)
        Logger.mailbox(this.parent)
    }
    
    /*    
     * @callback Mailbox.Predicate
     * @param  {Msg}  m - The message to check.
     * @return {Boolean} `true` if the message matches the pattern.
     */
    
    /**
     * Build a pattern checking function out of a given example.
     *
     * @protected
     * @param  {Msg} msg  - An example message, showing the label/sender to match.
     * @return {Mailbox.Predicate} 
     */
    _condition(msg) {
        const label  = msg.label
        const sender = msg.sender
        
        if (label && sender) 
            return m => m.label == label && m.sender == sender
        else if (label)
            return m => m.label == label 
        else if (sender)
            return m => m.sender == sender
        else 
            throw new Error("No conditions given when trying to match a message from the mailbox.")
    }

    /**
     * Build an alternative patterns checking function out of a list of given examples. 
     *
     * @protected
     * @param  {Array<Msg>} msgs - An array of example messages.
     * @return {Mailbox.Predicate} A function that checks if the message matches any of the patterns.
     */
    _conditions(msgs) {
        const base  = m => false 
        const fn    = (msg, conds) => { return m => this._condition(msg)(m) || conds(m) }
        const conds = msgs.foldr(base, fn)

        return conds
    }

    /**
     * Handles "match" command.
     *
     * @param  {Mailbox.Match} msg 
     * @return {Msg} Return the earliest message that matches any of the example messages.      
     */
    async onmatch(msg) {
        const conds = this._conditions(msg.payload)

        while (true) {
            let index = this.mbox.findIndex(conds)
            while (index < 0) {
                await sleep(1)
                index = this.mbox.findIndex(conds)
            }
            
            const ret = this.mbox.splice(index, 1)[0]
            Logger.mailbox(this.parent)
            return ret
        }
    }

    /**
     * Close the mailbox.
     * 
     * @return {Void}
     */
    onclose() {
        delete this.mbox
        this.sock.close()
    }

    /**
     * Clear all the messages that match the pattern.
     * 
     * @param  {Mailbox.Clear} msg
     * @return {Void}
     */
    onclear(msg) {
        const cond = this._condition(msg.payload)
        this.mbox = this.mbox.filter(m => !cond(m))

        Logger.mailbox(this.parent)
    }

    /**
     * Dispatch commands. 
     *
     * This function "returns" by sending a reply message.
     * 
     * @param  {(Mailbox.Put|Mailbox.Match|Mailbox.Close|Mailbox.Clear|Mailbox.Size)} msg 
     * @return {Void|Msg}
     */
    async dispatch(msg) {
        switch (msg.label) {
            case "put":
                this.onput(msg)
                break
            case "match":
                this.sock.send(await this.onmatch(msg))
                break
            case "close":
                this.onclose()
                break
            case "size":
                this.sock.send(this.mbox.length)
                break
            case "clear":
                this.onclear(msg)
                break
        }
    }
}


/**
 * An Erlang-style concurrent mailbox that supports pattern matching.
 */
class Mailbox {

    /**
     * @param  {Endpoint} ep - The endpoint who owns the mailbox.
     * @return {Mailbox} 
     */
    constructor(ep) {
        /**
         * @type {Endpoint}
         */
        this.endpoint = ep

        /**
         * @type {String}
         */
        this.addr = `inproc://${uuidv4()}`

        /**
         * @type {Sock}
         */
        this.sock = new Sock("pair")
        this.sock.bind(this.addr)

        /**
         * @type {MailboxWorker}
         */
        this.worker = new MailboxWorker(this, this.addr)

        Logger.mailbox(this)
    }

    /**
     * @typedef  {Msg}        Mailbox.Match
     * @property {"match"}    label
     * @property {Array<Msg>} payload - The messages to match.
     */
    
    /** 
     * @typedef  {Msg}   Mailbox.Put
     * @property {"put"} label
     * @property {Msg}   payload - The message to put.
     */
    
    /**
     * @typedef  {Msg}     Mailbox.Clear
     * @property {"clear"} label
     * @property {Msg}     payload - The message to match and clear.
     */
    
    /**
     * @typedef  {Msg}    Mailbox.Size
     * @property {"size"} label
     */
    
    /**
     * @typedef  {Msg}     Mailbox.Close
     * @property {"close"} label
     */

    /**
     * Put a message into the mailbox.
     * 
     * @param  {Msg}  msg 
     * @return {Void}     
     */
    put(msg) {
        this.sock.send(new Msg("put", null, msg))
    }

    /**
     * Get the earliest message that matches the given example.
     * The example message will show the intended label and/or sender.
     *
     * @async
     * @param  {Msg} msg - An example message showing the intended label and/or sender.
     * @return {Msg} 
     */
    match(msg) {
        return this.matchany([msg])
    }

    /**
     * Get the earliest message that matches one of the given examples. 
     *
     * @async
     * @param  {Array<Msg>} msgs
     * @return {Msg} 
     */
    matchany(msgs) {
        let request = new Promise((resolve, reject) => {
            this.sock.onmessage = msg => resolve(msg)
            this.sock.send(new Msg("match", null, msgs))
        })

        return request
    }

    /**
     * Delete all the messages that match the given example.
     * 
     * @param  {Msg}  msg 
     * @return {Void}
     */
    clear(msg) {
        this.sock.send(new Msg("clear", null, msg))
    }

    /**
     * Close the mailbox.
     * 
     * @return {Void}
     */
    close() {
        this.sock.send(new Msg("close", null, null))
        this.sock.close()

        Logger.closemailbox(this)
    }

    /**
     * Check if the mailbox is empty.
     * 
     * @return {Boolean} `true` if the mailbox is empty, `false` otherwise.
     */
    isempty() {
        return new Promise((resolve, reject) => {
            this.sock.onmessage = msg => resolve(msg == 0)
            this.sock.send(new Msg("size", null, null))            
        })
    }

    /**
     * Get a copy of all the mails in the mailbox.
     * 
     * @return {Array<Msg>}
     */
    mails() {
        return this.worker.mbox.clone()
    }
    
    /**
     * @typedef  {Object} Mailbox.JSON
     * @property {String} id       - The address of the mailbox, which is uniquely generated as an uuid.
     * @property {uuid}   endpoint - The id of the owning endpoint.
     * @property {Array<Msg>} mails
     */
    
    /**
     * @return {Mailbox.JSON}
     */
    toJSON() {
        return {
            id:       this.addr,
            endpoint: this.endpoint.id,
            mails:    this.worker.mbox.clone()
        }
    }

}

module.exports = Mailbox


