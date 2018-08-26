"use strict"

class Msg {
    constructor(label, sender, payload) {
        this.label = label
        this.sender = sender
        this.payload = payload
    }
}

export { Msg }