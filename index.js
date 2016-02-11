/*
Copyright Brian Ninni 2016

Changes:
	-added custom error function
	-added row and col counters
	-added in default css and html ignores
	-Removed BracketsList and CombinedBrackets, now there is just Brackets and Bracket objects

Todo:
	Tests, Readme, Comments
		-make note that if the use a regex, it will match in the order it is listed
			-pen will match before penny
		-make note that if a segment matches multiple open brackets, the first one listed will be used
			-this is because the 'escapeRegex' is specific to a bracket

	Parser options:
		-wordBoundary
			-don't open the nest if the first char of open string and the last char of the current content both match \w
			-don't close if the last char of the close string and first char of next string both match \w
		-error function
			-finish all TODOs about errors
			-go through and see if any other places should have todos
		
	The Nest object:
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

function defaultHandle(){
	return this.open + this.content + this.close;
}

//to build an escape regex
function buildEscapeRegex( source ){
	return source ? new RegExp("(^|[^(?:" + source + ")])" + source + "(" + source + "{2})*$") : null;
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

var Brackets = (function(){

	function Bracket( data ){
		var data = typeof data === "object" ? data : {},
			open = data.open,
			close = data.close,
			escape = data.escape,
			maxDepth = typeof data.maxDepth === "number" ? data.maxDepth : -1,
			handle = typeof data.handle === "function" ? data.handle : defaultHandle;
			
		open =  new RegexList( open );
		//TODO: if( !close ) close = getMate( open );
		close = new RegexList( close );
		escape = new RegexList( escape );
			
		this.compile = function( regexFirst ){
			var openSource = open.toString( regexFirst ),
				closeSource = close.toString( regexFirst ),
				escapeSource = escape.toString( regexFirst ),
				openRegex = new RegExp( '^(' +  openSource + ')$' ),
				closeRegex = new RegExp( '^(' +  closeSource + ')$' ),					
				escapeRegex = buildEscapeRegex( escapeSource );
			
			this.isOpenMatch = function( str ){
				return str.match( openRegex );
			};
			
			this.isCloseMatch = function( str ){
				return str.match( closeRegex );
			};
			
			this.isEscapeMatch = function( str ){
				return str.match( escapeRegex );
			}
			this.openSource = openSource;
			this.closeSource = closeSource;
			this.handle = handle;
			this.maxDepth = maxDepth;
		}
	}
	
	//TODO: throw error if no 'open'??
	//TODO: accept just a string or just an array?
	function Brackets( obj ){
		var data = typeof obj === "object" ? obj : {},
			escape = data.escape,
			maxDepth = data.maxDepth,
			handle = data.handle,
			content = [];
		
		//to add a bracket to the content
		function add( data ){			
			data.handle = handle;
			data.escape = escape;
			data.maxDepth = maxDepth;
			
			content.push( new Bracket(data) );
		}
		
		function addMate( mate ){
			if( isArray( mate ) ) add({
				open : mate[0],
				close : mate[1],
			});
		}
		
		function addBracket( bracket ){
			if( bracket instanceof Brackets ) content.push(bracket);
		}
		
		//if its a single Brackets object, then return that
		if( obj instanceof Brackets ) return obj;
		
		//if its an array, then add each to the content
		if( isArray( obj ) ) obj.forEach( addBracket );
		else if( 'mates' in data && isArray( data.mates ) ) data.mates.forEach( addMate );
		else if( 'mate' in data ) addMate( data.mate );
		else add( data );
		
		this.compile = function( regexFirst ){
			
			var openSources = [],
				openSource = '',
				openRegex = null,
				closeSources = [],
				closeSource = '',
				closeRegex = null,
				combinedSource = '';
			
			content.forEach(function( bracket ){				
				bracket.compile( regexFirst );
				openSources.push( bracket.openSource );
				closeSources.push( bracket.closeSource );
			});
			
			//if Bracket data exists, update the data
			if( content.length ){
				openSource = openSources.join('|');
				openRegex = new RegExp('^(?:' + openSource + ')$');
				closeSource = closeSources.join('|');
				closeRegex = new RegExp('^(?:' + closeSource + ')$');
				combinedSource = openSources.concat( closeSources ).join('|');
			}
			
			this.openSource = openSource;
			this.closeSource = closeSource;
			this.combinedSource = combinedSource;
			
			this.isOpenMatch = function( str ){
				return str.match( openRegex );
			}
			
			this.isCloseMatch = function( str ){
				return str.match( closeRegex );
			}
	
			this.getFirstOpenMatch = function(str){
				var i, l = content.length,
					match = null;
					
				for(i=0;i<l;i++){
					if( content[i].isOpenMatch( str ) ){
						match = content[i];
						break;
					}
				}
				
				//if the match is a Brackets, then get the specific Bracket
				if( match instanceof Brackets ) return match.getFirstOpenMatch( str );
				
				return match;
			};
			
			return this;
		}
		
		//initialize compilation with regexFirst = false
		this.compile( false );
	}
	
	return Brackets;
})();

var Extraction = (function(){

	function Extraction( capture, ignore, regex, maxDepth, escapeRegex, errorHandle ){
		this.capture = capture;
		this.ignore = ignore;
		this.regex = regex;
		
		this.isEscapeMatch = function( str ){
			return str.match( escapeRegex );
		};
		
		this.maxDepth = maxDepth;
		this.errorHandle = errorHandle;
		//TODO: error if maxDepth = 0?
	}
	
	Extraction.prototype.init = function( str, doInclude ){
		this.strings = str.split( this.regex );
		this.row = 0;
		this.col = 0;
		this.index = 0;
		this.currentNest = new Nest.Base( doInclude, this );
		return this.currentNest.public;
	}
	
	//to return the given value if there is no error
	Extraction.prototype.returnIfNoError = function( val ){
		//if the current nest is not the base nest, then there was an error
		if( this.currentNest.parent ){
			this.errorHandle(new Error('No Close Bracket detected for Open Bracket of \'' + this.currentNest.public.open + '\' found at index ' + this.currentNest.startIndex + ' (row ' + this.currentNest.startRow + ', col ' + this.currentNest.startCol + ')' ));
			return null;
		}
		
		return val;
	}

	Extraction.prototype.extract = function( str, count ){
		//initialize the base nest, but don't include it in the results
		var self = this,
			baseNest = this.init( str, false );
		this.handleAllStringsUntil(function(){
			return self.currentNest.public === baseNest && baseNest.matches.length === count;
		});
		return this.returnIfNoError( baseNest.matches );
	}

	Extraction.prototype.handle = function( str ){
		var baseNest = this.init( str, true );
		this.handleAllStrings();
		return this.returnIfNoError( baseNest.content );
	}

	Extraction.prototype.parse = function( str ){	
		var baseNest = this.init( str, true );
		this.handleAllStrings();
		return this.returnIfNoError( baseNest );
	}

	Extraction.prototype.replace = function( str, fn ){
		var baseNest = this.init( str, true );
		this.nestHandle = fn;
		this.handleAllStrings();
		return this.returnIfNoError( baseNest.content );
	}
	
	Extraction.prototype.handleAllStringsUntil = function( condition ){
		while( !condition() && this.strings.length ) this.handleNextString();
	}
	
	Extraction.prototype.handleAllStrings = function(){
		while( this.strings.length ) this.handleNextString();
	}
	
	Extraction.prototype.handleNextString = function(){
		var str = popFirst( this.strings );
		if( !str ) return;
		this.handleString( str );
		this.increaseCounters( str );
	}
	
	var lineBreakRegex = /\r\n?|\n/g;
	
	Extraction.prototype.increaseCounters = function( str ){
		var match = str.split( lineBreakRegex ),
			//the number of linebreaks is one less than the size of the array
			numOfBreaks = match.length-1;
			
		this.index += str.length;
		this.row += numOfBreaks;
		//reset col index if there is a line break
		if( numOfBreaks ) this.col = 0;
		//increase by the length of the last string in the array
		this.col += match.pop().length;
	}

	Extraction.prototype.handleString = function( str ){

		//if the last portion of the content is escaped, then just add the string
		if( this.currentNest.endsWithEscape ) return this.addString( str );

		//if the string is a close match, then close
		if( this.currentNest.isCloseMatch( str ) ) return this.closeNest( str );
		
		//if we are at the max depth, then add the string
		if( this.currentNest.atMaxDepth ) return this.addString( str );
		
		//if it matches an open Regex:
		if( this.capture.isOpenMatch( str ) ) return this.openNest( str, false );
		
		//if it matches any close Regex:
		if( this.capture.isCloseMatch( str ) ){
			//TODO: throw error here, closeRegex encountered without openRegex??
			//what about ignore?
		}
		
		//if it matches an escape open regex, then set escaped
		if( this.ignore.isOpenMatch( str ) ) return this.openNest( str, true );
		
		this.addString( str );
	}

	Extraction.prototype.openNest = function( str, doIgnore ){
		var bracket = (doIgnore ? this.ignore : this.capture).getFirstOpenMatch( str ),
			handle = this.nestHandle ? this.nestHandle : bracket.handle;
			
		//TODO: throw error if bracket === null?
			
		this.currentNest = new Nest.Wrapper( str, this.currentNest, bracket, handle, this, doIgnore );
	}

	//to add text to the current result if there is one
	Extraction.prototype.addString = function( str ){
		this.currentNest.addChildString( str );
	}

	Extraction.prototype.closeNest = function( str ){
		this.currentNest.close( str );
		this.currentNest = this.currentNest.parent;
	}
	return Extraction;
})();

var Nest = new function(){
	function Nest(){
		this.nest = [];
		this.simple = [];
		this.hasChildNest = false;
		this.rawContent = '';
		this.content = '';
		this.open = '';
		this.close = '';
		this.index = [];
		this.nextIndex = [];
		this.matches = [];
		this.ancestors = [];
		this.depth = 0;
		this.parent = null;
	}

	function addChildNest( child ){
		var childNest = child.public,
			nest = this.public;
		
		this.lastEntryType = Nest;
		nest.matches.push( childNest );
		nest.nest.push( childNest );
		nest.simple.push( childNest.simple );
		nest.hasChildNest = true;
		
		this.addToChildNest( child, true );
	}

	function addChildString( str ){
		var nest = this.public;
		
		//add this string to the content and handled content
		this.addOriginalString( str );
		this.addHandledString( str );
		
		//add the string to the nest and simply arrays
		if( this.lastEntryType === String ){
			nest.nest[ nest.nest.length-1 ] += str;
			nest.simple[ nest.simple.length-1 ] += str;
		}
		else{
			nest.nest.push( str );
			nest.simple.push( str );
		}
		
		this.lastEntryType = String;
		this.endsWithEscape = this.isEscapeMatch( str );
	}

	function addOriginalString( str ){
		this.public.rawContent += str;
	}

	function addHandledString( str ){
		this.public.content += str;
	}
	
	this.Base = (function(){
		function BaseNest( doInclude, extraction ){
						
			this.public = new Nest();
			
			//set some properties from the input
			this.doInclude = doInclude;
			this.maxDepth = extraction.maxDepth;
			this.isEscapeMatch = extraction.isEscapeMatch;
			
			//initialize other properties
			this.startIndex = 0;
			this.doIgnore = false;
			this.atMaxDepth = false;
			this.endsWithEscape = false;
			this.lastEntryType = null;
		}
		
		BaseNest.prototype.addChildNest = addChildNest;
		BaseNest.prototype.addChildString = addChildString;
		BaseNest.prototype.addOriginalString = addOriginalString;
		BaseNest.prototype.addHandledString = addHandledString;
		
		BaseNest.prototype.addToChildNest = function( child, isParent ){
			var childNest = child.public,
				nest = this.public;
				
			//add the offset from the original string regardless
			//TODO: is this a good idea?
			childNest.index.unshift( child.startIndex );
			
			//only add if this base nest is included
			if( !this.doInclude ) return;
			
			if( isParent ) childNest.parent = nest;
			
			childNest.ancestors.unshift( nest );
			childNest.depth++;
		};
		
		BaseNest.prototype.isCloseMatch = function( str ){
			return false;
		}
		
		return BaseNest;
	})();
	
	this.Wrapper = (function(){
		function NestWrapper( str, parent, bracket, handle, extraction, doIgnore ){
			//ignore if the parent is ignored as well
			var doIgnore = doIgnore || parent.doIgnore,
			//use the lowest non-negative value for the max depth
				maxDepth = lowestNonNegative( [parent.maxDepth-1, bracket.maxDepth] ),
				nest = new Nest();
			
			//set some properties from the input
			this.doIgnore = doIgnore;
			this.startIndex = extraction.index;
			this.startRow = extraction.row;
			this.startCol = extraction.col;
			this.isEscapeMatch = bracket.isEscapeMatch;
			this.isCloseMatch = bracket.isCloseMatch;
			this.handle = handle.bind(nest);
			this.maxDepth = maxDepth;
			
			//initialize other values
			this.atMaxDepth = maxDepth === 0;
			this.endsWithEscape = false;
			this.lastEntryType = null;
				
			//set the open string
			nest.open = str;
			this.public = nest;
			
			//add this as a child to the parent if not ignoring
			if( !doIgnore ) parent.addChildNest( this );
			this.parent = parent;
		}
		
		NestWrapper.prototype.addChildNest = addChildNest;
		NestWrapper.prototype.addChildString = addChildString;
		NestWrapper.prototype.addOriginalString = addOriginalString;
		NestWrapper.prototype.addHandledString = addHandledString;
		
		NestWrapper.prototype.addToChildNest = function( child, isParent ){
			var childNest = child.public,
				nest = this.public;
			
			if( isParent ) childNest.parent = nest;
			
			childNest.ancestors.unshift( nest );
			childNest.index.unshift( child.startIndex - this.startIndex - nest.open.length );
			childNest.depth++;
			
			this.parent.addToChildNest( child, false );
		};
		
		NestWrapper.prototype.isCloseMatch = function( str ){
			return str.match( this.closeRegex );
		};
		
		NestWrapper.prototype.close = function( str ){
			var nest = this.public,
				fullString = nest.open + nest.rawContent + str,
				length = fullString.length;
			
			//if ignore, then just add the full string to the parent
			if( this.doIgnore ) return this.parent.addChildString( fullString );
			
			nest.close = str;
			
			//get the next index for each ancestor
			nest.index.forEach(function( i ){
				nest.nextIndex.push( i + length );
			});
			
			//add the content to the parent content
			this.parent.addOriginalString( fullString );
			this.parent.addHandledString( this.handle() );
		}
		
		return NestWrapper;
	})();
	
};

//TODO: throw error if no capture brackets??
var Parser = (function(){

	function stripHandle(){
		return '';
	};
	
	function defaultErrorHandle( err ){
		console.log( err );
	}
	
	function Parser( captureBrackets, ignoreBrackets, opts ){
		
		var opts = typeof opts === 'object' ? opts : {},
			regexFirst = opts.regexFirst === true,
			errorHandle = typeof opts.errorHandle === "function" ? opts.errorHandle : defaultErrorHandle,
			maxDepth = typeof opts.maxDepth === "number" ? opts.maxDepth : -1,
			capture = new Brackets( captureBrackets).compile( regexFirst ),
			ignore = new Brackets( ignoreBrackets ).compile( regexFirst ),
			allCombinedSources = capture.combinedSource + (ignore.combinedSource ? ('|' + ignore.combinedSource) : ''),
			regex = new RegExp( '(' + allCombinedSources + ')' ),
			escapeSource = new RegexList( opts.escape ).toString( regexFirst ),
			escapeRegex = buildEscapeRegex( escapeSource );
		
		//TODO: error if capture combined sources is empty?? or at least no open source and no close source?
		
		function newExtraction(){
			return new Extraction( capture, ignore, regex, maxDepth, escapeRegex, errorHandle );
		}
		
		this.extract = function( str, count ){
			if (typeof count !== "number") count = -1;
			return newExtraction().extract( str, count );
		}
		
		this.handle = function( str ){
			return newExtraction().handle( str );
		}
		
		this.parse = function( str ){
			return newExtraction().parse( str );
		}
		
		this.strip = function( str ){
			return newExtraction().replace( str, stripHandle );
		}
		
		this.replace = function( str, fn ){
			return newExtraction().replace( str, fn );
		}
	}
	
	return Parser;
})();


var JS = {
	RegExp : new Brackets({
		mate : ['/','/'],
		maxDepth : 0,
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

var CSS = {
	Comments : new Brackets({
		mate : ['/*','*/'],
		maxDepth : 0,
	}),
	Strings : new Brackets({
		mates : [
			['"','"'],
			['\'','\''],
		],
		maxDepth : 0,
		escape : '\\'
	}),
}

var HTML = {
	Comments : new Brackets({
		mate : ['<!--','-->'],
		maxDepth : 0,
	}),
	Strings : new Brackets({
		mates : [
			['"','"'],
			['\'','\''],
		],
		maxDepth : 0,
		escape : '\\'
	}),
}

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
		escape : '\\'
	}).handle( str );
}

module.exports = {
	Parser : Parser,
	Brackets : Brackets,
	JS : JS,
	CSS : CSS,
	HTML : HTML,
};
