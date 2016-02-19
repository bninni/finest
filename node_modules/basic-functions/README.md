# basic-functions
[![Build Status](https://travis-ci.org/bninni/basic-functions.svg?branch=master)](https://travis-ci.org/bninni/basic-functions)

A Simple module which contains common functions to save you time, code, and memory

## Install
```
npm install basic-functions
```
or
```
npm install -g basic-functions
```

Then import the module into your program:

```javascript
var baseFns = require('basic-functions')
```

An simply reference the stored functions

## Default Values

```javascript
baseFns.undefined() //undefined

baseFns.null()      //null

baseFns.true()      //true
//or baseFns.True()

baseFns.false()     //false
//or baseFns.False()

baseFns.zero()      //0
//or baseFns[0], baseFns['0'], baseFns.Zero

baseFns.one()       //1
//or baseFns[1], baseFns['1'], baseFns.One

baseFns.NaN()       //NaN
//or baseFns.nan()

baseFns.Infinity()  //Infinity
//or baseFns.infinity()

baseFns._Infinity() //-Infinity
//or baseFns._infinity()

baseFns.Array()     //[]
//or baseFns.array()

baseFns.Object()    //{}
//or baseFns.object()

baseFns.String()    //{}
//or baseFns.string()

baseFns.Function()  //function(){}
//or baseFns.function()

baseFns.this()      //this

//more detailed example of how 'this' can be used
var obj = {},
  f = baseFns.this.bind( obj );

f() === obj; //true
```
<a name="handlers"></a>
## Handlers

  * [Empty Handler](#empty)
  * [Calling a Function](#call)
  * [Instantiating a Constructor](#instantiate)
  * [Throwing an Error](#throw)
  * [Echoing a Value](#echo)

<a name="empty"></a>
### Empty Handler

[Back to Top](#handlers)

* **noop**
* **noOp**
  
*Does nothing*

```javascript
var fn = baseFns.noop;
//or baseFns.noOp

fn() //undefined
```

<a name="call"></a>
### Calling a Function

[Back to Top](#handlers)

* **call**
* **run**

*Returns the result of invoking the first input argument*
  * *Only if the input argument is a* `Function`
  
```javascript
var fn = baseFns.call;
//or baseFns.run

function arrFn(){
  return ['a','b','c'];
}

fn( arrFn ) //['a','b','c']
```

* **call.with( _args_ )**
 
*Returns the result of invoking the first input argument with* `args` *as the* `arguments`

```javascript
var fn = baseFns.call.with( 5, 10 );
//or baseFns.run.with( 5, 10 )

function add( a, b ){
  return a + b;
}

function multiply( a, b ){
  return a * b;
}

fn( add )      //15
fn( multiply ) //50
```

* **call.fn( _fn_ )**
 
*Returns the result of invoking* `fn` *with the input arguments as the* `arguments`

```javascript
var fn = baseFns.call.fn( add );
//or baseFns.run.fn( add )

fn( 5, 10 ) //15
```

* **call.fn( _fn_ ).with( _args_ )**
 
*Returns the result of invoking* `fn` *with* `args` *as the* `arguments`

```javascript
var fn = baseFns.call.fn( add ).with( 5, 10 );
//or baseFns.run.fn( add ).with( 5, 10 )

fn()          //15
fn( 25, 100 ) //15
```

* **call.firstFn**
 
*Returns the result of invoking the first input argument that is a* `Function`

```javascript
var fn = baseFns.call.firstFn;
//or baseFns.run.firstFn

function numFn(){
  return 10;
}

function strFn(){
  return 'hi';
}

fn( false, numFn, strFn ) //10
```

* **call.firstFn.with( _args_ )**
 
*Returns the result of invoking the first input argument that is a* `Function` *with* `args` *as the* `arguments`

```javascript
var fn = baseFns.call.firstFn.with( 5, 10 );
//or baseFns.run.firstFn.with( 5, 10 )

fn( [], add, multiply )     //15
```

* **call.nth( _n_ )**
 
*Returns the result of invoking the* `nth` *input argument*

*Note: Index starts at* `0`

```javascript
var fn = baseFns.call.nth(1);
//or baseFns.run.nth(1)

fn( false, numFn, strFn ) //10
```

* **call.nth( _n_ ).with( _args_ )**
 
*Returns the result of invoking the* `nth` *input argument with* `args` *as the* `arguments`

```javascript
var fn = baseFns.call.nth(1).with( 5, 10 );
//or baseFns.run.nth(1).with( 5, 10 )

fn( [], add, multiply ) //15
```

* **call.nth( _n_ ).fn**
 
*Returns the result of invoking the* `nth` *input argument that is a* `Function`

*Note: Index starts at* `0`

```javascript
var fn = baseFns.call.nth(1).fn;
//or baseFns.run.nth(1).fn

fn( false, numFn, strFn ) //'hi'
```

* **call.nth( _n_ ).fn.with( _args_ )**
 
*Returns the result of invoking the* `nth` *input argument that is a* `Function` *with* `args` *as the* `arguments`

```javascript
var fn = baseFns.call.nth(1).fn.with( 5, 10 );
//or baseFns.run.nth(1).fn.with( 5, 10 )

fn( [], add, multiply ) //50
```

* **call.key( _key_ )**
 
*Returns the result of invoking the property* `key` *in the first input argument*

```javascript
var numObj = {
    fn : numFn
  },
  strObj = {
    fn : strFn
  },
  fn = baseFns.call.key('fn');
  //or baseFns.run.key('fn')

fn( numObj ) //10
fn( strObj ) //'hi'
```

* **call.key( _key_ ).with( _args_ )**
 
*Returns the result of invoking the property* `key` *in the first input argument with* `args` *as the* `arguments`

```javascript
var multObj = {
    fn : multiply
  },
  addObj = {
    fn : add
  },
  fn = baseFns.call.key('fn').with( 5, 10 );
  //or baseFns.run.key('fn').with( 5, 10 )

fn( multObj ) //50
fn( addObj )  //15
```

* **call.key( _key_ ).inThis**
 
*Returns the result of invoking the property* `key` *in* `this` *with the input arguments as the* `arguments`

```javascript
var fn = baseFns.call.key('fn').inThis.bind( addObj );
//or baseFns.run.key('fn').inThis.bind( addObj )

fn( 5, 10 ) //15
```

* **call.key( _key_ ).inThis.with( _args_ )**
 
*Returns the result of invoking the property* `key` *in* `this` *with* `args` *as the* `arguments`

```javascript
var fn = baseFns.call.key('fn').inThis.with( 5, 10 );
//or baseFns.run.key('fn').inThis.with( 5, 10 ).bind( addObj )

fn()          //15
fn( 25, 100 ) //15
```

* **call.key( _key_ ).inNth( _n_ )**
 
*Returns the result of invoking the property* `key` *in the* `nth` *input argument*

```javascript
var fn = baseFns.call.key('fn').inNth(1);
//or baseFns.run.key('fn').inNth(1)

fn( false, numObj, strObj ) //10
```

* **call.key( _key_ ).inNth( _n_ ).with( _args_ )**
 
*Returns the result of invoking the property* `key` *in the* `nth` *input argument with* `args` *as the* `arguments`

```javascript
var fn = baseFns.call.key('fn').inNth(1).with( 5, 10 );
//or baseFns.run.key('fn').inNth(1).with( 5, 10 )

fn( [], addObj, multObj ) //15
```

* **call.key( _key_ ).inNth( _n_ ).ofType( _type_ )**
 
*Returns the result of invoking the property* `key` *in the* `nth` *input argument of type* `type`

```javascript
var fn = baseFns.call.key('fn').inNth(1).ofType( Object );
//or baseFns.run.key('fn').inNth(1).ofType( Object )

fn( false, numObj, strObj ) //'hi'
```

* **call.key( _key_ ).inNth( _n_ ).ofType( _type_ ).with( _args_ )**
 
*Returns the result of invoking the property* `key` *in the* `nth` *input argument of type* `type` *with* `args` *as the* `arguments`

```javascript
//can also use strings for the type
var fn = baseFns.call.key('fn').inNth(1).ofType( 'object' ).with( 5, 10 );
//or baseFns.run.key('fn').inNth(1).ofType( 'object' ).with( 5, 10 )

fn( [], addObj, multObj ) //50
```

<a name="instantiate"></a>
### Instantiating a Constructor

[Back to Top](#handlers)

* **instantiate**
* **new**

*Returns a* `new` *instance of the first input argument*
  * *Only if the input argument is a* `Function`
  
```javascript
var fn = baseFns.instantiate;
//or baseFns.new

fn( Array ) //[]
```

* **instantiate.with( _args_ )**
 
*Returns a* `new` *instance of the first input argument with* `args` *as the* `arguments`

```javascript
var fn = baseFns.instantiate.with( 'abc' );
//or baseFns.new.with( 'abc' )

fn( Array )   //['abc']
```

* **instantiate.fn( _fn_ )**
 
*Returns a* `new` *instance of* `fn` *with the input arguments as the* `arguments`

```javascript
var fn = baseFns.instantiate.fn( Array );
//or baseFns.new.fn( Array )

fn( 5 ) //[5]
```

* **instantiate.fn( _fn_ ).with( _args_ )**
 
*Returns a* `new` *instance of* `fn` *with* `args` *as the* `arguments`

```javascript
var fn = baseFns.instantiate.fn( Array ).with( 5, 10 );
//or baseFns.new.fn( Array ).with( 5, 10 )

fn()          //[5, 10]
fn( 25, 100 ) //[5, 10]
```

* **instantiate.firstFn**
 
*Returns a* `new` *instance of the first input argument that is a* `Function`

```javascript
var fn = baseFns.instantiate.firstFn;
//or baseFns.new.firstFn

fn( 100, Array, String ) //[]
```

* **instantiate.firstFn.with( _args_ )**
 
*Returns a* `new` *instance of the first input argument that is a* `Function` *with* `args` *as the* `arguments`

```javascript
var fn = baseFns.instantiate.firstFn.with( true );
//or baseFns.new.firstFn.with( true )

fn( 100, Array, String ) //[ true ]
```

* **instantiate.nth( _n_ )**
 
*Returns a* `new` *instance of the* `nth` *input argument*

*Note: Index starts at* `0`

```javascript
var fn = baseFns.instantiate.nth(1);
//or baseFns.new.nth(1)

fn( 100, Array, String ) //[]
```

* **instantiate.nth( _n_ ).with( _args_ )**
 
*Returns a* `new` *instance of the* `nth` *input argument with* `args` *as the* `arguments`

```javascript
var fn = baseFns.instantiate.nth(1).with( true );
//or baseFns.new.nth(1).with( true )

fn( 100, Array, String ) //[ true ]
```

* **instantiate.nth( _n_ ).fn**
 
*Returns a* `new` *instance of the* `nth` *input argument that is a* `Function`

*Note: Index starts at* `0`

```javascript
var fn = baseFns.instantiate.nth(1).fn;
//or baseFns.new.nth(1).fn

fn( 100, Array, String ) //''
```

* **instantiate.nth( _n_ ).fn.with( _args_ )**
 
*Returns a* `new` *instance of the* `nth` *input argument that is a* `Function` *with* `args` *as the* `arguments`

```javascript
var fn = baseFns.instantiate.nth(1).fn.with( true );
//or baseFns.new.nth(1).fn.with( true )

fn( 100, Array, String ) //'true'
```

* **instantiate.key( _key_ )**
 
*Returns a* `new` *instance of the property* `key` *in the first input argument*

```javascript
var arrObj = {
    fn : Array
  },
  strObj = {
    fn : String
  },
  fn = baseFns.instantiate.key('fn');
  //or baseFns.new.key('fn')

fn( arrObj ) //[]
fn( strObj ) //''
```

* **instantiate.key( _key_ ).with( _args_ )**
 
*Returns a* `new` *instance of the property* `key` *in the first input argument with* `args` *as the* `arguments`

```javascript
var fn = baseFns.instantiate.key('fn').with( true );
//or baseFns.new.key('fn').with( true )

fn( arrObj ) //[ true ]
```

* **instantiate.key( _key_ ).inThis**
 
*Returns a* `new` *instance of the property* `key` *in* `this` *with the input arguments as the* `arguments`

```javascript
var fn = baseFns.instantiate.key('fn').inThis.bind( arrObj );
//or baseFns.new.key('fn').inThis.bind( arrObj )

fn()       //[]
fn( 'hi' ) //[ 'hi' ]
```

* **instantiate.key( _key_ ).inThis.with( _args_ )**
 
*Returns a* `new` *instance of the property* `key` *in* `this` *with* `args` *as the* `arguments`

```javascript
var fn = baseFns.instantiate.key('fn').inThis.with( true ).bind( arrObj );
//or baseFns.new.key('fn').inThis.with( true ).bind( arrObj )

fn()       //[ true ]
fn( 'hi' ) //[ true ]
```

* **instantiate.key( _key_ ).inNth( _n_ )**
 
*Returns a* `new` *instance of the property* `key` *in the* `nth` *input argument*

```javascript
var fn = baseFns.instantiate.key('fn').inNth(1);
//or baseFns.new.key('fn').inNth(1)

fn( 100, arrObj, strObj ) //[]
```

* **instantiate.key( _key_ ).inNth( _n_ ).with( _args_ )**
 
*Returns a* `new` *instance of the property* `key` *in the* `nth` *input argument with* `args` *as the* `arguments`

```javascript
var fn = baseFns.instantiate.key('fn').inNth(1).with( true );
//or baseFns.new.key('fn').inNth(1).with( true )

fn( 100, arrObj, strObj ) //[ true ]
```

* **instantiate.key( _key_ ).inNth( _n_ ).ofType( _type_ )**
 
*Returns a* `new` *instance of the property* `key` *in the* `nth` *input argument of type* `type`

```javascript
var fn = baseFns.instantiate.key('fn').inNth(1).ofType( Object );
//or baseFns.new.key('fn').inNth(1).ofType( Object )

fn( 100, arrObj, strObj ) //''
```

* **instantiate.key( _key_ ).inNth( _n_ ).ofType( _type_ ).with( _args_ )**
 
*Returns a* `new` *instance of the property* `key` *in the* `nth` *input argument of type* `type` *with* `args` *as the* `arguments`

```javascript
var fn = baseFns.instantiate.key('fn').inNth(1).ofType( 'object' ).with( true );
//or baseFns.new.key('fn').inNth(1).ofType( 'object' ).with( true );

fn( 100, arrObj, strObj ) //'true'
```

<a name="throw"></a>
### Throwing an Error

[Back to Top](#handlers)

* **throw**
* **error**

*Throws the first input argument*
  
```javascript
var fn = baseFns.throw;
//or baseFns.error

fn( new Error ) //throws Error
```

* **throw.error( _err_ )**
 
*Throws* `fn`

```javascript
var fn = baseFns.throw.error( new TypeError );
//or baseFns.error.error( new TypeError )

fn() //throws TypeError
```

* **throw.firstError**
 
*Throws the first input argument that is an* `instanceof Error`

```javascript
var fn = baseFns.throw.firstError;
//or baseFns.error.firstError

fn( {}, new Error, new TypeError ) //throws Error
```

* **throw.nth( _n_ )**
 
*Throws the* `nth` *input argument*

*Note: Index starts at* `0`

```javascript
var fn = baseFns.throw.nth(1);
//or baseFns.error.nth(1)

fn( {}, new Error, new TypeError ) //throws Error
```

* **throw.nth( _n_ ).error**
 
*Throws the* `nth` *input argument that is an* `instanceof Error`

*Note: Index starts at* `0`

```javascript
var fn = baseFns.throw.nth(1).error;
//or baseFns.error.nth(1).error

fn( {}, new Error, new TypeError ) //throws TypeError
```

* **throw.key( _key_ )**
 
*Throws the property* `key` *in the first input argument*

```javascript
var errObj = {
    err : new Error
  },
  typeErrObj = {
    err : new TypeError
  },
  fn = baseFns.throw.key('err');
  //or baseFns.error.key('err')

fn( errObj )     //throws Error
fn( typeErrObj ) //throws TypeError
```

* **throw.key( _key_ ).inThis**
 
*Throws the property* `key` *in* `this`

```javascript
var fn = baseFns.throw.key('err').inThis.bind( errObj );
//or baseFns.error.key('err').inThis.bind( errObj )

fn() //throws Error
```

* **throw.key( _key_ ).inNth( _n_ )**
 
*Throws the property* `key` *in the* `nth` *input argument*

```javascript
var fn = baseFns.throw.key('err').inNth(1);
//or baseFns.error.key('err').inNth(1)

fn( 'hi', errObj, typeErrObj ) //throws Error
```

* **throw.key( _key_ ).inNth( _n_ ).ofType( _type_ )**
 
*Throws the property* `key` *in the* `nth` *input argument of type* `type`

```javascript
var fn = baseFns.throw.key('err').inNth(1).ofType( Object );
//or baseFns.error.key('err').inNth(1).ofType( Object )

fn( 'hi', errObj, typeErrObj ) //throws TypeError
```

<a name="echo"></a>
### Echoing a Value

[Back to Top](#handlers)

* **echo**
* **return**

*Returns the first input argument*
  
```javascript
var fn = baseFns.echo;
//or baseFns.return

fn( 10 ) //10
```

* **echo.value( _v_ )**
 
*Returns* `v`

```javascript
var fn = baseFns.echo.value( 10 );
//or baseFns.return.value( 10 )

fn()       //10
fn( true ) //10
```

* **echo.nth( _n_ )**
 
*Returns the* `nth` *input argument*

*Note: Index starts at* `0`

```javascript
var fn = baseFns.echo.nth(1);
//or baseFns.return.nth(1)

fn( 'hi', 100, 'there' ) //100
```

* **echo.nth( _n_ ).ofType( _type_ )**
 
*Returns the* `nth` *input argument of type* `type`

*Note: Index starts at* `0`

```javascript
var fn = baseFns.echo.nth(1).ofType('string');
//or baseFns.return.nth(1).ofType('string')

fn( 'hi', 100, 'there' ) //'there'
```

* **echo.key( _key_ )**
 
*Returns the property* `key` *in the first input argument*

```javascript
var obj = {
    str : 'hi',
    num : 100
  },
  fn = baseFns.echo.key('str');
  //or baseFns.return.key('str')

fn( obj ) //'hi'
```

* **echo.key( _key_ ).inThis**
 
*Returns the property* `key` *in* `this`

```javascript
var fn = baseFns.echo.key('str').inThis.bind( obj );
//or baseFns.return.key('str').inThis.bind( obj )

fn() //'hi'
```

* **echo.key( _key_ ).inNth( _n_ )**
 
*Returns the property* `key` *in the* `nth` *input argument*

```javascript
var fn = baseFns.echo.key('num').inNth(1);
//or baseFns.return.key('num').inNth(1)

fn( 'hi', obj ) //100
```

* **echo.key( _key_ ).inNth( _n_ ).ofType( _type_ )**
 
*Returns the property* `key` *in the* `nth` *input argument of type* `type`

```javascript
var fn = baseFns.echo.key('str').inNth(1).ofType( Object );
//or baseFns.return.key('str').inNth(1).ofType( Object )

fn( 'hi', {}, obj ) //'hi'
```