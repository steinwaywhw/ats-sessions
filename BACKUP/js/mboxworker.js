"use strict"

import { Msg } from "./msg.js"

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class MailboxWorker {
    constructor() {
        this.mbox = []
        setInterval((mbox) => console.log(mbox), 1000, this.mbox)
    }

    on_put(msg) {
        this.mbox.push(msg.payload)
    }

    async on_get() {
        while (!this.mbox.length) {
            await sleep(1)
        }
        return this.mbox.shift()
    }

    async on_match(msg) {
        let label = msg.payload.label,
            sender = msg.payload.sender
        while (true) {
            let index = this.mbox.findIndex(m => m.label == label && m.sender == sender)
            while (index < 0) {
                await sleep(1)
            }
            return this.mbox.splice(index, 1)[0]
        }
    }

    on_close() {
        delete this.mbox
        close()
    }

    async dispatch(msg) {
        switch (msg.label) {
            case "put":
                this.on_put(msg)
                break
            case "get":
                postMessage(await this.on_get())
                break
            case "match":
                postMessage(await this.on_match(msg))
                break
            case "close":
                this.on_close()
                break
        }
    }
}

let worker = new MailboxWorker()
self.onmessage = e => worker.dispatch(e.data)