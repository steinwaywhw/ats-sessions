"use strict"

/**
 * Extensions to Array
 */

Array.prototype.foldr = function (base, fn) {
	const fold = (base, index) => {
		if (index == this.length) 
			return base
		return fn(this[index], fold(base, index+1))
	}
	return fold(base, 0)
}

Array.prototype.foldl = function (base, fn) {
	const fold = (base, index) => {
		if (index == this.length)
			return base 
		return fold(fn(this[index], base), index+1)
	}
	return fold(base, 0)
}

Array.prototype.clone = function () {
	return this.slice(0)
}

Array.prototype.dedup = function () {
	const set = new Set(this)
	return set.toJSON()
}



/**
 * Extensions to Set
 */


Set.prototype.isSupersetOf = function (other) {
	return other.every(e => this.has(e))
}

Set.prototype.isSubsetOf = function (other) {
	return this.every(e => other.has(e))
}

Set.prototype.equal = function (other) {
	return this.isSubsetOf(other) && this.isSupersetOf(other)
}

Set.prototype.filter = function (fn) {
	return new Set(this.toJSON().filter(fn))
}

Set.prototype.every = function (fn) {
	for (const e of this) {
		if (!fn(e))	return false 
	}
	return true 
}

Set.prototype.some = function (fn) {
	for (const e of this) {
		if (fn(e)) return true
	}
	return false 
}

Set.prototype.clone = function () {
	return new Set(this)
}

Set.prototype.different = function (other) { 
	this.forEach(e => {if (other.has(e)) this.delete(e)})
	return this 
}

Set.prototype.intersect = function (other) {
	this.forEach(e => {if (!other.has(e)) this.delete(e)})
	return this
}

Set.prototype.union = function (other) {
	other.forEach(e => this.add(e))
	return this
}

Set.prototype.toJSON = function () {
	return [...this]
}

Set.prototype.foldr = function (base, fn) {
	const tmp = [...this]
	const fold = (base, index) => {
		if (index == this.size) 
			return base
		return fn(tmp[index], fold(base, index+1))
	}
	return fold(base, 0)
}

Set.prototype.foldl = function (base, fn) {
	const tmp = [...this]
	const fold = (base, index) => {
		if (index == this.size)
			return base 
		return fold(fn(tmp[index], base), index+1)
	}
	return fold(base, 0)
}

Set.prototype.map = function (fn) {
	const tmp = [...this]
	const mapped = tmp.map((val, x, y) => fn(val))

	return new Set(mapped)
}

Set.prototype.deleteall = function (fn) {
	this.forEach(e => {if (fn(e)) this.delete(e)})
}

Set.prototype.find = function (fn) {
	for (const e of this) {
		if (fn(e)) return e
	}
	return null
}

// Set.is

Set.intersect = function (a, b) {
	let ret = a.clone()
	ret.intersect(b)
	return ret
}

Set.union = function (a, b) {
	let ret = a.clone()
	ret.union(b)
	return ret
}

Set.minus = function (a, b) {
	let ret = a.clone()
	ret.different(b)
	return ret
}

/**
 * Extensions to Map
 */

Map.prototype.clone = function () {
	return new Map(this)
}

Map.prototype.every = function (fn) {
	for (const [key, value] of this) {
		if (!fn(value, key)) return false
	}
	return true 
}

Map.prototype.some = function (fn) {
	for (const [key, value] of this) {
		if (fn(value, key)) return true 
	}
	return false
}

Map.prototype.foldr = function (base, fn) {
	const iter = this.entries()
	const fold = base => {
		const item = iter.next()
		if (item.done) 
			return base

		// item.value = [key, val]
		return fn(item.value[1], item.value[0], fold(base))
	}
	return fold(base)
}

Map.prototype.foldl = function (base, fn) {
	const iter = this.entries()
	const fold = base => {
		const item = iter.next()
		if (item.done) 
			return base

		// item.value = [key, val]
		return fold(fn(item.value[1], item.value[0], base))
	}
	return fold(base)
}

Map.prototype.override = function (other) {
	other.forEach((v, k) => this.set(k, v))
}

Map.prototype.extend = function (other) {
	other.forEach((v, k) => this.has(k) ? null : this.set(k, v))
}

Map.prototype.haskey = function (key) {
	return this.has(key)
}

Map.prototype.hasvalue = function (value) {
	return this.some((v, k) => v === value)
}

Map.prototype.toJSON = function () {
	return [...this]
}

Map.prototype.uniqueValues = function () {
	return (new Set(this.values())).toJSON()
}
