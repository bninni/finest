/*
Copyright Brian Ninni 2016

Todo:

	Tests, Readme, Comments
	
	Make sure all custom regex does not include capture groups
	
	A way to have multiple different mates within the Brackets object?
		-instead of 'open' and 'close', use 'mate' or 'mates' property
		-Use a BracketList object??
			-create a new Brackets object for each mate
				-how to handle duplicate openings??
		
	Errors:
		-Custom error function?
		-Throw Error when encounter unmatched 'close' tag??
	
	For Escape:
		-need to make sure the escape character/string itself is not escaped
			-make sure it appears an odd number of times...
		-separate outerEscape and innerEscape
		
	Create default Brackets objects
		-Brackets.JS.Quotes
		-Brackets.JS.Comments
			/* and * /				
			// and (\r\n?|\n)
		-Brackets.JS.Regex
			/ and / (regex)	
		
	Add Parser functions:
		handle
			-returns a string by running each handle function on each nest
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

	return RegexList;

})();

var Brackets = (function(){

	function defaultHandle( str ){
		return str;
	}
	
	//TODO: throw error if no mate/mates?
	function Brackets( data ){
		var data = typeof data === "object" ? data : {},
			open =  new RegexList( data.open ),
			close = new RegexList( data.close ),
			escape = new RegexList( data.escape ),
			handle = typeof data.handle === "function" ? data.handle : defaultHandle,
			openSource, closeSource, escapeSource, openRegex, closeRegex,
			isBuilt = false;
		
		this.canHaveNest = typeof data.canHaveNest === 'boolean' ? data.canHaveNest : true;
		
		Object.defineProperty(this, 'isBuilt', {
			get : function(){
				return isBuilt;
			}
		});
		
		Object.defineProperty(this, 'closeRegex', {
			get : function(){
				return closeRegex;
			}
		});
		
		this.isOpenMatch = function( str ){
			return !!str.match( openRegex );
		}
			
		this.build = function( regexFirst ){
			
			if( this.isBuilt ) return;
			
			openSource = open.toString( regexFirst ),
			closeSource = close.toString( regexFirst );
			escapeSource = escape.toString( regexFirst );
			
			openRegex = new RegExp( '^' + openSource + '$' );
			closeRegex = new RegExp( '^' + closeSource + '$' );
			
			this.openSource = openSource;
			this.closeSource = closeSource;
			this.escapeSource = escapeSource ? '(?:' + escapeSource + ')?' : '';
			
			isBuilt = true;
		}
	}
	
	return Brackets;
})();

var Extraction = (function(){
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
		
		//if there is a current nest and the string is a close match, then close
		if( this.currentNest && str.match( this.currentNest.closeRegex ) ) return this.closeNest( str );
		
		//if it matches an open Regex:
		if( (!this.currentNest || this.currentNest.canHaveNest) && str.match( this.capture.openRegex ) ) return this.openNest( str );
		
		//if it matches any close Regex:
		if( str.match( this.capture.closeRegex ) ){
			//TODO: throw error here, closeRegex encountered without openRegex??
		}
		
		//if it matches an escape open regex, then set escaped
		if( str.match( this.escape.openRegex ) ) return this.setEscaped( str );
		
		this.addString( str );
	}

	Extraction.prototype.handleEscaped = function( str ){
		//if it matches the Escape Close RegEx then unescape
		if( str.match( this.unescapeRegex ) ){
			this.isEscaped = false;
			this.unescapeRegex = null;
		}
		this.addString( str );
	}

	Extraction.prototype.setEscaped = function( str ){
		//determine the unescape RegEx
		var i,
			arr = this.escape.brackets,
			l = arr.length;
			
		this.isEscaped = true;
		this.addString(str);
		
		for(i=0;i<l;i++) if( arr[i].isOpenMatch(str) ) return this.unescapeRegex = arr[i].closeRegex;

		//TODO - throw error if no match??
		
	}

	Extraction.prototype.openNest = function( str ){
		
		//Create the new Nest
		var self = this,
			bracket = this.getBracket( str ),
			nest = new Nest( str, this.index, this.currentNest, bracket.closeRegex, bracket.canHaveNest );
			
		//if there is no current nest, save the new nest as a new match
		if( !this.currentNest ) this.matches.push( nest );
		
		//set the result to be the new object
		this.currentNest = nest;
	}

	//to determine what the new bracket should be based on the str
	Extraction.prototype.getBracket = function( str ){
		var i,
			arr = this.capture.brackets,
			l=arr.length;
		
		for(i=0;i<l;i++) if( arr[i].isOpenMatch(str) ) return arr[i];
		//TODO - throw error here?
	}

	//to add text to the current result if there is one
	Extraction.prototype.addString = function( str ){
		if( str && this.currentNest ) this.currentNest.addChildString( str );
	}

	Extraction.prototype.closeNest = function( str ){
		//finish the current nest, and get its parent
		this.currentNest = this.currentNest.finish( str );
	}

	return Extraction;

})();

//to create a new nest
var Nest = (function(){
	function Nest( str, startIndex, parent, closeRegex, canHaveNest ){
		
		var self = this,
			closed = false;
		
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
		this.closeRegex = closeRegex;
		this.canHaveNest = canHaveNest;
		
		Object.defineProperty( this, "isClosed", {
			get : function(){
				return closed;
			}
		},{
			enumerable : true
		});
		
		this.setClosed = function(){
			closed = true;
		}
		
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
		
		if( this.isClosed ) return false;
			
		this.lastEntryType = Nest;
		
		this.hasChildNest = true;
		this.matches.push( child );
		this.nest.push( child );
		this.simple.push( child.simple );
		
		//add the child's open string to this content
		this.addContentString( child.open );
		
		return true;
	}

	Nest.prototype.addChildString = function( str ){
		
		if( this.isClosed ) return false;
		
		//add this string to the content (and all parent contents)
		this.addContentString( str );
		
		if( this.lastEntryType === String ){
			this.nest[ this.nest.length-1 ] += str;
			this.simple[ this.simple.length-1 ] += str;
		}
		else{
			this.nest.push( str );
			this.simple.push( str );
		}
		
		this.lastEntryType = String;
		
		return true;
	}

	Nest.prototype.addParentContentString = function( str ){
		if( this.isClosed ) return false;
		
		if( this.parent ) this.parent.addContentString( str );
		
		return true;
	}

	Nest.prototype.addContentString = function( str ){
		if( this.isClosed ) return false;
		this.content += str;
		this.addParentContentString( str );
		return true;
	}

	Nest.prototype.finish = function( str ){
		
		var self = this,
			length = this.open.length + this.content.length + str.length;
		
		if( this.isClosed ) return false;
		
		//get the next index for each ancestor
		this.index.forEach(function( i ){
			self.nextIndex.push( i + length );
		});
		
		this.close = str;
		this.addParentContentString( str );
		
		this.setClosed();
		
		//the following properties should not be public
		delete this.closeRegex;
		delete this.lastEntryType;
		delete this.setClosed;
		
		return this.parent;
	}
	
	return Nest;
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
		
		if( !(bracket instanceof Brackets) ) return;
		
		bracket.build( this.regexFirst );
		
		this.brackets.push( bracket );
		this.openSources.push( '(?:' + bracket.openSource + ')' );
		this.closeSources.push( '(?:' + bracket.closeSource + ')' );
		this.combinedSourcesArray.push( bracket.escapeSource + '(?:' + bracket.openSource + '|' + bracket.closeSource + ')' );
	}
	
	return CombinedBrackets;
	
})();

//TODO: throw error if no capture brackets??
var Parser = (function(){
	function Parser( captureBrackets, escapeBrackets, opts ){
		
		var opts = typeof opts === 'object' ? opts : {},
			regexFirst = opts.regexFirst,
			capture = new CombinedBrackets( captureBrackets, regexFirst ),
			escape = new CombinedBrackets( escapeBrackets, regexFirst ),
			escapeCombinedSources = escape.combinedSources ? ('|' + escape.combinedSources) : '',
			regex = new RegExp( '(?:^|\\b)?(' + capture.combinedSources + escapeCombinedSources + ')(?:\\b|$)?' );
			
		this.extract = function( str, count ){
		
			if (typeof count !== "number") count = -1;
		
			return new Extraction( capture, escape, regex ).extract( str, count );
		}
	}
	
	return Parser;
})();

var JS = {
	Strings : [
		new Brackets({
			open : '"',
			close : '"',
			escape : '\\',
			canHaveNest : false
		}),
		new Brackets({
			open : '\'',
			close : '\'',
			escape : '\\',
			canHaveNest : false
		}),
		new Brackets({
			open : '`',
			close : '`',
			escape : '\\',
			canHaveNest : false
		})
	]
}

module.exports = {
	Parser : Parser,
	Brackets : Brackets,
	JS : JS
};
