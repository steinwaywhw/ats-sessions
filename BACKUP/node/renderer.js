"use strict"

// d3.selection.prototype.moveToFront = function () {  
//     console.log(this)
//     return this.each(() => { this.parentNode.appendChild(this) })
// }

// d3.selection.prototype.moveToBack = function () {  
//     return this.each(() => { 
//         const firstChild = this.parentNode.firstChild
//         if (firstChild) { this.parentNode.insertBefore(this, firstChild) }
//     })
// }

class DataManager {
    constructor() {
        this.nodes = [] 
        this.links = []
        this.event = []

        this.nodecmp = (a, b) => a.id == b.id
        this.linkcmp = (a, b) => {
            if (a.kind != b.kind) 
                return false 

            if ((a.source == b.source && a.target == b.target) || 
                (a.source == b.target && a.target == b.source))
                return true 

            return false
        }
    }

    endpoints() { return this.nodes.filter(n => n.kind == "endpoint") }
    mailboxes() { return this.nodes.filter(n => n.kind == "mailbox")  }
    mboxlinks() { return this.links.filter(n => n.kind == "mailbox")  }
    msglinks()  { return this.links.filter(n => n.kind == "msg")      }
    peerlinks() { return this.links.filter(n => n.kind == "peer")     }

    deactivate() {
      this.links = this.links.filter(l => l.kind != "msg")
      this.nodes.filter(n => n.active == true).forEach(n => n.active = false)
      this.links.filter(l => l.active == true).forEach(l => l.active = false)
    }

    onnode(node, cmp = this.nodecmp) {
        let index = this.nodes.findIndex(n => cmp(n, node))
        if (index < 0) index = this.nodes.length

        this.nodes[index] = Object.assign(this.nodes[index] || {}, node)
        return index
    }

    onlink(link, cmp = this.linkcmp) {
        let index = this.links.findIndex(l => cmp(l, link))
        if (index < 0) index = this.links.length

        this.links[index] = Object.assign(this.links[index] || {}, link)
        return index
    }
    
    onendpoint(ev) {
        const ep = ev.data
        const index = this.onnode(ep)
        Object.assign(this.nodes[index], { kind: "endpoint", active: true })

        // If there is a change in the peer map.
        if (ep.peers && 
            !ep.peers.every(([_, peer]) => this.links.some(l => {
                const link = {kind: "peer", source: ep.id, target: peer}
                return this.linkcmp(l, link)
            }))) {

            // remove existing peer links
            this.links = this.links.filter(l => !(l.kind == "peer" && [l.source, l.target].includes(ep.id)))

            ep.peers.forEach(([_, peer]) => {
                if (peer != ep.id) {
                    const link = {kind: "peer", source: ep.id, target: peer, time: ev.time.getTime(), active: true}
                    this.onlink(link)
                }
            })
        }

        // If the endpoint is gone.
        if (ep.state == "term") {
            const mbox = this.nodes.find(n => n.endpoint == ep.id)

            this.nodes = this.nodes.filter(n => ![ep.id, mbox.id].includes(n.id))
            this.links = this.links.filter(l => !([l.source, l.target].includes(ep.id)))
            this.links = this.links.filter(l => !([l.source, l.target].includes(mbox.id)))
        }
    }

    onmailbox(ev) {
        const mbox = ev.data
        let index = this.onnode(mbox)
        Object.assign(this.nodes[index], { kind: "mailbox", active: true })

        // If the endpoint is not yet created, fake one first. 
        if (this.nodes.findIndex(n => n.id == mbox.endpoint) < 0) 
            this.onendpoint({data: {id: mbox.endpoint, roles: []}})
        
        // If there's no such link, create it.
        const link = {kind: "mailbox", source: mbox.endpoint, target: mbox.id, time: ev.time.getTime(), active: true}
        if (!this.links.some(l => this.linkcmp(l, link)))
            this.onlink(link)
    }

    onsend(ev) {
        ev.data.to.forEach(t => {
            const link = {kind: "msg", source: ev.data.from, target: t, msg: ev.data.msg, time: ev.time.getTime(), active: true}
            this.onlink(link)
            this.nodes.find(n => n.id == ev.data.from).active = true
        })
    }

    onrecv(ev) {
        const link = {kind: "msg", source: ev.data.from, target: ev.data.to, msg: ev.data.msg, time: ev.time.getTime(), active: true}
        this.onlink(link)
        this.nodes.find(n => n.id == ev.data.to).active = true
    }

    oncloseendpoint(ev) {
        const ep = ev.data 

        this.nodes = this.nodes.filter(n => n.id != ep.id)
        this.links = this.links.filter(l => ![l.source.id, l.target.id].includes(ep.id))
    }

    onclosemailbox(ev) {
        const mbox = ev.data

        console.log(this.links)
        this.nodes = this.nodes.filter(n => n.id != mbox.id)
        this.links = this.links.filter(l => ![l.source.id, l.target.id].includes(mbox.id))
        console.log(this.links)

    }

    on(ev) {
        this.deactivate()
        this.event[0] = ev 

        switch (ev.label) {
        case "endpoint":
            this.onendpoint(ev)
            break
        case "mailbox":
            this.onmailbox(ev)
            break
        case "send":
            this.onsend(ev)
            break
        case "recv":
            this.onrecv(ev)
            break
        case "closeendpoint":
            this.oncloseendpoint(ev)
            break 
        case "closemailbox": 
            this.onclosemailbox(ev)
            break
        }
    }
}


class SVGManager {
    constructor(svg, log) {
        this.svg = svg
        this.log = log

        this.reset()
    }

    reset() {
        this.svg.selectAll("*").remove()
        this.log.html(null)

        this.peerlinks = this.svg.append("g").attr("class", "peerlinks").property("__data__", {zindex: 1})
        this.mboxlinks = this.svg.append("g").attr("class", "mboxlinks").property("__data__", {zindex: 2})
        this.msglinks  = this.svg.append("g").attr("class", "msglinks").property("__data__", {zindex: 3})
        this.mailboxes = this.svg.append("g").attr("class", "mailboxes").property("__data__", {zindex: 4})
        this.endpoints = this.svg.append("g").attr("class", "endpoints").property("__data__", {zindex: 5})
    }

    zindex() {
        this.svg.selectAll("g").sort((a, b) => a.zindex - b.zindex)
        this.svg.selectAll("text").raise()
    }

    circle(svg, data) {
        const nodes = svg.selectAll("circle").data(data, d => d.id)
        nodes.enter().append("circle").attr("r", 10)
        nodes.exit().remove()

        const labels = svg.selectAll("text").data(data, d => d.id)
        labels.enter().append("text")
        labels.exit().remove()

        nodes.attr("cx", d => d.x).attr("cy", d => d.y)
        labels.attr("x", d => d.x + 10).attr("y", d => d.y - 10)

        return [nodes, labels]
    }

    line(svg, data) {
        const links = svg.selectAll("line").data(data)
        links.enter().append("line")
        links.exit().remove()
        links.attr("x1", d => d.source.x).attr("y1", d => d.source.y).attr("x2", d => d.target.x).attr("y2", d => d.target.y)

        return links
    }

    renderEndpoints(data) {
        const [nodes, labels] = this.circle(this.endpoints, data)

        nodes.classed("endpoint", true).classed("active", d => d.active)
        labels.text(d => `[${d.roles}]@${d.state}`)
    }
  
    renderMailboxes(data) {
        const [nodes, labels] = this.circle(this.mailboxes, data)

        nodes.classed("mailbox", true).classed("active", d => d.active)
        labels.text(d => JSON.stringify(d.mails.map(m => m.label)))
    }

    renderMboxlinks(data) {
        const links = this.line(this.mboxlinks, data)
        links.classed("mboxlink", true).classed("active", d => d.active)
    }

    renderMsglinks(data) {
        const links = this.line(this.msglinks, data)
        links.classed("msglink", true).classed("active", d => d.active)

        const labels = this.msglinks.selectAll("text").data(data, d => d.id)
        labels.enter().append("text").merge(labels)
              .text(d => d.msg.label)
              .attr("x", d => (d.source.x + d.target.x)/2 + 10)
              .attr("y", d => (d.source.y + d.target.y)/2 - 10)

        labels.exit().remove()

    }

    renderPeerlinks(data) {
        const links = this.line(this.peerlinks, data)
        links.classed("peerlink", true).classed("active", d => d.active)
    }

    renderLogs(data) {
        const text = this.log.selectAll("code").data(data)
        text.enter().append("code").merge(text).classed("json", true).text(d => JSON.stringify(d, null, 2))
    }
}

class SessionRenderer {
    constructor(events, svg, log) {

        this.events = events
        this.step = -1
   
        // The force simulation layout.
        this.force = d3.forceSimulation()
                       .force("charge", d3.forceManyBody().strength(-1000))
                       .force("collide", d3.forceCollide(d => d.r * 4).iterations(16))
                       .force("x", d3.forceX())
                       .force("y", d3.forceY())
                       .force("mailbox", d3.forceLink().id(d => d.id))
                       .force("msg",     d3.forceLink().id(d => d.id))
                       .force("peer",    d3.forceLink().id(d => d.id))

        this.dm = new DataManager()
        this.sm = new SVGManager(d3.select(svg), d3.select(log))
    }

    resize(w, h) {
        this.force.force("center", d3.forceCenter(w/2, h/2))
        this.force.restart()
        this.force.alpha(1)
    }

    reset(events) {
        this.sm.reset()
        this.dm     = new DataManager()

        this.step   = -1
        this.events = events
    }

    ontick() {
        const sm = this.sm 
        const dm = this.dm 
        
        sm.renderPeerlinks(dm.peerlinks())
        sm.renderMboxlinks(dm.mboxlinks())
        sm.renderMsglinks(dm.msglinks())
        sm.renderMailboxes(dm.mailboxes())
        sm.renderEndpoints(dm.endpoints())

        sm.zindex()
    }

    onend() {
        this.sm.zindex()
    }

    forward() {

        this.step += 1

        const ev = this.events[this.step]
        console.log(ev)
        this.dm.on(ev)
        
        this.sm.renderPeerlinks(this.dm.peerlinks())
        this.sm.renderMboxlinks(this.dm.mboxlinks())
        this.sm.renderMsglinks(this.dm.msglinks())
        this.sm.renderMailboxes(this.dm.mailboxes())
        this.sm.renderEndpoints(this.dm.endpoints())
        this.sm.renderLogs(this.dm.event)


        this.force.nodes(this.dm.nodes)
        this.force.force("mailbox").id(d => d.id).links(this.dm.mboxlinks())
        this.force.force("msg").id(d => d.id).links(this.dm.msglinks())
        this.force.force("peer").id(d => d.id).links(this.dm.peerlinks())

        this.force.on("tick", () => this.ontick())
        this.force.restart()
        this.force.alpha(1)
    }
}

export { SessionRenderer }