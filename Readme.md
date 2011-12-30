# Ripple

## Command line git repository & branch manager, with (plans for) release tools.

ripple was inspired by and does it's best to adhere to the principals described in Vincent Driessen's excellent blog post; [A successful Git branching model](http://nvie.com/posts/a-successful-git-branching-model/). By automating and enforcing a strict yet very logical branching model, ripple both makes working with your git repository easier as well as more robust and well documented at the same time.

## What it can do for you

* Create "feature" branches, from other feature branches or from "develop".
* Create "release" and "hotfix" branches with automated versioning.
* Integrate release and hotfix branches for release, my properly merging them back into your master and development branches.
* Smartly integrate hotfix branches into an existing release branch rather than develop, if one exists, and
* Automatically advance version on release branch if a hotfix was required during a release cycle.
* Automatically tag releases with the correct integration version number.
* Keep you adhered to the principals outlined in "A successful git branching model". Things like not having more than one active hotfix, making sure you apply hotfixes and releases in the right order and in the right places, etc.

## Examples

All examples below show the branch that is currently checked out within the prompt.

	iMac:Ripple cscade [develop] $ ripple start feature docs
	Starting feature branch
	  creating new docs branch from "develop"
	ok.
	
	... do stuff, commit things ...
	
	

## Help output

	iMac:Ripple cscade $ ripple wtf

	  Usage: ripple [options] [command]

	  Commands:

	    status 
	      Output current status of the active project.

	    start <type> [name]
	      Create a new branch of type "feature", "release", or "hotfix".
	      If it's a feature branch, provide a name.

	    bump <part>
	      Bump version number while on a release branch.
	      Specify "major", "minor", or "revision".

	    finish <type>
	      Finish and merge the current release or hotfix branch.
	      Specify "feature", "release", or "hotfix".
	      Always commits!

	  Options:

	    -h, --help                output usage information
	    -p, --package <location>  Relative path of package.json file to modify [./package.json]
	    -x, --no-commit           Do not commit version changes automatically
	    -d, --debug               show debug output
	    -v, --verbose             show verbose git output

	

## Where it's meant to work

I designed ripple for my development cycle, but it should integrate well into many existing workflows. It makes the following assumptions about your environment:

* You have node.js installed on your development system
* You have NPM
* You use git for your project, and have at least a "master" and "develop" branch
* Projects you manage with ripple have a package.json file containing at least "name" and "version" keys

That's it. Projects can be in any language, and contain anything git can handle. ripple is available as a global executable in your terminal just like git, and uses git-like command options. As of right now, ripple does not create git repositories for you, but that is a planned feature.

## Installation

Install ripple globally, so you will have access to it's binary.

	npm install -g ripple

## License 

(The MIT License)

Copyright (c) 2011 Carson Christian &lt;cc@amplego.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.