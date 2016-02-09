/*
Copyright Brian Ninni 2016

Changes:
	-added built-in JS Brackets : RegExp and Comments
	-added maxDepth to a Bracket
	-added Parser.handle
	-added in way to replace capture groups with non capture groups, but still need to add in top level escape
	-Updated the 'split regex'
	-The 'ignore brackets' are now treated as nests (until it closes, then it reverts back to a string)
	-The 'escape' string applies to everything inside those brackets

Todo:

	Tests, Readme, Comments
		-make note that if the use a regex, it will match in the order it is listed
			-pen will match before penny
		-note that the nextIndex array is not accessible in the nest handle function
		
	The return Bracket object should have no properties, it should just map to the private bracket object instead
	
	Create a 'Base Nest' object for each Extraction
		-should have no closeRegex
		
	In Extraction, make the closeRegex a combination of all closeRegex whose openRegex matches the current string
	
	Errors:
		-Custom error function?
		-Throw Error when encounter unmatched 'close' tag??
	
	Parser options:
		-base Brackets
		-wordBoundary
			-don't open the nest if the first char of open string and the last char of the current content both match \w
			-don't close if the last char of the close string and first char of next string both match \w
		-error function
		
	Add Parser functions:
		parse
			-will return a Nest object of the entire string
				-initialize a currentNest
					-openStr and closeRegex will be null
		-strip: to remove everything inside the brackets (returns a string)
		-replace : automatically run the replace function when .close() happens
			-utilize an onClose callback
				-this can be used for the 'extract' function too (to see if # of matches is reached)
		
	The Nest object:
		-add 'before' and 'after' properties
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

//to get the first value
function popFirst( arr ){
	return arr.splice(0,1)[0];
}

//to get the lowest non-negative value in the array
function lowestNonNegative(arr){
	var newArr = arr.sort(),
		ret = popFirst( newArr );
	
	while( newArr.length && ret < 0) ret = popFirst( newArr );
	
	return ret >= 0 ? ret : -1;
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

function isString( val ){
	return val !== undefined && val !== null && val.constructor === String;
}

function isArray( val ){
	return val !== undefined && val !== null && val.constructor === Array;
}

function isRegExp( val ){
	return val !== undefined && val !== null && val.constructor === RegExp;
}

var RegexList = (function(){

	function RegexList( data ){
		this.string = [];
		this.regex = [];
		
		if( isArray( data ) ) data.forEach( this.add, this );
		else this.add( data );
	}

	//convert these mate list to a single source array
	RegexList.prototype.toString = function( regexFirst ){
		//sort the strings by length and convert to regex safe
		var arr = this.string.sort( sortArrayByLength ).map( makeRegexSafe );
		arr = regexFirst ? this.regex.concat( arr ) : arr.concat( this.regex );
		this.source = arr.join('|');
		return this.source;
	}

	RegexList.prototype.add = function( val ){
		var arr;
		
		//if regex, set the value to be the source without capture groups:
		if( isRegExp( val ) ){
			arr = this.regex;
			val = removeCaptureGroups( val.source );
		}
		//if string:
		else if( isString( val ) ) arr = this.string;
		else return;
		
		//todo - what happens when there is no close mate??
		
		//add the value to the array if not already there
		if( arr.indexOf( val ) === -1 ) arr.push( val );
	}

	return RegexList;

})();

var BracketsList = (function(){
	function BracketsList( data ){
		var brackets = [];
		this.brackets = brackets;
		
		data.mates.forEach(function( mate ){
			var newData = {
				open : mate[0],
				close : mate[1],
				handle : data.handle,
				escape : data.escape,
				maxDepth : data.maxDepth,
			}

			brackets.push( new Brackets( newData ) );
		});
		
	}
	
	return BracketsList;
	
})();

var Brackets = (function(){

	function defaultHandle(){
		return this.open + this.content + this.close;
	}
	
	//TODO: throw error if no 'open'??
	//TODO: accepted just a string or just an array?
	function Brackets( data ){
		var data = typeof data === "object" ? data : {},
			open = data.open,
			close = data.close,
			escape = data.escape;
		
		if( 'mates' in data && isArray( data.mates ) ) return new BracketsList( data );
		
		if( 'mate' in data && isArray( data.mate ) ){
			open = data.mate[0];
			close = data.mate[1];
		}
		
		open =  new RegexList( open );
		//TODO: if( !close ) close = getMate( open );
		close = new RegexList( close );
		escape = new RegexList( escape );

		this.maxDepth = typeof data.maxDepth === "number" ? data.maxDepth : -1;
		this.handle = typeof data.handle === "function" ? data.handle : defaultHandle;
			
		this.build = function( regexFirst ){
			var openSource = open.toString( regexFirst ),
				closeSource = close.toString( regexFirst ),
				escapeSource = escape.toString( regexFirst );
			
			this.openRegex = new RegExp( '^(' +  openSource + ')$' );
			this.escapeRegex = escapeSource ? new RegExp("(^|[^(?:" + escapeSource + ")])" + escapeSource + "(" + escapeSource + "{2})*$") : null;
			this.closeRegex = new RegExp( '^(' +  closeSource + ')$' );
			this.openSource = openSource;
			this.closeSource = closeSource;
		}
	}
	
	return Brackets;
})();

var Extraction = (function(){
	function Extraction( capture, ignore, regex, maxDepth ){
		this.capture = capture;
		this.ignore = ignore;
		this.regex = regex;
		this.maxDepth = maxDepth;
		this.index = 0;
		this.fullString = '';
		//TODO: error if maxDepth = 0?
	}

	Extraction.prototype.extract = function( str, count ){
		var matches = [],
			arr = str.split( this.regex ),
			doContinue = true;
		
		this.onClose = function( nest ){
			//if a top level capture nest closed, save and see if the number of matches is reached
			if( !nest.doIgnore && !nest.parent ){
				matches.push( nest.public );
				if( matches.length === count ) doContinue = false;
			}
		}
		
		while( doContinue && arr.length ) this.handleStr( popFirst(arr) );
		
		//if there is still a result, then there was an error
		//TODO : separate way to handle errors?
		if( this.currentNest ) throw new Error("Unable to parse. Unclosed Bracket detected")
		
		return matches;
	}

	Extraction.prototype.handle = function( str ){
		var fullString = '',
			arr = str.split( this.regex );
		
		this.onClose = function( nest ){
			//if it is top level, save the content
			if( !nest.parent ) fullString += nest.handle();
		}
		
		this.onString = function( str ){
			fullString += str;
		}
		
		while( arr.length ) this.handleStr( popFirst( arr ) );
		
		//if there is still a result, then there was an error
		//TODO : separate way to handle errors?
		if( this.currentNest ) throw new Error("Unable to parse. Unclosed Bracket detected")
		
		return fullString;
	}

	Extraction.prototype.handleStr = function( str ){
		
		if( !str ) return;
		
		//increase the total index
		this.index += str.length;
		
		//if there is a current nest and the last portion of the content is escaped, then just add the string
		if( this.currentNest && this.currentNest.endsWithEscape ) return this.addString( str );
		
		//if there is a current nest and the string is a close match, then close
		if( this.currentNest && str.match( this.currentNest.closeRegex ) ) return this.closeNest( str );
		
		//if we are at the max depth, then add the string
		if( this.currentNest && this.currentNest.maxDepth === 0 ) return this.addString( str );
		
		//if it matches an open Regex and we are not at the max depth:
		if( str.match( this.capture.openRegex ) ) return this.openNest( str, false );
		
		//if it matches any close Regex:
		if( str.match( this.capture.closeRegex ) ){
			//TODO: throw error here, closeRegex encountered without openRegex??
		}
		
		//if it matches an escape open regex, then set escaped
		if( str.match( this.ignore.openRegex ) ) return this.openNest( str, true );
		
		this.addString( str );
	}

	Extraction.prototype.openNest = function( str, doIgnore ){
		
		var bracket = this.getBracket( str, doIgnore );
		
		this.currentNest = new Nest( str, this.index, this.currentNest, this.maxDepth, bracket, doIgnore, this.onClose, this.onString );
	}

	//to determine what the new bracket should be based on the str
	Extraction.prototype.getBracket = function( str, doIgnore ){
		var i,
			arr = doIgnore ? this.ignore.brackets : this.capture.brackets,
			l = arr.length;
		
		for(i=0;i<l;i++) if( str.match( arr[i].openRegex ) ) return arr[i];
		//TODO - throw error here?
	}

	//to add text to the current result if there is one
	Extraction.prototype.addString = function( str ){
		if( this.currentNest ) this.currentNest.addChildString( str );
		else if( this.onString ) this.onString( str );
	}

	Extraction.prototype.closeNest = function( str ){
		//close the current nest and get its parent
		this.currentNest = this.currentNest.close( str );
	}

	return Extraction;

})();

var Nest = (function(){

	function Nest( str, startIndex, parent ){
		this.nest = [];
		this.simple = [];
		this.hasChildNest = false;
		this.original = '';
		this.content = '';
		this.open = str;
		this.close = null;
		this.index = [startIndex];
		this.nextIndex = [];
		this.matches = [];
		this.ancestors = [];
		this.parent = parent ? parent.public : null;
		this.depth = 0;
	}
	
	function NestWrapper( str, startIndex, parent, maxDepth, bracket, doIgnore, onClose, onString ){
	
		//initialize the public Nest
		var nest = new Nest( str, startIndex, parent );
		
		this.parent = parent;
		this.public = nest;
		
		//shortcuts to the public object values
		this.matches = nest.matches;
		this.nest = nest.nest;
		this.simple = nest.simple;
		this.index = nest.index;
				
		//if it isn't an ignore nest, then add this as a child nest to the parent nest
		if( !doIgnore && parent ){
			//add this nest as a child to the parent
			parent.addChildNest( nest );
			
			//use the parents max depth
			maxDepth = parent.maxDepth;
			
			//if the parent is ignored, then so is this
			doIgnore = doIgnore || parent.doIgnore;
			
			while( parent ){
				nest.ancestors.unshift( parent.public );
				nest.index.unshift( startIndex - parent.index[0] - parent.public.open.length );
				nest.depth++;
				parent = parent.parent;
			}
		}
		
		//set some values from the input
		this.doIgnore = doIgnore;
		this.bracket = bracket;
		this.onClose = onClose;
		this.onString = onString;
		this.handle = bracket.handle.bind(nest);
		this.closeRegex = bracket.closeRegex;
		this.escapeRegex = bracket.escapeRegex;
		
		//use the lowest non-negative value
		this.maxDepth = lowestNonNegative( [maxDepth-1, bracket.maxDepth] );
		
		//initialize other values
		this.endsWithEscape = false;
		this.lastEntryType = null;
	}

	NestWrapper.prototype.addChildNest = function( child ){
		this.lastEntryType = Nest;
		
		this.matches.push( child );
		this.nest.push( child );
		this.simple.push( child.simple );
		
		this.public.hasChildNest = true;
	}

	NestWrapper.prototype.addChildString = function( str ){
		//add this string to the content and handled content
		this.addOriginalString( str );
		this.addHandledString( str );
		
		if( this.lastEntryType === String ){
			this.nest[ this.nest.length-1 ] += str;
			this.simple[ this.simple.length-1 ] += str;
		}
		else{
			this.nest.push( str );
			this.simple.push( str );
		}
		
		this.lastEntryType = String;
		this.endsWithEscape = str.match( this.escapeRegex );
	}

	NestWrapper.prototype.addOriginalString = function( str ){
		this.public.original += str;
	}
	
	NestWrapper.prototype.addHandledString = function( str ){
		this.public.content += str;
	}

	NestWrapper.prototype.close = function( str ){
		var fullString = this.public.open + this.public.original + str,
			length = fullString.length,
			nextIndex = this.public.nextIndex;
		
		//if its an ignore nest, then add the entire content to the parent as a string
		if( this.doIgnore ){
			if( this.parent ) this.parent.addChildString( fullString );
			//if no parent, then run the onString function
			else if( this.onString ) this.onString( fullString );
		}
		else{
			this.public.close = str;
						
			//get the next index for each ancestor
			this.index.forEach(function( i ){
				nextIndex.push( i + length );
			});
			
			//add the content to the parent content
			if( this.parent ){
				this.parent.addOriginalString( fullString );
				this.parent.addHandledString( this.handle() );
			}
			
			//run the onClose function with this nest
			if( this.onClose ) this.onClose( this );

		}
		
		return this.parent;
	}
	
	return NestWrapper;
})();

var CombinedBrackets = (function(){
	function CombinedBrackets( brackets, regexFirst ){

		this.regexFirst = regexFirst;
	
		this.openSources = [];
		this.closeSources = [];
		this.combinedSourcesArray = [];
		
		this.brackets = [];
		this.openRegex = null;
		this.closeRegex = null;
		this.combinedSources = null;
		
		if( isArray( brackets ) ) brackets.forEach( this.add, this );
		else this.add( brackets );
		
		if( this.brackets.length ){
			this.openRegex = new RegExp('^(?:' + this.openSources.join('|') + ')$');
			this.closeRegex = new RegExp('^(?:' + this.closeSources.join('|') + ')$');
			this.combinedSources = this.combinedSourcesArray.join('|');
		}
	}
	
	CombinedBrackets.prototype.add = function( bracket ){
		
		if( bracket instanceof BracketsList ) return bracket.brackets.forEach( this.add, this );
		
		if( !(bracket instanceof Brackets) ) return;
		
		bracket.build( this.regexFirst );
		
		this.brackets.push( bracket );
		this.openSources.push( '(' + bracket.openSource + ')' );
		this.closeSources.push( '(' + bracket.closeSource + ')' );
		this.combinedSourcesArray.push( '(?:' + bracket.openSource + '|' + bracket.closeSource + ')' );
	}
	
	return CombinedBrackets;
	
})();

//TODO: throw error if no capture brackets??
var Parser = (function(){
	function Parser( captureBrackets, ignoreBrackets, opts ){
		
		var opts = typeof opts === 'object' ? opts : {},
			regexFirst = opts.regexFirst,
			maxDepth = typeof opts.maxDepth === "number" ? opts.maxDepth : -1,
			capture = new CombinedBrackets( captureBrackets, regexFirst ),
			ignore = new CombinedBrackets( ignoreBrackets, regexFirst ),
			allCombinedSources = capture.combinedSources + (ignore.combinedSources ? ('|' + ignore.combinedSources) : ''),
			regex = new RegExp( '(' + allCombinedSources + ')' );
			
		this.extract = function( str, count ){
			if (typeof count !== "number") count = -1;
			return new Extraction( capture, ignore, regex, maxDepth ).extract( str, count );
		}	
		this.handle = function( str ){
			return new Extraction( capture, ignore, regex, maxDepth ).handle( str );
		}
	}
	
	return Parser;
})();


var JS = {
	RegExp : new Brackets({
		mate : ['/','/'],
		escape : '\\'
	}),
	Strings : new Brackets({
		mates : [
			['"','"'],
			['\'','\''],
			['`','`'],
		],
		maxDepth : 0,
		escape : '\\'
	}),
	Comments : new Brackets({
		mates : [
			['/*','*/'],
			['//',['\r\n','\r','\n']],
		],
		maxDepth : 0
	})
};

//to change all capture groups to non-capture groups in a regex source string
function removeCaptureGroups( str ){
	var Parens = new Brackets({
			mate : ['(',')'],
			escape : '\\',
			handle : function(){
				var openStr = '(';
				if( this.content[0] !== '?' ) openStr += '?:';
				return openStr + this.content + ')';
			}
		}),
		Bracks = new Brackets({
			mate : ['[',']'],
			maxDepth : 0,
			escape : '\\'
		});
	
	return new Parser( Parens, Bracks,{
		base : JS.RegExp
	}).handle( str );
}

module.exports = {
	Parser : Parser,
	Brackets : Brackets,
	JS : JS,
	remove : removeCaptureGroups
};
