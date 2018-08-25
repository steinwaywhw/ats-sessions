"use strict"

const nanomsg = require("nanomsg")
const fs      = require("fs")
const chalk   = require("chalk")
const util    = require("util")

const Endpoint = require("./endpoint.js")

const sleep = ms => new Promise((resolve, reject) => setTimeout(resolve, ms))

async function test_subbus() {

	try { fs.unlinkSync("/tmp/devicea.ipc") } catch (e) { console.error(e) }
	try { fs.unlinkSync("/tmp/deviceb.ipc") } catch (e) { console.error(e) }

	const epa = new Endpoint("ipc:///tmp/devicea.ipc", [0])
	const epb = new Endpoint("ipc:///tmp/devicea.ipc", [1])
	const epc = new Endpoint("ipc:///tmp/devicea.ipc", [2,3])

	const epd = new Endpoint("ipc:///tmp/deviceb.ipc", [3])
	const epe = new Endpoint("ipc:///tmp/deviceb.ipc", [0,1,2])

	const full = [0, 1, 2, 3]

	const proca = epa.init(full).then(async () => {
		epa.broadcast("hello")
		await epa.close()
		console.info(chalk.red("Proc A closed."))
	})

	const procb = epb.init(full).then(async () => {
		const r = await epb.receive(0)
		console.info(chalk.red("Proc B received: " + r))
		await epb.wait(0)
		console.info(chalk.red("Proc B closed."))
	})

	// const procc = epc.init(full).then(async () => {
	// 	const r = await epc.receive(0)
	// 	return await epc.wait(0)
	// })

	const procd = epd.init(full).then(async () => {
		const r = await epd.receive(0)
		console.info(chalk.yellow("Proc D received: " + r))
		await epd.wait(0)
		console.info(chalk.yellow("Proc D closed."))
	})

	const proc = Promise.all([epe.init(full), epc.init(full)])
						.then(async () => {
							const ep = await Endpoint.link(epc, epe)
							const r = await ep.receive(0)
							console.info(chalk.green("Proc Link received: " + r))
							await ep.wait(0)
							console.info(chalk.green("Proc Link closed."))
						})

	const logger = require("./recorder.js")
	setTimeout(() => {
		console.log(JSON.stringify(logger.events()))
		nanomsg.term()
		process.exit()
	}, 3000)

	await Promise.all([proca, procb, procd, proc])
	nanomsg.term()
	console.info("Program exited.")
	process.exit()
}

try {
	test_subbus()
} catch (e) {
	console.log(e)
	process.exit(1)
}


