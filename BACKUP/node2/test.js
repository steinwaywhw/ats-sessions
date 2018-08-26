"use strict"

const transport = require('./transport.js')
const Endpoint  = require('./endpoint.js')
const Session  = require('./session.js')

const util      = require('./util.js')
const Msg       = require('./msg.js')
const recorder  = require('./recorder.js')
const nanomsg   = require('nanomsg')

const addr = 'inproc://bus'
const name1 = 'session1'
const name2 = 'session2'
const name3 = 'session3'

const handler = msg => console.log(msg)
const onerror = e => {
	console.error(e, e.stack.split('\n'))
}

async function test_broadcast() {
	const addr = 'inproc://bus1'

	const device = transport.NanomsgBroker(addr)
	await util.sleep(100)

	const s1 = nanomsg.socket('bus')
	const s2 = nanomsg.socket('bus')

	s1.setEncoding('utf8')
	s1.connect(addr)
	s1.on('data', handler)

	s2.setEncoding('utf8')
	s2.connect(addr)
	s2.on('data', handler)

	s1.send('hello from s1')
	s2.send('hello from s2')

	await util.sleep(100)
	s1.close()
	s2.close()

	device.close()
}

async function test2() {
	const a1 = 'inproc://bus1'
	const a2 = 'inproc://bus2'

	const device1 = transport.NanomsgBroker(a1)
	const device2 = transport.NanomsgBroker(a2)
	await util.sleep(100)

	const s1 = nanomsg.socket('bus')
	const s2 = nanomsg.socket('bus')
	const ss = nanomsg.socket('bus')

	s1.setEncoding('utf8')
	s1.connect(a1)
	s1.on('data', handler)

	s2.setEncoding('utf8')
	s2.connect(a2)
	s2.on('data', handler)

	ss.setEncoding('utf8')
	ss.connect(a1)
	ss.connect(a2)
	ss.on('data', handler)

	s1.send('hello from bus1')
	s2.send('hello from bus2')

	await util.sleep(100)
	s1.close()
	s2.close()
	ss.close()

	device1.close()
	device2.close()
}

async function test_accept_request() {

	const device = transport.NanomsgBroker(addr)
	await util.sleep(100)

	const ep1 = new Endpoint(name1, [0,2])
	const ep2 = new Endpoint(name1, [1])
	const ep3 = new Endpoint(name1, [3,4,5])

	const p1 = ep1.accept(addr, [0,1,2,3,4,5])
	const p2 = ep2.request(addr)
	const p3 = ep3.request(addr)

	await Promise.all([p1, p2, p3])

	ep1.close()
	ep2.close()
	ep3.close()
	device.close()

	console.log('Done')
}


async function test_forward() {

	const device = transport.NanomsgBroker(addr)
	await util.sleep(100)

	const ep1 = new Endpoint(name1, [0,2])
	const ep2 = new Endpoint(name1, [1])
	const ep3 = new Endpoint(name1, [3,4,5])

	const p1 = ep1.accept(addr, [0,1,2,3,4,5])
	const p2 = ep2.request(addr)
	const p3 = ep3.request(addr)

	const epa = new Endpoint(name2, [0,1,2])
	const epb = new Endpoint(name2, [3,4])
	const epc = new Endpoint(name2, [5])

	const pa = epa.accept(addr, [0,1,2,3,4,5])
	const pb = epb.request(addr)
	const pc = epc.request(addr)

	await Promise.all([p1, p2, p3, pa, pb, pc])

	console.log('Done')

	const thread1 = new Promise((ok, no) => {
		ep1.send(new Msg('msg', [0], [5], 'hello'))
		ok()
	})

	const thread2 = new Promise(async (ok, no) => {
		const msg = await epc.receive()
		console.log(msg)
		ok()
	})

	const stop = Endpoint.forward(ep3, epa)

	await Promise.all([thread1, thread2])
	await stop()

	ep1.close()
	ep2.close()
	ep3.close()
	epa.close()
	epb.close()
	epc.close()
	 
	device.close()
}

async function test_2party2cut() {

	const device = transport.NanomsgBroker(addr)
	await util.sleep(100)

	const ep1 = new Endpoint(name1, [1])
	const ep2 = new Endpoint(name1, [2])

	const p1 = ep1.accept(addr, [1,2])
	const p2 = ep2.request(addr)

	const epa = new Endpoint(name2, [1])
	const epb = new Endpoint(name2, [2])

	const pa = epa.accept(addr, [1,2])
	const pb = epb.request(addr)

	await Promise.all([p1, p2, pa, pb])

	console.log('Ready')

	const thread1 = new Promise(async (ok, no) => {
		ep1.send(new Msg('msg', [1], [2], 'hello'))
		console.log((await ep1.receive(util.pattern('msg', 2))).payload)
		ok(ep1)
	})

	const thread2 = new Promise(async (ok, no) => {
		console.log((await epb.receive(util.pattern('msg', 1))).payload)
		epb.send(new Msg('msg', [2], [1], 'world'))
		ok(epb)
	})

	const thread3 = new Promise(async (ok, no) => {
		const [keep, kill] = await Endpoint.link(ep2, epa, [1,2])
		// if (keep.roles.size == 0)
			// keep.close()
		ok(keep)
	})

	const [x, y, z] = await Promise.all([thread1, thread2, thread3])

	x.close()
	y.close()
	z.close()
	 
	device.close()
}

async function test_3party2cutspill() {

	const device = transport.NanomsgBroker(addr)
	await util.sleep(100)

	const ep1 = new Endpoint(name1, [1])
	const ep2 = new Endpoint(name1, [2,3])

	const p1 = ep1.accept(addr, [1,2,3])
	const p2 = ep2.request(addr)

	const epa = new Endpoint(name2, [1,2])
	const epb = new Endpoint(name2, [3])

	const pa = epa.accept(addr, [1,2,3])
	const pb = epb.request(addr)

	await Promise.all([p1, p2, pa, pb])

	console.log('Ready')

	const thread1 = new Promise(async (ok, no) => {
		ep1.send(new Msg('msg', [1], [2], 'hello 1->2'))
		ep1.send(new Msg('msg', [1], [3], 'hello 1->3'))
		ep1.send(new Msg('msg', [1], [2,3], 'hello 1->2,3'))
		console.log((await ep1.receive(util.pattern('msg', 3))).payload)
		console.log((await ep1.receive(util.pattern('msg', 2))).payload)
		ok(ep1)
	})

	const thread2 = new Promise(async (ok, no) => {
		console.log((await epb.receive(util.pattern('msg', 1))).payload)
		console.log((await epb.receive(util.pattern('msg', 1))).payload)
		epb.send(new Msg('msg', [3], [1], 'world 3->1'))
		ok(epb)
	})

	const thread3 = new Promise(async (ok, no) => {
		const [keep, kill] = await Endpoint.link(ep2, epa, [1,2,3])
		console.log(keep.toJSON())
		console.log((await keep.receive(util.pattern('msg', 1))).payload)
		console.log((await keep.receive(util.pattern('msg', 1))).payload)
		keep.send(new Msg('msg', [2], [1], 'world 2->1'))
		ok(keep)
	})

	const [x, y, z] = await Promise.all([thread1, thread2, thread3])

	x.close()
	y.close()
	z.close()
	 
	device.close()
}

async function test_mult3party2cutspill() {

	const device = transport.NanomsgBroker(addr)
	await util.sleep(100)

	const full = [1,2,3,4]

	const ep1 = new Endpoint(name1, [1])
	const ep2 = new Endpoint(name1, [2,3,4])

	const p1 = ep1.accept(addr, full)
	const p2 = ep2.request(addr)

	const epa = new Endpoint(name2, [1,2])
	const epb = new Endpoint(name2, [3,4])

	const pa = epa.accept(addr, full)
	const pb = epb.request(addr)

	const epx = new Endpoint(name3, [1,2,4])
	const epy = new Endpoint(name3, [3])

	const px = epx.accept(addr, full)
	const py = epy.request(addr)

	await Promise.all([p1, p2, pa, pb, px, py])

	console.log('Ready')

	const thread1 = new Promise(async (ok, no) => {
		ep1.send(new Msg('msg', [1], [2], 'hello 1->2'))
		ep1.send(new Msg('msg', [1], [3], 'hello 1->3'))
		ep1.send(new Msg('msg', [1], [4], 'hello 1->4'))
		console.log((await ep1.receive(util.pattern('msg', 4))).payload)
		console.log((await ep1.receive(util.pattern('msg', 3))).payload)
		console.log((await ep1.receive(util.pattern('msg', 2))).payload)
		ok(ep1)
	})

	const thread2 = new Promise(async (ok, no) => {
		console.log((await epy.receive(util.pattern('msg', 1))).payload)
		epy.send(new Msg('msg', [3], [1], 'world 3->1'))
		ok(epy)
	})

	const thread3 = new Promise(async (ok, no) => {
		const [keep, kill] = await Endpoint.link(ep2, epa, full)
		console.log((await keep.receive(util.pattern('msg', 1))).payload)
		keep.send(new Msg('msg', [2], [1], 'world 2->1'))
		ok(keep)
	})

	const thread4 = new Promise(async (ok, no) => {
		const [keep, kill] = await Endpoint.link(epb, epx, full)
		console.log((await keep.receive(util.pattern('msg', 1))).payload)
		keep.send(new Msg('msg', [4], [1], 'world 4->1'))
		ok(keep)
	})

	const [a,b,c,d] = await Promise.all([thread1, thread2, thread3, thread4])

	a.close()
	b.close()
	c.close()
	d.close()
	 
	device.close()
}

async function testss() {
	const device = transport.NanomsgBroker(addr)
	await util.sleep(100)

	const full = [1,2,3,4]

	const ep1 = new Session(name1, null, [1])
	const ep2 = new Session(name1, null, [2,3,4])

	const p1 = ep1.accept(addr, full)
	const p2 = ep2.request(addr)

	const epa = new Session(name2, null, [1,2])
	const epb = new Session(name2, null, [3,4])

	const pa = epa.accept(addr, full)
	const pb = epb.request(addr)

	const epx = new Session(name3, null, [1,2,4])
	const epy = new Session(name3, null, [3])

	const px = epx.accept(addr, full)
	const py = epy.request(addr)

	await Promise.all([p1, p2, pa, pb, px, py])

	console.log('Ready')

	const thread1 = new Promise(async (ok, no) => {
		ep1.send(1, [2], 'hello 1->2')
		ep1.send(1, [3], 'hello 1->3')
		ep1.send(1, [4], 'hello 1->4')
		console.log(await ep1.receive(4))
		console.log(await ep1.receive(3))
		console.log(await ep1.receive(2))
		ok(ep1)
	})

	const thread2 = new Promise(async (ok, no) => {
		console.log(await epy.receive(1))
		epy.send(3, [1], 'world 3->1')
		ok(epy)
	})

	const thread3 = new Promise(async (ok, no) => {
		const [keep, kill] = await Session.link(ep2, epa)
		console.log(await keep.receive(1))
		keep.send(2, [1], 'world 2->1')
		ok(keep)
	})

	const thread4 = new Promise(async (ok, no) => {
		const [keep, kill] = await Session.link(epb, epx)
		console.log(await keep.receive(1))
		keep.send(4, [1], 'world 4->1')
		ok(keep)
	})

	const [a,b,c,d] = await Promise.all([thread1, thread2, thread3, thread4])

	a.close()
	b.close()
	c.close()
	d.close()

	device.close()
}


async function bug() {
    var outside
    try {
        outside = await Promise.race([42])
        var inside = await Promise.race([42])
    } catch (e) {
        
    }
}

try {
	// setTimeout(() => recorder.replay(), 1000)
	// test_broadcast()
	// test_3party2cutspill()
		// .then((_) => recorder.dump())
		// .catch((_) => recorder.dump())
		// .finally(() => recorder.dump())
	testss()
	// test_forward()
	// bug()
} catch (e) {
	
	console.error(e, e.stack.split('\n'))
} finally {
	
}


