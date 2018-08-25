"use strict"

class Socket {
    constructor(proto) {
        this.proto = proto
    }

    bind(addr) {
        throw "not supported"
    }

    connect(addr) {
        try {
            this.sock = new WebSocket(addr, this.proto)
        } catch ( e ) {
            console.log(e)
        }
    }

    close() {
        this.sock.close()
    }

    set onmessage(handler) {
        this.sock.onmessage = e => {
            let reader = new FileReader()
            reader.onloadend = () => {
                console.log(`recv: ${reader.result}`)
                handler(JSON.parse(reader.result))
            }
            reader.readAsText(e.data)
        }
    }

    get onmessage() {
        return this.sock.onmessage
    }

    send(payload) {
        console.log(`send: ${JSON.stringify(payload)}`)
        this.sock.send(JSON.stringify(payload))
    }
}


export { Socket }