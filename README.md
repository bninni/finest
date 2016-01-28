To extract nested brackets from strings.  

It will detect all brackets inside the string, and return the data from each bracket in a nested format.

For example:
Parsing: `'outer( inner )'` will return `' inner '`
parsing: `'outer( inner( innest ) )'` will return: `' inner( innest ) '` and `' innest '`

It works with escaped characters and characters that exist inside strings:
Parsing: `'outer( inner( innest )" )'`  will return `' "inner( innest )" '`
Parsing: `'outer( inner\( innest ) )'`  will return `' "inner\( innest )" '`

To use:

```javascript
var Extractor = require('extract-brackets')
```

You can define the `open` str, the `close` str, and the `string escape` strs

If a `close` char is not provided, it will default to the matching pair from the a list, or it will be the `open` string in reverse.

If a `string escape` list is not provided, it will default to a common list.

Returns an array of **match objects**

A **match object** has three properties:

  * `str` - The entire string inside the brackets
  * `hasNest` - If a nested bracket was found
  * `nest` - Array where each element is either a plain string or a nested **match object**

To extract parenthesis:
```javascript
var ExtractParens = new Extractor( '(' );

//the 'close' char defaults to ')'

ExtractParents.extract('outer( inner( innest ) )')
```

will return:
```javascript

[{
  hasNest : true,
  str : ' inner( innest ) '
  nest : [
    ' inner',
    {
	  str : ' innest ',
	  hasNest : false,
	  nest : [' innest ']
	},
    ' '
  ]
}
```