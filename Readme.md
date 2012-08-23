# Ripple

## Command line git repository & branch manager

Ripple was inspired by and does it's best to adhere to the principals described in Vincent Driessen's excellent blog post; [A successful Git branching model](http://nvie.com/posts/a-successful-git-branching-model/).

By automating and enforcing a strict yet very logical branching model, ripple both makes working with your git repository easier as well as more robust and well documented at the same time.

## Installation

	npm install -g ripple

## What it can do for you

Ripple will make your branch model simple, consistent, repeatable, and descriptive. If you are an individual developer, it will help you stay organized. If you work as part of a team, it will work wonders on keeping your team on the same page, and keeping you from tripping over each other.

* Create a new git repository from scratch, with appropriate tree structure.
* Create a new package.json and start managing an existing get repo / project.
* Create "feature" branches, from other feature branches or from "develop".
* Create "release" and "hotfix" branches with automated versioning.
* Integrate release and hotfix branches for release, by properly merging them back into your master and development branches.
* Smartly integrate hotfix branches into an existing release branch rather than develop, if one exists, and
	* Automatically advance version on release branch if a hotfix was required during a release cycle.
* Automatically tag releases with the correct integration version number.
* Keep you adhered to the principals outlined in "A successful git branching model".
	* No more than one active hotfix
	* Make sure you apply hotfixes and releases in the correct order

## Examples

All examples below show the branch that is currently checked out within the prompt.

### Create a new project from scratch

	iMac:test cscade $ ripple init test
	Initializing new ripple project
	  creating new git repository where there was none
	  creating new package.json on "master" for project test version 0.0.1
	  commiting package.json
	  creating new "develop" branch
	ok.

### Work on a feature

	iMac:Ripple cscade [develop] $ ripple start feature docs
	Starting feature branch
	  creating new docs branch from "develop"
	ok.
	
... do stuff, commit things ...
	
	iMac:Ripple cscade [docs] $ ripple finish feature 
	Finishing feature branch
	  merging docs into develop
	  removing docs branch
	ok.

### Create a release
	
	iMac:Ripple cscade [develop] $ ripple start release
	Starting release branch
	  creating new release branch from "develop"
	  updating version: 0.0.12 -> 0.0.13
	  commiting changes
	[release-0.0.13 357f066] bump version to 0.0.13
	 1 files changed, 1 insertions(+), 1 deletions(-)
	ok.
	
... polish, update your docs, etc ...
	
	iMac:Ripple cscade [release-0.0.13] $ ripple finish release
	Finishing release branch
	  merging release-0.0.13 into master
	  tagging version 0.0.13 on master
	  merging release-0.0.13 into develop
	  removing release-0.0.13 branch
	ok.

## Help

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

	    init <name> [version]
	      Initialize a ripple project here (creating a repository if needed), with the given project name and version number. [0.0.1]

	    * 

	  Options:

	    -h, --help                output usage information
	    -p, --package <location>  Relative path of package.json file to modify [./package.json]
	    -x, --no-commit           Do not commit version changes automatically
	    -d, --debug               show debug output
	    -v, --verbose             show verbose git output

	

## Where it's meant to work

Ripple makes the following assumptions about your environment:

* You have `node.js` & `npm`
* You use git
* Projects have a package.json file containing at least "name" and "version" keys

That's it. Projects can be in any language, and contain anything git can handle. Ripple is available as a global executable in your terminal just like git, and uses git-like command options.

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