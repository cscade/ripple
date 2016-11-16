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
	Exec = require('./lib/exec')(cli),
	colors = require('colors');

var methods = {
	file: {},
	document: {}
};

var properties = {
	branch: {
		execution: {
			name: '',
			isRelease: false,
			isHotfix: false,
			dirty: undefined
		},
		release: {
			name: '',
			exists: false
		},
		hotfix: {
			name: '',
			exists: false
		}
	},
	document: {
		version: {
			from: '',
			to: ''
		}
	},
	repository: {
		initialized: false
	}
};

// Methods
/**
 * checkLive
 * 
 * Check that a git repository exists in good standing to execute this command.
 * 
 * @param {Boolean} gentle - If true, do not process.exit on not exist, just return false.
 */
methods.checkLive = function (gentle) {
	if (!gentle && !properties.repository.initialized) {
		console.log('error: '.red.bold + 'git says this isn\'t a repository. Are you in the right folder?');
		console.log('  If you would like to start a new repository here, use "ripple init <name> [version]" instead.');
		process.exit(1);
	} else {
		return properties.repository.initialized;
	}
};

/**
 * read
 * 
 * Read a json file at uri and pass it as an object.
 * 
 * @param {String} uri
 * @param {Function} next
 */
methods.file.read = function (uri, next) {
	if (cli.debug) console.error('debug:'.grey.inverse + ' file.read "%s"', uri.bold);
	fs.readFile(uri, 'utf8', function (e, data) {
		if (e) {
			console.error('error: '.red + '%s could not be read. File does not exist.', uri);
			process.exit(1);
		} else {
			try {
				data = JSON.parse(data);
			} catch (e) {
				console.error('error: '.red + '%s could not be parsed. Make sure it is a valid json document.', uri);
				process.exit(1);
			}
			next(data);
		}
	});
};

/**
 * write
 * 
 * Write the passed object as a JSON file to the provided uri.
 * 
 * @param {Object} doc
 * @param {String} uri
 * @param {Function} next
 */
methods.file.write = function (doc, uri, next) {
	if (cli.debug) console.error('debug:'.grey.inverse + ' file.write "%s"', uri.bold);
	fs.writeFile(uri, JSON.stringify(doc, null, 4), 'utf8', function (e) {
		if (e) {
			console.error('error: '.red + '%s could not be written.');
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
	if (typeof branch !== 'string') throw new Error('Document: You must specify a branch to read package.json from.');
	(new Exec()).send('git checkout ' + branch, function (e) {
		if (e) {
			console.log(e.message);
		} else {
			methods.file.read(path.resolve(cli.package), function (doc) {
				properties.document.object = doc;
				properties.document.version.to = doc.version.split('.').map(Number);
				properties.document.version.from = properties.document.version.to.filter(function () { return true; }).join('.');
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
	methods.file.write(properties.document.object, path.resolve(cli.package), function () {
		if (cli.commit) {
			console.log('  commiting changes'.blue);
			(new Exec())
				.send('git add ' + path.resolve(cli.package) + ' && git commit -m "bump version to ' + properties.document.object.version + '"', function (e, next, stdout) {
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
				.send('git branch -m ' + alias + '-' + properties.document.object.version, function (e) {
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
 * 
 * @param {String} part
 */
methods.document.increment = function (part) {
	if (part === 'revision') {
		properties.document.version.to[2]++;
	}
	if (part === 'minor') {
		properties.document.version.to[1]++;
		properties.document.version.to[2] = 0;
	}
	if (part === 'major') {
		properties.document.version.to[0]++;
		properties.document.version.to[1] = 0;
		properties.document.version.to[2] = 0;
	}
	console.log('  updating version: %s -> %s'.blue, properties.document.version.from, properties.document.version.to.join('.'));
	properties.document.object.version = properties.document.version.to.join('.');
};

/**
 * Commands
 */
cli
	.command('status')
	.description('  Output current status of the active project.')
	.action(function () {
		methods.checkLive();
		methods.file.read(path.resolve(cli.package), function (doc) {
			console.log('Status');
			console.log('  Current release: %s %s', doc.name.blue, doc.version.blue);
			console.log('  With a package located at: %s', path.resolve(cli.package).blue);
			console.log('  Working tree is %s, current branch is %s.', properties.branch.execution.dirty ? 'dirty'.underline : 'clean', properties.branch.execution.name.blue);
			if (!properties.branch.execution.dirty) {
				console.log(properties.branch.release.exists ? '  You cannot create a release branch, one already exists.' : '  You may create a release branch with "' + 'ripple start release bump <major/minor/revision>'.bold + '"');
				console.log(properties.branch.hotfix.exists ? '  You cannot create a hotfix branch, one already exists.' : '  You may create a hotfix branch with "' + 'ripple start hotfix'.bold + '"');
			}
			console.log('ok.'.green.bold);
		});
	});
cli
	.command('start <type> [name]')
	.description('  Create a new branch of type "feature", "release", or "hotfix".\n  If it\'s a feature branch, provide a name.')
	.action(function (type, name) {
		methods.checkLive();
		console.log('Starting %s branch', type);
		if (properties.branch.execution.dirty && type !== 'feature') {
			console.log('error: '.red.bold + 'Can\'t start on a dirty working tree. Stash or commit your changes, then try again.');
			process.exit(0);
		}
		if (type === 'feature') {
			if (typeof name !== 'string') {
				console.log('error: '.red.bold + 'When starting a new feature, include a name. i.e. "ripple start feature my_feature".');
				process.exit(1);
			}
			if (properties.branch.execution.isRelease || properties.branch.execution.isHotfix || properties.branch.execution.name === 'master') {
				console.log('error: '.red.bold + 'New features must be started relative to "develop", or an existing feature branch.');
				process.exit(1);
			}
			methods.document.read(properties.branch.execution.name, function () {
				console.log('  creating new %s branch from "%s"'.blue, name, properties.branch.execution.name);
				(new Exec()).send('git checkout -b ' + name + ' ' + properties.branch.execution.name, function (e) {
					if (e) {
						console.log(e.message);
					} else {
						console.log('ok.'.green.bold);
					}
				});
			});
		} else if (type === 'release') {
			if (properties.branch.release.exists) {
				console.log('error: '.red.bold + 'You already have a release branch!');
				process.exit(1);
			}
			methods.document.read('develop', function () {
				console.log('  creating new release branch from "develop"'.blue);
				methods.document.increment('revision');
				if (properties.branch.hotfix.exists) {
					console.log('warning'.red + ': A hotfix branch exists. You must finish the hotfix before finalizing the release.');
				}
				(new Exec()).send('git checkout -b release-' + properties.document.object.version + ' develop', function (e) {
					if (e) {
						console.log(e.message);
					} else {
						methods.document.write(function () {
							console.log('ok.'.green.bold);
						});
					}
				});
			});
		} else if (type === 'hotfix') {
			if (properties.branch.hotfix.exists) {
				console.log('error: '.red.bold + 'You already have a hotfix branch!');
				process.exit(1);
			}
			methods.document.read('master', function (doc) {
				// *** hotfixes imply a revision bump only. Ignore version bump flags
				console.log('  creating new hotfix branch from "master"'.blue);
				methods.document.increment('revision');
				if (properties.branch.release.exists) {
					console.log('warning'.red + ': A release branch exists. You must finish the hotfix before finalizing the release.');
				}
				(new Exec()).send('git checkout -b hotfix-' + properties.document.object.version + ' master', function (e) {
					if (e) {
						console.log(e.message);
					} else {
						methods.document.write(function () {
							console.log('ok.'.green.bold);
						});
					}
				});
			});
		}
	});
cli
	.command('bump <part>')
	.description('  Bump version number while on a release branch.\n  Specify "major", "minor", or "revision".')
	.action(function (part) {
		methods.checkLive();
		console.log('Bumping version number');
		if (!properties.branch.execution.isRelease) {
			console.log('error: '.red.bold + 'You can only manually bump versions on a release branch.');
			process.exit(1);
		}
		methods.document.read(properties.branch.release.name, function () {
			methods.document.increment(part);
			methods.document.write(function () {
				console.log('ok.'.green.bold);
			}, 'release');
		});
	});
cli
	.command('finish <type>')
	.description('  Finish and merge the current release or hotfix branch.\n  Specify "feature", "release", or "hotfix".' + '\n  ' + 'Always commits!'.underline)
	.action(function (type) {
		methods.checkLive();
		console.log('Finishing %s branch', type);
		if (properties.branch.execution.dirty) {
			console.log('error: '.red.bold + 'Can\'t start on a dirty working tree. Stash or commit your changes, then try again.');
			process.exit(0);
		}
		if (properties.branch.release.exists && properties.branch.hotfix.exists && type === 'release') {
			console.log('error: '.red.bold + 'You must finish your hotfix before finishing your release.');
			process.exit(1);
		}
		if (type === 'feature' && (properties.branch.execution.isRelease || properties.branch.execution.isHotfix || properties.branch.execution.name === 'master' || properties.branch.execution.name === 'develop')) {
			console.log('error: '.red.bold + 'Finishing a feature requires that you have it\'s branch already checked out.');
			process.exit(1);
		}
		if (type === 'feature') {
			// Feature integration
			// merge feature into develop, delete feature
			(new Exec())
				.send('git checkout develop', function (e, next) {
					if (e) {
						console.log(e.message);
					} else {
						console.log('  merging %s into develop'.blue, properties.branch.execution.name);
						next();
					}
				})
				.send('git merge --no-ff ' + properties.branch.execution.name, function (e, next, stdout) {
					if (e) {
						console.log(stdout);
					} else {
						if (cli.verbose) console.log(stdout.grey);
						console.log('  removing %s branch'.blue, properties.branch.execution.name);
						next();
					}
				})
				.send('git branch -d ' + properties.branch.execution.name, function (e, next, stdout) {
					if (e) {
						console.log(e.message);
					} else {
						if (cli.verbose) console.log(stdout.grey);
						console.log('ok.'.green.bold);
					}
				});
		} else if (type === 'release') {
			// Release integration
			// merge release into master, merge release into develop, delete release
			methods.document.read(properties.branch.release.name, function () {
				(new Exec())
					.send('git checkout master', function (e, next) {
						if (e) {
							console.log(e.message);
						} else {
							console.log('  merging %s into master'.blue, properties.branch.release.name);
							next();
						}
					})
					.send('git merge --no-ff -s recursive -Xtheirs ' + properties.branch.release.name, function (e, next, stdout) {
						if (e) {
							console.log(stdout);
						} else {
							if (cli.verbose) console.log(stdout.grey);
							console.log('  tagging version %s on master'.blue, properties.document.object.version);
							next();
						}
					})
					.send('git tag -a ' + properties.document.object.version + ' -m "version ' + properties.document.object.version + '"', function (e, next) {
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
							console.log('  merging %s into develop'.blue, properties.branch.release.name);
							next();
						}
					})
					.send('git merge --no-ff ' + properties.branch.release.name, function (e, next, stdout) {
						if (e) {
							console.log('error: '.red.bold + 'Merge failed.');
							console.log(stdout);
						} else {
							if (cli.verbose) console.log(stdout.grey);
							console.log('  removing %s branch'.blue, properties.branch.release.name);
							next();
						}
					})
					.send('git branch -d ' + properties.branch.release.name, function (e, next, stdout) {
						if (e) {
							console.log(e.message);
						} else {
							if (cli.verbose) console.log(stdout.grey);
							console.log('ok.'.green.bold);
						}
					});
			});
		} else if (type === 'hotfix') {
			// Hotfix integration
			// checkout master, merge in hotfix, checkout develop, merge in hotfix, delete hotfix
			methods.document.read(properties.branch.hotfix.name, function () {
				(new Exec())
					.send('git checkout master', function (e, next) {
						if (e) {
							console.log(e.message);
						} else {
							console.log('  merging %s into master'.blue, properties.branch.hotfix.name);
							next();
						}
					})
					.send('git merge --no-ff -s recursive -Xtheirs ' + properties.branch.hotfix.name, function (e, next, stdout) {
						if (e) {
							console.log(stdout);
						} else {
							if (cli.verbose) console.log(stdout.grey);
							console.log('  tagging version %s on master'.blue, properties.document.object.version);
							next();
						}
					})
					.send('git tag -a ' + properties.document.object.version + ' -m "version ' + properties.document.object.version + '"', function (e) {
						if (e) {
							console.log(e.message);
						} else {
							if (properties.branch.release.exists) {
								// Merge into release
								(new Exec())
									.send('git checkout ' + properties.branch.release.name, function (e, next) {
										if (e) {
											console.log(e.message);
										} else {
											console.log(('  merging %s into ' + properties.branch.release.name).blue, properties.branch.hotfix.name);
											next();
										}
									})
									.send('git merge --no-ff -s recursive -Xtheirs ' + properties.branch.hotfix.name, function (e, next, stdout) {
										if (e) {
											console.log(stdout);
										} else {
											if (cli.verbose) console.log(stdout.grey);
											console.log('warning'.red + ': Check the results of this merge carfully! Conflicts may be auto-resolved using hotfix.');
											console.log('  removing %s branch'.blue, properties.branch.hotfix.name);
											next();
										}
									})
									.send('git branch -d ' + properties.branch.hotfix.name, function (e, next, stdout) {
										if (e) {
											console.log(e.message);
										} else {
											if (cli.verbose) console.log(stdout.grey);
											console.log('  auto-incrementing release branch'.blue);
											console.log('note'.underline + ': if you would prefer a different release version, run "ripple bump <major/minor/revision>".');
											methods.document.increment('revision');
											methods.document.write(function () {
												console.log('ok.'.green.bold);
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
											console.log('  merging %s into develop'.blue, properties.branch.hotfix.name);
											next();
										}
									})
									.send('git merge --no-ff ' + properties.branch.hotfix.name, function (e, next, stdout) {
										if (e) {
											console.log(stdout);
										} else {
											if (cli.verbose) console.log(stdout.grey);
											console.log('  removing %s branch'.blue, properties.branch.hotfix.name);
											next();
										}
									})
									.send('git branch -d ' + properties.branch.hotfix.name, function (e, next, stdout) {
										if (e) {
											console.log(e.message);
										} else {
											if (cli.verbose) console.log(stdout.grey);
											console.log('ok.'.green.bold);
										}
									});
							}
						}
					});
			});
		}
	});
cli
	.command('init <name> [version]')
	.description('  Initialize a ripple project here (creating a repository if needed), with the given project name and version number. [0.0.1]')
	.action(function (name, version) {
		version = version || '0.0.1';
		if (version.split('.').length !== 3) {
			console.log('error: '.red.bold + 'Version numbers must follow the major.minor.revision convention. i.e. 1.0.0');
			process.exit(1);
		}
		fs.readFile(path.resolve(cli.package), 'utf8', function (e, data) {
			if (e) {
				// Package doesn't exist ... expected
				console.log('Initializing new ripple project');
				if (!methods.checkLive(true)) {
					// No git repo yet
					console.log('  creating new git repository where there was none');
					(new Exec())
						.send('git init', function (e, next) {
							console.log('  creating new package.json on "master" for project %s version %s', name.blue, version.blue);
							fs.writeFile(path.resolve(cli.package), JSON.stringify({ name: name, version: version }, null, 4), 'utf8', function (err) {
								if (err) {
									console.error('error: '.red + '%s could not be written.');
									process.exit(1);
								} else {
									console.log('  commiting package.json');
									console.log('  creating new "develop" branch');
									next();
								}
							});
						})
						.send('git add ./package.json && git commit -m "create new package.json for ' + name + ' version ' + version + '" && git checkout -b develop', function (e, next, stdout) {
							if (cli.verbose) console.log(stdout.grey);
							console.log('ok.'.green.bold);
						});
				} else {
					// Existing git repo
					(new Exec())
						.send('git checkout -b master || git checkout master', function (e, next, stdout) {
							if (cli.verbose) console.log(stdout.grey);
							console.log('  creating new package.json on "master" for project %s version %s', name.blue, version.blue);
							fs.writeFile(path.resolve(cli.package), JSON.stringify({ name: name, version: version }, null, 4), 'utf8', function (err) {
								if (err) {
									console.error('error: '.red + '%s could not be written.');
									process.exit(1);
								} else {
									console.log('  creating new "develop" branch');
									console.log('  commiting package.json');
									next();
								}
							});
						})
						.send('git checkout -b develop && git add ./package.json && git commit -m "create new package.json for ' + name + ' version ' + version + '" && git checkout master && git merge --no-ff develop && git checkout develop', function (e, next, stdout) {
							if (cli.verbose) console.log(stdout.grey);
							console.log('ok.'.green.bold);
						});
				}
			} else {
				try {
					data = JSON.parse(data);
					console.log('error: '.red.bold + 'An existing package.json file was found, describing this project as %s with version %s.', data.name.blue, data.version.blue);
					process.exit(1);
				} catch (e) {
					console.log('error: '.red.bold + 'An existing package.json file was found, but could not be parsed. Either fix it manually, or remove it and re-execute "ripple init".');
					process.exit(1);
				}
			}
		});
	});
cli
	.command('*')
	.action(function () {
		(new Exec()).send('ripple --help', function (e, next, stdout) {
			console.log(stdout);
		});
	});

/**
 * Options
 */
cli
	.option('-p, --package <location>', 'Relative path of package.json file to modify [./package.json]', './package.json')
	.option('-x, --no-commit', 'Do not commit version changes automatically')
	.option('-d, --debug', 'show debug output')
	.option('-v, --verbose', 'show verbose git output');

/**
 * Preload all state info.
 */
(new Exec())
	.send('git status', function (e, next, stdout, stderr) {
		properties.repository.initialized = stderr.indexOf('fatal') === -1;
		next();
	})
	.send('git status|grep -c "working directory clean"', function (e, next, stdout) {
		properties.branch.execution.dirty = stdout.trim() === '0';
		next();
	})
	.send('git status|grep -c "working tree clean"', function (e, next, stdout) {
		// Second check for different git version.
		if (properties.branch.execution.dirty === false) return next();
		properties.branch.execution.dirty = stdout.trim() === '0';
		next();
	})
	.send('git branch --no-color|sed -e "/^[^*]/d" -e "s/* \(.*\)/\ \1/"', function (e, next, stdout) {
		properties.branch.execution.name = stdout.trim().slice(2);
		properties.branch.execution.isRelease = properties.branch.execution.name.indexOf('release') !== -1;
		properties.branch.execution.isHotfix = properties.branch.execution.name.indexOf('hotfix') !== -1;
		next();
	})
	.send('git branch|grep release', function (e, next, stdout) {
		properties.branch.release.exists = stdout.trim().length > 0;
		properties.branch.release.name = stdout.trim();
		if (properties.branch.release.name.indexOf('*') !== -1) {
			// Trim possible leading '* '
			properties.branch.release.name = properties.branch.release.name.slice(2);
		}
		next();
	})
	.send('git branch|grep hotfix', function (e, next, stdout) {
		properties.branch.hotfix.exists = stdout.trim().length > 0;
		properties.branch.hotfix.name = stdout.trim();
		if (properties.branch.hotfix.name.indexOf('*') !== -1) {
			// Trim possible leading '* '
			properties.branch.hotfix.name = properties.branch.hotfix.name.slice(2);
		}
		cli.parse(process.argv);
	});