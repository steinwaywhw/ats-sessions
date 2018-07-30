"use strict"

const _ = require('./collection.js')

// nodejs util library
let util = require("util")

util.sleep = ms => 
	new Promise((resolve, reject) => setTimeout(resolve, ms))

util.waituntil = async (cond) => {
	while (!cond()) {
		await util.sleep(1)
	}
} 

util.wait = (promise, ms) => new Promise(async (resolve, reject) => {
	setTimeout(reject(promise), ms)
	resolve(await promise)
})

/* For pattern matching in message receiving */

util.pattern = (label=null, sender=null, pred=null) => {
	return {label: label, sender: sender, pred: pred}
}

util.preds = function (patterns) {

	function build_condition ({label, sender, pred}) {
		if (pred == null)
			pred = msg => true

		var cond

		if (label == null && sender == null) 
			cond = msg => true
		else if (label && sender == null)
			cond = msg => label == msg.label
		else if (label == null && sender)
			cond = msg => sender == msg.sender
		else
			cond = msg => label == msg.label && sender == msg.sender

		return msg => pred(msg) && cond(msg)
	}

	if (!patterns)
		return msg => true 

	if (!Array.isArray(patterns))
		return build_condition(patterns)

	if (patterns.length == 0)
		return msg => true

	return patterns.foldr(msg => false, (p, preds) => msg => build_condition(p)(msg) || preds(msg))
}

module.exports = util