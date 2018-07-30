'use strict'

const _        = require('./collection.js')
const readline = require('readline-sync')

class Recorder {
	constructor() {
		this.buffer = []
	}

	log(ep) {
		const obj = {id     : ep.id, 
			         name   : ep.name,
		             roles  : ep.roles, 
		             peers  : ep.peers,
		             state  : ep.state,
		             buffer : ep.buffer.map(m => `${m.label}/${m.sender}`),
		             trans  : ep.trans.buffer.map(m => `${m.label}/${m.sender.split('/')[0]}`)}

		this.buffer.push(obj)
	}

	dump() {
		console.log('Dumping recorded session ...')
		console.log(JSON.stringify(this.buffer, null, 2))
	}

	replay() {
		const eps = new Map()
		for (var i = 0; i < this.buffer.length; i++) {
			let obj = this.buffer[i]
			eps.set(obj.id, {name: `${obj.name}/${JSON.stringify(obj.roles)}`, state: obj.state, buffer: [], trans: []})
		}

		for (var i = 0; i < this.buffer.length; i++) {
			let obj = this.buffer[i]
			eps.set(obj.id, {name: `${obj.name}/${JSON.stringify(obj.roles)}`, state: obj.state, buffer: obj.buffer, trans: obj.trans})
			console.log(`=============\nReplay: ${i}:`)
			console.table([...eps.values()])
			readline.question('')
		}
	}

	current() {
		// return 
		
		const eps = new Map()
		for (var i = 0; i < this.buffer.length; i++) {
			let obj = this.buffer[i]
			eps.set(obj.id, {name: `${obj.name}/${JSON.stringify(obj.roles)}`, state: obj.state, buffer: obj.buffer, trans: obj.trans})
		}
		console.table([...eps.values()])
	}
}


const key = Symbol.for('Session.Recorder')

if (Object.getOwnPropertySymbols(global).indexOf(key) < 0)
	global[key] = new Recorder()

module.exports = global[key]
