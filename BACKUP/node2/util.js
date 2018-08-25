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

	function build ({label, sender, pred}) {
		let cond

		if (label == null && sender == null) 
			cond = msg => true
		else if (label && sender == null)
			cond = msg => label == msg.label
		else if (label == null && sender)
			cond = msg => sender == msg.sender
		else
			cond = msg => label == msg.label && sender == msg.sender

		if (pred == null) 
			return msg => cond(msg)
		else
			return msg => cond(msg) && pred(msg) 
	}

	if (!patterns)
		return msg => true 

	if (!Array.isArray(patterns))
		return build(patterns)

	if (patterns.length == 0)
		return msg => true

	// Use foldr and short-circuit of || to do left-to-right check.
	// The patterns are matched from patterns[0] to patterns[length-1].
	return patterns.foldr(msg => false, (p, preds) => msg => build(p)(msg) || preds(msg))
}

module.exports = util