"use strict"

class Msg {
    constructor(label, sender, receivers, payload, skipsendercheck=false) {

        this.label     = label       

        /**
         * Sender roles/uuid.
         * @type {Array<Int>|uuid}
         */
        this.sender    = sender

        /**
         * Receivers roles/uuids.
         * 
         * @type {Array<Int|uuid>}
         */
        this.receivers = receivers 

        /**
         * Payload 
         */
        this.payload   = payload

        /**
         * Whether this message is out-of-session. 
         * This property will only exist if it is indeed out-of-session.
         * @type {Boolean}
         */
         if (skipsendercheck)
            this.skipsendercheck = skipsendercheck

    }

    static isMsg(msg) {

        try {
            if (!('label' in msg))
                return false 
            if (!('sender' in msg))
                return false 
            if (!('receivers' in msg))
                return false 
            if (!('payload' in msg))
                return false 

            return true
        } catch(e) {
            return false
        }
    }

    static skipSenderCheck(msg) {
        return Msg.isMsg(msg) && msg.skipsendercheck
    }
}

module.exports = Msg