//common string symbols
var defaultStringChars = [
		'"',
		'\'',
		'`',
	],
	defaultStringObj = {
		open : defaultStringChars,
		close : defaultStringChars
	},
	//Common mates for statements
	Mates = {
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
	regexChars = ['^','$','[',']','{','}','(',')','\\','/','.',',','?','-','+','*','|'];

//To extract everything inside the outer most brackets
function Extractor( open, close, stringChars ){
	
	var regex;
	
	if( typeof open !== 'string' ) throw new TypeError('The \'open\' argument must be a string');
	
	//if close isnt a string, then get a mate for it
	if( typeof close !== 'string' ) close = getMate( open );
	
	stringChars = buildStringObj(stringChars);
	regex = buildRegex( open, close, stringChars.open );
	
	this.extract = function( str ){
		return new Extraction( open, close, stringChars, regex ).init( str );
	}
	
}

function Extraction( open, close, stringChars, regex ){
	this.matches = [];
	this.tree = [];
	this.escaped = false;
	
	this.openChar = open;
	this.closeChar = close;
	this.stringChars = stringChars;
	this.regex = regex;
	
	this.sameChar = open === close;
}

Extraction.prototype.init = function( str ){
	var arr = str.split( this.regex );
		
	arr.forEach(this.handleStr, this);
	
	//if there is still a result, then there was an error
	if( this.result ){
		if( this.escaped ) throw new Error("Unable to parse. Unclosed String detected")
		throw new Error("Unable to parse. Unclosed Bracket detected")
	}
	
	return this.matches;
}

Extraction.prototype.handleStr = function( str ){
	var index;

	if( this.escaped ){
		if( str === this.unescapeStr ) this.escaped = false;
		return this.add( str );
	}
	
	if( str === this.openChar ) return this.open();
	
	if( str === this.closeChar ) return this.close();
		
	index = this.stringChars.open.indexOf( str );
	if( index > -1 ){
		this.escaped = true;
		this.unescapeStr = this.stringChars.close[index];
	}
	this.add( str );
}

Extraction.prototype.open = function(){
	//create a new result object
	var obj = {
			nest : [],
			hasNest : false,
			str : ''
		};
	
	//if there currently is a result:
	if( this.result ){
	
		//if the open and close characters are the same, then close
		if( this.sameChar ) return this.close();
		
		//set hasNest to true
		this.result.hasNest = true;
	
		//add the new result object to the current nest
		this.result.nest.push( obj );
		
		//add the open char to the string
		this.result.str += this.openChar;
		
		//add the result to the tree
		this.tree.push( this.result );
	}
	//otherwise, save the obj as a new match
	else this.matches.push( obj );
	
	//set the result to be the new object
	this.result = obj;
}

//to add text to the current result if there is one
Extraction.prototype.add = function( str ){
	var nest;
	
	if( str && this.result ){	
		nest = this.result.nest;
		
		//if the last element is a string, then append
		if( typeof nest[ nest.length-1 ] === "string" ) nest[ nest.length-1 ] += str;
		//otherwise, the new string
		else nest.push( str );
		
		this.result.str += str;
		
		this.tree.forEach(function(obj){
			obj.str += str;
		})
	}
}

Extraction.prototype.close = function(){	
	//set the result to be the last element in the tree
	this.result = popLast( this.tree );
	
	if( this.result ) this.result.str += this.closeChar;
}

//to sort an array by length
function sortArrayByLength(a, b){
  return b.length - a.length;
}

//to get the mate value of the given string
function getMate( str ){

	var keys, regex, match, count;
	
	if( str in Mates ) return Mates[str];
	
	//check for repeating cases
	
	//get the keys in order of largest to smallest since the smaller ones are substrings of the larger ones
	keys = Object.keys( Mates ).sort( sortArrayByLength ).map( toRegex );
	regex = new RegExp( '(' + keys.join('|') + ')', 'g' );
	match = str.match( regex );
	
	if( match ){
		count = str.length/match[0].length;
		if( count === match.length ) return  Mates[ match[0] ].repeat( count );
	}
	
	//if no common mate, then use the reverse of the str
	return reverse( str );
}

//to reverse a string
function reverse( str ){
	return str.split('').reverse().join('');
}

function toRegex( str ){
  return escapeChars( str, regexChars );
}

function escapeChars( str, arr ){
	var expression = arr.join('\\'),
		regex = new RegExp( '[\\' + expression + ']', 'g' );
		
	return str.replace( regex, '\\$&' )
}

function popLast(arr){
	return arr.splice(arr.length-1,1)[0];
}

function getLast( arr ){
	return arr[ arr.length-1 ];
}

function addEscape( str ){
	return '\\\\' + str;
}

function buildStringObj( arr ){
	
	var ret = {
		open : [],
		close : []
	}
	
	if( typeof arr === "string" ) arr = [arr];
	else if( typeof arr !== "object" || arr.constructor !== Array ) return defaultStringObj;
	
	arr.forEach(function( el ){
		if( typeof el === "string" ){
			ret.open.push( el );
			ret.close.push( getMate( el ) )
		}
		else if( typeof el === "object" && el.constructor === Array && typeof el[0] === "string"){
			if( typeof el[1] === "string" ){
				ret.open.push( el[0] )
				ret.close.push( el[1] )
			}
			else{
				ret.open.push( el );
				ret.close.push( getMate( el ) );
			}
		}
	})
	
	return ret;
}

function buildRegex( open, close, stringChars ){
	var regexNormal = [ open, close ].concat( stringChars ).sort( sortArrayByLength ).map( toRegex ),
		regexEscaped = regexNormal.map( addEscape ),
		arr = regexEscaped.concat( regexNormal );
		
	return new RegExp('(' + arr.join('|') + ')','g');
}

module.exports = Extractor