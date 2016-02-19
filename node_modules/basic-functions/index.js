(function( exports ){
	
	function noop(){};
	exports.undefined = exports.noOp = exports.noop = noop;
	
	exports.null = function(){
		return null;
	}
	
	exports.this = function(){
		return this;
	}
	
	exports.nan = exports.NaN = function(){
		return NaN;
	}
	
	exports['0'] = exports.Zero = exports.zero = function(){
		return 0;
	}
	
	exports['1'] = exports.One = exports.one = function(){
		return 1;
	}
	
	exports.infinity = exports.Infinity = function(){
		return Infinity;
	}
	
	exports._infinity = exports._Infinity = function(){
		return -Infinity;
	}
	
	exports.True = exports.true = function(){
		return true;
	}
	
	exports.False = exports.false = function(){
		return false;
	}
	
	exports.String = exports.string = function(){
		return '';
	}
	
	exports.Array = exports.array = function(){
		return [];
	}
	exports.Object = exports.object = function(){
		return {};
	}
	
	exports.Function = exports.function = function(){
		return function(){};
	}

	//to turn the given arguments into an arg array
	function toArgArray( args ){
		return Array.prototype.slice.call( args );
	}
	
	//does the given value exist
	function exists( val ){
		return typeof val !== "undefined" && val !== null;
	}
	
	//is the given value of the given type
	function is(val, con){
		return exists( val ) && (typeof con === "string" ? typeof val === con : val.constructor === con);
	}
	
	//is the given value an instance of the given type
	function isInstance(val, con){
		return typeof con === 'function' && val instanceof con;
	}
	
	var build = (function(){
	
		//to get a specific argument from the given arguments
		function getNthArgByType( comp, args, n, type ){
			var i,
				count = 0,
				a = toArgArray( args ),
				l = a.length;
					
			for(i=0;i<l;i++){
				if( comp(a[i],type) ){
					if( count++ === n ) return a[i];
				}
			}
		}
		
		//to create the function with a with attribute
		function compileFn( includeWith, getFn ){			
			var ret = getFn();
			
			if( includeWith ) ret.with = function(){
				return getFn( arguments );
			}
			
			return ret;
			
		}
		
		//create the base function
		function baseFn( includeWith, handleFn ){
			function getFn( args ){
				return function( v ){
					return handleFn( v, args );
				}
			}
			
			return compileFn( includeWith, getFn );
		}
		
		//create the value function
		function valueFn( includeWith, handleFn, value ){
			
			function getFn( args ){
				return function(){
					return handleFn( value, args || arguments );
				}
			}
			
			return compileFn( includeWith, getFn );
		}
		
		//create the nthOfType function
		function nthOfType( includeWith, handleFn, compFn, type, n ){
			
			n = typeof n === 'number' ? n : 0;
			
			function getFn( args ){
				return function(){
					var value = getNthArgByType( compFn, arguments, n, type );
					return handleFn( value, args );
				}
			}
			
			return compileFn( includeWith, getFn );
		};
	
		//to create the nth function
		function nthFn( includeWith, handleFn, n, compFn, type, name ){
			
			var ret = compileFn( includeWith, getFn );
			
			function getFn( args ){
				return function(){
					return handleFn( arguments[n], args );
				}
			}
			
			if( type ) ret[name] = nthOfType( includeWith, handleFn, compFn, type, n );
			else ret.ofType = function( type ){
				return nthOfType( includeWith, handleFn, compFn, type, n )
			}
			
			return ret;
		}
		
		//to create the key function
		function keyFn( includeWith, handleFn, key ){
		
			var ret = compileFn( includeWith, getFn );
						
			function getFn( args ){
				return function( v ){
					if( exists(v) ) return handleFn( v[key], args );
				}
			}
			
			function nthHandle( v, args ){
				if( exists(v) ) return handleFn( v[key], args );
			}
			
			ret.inNth = function( n ){
				return nthFn( includeWith, nthHandle, n, is );
			}
			
			function getFnThis( args ){
				return function(){
					return handleFn( this[key], args || arguments, this );
				}
			}
			
			ret.inThis = compileFn( includeWith, getFnThis );
			
			return ret;
		}
	
		function build( handleFn, includeWith, name, compFn, type ){
			//create the base function
			var ret = baseFn( includeWith, handleFn ),
				upperName = name[0].toUpperCase() + name.slice(1);
			
			//if a type was provided, add handle for first occurrence of the type
			if( type ) ret['first' + upperName ] = nthOfType( includeWith, handleFn, compFn, type );
			
			//to handle a specific value
			ret[name] = function( value ){
				return valueFn( includeWith, handleFn, value );
			}
			
			//to handle the nth occurrence of the type
			ret.nth = function( n ){
				return nthFn( includeWith, handleFn, n, compFn, type, name );
			}
			
			//to handle the given key
			ret.key = function( key ){
				return keyFn( includeWith, handleFn, key );
			}
			
			return ret;
		}
		
		return build;
		
	})();
	
	
	function callHandle( f, args, that ){
		if( is(f,Function) ) return f.apply(that || this, args);
	}
	exports.run = exports.call = build( callHandle, true, 'fn', is, Function );

	function instantiateHandle( f, args ){
		args = args ? toArgArray( args ) : [];
		if( is(f,Function) ) return new (Function.prototype.bind.apply(f,[f].concat(args)));
	}
	exports.instantiate =  build( instantiateHandle, true, 'fn', is, Function );
	exports.new = exports.instantiate;	
	
	function throwHandle( e ){
		throw e;
	}
	exports.throw = build( throwHandle, false, 'error', isInstance, Error );
	exports.error = exports.throw;

	function echoHandle( v ){
		return v;
	}
	exports.echo =  build( echoHandle, false, 'value', is );
	exports.return = exports.echo;
	
})( (typeof module === "object" && typeof module.exports === "object") ? module.exports : (baseFns = {}) )