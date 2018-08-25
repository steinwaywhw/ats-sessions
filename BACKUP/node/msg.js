/**
 * A common message format.
 */
class Msg {

    /**
     * @param  {("init"|"ready"|"link"|"linkready"|"go"|"send"|"close")} label 
     * @param  {uuid}         sender   
     * @param  {Object}       payload  
     * @param  {Array<uuid>}  receivers=null 
     * @return {Msg}         
     */
    constructor(label, sender, payload, receivers = []) {
        this.label = label
        this.sender = sender
        this.payload = payload
        this.receivers = receivers
    }   

    /**
     * Broadcasting message for announcing the existence of an endpoint. 
     * Used to initiate a session.
     * 
     * @typedef  {Msg}           Msg.Init
     * @property {"init"}        label
     * @property {uuid}          sender    - Announce the endpoint id.
     * @property {Array<Int>}    payload   - The roles played by the endpoint.
     * @property {Array<uuid>}   receivers - Empty array.
     */
    
    /**
     * Init message.
     * @param  {Endpoint} ep
     * @return {Msg.Init}
     */
    static Init(ep) {
        return new Msg("init", ep.id, ep.roles)
    }

    /**
     * This message is for the leader to get all followers ready by supplying the peer map.
     * 
     * @typedef  {Msg}           Msg.ReadyRequest
     * @property {"ready"}       label
     * @property {uuid}          sender
     * @property {Map<Int,uuid>} payload   - The peers map as determined by the leader.
     * @property {Array<uuid>}   receivers - All the intended receivers
     */
    
    /**
     * The follower announce to the leader that it is ready.
     * 
     * @typedef  {Msg}           Msg.ReadyReply
     * @property {"ready"}       label
     * @property {uuid}          sender
     * @property {null}          payload   - The peers map as determined by the leader.
     * @property {Array<uuid>}   receivers - One element array containing the leader's id.
     */
    
    /**
     * ReadyRequest message.
     * @param  {Endpoint} ep  
     * @param  {Map<Int,uuid>} peers
     * @return {Msg.ReadyRequest}
     */
    static Ready(ep, peers) {
        return new Msg("ready", ep.id, peers, new Set(peers.values()))
    }

    /**
     * This message is for the leader to green light all followers.
     * 
     * @typedef  {Msg}           Msg.Go
     * @property {"go"}          label
     * @property {uuid}          sender
     * @property {null}          payload   
     * @property {Array<uuid>}   receivers - All the intended receivers
     */
    
    /**
     * Go message.
     * @param  {Endpoint} ep
     * @return {Msg.Go}
     */
    static Go(ep) {
        return new Msg("go", ep.id, null, new Set(ep.peers.values()))
    }

    /**
     * The primary data message being exchanged. 
     *
     * @typedef  {Msg}         Msg.Send
     * @property {"send"}      label
     * @property {uuid}        sender
     * @property {Object}      payload   - JSON serializable object.
     * @property {Array<uuid>} receivers
     */

    /**
     * Ack for the previous "send", used to implement synchrounus "send".
     *
     * @typedef  {Msg}         Msg.Recv
     * @property {"recv"}      label
     * @property {uuid}        sender
     * @property {null}        payload   - JSON serializable object.
     * @property {Array<uuid>} receivers - One element array that contains the sender's uuid.
     */

    /**
     * The message to direct everyone into the linking state.
     *
     * @typedef  {Msg}           Msg.LinkRequest
     * @property {"link"}        label
     * @property {uuid}          sender
     * @property {null}          payload
     * @property {Array<uuid>}   receivers    
     */
    
    /**
     * The message to acknowledge that it is in the linking state.
     *
     * @typedef  {Msg}           Msg.LinkReply
     * @property {"link"}        label
     * @property {uuid}          sender
     * @property {null}          payload   
     * @property {Array<uuid>}   receivers - One element array containing the original requester.
     */
    
    /**
     * LinkRequest message.
     * @param {Endpoint} ep 
     */
    static Link(ep) {
        return new Msg("link", ep.id, null, new Set(ep.peers.values()))
    }

    /**
     * The message to updates the peer map.
     *
     * @typedef  {Msg}           Msg.LinkReadyRequest
     * @property {"linkready"}   label
     * @property {uuid}          sender
     * @property {Array<uuid>}   receivers    
     *  
     * @property {Object}        payload
     * @property {String}        payload.brokeraddr - The new broker address to connect to.
     * @property {Map<Int,uuid>} payload.peers      - The new peer map.
     * @property {uuid}          payload.replyto    - The coordinator for this link.
     */
    
    /**
     * The message to acknowledge that the the follower is updated.
     *
     * @typedef  {Msg}           Msg.LinkReadyReply
     * @property {"linkready"}   label
     * @property {uuid}          sender
     * @property {null}          payload   
     * @property {Array<uuid>}   receivers - One element array containing the link initiator.
     */
    
    /**
     * LinkReady message.
     * @param  {Endpoint}      keep - The endpoint to keep in a link.
     * @param  {Map<Int,uuid>} peers 
     * @param  {Array<Msg>}    mails
     * @return {Msg.LinkReady}
     */
    static LinkReady(keep, peers, mails) {
        return new Msg("linkready", 
                        keep.id, 
                        {brokeraddr: keep.brokeraddr, peers: peers, replyto: keep.id, mails: mails}, 
                        new Set(peers.values()))
    }


    /**
     * The message is used by the leader to request to close.
     *
     * @typedef  {Msg}         Msg.CloseRequest
     * @property {"close"}     label
     * @property {uuid}        sender
     * @property {null}        payload 
     * @property {Array<uuid>} receivers 
     */
    
    /**
     * The message is used by followers to acknowledge to close.
     *
     * @typedef  {Msg}         Msg.CloseReply
     * @property {"close"}     label
     * @property {uuid}        sender
     * @property {null}        payload 
     * @property {Array<uuid>} receivers - A single element array containing the closer's endpoint id.     
     */
    
    /**
     * CloseRequest
     * @param  {Endpoint} ep 
     * @return {Msg.CloseRequest}
     */
    static Close(ep) {
        return new Msg("close", ep.id, null, new Set(ep.peers.values()))
    }
}





module.exports = Msg