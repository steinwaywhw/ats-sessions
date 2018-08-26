'use strict'

import * as d3 from "d3"

class DataStore {
	constructor(recorder) {
		this.recorder = recorder
		this.reset()
	}

	reset() {
		this.links = new Map()
		this.nodes = new Map()
	}

	pos(p) {
		this.reset()

		const buffer = this.recorder.buffer
		assert(p >= 0 && p < buffer.length)

		for (var i = 0; i < buffer.length; i++) {
			let obj = buffer[i]
			this.nodes.set(obj.id, {name: `${obj.name}/${JSON.stringify(obj.roles)}`, buffer: obj.buffer, trans: obj.trans})
			
			obj.peers.forEach((uuid, role) => {
				if (!obj.roles.has(role))) {
					let link = [obj.id, uuid]
					link.sort()
					linkid = JSON.stringify(link)

					this.links.set(linkid, {type: 'peer', src: link[0], dst: link[1]})
				}
			})
		}

		for (let key of this.links.keys()) {
			const {src, dst} = this.links.get(key)
			if ([src, dst].some(id => !this.nodes.haskey(id)))
				this.links.delete(key)
		}
	}
}



class Renderer {
	constructor(data, svg, log) {
		this.data = data

		this.svg = svg 
		this.log = log
	}

	reset() {
        this.svg.selectAll('*').remove()
        this.log.html(null)

        this.peerlinks = this.svg.append('g').addClass('peerlinks').property('__data__', {zindex: 1})
        this.endpoints = this.svg.append('g').addClass('endpoints').property('__data__', {zindex: 5})
        // this.mboxlinks = this.svg.append('g').attr('class', 'mboxlinks').property('__data__', {zindex: 2})
        // this.msglinks  = this.svg.append('g').attr('class', 'msglinks').property('__data__', {zindex: 3})
        // this.mailboxes = this.svg.append('g').attr('class', 'mailboxes').property('__data__', {zindex: 4})
    }

    zindex() {
        this.svg.selectAll('g').sort((a, b) => a.zindex - b.zindex)
        this.svg.selectAll('text').raise()
    }

    circle(svg, data) {
        const nodes = svg.selectAll('circle').data(data, d => d.id)
        nodes.enter().append('circle').attr('r', 10)
        nodes.exit().remove()

        const labels = svg.selectAll('text').data(data, d => d.id)
        labels.enter().append('text')
        labels.exit().remove()

        nodes.attr('cx', d => d.x).attr('cy', d => d.y)
        labels.attr('x', d => d.x + 10).attr('y', d => d.y - 10)

        return [nodes, labels]
    }

    line(svg, data) {
        const links = svg.selectAll('line').data(data)
        links.enter().append('line')
        links.exit().remove()
        links.attr('x1', d => d.source.x).attr('y1', d => d.source.y).attr('x2', d => d.target.x).attr('y2', d => d.target.y)

        return links
    }

    renderEndpoints(data) {
        const [nodes, labels] = this.circle(this.endpoints, data)

        nodes.classed('endpoint', true).classed('active', d => d.active)
        labels.text(d => `[${d.roles}]@${d.state}`)
    }
  
    renderMailboxes(data) {
        const [nodes, labels] = this.circle(this.mailboxes, data)

        nodes.classed('mailbox', true).classed('active', d => d.active)
        labels.text(d => JSON.stringify(d.mails.map(m => m.label)))
    }

    renderMboxlinks(data) {
        const links = this.line(this.mboxlinks, data)
        links.classed('mboxlink', true).classed('active', d => d.active)
    }

    renderMsglinks(data) {
        const links = this.line(this.msglinks, data)
        links.classed('msglink', true).classed('active', d => d.active)

        const labels = this.msglinks.selectAll('text').data(data, d => d.id)
        labels.enter().append('text').merge(labels)
              .text(d => d.msg.label)
              .attr('x', d => (d.source.x + d.target.x)/2 + 10)
              .attr('y', d => (d.source.y + d.target.y)/2 - 10)

        labels.exit().remove()

    }

    renderPeerlinks(data) {
        const links = this.line(this.peerlinks, data)
        links.classed('peerlink', true).classed('active', d => d.active)
    }

    renderLogs(data) {
        const text = this.log.selectAll('code').data(data)
        text.enter().append('code').merge(text).classed('json', true).text(d => JSON.stringify(d, null, 2))
    }
}