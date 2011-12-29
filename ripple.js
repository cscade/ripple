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
	Exec = require('./lib/exec')(cli);

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
		execution: '',
		release: '',
		hotfix: '',
		isRelease: false,
		isHotfix: false,
		exists: {
			release: false,
			hotfix: false
		}
	}
};

var defaultMessage = 'Use --help for command line options.',
	dirty;

cli
	.option('status', 'Output current status')
	.option('start <kind>', 'Create a new release or hotfix branch [feature | release | hotfix]')
	.option('called <name>', 'Used in conjunction with "start feature" to specify a branch name')
	.option('bump <part>', 'Bump version number while on a release branch [major | minor | revision]')
	.option('finish <kind>', 'Finish and merge the current release or hotfix branch. Always commits! [release | hotfix]')
	.option('-p, package <location>', 'Relative path of package.json file to modify [./package.json]', './package.json')
	.option('-n, no-commit', 'Do not commit version changes automatically')
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
cli.commit = !cli.commit;

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
	(new Exec()).send('git checkout ' + branch, function (e) {
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
		if (cli.commit) {
			console.log('  commiting changes');
			(new Exec())
				.send('git add ' + path.resolve(cli.package) + ' && git commit -m "bump version to ' + methods.document.object.version + '"', function (e, next, stdout) {
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
			(new Exec())
				.send('git add ' + path.resolve(cli.package) + ' && git status', function (e, next, stdout) {
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
	console.log('  updating version: %s -> %s', methods.document.version.from, methods.document.version.to.join('.'));
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
			console.log('  Working tree is %s, current branch is [%s].', dirty ? 'dirty' : 'clean', properties.branch.execution);
			if (!dirty) {
				console.log(properties.branch.exists.release ? '  You cannot create a release branch, one already exists.' : '  You may create a release branch with "ripple start release bump <major/minor/revision>"');
				console.log(properties.branch.exists.hotfix ? '  You cannot create a hotfix branch, one already exists.' : '  You may create a hotfix branch with "ripple start hotfix"');
			}
			console.log('ok.');
		});
	} else if (cli.start) {
		console.log('Starting %s branch', cli.start);
		if (dirty && cli.start !== 'feature') {
			console.log('error: Can\'t start on a dirty working tree. Stash or commit your changes, then try again.');
			process.exit(0);
		}
		if (cli.bump !== 'major' && cli.bump !== 'minor' && (cli.bump !== 'revision' && cli.start === 'release')) {
			console.log('error: Can\'t create a new release without bumping version. %s', defaultMessage);
			process.exit(1);
		}
		if (cli.start === 'feature') {
			if (!cli.called) {
				console.log('error: When starting a new feature, use the called flag. i.e. "ripple start feature called my_feature".');
				process.exit(1);
			}
			methods.document.read('master', function () {
				console.log('  creating new %s branch from "%s"', cli.called, properties.branch.execution);
				(new Exec()).send('git checkout -b ' + cli.called + ' ' + properties.branch.execution, function (e) {
					if (e) {
						console.log(e.message);
					} else {
						console.log('ok.');
					}
				});
			});
		} else if (cli.start === 'release') {
			if (properties.branch.exists.release) {
				console.log('error: You already have a release branch!');
				process.exit(1);
			}
			methods.document.read('master', function () {
				console.log('  creating new release branch from "develop"');
				methods.document.increment();
				if (properties.branch.exists.hotfix) {
					console.log('warning: A hotfix branch exists. You must finish the hotfix before finalizing the release.');
				}
				(new Exec()).send('git checkout -b release-' + methods.document.object.version + ' develop', function (e) {
					if (e) {
						console.log(e.message);
					} else {
						methods.document.write(function () {
							console.log('ok.');
						});
					}
				});
			});
		} else if (cli.start === 'hotfix') {
			if (properties.branch.exists.hotfix) {
				console.log('error: You already have a hotfix branch!');
				process.exit(1);
			}
			methods.document.read('master', function (doc) {
				// *** hotfixes imply a revision bump only. Ignore version bump flags
				cli.bump = 'revision';
				console.log('  creating new hotfix branch from "master"');
				methods.document.increment();
				if (properties.branch.exists.release) {
					console.log('warning: A release branch exists. You must finish the hotfix before finalizing the release.');
				}
				(new Exec()).send('git checkout -b hotfix-' + methods.document.object.version + ' master', function (e) {
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
		console.log('Finishing %s branch', cli.finish);
		if (dirty) {
			console.log('error: Can\'t start on a dirty working tree. Stash or commit your changes, then try again.');
			process.exit(0);
		}
		if (properties.branch.exists.release && properties.branch.exists.hotfix && cli.finish === 'release') {
			console.log('error: You must finish your hotfix before finishing your release.');
			process.exit(1);
		}
		if (cli.finish === 'feature' && (properties.branch.isRelease || properties.branch.isHotfix || properties.branch.execution === 'master' || properties.branch.execution === 'develop')) {
			console.log('error: Finishing a feature requires that you have it\'s branch already checked out.');
			process.exit(1);
		}
		if (cli.finish === 'feature') {
			// Feature integration
			// merge feature into develop, delete feature
			(new Exec())
				.send('git checkout develop', function (e, next) {
					if (e) {
						console.log(e.message);
					} else {
						console.log('  merging %s into develop', properties.branch.execution);
						next();
					}
				})
				.send('git merge --no-ff ' + properties.branch.execution, function (e, next, stdout) {
					if (e) {
						console.log(stdout);
					} else {
						if (cli.verbose) console.log(stdout);
						next();
					}
				})
				.send('git branch -d ' + properties.branch.execution, function (e, next, stdout) {
					if (e) {
						console.log(e.message);
					} else {
						if (cli.verbose) console.log(stdout);
						console.log('ok.');
					}
				});
		} else if (cli.finish === 'release') {
			// Release integration
			// merge release into master, merge release into develop, delete release
			methods.document.read(properties.branch.release, function () {
				(new Exec())
					.send('git checkout master', function (e, next) {
						if (e) {
							console.log(e.message);
						} else {
							console.log('  merging %s into master', properties.branch.release);
							next();
						}
					})
					.send('git merge --no-ff -s recursive -Xtheirs ' + properties.branch.release, function (e, next, stdout) {
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
							console.log('  merging %s into develop', properties.branch.release);
							next();
						}
					})
					.send('git merge --no-ff ' + properties.branch.release, function (e, next, stdout) {
						if (e) {
							console.log('error: Merge failed.');
							console.log(stdout);
						} else {
							if (cli.verbose) console.log(stdout);
							console.log('  removing %s branch', properties.branch.release);
							next();
						}
					})
					.send('git branch -d ' + properties.branch.release, function (e, next, stdout) {
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
			methods.document.read(properties.branch.hotfix, function () {
				(new Exec())
					.send('git checkout master', function (e, next) {
						if (e) {
							console.log(e.message);
						} else {
							console.log('  merging %s into master', properties.branch.hotfix);
							next();
						}
					})
					.send('git merge --no-ff -s recursive -Xtheirs ' + properties.branch.hotfix, function (e, next, stdout) {
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
								(new Exec())
									.send('git checkout ' + properties.branch.release, function (e, next) {
										if (e) {
											console.log(e.message);
										} else {
											console.log('  merging %s into ' + properties.branch.release, properties.branch.hotfix);
											next();
										}
									})
									.send('git merge --no-ff -s recursive -Xtheirs ' + properties.branch.hotfix, function (e, next, stdout) {
										if (e) {
											console.log(stdout);
										} else {
											if (cli.verbose) console.log(stdout);
											console.log('warning: Check the results of this merge carfully! Conflicts may be auto-resolved using hotfix.');
											console.log('  removing %s branch', properties.branch.hotfix);
											next();
										}
									})
									.send('git branch -d ' + properties.branch.hotfix, function (e, next, stdout) {
										if (e) {
											console.log(e.message);
										} else {
											if (cli.verbose) console.log(stdout);
											cli.bump = 'revision';
											console.log('  auto-incrementing release branch');
											console.log('note: if you would prefer a different release version, run "ripple bump <major/minor/revision>".');
											methods.document.increment();
											methods.document.write(function () {
												console.log('ok.');
											}, 'release');
										}
									});
							} else {
								// Merge into develop
								(new Exec())
									.send('git checkout develop', function (e, next) {
										if (e) {
											console.log(e.message);
										} else {
											console.log('  merging %s into develop', properties.branch.hotfix);
											next();
										}
									})
									.send('git merge --no-ff ' + properties.branch.hotfix, function (e, next, stdout) {
										if (e) {
											console.log(stdout);
										} else {
											if (cli.verbose) console.log(stdout);
											console.log('  removing %s branch', properties.branch.hotfix);
											next();
										}
									})
									.send('git branch -d ' + properties.branch.hotfix, function (e, next, stdout) {
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
		console.log('Bumping version number');
		if (!properties.branch.isRelease) {
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
(new Exec())
	.send('git status|grep -c "working directory clean"', function (e, next, stdout) {
		dirty = stdout.trim() === '0';
		next();
	})
	.send('git branch --no-color|sed -e "/^[^*]/d" -e "s/* \(.*\)/\ \1/"', function (e, next, stdout) {
		properties.branch.execution = stdout.trim().slice(2);
		properties.branch.isRelease = properties.branch.execution.indexOf('release') !== -1;
		properties.branch.isHotfix = properties.branch.execution.indexOf('hotfix') !== -1;
		next();
	})
	.send('git branch|grep release', function (e, next, stdout) {
		properties.branch.exists.release = stdout.trim().length > 0;
		properties.branch.release = stdout.trim();
		if (properties.branch.release.indexOf('*') !== -1) {
			// Trim possible leading '* '
			properties.branch.release = properties.branch.release.slice(2);
		}
		next();
	})
	.send('git branch|grep hotfix', function (e, next, stdout) {
		properties.branch.exists.hotfix = stdout.trim().length > 0;
		properties.branch.hotfix = stdout.trim();
		if (properties.branch.hotfix.indexOf('*') !== -1) {
			// Trim possible leading '* '
			properties.branch.hotfix = properties.branch.hotfix.slice(2);
		}
		main();
	});