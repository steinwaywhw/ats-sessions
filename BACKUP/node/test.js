"use strict"

const nanomsg = require("nanomsg")
const fs      = require("fs")
const chalk   = require("chalk")
const uuidv4  = require("uuid/v4")
const util    = require("util")

const Endpoint = require("./endpoint.js")

const C = 1
const S = 0

async function create(fn, file=`/tmp/${uuidv4()}.ipc`) {
	try { fs.unlinkSync(file) } catch (e) {}

	const addr   = "ipc://" + file
	const server = new Endpoint(addr, [S])
	const client = new Endpoint(addr, [C])

	server.init([S, C]).then(async () => { await fn(server) })
	await client.init([S, C])
	return client
}


async function empty() {
	const server = async (out) => {
		const choice = await out.receive(C)
		switch (choice) {
			case "right": 
				await out.close()
				break 
			case "left":
				const x    = await out.receive(C)
				const tail = await empty()
				const inp  = await elem(tail, x)
				console.log("here")

				const ep = await Endpoint.link(inp, out)
				await ep.close()
				break
		}
	}

	return await create(server)
}

async function elem(tail, e) {
	const server = async (out, inp) => {
		const choice = await out.receive(C)
		switch (choice) {
			case "right":
				out.broadcast(e)
				const ep = await Endpoint.link(out, inp)
				await ep.close()
				break
			case "left":
				const y = await out.receive(C)
				inp.broadcast("left")
				inp.broadcast(y)
				await server(out, inp)
				break
		}
	}

	return await create(out => {
		console.debug("Here in the elem")
		server(out, tail) 
	})
}

async function enq(queue, x) {
	queue.broadcast("left")
	queue.broadcast(x)
}

async function deq(queue) {
	queue.broadcast("right")
	return await queue.receive(S)
}

async function free(queue) {
	queue.broadcast("right")
 	await queue.wait(S)
}

async function main() {
	let queue = await empty()
	let x     = 0

	await enq(queue, 1)
	await enq(queue, 2)
	x = await deq(queue)
	console.info(x)
	x = await deq(queue)
	console.info(x)
	await free(queue)

	
	nanomsg.term()
	process.exit()
}


const logger = require("./recorder.js")
setTimeout(() => {
	console.log(JSON.stringify(logger.events()))
	nanomsg.term()
	process.exit()
}, 10000)

try {
	main()
} catch (e) {
	console.log(util.inspect(e))
}