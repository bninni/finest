/*
Copyright Brian Ninni 2016

Rename to finest

Todo:

	Tests, Readme, Comments
	
	Why does x.extract('hi(the\\"(guy)\\")') fail?
	
	Make sure all custom regex does not include capture groups
	
	Use the Brackets object instead of current method
		-create its own openRegex and closeRegex (both with and without the escape function)
		-dont use delim or prefix.  If people want to catch specific prefixes, they can assign it to the open bracket
			-still place 'before' and 'after' nest properties?
	Then simply: new Extractor( [CaptureBrackets], [EscapeBrackets], errorFunction );
	
	Throw Error when encounter unmatched 'close' tag??
	
	For Escape:
		-need to make sure the escape character/string itself is not escaped
			-make sure it appears an odd number of times...
		-ONLY use inside 'escape' brackets??
		
	Create default Brackets objects
		-Brackets.JS.Quotes
		-Brackets.JS.Comments
			/* and */				
	/*		// and (\r\n?|\n)
		-Brackets.JS.Regex
			/ and / (regex)	
		
	Add functions:
	handle
		-returns a string by running each handle function on each nest
	parse
		-will return a Nest object of the entire string
			-initialize a currentNest
				-openStr and closeRegex will be null
	-find functions
		-will look for parenthesis
			-if prefix matches a property of the given object, then send to obj[prop] (which is a function)
			-if no prefix, then run vm.runInNewContext
	-strip: to remove everything inside the brackets (returns a string)
	-replace : automatically run the replace function when .close() happens
		-utilize an onClose callback
			-this can be used for the 'extract' function too (to see if # of matches is reached)
		
	The Nest object is an actual object
		-has function 'flatten', flatten the nest where each open/close is replaced by the given string
			-can give multiple strings to flatten open/close with different strings
		-has function 'forEach'
			-will run function from inner to outer
			-arguments are the newContentString, newContentArray, currentNest, topNest
				-content is everything in the nest array combined into one string
				-each nest will have the newContentString and newContentArray as attributes after returning
			-returns a new nest object with the updated values
			-original nest and child nests all remain unchanged
		-clone: to create a copy of the nest object
		
*/

var Settings = {
		defaultEscape : '\\',
		defaultCaptureMates : [['(',')']],
		defaultEscapeMates : [['"','"'],["'","'"],['`','`']],
		//to match regex before strings
		regexFirst : false,
	},
	//Common mates for statements
	CommonMates = {
		'(' : ')',
		'[' : ']',
		'<' : '>',
		'{' : '}',
		'"' : '"',
		'\'' : '\'',
		'/*' : '*/',
		'<!--' : '-->',
		'(*' : '*)',
		'{-' : '-}',
		'%{' : '%}',
		'<#' : '#>',
	},
	//Characters that need to be escaped for use in RegEx
	regexChars = new RegExp( '[\\' + ['^','[',']','{','}','(',')','\\','/','.',',','?','-','+','*','|','$'].join('\\') + ']', 'g' );


//to get the mate value of the given string
function getMate( str ){

	var keys, regex, match, count;
	
	if( str in CommonMates ) return CommonMates[str];
	
	//check for repeating cases
	
	//get the keys in order of largest to smallest since the smaller ones are substrings of the larger ones
	keys = Object.keys( CommonMates ).sort( sortArrayByLength ).map( makeRegexSafe );
	regex = new RegExp( '(' + keys.join('|') + ')', 'g' );
	match = str.match( regex );
	
	if( match ){
		count = str.length/match[0].length;
		if( count === match.length ) return CommonMates[ match[0] ].repeat( count );
	}
	
	//if no common mate, then use the reverse of the str
	return reverse( str );
}

//to sort an array by length
function sortArrayByLength(a, b){
  return b.length - a.length;
}
	
//to convert the given string (which already regex safe) into a regex 
function sourceToRegex( str ){
	return new RegExp( str );
}

//to reverse a string
function reverse( str ){
	return str.split('').reverse().join('');
}

//to make a string regex safe by prefixing certain certain chars with the escape char
function makeRegexSafe( str ){
	return str.replace( regexChars, '\\$&' )
}

function combineRegex( arr ){
	return new RegExp( arr.join('|') );
}

//To sort multiple arrays based on the sorting of a single array
function sortMultipleArrays( baseArrName, sortFunc, obj ){
	var key,
		retObj = {},
		newArr = [];
	
	
	function add( val, i ){
		newArr[i][key] = val;
	}
	
	function sort( a, b ){
		return sortFunc( a[baseArrName], b[baseArrName] );
	};
	
	function finish( obj ){
		var key;
		for( key in obj ) retObj[key].push( obj[key] );
	}
	
	obj[baseArrName].forEach(function( val ){
		var obj = {};
		obj[baseArrName] = val;
		newArr.push(obj);
	});
	
	for(key in obj){
		if( key !== baseArrName ) obj[key].forEach( add );
		retObj[key] = [];
	}
	
	newArr.sort( sort );

	newArr.forEach( finish );

	return retObj;
}

function isString( val ){
	return val !== undefined && val !== null && val.constructor === String;
}

function isArray( val ){
	return val !== undefined && val !== null && val.constructor === Array;
}

function isRegExp( val ){
	return val !== undefined && val !== null && val.constructor === RegExp;
}

function noOp( str ){
	return str;
}

function Brackets( data ){
	var data = typeof data === "object" ? data : {},
		open = data.open,
		close = data.close,
		handle = typeof data.handle === "function" ? data.handle : noOp,
		delim = data.delim,
		delimBefore = 'delimBefore' in data ? data.delimBefore : delim,
		delimAfter = 'delimAfter' in data ? data.delimAfter : delim,
		escape = data.escape,
		escapeOutside = 'escapeOutside' in data ? data.escapeOutside : escape,
		escapeInside = 'escapeInside' in data ? data.escapeInside : escape;
		
	
		
}

function MateMap( allClose, isString, regexFirst ){
	this.isString = isString;
	this.regexFirst = regexFirst;
	
	this.open = [];
	this.close = [];
	this.allClose = allClose;
}

MateMap.prototype.add = function( open, close ){
	var regexList,
		//if this MateMap is for regex, then extract the source;
		open = this.isString ? open : open.source,
		index = this.open.indexOf( open );
	
	if( index === -1 ){
		this.open.push( open );
		regexList = new RegexList( this.regexFirst )
		this.close.push( regexList );
	}
	else regexList = this.close[index];
	
	this.regexList = regexList;
	
	if( isArray( close ) ) this.close.forEach( this.addClose, this);
	else this.addClose( close );
}

MateMap.prototype.addClose = function( val ){
	this.regexList.add( val );
	this.allClose.add( val );
}

MateMap.prototype.finish = function(){
	var self = this,
		sorted;
	
	//If this MateMap is a String Map
	if( this.isString ){
		//sort the open and close arrays by length
		sorted = sortMultipleArrays( 'open', sortArrayByLength, { open : this.open, close : this.close } );
		this.open = sorted.open;
		this.close = sorted.close;

		//make the open array regex safe
		this.open = this.open.map( makeRegexSafe );
	}
	
	//turn all Open regex sources into regular expressions
	this.openRegex = this.open.map( sourceToRegex );
	
	this.closeRegex = [];
	
	//turn all Close regex sources into regular expressions
	this.close.forEach(function( regexList ){
		//get the regex list as a regex source string
		var source = regexList.toString();
		//add it to the close regex array
		self.closeRegex.push( new RegExp( '^' + source + '$' ) );
	});
	
}

function RegexList( regexFirst ){
	this.string = [];
	this.regex = [];
	this.regexFirst = regexFirst;
}

//convert these mate list to a single source array
RegexList.prototype.toString = function(){
	//sort the strings by length and convert to regex safe
	var arr = this.string.sort( sortArrayByLength ).map( makeRegexSafe );
	
	arr = this.regexFirst ? this.regex.concat( arr ) : arr.concat( this.regex );
	
	this.source = arr.join('|');
	
	return this.source;
}

RegexList.prototype.add = function( val ){
	var arr;
	
	//if regex:
	if( isRegExp( val ) ){
		arr = this.regex;
		val = val.source;
	}
	//if string:
	else if( isString( val ) ) arr = this.string;
	else return;
	
	//todo - what happens when there is no close mate??
	
	//add the value to the array if not already there
	if( arr.indexOf( val ) === -1 ) arr.push( val );
}

function Mates( mates, defaultMates, regexFirst, escape ){
		
	var allOpenSources, allCloseSources,
		allClose = new RegexList( regexFirst );
	
	this.escape = escape;
	this.regexFirst = regexFirst;
	this.stringMap = new MateMap( allClose, true, this.regexFirst );
	this.regexMap = new MateMap( allClose, false, this.regexFirst );

	//the mates is just a string, then parse the string as the open mate and get its close mate
	if( isString(mates) ){
		this.close = getMate( mates );
		this.addMate( mates );
	}
	//if it is an array, then parse each element in the array
	else if( isArray(mates) ) mates.forEach( this.parseOpen, this );
	//otherwise, use the default mates
	else defaultMates.forEach( this.parseOpen, this );
	
	//convert both maps into sources and regexes
	this.stringMap.finish();
	this.regexMap.finish();
	
	//array of all open regexs
	this.openMap = this.concat( this.stringMap.openRegex, this.regexMap.openRegex );
	
	//combine the open into a single string
	allOpenSources = this.concat( this.stringMap.open, this.regexMap.open ).join('|');
	this.allOpenRegex = this.newRegex( allOpenSources );
	
	//array of all mate regex arrays
	this.closeMap = this.concat( this.stringMap.closeRegex, this.regexMap.closeRegex );
	
	//Get all of the Close possibilities as a regex source string
	allCloseSources = allClose.toString()
	//combine them into a single regex
	this.allCloseRegex = this.newRegex( allCloseSources );
	
	//combine all of the sources into a single source string
	this.combinedSources = allOpenSources + '|' + allCloseSources;
}

Mates.prototype.newRegex = function( src ){
	//TODO: escape can be a regex, str, or array of each
	return new RegExp( '^(' + this.escape + '?(?:' + src + '))$' );
}

Mates.prototype.concat = function( str, regex ){
	return this.regexFirst ? regex.concat( str ) : str.concat( regex );
}

Mates.prototype.parseOpen = function( mate ){
	var open = mate[0];
	this.close = mate[1];
	
	if( isArray( open ) ) open.forEach( this.addMate, this );
	else this.addMate( open );
}

Mates.prototype.addMate = function( open ){
	//if string:
	if( isString(open) ) this.stringMap.add( open, this.close );
	//if regex:
	else if( isRegExp(open) ) this.regexMap.add( open, this.close );
}
	
//to create a regular expression for a brackets object
function BracketData( obj ){

	var mates, escape;
		
	this.escapeInner = obj.escapeInner;
	this.escapeOuter = obj.escapeOuter;
	this.removeEscape = obj.removeEscape;
	this.regexFirst = obj.regexFirst;
	
	escape = new RegexList( this.regexFirst );

	console.log(obj.escape);
	if( isArray( obj.escape ) ) obj.escape.forEach( escape.add );
	else escape.add( obj.escape );
	
	this.escape = escape.toString();
	console.log(escape);
	console.log(this.escape);
	this.escapeRegex = new RegExp( '^' + this.escape );
	//TODO: throw error if no valid open or close mate?
	mates = new Mates( obj.mates, obj.defaultMates, this.regexFirst, this.escape );
	
	this.openMap = mates.openMap;
	this.closeMap = mates.closeMap;
	this.openRegex = mates.allOpenRegex;
	this.closeRegex = mates.allCloseRegex;
	this.combined = mates.combinedSources;
}

function Extraction( capture, escape, regex ){
	this.capture = capture;
	this.escape = escape;
	this.regex = regex;
}

Extraction.prototype.extract = function( str, count ){
	var arr = str.split( this.regex ),
		l = arr.length,
		i;
		
	this.matches = [];
	this.isEscaped = false;
	this.index = 0;
	
	for(i=0;i<l;i++){
		this.handleStr( arr[i] );
		
		//if we are at the top of the chain and the number of matches is reached, then break
		if( !this.currentNest && this.matches.length === count) break;
		
		this.index += arr[i].length;
	}
	
	//if there is still a result, then there was an error
	//TODO : separate way to handle errors?
	if( this.currentNest ){
		if( this.isEscaped ) throw new Error("Unable to parse. Unclosed String detected")
		throw new Error("Unable to parse. Unclosed Bracket detected")
	}
	
	return this.matches;
}

Extraction.prototype.handleStr = function( str ){
	var index;
	
	if( this.isEscaped ) return this.handleEscaped( str );
	
	//if it matches an open Regex:
	if( str.match( this.capture.openRegex ) ) return this.handleOpenMatch( str );
	
	//if it matches any close Regex:
	if( str.match( this.capture.closeRegex ) ) return this.handleCloseMatch( str );
	
	//if it matches an escape open regex, then set escaped
	if( str.match( this.escape.openRegex ) ) return this.setEscaped( str );
	
	this.addString( str );
}

Extraction.prototype.handleEscaped = function( str ){
	//if it matches the Escape Close RegEx and not the Escape Escape RegEx, then unescape
	if( str.match( this.unescapeRegex ) && !str.match( this.escape.escapeRegex ) ){
		this.isEscaped = false;
		this.unescapeRegex = null;
	}
	this.addString( str );
}

Extraction.prototype.setEscaped = function( str ){
	//determine the unescape RegEx
	var i, l = this.escape.openMap.length;
	
	//if it is escaped, then just add as string
	if( str.match( this.escape.escapeRegex ) ) return this.addString(str);
	
	this.isEscaped = true;
	this.addString(str);
	
	for(i=0;i<l;i++) if( str.match( this.escape.openMap[i] ) ) return this.unescapeRegex = this.escape.closeMap[i];

	//TODO - throw error if no match??
	
}

//How to handle when the string matches the 'Open' Regular Expressions
Extraction.prototype.handleOpenMatch = function( str ){
	//if it is an escape, then just add as a string
	if( str.match( this.capture.escapeRegex ) ) return this.addString(str);
	
	//if there is a current nest and the string is also a close match, then close
	if( this.currentNest && str.match( this.currentNest.closeRegex ) ) return this.closeNest(str);
	
	this.openNest( str );
}

Extraction.prototype.openNest = function( str ){
	
	//Create the new Nest
	var self = this;	
		nest = new Nest( str, this.index, this.currentNest, this.getCloseRegex( str ) );
		
	//if there is no current nest, save the new nest as a new match
	if( !this.currentNest ) this.matches.push( nest );
	
	//set the result to be the new object
	this.currentNest = nest;
}

//to determine what the new close regex should be based on the str
Extraction.prototype.getCloseRegex = function( str ){
	var i, l=this.capture.openMap.length;
	
	for(i=0;i<l;i++) if( str.match( this.capture.openMap[i] ) ) return this.capture.closeMap[i];
	//TODO - throw error here?
}

//to add text to the current result if there is one
Extraction.prototype.addString = function( str ){
	if( str && this.currentNest ) this.currentNest.addChildString( str );
}

Extraction.prototype.handleCloseMatch = function( str ){
	//if it is an escape, then add the string
	if( str.match( this.capture.escapeRegex ) ) return this.addString(str);
	
	//if it matches the current close regex
	if( this.currentNest && str.match( this.currentNest.closeRegex ) ) return this.closeNest( str );
	
	//TODO: throw error here? (close string matched outside of nest)
};

Extraction.prototype.closeNest = function( str ){
	//finish the current nest, and get its parent
	this.currentNest = this.currentNest.finish( str );
}

//to create a new nest
function Nest( str, startIndex, parent, closeRegex ){
	
	var self = this;
	
	this.nest = [];
	this.simple = [];
	this.hasChildNest = false;
	this.content = '';
	this.open = str;
	this.close = null;
	this.index = [ startIndex ];
	this.nextIndex = [];
	this.matches = [];
	this.ancestors = [];
	this.parent = parent;
	this.depth = 0;
	this.lastEntryType = null;
	this.isClosed = false;
	this.closeRegex = closeRegex;
	
	//add this as child nest to the parent
	if( parent ){
		parent.addChildNest( this );
		
		while( parent ){
			this.ancestors.unshift( parent );
			this.index.unshift( startIndex - parent.index[0] - parent.open.length );
			this.depth++;
			parent = parent.parent;
		}
		
	}
}

Nest.prototype.addChildNest = function( child ){
	
	this.lastEntryType = Nest;
	
	this.hasChildNest = true;
	this.matches.push( child );
	this.nest.push( child );
	this.simple.push( child.simple );
	
	//add the child's open string to this content
	this.addContentString( child.open );
}

Nest.prototype.addChildString = function( str ){
	//add this string to the content (and all parent contents)
	this.addContentString( str );
	
	if( this.lastEntryType === String ){
		this.nest[ this.nest.length-1 ] += str;
		this.simple += str;
	}
	else{
		this.nest.push( str );
		this.simple.push( str );
	}
	
	this.lastEntryType = String;
}

Nest.prototype.addParentContentString = function( str ){
	if( this.parent ) this.parent.addContentString( str );
}

Nest.prototype.addContentString = function( str ){
	this.content += str;
	this.addParentContentString( str );
}

Nest.prototype.finish = function( str ){
	
	var self = this,
		length = this.open.length + this.content.length + str.length;
	
	//get the next index for each ancestor
	this.index.forEach(function( i ){
		self.nextIndex.push( i + length );
	});
	
	//the closeRegex property should not be public
	delete this.closeRegex;
	
	this.isClosed = true;
	this.close = str;

	this.addParentContentString( str );
	
	return this.parent;
}

function Extractor( captureMates, escapeMates ){
	
	var regex,
		capture = new BracketData({
			mates : captureMates,
			defaultMates : Settings.defaultCaptureMates,
			escape : Settings.defaultEscape,
			escapeInner : false,
			escapeOuter : false,
			removeEscape : false,
	
			//TODO: this can be set from input options
			regexFirst : Settings.regexFirst
		}),
		escape =  new BracketData({
			mates : escapeMates,
			defaultMates : Settings.defaultEscapeMates,
			escape :  Settings.defaultEscape,
			escapeInner : true,
			escapeOuter : false,
			removeEscape : false,
	
			//TODO: this can be set from input options
			regexFirst : Settings.regexFirst
		});
	
	regex = new RegExp( '(' + capture.escape + '?(?:' + capture.combined + ')|'+ escape.escape + '?(?:' + escape.combined + ')' + ')');
		
	this.extract = function( str, count ){
	
		if (typeof count !== "number") count = -1;
	
		return new Extraction( capture, escape, regex ).extract( str, count );
	}
}

module.exports = Extractor
