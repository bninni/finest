/*
Copyright Brian Ninni 2016

Todo:
	Tests, Readme, Comments
		-make note that if the use a regex, it will match in the order it is listed
			-pen will match before penny
		-make note that if a segment matches multiple open brackets, the first one listed will be used
			-this is because the 'escapeRegex' is specific to a bracket
		-note maxDepth=0 wont work for parser
		-note that maxDepth will ignore any nested open brackets, so it might come across and use the wrong close bracket
		
	Settings:
		-wordBoundary
		-escape

	What to do if open/close string has escape inside it?
		
	Should wordBoundary be assigned to a bracket?
	Should wordBoundary succeed if the boundary is another open/close bracket?
	
*/

var Settings = {
		regexFirst : false,
		wordBoundary : false,
		maxDepth : -1,
		wordRegex : '\\w',
		errorHandle : function( err ){
			throw err;
		},
		handle : function(){
			return this.open + this.content + this.close;
		}
	},
	WordBoundaryManager = (function(){
		function WordBoundaryManager( useWordBoundary, source ){
			source = source || Settings.wordRegex;
		
			this.useWordBoundary = typeof useWordBoundary === 'boolean' ? useWordBoundary : Settings.wordBoundary;
			this.endRegex = new RegExp( '(' + source + ')$' );
			this.startRegex = new RegExp( '^(' + source + ')' );
		}
		
		WordBoundaryManager.prototype.isEndMatch = function( str ){
			return str.match( this.endRegex );
		}
		
		WordBoundaryManager.prototype.isStartMatch = function( str ){
			return str.match( this.startRegex );
		}
		
		WordBoundaryManager.prototype.isValid = function( prevStr, str, nextStr ){
			return !(this.useWordBoundary && 
				(
					( prevStr && this.isEndMatch( prevStr ) && this.isStartMatch( str ) ) ||
					( this.isEndMatch( str ) && nextStr && this.isStartMatch( nextStr ) )
				)
			);
		}
		
		return WordBoundaryManager;
	})(),
	EscapeManager = (function(){
		function buildCaptureRegex( source ){
			return source ? new RegExp("(" + source + ")+$") : null;
		}

		function buildStripRegex( source ){
			return source ? new RegExp( "(?:" + source + ")([\\w\\W])", "g" ) : null;
		}
		
		//to assign escape functions to the given object
		function EscapeManager( source ){
			this.captureRegex = buildCaptureRegex( source ),
			this.countRegex = new RegExp( source ),
			this.stripRegex = buildStripRegex( source );
		}
		
		EscapeManager.prototype.strip = function( str ){
			return str.replace( this.stripRegex, '$1' );
		}
		
		EscapeManager.prototype.isMatch = function( str ){
			var count,
				match = str.match( this.captureRegex );
				
			if( !match ) return false;
			
			match = match[0].split( this.countRegex );
			
			//the length of the split is the number of regex in a row
			count = match.length-1;
			
			//if count is odd, then there is an escape
			return count%2;
		}
		
		return EscapeManager;
	})(),
	RegexList = (function(){
		//Characters that need to be escaped for use in RegEx
		var regexChars = new RegExp( '[\\' + ['^','[',']','{','}','(',')','\\','/','.',',','?','-','+','*','|','$'].join('\\') + ']', 'g' );

		//to sort an array by length
		function sortArrayByLength(a, b){
		  return b.length - a.length;
		}
		
		//to make a string regex safe by prefixing certain certain chars with the escape char
		function makeRegexSafe( str ){
			return str.replace( regexChars, '\\$&' )
		}

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
			
			//add the value to the array if not already there
			if( arr.indexOf( val ) === -1 ) arr.push( val );
		}

		return RegexList;

	})(),
	Brackets = (function(){
		function Bracket( data ){
			var data = typeof data === "object" ? data : {},
				open = data.open,
				close = data.close,
				escape = data.escape,
				ignore = data.ignore,
				maxDepth = typeof data.maxDepth === "number" ? data.maxDepth : Settings.maxDepth,
				handle = typeof data.handle === "function" ? data.handle : Settings.handle;
				
			open =  new RegexList( open );
			close = new RegexList( close );
			escape = new RegexList( escape );
			ignore = new RegexList( ignore );
			
			this.compile = function( regexFirst ){
				var openSource = open.toString( regexFirst ),
					closeSource = close.toString( regexFirst ),
					escapeSource = escape.toString( regexFirst ),
					ignoreSource = ignore.toString( regexFirst ),
					openRegex = buildFullRegex( openSource ),
					closeRegex = buildFullRegex( closeSource ),
					ignoreRegex = buildFullRegex( ignoreSource );
					
				this.EscapeManager = new EscapeManager( escapeSource );
					
				this.isOpenMatch = function( str ){
					return str.match( openRegex );
				};
				
				this.isCloseMatch = function( str ){
					return str.match( closeRegex );
				};
				
				this.isIgnoreMatch = function( str ){
					return str.match( ignoreRegex );
				};
				
				this.openSource = openSource;
				this.closeSource = closeSource;
				this.handle = handle;
				this.maxDepth = maxDepth;
			}
		}
		
		function Brackets( obj ){
			var data = typeof obj === "object" ? obj : {},
				escape = data.escape,
				maxDepth = data.maxDepth,
				handle = data.handle,
				ignore = data.ignore,
				content = [];
			
			//to add a bracket to the content
			function add( open, close ){
				content.push( new Bracket({
					open : open,
					close : close,
					handle : handle,
					escape : escape,
					ignore : ignore,
					maxDepth : maxDepth
				}) );
			}
			
			function addMate( mate ){
				if( isArray( mate ) ) add( mate[0], mate[1] );
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
			else add( data.open, data.close );
			
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
					openRegex = buildFullRegex( openSource );
					closeSource = closeSources.join('|');
					closeRegex = buildFullRegex( closeSource );
					combinedSource = (openSource && closeSource) ? openSources.concat( closeSources ).join('|') : '';
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
	})(),
	Extraction = (function(){
		var lineBreakRegex = /\r\n?|\n/g;
		
		function Extraction( capture, except, regex, maxDepth, escapeManager, errorHandle, wordBoundaryManager, isIgnoreMatch ){
			
			this.capture = capture;
			this.except = except;
			this.regex = regex;
			this.WordBoundaryManager = wordBoundaryManager;
			this.EscapeManager = escapeManager;
			this.isIgnoreMatch = isIgnoreMatch;			
			this.maxDepth = maxDepth;
			this.errorHandle = errorHandle;
		}
		
		Extraction.prototype.init = function( str, doInclude ){
			this.strings = str.split( this.regex );
			this.getNextString();
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
				this.errorHandle(new Error('No close bracket found for \'' + this.currentNest.public.open + '\' at index ' + this.currentNest.startIndex + ' (row ' + this.currentNest.startRow + ', col ' + this.currentNest.startCol + ')' ));
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
			this.currentNest.storeCurrentStringSegment();
		}
		
		Extraction.prototype.handleAllStrings = function(){
			while( this.strings.length ) this.handleNextString();
			this.currentNest.storeCurrentStringSegment();
		}
		
		Extraction.prototype.handleNextString = function(){
			var str = this.nextString;
			this.getNextString();
			this.handleString( str );
			this.increaseCounters( str );
		}
		
		Extraction.prototype.getNextString = function(){
			do{
				this.nextString = popFirst( this.strings );
			}while( !this.nextString && this.strings.length )
		}
		
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

			//if the last portion of the content is escaped or this string is an ignore match, then just add the string
			if( this.currentNest.endsWithEscape || this.currentNest.isIgnoreMatch( str ) ) return this.addString( str );

			//if the string is a close match, then close
			if( this.currentNest.isCloseMatch( str ) ) return this.closeNest( str );
			
			//if we are at the max depth, then add the string
			if( this.currentNest.atMaxDepth ) return this.addString( str );
			
			//if it matches an open Regex:
			if( this.capture.isOpenMatch( str ) ) return this.openNest( str, false );
			
			//if it matches an escape open regex, then set escaped
			if( this.except.isOpenMatch( str ) ) return this.openNest( str, true );
			
			//if it matches any close Regex:
			if( this.capture.isCloseMatch( str ) || this.except.isCloseMatch( str ) ) return this.handleUnmatchedClose( str );
			
			this.addString( str );
		}

		Extraction.prototype.openNest = function( str, doIgnore ){
			var bracket = (doIgnore ? this.except : this.capture).getFirstOpenMatch( str ),
				handle = this.nestHandle ? this.nestHandle : bracket.handle;
				
			//if it is not valid according to the word boundary, then just add the string
			if( !this.isValid( str ) ) return this.addString( str );
				
			this.currentNest = new Nest.Wrapper( str, this.currentNest, bracket, handle, this, doIgnore );
		}

		//to add text to the current result if there is one
		Extraction.prototype.addString = function( str ){
			this.currentNest.addChildString( str );
		}
		
		Extraction.prototype.handleUnmatchedClose = function( str ){
			//if it is valid according to the word boundary manager, then produce an error
			if( this.isValid( str ) ) this.errorHandle(new Error('No open bracket found for \'' + str + '\' at index ' + this.index + ' (row ' + this.row + ', col ' + this.col + ')' ));
			
			this.addString( str );
		}

		Extraction.prototype.isValid = function( str ){
			return this.WordBoundaryManager.isValid( this.currentNest.public.content, str, this.nextString );
		}
		
		Extraction.prototype.closeNest = function( str ){
			//if it is not valid according to the word boundary manager, then just add the string
			if( !this.isValid( str ) ) return this.addString( str );
			
			this.currentNest.close( str );
			this.currentNest = this.currentNest.parent;
		}
		return Extraction;
	})(),
	Nest = new function(){
		//to get the lowest non-negative value in the array
		function lowestNonNegative(arr){
			var newArr = arr.sort(),
				ret = popFirst( newArr );
			
			while( newArr.length && ret < 0) ret = popFirst( newArr );
			
			return ret >= 0 ? ret : -1;
		}

		var Nest = (function(){
			function Nest(){
				this.nest = [];
				this.simple = [];
				this.hasChildNest = false;
				this.raw = '';
				this.original = '';
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
			
			Nest.prototype.forEach = function( f ){
				var str = '';
				
				this.nest.forEach(function( el ){
					if( el instanceof Nest ) str += el.forEach( f );
					else str += el;
				});
				
				return (this.parent ? f.call( this, str ) : str);
			}
			
			return Nest;
		})();

		function addChildNest( child ){
			var childNest = child.public,
				nest = this.public;
			
			this.storeCurrentStringSegment();
			
			nest.matches.push( childNest );
			nest.nest.push( childNest );
			nest.simple.push( childNest.simple );
			nest.hasChildNest = true;
			
			this.addToChildNest( child, true );
		}
		
		function storeCurrentStringSegment(){
			var str = this.currentStringSegment,
				nest = this.public;
				
			if( str ){
				this.addRawString( str );
				//remove all escapes
				str = this.EscapeManager.strip( str );
				this.addOriginalString( str );
				this.addHandledString( str );
				nest.nest.push( str );
				nest.simple.push( str );
			}
			//reset the string segment
			this.currentStringSegment = '';
		}

		function addChildString( str ){			
			this.currentStringSegment += str;
			this.endsWithEscape = this.EscapeManager.isMatch( this.currentStringSegment );
		}

		function addOriginalString( str ){
			this.public.original += str;
		}

		function addRawString( str ){
			this.public.raw += str;
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
				this.isIgnoreMatch = extraction.isIgnoreMatch;
				this.EscapeManager = extraction.EscapeManager;
				
				//initialize other properties
				this.startIndex = 0;
				this.doIgnore = false;
				this.atMaxDepth = false;
				this.endsWithEscape = false;
				this.lastLetterIsWord = false;
				this.lastEntryType = null;
				this.currentStringSegment = '';
			}
			
			BaseNest.prototype.storeCurrentStringSegment = storeCurrentStringSegment;
			BaseNest.prototype.addChildNest = addChildNest;
			BaseNest.prototype.addChildString = addChildString;
			BaseNest.prototype.addOriginalString = addOriginalString;
			BaseNest.prototype.addRawString = addRawString;
			BaseNest.prototype.addHandledString = addHandledString;
			
			BaseNest.prototype.addToChildNest = function( child, isParent ){
				var childNest = child.public,
					nest = this.public;
					
				//add the offset from the original string regardless
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
				this.EscapeManager = bracket.EscapeManager;
				this.isIgnoreMatch = bracket.isIgnoreMatch;
				this.isCloseMatch = bracket.isCloseMatch;
				this.handle = handle.bind(nest);
				this.maxDepth = maxDepth;
				
				//initialize other values
				this.atMaxDepth = maxDepth === 0;
				this.endsWithEscape = false;
				this.lastLetterIsWord = false;
				this.lastEntryType = null;
				this.currentStringSegment = '';
					
				//set the open string
				nest.open = str;
				this.public = nest;
				
				//add this as a child to the parent if not ignoring
				if( !doIgnore ) parent.addChildNest( this );
				this.parent = parent;
			}
			
			NestWrapper.prototype.storeCurrentStringSegment = storeCurrentStringSegment;
			NestWrapper.prototype.addChildNest = addChildNest;
			NestWrapper.prototype.addChildString = addChildString;
			NestWrapper.prototype.addOriginalString = addOriginalString;
			NestWrapper.prototype.addRawString = addRawString;
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
					fullString, length;
				
				//store the last string segment
				this.storeCurrentStringSegment();
				
				fullString = nest.open + nest.raw + str;
				length = fullString.length;
				
				//if ignore, then just add the full raw string to the parent
				if( this.doIgnore ) return this.parent.addChildString( fullString );
				
				nest.close = str;
				
				//get the next index for each ancestor
				nest.index.forEach(function( i ){
					nest.nextIndex.push( i + length );
				});
				
				//add the content to the parent content
				this.parent.addRawString( fullString );
				this.parent.addOriginalString( nest.open + nest.original + str );
				this.parent.addHandledString( this.handle() );
			}
			
			return NestWrapper;
		})();
	},
	Parser = (function(){
		
		function stripHandle(){
			return '';
		};
		
		function assignWordBoundaryFunctions( target, source ){
			var wordRegex = source || Settings.wordRegex,
				wordRegexEnd = new RegExp( '(' + wordRegex + ')$' ),
				wordRegexBegin = new RegExp( '^(' + wordRegex + ')' );
			
			target.isLastLetterWord = function( str ){
				return str.match( wordRegexEnd );
			}
			
			target.isFirstLetterWord = function( str ){
				return str.match( wordRegexBegin );
			}
		}
		
		function Parser( opts ){
			
			var opts = typeof opts === 'object' ? opts : {},
				regexFirst = typeof opts.regexFirst === 'boolean' ? opts.regexFirst : Settings.regexFirst,
				wordBoundaryManager = new WordBoundaryManager( opts.wordBoundary, new RegexList( opts.wordRegex ).toString( regexFirst ) ),
				ignoreRegexSource = new RegexList( opts.ignore ).toString( regexFirst ),
				ignoreRegex = buildFullRegex(ignoreRegexSource),
				errorHandle = typeof opts.errorHandle === "function" ? opts.errorHandle : Settings.errorHandle,
				maxDepth = typeof opts.maxDepth === "number" ? opts.maxDepth : (Settings.maxDepth ? Settings.maxDepth : -1 ), //if the Settings.maxDepth = 0, then use -1 instead
				capture = new Brackets( opts.capture ).compile( regexFirst ),
				except = new Brackets( opts.except ).compile( regexFirst ),
				allCombinedSources = capture.combinedSource + (except.combinedSource ? ('|' + except.combinedSource) : ''),
				regex = new RegExp( '(' + allCombinedSources + ')' ),
				escapeManager = new EscapeManager( new RegexList( opts.escape ).toString( regexFirst ) );
										
			function isIgnoreMatch( str ){
				return str.match( ignoreRegex );
			};
			
			function newExtraction(){
				return new Extraction( capture, except, regex, maxDepth, escapeManager, errorHandle, wordBoundaryManager, isIgnoreMatch );
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
	})(),
	removeCaptureGroups = (function(){
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
			}),
			opts = {
				escape : '\\'
			},
			parser = new Parser( Parens, Bracks,opts);
			
		//to change all capture groups to non-capture groups in a regex source string		
		function remove( str ){
			return parser.handle( str );
		}
		
		return remove;
	})(),
	JS = {
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
	},
	CSS = {
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
	},
	HTML = {
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
	};
	
//to get the first value
function popFirst( arr ){
	return arr.splice(0,1)[0];
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

//to build a full string match regex
function buildFullRegex( source ){
	return source ? new RegExp( '^(?:' +  source + ')$' ) : null;
}

//to define the settings
function defineSettings( obj ){
	var key;
	
	if (typeof obj !== 'object') return;
	
	if( typeof obj.regexFirst === 'boolean' ) Settings.regexFirst = obj.regexFirst;
	if( typeof obj.maxDepth === 'number' ) Settings.maxDepth = obj.maxDepth;
	if( 'wordRegex' in obj ) Settings.wordRegex = new RegexList( obj.wordRegex ).toString( Settings.regexFirst );
	if( typeof obj.errorHandle === 'function' ) Settings.errorHandle = obj.errorHandle;
	if( typeof obj.handle === 'function' ) Settings.handle = obj.handle;
};

module.exports = {
	Parser : Parser,
	Brackets : Brackets,
	JS : JS,
	CSS : CSS,
	HTML : HTML,
	Settings : defineSettings
};
