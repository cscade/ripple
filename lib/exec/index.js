/*!
 * exec/index.js
 * Ripple
 * 
 * Created by Carson Christian on 2011-12-29.
 * Copyright 2011 (ampl)EGO. All rights reserved.
 */

/**
 * exec library
 * 
 * Automatically queues calls to exec, and guarantees execution order.
 */

var systemExec = require('child_process').exec,
	cli;

var Exec = function () {
	this.queue = [];
	this.fresh = true;
};

Exec.prototype.send = function (args, next) {
	var that = this;

	if (!this.running) {
		process.nextTick(function () {
			that.fresh = false;
			that.next();
		});
		this.running = true;
	}
	if (typeof next !== 'function') throw new Error('exec: You cannot send() without a callback.');
	this.queue.unshift([args, next]);
	return this;
};

Exec.prototype.go = function (queueObj) {
	var that = this;

	if (queueObj) {
		if (cli.debug) console.error('debug:'.grey.inverse + ' [queue #%s] exec: "%s"', this.queue.length + 1, queueObj[0].bold);
		systemExec(queueObj[0], function (e, stdout, stderr) { queueObj[1](e, function () { that.next(); }, stdout, stderr); });
	} else {
		if (cli.debug) console.error('debug warning:'.red.inverse + ' go called with no job. Look for an errant "next();".');
	}
};

Exec.prototype.next = function () {
	if (this.fresh) throw new Error('exec: Do not call next() programmatically. Execution will begin automatically on nextTick.');
	this.go(this.queue.pop());
	if (this.queue.length === 0) {
		this.running = false;
	}
};

module.exports = function (cliInstance) {
	cli = cliInstance;
	return Exec;
};