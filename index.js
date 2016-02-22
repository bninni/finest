/*
Copyright Brian Ninni 2016
	
Todo:
	Tests, Readme, Comments
		-make note that if the use a regex, it will match in the order it is listed
			-pen will match before penny
		-make note that if a segment matches multiple open brackets, the first one listed will be used
			-this is because the 'escapeRegex' is specific to a bracket
		-close first is only check searching for next string.  if open string and close string are identical, it will always close first.
			-but if the close string is part of an open string, it will match the open string first
						
	Brackets should have their own token handles
	
	Base nest should NOT handle?
		-make it an option?
						
	Should we remove escapes from Tokens??
		-they wouldn't match correctly if the escapes were there though..
						
	Need a simple function to use either the given value or the Settings value
		
	Finish Tokens:
		Add Public Class
			-with match, label, handle
		Can be added to a Brackets Content
		Add Tokens to the ContentManager.getNextString regex
			-need Extraction.prototype.addToken
			-.currentStringSegment should be currentToken
				-.addChildString will just updated the raw value in this.currentToken
				-.storeCurrentStringSegment will just run this.addToken( this.currentToken ) and then create a new Token in its place
		
	Finish WordBoundary:
		-need one for the open/close of the content brackets and one for the close bracket of the current nest
		-should succeed if the boundary is another open/close bracket?
		
	Add in options:
		parentClose - to close this nest and the parent nest if the parent close is hit
		
	Reject doesn't throw an error when nested parsing...
	
	Settings.escape should already be an EscapeManager object
		
	-----------------------------------------------	
	
	How should it handle conflicting tokens?
		-i.e., pen is matched but openIf returns false
			-should it see if it matches any remaining tokens/brackets?
	
	Should eofClose always or never apply to the Base Nest??

	Should each Mate to have their own Label?
		-or at least allow 'label' to be a Function which returns a string
		-if function, apply the results of .match (of the original regex with capture groups) as the input args
	
	Can Override all Bracket settings in the Parser??
		-only the booleans
		
	For all parser functions, cast as string first
		-same for empty parser

	Error Checking if open/close tag matches empty string??
		
	-----------------------------------------------	
	
	Test using return vs using resolve() in handles
		
	Test all default Brackets
	
	Test using regex input for compileRegexList
	-----------------------------------------------	
				
	-For Each should also apply to Tokens??
		-or, one Nest function, one Tokens function
		-can run async
			
	If openIf and closeIf fail, then keep checking
		-this way, we can have multiple CurlyBraces for different contexts
			-i.e. if this.before = FunctionDeclaration, then use FunctionBody will pass
			
	-Retain the capture groups in open/close and store them in the Nest??
		-will need 2 regex, one for 'getNextTag' and one for capturing
		-openCaptures, closeCaptures
	
*/

var baseFns = require('basic-functions'),
	Settings = {
		autoOpen : null,
		eofClose : false,
		wordBoundary : false,
		removeUnmatchedTokens : false,
		async : false,
		rejectUnexpectedClose : true,
		stripEscapes : false,
		regexFirst : false,
		closeFirst : true,
		escape : '',
		wordRegex : '\\w',
		reject : baseFns.throw,
		openIf : baseFns.true,
		closeIf : baseFns.true,
		stringHandle : function( resolve, reject ){
			resolve( this.original );
		},
		nestHandle : function( resolve, reject ){
			resolve( this.open + this.content + this.close );
		}
	},
	Token = (function(){
		function Token( parent, raw, label ){
			this.parent = parent;
			this.raw = raw;
			this.original = '';
			this.content = '';

			this.isNest = false;
			this.isString = true;
			this.type = label || '';
		}
		
		function TokenWrapper( parent, handle, str, label ){
			this.parent = parent;
			this.public = new Token( parent.public, str || '', label );
			this.handleFn = handle.bind( this.public );
		}
		
		TokenWrapper.prototype.addChildString = function( str ){
			this.public.raw += str;
		}
		
		TokenWrapper.prototype.addOriginalString = function( str ){
			this.public.original = str;
		}
		
		TokenWrapper.prototype.handle = function(){
			var resolvedValue, result,
				resolveHandle = function( str ){
					resolvedValue = str;
				},
				self = this;
				
			//if this is async, then return a promise which only gets resolves when all promises in the content array get resolved
			if( this.parent.Extraction.isAsync ){
				return new Promise(function( resolve, reject ){
					var result;
					
					function resolveHandle( str ){
						self.public.content = str;
						resolve( str );
					}
				
					//run the handle function
					result = self.handleFn( resolveHandle, reject );
					
					//if the handle function returned a value, then resolve using that value
					if( result !== undefined ) resolveHandle( result );
				});
			}
			
			//run the handle function using the custom resolve handle and the extraction reject function
			result = this.handleFn( resolveHandle, this.parent.Extraction.reject );
			
			//if there was no return value, use the resolvedValue
			this.public.content = (result === undefined ? resolvedValue : result);
			
			return this.public.content;
		}
		
		return TokenWrapper;
	})(),
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
	/*
	To build an object for handling the given Tag
	Input: Tag (String or Array of Strings)
		-Each string should already be a valid RegExp source
		-if input is Array, it will combine all into a single string using the pipe character
	Return: Object with the following properties:
		- isMatch : Tests if the given string entirely matches the given Tag (or any of the given Tags)
		- addSourceTo : Adds the original Tag (as a RegExp source) to the given array
	*/
	buildTagManager = (function(){	
	
		//The empty Tags Matcher, returned when no Tags are given
		var emptyTagMatcher = {
			isMatch : function(){
				return false;
			},
			addSourceTo : baseFns.noop
		};
		
		//To create a Tag Manager object from the given Tags source
		function buildTagManager( source ){
			
			var regex;
			
			//if the source is given as an array, then combine into a string
			if( isArray( source ) ) source = source.join('|');
			
			//if there is no source, then return the empty Tag Matcher
			if( !source ) return emptyTagMatcher;
			
			//turn the source into a RegExp which tests the entire string
			regex = new RegExp( '^(?:' +  source + ')$' );
			
			return {
				isMatch : function( str ){
					return str.match( regex );
				},
				addSourceTo : function( arr ){
					arr.push( source );
				}
			}
		}
		
		return buildTagManager;
	})(),
	/*
	To build an object for handling the given Escape Tag
	Input: String
		-String should already be a valid RegExp source
	Return: Object with the following properties:
		-isMatch : Tests if the given string ends with an Escape Tag
			-Only if the number of consecutive Escape Tags at end of the string is odd
		-strip : removes the Escape Tags from the given string
			-Will not remove Escape Tags which are escaped
	*/
	buildEscapeManager = (function(){
		
		//The empty Escape Manager, returned when no Escape Source String is given
		var emptyEscapeManager = {
			isMatch : baseFns.false,
			stripFrom : baseFns.echo
		};
		
		//To create an Escape Manager from the given Escape Tag source
		function buildEscapeManager( source ){
			
			var captureRegex, countRegex, stripRegex;
			
			//if no source is given, then return the empty escape manager
			if( !source ) return emptyEscapeManager;
			
			//Regex to capture all consecutive Escape Tags at the end of a string
			captureRegex = new RegExp("(" + source + ")+$");
			//Regex to match any Escape Tag
			countRegex = new RegExp( source );
			//Regex to capture any Escape Tag and the subsequent character
			stripRegex = new RegExp( "(?:" + source + ")([\\w\\W])", "g" );
			
			return {
				isMatch : function( str ){
					var match = str.match( captureRegex );
						
					if( !match ) return false;
					
					//split the captured string at each Escape Tag
					match = match[0].split( countRegex );
					
					//One less than the length of the split is the number of consecutive Escape Tags
					//If the amount is odd, then it ends with an Escape Tag
					return (match.length-1)%2;
				},
				stripFrom : function( str ){
					//capture each Escape Tag and the subsequent character, and only return the character
					return str.replace( stripRegex, '$1' );
				}
			}
		}
		
		return buildEscapeManager;
	})(),
	/*
	To compile the given Array of Strings/RegExps into a single RegExp source string
	Inputs :
		data : String/RegExp or Array of Strings/RegExps
		regexFirst : Whether combined string should have the RegExps appear before Strings
	Return : RegExp source string of all input data (as RegExp source strings) joined with the pipe character
	*/
	compileRegexList = (function(){
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
		
		//to add the given value to either the string array or the regexArray based on its constructor
		function addToArray( val, stringArray, regexArray ){
			var arr = stringArray;
			
			//if regex, set the value to be the source without capture groups:
			if( isRegExp( val ) ){
				arr = regexArray;
				val = removeCaptureGroups( val.source );
			}
			//if not string, then return:
			else if( !isString( val ) ) return
			
			//add the value to the array if not already there
			if( arr.indexOf( val ) === -1 ) arr.push( val );
		}

		//to compile the given RegexList into the given
		function compileRegexList( data, regexFirst ){
			var returnArray,
				stringArray = [],
				regexArray = [];
				
			function add( val ){
				addToArray( val, stringArray, regexArray );
			}
				
			if( isArray( data ) ) data.forEach( add );
			else add( data );
			
			//sort the strings by length and convert to regex safe
			stringArray = stringArray.sort( sortArrayByLength ).map( makeRegexSafe );
			
			//combine in the order dictated by regexFirst
			returnArray = regexFirst ? regexArray.concat( stringArray ) : stringArray.concat( regexArray );
			
			//return as string joined by the pipe character
			return returnArray.join('|');
		}
		
		return compileRegexList;

	})(),
	//The Brackets constructor object
	Brackets = (function(){
		//to create a Mates object from the given Open and Close RegExp Lists
		function buildMates( open, close, regexFirst ){
			return {
				OpenTags : buildTagManager( compileRegexList( open, regexFirst ) ),
				CloseTags : buildTagManager( compileRegexList( close, regexFirst ) )
			}
		}
		
		//to go through the given Array of Brackets/Mates and return the first instance where the given Tag is an Open Tag
		function findOpenMatch( tag, arr ){
			var i, l = arr.length;
			for(i=0;i<l;i++) if( arr[i].OpenTags.isMatch( tag ) ) return arr[i];
		}
		
		/*
		The Brackets constructor
		
		Input : Object for all properties the Brackets Object should have
			- open : All valid Open Tags (String/RegExp or Array of String/RegExp)
			- close : All valid Close Tags (String/RegExp or Array of String/RegExp)
			- mate : [open, close]
			- mates : Array of mate arrays
			- escape : All valid Escape Tags  (String/RegExp or Array of String/RegExp)
			- content : Brackets Object or Array of Brackets Objects which can exist inside the Open/Close tags
			- handle : Function to run when an instance of this Brackets Closes which determines what is passed to the parent Brackets
			- regexFirst : Whether combined string should have the RegExps appear before Strings
			- closeFirst : Whether combined string should have these Close Tags appear before content Brackets Open Tags
			- wordBoundary : Whether these Open/Close Tags should have a word boundary surrounding them
			- wordRegex : The String/RegExp or Array of String/RegExp which defines a 'word'
			- stripEscapes : Whether the Escape Tags should be removed from the content
			- rejectUnexpectedClose : Whether an unmatched content Brackets Close Tag will run the error function or just be accepted as a string
		
		Output : Brackets Object with the following properties
			- getContentManager - Function return a Content Manager Object based on the Bracket which matches the given 'open string'
			- isValid - Returns whether the three given strings should be considered for an open/close match according to the EscapemManager and WordBoundary Manager
		*/
		function Brackets( obj ){
			var data = typeof obj === "object" ? obj : {},
				regexFirst = typeof data.regexFirst === 'boolean' ? data.regexFirst : Settings.regexFirst,
				closeFirst = typeof data.closeFirst === 'boolean' ? data.closeFirst : Settings.closeFirst,
				openTagSources = [],
				closeTagSources = [],
				contentList = [],
				matesList = [];
				
			//to add a Mates Object to the matesList and the sources to the Tags Source arrays
			function addMatesObject( open, close ){
				var obj = buildMates( open, close, regexFirst );
				
				matesList.push( obj );
				obj.OpenTags.addSourceTo( openTagSources );
				obj.CloseTags.addSourceTo( closeTagSources );
			}
			
			//to create a new bracket from a mate pair
			function addMate( mate ){
				if( isArray( mate ) ) addMatesObject( mate[0], mate[1] );
			}
			
			//to add content to the content list (only if it is a Brackets object)
			function addToContentBrackets( obj ){
				if( isArray( obj ) ) obj.forEach( addToContentBrackets );
				else if( obj instanceof Brackets ) contentList.push( obj );
			}
			
			//create each Mates object and add to the Mates List
			if( 'mates' in data && isArray( data.mates ) ) data.mates.forEach( addMate );
			else if( 'mate' in data ) addMate( data.mate );
			else addMatesObject( data.open, data.close );
			
			//add each Content Bracket to the Content Brackets List
			addToContentBrackets( data.content );
			
			//to define the properties of this Brackets
			this.label = data.label || '';
			this.autoOpen = data.autoOpen instanceof Brackets ? data.autoOpen : Settings.autoOpen;
			this.EscapeManager = 'escape' in data ? buildEscapeManager( compileRegexList( data.escape, regexFirst ) ) : buildEscapeManager( Settings.escape );
			this.rejectUnexpectedClose = typeof data.rejectUnexpectedClose === 'boolean' ? data.rejectUnexpectedClose : Settings.rejectUnexpectedClose;
			this.removeUnmatchedTokens = typeof data.removeUnmatchedTokens === 'boolean' ? data.removeUnmatchedTokens : Settings.removeUnmatchedTokens;
			this.stripEscapes = typeof data.stripEscapes === 'boolean' ? data.stripEscapes : Settings.stripEscapes;
			this.eofClose = typeof data.eofClose === 'boolean' ? data.eofClose : Settings.eofClose;
			this.handle = typeof data.handle === "function" ? data.handle : Settings.nestHandle;
			this.stringHandle = typeof data.stringHandle === "function" ? data.stringHandle : Settings.stringHandle;
			this.openIf = typeof data.openIf === "function" ? data.openIf : Settings.openIf;
			this.closeIf = typeof data.closeIf === "function" ? data.closeIf : Settings.closeIf;
			this.WordBoundaryManager = new WordBoundaryManager( data.wordBoundary, compileRegexList( data.wordRegex, regexFirst ) );
			
			//To add the given Brackets object as content to these Brackets
			this.addContent = function(){
				var args = Array.prototype.slice.apply( arguments );
				args.forEach( addToContentBrackets );
			};
			
			//combine all Mate Open and Close tags each into a single Tag Manager object
			this.OpenTags = buildTagManager( openTagSources );
			this.CloseTags = buildTagManager( closeTagSources );
			
			//to create a new Content Manager based on the given Open Tag
			this.getContentManager = function( tag, parent ){
				
				var currentMate, CloseTags;
				
				//if no parent, then it can't close
				if( !parent ) return buildContentManager( contentList, null, closeFirst );
				
				//Get the current mate based on the open tag
				//if there is no open tag, then return the first mate
				var currentMate = tag ? findOpenMatch( tag, matesList ) : matesList[0],
					CloseTags = currentMate ? currentMate.CloseTags : null;
					
				return buildContentManager( contentList, CloseTags, closeFirst );
			}
			
			/*
			To see if the given str is valid
			Valid if:
				- prevStr does not end with escape AND
				- there is a no word boundary error
			*/
			this.isValid = function( prevStr, str, nextStr ){
				return !this.EscapeManager.isMatch( prevStr ) && this.WordBoundaryManager.isValid( prevStr, str, nextStr );
			}
		}
		
		/*
		To create a Content Manager	object:
		Input : 
			- contentList : Array of Brackets which can appear inside the content
			- CloseTags : The Close Tags (TagManagerObject) for this content
			- closeFirst : Whether combined string should have these Close Tags appear before content Brackets Open Tags
		Output : Object with the following properties:
			- isCloseMatch : Whether the given string is a Close tag match
			- getNextString : To split the given string at the first instance of a Close Tag or content Close/Open tag
			- getOpenMatch : to get the content Brackets which has the given string as an Open Tag
		*/
		function buildContentManager( contentList, CloseTags, closeFirst ){
				
				var OpenTags, nextRegex,
					openTagSources = [],
					closeTagSources = [],
					allSources = [];
					
			//if a Close Tags Object was provided, then add the source to the allSources array
			if( CloseTags ) CloseTags.addSourceTo( allSources );
			
			//go through each content Brackets and capture the sources of each Open and Close Tags
			contentList.forEach(function( obj ){
				obj.OpenTags.addSourceTo( openTagSources );
				obj.CloseTags.addSourceTo( closeTagSources );
			})
			
			//combine all of the source in the order dictated by closeFirst
			allSources = closeFirst ? allSources.concat( openTagSources, closeTagSources ) : openTagSources.concat( closeTagSources, allSources );
			
			//if any Tag Sources exist, then create the RegExp which will match the first instance of any of them
			nextRegex = allSources.length ? new RegExp('^([\\w\\W]*?)(' + allSources.join('|') + ')([\\w\\W]*)$') : null;
			
			//create an Tag Manager Object based on the Open Tags of all content Brackets
			OpenTags = buildTagManager( openTagSources );
			
			return {
				//to see if the given string is a Close Tag
				isCloseMatch : function( str ){
					return CloseTags && CloseTags.isMatch( str ) ;
				},
				//to split the given string at the next instance of CloseTag or Content Open/Close tag
				getNextString : function( str ){
					return str.match( nextRegex );
				},
				//to see if the given string is an Open Tag
				isOpenMatch : function( str ){
					return OpenTags.isMatch( str );
				},
				//to get the Brackets object in which the given string is an Open Tag
				getOpenMatch : function( tag ){
					//get the corresponding Brackets object from the contentList
					return findOpenMatch( tag, contentList );
				}
			}
		}
		
		return Brackets;
	})(),
	Parser = (function(){
		/*
		To create a Location object with the given properties:
			-update : update the index, row, col counters based on the given string
			-clone : create a new Location object based on the current index, row, col values
			-toString : creates a string describing the current index, row, col values
		*/
		var buildLocation = (function(){
			var lineBreakRegex = /\r\n?|\n/g;
			
			//Builds the location object from the given array.
			//If no array is given, it will start at 0
			function buildLocation( arr ){
				var index, row, col;
				
				if( arr ){
					index = arr[0];
					row = arr[1];
					col = arr[2];
				}
				else{
					index = 0;
					row = col = 1;
				}
				
				return {
					update : function( str ){
						var match = str.split( lineBreakRegex ),
							//the number of linebreaks is one less than the size of the array
							numOfBreaks = match.length-1;
							
						index += str.length;
						row += numOfBreaks;
						//reset col index if there is a line break
						if( numOfBreaks ) col = 1;
						//increase by the length of the last string in the array
						col += match.pop().length;
					},
					clone : function(){
						return buildLocation( [index, row, col] );
					},
					toString : function(){
						return 'index ' + index + ' (row ' + row + ', col ' + col + ')'
					}
				}
				
			}
			
			return buildLocation;
		})(),
		//The Nest constructor
		Nest = (function(){
			/*
			The public Nest object
				Input : str which represents the Open Tag
				Output : Nest object with properties:
					-forEach : To handle each nest
						-input :
							- f : function to run as the handle for each nest
							- applyToTopMost : whether the topMost nest should also have the handle function applied
						-output : Handled string
			*/
			var Nest = (function(){
				function Nest( str, label ){
					this.tokens = [];
					this.hasChildNest = false;
					this.raw = '';
					this.original = '';
					this.content = '';
					this.open = str || '';
					this.close = '';
					this.index = [];
					this.nextIndex = [];
					this.matches = [];
					this.parent = null;
					this.ancestors = [];
					this.depth = 0;
					this.isNest = true;
					this.isString = false;
					this.type = label || '';
				}
				
				Nest.prototype.forEach = function( f, applyToTopMost ){
					var apply = this.parent || applyToTopMost === true,
						str = '';
					
					this.tokens.forEach(function( el ){
						if( el instanceof Nest ) str += el.forEach( f );
						else str += el;
					});
					
					return apply ? f.call( this, str ) : str;
				}
				
				return Nest;
			})();
			/*
			The NestWrapper Object
			
			Input :
				- brackets : The Brackets Object which this Nest is based on
				- extraction : The Extraction Object that created this Nest
				- str : The string that is the Open Tag
				- parent : The parent NestWrapper
			
			Output :
				If no Brackets object is given, it will just return the public Nest object
				Otherwise, will return a NestWrapper object
			*/
			var NestWrapper = (function(){
				function NestWrapper( brackets, extraction, str, parent ){
					
					this.public = new Nest( str, brackets.label );
					
					this.contentArray = [];
					
					//return an empty nest if there are no input arguments
					if( !brackets ) return this.public;
					
					if( parent && parent.doInclude ) this.public.parent = parent.public;
					
					//set some properties from the input
					this.Brackets = brackets;
					this.ContentManager = brackets.getContentManager( str, parent );
					this.Extraction = extraction;
					this.Location = extraction.Location.clone();
					//if this is the BaseNest, then it cannot close at eof
					this.eofClose = parent ? brackets.eofClose : false;
					
					this.parent = parent;
					
					this.handleFn = (extraction.nestHandle ? extraction.nestHandle : brackets.handle).bind( this.public );
					
					//initialize other properties
					this.doInclude = true;
					this.currentToken = new Token( this, brackets.stringHandle );
				}
				
				/*
				To handle the given nest
					-If sync, will combine all strings in the content array, run the handle function, and return the handled string
					-otherwise, returns a promise which only runs when all promises in the content array resolve
						-once they are all resolved, will combine all strings in the resolved array and run the handle function
				*/
				NestWrapper.prototype.handle = function(){
					var resolvedValue, result,
						resolveHandle = function( str ){
							resolvedValue = str;
						},
						self = this;
					
					//if this is async, then return a promise which only gets resolves when all promises in the content array get resolved
					if( this.Extraction.isAsync ){
						return new Promise(function(resolve,reject){
							Promise.all( self.contentArray ).then(function( arr ){
								//combine all strings in the resolved array
								self.public.content = arr.join('');
								
								//run the handle function
								result = self.handleFn( resolve, reject );
								
								//if the handle function returned a value, then resolve using that value
								if( result !== undefined ) resolve( result );
							});
						});
					}
					
					//combine all strings in the content array and run the handle function on it
					this.public.content = this.contentArray.join('');
					//run the handle function using the custom resolve handle and the extraction reject function
					result = this.handleFn( resolveHandle, this.Extraction.reject );
					//if there was no return value, use the resolvedValue
					return result === undefined ? resolvedValue : result;
				};
				
				/*
				To store the current string segment to the necessary locations:
					- adds the unmodifed string to the raw string
					- strips Escape tags if necessary
					- adds the string to the original string, content array, nest array and simple array
						- if async, will add a resolved promise to the content array instead
				*/
				NestWrapper.prototype.storeCurrentToken = function(){						
					//if there is no token string
					//or, we remove unmatched tokens, then return
					if( !this.currentToken.public.raw || this.Brackets.removeUnmatchedTokens ) return;
						
					this.storeToken( this.currentToken );
					
					//create a new token
					this.currentToken = new Token( this, this.Brackets.stringHandle );
				};
				
				NestWrapper.prototype.storeToken = function( token ){
					
					var str = token.public.raw;
					
					//append the string to the raw string
					this.addRawString( str );
					
					//remove all escapes if requested to do so
					if( this.Brackets.stripEscapes ) str = this.Brackets.EscapeManager.stripFrom( str );
											
					//add the unescaped string to the original string
					token.addOriginalString( str );
					this.addOriginalString( str );
											
					//add the token to the token array
					this.public.tokens.push( token.public );
					
					//add the handled token to the contentArray (as string or resolved promise)
					this.contentArray.push( token.handle() );
				}
				
				/*
				To add a child nest to this Nest
					- stores the current string segment
					- creates a new Nest based on the given Open Tag and corresponding Brackets object
					- adds the childNest to the appropriate arrays
					- adds this Nests info to the child Nest
					- returns the child nest
				*/
				NestWrapper.prototype.addChildNest = function( str, brackets ){
					var child = new NestWrapper( brackets, this.Extraction, str, this ),
						childNest = child.public,
						nest = this.public;
						
					this.storeCurrentToken();
					
					nest.matches.push( childNest );
					nest.tokens.push( childNest );
					nest.hasChildNest = true;
					
					this.addToChildNest( child );
					
					return child;
				};
				
				/*
				To add this Nests info to the childNest
					- adds the start index and this public nest to the child public nest
					- also adds parents info (if it exists)
				*/
				NestWrapper.prototype.addToChildNest = function( child, startOffset ){
					var childNest = child.public,
						startOffset = startOffset || 0;
						
					//add the start index
					childNest.index.unshift( this.public.raw.length + startOffset );
					
					//if the nest is not included, then return
					if( !this.doInclude ) return;
					
					//add this public nest as an ancestor and increase the depth
					childNest.ancestors.unshift( this.public );
					childNest.depth++;
					
					//if there is a parent, then add this parents info to the child nest
					//add the length of the raw content plus the length of the open tag to the start offset
					if( this.parent ) this.parent.addToChildNest( child, this.public.open.length + this.public.raw.length + startOffset );
				};
				
				/*
				To close this Nest:
					-stores the current string segment
					-updates the close string
					-updates each 'nestIndex' value
					-updates the parent raw and original strings
					-adds the return of this.handle() to the parent content array
					-returns parent nest
				*/
				NestWrapper.prototype.close = function( str ){
					var nest = this.public,
						fullString, length;
						
					//store the latest token
					this.storeCurrentToken();
					
					//if there is no parent, then just return the handle
					if( !this.parent ) return this.handle();
					
					//update the nest close tag
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
					this.parent.contentArray.push( this.handle() );
					
					return this.parent;
				};
				
				/*
				To see if the given str is valid
				Valid if:
					- Current String Segment does not end with escape AND
					- there is a no word boundary error
				*/
				NestWrapper.prototype.isValid = function( str, nextStr ){
					return this.Brackets.isValid( this.currentToken.public.raw, str, nextStr );
				};
				
				NestWrapper.prototype.addOriginalString = function( str ){
					this.public.original += str;
				};
				
				NestWrapper.prototype.addRawString = function( str ){
					this.public.raw += str;
				};
				
				return NestWrapper;
			})();
			
			return NestWrapper;
		})(),
		/*
		The EmptyParser object.  Has same methods are Parser, but returns default values instead
		Used when Parser has error in input arguments
		*/
		EmptyParser = (function(){
		
			function EmptyParser(){}
			
			EmptyParser.prototype.extract = function(){
				return [];
			}
			
			EmptyParser.prototype.parse = function( str ){
				return new Nest();
			}
			
			EmptyParser.prototype.handle = baseFns.echo;
			EmptyParser.prototype.replace = baseFns.echo;
			EmptyParser.prototype.strip = baseFns.echo;
			
			return EmptyParser;
		})(),
		//The Extraction object
		Extraction = (function(){
			/*
			The Extraction Object:
				Input :
					- isAsync : if this extraction should use Promises
					- reject : The function to run when an error occurs
					- str : The string that this extraction is parsing
					- bracket : The Brackets object that this Extraction is based on
			*/
			function Extraction( isAsync, reject, str, brackets ){
				//initialize some values from the input
				this.isAsync = isAsync;
				this.reject = reject;
				this.remainingString = str;
				this.WordBoundaryManager = brackets.wordBoundaryManager;
				
				//initialize other arguments
				this.Location = buildLocation();
				
				this.Nest = new Nest( brackets, this );
			}
			
			//To handle all tags until the condition test passes (if one exists)
			Extraction.prototype.handleAllTags = function(){
				while( !(this.condition && this.condition()) && this.remainingString ) this.getNextTag();
			}
			
			/*
			To get the next Tag in this extraction
				-First, it splits the remaining string into three strings:
					- Text Before, Tag, Text After
				-If it was not able to split the remaining string, then auto auto open a new Nest or it is finished so just add the remaining string
				-Handle the before, tag, and after strings
			*/
			Extraction.prototype.getNextTag = function(){
				var match = this.Nest.ContentManager.getNextString( this.remainingString );
				
				//if there is no match, then see if there is an auto open
				if( !match ){					
					//if there is no autoOpen brackets, then it is finished
					if( !this.Nest.Brackets.autoOpen ) return this.handleNextTag( this.remainingString, '', '' );
					
					//otherwise, open a Nest with those Brackets
					this.Nest = this.Nest.addChildNest( '', this.Nest.Brackets.autoOpen );
				}
				else this.handleNextTag( match[1], match[2], match[3] );
			}
			
			/*
			To handle the next tag:
				-First, save the before string
				-Then update the remaining string to be the after string
				-Then handle the tag and increase counters if a tag was provided
			*/
			Extraction.prototype.handleNextTag = function( before, tag, after ){
				//add the before string
				this.addString( before );
				this.Location.update( before );
				
				//update the remaining string
				this.remainingString = after;

				//if there is no tag, then return
				if( !tag ) return;
				
				this.handleTag( tag );
				this.Location.update( tag );
			}

			/*
			To handle the given tag:
				-if the tag is not valid due to Escape Tags or Word Boundaries, then just add as a string
				-test if it is a close match and close nest if so
				-test if it is an open match, and open if so
				-otherwise, it is an unmatched close bracket:
					-run error handle if rejectUnexpectedClose is true
					-add as string
			*/
			Extraction.prototype.handleTag = function( tag ){				
				//if the tag is not valid due to Escape Tags or Word Boundaries, then just add as a string
				if( !this.Nest.isValid( tag, this.remainingString ) ) return this.addString( tag );
				
				//if the Tag is a close match, then close
				if( this.Nest.ContentManager.isCloseMatch( tag ) ) return this.closeNest( tag );
				
				//if the Tag is an open match, then open
				if( this.Nest.ContentManager.isOpenMatch( tag ) ) return this.openNest( tag );
				
				//otherwise, it is an unmatched Close bracket
				
				//if we reject unexpected close, then run the error handle
				if( this.Nest.Brackets.rejectUnexpectedClose ) this.reject(new Error('No open bracket found for \'' + tag + '\' at ' + this.Location.toString() ));
				this.addString( tag )
			}

			//to open a new child nest
			Extraction.prototype.openNest = function( tag ){
				var brackets = this.Nest.ContentManager.getOpenMatch( tag );
				
				//if the brackets openIf function returned false, then add as string instead.
				if( !brackets.openIf.call( this.Nest.public, this.Nest.currentToken.public.raw, tag ) ) return this.addString( tag );
				
				this.Nest = this.Nest.addChildNest( tag, brackets );
			}

			//to add the given string to the current result if it exists
			Extraction.prototype.addString = function( str ){
				if( str ) this.Nest.currentToken.addChildString( str );
			}
			
			//to close the current nest
			Extraction.prototype.closeNest = function( tag ){
				//if the current brackets closeIf function returned false, then add as string instead
				if( !this.Nest.Brackets.closeIf.call( this.Nest.public, this.Nest.currentToken.public.raw, tag ) ) return this.addString( tag );
				
				this.Nest = this.Nest.close( tag );
			}
			
			//to try to close the current nest (used at the very end of the Extraction process)
			//if the nest still has a parent, then it is not at the base nest, so create an error
			Extraction.prototype.tryClose = function(){
				
				//try to close all Nests that can close at the eof
				while( this.Nest.eofClose ) this.closeNest('');
				
				//if there is no parent, then close
				if( !this.Nest.parent ) return this.Nest.close();
				
				//otherwise, there is an error
				this.reject(new Error('No close bracket found for \'' + this.Nest.public.open + '\' at ' + this.Nest.Location.toString() ) );
			}
			
			return Extraction;
		})();
		
		/*
		To run the given function with the the given arguments
		other arguments are:
			- isAsync : whether to run using Promises
			- reject : function to run when an error occurs
			- bracket : The brackets object to use as the Base of the extraction
			- str : The string to run the Extraction on
			- returnHandle : the function to get the return value
		*/
		function runFn( str, fn, returnHandle, args, isAsync, reject, brackets ){
			var result,
				//custom resolve handle which updates the result variable to the resolved value
				resolveHandle = function( val ){
					result = val;
				},
				hasError = false,
				//custom reject handle to run the initial reject function and set hasError to true
				rejectHandle = function( err ){
					reject( err );
					hasError = true;
				};
			
			//To run the given function with the given resolve and reject handles
			function run( resolve, reject ){
				var close,
					//create a new extraction
					X = new Extraction( isAsync, reject, str, brackets );
				
				/*
				To finish and resolve using the return handle
					Input :
						- content : handle string
				*/
				function finish( content ){
					//the nest is the Extraction base nest (or an empty nest if there is an error)
					var nest = hasError ? new Nest() : X.Nest.public,
						//get the return value by running the returnHandle in the context of the nest with the handled string as the input argument
						value = returnHandle.call( nest, content);
						
					//resolve with the return value
					resolve( value );
				}
				
				//run the given function with the given arguments
				fn.apply( X, args );
				
				//try to close the Extraction
				close = X.tryClose();
				
				//if Async, then 'close' is a Promise, so run the finish function when resolved
				if( isAsync ) close.then(finish,reject);
				//otherwise, finish using 'close' as the input argument
				else finish( close );
			}
		
			//if in async mode, then run the function inside a Promise
			if( isAsync ) return new Promise( run )
			//otherwise, run the function using the custom resolve and reject handles
			run( resolveHandle, rejectHandle );
			//and return the result
			return result; 
		}
		
		//To extract the given number of matches
		function extract( count ){
			//if count is not a number, then set to -1
			if (typeof count !== "number") count = -1;
			
			//to not include the base nest
			this.Nest.doInclude = false;
			
			//if there is a count, then stop when at the Base Nest and the number of matches is reached
			if( count > -1 ) this.condition = function(){
				return (!this.Nest.parent && this.Nest.public.matches.length === count);
			}
			//handle all of the tags
			this.handleAllTags();
		};
		
		function replaceHandle( fn ){
			this.nestHandle = fn;
			this.handleAllTags();
		}
		
		/*
		The Parser Object
		
		Inputs:
			-brackets : The Brackets Object to use as the Base for the Extraction
			- rejectOrAsync :
				-if function, the reject function.
				-if boolean, then whether to run in async using Promises
		
			If no brackets is supplied, it will create an error and return a new EmptyParser Object
		*/
		function Parser( brackets, rejectOrAsync ){
			
			var isAsync = typeof rejectOrAsync === "boolean" ? rejectOrAsync : Settings.async,
				reject = typeof rejectOrAsync === "function" ? rejectOrAsync : Settings.reject;
			
			//if no Brackets were supplied, then create an error and return an EmptyParser
			if( !(brackets instanceof Brackets) ){
				reject(new Error('The Parser input must be a Brackets Object'));
				return new EmptyParser;
			}
			
			//To run the given function with the given args on the given string using the given return function
			function run( str, fn, ret, args ){
				return runFn( str, fn, ret, args || [], isAsync, reject, brackets );
			}
			
			this.extract = function( str, count ){
				return run( str, extract, baseFns.echo.key('matches').inThis, [count] );
			}
			
			this.handle = function( str ){
				return run( str, baseFns.call.key('handleAllTags').inThis, baseFns.echo );
			}
			
			this.parse = function( str ){
				return run( str, baseFns.call.key('handleAllTags').inThis, baseFns.this );
			}
			
			function replace( str, fn ){
				return run( str, replaceHandle, baseFns.echo.key('content').inThis, [fn] );
			}
			this.replace = replace;
			
			this.strip = function( str ){
				return replace( str, baseFns.string );
			}
			
		}
		
		return Parser;
	})(),
	//Parser to convert capture groups from the given RegExp source string to non-capture groups
	removeCaptureGroups = (function(){
		var parser,
			RegexParens = new Brackets({
				mate : ['(',')'],
				escape : '\\',
				rejectUnexpectedClose : false,
				handle : function(){
					var openStr = '(';
					if( this.content[0] !== '?' ) openStr += '?:';
					return openStr + this.content + ')';
				}
			}),
			RegexBrackets = new Brackets({
				mate : ['[',']'],
				escape : '\\',
			}),
			sub = [RegexParens, RegexBrackets],
			Base = new Brackets({
				escape : '\\',
				content : sub,
				rejectUnexpectedClose : false
			});
			
		RegexParens.addContent( sub );
		parser = new Parser( Base );
			
		//to change all capture groups to non-capture groups in a regex source string		
		function removeCaptureGroups( str ){
			return parser.handle( str );
		}
		
		return removeCaptureGroups;
	})(),
	//To define the Settings
	defineSettings = (function(){

		//to set the given key if the key in the given object matches the given type
		function setIf( obj, key, type ){
			if( typeof obj[key] === type ) Settings[key] = obj[key];
		}

		//to set the given key if the key in the given object is an instance of the given type or null
		function setIfInstance( obj, key, type ){
			if( obj[key] instanceof type || obj[key] === null ) Settings[key] = obj[key];
		}
		
		//to set the given key as a regex list if the key exists in the given object
		function setRegexListIf( obj, key ){
			if( key in obj ) Settings[key] = compileRegexList( obj[key], Settings.regexFirst );
		}

		function defineSettings( obj ){	
			if (typeof obj !== 'object') return;
			
			setIf( obj, 'regexFirst', 'boolean' );
			setIf( obj, 'async', 'boolean' );
			setIf( obj, 'closeFirst', 'boolean' );
			setIf( obj, 'stripEscapes', 'boolean' );
			setIf( obj, 'rejectUnexpectedClose', 'boolean' );
			setIf( obj, 'removeUnmatchedTokens', 'boolean' );
			setIf( obj, 'wordBoundary', 'boolean' );
			setIf( obj, 'eofClose', 'boolean' );
			
			setIf( obj, 'reject', 'function' );
			setIf( obj, 'openIf', 'function' );
			setIf( obj, 'closeIf', 'function' );
			setIf( obj, 'stringHandle', 'function' );
			setIf( obj, 'nestHandle', 'function' );
			
			setIfInstance( obj, 'autoOpen', Brackets );
					
			setRegexListIf( obj, 'wordRegex' );
			setRegexListIf( obj, 'escape' );
		};
		
		return defineSettings;
	})();
	
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

module.exports = {
	Parser : Parser,
	Brackets : Brackets,
	Settings : defineSettings
};
