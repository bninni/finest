/*
Copyright Brian Ninni 2016

Todo:
	Tests, Readme, Comments
		-make note that if the use a regex, it will match in the order it is listed
			-pen will match before penny
		-make note that if a segment matches multiple open brackets, the first one listed will be used
			-this is because the 'escapeRegex' is specific to a bracket

	Finish WordBoundary:
		-need one for the open/close of the content brackets and one for the close bracket of the current nest
		-should succeed if the boundary is another open/close bracket?
			
	Test all default Brackets
	
	Test using regex input for CompileRegexList

	raw, original, and handled should each have its own tree, simple, content, index, nextIndex
*/

var Settings = {
		wordBoundary : false,
		rejectUnexpectedClose : true,
		regexFirst : false,
		escape : '',
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
	RegexMatcher = (function(){
		function RegexMatcher( source ){
			this.source = source;
			this.regex = buildFullRegex( source );
		}
		
		RegexMatcher.prototype.isMatch = function( str ){
			return str.match( this.regex );
		}
		
		return RegexMatcher;
		
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
			
			source = source || Settings.escape;
			
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
	CompileRegexList = (function(){
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
		
		function addToArray( val, stringArray, regexArray ){
			var arr;
			
			//if regex, set the value to be the source without capture groups:
			if( isRegExp( val ) ){
				arr = regexArray;
				val = removeCaptureGroups( val.source );
			}
			//if string:
			else if( isString( val ) ) arr = stringArray;
			else return;
			
			//add the value to the array if not already there
			if( arr.indexOf( val ) === -1 ) arr.push( val );
		}

		function CompileRegexList( data, regexFirst ){
			var returnArray,
				stringArray = [],
				regexArray = [];
				
			function add( val ){
				addToArray( val, stringArray, regexArray );
			}
				
			if( isArray( data ) ) data.forEach( add );
			else add( data );
			
			//sort the strings by length and convert to regex safe
			var arr = stringArray.sort( sortArrayByLength ).map( makeRegexSafe );
			
			arr = regexFirst ? regexArray.concat( arr ) : arr.concat( regexArray );
			return arr.join('|');
		}
		
		return CompileRegexList;

	})(),
	Brackets = (function(){
		function Mates( open, close, regexFirst ){
			var openSource = CompileRegexList( open, regexFirst ),
				closeSource = CompileRegexList( close, regexFirst );
				
			this.Open = new RegexMatcher( openSource );
			this.Close = new RegexMatcher( closeSource );
		}
		
		function findOpenMatch( str, arr ){
			var i, l = arr.length;
			for(i=0;i<l;i++) if( arr[i].Open.isMatch( str ) ) return arr[i];
		}
		
		function Brackets( obj ){
			var data = typeof obj === "object" ? obj : {},
				regexFirst = typeof data.regexFirst === 'boolean' ? data.regexFirst : Settings.regexFirst,
				escapeSource = CompileRegexList( data.escape, regexFirst ),
				openSources = [],
				closeSources = [],
				contentList = [];
			
			//to add a Brackets to the bracketList
			function addBracket( obj ){
				openSources.push( obj.Open.source );
				closeSources.push( obj.Close.source );
			}
			
			//to create a new bracket from a mate pair
			function addMate( mate ){
				if( isArray( mate ) ) addBracket( new Mates( mate[0], mate[1], regexFirst ) );
			}
			
			//to add content to the content list
			function addContent(){
				var args = Array.prototype.slice.apply( arguments );
				args.forEach( addToContentBrackets );
			}
			function addToContentBrackets( obj ){
				if( isArray( obj ) ) obj.forEach( addToContentBrackets );
				else if( obj instanceof Brackets ) contentList.push( obj );
			}
			
			//create each Bracket and add to the Bracket List
			if( 'mates' in data && isArray( data.mates ) ) data.mates.forEach( addMate );
			else if( 'mate' in data ) addMate( data.mate );
			else addBracket( new Mates( data.open, data.close, regexFirst ) );
			
			//add each Content Bracket to the Content List
			addToContentBrackets( data.content );
			
			this.EscapeManager = new EscapeManager( escapeSource );
			this.rejectUnexpectedClose = typeof data.rejectUnexpectedClose === 'boolean' ? data.rejectUnexpectedClose : Settings.rejectUnexpectedClose,
			this.Handle = typeof data.handle === "function" ? data.handle : Settings.handle;
			this.WordBoundaryManager = new WordBoundaryManager( data.wordBoundary, CompileRegexList( data.wordRegex, regexFirst ) ),
			this.addContent = addContent;
			this.Open = new RegexMatcher( openSources.join('|') );
			this.Close = new RegexMatcher( closeSources.join('|') );
			this.getContentManager = function(){
				return new ContentManager( contentList, this.Close );
			}
			//to see if the given str is valid
			//is valid if the prev str does not end with escape AND
			//there is a no word boundary error
			this.isValid = function( prevStr, str, nextStr ){
				return !this.EscapeManager.isMatch( prevStr ) && this.WordBoundaryManager.isValid( prevStr, str, nextStr );
			}
			
			this.contentList = contentList;
		}
		
		function ContentManager( contentList, closeManager ){
				
				var openSources = [],
					closeSources = [],
					regexSource = closeManager.source,
					openRegex = null,
					nextRegex = null;
				
				contentList.forEach(function( obj ){
					openSources.push( obj.Open.source );
					closeSources.push( obj.Close.source );
				})
				
				if( contentList.length ){
					regexSource += '|' + openSources.join('|') + '|' + closeSources.join('|');
					openRegex = new RegExp('^(' + openSources.join('|') + ')$' );
				}
				
				if( regexSource ) nextRegex = new RegExp('^([\\w\\W]*?)(' + regexSource + ')([\\w\\W]*)$');
				
				this.isCloseMatch = function( str ){
					return closeManager.isMatch( str );
				}
				this.nextRegex = nextRegex;
				
				this.getNextString = function( str ){
					return str.match( nextRegex );
				}
				
				this.getOpenMatch = function( str ){
					var match;
					//return null if not open match
					if( !str.match( openRegex ) ) return null;
					return findOpenMatch( str, contentList );
				}
		}
		
		return Brackets;
	})(),
	Nest = (function(){
		var Nest = (function(){
			function Nest( str ){
				this.nest = [];
				this.simple = [];
				this.hasChildNest = false;
				this.raw = '';
				this.original = '';
				this.content = '';
				this.open = str ? str : '';
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
		
		var NestWrapper = (function(){
			function NestWrapper( brackets, extraction, str, parent ){
				this.public = new Nest( str );
				
				//set some properties from the input
				this.Brackets = brackets;
				this.ContentManager = brackets.getContentManager();
				this.startIndex = extraction.index;
				this.startRow = extraction.row;
				this.startCol = extraction.col;				
				this.handle = (extraction.nestHandle ? extraction.nestHandle : brackets.Handle).bind(this.public);
				this.parent = parent;
				
				//override the isCloseMatch function if this is the Base Nest
				if( !parent ) this.ContentManager.isCloseMatch = function( str ){
					return false;
				};
				
				//initialize other properties
				this.doInclude = true;
				this.currentStringSegment = '';
			}
			
			NestWrapper.prototype.storeCurrentStringSegment = function(){
				var str = this.currentStringSegment,
					nest = this.public;
					
				if( str ){
					this.addRawString( str );
					//remove all escapes
					str = this.Brackets.EscapeManager.strip( str );
					this.addOriginalString( str );
					this.addHandledString( str );
					nest.nest.push( str );
					nest.simple.push( str );
				}
				//reset the string segment
				this.currentStringSegment = '';
			};
			
			NestWrapper.prototype.addChildNest = function( str, brackets, extraction ){
				var child = new NestWrapper( brackets, extraction, str, this ),
					childNest = child.public,
					nest = this.public;
				
				this.storeCurrentStringSegment();
				
				nest.matches.push( childNest );
				nest.nest.push( childNest );
				nest.simple.push( childNest.simple );
				nest.hasChildNest = true;
				
				this.addToChildNest( child, true );
				
				return child;
			};
			
			NestWrapper.prototype.addChildString = function( str ){			
				this.currentStringSegment += str;
			};
			
			NestWrapper.prototype.addOriginalString = function( str ){
				this.public.original += str;
			};
			
			NestWrapper.prototype.addRawString = function( str ){
				this.public.raw += str;
			};
			
			NestWrapper.prototype.addHandledString = function( str ){
				this.public.content += str;
			};
			
			NestWrapper.prototype.addToChildNest = function( child, isParent ){
				var childNest = child.public,
					nest = this.public;
					
				childNest.index.unshift( child.startIndex );
				
				//if the nest is not included, then return
				if( !this.doInclude ) return;
				
				if( isParent ) childNest.parent = nest;
				
				childNest.ancestors.unshift( nest );
				childNest.depth++;
				
				if( this.parent ) this.parent.addToChildNest( child, false );
			};
			
			NestWrapper.prototype.close = function( str ){
				var nest = this.public,
					fullString, length;
				
				//store the last string segment
				this.storeCurrentStringSegment();
				
				nest.close = str;
				
				fullString = nest.open + nest.raw + str;
				length = fullString.length;
				
				//get the next index for each ancestor
				nest.index.forEach(function( i ){
					nest.nextIndex.push( i + length );
				});
				
				//add the content to the parent content
				this.parent.addRawString( fullString );
				this.parent.addOriginalString( nest.open + nest.original + str );
				this.parent.addHandledString( this.handle() );
				
				return this.parent;
			};
			
			return NestWrapper;
		})();
		
		return NestWrapper;
	})(),
	Parser = (function(){
		
		var Extraction = (function(){
			var lineBreakRegex = /\r\n?|\n/g;
			
			function Extraction( errorHandle, brackets, str ){
				this.errorHandle = errorHandle;
				this.remainingString = str;
				this.row = 0;
				this.col = 0;
				this.index = 0;
				this.WordBoundaryManager = brackets.wordBoundaryManager;
				this.Nest = new Nest( brackets, this );	
			}
			
			//to return the given value if there is no error
			Extraction.prototype.returnIfNoError = function( val ){
				//if the current nest is not the base nest, then there was an error
				if( this.Nest.parent ){
					this.errorHandle(new Error('No close bracket found for \'' + this.Nest.public.open + '\' at index ' + this.Nest.startIndex + ' (row ' + this.Nest.startRow + ', col ' + this.Nest.startCol + ')' ));
					return null;
				}
				return val;
			}
			
			Extraction.prototype.handleAllStringsUntil = function( condition ){
				while( !condition() && this.remainingString ) this.handleNextString();
				this.Nest.storeCurrentStringSegment();
			}
			
			Extraction.prototype.handleAllStrings = function(){
				while( this.remainingString ) this.handleNextString();
				this.Nest.storeCurrentStringSegment();
			}
			
			Extraction.prototype.handleNextString = function(){
				var str = this.getNextString();
				//if a string was returned, then handle it
				//otherwise, it is finished
				if( !str ) return;
				
				//if it is not valid according to the word boundary, then just add the string
				if( !this.Nest.Brackets.isValid( this.Nest.currentStringSegment, str, this.remainingString ) ) this.addString( str );
				//otherwise, handle it
				else this.handleString( str );
				
				this.increaseCounters( str );
			}
			
			Extraction.prototype.getNextString = function(){
				
				var match = this.Nest.ContentManager.getNextString( this.remainingString );
				
				//if there is no match, then it is finished
				if( !match ){
					this.addString( this.remainingString );
					return this.remainingString = '';
				}
				//add the non-important string
				this.addString( match[1] );
				//update the remaining string
				this.remainingString = match[3];
				//return the important string
				return match[2];
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
				var brackets;
				
				//if the string is a close match, then close
				if( this.Nest.ContentManager.isCloseMatch( str ) ) return this.closeNest( str );
				
				//if the string is an open match, then open
				if( brackets = this.Nest.ContentManager.getOpenMatch( str ) ) return this.openNest( str, brackets );
				
				//otherwise, it is an unmatched Close bracket
				
				//if we reject unexpected close, then run the error handle
				if( this.Nest.Brackets.rejectUnexpectedClose ) this.errorHandle(new Error('No open bracket found for \'' + str + '\' at index ' + this.index + ' (row ' + this.row + ', col ' + this.col + ')' ));
				this.addString( str )
			}

			Extraction.prototype.openNest = function( str, brackets ){
				this.Nest = this.Nest.addChildNest( str, brackets, this );
			}

			//to add text to the current result if there is one
			Extraction.prototype.addString = function( str ){
				if( str ) this.Nest.addChildString( str );
			}
			
			Extraction.prototype.closeNest = function( str ){
				this.Nest = this.Nest.close( str );
			}
			
			return Extraction;
		})();
		
		function stripHandle(){
			return '';
		};
		
		function Parser( brackets, errorHandle ){
			
			var errorHandle = typeof errorHandle === "function" ? errorHandle : Settings.errorHandle;
			
			if( !(brackets instanceof Brackets) ){
				errorHandle(new Error('The Parser input must be a Brackets Object'));
				return null;
			}
			
			function newX( str ){
				return new Extraction( errorHandle, brackets, str );
			}
			
			this.extract = function( str, count ){
				var X = newX( str );
				
				if (typeof count !== "number") count = -1;
				
				X.Nest.doInclude = false;
				
				//if there is a count, then stop when the number of matches is reached
				if( count > -1 ) X.handleAllStringsUntil(function(){
					return (!X.Nest.parent && X.Nest.matches.length === count);
				});
				//if there is no count, then just handle all strings
				else X.handleAllStrings();
				
				return X.returnIfNoError( X.Nest.public.matches );
			}
			
			this.handle = function( str ){
				var X = newX( str );
				X.handleAllStrings();
				return X.returnIfNoError( X.Nest.public.content );
			}
			
			this.parse = function( str ){
				var X = newX( str );
				X.handleAllStrings();
				return X.returnIfNoError( X.Nest.public );
			}
			
			function replace( str, fn ){
				var X = newX( str );
				X.nestHandle = fn;
				X.handleAllStrings();
				return X.returnIfNoError( X.Nest.public.content );
			}
			this.replace = replace;
			
			this.strip = function( str ){
				return replace( str, stripHandle );
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
			escape : '\\'
		}),
		Strings : new Brackets({
			mates : [
				['"','"'],
				['\'','\''],
				['`','`'],
			],
			escape : '\\'
		}),
		Comments : new Brackets({
			mates : [
				['/*','*/'],
				['//',['\r\n','\r','\n']],
			],
		})
	},
	CSS = {
		Comments : new Brackets({
			mate : ['/*','*/'],
		}),
		Strings : new Brackets({
			mates : [
				['"','"'],
				['\'','\''],
			],
			escape : '\\'
		}),
	},
	HTML = {
		Comments : new Brackets({
			mate : ['<!--','-->'],
		}),
		Strings : new Brackets({
			mates : [
				['"','"'],
				['\'','\''],
			],
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
	if (typeof obj !== 'object') return;
	
	if( typeof obj.regexFirst === 'boolean' ) Settings.regexFirst = obj.regexFirst;
	if( typeof obj.rejectUnexpectedClose === 'boolean' ) Settings.rejectUnexpectedClose = obj.rejectUnexpectedClose;
	if( typeof obj.wordBoundary === 'boolean' ) Settings.wordBoundary = obj.wordBoundary;
	
	if( typeof obj.errorHandle === 'function' ) Settings.errorHandle = obj.errorHandle;
	if( typeof obj.handle === 'function' ) Settings.handle = obj.handle;
	
	if( 'wordRegex' in obj ) Settings.wordRegex = CompileRegexList( obj.wordRegex, Settings.regexFirst );
	if( 'escape' in obj ) Settings.escape = CompileRegexList( obj.escape, Settings.regexFirst );
};

module.exports = {
	Parser : Parser,
	Brackets : Brackets,
	JS : JS,
	CSS : CSS,
	HTML : HTML,
	Settings : defineSettings
};
