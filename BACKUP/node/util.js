"use strict"

// nodejs util library
let util = require("util")

util.sleep = ms => 
	new Promise((resolve, reject) => setTimeout(resolve, ms))

util.waituntil = async (cond) => {
	while (!cond) {
		await new Promise((resolve, reject) => setTimeout(resolve, 1))
	}
} 

module.exports = util