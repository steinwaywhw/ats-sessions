"use strict"

const nanomsg = require("nanomsg")
const uuidv4  = require("uuid/v4")
const util    = require("util")

const Mailbox = require("./mailbox.js")
const Sock    = require("./socket.js")
const Msg     = require("./msg.js")
const _       = require("./collections.js")
const Logger  = require("./recorder.js")

/**
 * @ignore
 */
const sleep = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

/**
 * An endpoint is an abstraction over sockets that provides session initiation, 
 * broadcasting, and linking/forwarding capabilities. 
 */
class Endpoint {

    /**
     * Construct an endpoint.
     * 
     * @param  {String}     brokeraddr - The address of the broker device.
     * @param  {Array<Int>} roles      - The roles 
     */
    constructor(brokeraddr, roles) {

        /**
         * @type {uuid}
         */
        this.id = uuidv4()

        /**
         * A set of roles played by this endpoint.
         * @type {Set<Int>}
         */
        this.roles = new Set(roles)

        /**
         * A mapping from roles to endpoint id's.
         * @type {Map<Int, uuid>}
         */
        this.peers = new Map()

        /**
         * @type {Mailbox}
         */
        this.mbox = new Mailbox(this)

        /**
         * @type {String}
         */
        this.brokeraddr = brokeraddr

        /**
         * The broker loopback device, provided by the nanomsg. 
         * @type {nanomsg.Device}
         */
        this.broker = null

        /**
         * @type {Sock}
         */
        this.sock = null

        /**
         * @type {("init"|"ready"|"active"|"linking"|"closing")}
         */
        this.state = "init"

        /**
         * The default message handler.
         * @param   {Msg}  msg
         * @returns {Void}
         */
        this.handler = msg => {
            switch (this.state) {
                case "init":
                    switch (msg.label) {
                        case "init": 
                            if (this.roles.has(0)) 
                                this.mbox.put(msg)
                            break
                        case "ready": 
                            if (msg.receivers.includes(this.id)) 
                                this.mbox.put(msg)
                            break
                    }
                    break
                case "linking":
                    if (msg.receivers.includes(this.id)) 
                        this.mbox.put(msg)
                    break
                default:
                    if (this.peers.hasvalue(msg.sender) && msg.receivers.includes(this.id)) 
                        this.mbox.put(msg)
                    break
            }
        }

        Logger.endpoint(this)
    }

    /**
     * @typedef  {Object}                 Endpoint.JSON
     * @property {uuid}                   id 
     * @property {Mailbox.JSON}           mbox
     * @property {Array<Int>}             roles
     * @property {Array<Tuple<Int,uuid>>} peers
     * @property {String}                 state
     * @property {String}                 brokeraddr
     */
    
    /**
     * @return {Endpoint.JSON} 
     */
    toJSON() {
        return {
            id: this.id,
            mbox: this.mbox.toJSON(),
            roles: this.roles.toJSON(),
            peers: this.peers.toJSON(),
            state: this.state,
            brokeraddr: this.brokeraddr
        }
    }

    /**
     * Synchronize with peers by waiting on all replys with the same
     * label as the given message. 
     *
     * @protected
     * @param  {Msg}     msg            - A message used to sync with peers. 
     * @param  {Boolean} broadcast=true - Set to false to only wait on the replies, 
     *                                    without sending the request.
     * @return {Void}
     */
    async _sync(msg, broadcast=true) {
        if (broadcast) this._broadcast(msg)

        const label = msg.label
        const responses = new Set([this.id])
        while (!this.peers.every((uuid, role) => responses.has(uuid))) {
            const reply = this.mbox.match(new Msg(label, null, null))
            responses.add(reply.sender)
        }
    }

    /**
     * Respond to a sync message, using a null payload and the original label.
     *
     * @protected
     * @param  {Msg}  msg 
     * @return {Void}
     */
    async _onsync(msg) {
        const reply = new Msg(msg.label, this.id, null, [msg.sender])
        this.sock.send(reply)
        Logger.send(reply)
    }

    /**
     * Coordinate the session initiation as a leader.
     *
     * @protected 
     * @param  {Array<Int>} fullroles - The full set of roles. 
     * @return {Void}
     *
     * ##### Out-going Messages:
     *     ready {@link Msg.ReadyRequest}
     *     go    {@link Msg.Go}
     *     
     * ##### In-coming Messages:
     *     init  {@link Msg.Init}
     *     ready {@link Msg.ReadyReply}
     */
    async _init_leader(fullroles) {
        // Init state.
        this.peers.clear()
        this.roles.forEach(role => this.peers.set(role, this.id))

        // Gather all `init` messages.
        while (!fullroles.every(role => this.peers.get(role))) {
            const msg = await this.mbox.match(new Msg("init", null, null))

            // Skip roles that intersect with our session.
            const roles = new Set(msg.payload)
            if (roles.some(role => this.peers.haskey(role))) continue

            // Add peer.
            roles.forEach(role => this.peers.set(role, msg.sender))
        }

        // Ready state.
        // Make sure everyone receives the peers map.
        this.state = "ready"
        await this._sync(Msg.Ready(this, this.peers))

        // Active state.
        this.state = "active"
        this._broadcast(Msg.Go(this))
        Logger.endpoint(this)
    }

    /**
     * Coordinate the session initiation as a follower.
     *
     * @protected
     * @param  {Array<Int>} fullroles 
     * @return {Void}
     *
     * ##### Out-going Messages:
     *     init  {@link Msg.Init}
     *     ready {@link Msg.ReadyReply}
     *
     * ##### In-coming Messages:
     *     ready {@link Msg.ReadyRequest}
     *     go    {@link Msg.Go}
     */
    async _init_follower(fullroles) {
        // Init state
        this.peers.clear()

        // Annouce itself.
        const ping = setInterval(() => this._broadcast(Msg.Init(this)), 1000)

        // Getting the `ready` message.
        const ready = await this.mbox.match(new Msg("ready", null, null))
        clearInterval(ping)
        
        this.state = "ready"
        this.peers = new Map(ready.payload)

        // Reply `ready` to the leader, and wait for the `go`.
        this._onsync(ready)
        const go = await this.mbox.match(new Msg("go", ready.sender, null))

        this.state = "active"
        Logger.endpoint(this)
    }

    /**
     * Initiate a session.
     * 
     * @param  {Array<Int>} fullroles - The full set of roles.
     * @return {Void}           
     */
    async init(fullroles) {
        if (this.roles.has(0)) {
            // Create a broker socket.
            const brokersock = new Sock("bus", null, {raw: true})
            brokersock.bind(this.brokeraddr)

            // Make it a loopback device.
            this.broker = nanomsg.device(brokersock.sock)
            this.broker.on("error", e => {
                console.error(e, e.stack.split("\n"))
            })

            // Connect to the broker.
            this.sock = new Sock("bus", this)
            this.sock.onmessage = this.handler
            this.sock.connect(this.brokeraddr)

            // Init.
            await this._init_leader(fullroles)

        } else {
            // Connect to the broker.
            this.sock = new Sock("bus", this)
            this.sock.onmessage = this.handler
            this.sock.connect(this.brokeraddr)

            // Init.
            await this._init_follower(fullroles)
        }

        // Remove left-over `init` 
        // this.mbox.clear(new Msg("init", null, null))
    }


    /**
     * Broadcast to all peers. For internal use.
     *
     * @protected
     * @param  {Msg}  msg 
     * @return {Void}
     */
    _broadcast(msg) {
        this.sock.send(msg)
        Logger.send(this, msg)
    }

    /**
     * Broadcast a payload to all peers.
     * @param  {Object} payload - JSON serializable object.
     * @return {Void}         
     */
    broadcast(payload) {
        const msg = new Msg("send", this.id, payload, new Set(this.peers.values()))
        this._broadcast(msg)
    }

    /**
     * Receive a message from a particular sender.
     *
     * @param  {Int}     sender - The role of the sender.
     * @return {Object}  The message payload.       
     * 
     * ##### In-coming Messages:
     *     send {@link Msg.Send}
     *     link {@link Msg.LinkRequest}
     */
    async receive(sender) {
        const msg = await this.mbox.matchany([new Msg("send", this.peers.get(sender), null),
                                              new Msg("link", null, null)])
        Logger.recv(this, msg)
        switch (msg.label) {
            case "send":
                return msg.payload
            case "link":
                await this.onlink(msg)
                return await this.receive(sender)
        }
    }

    /**
     * Close all the sockets and mailboxes.
     *
     * Note that the device is not closed, since it can only be closed by `nanomsg.term()`.
     * Also, when the roles are empty, the endpoint can be closed without syncing.
     *
     * @return {Void}
     *
     * ##### Out-going Messages:
     *     go    {@link Msg.Go}
     *
     * ##### In-coming Messages:
     *     close {@link Msg.Close}
     *     link  {@link Msg.LinkRequest}
     */
    async close() {

        this.state = "closing"
        Logger.endpoint(this)

        // When the role set is empty, we can directly close without syncing.
        if (this.roles.size == 0) {
            await sleep(5)
            this.sock.close()
            this.mbox.close()
            Logger.closeendpoint(this)
            return
        }

        // Direct all followers into closing state.
        await this._sync(Msg.Close(this))

        const responses = new Set([this.id])

        // Loop until every one is ready to be closed.
        while (!this.peers.every((uuid, role) => responses.has(uuid))) {
            const msg = await this.mbox.matchany([new Msg("close", null, null),
                                                  new Msg("link",  null, null)])
            switch (msg.label) {
                case "close":
                    responses.add(msg.sender)
                    continue
                case "link":
                    await this.onlink(msg)
                    this.state = "closing"
                    Logger.endpoint(this)
                    continue
            }
        }

        // Close.
        this._broadcast(Msg.Go(this))

        // This delay is necessary since NN_LINGER is marked as "not implemented" by 
        // the nanomsg library.
        await sleep(10)

        this.sock.close()
        this.mbox.close()

        Logger.closeendpoint(this)
    }

    /**
     * Synchonoursly close the endpoint as a follower. This operation tries to sync
     * with the broker (role 0) with a close message. When the broker collects all the "close", 
     * it will let all clients close. 
     *
     * @param  {Int}  closer - The role of the closing endpoint.
     * @return {Void}
     * 
     * ##### Out-going Messages:
     *     close {@link Msg.Close)
     *
     * ##### In-coming Messages:
     *     go    {@link Msg.Close}
     *     link  {@link Msg.LinkRequest}
     */
    async wait(closer) {
        this.state = "closing"
        this._send(null, closer, "close")
        Logger.endpoint(this)
        
        // Wait for the closing signal.
        const msg = await this.mbox.matchany([new Msg("go", this.peers.get(closer), null),
                                              new Msg("link", null, null)])

        switch (msg.label) {
            case "go":
                this.sock.close()
                this.mbox.close()
                Logger.closeendpoint(this)
                break
            case "link":
                await this.onlink(msg)
                await this.wait(closer)
                break
        }
    }

    /**
     * Cut with Spill.
     * 
     * @param  {Endpoint} ep1 
     * @param  {Endpoint} ep2 
     * @return {Endpoint}     
     * 
     * Given `EP1` of roles `R1` and `EP2` with roles `R2`, 
     * the function will perform a cut-with-spill by:
     *
     *  1. Choose the (possibly) non-empty mailbox one as `KEEP`, and the other as `KILL`. 
     *  2. Set `KEEP` role to be `R1 \intersect R2`.
     *  3. Connects the network involving `KILL` with the network involving `KEEP`.
     *  4. Updates the peers in the combined network.
     *
     * During a cut of two endpoints, we are in the following situation (case-sensitive): 
     *
     *     {ep1, ...} <=> EP1  <- to be cut with -> EP2 <=> {ep2, ...}
     *
     * And at most one of (`EP1`, `EP2`)'s mailbox must be empty since:
     * 
     *  1. All of the `ep` and `EP` should now be blocked on receive (or similar).
     *  2. And based on the protocol, no two endpoints in the same session 
     *     can send at the same time.
     *  3. There must be someone that has performed all the send and 
     *     then is blocked at a receive (or similar).
     *  4. All others start from a receive.
     *  5. As a result, if someone from `{ep1, ...}` sends, then `EP1` has non-empty mailbox.
     *     And correspondingly, `EP2` must contain the sending role, and therefore `EP2` has 
     *     an empty mailbox, no matter the receiving role is in `EP2` or not.
     *  6. This sending operation(s), should be considered incomplete, and should be replayed 
     *     after the new session is formed. 
     *
     * ##### In-coming Messages:
     *     link      {@link Msg.LinkReply}
     *     linkready {@link Msg.LinkReadyReply}
     *
     * ##### Out-going Messages:
     *     link      {@link Msg.LinkRequest}
     *     linkready {@link Msg.LinkReadyRequest}
     *     go        {@link Msg.Go}
     *     
     */
    static async link(ep1, ep2) {
        // Direct all parties into the `linking` state.
        await ep1._sync(Msg.Link(ep1))
        await ep2._sync(Msg.Link(ep2))

        keep.state = "linking"
        Logger.endpoint(keep)

        kill.state = "linking"
        Logger.endpoint(kill)

        // We re-use the endpoint with non-empty mailbox 
        // for easier replay of "receive", etc.
        const [kill, keep] = (await ep1.mbox.isempty()) ? [ep1, ep2] : [ep2, ep1]

        // New roles and new peers.
        const roles = Set.intersect(ep1.roles, ep2.roles)
        const peers = new Map()

        roles.forEach(role => peers.set(role, keep.id))
        ep1.peers.forEach((uuid, role) => {
            if (!ep1.roles.has(role)) peers.set(role, uuid)
        })
        ep2.peers.forEach((uuid, role) => {
            if (!ep2.roles.has(role)) peers.set(role, uuid)
        })

        // Update to new peers. The new peer map includes essentially every one except `kill`.
        keep.roles = roles
        keep.peers = peers
        Logger.endpoint(keep)

        // Broadcast new peers and broker addresses.
        const mails = keep.mbox.mails()
        keep._broadcast(Msg.LinkReady(keep, peers, []))
        kill._broadcast(Msg.LinkReady(keep, peers, mails))

        // Wait until everyone is ready.
        keep._sync(Msg.LinkReady(keep, peers, []), false)

        // Kill the endpoint manually.
        kill.peers = new Map()
        kill.roles = new Set()
        await kill.close()

        // Activate.
        keep.state = "active"
        Logger.endpoint(keep)
            
        // Go.
        keep._broadcast(Msg.Go(keep))
        return keep
    }

    /**
     * Respond to the `link` request. 
     *
     * @param  {Msg.LinkRequest} msg 
     * @return {Void}
     * 
     * Handling the `link` message. The states to be changed include:
     * 
     * * `peers`: Since we linked two endpoints, the peer map changed.
     * * `brokeraddr`: 
     *      Before linking, there were two leaders, and as a result, two devices.
     *      After linking, they will all be connected to one of the device, 
     *      that originally belongs to the `KEEP`'s leader. 
     *
     * ##### In-coming Messages
     *     link      {@link Msg.LinkRequest}
     *     linkready {@link Msg.LinkReadyRequest}
     *     go        {@link Msg.Go}
     *
     * ##### Out-going Messages
     *     link      {@link Msg.LinkReply}
     *     linkready {@link Msg.LinkReadyReply}
     */
    async onlink(link) {
        // Sycn with the LinkRequest message.
        this.state = "linking"
        Logger.endpoint(this)
        this._onsync(link)
        
        // Wait for the LinkReadyRequest message.
        const linkready = await this.mbox.match(new Msg("linkready", link.sender, null))

        // Doing the update.
        this.peers = new Map(linkready.payload.peers)
        if (linkready.payload.brokeraddr != this.brokeraddr) {
            this.sock.disconnect(this.brokeraddr)
            this.brokeraddr = linkready.payload.brokeraddr
            this.sock.connect(this.brokeraddr)
        }

        // Put forwarded mails in the mailbox.
        linkready.payload.mails.forEach(m => this.mbox.put(m))

        // Reply only back to the KEEP endpoint.
        linkready.sender = linkready.payload.replyto
        this._onsync(linkready)

        // Waiting for `go`.
        await this.mbox.match(new Msg("go", null, null))
        this.state = "active"
        Logger.endpoint(this)
    }
}
module.exports = Endpoint