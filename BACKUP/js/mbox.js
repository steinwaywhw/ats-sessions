"use strict"

import { Msg } from "./msg.js"

class Mailbox {
    constructor() {
        this.worker = new Worker("mboxworker.js")
    }

    put(msg) {
        this.worker.postMessage(new Msg("put", undefined, msg))
    }

    async get() {
        let request = new Promise(resolve => {
            this.worker.onmessage = resolve
            this.worker.postMessage(new Msg("get", undefined, undefined))
        })

        let response = await request
        return response.data
    }

    async match(label, sender) {
        let request = new Promise(resolve => {
            this.worker.onmessage = resolve
            this.worker.postMessage(new Msg("match", undefined, {
                label: label,
                sender: sender
            }))
        })

        let response = await request
        return response.data
    }

    close() {
        this.worker.postMessage(new Msg("close", undefined, undefined))
    }
}

export { Mailbox }