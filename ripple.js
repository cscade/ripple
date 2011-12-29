#!/usr/bin/env node
/*!
 * ripple.js
 * Ripple
 * 
 * Created by Carson Christian on 2011-12-28.
 * Copyright 2011 Carson Christian <cc@amplego.com>
 */

var cli = require('commander'),
	fs = require('fs'),
	path = require('path'),
	systemExec = require('child_process').exec;

var methods = {
	file: {},
	document: {
		version: {
			from: '',
			to: ''
		}
	}
};

var properties = {
	branch: {
		name: '',
		release: false,
		hotfix: false,
		exists: {
			release: false,
			hotfix: false
		}
	}
};

var defaultMessage = 'Use --help for command line options.',
	dirty;

/**
 * exec library
 * 
 * Automatically queues calls to exec, and guarantees execution order.
 */
var exec = {
	/**
	 * begin
	 * 
	 * Start a new exec queue.
	 * callback singature - next(e, next, stdout, stderr)
	 * 
	 * @param {String} args
	 * @param {Function} next
	 */
	begin: function (args, next) {
		if (cli.debug) console.error('debug: begin called. new exec queue.');
		this.queue = [];
		this.send(args, next);
		this.fresh = true;
		process.nextTick(function () {
			if (cli.debug) console.error('debug: next tick. calling next.');
			exec.fresh = false;
			exec.next();
		});
		return this;
	},
	send: function (args, next) {
		if (cli.debug) console.error('debug: send called.');
		if (typeof next !== 'function') throw new Error('exec: You cannot begin() or send() without a callback.');
		this.queue.unshift([args, next]);
		return this;
	},
	go: function (queueObj) {
		if (queueObj) {
			if (cli.debug) console.error('debug: go called. queue depth %s. "%s"', exec.queue.length, queueObj[0]);
			systemExec(queueObj[0], function (e, stdout, stderr) { queueObj[1](e, exec.next, stdout, stderr); });
		} else {
			if (cli.debug) console.error('debug warning: go called with no job. Look for an errant "next();".');
		}
	},
	next: function () {
		if (cli.debug) console.error('debug: next called. queue depth %s.', exec.queue.length);
		if (exec.fresh) throw new Error('exec: Do not call next() programmatically. Execution will begin automatically on nextTick.');
		exec.go(exec.queue.pop());
	}
};

cli
	.option('status', 'Output current status')
	.option('start <kind>', 'Create a new release or hotfix branch [release | hotfix]')
	.option('bump <part>', 'Bump version number while on a release branch [major | minor | revision]')
	.option('finish <kind>', 'Finish and merge the current release or hotfix branch. Always commits! [release | hotfix]')
	.option('-p, package <location>', 'Relative path of package.json file to modify [./package.json]', './package.json')
	.option('no-commit', 'Do not commit version changes automatically')
	.option('-d, debug', 'debug output')
	.option('-v, verbose', 'verbose git output');

cli.on('--help', function(){
	console.log('  Examples:');
	console.log('');
	console.log('    $ release.js --create-release --minor --commit');
	console.log('      Create a new release branch from develop, increment the minor version number, and commit the result.');
	console.log('    $ release.js --current');
	console.log('      Output the current application name: version.');
	console.log('    $ release.js --create-hotfix');
	console.log('      Create a new hotfix branch from master, increment the revision version number, and leave the working tree dirty.');
	console.log('    $ release.js --finalize');
	console.log('      Integrate the current release/hotfix branch into master/develop.');
	console.log('');
});

cli.parse(process.argv);

// Methods
/**
 * read
 * 
 * Read a json file at uri and pass it as an object.
 * 
 * @param {String} uri
 * @param {Function} next
 */
methods.file.read = function (uri, next) {
	if (cli.debug) console.error('debug: file.read called.');
	fs.readFile(uri, 'utf8', function (e, data) {
		if (e) {
			console.error('error: %s could not be read. File does not exist.', uri);
			process.exit(1);
		} else {
			try {
				data = JSON.parse(data);
			} catch (e) {
				console.error('error: %s could not be parsed. Make sure it is a valid json document.', uri);
				process.exit(1);
			}
			next(data);
		}
	});
};

/**
 * write
 * 
 * Write the passed object as a JSON file to the privded uri.
 * 
 * @param {Object} doc
 * @param {String} uri
 * @param {Function} next
 */
methods.file.write = function (doc, uri, next) {
	if (cli.debug) console.error('debug: file.write called.');
	fs.writeFile(uri, JSON.stringify(doc, null, 4), 'utf8', function (e) {
		if (e) {
			console.error('error: %s could not be written.');
			process.exit(1);
		} else {
			try {
				next();
			} catch (e) {}
		}
	});
};

/**
 * read
 * 
 * Read in the document, and update local variables.
 * 
 * @param {String} branch - branch to checkout before reading
 * @param {Function} next
 */
methods.document.read = function (branch, next) {
	if (cli.debug) console.error('debug: document.read called.');
	if (typeof branch !== 'string') throw new Error('Document: You must specify a branch to read package.json from.');
	if (cli.debug) console.error('debug: checking out %s.', branch);
	exec.begin('git checkout ' + branch, function (e) {
		if (e) {
			console.log(e.message);
		} else {
			methods.file.read(path.resolve(cli.package), function (doc) {
				methods.document.object = doc;
				methods.document.version.to = doc.version.split('.').map(Number);
				methods.document.version.from = methods.document.version.to.filter(function () { return true; }).join('.');
				next();
			});
		}
	});
};

/**
 * write
 * 
 * Write the document, and optionally commit.
 * 
 * @param {Function} proceed
 * @param {String} alias
 */
methods.document.write = function (proceed, alias) {
	if (cli.debug) console.error('debug: document.write called.');
	methods.file.write(methods.document.object, path.resolve(cli.package), function () {
		if (!cli.noCommit) {
			console.log('*** Commiting changes...');
			exec
				.begin('git add ' + path.resolve(cli.package) + ' && git commit -m "bump version to ' + methods.document.object.version + '"', function (e, next, stdout) {
					if (e) {
						console.log(e.message);
					} else {
						console.log(stdout);
						if (alias) {
							// Rename branch
							next();
						} else {
							try {
								proceed();
							} catch (e) {}
						}
					}
				})
				.send('git branch -m ' + alias + '-' + methods.document.object.version, function (e) {
					if (e) {
						console.log(e.message);
					} else {
						try {
							proceed();
						} catch (e) {}
					}
				});
		} else {
			exec
				.begin('git status', function (e, next, stdout) {
					if (e) {
						console.log(e.message);
					} else {
						console.log(stdout);
						// Show diff
						next();
					}
				})
				.send('git diff ' + path.resolve(cli.package), function (e, next, stdout) {
					if (e) {
						console.log(e.message);
					} else {
						console.log(stdout);
						try {
							proceed();
						} catch (e) {}
					}
				});
		}
	});
};

/**
 * increment
 * 
 * Increment the version number.
 */
methods.document.increment = function () {
	if (cli.bump === 'revision') {
		methods.document.version.to[2]++;
	}
	if (cli.bump === 'minor') {
		methods.document.version.to[1]++;
		methods.document.version.to[2] = 0;
	}
	if (cli.bump === 'major') {
		methods.document.version.to[0]++;
		methods.document.version.to[1] = 0;
		methods.document.version.to[2] = 0;
	}
	console.log('*** Updating version: %s -> %s', methods.document.version.from, methods.document.version.to.join('.'));
	methods.document.object.version = methods.document.version.to.join('.');
};

/**
 * main
 * 
 * Primary logic flow.
 */
var main = function () {
	if (cli.status) {
		// Output current status
		methods.file.read(path.resolve(cli.package), function (doc) {
			console.log('Status');
			console.log('  Working on: %s %s', doc.name, doc.version);
			console.log('  With a package located at: %s', path.resolve(cli.package));
			console.log('  Working tree is %s, current branch is [%s].', dirty ? 'dirty' : 'clean', properties.branch.name);
			if (!dirty) {
				console.log(properties.branch.exists.release ? '  You cannot create a release branch, one already exists.' : '  You may create a release branch with "ripple start release bump <major/minor/revision>"');
				console.log(properties.branch.exists.hotfix ? '  You cannot create a hotfix branch, one already exists.' : '  You may create a hotfix branch with "ripple start hotfix"');
			}
			console.log('ok.');
		});
	} else if (cli.start) {
		if (dirty) {
			console.log('error: Can\'t start on a dirty working tree. Stash or commit your changes, then try again.');
			process.exit(0);
		}
		if (cli.bump !== 'major' && cli.bump !== 'minor' && (cli.bump !== 'revision' && cli.start === 'release')) {
			console.log('error: Can\'t create a new release without bumping version. %s', defaultMessage);
			process.exit(1);
		}
		if (cli.start === 'release') {
			// Create release
			if (properties.branch.exists.release) {
				console.log('error: You already have a release branch!');
				process.exit(1);
			}
			methods.document.read('master', function () {
				methods.document.increment();
				console.log('*** Creating new release branch from "develop"...');
				if (properties.branch.exists.hotfix) {
					console.log('warning: A hotfix branch exists. You must finish the hotfix before finalizing the release.');
				}
				exec.begin('git checkout -b release-' + methods.document.object.version + ' develop', function (e) {
					if (e) {
						console.log(e.message);
					} else {
						methods.document.write(function () {
							console.log('ok.');
						});
					}
				});
			});
		} else {
			// Create hotfix
			if (properties.branch.exists.hotfix) {
				console.log('error: You already have a hotfix branch!');
				process.exit(1);
			}
			methods.document.read('master', function (doc) {
				// *** hotfixes imply a revision bump only. Ignore version bump flags
				cli.bump = 'revision';
				methods.document.increment();
				console.log('*** Creating new hotfix branch from "master"...');
				if (properties.branch.exists.release) {
					console.log('warning: A release branch exists. You must finish the hotfix before finalizing the release.');
				}
				exec.begin('git checkout -b hotfix-' + doc.version + ' master', function (e) {
					if (e) {
						console.log(e.message);
					} else {
						methods.document.write(function () {
							console.log('ok.');
						});
					}
				});
			});
		}
	} else if (cli.finish) {
		// Finish
		if (dirty) {
			console.log('error: Can\'t start on a dirty working tree. Stash or commit your changes, then try again.');
			process.exit(0);
		}
		if (!properties.branch.release && !properties.branch.hotfix) {
			console.log('error: You can only finish a release or hotfix branch!');
			process.exit(1);
		}
		if (properties.branch.release && properties.branch.exists.hotfix) {
			console.log('error: You must finish your hotfix before finishing your release.');
			process.exit(1);
		}
		if (cli.finish === 'release') {
			// Release integration
			// checkout master, merge in release, checkout develop, merge in release, delete release
			methods.document.read('HEAD', function () {
				exec
					.begin('git checkout master', function (e, next) {
						if (e) {
							console.log(e.message);
						} else {
							console.log('*** Finalizing release branch...');
							console.log('  merging %s into master', properties.branch.name);
							next();
						}
					})
					.send('git merge --no-ff -s recursive -Xtheirs ' + properties.branch.name, function (e, next, stdout) {
						if (e) {
							console.log(stdout);
						} else {
							if (cli.verbose) console.log(stdout);
							console.log('  tagging version %s on master', methods.document.object.version);
							next();
						}
					})
					.send('git tag -a ' + methods.document.object.version + ' -m "version ' + methods.document.object.version + '"', function (e, next) {
						if (e) {
							console.log(e.message);
						} else {
							next();
						}
					})
					.send('git checkout develop', function (e, next) {
						if (e) {
							console.log(e.message);
						} else {
							console.log('  merging %s into develop', properties.branch.name);
							next();
						}
					})
					.send('git merge --no-ff ' + properties.branch.name, function (e, next, stdout) {
						if (e) {
							console.log('error: Merge failed.');
							console.log(stdout);
						} else {
							if (cli.verbose) console.log(stdout);
							console.log('  removing release branch');
							next();
						}
					})
					.send('git branch -d ' + properties.branch.name, function (e, next, stdout) {
						if (e) {
							console.log(e.message);
						} else {
							if (cli.verbose) console.log(stdout);
							console.log('ok.');
						}
					});
			});
		} else if (cli.finish === 'hotfix') {
			// Hotfix integration
			// checkout master, merge in hotfix, checkout develop, merge in hotfix, delete hotfix
			methods.document.read('HEAD', function () {
				var releaseBranch;
				
				exec
					.begin('git checkout master', function (e, next) {
						if (e) {
							console.log(e.message);
						} else {
							console.log('*** Finalizing hotfix branch...');
							console.log('  merging %s into master', properties.branch.name);
							next();
						}
					})
					.send('git merge --no-ff -s recursive -Xtheirs ' + properties.branch.name, function (e, next, stdout) {
						if (e) {
							console.log(stdout);
						} else {
							if (cli.verbose) console.log(stdout);
							console.log('  tagging version %s on master', methods.document.object.version);
							next();
						}
					})
					.send('git tag -a ' + methods.document.object.version + ' -m "version ' + methods.document.object.version + '"', function (e) {
						if (e) {
							console.log(e.message);
						} else {
							if (properties.branch.exists.release) {
								// Merge into release
								exec
									.begin('git branch | grep "release"', function (e, next, stdout) {
										releaseBranch = stdout.trim();
										next();
									})
									.send('git checkout ' + releaseBranch, function (e, next) {
										if (e) {
											console.log(e.message);
										} else {
											console.log('  merging %s into ' + releaseBranch, properties.branch.name);
											next();
										}
									})
									.send('git merge --no-ff -s recursive -Xtheirs ' + properties.branch.name, function (e, next, stdout) {
										if (e) {
											console.log(stdout);
										} else {
											if (cli.verbose) console.log(stdout);
											console.log('warning: Check the results of this merge carfully! Conflicts were auto-rsolved using hotfix.');
											console.log('  removing hotfix branch');
											next();
										}
									})
									.send('git branch -d ' + properties.branch.name, function (e, next, stdout) {
										if (e) {
											console.log(e.message);
										} else {
											if (cli.verbose) console.log(stdout);
											cli.bump = 'revision';
											methods.document.increment();
											console.log('  auto-incrementing release branch to %s', methods.document.object.version);
											console.log('  If you would prefer a different release version, run "ripple bump <part>".');
											methods.document.write(function () {
												console.log('ok.');
											}, 'release');
										}
									});
							} else {
								// Merge into develop
								exec
									.begin('git checkout develop', function (e, next) {
										if (e) {
											console.log(e.message);
										} else {
											console.log('  merging %s into develop', properties.branch.name);
											next();
										}
									})
									.send('git merge --no-ff ' + properties.branch.name, function (e, next, stdout) {
										if (e) {
											console.log(stdout);
										} else {
											if (cli.verbose) console.log(stdout);
											console.log('  removing hotfix branch');
											next();
										}
									})
									.send('git branch -d ' + properties.branch.name, function (e, next, stdout) {
										if (e) {
											console.log(e.message);
										} else {
											if (cli.verbose) console.log(stdout);
											console.log('ok.');
										}
									});
							}
						}
					});
			});
		}
	} else if (cli.bump === 'major' || cli.bump === 'minor' || cli.bump === 'revision') {
		// Just update revision
		if (!properties.branch.release) {
			console.log('error: You can only manually bump versions on a release branch.');
			process.exit(1);
		}
		methods.document.read('HEAD', function () {
			methods.document.increment();
			methods.document.write(function () {
				console.log('ok.');
			}, 'release');
		});
	} else {
		console.log('error: Nothing to do. %s', defaultMessage);
	}
};

/**
 * Preload all state info.
 */
exec
	.begin('git status|grep -c "working directory clean"', function (e, next, stdout) {
		dirty = stdout.trim() === '0';
		next();
	})
	.send('git branch --no-color|sed -e "/^[^*]/d" -e "s/* \(.*\)/\ \1/"', function (e, next, stdout) {
		properties.branch.name = stdout.trim().slice(2);
		properties.branch.release = properties.branch.name.indexOf('release') !== -1;
		properties.branch.hotfix = properties.branch.name.indexOf('hotfix') !== -1;
		next();
	})
	.send('git branch|grep -c release', function (e, next, stdout) {
		properties.branch.exists.release = stdout.trim() === '1';
		next();
	})
	.send('git branch|grep -c hotfix', function (e, next, stdout) {
		properties.branch.exists.hotfix = stdout.trim() === '1';
		main();
	});