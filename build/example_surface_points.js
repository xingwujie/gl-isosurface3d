(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('Invalid typed array length')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (value instanceof ArrayBuffer) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  return fromObject(value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj) {
    if (isArrayBufferView(obj) || 'length' in obj) {
      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
        return createBuffer(0)
      }
      return fromArrayLike(obj)
    }

    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return fromArrayLike(obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (isArrayBufferView(string) || string instanceof ArrayBuffer) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : new Buffer(val, encoding)
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// Node 0.10 supports `ArrayBuffer` but lacks `ArrayBuffer.isView`
function isArrayBufferView (obj) {
  return (typeof ArrayBuffer.isView === 'function') && ArrayBuffer.isView(obj)
}

function numberIsNaN (obj) {
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":1,"ieee754":4}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],6:[function(require,module,exports){
var createCamera = require('3d-view-controls')
var getBounds    = require('bound-points')
var perspective  = require('gl-mat4/perspective')
var createAxes   = require('gl-axes3d')
var createSpikes = require('gl-spikes3d')
var createSelect = require('gl-select-static')
var getBounds    = require('bound-points')
var mouseChange  = require('mouse-change')
var createPoints = require('gl-scatter3d')
var createIsosurface = require('../isosurface')

var mat4 = require('gl-mat4');

var getData = function(fn, responseType, callback) {
  if (!callback) {
    callback = responseType;
    responseType = 'text';
  }
  var xhr = new XMLHttpRequest;
  xhr.responseType = responseType;
  xhr.onload = function() {
    callback(xhr.response);
  };
  xhr.open('GET', fn, true);
  xhr.send();
};

getData('example/data/MRbrain.txt', 'arraybuffer', function(mriBuffer) {

  var dims = [256, 256, 109];
  var bounds = [[30, 30, 30], [256-30, 256-30, 109-30]];
  var dataWidth = dims[0], dataHeight = dims[1], dataDepth = dims[2];

  var mri = new Uint16Array(mriBuffer);
  for (var i=0; i<mri.length; i++) {
    mri[i] = ((mri[i] << 8) & 0xff00) | (mri[i] >> 8);
  }

  console.time("Total mesh creation time")

  var isoPlot = createIsosurface({
    values: mri,
    dimensions: dims,
    vertexIntensityBounds: [1300, 3000],
    isoBounds: [1300, 25000],
    smoothNormals: true,
    isoCaps: true
  }, bounds)

  var canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  window.addEventListener('resize', require('canvas-fit')(canvas))
  var gl = canvas.getContext('webgl')

  var camera = createCamera(canvas, {
    eye: [-100, 0, 250],
    up: [0, -1, 0],
    center: [0.5*(bounds[0][0]+bounds[1][0]),
             0.5*(bounds[0][1]+bounds[1][1]),
             0.5*(bounds[0][2]+bounds[1][2])],
    zoomMax: 500,
    mode: 'turntable'
  })

  isoPlot.colormap = 'portland'
  isoPlot.caps.colormap = 'portland'
  var mesh = createIsosurface.createTriMesh(gl, isoPlot)
  var capMesh = createIsosurface.createTriMesh(gl, isoPlot.caps)

  var points = [], glyphs = [], colors = [];
  var pos = isoPlot.positions;
  for (var i=0; i<100; i++) {
    var off = Math.floor(Math.random()*pos.length/3)*3;
    points.push([
      pos[off],
      pos[off+1],
      pos[off+2]
    ]);
    glyphs.push("✖");
    colors.push([1,0,0]);
  }

  var initialData = {
    gl: gl,
    position: points,
    glyph: glyphs,
    color: colors,
    size: 30,
    orthographic: true,
    lineColor: [0,0,0],
    lineWidth: 1,
    project: [true, true, true]
  }

  var points = createPoints(initialData);

  console.timeEnd("Total mesh creation time")

  var select = createSelect(gl, [canvas.width, canvas.height])
  var tickSpacing = 5;
  var ticks = bounds[0].map(function(v,i) {
    var arr = [];
    var firstTick = Math.ceil(bounds[0][i] / tickSpacing) * tickSpacing;
    var lastTick = Math.floor(bounds[1][i] / tickSpacing) * tickSpacing;
    for (var tick = firstTick; tick <= lastTick; tick += tickSpacing) {
      if (tick === -0) tick = 0;
      arr.push({x: tick, text: tick.toString()});
    }
    return arr;
  });
  var axes = createAxes(gl, { bounds: bounds, ticks: ticks })
  var spikes = createSpikes(gl, {
    bounds: bounds
  })
  var spikeChanged = false


  mouseChange(canvas, function(buttons, x, y) {
    var pickData = select.query(x, canvas.height - y, 10)
    var pickResult = mesh.pick(pickData) || capMesh.pick(pickData);
    if(pickResult) {
      spikes.update({
        position: pickResult.position,
        enabled: [true, true, true]
      })
      spikeChanged = true
    } else {
      spikeChanged = spikes.enabled[0]
      spikes.update({
        enabled: [false, false, false]
      })
    }
  })

  var stretchZ = mat4.create();
  mat4.scale(stretchZ, stretchZ, [1,1,1.2]);

  function render() {
    requestAnimationFrame(render)

    gl.enable(gl.DEPTH_TEST)
    gl.polygonOffset(1, -20);

    var needsUpdate = camera.tick()
    var cameraParams = {
      projection: perspective([], Math.PI/4, canvas.width/canvas.height, 0.01, 1000),
      view: camera.matrix,
      model: stretchZ
    }

    if(needsUpdate || spikeChanged) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      axes.draw(cameraParams)
      spikes.draw(cameraParams)
      mesh.draw(cameraParams)
      capMesh.draw(cameraParams)
      gl.enable(gl.POLYGON_OFFSET_FILL);
      points.axes = axes;
      points.draw(cameraParams)
      gl.disable(gl.POLYGON_OFFSET_FILL);
      spikeChanged = false
    }

    if(needsUpdate) {
      select.shape = [canvas.width, canvas.height]
      select.begin()
      mesh.drawPick(cameraParams)
      capMesh.drawPick(cameraParams)
      select.end()
    }
  }
  render()
})
},{"../isosurface":7,"3d-view-controls":12,"bound-points":37,"canvas-fit":45,"gl-axes3d":74,"gl-mat4":95,"gl-mat4/perspective":100,"gl-scatter3d":113,"gl-select-static":114,"gl-spikes3d":123,"mouse-change":156}],7:[function(require,module,exports){
"use strict";

var createTriMesh = require('./lib/trimesh');

var LOG_TIMINGS = false;

exports = module.exports = function(params, bounds) {
	if (params.logTimings) {
		LOG_TIMINGS = true;
	}
	var dims = params.dimensions;
	var data = params.values;
	var isoBounds = params.isoBounds || [1, 1/0];
	var isoMin = isoBounds[0], isoMax = isoBounds[1]; 
	var isosurf = exports.marchingCubes(dims, data, isoMin, isoMax, bounds)
	if (params.smoothNormals) {
		exports.smoothNormals(isosurf);
	}
	var isocapsMesh;
	if (params.isoCaps) {
		var isocaps = exports.marchingCubesCaps(dims, data, isoMin, isoMax, bounds);
		if (params.singleMesh) {
			isosurf = exports.concatMeshes(isosurf, isocaps);
		} else {
			isocapsMesh = exports.meshConvert(isocaps, data, dims, params.capsVertexIntensityBounds || params.vertexIntensityBounds);
			isocapsMesh.colormap = params.capsColormap || params.colormap;
		}
	}
	var isoPlot = exports.meshConvert(isosurf, data, dims, params.vertexIntensityBounds);
	isoPlot.colormap = params.colormap;
	if (isocapsMesh) {
		isoPlot.caps = isocapsMesh;
	}
	if (params.logTimings) {
		LOG_TIMINGS = false;
	}
	return isoPlot;
};

exports.createTriMesh = createTriMesh;

var computeVertexNormals = require('./lib/computeVertexNormals').computeVertexNormals

var geoTable = [new Float32Array([]), new Float32Array([1,0,0,0,0,1,0,1,0]), new Float32Array([0,0,0,1,1,0,1,0,1]), new Float32Array([1,1,0,0,0,1,0,1,0,1,0,1,0,0,1,1,1,0]), new Float32Array([0,0,0,0,1,1,1,1,0]), new Float32Array([1,0,0,0,1,1,1,1,0,0,0,1,0,1,1,1,0,0]), new Float32Array([1,1,0,1,0,1,0,0,0,1,1,0,0,0,0,0,1,1]), new Float32Array([1,1,0,0,1,1,1,1,0,1,1,0,1,0,1,0,1,1,1,0,1,0,0,1,0,1,1]), new Float32Array([1,0,0,0,1,0,1,1,1]), new Float32Array([1,0,0,0,0,1,0,1,0,1,0,0,0,1,0,1,1,1]), new Float32Array([1,0,1,0,1,0,1,1,1,0,0,0,0,1,0,1,0,1]), new Float32Array([0,1,0,0,0,1,0,1,0,0,1,0,1,1,1,0,0,1,1,1,1,1,0,1,0,0,1]), new Float32Array([0,0,0,1,1,1,1,0,0,0,1,1,1,1,1,0,0,0]), new Float32Array([1,0,0,1,1,1,1,0,0,1,0,0,0,0,1,1,1,1,0,0,1,0,1,1,1,1,1]), new Float32Array([0,0,0,1,0,1,0,0,0,0,0,0,0,1,1,1,0,1,0,1,1,1,1,1,1,0,1]), new Float32Array([1,0,1,0,0,1,1,1,1,1,1,1,0,0,1,0,1,1]), new Float32Array([1,0,1,0,1,1,0,0,0]), new Float32Array([1,0,1,0,1,0,1,0,0,0,1,1,0,1,0,1,0,1]), new Float32Array([0,0,0,1,1,0,1,0,1,0,0,0,1,0,1,0,1,1]), new Float32Array([1,0,1,1,1,0,1,0,1,1,0,1,0,1,1,1,1,0,0,1,1,0,1,0,1,1,0]), new Float32Array([0,0,0,1,0,1,0,1,1,0,0,0,0,1,1,1,1,0]), new Float32Array([0,1,1,1,0,1,0,1,1,0,1,1,1,1,0,1,0,1,1,1,0,1,0,0,1,0,1]), new Float32Array([1,0,1,0,0,0,1,1,0,0,0,0,1,0,1,0,1,1,1,1,0,0,0,0,0,1,1]), new Float32Array([1,0,1,0,1,1,0,1,1,1,0,1,1,0,1,0,1,1,1,0,1,0,1,1,1,1,0,1,0,1,1,1,0,1,1,0]), new Float32Array([1,0,0,0,1,0,1,1,1,0,0,0,1,0,1,0,1,1]), new Float32Array([0,1,0,1,0,1,0,1,1,0,1,0,1,0,0,1,0,1,1,0,0,0,1,0,1,1,1]), new Float32Array([1,0,1,0,1,0,1,1,1,1,0,1,0,0,0,0,1,0,0,0,0,1,0,1,0,1,1]), new Float32Array([0,1,0,1,1,1,1,0,1,0,1,0,1,0,1,0,1,1,0,1,0,0,1,1,0,1,0,0,1,1,1,0,1,1,0,1]), new Float32Array([0,0,0,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,0,1,1,0,0,0,1,0,1]), new Float32Array([1,0,0,0,1,1,1,1,1,1,0,0,1,0,1,0,1,1,1,0,0,1,0,0,1,0,1,0,1,1,0,1,1,1,0,1]), new Float32Array([1,0,1,0,1,1,0,0,0,1,0,1,0,0,0,0,1,1,1,0,1,0,1,1,1,1,1,0,1,1,0,0,0,0,0,0]), new Float32Array([1,0,1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1,0,1,1,1,1,1]), new Float32Array([1,0,0,1,1,1,0,0,1]), new Float32Array([1,0,0,1,1,1,0,0,1,1,0,0,0,0,1,0,1,0]), new Float32Array([0,0,0,1,1,1,0,0,1,1,1,0,1,1,1,0,0,0]), new Float32Array([0,0,1,1,1,1,0,0,1,0,0,1,0,1,0,1,1,1,0,1,0,1,1,0,1,1,1]), new Float32Array([1,0,0,1,1,1,0,0,1,1,1,0,0,0,0,0,1,1]), new Float32Array([1,0,0,0,1,1,1,1,0,1,0,0,0,0,1,0,1,1,0,0,1,1,0,0,1,1,1]), new Float32Array([0,0,0,1,1,1,0,0,1,0,0,0,1,1,0,1,1,1,1,1,0,0,0,0,0,1,1]), new Float32Array([1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,0,0,1,1,1,0,0,0,1,0,1,1,0,0,1,0,0,1,1,1,1]), new Float32Array([1,0,0,0,1,0,1,1,1,1,0,0,1,1,1,0,0,1]), new Float32Array([0,1,0,1,0,0,0,0,1,1,0,0,0,1,0,1,1,1,0,0,1,1,0,0,1,1,1]), new Float32Array([1,1,1,0,1,0,1,1,1,1,1,1,0,0,1,0,1,0,0,0,1,0,0,0,0,1,0]), new Float32Array([0,1,0,1,1,1,1,1,1,0,1,0,0,1,0,1,1,1,0,1,0,1,1,1,0,0,1,0,1,0,0,0,1,0,0,1]), new Float32Array([1,1,1,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,1,0,0,1,1,1,0,0,1]), new Float32Array([0,0,1,1,0,0,1,1,1,1,0,0,0,0,1,1,0,0,0,0,1,1,1,1,1,0,0,0,0,1,0,1,1,1,1,1]), new Float32Array([1,1,1,0,0,1,0,0,0,1,1,1,0,0,0,0,1,1,1,1,1,0,1,1,1,1,1,0,1,1,0,0,0,0,0,0]), new Float32Array([1,1,1,0,0,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,1,0,0,1,0,1,1]), new Float32Array([1,0,0,0,1,1,0,0,0,1,1,1,0,1,1,1,0,0]), new Float32Array([1,0,0,0,1,0,1,0,0,1,0,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1,0]), new Float32Array([0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1,1,1,1,0,1,1,1,0,1,1]), new Float32Array([1,1,0,1,1,1,0,1,0,0,1,0,1,1,1,0,1,1]), new Float32Array([0,1,1,1,0,0,1,1,1,0,1,1,0,0,0,1,0,0,0,0,0,0,1,1,1,1,0]), new Float32Array([1,0,0,1,1,1,0,1,1,1,0,0,0,1,1,1,1,0,1,0,0,1,1,0,1,0,0,1,1,0,0,1,1,0,1,1]), new Float32Array([1,1,0,0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0,0,1,1,0,1,1,1,0,1,1]), new Float32Array([0,1,1,1,1,0,1,1,0,0,1,1,1,1,0,0,1,1,0,1,1,1,1,0,1,1,1]), new Float32Array([1,0,0,0,1,1,0,0,0,1,0,0,1,1,1,0,1,1,1,1,1,1,0,0,0,1,0]), new Float32Array([1,1,1,1,0,0,0,1,0,1,0,0,1,1,1,1,0,0,1,1,1,0,1,0,1,0,0,1,1,1,0,1,1,0,1,0]), new Float32Array([0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,1,1,1,0,0,0,1,1,1,0,1,1,1,1,1,1,1,1,0,1,0]), new Float32Array([0,1,0,1,1,1,1,1,1,0,1,0,1,1,1,0,1,0,0,1,0,1,1,1,0,1,1]), new Float32Array([1,0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,1,1,1,1,1,1,0,0,0,0,0,1,1,1,0,0,0,0,1,1]), new Float32Array([1,1,1,0,1,1,1,0,0,1,1,1,1,0,0,1,0,0,0,1,1,0,1,1,1,0,0,1,0,0,1,0,0,1,1,1,0,1,1,1,1,1,1,0,0]), new Float32Array([0,1,1,1,1,1,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,1,1,0,0,0]), new Float32Array([0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1]), new Float32Array([0,0,1,1,1,1,0,1,0]), new Float32Array([0,1,0,1,0,0,0,0,1,0,1,0,0,0,1,1,1,1]), new Float32Array([0,0,0,1,1,0,1,0,1,0,1,0,0,0,1,1,1,1]), new Float32Array([0,0,1,1,1,0,1,0,1,0,0,1,0,1,0,1,1,0,0,1,0,0,0,1,1,1,1]), new Float32Array([0,0,1,1,1,0,0,0,0,1,1,1,1,1,0,0,0,1]), new Float32Array([0,0,1,1,0,0,0,0,1,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,1,0,0]), new Float32Array([1,1,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,1,0,0,0,1,1,0,1,0,1]), new Float32Array([1,1,0,1,1,1,1,1,0,1,1,0,0,0,1,1,1,1,1,1,0,1,0,1,0,0,1,0,0,1,0,0,1,1,1,1]), new Float32Array([1,1,1,1,0,0,0,1,0,1,1,1,0,1,0,0,0,1]), new Float32Array([1,0,0,0,1,0,1,1,1,0,1,0,1,0,0,0,0,1,1,1,1,0,1,0,0,0,1]), new Float32Array([0,1,0,1,0,1,0,0,0,0,1,0,1,1,1,1,0,1,1,1,1,0,1,0,0,0,1]), new Float32Array([1,1,1,0,1,0,0,0,1,0,1,0,1,1,1,0,1,0,1,1,1,0,0,1,0,1,0,1,1,1,1,0,1,0,0,1]), new Float32Array([1,1,1,0,0,1,1,1,1,1,1,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,1]), new Float32Array([1,1,1,0,0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0,0,0,0,1,0,0,1,1,0,0,1,0,0,0,0,1]), new Float32Array([0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,1,1,1,0,0,0,1,1,1,1,0,1,1,1,1,1,1,1,0,0,1]), new Float32Array([0,0,1,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,0,0,1,1,1,1,1,0,1]), new Float32Array([1,1,1,0,0,0,1,0,1,0,1,0,0,0,0,1,1,1]), new Float32Array([0,1,0,1,1,1,0,1,0,0,1,0,1,0,0,1,1,1,1,0,0,1,0,1,1,1,1]), new Float32Array([0,0,0,1,1,1,0,1,0,0,0,0,1,0,1,1,1,1,1,0,1,0,0,0,1,1,0]), new Float32Array([1,0,1,1,0,1,1,1,1,1,0,1,1,1,1,0,1,0,1,0,1,0,1,0,1,1,0,0,1,0,0,1,0,1,1,1]), new Float32Array([0,0,0,1,1,0,0,0,0,0,0,0,1,0,1,1,1,0,1,0,1,1,1,1,1,1,0]), new Float32Array([1,0,0,1,0,1,1,1,0,1,0,1,1,1,1,1,1,0]), new Float32Array([1,1,0,1,0,1,0,0,0,1,1,0,0,0,0,1,0,1,1,1,0,1,0,1,1,1,1,1,0,1,0,0,0,0,0,0]), new Float32Array([1,1,0,1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1,0,1,1,1,1]), new Float32Array([1,1,1,0,0,0,1,0,1,1,1,1,0,1,0,0,0,0,0,1,0,1,1,1,1,0,0]), new Float32Array([1,0,0,0,1,0,1,1,1,0,1,0,1,0,0,0,1,0,1,0,0,1,1,1,0,1,0,1,0,0,1,0,1,1,1,1]), new Float32Array([1,0,1,0,1,0,0,0,0,1,0,1,1,1,1,0,1,0,0,0,0,0,1,0,1,0,1,0,1,0,1,1,1,1,0,1]), new Float32Array([1,1,1,1,0,1,0,1,0,1,1,1,0,1,0,0,1,0,1,0,1,1,0,1,0,1,0,0,1,0,0,1,0,1,1,1,1,0,1,1,1,1,0,1,0]), new Float32Array([0,0,0,1,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,1,0,1,1,1,1,1,1,1,1,1,1,1,0,0]), new Float32Array([1,1,1,1,0,0,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,1,0,0,1,0,1]), new Float32Array([1,0,1,1,1,1,0,0,0,1,0,1,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,0,1,1,1,1,1,0,1,0,0,0]), new Float32Array([1,1,1,1,0,1,1,0,1,1,1,1,1,1,1,1,0,1]), new Float32Array([0,0,1,1,0,0,1,1,1,0,0,1,1,1,1,0,1,0]), new Float32Array([1,0,0,0,0,1,0,1,0,0,0,1,1,0,0,1,1,1,0,1,0,0,0,1,1,1,1]), new Float32Array([1,1,1,0,0,0,1,1,0,1,1,1,0,0,1,0,0,0,0,0,1,1,1,1,0,1,0]), new Float32Array([0,1,0,0,0,1,1,1,1,0,0,1,0,1,0,0,0,1,0,1,0,1,1,1,0,0,1,0,1,0,1,1,0,1,1,1]), new Float32Array([0,0,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,0,1,1,1,0,0,1,1,0,0]), new Float32Array([1,0,0,1,1,1,0,0,1,1,0,0,0,0,1,1,1,1,1,0,0,1,1,1,1,1,0,1,1,1,0,0,1,0,0,1]), new Float32Array([0,0,0,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,0,1,1,1,0,0,0,1,1,1,0,0,1,0,0,0]), new Float32Array([1,1,1,1,1,0,0,0,1,1,1,1,0,0,1,0,0,1,1,1,0,1,1,0,0,0,1,0,0,1,0,0,1,1,1,1,1,1,0,1,1,1,0,0,1]), new Float32Array([1,0,0,1,1,1,0,0,1,1,1,1,1,0,0,0,1,0,0,0,1,1,1,1,0,1,0]), new Float32Array([1,1,1,0,1,0,0,0,1,1,0,0,0,1,0,1,1,1,1,0,0,0,0,1,0,1,0,0,0,1,1,0,0,1,1,1]), new Float32Array([0,0,1,1,1,1,0,1,0,1,1,1,0,0,1,1,1,1,0,0,1,0,1,0,1,1,1,0,0,1,0,0,0,0,1,0]), new Float32Array([0,1,0,0,0,1,0,0,1,0,1,0,1,1,1,0,0,1,0,1,0,0,1,0,1,1,1,1,1,1,1,1,1,0,1,0,0,1,0,0,0,1,1,1,1]), new Float32Array([1,0,0,1,1,1,0,0,1,1,1,1,1,0,0,1,1,1,1,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,1]), new Float32Array([1,0,0,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,0,0,1,0,0,0,0,1,0,0,1,0,0,1,1,0,0,1,0,0,1,1,1,0,0,1]), new Float32Array([0,0,1,0,0,0,1,1,1,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,1,0,0,0,0,0,1,1,1,1]), new Float32Array([0,0,1,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,0,0,1,1,1,1]), new Float32Array([1,1,1,1,0,0,1,1,1,1,1,1,0,1,0,1,0,0,0,1,0,0,0,0,1,0,0]), new Float32Array([0,1,0,1,1,1,0,1,0,1,0,0,1,1,1,0,1,0,1,0,0,1,1,1,1,1,1,1,0,0,1,0,0,1,1,1]), new Float32Array([0,0,0,0,1,0,0,0,0,0,0,0,1,1,1,0,1,0,0,0,0,1,1,0,1,1,1,1,1,1,1,1,1,0,1,0]), new Float32Array([1,1,1,0,1,0,0,1,0,1,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0]), new Float32Array([1,1,1,0,0,0,1,0,0,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,0]), new Float32Array([1,0,0,1,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,0,0,1,1,1,1,1,0]), new Float32Array([1,1,0,1,1,1,0,0,0,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1,0,0,0,0]), new Float32Array([1,1,0,1,1,1,1,1,1,1,1,0,1,1,0,1,1,1]), new Float32Array([1,0,0,0,1,0,1,1,1,1,0,0,1,1,1,0,1,0,1,0,0,0,1,0,0,0,0,0,1,0,1,1,1,1,1,1]), new Float32Array([1,0,0,0,1,0,0,1,0,1,0,0,1,1,1,0,1,0,1,0,0,1,0,0,1,1,1,1,1,1,1,1,1,1,0,0,1,0,0,0,1,0,1,1,1]), new Float32Array([0,1,0,0,0,0,1,1,1,0,1,0,1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,1,0,0,0,0,0,1,0,1,1,1]), new Float32Array([1,1,1,0,1,0,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,1,1,1,0,1,0]), new Float32Array([1,0,0,0,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,0,0,1,1,1]), new Float32Array([1,1,1,1,0,0,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,1,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1]), new Float32Array([1,1,1,1,1,1,1,1,1]), new Float32Array([1,1,0,0,1,1,1,0,1]), new Float32Array([1,0,0,0,0,1,0,1,0,1,0,1,1,1,0,0,1,1]), new Float32Array([1,0,1,0,0,0,1,1,0,1,0,1,1,1,0,0,1,1]), new Float32Array([1,1,0,0,0,1,0,1,0,1,1,0,1,0,1,0,0,1,1,0,1,1,1,0,0,1,1]), new Float32Array([1,1,0,0,0,0,0,1,1,1,1,0,0,1,1,1,0,1]), new Float32Array([0,1,1,1,0,0,0,0,1,0,1,1,1,1,0,1,0,0,1,1,0,0,1,1,1,0,1]), new Float32Array([0,0,0,1,1,0,1,0,1,1,1,0,0,0,0,0,1,1,1,0,1,1,1,0,0,1,1]), new Float32Array([1,0,1,1,1,0,0,1,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1,1,1,1,0,1,0,1,0,0,1,0,1,1]), new Float32Array([1,0,0,0,1,1,1,0,1,0,1,0,0,1,1,1,0,0]), new Float32Array([1,0,0,0,1,1,1,0,1,1,0,0,0,1,0,0,1,1,0,1,0,1,0,0,0,0,1]), new Float32Array([1,0,1,0,1,1,1,0,1,1,0,1,0,0,0,0,1,1,0,0,0,0,1,0,0,1,1]), new Float32Array([1,0,1,1,0,1,0,0,1,1,0,1,0,0,1,0,1,0,1,0,1,0,1,0,0,1,1,0,1,0,0,1,0,0,0,1]), new Float32Array([0,1,1,0,0,0,0,1,1,0,1,1,1,0,1,0,0,0,1,0,1,1,0,0,0,0,0]), new Float32Array([1,0,0,0,0,1,0,1,1,1,0,0,0,1,1,1,0,1,1,0,0,1,0,1,1,0,0,1,0,1,0,1,1,0,1,1]), new Float32Array([0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,1,0,1,0,0,0,1,0,1,1,0,1]), new Float32Array([0,1,1,1,0,1,1,0,1,0,1,1,1,0,1,0,1,1,0,1,1,1,0,1,0,0,1]), new Float32Array([1,0,1,1,1,0,0,1,1,1,0,1,0,1,1,0,0,0]), new Float32Array([1,0,1,0,1,0,1,0,0,1,0,1,0,1,1,0,1,0,0,1,1,1,0,1,1,1,0]), new Float32Array([1,1,0,1,0,1,0,0,0,1,0,1,1,1,0,0,1,1,0,0,0,1,0,1,0,1,1]), new Float32Array([1,1,0,0,1,1,1,0,1,1,1,0,1,0,1,0,1,1,1,1,0,0,1,1,0,1,0,0,1,1,1,0,1,1,0,1]), new Float32Array([0,0,0,0,1,1,1,1,0,0,1,1,0,0,0,1,0,1,1,1,0,0,1,1,1,0,1]), new Float32Array([1,0,1,1,1,0,0,1,1,1,0,1,0,1,1,1,1,0,1,0,1,1,1,0,1,0,0,1,1,0,0,1,1,0,1,1]), new Float32Array([0,0,0,1,1,0,1,0,1,1,0,1,0,1,1,0,0,0,1,1,0,0,0,0,0,1,1,1,0,1,1,1,0,0,1,1]), new Float32Array([1,0,1,1,1,0,1,1,0,1,0,1,0,1,1,1,1,0,1,0,1,1,0,1,0,1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,0,1,1]), new Float32Array([0,1,1,1,0,0,0,1,0,0,1,1,1,0,1,1,0,0,1,0,1,0,1,1,0,0,0]), new Float32Array([1,0,0,0,1,0,1,0,1,1,0,1,0,1,0,0,1,1,0,1,0,1,0,0,1,0,1,0,1,0,1,0,1,0,1,1]), new Float32Array([0,0,0,1,0,1,0,1,1,1,0,1,0,0,0,1,0,1,0,0,0,0,1,1,1,0,1,0,0,0,0,1,0,0,1,1]), new Float32Array([0,1,1,0,1,0,1,0,1,0,1,1,1,0,1,1,0,1,0,1,0,0,1,0,1,0,1,1,0,1,1,0,1,0,1,1,0,1,0,0,1,1,1,0,1]), new Float32Array([0,0,0,1,0,1,0,1,1,0,0,0,0,1,1,1,0,1,0,0,0,1,0,1,1,0,0,1,0,1,0,1,1,0,1,1]), new Float32Array([1,0,1,1,0,0,0,1,1,1,0,1,0,1,1,0,1,1,1,0,0,1,0,0,0,1,1,0,1,1,0,1,1,1,0,1,1,0,0,1,0,1,0,1,1]), new Float32Array([0,0,0,1,0,1,1,0,1,0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0,1,1,0,1,1,0,1,1,0,0,0,0,0,0,1,0,1,0,1,1]), new Float32Array([0,1,1,1,0,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,0,1,1,1,0,1]), new Float32Array([1,1,0,0,0,1,1,0,0,0,1,1,0,0,1,1,1,0]), new Float32Array([0,0,1,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,1,0,0,0,0,1,0,1,0]), new Float32Array([1,1,0,0,0,0,1,1,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,0,0,0]), new Float32Array([0,0,1,0,1,0,1,1,0,0,0,1,1,1,0,0,1,1,0,0,1,0,1,1,0,0,1,0,1,1,1,1,0,1,1,0]), new Float32Array([1,1,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,0,1,1,1,1,0,0,0,0]), new Float32Array([1,0,0,0,0,1,1,1,0,1,1,0,0,0,1,0,1,1,0,0,1,1,0,0,1,1,0,0,0,1,1,1,0,0,1,1]), new Float32Array([0,0,0,0,1,1,1,1,0,0,0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,0,1,1,1,1,0,1,1,0]), new Float32Array([0,1,1,0,0,1,1,1,0,0,1,1,1,1,0,1,1,0,0,0,1,0,0,1,1,1,0,1,1,0,1,1,0,0,1,1,0,0,1,0,1,1,1,1,0]), new Float32Array([1,0,0,0,0,1,1,0,0,1,0,0,0,1,0,0,0,1,0,1,0,0,1,1,0,0,1]), new Float32Array([0,1,0,1,0,0,0,0,1,1,0,0,0,1,0,1,0,0,0,1,0,0,0,1,1,0,0,0,1,0,0,1,1,0,0,1]), new Float32Array([0,0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,1,1]), new Float32Array([0,0,1,0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0,1,0,0,1,1]), new Float32Array([1,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,1,1,0,0,1,0,0,0,0,0,0,1,1,0,1,1,0,0,0]), new Float32Array([0,0,1,0,1,1,1,0,0,0,0,1,1,0,0,1,0,0,0,1,1,0,1,1,1,0,0,1,0,0,1,0,0,0,0,1,0,1,1,0,0,1,1,0,0]), new Float32Array([0,0,0,0,1,1,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,1]), new Float32Array([0,1,1,0,0,1,0,0,1,0,1,1,0,1,1,0,0,1]), new Float32Array([0,1,1,1,1,0,0,1,1,0,1,1,0,0,0,1,1,0,0,0,0,1,0,0,1,1,0]), new Float32Array([1,0,0,0,1,1,0,1,0,1,0,0,1,1,0,0,1,1,1,0,0,1,0,0,1,1,0,0,1,1,0,1,1,1,1,0]), new Float32Array([1,1,0,0,1,1,0,1,1,1,1,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0,0]), new Float32Array([1,1,0,0,1,1,0,1,1,1,1,0,0,1,1,1,1,0,1,1,0,0,1,1,0,1,0]), new Float32Array([1,1,0,0,0,0,0,1,1,1,1,0,0,1,1,0,0,0,1,1,0,0,0,0,1,0,0,0,0,0,0,1,1,0,1,1]), new Float32Array([1,1,0,1,0,0,0,1,1,1,1,0,0,1,1,0,1,1,1,0,0,1,0,0,0,1,1,0,1,1,0,1,1,1,1,0,1,0,0,1,1,0,0,1,1]), new Float32Array([1,1,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,0,1,1,0,1,1,0,0,1,1,0,1,1,0,1,1,1,1,0,1,1,0,0,0,0,0,1,1]), new Float32Array([0,1,1,1,1,0,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,0,1,1,1,1,0]), new Float32Array([1,0,0,0,1,0,0,1,1,1,0,0,0,1,1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,1,1,0,1,1]), new Float32Array([0,1,0,0,1,1,1,0,0,0,1,0,1,0,0,1,0,0,0,1,1,0,1,1,1,0,0,1,0,0,1,0,0,0,1,0,0,1,1,0,1,0,1,0,0]), new Float32Array([0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,1,1,0,0,0,0,1,0]), new Float32Array([0,1,1,0,1,0,0,1,0,0,1,1,0,1,1,0,1,0]), new Float32Array([0,0,0,1,0,0,0,1,1,0,0,0,0,1,1,0,1,1,1,0,0,1,0,0,0,1,1,0,1,1,0,1,1,0,0,0,1,0,0,0,0,0,0,1,1]), new Float32Array([1,0,0,1,0,0,1,0,0,0,1,1,0,1,1,0,1,1]), new Float32Array([0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,1,1,0,0,0]), new Float32Array([0,1,1,0,1,1,0,1,1]), new Float32Array([0,1,0,1,0,1,1,1,0,0,0,1,1,0,1,0,1,0]), new Float32Array([0,1,0,1,0,1,1,1,0,0,1,0,0,0,1,1,0,1,0,0,1,0,1,0,1,0,0]), new Float32Array([1,0,1,0,1,0,0,0,1,1,0,1,1,1,0,0,1,0,1,1,0,1,0,1,0,0,0]), new Float32Array([1,1,0,0,0,1,1,0,1,1,1,0,0,1,0,0,0,1,1,0,1,0,0,1,1,1,0,0,0,1,0,1,0,1,1,0]), new Float32Array([1,1,0,1,0,1,1,1,0,1,1,0,0,0,0,1,0,1,0,0,0,0,0,1,1,0,1]), new Float32Array([0,0,1,1,1,0,1,0,0,0,0,1,1,0,1,1,1,0,0,0,1,0,0,1,1,0,1,1,1,0,1,1,0,1,0,1]), new Float32Array([1,0,1,0,0,0,1,1,0,1,0,1,1,1,0,0,0,0,1,0,1,0,0,0,0,0,1,0,0,0,1,1,0,1,1,0]), new Float32Array([1,0,1,0,0,1,1,1,0,1,0,1,1,1,0,1,1,0,0,0,1,0,0,1,1,1,0,1,1,0,1,1,0,1,0,1,0,0,1,1,0,1,1,1,0]), new Float32Array([0,1,0,1,0,0,0,1,0,0,1,0,0,0,1,1,0,0,0,0,1,1,0,1,1,0,0]), new Float32Array([1,0,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0,1,1,0,0,0,0,1,1,0,1,0,0,1,0,1,0,0,1,0]), new Float32Array([1,0,1,0,0,1,1,0,1,1,0,1,0,1,0,0,0,1,1,0,1,0,0,0,0,1,0,0,1,0,0,1,0,0,0,1]), new Float32Array([0,0,1,1,0,1,0,1,0,0,0,1,0,1,0,0,1,0,1,0,1,1,0,1,0,1,0,0,1,0,0,1,0,0,0,1,1,0,1,0,0,1,0,1,0]), new Float32Array([1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,1,0,1]), new Float32Array([1,0,0,0,0,1,0,0,1,1,0,0,0,0,1,1,0,0,1,0,0,0,0,1,1,0,1]), new Float32Array([1,0,1,0,0,0,0,0,0,1,0,1,0,0,0,1,0,1,1,0,1,0,0,0,0,0,1]), new Float32Array([1,0,1,0,0,1,0,0,1,1,0,1,1,0,1,0,0,1]), new Float32Array([1,0,1,0,0,0,1,0,1,1,0,1,1,1,0,0,0,0,1,1,0,0,1,0,0,0,0]), new Float32Array([1,0,1,1,0,0,1,0,1,1,0,1,0,1,0,1,0,0,1,0,1,1,1,0,0,1,0,0,1,0,0,1,0,1,0,0]), new Float32Array([0,0,0,1,1,0,1,0,1,0,0,0,1,0,1,1,1,0,0,0,0,1,1,0,0,1,0,1,1,0,1,0,1,1,0,1]), new Float32Array([1,1,0,0,1,0,1,0,1,1,1,0,1,0,1,1,0,1,0,1,0,0,1,0,1,0,1,1,0,1,1,0,1,1,1,0,0,1,0,1,1,0,1,0,1]), new Float32Array([1,1,0,1,0,1,1,1,0,0,0,0,1,0,1,1,1,0,0,0,0,1,0,1,1,0,1,0,0,0,0,0,0,1,0,1]), new Float32Array([1,0,1,1,1,0,1,1,0,1,0,1,1,1,0,1,0,1,1,0,1,1,1,0,1,0,0]), new Float32Array([0,0,0,1,1,0,1,1,0,0,0,0,1,0,1,1,1,0,0,0,0,0,0,0,1,0,1,1,0,1,1,0,1,0,0,0,0,0,0,1,1,0,1,0,1]), new Float32Array([1,0,1,1,1,0,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,0,1,1,1,0]), new Float32Array([0,1,0,1,0,1,1,0,0,0,1,0,0,0,0,1,0,1,0,1,0,0,1,0,0,0,0,1,0,1,1,0,1,0,0,0]), new Float32Array([1,0,0,1,0,1,0,1,0,1,0,0,0,1,0,0,1,0,1,0,1,1,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,1,1,0,0,0,1,0]), new Float32Array([0,0,0,0,1,0,1,0,1,0,0,0,1,0,1,1,0,1,0,1,0,0,1,0,1,0,1,1,0,1,1,0,1,0,0,0,0,1,0,0,0,0,1,0,1]), new Float32Array([1,0,1,1,0,1,1,0,1,0,1,0,0,1,0,0,1,0]), new Float32Array([0,0,0,1,0,1,1,0,1,0,0,0,1,0,1,0,0,0,0,0,0,1,0,1,1,0,0]), new Float32Array([1,0,0,1,0,1,1,0,1,1,0,0,1,0,0,1,0,1]), new Float32Array([0,0,0,1,0,1,1,0,1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,0,0,0,1,0,1]), new Float32Array([1,0,1,1,0,1,1,0,1]), new Float32Array([0,0,1,0,1,0,0,0,1,0,0,1,1,0,0,0,1,0,1,0,0,1,1,0,0,1,0]), new Float32Array([1,0,0,0,0,1,0,1,0,0,0,1,1,0,0,0,0,1,1,0,0,0,1,0,0,0,1,1,0,0,1,1,0,0,1,0]), new Float32Array([1,1,0,1,1,0,0,1,0,1,1,0,0,1,0,0,0,1,1,1,0,0,0,1,0,0,0,0,0,1,0,0,1,0,1,0]), new Float32Array([0,1,0,1,1,0,0,0,1,0,1,0,0,0,1,0,0,1,1,1,0,1,1,0,0,0,1,0,0,1,0,0,1,0,1,0,1,1,0,0,1,0,0,0,1]), new Float32Array([1,1,0,1,0,0,1,1,0,1,1,0,0,0,1,1,0,0,1,1,0,0,0,0,0,0,1,0,0,1,0,0,1,1,0,0]), new Float32Array([1,0,0,1,1,0,0,0,1,1,0,0,0,0,1,0,0,1,1,1,0,1,1,0,0,0,1,0,0,1,0,0,1,1,0,0,1,1,0,1,0,0,0,0,1]), new Float32Array([0,0,0,0,0,1,1,1,0,0,0,0,1,1,0,1,1,0,0,0,1,0,0,1,1,1,0,1,1,0,1,1,0,0,0,0,0,0,1,0,0,0,1,1,0]), new Float32Array([1,1,0,1,1,0,1,1,0,0,0,1,0,0,1,0,0,1]), new Float32Array([0,0,1,0,1,0,0,0,1,1,0,0,0,1,0,0,0,1,1,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,1,0]), new Float32Array([1,0,0,0,0,1,0,0,1,1,0,0,0,1,0,0,0,1,1,0,0,1,0,0,0,1,0,0,1,0,0,1,0,1,0,0,1,0,0,0,0,1,0,1,0]), new Float32Array([0,1,0,0,0,1,0,0,1,0,1,0,0,0,1,0,1,0,0,1,0,0,0,1,0,0,0]), new Float32Array([0,1,0,0,0,1,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,1,0,0,0,1]), new Float32Array([0,0,1,1,0,0,1,0,0,0,0,1,1,0,0,0,0,1,0,0,1,1,0,0,0,0,0]), new Float32Array([0,0,1,1,0,0,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,0,0,1,1,0,0]), new Float32Array([0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0]), new Float32Array([0,0,1,0,0,1,0,0,1]), new Float32Array([1,0,0,1,1,0,0,0,0,1,1,0,0,1,0,0,0,0]), new Float32Array([0,1,0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0,1,0,0,1,1,0]), new Float32Array([0,0,0,1,1,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,1,0]), new Float32Array([0,1,0,1,1,0,1,1,0,0,1,0,0,1,0,1,1,0]), new Float32Array([1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,1,1,0,0,0,0,1,0,0]), new Float32Array([1,0,0,1,1,0,1,1,0,1,0,0,1,0,0,1,1,0]), new Float32Array([1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,1,1,0,0,0,0]), new Float32Array([1,1,0,1,1,0,1,1,0]), new Float32Array([1,0,0,0,1,0,0,1,0,1,0,0,0,1,0,1,0,0,1,0,0,0,1,0,0,0,0]), new Float32Array([0,1,0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0,1,0,0]), new Float32Array([0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0]), new Float32Array([0,1,0,0,1,0,0,1,0]), new Float32Array([1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0]), new Float32Array([1,0,0,1,0,0,1,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0]), new Float32Array([])];
var normalTable = [new Float32Array([]), new Float32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1]), new Float32Array([0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1]), new Float32Array([-1,1,-1,-1,1,-1,-1,1,-1]), new Float32Array([-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,-1,1,-1,-1,1,-1,-1,1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([1,1,-1,1,1,-1,1,1,-1]), new Float32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,1,1,-1,1,1,-1,1,1,-1]), new Float32Array([1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,1,-1,-1,1,-1,-1,1,-1,-1,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,-1,-1,1,-1,-1,1,-1,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,1,1,-1,1,1,-1,1,1,-1,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([-1,-1,1,-1,-1,1,-1,-1,1]), new Float32Array([-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1,1,-1,-1,1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([-1,-1,1,-1,-1,1,-1,-1,1,-1,1,-1,-1,1,-1,-1,1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,-1,0,0,-1,0,0]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1,1,-1,-1,1,-1,1,-1,-1,1,-1,-1,1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0]), new Float32Array([1,1,-1,1,1,-1,1,1,-1,-1,-1,1,-1,-1,1,-1,-1,1]), new Float32Array([-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,1,1,-1,1,1,-1,1,1,-1]), new Float32Array([1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,-1,-1,1,-1,-1,1,-1,-1,1]), new Float32Array([1,0,-1,1,0,-1,1,0,-1,-1,-1,0,-1,-1,0,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,-1,-1,1,-1,-1,1,-1,-1,1]), new Float32Array([0,1,-1,0,1,-1,0,1,-1,-1,-1,0,-1,-1,0,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([-1,-1,1,-1,-1,1,-1,-1,1,1,1,-1,1,1,-1,1,1,-1,0,0,-1,0,0,-1,0,0,-1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([1,-1,1,1,-1,1,1,-1,1]), new Float32Array([1,-1,1,1,-1,1,1,-1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1]), new Float32Array([1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,-1,-1,1,-1,-1,1,-1,-1,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([1,-1,1,1,-1,1,1,-1,1,-1,1,-1,-1,1,-1,-1,1,-1]), new Float32Array([-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,1,-1,1,1,-1,1,1,-1,1]), new Float32Array([1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,-1,1,-1,-1,1,-1,-1,1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,1,-1,0,1,-1,0,1,-1,0,-1,0,-1,-1,0,-1,-1,0,-1,0,0,0,0,0,0,0,0,0]), new Float32Array([1,1,-1,1,1,-1,1,1,-1,1,-1,1,1,-1,1,1,-1,1]), new Float32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,1,1,-1,1,1,-1,1,1,-1,1,-1,1,1,-1,1,1,-1,1]), new Float32Array([0,0,0,0,0,0,0,0,0,1,-1,-1,1,-1,-1,1,-1,-1,1,0,0,1,0,0,1,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,-1,1,-1,-1,1,-1,-1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,1,-1,1,1,-1,1,1,-1,1]), new Float32Array([1,-1,1,1,-1,1,1,-1,1,0,0,0,0,0,0,0,0,0,-1,1,-1,-1,1,-1,-1,1,-1,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([1,-1,0,1,-1,0,1,-1,0,0,1,-1,0,1,-1,0,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,-1,1,-1,-1,1,-1,-1,1,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,-1,1,1,-1,1,1,-1,1,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,-1,1,-1,-1,1,-1,-1,1,-1]), new Float32Array([0,-1,1,0,-1,1,0,-1,1,-1,0,-1,-1,0,-1,-1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([-1,1,-1,-1,1,-1,-1,1,-1,0,0,0,0,0,0,0,0,0,1,-1,1,1,-1,1,1,-1,1,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,1,1,-1,1,1,-1,1,1,-1]), new Float32Array([1,1,-1,1,1,-1,1,1,-1,0,0,0,0,0,0,0,0,0,-1,-1,1,-1,-1,1,-1,-1,1,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,0,-1,1,0,-1,1,0,-1,0,-1,1,0,-1,1,0,-1,1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1]), new Float32Array([0,-1,1,0,-1,1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,0,1,-1,0,1,-1]), new Float32Array([0,1,-1,0,1,-1,0,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,-1,1,0,-1,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([-1,1,1,-1,1,1,-1,1,1]), new Float32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,-1,-1,1,-1,-1,1,-1,-1,0,0,-1,0,0,-1,0,0]), new Float32Array([-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,1,-1,-1,1,-1,-1,1,-1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,0,-1,1,0,-1,1,0,0,-1,-1,0,-1,-1,0,-1,-1,0,0,0,0,0,0,0,0,0]), new Float32Array([1,1,-1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([1,1,-1,1,1,-1,1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([-1,1,1,-1,1,1,-1,1,1,0,0,0,0,0,0,0,0,0,1,-1,-1,1,-1,-1,1,-1,-1,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,-1,-1,1,-1,-1,1,-1,0,1,0,0,1,0,0,1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,-1,-1,1,-1,-1,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,0,-1,1,0,-1,1,0,1,0,-1,1,0,-1,1,0,-1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,-1,1,-1,-1,1,-1,-1,1,-1,0,0,-1,0,0,-1,0,0]), new Float32Array([-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,1,-1,-1,1,-1,-1,1,-1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,0,1,-1,0,1,-1,0,1,0,-1,-1,0,-1,-1,0,-1,-1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,1,-1,1,1,-1,1,1,-1,0,0,-1,0,0,-1,0,0]), new Float32Array([-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,-1,1,1,-1,0,0,-1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1,0,0]), new Float32Array([-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,1,1,-1,1,1,-1,1,1,-1]), new Float32Array([1,1,-1,1,1,-1,1,1,-1,0,0,0,0,0,0,0,0,0,-1,-1,1,-1,-1,1,-1,-1,1,-1,0,0,-1,0,0,-1,0,0]), new Float32Array([-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1]), new Float32Array([1,0,-1,1,0,-1,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,1,-1,0,1,-1,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,1,-1,0,1,-1,0,1,-1,-1,0,1,-1,0,1,-1,0,1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1,0,0]), new Float32Array([-1,0,1,-1,0,1,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,1,0,-1,1,0,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,-1,1,1,-1,1,1,-1,1,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,1,-1,1,1,-1,1,1,-1,1,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([-1,1,1,-1,1,1,-1,1,1,0,0,0,0,0,0,0,0,0,1,-1,-1,1,-1,-1,1,-1,-1,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,1,-1,1,1,-1,1,1,-1,1]), new Float32Array([1,-1,1,1,-1,1,1,-1,1,-1,1,-1,-1,1,-1,-1,1,-1,-1,0,0,-1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,-1,1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0,1,-1,0]), new Float32Array([-1,1,0,-1,1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,0,1,-1,0,1,-1,0]), new Float32Array([1,-1,1,1,-1,1,1,-1,1,1,1,-1,1,1,-1,1,1,-1,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([-1,1,1,-1,1,1,-1,1,1,1,1,-1,1,1,-1,1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,1,-1,1,1,-1,1,1,-1,1]), new Float32Array([-1,1,1,-1,1,1,-1,1,1,0,0,0,0,0,0,0,0,0,1,-1,-1,1,-1,-1,1,-1,-1,1,0,0,1,0,0,1,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,-1,-1,1,-1,-1,1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,1,-1,1,1,-1,1,1]), new Float32Array([1,-1,1,1,-1,1,1,-1,1,0,0,0,0,0,0,0,0,0,-1,1,-1,-1,1,-1,-1,1,-1,0,1,0,0,1,0,0,1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,-1,-1,1,-1,-1,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,1,1,-1,1,1,-1,1]), new Float32Array([1,-1,0,1,-1,0,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,-1,1,0,-1,1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,-1,1,-1,-1,1,-1,-1,1,0,0,1,0,0,1,0,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,-1,1,-1,-1,1,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,0,1,-1,0,1,-1,0,1,1,-1,0,1,-1,0,1,-1,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([0,-1,1,0,-1,1,0,-1,1,-1,1,0,-1,1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1,0,0]), new Float32Array([1,-1,0,1,-1,0,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,-1,1,0,-1,1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,1,-1,1,1,-1,1,1,-1,-1,-1,1,-1,-1,1,-1,-1,1,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,-1,1,-1,-1,1,-1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,-1,1,1,-1,1,1,-1]), new Float32Array([-1,0,1,-1,0,1,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,-1,1,0,-1,1,0,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,1,-1,0,1,-1,0,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,0,-1,1,0,-1,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0]), new Float32Array([1,1,1,1,1,1,1,1,1]), new Float32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,1,1,1,1,1,1,1,1,1]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,1,1,1,1,1,1,1,1,1]), new Float32Array([0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,1,1,1,1,1,1,1,1,1]), new Float32Array([-1,1,-1,-1,1,-1,-1,1,-1,1,1,1,1,1,1,1,1,1]), new Float32Array([-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,1,1,1,1,1,1,1,1,1]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,-1,1,-1,-1,1,-1,-1,1,-1,1,1,1,1,1,1,1,1,1]), new Float32Array([1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0]), new Float32Array([1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,-1,-1,-1,-1,-1,-1,-1,-1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,1,1,-1,1,1,-1,1,1,-1,1,0,0,1,0,0,1,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,-1,-1,0,-1,-1,0,-1,-1,1,1,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,1,-1,1,1,-1,1,1,-1,0,1,0,0,1,0,0,1,0]), new Float32Array([-1,0,-1,-1,0,-1,-1,0,-1,1,1,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,-1,1,1,-1,1,1,-1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1]), new Float32Array([1,1,1,1,1,1,1,1,1,-1,-1,1,-1,-1,1,-1,-1,1]), new Float32Array([-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,1,1,1,1,1,1,1,1,1]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,1,1,1,1,1,1,1,1,1,-1,-1,1,-1,-1,1,-1,-1,1]), new Float32Array([1,1,1,1,1,1,1,1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,-1,0,0,-1,0,0,-1,0,0,0,0,0,0,0,0,0,0]), new Float32Array([-1,1,-1,-1,1,-1,-1,1,-1,-1,-1,1,-1,-1,1,-1,-1,1,1,1,1,1,1,1,1,1,1]), new Float32Array([1,1,1,1,1,1,1,1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,-1,0,0,-1,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,-1,-1,1,-1,-1,1,-1,-1,1,-1,1,-1,-1,1,-1,-1,1,-1,1,1,1,1,1,1,1,1,1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1]), new Float32Array([1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,-1,-1,1,-1,-1,1,-1,-1,1]), new Float32Array([1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0]), new Float32Array([-1,-1,1,-1,-1,1,-1,-1,1,0,0,0,0,0,0,0,0,0,1,1,-1,1,1,-1,1,1,-1,1,0,0,1,0,0,1,0,0]), new Float32Array([-1,-1,0,-1,-1,0,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,1,1,0]), new Float32Array([-1,-1,1,-1,-1,1,-1,-1,1,1,1,-1,1,1,-1,1,1,-1,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,1,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,0,-1,-1,0,-1,-1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,1,-1,1,1,-1,1,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,1,-1,-1,1,-1,-1,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1]), new Float32Array([1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,-1,-1,-1,-1,-1,-1,-1,-1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,1,-1,1,1,-1,1,1,-1,1,1,0,0,1,0,0,1,0,0]), new Float32Array([0,-1,-1,0,-1,-1,0,-1,-1,1,0,1,1,0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,-1,1,-1,-1,1,-1,-1,1,-1]), new Float32Array([-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1]), new Float32Array([-1,1,-1,-1,1,-1,-1,1,-1,1,-1,1,1,-1,1,1,-1,1,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,0,1,1,0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,-1,-1,0,-1,-1,0,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,1,0,0,1,0,0]), new Float32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,1,0,0,1,0,0]), new Float32Array([1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0]), new Float32Array([1,0,1,1,0,1,1,0,1,0,1,-1,0,1,-1,0,1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([-1,0,-1,-1,0,-1,-1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,1,0,1,1,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,-1,1,1,-1,1,1,-1,1,0,0,1,0,0,1,0,0,1]), new Float32Array([-1,-1,0,-1,-1,0,-1,-1,0,1,0,1,1,0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,1,1,-1,1,1,-1,1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1,0]), new Float32Array([-1,1,-1,-1,1,-1,-1,1,-1,1,-1,1,1,-1,1,1,-1,1,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0]), new Float32Array([-1,0,-1,-1,0,-1,-1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,1,0,1,1,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,1,-1,1,1,-1,1,1,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,1,-1,-1,1,-1,-1,1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,1,0,1,1,0,1,1,0,0,-1,1,0,-1,1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,1,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,0,-1,-1,0,-1,-1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,-1,1,0,-1,1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,0,1,-1,0,1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0]), new Float32Array([0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1]), new Float32Array([0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,-1,-1,-1,-1,-1,-1,-1,-1,-1]), new Float32Array([0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,1,-1,-1,1,-1,-1,1,-1,-1]), new Float32Array([0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,1,1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1,0,-1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,1,-1,1,1,-1,1,1,0,1,0,0,1,0,0,1,0]), new Float32Array([-1,0,-1,-1,0,-1,-1,0,-1,0,1,1,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,-1,1,1,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,-1,-1,0,-1,-1,0,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,1,1]), new Float32Array([0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,1,0,0,1,0,0,1,0]), new Float32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,1,1,1,1,1,1,1,1,1,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,1,1,1,0,-1,1,0,-1,1,0,-1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,1,1,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,0,-1,-1,0,-1,-1]), new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,1,-1,1,1,-1,1,1,0,0,1,0,0,1,0,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,-1,0,-1,-1,0,-1,-1,0,0,1,1,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0]), new Float32Array([1,-1,-1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,-1,1,1,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0]), new Float32Array([0,1,1,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,0,-1,-1,0,-1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,1,-1,1,1,-1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,0,-1,0,0,-1,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,-1,1,1,-1,1,1,-1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,-1,1,-1,-1,1,-1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,1,0,1,1,0,1,1,0,-1,0,1,-1,0,1,-1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([-1,-1,0,-1,-1,0,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,1,1,0]), new Float32Array([1,0,-1,1,0,-1,1,0,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,1,-1,0,1,-1,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,1,0,0,1,0,0,1]), new Float32Array([-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,1,0,0,1,0,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,1,1,1,-1,0,1,-1,0,1,-1,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,-1,-1,0,-1,-1,0,-1,-1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,1,1]), new Float32Array([0,0,0,0,0,0,0,0,0,1,0,1,1,0,1,1,0,1,-1,1,0,-1,1,0,-1,1,0,0,0,0,0,0,0,0,0,0]), new Float32Array([1,0,1,1,0,1,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,0,-1,-1,0,-1,-1,0,-1]), new Float32Array([-1,1,0,-1,1,0,-1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,-1,0,1,-1,0,1,-1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0]), new Float32Array([0,0,0,0,0,0,0,0,0]), new Float32Array([])];
var geoLengthTable = geoTable.map(function(a) { return a.length });

var fillVertexArrays = function(geoIndices, vertices, normals, dims, bounds) {
	var idx, verts, norms;
	var x, y, z;
	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];
	var zStride = width * height;
	var yStride = width;
	ex--; ey--; ez--;

	var i=0, j=0, k=0, w=0, u=0, vl=0;
	// March over the volume
	for (z=sz; z<ez; z++) {
		for (y=sy; y<ey; y++) {
			for (x=sx; x<ex; x++, j++) {

				idx = geoIndices[j];
				verts = geoTable[idx];
				norms = normalTable[idx];

				vl = verts.length;

				for (i=0,u=0; i<vl;) {

					normals[w++] = norms[u++];
					normals[w++] = norms[u++];
					normals[w++] = norms[u++];

					normals[w++] = norms[u++];
					normals[w++] = norms[u++];
					normals[w++] = norms[u++];

					normals[w++] = norms[u++];
					normals[w++] = norms[u++];
					normals[w++] = norms[u++];

					vertices[k++] = verts[i++] + x;
					vertices[k++] = verts[i++] + y;
					vertices[k++] = verts[i++] + z;

					vertices[k++] = verts[i++] + x;
					vertices[k++] = verts[i++] + y;
					vertices[k++] = verts[i++] + z;

					vertices[k++] = verts[i++] + x;
					vertices[k++] = verts[i++] + y;
					vertices[k++] = verts[i++] + z;

				}
			}
		}
	}
}


var buildGeoIndices = function(geoIndices, data, dims, bounds) {
	var x, y, z;
	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];
	var zStride = width * height;
	var yStride = width;
	ex--; ey--; ez--;
	var ex4 = ex-4;

	var vertexCount = 0;
	var n = 0;

	var zOff, yOff00, yOff01, yOff10, yOff11;
	var s1, s3, s5, s7;
	var c0, c1, c2, c3;

	// March over the volume
	for (z=sz; z<ez; z++) {
		zOff = z * zStride;
		for (y=sy; y<ey; y++) {
			yOff00 = zOff + y * yStride + sx;
			yOff01 = yOff00 + yStride;
			yOff10 = yOff00 + zStride;
			yOff11 = yOff01 + zStride;

			// For each cell, compute cube index

			s1 = data[yOff00++];
			s3 = data[yOff01++];
			s5 = data[yOff10++];
			s7 = data[yOff11++];

			for (x=sx; x<ex4; x+=4, n+=4) {
				c0 = 0, c1 = 0, c2 = 0, c3 = 0;

				c0 += s1*1;
				c0 += s3*4;
				c0 += s5*16;
				c0 += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				c0 += s1*2;
				c0 += s3*8;
				c0 += s5*32;
				c0 += s7*128;

				c1 += s1*1;
				c1 += s3*4;
				c1 += s5*16;
				c1 += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				c1 += s1*2;
				c1 += s3*8;
				c1 += s5*32;
				c1 += s7*128;

				c2 += s1*1;
				c2 += s3*4;
				c2 += s5*16;
				c2 += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				c2 += s1*2;
				c2 += s3*8;
				c2 += s5*32;
				c2 += s7*128;

				c3 += s1*1;
				c3 += s3*4;
				c3 += s5*16;
				c3 += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				c3 += s1*2;
				c3 += s3*8;
				c3 += s5*32;
				c3 += s7*128;

				geoIndices[n+0] = c0;
				geoIndices[n+1] = c1;
				geoIndices[n+2] = c2;
				geoIndices[n+3] = c3;

				vertexCount += geoLengthTable[c0];
				vertexCount += geoLengthTable[c1];
				vertexCount += geoLengthTable[c2];
				vertexCount += geoLengthTable[c3];
			}
			for (; x<ex; x++, n++) {
				c0 = 0, c1 = 0, c2 = 0, c3 = 0;

				c0 += s1*1;
				c0 += s3*4;
				c0 += s5*16;
				c0 += s7*64;
				s1 = data[yOff00++];
				s3 = data[yOff01++];
				s5 = data[yOff10++];
				s7 = data[yOff11++];
				c0 += s1*2;
				c0 += s3*8;
				c0 += s5*32;
				c0 += s7*128;

				geoIndices[n+0] = c0;
				vertexCount += geoLengthTable[c0];
			}
		}
	}

	return vertexCount;
}

function munchData(data, isoMin, isoMax) {
	if (data2.length < data.length) {
		data2 = new Uint8Array(data.length);
	}
	var i = 0, s = 0, dl8 = data.length - 8;
	for (i = 0; i < dl8; i += 8) {
		data2[i+0] = (data[i+0] >= isoMin && data[i+0] <= isoMax) ? 1 : 0;
		data2[i+1] = (data[i+1] >= isoMin && data[i+1] <= isoMax) ? 1 : 0;
		data2[i+2] = (data[i+2] >= isoMin && data[i+2] <= isoMax) ? 1 : 0;
		data2[i+3] = (data[i+3] >= isoMin && data[i+3] <= isoMax) ? 1 : 0;
		data2[i+4] = (data[i+4] >= isoMin && data[i+4] <= isoMax) ? 1 : 0;
		data2[i+5] = (data[i+5] >= isoMin && data[i+5] <= isoMax) ? 1 : 0;
		data2[i+6] = (data[i+6] >= isoMin && data[i+6] <= isoMax) ? 1 : 0;
		data2[i+7] = (data[i+7] >= isoMin && data[i+7] <= isoMax) ? 1 : 0;
	}
	for (; i < data.length; i++) {
		data2[i+0] = (data[i+0] >= isoMin && data[i+0] <= isoMax) ? 1 : 0;
	}
}


var data2 = new Uint8Array(1000000);
var geoIndices = new Uint8Array(1000000);

exports.marchingCubes = function(dims, data, isoMin, isoMax, bounds) {
	if (LOG_TIMINGS) {
		console.log('---');
		console.time('marchingCubes');
	}
	if (!bounds) {
		bounds = [[0,0,0], dims];
	}

	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];

	if (LOG_TIMINGS) {
		console.time("Munch data");
	}

	munchData(data, isoMin, isoMax);

	if (LOG_TIMINGS) {
		console.timeEnd("Munch data");

		console.time("construct cube indices");
	}

	var geoIndicesLength = (ez-sz-1)*(ey-sy-1)*(ex-sx-1);
	if (geoIndices.length < geoIndicesLength) {
		geoIndices = new Uint8Array(geoIndicesLength);
	}
	var vertexCount = buildGeoIndices(geoIndices, data2, dims, bounds);

	if (LOG_TIMINGS) {
		console.timeEnd("construct cube indices");

		console.time("Fill vertex arrays");
	}

	var vertices = new Float32Array(vertexCount);
	var normals = new Float32Array(vertexCount);
	fillVertexArrays(geoIndices, vertices, normals, dims, bounds);

	if (LOG_TIMINGS) {
		console.timeEnd("Fill vertex arrays");

		console.timeEnd('marchingCubes');
	}
	return {vertices: vertices, normals: normals};
};

exports.marchingCubeCapX = function(dims, data, isoMin, isoMax, bounds, dir) {
	var capX = dir === -1 ? bounds[0][0] : bounds[1][0]-1;
	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];

	var bw = 2;
	var bh = ey-sy;
	var bd = ez-sz;

	var off1 = 0, off2 = 1;
	if (dir === -1) {
		off1 = 1;
		off2 = 0;
	}

	var dataSlice = new Uint8Array(bw * bh * bd);
	var zStride = width * height;
	for (var z=sz,dz=0; z<ez; z++,dz++) {
		for (var y=sy,dy=0; y<ey; y++,dy++) {
			var off = z * zStride + y * width;
			var v = data[off + capX];
			dataSlice[off1 + dz*bw*bh + dy*bw] = 0;
			dataSlice[off2 + dz*bw*bh + dy*bw] = (v >= isoMin && v <= isoMax) ? 1 : 0;
		}
	}

	var sliceDims = [bw, bh, bd];
	var bounds = [[0,0,0], sliceDims];
	var geoIndicesLength = (bd-1)*(bh-1)*(bw-1);
	if (geoIndices.length < geoIndicesLength) {
		geoIndices = new Uint8Array(geoIndicesLength);
	}
	var vertexCount = buildGeoIndices(geoIndices, dataSlice, sliceDims, bounds);

	var vertices = new Float32Array(vertexCount);
	var normals = new Float32Array(vertexCount);
	fillVertexArrays(geoIndices, vertices, normals, dims, bounds);
	for (var i=0; i<vertices.length; i+=3) {
		vertices[i] = capX;
		vertices[i+1] += sy;
		vertices[i+2] += sz;
		normals[i] = dir;
		normals[i+1] = 0;
		normals[i+2] = 0;
	}

	return {vertices: vertices, normals: normals};
}

exports.marchingCubeCapY = function(dims, data, isoMin, isoMax, bounds, dir) {
	var capY = dir === -1 ? bounds[0][1] : bounds[1][1]-1;
	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];

	var bw = ex-sx;
	var bh = 2;
	var bd = ez-sz;

	var off1 = 0, off2 = bw;
	if (dir === -1) {
		off1 = bw;
		off2 = 0;
	}

	var dataSlice = new Uint8Array(bw * bh * bd);
	var zStride = width * height;
	for (var z=sz,dz=0; z<ez; z++,dz++) {
		for (var x=sx,dx=0; x<ex; x++,dx++) {
			var off = z * zStride + x;
			var v = data[off + width*capY];
			dataSlice[off1 + dz*bw*bh + dx] = 0;
			dataSlice[off2 + dz*bw*bh + dx] = (v >= isoMin && v <= isoMax) ? 1 : 0;
		}
	}

	var sliceDims = [bw, bh, bd];
	var bounds = [[0,0,0], sliceDims];
	var geoIndicesLength = (bd-1)*(bh-1)*(bw-1);
	if (geoIndices.length < geoIndicesLength) {
		geoIndices = new Uint8Array(geoIndicesLength);
	}
	var vertexCount = buildGeoIndices(geoIndices, dataSlice, sliceDims, bounds);

	var vertices = new Float32Array(vertexCount);
	var normals = new Float32Array(vertexCount);
	fillVertexArrays(geoIndices, vertices, normals, dims, bounds);
	for (var i=0; i<vertices.length; i+=3) {
		vertices[i] += sx;
		vertices[i+1] = capY;
		vertices[i+2] += sz;
		normals[i] = 0;
		normals[i+1] = dir;
		normals[i+2] = 0;
	}

	return {vertices: vertices, normals: normals};
}

exports.marchingCubeCapZ = function(dims, data, isoMin, isoMax, bounds, dir) {
	var capZ = dir === -1 ? bounds[0][2] : bounds[1][2]-1;
	var width = dims[0], height = dims[1], depth = dims[2];
	var sx = bounds[0][0], sy = bounds[0][1], sz = bounds[0][2];
	var ex = bounds[1][0], ey = bounds[1][1], ez = bounds[1][2];

	var bw = ex-sx;
	var bh = ey-sy;
	var bd = 2;

	var off1 = 0, off2 = bh*bw;
	if (dir === -1) {
		off1 = bh*bw;
		off2 = 0;
	}

	var dataSlice = new Uint8Array(bw * bh * bd);
	var zStride = width * height;
	for (var y=sy,dy=0; y<ey; y++,dy++) {
		for (var x=sx,dx=0; x<ex; x++,dx++) {
			var off = y * width + x;
			var v = data[off + zStride*capZ];
			dataSlice[off1 + dy*bw + dx] = 0;
			dataSlice[off2 + dy*bw + dx] = (v >= isoMin && v <= isoMax) ? 1 : 0;
		}
	}

	var sliceDims = [bw, bh, bd];
	var bounds = [[0,0,0], sliceDims];
	var geoIndicesLength = (bd-1)*(bh-1)*(bw-1);
	if (geoIndices.length < geoIndicesLength) {
		geoIndices = new Uint8Array(geoIndicesLength);
	}
	var vertexCount = buildGeoIndices(geoIndices, dataSlice, sliceDims, bounds);

	var vertices = new Float32Array(vertexCount);
	var normals = new Float32Array(vertexCount);
	fillVertexArrays(geoIndices, vertices, normals, dims, bounds);
	for (var i=0; i<vertices.length; i+=3) {
		vertices[i] += sx;
		vertices[i+1] += sy;
		vertices[i+2] = capZ;
		normals[i] = 0;
		normals[i+1] = 0;
		normals[i+2] = dir;
	}

	return {vertices: vertices, normals: normals};
}

exports.concatMeshes = function() {
	if (LOG_TIMINGS) {
		console.time('concatMeshes');
	}
	var len = 0;
	for (var i=0; i<arguments.length; i++) {
		len += arguments[i].vertices.length;
	}
	var vertices = new Float32Array(len);
	var normals = new Float32Array(len);
	var count = 0;
	for (var i=0; i<arguments.length; i++) {
		var mesh = arguments[i];
		var v = mesh.vertices;
		var n = mesh.normals;
		vertices.set(v, count);
		normals.set(n, count);
		count += v.length;
	}
	if (LOG_TIMINGS) {
		console.timeEnd('concatMeshes');
	}
	return {vertices: vertices, normals: normals};
}

exports.marchingCubesCaps = function(dims, data, isoMin, isoMax, bounds) {
	if (LOG_TIMINGS) {
		console.time('isoCaps');
	}
	var mesh = exports.concatMeshes(
		exports.marchingCubeCapX(dims, data, isoMin, isoMax, bounds, -1),
		exports.marchingCubeCapX(dims, data, isoMin, isoMax, bounds, 1),
		exports.marchingCubeCapY(dims, data, isoMin, isoMax, bounds, -1),
		exports.marchingCubeCapY(dims, data, isoMin, isoMax, bounds, 1),
		exports.marchingCubeCapZ(dims, data, isoMin, isoMax, bounds, -1),
		exports.marchingCubeCapZ(dims, data, isoMin, isoMax, bounds, 1)
	);
	if (LOG_TIMINGS) {
		console.timeEnd('isoCaps');
	}
	return mesh;
};

exports.smoothNormals = function(mesh) {
	var vertices = mesh.vertices, normals = mesh.normals;
	if (LOG_TIMINGS) {
		console.time('computeVertexNormals');
	}
	computeVertexNormals(vertices, normals, normals);
	if (LOG_TIMINGS) {
		console.timeEnd('computeVertexNormals');
	}
	return mesh;
};

exports.meshConvert = function(mesh, data, dims, vertexIntensityBounds, meshgrid) {
	if (LOG_TIMINGS) {
		console.time('meshConvert');
	}
	var vertices = mesh.vertices, normals = mesh.normals;
	var w = dims[0], h = dims[1], d = dims[2];
	var vertexIntensity = new Float32Array(vertices.length / 3);
	if (meshgrid) {
		for (var j = 0, i = 0; j < vertices.length; j+=3, i++) {
			var x = meshgrid[0][vertices[j]];
			var y = meshgrid[1][vertices[j+1]];
			var z = meshgrid[2][vertices[j+2]];
			vertexIntensity[i] = data[z*h*w + y*w + x];
		}
	} else {
		for (var j = 0, i = 0; j < vertices.length; j+=3, i++) {
			var x = vertices[j];
			var y = vertices[j+1];
			var z = vertices[j+2];
			vertexIntensity[i] = data[z*h*w + y*w + x];
		}
	}
	var geo = {
		positions: vertices,
		vertexNormals: normals,
		vertexIntensity: vertexIntensity,
		vertexIntensityBounds: vertexIntensityBounds
	};
	if (LOG_TIMINGS) {
		console.timeEnd('meshConvert');
	}
	return geo;
};

},{"./lib/computeVertexNormals":9,"./lib/trimesh":11}],8:[function(require,module,exports){
'use strict'

var barycentric            = require('barycentric')
var closestPointToTriangle = require('polytope-closest-point/lib/closest_point_2d.js')

module.exports = closestPointToPickLocation

function xformMatrix(m, v) {
  var out = [0,0,0,0]
  for(var i=0; i<4; ++i) {
    for(var j=0; j<4; ++j) {
      out[j] += m[4*i + j] * v[i]
    }
  }
  return out
}

function projectVertex(v, model, view, projection, resolution) {
  var p = xformMatrix(projection,
            xformMatrix(view,
              xformMatrix(model, [v[0], v[1], v[2], 1])))
  for(var i=0; i<3; ++i) {
    p[i] /= p[3]
  }
  return [ 0.5 * resolution[0] * (1.0+p[0]), 0.5 * resolution[1] * (1.0-p[1]) ]
}

function barycentricCoord(simplex, point) {
  if(simplex.length === 2) {
    var d0 = 0.0
    var d1 = 0.0
    for(var i=0; i<2; ++i) {
      d0 += Math.pow(point[i] - simplex[0][i], 2)
      d1 += Math.pow(point[i] - simplex[1][i], 2)
    }
    d0 = Math.sqrt(d0)
    d1 = Math.sqrt(d1)
    if(d0+d1 < 1e-6) {
      return [1,0]
    }
    return [d1/(d0+d1),d0/(d1+d0)]
  } else if(simplex.length === 3) {
    var closestPoint = [0,0]
    closestPointToTriangle(simplex[0], simplex[1], simplex[2], point, closestPoint)
    return barycentric(simplex, closestPoint)
  }
  return []
}

function interpolate(simplex, weights) {
  var result = [0,0,0]
  for(var i=0; i<simplex.length; ++i) {
    var p = simplex[i]
    var w = weights[i]
    for(var j=0; j<3; ++j) {
      result[j] += w * p[j]
    }
  }
  return result
}

function closestPointToPickLocation(simplex, pixelCoord, model, view, projection, resolution) {
  if(simplex.length === 1) {
    return [0, simplex[0].slice()]
  }
  var simplex2D = new Array(simplex.length)
  for(var i=0; i<simplex.length; ++i) {
    simplex2D[i] = projectVertex(simplex[i], model, view, projection, resolution);
  }

  var closestIndex = 0
  var closestDist  = Infinity
  for(var i=0; i<simplex2D.length; ++i) {
    var d2 = 0.0
    for(var j=0; j<2; ++j) {
      d2 += Math.pow(simplex2D[i][j] - pixelCoord[j], 2)
    }
    if(d2 < closestDist) {
      closestDist  = d2
      closestIndex = i
    }
  }

  var weights = barycentricCoord(simplex2D, pixelCoord)
  var s = 0.0
  for(var i=0; i<3; ++i) {
    if(weights[i] < -0.001 ||
       weights[i] > 1.0001) {
      return null
    }
    s += weights[i]
  }
  if(Math.abs(s - 1.0) > 0.001) {
    return null
  }
  return [closestIndex, interpolate(simplex, weights), weights]
}
},{"barycentric":17,"polytope-closest-point/lib/closest_point_2d.js":177}],9:[function(require,module,exports){
"use strict";

exports.computeVertexNormals = function(vertices, normals, dst) {
	if (dst === undefined) {
		dst = new Float32Array(normals.length);
	}
	var vertexNormals = {};
	for (var i=0; i<vertices.length; i+=3) {
		var key = (vertices[i+2] << 20) + (vertices[i+1] << 10) + vertices[i];
		if (vertexNormals[key] === undefined) {
			vertexNormals[key] = [0,0,0];
		}
		var nml = vertexNormals[key];
		nml[0] += normals[i];
		nml[1] += normals[i+1];
		nml[2] += normals[i+2];
	}
	for (var i=0; i<vertices.length; i+=3) {
		var key = (vertices[i+2] << 20) + (vertices[i+1] << 10) + vertices[i];
		var nml = vertexNormals[key];
		dst[i] = nml[0];
		dst[i+1] = nml[1];
		dst[i+2] = nml[2];
	}
	return dst;
};
},{}],10:[function(require,module,exports){


var triVertSrc = "precision mediump float;\n#define GLSLIFY 1\n\nattribute vec3 position, normal;\nattribute vec2 uv;\n\nuniform mat4 model\n           , view\n           , projection;\nuniform vec3 eyePosition\n           , lightPosition;\n\nvarying vec3 f_normal\n           , f_lightDirection\n           , f_eyeDirection\n           , f_data;\nvarying vec2 f_uv;\n\nvoid main() {\n  vec4 m_position  = model * vec4(position, 1.0);\n  vec4 t_position  = view * m_position;\n  gl_Position      = projection * t_position;\n  f_normal         = normal;\n  f_data           = position;\n  f_eyeDirection   = eyePosition   - position;\n  f_lightDirection = lightPosition - position;\n  f_uv             = uv;\n}"
var triFragSrc = "precision mediump float;\n#define GLSLIFY 1\n\nfloat beckmannDistribution_2_0(float x, float roughness) {\n  float NdotH = max(x, 0.0001);\n  float cos2Alpha = NdotH * NdotH;\n  float tan2Alpha = (cos2Alpha - 1.0) / cos2Alpha;\n  float roughness2 = roughness * roughness;\n  float denom = 3.141592653589793 * roughness2 * cos2Alpha * cos2Alpha;\n  return exp(tan2Alpha / roughness2) / denom;\n}\n\n\n\nfloat cookTorranceSpecular_1_1(\n  vec3 lightDirection,\n  vec3 viewDirection,\n  vec3 surfaceNormal,\n  float roughness,\n  float fresnel) {\n\n  float VdotN = max(dot(viewDirection, surfaceNormal), 0.0);\n  float LdotN = max(dot(lightDirection, surfaceNormal), 0.0);\n\n  //Half angle vector\n  vec3 H = normalize(lightDirection + viewDirection);\n\n  //Geometric term\n  float NdotH = max(dot(surfaceNormal, H), 0.0);\n  float VdotH = max(dot(viewDirection, H), 0.000001);\n  float LdotH = max(dot(lightDirection, H), 0.000001);\n  float G1 = (2.0 * NdotH * VdotN) / VdotH;\n  float G2 = (2.0 * NdotH * LdotN) / LdotH;\n  float G = min(1.0, min(G1, G2));\n  \n  //Distribution term\n  float D = beckmannDistribution_2_0(NdotH, roughness);\n\n  //Fresnel term\n  float F = pow(1.0 - VdotN, fresnel);\n\n  //Multiply terms and done\n  return  G * F * D / max(3.14159265 * VdotN, 0.000001);\n}\n\n\n\nuniform vec3 clipBounds[2];\nuniform float roughness\n            , fresnel\n            , kambient\n            , kdiffuse\n            , kspecular\n            , opacity;\nuniform sampler2D texture;\n\nvarying vec3 f_normal\n           , f_lightDirection\n           , f_eyeDirection\n           , f_data;\nvarying vec2 f_uv;\n\nvoid main() {\n  if(any(lessThan(f_data, clipBounds[0])) || \n     any(greaterThan(f_data, clipBounds[1]))) {\n    discard;\n  }\n\n  vec3 N = normalize(f_normal);\n  vec3 L = normalize(f_lightDirection);\n  vec3 V = normalize(f_eyeDirection);\n  \n  if(!gl_FrontFacing) {\n    N = -N;\n  }\n\n  float specular = cookTorranceSpecular_1_1(L, V, N, roughness, fresnel);\n  float diffuse  = min(kambient + kdiffuse * max(dot(N, L), 0.0), 1.0);\n\n  vec4 surfaceColor = texture2D(texture, f_uv);\n  vec4 litColor = surfaceColor.a * vec4(diffuse * surfaceColor.rgb + kspecular * vec3(1,1,1) * specular,  1.0);\n\n  gl_FragColor = litColor * opacity;\n}"
var pickVertSrc = "precision mediump float;\n#define GLSLIFY 1\n\nattribute vec3 position;\nattribute vec4 id;\n\nuniform mat4 model, view, projection;\n\nvarying vec3 f_position;\nvarying vec4 f_id;\n\nvoid main() {\n  gl_Position = projection * view * model * vec4(position, 1.0);\n  f_id        = id;\n  f_position  = position;\n}"
var pickFragSrc = "precision mediump float;\n#define GLSLIFY 1\n\nuniform vec3  clipBounds[2];\nuniform float pickId;\n\nvarying vec3 f_position;\nvarying vec4 f_id;\n\nvoid main() {\n  if(any(lessThan(f_position, clipBounds[0])) || \n     any(greaterThan(f_position, clipBounds[1]))) {\n    discard;\n  }\n  gl_FragColor = vec4(pickId, f_id.xyz);\n}"

exports.meshShader = {
  vertex:   triVertSrc,
  fragment: triFragSrc,
  attributes: [
    {name: 'position', type: 'vec3'},
    {name: 'normal', type: 'vec3'},
    {name: 'color', type: 'vec4'},
    {name: 'uv', type: 'vec2'}
  ]
}
exports.pickShader = {
  vertex:   pickVertSrc,
  fragment: pickFragSrc,
  attributes: [
    {name: 'position', type: 'vec3'},
    {name: 'id', type: 'vec4'}
  ]
}

},{}],11:[function(require,module,exports){
'use strict'

var DEFAULT_VERTEX_NORMALS_EPSILON = 1e-6; // may be too large if triangles are very small
var DEFAULT_FACE_NORMALS_EPSILON = 1e-6;

var createShader  = require('gl-shader')
var createBuffer  = require('gl-buffer')
var createVAO     = require('gl-vao')
var createTexture = require('gl-texture2d')
var normals       = require('normals')
var multiply      = require('gl-mat4/multiply')
var invert        = require('gl-mat4/invert')
var ndarray       = require('ndarray')
var colormap      = require('colormap')
var getContour    = require('simplicial-complex-contour')
var pool          = require('typedarray-pool')
var shaders       = require('./shaders')
var closestPoint  = require('./closest-point')

var meshShader    = shaders.meshShader
var wireShader    = shaders.wireShader
var pointShader   = shaders.pointShader
var pickShader    = shaders.pickShader
var pointPickShader = shaders.pointPickShader
var contourShader = shaders.contourShader

var identityMatrix = [
  1,0,0,0,
  0,1,0,0,
  0,0,1,0,
  0,0,0,1]

function SimplicialMesh(gl
  , texture
  , triShader
  , lineShader
  , pointShader
  , pickShader
  , pointPickShader
  , contourShader
  , trianglePositions
  , triangleIds
  , triangleColors
  , triangleUVs
  , triangleNormals
  , triangleVAO
  , edgePositions
  , edgeIds
  , edgeColors
  , edgeUVs
  , edgeVAO
  , pointPositions
  , pointIds
  , pointColors
  , pointUVs
  , pointSizes
  , pointVAO
  , contourPositions
  , contourVAO) {

  this.gl                = gl
  this.positions         = []
  this.intensity         = []
  this.texture           = texture
  this.dirty             = true

  this.triShader         = triShader
  this.pickShader        = pickShader

  this.trianglePositions = trianglePositions
  this.triangleNormals   = triangleNormals
  this.triangleUVs       = triangleUVs
  this.triangleIds       = triangleIds
  this.triangleVAO       = triangleVAO
  this.triangleCount     = 0

  this.pickId            = 1
  this.bounds            = [
    [ Infinity, Infinity, Infinity],
    [-Infinity,-Infinity,-Infinity] ]
  this.clipBounds        = [
    [-Infinity,-Infinity,-Infinity],
    [ Infinity, Infinity, Infinity] ]

  this.lightPosition = [1e5, 1e5, 0]
  this.ambientLight  = 0.8
  this.diffuseLight  = 0.8
  this.specularLight = 2.0
  this.roughness     = 0.5
  this.fresnel       = 1.5

  this.opacity       = 1.0

  this._model       = identityMatrix
  this._view        = identityMatrix
  this._projection  = identityMatrix
  this._resolution  = [1,1]
}

var proto = SimplicialMesh.prototype

proto.isOpaque = function() {
  return this.opacity >= 1
}

proto.isTransparent = function() {
  return this.opacity < 1
}

proto.pickSlots = 1

proto.setPickBase = function(id) {
  this.pickId = id
}

function genColormap(param) {
  var colors = colormap({
      colormap: param
    , nshades:  256
    , format:  'rgba'
  })

  var result = new Uint8Array(256*4)
  for(var i=0; i<256; ++i) {
    var c = colors[i]
    for(var j=0; j<3; ++j) {
      result[4*i+j] = c[j]
    }
    result[4*i+3] = c[3]*255
  }

  return ndarray(result, [256,256,4], [4,0,1])
}

function takeZComponent(array) {
  var result = new Float32Array(array.length/3)
  for(var i=2, j=0; i<array.length; i+=3, j++) {
    result[j] = array[i]
  }
  return result
}

proto.highlight = function(selection) {
  if(!selection || !this.contourEnable) {
    this.contourCount = 0
    return
  }
  var level = getContour(this.cells, this.intensity, selection.intensity)
  var cells         = level.cells
  var vertexIds     = level.vertexIds
  var vertexWeights = level.vertexWeights
  var numCells = cells.length
  var result = pool.mallocFloat32(2 * 3 * numCells)
  var ptr = 0
  for(var i=0; i<numCells; ++i) {
    var c = cells[i]
    for(var j=0; j<2; ++j) {
      var v = c[0]
      if(c.length === 2) {
        v = c[j]
      }
      var a = vertexIds[v][0]
      var b = vertexIds[v][1]
      var w = vertexWeights[v]
      var wi = 1.0 - w
      var pa = this.positions[a]
      var pb = this.positions[b]
      for(var k=0; k<3; ++k) {
        result[ptr++] = w * pa[k] + wi * pb[k]
      }
    }
  }
  this.contourCount = (ptr / 3)|0
  this.contourPositions.update(result.subarray(0, ptr))
  pool.free(result)
}

proto.update = function(params) {
  params = params || {}
  var gl = this.gl

  this.dirty = true

  if('lightPosition' in params) {
    this.lightPosition = params.lightPosition
  }
  if('opacity' in params) {
    this.opacity = params.opacity
  }
  if('ambient' in params) {
    this.ambientLight  = params.ambient
  }
  if('diffuse' in params) {
    this.diffuseLight = params.diffuse
  }
  if('specular' in params) {
    this.specularLight = params.specular
  }
  if('roughness' in params) {
    this.roughness = params.roughness
  }
  if('fresnel' in params) {
    this.fresnel = params.fresnel
  }

  if(params.texture) {
    this.texture.dispose()
    this.texture = createTexture(gl, params.texture)
  } else if (params.colormap) {
    this.texture.shape = [256,256]
    this.texture.minFilter = gl.LINEAR_MIPMAP_LINEAR
    this.texture.magFilter = gl.LINEAR
    this.texture.setPixels(genColormap(params.colormap))
    this.texture.generateMipmap()
  }

  // var cells = params.cells
  var positions = params.positions

  if(!positions) {
    return
  }

  //Save geometry data for picking calculations
  this.positions = positions

  //Compute normals
  var vertexNormals = params.vertexNormals

  //UVs
  var vertexIntensity = params.vertexIntensity

  var intensityLo     = Infinity
  var intensityHi     = -Infinity
  if(vertexIntensity) {
    if(params.vertexIntensityBounds) {
      intensityLo = +params.vertexIntensityBounds[0]
      intensityHi = +params.vertexIntensityBounds[1]
    } else {
      for(var i=0; i<vertexIntensity.length; ++i) {
        var f = vertexIntensity[i]
        intensityLo = Math.min(intensityLo, f)
        intensityHi = Math.max(intensityHi, f)
      }
    }
  } else {
    for(var i=2; i<positions.length; i+=3) {
      var f = positions[i]
      intensityLo = Math.min(intensityLo, f)
      intensityHi = Math.max(intensityHi, f)
    }
  }


  if(vertexIntensity) {
    this.intensity = vertexIntensity
  } else {
    this.intensity = takeZComponent(positions)
  }

  //Pack cells into buffers
  var vertexCount = positions.length / 3;
  var triangleCount = vertexCount / 3;
  var tIds = new Uint32Array(vertexCount);
  var tUVs = new Float32Array(vertexCount * 2);

  for(var i=0,j=0; i<vertexCount; i++,j+=2) {
    tUVs[j] = (this.intensity[i] - intensityLo) / (intensityHi - intensityLo);
    tIds[i] = (i/3) | 0;
  }

  this.triangleCount  = triangleCount

  this.trianglePositions.update(positions)
  this.triangleUVs.update(tUVs)
  this.triangleNormals.update(vertexNormals)
  this.triangleIds.update(tIds)
}

proto.drawTransparent = 
proto.draw = 
function(params) {
  params = params || {}
  var gl          = this.gl
  var model       = params.model      || identityMatrix
  var view        = params.view       || identityMatrix
  var projection  = params.projection || identityMatrix

  var clipBounds = [[-1e6,-1e6,-1e6],[1e6,1e6,1e6]]
  for(var i=0; i<3; ++i) {
    clipBounds[0][i] = Math.max(clipBounds[0][i], this.clipBounds[0][i])
    clipBounds[1][i] = Math.min(clipBounds[1][i], this.clipBounds[1][i])
  }

  var uniforms = {
    model:      model,
    view:       view,
    projection: projection,

    clipBounds: clipBounds,

    kambient:   this.ambientLight,
    kdiffuse:   this.diffuseLight,
    kspecular:  this.specularLight,
    roughness:  this.roughness,
    fresnel:    this.fresnel,

    eyePosition:   [0,0,0],
    lightPosition: [0,0,0],

    opacity:  this.opacity,

    contourColor: this.contourColor,

    texture:    0
  }

  this.texture.bind(0)

  var invCameraMatrix = new Array(16)
  multiply(invCameraMatrix, uniforms.view, uniforms.model)
  multiply(invCameraMatrix, uniforms.projection, invCameraMatrix)
  invert(invCameraMatrix, invCameraMatrix)

  for(var i=0; i<3; ++i) {
    uniforms.eyePosition[i] = invCameraMatrix[12+i] / invCameraMatrix[15]
  }

  var w = invCameraMatrix[15]
  for(var i=0; i<3; ++i) {
    w += this.lightPosition[i] * invCameraMatrix[4*i+3]
  }
  for(var i=0; i<3; ++i) {
    var s = invCameraMatrix[12+i]
    for(var j=0; j<3; ++j) {
      s += invCameraMatrix[4*j+i] * this.lightPosition[j]
    }
    uniforms.lightPosition[i] = s / w
  }

  if(this.triangleCount > 0) {
    var shader = this.triShader
    shader.bind()
    shader.uniforms = uniforms

    this.triangleVAO.bind()
    gl.drawArrays(gl.TRIANGLES, 0, this.triangleCount*3)
    this.triangleVAO.unbind()
  }
}

proto.drawPick = function(params) {
  params = params || {}

  var gl         = this.gl

  var model      = params.model      || identityMatrix
  var view       = params.view       || identityMatrix
  var projection = params.projection || identityMatrix

  var clipBounds = [[-1e6,-1e6,-1e6],[1e6,1e6,1e6]]
  for(var i=0; i<3; ++i) {
    clipBounds[0][i] = Math.max(clipBounds[0][i], this.clipBounds[0][i])
    clipBounds[1][i] = Math.min(clipBounds[1][i], this.clipBounds[1][i])
  }

  //Save camera parameters
  this._model      = [].slice.call(model)
  this._view       = [].slice.call(view)
  this._projection = [].slice.call(projection)
  this._resolution = [gl.drawingBufferWidth, gl.drawingBufferHeight]

  var uniforms = {
    model:      model,
    view:       view,
    projection: projection,
    clipBounds: clipBounds,
    pickId:     this.pickId / 255.0,
  }

  var shader = this.pickShader
  shader.bind()
  shader.uniforms = uniforms

  if(this.triangleCount > 0) {
    this.triangleVAO.bind()
    gl.drawArrays(gl.TRIANGLES, 0, this.triangleCount*3)
    this.triangleVAO.unbind()
  }
}


proto.pick = function(pickData) {
  if(!pickData) {
    return null
  }
  if(pickData.id !== this.pickId) {
    return null
  }

  var cellId    = pickData.value[0] + 256*pickData.value[1] + 65536*pickData.value[2]
  var cell      = [cellId*3+0, cellId*3+1, cellId*3+2]
  var positions = this.positions

  var simplex   = new Array(cell.length)
  for(var i=0; i<cell.length; ++i) {
    simplex[i] = [
      positions[cell[i]*3 + 0],
      positions[cell[i]*3 + 1],
      positions[cell[i]*3 + 2]
    ];
  }

  var data = closestPoint(
    simplex,
    [pickData.coord[0], this._resolution[1]-pickData.coord[1]],
    this._model,
    this._view,
    this._projection,
    this._resolution)

  if(!data) {
    return null
  }

  var weights = data[2]
  var interpIntensity = 0.0
  for(var i=0; i<cell.length; ++i) {
    interpIntensity += weights[i] * this.intensity[cell[i]]
  }

  return {
    position: data[1],
    index:    cell[data[0]],
    cell:     cell,
    cellId:   cellId,
    intensity:  interpIntensity,
    dataCoordinate: [
      this.positions[cell[data[0]]*3 + 0],
      this.positions[cell[data[0]]*3 + 1],
      this.positions[cell[data[0]]*3 + 2]
    ]
  }
}


proto.dispose = function() {
  this.texture.dispose()

  this.triShader.dispose()
  this.pickShader.dispose()

  this.triangleVAO.dispose()
  this.trianglePositions.dispose()
  this.triangleUVs.dispose()
  this.triangleNormals.dispose()
  this.triangleIds.dispose()
}

function createMeshShader(gl) {
  var shader = createShader(gl, meshShader.vertex, meshShader.fragment)
  shader.attributes.position.location = 0
  shader.attributes.uv.location       = 2
  shader.attributes.normal.location   = 3
  return shader
}

function createPickShader(gl) {
  var shader = createShader(gl, pickShader.vertex, pickShader.fragment)
  shader.attributes.position.location = 0
  shader.attributes.id.location       = 1
  return shader
}

function createSimplicialMesh(gl, params) {
  if (arguments.length === 1) {
    params = gl;
    gl = params.gl;
  }

  console.time("createSimplicialMesh init");

  var triShader       = createMeshShader(gl)
  var pickShader      = createPickShader(gl)

  var meshTexture       = createTexture(gl,
    ndarray(new Uint8Array([255,255,255,255]), [1,1,4]))
  meshTexture.generateMipmap()
  meshTexture.minFilter = gl.LINEAR_MIPMAP_LINEAR
  meshTexture.magFilter = gl.LINEAR

  var trianglePositions = createBuffer(gl)
  var triangleUVs       = createBuffer(gl)
  var triangleNormals   = createBuffer(gl)
  var triangleIds       = createBuffer(gl)
  var triangleVAO       = createVAO(gl, [
    { buffer: trianglePositions,
      type: gl.FLOAT,
      size: 3
    },
    { buffer: triangleIds,
      type: gl.UNSIGNED_BYTE,
      size: 4,
      normalized: true
    },
    { buffer: triangleUVs,
      type: gl.FLOAT,
      size: 2
    },
    { buffer: triangleNormals,
      type: gl.FLOAT,
      size: 3
    }
  ])

  console.timeEnd("createSimplicialMesh init");
  console.time("new SimplicialMesh");

  var mesh = new SimplicialMesh(gl
    , meshTexture
    , triShader
    , null
    , null
    , pickShader
    , null
    , null
    , trianglePositions
    , triangleIds
    , null
    , triangleUVs
    , triangleNormals
    , triangleVAO
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null
    , null)

  console.timeEnd("new SimplicialMesh");
  console.time("mesh.update");
  mesh.update(params)
  console.timeEnd("mesh.update");

  return mesh
}

module.exports = createSimplicialMesh

},{"./closest-point":8,"./shaders":10,"colormap":55,"gl-buffer":81,"gl-mat4/invert":96,"gl-mat4/multiply":98,"gl-shader":115,"gl-texture2d":124,"gl-vao":128,"ndarray":164,"normals":166,"simplicial-complex-contour":196,"typedarray-pool":212}],12:[function(require,module,exports){
'use strict'

module.exports = createCamera

var now         = require('right-now')
var createView  = require('3d-view')
var mouseChange = require('mouse-change')
var mouseWheel  = require('mouse-wheel')
var mouseOffset = require('mouse-event-offset')

function createCamera(element, options) {
  element = element || document.body
  options = options || {}

  var limits  = [ 0.01, Infinity ]
  if('distanceLimits' in options) {
    limits[0] = options.distanceLimits[0]
    limits[1] = options.distanceLimits[1]
  }
  if('zoomMin' in options) {
    limits[0] = options.zoomMin
  }
  if('zoomMax' in options) {
    limits[1] = options.zoomMax
  }

  var view = createView({
    center: options.center || [0,0,0],
    up:     options.up     || [0,1,0],
    eye:    options.eye    || [0,0,10],
    mode:   options.mode   || 'orbit',
    distanceLimits: limits
  })

  var pmatrix = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  var distance = 0.0
  var width   = element.clientWidth
  var height  = element.clientHeight

  var camera = {
    view:               view,
    element:            element,
    delay:              options.delay          || 16,
    rotateSpeed:        options.rotateSpeed    || 1,
    zoomSpeed:          options.zoomSpeed      || 1,
    translateSpeed:     options.translateSpeed || 1,
    flipX:              !!options.flipX,
    flipY:              !!options.flipY,
    modes:              view.modes,
    tick: function() {
      var t = now()
      var delay = this.delay
      view.idle(t-delay)
      view.flush(t-(100+delay*2))
      var ctime = t - 2 * delay
      view.recalcMatrix(ctime)
      var allEqual = true
      var matrix = view.computedMatrix
      for(var i=0; i<16; ++i) {
        allEqual = allEqual && (pmatrix[i] === matrix[i])
        pmatrix[i] = matrix[i]
      }
      var sizeChanged =
          element.clientWidth === width &&
          element.clientHeight === height
      width  = element.clientWidth
      height = element.clientHeight
      if(allEqual) {
        return !sizeChanged
      }
      distance = Math.exp(view.computedRadius[0])
      return true
    },
    lookAt: function(center, eye, up) {
      view.lookAt(view.lastT(), center, eye, up)
    },
    rotate: function(pitch, yaw, roll) {
      view.rotate(view.lastT(), pitch, yaw, roll)
    },
    pan: function(dx, dy, dz) {
      view.pan(view.lastT(), dx, dy, dz)
    },
    translate: function(dx, dy, dz) {
      view.translate(view.lastT(), dx, dy, dz)
    }
  }

  Object.defineProperties(camera, {
    matrix: {
      get: function() {
        return view.computedMatrix
      },
      set: function(mat) {
        view.setMatrix(view.lastT(), mat)
        return view.computedMatrix
      },
      enumerable: true
    },
    mode: {
      get: function() {
        return view.getMode()
      },
      set: function(mode) {
        view.setMode(mode)
        return view.getMode()
      },
      enumerable: true
    },
    center: {
      get: function() {
        return view.computedCenter
      },
      set: function(ncenter) {
        view.lookAt(view.lastT(), ncenter)
        return view.computedCenter
      },
      enumerable: true
    },
    eye: {
      get: function() {
        return view.computedEye
      },
      set: function(neye) {
        view.lookAt(view.lastT(), null, neye)
        return view.computedEye
      },
      enumerable: true
    },
    up: {
      get: function() {
        return view.computedUp
      },
      set: function(nup) {
        view.lookAt(view.lastT(), null, null, nup)
        return view.computedUp
      },
      enumerable: true
    },
    distance: {
      get: function() {
        return distance
      },
      set: function(d) {
        view.setDistance(view.lastT(), d)
        return d
      },
      enumerable: true
    },
    distanceLimits: {
      get: function() {
        return view.getDistanceLimits(limits)
      },
      set: function(v) {
        view.setDistanceLimits(v)
        return v
      },
      enumerable: true
    }
  })

  element.addEventListener('contextmenu', function(ev) {
    ev.preventDefault()
    return false
  })

  var lastX = 0, lastY = 0, lastMods = {shift: false, control: false, alt: false, meta: false}
  mouseChange(element, handleInteraction)

  //enable simple touch interactions
  element.addEventListener('touchstart', function (ev) {
    var xy = mouseOffset(ev.changedTouches[0], element)
    handleInteraction(0, xy[0], xy[1], lastMods)
    handleInteraction(1, xy[0], xy[1], lastMods)
  })
  element.addEventListener('touchmove', function (ev) {
    var xy = mouseOffset(ev.changedTouches[0], element)
    handleInteraction(1, xy[0], xy[1], lastMods)
  })
  element.addEventListener('touchend', function (ev) {
    var xy = mouseOffset(ev.changedTouches[0], element)
    handleInteraction(0, lastX, lastY, lastMods)
  })

  function handleInteraction (buttons, x, y, mods) {
    var scale = 1.0 / element.clientHeight
    var dx    = scale * (x - lastX)
    var dy    = scale * (y - lastY)

    var flipX = camera.flipX ? 1 : -1
    var flipY = camera.flipY ? 1 : -1

    var drot  = Math.PI * camera.rotateSpeed

    var t = now()

    if(buttons & 1) {
      if(mods.shift) {
        view.rotate(t, 0, 0, -dx * drot)
      } else {
        view.rotate(t, flipX * drot * dx, -flipY * drot * dy, 0)
      }
    } else if(buttons & 2) {
      view.pan(t, -camera.translateSpeed * dx * distance, camera.translateSpeed * dy * distance, 0)
    } else if(buttons & 4) {
      var kzoom = camera.zoomSpeed * dy / window.innerHeight * (t - view.lastT()) * 50.0
      view.pan(t, 0, 0, distance * (Math.exp(kzoom) - 1))
    }

    lastX = x
    lastY = y
    lastMods = mods
  }

  mouseWheel(element, function(dx, dy, dz) {
    var flipX = camera.flipX ? 1 : -1
    var flipY = camera.flipY ? 1 : -1
    var t = now()
    if(Math.abs(dx) > Math.abs(dy)) {
      view.rotate(t, 0, 0, -dx * flipX * Math.PI * camera.rotateSpeed / window.innerWidth)
    } else {
      var kzoom = camera.zoomSpeed * flipY * dy / window.innerHeight * (t - view.lastT()) / 100.0
      view.pan(t, 0, 0, distance * (Math.exp(kzoom) - 1))
    }
  }, true)

  return camera
}

},{"3d-view":13,"mouse-change":156,"mouse-event-offset":157,"mouse-wheel":159,"right-now":184}],13:[function(require,module,exports){
'use strict'

module.exports = createViewController

var createTurntable = require('turntable-camera-controller')
var createOrbit     = require('orbit-camera-controller')
var createMatrix    = require('matrix-camera-controller')

function ViewController(controllers, mode) {
  this._controllerNames = Object.keys(controllers)
  this._controllerList = this._controllerNames.map(function(n) {
    return controllers[n]
  })
  this._mode   = mode
  this._active = controllers[mode]
  if(!this._active) {
    this._mode   = 'turntable'
    this._active = controllers.turntable
  }
  this.modes = this._controllerNames
  this.computedMatrix = this._active.computedMatrix
  this.computedEye    = this._active.computedEye
  this.computedUp     = this._active.computedUp
  this.computedCenter = this._active.computedCenter
  this.computedRadius = this._active.computedRadius
}

var proto = ViewController.prototype

var COMMON_METHODS = [
  ['flush', 1],
  ['idle', 1],
  ['lookAt', 4],
  ['rotate', 4],
  ['pan', 4],
  ['translate', 4],
  ['setMatrix', 2],
  ['setDistanceLimits', 2],
  ['setDistance', 2]
]

COMMON_METHODS.forEach(function(method) {
  var name = method[0]
  var argNames = []
  for(var i=0; i<method[1]; ++i) {
    argNames.push('a'+i)
  }
  var code = 'var cc=this._controllerList;for(var i=0;i<cc.length;++i){cc[i].'+method[0]+'('+argNames.join()+')}'
  proto[name] = Function.apply(null, argNames.concat(code))
})

proto.recalcMatrix = function(t) {
  this._active.recalcMatrix(t)
}

proto.getDistance = function(t) {
  return this._active.getDistance(t)
}
proto.getDistanceLimits = function(out) {
  return this._active.getDistanceLimits(out)
}

proto.lastT = function() {
  return this._active.lastT()
}

proto.setMode = function(mode) {
  if(mode === this._mode) {
    return
  }
  var idx = this._controllerNames.indexOf(mode)
  if(idx < 0) {
    return
  }
  var prev  = this._active
  var next  = this._controllerList[idx]
  var lastT = Math.max(prev.lastT(), next.lastT())

  prev.recalcMatrix(lastT)
  next.setMatrix(lastT, prev.computedMatrix)
  
  this._active = next
  this._mode   = mode

  //Update matrix properties
  this.computedMatrix = this._active.computedMatrix
  this.computedEye    = this._active.computedEye
  this.computedUp     = this._active.computedUp
  this.computedCenter = this._active.computedCenter
  this.computedRadius = this._active.computedRadius
}

proto.getMode = function() {
  return this._mode
}

function createViewController(options) {
  options = options || {}

  var eye       = options.eye    || [0,0,1]
  var center    = options.center || [0,0,0]
  var up        = options.up     || [0,1,0]
  var limits    = options.distanceLimits || [0, Infinity]
  var mode      = options.mode   || 'turntable'

  var turntable = createTurntable()
  var orbit     = createOrbit()
  var matrix    = createMatrix()

  turntable.setDistanceLimits(limits[0], limits[1])
  turntable.lookAt(0, eye, center, up)
  orbit.setDistanceLimits(limits[0], limits[1])
  orbit.lookAt(0, eye, center, up)
  matrix.setDistanceLimits(limits[0], limits[1])
  matrix.lookAt(0, eye, center, up)

  return new ViewController({
    turntable: turntable,
    orbit: orbit,
    matrix: matrix
  }, mode)
}
},{"matrix-camera-controller":154,"orbit-camera-controller":168,"turntable-camera-controller":209}],14:[function(require,module,exports){
var padLeft = require('pad-left')

module.exports = addLineNumbers
function addLineNumbers (string, start, delim) {
  start = typeof start === 'number' ? start : 1
  delim = delim || ': '

  var lines = string.split(/\r?\n/)
  var totalDigits = String(lines.length + start - 1).length
  return lines.map(function (line, i) {
    var c = i + start
    var digits = String(c).length
    var prefix = padLeft(c, totalDigits - digits)
    return prefix + delim + line
  }).join('\n')
}

},{"pad-left":169}],15:[function(require,module,exports){
'use strict'

module.exports = affineHull

var orient = require('robust-orientation')

function linearlyIndependent(points, d) {
  var nhull = new Array(d+1)
  for(var i=0; i<points.length; ++i) {
    nhull[i] = points[i]
  }
  for(var i=0; i<=points.length; ++i) {
    for(var j=points.length; j<=d; ++j) {
      var x = new Array(d)
      for(var k=0; k<d; ++k) {
        x[k] = Math.pow(j+1-i, k)
      }
      nhull[j] = x
    }
    var o = orient.apply(void 0, nhull)
    if(o) {
      return true
    }
  }
  return false
}

function affineHull(points) {
  var n = points.length
  if(n === 0) {
    return []
  }
  if(n === 1) {
    return [0]
  }
  var d = points[0].length
  var frame = [ points[0] ]
  var index = [ 0 ]
  for(var i=1; i<n; ++i) {
    frame.push(points[i])
    if(!linearlyIndependent(frame, d)) {
      frame.pop()
      continue
    }
    index.push(i)
    if(index.length === d+1) {
      return index
    }
  }
  return index
}
},{"robust-orientation":190}],16:[function(require,module,exports){
module.exports = function _atob(str) {
  return atob(str)
}

},{}],17:[function(require,module,exports){
'use strict'

module.exports = barycentric

var solve = require('robust-linear-solve')

function reduce(x) {
  var r = 0
  for(var i=0; i<x.length; ++i) {
    r += x[i]
  }
  return r
}

function barycentric(simplex, point) {
  var d = point.length
  var A = new Array(d+1)
  for(var i=0; i<d; ++i) {
    var row = new Array(d+1)
    for(var j=0; j<=d; ++j) {
      row[j] = simplex[j][i]
    }
    A[i] = row
  }
  A[d] = new Array(d+1)
  for(var i=0; i<=d; ++i) {
    A[d][i] = 1
  }

  var b = new Array(d+1)
  for(var i=0; i<d; ++i) {
    b[i] = point[i]
  }
  b[d] = 1.0

  var x = solve(A, b)
  var w = reduce(x[d+1])
  
  if(w === 0) {
    w = 1.0
  }
  var y = new Array(d+1)
  for(var i=0; i<=d; ++i) {
    y[i] = reduce(x[i]) / w
  }
  return y
}
},{"robust-linear-solve":189}],18:[function(require,module,exports){
'use strict'

var rationalize = require('./lib/rationalize')

module.exports = add

function add(a, b) {
  return rationalize(
    a[0].mul(b[1]).add(b[0].mul(a[1])),
    a[1].mul(b[1]))
}

},{"./lib/rationalize":28}],19:[function(require,module,exports){
'use strict'

module.exports = cmp

function cmp(a, b) {
    return a[0].mul(b[1]).cmp(b[0].mul(a[1]))
}

},{}],20:[function(require,module,exports){
'use strict'

var rationalize = require('./lib/rationalize')

module.exports = div

function div(a, b) {
  return rationalize(a[0].mul(b[1]), a[1].mul(b[0]))
}

},{"./lib/rationalize":28}],21:[function(require,module,exports){
'use strict'

var isRat = require('./is-rat')
var isBN = require('./lib/is-bn')
var num2bn = require('./lib/num-to-bn')
var str2bn = require('./lib/str-to-bn')
var rationalize = require('./lib/rationalize')
var div = require('./div')

module.exports = makeRational

function makeRational(numer, denom) {
  if(isRat(numer)) {
    if(denom) {
      return div(numer, makeRational(denom))
    }
    return [numer[0].clone(), numer[1].clone()]
  }
  var shift = 0
  var a, b
  if(isBN(numer)) {
    a = numer.clone()
  } else if(typeof numer === 'string') {
    a = str2bn(numer)
  } else if(numer === 0) {
    return [num2bn(0), num2bn(1)]
  } else if(numer === Math.floor(numer)) {
    a = num2bn(numer)
  } else {
    while(numer !== Math.floor(numer)) {
      numer = numer * Math.pow(2, 256)
      shift -= 256
    }
    a = num2bn(numer)
  }
  if(isRat(denom)) {
    a.mul(denom[1])
    b = denom[0].clone()
  } else if(isBN(denom)) {
    b = denom.clone()
  } else if(typeof denom === 'string') {
    b = str2bn(denom)
  } else if(!denom) {
    b = num2bn(1)
  } else if(denom === Math.floor(denom)) {
    b = num2bn(denom)
  } else {
    while(denom !== Math.floor(denom)) {
      denom = denom * Math.pow(2, 256)
      shift += 256
    }
    b = num2bn(denom)
  }
  if(shift > 0) {
    a = a.ushln(shift)
  } else if(shift < 0) {
    b = b.ushln(-shift)
  }
  return rationalize(a, b)
}

},{"./div":20,"./is-rat":22,"./lib/is-bn":26,"./lib/num-to-bn":27,"./lib/rationalize":28,"./lib/str-to-bn":29}],22:[function(require,module,exports){
'use strict'

var isBN = require('./lib/is-bn')

module.exports = isRat

function isRat(x) {
  return Array.isArray(x) && x.length === 2 && isBN(x[0]) && isBN(x[1])
}

},{"./lib/is-bn":26}],23:[function(require,module,exports){
'use strict'

var BN = require('bn.js')

module.exports = sign

function sign (x) {
  return x.cmp(new BN(0))
}

},{"bn.js":36}],24:[function(require,module,exports){
'use strict'

var sign = require('./bn-sign')

module.exports = bn2num

//TODO: Make this better
function bn2num(b) {
  var l = b.length
  var words = b.words
  var out = 0
  if (l === 1) {
    out = words[0]
  } else if (l === 2) {
    out = words[0] + (words[1] * 0x4000000)
  } else {
    for (var i = 0; i < l; i++) {
      var w = words[i]
      out += w * Math.pow(0x4000000, i)
    }
  }
  return sign(b) * out
}

},{"./bn-sign":23}],25:[function(require,module,exports){
'use strict'

var db = require('double-bits')
var ctz = require('bit-twiddle').countTrailingZeros

module.exports = ctzNumber

//Counts the number of trailing zeros
function ctzNumber(x) {
  var l = ctz(db.lo(x))
  if(l < 32) {
    return l
  }
  var h = ctz(db.hi(x))
  if(h > 20) {
    return 52
  }
  return h + 32
}

},{"bit-twiddle":35,"double-bits":67}],26:[function(require,module,exports){
'use strict'

var BN = require('bn.js')

module.exports = isBN

//Test if x is a bignumber
//FIXME: obviously this is the wrong way to do it
function isBN(x) {
  return x && typeof x === 'object' && Boolean(x.words)
}

},{"bn.js":36}],27:[function(require,module,exports){
'use strict'

var BN = require('bn.js')
var db = require('double-bits')

module.exports = num2bn

function num2bn(x) {
  var e = db.exponent(x)
  if(e < 52) {
    return new BN(x)
  } else {
    return (new BN(x * Math.pow(2, 52-e))).ushln(e-52)
  }
}

},{"bn.js":36,"double-bits":67}],28:[function(require,module,exports){
'use strict'

var num2bn = require('./num-to-bn')
var sign = require('./bn-sign')

module.exports = rationalize

function rationalize(numer, denom) {
  var snumer = sign(numer)
  var sdenom = sign(denom)
  if(snumer === 0) {
    return [num2bn(0), num2bn(1)]
  }
  if(sdenom === 0) {
    return [num2bn(0), num2bn(0)]
  }
  if(sdenom < 0) {
    numer = numer.neg()
    denom = denom.neg()
  }
  var d = numer.gcd(denom)
  if(d.cmpn(1)) {
    return [ numer.div(d), denom.div(d) ]
  }
  return [ numer, denom ]
}

},{"./bn-sign":23,"./num-to-bn":27}],29:[function(require,module,exports){
'use strict'

var BN = require('bn.js')

module.exports = str2BN

function str2BN(x) {
  return new BN(x)
}

},{"bn.js":36}],30:[function(require,module,exports){
'use strict'

var rationalize = require('./lib/rationalize')

module.exports = mul

function mul(a, b) {
  return rationalize(a[0].mul(b[0]), a[1].mul(b[1]))
}

},{"./lib/rationalize":28}],31:[function(require,module,exports){
'use strict'

var bnsign = require('./lib/bn-sign')

module.exports = sign

function sign(x) {
  return bnsign(x[0]) * bnsign(x[1])
}

},{"./lib/bn-sign":23}],32:[function(require,module,exports){
'use strict'

var rationalize = require('./lib/rationalize')

module.exports = sub

function sub(a, b) {
  return rationalize(a[0].mul(b[1]).sub(a[1].mul(b[0])), a[1].mul(b[1]))
}

},{"./lib/rationalize":28}],33:[function(require,module,exports){
'use strict'

var bn2num = require('./lib/bn-to-num')
var ctz = require('./lib/ctz')

module.exports = roundRat

// Round a rational to the closest float
function roundRat (f) {
  var a = f[0]
  var b = f[1]
  if (a.cmpn(0) === 0) {
    return 0
  }
  var h = a.abs().divmod(b.abs())
  var iv = h.div
  var x = bn2num(iv)
  var ir = h.mod
  var sgn = (a.negative !== b.negative) ? -1 : 1
  if (ir.cmpn(0) === 0) {
    return sgn * x
  }
  if (x) {
    var s = ctz(x) + 4
    var y = bn2num(ir.ushln(s).divRound(b))
    return sgn * (x + y * Math.pow(2, -s))
  } else {
    var ybits = b.bitLength() - ir.bitLength() + 53
    var y = bn2num(ir.ushln(ybits).divRound(b))
    if (ybits < 1023) {
      return sgn * y * Math.pow(2, -ybits)
    }
    y *= Math.pow(2, -1023)
    return sgn * y * Math.pow(2, 1023 - ybits)
  }
}

},{"./lib/bn-to-num":24,"./lib/ctz":25}],34:[function(require,module,exports){
"use strict"

function compileSearch(funcName, predicate, reversed, extraArgs, useNdarray, earlyOut) {
  var code = [
    "function ", funcName, "(a,l,h,", extraArgs.join(","),  "){",
earlyOut ? "" : "var i=", (reversed ? "l-1" : "h+1"),
";while(l<=h){\
var m=(l+h)>>>1,x=a", useNdarray ? ".get(m)" : "[m]"]
  if(earlyOut) {
    if(predicate.indexOf("c") < 0) {
      code.push(";if(x===y){return m}else if(x<=y){")
    } else {
      code.push(";var p=c(x,y);if(p===0){return m}else if(p<=0){")
    }
  } else {
    code.push(";if(", predicate, "){i=m;")
  }
  if(reversed) {
    code.push("l=m+1}else{h=m-1}")
  } else {
    code.push("h=m-1}else{l=m+1}")
  }
  code.push("}")
  if(earlyOut) {
    code.push("return -1};")
  } else {
    code.push("return i};")
  }
  return code.join("")
}

function compileBoundsSearch(predicate, reversed, suffix, earlyOut) {
  var result = new Function([
  compileSearch("A", "x" + predicate + "y", reversed, ["y"], false, earlyOut),
  compileSearch("B", "x" + predicate + "y", reversed, ["y"], true, earlyOut),
  compileSearch("P", "c(x,y)" + predicate + "0", reversed, ["y", "c"], false, earlyOut),
  compileSearch("Q", "c(x,y)" + predicate + "0", reversed, ["y", "c"], true, earlyOut),
"function dispatchBsearch", suffix, "(a,y,c,l,h){\
if(a.shape){\
if(typeof(c)==='function'){\
return Q(a,(l===undefined)?0:l|0,(h===undefined)?a.shape[0]-1:h|0,y,c)\
}else{\
return B(a,(c===undefined)?0:c|0,(l===undefined)?a.shape[0]-1:l|0,y)\
}}else{\
if(typeof(c)==='function'){\
return P(a,(l===undefined)?0:l|0,(h===undefined)?a.length-1:h|0,y,c)\
}else{\
return A(a,(c===undefined)?0:c|0,(l===undefined)?a.length-1:l|0,y)\
}}}\
return dispatchBsearch", suffix].join(""))
  return result()
}

module.exports = {
  ge: compileBoundsSearch(">=", false, "GE"),
  gt: compileBoundsSearch(">", false, "GT"),
  lt: compileBoundsSearch("<", true, "LT"),
  le: compileBoundsSearch("<=", true, "LE"),
  eq: compileBoundsSearch("-", true, "EQ", true)
}

},{}],35:[function(require,module,exports){
/**
 * Bit twiddling hacks for JavaScript.
 *
 * Author: Mikola Lysenko
 *
 * Ported from Stanford bit twiddling hack library:
 *    http://graphics.stanford.edu/~seander/bithacks.html
 */

"use strict"; "use restrict";

//Number of bits in an integer
var INT_BITS = 32;

//Constants
exports.INT_BITS  = INT_BITS;
exports.INT_MAX   =  0x7fffffff;
exports.INT_MIN   = -1<<(INT_BITS-1);

//Returns -1, 0, +1 depending on sign of x
exports.sign = function(v) {
  return (v > 0) - (v < 0);
}

//Computes absolute value of integer
exports.abs = function(v) {
  var mask = v >> (INT_BITS-1);
  return (v ^ mask) - mask;
}

//Computes minimum of integers x and y
exports.min = function(x, y) {
  return y ^ ((x ^ y) & -(x < y));
}

//Computes maximum of integers x and y
exports.max = function(x, y) {
  return x ^ ((x ^ y) & -(x < y));
}

//Checks if a number is a power of two
exports.isPow2 = function(v) {
  return !(v & (v-1)) && (!!v);
}

//Computes log base 2 of v
exports.log2 = function(v) {
  var r, shift;
  r =     (v > 0xFFFF) << 4; v >>>= r;
  shift = (v > 0xFF  ) << 3; v >>>= shift; r |= shift;
  shift = (v > 0xF   ) << 2; v >>>= shift; r |= shift;
  shift = (v > 0x3   ) << 1; v >>>= shift; r |= shift;
  return r | (v >> 1);
}

//Computes log base 10 of v
exports.log10 = function(v) {
  return  (v >= 1000000000) ? 9 : (v >= 100000000) ? 8 : (v >= 10000000) ? 7 :
          (v >= 1000000) ? 6 : (v >= 100000) ? 5 : (v >= 10000) ? 4 :
          (v >= 1000) ? 3 : (v >= 100) ? 2 : (v >= 10) ? 1 : 0;
}

//Counts number of bits
exports.popCount = function(v) {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return ((v + (v >>> 4) & 0xF0F0F0F) * 0x1010101) >>> 24;
}

//Counts number of trailing zeros
function countTrailingZeros(v) {
  var c = 32;
  v &= -v;
  if (v) c--;
  if (v & 0x0000FFFF) c -= 16;
  if (v & 0x00FF00FF) c -= 8;
  if (v & 0x0F0F0F0F) c -= 4;
  if (v & 0x33333333) c -= 2;
  if (v & 0x55555555) c -= 1;
  return c;
}
exports.countTrailingZeros = countTrailingZeros;

//Rounds to next power of 2
exports.nextPow2 = function(v) {
  v += v === 0;
  --v;
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v + 1;
}

//Rounds down to previous power of 2
exports.prevPow2 = function(v) {
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return v - (v>>>1);
}

//Computes parity of word
exports.parity = function(v) {
  v ^= v >>> 16;
  v ^= v >>> 8;
  v ^= v >>> 4;
  v &= 0xf;
  return (0x6996 >>> v) & 1;
}

var REVERSE_TABLE = new Array(256);

(function(tab) {
  for(var i=0; i<256; ++i) {
    var v = i, r = i, s = 7;
    for (v >>>= 1; v; v >>>= 1) {
      r <<= 1;
      r |= v & 1;
      --s;
    }
    tab[i] = (r << s) & 0xff;
  }
})(REVERSE_TABLE);

//Reverse bits in a 32 bit word
exports.reverse = function(v) {
  return  (REVERSE_TABLE[ v         & 0xff] << 24) |
          (REVERSE_TABLE[(v >>> 8)  & 0xff] << 16) |
          (REVERSE_TABLE[(v >>> 16) & 0xff] << 8)  |
           REVERSE_TABLE[(v >>> 24) & 0xff];
}

//Interleave bits of 2 coordinates with 16 bits.  Useful for fast quadtree codes
exports.interleave2 = function(x, y) {
  x &= 0xFFFF;
  x = (x | (x << 8)) & 0x00FF00FF;
  x = (x | (x << 4)) & 0x0F0F0F0F;
  x = (x | (x << 2)) & 0x33333333;
  x = (x | (x << 1)) & 0x55555555;

  y &= 0xFFFF;
  y = (y | (y << 8)) & 0x00FF00FF;
  y = (y | (y << 4)) & 0x0F0F0F0F;
  y = (y | (y << 2)) & 0x33333333;
  y = (y | (y << 1)) & 0x55555555;

  return x | (y << 1);
}

//Extracts the nth interleaved component
exports.deinterleave2 = function(v, n) {
  v = (v >>> n) & 0x55555555;
  v = (v | (v >>> 1))  & 0x33333333;
  v = (v | (v >>> 2))  & 0x0F0F0F0F;
  v = (v | (v >>> 4))  & 0x00FF00FF;
  v = (v | (v >>> 16)) & 0x000FFFF;
  return (v << 16) >> 16;
}


//Interleave bits of 3 coordinates, each with 10 bits.  Useful for fast octree codes
exports.interleave3 = function(x, y, z) {
  x &= 0x3FF;
  x  = (x | (x<<16)) & 4278190335;
  x  = (x | (x<<8))  & 251719695;
  x  = (x | (x<<4))  & 3272356035;
  x  = (x | (x<<2))  & 1227133513;

  y &= 0x3FF;
  y  = (y | (y<<16)) & 4278190335;
  y  = (y | (y<<8))  & 251719695;
  y  = (y | (y<<4))  & 3272356035;
  y  = (y | (y<<2))  & 1227133513;
  x |= (y << 1);
  
  z &= 0x3FF;
  z  = (z | (z<<16)) & 4278190335;
  z  = (z | (z<<8))  & 251719695;
  z  = (z | (z<<4))  & 3272356035;
  z  = (z | (z<<2))  & 1227133513;
  
  return x | (z << 2);
}

//Extracts nth interleaved component of a 3-tuple
exports.deinterleave3 = function(v, n) {
  v = (v >>> n)       & 1227133513;
  v = (v | (v>>>2))   & 3272356035;
  v = (v | (v>>>4))   & 251719695;
  v = (v | (v>>>8))   & 4278190335;
  v = (v | (v>>>16))  & 0x3FF;
  return (v<<22)>>22;
}

//Computes next combination in colexicographic order (this is mistakenly called nextPermutation on the bit twiddling hacks page)
exports.nextCombination = function(v) {
  var t = v | (v - 1);
  return (t + 1) | (((~t & -~t) - 1) >>> (countTrailingZeros(v) + 1));
}


},{}],36:[function(require,module,exports){
(function (module, exports) {
  'use strict';

  // Utils
  function assert (val, msg) {
    if (!val) throw new Error(msg || 'Assertion failed');
  }

  // Could use `inherits` module, but don't want to move from single file
  // architecture yet.
  function inherits (ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  }

  // BN

  function BN (number, base, endian) {
    if (BN.isBN(number)) {
      return number;
    }

    this.negative = 0;
    this.words = null;
    this.length = 0;

    // Reduction context
    this.red = null;

    if (number !== null) {
      if (base === 'le' || base === 'be') {
        endian = base;
        base = 10;
      }

      this._init(number || 0, base || 10, endian || 'be');
    }
  }
  if (typeof module === 'object') {
    module.exports = BN;
  } else {
    exports.BN = BN;
  }

  BN.BN = BN;
  BN.wordSize = 26;

  var Buffer;
  try {
    Buffer = require('buffer').Buffer;
  } catch (e) {
  }

  BN.isBN = function isBN (num) {
    if (num instanceof BN) {
      return true;
    }

    return num !== null && typeof num === 'object' &&
      num.constructor.wordSize === BN.wordSize && Array.isArray(num.words);
  };

  BN.max = function max (left, right) {
    if (left.cmp(right) > 0) return left;
    return right;
  };

  BN.min = function min (left, right) {
    if (left.cmp(right) < 0) return left;
    return right;
  };

  BN.prototype._init = function init (number, base, endian) {
    if (typeof number === 'number') {
      return this._initNumber(number, base, endian);
    }

    if (typeof number === 'object') {
      return this._initArray(number, base, endian);
    }

    if (base === 'hex') {
      base = 16;
    }
    assert(base === (base | 0) && base >= 2 && base <= 36);

    number = number.toString().replace(/\s+/g, '');
    var start = 0;
    if (number[0] === '-') {
      start++;
    }

    if (base === 16) {
      this._parseHex(number, start);
    } else {
      this._parseBase(number, base, start);
    }

    if (number[0] === '-') {
      this.negative = 1;
    }

    this.strip();

    if (endian !== 'le') return;

    this._initArray(this.toArray(), base, endian);
  };

  BN.prototype._initNumber = function _initNumber (number, base, endian) {
    if (number < 0) {
      this.negative = 1;
      number = -number;
    }
    if (number < 0x4000000) {
      this.words = [ number & 0x3ffffff ];
      this.length = 1;
    } else if (number < 0x10000000000000) {
      this.words = [
        number & 0x3ffffff,
        (number / 0x4000000) & 0x3ffffff
      ];
      this.length = 2;
    } else {
      assert(number < 0x20000000000000); // 2 ^ 53 (unsafe)
      this.words = [
        number & 0x3ffffff,
        (number / 0x4000000) & 0x3ffffff,
        1
      ];
      this.length = 3;
    }

    if (endian !== 'le') return;

    // Reverse the bytes
    this._initArray(this.toArray(), base, endian);
  };

  BN.prototype._initArray = function _initArray (number, base, endian) {
    // Perhaps a Uint8Array
    assert(typeof number.length === 'number');
    if (number.length <= 0) {
      this.words = [ 0 ];
      this.length = 1;
      return this;
    }

    this.length = Math.ceil(number.length / 3);
    this.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      this.words[i] = 0;
    }

    var j, w;
    var off = 0;
    if (endian === 'be') {
      for (i = number.length - 1, j = 0; i >= 0; i -= 3) {
        w = number[i] | (number[i - 1] << 8) | (number[i - 2] << 16);
        this.words[j] |= (w << off) & 0x3ffffff;
        this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
        off += 24;
        if (off >= 26) {
          off -= 26;
          j++;
        }
      }
    } else if (endian === 'le') {
      for (i = 0, j = 0; i < number.length; i += 3) {
        w = number[i] | (number[i + 1] << 8) | (number[i + 2] << 16);
        this.words[j] |= (w << off) & 0x3ffffff;
        this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
        off += 24;
        if (off >= 26) {
          off -= 26;
          j++;
        }
      }
    }
    return this.strip();
  };

  function parseHex (str, start, end) {
    var r = 0;
    var len = Math.min(str.length, end);
    for (var i = start; i < len; i++) {
      var c = str.charCodeAt(i) - 48;

      r <<= 4;

      // 'a' - 'f'
      if (c >= 49 && c <= 54) {
        r |= c - 49 + 0xa;

      // 'A' - 'F'
      } else if (c >= 17 && c <= 22) {
        r |= c - 17 + 0xa;

      // '0' - '9'
      } else {
        r |= c & 0xf;
      }
    }
    return r;
  }

  BN.prototype._parseHex = function _parseHex (number, start) {
    // Create possibly bigger array to ensure that it fits the number
    this.length = Math.ceil((number.length - start) / 6);
    this.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      this.words[i] = 0;
    }

    var j, w;
    // Scan 24-bit chunks and add them to the number
    var off = 0;
    for (i = number.length - 6, j = 0; i >= start; i -= 6) {
      w = parseHex(number, i, i + 6);
      this.words[j] |= (w << off) & 0x3ffffff;
      // NOTE: `0x3fffff` is intentional here, 26bits max shift + 24bit hex limb
      this.words[j + 1] |= w >>> (26 - off) & 0x3fffff;
      off += 24;
      if (off >= 26) {
        off -= 26;
        j++;
      }
    }
    if (i + 6 !== start) {
      w = parseHex(number, start, i + 6);
      this.words[j] |= (w << off) & 0x3ffffff;
      this.words[j + 1] |= w >>> (26 - off) & 0x3fffff;
    }
    this.strip();
  };

  function parseBase (str, start, end, mul) {
    var r = 0;
    var len = Math.min(str.length, end);
    for (var i = start; i < len; i++) {
      var c = str.charCodeAt(i) - 48;

      r *= mul;

      // 'a'
      if (c >= 49) {
        r += c - 49 + 0xa;

      // 'A'
      } else if (c >= 17) {
        r += c - 17 + 0xa;

      // '0' - '9'
      } else {
        r += c;
      }
    }
    return r;
  }

  BN.prototype._parseBase = function _parseBase (number, base, start) {
    // Initialize as zero
    this.words = [ 0 ];
    this.length = 1;

    // Find length of limb in base
    for (var limbLen = 0, limbPow = 1; limbPow <= 0x3ffffff; limbPow *= base) {
      limbLen++;
    }
    limbLen--;
    limbPow = (limbPow / base) | 0;

    var total = number.length - start;
    var mod = total % limbLen;
    var end = Math.min(total, total - mod) + start;

    var word = 0;
    for (var i = start; i < end; i += limbLen) {
      word = parseBase(number, i, i + limbLen, base);

      this.imuln(limbPow);
      if (this.words[0] + word < 0x4000000) {
        this.words[0] += word;
      } else {
        this._iaddn(word);
      }
    }

    if (mod !== 0) {
      var pow = 1;
      word = parseBase(number, i, number.length, base);

      for (i = 0; i < mod; i++) {
        pow *= base;
      }

      this.imuln(pow);
      if (this.words[0] + word < 0x4000000) {
        this.words[0] += word;
      } else {
        this._iaddn(word);
      }
    }
  };

  BN.prototype.copy = function copy (dest) {
    dest.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      dest.words[i] = this.words[i];
    }
    dest.length = this.length;
    dest.negative = this.negative;
    dest.red = this.red;
  };

  BN.prototype.clone = function clone () {
    var r = new BN(null);
    this.copy(r);
    return r;
  };

  BN.prototype._expand = function _expand (size) {
    while (this.length < size) {
      this.words[this.length++] = 0;
    }
    return this;
  };

  // Remove leading `0` from `this`
  BN.prototype.strip = function strip () {
    while (this.length > 1 && this.words[this.length - 1] === 0) {
      this.length--;
    }
    return this._normSign();
  };

  BN.prototype._normSign = function _normSign () {
    // -0 = 0
    if (this.length === 1 && this.words[0] === 0) {
      this.negative = 0;
    }
    return this;
  };

  BN.prototype.inspect = function inspect () {
    return (this.red ? '<BN-R: ' : '<BN: ') + this.toString(16) + '>';
  };

  /*

  var zeros = [];
  var groupSizes = [];
  var groupBases = [];

  var s = '';
  var i = -1;
  while (++i < BN.wordSize) {
    zeros[i] = s;
    s += '0';
  }
  groupSizes[0] = 0;
  groupSizes[1] = 0;
  groupBases[0] = 0;
  groupBases[1] = 0;
  var base = 2 - 1;
  while (++base < 36 + 1) {
    var groupSize = 0;
    var groupBase = 1;
    while (groupBase < (1 << BN.wordSize) / base) {
      groupBase *= base;
      groupSize += 1;
    }
    groupSizes[base] = groupSize;
    groupBases[base] = groupBase;
  }

  */

  var zeros = [
    '',
    '0',
    '00',
    '000',
    '0000',
    '00000',
    '000000',
    '0000000',
    '00000000',
    '000000000',
    '0000000000',
    '00000000000',
    '000000000000',
    '0000000000000',
    '00000000000000',
    '000000000000000',
    '0000000000000000',
    '00000000000000000',
    '000000000000000000',
    '0000000000000000000',
    '00000000000000000000',
    '000000000000000000000',
    '0000000000000000000000',
    '00000000000000000000000',
    '000000000000000000000000',
    '0000000000000000000000000'
  ];

  var groupSizes = [
    0, 0,
    25, 16, 12, 11, 10, 9, 8,
    8, 7, 7, 7, 7, 6, 6,
    6, 6, 6, 6, 6, 5, 5,
    5, 5, 5, 5, 5, 5, 5,
    5, 5, 5, 5, 5, 5, 5
  ];

  var groupBases = [
    0, 0,
    33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216,
    43046721, 10000000, 19487171, 35831808, 62748517, 7529536, 11390625,
    16777216, 24137569, 34012224, 47045881, 64000000, 4084101, 5153632,
    6436343, 7962624, 9765625, 11881376, 14348907, 17210368, 20511149,
    24300000, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176
  ];

  BN.prototype.toString = function toString (base, padding) {
    base = base || 10;
    padding = padding | 0 || 1;

    var out;
    if (base === 16 || base === 'hex') {
      out = '';
      var off = 0;
      var carry = 0;
      for (var i = 0; i < this.length; i++) {
        var w = this.words[i];
        var word = (((w << off) | carry) & 0xffffff).toString(16);
        carry = (w >>> (24 - off)) & 0xffffff;
        if (carry !== 0 || i !== this.length - 1) {
          out = zeros[6 - word.length] + word + out;
        } else {
          out = word + out;
        }
        off += 2;
        if (off >= 26) {
          off -= 26;
          i--;
        }
      }
      if (carry !== 0) {
        out = carry.toString(16) + out;
      }
      while (out.length % padding !== 0) {
        out = '0' + out;
      }
      if (this.negative !== 0) {
        out = '-' + out;
      }
      return out;
    }

    if (base === (base | 0) && base >= 2 && base <= 36) {
      // var groupSize = Math.floor(BN.wordSize * Math.LN2 / Math.log(base));
      var groupSize = groupSizes[base];
      // var groupBase = Math.pow(base, groupSize);
      var groupBase = groupBases[base];
      out = '';
      var c = this.clone();
      c.negative = 0;
      while (!c.isZero()) {
        var r = c.modn(groupBase).toString(base);
        c = c.idivn(groupBase);

        if (!c.isZero()) {
          out = zeros[groupSize - r.length] + r + out;
        } else {
          out = r + out;
        }
      }
      if (this.isZero()) {
        out = '0' + out;
      }
      while (out.length % padding !== 0) {
        out = '0' + out;
      }
      if (this.negative !== 0) {
        out = '-' + out;
      }
      return out;
    }

    assert(false, 'Base should be between 2 and 36');
  };

  BN.prototype.toNumber = function toNumber () {
    var ret = this.words[0];
    if (this.length === 2) {
      ret += this.words[1] * 0x4000000;
    } else if (this.length === 3 && this.words[2] === 0x01) {
      // NOTE: at this stage it is known that the top bit is set
      ret += 0x10000000000000 + (this.words[1] * 0x4000000);
    } else if (this.length > 2) {
      assert(false, 'Number can only safely store up to 53 bits');
    }
    return (this.negative !== 0) ? -ret : ret;
  };

  BN.prototype.toJSON = function toJSON () {
    return this.toString(16);
  };

  BN.prototype.toBuffer = function toBuffer (endian, length) {
    assert(typeof Buffer !== 'undefined');
    return this.toArrayLike(Buffer, endian, length);
  };

  BN.prototype.toArray = function toArray (endian, length) {
    return this.toArrayLike(Array, endian, length);
  };

  BN.prototype.toArrayLike = function toArrayLike (ArrayType, endian, length) {
    var byteLength = this.byteLength();
    var reqLength = length || Math.max(1, byteLength);
    assert(byteLength <= reqLength, 'byte array longer than desired length');
    assert(reqLength > 0, 'Requested array length <= 0');

    this.strip();
    var littleEndian = endian === 'le';
    var res = new ArrayType(reqLength);

    var b, i;
    var q = this.clone();
    if (!littleEndian) {
      // Assume big-endian
      for (i = 0; i < reqLength - byteLength; i++) {
        res[i] = 0;
      }

      for (i = 0; !q.isZero(); i++) {
        b = q.andln(0xff);
        q.iushrn(8);

        res[reqLength - i - 1] = b;
      }
    } else {
      for (i = 0; !q.isZero(); i++) {
        b = q.andln(0xff);
        q.iushrn(8);

        res[i] = b;
      }

      for (; i < reqLength; i++) {
        res[i] = 0;
      }
    }

    return res;
  };

  if (Math.clz32) {
    BN.prototype._countBits = function _countBits (w) {
      return 32 - Math.clz32(w);
    };
  } else {
    BN.prototype._countBits = function _countBits (w) {
      var t = w;
      var r = 0;
      if (t >= 0x1000) {
        r += 13;
        t >>>= 13;
      }
      if (t >= 0x40) {
        r += 7;
        t >>>= 7;
      }
      if (t >= 0x8) {
        r += 4;
        t >>>= 4;
      }
      if (t >= 0x02) {
        r += 2;
        t >>>= 2;
      }
      return r + t;
    };
  }

  BN.prototype._zeroBits = function _zeroBits (w) {
    // Short-cut
    if (w === 0) return 26;

    var t = w;
    var r = 0;
    if ((t & 0x1fff) === 0) {
      r += 13;
      t >>>= 13;
    }
    if ((t & 0x7f) === 0) {
      r += 7;
      t >>>= 7;
    }
    if ((t & 0xf) === 0) {
      r += 4;
      t >>>= 4;
    }
    if ((t & 0x3) === 0) {
      r += 2;
      t >>>= 2;
    }
    if ((t & 0x1) === 0) {
      r++;
    }
    return r;
  };

  // Return number of used bits in a BN
  BN.prototype.bitLength = function bitLength () {
    var w = this.words[this.length - 1];
    var hi = this._countBits(w);
    return (this.length - 1) * 26 + hi;
  };

  function toBitArray (num) {
    var w = new Array(num.bitLength());

    for (var bit = 0; bit < w.length; bit++) {
      var off = (bit / 26) | 0;
      var wbit = bit % 26;

      w[bit] = (num.words[off] & (1 << wbit)) >>> wbit;
    }

    return w;
  }

  // Number of trailing zero bits
  BN.prototype.zeroBits = function zeroBits () {
    if (this.isZero()) return 0;

    var r = 0;
    for (var i = 0; i < this.length; i++) {
      var b = this._zeroBits(this.words[i]);
      r += b;
      if (b !== 26) break;
    }
    return r;
  };

  BN.prototype.byteLength = function byteLength () {
    return Math.ceil(this.bitLength() / 8);
  };

  BN.prototype.toTwos = function toTwos (width) {
    if (this.negative !== 0) {
      return this.abs().inotn(width).iaddn(1);
    }
    return this.clone();
  };

  BN.prototype.fromTwos = function fromTwos (width) {
    if (this.testn(width - 1)) {
      return this.notn(width).iaddn(1).ineg();
    }
    return this.clone();
  };

  BN.prototype.isNeg = function isNeg () {
    return this.negative !== 0;
  };

  // Return negative clone of `this`
  BN.prototype.neg = function neg () {
    return this.clone().ineg();
  };

  BN.prototype.ineg = function ineg () {
    if (!this.isZero()) {
      this.negative ^= 1;
    }

    return this;
  };

  // Or `num` with `this` in-place
  BN.prototype.iuor = function iuor (num) {
    while (this.length < num.length) {
      this.words[this.length++] = 0;
    }

    for (var i = 0; i < num.length; i++) {
      this.words[i] = this.words[i] | num.words[i];
    }

    return this.strip();
  };

  BN.prototype.ior = function ior (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuor(num);
  };

  // Or `num` with `this`
  BN.prototype.or = function or (num) {
    if (this.length > num.length) return this.clone().ior(num);
    return num.clone().ior(this);
  };

  BN.prototype.uor = function uor (num) {
    if (this.length > num.length) return this.clone().iuor(num);
    return num.clone().iuor(this);
  };

  // And `num` with `this` in-place
  BN.prototype.iuand = function iuand (num) {
    // b = min-length(num, this)
    var b;
    if (this.length > num.length) {
      b = num;
    } else {
      b = this;
    }

    for (var i = 0; i < b.length; i++) {
      this.words[i] = this.words[i] & num.words[i];
    }

    this.length = b.length;

    return this.strip();
  };

  BN.prototype.iand = function iand (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuand(num);
  };

  // And `num` with `this`
  BN.prototype.and = function and (num) {
    if (this.length > num.length) return this.clone().iand(num);
    return num.clone().iand(this);
  };

  BN.prototype.uand = function uand (num) {
    if (this.length > num.length) return this.clone().iuand(num);
    return num.clone().iuand(this);
  };

  // Xor `num` with `this` in-place
  BN.prototype.iuxor = function iuxor (num) {
    // a.length > b.length
    var a;
    var b;
    if (this.length > num.length) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    for (var i = 0; i < b.length; i++) {
      this.words[i] = a.words[i] ^ b.words[i];
    }

    if (this !== a) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    this.length = a.length;

    return this.strip();
  };

  BN.prototype.ixor = function ixor (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuxor(num);
  };

  // Xor `num` with `this`
  BN.prototype.xor = function xor (num) {
    if (this.length > num.length) return this.clone().ixor(num);
    return num.clone().ixor(this);
  };

  BN.prototype.uxor = function uxor (num) {
    if (this.length > num.length) return this.clone().iuxor(num);
    return num.clone().iuxor(this);
  };

  // Not ``this`` with ``width`` bitwidth
  BN.prototype.inotn = function inotn (width) {
    assert(typeof width === 'number' && width >= 0);

    var bytesNeeded = Math.ceil(width / 26) | 0;
    var bitsLeft = width % 26;

    // Extend the buffer with leading zeroes
    this._expand(bytesNeeded);

    if (bitsLeft > 0) {
      bytesNeeded--;
    }

    // Handle complete words
    for (var i = 0; i < bytesNeeded; i++) {
      this.words[i] = ~this.words[i] & 0x3ffffff;
    }

    // Handle the residue
    if (bitsLeft > 0) {
      this.words[i] = ~this.words[i] & (0x3ffffff >> (26 - bitsLeft));
    }

    // And remove leading zeroes
    return this.strip();
  };

  BN.prototype.notn = function notn (width) {
    return this.clone().inotn(width);
  };

  // Set `bit` of `this`
  BN.prototype.setn = function setn (bit, val) {
    assert(typeof bit === 'number' && bit >= 0);

    var off = (bit / 26) | 0;
    var wbit = bit % 26;

    this._expand(off + 1);

    if (val) {
      this.words[off] = this.words[off] | (1 << wbit);
    } else {
      this.words[off] = this.words[off] & ~(1 << wbit);
    }

    return this.strip();
  };

  // Add `num` to `this` in-place
  BN.prototype.iadd = function iadd (num) {
    var r;

    // negative + positive
    if (this.negative !== 0 && num.negative === 0) {
      this.negative = 0;
      r = this.isub(num);
      this.negative ^= 1;
      return this._normSign();

    // positive + negative
    } else if (this.negative === 0 && num.negative !== 0) {
      num.negative = 0;
      r = this.isub(num);
      num.negative = 1;
      return r._normSign();
    }

    // a.length > b.length
    var a, b;
    if (this.length > num.length) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    var carry = 0;
    for (var i = 0; i < b.length; i++) {
      r = (a.words[i] | 0) + (b.words[i] | 0) + carry;
      this.words[i] = r & 0x3ffffff;
      carry = r >>> 26;
    }
    for (; carry !== 0 && i < a.length; i++) {
      r = (a.words[i] | 0) + carry;
      this.words[i] = r & 0x3ffffff;
      carry = r >>> 26;
    }

    this.length = a.length;
    if (carry !== 0) {
      this.words[this.length] = carry;
      this.length++;
    // Copy the rest of the words
    } else if (a !== this) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    return this;
  };

  // Add `num` to `this`
  BN.prototype.add = function add (num) {
    var res;
    if (num.negative !== 0 && this.negative === 0) {
      num.negative = 0;
      res = this.sub(num);
      num.negative ^= 1;
      return res;
    } else if (num.negative === 0 && this.negative !== 0) {
      this.negative = 0;
      res = num.sub(this);
      this.negative = 1;
      return res;
    }

    if (this.length > num.length) return this.clone().iadd(num);

    return num.clone().iadd(this);
  };

  // Subtract `num` from `this` in-place
  BN.prototype.isub = function isub (num) {
    // this - (-num) = this + num
    if (num.negative !== 0) {
      num.negative = 0;
      var r = this.iadd(num);
      num.negative = 1;
      return r._normSign();

    // -this - num = -(this + num)
    } else if (this.negative !== 0) {
      this.negative = 0;
      this.iadd(num);
      this.negative = 1;
      return this._normSign();
    }

    // At this point both numbers are positive
    var cmp = this.cmp(num);

    // Optimization - zeroify
    if (cmp === 0) {
      this.negative = 0;
      this.length = 1;
      this.words[0] = 0;
      return this;
    }

    // a > b
    var a, b;
    if (cmp > 0) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    var carry = 0;
    for (var i = 0; i < b.length; i++) {
      r = (a.words[i] | 0) - (b.words[i] | 0) + carry;
      carry = r >> 26;
      this.words[i] = r & 0x3ffffff;
    }
    for (; carry !== 0 && i < a.length; i++) {
      r = (a.words[i] | 0) + carry;
      carry = r >> 26;
      this.words[i] = r & 0x3ffffff;
    }

    // Copy rest of the words
    if (carry === 0 && i < a.length && a !== this) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    this.length = Math.max(this.length, i);

    if (a !== this) {
      this.negative = 1;
    }

    return this.strip();
  };

  // Subtract `num` from `this`
  BN.prototype.sub = function sub (num) {
    return this.clone().isub(num);
  };

  function smallMulTo (self, num, out) {
    out.negative = num.negative ^ self.negative;
    var len = (self.length + num.length) | 0;
    out.length = len;
    len = (len - 1) | 0;

    // Peel one iteration (compiler can't do it, because of code complexity)
    var a = self.words[0] | 0;
    var b = num.words[0] | 0;
    var r = a * b;

    var lo = r & 0x3ffffff;
    var carry = (r / 0x4000000) | 0;
    out.words[0] = lo;

    for (var k = 1; k < len; k++) {
      // Sum all words with the same `i + j = k` and accumulate `ncarry`,
      // note that ncarry could be >= 0x3ffffff
      var ncarry = carry >>> 26;
      var rword = carry & 0x3ffffff;
      var maxJ = Math.min(k, num.length - 1);
      for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
        var i = (k - j) | 0;
        a = self.words[i] | 0;
        b = num.words[j] | 0;
        r = a * b + rword;
        ncarry += (r / 0x4000000) | 0;
        rword = r & 0x3ffffff;
      }
      out.words[k] = rword | 0;
      carry = ncarry | 0;
    }
    if (carry !== 0) {
      out.words[k] = carry | 0;
    } else {
      out.length--;
    }

    return out.strip();
  }

  // TODO(indutny): it may be reasonable to omit it for users who don't need
  // to work with 256-bit numbers, otherwise it gives 20% improvement for 256-bit
  // multiplication (like elliptic secp256k1).
  var comb10MulTo = function comb10MulTo (self, num, out) {
    var a = self.words;
    var b = num.words;
    var o = out.words;
    var c = 0;
    var lo;
    var mid;
    var hi;
    var a0 = a[0] | 0;
    var al0 = a0 & 0x1fff;
    var ah0 = a0 >>> 13;
    var a1 = a[1] | 0;
    var al1 = a1 & 0x1fff;
    var ah1 = a1 >>> 13;
    var a2 = a[2] | 0;
    var al2 = a2 & 0x1fff;
    var ah2 = a2 >>> 13;
    var a3 = a[3] | 0;
    var al3 = a3 & 0x1fff;
    var ah3 = a3 >>> 13;
    var a4 = a[4] | 0;
    var al4 = a4 & 0x1fff;
    var ah4 = a4 >>> 13;
    var a5 = a[5] | 0;
    var al5 = a5 & 0x1fff;
    var ah5 = a5 >>> 13;
    var a6 = a[6] | 0;
    var al6 = a6 & 0x1fff;
    var ah6 = a6 >>> 13;
    var a7 = a[7] | 0;
    var al7 = a7 & 0x1fff;
    var ah7 = a7 >>> 13;
    var a8 = a[8] | 0;
    var al8 = a8 & 0x1fff;
    var ah8 = a8 >>> 13;
    var a9 = a[9] | 0;
    var al9 = a9 & 0x1fff;
    var ah9 = a9 >>> 13;
    var b0 = b[0] | 0;
    var bl0 = b0 & 0x1fff;
    var bh0 = b0 >>> 13;
    var b1 = b[1] | 0;
    var bl1 = b1 & 0x1fff;
    var bh1 = b1 >>> 13;
    var b2 = b[2] | 0;
    var bl2 = b2 & 0x1fff;
    var bh2 = b2 >>> 13;
    var b3 = b[3] | 0;
    var bl3 = b3 & 0x1fff;
    var bh3 = b3 >>> 13;
    var b4 = b[4] | 0;
    var bl4 = b4 & 0x1fff;
    var bh4 = b4 >>> 13;
    var b5 = b[5] | 0;
    var bl5 = b5 & 0x1fff;
    var bh5 = b5 >>> 13;
    var b6 = b[6] | 0;
    var bl6 = b6 & 0x1fff;
    var bh6 = b6 >>> 13;
    var b7 = b[7] | 0;
    var bl7 = b7 & 0x1fff;
    var bh7 = b7 >>> 13;
    var b8 = b[8] | 0;
    var bl8 = b8 & 0x1fff;
    var bh8 = b8 >>> 13;
    var b9 = b[9] | 0;
    var bl9 = b9 & 0x1fff;
    var bh9 = b9 >>> 13;

    out.negative = self.negative ^ num.negative;
    out.length = 19;
    /* k = 0 */
    lo = Math.imul(al0, bl0);
    mid = Math.imul(al0, bh0);
    mid = (mid + Math.imul(ah0, bl0)) | 0;
    hi = Math.imul(ah0, bh0);
    var w0 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w0 >>> 26)) | 0;
    w0 &= 0x3ffffff;
    /* k = 1 */
    lo = Math.imul(al1, bl0);
    mid = Math.imul(al1, bh0);
    mid = (mid + Math.imul(ah1, bl0)) | 0;
    hi = Math.imul(ah1, bh0);
    lo = (lo + Math.imul(al0, bl1)) | 0;
    mid = (mid + Math.imul(al0, bh1)) | 0;
    mid = (mid + Math.imul(ah0, bl1)) | 0;
    hi = (hi + Math.imul(ah0, bh1)) | 0;
    var w1 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w1 >>> 26)) | 0;
    w1 &= 0x3ffffff;
    /* k = 2 */
    lo = Math.imul(al2, bl0);
    mid = Math.imul(al2, bh0);
    mid = (mid + Math.imul(ah2, bl0)) | 0;
    hi = Math.imul(ah2, bh0);
    lo = (lo + Math.imul(al1, bl1)) | 0;
    mid = (mid + Math.imul(al1, bh1)) | 0;
    mid = (mid + Math.imul(ah1, bl1)) | 0;
    hi = (hi + Math.imul(ah1, bh1)) | 0;
    lo = (lo + Math.imul(al0, bl2)) | 0;
    mid = (mid + Math.imul(al0, bh2)) | 0;
    mid = (mid + Math.imul(ah0, bl2)) | 0;
    hi = (hi + Math.imul(ah0, bh2)) | 0;
    var w2 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w2 >>> 26)) | 0;
    w2 &= 0x3ffffff;
    /* k = 3 */
    lo = Math.imul(al3, bl0);
    mid = Math.imul(al3, bh0);
    mid = (mid + Math.imul(ah3, bl0)) | 0;
    hi = Math.imul(ah3, bh0);
    lo = (lo + Math.imul(al2, bl1)) | 0;
    mid = (mid + Math.imul(al2, bh1)) | 0;
    mid = (mid + Math.imul(ah2, bl1)) | 0;
    hi = (hi + Math.imul(ah2, bh1)) | 0;
    lo = (lo + Math.imul(al1, bl2)) | 0;
    mid = (mid + Math.imul(al1, bh2)) | 0;
    mid = (mid + Math.imul(ah1, bl2)) | 0;
    hi = (hi + Math.imul(ah1, bh2)) | 0;
    lo = (lo + Math.imul(al0, bl3)) | 0;
    mid = (mid + Math.imul(al0, bh3)) | 0;
    mid = (mid + Math.imul(ah0, bl3)) | 0;
    hi = (hi + Math.imul(ah0, bh3)) | 0;
    var w3 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w3 >>> 26)) | 0;
    w3 &= 0x3ffffff;
    /* k = 4 */
    lo = Math.imul(al4, bl0);
    mid = Math.imul(al4, bh0);
    mid = (mid + Math.imul(ah4, bl0)) | 0;
    hi = Math.imul(ah4, bh0);
    lo = (lo + Math.imul(al3, bl1)) | 0;
    mid = (mid + Math.imul(al3, bh1)) | 0;
    mid = (mid + Math.imul(ah3, bl1)) | 0;
    hi = (hi + Math.imul(ah3, bh1)) | 0;
    lo = (lo + Math.imul(al2, bl2)) | 0;
    mid = (mid + Math.imul(al2, bh2)) | 0;
    mid = (mid + Math.imul(ah2, bl2)) | 0;
    hi = (hi + Math.imul(ah2, bh2)) | 0;
    lo = (lo + Math.imul(al1, bl3)) | 0;
    mid = (mid + Math.imul(al1, bh3)) | 0;
    mid = (mid + Math.imul(ah1, bl3)) | 0;
    hi = (hi + Math.imul(ah1, bh3)) | 0;
    lo = (lo + Math.imul(al0, bl4)) | 0;
    mid = (mid + Math.imul(al0, bh4)) | 0;
    mid = (mid + Math.imul(ah0, bl4)) | 0;
    hi = (hi + Math.imul(ah0, bh4)) | 0;
    var w4 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w4 >>> 26)) | 0;
    w4 &= 0x3ffffff;
    /* k = 5 */
    lo = Math.imul(al5, bl0);
    mid = Math.imul(al5, bh0);
    mid = (mid + Math.imul(ah5, bl0)) | 0;
    hi = Math.imul(ah5, bh0);
    lo = (lo + Math.imul(al4, bl1)) | 0;
    mid = (mid + Math.imul(al4, bh1)) | 0;
    mid = (mid + Math.imul(ah4, bl1)) | 0;
    hi = (hi + Math.imul(ah4, bh1)) | 0;
    lo = (lo + Math.imul(al3, bl2)) | 0;
    mid = (mid + Math.imul(al3, bh2)) | 0;
    mid = (mid + Math.imul(ah3, bl2)) | 0;
    hi = (hi + Math.imul(ah3, bh2)) | 0;
    lo = (lo + Math.imul(al2, bl3)) | 0;
    mid = (mid + Math.imul(al2, bh3)) | 0;
    mid = (mid + Math.imul(ah2, bl3)) | 0;
    hi = (hi + Math.imul(ah2, bh3)) | 0;
    lo = (lo + Math.imul(al1, bl4)) | 0;
    mid = (mid + Math.imul(al1, bh4)) | 0;
    mid = (mid + Math.imul(ah1, bl4)) | 0;
    hi = (hi + Math.imul(ah1, bh4)) | 0;
    lo = (lo + Math.imul(al0, bl5)) | 0;
    mid = (mid + Math.imul(al0, bh5)) | 0;
    mid = (mid + Math.imul(ah0, bl5)) | 0;
    hi = (hi + Math.imul(ah0, bh5)) | 0;
    var w5 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w5 >>> 26)) | 0;
    w5 &= 0x3ffffff;
    /* k = 6 */
    lo = Math.imul(al6, bl0);
    mid = Math.imul(al6, bh0);
    mid = (mid + Math.imul(ah6, bl0)) | 0;
    hi = Math.imul(ah6, bh0);
    lo = (lo + Math.imul(al5, bl1)) | 0;
    mid = (mid + Math.imul(al5, bh1)) | 0;
    mid = (mid + Math.imul(ah5, bl1)) | 0;
    hi = (hi + Math.imul(ah5, bh1)) | 0;
    lo = (lo + Math.imul(al4, bl2)) | 0;
    mid = (mid + Math.imul(al4, bh2)) | 0;
    mid = (mid + Math.imul(ah4, bl2)) | 0;
    hi = (hi + Math.imul(ah4, bh2)) | 0;
    lo = (lo + Math.imul(al3, bl3)) | 0;
    mid = (mid + Math.imul(al3, bh3)) | 0;
    mid = (mid + Math.imul(ah3, bl3)) | 0;
    hi = (hi + Math.imul(ah3, bh3)) | 0;
    lo = (lo + Math.imul(al2, bl4)) | 0;
    mid = (mid + Math.imul(al2, bh4)) | 0;
    mid = (mid + Math.imul(ah2, bl4)) | 0;
    hi = (hi + Math.imul(ah2, bh4)) | 0;
    lo = (lo + Math.imul(al1, bl5)) | 0;
    mid = (mid + Math.imul(al1, bh5)) | 0;
    mid = (mid + Math.imul(ah1, bl5)) | 0;
    hi = (hi + Math.imul(ah1, bh5)) | 0;
    lo = (lo + Math.imul(al0, bl6)) | 0;
    mid = (mid + Math.imul(al0, bh6)) | 0;
    mid = (mid + Math.imul(ah0, bl6)) | 0;
    hi = (hi + Math.imul(ah0, bh6)) | 0;
    var w6 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w6 >>> 26)) | 0;
    w6 &= 0x3ffffff;
    /* k = 7 */
    lo = Math.imul(al7, bl0);
    mid = Math.imul(al7, bh0);
    mid = (mid + Math.imul(ah7, bl0)) | 0;
    hi = Math.imul(ah7, bh0);
    lo = (lo + Math.imul(al6, bl1)) | 0;
    mid = (mid + Math.imul(al6, bh1)) | 0;
    mid = (mid + Math.imul(ah6, bl1)) | 0;
    hi = (hi + Math.imul(ah6, bh1)) | 0;
    lo = (lo + Math.imul(al5, bl2)) | 0;
    mid = (mid + Math.imul(al5, bh2)) | 0;
    mid = (mid + Math.imul(ah5, bl2)) | 0;
    hi = (hi + Math.imul(ah5, bh2)) | 0;
    lo = (lo + Math.imul(al4, bl3)) | 0;
    mid = (mid + Math.imul(al4, bh3)) | 0;
    mid = (mid + Math.imul(ah4, bl3)) | 0;
    hi = (hi + Math.imul(ah4, bh3)) | 0;
    lo = (lo + Math.imul(al3, bl4)) | 0;
    mid = (mid + Math.imul(al3, bh4)) | 0;
    mid = (mid + Math.imul(ah3, bl4)) | 0;
    hi = (hi + Math.imul(ah3, bh4)) | 0;
    lo = (lo + Math.imul(al2, bl5)) | 0;
    mid = (mid + Math.imul(al2, bh5)) | 0;
    mid = (mid + Math.imul(ah2, bl5)) | 0;
    hi = (hi + Math.imul(ah2, bh5)) | 0;
    lo = (lo + Math.imul(al1, bl6)) | 0;
    mid = (mid + Math.imul(al1, bh6)) | 0;
    mid = (mid + Math.imul(ah1, bl6)) | 0;
    hi = (hi + Math.imul(ah1, bh6)) | 0;
    lo = (lo + Math.imul(al0, bl7)) | 0;
    mid = (mid + Math.imul(al0, bh7)) | 0;
    mid = (mid + Math.imul(ah0, bl7)) | 0;
    hi = (hi + Math.imul(ah0, bh7)) | 0;
    var w7 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w7 >>> 26)) | 0;
    w7 &= 0x3ffffff;
    /* k = 8 */
    lo = Math.imul(al8, bl0);
    mid = Math.imul(al8, bh0);
    mid = (mid + Math.imul(ah8, bl0)) | 0;
    hi = Math.imul(ah8, bh0);
    lo = (lo + Math.imul(al7, bl1)) | 0;
    mid = (mid + Math.imul(al7, bh1)) | 0;
    mid = (mid + Math.imul(ah7, bl1)) | 0;
    hi = (hi + Math.imul(ah7, bh1)) | 0;
    lo = (lo + Math.imul(al6, bl2)) | 0;
    mid = (mid + Math.imul(al6, bh2)) | 0;
    mid = (mid + Math.imul(ah6, bl2)) | 0;
    hi = (hi + Math.imul(ah6, bh2)) | 0;
    lo = (lo + Math.imul(al5, bl3)) | 0;
    mid = (mid + Math.imul(al5, bh3)) | 0;
    mid = (mid + Math.imul(ah5, bl3)) | 0;
    hi = (hi + Math.imul(ah5, bh3)) | 0;
    lo = (lo + Math.imul(al4, bl4)) | 0;
    mid = (mid + Math.imul(al4, bh4)) | 0;
    mid = (mid + Math.imul(ah4, bl4)) | 0;
    hi = (hi + Math.imul(ah4, bh4)) | 0;
    lo = (lo + Math.imul(al3, bl5)) | 0;
    mid = (mid + Math.imul(al3, bh5)) | 0;
    mid = (mid + Math.imul(ah3, bl5)) | 0;
    hi = (hi + Math.imul(ah3, bh5)) | 0;
    lo = (lo + Math.imul(al2, bl6)) | 0;
    mid = (mid + Math.imul(al2, bh6)) | 0;
    mid = (mid + Math.imul(ah2, bl6)) | 0;
    hi = (hi + Math.imul(ah2, bh6)) | 0;
    lo = (lo + Math.imul(al1, bl7)) | 0;
    mid = (mid + Math.imul(al1, bh7)) | 0;
    mid = (mid + Math.imul(ah1, bl7)) | 0;
    hi = (hi + Math.imul(ah1, bh7)) | 0;
    lo = (lo + Math.imul(al0, bl8)) | 0;
    mid = (mid + Math.imul(al0, bh8)) | 0;
    mid = (mid + Math.imul(ah0, bl8)) | 0;
    hi = (hi + Math.imul(ah0, bh8)) | 0;
    var w8 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w8 >>> 26)) | 0;
    w8 &= 0x3ffffff;
    /* k = 9 */
    lo = Math.imul(al9, bl0);
    mid = Math.imul(al9, bh0);
    mid = (mid + Math.imul(ah9, bl0)) | 0;
    hi = Math.imul(ah9, bh0);
    lo = (lo + Math.imul(al8, bl1)) | 0;
    mid = (mid + Math.imul(al8, bh1)) | 0;
    mid = (mid + Math.imul(ah8, bl1)) | 0;
    hi = (hi + Math.imul(ah8, bh1)) | 0;
    lo = (lo + Math.imul(al7, bl2)) | 0;
    mid = (mid + Math.imul(al7, bh2)) | 0;
    mid = (mid + Math.imul(ah7, bl2)) | 0;
    hi = (hi + Math.imul(ah7, bh2)) | 0;
    lo = (lo + Math.imul(al6, bl3)) | 0;
    mid = (mid + Math.imul(al6, bh3)) | 0;
    mid = (mid + Math.imul(ah6, bl3)) | 0;
    hi = (hi + Math.imul(ah6, bh3)) | 0;
    lo = (lo + Math.imul(al5, bl4)) | 0;
    mid = (mid + Math.imul(al5, bh4)) | 0;
    mid = (mid + Math.imul(ah5, bl4)) | 0;
    hi = (hi + Math.imul(ah5, bh4)) | 0;
    lo = (lo + Math.imul(al4, bl5)) | 0;
    mid = (mid + Math.imul(al4, bh5)) | 0;
    mid = (mid + Math.imul(ah4, bl5)) | 0;
    hi = (hi + Math.imul(ah4, bh5)) | 0;
    lo = (lo + Math.imul(al3, bl6)) | 0;
    mid = (mid + Math.imul(al3, bh6)) | 0;
    mid = (mid + Math.imul(ah3, bl6)) | 0;
    hi = (hi + Math.imul(ah3, bh6)) | 0;
    lo = (lo + Math.imul(al2, bl7)) | 0;
    mid = (mid + Math.imul(al2, bh7)) | 0;
    mid = (mid + Math.imul(ah2, bl7)) | 0;
    hi = (hi + Math.imul(ah2, bh7)) | 0;
    lo = (lo + Math.imul(al1, bl8)) | 0;
    mid = (mid + Math.imul(al1, bh8)) | 0;
    mid = (mid + Math.imul(ah1, bl8)) | 0;
    hi = (hi + Math.imul(ah1, bh8)) | 0;
    lo = (lo + Math.imul(al0, bl9)) | 0;
    mid = (mid + Math.imul(al0, bh9)) | 0;
    mid = (mid + Math.imul(ah0, bl9)) | 0;
    hi = (hi + Math.imul(ah0, bh9)) | 0;
    var w9 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w9 >>> 26)) | 0;
    w9 &= 0x3ffffff;
    /* k = 10 */
    lo = Math.imul(al9, bl1);
    mid = Math.imul(al9, bh1);
    mid = (mid + Math.imul(ah9, bl1)) | 0;
    hi = Math.imul(ah9, bh1);
    lo = (lo + Math.imul(al8, bl2)) | 0;
    mid = (mid + Math.imul(al8, bh2)) | 0;
    mid = (mid + Math.imul(ah8, bl2)) | 0;
    hi = (hi + Math.imul(ah8, bh2)) | 0;
    lo = (lo + Math.imul(al7, bl3)) | 0;
    mid = (mid + Math.imul(al7, bh3)) | 0;
    mid = (mid + Math.imul(ah7, bl3)) | 0;
    hi = (hi + Math.imul(ah7, bh3)) | 0;
    lo = (lo + Math.imul(al6, bl4)) | 0;
    mid = (mid + Math.imul(al6, bh4)) | 0;
    mid = (mid + Math.imul(ah6, bl4)) | 0;
    hi = (hi + Math.imul(ah6, bh4)) | 0;
    lo = (lo + Math.imul(al5, bl5)) | 0;
    mid = (mid + Math.imul(al5, bh5)) | 0;
    mid = (mid + Math.imul(ah5, bl5)) | 0;
    hi = (hi + Math.imul(ah5, bh5)) | 0;
    lo = (lo + Math.imul(al4, bl6)) | 0;
    mid = (mid + Math.imul(al4, bh6)) | 0;
    mid = (mid + Math.imul(ah4, bl6)) | 0;
    hi = (hi + Math.imul(ah4, bh6)) | 0;
    lo = (lo + Math.imul(al3, bl7)) | 0;
    mid = (mid + Math.imul(al3, bh7)) | 0;
    mid = (mid + Math.imul(ah3, bl7)) | 0;
    hi = (hi + Math.imul(ah3, bh7)) | 0;
    lo = (lo + Math.imul(al2, bl8)) | 0;
    mid = (mid + Math.imul(al2, bh8)) | 0;
    mid = (mid + Math.imul(ah2, bl8)) | 0;
    hi = (hi + Math.imul(ah2, bh8)) | 0;
    lo = (lo + Math.imul(al1, bl9)) | 0;
    mid = (mid + Math.imul(al1, bh9)) | 0;
    mid = (mid + Math.imul(ah1, bl9)) | 0;
    hi = (hi + Math.imul(ah1, bh9)) | 0;
    var w10 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w10 >>> 26)) | 0;
    w10 &= 0x3ffffff;
    /* k = 11 */
    lo = Math.imul(al9, bl2);
    mid = Math.imul(al9, bh2);
    mid = (mid + Math.imul(ah9, bl2)) | 0;
    hi = Math.imul(ah9, bh2);
    lo = (lo + Math.imul(al8, bl3)) | 0;
    mid = (mid + Math.imul(al8, bh3)) | 0;
    mid = (mid + Math.imul(ah8, bl3)) | 0;
    hi = (hi + Math.imul(ah8, bh3)) | 0;
    lo = (lo + Math.imul(al7, bl4)) | 0;
    mid = (mid + Math.imul(al7, bh4)) | 0;
    mid = (mid + Math.imul(ah7, bl4)) | 0;
    hi = (hi + Math.imul(ah7, bh4)) | 0;
    lo = (lo + Math.imul(al6, bl5)) | 0;
    mid = (mid + Math.imul(al6, bh5)) | 0;
    mid = (mid + Math.imul(ah6, bl5)) | 0;
    hi = (hi + Math.imul(ah6, bh5)) | 0;
    lo = (lo + Math.imul(al5, bl6)) | 0;
    mid = (mid + Math.imul(al5, bh6)) | 0;
    mid = (mid + Math.imul(ah5, bl6)) | 0;
    hi = (hi + Math.imul(ah5, bh6)) | 0;
    lo = (lo + Math.imul(al4, bl7)) | 0;
    mid = (mid + Math.imul(al4, bh7)) | 0;
    mid = (mid + Math.imul(ah4, bl7)) | 0;
    hi = (hi + Math.imul(ah4, bh7)) | 0;
    lo = (lo + Math.imul(al3, bl8)) | 0;
    mid = (mid + Math.imul(al3, bh8)) | 0;
    mid = (mid + Math.imul(ah3, bl8)) | 0;
    hi = (hi + Math.imul(ah3, bh8)) | 0;
    lo = (lo + Math.imul(al2, bl9)) | 0;
    mid = (mid + Math.imul(al2, bh9)) | 0;
    mid = (mid + Math.imul(ah2, bl9)) | 0;
    hi = (hi + Math.imul(ah2, bh9)) | 0;
    var w11 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w11 >>> 26)) | 0;
    w11 &= 0x3ffffff;
    /* k = 12 */
    lo = Math.imul(al9, bl3);
    mid = Math.imul(al9, bh3);
    mid = (mid + Math.imul(ah9, bl3)) | 0;
    hi = Math.imul(ah9, bh3);
    lo = (lo + Math.imul(al8, bl4)) | 0;
    mid = (mid + Math.imul(al8, bh4)) | 0;
    mid = (mid + Math.imul(ah8, bl4)) | 0;
    hi = (hi + Math.imul(ah8, bh4)) | 0;
    lo = (lo + Math.imul(al7, bl5)) | 0;
    mid = (mid + Math.imul(al7, bh5)) | 0;
    mid = (mid + Math.imul(ah7, bl5)) | 0;
    hi = (hi + Math.imul(ah7, bh5)) | 0;
    lo = (lo + Math.imul(al6, bl6)) | 0;
    mid = (mid + Math.imul(al6, bh6)) | 0;
    mid = (mid + Math.imul(ah6, bl6)) | 0;
    hi = (hi + Math.imul(ah6, bh6)) | 0;
    lo = (lo + Math.imul(al5, bl7)) | 0;
    mid = (mid + Math.imul(al5, bh7)) | 0;
    mid = (mid + Math.imul(ah5, bl7)) | 0;
    hi = (hi + Math.imul(ah5, bh7)) | 0;
    lo = (lo + Math.imul(al4, bl8)) | 0;
    mid = (mid + Math.imul(al4, bh8)) | 0;
    mid = (mid + Math.imul(ah4, bl8)) | 0;
    hi = (hi + Math.imul(ah4, bh8)) | 0;
    lo = (lo + Math.imul(al3, bl9)) | 0;
    mid = (mid + Math.imul(al3, bh9)) | 0;
    mid = (mid + Math.imul(ah3, bl9)) | 0;
    hi = (hi + Math.imul(ah3, bh9)) | 0;
    var w12 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w12 >>> 26)) | 0;
    w12 &= 0x3ffffff;
    /* k = 13 */
    lo = Math.imul(al9, bl4);
    mid = Math.imul(al9, bh4);
    mid = (mid + Math.imul(ah9, bl4)) | 0;
    hi = Math.imul(ah9, bh4);
    lo = (lo + Math.imul(al8, bl5)) | 0;
    mid = (mid + Math.imul(al8, bh5)) | 0;
    mid = (mid + Math.imul(ah8, bl5)) | 0;
    hi = (hi + Math.imul(ah8, bh5)) | 0;
    lo = (lo + Math.imul(al7, bl6)) | 0;
    mid = (mid + Math.imul(al7, bh6)) | 0;
    mid = (mid + Math.imul(ah7, bl6)) | 0;
    hi = (hi + Math.imul(ah7, bh6)) | 0;
    lo = (lo + Math.imul(al6, bl7)) | 0;
    mid = (mid + Math.imul(al6, bh7)) | 0;
    mid = (mid + Math.imul(ah6, bl7)) | 0;
    hi = (hi + Math.imul(ah6, bh7)) | 0;
    lo = (lo + Math.imul(al5, bl8)) | 0;
    mid = (mid + Math.imul(al5, bh8)) | 0;
    mid = (mid + Math.imul(ah5, bl8)) | 0;
    hi = (hi + Math.imul(ah5, bh8)) | 0;
    lo = (lo + Math.imul(al4, bl9)) | 0;
    mid = (mid + Math.imul(al4, bh9)) | 0;
    mid = (mid + Math.imul(ah4, bl9)) | 0;
    hi = (hi + Math.imul(ah4, bh9)) | 0;
    var w13 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w13 >>> 26)) | 0;
    w13 &= 0x3ffffff;
    /* k = 14 */
    lo = Math.imul(al9, bl5);
    mid = Math.imul(al9, bh5);
    mid = (mid + Math.imul(ah9, bl5)) | 0;
    hi = Math.imul(ah9, bh5);
    lo = (lo + Math.imul(al8, bl6)) | 0;
    mid = (mid + Math.imul(al8, bh6)) | 0;
    mid = (mid + Math.imul(ah8, bl6)) | 0;
    hi = (hi + Math.imul(ah8, bh6)) | 0;
    lo = (lo + Math.imul(al7, bl7)) | 0;
    mid = (mid + Math.imul(al7, bh7)) | 0;
    mid = (mid + Math.imul(ah7, bl7)) | 0;
    hi = (hi + Math.imul(ah7, bh7)) | 0;
    lo = (lo + Math.imul(al6, bl8)) | 0;
    mid = (mid + Math.imul(al6, bh8)) | 0;
    mid = (mid + Math.imul(ah6, bl8)) | 0;
    hi = (hi + Math.imul(ah6, bh8)) | 0;
    lo = (lo + Math.imul(al5, bl9)) | 0;
    mid = (mid + Math.imul(al5, bh9)) | 0;
    mid = (mid + Math.imul(ah5, bl9)) | 0;
    hi = (hi + Math.imul(ah5, bh9)) | 0;
    var w14 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w14 >>> 26)) | 0;
    w14 &= 0x3ffffff;
    /* k = 15 */
    lo = Math.imul(al9, bl6);
    mid = Math.imul(al9, bh6);
    mid = (mid + Math.imul(ah9, bl6)) | 0;
    hi = Math.imul(ah9, bh6);
    lo = (lo + Math.imul(al8, bl7)) | 0;
    mid = (mid + Math.imul(al8, bh7)) | 0;
    mid = (mid + Math.imul(ah8, bl7)) | 0;
    hi = (hi + Math.imul(ah8, bh7)) | 0;
    lo = (lo + Math.imul(al7, bl8)) | 0;
    mid = (mid + Math.imul(al7, bh8)) | 0;
    mid = (mid + Math.imul(ah7, bl8)) | 0;
    hi = (hi + Math.imul(ah7, bh8)) | 0;
    lo = (lo + Math.imul(al6, bl9)) | 0;
    mid = (mid + Math.imul(al6, bh9)) | 0;
    mid = (mid + Math.imul(ah6, bl9)) | 0;
    hi = (hi + Math.imul(ah6, bh9)) | 0;
    var w15 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w15 >>> 26)) | 0;
    w15 &= 0x3ffffff;
    /* k = 16 */
    lo = Math.imul(al9, bl7);
    mid = Math.imul(al9, bh7);
    mid = (mid + Math.imul(ah9, bl7)) | 0;
    hi = Math.imul(ah9, bh7);
    lo = (lo + Math.imul(al8, bl8)) | 0;
    mid = (mid + Math.imul(al8, bh8)) | 0;
    mid = (mid + Math.imul(ah8, bl8)) | 0;
    hi = (hi + Math.imul(ah8, bh8)) | 0;
    lo = (lo + Math.imul(al7, bl9)) | 0;
    mid = (mid + Math.imul(al7, bh9)) | 0;
    mid = (mid + Math.imul(ah7, bl9)) | 0;
    hi = (hi + Math.imul(ah7, bh9)) | 0;
    var w16 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w16 >>> 26)) | 0;
    w16 &= 0x3ffffff;
    /* k = 17 */
    lo = Math.imul(al9, bl8);
    mid = Math.imul(al9, bh8);
    mid = (mid + Math.imul(ah9, bl8)) | 0;
    hi = Math.imul(ah9, bh8);
    lo = (lo + Math.imul(al8, bl9)) | 0;
    mid = (mid + Math.imul(al8, bh9)) | 0;
    mid = (mid + Math.imul(ah8, bl9)) | 0;
    hi = (hi + Math.imul(ah8, bh9)) | 0;
    var w17 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w17 >>> 26)) | 0;
    w17 &= 0x3ffffff;
    /* k = 18 */
    lo = Math.imul(al9, bl9);
    mid = Math.imul(al9, bh9);
    mid = (mid + Math.imul(ah9, bl9)) | 0;
    hi = Math.imul(ah9, bh9);
    var w18 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w18 >>> 26)) | 0;
    w18 &= 0x3ffffff;
    o[0] = w0;
    o[1] = w1;
    o[2] = w2;
    o[3] = w3;
    o[4] = w4;
    o[5] = w5;
    o[6] = w6;
    o[7] = w7;
    o[8] = w8;
    o[9] = w9;
    o[10] = w10;
    o[11] = w11;
    o[12] = w12;
    o[13] = w13;
    o[14] = w14;
    o[15] = w15;
    o[16] = w16;
    o[17] = w17;
    o[18] = w18;
    if (c !== 0) {
      o[19] = c;
      out.length++;
    }
    return out;
  };

  // Polyfill comb
  if (!Math.imul) {
    comb10MulTo = smallMulTo;
  }

  function bigMulTo (self, num, out) {
    out.negative = num.negative ^ self.negative;
    out.length = self.length + num.length;

    var carry = 0;
    var hncarry = 0;
    for (var k = 0; k < out.length - 1; k++) {
      // Sum all words with the same `i + j = k` and accumulate `ncarry`,
      // note that ncarry could be >= 0x3ffffff
      var ncarry = hncarry;
      hncarry = 0;
      var rword = carry & 0x3ffffff;
      var maxJ = Math.min(k, num.length - 1);
      for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
        var i = k - j;
        var a = self.words[i] | 0;
        var b = num.words[j] | 0;
        var r = a * b;

        var lo = r & 0x3ffffff;
        ncarry = (ncarry + ((r / 0x4000000) | 0)) | 0;
        lo = (lo + rword) | 0;
        rword = lo & 0x3ffffff;
        ncarry = (ncarry + (lo >>> 26)) | 0;

        hncarry += ncarry >>> 26;
        ncarry &= 0x3ffffff;
      }
      out.words[k] = rword;
      carry = ncarry;
      ncarry = hncarry;
    }
    if (carry !== 0) {
      out.words[k] = carry;
    } else {
      out.length--;
    }

    return out.strip();
  }

  function jumboMulTo (self, num, out) {
    var fftm = new FFTM();
    return fftm.mulp(self, num, out);
  }

  BN.prototype.mulTo = function mulTo (num, out) {
    var res;
    var len = this.length + num.length;
    if (this.length === 10 && num.length === 10) {
      res = comb10MulTo(this, num, out);
    } else if (len < 63) {
      res = smallMulTo(this, num, out);
    } else if (len < 1024) {
      res = bigMulTo(this, num, out);
    } else {
      res = jumboMulTo(this, num, out);
    }

    return res;
  };

  // Cooley-Tukey algorithm for FFT
  // slightly revisited to rely on looping instead of recursion

  function FFTM (x, y) {
    this.x = x;
    this.y = y;
  }

  FFTM.prototype.makeRBT = function makeRBT (N) {
    var t = new Array(N);
    var l = BN.prototype._countBits(N) - 1;
    for (var i = 0; i < N; i++) {
      t[i] = this.revBin(i, l, N);
    }

    return t;
  };

  // Returns binary-reversed representation of `x`
  FFTM.prototype.revBin = function revBin (x, l, N) {
    if (x === 0 || x === N - 1) return x;

    var rb = 0;
    for (var i = 0; i < l; i++) {
      rb |= (x & 1) << (l - i - 1);
      x >>= 1;
    }

    return rb;
  };

  // Performs "tweedling" phase, therefore 'emulating'
  // behaviour of the recursive algorithm
  FFTM.prototype.permute = function permute (rbt, rws, iws, rtws, itws, N) {
    for (var i = 0; i < N; i++) {
      rtws[i] = rws[rbt[i]];
      itws[i] = iws[rbt[i]];
    }
  };

  FFTM.prototype.transform = function transform (rws, iws, rtws, itws, N, rbt) {
    this.permute(rbt, rws, iws, rtws, itws, N);

    for (var s = 1; s < N; s <<= 1) {
      var l = s << 1;

      var rtwdf = Math.cos(2 * Math.PI / l);
      var itwdf = Math.sin(2 * Math.PI / l);

      for (var p = 0; p < N; p += l) {
        var rtwdf_ = rtwdf;
        var itwdf_ = itwdf;

        for (var j = 0; j < s; j++) {
          var re = rtws[p + j];
          var ie = itws[p + j];

          var ro = rtws[p + j + s];
          var io = itws[p + j + s];

          var rx = rtwdf_ * ro - itwdf_ * io;

          io = rtwdf_ * io + itwdf_ * ro;
          ro = rx;

          rtws[p + j] = re + ro;
          itws[p + j] = ie + io;

          rtws[p + j + s] = re - ro;
          itws[p + j + s] = ie - io;

          /* jshint maxdepth : false */
          if (j !== l) {
            rx = rtwdf * rtwdf_ - itwdf * itwdf_;

            itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_;
            rtwdf_ = rx;
          }
        }
      }
    }
  };

  FFTM.prototype.guessLen13b = function guessLen13b (n, m) {
    var N = Math.max(m, n) | 1;
    var odd = N & 1;
    var i = 0;
    for (N = N / 2 | 0; N; N = N >>> 1) {
      i++;
    }

    return 1 << i + 1 + odd;
  };

  FFTM.prototype.conjugate = function conjugate (rws, iws, N) {
    if (N <= 1) return;

    for (var i = 0; i < N / 2; i++) {
      var t = rws[i];

      rws[i] = rws[N - i - 1];
      rws[N - i - 1] = t;

      t = iws[i];

      iws[i] = -iws[N - i - 1];
      iws[N - i - 1] = -t;
    }
  };

  FFTM.prototype.normalize13b = function normalize13b (ws, N) {
    var carry = 0;
    for (var i = 0; i < N / 2; i++) {
      var w = Math.round(ws[2 * i + 1] / N) * 0x2000 +
        Math.round(ws[2 * i] / N) +
        carry;

      ws[i] = w & 0x3ffffff;

      if (w < 0x4000000) {
        carry = 0;
      } else {
        carry = w / 0x4000000 | 0;
      }
    }

    return ws;
  };

  FFTM.prototype.convert13b = function convert13b (ws, len, rws, N) {
    var carry = 0;
    for (var i = 0; i < len; i++) {
      carry = carry + (ws[i] | 0);

      rws[2 * i] = carry & 0x1fff; carry = carry >>> 13;
      rws[2 * i + 1] = carry & 0x1fff; carry = carry >>> 13;
    }

    // Pad with zeroes
    for (i = 2 * len; i < N; ++i) {
      rws[i] = 0;
    }

    assert(carry === 0);
    assert((carry & ~0x1fff) === 0);
  };

  FFTM.prototype.stub = function stub (N) {
    var ph = new Array(N);
    for (var i = 0; i < N; i++) {
      ph[i] = 0;
    }

    return ph;
  };

  FFTM.prototype.mulp = function mulp (x, y, out) {
    var N = 2 * this.guessLen13b(x.length, y.length);

    var rbt = this.makeRBT(N);

    var _ = this.stub(N);

    var rws = new Array(N);
    var rwst = new Array(N);
    var iwst = new Array(N);

    var nrws = new Array(N);
    var nrwst = new Array(N);
    var niwst = new Array(N);

    var rmws = out.words;
    rmws.length = N;

    this.convert13b(x.words, x.length, rws, N);
    this.convert13b(y.words, y.length, nrws, N);

    this.transform(rws, _, rwst, iwst, N, rbt);
    this.transform(nrws, _, nrwst, niwst, N, rbt);

    for (var i = 0; i < N; i++) {
      var rx = rwst[i] * nrwst[i] - iwst[i] * niwst[i];
      iwst[i] = rwst[i] * niwst[i] + iwst[i] * nrwst[i];
      rwst[i] = rx;
    }

    this.conjugate(rwst, iwst, N);
    this.transform(rwst, iwst, rmws, _, N, rbt);
    this.conjugate(rmws, _, N);
    this.normalize13b(rmws, N);

    out.negative = x.negative ^ y.negative;
    out.length = x.length + y.length;
    return out.strip();
  };

  // Multiply `this` by `num`
  BN.prototype.mul = function mul (num) {
    var out = new BN(null);
    out.words = new Array(this.length + num.length);
    return this.mulTo(num, out);
  };

  // Multiply employing FFT
  BN.prototype.mulf = function mulf (num) {
    var out = new BN(null);
    out.words = new Array(this.length + num.length);
    return jumboMulTo(this, num, out);
  };

  // In-place Multiplication
  BN.prototype.imul = function imul (num) {
    return this.clone().mulTo(num, this);
  };

  BN.prototype.imuln = function imuln (num) {
    assert(typeof num === 'number');
    assert(num < 0x4000000);

    // Carry
    var carry = 0;
    for (var i = 0; i < this.length; i++) {
      var w = (this.words[i] | 0) * num;
      var lo = (w & 0x3ffffff) + (carry & 0x3ffffff);
      carry >>= 26;
      carry += (w / 0x4000000) | 0;
      // NOTE: lo is 27bit maximum
      carry += lo >>> 26;
      this.words[i] = lo & 0x3ffffff;
    }

    if (carry !== 0) {
      this.words[i] = carry;
      this.length++;
    }

    return this;
  };

  BN.prototype.muln = function muln (num) {
    return this.clone().imuln(num);
  };

  // `this` * `this`
  BN.prototype.sqr = function sqr () {
    return this.mul(this);
  };

  // `this` * `this` in-place
  BN.prototype.isqr = function isqr () {
    return this.imul(this.clone());
  };

  // Math.pow(`this`, `num`)
  BN.prototype.pow = function pow (num) {
    var w = toBitArray(num);
    if (w.length === 0) return new BN(1);

    // Skip leading zeroes
    var res = this;
    for (var i = 0; i < w.length; i++, res = res.sqr()) {
      if (w[i] !== 0) break;
    }

    if (++i < w.length) {
      for (var q = res.sqr(); i < w.length; i++, q = q.sqr()) {
        if (w[i] === 0) continue;

        res = res.mul(q);
      }
    }

    return res;
  };

  // Shift-left in-place
  BN.prototype.iushln = function iushln (bits) {
    assert(typeof bits === 'number' && bits >= 0);
    var r = bits % 26;
    var s = (bits - r) / 26;
    var carryMask = (0x3ffffff >>> (26 - r)) << (26 - r);
    var i;

    if (r !== 0) {
      var carry = 0;

      for (i = 0; i < this.length; i++) {
        var newCarry = this.words[i] & carryMask;
        var c = ((this.words[i] | 0) - newCarry) << r;
        this.words[i] = c | carry;
        carry = newCarry >>> (26 - r);
      }

      if (carry) {
        this.words[i] = carry;
        this.length++;
      }
    }

    if (s !== 0) {
      for (i = this.length - 1; i >= 0; i--) {
        this.words[i + s] = this.words[i];
      }

      for (i = 0; i < s; i++) {
        this.words[i] = 0;
      }

      this.length += s;
    }

    return this.strip();
  };

  BN.prototype.ishln = function ishln (bits) {
    // TODO(indutny): implement me
    assert(this.negative === 0);
    return this.iushln(bits);
  };

  // Shift-right in-place
  // NOTE: `hint` is a lowest bit before trailing zeroes
  // NOTE: if `extended` is present - it will be filled with destroyed bits
  BN.prototype.iushrn = function iushrn (bits, hint, extended) {
    assert(typeof bits === 'number' && bits >= 0);
    var h;
    if (hint) {
      h = (hint - (hint % 26)) / 26;
    } else {
      h = 0;
    }

    var r = bits % 26;
    var s = Math.min((bits - r) / 26, this.length);
    var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
    var maskedWords = extended;

    h -= s;
    h = Math.max(0, h);

    // Extended mode, copy masked part
    if (maskedWords) {
      for (var i = 0; i < s; i++) {
        maskedWords.words[i] = this.words[i];
      }
      maskedWords.length = s;
    }

    if (s === 0) {
      // No-op, we should not move anything at all
    } else if (this.length > s) {
      this.length -= s;
      for (i = 0; i < this.length; i++) {
        this.words[i] = this.words[i + s];
      }
    } else {
      this.words[0] = 0;
      this.length = 1;
    }

    var carry = 0;
    for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h); i--) {
      var word = this.words[i] | 0;
      this.words[i] = (carry << (26 - r)) | (word >>> r);
      carry = word & mask;
    }

    // Push carried bits as a mask
    if (maskedWords && carry !== 0) {
      maskedWords.words[maskedWords.length++] = carry;
    }

    if (this.length === 0) {
      this.words[0] = 0;
      this.length = 1;
    }

    return this.strip();
  };

  BN.prototype.ishrn = function ishrn (bits, hint, extended) {
    // TODO(indutny): implement me
    assert(this.negative === 0);
    return this.iushrn(bits, hint, extended);
  };

  // Shift-left
  BN.prototype.shln = function shln (bits) {
    return this.clone().ishln(bits);
  };

  BN.prototype.ushln = function ushln (bits) {
    return this.clone().iushln(bits);
  };

  // Shift-right
  BN.prototype.shrn = function shrn (bits) {
    return this.clone().ishrn(bits);
  };

  BN.prototype.ushrn = function ushrn (bits) {
    return this.clone().iushrn(bits);
  };

  // Test if n bit is set
  BN.prototype.testn = function testn (bit) {
    assert(typeof bit === 'number' && bit >= 0);
    var r = bit % 26;
    var s = (bit - r) / 26;
    var q = 1 << r;

    // Fast case: bit is much higher than all existing words
    if (this.length <= s) return false;

    // Check bit and return
    var w = this.words[s];

    return !!(w & q);
  };

  // Return only lowers bits of number (in-place)
  BN.prototype.imaskn = function imaskn (bits) {
    assert(typeof bits === 'number' && bits >= 0);
    var r = bits % 26;
    var s = (bits - r) / 26;

    assert(this.negative === 0, 'imaskn works only with positive numbers');

    if (this.length <= s) {
      return this;
    }

    if (r !== 0) {
      s++;
    }
    this.length = Math.min(s, this.length);

    if (r !== 0) {
      var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
      this.words[this.length - 1] &= mask;
    }

    return this.strip();
  };

  // Return only lowers bits of number
  BN.prototype.maskn = function maskn (bits) {
    return this.clone().imaskn(bits);
  };

  // Add plain number `num` to `this`
  BN.prototype.iaddn = function iaddn (num) {
    assert(typeof num === 'number');
    assert(num < 0x4000000);
    if (num < 0) return this.isubn(-num);

    // Possible sign change
    if (this.negative !== 0) {
      if (this.length === 1 && (this.words[0] | 0) < num) {
        this.words[0] = num - (this.words[0] | 0);
        this.negative = 0;
        return this;
      }

      this.negative = 0;
      this.isubn(num);
      this.negative = 1;
      return this;
    }

    // Add without checks
    return this._iaddn(num);
  };

  BN.prototype._iaddn = function _iaddn (num) {
    this.words[0] += num;

    // Carry
    for (var i = 0; i < this.length && this.words[i] >= 0x4000000; i++) {
      this.words[i] -= 0x4000000;
      if (i === this.length - 1) {
        this.words[i + 1] = 1;
      } else {
        this.words[i + 1]++;
      }
    }
    this.length = Math.max(this.length, i + 1);

    return this;
  };

  // Subtract plain number `num` from `this`
  BN.prototype.isubn = function isubn (num) {
    assert(typeof num === 'number');
    assert(num < 0x4000000);
    if (num < 0) return this.iaddn(-num);

    if (this.negative !== 0) {
      this.negative = 0;
      this.iaddn(num);
      this.negative = 1;
      return this;
    }

    this.words[0] -= num;

    if (this.length === 1 && this.words[0] < 0) {
      this.words[0] = -this.words[0];
      this.negative = 1;
    } else {
      // Carry
      for (var i = 0; i < this.length && this.words[i] < 0; i++) {
        this.words[i] += 0x4000000;
        this.words[i + 1] -= 1;
      }
    }

    return this.strip();
  };

  BN.prototype.addn = function addn (num) {
    return this.clone().iaddn(num);
  };

  BN.prototype.subn = function subn (num) {
    return this.clone().isubn(num);
  };

  BN.prototype.iabs = function iabs () {
    this.negative = 0;

    return this;
  };

  BN.prototype.abs = function abs () {
    return this.clone().iabs();
  };

  BN.prototype._ishlnsubmul = function _ishlnsubmul (num, mul, shift) {
    var len = num.length + shift;
    var i;

    this._expand(len);

    var w;
    var carry = 0;
    for (i = 0; i < num.length; i++) {
      w = (this.words[i + shift] | 0) + carry;
      var right = (num.words[i] | 0) * mul;
      w -= right & 0x3ffffff;
      carry = (w >> 26) - ((right / 0x4000000) | 0);
      this.words[i + shift] = w & 0x3ffffff;
    }
    for (; i < this.length - shift; i++) {
      w = (this.words[i + shift] | 0) + carry;
      carry = w >> 26;
      this.words[i + shift] = w & 0x3ffffff;
    }

    if (carry === 0) return this.strip();

    // Subtraction overflow
    assert(carry === -1);
    carry = 0;
    for (i = 0; i < this.length; i++) {
      w = -(this.words[i] | 0) + carry;
      carry = w >> 26;
      this.words[i] = w & 0x3ffffff;
    }
    this.negative = 1;

    return this.strip();
  };

  BN.prototype._wordDiv = function _wordDiv (num, mode) {
    var shift = this.length - num.length;

    var a = this.clone();
    var b = num;

    // Normalize
    var bhi = b.words[b.length - 1] | 0;
    var bhiBits = this._countBits(bhi);
    shift = 26 - bhiBits;
    if (shift !== 0) {
      b = b.ushln(shift);
      a.iushln(shift);
      bhi = b.words[b.length - 1] | 0;
    }

    // Initialize quotient
    var m = a.length - b.length;
    var q;

    if (mode !== 'mod') {
      q = new BN(null);
      q.length = m + 1;
      q.words = new Array(q.length);
      for (var i = 0; i < q.length; i++) {
        q.words[i] = 0;
      }
    }

    var diff = a.clone()._ishlnsubmul(b, 1, m);
    if (diff.negative === 0) {
      a = diff;
      if (q) {
        q.words[m] = 1;
      }
    }

    for (var j = m - 1; j >= 0; j--) {
      var qj = (a.words[b.length + j] | 0) * 0x4000000 +
        (a.words[b.length + j - 1] | 0);

      // NOTE: (qj / bhi) is (0x3ffffff * 0x4000000 + 0x3ffffff) / 0x2000000 max
      // (0x7ffffff)
      qj = Math.min((qj / bhi) | 0, 0x3ffffff);

      a._ishlnsubmul(b, qj, j);
      while (a.negative !== 0) {
        qj--;
        a.negative = 0;
        a._ishlnsubmul(b, 1, j);
        if (!a.isZero()) {
          a.negative ^= 1;
        }
      }
      if (q) {
        q.words[j] = qj;
      }
    }
    if (q) {
      q.strip();
    }
    a.strip();

    // Denormalize
    if (mode !== 'div' && shift !== 0) {
      a.iushrn(shift);
    }

    return {
      div: q || null,
      mod: a
    };
  };

  // NOTE: 1) `mode` can be set to `mod` to request mod only,
  //       to `div` to request div only, or be absent to
  //       request both div & mod
  //       2) `positive` is true if unsigned mod is requested
  BN.prototype.divmod = function divmod (num, mode, positive) {
    assert(!num.isZero());

    if (this.isZero()) {
      return {
        div: new BN(0),
        mod: new BN(0)
      };
    }

    var div, mod, res;
    if (this.negative !== 0 && num.negative === 0) {
      res = this.neg().divmod(num, mode);

      if (mode !== 'mod') {
        div = res.div.neg();
      }

      if (mode !== 'div') {
        mod = res.mod.neg();
        if (positive && mod.negative !== 0) {
          mod.iadd(num);
        }
      }

      return {
        div: div,
        mod: mod
      };
    }

    if (this.negative === 0 && num.negative !== 0) {
      res = this.divmod(num.neg(), mode);

      if (mode !== 'mod') {
        div = res.div.neg();
      }

      return {
        div: div,
        mod: res.mod
      };
    }

    if ((this.negative & num.negative) !== 0) {
      res = this.neg().divmod(num.neg(), mode);

      if (mode !== 'div') {
        mod = res.mod.neg();
        if (positive && mod.negative !== 0) {
          mod.isub(num);
        }
      }

      return {
        div: res.div,
        mod: mod
      };
    }

    // Both numbers are positive at this point

    // Strip both numbers to approximate shift value
    if (num.length > this.length || this.cmp(num) < 0) {
      return {
        div: new BN(0),
        mod: this
      };
    }

    // Very short reduction
    if (num.length === 1) {
      if (mode === 'div') {
        return {
          div: this.divn(num.words[0]),
          mod: null
        };
      }

      if (mode === 'mod') {
        return {
          div: null,
          mod: new BN(this.modn(num.words[0]))
        };
      }

      return {
        div: this.divn(num.words[0]),
        mod: new BN(this.modn(num.words[0]))
      };
    }

    return this._wordDiv(num, mode);
  };

  // Find `this` / `num`
  BN.prototype.div = function div (num) {
    return this.divmod(num, 'div', false).div;
  };

  // Find `this` % `num`
  BN.prototype.mod = function mod (num) {
    return this.divmod(num, 'mod', false).mod;
  };

  BN.prototype.umod = function umod (num) {
    return this.divmod(num, 'mod', true).mod;
  };

  // Find Round(`this` / `num`)
  BN.prototype.divRound = function divRound (num) {
    var dm = this.divmod(num);

    // Fast case - exact division
    if (dm.mod.isZero()) return dm.div;

    var mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;

    var half = num.ushrn(1);
    var r2 = num.andln(1);
    var cmp = mod.cmp(half);

    // Round down
    if (cmp < 0 || r2 === 1 && cmp === 0) return dm.div;

    // Round up
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  };

  BN.prototype.modn = function modn (num) {
    assert(num <= 0x3ffffff);
    var p = (1 << 26) % num;

    var acc = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      acc = (p * acc + (this.words[i] | 0)) % num;
    }

    return acc;
  };

  // In-place division by number
  BN.prototype.idivn = function idivn (num) {
    assert(num <= 0x3ffffff);

    var carry = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      var w = (this.words[i] | 0) + carry * 0x4000000;
      this.words[i] = (w / num) | 0;
      carry = w % num;
    }

    return this.strip();
  };

  BN.prototype.divn = function divn (num) {
    return this.clone().idivn(num);
  };

  BN.prototype.egcd = function egcd (p) {
    assert(p.negative === 0);
    assert(!p.isZero());

    var x = this;
    var y = p.clone();

    if (x.negative !== 0) {
      x = x.umod(p);
    } else {
      x = x.clone();
    }

    // A * x + B * y = x
    var A = new BN(1);
    var B = new BN(0);

    // C * x + D * y = y
    var C = new BN(0);
    var D = new BN(1);

    var g = 0;

    while (x.isEven() && y.isEven()) {
      x.iushrn(1);
      y.iushrn(1);
      ++g;
    }

    var yp = y.clone();
    var xp = x.clone();

    while (!x.isZero()) {
      for (var i = 0, im = 1; (x.words[0] & im) === 0 && i < 26; ++i, im <<= 1);
      if (i > 0) {
        x.iushrn(i);
        while (i-- > 0) {
          if (A.isOdd() || B.isOdd()) {
            A.iadd(yp);
            B.isub(xp);
          }

          A.iushrn(1);
          B.iushrn(1);
        }
      }

      for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1);
      if (j > 0) {
        y.iushrn(j);
        while (j-- > 0) {
          if (C.isOdd() || D.isOdd()) {
            C.iadd(yp);
            D.isub(xp);
          }

          C.iushrn(1);
          D.iushrn(1);
        }
      }

      if (x.cmp(y) >= 0) {
        x.isub(y);
        A.isub(C);
        B.isub(D);
      } else {
        y.isub(x);
        C.isub(A);
        D.isub(B);
      }
    }

    return {
      a: C,
      b: D,
      gcd: y.iushln(g)
    };
  };

  // This is reduced incarnation of the binary EEA
  // above, designated to invert members of the
  // _prime_ fields F(p) at a maximal speed
  BN.prototype._invmp = function _invmp (p) {
    assert(p.negative === 0);
    assert(!p.isZero());

    var a = this;
    var b = p.clone();

    if (a.negative !== 0) {
      a = a.umod(p);
    } else {
      a = a.clone();
    }

    var x1 = new BN(1);
    var x2 = new BN(0);

    var delta = b.clone();

    while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
      for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1);
      if (i > 0) {
        a.iushrn(i);
        while (i-- > 0) {
          if (x1.isOdd()) {
            x1.iadd(delta);
          }

          x1.iushrn(1);
        }
      }

      for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1);
      if (j > 0) {
        b.iushrn(j);
        while (j-- > 0) {
          if (x2.isOdd()) {
            x2.iadd(delta);
          }

          x2.iushrn(1);
        }
      }

      if (a.cmp(b) >= 0) {
        a.isub(b);
        x1.isub(x2);
      } else {
        b.isub(a);
        x2.isub(x1);
      }
    }

    var res;
    if (a.cmpn(1) === 0) {
      res = x1;
    } else {
      res = x2;
    }

    if (res.cmpn(0) < 0) {
      res.iadd(p);
    }

    return res;
  };

  BN.prototype.gcd = function gcd (num) {
    if (this.isZero()) return num.abs();
    if (num.isZero()) return this.abs();

    var a = this.clone();
    var b = num.clone();
    a.negative = 0;
    b.negative = 0;

    // Remove common factor of two
    for (var shift = 0; a.isEven() && b.isEven(); shift++) {
      a.iushrn(1);
      b.iushrn(1);
    }

    do {
      while (a.isEven()) {
        a.iushrn(1);
      }
      while (b.isEven()) {
        b.iushrn(1);
      }

      var r = a.cmp(b);
      if (r < 0) {
        // Swap `a` and `b` to make `a` always bigger than `b`
        var t = a;
        a = b;
        b = t;
      } else if (r === 0 || b.cmpn(1) === 0) {
        break;
      }

      a.isub(b);
    } while (true);

    return b.iushln(shift);
  };

  // Invert number in the field F(num)
  BN.prototype.invm = function invm (num) {
    return this.egcd(num).a.umod(num);
  };

  BN.prototype.isEven = function isEven () {
    return (this.words[0] & 1) === 0;
  };

  BN.prototype.isOdd = function isOdd () {
    return (this.words[0] & 1) === 1;
  };

  // And first word and num
  BN.prototype.andln = function andln (num) {
    return this.words[0] & num;
  };

  // Increment at the bit position in-line
  BN.prototype.bincn = function bincn (bit) {
    assert(typeof bit === 'number');
    var r = bit % 26;
    var s = (bit - r) / 26;
    var q = 1 << r;

    // Fast case: bit is much higher than all existing words
    if (this.length <= s) {
      this._expand(s + 1);
      this.words[s] |= q;
      return this;
    }

    // Add bit and propagate, if needed
    var carry = q;
    for (var i = s; carry !== 0 && i < this.length; i++) {
      var w = this.words[i] | 0;
      w += carry;
      carry = w >>> 26;
      w &= 0x3ffffff;
      this.words[i] = w;
    }
    if (carry !== 0) {
      this.words[i] = carry;
      this.length++;
    }
    return this;
  };

  BN.prototype.isZero = function isZero () {
    return this.length === 1 && this.words[0] === 0;
  };

  BN.prototype.cmpn = function cmpn (num) {
    var negative = num < 0;

    if (this.negative !== 0 && !negative) return -1;
    if (this.negative === 0 && negative) return 1;

    this.strip();

    var res;
    if (this.length > 1) {
      res = 1;
    } else {
      if (negative) {
        num = -num;
      }

      assert(num <= 0x3ffffff, 'Number is too big');

      var w = this.words[0] | 0;
      res = w === num ? 0 : w < num ? -1 : 1;
    }
    if (this.negative !== 0) return -res | 0;
    return res;
  };

  // Compare two numbers and return:
  // 1 - if `this` > `num`
  // 0 - if `this` == `num`
  // -1 - if `this` < `num`
  BN.prototype.cmp = function cmp (num) {
    if (this.negative !== 0 && num.negative === 0) return -1;
    if (this.negative === 0 && num.negative !== 0) return 1;

    var res = this.ucmp(num);
    if (this.negative !== 0) return -res | 0;
    return res;
  };

  // Unsigned comparison
  BN.prototype.ucmp = function ucmp (num) {
    // At this point both numbers have the same sign
    if (this.length > num.length) return 1;
    if (this.length < num.length) return -1;

    var res = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      var a = this.words[i] | 0;
      var b = num.words[i] | 0;

      if (a === b) continue;
      if (a < b) {
        res = -1;
      } else if (a > b) {
        res = 1;
      }
      break;
    }
    return res;
  };

  BN.prototype.gtn = function gtn (num) {
    return this.cmpn(num) === 1;
  };

  BN.prototype.gt = function gt (num) {
    return this.cmp(num) === 1;
  };

  BN.prototype.gten = function gten (num) {
    return this.cmpn(num) >= 0;
  };

  BN.prototype.gte = function gte (num) {
    return this.cmp(num) >= 0;
  };

  BN.prototype.ltn = function ltn (num) {
    return this.cmpn(num) === -1;
  };

  BN.prototype.lt = function lt (num) {
    return this.cmp(num) === -1;
  };

  BN.prototype.lten = function lten (num) {
    return this.cmpn(num) <= 0;
  };

  BN.prototype.lte = function lte (num) {
    return this.cmp(num) <= 0;
  };

  BN.prototype.eqn = function eqn (num) {
    return this.cmpn(num) === 0;
  };

  BN.prototype.eq = function eq (num) {
    return this.cmp(num) === 0;
  };

  //
  // A reduce context, could be using montgomery or something better, depending
  // on the `m` itself.
  //
  BN.red = function red (num) {
    return new Red(num);
  };

  BN.prototype.toRed = function toRed (ctx) {
    assert(!this.red, 'Already a number in reduction context');
    assert(this.negative === 0, 'red works only with positives');
    return ctx.convertTo(this)._forceRed(ctx);
  };

  BN.prototype.fromRed = function fromRed () {
    assert(this.red, 'fromRed works only with numbers in reduction context');
    return this.red.convertFrom(this);
  };

  BN.prototype._forceRed = function _forceRed (ctx) {
    this.red = ctx;
    return this;
  };

  BN.prototype.forceRed = function forceRed (ctx) {
    assert(!this.red, 'Already a number in reduction context');
    return this._forceRed(ctx);
  };

  BN.prototype.redAdd = function redAdd (num) {
    assert(this.red, 'redAdd works only with red numbers');
    return this.red.add(this, num);
  };

  BN.prototype.redIAdd = function redIAdd (num) {
    assert(this.red, 'redIAdd works only with red numbers');
    return this.red.iadd(this, num);
  };

  BN.prototype.redSub = function redSub (num) {
    assert(this.red, 'redSub works only with red numbers');
    return this.red.sub(this, num);
  };

  BN.prototype.redISub = function redISub (num) {
    assert(this.red, 'redISub works only with red numbers');
    return this.red.isub(this, num);
  };

  BN.prototype.redShl = function redShl (num) {
    assert(this.red, 'redShl works only with red numbers');
    return this.red.shl(this, num);
  };

  BN.prototype.redMul = function redMul (num) {
    assert(this.red, 'redMul works only with red numbers');
    this.red._verify2(this, num);
    return this.red.mul(this, num);
  };

  BN.prototype.redIMul = function redIMul (num) {
    assert(this.red, 'redMul works only with red numbers');
    this.red._verify2(this, num);
    return this.red.imul(this, num);
  };

  BN.prototype.redSqr = function redSqr () {
    assert(this.red, 'redSqr works only with red numbers');
    this.red._verify1(this);
    return this.red.sqr(this);
  };

  BN.prototype.redISqr = function redISqr () {
    assert(this.red, 'redISqr works only with red numbers');
    this.red._verify1(this);
    return this.red.isqr(this);
  };

  // Square root over p
  BN.prototype.redSqrt = function redSqrt () {
    assert(this.red, 'redSqrt works only with red numbers');
    this.red._verify1(this);
    return this.red.sqrt(this);
  };

  BN.prototype.redInvm = function redInvm () {
    assert(this.red, 'redInvm works only with red numbers');
    this.red._verify1(this);
    return this.red.invm(this);
  };

  // Return negative clone of `this` % `red modulo`
  BN.prototype.redNeg = function redNeg () {
    assert(this.red, 'redNeg works only with red numbers');
    this.red._verify1(this);
    return this.red.neg(this);
  };

  BN.prototype.redPow = function redPow (num) {
    assert(this.red && !num.red, 'redPow(normalNum)');
    this.red._verify1(this);
    return this.red.pow(this, num);
  };

  // Prime numbers with efficient reduction
  var primes = {
    k256: null,
    p224: null,
    p192: null,
    p25519: null
  };

  // Pseudo-Mersenne prime
  function MPrime (name, p) {
    // P = 2 ^ N - K
    this.name = name;
    this.p = new BN(p, 16);
    this.n = this.p.bitLength();
    this.k = new BN(1).iushln(this.n).isub(this.p);

    this.tmp = this._tmp();
  }

  MPrime.prototype._tmp = function _tmp () {
    var tmp = new BN(null);
    tmp.words = new Array(Math.ceil(this.n / 13));
    return tmp;
  };

  MPrime.prototype.ireduce = function ireduce (num) {
    // Assumes that `num` is less than `P^2`
    // num = HI * (2 ^ N - K) + HI * K + LO = HI * K + LO (mod P)
    var r = num;
    var rlen;

    do {
      this.split(r, this.tmp);
      r = this.imulK(r);
      r = r.iadd(this.tmp);
      rlen = r.bitLength();
    } while (rlen > this.n);

    var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
    if (cmp === 0) {
      r.words[0] = 0;
      r.length = 1;
    } else if (cmp > 0) {
      r.isub(this.p);
    } else {
      r.strip();
    }

    return r;
  };

  MPrime.prototype.split = function split (input, out) {
    input.iushrn(this.n, 0, out);
  };

  MPrime.prototype.imulK = function imulK (num) {
    return num.imul(this.k);
  };

  function K256 () {
    MPrime.call(
      this,
      'k256',
      'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f');
  }
  inherits(K256, MPrime);

  K256.prototype.split = function split (input, output) {
    // 256 = 9 * 26 + 22
    var mask = 0x3fffff;

    var outLen = Math.min(input.length, 9);
    for (var i = 0; i < outLen; i++) {
      output.words[i] = input.words[i];
    }
    output.length = outLen;

    if (input.length <= 9) {
      input.words[0] = 0;
      input.length = 1;
      return;
    }

    // Shift by 9 limbs
    var prev = input.words[9];
    output.words[output.length++] = prev & mask;

    for (i = 10; i < input.length; i++) {
      var next = input.words[i] | 0;
      input.words[i - 10] = ((next & mask) << 4) | (prev >>> 22);
      prev = next;
    }
    prev >>>= 22;
    input.words[i - 10] = prev;
    if (prev === 0 && input.length > 10) {
      input.length -= 10;
    } else {
      input.length -= 9;
    }
  };

  K256.prototype.imulK = function imulK (num) {
    // K = 0x1000003d1 = [ 0x40, 0x3d1 ]
    num.words[num.length] = 0;
    num.words[num.length + 1] = 0;
    num.length += 2;

    // bounded at: 0x40 * 0x3ffffff + 0x3d0 = 0x100000390
    var lo = 0;
    for (var i = 0; i < num.length; i++) {
      var w = num.words[i] | 0;
      lo += w * 0x3d1;
      num.words[i] = lo & 0x3ffffff;
      lo = w * 0x40 + ((lo / 0x4000000) | 0);
    }

    // Fast length reduction
    if (num.words[num.length - 1] === 0) {
      num.length--;
      if (num.words[num.length - 1] === 0) {
        num.length--;
      }
    }
    return num;
  };

  function P224 () {
    MPrime.call(
      this,
      'p224',
      'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001');
  }
  inherits(P224, MPrime);

  function P192 () {
    MPrime.call(
      this,
      'p192',
      'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff');
  }
  inherits(P192, MPrime);

  function P25519 () {
    // 2 ^ 255 - 19
    MPrime.call(
      this,
      '25519',
      '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed');
  }
  inherits(P25519, MPrime);

  P25519.prototype.imulK = function imulK (num) {
    // K = 0x13
    var carry = 0;
    for (var i = 0; i < num.length; i++) {
      var hi = (num.words[i] | 0) * 0x13 + carry;
      var lo = hi & 0x3ffffff;
      hi >>>= 26;

      num.words[i] = lo;
      carry = hi;
    }
    if (carry !== 0) {
      num.words[num.length++] = carry;
    }
    return num;
  };

  // Exported mostly for testing purposes, use plain name instead
  BN._prime = function prime (name) {
    // Cached version of prime
    if (primes[name]) return primes[name];

    var prime;
    if (name === 'k256') {
      prime = new K256();
    } else if (name === 'p224') {
      prime = new P224();
    } else if (name === 'p192') {
      prime = new P192();
    } else if (name === 'p25519') {
      prime = new P25519();
    } else {
      throw new Error('Unknown prime ' + name);
    }
    primes[name] = prime;

    return prime;
  };

  //
  // Base reduction engine
  //
  function Red (m) {
    if (typeof m === 'string') {
      var prime = BN._prime(m);
      this.m = prime.p;
      this.prime = prime;
    } else {
      assert(m.gtn(1), 'modulus must be greater than 1');
      this.m = m;
      this.prime = null;
    }
  }

  Red.prototype._verify1 = function _verify1 (a) {
    assert(a.negative === 0, 'red works only with positives');
    assert(a.red, 'red works only with red numbers');
  };

  Red.prototype._verify2 = function _verify2 (a, b) {
    assert((a.negative | b.negative) === 0, 'red works only with positives');
    assert(a.red && a.red === b.red,
      'red works only with red numbers');
  };

  Red.prototype.imod = function imod (a) {
    if (this.prime) return this.prime.ireduce(a)._forceRed(this);
    return a.umod(this.m)._forceRed(this);
  };

  Red.prototype.neg = function neg (a) {
    if (a.isZero()) {
      return a.clone();
    }

    return this.m.sub(a)._forceRed(this);
  };

  Red.prototype.add = function add (a, b) {
    this._verify2(a, b);

    var res = a.add(b);
    if (res.cmp(this.m) >= 0) {
      res.isub(this.m);
    }
    return res._forceRed(this);
  };

  Red.prototype.iadd = function iadd (a, b) {
    this._verify2(a, b);

    var res = a.iadd(b);
    if (res.cmp(this.m) >= 0) {
      res.isub(this.m);
    }
    return res;
  };

  Red.prototype.sub = function sub (a, b) {
    this._verify2(a, b);

    var res = a.sub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res._forceRed(this);
  };

  Red.prototype.isub = function isub (a, b) {
    this._verify2(a, b);

    var res = a.isub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res;
  };

  Red.prototype.shl = function shl (a, num) {
    this._verify1(a);
    return this.imod(a.ushln(num));
  };

  Red.prototype.imul = function imul (a, b) {
    this._verify2(a, b);
    return this.imod(a.imul(b));
  };

  Red.prototype.mul = function mul (a, b) {
    this._verify2(a, b);
    return this.imod(a.mul(b));
  };

  Red.prototype.isqr = function isqr (a) {
    return this.imul(a, a.clone());
  };

  Red.prototype.sqr = function sqr (a) {
    return this.mul(a, a);
  };

  Red.prototype.sqrt = function sqrt (a) {
    if (a.isZero()) return a.clone();

    var mod3 = this.m.andln(3);
    assert(mod3 % 2 === 1);

    // Fast case
    if (mod3 === 3) {
      var pow = this.m.add(new BN(1)).iushrn(2);
      return this.pow(a, pow);
    }

    // Tonelli-Shanks algorithm (Totally unoptimized and slow)
    //
    // Find Q and S, that Q * 2 ^ S = (P - 1)
    var q = this.m.subn(1);
    var s = 0;
    while (!q.isZero() && q.andln(1) === 0) {
      s++;
      q.iushrn(1);
    }
    assert(!q.isZero());

    var one = new BN(1).toRed(this);
    var nOne = one.redNeg();

    // Find quadratic non-residue
    // NOTE: Max is such because of generalized Riemann hypothesis.
    var lpow = this.m.subn(1).iushrn(1);
    var z = this.m.bitLength();
    z = new BN(2 * z * z).toRed(this);

    while (this.pow(z, lpow).cmp(nOne) !== 0) {
      z.redIAdd(nOne);
    }

    var c = this.pow(z, q);
    var r = this.pow(a, q.addn(1).iushrn(1));
    var t = this.pow(a, q);
    var m = s;
    while (t.cmp(one) !== 0) {
      var tmp = t;
      for (var i = 0; tmp.cmp(one) !== 0; i++) {
        tmp = tmp.redSqr();
      }
      assert(i < m);
      var b = this.pow(c, new BN(1).iushln(m - i - 1));

      r = r.redMul(b);
      c = b.redSqr();
      t = t.redMul(c);
      m = i;
    }

    return r;
  };

  Red.prototype.invm = function invm (a) {
    var inv = a._invmp(this.m);
    if (inv.negative !== 0) {
      inv.negative = 0;
      return this.imod(inv).redNeg();
    } else {
      return this.imod(inv);
    }
  };

  Red.prototype.pow = function pow (a, num) {
    if (num.isZero()) return new BN(1).toRed(this);
    if (num.cmpn(1) === 0) return a.clone();

    var windowSize = 4;
    var wnd = new Array(1 << windowSize);
    wnd[0] = new BN(1).toRed(this);
    wnd[1] = a;
    for (var i = 2; i < wnd.length; i++) {
      wnd[i] = this.mul(wnd[i - 1], a);
    }

    var res = wnd[0];
    var current = 0;
    var currentLen = 0;
    var start = num.bitLength() % 26;
    if (start === 0) {
      start = 26;
    }

    for (i = num.length - 1; i >= 0; i--) {
      var word = num.words[i];
      for (var j = start - 1; j >= 0; j--) {
        var bit = (word >> j) & 1;
        if (res !== wnd[0]) {
          res = this.sqr(res);
        }

        if (bit === 0 && current === 0) {
          currentLen = 0;
          continue;
        }

        current <<= 1;
        current |= bit;
        currentLen++;
        if (currentLen !== windowSize && (i !== 0 || j !== 0)) continue;

        res = this.mul(res, wnd[current]);
        currentLen = 0;
        current = 0;
      }
      start = 26;
    }

    return res;
  };

  Red.prototype.convertTo = function convertTo (num) {
    var r = num.umod(this.m);

    return r === num ? r.clone() : r;
  };

  Red.prototype.convertFrom = function convertFrom (num) {
    var res = num.clone();
    res.red = null;
    return res;
  };

  //
  // Montgomery method engine
  //

  BN.mont = function mont (num) {
    return new Mont(num);
  };

  function Mont (m) {
    Red.call(this, m);

    this.shift = this.m.bitLength();
    if (this.shift % 26 !== 0) {
      this.shift += 26 - (this.shift % 26);
    }

    this.r = new BN(1).iushln(this.shift);
    this.r2 = this.imod(this.r.sqr());
    this.rinv = this.r._invmp(this.m);

    this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
    this.minv = this.minv.umod(this.r);
    this.minv = this.r.sub(this.minv);
  }
  inherits(Mont, Red);

  Mont.prototype.convertTo = function convertTo (num) {
    return this.imod(num.ushln(this.shift));
  };

  Mont.prototype.convertFrom = function convertFrom (num) {
    var r = this.imod(num.mul(this.rinv));
    r.red = null;
    return r;
  };

  Mont.prototype.imul = function imul (a, b) {
    if (a.isZero() || b.isZero()) {
      a.words[0] = 0;
      a.length = 1;
      return a;
    }

    var t = a.imul(b);
    var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    var u = t.isub(c).iushrn(this.shift);
    var res = u;

    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }

    return res._forceRed(this);
  };

  Mont.prototype.mul = function mul (a, b) {
    if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);

    var t = a.mul(b);
    var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    var u = t.isub(c).iushrn(this.shift);
    var res = u;
    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }

    return res._forceRed(this);
  };

  Mont.prototype.invm = function invm (a) {
    // (AR)^-1 * R^2 = (A^-1 * R^-1) * R^2 = A^-1 * R
    var res = this.imod(a._invmp(this.m).mul(this.r2));
    return res._forceRed(this);
  };
})(typeof module === 'undefined' || module, this);

},{"buffer":2}],37:[function(require,module,exports){
'use strict'

module.exports = findBounds

function findBounds(points) {
  var n = points.length
  if(n === 0) {
    return [[], []]
  }
  var d = points[0].length
  var lo = points[0].slice()
  var hi = points[0].slice()
  for(var i=1; i<n; ++i) {
    var p = points[i]
    for(var j=0; j<d; ++j) {
      var x = p[j]
      lo[j] = Math.min(lo[j], x)
      hi[j] = Math.max(hi[j], x)
    }
  }
  return [lo, hi]
}
},{}],38:[function(require,module,exports){
'use strict'

module.exports = boxIntersectWrapper

var pool = require('typedarray-pool')
var sweep = require('./lib/sweep')
var boxIntersectIter = require('./lib/intersect')

function boxEmpty(d, box) {
  for(var j=0; j<d; ++j) {
    if(!(box[j] <= box[j+d])) {
      return true
    }
  }
  return false
}

//Unpack boxes into a flat typed array, remove empty boxes
function convertBoxes(boxes, d, data, ids) {
  var ptr = 0
  var count = 0
  for(var i=0, n=boxes.length; i<n; ++i) {
    var b = boxes[i]
    if(boxEmpty(d, b)) {
      continue
    }
    for(var j=0; j<2*d; ++j) {
      data[ptr++] = b[j]
    }
    ids[count++] = i
  }
  return count
}

//Perform type conversions, check bounds
function boxIntersect(red, blue, visit, full) {
  var n = red.length
  var m = blue.length

  //If either array is empty, then we can skip this whole thing
  if(n <= 0 || m <= 0) {
    return
  }

  //Compute dimension, if it is 0 then we skip
  var d = (red[0].length)>>>1
  if(d <= 0) {
    return
  }

  var retval

  //Convert red boxes
  var redList  = pool.mallocDouble(2*d*n)
  var redIds   = pool.mallocInt32(n)
  n = convertBoxes(red, d, redList, redIds)

  if(n > 0) {
    if(d === 1 && full) {
      //Special case: 1d complete
      sweep.init(n)
      retval = sweep.sweepComplete(
        d, visit, 
        0, n, redList, redIds,
        0, n, redList, redIds)
    } else {

      //Convert blue boxes
      var blueList = pool.mallocDouble(2*d*m)
      var blueIds  = pool.mallocInt32(m)
      m = convertBoxes(blue, d, blueList, blueIds)

      if(m > 0) {
        sweep.init(n+m)

        if(d === 1) {
          //Special case: 1d bipartite
          retval = sweep.sweepBipartite(
            d, visit, 
            0, n, redList,  redIds,
            0, m, blueList, blueIds)
        } else {
          //General case:  d>1
          retval = boxIntersectIter(
            d, visit,    full,
            n, redList,  redIds,
            m, blueList, blueIds)
        }

        pool.free(blueList)
        pool.free(blueIds)
      }
    }

    pool.free(redList)
    pool.free(redIds)
  }

  return retval
}


var RESULT

function appendItem(i,j) {
  RESULT.push([i,j])
}

function intersectFullArray(x) {
  RESULT = []
  boxIntersect(x, x, appendItem, true)
  return RESULT
}

function intersectBipartiteArray(x, y) {
  RESULT = []
  boxIntersect(x, y, appendItem, false)
  return RESULT
}

//User-friendly wrapper, handle full input and no-visitor cases
function boxIntersectWrapper(arg0, arg1, arg2) {
  var result
  switch(arguments.length) {
    case 1:
      return intersectFullArray(arg0)
    case 2:
      if(typeof arg1 === 'function') {
        return boxIntersect(arg0, arg0, arg1, true)
      } else {
        return intersectBipartiteArray(arg0, arg1)
      }
    case 3:
      return boxIntersect(arg0, arg1, arg2, false)
    default:
      throw new Error('box-intersect: Invalid arguments')
  }
}
},{"./lib/intersect":40,"./lib/sweep":44,"typedarray-pool":212}],39:[function(require,module,exports){
'use strict'

var DIMENSION   = 'd'
var AXIS        = 'ax'
var VISIT       = 'vv'
var FLIP        = 'fp'

var ELEM_SIZE   = 'es'

var RED_START   = 'rs'
var RED_END     = 're'
var RED_BOXES   = 'rb'
var RED_INDEX   = 'ri'
var RED_PTR     = 'rp'

var BLUE_START  = 'bs'
var BLUE_END    = 'be'
var BLUE_BOXES  = 'bb'
var BLUE_INDEX  = 'bi'
var BLUE_PTR    = 'bp'

var RETVAL      = 'rv'

var INNER_LABEL = 'Q'

var ARGS = [
  DIMENSION,
  AXIS,
  VISIT,
  RED_START,
  RED_END,
  RED_BOXES,
  RED_INDEX,
  BLUE_START,
  BLUE_END,
  BLUE_BOXES,
  BLUE_INDEX
]

function generateBruteForce(redMajor, flip, full) {
  var funcName = 'bruteForce' + 
    (redMajor ? 'Red' : 'Blue') + 
    (flip ? 'Flip' : '') +
    (full ? 'Full' : '')

  var code = ['function ', funcName, '(', ARGS.join(), '){',
    'var ', ELEM_SIZE, '=2*', DIMENSION, ';']

  var redLoop = 
    'for(var i=' + RED_START + ',' + RED_PTR + '=' + ELEM_SIZE + '*' + RED_START + ';' +
        'i<' + RED_END +';' +
        '++i,' + RED_PTR + '+=' + ELEM_SIZE + '){' +
        'var x0=' + RED_BOXES + '[' + AXIS + '+' + RED_PTR + '],' +
            'x1=' + RED_BOXES + '[' + AXIS + '+' + RED_PTR + '+' + DIMENSION + '],' +
            'xi=' + RED_INDEX + '[i];'

  var blueLoop = 
    'for(var j=' + BLUE_START + ',' + BLUE_PTR + '=' + ELEM_SIZE + '*' + BLUE_START + ';' +
        'j<' + BLUE_END + ';' +
        '++j,' + BLUE_PTR + '+=' + ELEM_SIZE + '){' +
        'var y0=' + BLUE_BOXES + '[' + AXIS + '+' + BLUE_PTR + '],' +
            (full ? 'y1=' + BLUE_BOXES + '[' + AXIS + '+' + BLUE_PTR + '+' + DIMENSION + '],' : '') +
            'yi=' + BLUE_INDEX + '[j];'

  if(redMajor) {
    code.push(redLoop, INNER_LABEL, ':', blueLoop)
  } else {
    code.push(blueLoop, INNER_LABEL, ':', redLoop)
  }

  if(full) {
    code.push('if(y1<x0||x1<y0)continue;')
  } else if(flip) {
    code.push('if(y0<=x0||x1<y0)continue;')
  } else {
    code.push('if(y0<x0||x1<y0)continue;')
  }

  code.push('for(var k='+AXIS+'+1;k<'+DIMENSION+';++k){'+
    'var r0='+RED_BOXES+'[k+'+RED_PTR+'],'+
        'r1='+RED_BOXES+'[k+'+DIMENSION+'+'+RED_PTR+'],'+
        'b0='+BLUE_BOXES+'[k+'+BLUE_PTR+'],'+
        'b1='+BLUE_BOXES+'[k+'+DIMENSION+'+'+BLUE_PTR+'];'+
      'if(r1<b0||b1<r0)continue ' + INNER_LABEL + ';}' +
      'var ' + RETVAL + '=' + VISIT + '(')

  if(flip) {
    code.push('yi,xi')
  } else {
    code.push('xi,yi')
  }

  code.push(');if(' + RETVAL + '!==void 0)return ' + RETVAL + ';}}}')

  return {
    name: funcName, 
    code: code.join('')
  }
}

function bruteForcePlanner(full) {
  var funcName = 'bruteForce' + (full ? 'Full' : 'Partial')
  var prefix = []
  var fargs = ARGS.slice()
  if(!full) {
    fargs.splice(3, 0, FLIP)
  }

  var code = ['function ' + funcName + '(' + fargs.join() + '){']

  function invoke(redMajor, flip) {
    var res = generateBruteForce(redMajor, flip, full)
    prefix.push(res.code)
    code.push('return ' + res.name + '(' + ARGS.join() + ');')
  }

  code.push('if(' + RED_END + '-' + RED_START + '>' +
                    BLUE_END + '-' + BLUE_START + '){')

  if(full) {
    invoke(true, false)
    code.push('}else{')
    invoke(false, false)
  } else {
    code.push('if(' + FLIP + '){')
    invoke(true, true)
    code.push('}else{')
    invoke(true, false)
    code.push('}}else{if(' + FLIP + '){')
    invoke(false, true)
    code.push('}else{')
    invoke(false, false)
    code.push('}')
  }
  code.push('}}return ' + funcName)

  var codeStr = prefix.join('') + code.join('')
  var proc = new Function(codeStr)
  return proc()
}


exports.partial = bruteForcePlanner(false)
exports.full    = bruteForcePlanner(true)
},{}],40:[function(require,module,exports){
'use strict'

module.exports = boxIntersectIter

var pool = require('typedarray-pool')
var bits = require('bit-twiddle')
var bruteForce = require('./brute')
var bruteForcePartial = bruteForce.partial
var bruteForceFull = bruteForce.full
var sweep = require('./sweep')
var findMedian = require('./median')
var genPartition = require('./partition')

//Twiddle parameters
var BRUTE_FORCE_CUTOFF    = 128       //Cut off for brute force search
var SCAN_CUTOFF           = (1<<22)   //Cut off for two way scan
var SCAN_COMPLETE_CUTOFF  = (1<<22)  

//Partition functions
var partitionInteriorContainsInterval = genPartition(
  '!(lo>=p0)&&!(p1>=hi)', 
  ['p0', 'p1'])

var partitionStartEqual = genPartition(
  'lo===p0',
  ['p0'])

var partitionStartLessThan = genPartition(
  'lo<p0',
  ['p0'])

var partitionEndLessThanEqual = genPartition(
  'hi<=p0',
  ['p0'])

var partitionContainsPoint = genPartition(
  'lo<=p0&&p0<=hi',
  ['p0'])

var partitionContainsPointProper = genPartition(
  'lo<p0&&p0<=hi',
  ['p0'])

//Frame size for iterative loop
var IFRAME_SIZE = 6
var DFRAME_SIZE = 2

//Data for box statck
var INIT_CAPACITY = 1024
var BOX_ISTACK  = pool.mallocInt32(INIT_CAPACITY)
var BOX_DSTACK  = pool.mallocDouble(INIT_CAPACITY)

//Initialize iterative loop queue
function iterInit(d, count) {
  var levels = (8 * bits.log2(count+1) * (d+1))|0
  var maxInts = bits.nextPow2(IFRAME_SIZE*levels)
  if(BOX_ISTACK.length < maxInts) {
    pool.free(BOX_ISTACK)
    BOX_ISTACK = pool.mallocInt32(maxInts)
  }
  var maxDoubles = bits.nextPow2(DFRAME_SIZE*levels)
  if(BOX_DSTACK < maxDoubles) {
    pool.free(BOX_DSTACK)
    BOX_DSTACK = pool.mallocDouble(maxDoubles)
  }
}

//Append item to queue
function iterPush(ptr,
  axis, 
  redStart, redEnd, 
  blueStart, blueEnd, 
  state, 
  lo, hi) {

  var iptr = IFRAME_SIZE * ptr
  BOX_ISTACK[iptr]   = axis
  BOX_ISTACK[iptr+1] = redStart
  BOX_ISTACK[iptr+2] = redEnd
  BOX_ISTACK[iptr+3] = blueStart
  BOX_ISTACK[iptr+4] = blueEnd
  BOX_ISTACK[iptr+5] = state

  var dptr = DFRAME_SIZE * ptr
  BOX_DSTACK[dptr]   = lo
  BOX_DSTACK[dptr+1] = hi
}

//Special case:  Intersect single point with list of intervals
function onePointPartial(
  d, axis, visit, flip,
  redStart, redEnd, red, redIndex,
  blueOffset, blue, blueId) {

  var elemSize = 2 * d
  var bluePtr  = blueOffset * elemSize
  var blueX    = blue[bluePtr + axis]

red_loop:
  for(var i=redStart, redPtr=redStart*elemSize; i<redEnd; ++i, redPtr+=elemSize) {
    var r0 = red[redPtr+axis]
    var r1 = red[redPtr+axis+d]
    if(blueX < r0 || r1 < blueX) {
      continue
    }
    if(flip && blueX === r0) {
      continue
    }
    var redId = redIndex[i]
    for(var j=axis+1; j<d; ++j) {
      var r0 = red[redPtr+j]
      var r1 = red[redPtr+j+d]
      var b0 = blue[bluePtr+j]
      var b1 = blue[bluePtr+j+d]
      if(r1 < b0 || b1 < r0) {
        continue red_loop
      }
    }
    var retval
    if(flip) {
      retval = visit(blueId, redId)
    } else {
      retval = visit(redId, blueId)
    }
    if(retval !== void 0) {
      return retval
    }
  }
}

//Special case:  Intersect one point with list of intervals
function onePointFull(
  d, axis, visit,
  redStart, redEnd, red, redIndex,
  blueOffset, blue, blueId) {

  var elemSize = 2 * d
  var bluePtr  = blueOffset * elemSize
  var blueX    = blue[bluePtr + axis]

red_loop:
  for(var i=redStart, redPtr=redStart*elemSize; i<redEnd; ++i, redPtr+=elemSize) {
    var redId = redIndex[i]
    if(redId === blueId) {
      continue
    }
    var r0 = red[redPtr+axis]
    var r1 = red[redPtr+axis+d]
    if(blueX < r0 || r1 < blueX) {
      continue
    }
    for(var j=axis+1; j<d; ++j) {
      var r0 = red[redPtr+j]
      var r1 = red[redPtr+j+d]
      var b0 = blue[bluePtr+j]
      var b1 = blue[bluePtr+j+d]
      if(r1 < b0 || b1 < r0) {
        continue red_loop
      }
    }
    var retval = visit(redId, blueId)
    if(retval !== void 0) {
      return retval
    }
  }
}

//The main box intersection routine
function boxIntersectIter(
  d, visit, initFull,
  xSize, xBoxes, xIndex,
  ySize, yBoxes, yIndex) {

  //Reserve memory for stack
  iterInit(d, xSize + ySize)

  var top  = 0
  var elemSize = 2 * d
  var retval

  iterPush(top++,
      0,
      0, xSize,
      0, ySize,
      initFull ? 16 : 0, 
      -Infinity, Infinity)
  if(!initFull) {
    iterPush(top++,
      0,
      0, ySize,
      0, xSize,
      1, 
      -Infinity, Infinity)
  }

  while(top > 0) {
    top  -= 1

    var iptr = top * IFRAME_SIZE
    var axis      = BOX_ISTACK[iptr]
    var redStart  = BOX_ISTACK[iptr+1]
    var redEnd    = BOX_ISTACK[iptr+2]
    var blueStart = BOX_ISTACK[iptr+3]
    var blueEnd   = BOX_ISTACK[iptr+4]
    var state     = BOX_ISTACK[iptr+5]

    var dptr = top * DFRAME_SIZE
    var lo        = BOX_DSTACK[dptr]
    var hi        = BOX_DSTACK[dptr+1]

    //Unpack state info
    var flip      = (state & 1)
    var full      = !!(state & 16)

    //Unpack indices
    var red       = xBoxes
    var redIndex  = xIndex
    var blue      = yBoxes
    var blueIndex = yIndex
    if(flip) {
      red         = yBoxes
      redIndex    = yIndex
      blue        = xBoxes
      blueIndex   = xIndex
    }

    if(state & 2) {
      redEnd = partitionStartLessThan(
        d, axis,
        redStart, redEnd, red, redIndex,
        hi)
      if(redStart >= redEnd) {
        continue
      }
    }
    if(state & 4) {
      redStart = partitionEndLessThanEqual(
        d, axis,
        redStart, redEnd, red, redIndex,
        lo)
      if(redStart >= redEnd) {
        continue
      }
    }
    
    var redCount  = redEnd  - redStart
    var blueCount = blueEnd - blueStart

    if(full) {
      if(d * redCount * (redCount + blueCount) < SCAN_COMPLETE_CUTOFF) {
        retval = sweep.scanComplete(
          d, axis, visit, 
          redStart, redEnd, red, redIndex,
          blueStart, blueEnd, blue, blueIndex)
        if(retval !== void 0) {
          return retval
        }
        continue
      }
    } else {
      if(d * Math.min(redCount, blueCount) < BRUTE_FORCE_CUTOFF) {
        //If input small, then use brute force
        retval = bruteForcePartial(
            d, axis, visit, flip,
            redStart,  redEnd,  red,  redIndex,
            blueStart, blueEnd, blue, blueIndex)
        if(retval !== void 0) {
          return retval
        }
        continue
      } else if(d * redCount * blueCount < SCAN_CUTOFF) {
        //If input medium sized, then use sweep and prune
        retval = sweep.scanBipartite(
          d, axis, visit, flip, 
          redStart, redEnd, red, redIndex,
          blueStart, blueEnd, blue, blueIndex)
        if(retval !== void 0) {
          return retval
        }
        continue
      }
    }
    
    //First, find all red intervals whose interior contains (lo,hi)
    var red0 = partitionInteriorContainsInterval(
      d, axis, 
      redStart, redEnd, red, redIndex,
      lo, hi)

    //Lower dimensional case
    if(redStart < red0) {

      if(d * (red0 - redStart) < BRUTE_FORCE_CUTOFF) {
        //Special case for small inputs: use brute force
        retval = bruteForceFull(
          d, axis+1, visit,
          redStart, red0, red, redIndex,
          blueStart, blueEnd, blue, blueIndex)
        if(retval !== void 0) {
          return retval
        }
      } else if(axis === d-2) {
        if(flip) {
          retval = sweep.sweepBipartite(
            d, visit,
            blueStart, blueEnd, blue, blueIndex,
            redStart, red0, red, redIndex)
        } else {
          retval = sweep.sweepBipartite(
            d, visit,
            redStart, red0, red, redIndex,
            blueStart, blueEnd, blue, blueIndex)
        }
        if(retval !== void 0) {
          return retval
        }
      } else {
        iterPush(top++,
          axis+1,
          redStart, red0,
          blueStart, blueEnd,
          flip,
          -Infinity, Infinity)
        iterPush(top++,
          axis+1,
          blueStart, blueEnd,
          redStart, red0,
          flip^1,
          -Infinity, Infinity)
      }
    }

    //Divide and conquer phase
    if(red0 < redEnd) {

      //Cut blue into 3 parts:
      //
      //  Points < mid point
      //  Points = mid point
      //  Points > mid point
      //
      var blue0 = findMedian(
        d, axis, 
        blueStart, blueEnd, blue, blueIndex)
      var mid = blue[elemSize * blue0 + axis]
      var blue1 = partitionStartEqual(
        d, axis,
        blue0, blueEnd, blue, blueIndex,
        mid)

      //Right case
      if(blue1 < blueEnd) {
        iterPush(top++,
          axis,
          red0, redEnd,
          blue1, blueEnd,
          (flip|4) + (full ? 16 : 0),
          mid, hi)
      }

      //Left case
      if(blueStart < blue0) {
        iterPush(top++,
          axis,
          red0, redEnd,
          blueStart, blue0,
          (flip|2) + (full ? 16 : 0),
          lo, mid)
      }

      //Center case (the hard part)
      if(blue0 + 1 === blue1) {
        //Optimization: Range with exactly 1 point, use a brute force scan
        if(full) {
          retval = onePointFull(
            d, axis, visit,
            red0, redEnd, red, redIndex,
            blue0, blue, blueIndex[blue0])
        } else {
          retval = onePointPartial(
            d, axis, visit, flip,
            red0, redEnd, red, redIndex,
            blue0, blue, blueIndex[blue0])
        }
        if(retval !== void 0) {
          return retval
        }
      } else if(blue0 < blue1) {
        var red1
        if(full) {
          //If full intersection, need to handle special case
          red1 = partitionContainsPoint(
            d, axis,
            red0, redEnd, red, redIndex,
            mid)
          if(red0 < red1) {
            var redX = partitionStartEqual(
              d, axis,
              red0, red1, red, redIndex,
              mid)
            if(axis === d-2) {
              //Degenerate sweep intersection:
              //  [red0, redX] with [blue0, blue1]
              if(red0 < redX) {
                retval = sweep.sweepComplete(
                  d, visit,
                  red0, redX, red, redIndex,
                  blue0, blue1, blue, blueIndex)
                if(retval !== void 0) {
                  return retval
                }
              }

              //Normal sweep intersection:
              //  [redX, red1] with [blue0, blue1]
              if(redX < red1) {
                retval = sweep.sweepBipartite(
                  d, visit,
                  redX, red1, red, redIndex,
                  blue0, blue1, blue, blueIndex)
                if(retval !== void 0) {
                  return retval
                }
              }
            } else {
              if(red0 < redX) {
                iterPush(top++,
                  axis+1,
                  red0, redX,
                  blue0, blue1,
                  16,
                  -Infinity, Infinity)
              }
              if(redX < red1) {
                iterPush(top++,
                  axis+1,
                  redX, red1,
                  blue0, blue1,
                  0,
                  -Infinity, Infinity)
                iterPush(top++,
                  axis+1,
                  blue0, blue1,
                  redX, red1,
                  1,
                  -Infinity, Infinity)
              }
            }
          }
        } else {
          if(flip) {
            red1 = partitionContainsPointProper(
              d, axis,
              red0, redEnd, red, redIndex,
              mid)
          } else {
            red1 = partitionContainsPoint(
              d, axis,
              red0, redEnd, red, redIndex,
              mid)
          }
          if(red0 < red1) {
            if(axis === d-2) {
              if(flip) {
                retval = sweep.sweepBipartite(
                  d, visit,
                  blue0, blue1, blue, blueIndex,
                  red0, red1, red, redIndex)
              } else {
                retval = sweep.sweepBipartite(
                  d, visit,
                  red0, red1, red, redIndex,
                  blue0, blue1, blue, blueIndex)
              }
            } else {
              iterPush(top++,
                axis+1,
                red0, red1,
                blue0, blue1,
                flip,
                -Infinity, Infinity)
              iterPush(top++,
                axis+1,
                blue0, blue1,
                red0, red1,
                flip^1,
                -Infinity, Infinity)
            }
          }
        }
      }
    }
  }
}
},{"./brute":39,"./median":41,"./partition":42,"./sweep":44,"bit-twiddle":35,"typedarray-pool":212}],41:[function(require,module,exports){
'use strict'

module.exports = findMedian

var genPartition = require('./partition')

var partitionStartLessThan = genPartition('lo<p0', ['p0'])

var PARTITION_THRESHOLD = 8   //Cut off for using insertion sort in findMedian

//Base case for median finding:  Use insertion sort
function insertionSort(d, axis, start, end, boxes, ids) {
  var elemSize = 2 * d
  var boxPtr = elemSize * (start+1) + axis
  for(var i=start+1; i<end; ++i, boxPtr+=elemSize) {
    var x = boxes[boxPtr]
    for(var j=i, ptr=elemSize*(i-1); 
        j>start && boxes[ptr+axis] > x; 
        --j, ptr-=elemSize) {
      //Swap
      var aPtr = ptr
      var bPtr = ptr+elemSize
      for(var k=0; k<elemSize; ++k, ++aPtr, ++bPtr) {
        var y = boxes[aPtr]
        boxes[aPtr] = boxes[bPtr]
        boxes[bPtr] = y
      }
      var tmp = ids[j]
      ids[j] = ids[j-1]
      ids[j-1] = tmp
    }
  }
}

//Find median using quick select algorithm
//  takes O(n) time with high probability
function findMedian(d, axis, start, end, boxes, ids) {
  if(end <= start+1) {
    return start
  }

  var lo       = start
  var hi       = end
  var mid      = ((end + start) >>> 1)
  var elemSize = 2*d
  var pivot    = mid
  var value    = boxes[elemSize*mid+axis]
  
  while(lo < hi) {
    if(hi - lo < PARTITION_THRESHOLD) {
      insertionSort(d, axis, lo, hi, boxes, ids)
      value = boxes[elemSize*mid+axis]
      break
    }
    
    //Select pivot using median-of-3
    var count  = hi - lo
    var pivot0 = (Math.random()*count+lo)|0
    var value0 = boxes[elemSize*pivot0 + axis]
    var pivot1 = (Math.random()*count+lo)|0
    var value1 = boxes[elemSize*pivot1 + axis]
    var pivot2 = (Math.random()*count+lo)|0
    var value2 = boxes[elemSize*pivot2 + axis]
    if(value0 <= value1) {
      if(value2 >= value1) {
        pivot = pivot1
        value = value1
      } else if(value0 >= value2) {
        pivot = pivot0
        value = value0
      } else {
        pivot = pivot2
        value = value2
      }
    } else {
      if(value1 >= value2) {
        pivot = pivot1
        value = value1
      } else if(value2 >= value0) {
        pivot = pivot0
        value = value0
      } else {
        pivot = pivot2
        value = value2
      }
    }

    //Swap pivot to end of array
    var aPtr = elemSize * (hi-1)
    var bPtr = elemSize * pivot
    for(var i=0; i<elemSize; ++i, ++aPtr, ++bPtr) {
      var x = boxes[aPtr]
      boxes[aPtr] = boxes[bPtr]
      boxes[bPtr] = x
    }
    var y = ids[hi-1]
    ids[hi-1] = ids[pivot]
    ids[pivot] = y

    //Partition using pivot
    pivot = partitionStartLessThan(
      d, axis, 
      lo, hi-1, boxes, ids,
      value)

    //Swap pivot back
    var aPtr = elemSize * (hi-1)
    var bPtr = elemSize * pivot
    for(var i=0; i<elemSize; ++i, ++aPtr, ++bPtr) {
      var x = boxes[aPtr]
      boxes[aPtr] = boxes[bPtr]
      boxes[bPtr] = x
    }
    var y = ids[hi-1]
    ids[hi-1] = ids[pivot]
    ids[pivot] = y

    //Swap pivot to last pivot
    if(mid < pivot) {
      hi = pivot-1
      while(lo < hi && 
        boxes[elemSize*(hi-1)+axis] === value) {
        hi -= 1
      }
      hi += 1
    } else if(pivot < mid) {
      lo = pivot + 1
      while(lo < hi &&
        boxes[elemSize*lo+axis] === value) {
        lo += 1
      }
    } else {
      break
    }
  }

  //Make sure pivot is at start
  return partitionStartLessThan(
    d, axis, 
    start, mid, boxes, ids,
    boxes[elemSize*mid+axis])
}
},{"./partition":42}],42:[function(require,module,exports){
'use strict'

module.exports = genPartition

var code = 'for(var j=2*a,k=j*c,l=k,m=c,n=b,o=a+b,p=c;d>p;++p,k+=j){var _;if($)if(m===p)m+=1,l+=j;else{for(var s=0;j>s;++s){var t=e[k+s];e[k+s]=e[l],e[l++]=t}var u=f[p];f[p]=f[m],f[m++]=u}}return m'

function genPartition(predicate, args) {
  var fargs ='abcdef'.split('').concat(args)
  var reads = []
  if(predicate.indexOf('lo') >= 0) {
    reads.push('lo=e[k+n]')
  }
  if(predicate.indexOf('hi') >= 0) {
    reads.push('hi=e[k+o]')
  }
  fargs.push(
    code.replace('_', reads.join())
        .replace('$', predicate))
  return Function.apply(void 0, fargs)
}
},{}],43:[function(require,module,exports){
'use strict';

//This code is extracted from ndarray-sort
//It is inlined here as a temporary workaround

module.exports = wrapper;

var INSERT_SORT_CUTOFF = 32

function wrapper(data, n0) {
  if (n0 <= 4*INSERT_SORT_CUTOFF) {
    insertionSort(0, n0 - 1, data);
  } else {
    quickSort(0, n0 - 1, data);
  }
}

function insertionSort(left, right, data) {
  var ptr = 2*(left+1)
  for(var i=left+1; i<=right; ++i) {
    var a = data[ptr++]
    var b = data[ptr++]
    var j = i
    var jptr = ptr-2
    while(j-- > left) {
      var x = data[jptr-2]
      var y = data[jptr-1]
      if(x < a) {
        break
      } else if(x === a && y < b) {
        break
      }
      data[jptr]   = x
      data[jptr+1] = y
      jptr -= 2
    }
    data[jptr]   = a
    data[jptr+1] = b
  }
}

function swap(i, j, data) {
  i *= 2
  j *= 2
  var x = data[i]
  var y = data[i+1]
  data[i] = data[j]
  data[i+1] = data[j+1]
  data[j] = x
  data[j+1] = y
}

function move(i, j, data) {
  i *= 2
  j *= 2
  data[i] = data[j]
  data[i+1] = data[j+1]
}

function rotate(i, j, k, data) {
  i *= 2
  j *= 2
  k *= 2
  var x = data[i]
  var y = data[i+1]
  data[i] = data[j]
  data[i+1] = data[j+1]
  data[j] = data[k]
  data[j+1] = data[k+1]
  data[k] = x
  data[k+1] = y
}

function shufflePivot(i, j, px, py, data) {
  i *= 2
  j *= 2
  data[i] = data[j]
  data[j] = px
  data[i+1] = data[j+1]
  data[j+1] = py
}

function compare(i, j, data) {
  i *= 2
  j *= 2
  var x = data[i],
      y = data[j]
  if(x < y) {
    return false
  } else if(x === y) {
    return data[i+1] > data[j+1]
  }
  return true
}

function comparePivot(i, y, b, data) {
  i *= 2
  var x = data[i]
  if(x < y) {
    return true
  } else if(x === y) {
    return data[i+1] < b
  }
  return false
}

function quickSort(left, right, data) {
  var sixth = (right - left + 1) / 6 | 0, 
      index1 = left + sixth, 
      index5 = right - sixth, 
      index3 = left + right >> 1, 
      index2 = index3 - sixth, 
      index4 = index3 + sixth, 
      el1 = index1, 
      el2 = index2, 
      el3 = index3, 
      el4 = index4, 
      el5 = index5, 
      less = left + 1, 
      great = right - 1, 
      tmp = 0
  if(compare(el1, el2, data)) {
    tmp = el1
    el1 = el2
    el2 = tmp
  }
  if(compare(el4, el5, data)) {
    tmp = el4
    el4 = el5
    el5 = tmp
  }
  if(compare(el1, el3, data)) {
    tmp = el1
    el1 = el3
    el3 = tmp
  }
  if(compare(el2, el3, data)) {
    tmp = el2
    el2 = el3
    el3 = tmp
  }
  if(compare(el1, el4, data)) {
    tmp = el1
    el1 = el4
    el4 = tmp
  }
  if(compare(el3, el4, data)) {
    tmp = el3
    el3 = el4
    el4 = tmp
  }
  if(compare(el2, el5, data)) {
    tmp = el2
    el2 = el5
    el5 = tmp
  }
  if(compare(el2, el3, data)) {
    tmp = el2
    el2 = el3
    el3 = tmp
  }
  if(compare(el4, el5, data)) {
    tmp = el4
    el4 = el5
    el5 = tmp
  }

  var pivot1X = data[2*el2]
  var pivot1Y = data[2*el2+1]
  var pivot2X = data[2*el4]
  var pivot2Y = data[2*el4+1]

  var ptr0 = 2 * el1;
  var ptr2 = 2 * el3;
  var ptr4 = 2 * el5;
  var ptr5 = 2 * index1;
  var ptr6 = 2 * index3;
  var ptr7 = 2 * index5;
  for (var i1 = 0; i1 < 2; ++i1) {
    var x = data[ptr0+i1];
    var y = data[ptr2+i1];
    var z = data[ptr4+i1];
    data[ptr5+i1] = x;
    data[ptr6+i1] = y;
    data[ptr7+i1] = z;
  }

  move(index2, left, data)
  move(index4, right, data)
  for (var k = less; k <= great; ++k) {
    if (comparePivot(k, pivot1X, pivot1Y, data)) {
      if (k !== less) {
        swap(k, less, data)
      }
      ++less;
    } else {
      if (!comparePivot(k, pivot2X, pivot2Y, data)) {
        while (true) {
          if (!comparePivot(great, pivot2X, pivot2Y, data)) {
            if (--great < k) {
              break;
            }
            continue;
          } else {
            if (comparePivot(great, pivot1X, pivot1Y, data)) {
              rotate(k, less, great, data)
              ++less;
              --great;
            } else {
              swap(k, great, data)
              --great;
            }
            break;
          }
        }
      }
    }
  }
  shufflePivot(left, less-1, pivot1X, pivot1Y, data)
  shufflePivot(right, great+1, pivot2X, pivot2Y, data)
  if (less - 2 - left <= INSERT_SORT_CUTOFF) {
    insertionSort(left, less - 2, data);
  } else {
    quickSort(left, less - 2, data);
  }
  if (right - (great + 2) <= INSERT_SORT_CUTOFF) {
    insertionSort(great + 2, right, data);
  } else {
    quickSort(great + 2, right, data);
  }
  if (great - less <= INSERT_SORT_CUTOFF) {
    insertionSort(less, great, data);
  } else {
    quickSort(less, great, data);
  }
}
},{}],44:[function(require,module,exports){
'use strict'

module.exports = {
  init:           sqInit,
  sweepBipartite: sweepBipartite,
  sweepComplete:  sweepComplete,
  scanBipartite:  scanBipartite,
  scanComplete:   scanComplete
}

var pool  = require('typedarray-pool')
var bits  = require('bit-twiddle')
var isort = require('./sort')

//Flag for blue
var BLUE_FLAG = (1<<28)

//1D sweep event queue stuff (use pool to save space)
var INIT_CAPACITY      = 1024
var RED_SWEEP_QUEUE    = pool.mallocInt32(INIT_CAPACITY)
var RED_SWEEP_INDEX    = pool.mallocInt32(INIT_CAPACITY)
var BLUE_SWEEP_QUEUE   = pool.mallocInt32(INIT_CAPACITY)
var BLUE_SWEEP_INDEX   = pool.mallocInt32(INIT_CAPACITY)
var COMMON_SWEEP_QUEUE = pool.mallocInt32(INIT_CAPACITY)
var COMMON_SWEEP_INDEX = pool.mallocInt32(INIT_CAPACITY)
var SWEEP_EVENTS       = pool.mallocDouble(INIT_CAPACITY * 8)

//Reserves memory for the 1D sweep data structures
function sqInit(count) {
  var rcount = bits.nextPow2(count)
  if(RED_SWEEP_QUEUE.length < rcount) {
    pool.free(RED_SWEEP_QUEUE)
    RED_SWEEP_QUEUE = pool.mallocInt32(rcount)
  }
  if(RED_SWEEP_INDEX.length < rcount) {
    pool.free(RED_SWEEP_INDEX)
    RED_SWEEP_INDEX = pool.mallocInt32(rcount)
  }
  if(BLUE_SWEEP_QUEUE.length < rcount) {
    pool.free(BLUE_SWEEP_QUEUE)
    BLUE_SWEEP_QUEUE = pool.mallocInt32(rcount)
  }
  if(BLUE_SWEEP_INDEX.length < rcount) {
    pool.free(BLUE_SWEEP_INDEX)
    BLUE_SWEEP_INDEX = pool.mallocInt32(rcount)
  }
  if(COMMON_SWEEP_QUEUE.length < rcount) {
    pool.free(COMMON_SWEEP_QUEUE)
    COMMON_SWEEP_QUEUE = pool.mallocInt32(rcount)
  }
  if(COMMON_SWEEP_INDEX.length < rcount) {
    pool.free(COMMON_SWEEP_INDEX)
    COMMON_SWEEP_INDEX = pool.mallocInt32(rcount)
  }
  var eventLength = 8 * rcount
  if(SWEEP_EVENTS.length < eventLength) {
    pool.free(SWEEP_EVENTS)
    SWEEP_EVENTS = pool.mallocDouble(eventLength)
  }
}

//Remove an item from the active queue in O(1)
function sqPop(queue, index, count, item) {
  var idx = index[item]
  var top = queue[count-1]
  queue[idx] = top
  index[top] = idx
}

//Insert an item into the active queue in O(1)
function sqPush(queue, index, count, item) {
  queue[count] = item
  index[item]  = count
}

//Recursion base case: use 1D sweep algorithm
function sweepBipartite(
    d, visit,
    redStart,  redEnd, red, redIndex,
    blueStart, blueEnd, blue, blueIndex) {

  //store events as pairs [coordinate, idx]
  //
  //  red create:  -(idx+1)
  //  red destroy: idx
  //  blue create: -(idx+BLUE_FLAG)
  //  blue destroy: idx+BLUE_FLAG
  //
  var ptr      = 0
  var elemSize = 2*d
  var istart   = d-1
  var iend     = elemSize-1

  for(var i=redStart; i<redEnd; ++i) {
    var idx = redIndex[i]
    var redOffset = elemSize*i
    SWEEP_EVENTS[ptr++] = red[redOffset+istart]
    SWEEP_EVENTS[ptr++] = -(idx+1)
    SWEEP_EVENTS[ptr++] = red[redOffset+iend]
    SWEEP_EVENTS[ptr++] = idx
  }

  for(var i=blueStart; i<blueEnd; ++i) {
    var idx = blueIndex[i]+BLUE_FLAG
    var blueOffset = elemSize*i
    SWEEP_EVENTS[ptr++] = blue[blueOffset+istart]
    SWEEP_EVENTS[ptr++] = -idx
    SWEEP_EVENTS[ptr++] = blue[blueOffset+iend]
    SWEEP_EVENTS[ptr++] = idx
  }

  //process events from left->right
  var n = ptr >>> 1
  isort(SWEEP_EVENTS, n)
  
  var redActive  = 0
  var blueActive = 0
  for(var i=0; i<n; ++i) {
    var e = SWEEP_EVENTS[2*i+1]|0
    if(e >= BLUE_FLAG) {
      //blue destroy event
      e = (e-BLUE_FLAG)|0
      sqPop(BLUE_SWEEP_QUEUE, BLUE_SWEEP_INDEX, blueActive--, e)
    } else if(e >= 0) {
      //red destroy event
      sqPop(RED_SWEEP_QUEUE, RED_SWEEP_INDEX, redActive--, e)
    } else if(e <= -BLUE_FLAG) {
      //blue create event
      e = (-e-BLUE_FLAG)|0
      for(var j=0; j<redActive; ++j) {
        var retval = visit(RED_SWEEP_QUEUE[j], e)
        if(retval !== void 0) {
          return retval
        }
      }
      sqPush(BLUE_SWEEP_QUEUE, BLUE_SWEEP_INDEX, blueActive++, e)
    } else {
      //red create event
      e = (-e-1)|0
      for(var j=0; j<blueActive; ++j) {
        var retval = visit(e, BLUE_SWEEP_QUEUE[j])
        if(retval !== void 0) {
          return retval
        }
      }
      sqPush(RED_SWEEP_QUEUE, RED_SWEEP_INDEX, redActive++, e)
    }
  }
}

//Complete sweep
function sweepComplete(d, visit, 
  redStart, redEnd, red, redIndex,
  blueStart, blueEnd, blue, blueIndex) {

  var ptr      = 0
  var elemSize = 2*d
  var istart   = d-1
  var iend     = elemSize-1

  for(var i=redStart; i<redEnd; ++i) {
    var idx = (redIndex[i]+1)<<1
    var redOffset = elemSize*i
    SWEEP_EVENTS[ptr++] = red[redOffset+istart]
    SWEEP_EVENTS[ptr++] = -idx
    SWEEP_EVENTS[ptr++] = red[redOffset+iend]
    SWEEP_EVENTS[ptr++] = idx
  }

  for(var i=blueStart; i<blueEnd; ++i) {
    var idx = (blueIndex[i]+1)<<1
    var blueOffset = elemSize*i
    SWEEP_EVENTS[ptr++] = blue[blueOffset+istart]
    SWEEP_EVENTS[ptr++] = (-idx)|1
    SWEEP_EVENTS[ptr++] = blue[blueOffset+iend]
    SWEEP_EVENTS[ptr++] = idx|1
  }

  //process events from left->right
  var n = ptr >>> 1
  isort(SWEEP_EVENTS, n)
  
  var redActive    = 0
  var blueActive   = 0
  var commonActive = 0
  for(var i=0; i<n; ++i) {
    var e     = SWEEP_EVENTS[2*i+1]|0
    var color = e&1
    if(i < n-1 && (e>>1) === (SWEEP_EVENTS[2*i+3]>>1)) {
      color = 2
      i += 1
    }
    
    if(e < 0) {
      //Create event
      var id = -(e>>1) - 1

      //Intersect with common
      for(var j=0; j<commonActive; ++j) {
        var retval = visit(COMMON_SWEEP_QUEUE[j], id)
        if(retval !== void 0) {
          return retval
        }
      }

      if(color !== 0) {
        //Intersect with red
        for(var j=0; j<redActive; ++j) {
          var retval = visit(RED_SWEEP_QUEUE[j], id)
          if(retval !== void 0) {
            return retval
          }
        }
      }

      if(color !== 1) {
        //Intersect with blue
        for(var j=0; j<blueActive; ++j) {
          var retval = visit(BLUE_SWEEP_QUEUE[j], id)
          if(retval !== void 0) {
            return retval
          }
        }
      }

      if(color === 0) {
        //Red
        sqPush(RED_SWEEP_QUEUE, RED_SWEEP_INDEX, redActive++, id)
      } else if(color === 1) {
        //Blue
        sqPush(BLUE_SWEEP_QUEUE, BLUE_SWEEP_INDEX, blueActive++, id)
      } else if(color === 2) {
        //Both
        sqPush(COMMON_SWEEP_QUEUE, COMMON_SWEEP_INDEX, commonActive++, id)
      }
    } else {
      //Destroy event
      var id = (e>>1) - 1
      if(color === 0) {
        //Red
        sqPop(RED_SWEEP_QUEUE, RED_SWEEP_INDEX, redActive--, id)
      } else if(color === 1) {
        //Blue
        sqPop(BLUE_SWEEP_QUEUE, BLUE_SWEEP_INDEX, blueActive--, id)
      } else if(color === 2) {
        //Both
        sqPop(COMMON_SWEEP_QUEUE, COMMON_SWEEP_INDEX, commonActive--, id)
      }
    }
  }
}

//Sweep and prune/scanline algorithm:
//  Scan along axis, detect intersections
//  Brute force all boxes along axis
function scanBipartite(
  d, axis, visit, flip,
  redStart,  redEnd, red, redIndex,
  blueStart, blueEnd, blue, blueIndex) {
  
  var ptr      = 0
  var elemSize = 2*d
  var istart   = axis
  var iend     = axis+d

  var redShift  = 1
  var blueShift = 1
  if(flip) {
    blueShift = BLUE_FLAG
  } else {
    redShift  = BLUE_FLAG
  }

  for(var i=redStart; i<redEnd; ++i) {
    var idx = i + redShift
    var redOffset = elemSize*i
    SWEEP_EVENTS[ptr++] = red[redOffset+istart]
    SWEEP_EVENTS[ptr++] = -idx
    SWEEP_EVENTS[ptr++] = red[redOffset+iend]
    SWEEP_EVENTS[ptr++] = idx
  }
  for(var i=blueStart; i<blueEnd; ++i) {
    var idx = i + blueShift
    var blueOffset = elemSize*i
    SWEEP_EVENTS[ptr++] = blue[blueOffset+istart]
    SWEEP_EVENTS[ptr++] = -idx
  }

  //process events from left->right
  var n = ptr >>> 1
  isort(SWEEP_EVENTS, n)
  
  var redActive    = 0
  for(var i=0; i<n; ++i) {
    var e = SWEEP_EVENTS[2*i+1]|0
    if(e < 0) {
      var idx   = -e
      var isRed = false
      if(idx >= BLUE_FLAG) {
        isRed = !flip
        idx -= BLUE_FLAG 
      } else {
        isRed = !!flip
        idx -= 1
      }
      if(isRed) {
        sqPush(RED_SWEEP_QUEUE, RED_SWEEP_INDEX, redActive++, idx)
      } else {
        var blueId  = blueIndex[idx]
        var bluePtr = elemSize * idx
        
        var b0 = blue[bluePtr+axis+1]
        var b1 = blue[bluePtr+axis+1+d]

red_loop:
        for(var j=0; j<redActive; ++j) {
          var oidx   = RED_SWEEP_QUEUE[j]
          var redPtr = elemSize * oidx

          if(b1 < red[redPtr+axis+1] || 
             red[redPtr+axis+1+d] < b0) {
            continue
          }

          for(var k=axis+2; k<d; ++k) {
            if(blue[bluePtr + k + d] < red[redPtr + k] || 
               red[redPtr + k + d] < blue[bluePtr + k]) {
              continue red_loop
            }
          }

          var redId  = redIndex[oidx]
          var retval
          if(flip) {
            retval = visit(blueId, redId)
          } else {
            retval = visit(redId, blueId)
          }
          if(retval !== void 0) {
            return retval 
          }
        }
      }
    } else {
      sqPop(RED_SWEEP_QUEUE, RED_SWEEP_INDEX, redActive--, e - redShift)
    }
  }
}

function scanComplete(
  d, axis, visit,
  redStart,  redEnd, red, redIndex,
  blueStart, blueEnd, blue, blueIndex) {

  var ptr      = 0
  var elemSize = 2*d
  var istart   = axis
  var iend     = axis+d

  for(var i=redStart; i<redEnd; ++i) {
    var idx = i + BLUE_FLAG
    var redOffset = elemSize*i
    SWEEP_EVENTS[ptr++] = red[redOffset+istart]
    SWEEP_EVENTS[ptr++] = -idx
    SWEEP_EVENTS[ptr++] = red[redOffset+iend]
    SWEEP_EVENTS[ptr++] = idx
  }
  for(var i=blueStart; i<blueEnd; ++i) {
    var idx = i + 1
    var blueOffset = elemSize*i
    SWEEP_EVENTS[ptr++] = blue[blueOffset+istart]
    SWEEP_EVENTS[ptr++] = -idx
  }

  //process events from left->right
  var n = ptr >>> 1
  isort(SWEEP_EVENTS, n)
  
  var redActive    = 0
  for(var i=0; i<n; ++i) {
    var e = SWEEP_EVENTS[2*i+1]|0
    if(e < 0) {
      var idx   = -e
      if(idx >= BLUE_FLAG) {
        RED_SWEEP_QUEUE[redActive++] = idx - BLUE_FLAG
      } else {
        idx -= 1
        var blueId  = blueIndex[idx]
        var bluePtr = elemSize * idx

        var b0 = blue[bluePtr+axis+1]
        var b1 = blue[bluePtr+axis+1+d]

red_loop:
        for(var j=0; j<redActive; ++j) {
          var oidx   = RED_SWEEP_QUEUE[j]
          var redId  = redIndex[oidx]

          if(redId === blueId) {
            break
          }

          var redPtr = elemSize * oidx
          if(b1 < red[redPtr+axis+1] || 
            red[redPtr+axis+1+d] < b0) {
            continue
          }
          for(var k=axis+2; k<d; ++k) {
            if(blue[bluePtr + k + d] < red[redPtr + k] || 
               red[redPtr + k + d]   < blue[bluePtr + k]) {
              continue red_loop
            }
          }

          var retval = visit(redId, blueId)
          if(retval !== void 0) {
            return retval 
          }
        }
      }
    } else {
      var idx = e - BLUE_FLAG
      for(var j=redActive-1; j>=0; --j) {
        if(RED_SWEEP_QUEUE[j] === idx) {
          for(var k=j+1; k<redActive; ++k) {
            RED_SWEEP_QUEUE[k-1] = RED_SWEEP_QUEUE[k]
          }
          break
        }
      }
      --redActive
    }
  }
}
},{"./sort":43,"bit-twiddle":35,"typedarray-pool":212}],45:[function(require,module,exports){
var size = require('element-size')

module.exports = fit

var scratch = new Float32Array(2)

function fit(canvas, parent, scale) {
  var isSVG = canvas.nodeName.toUpperCase() === 'SVG'

  canvas.style.position = canvas.style.position || 'absolute'
  canvas.style.top = 0
  canvas.style.left = 0

  resize.scale  = parseFloat(scale || 1)
  resize.parent = parent

  return resize()

  function resize() {
    var p = resize.parent || canvas.parentNode
    if (typeof p === 'function') {
      var dims   = p(scratch) || scratch
      var width  = dims[0]
      var height = dims[1]
    } else
    if (p && p !== document.body) {
      var psize  = size(p)
      var width  = psize[0]|0
      var height = psize[1]|0
    } else {
      var width  = window.innerWidth
      var height = window.innerHeight
    }

    if (isSVG) {
      canvas.setAttribute('width', width * resize.scale + 'px')
      canvas.setAttribute('height', height * resize.scale + 'px')
    } else {
      canvas.width = width * resize.scale
      canvas.height = height * resize.scale
    }

    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'

    return resize
  }
}

},{"element-size":70}],46:[function(require,module,exports){
'use strict'

var monotoneTriangulate = require('./lib/monotone')
var makeIndex = require('./lib/triangulation')
var delaunayFlip = require('./lib/delaunay')
var filterTriangulation = require('./lib/filter')

module.exports = cdt2d

function canonicalizeEdge(e) {
  return [Math.min(e[0], e[1]), Math.max(e[0], e[1])]
}

function compareEdge(a, b) {
  return a[0]-b[0] || a[1]-b[1]
}

function canonicalizeEdges(edges) {
  return edges.map(canonicalizeEdge).sort(compareEdge)
}

function getDefault(options, property, dflt) {
  if(property in options) {
    return options[property]
  }
  return dflt
}

function cdt2d(points, edges, options) {

  if(!Array.isArray(edges)) {
    options = edges || {}
    edges = []
  } else {
    options = options || {}
    edges = edges || []
  }

  //Parse out options
  var delaunay = !!getDefault(options, 'delaunay', true)
  var interior = !!getDefault(options, 'interior', true)
  var exterior = !!getDefault(options, 'exterior', true)
  var infinity = !!getDefault(options, 'infinity', false)

  //Handle trivial case
  if((!interior && !exterior) || points.length === 0) {
    return []
  }

  //Construct initial triangulation
  var cells = monotoneTriangulate(points, edges)

  //If delaunay refinement needed, then improve quality by edge flipping
  if(delaunay || interior !== exterior || infinity) {

    //Index all of the cells to support fast neighborhood queries
    var triangulation = makeIndex(points.length, canonicalizeEdges(edges))
    for(var i=0; i<cells.length; ++i) {
      var f = cells[i]
      triangulation.addTriangle(f[0], f[1], f[2])
    }

    //Run edge flipping
    if(delaunay) {
      delaunayFlip(points, triangulation)
    }

    //Filter points
    if(!exterior) {
      return filterTriangulation(triangulation, -1)
    } else if(!interior) {
      return filterTriangulation(triangulation,  1, infinity)
    } else if(infinity) {
      return filterTriangulation(triangulation, 0, infinity)
    } else {
      return triangulation.cells()
    }
    
  } else {
    return cells
  }
}

},{"./lib/delaunay":47,"./lib/filter":48,"./lib/monotone":49,"./lib/triangulation":50}],47:[function(require,module,exports){
'use strict'

var inCircle = require('robust-in-sphere')[4]
var bsearch = require('binary-search-bounds')

module.exports = delaunayRefine

function testFlip(points, triangulation, stack, a, b, x) {
  var y = triangulation.opposite(a, b)

  //Test boundary edge
  if(y < 0) {
    return
  }

  //Swap edge if order flipped
  if(b < a) {
    var tmp = a
    a = b
    b = tmp
    tmp = x
    x = y
    y = tmp
  }

  //Test if edge is constrained
  if(triangulation.isConstraint(a, b)) {
    return
  }

  //Test if edge is delaunay
  if(inCircle(points[a], points[b], points[x], points[y]) < 0) {
    stack.push(a, b)
  }
}

//Assume edges are sorted lexicographically
function delaunayRefine(points, triangulation) {
  var stack = []

  var numPoints = points.length
  var stars = triangulation.stars
  for(var a=0; a<numPoints; ++a) {
    var star = stars[a]
    for(var j=1; j<star.length; j+=2) {
      var b = star[j]

      //If order is not consistent, then skip edge
      if(b < a) {
        continue
      }

      //Check if edge is constrained
      if(triangulation.isConstraint(a, b)) {
        continue
      }

      //Find opposite edge
      var x = star[j-1], y = -1
      for(var k=1; k<star.length; k+=2) {
        if(star[k-1] === b) {
          y = star[k]
          break
        }
      }

      //If this is a boundary edge, don't flip it
      if(y < 0) {
        continue
      }

      //If edge is in circle, flip it
      if(inCircle(points[a], points[b], points[x], points[y]) < 0) {
        stack.push(a, b)
      }
    }
  }

  while(stack.length > 0) {
    var b = stack.pop()
    var a = stack.pop()

    //Find opposite pairs
    var x = -1, y = -1
    var star = stars[a]
    for(var i=1; i<star.length; i+=2) {
      var s = star[i-1]
      var t = star[i]
      if(s === b) {
        y = t
      } else if(t === b) {
        x = s
      }
    }

    //If x/y are both valid then skip edge
    if(x < 0 || y < 0) {
      continue
    }

    //If edge is now delaunay, then don't flip it
    if(inCircle(points[a], points[b], points[x], points[y]) >= 0) {
      continue
    }

    //Flip the edge
    triangulation.flip(a, b)

    //Test flipping neighboring edges
    testFlip(points, triangulation, stack, x, a, y)
    testFlip(points, triangulation, stack, a, y, x)
    testFlip(points, triangulation, stack, y, b, x)
    testFlip(points, triangulation, stack, b, x, y)
  }
}

},{"binary-search-bounds":51,"robust-in-sphere":188}],48:[function(require,module,exports){
'use strict'

var bsearch = require('binary-search-bounds')

module.exports = classifyFaces

function FaceIndex(cells, neighbor, constraint, flags, active, next, boundary) {
  this.cells       = cells
  this.neighbor    = neighbor
  this.flags       = flags
  this.constraint  = constraint
  this.active      = active
  this.next        = next
  this.boundary    = boundary
}

var proto = FaceIndex.prototype

function compareCell(a, b) {
  return a[0] - b[0] ||
         a[1] - b[1] ||
         a[2] - b[2]
}

proto.locate = (function() {
  var key = [0,0,0]
  return function(a, b, c) {
    var x = a, y = b, z = c
    if(b < c) {
      if(b < a) {
        x = b
        y = c
        z = a
      }
    } else if(c < a) {
      x = c
      y = a
      z = b
    }
    if(x < 0) {
      return -1
    }
    key[0] = x
    key[1] = y
    key[2] = z
    return bsearch.eq(this.cells, key, compareCell)
  }
})()

function indexCells(triangulation, infinity) {
  //First get cells and canonicalize
  var cells = triangulation.cells()
  var nc = cells.length
  for(var i=0; i<nc; ++i) {
    var c = cells[i]
    var x = c[0], y = c[1], z = c[2]
    if(y < z) {
      if(y < x) {
        c[0] = y
        c[1] = z
        c[2] = x
      }
    } else if(z < x) {
      c[0] = z
      c[1] = x
      c[2] = y
    }
  }
  cells.sort(compareCell)

  //Initialize flag array
  var flags = new Array(nc)
  for(var i=0; i<flags.length; ++i) {
    flags[i] = 0
  }

  //Build neighbor index, initialize queues
  var active = []
  var next   = []
  var neighbor = new Array(3*nc)
  var constraint = new Array(3*nc)
  var boundary = null
  if(infinity) {
    boundary = []
  }
  var index = new FaceIndex(
    cells,
    neighbor,
    constraint,
    flags,
    active,
    next,
    boundary)
  for(var i=0; i<nc; ++i) {
    var c = cells[i]
    for(var j=0; j<3; ++j) {
      var x = c[j], y = c[(j+1)%3]
      var a = neighbor[3*i+j] = index.locate(y, x, triangulation.opposite(y, x))
      var b = constraint[3*i+j] = triangulation.isConstraint(x, y)
      if(a < 0) {
        if(b) {
          next.push(i)
        } else {
          active.push(i)
          flags[i] = 1
        }
        if(infinity) {
          boundary.push([y, x, -1])
        }
      }
    }
  }
  return index
}

function filterCells(cells, flags, target) {
  var ptr = 0
  for(var i=0; i<cells.length; ++i) {
    if(flags[i] === target) {
      cells[ptr++] = cells[i]
    }
  }
  cells.length = ptr
  return cells
}

function classifyFaces(triangulation, target, infinity) {
  var index = indexCells(triangulation, infinity)

  if(target === 0) {
    if(infinity) {
      return index.cells.concat(index.boundary)
    } else {
      return index.cells
    }
  }

  var side = 1
  var active = index.active
  var next = index.next
  var flags = index.flags
  var cells = index.cells
  var constraint = index.constraint
  var neighbor = index.neighbor

  while(active.length > 0 || next.length > 0) {
    while(active.length > 0) {
      var t = active.pop()
      if(flags[t] === -side) {
        continue
      }
      flags[t] = side
      var c = cells[t]
      for(var j=0; j<3; ++j) {
        var f = neighbor[3*t+j]
        if(f >= 0 && flags[f] === 0) {
          if(constraint[3*t+j]) {
            next.push(f)
          } else {
            active.push(f)
            flags[f] = side
          }
        }
      }
    }

    //Swap arrays and loop
    var tmp = next
    next = active
    active = tmp
    next.length = 0
    side = -side
  }

  var result = filterCells(cells, flags, target)
  if(infinity) {
    return result.concat(index.boundary)
  }
  return result
}

},{"binary-search-bounds":51}],49:[function(require,module,exports){
'use strict'

var bsearch = require('binary-search-bounds')
var orient = require('robust-orientation')[3]

var EVENT_POINT = 0
var EVENT_END   = 1
var EVENT_START = 2

module.exports = monotoneTriangulate

//A partial convex hull fragment, made of two unimonotone polygons
function PartialHull(a, b, idx, lowerIds, upperIds) {
  this.a = a
  this.b = b
  this.idx = idx
  this.lowerIds = lowerIds
  this.upperIds = upperIds
}

//An event in the sweep line procedure
function Event(a, b, type, idx) {
  this.a    = a
  this.b    = b
  this.type = type
  this.idx  = idx
}

//This is used to compare events for the sweep line procedure
// Points are:
//  1. sorted lexicographically
//  2. sorted by type  (point < end < start)
//  3. segments sorted by winding order
//  4. sorted by index
function compareEvent(a, b) {
  var d =
    (a.a[0] - b.a[0]) ||
    (a.a[1] - b.a[1]) ||
    (a.type - b.type)
  if(d) { return d }
  if(a.type !== EVENT_POINT) {
    d = orient(a.a, a.b, b.b)
    if(d) { return d }
  }
  return a.idx - b.idx
}

function testPoint(hull, p) {
  return orient(hull.a, hull.b, p)
}

function addPoint(cells, hulls, points, p, idx) {
  var lo = bsearch.lt(hulls, p, testPoint)
  var hi = bsearch.gt(hulls, p, testPoint)
  for(var i=lo; i<hi; ++i) {
    var hull = hulls[i]

    //Insert p into lower hull
    var lowerIds = hull.lowerIds
    var m = lowerIds.length
    while(m > 1 && orient(
        points[lowerIds[m-2]],
        points[lowerIds[m-1]],
        p) > 0) {
      cells.push(
        [lowerIds[m-1],
         lowerIds[m-2],
         idx])
      m -= 1
    }
    lowerIds.length = m
    lowerIds.push(idx)

    //Insert p into upper hull
    var upperIds = hull.upperIds
    var m = upperIds.length
    while(m > 1 && orient(
        points[upperIds[m-2]],
        points[upperIds[m-1]],
        p) < 0) {
      cells.push(
        [upperIds[m-2],
         upperIds[m-1],
         idx])
      m -= 1
    }
    upperIds.length = m
    upperIds.push(idx)
  }
}

function findSplit(hull, edge) {
  var d
  if(hull.a[0] < edge.a[0]) {
    d = orient(hull.a, hull.b, edge.a)
  } else {
    d = orient(edge.b, edge.a, hull.a)
  }
  if(d) { return d }
  if(edge.b[0] < hull.b[0]) {
    d = orient(hull.a, hull.b, edge.b)
  } else {
    d = orient(edge.b, edge.a, hull.b)
  }
  return d || hull.idx - edge.idx
}

function splitHulls(hulls, points, event) {
  var splitIdx = bsearch.le(hulls, event, findSplit)
  var hull = hulls[splitIdx]
  var upperIds = hull.upperIds
  var x = upperIds[upperIds.length-1]
  hull.upperIds = [x]
  hulls.splice(splitIdx+1, 0,
    new PartialHull(event.a, event.b, event.idx, [x], upperIds))
}


function mergeHulls(hulls, points, event) {
  //Swap pointers for merge search
  var tmp = event.a
  event.a = event.b
  event.b = tmp
  var mergeIdx = bsearch.eq(hulls, event, findSplit)
  var upper = hulls[mergeIdx]
  var lower = hulls[mergeIdx-1]
  lower.upperIds = upper.upperIds
  hulls.splice(mergeIdx, 1)
}


function monotoneTriangulate(points, edges) {

  var numPoints = points.length
  var numEdges = edges.length

  var events = []

  //Create point events
  for(var i=0; i<numPoints; ++i) {
    events.push(new Event(
      points[i],
      null,
      EVENT_POINT,
      i))
  }

  //Create edge events
  for(var i=0; i<numEdges; ++i) {
    var e = edges[i]
    var a = points[e[0]]
    var b = points[e[1]]
    if(a[0] < b[0]) {
      events.push(
        new Event(a, b, EVENT_START, i),
        new Event(b, a, EVENT_END, i))
    } else if(a[0] > b[0]) {
      events.push(
        new Event(b, a, EVENT_START, i),
        new Event(a, b, EVENT_END, i))
    }
  }

  //Sort events
  events.sort(compareEvent)

  //Initialize hull
  var minX = events[0].a[0] - (1 + Math.abs(events[0].a[0])) * Math.pow(2, -52)
  var hull = [ new PartialHull([minX, 1], [minX, 0], -1, [], [], [], []) ]

  //Process events in order
  var cells = []
  for(var i=0, numEvents=events.length; i<numEvents; ++i) {
    var event = events[i]
    var type = event.type
    if(type === EVENT_POINT) {
      addPoint(cells, hull, points, event.a, event.idx)
    } else if(type === EVENT_START) {
      splitHulls(hull, points, event)
    } else {
      mergeHulls(hull, points, event)
    }
  }

  //Return triangulation
  return cells
}

},{"binary-search-bounds":51,"robust-orientation":190}],50:[function(require,module,exports){
'use strict'

var bsearch = require('binary-search-bounds')

module.exports = createTriangulation

function Triangulation(stars, edges) {
  this.stars = stars
  this.edges = edges
}

var proto = Triangulation.prototype

function removePair(list, j, k) {
  for(var i=1, n=list.length; i<n; i+=2) {
    if(list[i-1] === j && list[i] === k) {
      list[i-1] = list[n-2]
      list[i] = list[n-1]
      list.length = n - 2
      return
    }
  }
}

proto.isConstraint = (function() {
  var e = [0,0]
  function compareLex(a, b) {
    return a[0] - b[0] || a[1] - b[1]
  }
  return function(i, j) {
    e[0] = Math.min(i,j)
    e[1] = Math.max(i,j)
    return bsearch.eq(this.edges, e, compareLex) >= 0
  }
})()

proto.removeTriangle = function(i, j, k) {
  var stars = this.stars
  removePair(stars[i], j, k)
  removePair(stars[j], k, i)
  removePair(stars[k], i, j)
}

proto.addTriangle = function(i, j, k) {
  var stars = this.stars
  stars[i].push(j, k)
  stars[j].push(k, i)
  stars[k].push(i, j)
}

proto.opposite = function(j, i) {
  var list = this.stars[i]
  for(var k=1, n=list.length; k<n; k+=2) {
    if(list[k] === j) {
      return list[k-1]
    }
  }
  return -1
}

proto.flip = function(i, j) {
  var a = this.opposite(i, j)
  var b = this.opposite(j, i)
  this.removeTriangle(i, j, a)
  this.removeTriangle(j, i, b)
  this.addTriangle(i, b, a)
  this.addTriangle(j, a, b)
}

proto.edges = function() {
  var stars = this.stars
  var result = []
  for(var i=0, n=stars.length; i<n; ++i) {
    var list = stars[i]
    for(var j=0, m=list.length; j<m; j+=2) {
      result.push([list[j], list[j+1]])
    }
  }
  return result
}

proto.cells = function() {
  var stars = this.stars
  var result = []
  for(var i=0, n=stars.length; i<n; ++i) {
    var list = stars[i]
    for(var j=0, m=list.length; j<m; j+=2) {
      var s = list[j]
      var t = list[j+1]
      if(i < Math.min(s, t)) {
        result.push([i, s, t])
      }
    }
  }
  return result
}

function createTriangulation(numVerts, edges) {
  var stars = new Array(numVerts)
  for(var i=0; i<numVerts; ++i) {
    stars[i] = []
  }
  return new Triangulation(stars, edges)
}

},{"binary-search-bounds":51}],51:[function(require,module,exports){
"use strict"

function compileSearch(funcName, predicate, reversed, extraArgs, earlyOut) {
  var code = [
    "function ", funcName, "(a,l,h,", extraArgs.join(","),  "){",
earlyOut ? "" : "var i=", (reversed ? "l-1" : "h+1"),
";while(l<=h){\
var m=(l+h)>>>1,x=a[m]"]
  if(earlyOut) {
    if(predicate.indexOf("c") < 0) {
      code.push(";if(x===y){return m}else if(x<=y){")
    } else {
      code.push(";var p=c(x,y);if(p===0){return m}else if(p<=0){")
    }
  } else {
    code.push(";if(", predicate, "){i=m;")
  }
  if(reversed) {
    code.push("l=m+1}else{h=m-1}")
  } else {
    code.push("h=m-1}else{l=m+1}")
  }
  code.push("}")
  if(earlyOut) {
    code.push("return -1};")
  } else {
    code.push("return i};")
  }
  return code.join("")
}

function compileBoundsSearch(predicate, reversed, suffix, earlyOut) {
  var result = new Function([
  compileSearch("A", "x" + predicate + "y", reversed, ["y"], earlyOut),
  compileSearch("P", "c(x,y)" + predicate + "0", reversed, ["y", "c"], earlyOut),
"function dispatchBsearch", suffix, "(a,y,c,l,h){\
if(typeof(c)==='function'){\
return P(a,(l===void 0)?0:l|0,(h===void 0)?a.length-1:h|0,y,c)\
}else{\
return A(a,(c===void 0)?0:c|0,(l===void 0)?a.length-1:l|0,y)\
}}\
return dispatchBsearch", suffix].join(""))
  return result()
}

module.exports = {
  ge: compileBoundsSearch(">=", false, "GE"),
  gt: compileBoundsSearch(">", false, "GT"),
  lt: compileBoundsSearch("<", true, "LT"),
  le: compileBoundsSearch("<=", true, "LE"),
  eq: compileBoundsSearch("-", true, "EQ", true)
}

},{}],52:[function(require,module,exports){
'use strict'

module.exports = cleanPSLG

var UnionFind = require('union-find')
var boxIntersect = require('box-intersect')
var segseg = require('robust-segment-intersect')
var rat = require('big-rat')
var ratCmp = require('big-rat/cmp')
var ratToFloat = require('big-rat/to-float')
var ratVec = require('rat-vec')
var nextafter = require('nextafter')

var solveIntersection = require('./lib/rat-seg-intersect')

// Bounds on a rational number when rounded to a float
function boundRat (r) {
  var f = ratToFloat(r)
  return [
    nextafter(f, -Infinity),
    nextafter(f, Infinity)
  ]
}

// Convert a list of edges in a pslg to bounding boxes
function boundEdges (points, edges) {
  var bounds = new Array(edges.length)
  for (var i = 0; i < edges.length; ++i) {
    var e = edges[i]
    var a = points[e[0]]
    var b = points[e[1]]
    bounds[i] = [
      nextafter(Math.min(a[0], b[0]), -Infinity),
      nextafter(Math.min(a[1], b[1]), -Infinity),
      nextafter(Math.max(a[0], b[0]), Infinity),
      nextafter(Math.max(a[1], b[1]), Infinity)
    ]
  }
  return bounds
}

// Convert a list of points into bounding boxes by duplicating coords
function boundPoints (points) {
  var bounds = new Array(points.length)
  for (var i = 0; i < points.length; ++i) {
    var p = points[i]
    bounds[i] = [
      nextafter(p[0], -Infinity),
      nextafter(p[1], -Infinity),
      nextafter(p[0], Infinity),
      nextafter(p[1], Infinity)
    ]
  }
  return bounds
}

// Find all pairs of crossing edges in a pslg (given edge bounds)
function getCrossings (points, edges, edgeBounds) {
  var result = []
  boxIntersect(edgeBounds, function (i, j) {
    var e = edges[i]
    var f = edges[j]
    if (e[0] === f[0] || e[0] === f[1] ||
      e[1] === f[0] || e[1] === f[1]) {
      return
    }
    var a = points[e[0]]
    var b = points[e[1]]
    var c = points[f[0]]
    var d = points[f[1]]
    if (segseg(a, b, c, d)) {
      result.push([i, j])
    }
  })
  return result
}

// Find all pairs of crossing vertices in a pslg (given edge/vert bounds)
function getTJunctions (points, edges, edgeBounds, vertBounds) {
  var result = []
  boxIntersect(edgeBounds, vertBounds, function (i, v) {
    var e = edges[i]
    if (e[0] === v || e[1] === v) {
      return
    }
    var p = points[v]
    var a = points[e[0]]
    var b = points[e[1]]
    if (segseg(a, b, p, p)) {
      result.push([i, v])
    }
  })
  return result
}

// Cut edges along crossings/tjunctions
function cutEdges (floatPoints, edges, crossings, junctions, useColor) {
  var i, e

  // Convert crossings into tjunctions by constructing rational points
  var ratPoints = floatPoints.map(function(p) {
      return [
          rat(p[0]),
          rat(p[1])
      ]
  })
  for (i = 0; i < crossings.length; ++i) {
    var crossing = crossings[i]
    e = crossing[0]
    var f = crossing[1]
    var ee = edges[e]
    var ef = edges[f]
    var x = solveIntersection(
      ratVec(floatPoints[ee[0]]),
      ratVec(floatPoints[ee[1]]),
      ratVec(floatPoints[ef[0]]),
      ratVec(floatPoints[ef[1]]))
    if (!x) {
      // Segments are parallel, should already be handled by t-junctions
      continue
    }
    var idx = floatPoints.length
    floatPoints.push([ratToFloat(x[0]), ratToFloat(x[1])])
    ratPoints.push(x)
    junctions.push([e, idx], [f, idx])
  }

  // Sort tjunctions
  junctions.sort(function (a, b) {
    if (a[0] !== b[0]) {
      return a[0] - b[0]
    }
    var u = ratPoints[a[1]]
    var v = ratPoints[b[1]]
    return ratCmp(u[0], v[0]) || ratCmp(u[1], v[1])
  })

  // Split edges along junctions
  for (i = junctions.length - 1; i >= 0; --i) {
    var junction = junctions[i]
    e = junction[0]

    var edge = edges[e]
    var s = edge[0]
    var t = edge[1]

    // Check if edge is not lexicographically sorted
    var a = floatPoints[s]
    var b = floatPoints[t]
    if (((a[0] - b[0]) || (a[1] - b[1])) < 0) {
      var tmp = s
      s = t
      t = tmp
    }

    // Split leading edge
    edge[0] = s
    var last = edge[1] = junction[1]

    // If we are grouping edges by color, remember to track data
    var color
    if (useColor) {
      color = edge[2]
    }

    // Split other edges
    while (i > 0 && junctions[i - 1][0] === e) {
      var junction = junctions[--i]
      var next = junction[1]
      if (useColor) {
        edges.push([last, next, color])
      } else {
        edges.push([last, next])
      }
      last = next
    }

    // Add final edge
    if (useColor) {
      edges.push([last, t, color])
    } else {
      edges.push([last, t])
    }
  }

  // Return constructed rational points
  return ratPoints
}

// Merge overlapping points
function dedupPoints (floatPoints, ratPoints, floatBounds) {
  var numPoints = ratPoints.length
  var uf = new UnionFind(numPoints)

  // Compute rational bounds
  var bounds = []
  for (var i = 0; i < ratPoints.length; ++i) {
    var p = ratPoints[i]
    var xb = boundRat(p[0])
    var yb = boundRat(p[1])
    bounds.push([
      nextafter(xb[0], -Infinity),
      nextafter(yb[0], -Infinity),
      nextafter(xb[1], Infinity),
      nextafter(yb[1], Infinity)
    ])
  }

  // Link all points with over lapping boxes
  boxIntersect(bounds, function (i, j) {
    uf.link(i, j)
  })

  // Do 1 pass over points to combine points in label sets
  var noDupes = true
  var labels = new Array(numPoints)
  for (var i = 0; i < numPoints; ++i) {
    var j = uf.find(i)
    if (j !== i) {
      // Clear no-dupes flag, zero out label
      noDupes = false
      // Make each point the top-left point from its cell
      floatPoints[j] = [
        Math.min(floatPoints[i][0], floatPoints[j][0]),
        Math.min(floatPoints[i][1], floatPoints[j][1])
      ]
    }
  }

  // If no duplicates, return null to signal termination
  if (noDupes) {
    return null
  }

  var ptr = 0
  for (var i = 0; i < numPoints; ++i) {
    var j = uf.find(i)
    if (j === i) {
      labels[i] = ptr
      floatPoints[ptr++] = floatPoints[i]
    } else {
      labels[i] = -1
    }
  }

  floatPoints.length = ptr

  // Do a second pass to fix up missing labels
  for (var i = 0; i < numPoints; ++i) {
    if (labels[i] < 0) {
      labels[i] = labels[uf.find(i)]
    }
  }

  // Return resulting union-find data structure
  return labels
}

function compareLex2 (a, b) { return (a[0] - b[0]) || (a[1] - b[1]) }
function compareLex3 (a, b) {
  var d = (a[0] - b[0]) || (a[1] - b[1])
  if (d) {
    return d
  }
  if (a[2] < b[2]) {
    return -1
  } else if (a[2] > b[2]) {
    return 1
  }
  return 0
}

// Remove duplicate edge labels
function dedupEdges (edges, labels, useColor) {
  if (edges.length === 0) {
    return
  }
  if (labels) {
    for (var i = 0; i < edges.length; ++i) {
      var e = edges[i]
      var a = labels[e[0]]
      var b = labels[e[1]]
      e[0] = Math.min(a, b)
      e[1] = Math.max(a, b)
    }
  } else {
    for (var i = 0; i < edges.length; ++i) {
      var e = edges[i]
      var a = e[0]
      var b = e[1]
      e[0] = Math.min(a, b)
      e[1] = Math.max(a, b)
    }
  }
  if (useColor) {
    edges.sort(compareLex3)
  } else {
    edges.sort(compareLex2)
  }
  var ptr = 1
  for (var i = 1; i < edges.length; ++i) {
    var prev = edges[i - 1]
    var next = edges[i]
    if (next[0] === prev[0] && next[1] === prev[1] &&
      (!useColor || next[2] === prev[2])) {
      continue
    }
    edges[ptr++] = next
  }
  edges.length = ptr
}

function preRound (points, edges, useColor) {
  var labels = dedupPoints(points, [], boundPoints(points))
  dedupEdges(edges, labels, useColor)
  return !!labels
}

// Repeat until convergence
function snapRound (points, edges, useColor) {
  // 1. find edge crossings
  var edgeBounds = boundEdges(points, edges)
  var crossings = getCrossings(points, edges, edgeBounds)

  // 2. find t-junctions
  var vertBounds = boundPoints(points)
  var tjunctions = getTJunctions(points, edges, edgeBounds, vertBounds)

  // 3. cut edges, construct rational points
  var ratPoints = cutEdges(points, edges, crossings, tjunctions, useColor)

  // 4. dedupe verts
  var labels = dedupPoints(points, ratPoints, vertBounds)

  // 5. dedupe edges
  dedupEdges(edges, labels, useColor)

  // 6. check termination
  if (!labels) {
    return (crossings.length > 0 || tjunctions.length > 0)
  }

  // More iterations necessary
  return true
}

// Main loop, runs PSLG clean up until completion
function cleanPSLG (points, edges, colors) {
  // If using colors, augment edges with color data
  var prevEdges
  if (colors) {
    prevEdges = edges
    var augEdges = new Array(edges.length)
    for (var i = 0; i < edges.length; ++i) {
      var e = edges[i]
      augEdges[i] = [e[0], e[1], colors[i]]
    }
    edges = augEdges
  }

  // First round: remove duplicate edges and points
  var modified = preRound(points, edges, !!colors)

  // Run snap rounding until convergence
  while (snapRound(points, edges, !!colors)) {
    modified = true
  }

  // Strip color tags
  if (!!colors && modified) {
    prevEdges.length = 0
    colors.length = 0
    for (var i = 0; i < edges.length; ++i) {
      var e = edges[i]
      prevEdges.push([e[0], e[1]])
      colors.push(e[2])
    }
  }

  return modified
}

},{"./lib/rat-seg-intersect":53,"big-rat":21,"big-rat/cmp":19,"big-rat/to-float":33,"box-intersect":38,"nextafter":165,"rat-vec":180,"robust-segment-intersect":193,"union-find":213}],53:[function(require,module,exports){
'use strict'

module.exports = solveIntersection

var ratMul = require('big-rat/mul')
var ratDiv = require('big-rat/div')
var ratSub = require('big-rat/sub')
var ratSign = require('big-rat/sign')
var rvSub = require('rat-vec/sub')
var rvAdd = require('rat-vec/add')
var rvMuls = require('rat-vec/muls')

function ratPerp (a, b) {
  return ratSub(ratMul(a[0], b[1]), ratMul(a[1], b[0]))
}

// Solve for intersection
//  x = a + t (b-a)
//  (x - c) ^ (d-c) = 0
//  (t * (b-a) + (a-c) ) ^ (d-c) = 0
//  t * (b-a)^(d-c) = (d-c)^(a-c)
//  t = (d-c)^(a-c) / (b-a)^(d-c)

function solveIntersection (a, b, c, d) {
  var ba = rvSub(b, a)
  var dc = rvSub(d, c)

  var baXdc = ratPerp(ba, dc)

  if (ratSign(baXdc) === 0) {
    return null
  }

  var ac = rvSub(a, c)
  var dcXac = ratPerp(dc, ac)

  var t = ratDiv(dcXac, baXdc)
  var s = rvMuls(ba, t)
  var r = rvAdd(a, s)

  return r
}

},{"big-rat/div":20,"big-rat/mul":30,"big-rat/sign":31,"big-rat/sub":32,"rat-vec/add":179,"rat-vec/muls":181,"rat-vec/sub":182}],54:[function(require,module,exports){
module.exports={
	"jet":[{"index":0,"rgb":[0,0,131]},{"index":0.125,"rgb":[0,60,170]},{"index":0.375,"rgb":[5,255,255]},{"index":0.625,"rgb":[255,255,0]},{"index":0.875,"rgb":[250,0,0]},{"index":1,"rgb":[128,0,0]}],

	"hsv":[{"index":0,"rgb":[255,0,0]},{"index":0.169,"rgb":[253,255,2]},{"index":0.173,"rgb":[247,255,2]},{"index":0.337,"rgb":[0,252,4]},{"index":0.341,"rgb":[0,252,10]},{"index":0.506,"rgb":[1,249,255]},{"index":0.671,"rgb":[2,0,253]},{"index":0.675,"rgb":[8,0,253]},{"index":0.839,"rgb":[255,0,251]},{"index":0.843,"rgb":[255,0,245]},{"index":1,"rgb":[255,0,6]}],

	"hot":[{"index":0,"rgb":[0,0,0]},{"index":0.3,"rgb":[230,0,0]},{"index":0.6,"rgb":[255,210,0]},{"index":1,"rgb":[255,255,255]}],

	"cool":[{"index":0,"rgb":[0,255,255]},{"index":1,"rgb":[255,0,255]}],

	"spring":[{"index":0,"rgb":[255,0,255]},{"index":1,"rgb":[255,255,0]}],

	"summer":[{"index":0,"rgb":[0,128,102]},{"index":1,"rgb":[255,255,102]}],

	"autumn":[{"index":0,"rgb":[255,0,0]},{"index":1,"rgb":[255,255,0]}],

	"winter":[{"index":0,"rgb":[0,0,255]},{"index":1,"rgb":[0,255,128]}],

	"bone":[{"index":0,"rgb":[0,0,0]},{"index":0.376,"rgb":[84,84,116]},{"index":0.753,"rgb":[169,200,200]},{"index":1,"rgb":[255,255,255]}],

	"copper":[{"index":0,"rgb":[0,0,0]},{"index":0.804,"rgb":[255,160,102]},{"index":1,"rgb":[255,199,127]}],

	"greys":[{"index":0,"rgb":[0,0,0]},{"index":1,"rgb":[255,255,255]}],

	"yignbu":[{"index":0,"rgb":[8,29,88]},{"index":0.125,"rgb":[37,52,148]},{"index":0.25,"rgb":[34,94,168]},{"index":0.375,"rgb":[29,145,192]},{"index":0.5,"rgb":[65,182,196]},{"index":0.625,"rgb":[127,205,187]},{"index":0.75,"rgb":[199,233,180]},{"index":0.875,"rgb":[237,248,217]},{"index":1,"rgb":[255,255,217]}],

	"greens":[{"index":0,"rgb":[0,68,27]},{"index":0.125,"rgb":[0,109,44]},{"index":0.25,"rgb":[35,139,69]},{"index":0.375,"rgb":[65,171,93]},{"index":0.5,"rgb":[116,196,118]},{"index":0.625,"rgb":[161,217,155]},{"index":0.75,"rgb":[199,233,192]},{"index":0.875,"rgb":[229,245,224]},{"index":1,"rgb":[247,252,245]}],

	"yiorrd":[{"index":0,"rgb":[128,0,38]},{"index":0.125,"rgb":[189,0,38]},{"index":0.25,"rgb":[227,26,28]},{"index":0.375,"rgb":[252,78,42]},{"index":0.5,"rgb":[253,141,60]},{"index":0.625,"rgb":[254,178,76]},{"index":0.75,"rgb":[254,217,118]},{"index":0.875,"rgb":[255,237,160]},{"index":1,"rgb":[255,255,204]}],

	"bluered":[{"index":0,"rgb":[0,0,255]},{"index":1,"rgb":[255,0,0]}],

	"rdbu":[{"index":0,"rgb":[5,10,172]},{"index":0.35,"rgb":[106,137,247]},{"index":0.5,"rgb":[190,190,190]},{"index":0.6,"rgb":[220,170,132]},{"index":0.7,"rgb":[230,145,90]},{"index":1,"rgb":[178,10,28]}],

	"picnic":[{"index":0,"rgb":[0,0,255]},{"index":0.1,"rgb":[51,153,255]},{"index":0.2,"rgb":[102,204,255]},{"index":0.3,"rgb":[153,204,255]},{"index":0.4,"rgb":[204,204,255]},{"index":0.5,"rgb":[255,255,255]},{"index":0.6,"rgb":[255,204,255]},{"index":0.7,"rgb":[255,153,255]},{"index":0.8,"rgb":[255,102,204]},{"index":0.9,"rgb":[255,102,102]},{"index":1,"rgb":[255,0,0]}],

	"rainbow":[{"index":0,"rgb":[150,0,90]},{"index":0.125,"rgb":[0,0,200]},{"index":0.25,"rgb":[0,25,255]},{"index":0.375,"rgb":[0,152,255]},{"index":0.5,"rgb":[44,255,150]},{"index":0.625,"rgb":[151,255,0]},{"index":0.75,"rgb":[255,234,0]},{"index":0.875,"rgb":[255,111,0]},{"index":1,"rgb":[255,0,0]}],

	"portland":[{"index":0,"rgb":[12,51,131]},{"index":0.25,"rgb":[10,136,186]},{"index":0.5,"rgb":[242,211,56]},{"index":0.75,"rgb":[242,143,56]},{"index":1,"rgb":[217,30,30]}],

	"blackbody":[{"index":0,"rgb":[0,0,0]},{"index":0.2,"rgb":[230,0,0]},{"index":0.4,"rgb":[230,210,0]},{"index":0.7,"rgb":[255,255,255]},{"index":1,"rgb":[160,200,255]}],

	"earth":[{"index":0,"rgb":[0,0,130]},{"index":0.1,"rgb":[0,180,180]},{"index":0.2,"rgb":[40,210,40]},{"index":0.4,"rgb":[230,230,50]},{"index":0.6,"rgb":[120,70,20]},{"index":1,"rgb":[255,255,255]}],

	"electric":[{"index":0,"rgb":[0,0,0]},{"index":0.15,"rgb":[30,0,100]},{"index":0.4,"rgb":[120,0,100]},{"index":0.6,"rgb":[160,90,0]},{"index":0.8,"rgb":[230,200,0]},{"index":1,"rgb":[255,250,220]}],

	"alpha": [{"index":0, "rgb": [255,255,255,0]},{"index":1, "rgb": [255,255,255,1]}],

	"viridis": [{"index":0,"rgb":[68,1,84]},{"index":0.13,"rgb":[71,44,122]},{"index":0.25,"rgb":[59,81,139]},{"index":0.38,"rgb":[44,113,142]},{"index":0.5,"rgb":[33,144,141]},{"index":0.63,"rgb":[39,173,129]},{"index":0.75,"rgb":[92,200,99]},{"index":0.88,"rgb":[170,220,50]},{"index":1,"rgb":[253,231,37]}],

	"inferno": [{"index":0,"rgb":[0,0,4]},{"index":0.13,"rgb":[31,12,72]},{"index":0.25,"rgb":[85,15,109]},{"index":0.38,"rgb":[136,34,106]},{"index":0.5,"rgb":[186,54,85]},{"index":0.63,"rgb":[227,89,51]},{"index":0.75,"rgb":[249,140,10]},{"index":0.88,"rgb":[249,201,50]},{"index":1,"rgb":[252,255,164]}],

	"magma": [{"index":0,"rgb":[0,0,4]},{"index":0.13,"rgb":[28,16,68]},{"index":0.25,"rgb":[79,18,123]},{"index":0.38,"rgb":[129,37,129]},{"index":0.5,"rgb":[181,54,122]},{"index":0.63,"rgb":[229,80,100]},{"index":0.75,"rgb":[251,135,97]},{"index":0.88,"rgb":[254,194,135]},{"index":1,"rgb":[252,253,191]}],

	"plasma": [{"index":0,"rgb":[13,8,135]},{"index":0.13,"rgb":[75,3,161]},{"index":0.25,"rgb":[125,3,168]},{"index":0.38,"rgb":[168,34,150]},{"index":0.5,"rgb":[203,70,121]},{"index":0.63,"rgb":[229,107,93]},{"index":0.75,"rgb":[248,148,65]},{"index":0.88,"rgb":[253,195,40]},{"index":1,"rgb":[240,249,33]}],

	"warm": [{"index":0,"rgb":[125,0,179]},{"index":0.13,"rgb":[172,0,187]},{"index":0.25,"rgb":[219,0,170]},{"index":0.38,"rgb":[255,0,130]},{"index":0.5,"rgb":[255,63,74]},{"index":0.63,"rgb":[255,123,0]},{"index":0.75,"rgb":[234,176,0]},{"index":0.88,"rgb":[190,228,0]},{"index":1,"rgb":[147,255,0]}],

	"cool": [{"index":0,"rgb":[125,0,179]},{"index":0.13,"rgb":[116,0,218]},{"index":0.25,"rgb":[98,74,237]},{"index":0.38,"rgb":[68,146,231]},{"index":0.5,"rgb":[0,204,197]},{"index":0.63,"rgb":[0,247,146]},{"index":0.75,"rgb":[0,255,88]},{"index":0.88,"rgb":[40,255,8]},{"index":1,"rgb":[147,255,0]}],

	"rainbow-soft": [{"index":0,"rgb":[125,0,179]},{"index":0.1,"rgb":[199,0,180]},{"index":0.2,"rgb":[255,0,121]},{"index":0.3,"rgb":[255,108,0]},{"index":0.4,"rgb":[222,194,0]},{"index":0.5,"rgb":[150,255,0]},{"index":0.6,"rgb":[0,255,55]},{"index":0.7,"rgb":[0,246,150]},{"index":0.8,"rgb":[50,167,222]},{"index":0.9,"rgb":[103,51,235]},{"index":1,"rgb":[124,0,186]}],

	"bathymetry": [{"index":0,"rgb":[40,26,44]},{"index":0.13,"rgb":[59,49,90]},{"index":0.25,"rgb":[64,76,139]},{"index":0.38,"rgb":[63,110,151]},{"index":0.5,"rgb":[72,142,158]},{"index":0.63,"rgb":[85,174,163]},{"index":0.75,"rgb":[120,206,163]},{"index":0.88,"rgb":[187,230,172]},{"index":1,"rgb":[253,254,204]}],

	"cdom": [{"index":0,"rgb":[47,15,62]},{"index":0.13,"rgb":[87,23,86]},{"index":0.25,"rgb":[130,28,99]},{"index":0.38,"rgb":[171,41,96]},{"index":0.5,"rgb":[206,67,86]},{"index":0.63,"rgb":[230,106,84]},{"index":0.75,"rgb":[242,149,103]},{"index":0.88,"rgb":[249,193,135]},{"index":1,"rgb":[254,237,176]}],

	"chlorophyll": [{"index":0,"rgb":[18,36,20]},{"index":0.13,"rgb":[25,63,41]},{"index":0.25,"rgb":[24,91,59]},{"index":0.38,"rgb":[13,119,72]},{"index":0.5,"rgb":[18,148,80]},{"index":0.63,"rgb":[80,173,89]},{"index":0.75,"rgb":[132,196,122]},{"index":0.88,"rgb":[175,221,162]},{"index":1,"rgb":[215,249,208]}],

	"density": [{"index":0,"rgb":[54,14,36]},{"index":0.13,"rgb":[89,23,80]},{"index":0.25,"rgb":[110,45,132]},{"index":0.38,"rgb":[120,77,178]},{"index":0.5,"rgb":[120,113,213]},{"index":0.63,"rgb":[115,151,228]},{"index":0.75,"rgb":[134,185,227]},{"index":0.88,"rgb":[177,214,227]},{"index":1,"rgb":[230,241,241]}],

	"freesurface-blue": [{"index":0,"rgb":[30,4,110]},{"index":0.13,"rgb":[47,14,176]},{"index":0.25,"rgb":[41,45,236]},{"index":0.38,"rgb":[25,99,212]},{"index":0.5,"rgb":[68,131,200]},{"index":0.63,"rgb":[114,156,197]},{"index":0.75,"rgb":[157,181,203]},{"index":0.88,"rgb":[200,208,216]},{"index":1,"rgb":[241,237,236]}],

	"freesurface-red": [{"index":0,"rgb":[60,9,18]},{"index":0.13,"rgb":[100,17,27]},{"index":0.25,"rgb":[142,20,29]},{"index":0.38,"rgb":[177,43,27]},{"index":0.5,"rgb":[192,87,63]},{"index":0.63,"rgb":[205,125,105]},{"index":0.75,"rgb":[216,162,148]},{"index":0.88,"rgb":[227,199,193]},{"index":1,"rgb":[241,237,236]}],

	"oxygen": [{"index":0,"rgb":[64,5,5]},{"index":0.13,"rgb":[106,6,15]},{"index":0.25,"rgb":[144,26,7]},{"index":0.38,"rgb":[168,64,3]},{"index":0.5,"rgb":[188,100,4]},{"index":0.63,"rgb":[206,136,11]},{"index":0.75,"rgb":[220,174,25]},{"index":0.88,"rgb":[231,215,44]},{"index":1,"rgb":[248,254,105]}],

	"par": [{"index":0,"rgb":[51,20,24]},{"index":0.13,"rgb":[90,32,35]},{"index":0.25,"rgb":[129,44,34]},{"index":0.38,"rgb":[159,68,25]},{"index":0.5,"rgb":[182,99,19]},{"index":0.63,"rgb":[199,134,22]},{"index":0.75,"rgb":[212,171,35]},{"index":0.88,"rgb":[221,210,54]},{"index":1,"rgb":[225,253,75]}],

	"phase": [{"index":0,"rgb":[145,105,18]},{"index":0.13,"rgb":[184,71,38]},{"index":0.25,"rgb":[186,58,115]},{"index":0.38,"rgb":[160,71,185]},{"index":0.5,"rgb":[110,97,218]},{"index":0.63,"rgb":[50,123,164]},{"index":0.75,"rgb":[31,131,110]},{"index":0.88,"rgb":[77,129,34]},{"index":1,"rgb":[145,105,18]}],

	"salinity": [{"index":0,"rgb":[42,24,108]},{"index":0.13,"rgb":[33,50,162]},{"index":0.25,"rgb":[15,90,145]},{"index":0.38,"rgb":[40,118,137]},{"index":0.5,"rgb":[59,146,135]},{"index":0.63,"rgb":[79,175,126]},{"index":0.75,"rgb":[120,203,104]},{"index":0.88,"rgb":[193,221,100]},{"index":1,"rgb":[253,239,154]}],

	"temperature": [{"index":0,"rgb":[4,35,51]},{"index":0.13,"rgb":[23,51,122]},{"index":0.25,"rgb":[85,59,157]},{"index":0.38,"rgb":[129,79,143]},{"index":0.5,"rgb":[175,95,130]},{"index":0.63,"rgb":[222,112,101]},{"index":0.75,"rgb":[249,146,66]},{"index":0.88,"rgb":[249,196,65]},{"index":1,"rgb":[232,250,91]}],

	"turbidity": [{"index":0,"rgb":[34,31,27]},{"index":0.13,"rgb":[65,50,41]},{"index":0.25,"rgb":[98,69,52]},{"index":0.38,"rgb":[131,89,57]},{"index":0.5,"rgb":[161,112,59]},{"index":0.63,"rgb":[185,140,66]},{"index":0.75,"rgb":[202,174,88]},{"index":0.88,"rgb":[216,209,126]},{"index":1,"rgb":[233,246,171]}],

	"velocity-blue": [{"index":0,"rgb":[17,32,64]},{"index":0.13,"rgb":[35,52,116]},{"index":0.25,"rgb":[29,81,156]},{"index":0.38,"rgb":[31,113,162]},{"index":0.5,"rgb":[50,144,169]},{"index":0.63,"rgb":[87,173,176]},{"index":0.75,"rgb":[149,196,189]},{"index":0.88,"rgb":[203,221,211]},{"index":1,"rgb":[254,251,230]}],

	"velocity-green": [{"index":0,"rgb":[23,35,19]},{"index":0.13,"rgb":[24,64,38]},{"index":0.25,"rgb":[11,95,45]},{"index":0.38,"rgb":[39,123,35]},{"index":0.5,"rgb":[95,146,12]},{"index":0.63,"rgb":[152,165,18]},{"index":0.75,"rgb":[201,186,69]},{"index":0.88,"rgb":[233,216,137]},{"index":1,"rgb":[255,253,205]}],

	"cubehelix": [{"index":0,"rgb":[0,0,0]},{"index":0.07,"rgb":[22,5,59]},{"index":0.13,"rgb":[60,4,105]},{"index":0.2,"rgb":[109,1,135]},{"index":0.27,"rgb":[161,0,147]},{"index":0.33,"rgb":[210,2,142]},{"index":0.4,"rgb":[251,11,123]},{"index":0.47,"rgb":[255,29,97]},{"index":0.53,"rgb":[255,54,69]},{"index":0.6,"rgb":[255,85,46]},{"index":0.67,"rgb":[255,120,34]},{"index":0.73,"rgb":[255,157,37]},{"index":0.8,"rgb":[241,191,57]},{"index":0.87,"rgb":[224,220,93]},{"index":0.93,"rgb":[218,241,142]},{"index":1,"rgb":[227,253,198]}]
};

},{}],55:[function(require,module,exports){
/*
 * Ben Postlethwaite
 * January 2013
 * License MIT
 */
'use strict';

var colorScale = require('./colorScale');
var lerp = require('lerp')

module.exports = createColormap;

function createColormap (spec) {
    /*
     * Default Options
     */
    var indicies, rgba, fromrgba, torgba,
        nsteps, cmap, colormap, format,
        nshades, colors, alpha, index, i,
        r = [],
        g = [],
        b = [],
        a = [];

    if ( !spec ) spec = {};

    nshades = (spec.nshades || 72) - 1;
    format = spec.format || 'hex';

    colormap = spec.colormap;
    if (!colormap) colormap = 'jet';

    if (typeof colormap === 'string') {
        colormap = colormap.toLowerCase();

        if (!colorScale[colormap]) {
            throw Error(colormap + ' not a supported colorscale');
        }

        cmap = colorScale[colormap];

    } else if (Array.isArray(colormap)) {
        cmap = colormap.slice();

    } else {
        throw Error('unsupported colormap option', colormap);
    }

    if (cmap.length > nshades) {
        throw new Error(
            colormap+' map requires nshades to be at least size '+cmap.length
        );
    }

    if (!Array.isArray(spec.alpha)) {

        if (typeof spec.alpha === 'number') {
            alpha = [spec.alpha, spec.alpha];

        } else {
            alpha = [1, 1];
        }

    } else if (spec.alpha.length !== 2) {
        alpha = [1, 1];

    } else {
        alpha = spec.alpha.slice();
    }

    // map index points from 0..1 to 0..n-1
    indicies = cmap.map(function(c) {
        return Math.round(c.index * nshades);
    });

    // Add alpha channel to the map
    alpha[0] = Math.min(Math.max(alpha[0], 0), 1);
    alpha[1] = Math.min(Math.max(alpha[1], 0), 1);

    var steps = cmap.map(function(c, i) {
        var index = cmap[i].index

        var rgba = cmap[i].rgb.slice();

        // if user supplies their own map use it
        if (rgba.length === 4 && rgba[3] >= 0 && rgba[3] <= 1) {
            return rgba
        }
        rgba[3] = alpha[0] + (alpha[1] - alpha[0])*index;

        return rgba
    })


    /*
     * map increasing linear values between indicies to
     * linear steps in colorvalues
     */
    var colors = []
    for (i = 0; i < indicies.length-1; ++i) {
        nsteps = indicies[i+1] - indicies[i];
        fromrgba = steps[i];
        torgba = steps[i+1];

        for (var j = 0; j < nsteps; j++) {
            var amt = j / nsteps
            colors.push([
                Math.round(lerp(fromrgba[0], torgba[0], amt)),
                Math.round(lerp(fromrgba[1], torgba[1], amt)),
                Math.round(lerp(fromrgba[2], torgba[2], amt)),
                lerp(fromrgba[3], torgba[3], amt)
            ])
        }
    }

    //add 1 step as last value
    colors.push(cmap[cmap.length - 1].rgb.concat(alpha[1]))

    if (format === 'hex') colors = colors.map( rgb2hex );
    else if (format === 'rgbaString') colors = colors.map( rgbaStr );
    else if (format === 'float') colors = colors.map( rgb2float );

    return colors;
};

function rgb2float (rgba) {
    return [
        rgba[0] / 255,
        rgba[1] / 255,
        rgba[2] / 255,
        rgba[3]
    ]
}

function rgb2hex (rgba) {
    var dig, hex = '#';
    for (var i = 0; i < 3; ++i) {
        dig = rgba[i];
        dig = dig.toString(16);
        hex += ('00' + dig).substr( dig.length );
    }
    return hex;
}

function rgbaStr (rgba) {
    return 'rgba(' + rgba.join(',') + ')';
}

},{"./colorScale":54,"lerp":148}],56:[function(require,module,exports){
"use strict"

module.exports = compareAngle

var orient = require("robust-orientation")
var sgn = require("signum")
var twoSum = require("two-sum")
var robustProduct = require("robust-product")
var robustSum = require("robust-sum")

function testInterior(a, b, c) {
  var x0 = twoSum(a[0], -b[0])
  var y0 = twoSum(a[1], -b[1])
  var x1 = twoSum(c[0], -b[0])
  var y1 = twoSum(c[1], -b[1])

  var d = robustSum(
    robustProduct(x0, x1),
    robustProduct(y0, y1))

  return d[d.length-1] >= 0
}

function compareAngle(a, b, c, d) {
  var bcd = orient(b, c, d)
  if(bcd === 0) {
    //Handle degenerate cases
    var sabc = sgn(orient(a, b, c))
    var sabd = sgn(orient(a, b, d))
    if(sabc === sabd) {
      if(sabc === 0) {
        var ic = testInterior(a, b, c)
        var id = testInterior(a, b, d)
        if(ic === id) {
          return 0
        } else if(ic) {
          return 1
        } else {
          return -1
        }
      }
      return 0
    } else if(sabd === 0) {
      if(sabc > 0) {
        return -1
      } else if(testInterior(a, b, d)) {
        return -1
      } else {
        return 1
      }
    } else if(sabc === 0) {
      if(sabd > 0) {
        return 1
      } else if(testInterior(a, b, c)) {
        return 1
      } else {
        return -1
      }
    }
    return sgn(sabd - sabc)
  }
  var abc = orient(a, b, c)
  if(abc > 0) {
    if(bcd > 0 && orient(a, b, d) > 0) {
      return 1
    }
    return -1
  } else if(abc < 0) {
    if(bcd > 0 || orient(a, b, d) > 0) {
      return 1
    }
    return -1
  } else {
    var abd = orient(a, b, d)
    if(abd > 0) {
      return 1
    } else {
      if(testInterior(a, b, c)) {
        return 1
      } else {
        return -1
      }
    }
  }
}
},{"robust-orientation":190,"robust-product":191,"robust-sum":195,"signum":57,"two-sum":211}],57:[function(require,module,exports){
"use strict"

module.exports = function signum(x) {
  if(x < 0) { return -1 }
  if(x > 0) { return 1 }
  return 0.0
}
},{}],58:[function(require,module,exports){
"use strict"

var convexHull1d = require('./lib/ch1d')
var convexHull2d = require('./lib/ch2d')
var convexHullnd = require('./lib/chnd')

module.exports = convexHull

function convexHull(points) {
  var n = points.length
  if(n === 0) {
    return []
  } else if(n === 1) {
    return [[0]]
  }
  var d = points[0].length
  if(d === 0) {
    return []
  } else if(d === 1) {
    return convexHull1d(points)
  } else if(d === 2) {
    return convexHull2d(points)
  }
  return convexHullnd(points, d)
}
},{"./lib/ch1d":59,"./lib/ch2d":60,"./lib/chnd":61}],59:[function(require,module,exports){
"use strict"

module.exports = convexHull1d

function convexHull1d(points) {
  var lo = 0
  var hi = 0
  for(var i=1; i<points.length; ++i) {
    if(points[i][0] < points[lo][0]) {
      lo = i
    }
    if(points[i][0] > points[hi][0]) {
      hi = i
    }
  }
  if(lo < hi) {
    return [[lo], [hi]]
  } else if(lo > hi) {
    return [[hi], [lo]]
  } else {
    return [[lo]]
  }
}
},{}],60:[function(require,module,exports){
'use strict'

module.exports = convexHull2D

var monotoneHull = require('monotone-convex-hull-2d')

function convexHull2D(points) {
  var hull = monotoneHull(points)
  var h = hull.length
  if(h <= 2) {
    return []
  }
  var edges = new Array(h)
  var a = hull[h-1]
  for(var i=0; i<h; ++i) {
    var b = hull[i]
    edges[i] = [a,b]
    a = b
  }
  return edges
}

},{"monotone-convex-hull-2d":155}],61:[function(require,module,exports){
'use strict'

module.exports = convexHullnD

var ich = require('incremental-convex-hull')
var aff = require('affine-hull')

function permute(points, front) {
  var n = points.length
  var npoints = new Array(n)
  for(var i=0; i<front.length; ++i) {
    npoints[i] = points[front[i]]
  }
  var ptr = front.length
  for(var i=0; i<n; ++i) {
    if(front.indexOf(i) < 0) {
      npoints[ptr++] = points[i]
    }
  }
  return npoints
}

function invPermute(cells, front) {
  var nc = cells.length
  var nf = front.length
  for(var i=0; i<nc; ++i) {
    var c = cells[i]
    for(var j=0; j<c.length; ++j) {
      var x = c[j]
      if(x < nf) {
        c[j] = front[x]
      } else {
        x = x - nf
        for(var k=0; k<nf; ++k) {
          if(x >= front[k]) {
            x += 1
          }
        }
        c[j] = x
      }
    }
  }
  return cells
}

function convexHullnD(points, d) {
  try {
    return ich(points, true)
  } catch(e) {
    //If point set is degenerate, try to find a basis and rerun it
    var ah = aff(points)
    if(ah.length <= d) {
      //No basis, no try
      return []
    }
    var npoints = permute(points, ah)
    var nhull   = ich(npoints, true)
    return invPermute(nhull, ah)
  }
}
},{"affine-hull":15,"incremental-convex-hull":142}],62:[function(require,module,exports){
"use strict"

function dcubicHermite(p0, v0, p1, v1, t, f) {
  var dh00 = 6*t*t-6*t,
      dh10 = 3*t*t-4*t + 1,
      dh01 = -6*t*t+6*t,
      dh11 = 3*t*t-2*t
  if(p0.length) {
    if(!f) {
      f = new Array(p0.length)
    }
    for(var i=p0.length-1; i>=0; --i) {
      f[i] = dh00*p0[i] + dh10*v0[i] + dh01*p1[i] + dh11*v1[i]
    }
    return f
  }
  return dh00*p0 + dh10*v0 + dh01*p1[i] + dh11*v1
}

function cubicHermite(p0, v0, p1, v1, t, f) {
  var ti  = (t-1), t2 = t*t, ti2 = ti*ti,
      h00 = (1+2*t)*ti2,
      h10 = t*ti2,
      h01 = t2*(3-2*t),
      h11 = t2*ti
  if(p0.length) {
    if(!f) {
      f = new Array(p0.length)
    }
    for(var i=p0.length-1; i>=0; --i) {
      f[i] = h00*p0[i] + h10*v0[i] + h01*p1[i] + h11*v1[i]
    }
    return f
  }
  return h00*p0 + h10*v0 + h01*p1 + h11*v1
}

module.exports = cubicHermite
module.exports.derivative = dcubicHermite
},{}],63:[function(require,module,exports){
"use strict"

var createThunk = require("./lib/thunk.js")

function Procedure() {
  this.argTypes = []
  this.shimArgs = []
  this.arrayArgs = []
  this.arrayBlockIndices = []
  this.scalarArgs = []
  this.offsetArgs = []
  this.offsetArgIndex = []
  this.indexArgs = []
  this.shapeArgs = []
  this.funcName = ""
  this.pre = null
  this.body = null
  this.post = null
  this.debug = false
}

function compileCwise(user_args) {
  //Create procedure
  var proc = new Procedure()
  
  //Parse blocks
  proc.pre    = user_args.pre
  proc.body   = user_args.body
  proc.post   = user_args.post

  //Parse arguments
  var proc_args = user_args.args.slice(0)
  proc.argTypes = proc_args
  for(var i=0; i<proc_args.length; ++i) {
    var arg_type = proc_args[i]
    if(arg_type === "array" || (typeof arg_type === "object" && arg_type.blockIndices)) {
      proc.argTypes[i] = "array"
      proc.arrayArgs.push(i)
      proc.arrayBlockIndices.push(arg_type.blockIndices ? arg_type.blockIndices : 0)
      proc.shimArgs.push("array" + i)
      if(i < proc.pre.args.length && proc.pre.args[i].count>0) {
        throw new Error("cwise: pre() block may not reference array args")
      }
      if(i < proc.post.args.length && proc.post.args[i].count>0) {
        throw new Error("cwise: post() block may not reference array args")
      }
    } else if(arg_type === "scalar") {
      proc.scalarArgs.push(i)
      proc.shimArgs.push("scalar" + i)
    } else if(arg_type === "index") {
      proc.indexArgs.push(i)
      if(i < proc.pre.args.length && proc.pre.args[i].count > 0) {
        throw new Error("cwise: pre() block may not reference array index")
      }
      if(i < proc.body.args.length && proc.body.args[i].lvalue) {
        throw new Error("cwise: body() block may not write to array index")
      }
      if(i < proc.post.args.length && proc.post.args[i].count > 0) {
        throw new Error("cwise: post() block may not reference array index")
      }
    } else if(arg_type === "shape") {
      proc.shapeArgs.push(i)
      if(i < proc.pre.args.length && proc.pre.args[i].lvalue) {
        throw new Error("cwise: pre() block may not write to array shape")
      }
      if(i < proc.body.args.length && proc.body.args[i].lvalue) {
        throw new Error("cwise: body() block may not write to array shape")
      }
      if(i < proc.post.args.length && proc.post.args[i].lvalue) {
        throw new Error("cwise: post() block may not write to array shape")
      }
    } else if(typeof arg_type === "object" && arg_type.offset) {
      proc.argTypes[i] = "offset"
      proc.offsetArgs.push({ array: arg_type.array, offset:arg_type.offset })
      proc.offsetArgIndex.push(i)
    } else {
      throw new Error("cwise: Unknown argument type " + proc_args[i])
    }
  }
  
  //Make sure at least one array argument was specified
  if(proc.arrayArgs.length <= 0) {
    throw new Error("cwise: No array arguments specified")
  }
  
  //Make sure arguments are correct
  if(proc.pre.args.length > proc_args.length) {
    throw new Error("cwise: Too many arguments in pre() block")
  }
  if(proc.body.args.length > proc_args.length) {
    throw new Error("cwise: Too many arguments in body() block")
  }
  if(proc.post.args.length > proc_args.length) {
    throw new Error("cwise: Too many arguments in post() block")
  }

  //Check debug flag
  proc.debug = !!user_args.printCode || !!user_args.debug
  
  //Retrieve name
  proc.funcName = user_args.funcName || "cwise"
  
  //Read in block size
  proc.blockSize = user_args.blockSize || 64

  return createThunk(proc)
}

module.exports = compileCwise

},{"./lib/thunk.js":65}],64:[function(require,module,exports){
"use strict"

var uniq = require("uniq")

// This function generates very simple loops analogous to how you typically traverse arrays (the outermost loop corresponds to the slowest changing index, the innermost loop to the fastest changing index)
// TODO: If two arrays have the same strides (and offsets) there is potential for decreasing the number of "pointers" and related variables. The drawback is that the type signature would become more specific and that there would thus be less potential for caching, but it might still be worth it, especially when dealing with large numbers of arguments.
function innerFill(order, proc, body) {
  var dimension = order.length
    , nargs = proc.arrayArgs.length
    , has_index = proc.indexArgs.length>0
    , code = []
    , vars = []
    , idx=0, pidx=0, i, j
  for(i=0; i<dimension; ++i) { // Iteration variables
    vars.push(["i",i,"=0"].join(""))
  }
  //Compute scan deltas
  for(j=0; j<nargs; ++j) {
    for(i=0; i<dimension; ++i) {
      pidx = idx
      idx = order[i]
      if(i === 0) { // The innermost/fastest dimension's delta is simply its stride
        vars.push(["d",j,"s",i,"=t",j,"p",idx].join(""))
      } else { // For other dimensions the delta is basically the stride minus something which essentially "rewinds" the previous (more inner) dimension
        vars.push(["d",j,"s",i,"=(t",j,"p",idx,"-s",pidx,"*t",j,"p",pidx,")"].join(""))
      }
    }
  }
  if (vars.length > 0) {
    code.push("var " + vars.join(","))
  }  
  //Scan loop
  for(i=dimension-1; i>=0; --i) { // Start at largest stride and work your way inwards
    idx = order[i]
    code.push(["for(i",i,"=0;i",i,"<s",idx,";++i",i,"){"].join(""))
  }
  //Push body of inner loop
  code.push(body)
  //Advance scan pointers
  for(i=0; i<dimension; ++i) {
    pidx = idx
    idx = order[i]
    for(j=0; j<nargs; ++j) {
      code.push(["p",j,"+=d",j,"s",i].join(""))
    }
    if(has_index) {
      if(i > 0) {
        code.push(["index[",pidx,"]-=s",pidx].join(""))
      }
      code.push(["++index[",idx,"]"].join(""))
    }
    code.push("}")
  }
  return code.join("\n")
}

// Generate "outer" loops that loop over blocks of data, applying "inner" loops to the blocks by manipulating the local variables in such a way that the inner loop only "sees" the current block.
// TODO: If this is used, then the previous declaration (done by generateCwiseOp) of s* is essentially unnecessary.
//       I believe the s* are not used elsewhere (in particular, I don't think they're used in the pre/post parts and "shape" is defined independently), so it would be possible to make defining the s* dependent on what loop method is being used.
function outerFill(matched, order, proc, body) {
  var dimension = order.length
    , nargs = proc.arrayArgs.length
    , blockSize = proc.blockSize
    , has_index = proc.indexArgs.length > 0
    , code = []
  for(var i=0; i<nargs; ++i) {
    code.push(["var offset",i,"=p",i].join(""))
  }
  //Generate loops for unmatched dimensions
  // The order in which these dimensions are traversed is fairly arbitrary (from small stride to large stride, for the first argument)
  // TODO: It would be nice if the order in which these loops are placed would also be somehow "optimal" (at the very least we should check that it really doesn't hurt us if they're not).
  for(var i=matched; i<dimension; ++i) {
    code.push(["for(var j"+i+"=SS[", order[i], "]|0;j", i, ">0;){"].join("")) // Iterate back to front
    code.push(["if(j",i,"<",blockSize,"){"].join("")) // Either decrease j by blockSize (s = blockSize), or set it to zero (after setting s = j).
    code.push(["s",order[i],"=j",i].join(""))
    code.push(["j",i,"=0"].join(""))
    code.push(["}else{s",order[i],"=",blockSize].join(""))
    code.push(["j",i,"-=",blockSize,"}"].join(""))
    if(has_index) {
      code.push(["index[",order[i],"]=j",i].join(""))
    }
  }
  for(var i=0; i<nargs; ++i) {
    var indexStr = ["offset"+i]
    for(var j=matched; j<dimension; ++j) {
      indexStr.push(["j",j,"*t",i,"p",order[j]].join(""))
    }
    code.push(["p",i,"=(",indexStr.join("+"),")"].join(""))
  }
  code.push(innerFill(order, proc, body))
  for(var i=matched; i<dimension; ++i) {
    code.push("}")
  }
  return code.join("\n")
}

//Count the number of compatible inner orders
// This is the length of the longest common prefix of the arrays in orders.
// Each array in orders lists the dimensions of the correspond ndarray in order of increasing stride.
// This is thus the maximum number of dimensions that can be efficiently traversed by simple nested loops for all arrays.
function countMatches(orders) {
  var matched = 0, dimension = orders[0].length
  while(matched < dimension) {
    for(var j=1; j<orders.length; ++j) {
      if(orders[j][matched] !== orders[0][matched]) {
        return matched
      }
    }
    ++matched
  }
  return matched
}

//Processes a block according to the given data types
// Replaces variable names by different ones, either "local" ones (that are then ferried in and out of the given array) or ones matching the arguments that the function performing the ultimate loop will accept.
function processBlock(block, proc, dtypes) {
  var code = block.body
  var pre = []
  var post = []
  for(var i=0; i<block.args.length; ++i) {
    var carg = block.args[i]
    if(carg.count <= 0) {
      continue
    }
    var re = new RegExp(carg.name, "g")
    var ptrStr = ""
    var arrNum = proc.arrayArgs.indexOf(i)
    switch(proc.argTypes[i]) {
      case "offset":
        var offArgIndex = proc.offsetArgIndex.indexOf(i)
        var offArg = proc.offsetArgs[offArgIndex]
        arrNum = offArg.array
        ptrStr = "+q" + offArgIndex // Adds offset to the "pointer" in the array
      case "array":
        ptrStr = "p" + arrNum + ptrStr
        var localStr = "l" + i
        var arrStr = "a" + arrNum
        if (proc.arrayBlockIndices[arrNum] === 0) { // Argument to body is just a single value from this array
          if(carg.count === 1) { // Argument/array used only once(?)
            if(dtypes[arrNum] === "generic") {
              if(carg.lvalue) {
                pre.push(["var ", localStr, "=", arrStr, ".get(", ptrStr, ")"].join("")) // Is this necessary if the argument is ONLY used as an lvalue? (keep in mind that we can have a += something, so we would actually need to check carg.rvalue)
                code = code.replace(re, localStr)
                post.push([arrStr, ".set(", ptrStr, ",", localStr,")"].join(""))
              } else {
                code = code.replace(re, [arrStr, ".get(", ptrStr, ")"].join(""))
              }
            } else {
              code = code.replace(re, [arrStr, "[", ptrStr, "]"].join(""))
            }
          } else if(dtypes[arrNum] === "generic") {
            pre.push(["var ", localStr, "=", arrStr, ".get(", ptrStr, ")"].join("")) // TODO: Could we optimize by checking for carg.rvalue?
            code = code.replace(re, localStr)
            if(carg.lvalue) {
              post.push([arrStr, ".set(", ptrStr, ",", localStr,")"].join(""))
            }
          } else {
            pre.push(["var ", localStr, "=", arrStr, "[", ptrStr, "]"].join("")) // TODO: Could we optimize by checking for carg.rvalue?
            code = code.replace(re, localStr)
            if(carg.lvalue) {
              post.push([arrStr, "[", ptrStr, "]=", localStr].join(""))
            }
          }
        } else { // Argument to body is a "block"
          var reStrArr = [carg.name], ptrStrArr = [ptrStr]
          for(var j=0; j<Math.abs(proc.arrayBlockIndices[arrNum]); j++) {
            reStrArr.push("\\s*\\[([^\\]]+)\\]")
            ptrStrArr.push("$" + (j+1) + "*t" + arrNum + "b" + j) // Matched index times stride
          }
          re = new RegExp(reStrArr.join(""), "g")
          ptrStr = ptrStrArr.join("+")
          if(dtypes[arrNum] === "generic") {
            /*if(carg.lvalue) {
              pre.push(["var ", localStr, "=", arrStr, ".get(", ptrStr, ")"].join("")) // Is this necessary if the argument is ONLY used as an lvalue? (keep in mind that we can have a += something, so we would actually need to check carg.rvalue)
              code = code.replace(re, localStr)
              post.push([arrStr, ".set(", ptrStr, ",", localStr,")"].join(""))
            } else {
              code = code.replace(re, [arrStr, ".get(", ptrStr, ")"].join(""))
            }*/
            throw new Error("cwise: Generic arrays not supported in combination with blocks!")
          } else {
            // This does not produce any local variables, even if variables are used multiple times. It would be possible to do so, but it would complicate things quite a bit.
            code = code.replace(re, [arrStr, "[", ptrStr, "]"].join(""))
          }
        }
      break
      case "scalar":
        code = code.replace(re, "Y" + proc.scalarArgs.indexOf(i))
      break
      case "index":
        code = code.replace(re, "index")
      break
      case "shape":
        code = code.replace(re, "shape")
      break
    }
  }
  return [pre.join("\n"), code, post.join("\n")].join("\n").trim()
}

function typeSummary(dtypes) {
  var summary = new Array(dtypes.length)
  var allEqual = true
  for(var i=0; i<dtypes.length; ++i) {
    var t = dtypes[i]
    var digits = t.match(/\d+/)
    if(!digits) {
      digits = ""
    } else {
      digits = digits[0]
    }
    if(t.charAt(0) === 0) {
      summary[i] = "u" + t.charAt(1) + digits
    } else {
      summary[i] = t.charAt(0) + digits
    }
    if(i > 0) {
      allEqual = allEqual && summary[i] === summary[i-1]
    }
  }
  if(allEqual) {
    return summary[0]
  }
  return summary.join("")
}

//Generates a cwise operator
function generateCWiseOp(proc, typesig) {

  //Compute dimension
  // Arrays get put first in typesig, and there are two entries per array (dtype and order), so this gets the number of dimensions in the first array arg.
  var dimension = (typesig[1].length - Math.abs(proc.arrayBlockIndices[0]))|0
  var orders = new Array(proc.arrayArgs.length)
  var dtypes = new Array(proc.arrayArgs.length)
  for(var i=0; i<proc.arrayArgs.length; ++i) {
    dtypes[i] = typesig[2*i]
    orders[i] = typesig[2*i+1]
  }
  
  //Determine where block and loop indices start and end
  var blockBegin = [], blockEnd = [] // These indices are exposed as blocks
  var loopBegin = [], loopEnd = [] // These indices are iterated over
  var loopOrders = [] // orders restricted to the loop indices
  for(var i=0; i<proc.arrayArgs.length; ++i) {
    if (proc.arrayBlockIndices[i]<0) {
      loopBegin.push(0)
      loopEnd.push(dimension)
      blockBegin.push(dimension)
      blockEnd.push(dimension+proc.arrayBlockIndices[i])
    } else {
      loopBegin.push(proc.arrayBlockIndices[i]) // Non-negative
      loopEnd.push(proc.arrayBlockIndices[i]+dimension)
      blockBegin.push(0)
      blockEnd.push(proc.arrayBlockIndices[i])
    }
    var newOrder = []
    for(var j=0; j<orders[i].length; j++) {
      if (loopBegin[i]<=orders[i][j] && orders[i][j]<loopEnd[i]) {
        newOrder.push(orders[i][j]-loopBegin[i]) // If this is a loop index, put it in newOrder, subtracting loopBegin, to make sure that all loopOrders are using a common set of indices.
      }
    }
    loopOrders.push(newOrder)
  }

  //First create arguments for procedure
  var arglist = ["SS"] // SS is the overall shape over which we iterate
  var code = ["'use strict'"]
  var vars = []
  
  for(var j=0; j<dimension; ++j) {
    vars.push(["s", j, "=SS[", j, "]"].join("")) // The limits for each dimension.
  }
  for(var i=0; i<proc.arrayArgs.length; ++i) {
    arglist.push("a"+i) // Actual data array
    arglist.push("t"+i) // Strides
    arglist.push("p"+i) // Offset in the array at which the data starts (also used for iterating over the data)
    
    for(var j=0; j<dimension; ++j) { // Unpack the strides into vars for looping
      vars.push(["t",i,"p",j,"=t",i,"[",loopBegin[i]+j,"]"].join(""))
    }
    
    for(var j=0; j<Math.abs(proc.arrayBlockIndices[i]); ++j) { // Unpack the strides into vars for block iteration
      vars.push(["t",i,"b",j,"=t",i,"[",blockBegin[i]+j,"]"].join(""))
    }
  }
  for(var i=0; i<proc.scalarArgs.length; ++i) {
    arglist.push("Y" + i)
  }
  if(proc.shapeArgs.length > 0) {
    vars.push("shape=SS.slice(0)") // Makes the shape over which we iterate available to the user defined functions (so you can use width/height for example)
  }
  if(proc.indexArgs.length > 0) {
    // Prepare an array to keep track of the (logical) indices, initialized to dimension zeroes.
    var zeros = new Array(dimension)
    for(var i=0; i<dimension; ++i) {
      zeros[i] = "0"
    }
    vars.push(["index=[", zeros.join(","), "]"].join(""))
  }
  for(var i=0; i<proc.offsetArgs.length; ++i) { // Offset arguments used for stencil operations
    var off_arg = proc.offsetArgs[i]
    var init_string = []
    for(var j=0; j<off_arg.offset.length; ++j) {
      if(off_arg.offset[j] === 0) {
        continue
      } else if(off_arg.offset[j] === 1) {
        init_string.push(["t", off_arg.array, "p", j].join(""))      
      } else {
        init_string.push([off_arg.offset[j], "*t", off_arg.array, "p", j].join(""))
      }
    }
    if(init_string.length === 0) {
      vars.push("q" + i + "=0")
    } else {
      vars.push(["q", i, "=", init_string.join("+")].join(""))
    }
  }

  //Prepare this variables
  var thisVars = uniq([].concat(proc.pre.thisVars)
                      .concat(proc.body.thisVars)
                      .concat(proc.post.thisVars))
  vars = vars.concat(thisVars)
  if (vars.length > 0) {
    code.push("var " + vars.join(","))
  }
  for(var i=0; i<proc.arrayArgs.length; ++i) {
    code.push("p"+i+"|=0")
  }
  
  //Inline prelude
  if(proc.pre.body.length > 3) {
    code.push(processBlock(proc.pre, proc, dtypes))
  }

  //Process body
  var body = processBlock(proc.body, proc, dtypes)
  var matched = countMatches(loopOrders)
  if(matched < dimension) {
    code.push(outerFill(matched, loopOrders[0], proc, body)) // TODO: Rather than passing loopOrders[0], it might be interesting to look at passing an order that represents the majority of the arguments for example.
  } else {
    code.push(innerFill(loopOrders[0], proc, body))
  }

  //Inline epilog
  if(proc.post.body.length > 3) {
    code.push(processBlock(proc.post, proc, dtypes))
  }
  
  if(proc.debug) {
    console.log("-----Generated cwise routine for ", typesig, ":\n" + code.join("\n") + "\n----------")
  }
  
  var loopName = [(proc.funcName||"unnamed"), "_cwise_loop_", orders[0].join("s"),"m",matched,typeSummary(dtypes)].join("")
  var f = new Function(["function ",loopName,"(", arglist.join(","),"){", code.join("\n"),"} return ", loopName].join(""))
  return f()
}
module.exports = generateCWiseOp

},{"uniq":214}],65:[function(require,module,exports){
"use strict"

// The function below is called when constructing a cwise function object, and does the following:
// A function object is constructed which accepts as argument a compilation function and returns another function.
// It is this other function that is eventually returned by createThunk, and this function is the one that actually
// checks whether a certain pattern of arguments has already been used before and compiles new loops as needed.
// The compilation passed to the first function object is used for compiling new functions.
// Once this function object is created, it is called with compile as argument, where the first argument of compile
// is bound to "proc" (essentially containing a preprocessed version of the user arguments to cwise).
// So createThunk roughly works like this:
// function createThunk(proc) {
//   var thunk = function(compileBound) {
//     var CACHED = {}
//     return function(arrays and scalars) {
//       if (dtype and order of arrays in CACHED) {
//         var func = CACHED[dtype and order of arrays]
//       } else {
//         var func = CACHED[dtype and order of arrays] = compileBound(dtype and order of arrays)
//       }
//       return func(arrays and scalars)
//     }
//   }
//   return thunk(compile.bind1(proc))
// }

var compile = require("./compile.js")

function createThunk(proc) {
  var code = ["'use strict'", "var CACHED={}"]
  var vars = []
  var thunkName = proc.funcName + "_cwise_thunk"
  
  //Build thunk
  code.push(["return function ", thunkName, "(", proc.shimArgs.join(","), "){"].join(""))
  var typesig = []
  var string_typesig = []
  var proc_args = [["array",proc.arrayArgs[0],".shape.slice(", // Slice shape so that we only retain the shape over which we iterate (which gets passed to the cwise operator as SS).
                    Math.max(0,proc.arrayBlockIndices[0]),proc.arrayBlockIndices[0]<0?(","+proc.arrayBlockIndices[0]+")"):")"].join("")]
  var shapeLengthConditions = [], shapeConditions = []
  // Process array arguments
  for(var i=0; i<proc.arrayArgs.length; ++i) {
    var j = proc.arrayArgs[i]
    vars.push(["t", j, "=array", j, ".dtype,",
               "r", j, "=array", j, ".order"].join(""))
    typesig.push("t" + j)
    typesig.push("r" + j)
    string_typesig.push("t"+j)
    string_typesig.push("r"+j+".join()")
    proc_args.push("array" + j + ".data")
    proc_args.push("array" + j + ".stride")
    proc_args.push("array" + j + ".offset|0")
    if (i>0) { // Gather conditions to check for shape equality (ignoring block indices)
      shapeLengthConditions.push("array" + proc.arrayArgs[0] + ".shape.length===array" + j + ".shape.length+" + (Math.abs(proc.arrayBlockIndices[0])-Math.abs(proc.arrayBlockIndices[i])))
      shapeConditions.push("array" + proc.arrayArgs[0] + ".shape[shapeIndex+" + Math.max(0,proc.arrayBlockIndices[0]) + "]===array" + j + ".shape[shapeIndex+" + Math.max(0,proc.arrayBlockIndices[i]) + "]")
    }
  }
  // Check for shape equality
  if (proc.arrayArgs.length > 1) {
    code.push("if (!(" + shapeLengthConditions.join(" && ") + ")) throw new Error('cwise: Arrays do not all have the same dimensionality!')")
    code.push("for(var shapeIndex=array" + proc.arrayArgs[0] + ".shape.length-" + Math.abs(proc.arrayBlockIndices[0]) + "; shapeIndex-->0;) {")
    code.push("if (!(" + shapeConditions.join(" && ") + ")) throw new Error('cwise: Arrays do not all have the same shape!')")
    code.push("}")
  }
  // Process scalar arguments
  for(var i=0; i<proc.scalarArgs.length; ++i) {
    proc_args.push("scalar" + proc.scalarArgs[i])
  }
  // Check for cached function (and if not present, generate it)
  vars.push(["type=[", string_typesig.join(","), "].join()"].join(""))
  vars.push("proc=CACHED[type]")
  code.push("var " + vars.join(","))
  
  code.push(["if(!proc){",
             "CACHED[type]=proc=compile([", typesig.join(","), "])}",
             "return proc(", proc_args.join(","), ")}"].join(""))

  if(proc.debug) {
    console.log("-----Generated thunk:\n" + code.join("\n") + "\n----------")
  }
  
  //Compile thunk
  var thunk = new Function("compile", code.join("\n"))
  return thunk(compile.bind(undefined, proc))
}

module.exports = createThunk

},{"./compile.js":64}],66:[function(require,module,exports){
module.exports = require("cwise-compiler")
},{"cwise-compiler":63}],67:[function(require,module,exports){
(function (Buffer){
var hasTypedArrays = false
if(typeof Float64Array !== "undefined") {
  var DOUBLE_VIEW = new Float64Array(1)
    , UINT_VIEW   = new Uint32Array(DOUBLE_VIEW.buffer)
  DOUBLE_VIEW[0] = 1.0
  hasTypedArrays = true
  if(UINT_VIEW[1] === 0x3ff00000) {
    //Use little endian
    module.exports = function doubleBitsLE(n) {
      DOUBLE_VIEW[0] = n
      return [ UINT_VIEW[0], UINT_VIEW[1] ]
    }
    function toDoubleLE(lo, hi) {
      UINT_VIEW[0] = lo
      UINT_VIEW[1] = hi
      return DOUBLE_VIEW[0]
    }
    module.exports.pack = toDoubleLE
    function lowUintLE(n) {
      DOUBLE_VIEW[0] = n
      return UINT_VIEW[0]
    }
    module.exports.lo = lowUintLE
    function highUintLE(n) {
      DOUBLE_VIEW[0] = n
      return UINT_VIEW[1]
    }
    module.exports.hi = highUintLE
  } else if(UINT_VIEW[0] === 0x3ff00000) {
    //Use big endian
    module.exports = function doubleBitsBE(n) {
      DOUBLE_VIEW[0] = n
      return [ UINT_VIEW[1], UINT_VIEW[0] ]
    }
    function toDoubleBE(lo, hi) {
      UINT_VIEW[1] = lo
      UINT_VIEW[0] = hi
      return DOUBLE_VIEW[0]
    }
    module.exports.pack = toDoubleBE
    function lowUintBE(n) {
      DOUBLE_VIEW[0] = n
      return UINT_VIEW[1]
    }
    module.exports.lo = lowUintBE
    function highUintBE(n) {
      DOUBLE_VIEW[0] = n
      return UINT_VIEW[0]
    }
    module.exports.hi = highUintBE
  } else {
    hasTypedArrays = false
  }
}
if(!hasTypedArrays) {
  var buffer = new Buffer(8)
  module.exports = function doubleBits(n) {
    buffer.writeDoubleLE(n, 0, true)
    return [ buffer.readUInt32LE(0, true), buffer.readUInt32LE(4, true) ]
  }
  function toDouble(lo, hi) {
    buffer.writeUInt32LE(lo, 0, true)
    buffer.writeUInt32LE(hi, 4, true)
    return buffer.readDoubleLE(0, true)
  }
  module.exports.pack = toDouble  
  function lowUint(n) {
    buffer.writeDoubleLE(n, 0, true)
    return buffer.readUInt32LE(0, true)
  }
  module.exports.lo = lowUint
  function highUint(n) {
    buffer.writeDoubleLE(n, 0, true)
    return buffer.readUInt32LE(4, true)
  }
  module.exports.hi = highUint
}

module.exports.sign = function(n) {
  return module.exports.hi(n) >>> 31
}

module.exports.exponent = function(n) {
  var b = module.exports.hi(n)
  return ((b<<1) >>> 21) - 1023
}

module.exports.fraction = function(n) {
  var lo = module.exports.lo(n)
  var hi = module.exports.hi(n)
  var b = hi & ((1<<20) - 1)
  if(hi & 0x7ff00000) {
    b += (1<<20)
  }
  return [lo, b]
}

module.exports.denormalized = function(n) {
  var hi = module.exports.hi(n)
  return !(hi & 0x7ff00000)
}
}).call(this,require("buffer").Buffer)
},{"buffer":3}],68:[function(require,module,exports){
"use strict"

function dupe_array(count, value, i) {
  var c = count[i]|0
  if(c <= 0) {
    return []
  }
  var result = new Array(c), j
  if(i === count.length-1) {
    for(j=0; j<c; ++j) {
      result[j] = value
    }
  } else {
    for(j=0; j<c; ++j) {
      result[j] = dupe_array(count, value, i+1)
    }
  }
  return result
}

function dupe_number(count, value) {
  var result, i
  result = new Array(count)
  for(i=0; i<count; ++i) {
    result[i] = value
  }
  return result
}

function dupe(count, value) {
  if(typeof value === "undefined") {
    value = 0
  }
  switch(typeof count) {
    case "number":
      if(count > 0) {
        return dupe_number(count|0, value)
      }
    break
    case "object":
      if(typeof (count.length) === "number") {
        return dupe_array(count, value, 0)
      }
    break
  }
  return []
}

module.exports = dupe
},{}],69:[function(require,module,exports){
"use strict"

module.exports = edgeToAdjacency

var uniq = require("uniq")

function edgeToAdjacency(edges, numVertices) {
  var numEdges = edges.length
  if(typeof numVertices !== "number") {
    numVertices = 0
    for(var i=0; i<numEdges; ++i) {
      var e = edges[i]
      numVertices = Math.max(numVertices, e[0], e[1])
    }
    numVertices = (numVertices|0) + 1
  }
  numVertices = numVertices|0
  var adj = new Array(numVertices)
  for(var i=0; i<numVertices; ++i) {
    adj[i] = []
  }
  for(var i=0; i<numEdges; ++i) {
    var e = edges[i]
    adj[e[0]].push(e[1])
    adj[e[1]].push(e[0])
  }
  for(var j=0; j<numVertices; ++j) {
    uniq(adj[j], function(a, b) {
      return a - b
    })
  }
  return adj
}
},{"uniq":214}],70:[function(require,module,exports){
module.exports = getSize

function getSize(element) {
  // Handle cases where the element is not already
  // attached to the DOM by briefly appending it
  // to document.body, and removing it again later.
  if (element === window || element === document.body) {
    return [window.innerWidth, window.innerHeight]
  }

  if (!element.parentNode) {
    var temporary = true
    document.body.appendChild(element)
  }

  var bounds = element.getBoundingClientRect()
  var styles = getComputedStyle(element)
  var height = (bounds.height|0)
    + parse(styles.getPropertyValue('margin-top'))
    + parse(styles.getPropertyValue('margin-bottom'))
  var width  = (bounds.width|0)
    + parse(styles.getPropertyValue('margin-left'))
    + parse(styles.getPropertyValue('margin-right'))

  if (temporary) {
    document.body.removeChild(element)
  }

  return [width, height]
}

function parse(prop) {
  return parseFloat(prop) || 0
}

},{}],71:[function(require,module,exports){
'use strict'

module.exports = createFilteredVector

var cubicHermite = require('cubic-hermite')
var bsearch = require('binary-search-bounds')

function clamp(lo, hi, x) {
  return Math.min(hi, Math.max(lo, x))
}

function FilteredVector(state0, velocity0, t0) {
  this.dimension  = state0.length
  this.bounds     = [ new Array(this.dimension), new Array(this.dimension) ]
  for(var i=0; i<this.dimension; ++i) {
    this.bounds[0][i] = -Infinity
    this.bounds[1][i] = Infinity
  }
  this._state     = state0.slice().reverse()
  this._velocity  = velocity0.slice().reverse()
  this._time      = [ t0 ]
  this._scratch   = [ state0.slice(), state0.slice(), state0.slice(), state0.slice(), state0.slice() ]
}

var proto = FilteredVector.prototype

proto.flush = function(t) {
  var idx = bsearch.gt(this._time, t) - 1
  if(idx <= 0) {
    return
  }
  this._time.splice(0, idx)
  this._state.splice(0, idx * this.dimension)
  this._velocity.splice(0, idx * this.dimension)
}

proto.curve = function(t) {
  var time      = this._time
  var n         = time.length
  var idx       = bsearch.le(time, t)
  var result    = this._scratch[0]
  var state     = this._state
  var velocity  = this._velocity
  var d         = this.dimension
  var bounds    = this.bounds
  if(idx < 0) {
    var ptr = d-1
    for(var i=0; i<d; ++i, --ptr) {
      result[i] = state[ptr]
    }
  } else if(idx >= n-1) {
    var ptr = state.length-1
    var tf = t - time[n-1]
    for(var i=0; i<d; ++i, --ptr) {
      result[i] = state[ptr] + tf * velocity[ptr]
    }
  } else {
    var ptr = d * (idx+1) - 1
    var t0  = time[idx]
    var t1  = time[idx+1]
    var dt  = (t1 - t0) || 1.0
    var x0  = this._scratch[1]
    var x1  = this._scratch[2]
    var v0  = this._scratch[3]
    var v1  = this._scratch[4]
    var steady = true
    for(var i=0; i<d; ++i, --ptr) {
      x0[i] = state[ptr]
      v0[i] = velocity[ptr] * dt
      x1[i] = state[ptr+d]
      v1[i] = velocity[ptr+d] * dt
      steady = steady && (x0[i] === x1[i] && v0[i] === v1[i] && v0[i] === 0.0)
    }
    if(steady) {
      for(var i=0; i<d; ++i) {
        result[i] = x0[i]
      }
    } else {
      cubicHermite(x0, v0, x1, v1, (t-t0)/dt, result)
    }
  }
  var lo = bounds[0]
  var hi = bounds[1]
  for(var i=0; i<d; ++i) {
    result[i] = clamp(lo[i], hi[i], result[i])
  }
  return result
}

proto.dcurve = function(t) {
  var time     = this._time
  var n        = time.length
  var idx      = bsearch.le(time, t)
  var result   = this._scratch[0]
  var state    = this._state
  var velocity = this._velocity
  var d        = this.dimension
  if(idx >= n-1) {
    var ptr = state.length-1
    var tf = t - time[n-1]
    for(var i=0; i<d; ++i, --ptr) {
      result[i] = velocity[ptr]
    }
  } else {
    var ptr = d * (idx+1) - 1
    var t0 = time[idx]
    var t1 = time[idx+1]
    var dt = (t1 - t0) || 1.0
    var x0 = this._scratch[1]
    var x1 = this._scratch[2]
    var v0 = this._scratch[3]
    var v1 = this._scratch[4]
    var steady = true
    for(var i=0; i<d; ++i, --ptr) {
      x0[i] = state[ptr]
      v0[i] = velocity[ptr] * dt
      x1[i] = state[ptr+d]
      v1[i] = velocity[ptr+d] * dt
      steady = steady && (x0[i] === x1[i] && v0[i] === v1[i] && v0[i] === 0.0)
    }
    if(steady) {
      for(var i=0; i<d; ++i) {
        result[i] = 0.0
      }
    } else {
      cubicHermite.derivative(x0, v0, x1, v1, (t-t0)/dt, result)
      for(var i=0; i<d; ++i) {
        result[i] /= dt
      }
    }
  }
  return result
}

proto.lastT = function() {
  var time = this._time
  return time[time.length-1]
}

proto.stable = function() {
  var velocity = this._velocity
  var ptr = velocity.length
  for(var i=this.dimension-1; i>=0; --i) {
    if(velocity[--ptr]) {
      return false
    }
  }
  return true
}

proto.jump = function(t) {
  var t0 = this.lastT()
  var d  = this.dimension
  if(t < t0 || arguments.length !== d+1) {
    return
  }
  var state     = this._state
  var velocity  = this._velocity
  var ptr       = state.length-this.dimension
  var bounds    = this.bounds
  var lo        = bounds[0]
  var hi        = bounds[1]
  this._time.push(t0, t)
  for(var j=0; j<2; ++j) {
    for(var i=0; i<d; ++i) {
      state.push(state[ptr++])
      velocity.push(0)
    }
  }
  this._time.push(t)
  for(var i=d; i>0; --i) {
    state.push(clamp(lo[i-1], hi[i-1], arguments[i]))
    velocity.push(0)
  }
}

proto.push = function(t) {
  var t0 = this.lastT()
  var d  = this.dimension
  if(t < t0 || arguments.length !== d+1) {
    return
  }
  var state     = this._state
  var velocity  = this._velocity
  var ptr       = state.length-this.dimension
  var dt        = t - t0
  var bounds    = this.bounds
  var lo        = bounds[0]
  var hi        = bounds[1]
  var sf        = (dt > 1e-6) ? 1/dt : 0
  this._time.push(t)
  for(var i=d; i>0; --i) {
    var xc = clamp(lo[i-1], hi[i-1], arguments[i])
    state.push(xc)
    velocity.push((xc - state[ptr++]) * sf)
  }
}

proto.set = function(t) {
  var d = this.dimension
  if(t < this.lastT() || arguments.length !== d+1) {
    return
  }
  var state     = this._state
  var velocity  = this._velocity
  var bounds    = this.bounds
  var lo        = bounds[0]
  var hi        = bounds[1]
  this._time.push(t)
  for(var i=d; i>0; --i) {
    state.push(clamp(lo[i-1], hi[i-1], arguments[i]))
    velocity.push(0)
  }
}

proto.move = function(t) {
  var t0 = this.lastT()
  var d  = this.dimension
  if(t <= t0 || arguments.length !== d+1) {
    return
  }
  var state    = this._state
  var velocity = this._velocity
  var statePtr = state.length - this.dimension
  var bounds   = this.bounds
  var lo       = bounds[0]
  var hi       = bounds[1]
  var dt       = t - t0
  var sf       = (dt > 1e-6) ? 1/dt : 0.0
  this._time.push(t)
  for(var i=d; i>0; --i) {
    var dx = arguments[i]
    state.push(clamp(lo[i-1], hi[i-1], state[statePtr++] + dx))
    velocity.push(dx * sf)
  }
}

proto.idle = function(t) {
  var t0 = this.lastT()
  if(t < t0) {
    return
  }
  var d        = this.dimension
  var state    = this._state
  var velocity = this._velocity
  var statePtr = state.length-d
  var bounds   = this.bounds
  var lo       = bounds[0]
  var hi       = bounds[1]
  var dt       = t - t0
  this._time.push(t)
  for(var i=d-1; i>=0; --i) {
    state.push(clamp(lo[i], hi[i], state[statePtr] + dt * velocity[statePtr]))
    velocity.push(0)
    statePtr += 1
  }
}

function getZero(d) {
  var result = new Array(d)
  for(var i=0; i<d; ++i) {
    result[i] = 0.0
  }
  return result
}

function createFilteredVector(initState, initVelocity, initTime) {
  switch(arguments.length) {
    case 0:
      return new FilteredVector([0], [0], 0)
    case 1:
      if(typeof initState === 'number') {
        var zero = getZero(initState)
        return new FilteredVector(zero, zero, 0)
      } else {
        return new FilteredVector(initState, getZero(initState.length), 0)
      }
    case 2:
      if(typeof initVelocity === 'number') {
        var zero = getZero(initState.length)
        return new FilteredVector(initState, zero, +initVelocity)
      } else {
        initTime = 0
      }
    case 3:
      if(initState.length !== initVelocity.length) {
        throw new Error('state and velocity lengths must match')
      }
      return new FilteredVector(initState, initVelocity, initTime)
  }
}

},{"binary-search-bounds":34,"cubic-hermite":62}],72:[function(require,module,exports){
"use strict"

module.exports = createRBTree

var RED   = 0
var BLACK = 1

function RBNode(color, key, value, left, right, count) {
  this._color = color
  this.key = key
  this.value = value
  this.left = left
  this.right = right
  this._count = count
}

function cloneNode(node) {
  return new RBNode(node._color, node.key, node.value, node.left, node.right, node._count)
}

function repaint(color, node) {
  return new RBNode(color, node.key, node.value, node.left, node.right, node._count)
}

function recount(node) {
  node._count = 1 + (node.left ? node.left._count : 0) + (node.right ? node.right._count : 0)
}

function RedBlackTree(compare, root) {
  this._compare = compare
  this.root = root
}

var proto = RedBlackTree.prototype

Object.defineProperty(proto, "keys", {
  get: function() {
    var result = []
    this.forEach(function(k,v) {
      result.push(k)
    })
    return result
  }
})

Object.defineProperty(proto, "values", {
  get: function() {
    var result = []
    this.forEach(function(k,v) {
      result.push(v)
    })
    return result
  }
})

//Returns the number of nodes in the tree
Object.defineProperty(proto, "length", {
  get: function() {
    if(this.root) {
      return this.root._count
    }
    return 0
  }
})

//Insert a new item into the tree
proto.insert = function(key, value) {
  var cmp = this._compare
  //Find point to insert new node at
  var n = this.root
  var n_stack = []
  var d_stack = []
  while(n) {
    var d = cmp(key, n.key)
    n_stack.push(n)
    d_stack.push(d)
    if(d <= 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  //Rebuild path to leaf node
  n_stack.push(new RBNode(RED, key, value, null, null, 1))
  for(var s=n_stack.length-2; s>=0; --s) {
    var n = n_stack[s]
    if(d_stack[s] <= 0) {
      n_stack[s] = new RBNode(n._color, n.key, n.value, n_stack[s+1], n.right, n._count+1)
    } else {
      n_stack[s] = new RBNode(n._color, n.key, n.value, n.left, n_stack[s+1], n._count+1)
    }
  }
  //Rebalance tree using rotations
  //console.log("start insert", key, d_stack)
  for(var s=n_stack.length-1; s>1; --s) {
    var p = n_stack[s-1]
    var n = n_stack[s]
    if(p._color === BLACK || n._color === BLACK) {
      break
    }
    var pp = n_stack[s-2]
    if(pp.left === p) {
      if(p.left === n) {
        var y = pp.right
        if(y && y._color === RED) {
          //console.log("LLr")
          p._color = BLACK
          pp.right = repaint(BLACK, y)
          pp._color = RED
          s -= 1
        } else {
          //console.log("LLb")
          pp._color = RED
          pp.left = p.right
          p._color = BLACK
          p.right = pp
          n_stack[s-2] = p
          n_stack[s-1] = n
          recount(pp)
          recount(p)
          if(s >= 3) {
            var ppp = n_stack[s-3]
            if(ppp.left === pp) {
              ppp.left = p
            } else {
              ppp.right = p
            }
          }
          break
        }
      } else {
        var y = pp.right
        if(y && y._color === RED) {
          //console.log("LRr")
          p._color = BLACK
          pp.right = repaint(BLACK, y)
          pp._color = RED
          s -= 1
        } else {
          //console.log("LRb")
          p.right = n.left
          pp._color = RED
          pp.left = n.right
          n._color = BLACK
          n.left = p
          n.right = pp
          n_stack[s-2] = n
          n_stack[s-1] = p
          recount(pp)
          recount(p)
          recount(n)
          if(s >= 3) {
            var ppp = n_stack[s-3]
            if(ppp.left === pp) {
              ppp.left = n
            } else {
              ppp.right = n
            }
          }
          break
        }
      }
    } else {
      if(p.right === n) {
        var y = pp.left
        if(y && y._color === RED) {
          //console.log("RRr", y.key)
          p._color = BLACK
          pp.left = repaint(BLACK, y)
          pp._color = RED
          s -= 1
        } else {
          //console.log("RRb")
          pp._color = RED
          pp.right = p.left
          p._color = BLACK
          p.left = pp
          n_stack[s-2] = p
          n_stack[s-1] = n
          recount(pp)
          recount(p)
          if(s >= 3) {
            var ppp = n_stack[s-3]
            if(ppp.right === pp) {
              ppp.right = p
            } else {
              ppp.left = p
            }
          }
          break
        }
      } else {
        var y = pp.left
        if(y && y._color === RED) {
          //console.log("RLr")
          p._color = BLACK
          pp.left = repaint(BLACK, y)
          pp._color = RED
          s -= 1
        } else {
          //console.log("RLb")
          p.left = n.right
          pp._color = RED
          pp.right = n.left
          n._color = BLACK
          n.right = p
          n.left = pp
          n_stack[s-2] = n
          n_stack[s-1] = p
          recount(pp)
          recount(p)
          recount(n)
          if(s >= 3) {
            var ppp = n_stack[s-3]
            if(ppp.right === pp) {
              ppp.right = n
            } else {
              ppp.left = n
            }
          }
          break
        }
      }
    }
  }
  //Return new tree
  n_stack[0]._color = BLACK
  return new RedBlackTree(cmp, n_stack[0])
}


//Visit all nodes inorder
function doVisitFull(visit, node) {
  if(node.left) {
    var v = doVisitFull(visit, node.left)
    if(v) { return v }
  }
  var v = visit(node.key, node.value)
  if(v) { return v }
  if(node.right) {
    return doVisitFull(visit, node.right)
  }
}

//Visit half nodes in order
function doVisitHalf(lo, compare, visit, node) {
  var l = compare(lo, node.key)
  if(l <= 0) {
    if(node.left) {
      var v = doVisitHalf(lo, compare, visit, node.left)
      if(v) { return v }
    }
    var v = visit(node.key, node.value)
    if(v) { return v }
  }
  if(node.right) {
    return doVisitHalf(lo, compare, visit, node.right)
  }
}

//Visit all nodes within a range
function doVisit(lo, hi, compare, visit, node) {
  var l = compare(lo, node.key)
  var h = compare(hi, node.key)
  var v
  if(l <= 0) {
    if(node.left) {
      v = doVisit(lo, hi, compare, visit, node.left)
      if(v) { return v }
    }
    if(h > 0) {
      v = visit(node.key, node.value)
      if(v) { return v }
    }
  }
  if(h > 0 && node.right) {
    return doVisit(lo, hi, compare, visit, node.right)
  }
}


proto.forEach = function rbTreeForEach(visit, lo, hi) {
  if(!this.root) {
    return
  }
  switch(arguments.length) {
    case 1:
      return doVisitFull(visit, this.root)
    break

    case 2:
      return doVisitHalf(lo, this._compare, visit, this.root)
    break

    case 3:
      if(this._compare(lo, hi) >= 0) {
        return
      }
      return doVisit(lo, hi, this._compare, visit, this.root)
    break
  }
}

//First item in list
Object.defineProperty(proto, "begin", {
  get: function() {
    var stack = []
    var n = this.root
    while(n) {
      stack.push(n)
      n = n.left
    }
    return new RedBlackTreeIterator(this, stack)
  }
})

//Last item in list
Object.defineProperty(proto, "end", {
  get: function() {
    var stack = []
    var n = this.root
    while(n) {
      stack.push(n)
      n = n.right
    }
    return new RedBlackTreeIterator(this, stack)
  }
})

//Find the ith item in the tree
proto.at = function(idx) {
  if(idx < 0) {
    return new RedBlackTreeIterator(this, [])
  }
  var n = this.root
  var stack = []
  while(true) {
    stack.push(n)
    if(n.left) {
      if(idx < n.left._count) {
        n = n.left
        continue
      }
      idx -= n.left._count
    }
    if(!idx) {
      return new RedBlackTreeIterator(this, stack)
    }
    idx -= 1
    if(n.right) {
      if(idx >= n.right._count) {
        break
      }
      n = n.right
    } else {
      break
    }
  }
  return new RedBlackTreeIterator(this, [])
}

proto.ge = function(key) {
  var cmp = this._compare
  var n = this.root
  var stack = []
  var last_ptr = 0
  while(n) {
    var d = cmp(key, n.key)
    stack.push(n)
    if(d <= 0) {
      last_ptr = stack.length
    }
    if(d <= 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  stack.length = last_ptr
  return new RedBlackTreeIterator(this, stack)
}

proto.gt = function(key) {
  var cmp = this._compare
  var n = this.root
  var stack = []
  var last_ptr = 0
  while(n) {
    var d = cmp(key, n.key)
    stack.push(n)
    if(d < 0) {
      last_ptr = stack.length
    }
    if(d < 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  stack.length = last_ptr
  return new RedBlackTreeIterator(this, stack)
}

proto.lt = function(key) {
  var cmp = this._compare
  var n = this.root
  var stack = []
  var last_ptr = 0
  while(n) {
    var d = cmp(key, n.key)
    stack.push(n)
    if(d > 0) {
      last_ptr = stack.length
    }
    if(d <= 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  stack.length = last_ptr
  return new RedBlackTreeIterator(this, stack)
}

proto.le = function(key) {
  var cmp = this._compare
  var n = this.root
  var stack = []
  var last_ptr = 0
  while(n) {
    var d = cmp(key, n.key)
    stack.push(n)
    if(d >= 0) {
      last_ptr = stack.length
    }
    if(d < 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  stack.length = last_ptr
  return new RedBlackTreeIterator(this, stack)
}

//Finds the item with key if it exists
proto.find = function(key) {
  var cmp = this._compare
  var n = this.root
  var stack = []
  while(n) {
    var d = cmp(key, n.key)
    stack.push(n)
    if(d === 0) {
      return new RedBlackTreeIterator(this, stack)
    }
    if(d <= 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  return new RedBlackTreeIterator(this, [])
}

//Removes item with key from tree
proto.remove = function(key) {
  var iter = this.find(key)
  if(iter) {
    return iter.remove()
  }
  return this
}

//Returns the item at `key`
proto.get = function(key) {
  var cmp = this._compare
  var n = this.root
  while(n) {
    var d = cmp(key, n.key)
    if(d === 0) {
      return n.value
    }
    if(d <= 0) {
      n = n.left
    } else {
      n = n.right
    }
  }
  return
}

//Iterator for red black tree
function RedBlackTreeIterator(tree, stack) {
  this.tree = tree
  this._stack = stack
}

var iproto = RedBlackTreeIterator.prototype

//Test if iterator is valid
Object.defineProperty(iproto, "valid", {
  get: function() {
    return this._stack.length > 0
  }
})

//Node of the iterator
Object.defineProperty(iproto, "node", {
  get: function() {
    if(this._stack.length > 0) {
      return this._stack[this._stack.length-1]
    }
    return null
  },
  enumerable: true
})

//Makes a copy of an iterator
iproto.clone = function() {
  return new RedBlackTreeIterator(this.tree, this._stack.slice())
}

//Swaps two nodes
function swapNode(n, v) {
  n.key = v.key
  n.value = v.value
  n.left = v.left
  n.right = v.right
  n._color = v._color
  n._count = v._count
}

//Fix up a double black node in a tree
function fixDoubleBlack(stack) {
  var n, p, s, z
  for(var i=stack.length-1; i>=0; --i) {
    n = stack[i]
    if(i === 0) {
      n._color = BLACK
      return
    }
    //console.log("visit node:", n.key, i, stack[i].key, stack[i-1].key)
    p = stack[i-1]
    if(p.left === n) {
      //console.log("left child")
      s = p.right
      if(s.right && s.right._color === RED) {
        //console.log("case 1: right sibling child red")
        s = p.right = cloneNode(s)
        z = s.right = cloneNode(s.right)
        p.right = s.left
        s.left = p
        s.right = z
        s._color = p._color
        n._color = BLACK
        p._color = BLACK
        z._color = BLACK
        recount(p)
        recount(s)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.left === p) {
            pp.left = s
          } else {
            pp.right = s
          }
        }
        stack[i-1] = s
        return
      } else if(s.left && s.left._color === RED) {
        //console.log("case 1: left sibling child red")
        s = p.right = cloneNode(s)
        z = s.left = cloneNode(s.left)
        p.right = z.left
        s.left = z.right
        z.left = p
        z.right = s
        z._color = p._color
        p._color = BLACK
        s._color = BLACK
        n._color = BLACK
        recount(p)
        recount(s)
        recount(z)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.left === p) {
            pp.left = z
          } else {
            pp.right = z
          }
        }
        stack[i-1] = z
        return
      }
      if(s._color === BLACK) {
        if(p._color === RED) {
          //console.log("case 2: black sibling, red parent", p.right.value)
          p._color = BLACK
          p.right = repaint(RED, s)
          return
        } else {
          //console.log("case 2: black sibling, black parent", p.right.value)
          p.right = repaint(RED, s)
          continue  
        }
      } else {
        //console.log("case 3: red sibling")
        s = cloneNode(s)
        p.right = s.left
        s.left = p
        s._color = p._color
        p._color = RED
        recount(p)
        recount(s)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.left === p) {
            pp.left = s
          } else {
            pp.right = s
          }
        }
        stack[i-1] = s
        stack[i] = p
        if(i+1 < stack.length) {
          stack[i+1] = n
        } else {
          stack.push(n)
        }
        i = i+2
      }
    } else {
      //console.log("right child")
      s = p.left
      if(s.left && s.left._color === RED) {
        //console.log("case 1: left sibling child red", p.value, p._color)
        s = p.left = cloneNode(s)
        z = s.left = cloneNode(s.left)
        p.left = s.right
        s.right = p
        s.left = z
        s._color = p._color
        n._color = BLACK
        p._color = BLACK
        z._color = BLACK
        recount(p)
        recount(s)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.right === p) {
            pp.right = s
          } else {
            pp.left = s
          }
        }
        stack[i-1] = s
        return
      } else if(s.right && s.right._color === RED) {
        //console.log("case 1: right sibling child red")
        s = p.left = cloneNode(s)
        z = s.right = cloneNode(s.right)
        p.left = z.right
        s.right = z.left
        z.right = p
        z.left = s
        z._color = p._color
        p._color = BLACK
        s._color = BLACK
        n._color = BLACK
        recount(p)
        recount(s)
        recount(z)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.right === p) {
            pp.right = z
          } else {
            pp.left = z
          }
        }
        stack[i-1] = z
        return
      }
      if(s._color === BLACK) {
        if(p._color === RED) {
          //console.log("case 2: black sibling, red parent")
          p._color = BLACK
          p.left = repaint(RED, s)
          return
        } else {
          //console.log("case 2: black sibling, black parent")
          p.left = repaint(RED, s)
          continue  
        }
      } else {
        //console.log("case 3: red sibling")
        s = cloneNode(s)
        p.left = s.right
        s.right = p
        s._color = p._color
        p._color = RED
        recount(p)
        recount(s)
        if(i > 1) {
          var pp = stack[i-2]
          if(pp.right === p) {
            pp.right = s
          } else {
            pp.left = s
          }
        }
        stack[i-1] = s
        stack[i] = p
        if(i+1 < stack.length) {
          stack[i+1] = n
        } else {
          stack.push(n)
        }
        i = i+2
      }
    }
  }
}

//Removes item at iterator from tree
iproto.remove = function() {
  var stack = this._stack
  if(stack.length === 0) {
    return this.tree
  }
  //First copy path to node
  var cstack = new Array(stack.length)
  var n = stack[stack.length-1]
  cstack[cstack.length-1] = new RBNode(n._color, n.key, n.value, n.left, n.right, n._count)
  for(var i=stack.length-2; i>=0; --i) {
    var n = stack[i]
    if(n.left === stack[i+1]) {
      cstack[i] = new RBNode(n._color, n.key, n.value, cstack[i+1], n.right, n._count)
    } else {
      cstack[i] = new RBNode(n._color, n.key, n.value, n.left, cstack[i+1], n._count)
    }
  }

  //Get node
  n = cstack[cstack.length-1]
  //console.log("start remove: ", n.value)

  //If not leaf, then swap with previous node
  if(n.left && n.right) {
    //console.log("moving to leaf")

    //First walk to previous leaf
    var split = cstack.length
    n = n.left
    while(n.right) {
      cstack.push(n)
      n = n.right
    }
    //Copy path to leaf
    var v = cstack[split-1]
    cstack.push(new RBNode(n._color, v.key, v.value, n.left, n.right, n._count))
    cstack[split-1].key = n.key
    cstack[split-1].value = n.value

    //Fix up stack
    for(var i=cstack.length-2; i>=split; --i) {
      n = cstack[i]
      cstack[i] = new RBNode(n._color, n.key, n.value, n.left, cstack[i+1], n._count)
    }
    cstack[split-1].left = cstack[split]
  }
  //console.log("stack=", cstack.map(function(v) { return v.value }))

  //Remove leaf node
  n = cstack[cstack.length-1]
  if(n._color === RED) {
    //Easy case: removing red leaf
    //console.log("RED leaf")
    var p = cstack[cstack.length-2]
    if(p.left === n) {
      p.left = null
    } else if(p.right === n) {
      p.right = null
    }
    cstack.pop()
    for(var i=0; i<cstack.length; ++i) {
      cstack[i]._count--
    }
    return new RedBlackTree(this.tree._compare, cstack[0])
  } else {
    if(n.left || n.right) {
      //Second easy case:  Single child black parent
      //console.log("BLACK single child")
      if(n.left) {
        swapNode(n, n.left)
      } else if(n.right) {
        swapNode(n, n.right)
      }
      //Child must be red, so repaint it black to balance color
      n._color = BLACK
      for(var i=0; i<cstack.length-1; ++i) {
        cstack[i]._count--
      }
      return new RedBlackTree(this.tree._compare, cstack[0])
    } else if(cstack.length === 1) {
      //Third easy case: root
      //console.log("ROOT")
      return new RedBlackTree(this.tree._compare, null)
    } else {
      //Hard case: Repaint n, and then do some nasty stuff
      //console.log("BLACK leaf no children")
      for(var i=0; i<cstack.length; ++i) {
        cstack[i]._count--
      }
      var parent = cstack[cstack.length-2]
      fixDoubleBlack(cstack)
      //Fix up links
      if(parent.left === n) {
        parent.left = null
      } else {
        parent.right = null
      }
    }
  }
  return new RedBlackTree(this.tree._compare, cstack[0])
}

//Returns key
Object.defineProperty(iproto, "key", {
  get: function() {
    if(this._stack.length > 0) {
      return this._stack[this._stack.length-1].key
    }
    return
  },
  enumerable: true
})

//Returns value
Object.defineProperty(iproto, "value", {
  get: function() {
    if(this._stack.length > 0) {
      return this._stack[this._stack.length-1].value
    }
    return
  },
  enumerable: true
})


//Returns the position of this iterator in the sorted list
Object.defineProperty(iproto, "index", {
  get: function() {
    var idx = 0
    var stack = this._stack
    if(stack.length === 0) {
      var r = this.tree.root
      if(r) {
        return r._count
      }
      return 0
    } else if(stack[stack.length-1].left) {
      idx = stack[stack.length-1].left._count
    }
    for(var s=stack.length-2; s>=0; --s) {
      if(stack[s+1] === stack[s].right) {
        ++idx
        if(stack[s].left) {
          idx += stack[s].left._count
        }
      }
    }
    return idx
  },
  enumerable: true
})

//Advances iterator to next element in list
iproto.next = function() {
  var stack = this._stack
  if(stack.length === 0) {
    return
  }
  var n = stack[stack.length-1]
  if(n.right) {
    n = n.right
    while(n) {
      stack.push(n)
      n = n.left
    }
  } else {
    stack.pop()
    while(stack.length > 0 && stack[stack.length-1].right === n) {
      n = stack[stack.length-1]
      stack.pop()
    }
  }
}

//Checks if iterator is at end of tree
Object.defineProperty(iproto, "hasNext", {
  get: function() {
    var stack = this._stack
    if(stack.length === 0) {
      return false
    }
    if(stack[stack.length-1].right) {
      return true
    }
    for(var s=stack.length-1; s>0; --s) {
      if(stack[s-1].left === stack[s]) {
        return true
      }
    }
    return false
  }
})

//Update value
iproto.update = function(value) {
  var stack = this._stack
  if(stack.length === 0) {
    throw new Error("Can't update empty node!")
  }
  var cstack = new Array(stack.length)
  var n = stack[stack.length-1]
  cstack[cstack.length-1] = new RBNode(n._color, n.key, value, n.left, n.right, n._count)
  for(var i=stack.length-2; i>=0; --i) {
    n = stack[i]
    if(n.left === stack[i+1]) {
      cstack[i] = new RBNode(n._color, n.key, n.value, cstack[i+1], n.right, n._count)
    } else {
      cstack[i] = new RBNode(n._color, n.key, n.value, n.left, cstack[i+1], n._count)
    }
  }
  return new RedBlackTree(this.tree._compare, cstack[0])
}

//Moves iterator backward one element
iproto.prev = function() {
  var stack = this._stack
  if(stack.length === 0) {
    return
  }
  var n = stack[stack.length-1]
  if(n.left) {
    n = n.left
    while(n) {
      stack.push(n)
      n = n.right
    }
  } else {
    stack.pop()
    while(stack.length > 0 && stack[stack.length-1].left === n) {
      n = stack[stack.length-1]
      stack.pop()
    }
  }
}

//Checks if iterator is at start of tree
Object.defineProperty(iproto, "hasPrev", {
  get: function() {
    var stack = this._stack
    if(stack.length === 0) {
      return false
    }
    if(stack[stack.length-1].left) {
      return true
    }
    for(var s=stack.length-1; s>0; --s) {
      if(stack[s-1].right === stack[s]) {
        return true
      }
    }
    return false
  }
})

//Default comparison function
function defaultCompare(a, b) {
  if(a < b) {
    return -1
  }
  if(a > b) {
    return 1
  }
  return 0
}

//Build a tree
function createRBTree(compare) {
  return new RedBlackTree(compare || defaultCompare, null)
}
},{}],73:[function(require,module,exports){
// transliterated from the python snippet here:
// http://en.wikipedia.org/wiki/Lanczos_approximation

var g = 7;
var p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
];

var g_ln = 607/128;
var p_ln = [
    0.99999999999999709182,
    57.156235665862923517,
    -59.597960355475491248,
    14.136097974741747174,
    -0.49191381609762019978,
    0.33994649984811888699e-4,
    0.46523628927048575665e-4,
    -0.98374475304879564677e-4,
    0.15808870322491248884e-3,
    -0.21026444172410488319e-3,
    0.21743961811521264320e-3,
    -0.16431810653676389022e-3,
    0.84418223983852743293e-4,
    -0.26190838401581408670e-4,
    0.36899182659531622704e-5
];

// Spouge approximation (suitable for large arguments)
function lngamma(z) {

    if(z < 0) return Number('0/0');
    var x = p_ln[0];
    for(var i = p_ln.length - 1; i > 0; --i) x += p_ln[i] / (z + i);
    var t = z + g_ln + 0.5;
    return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x)-Math.log(z);
}

module.exports = function gamma (z) {
    if (z < 0.5) {
        return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    }
    else if(z > 100) return Math.exp(lngamma(z));
    else {
        z -= 1;
        var x = p[0];
        for (var i = 1; i < g + 2; i++) {
            x += p[i] / (z + i);
        }
        var t = z + g + 0.5;

        return Math.sqrt(2 * Math.PI)
            * Math.pow(t, z + 0.5)
            * Math.exp(-t)
            * x
        ;
    }
};

module.exports.log = lngamma;

},{}],74:[function(require,module,exports){
'use strict'

module.exports = createAxes

var createText        = require('./lib/text.js')
var createLines       = require('./lib/lines.js')
var createBackground  = require('./lib/background.js')
var getCubeProperties = require('./lib/cube.js')
var Ticks             = require('./lib/ticks.js')

var identity = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1])

function copyVec3(a, b) {
  a[0] = b[0]
  a[1] = b[1]
  a[2] = b[2]
  return a
}

function Axes(gl) {
  this.gl             = gl

  this.pixelRatio     = 1

  this.bounds         = [ [-10, -10, -10],
                          [ 10,  10,  10] ]
  this.ticks          = [ [], [], [] ]
  this.autoTicks      = true
  this.tickSpacing    = [ 1, 1, 1 ]

  this.tickEnable     = [ true, true, true ]
  this.tickFont       = [ 'sans-serif', 'sans-serif', 'sans-serif' ]
  this.tickSize       = [ 12, 12, 12 ]
  this.tickAngle      = [ 0, 0, 0 ]
  this.tickColor      = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]
  this.tickPad        = [ 10, 10, 10 ]

  this.lastCubeProps  = {
    cubeEdges: [0,0,0],
    axis:      [0,0,0]
  }

  this.labels         = [ 'x', 'y', 'z' ]
  this.labelEnable    = [ true, true, true ]
  this.labelFont      = 'sans-serif'
  this.labelSize      = [ 20, 20, 20 ]
  this.labelAngle     = [ 0, 0, 0 ]
  this.labelColor     = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]
  this.labelPad       = [ 10, 10, 10 ]

  this.lineEnable     = [ true, true, true ]
  this.lineMirror     = [ false, false, false ]
  this.lineWidth      = [ 1, 1, 1 ]
  this.lineColor      = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]

  this.lineTickEnable = [ true, true, true ]
  this.lineTickMirror = [ false, false, false ]
  this.lineTickLength = [ 0, 0, 0 ]
  this.lineTickWidth  = [ 1, 1, 1 ]
  this.lineTickColor  = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]

  this.gridEnable     = [ true, true, true ]
  this.gridWidth      = [ 1, 1, 1 ]
  this.gridColor      = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]

  this.zeroEnable     = [ true, true, true ]
  this.zeroLineColor  = [ [0,0,0,1], [0,0,0,1], [0,0,0,1] ]
  this.zeroLineWidth  = [ 2, 2, 2 ]

  this.backgroundEnable = [ false, false, false ]
  this.backgroundColor  = [ [0.8, 0.8, 0.8, 0.5],
                            [0.8, 0.8, 0.8, 0.5],
                            [0.8, 0.8, 0.8, 0.5] ]

  this._firstInit = true
  this._text  = null
  this._lines = null
  this._background = createBackground(gl)
}

var proto = Axes.prototype

proto.update = function(options) {
  options = options || {}

  //Option parsing helper functions
  function parseOption(nest, cons, name) {
    if(name in options) {
      var opt = options[name]
      var prev = this[name]
      var next
      if(nest ? (Array.isArray(opt) && Array.isArray(opt[0])) :
                 Array.isArray(opt) ) {
        this[name] = next = [ cons(opt[0]), cons(opt[1]), cons(opt[2]) ]
      } else {
        this[name] = next = [ cons(opt), cons(opt), cons(opt) ]
      }
      for(var i=0; i<3; ++i) {
        if(next[i] !== prev[i]) {
          return true
        }
      }
    }
    return false
  }

  var NUMBER  = parseOption.bind(this, false, Number)
  var BOOLEAN = parseOption.bind(this, false, Boolean)
  var STRING  = parseOption.bind(this, false, String)
  var COLOR   = parseOption.bind(this, true, function(v) {
    if(Array.isArray(v)) {
      if(v.length === 3) {
        return [ +v[0], +v[1], +v[2], 1.0 ]
      } else if(v.length === 4) {
        return [ +v[0], +v[1], +v[2], +v[3] ]
      }
    }
    return [ 0, 0, 0, 1 ]
  })

  //Tick marks and bounds
  var nextTicks
  var ticksUpdate   = false
  var boundsChanged = false
  if('bounds' in options) {
    var bounds = options.bounds
i_loop:
    for(var i=0; i<2; ++i) {
      for(var j=0; j<3; ++j) {
        if(bounds[i][j] !== this.bounds[i][j]) {
          boundsChanged = true
        }
        this.bounds[i][j] = bounds[i][j]
      }
    }
  }
  if('ticks' in options) {
    nextTicks      = options.ticks
    ticksUpdate    = true
    this.autoTicks = false
    for(var i=0; i<3; ++i) {
      this.tickSpacing[i] = 0.0
    }
  } else if(NUMBER('tickSpacing')) {
    this.autoTicks  = true
    boundsChanged   = true
  }

  if(this._firstInit) {
    if(!('ticks' in options || 'tickSpacing' in options)) {
      this.autoTicks = true
    }

    //Force tick recomputation on first update
    boundsChanged   = true
    ticksUpdate     = true
    this._firstInit = false
  }

  if(boundsChanged && this.autoTicks) {
    nextTicks = Ticks.create(this.bounds, this.tickSpacing)
    ticksUpdate = true
  }

  //Compare next ticks to previous ticks, only update if needed
  if(ticksUpdate) {
    for(var i=0; i<3; ++i) {
      nextTicks[i].sort(function(a,b) {
        return a.x-b.x
      })
    }
    if(Ticks.equal(nextTicks, this.ticks)) {
      ticksUpdate = false
    } else {
      this.ticks = nextTicks
    }
  }

  //Parse tick properties
  BOOLEAN('tickEnable')
  if(STRING('tickFont')) {
    ticksUpdate = true  //If font changes, must rebuild vbo
  }
  NUMBER('tickSize')
  NUMBER('tickAngle')
  NUMBER('tickPad')
  COLOR('tickColor')

  //Axis labels
  var labelUpdate = STRING('labels')
  if(STRING('labelFont')) {
    labelUpdate = true
  }
  BOOLEAN('labelEnable')
  NUMBER('labelSize')
  NUMBER('labelPad')
  COLOR('labelColor')

  //Axis lines
  BOOLEAN('lineEnable')
  BOOLEAN('lineMirror')
  NUMBER('lineWidth')
  COLOR('lineColor')

  //Axis line ticks
  BOOLEAN('lineTickEnable')
  BOOLEAN('lineTickMirror')
  NUMBER('lineTickLength')
  NUMBER('lineTickWidth')
  COLOR('lineTickColor')

  //Grid lines
  BOOLEAN('gridEnable')
  NUMBER('gridWidth')
  COLOR('gridColor')

  //Zero line
  BOOLEAN('zeroEnable')
  COLOR('zeroLineColor')
  NUMBER('zeroLineWidth')

  //Background
  BOOLEAN('backgroundEnable')
  COLOR('backgroundColor')

  //Update text if necessary
  if(!this._text) {
    this._text = createText(
      this.gl,
      this.bounds,
      this.labels,
      this.labelFont,
      this.ticks,
      this.tickFont)
  } else if(this._text && (labelUpdate || ticksUpdate)) {
    this._text.update(
      this.bounds,
      this.labels,
      this.labelFont,
      this.ticks,
      this.tickFont)
  }

  //Update lines if necessary
  if(this._lines && ticksUpdate) {
    this._lines.dispose()
    this._lines = null
  }
  if(!this._lines) {
    this._lines = createLines(this.gl, this.bounds, this.ticks)
  }
}

function OffsetInfo() {
  this.primalOffset = [0,0,0]
  this.primalMinor  = [0,0,0]
  this.mirrorOffset = [0,0,0]
  this.mirrorMinor  = [0,0,0]
}

var LINE_OFFSET = [ new OffsetInfo(), new OffsetInfo(), new OffsetInfo() ]

function computeLineOffset(result, i, bounds, cubeEdges, cubeAxis) {
  var primalOffset = result.primalOffset
  var primalMinor  = result.primalMinor
  var dualOffset   = result.mirrorOffset
  var dualMinor    = result.mirrorMinor
  var e = cubeEdges[i]

  //Calculate offsets
  for(var j=0; j<3; ++j) {
    if(i === j) {
      continue
    }
    var a = primalOffset,
        b = dualOffset,
        c = primalMinor,
        d = dualMinor
    if(e & (1<<j)) {
      a = dualOffset
      b = primalOffset
      c = dualMinor
      d = primalMinor
    }
    a[j] = bounds[0][j]
    b[j] = bounds[1][j]
    if(cubeAxis[j] > 0) {
      c[j] = -1
      d[j] = 0
    } else {
      c[j] = 0
      d[j] = +1
    }
  }
}

var CUBE_ENABLE = [0,0,0]
var DEFAULT_PARAMS = {
  model:      identity,
  view:       identity,
  projection: identity
}

proto.isOpaque = function() {
  return true
}

proto.isTransparent = function() {
  return false
}

proto.drawTransparent = function(params) {}


var PRIMAL_MINOR  = [0,0,0]
var MIRROR_MINOR  = [0,0,0]
var PRIMAL_OFFSET = [0,0,0]

proto.draw = function(params) {
  params = params || DEFAULT_PARAMS

  var gl = this.gl

  //Geometry for camera and axes
  var model       = params.model || identity
  var view        = params.view || identity
  var projection  = params.projection || identity
  var bounds      = this.bounds

  //Unpack axis info
  var cubeParams  = getCubeProperties(model, view, projection, bounds)
  var cubeEdges   = cubeParams.cubeEdges
  var cubeAxis    = cubeParams.axis

  var cx = view[12]
  var cy = view[13]
  var cz = view[14]
  var cw = view[15]

  var pixelScaleF = this.pixelRatio * (projection[3]*cx + projection[7]*cy + projection[11]*cz + projection[15]*cw) / gl.drawingBufferHeight

  for(var i=0; i<3; ++i) {
    this.lastCubeProps.cubeEdges[i] = cubeEdges[i]
    this.lastCubeProps.axis[i] = cubeAxis[i]
  }

  //Compute axis info
  var lineOffset  = LINE_OFFSET
  for(var i=0; i<3; ++i) {
    computeLineOffset(
      LINE_OFFSET[i],
      i,
      this.bounds,
      cubeEdges,
      cubeAxis)
  }

  //Set up state parameters
  var gl = this.gl

  //Draw background first
  var cubeEnable = CUBE_ENABLE
  for(var i=0; i<3; ++i) {
    if(this.backgroundEnable[i]) {
      cubeEnable[i] = cubeAxis[i]
    } else {
      cubeEnable[i] = 0
    }
  }

  this._background.draw(
    model,
    view,
    projection,
    bounds,
    cubeEnable,
    this.backgroundColor)

  //Draw lines
  this._lines.bind(
    model,
    view,
    projection,
    this)

  //First draw grid lines and zero lines
  for(var i=0; i<3; ++i) {
    var x = [0,0,0]
    if(cubeAxis[i] > 0) {
      x[i] = bounds[1][i]
    } else {
      x[i] = bounds[0][i]
    }

    //Draw grid lines
    for(var j=0; j<2; ++j) {
      var u = (i + 1 + j) % 3
      var v = (i + 1 + (j^1)) % 3
      if(this.gridEnable[u]) {
        this._lines.drawGrid(u, v, this.bounds, x, this.gridColor[u], this.gridWidth[u]*this.pixelRatio)
      }
    }

    //Draw zero lines (need to do this AFTER all grid lines are drawn)
    for(var j=0; j<2; ++j) {
      var u = (i + 1 + j) % 3
      var v = (i + 1 + (j^1)) % 3
      if(this.zeroEnable[v]) {
        //Check if zero line in bounds
        if(bounds[0][v] <= 0 && bounds[1][v] >= 0) {
          this._lines.drawZero(u, v, this.bounds, x, this.zeroLineColor[v], this.zeroLineWidth[v]*this.pixelRatio)
        }
      }
    }
  }

  //Then draw axis lines and tick marks
  for(var i=0; i<3; ++i) {

    //Draw axis lines
    if(this.lineEnable[i]) {
      this._lines.drawAxisLine(i, this.bounds, lineOffset[i].primalOffset, this.lineColor[i], this.lineWidth[i]*this.pixelRatio)
    }
    if(this.lineMirror[i]) {
      this._lines.drawAxisLine(i, this.bounds, lineOffset[i].mirrorOffset, this.lineColor[i], this.lineWidth[i]*this.pixelRatio)
    }

    //Compute minor axes
    var primalMinor = copyVec3(PRIMAL_MINOR, lineOffset[i].primalMinor)
    var mirrorMinor = copyVec3(MIRROR_MINOR, lineOffset[i].mirrorMinor)
    var tickLength  = this.lineTickLength
    var op = 0
    for(var j=0; j<3; ++j) {
      var scaleFactor = pixelScaleF / model[5*j]
      primalMinor[j] *= tickLength[j] * scaleFactor
      mirrorMinor[j] *= tickLength[j] * scaleFactor
    }

    //Draw axis line ticks
    if(this.lineTickEnable[i]) {
      this._lines.drawAxisTicks(i, lineOffset[i].primalOffset, primalMinor, this.lineTickColor[i], this.lineTickWidth[i]*this.pixelRatio)
    }
    if(this.lineTickMirror[i]) {
      this._lines.drawAxisTicks(i, lineOffset[i].mirrorOffset, mirrorMinor, this.lineTickColor[i], this.lineTickWidth[i]*this.pixelRatio)
    }
  }

  //Draw text sprites
  this._text.bind(
    model,
    view,
    projection,
    this.pixelRatio)

  for(var i=0; i<3; ++i) {

    var minor      = lineOffset[i].primalMinor
    var offset     = copyVec3(PRIMAL_OFFSET, lineOffset[i].primalOffset)

    for(var j=0; j<3; ++j) {
      if(this.lineTickEnable[i]) {
        offset[j] += pixelScaleF * minor[j] * Math.max(this.lineTickLength[j], 0)  / model[5*j]
      }
    }

    //Draw tick text
    if(this.tickEnable[i]) {

      //Add tick padding
      for(var j=0; j<3; ++j) {
        offset[j] += pixelScaleF * minor[j] * this.tickPad[j] / model[5*j]
      }

      //Draw axis
      this._text.drawTicks(
        i,
        this.tickSize[i],
        this.tickAngle[i],
        offset,
        this.tickColor[i])
    }

    //Draw labels
    if(this.labelEnable[i]) {

      //Add label padding
      for(var j=0; j<3; ++j) {
        offset[j] += pixelScaleF * minor[j] * this.labelPad[j] / model[5*j]
      }
      offset[i] += 0.5 * (bounds[0][i] + bounds[1][i])

      //Draw axis
      this._text.drawLabel(
        i,
        this.labelSize[i],
        this.labelAngle[i],
        offset,
        this.labelColor[i])
    }
  }
}

proto.dispose = function() {
  this._text.dispose()
  this._lines.dispose()
  this._background.dispose()
  this._lines = null
  this._text = null
  this._background = null
  this.gl = null
}

function createAxes(gl, options) {
  var axes = new Axes(gl)
  axes.update(options)
  return axes
}

},{"./lib/background.js":75,"./lib/cube.js":76,"./lib/lines.js":77,"./lib/text.js":79,"./lib/ticks.js":80}],75:[function(require,module,exports){
'use strict'

module.exports = createBackgroundCube

var createBuffer = require('gl-buffer')
var createVAO    = require('gl-vao')
var createShader = require('./shaders').bg

function BackgroundCube(gl, buffer, vao, shader) {
  this.gl = gl
  this.buffer = buffer
  this.vao = vao
  this.shader = shader
}

var proto = BackgroundCube.prototype

proto.draw = function(model, view, projection, bounds, enable, colors) {
  var needsBG = false
  for(var i=0; i<3; ++i) {
    needsBG = needsBG || enable[i]
  }
  if(!needsBG) {
    return
  }

  var gl = this.gl

  gl.enable(gl.POLYGON_OFFSET_FILL)
  gl.polygonOffset(1, 2)

  this.shader.bind()
  this.shader.uniforms = {
    model: model,
    view: view,
    projection: projection,
    bounds: bounds,
    enable: enable,
    colors: colors
  }
  this.vao.bind()
  this.vao.draw(this.gl.TRIANGLES, 36)

  gl.disable(gl.POLYGON_OFFSET_FILL)
}

proto.dispose = function() {
  this.vao.dispose()
  this.buffer.dispose()
  this.shader.dispose()
}

function createBackgroundCube(gl) {
  //Create cube vertices
  var vertices = []
  var indices  = []
  var ptr = 0
  for(var d=0; d<3; ++d) {
    var u = (d+1) % 3
    var v = (d+2) % 3
    var x = [0,0,0]
    var c = [0,0,0]
    for(var s=-1; s<=1; s+=2) {
      indices.push(ptr,   ptr+2, ptr+1,
                   ptr+1, ptr+2, ptr+3)
      x[d] = s
      c[d] = s
      for(var i=-1; i<=1; i+=2) {
        x[u] = i
        for(var j=-1; j<=1; j+=2) {
          x[v] = j
          vertices.push(x[0], x[1], x[2],
                        c[0], c[1], c[2])
          ptr += 1
        }
      }
      //Swap u and v
      var tt = u
      u = v
      v = tt
    }
  }

  //Allocate buffer and vertex array
  var buffer = createBuffer(gl, new Float32Array(vertices))
  var elements = createBuffer(gl, new Uint16Array(indices), gl.ELEMENT_ARRAY_BUFFER)
  var vao = createVAO(gl, [
      {
        buffer: buffer,
        type: gl.FLOAT,
        size: 3,
        offset: 0,
        stride: 24
      },
      {
        buffer: buffer,
        type: gl.FLOAT,
        size: 3,
        offset: 12,
        stride: 24
      }
    ], elements)

  //Create shader object
  var shader = createShader(gl)
  shader.attributes.position.location = 0
  shader.attributes.normal.location = 1

  return new BackgroundCube(gl, buffer, vao, shader)
}

},{"./shaders":78,"gl-buffer":81,"gl-vao":128}],76:[function(require,module,exports){
"use strict"

module.exports = getCubeEdges

var bits      = require('bit-twiddle')
var multiply  = require('gl-mat4/multiply')
var invert    = require('gl-mat4/invert')
var splitPoly = require('split-polygon')
var orient    = require('robust-orientation')

var mvp        = new Array(16)
var imvp       = new Array(16)
var pCubeVerts = new Array(8)
var cubeVerts  = new Array(8)
var x          = new Array(3)
var zero3      = [0,0,0]

;(function() {
  for(var i=0; i<8; ++i) {
    pCubeVerts[i] =[1,1,1,1]
    cubeVerts[i] = [1,1,1]
  }
})()


function transformHg(result, x, mat) {
  for(var i=0; i<4; ++i) {
    result[i] = mat[12+i]
    for(var j=0; j<3; ++j) {
      result[i] += x[j]*mat[4*j+i]
    }
  }
}

var FRUSTUM_PLANES = [
  [ 0, 0, 1, 0, 0],
  [ 0, 0,-1, 1, 0],
  [ 0,-1, 0, 1, 0],
  [ 0, 1, 0, 1, 0],
  [-1, 0, 0, 1, 0],
  [ 1, 0, 0, 1, 0]
]

function polygonArea(p) {
  for(var i=0; i<FRUSTUM_PLANES.length; ++i) {
    p = splitPoly.positive(p, FRUSTUM_PLANES[i])
    if(p.length < 3) {
      return 0
    }
  }

  var base = p[0]
  var ax = base[0] / base[3]
  var ay = base[1] / base[3]
  var area = 0.0
  for(var i=1; i+1<p.length; ++i) {
    var b = p[i]
    var c = p[i+1]

    var bx = b[0]/b[3]
    var by = b[1]/b[3]
    var cx = c[0]/c[3]
    var cy = c[1]/c[3]

    var ux = bx - ax
    var uy = by - ay

    var vx = cx - ax
    var vy = cy - ay

    area += Math.abs(ux * vy - uy * vx)
  }

  return area
}

var CUBE_EDGES = [1,1,1]
var CUBE_AXIS  = [0,0,0]
var CUBE_RESULT = {
  cubeEdges: CUBE_EDGES,
  axis: CUBE_AXIS
}

function getCubeEdges(model, view, projection, bounds) {

  //Concatenate matrices
  multiply(mvp, view, model)
  multiply(mvp, projection, mvp)
  
  //First project cube vertices
  var ptr = 0
  for(var i=0; i<2; ++i) {
    x[2] = bounds[i][2]
    for(var j=0; j<2; ++j) {
      x[1] = bounds[j][1]
      for(var k=0; k<2; ++k) {
        x[0] = bounds[k][0]
        transformHg(pCubeVerts[ptr], x, mvp)
        ptr += 1
      }
    }
  }

  //Classify camera against cube faces
  var closest = -1

  for(var i=0; i<8; ++i) {
    var w = pCubeVerts[i][3]
    for(var l=0; l<3; ++l) {
      cubeVerts[i][l] = pCubeVerts[i][l] / w
    }
    if(w < 0) {
      if(closest < 0) {
        closest = i
      } else if(cubeVerts[i][2] < cubeVerts[closest][2]) {
        closest = i
      }
    }    
  }

  if(closest < 0) {
    closest = 0
    for(var d=0; d<3; ++d) {
      var u = (d+2) % 3
      var v = (d+1) % 3
      var o0 = -1
      var o1 = -1
      for(var s=0; s<2; ++s) {
        var f0 = (s<<d)
        var f1 = f0 + (s << u) + ((1-s) << v)
        var f2 = f0 + ((1-s) << u) + (s << v)
        if(orient(cubeVerts[f0], cubeVerts[f1], cubeVerts[f2], zero3) < 0) {
          continue
        }
        if(s) {
          o0 = 1
        } else {
          o1 = 1
        }
      }
      if(o0 < 0 || o1 < 0) {
        if(o1 > o0) {
          closest |= 1<<d
        }
        continue
      } 
      for(var s=0; s<2; ++s) {
        var f0 = (s<<d)
        var f1 = f0 + (s << u) + ((1-s) << v)
        var f2 = f0 + ((1-s) << u) + (s << v)    
        var o = polygonArea([
            pCubeVerts[f0], 
            pCubeVerts[f1], 
            pCubeVerts[f2], 
            pCubeVerts[f0+(1<<u)+(1<<v)]])
        if(s) {
          o0 = o
        } else {
          o1 = o
        }
      }
      if(o1 > o0) {
        closest |= 1<<d
        continue
      }
    }
  }

  var farthest = 7^closest

  //Find lowest vertex which is not closest closest
  var bottom = -1
  for(var i=0; i<8; ++i) {
    if(i === closest || i === farthest) {
      continue
    }
    if(bottom < 0) {
      bottom = i
    } else if(cubeVerts[bottom][1] > cubeVerts[i][1]) {
      bottom = i
    }
  }

  //Find left/right neighbors of bottom vertex
  var left = -1
  for(var i=0; i<3; ++i) {
    var idx = bottom ^ (1<<i)
    if(idx === closest || idx === farthest) {
      continue
    }
    if(left < 0) {
      left = idx
    }
    var v = cubeVerts[idx]
    if(v[0] < cubeVerts[left][0]) {
      left = idx
    }
  }
  var right = -1
  for(var i=0; i<3; ++i) {
    var idx = bottom ^ (1<<i)
    if(idx === closest || idx === farthest || idx === left) {
      continue
    }
    if(right < 0) {
      right = idx
    }
    var v = cubeVerts[idx]
    if(v[0] > cubeVerts[right][0]) {
      right = idx
    }
  }

  //Determine edge axis coordinates
  var cubeEdges = CUBE_EDGES
  cubeEdges[0] = cubeEdges[1] = cubeEdges[2] = 0
  cubeEdges[bits.log2(left^bottom)] = bottom&left
  cubeEdges[bits.log2(bottom^right)] = bottom&right
  var top = right ^ 7
  if(top === closest || top === farthest) {
    top = left ^ 7
    cubeEdges[bits.log2(right^top)] = top&right
  } else {
    cubeEdges[bits.log2(left^top)] = top&left
  }

  //Determine visible faces
  var axis = CUBE_AXIS
  var cutCorner = closest
  for(var d=0; d<3; ++d) {
    if(cutCorner & (1<<d)) {
      axis[d] = -1
    } else {
      axis[d] = 1
    }
  }

  //Return result
  return CUBE_RESULT
}
},{"bit-twiddle":35,"gl-mat4/invert":96,"gl-mat4/multiply":98,"robust-orientation":190,"split-polygon":204}],77:[function(require,module,exports){
'use strict'

module.exports    = createLines

var createBuffer  = require('gl-buffer')
var createVAO     = require('gl-vao')
var createShader  = require('./shaders').line

var MAJOR_AXIS = [0,0,0]
var MINOR_AXIS = [0,0,0]
var SCREEN_AXIS = [0,0,0]
var OFFSET_VEC = [0,0,0]
var SHAPE = [1,1]

function zeroVec(a) {
  a[0] = a[1] = a[2] = 0
  return a
}

function copyVec(a,b) {
  a[0] = b[0]
  a[1] = b[1]
  a[2] = b[2]
  return a
}

function Lines(gl, vertBuffer, vao, shader, tickCount, tickOffset, gridCount, gridOffset) {
  this.gl         = gl
  this.vertBuffer = vertBuffer
  this.vao        = vao
  this.shader     = shader
  this.tickCount  = tickCount
  this.tickOffset = tickOffset
  this.gridCount  = gridCount
  this.gridOffset = gridOffset
}

var proto = Lines.prototype

proto.bind = function(model, view, projection) {
  this.shader.bind()
  this.shader.uniforms.model = model
  this.shader.uniforms.view = view
  this.shader.uniforms.projection = projection

  SHAPE[0] = this.gl.drawingBufferWidth
  SHAPE[1] = this.gl.drawingBufferHeight

  this.shader.uniforms.screenShape = SHAPE
  this.vao.bind()
}

proto.drawAxisLine = function(j, bounds, offset, color, lineWidth) {
  var minorAxis = zeroVec(MINOR_AXIS)
  this.shader.uniforms.majorAxis = MINOR_AXIS

  minorAxis[j] = bounds[1][j] - bounds[0][j]
  this.shader.uniforms.minorAxis = minorAxis

  var noffset = copyVec(OFFSET_VEC, offset)
  noffset[j] += bounds[0][j]
  this.shader.uniforms.offset = noffset

  this.shader.uniforms.lineWidth = lineWidth

  this.shader.uniforms.color = color

  var screenAxis = zeroVec(SCREEN_AXIS)
  screenAxis[(j+2)%3] = 1
  this.shader.uniforms.screenAxis = screenAxis
  this.vao.draw(this.gl.TRIANGLES, 6)

  var screenAxis = zeroVec(SCREEN_AXIS)
  screenAxis[(j+1)%3] = 1
  this.shader.uniforms.screenAxis = screenAxis
  this.vao.draw(this.gl.TRIANGLES, 6)
}

proto.drawAxisTicks = function(j, offset, minorAxis, color, lineWidth) {
  if(!this.tickCount[j]) {
    return
  }

  var majorAxis = zeroVec(MAJOR_AXIS)
  majorAxis[j]  = 1
  this.shader.uniforms.majorAxis = majorAxis
  this.shader.uniforms.offset    = offset
  this.shader.uniforms.minorAxis = minorAxis
  this.shader.uniforms.color     = color
  this.shader.uniforms.lineWidth = lineWidth

  var screenAxis = zeroVec(SCREEN_AXIS)
  screenAxis[j] = 1
  this.shader.uniforms.screenAxis = screenAxis
  this.vao.draw(this.gl.TRIANGLES, this.tickCount[j], this.tickOffset[j])
}


proto.drawGrid = function(i, j, bounds, offset, color, lineWidth) {
  if(!this.gridCount[i]) {
    return
  }

  var minorAxis = zeroVec(MINOR_AXIS)
  minorAxis[j]  = bounds[1][j] - bounds[0][j]
  this.shader.uniforms.minorAxis = minorAxis

  var noffset = copyVec(OFFSET_VEC, offset)
  noffset[j] += bounds[0][j]
  this.shader.uniforms.offset = noffset

  var majorAxis = zeroVec(MAJOR_AXIS)
  majorAxis[i]  = 1
  this.shader.uniforms.majorAxis = majorAxis

  var screenAxis = zeroVec(SCREEN_AXIS)
  screenAxis[i] = 1
  this.shader.uniforms.screenAxis = screenAxis
  this.shader.uniforms.lineWidth = lineWidth

  this.shader.uniforms.color = color
  this.vao.draw(this.gl.TRIANGLES, this.gridCount[i], this.gridOffset[i])
}

proto.drawZero = function(j, i, bounds, offset, color, lineWidth) {
  var minorAxis = zeroVec(MINOR_AXIS)
  this.shader.uniforms.majorAxis = minorAxis

  minorAxis[j] = bounds[1][j] - bounds[0][j]
  this.shader.uniforms.minorAxis = minorAxis

  var noffset = copyVec(OFFSET_VEC, offset)
  noffset[j] += bounds[0][j]
  this.shader.uniforms.offset = noffset

  var screenAxis = zeroVec(SCREEN_AXIS)
  screenAxis[i] = 1
  this.shader.uniforms.screenAxis = screenAxis
  this.shader.uniforms.lineWidth = lineWidth

  this.shader.uniforms.color = color
  this.vao.draw(this.gl.TRIANGLES, 6)
}

proto.dispose = function() {
  this.vao.dispose()
  this.vertBuffer.dispose()
  this.shader.dispose()
}

function createLines(gl, bounds, ticks) {
  var vertices    = []
  var tickOffset  = [0,0,0]
  var tickCount   = [0,0,0]

  //Create grid lines for each axis/direction
  var gridOffset = [0,0,0]
  var gridCount  = [0,0,0]

  //Add zero line
  vertices.push(
    0,0,1,   0,1,1,   0,0,-1,
    0,0,-1,  0,1,1,   0,1,-1)

  for(var i=0; i<3; ++i) {
    //Axis tick marks
    var start = ((vertices.length / 3)|0)
    for(var j=0; j<ticks[i].length; ++j) {
      var x = +ticks[i][j].x
      vertices.push(
        x,0,1,   x,1,1,   x,0,-1,
        x,0,-1,  x,1,1,   x,1,-1)
    }
    var end = ((vertices.length / 3)|0)
    tickOffset[i] = start
    tickCount[i]  = end - start

    //Grid lines
    var start = ((vertices.length / 3)|0)
    for(var k=0; k<ticks[i].length; ++k) {
      var x = +ticks[i][k].x
      vertices.push(
        x,0,1,   x,1,1,   x,0,-1,
        x,0,-1,  x,1,1,   x,1,-1)
    }
    var end = ((vertices.length / 3)|0)
    gridOffset[i] = start
    gridCount[i]  = end - start
  }

  //Create cube VAO
  var vertBuf = createBuffer(gl, new Float32Array(vertices))
  var vao = createVAO(gl, [
    { "buffer": vertBuf,
      "type": gl.FLOAT,
      "size": 3,
      "stride": 0,
      "offset": 0
    }
  ])
  var shader = createShader(gl)
  shader.attributes.position.location = 0
  return new Lines(gl, vertBuf, vao, shader, tickCount, tickOffset, gridCount, gridOffset)
}

},{"./shaders":78,"gl-buffer":81,"gl-vao":128}],78:[function(require,module,exports){
'use strict'


var createShader = require('gl-shader')

var lineVert = "#define GLSLIFY 1\nattribute vec3 position;\n\nuniform mat4 model, view, projection;\nuniform vec3 offset, majorAxis, minorAxis, screenAxis;\nuniform float lineWidth;\nuniform vec2 screenShape;\n\nvec3 project(vec3 p) {\n  vec4 pp = projection * view * model * vec4(p, 1.0);\n  return pp.xyz / max(pp.w, 0.0001);\n}\n\nvoid main() {\n  vec3 major = position.x * majorAxis;\n  vec3 minor = position.y * minorAxis;\n\n  vec3 vPosition = major + minor + offset;\n  vec3 pPosition = project(vPosition);\n  vec3 offset = project(vPosition + screenAxis * position.z);\n\n  vec2 screen = normalize((offset - pPosition).xy * screenShape) / screenShape;\n\n  gl_Position = vec4(pPosition + vec3(0.5 * screen * lineWidth, 0), 1.0);\n}\n"
var lineFrag = "precision mediump float;\n#define GLSLIFY 1\nuniform vec4 color;\nvoid main() {\n  gl_FragColor = color;\n}"
exports.line = function(gl) {
  return createShader(gl, lineVert, lineFrag, null, [
    {name: 'position', type: 'vec3'}
  ])
}

var textVert = "#define GLSLIFY 1\nattribute vec3 position;\n\nuniform mat4 model, view, projection;\nuniform vec3 offset, axis;\nuniform float scale, angle, pixelScale;\nuniform vec2 resolution;\n\nvoid main() {  \n  //Compute plane offset\n  vec2 planeCoord = position.xy * pixelScale;\n  mat2 planeXform = scale * mat2(cos(angle), sin(angle),\n                                -sin(angle), cos(angle));\n  vec2 viewOffset = 2.0 * planeXform * planeCoord / resolution;\n\n  //Compute world offset\n  float axisDistance = position.z;\n  vec3 dataPosition = axisDistance * axis + offset;\n  vec4 worldPosition = model * vec4(dataPosition, 1);\n  \n  //Compute clip position\n  vec4 viewPosition = view * worldPosition;\n  vec4 clipPosition = projection * viewPosition;\n  clipPosition /= clipPosition.w;\n\n  //Apply text offset in clip coordinates\n  clipPosition += vec4(viewOffset, 0, 0);\n\n  //Done\n  gl_Position = clipPosition;\n}"
var textFrag = "precision mediump float;\n#define GLSLIFY 1\nuniform vec4 color;\nvoid main() {\n  gl_FragColor = color;\n}"
exports.text = function(gl) {
  return createShader(gl, textVert, textFrag, null, [
    {name: 'position', type: 'vec3'}
  ])
}

var bgVert = "#define GLSLIFY 1\nattribute vec3 position;\nattribute vec3 normal;\n\nuniform mat4 model, view, projection;\nuniform vec3 enable;\nuniform vec3 bounds[2];\n\nvarying vec3 colorChannel;\n\nvoid main() {\n  if(dot(normal, enable) > 0.0) {\n    vec3 nPosition = mix(bounds[0], bounds[1], 0.5 * (position + 1.0));\n    gl_Position = projection * view * model * vec4(nPosition, 1.0);\n  } else {\n    gl_Position = vec4(0,0,0,0);\n  }\n  colorChannel = abs(normal);\n}"
var bgFrag = "precision mediump float;\n#define GLSLIFY 1\n\nuniform vec4 colors[3];\n\nvarying vec3 colorChannel;\n\nvoid main() {\n  gl_FragColor = colorChannel.x * colors[0] + \n                 colorChannel.y * colors[1] +\n                 colorChannel.z * colors[2];\n}"
exports.bg = function(gl) {
  return createShader(gl, bgVert, bgFrag, null, [
    {name: 'position', type: 'vec3'},
    {name: 'normal', type: 'vec3'}
  ])
}

},{"gl-shader":115}],79:[function(require,module,exports){
(function (process){
"use strict"

module.exports = createTextSprites

var createBuffer  = require('gl-buffer')
var createVAO     = require('gl-vao')
var vectorizeText = require('vectorize-text')
var createShader  = require('./shaders').text

var globals = window || process.global || {}
var __TEXT_CACHE  = globals.__TEXT_CACHE || {}
globals.__TEXT_CACHE = {}

//Vertex buffer format for text is:
//
/// [x,y,z] = Spatial coordinate
//

var VERTEX_SIZE = 3
var VERTEX_STRIDE = VERTEX_SIZE * 4

function TextSprites(
  gl,
  shader,
  buffer,
  vao) {
  this.gl           = gl
  this.shader       = shader
  this.buffer       = buffer
  this.vao          = vao
  this.tickOffset   =
  this.tickCount    =
  this.labelOffset  =
  this.labelCount   = null
}

var proto = TextSprites.prototype

//Bind textures for rendering
var SHAPE = [0,0]
proto.bind = function(model, view, projection, pixelScale) {
  this.vao.bind()
  this.shader.bind()
  var uniforms = this.shader.uniforms
  uniforms.model = model
  uniforms.view = view
  uniforms.projection = projection
  uniforms.pixelScale = pixelScale
  SHAPE[0] = this.gl.drawingBufferWidth
  SHAPE[1] = this.gl.drawingBufferHeight
  this.shader.uniforms.resolution = SHAPE
}

proto.update = function(bounds, labels, labelFont, ticks, tickFont) {
  var gl = this.gl
  var data = []

  function addItem(t, text, font, size) {
    var fontcache = __TEXT_CACHE[font]
    if(!fontcache) {
      fontcache = __TEXT_CACHE[font] = {}
    }
    var mesh = fontcache[text]
    if(!mesh) {
      mesh = fontcache[text] = tryVectorizeText(text, {
        triangles: true,
        font: font,
        textAlign: 'center',
        textBaseline: 'middle'
      })
    }
    var scale = (size || 12) / 12
    var positions = mesh.positions
    var cells = mesh.cells
    var lo = [ Infinity, Infinity]
    var hi = [-Infinity,-Infinity]
    for(var i=0, nc=cells.length; i<nc; ++i) {
      var c = cells[i]
      for(var j=2; j>=0; --j) {
        var p = positions[c[j]]
        data.push(scale*p[0], -scale*p[1], t)
      }
    }
  }

  //Generate sprites for all 3 axes, store data in texture atlases
  var tickOffset  = [0,0,0]
  var tickCount   = [0,0,0]
  var labelOffset = [0,0,0]
  var labelCount  = [0,0,0]
  for(var d=0; d<3; ++d) {

    //Generate label
    labelOffset[d] = (data.length/VERTEX_SIZE)|0
    addItem(0.5*(bounds[0][d]+bounds[1][d]), labels[d], labelFont)
    labelCount[d] = ((data.length/VERTEX_SIZE)|0) - labelOffset[d]

    //Generate sprites for tick marks
    tickOffset[d] = (data.length/VERTEX_SIZE)|0
    for(var i=0; i<ticks[d].length; ++i) {
      if(!ticks[d][i].text) {
        continue
      }
      addItem(
        ticks[d][i].x,
        ticks[d][i].text,
        ticks[d][i].font || tickFont,
        ticks[d][i].fontSize || 12)
    }
    tickCount[d] = ((data.length/VERTEX_SIZE)|0) - tickOffset[d]
  }

  this.buffer.update(data)
  this.tickOffset = tickOffset
  this.tickCount = tickCount
  this.labelOffset = labelOffset
  this.labelCount = labelCount
}

//Draws the tick marks for an axis
var AXIS = [0,0,0]
proto.drawTicks = function(d, scale, angle, offset, color) {
  if(!this.tickCount[d]) {
    return
  }

  var v = AXIS
  v[0] = v[1] = v[2] = 0
  v[d] = 1
  this.shader.uniforms.axis = v
  this.shader.uniforms.color = color
  this.shader.uniforms.angle = angle
  this.shader.uniforms.scale = scale
  this.shader.uniforms.offset = offset
  this.vao.draw(this.gl.TRIANGLES, this.tickCount[d], this.tickOffset[d])
}

//Draws the text label for an axis
var ZERO = [0,0,0]
proto.drawLabel = function(d, scale, angle, offset, color) {
  if(!this.labelCount[d]) {
    return
  }
  this.shader.uniforms.axis = ZERO
  this.shader.uniforms.color = color
  this.shader.uniforms.angle = angle
  this.shader.uniforms.scale = scale
  this.shader.uniforms.offset = offset
  this.vao.draw(this.gl.TRIANGLES, this.labelCount[d], this.labelOffset[d])
}

//Releases all resources attached to this object
proto.dispose = function() {
  this.shader.dispose()
  this.vao.dispose()
  this.buffer.dispose()
}

function tryVectorizeText(text, options) {
  try {
    return vectorizeText(text, options)
  } catch(e) {
    console.warn('error vectorizing text:', e)
    return {
      cells: [],
      positions: []
    }
  }
}

function createTextSprites(
    gl,
    bounds,
    labels,
    labelFont,
    ticks,
    tickFont) {

  var buffer = createBuffer(gl)
  var vao = createVAO(gl, [
    { "buffer": buffer,
      "size": 3
    }
  ])

  var shader = createShader(gl)
  shader.attributes.position.location = 0

  var result = new TextSprites(
    gl,
    shader,
    buffer,
    vao)

  result.update(bounds, labels, labelFont, ticks, tickFont)

  return result
}

}).call(this,require('_process'))
},{"./shaders":78,"_process":5,"gl-buffer":81,"gl-vao":128,"vectorize-text":215}],80:[function(require,module,exports){
'use strict'

exports.create   = defaultTicks
exports.equal    = ticksEqual

function prettyPrint(spacing, i) {
  var stepStr = spacing + ""
  var u = stepStr.indexOf(".")
  var sigFigs = 0
  if(u >= 0) {
    sigFigs = stepStr.length - u - 1
  }
  var shift = Math.pow(10, sigFigs)
  var x = Math.round(spacing * i * shift)
  var xstr = x + ""
  if(xstr.indexOf("e") >= 0) {
    return xstr
  }
  var xi = x / shift, xf = x % shift
  if(x < 0) {
    xi = -Math.ceil(xi)|0
    xf = (-xf)|0
  } else {
    xi = Math.floor(xi)|0
    xf = xf|0
  }
  var xis = "" + xi 
  if(x < 0) {
    xis = "-" + xis
  }
  if(sigFigs) {
    var xs = "" + xf
    while(xs.length < sigFigs) {
      xs = "0" + xs
    }
    return xis + "." + xs
  } else {
    return xis
  }
}

function defaultTicks(bounds, tickSpacing) {
  var array = []
  for(var d=0; d<3; ++d) {
    var ticks = []
    var m = 0.5*(bounds[0][d]+bounds[1][d])
    for(var t=0; t*tickSpacing[d]<=bounds[1][d]; ++t) {
      ticks.push({x: t*tickSpacing[d], text: prettyPrint(tickSpacing[d], t)})
    }
    for(var t=-1; t*tickSpacing[d]>=bounds[0][d]; --t) {
      ticks.push({x: t*tickSpacing[d], text: prettyPrint(tickSpacing[d], t)})
    }
    array.push(ticks)
  }
  return array
}

function ticksEqual(ticksA, ticksB) {
  for(var i=0; i<3; ++i) {
    if(ticksA[i].length !== ticksB[i].length) {
      return false
    }
    for(var j=0; j<ticksA[i].length; ++j) {
      var a = ticksA[i][j]
      var b = ticksB[i][j]
      if(
        a.x !== b.x ||
        a.text !== b.text ||
        a.font !== b.font ||
        a.fontColor !== b.fontColor ||
        a.fontSize !== b.fontSize ||
        a.dx !== b.dx ||
        a.dy !== b.dy
      ) {
        return false
      }
    }
  }
  return true
}
},{}],81:[function(require,module,exports){
"use strict"

var pool = require("typedarray-pool")
var ops = require("ndarray-ops")
var ndarray = require("ndarray")

var SUPPORTED_TYPES = [
  "uint8",
  "uint8_clamped",
  "uint16",
  "uint32",
  "int8",
  "int16",
  "int32",
  "float32" ]

function GLBuffer(gl, type, handle, length, usage) {
  this.gl = gl
  this.type = type
  this.handle = handle
  this.length = length
  this.usage = usage
}

var proto = GLBuffer.prototype

proto.bind = function() {
  this.gl.bindBuffer(this.type, this.handle)
}

proto.unbind = function() {
  this.gl.bindBuffer(this.type, null)
}

proto.dispose = function() {
  this.gl.deleteBuffer(this.handle)
}

function updateTypeArray(gl, type, len, usage, data, offset) {
  var dataLen = data.length * data.BYTES_PER_ELEMENT
  if(offset < 0) {
    gl.bufferData(type, data, usage)
    return dataLen
  }
  if(dataLen + offset > len) {
    throw new Error("gl-buffer: If resizing buffer, must not specify offset")
  }
  gl.bufferSubData(type, offset, data)
  return len
}

function makeScratchTypeArray(array, dtype) {
  var res = pool.malloc(array.length, dtype)
  var n = array.length
  for(var i=0; i<n; ++i) {
    res[i] = array[i]
  }
  return res
}

function isPacked(shape, stride) {
  var n = 1
  for(var i=stride.length-1; i>=0; --i) {
    if(stride[i] !== n) {
      return false
    }
    n *= shape[i]
  }
  return true
}

proto.update = function(array, offset) {
  if(typeof offset !== "number") {
    offset = -1
  }
  this.bind()
  if(typeof array === "object" && typeof array.shape !== "undefined") { //ndarray
    var dtype = array.dtype
    if(SUPPORTED_TYPES.indexOf(dtype) < 0) {
      dtype = "float32"
    }
    if(this.type === this.gl.ELEMENT_ARRAY_BUFFER) {
      var ext = gl.getExtension('OES_element_index_uint')
      if(ext && dtype !== "uint16") {
        dtype = "uint32"
      } else {
        dtype = "uint16"
      }
    }
    if(dtype === array.dtype && isPacked(array.shape, array.stride)) {
      if(array.offset === 0 && array.data.length === array.shape[0]) {
        this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, array.data, offset)
      } else {
        this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, array.data.subarray(array.offset, array.shape[0]), offset)
      }
    } else {
      var tmp = pool.malloc(array.size, dtype)
      var ndt = ndarray(tmp, array.shape)
      ops.assign(ndt, array)
      if(offset < 0) {
        this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, tmp, offset)
      } else {
        this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, tmp.subarray(0, array.size), offset)
      }
      pool.free(tmp)
    }
  } else if(Array.isArray(array)) { //Vanilla array
    var t
    if(this.type === this.gl.ELEMENT_ARRAY_BUFFER) {
      t = makeScratchTypeArray(array, "uint16")
    } else {
      t = makeScratchTypeArray(array, "float32")
    }
    if(offset < 0) {
      this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, t, offset)
    } else {
      this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, t.subarray(0, array.length), offset)
    }
    pool.free(t)
  } else if(typeof array === "object" && typeof array.length === "number") { //Typed array
    this.length = updateTypeArray(this.gl, this.type, this.length, this.usage, array, offset)
  } else if(typeof array === "number" || array === undefined) { //Number/default
    if(offset >= 0) {
      throw new Error("gl-buffer: Cannot specify offset when resizing buffer")
    }
    array = array | 0
    if(array <= 0) {
      array = 1
    }
    this.gl.bufferData(this.type, array|0, this.usage)
    this.length = array
  } else { //Error, case should not happen
    throw new Error("gl-buffer: Invalid data type")
  }
}

function createBuffer(gl, data, type, usage) {
  type = type || gl.ARRAY_BUFFER
  usage = usage || gl.DYNAMIC_DRAW
  if(type !== gl.ARRAY_BUFFER && type !== gl.ELEMENT_ARRAY_BUFFER) {
    throw new Error("gl-buffer: Invalid type for webgl buffer, must be either gl.ARRAY_BUFFER or gl.ELEMENT_ARRAY_BUFFER")
  }
  if(usage !== gl.DYNAMIC_DRAW && usage !== gl.STATIC_DRAW && usage !== gl.STREAM_DRAW) {
    throw new Error("gl-buffer: Invalid usage for buffer, must be either gl.DYNAMIC_DRAW, gl.STATIC_DRAW or gl.STREAM_DRAW")
  }
  var handle = gl.createBuffer()
  var result = new GLBuffer(gl, type, handle, 0, usage)
  result.update(data)
  return result
}

module.exports = createBuffer

},{"ndarray":164,"ndarray-ops":161,"typedarray-pool":212}],82:[function(require,module,exports){
module.exports = {
  0: 'NONE',
  1: 'ONE',
  2: 'LINE_LOOP',
  3: 'LINE_STRIP',
  4: 'TRIANGLES',
  5: 'TRIANGLE_STRIP',
  6: 'TRIANGLE_FAN',
  256: 'DEPTH_BUFFER_BIT',
  512: 'NEVER',
  513: 'LESS',
  514: 'EQUAL',
  515: 'LEQUAL',
  516: 'GREATER',
  517: 'NOTEQUAL',
  518: 'GEQUAL',
  519: 'ALWAYS',
  768: 'SRC_COLOR',
  769: 'ONE_MINUS_SRC_COLOR',
  770: 'SRC_ALPHA',
  771: 'ONE_MINUS_SRC_ALPHA',
  772: 'DST_ALPHA',
  773: 'ONE_MINUS_DST_ALPHA',
  774: 'DST_COLOR',
  775: 'ONE_MINUS_DST_COLOR',
  776: 'SRC_ALPHA_SATURATE',
  1024: 'STENCIL_BUFFER_BIT',
  1028: 'FRONT',
  1029: 'BACK',
  1032: 'FRONT_AND_BACK',
  1280: 'INVALID_ENUM',
  1281: 'INVALID_VALUE',
  1282: 'INVALID_OPERATION',
  1285: 'OUT_OF_MEMORY',
  1286: 'INVALID_FRAMEBUFFER_OPERATION',
  2304: 'CW',
  2305: 'CCW',
  2849: 'LINE_WIDTH',
  2884: 'CULL_FACE',
  2885: 'CULL_FACE_MODE',
  2886: 'FRONT_FACE',
  2928: 'DEPTH_RANGE',
  2929: 'DEPTH_TEST',
  2930: 'DEPTH_WRITEMASK',
  2931: 'DEPTH_CLEAR_VALUE',
  2932: 'DEPTH_FUNC',
  2960: 'STENCIL_TEST',
  2961: 'STENCIL_CLEAR_VALUE',
  2962: 'STENCIL_FUNC',
  2963: 'STENCIL_VALUE_MASK',
  2964: 'STENCIL_FAIL',
  2965: 'STENCIL_PASS_DEPTH_FAIL',
  2966: 'STENCIL_PASS_DEPTH_PASS',
  2967: 'STENCIL_REF',
  2968: 'STENCIL_WRITEMASK',
  2978: 'VIEWPORT',
  3024: 'DITHER',
  3042: 'BLEND',
  3088: 'SCISSOR_BOX',
  3089: 'SCISSOR_TEST',
  3106: 'COLOR_CLEAR_VALUE',
  3107: 'COLOR_WRITEMASK',
  3317: 'UNPACK_ALIGNMENT',
  3333: 'PACK_ALIGNMENT',
  3379: 'MAX_TEXTURE_SIZE',
  3386: 'MAX_VIEWPORT_DIMS',
  3408: 'SUBPIXEL_BITS',
  3410: 'RED_BITS',
  3411: 'GREEN_BITS',
  3412: 'BLUE_BITS',
  3413: 'ALPHA_BITS',
  3414: 'DEPTH_BITS',
  3415: 'STENCIL_BITS',
  3553: 'TEXTURE_2D',
  4352: 'DONT_CARE',
  4353: 'FASTEST',
  4354: 'NICEST',
  5120: 'BYTE',
  5121: 'UNSIGNED_BYTE',
  5122: 'SHORT',
  5123: 'UNSIGNED_SHORT',
  5124: 'INT',
  5125: 'UNSIGNED_INT',
  5126: 'FLOAT',
  5386: 'INVERT',
  5890: 'TEXTURE',
  6401: 'STENCIL_INDEX',
  6402: 'DEPTH_COMPONENT',
  6406: 'ALPHA',
  6407: 'RGB',
  6408: 'RGBA',
  6409: 'LUMINANCE',
  6410: 'LUMINANCE_ALPHA',
  7680: 'KEEP',
  7681: 'REPLACE',
  7682: 'INCR',
  7683: 'DECR',
  7936: 'VENDOR',
  7937: 'RENDERER',
  7938: 'VERSION',
  9728: 'NEAREST',
  9729: 'LINEAR',
  9984: 'NEAREST_MIPMAP_NEAREST',
  9985: 'LINEAR_MIPMAP_NEAREST',
  9986: 'NEAREST_MIPMAP_LINEAR',
  9987: 'LINEAR_MIPMAP_LINEAR',
  10240: 'TEXTURE_MAG_FILTER',
  10241: 'TEXTURE_MIN_FILTER',
  10242: 'TEXTURE_WRAP_S',
  10243: 'TEXTURE_WRAP_T',
  10497: 'REPEAT',
  10752: 'POLYGON_OFFSET_UNITS',
  16384: 'COLOR_BUFFER_BIT',
  32769: 'CONSTANT_COLOR',
  32770: 'ONE_MINUS_CONSTANT_COLOR',
  32771: 'CONSTANT_ALPHA',
  32772: 'ONE_MINUS_CONSTANT_ALPHA',
  32773: 'BLEND_COLOR',
  32774: 'FUNC_ADD',
  32777: 'BLEND_EQUATION_RGB',
  32778: 'FUNC_SUBTRACT',
  32779: 'FUNC_REVERSE_SUBTRACT',
  32819: 'UNSIGNED_SHORT_4_4_4_4',
  32820: 'UNSIGNED_SHORT_5_5_5_1',
  32823: 'POLYGON_OFFSET_FILL',
  32824: 'POLYGON_OFFSET_FACTOR',
  32854: 'RGBA4',
  32855: 'RGB5_A1',
  32873: 'TEXTURE_BINDING_2D',
  32926: 'SAMPLE_ALPHA_TO_COVERAGE',
  32928: 'SAMPLE_COVERAGE',
  32936: 'SAMPLE_BUFFERS',
  32937: 'SAMPLES',
  32938: 'SAMPLE_COVERAGE_VALUE',
  32939: 'SAMPLE_COVERAGE_INVERT',
  32968: 'BLEND_DST_RGB',
  32969: 'BLEND_SRC_RGB',
  32970: 'BLEND_DST_ALPHA',
  32971: 'BLEND_SRC_ALPHA',
  33071: 'CLAMP_TO_EDGE',
  33170: 'GENERATE_MIPMAP_HINT',
  33189: 'DEPTH_COMPONENT16',
  33306: 'DEPTH_STENCIL_ATTACHMENT',
  33635: 'UNSIGNED_SHORT_5_6_5',
  33648: 'MIRRORED_REPEAT',
  33901: 'ALIASED_POINT_SIZE_RANGE',
  33902: 'ALIASED_LINE_WIDTH_RANGE',
  33984: 'TEXTURE0',
  33985: 'TEXTURE1',
  33986: 'TEXTURE2',
  33987: 'TEXTURE3',
  33988: 'TEXTURE4',
  33989: 'TEXTURE5',
  33990: 'TEXTURE6',
  33991: 'TEXTURE7',
  33992: 'TEXTURE8',
  33993: 'TEXTURE9',
  33994: 'TEXTURE10',
  33995: 'TEXTURE11',
  33996: 'TEXTURE12',
  33997: 'TEXTURE13',
  33998: 'TEXTURE14',
  33999: 'TEXTURE15',
  34000: 'TEXTURE16',
  34001: 'TEXTURE17',
  34002: 'TEXTURE18',
  34003: 'TEXTURE19',
  34004: 'TEXTURE20',
  34005: 'TEXTURE21',
  34006: 'TEXTURE22',
  34007: 'TEXTURE23',
  34008: 'TEXTURE24',
  34009: 'TEXTURE25',
  34010: 'TEXTURE26',
  34011: 'TEXTURE27',
  34012: 'TEXTURE28',
  34013: 'TEXTURE29',
  34014: 'TEXTURE30',
  34015: 'TEXTURE31',
  34016: 'ACTIVE_TEXTURE',
  34024: 'MAX_RENDERBUFFER_SIZE',
  34041: 'DEPTH_STENCIL',
  34055: 'INCR_WRAP',
  34056: 'DECR_WRAP',
  34067: 'TEXTURE_CUBE_MAP',
  34068: 'TEXTURE_BINDING_CUBE_MAP',
  34069: 'TEXTURE_CUBE_MAP_POSITIVE_X',
  34070: 'TEXTURE_CUBE_MAP_NEGATIVE_X',
  34071: 'TEXTURE_CUBE_MAP_POSITIVE_Y',
  34072: 'TEXTURE_CUBE_MAP_NEGATIVE_Y',
  34073: 'TEXTURE_CUBE_MAP_POSITIVE_Z',
  34074: 'TEXTURE_CUBE_MAP_NEGATIVE_Z',
  34076: 'MAX_CUBE_MAP_TEXTURE_SIZE',
  34338: 'VERTEX_ATTRIB_ARRAY_ENABLED',
  34339: 'VERTEX_ATTRIB_ARRAY_SIZE',
  34340: 'VERTEX_ATTRIB_ARRAY_STRIDE',
  34341: 'VERTEX_ATTRIB_ARRAY_TYPE',
  34342: 'CURRENT_VERTEX_ATTRIB',
  34373: 'VERTEX_ATTRIB_ARRAY_POINTER',
  34466: 'NUM_COMPRESSED_TEXTURE_FORMATS',
  34467: 'COMPRESSED_TEXTURE_FORMATS',
  34660: 'BUFFER_SIZE',
  34661: 'BUFFER_USAGE',
  34816: 'STENCIL_BACK_FUNC',
  34817: 'STENCIL_BACK_FAIL',
  34818: 'STENCIL_BACK_PASS_DEPTH_FAIL',
  34819: 'STENCIL_BACK_PASS_DEPTH_PASS',
  34877: 'BLEND_EQUATION_ALPHA',
  34921: 'MAX_VERTEX_ATTRIBS',
  34922: 'VERTEX_ATTRIB_ARRAY_NORMALIZED',
  34930: 'MAX_TEXTURE_IMAGE_UNITS',
  34962: 'ARRAY_BUFFER',
  34963: 'ELEMENT_ARRAY_BUFFER',
  34964: 'ARRAY_BUFFER_BINDING',
  34965: 'ELEMENT_ARRAY_BUFFER_BINDING',
  34975: 'VERTEX_ATTRIB_ARRAY_BUFFER_BINDING',
  35040: 'STREAM_DRAW',
  35044: 'STATIC_DRAW',
  35048: 'DYNAMIC_DRAW',
  35632: 'FRAGMENT_SHADER',
  35633: 'VERTEX_SHADER',
  35660: 'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
  35661: 'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
  35663: 'SHADER_TYPE',
  35664: 'FLOAT_VEC2',
  35665: 'FLOAT_VEC3',
  35666: 'FLOAT_VEC4',
  35667: 'INT_VEC2',
  35668: 'INT_VEC3',
  35669: 'INT_VEC4',
  35670: 'BOOL',
  35671: 'BOOL_VEC2',
  35672: 'BOOL_VEC3',
  35673: 'BOOL_VEC4',
  35674: 'FLOAT_MAT2',
  35675: 'FLOAT_MAT3',
  35676: 'FLOAT_MAT4',
  35678: 'SAMPLER_2D',
  35680: 'SAMPLER_CUBE',
  35712: 'DELETE_STATUS',
  35713: 'COMPILE_STATUS',
  35714: 'LINK_STATUS',
  35715: 'VALIDATE_STATUS',
  35716: 'INFO_LOG_LENGTH',
  35717: 'ATTACHED_SHADERS',
  35718: 'ACTIVE_UNIFORMS',
  35719: 'ACTIVE_UNIFORM_MAX_LENGTH',
  35720: 'SHADER_SOURCE_LENGTH',
  35721: 'ACTIVE_ATTRIBUTES',
  35722: 'ACTIVE_ATTRIBUTE_MAX_LENGTH',
  35724: 'SHADING_LANGUAGE_VERSION',
  35725: 'CURRENT_PROGRAM',
  36003: 'STENCIL_BACK_REF',
  36004: 'STENCIL_BACK_VALUE_MASK',
  36005: 'STENCIL_BACK_WRITEMASK',
  36006: 'FRAMEBUFFER_BINDING',
  36007: 'RENDERBUFFER_BINDING',
  36048: 'FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE',
  36049: 'FRAMEBUFFER_ATTACHMENT_OBJECT_NAME',
  36050: 'FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL',
  36051: 'FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE',
  36053: 'FRAMEBUFFER_COMPLETE',
  36054: 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT',
  36055: 'FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT',
  36057: 'FRAMEBUFFER_INCOMPLETE_DIMENSIONS',
  36061: 'FRAMEBUFFER_UNSUPPORTED',
  36064: 'COLOR_ATTACHMENT0',
  36096: 'DEPTH_ATTACHMENT',
  36128: 'STENCIL_ATTACHMENT',
  36160: 'FRAMEBUFFER',
  36161: 'RENDERBUFFER',
  36162: 'RENDERBUFFER_WIDTH',
  36163: 'RENDERBUFFER_HEIGHT',
  36164: 'RENDERBUFFER_INTERNAL_FORMAT',
  36168: 'STENCIL_INDEX8',
  36176: 'RENDERBUFFER_RED_SIZE',
  36177: 'RENDERBUFFER_GREEN_SIZE',
  36178: 'RENDERBUFFER_BLUE_SIZE',
  36179: 'RENDERBUFFER_ALPHA_SIZE',
  36180: 'RENDERBUFFER_DEPTH_SIZE',
  36181: 'RENDERBUFFER_STENCIL_SIZE',
  36194: 'RGB565',
  36336: 'LOW_FLOAT',
  36337: 'MEDIUM_FLOAT',
  36338: 'HIGH_FLOAT',
  36339: 'LOW_INT',
  36340: 'MEDIUM_INT',
  36341: 'HIGH_INT',
  36346: 'SHADER_COMPILER',
  36347: 'MAX_VERTEX_UNIFORM_VECTORS',
  36348: 'MAX_VARYING_VECTORS',
  36349: 'MAX_FRAGMENT_UNIFORM_VECTORS',
  37440: 'UNPACK_FLIP_Y_WEBGL',
  37441: 'UNPACK_PREMULTIPLY_ALPHA_WEBGL',
  37442: 'CONTEXT_LOST_WEBGL',
  37443: 'UNPACK_COLORSPACE_CONVERSION_WEBGL',
  37444: 'BROWSER_DEFAULT_WEBGL'
}

},{}],83:[function(require,module,exports){
var gl10 = require('./1.0/numbers')

module.exports = function lookupConstant (number) {
  return gl10[number]
}

},{"./1.0/numbers":82}],84:[function(require,module,exports){
'use strict'

var createTexture = require('gl-texture2d')

module.exports = createFBO

var colorAttachmentArrays = null
var FRAMEBUFFER_UNSUPPORTED
var FRAMEBUFFER_INCOMPLETE_ATTACHMENT
var FRAMEBUFFER_INCOMPLETE_DIMENSIONS
var FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT

function saveFBOState(gl) {
  var fbo = gl.getParameter(gl.FRAMEBUFFER_BINDING)
  var rbo = gl.getParameter(gl.RENDERBUFFER_BINDING)
  var tex = gl.getParameter(gl.TEXTURE_BINDING_2D)
  return [fbo, rbo, tex]
}

function restoreFBOState(gl, data) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, data[0])
  gl.bindRenderbuffer(gl.RENDERBUFFER, data[1])
  gl.bindTexture(gl.TEXTURE_2D, data[2])
}

function lazyInitColorAttachments(gl, ext) {
  var maxColorAttachments = gl.getParameter(ext.MAX_COLOR_ATTACHMENTS_WEBGL)
  colorAttachmentArrays = new Array(maxColorAttachments + 1)
  for(var i=0; i<=maxColorAttachments; ++i) {
    var x = new Array(maxColorAttachments)
    for(var j=0; j<i; ++j) {
      x[j] = gl.COLOR_ATTACHMENT0 + j
    }
    for(var j=i; j<maxColorAttachments; ++j) {
      x[j] = gl.NONE
    }
    colorAttachmentArrays[i] = x
  }
}

//Throw an appropriate error
function throwFBOError(status) {
  switch(status){
    case FRAMEBUFFER_UNSUPPORTED:
      throw new Error('gl-fbo: Framebuffer unsupported')
    case FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
      throw new Error('gl-fbo: Framebuffer incomplete attachment')
    case FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
      throw new Error('gl-fbo: Framebuffer incomplete dimensions')
    case FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
      throw new Error('gl-fbo: Framebuffer incomplete missing attachment')
    default:
      throw new Error('gl-fbo: Framebuffer failed for unspecified reason')
  }
}

//Initialize a texture object
function initTexture(gl, width, height, type, format, attachment) {
  if(!type) {
    return null
  }
  var result = createTexture(gl, width, height, format, type)
  result.magFilter = gl.NEAREST
  result.minFilter = gl.NEAREST
  result.mipSamples = 1
  result.bind()
  gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, result.handle, 0)
  return result
}

//Initialize a render buffer object
function initRenderBuffer(gl, width, height, component, attachment) {
  var result = gl.createRenderbuffer()
  gl.bindRenderbuffer(gl.RENDERBUFFER, result)
  gl.renderbufferStorage(gl.RENDERBUFFER, component, width, height)
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachment, gl.RENDERBUFFER, result)
  return result
}

//Rebuild the frame buffer
function rebuildFBO(fbo) {

  //Save FBO state
  var state = saveFBOState(fbo.gl)

  var gl = fbo.gl
  var handle = fbo.handle = gl.createFramebuffer()
  var width = fbo._shape[0]
  var height = fbo._shape[1]
  var numColors = fbo.color.length
  var ext = fbo._ext
  var useStencil = fbo._useStencil
  var useDepth = fbo._useDepth
  var colorType = fbo._colorType

  //Bind the fbo
  gl.bindFramebuffer(gl.FRAMEBUFFER, handle)

  //Allocate color buffers
  for(var i=0; i<numColors; ++i) {
    fbo.color[i] = initTexture(gl, width, height, colorType, gl.RGBA, gl.COLOR_ATTACHMENT0 + i)
  }
  if(numColors === 0) {
    fbo._color_rb = initRenderBuffer(gl, width, height, gl.RGBA4, gl.COLOR_ATTACHMENT0)
    if(ext) {
      ext.drawBuffersWEBGL(colorAttachmentArrays[0])
    }
  } else if(numColors > 1) {
    ext.drawBuffersWEBGL(colorAttachmentArrays[numColors])
  }

  //Allocate depth/stencil buffers
  var WEBGL_depth_texture = gl.getExtension('WEBGL_depth_texture')
  if(WEBGL_depth_texture) {
    if(useStencil) {
      fbo.depth = initTexture(gl, width, height,
                          WEBGL_depth_texture.UNSIGNED_INT_24_8_WEBGL,
                          gl.DEPTH_STENCIL,
                          gl.DEPTH_STENCIL_ATTACHMENT)
    } else if(useDepth) {
      fbo.depth = initTexture(gl, width, height,
                          gl.UNSIGNED_SHORT,
                          gl.DEPTH_COMPONENT,
                          gl.DEPTH_ATTACHMENT)
    }
  } else {
    if(useDepth && useStencil) {
      fbo._depth_rb = initRenderBuffer(gl, width, height, gl.DEPTH_STENCIL, gl.DEPTH_STENCIL_ATTACHMENT)
    } else if(useDepth) {
      fbo._depth_rb = initRenderBuffer(gl, width, height, gl.DEPTH_COMPONENT16, gl.DEPTH_ATTACHMENT)
    } else if(useStencil) {
      fbo._depth_rb = initRenderBuffer(gl, width, height, gl.STENCIL_INDEX, gl.STENCIL_ATTACHMENT)
    }
  }

  //Check frame buffer state
  var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if(status !== gl.FRAMEBUFFER_COMPLETE) {

    //Release all partially allocated resources
    fbo._destroyed = true

    //Release all resources
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fbo.handle)
    fbo.handle = null
    if(fbo.depth) {
      fbo.depth.dispose()
      fbo.depth = null
    }
    if(fbo._depth_rb) {
      gl.deleteRenderbuffer(fbo._depth_rb)
      fbo._depth_rb = null
    }
    for(var i=0; i<fbo.color.length; ++i) {
      fbo.color[i].dispose()
      fbo.color[i] = null
    }
    if(fbo._color_rb) {
      gl.deleteRenderbuffer(fbo._color_rb)
      fbo._color_rb = null
    }

    restoreFBOState(gl, state)

    //Throw the frame buffer error
    throwFBOError(status)
  }

  //Everything ok, let's get on with life
  restoreFBOState(gl, state)
}

function Framebuffer(gl, width, height, colorType, numColors, useDepth, useStencil, ext) {

  //Handle and set properties
  this.gl = gl
  this._shape = [width|0, height|0]
  this._destroyed = false
  this._ext = ext

  //Allocate buffers
  this.color = new Array(numColors)
  for(var i=0; i<numColors; ++i) {
    this.color[i] = null
  }
  this._color_rb = null
  this.depth = null
  this._depth_rb = null

  //Save depth and stencil flags
  this._colorType = colorType
  this._useDepth = useDepth
  this._useStencil = useStencil

  //Shape vector for resizing
  var parent = this
  var shapeVector = [width|0, height|0]
  Object.defineProperties(shapeVector, {
    0: {
      get: function() {
        return parent._shape[0]
      },
      set: function(w) {
        return parent.width = w
      }
    },
    1: {
      get: function() {
        return parent._shape[1]
      },
      set: function(h) {
        return parent.height = h
      }
    }
  })
  this._shapeVector = shapeVector

  //Initialize all attachments
  rebuildFBO(this)
}

var proto = Framebuffer.prototype

function reshapeFBO(fbo, w, h) {
  //If fbo is invalid, just skip this
  if(fbo._destroyed) {
    throw new Error('gl-fbo: Can\'t resize destroyed FBO')
  }

  //Don't resize if no change in shape
  if( (fbo._shape[0] === w) &&
      (fbo._shape[1] === h) ) {
    return
  }

  var gl = fbo.gl

  //Check parameter ranges
  var maxFBOSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)
  if( w < 0 || w > maxFBOSize ||
      h < 0 || h > maxFBOSize) {
    throw new Error('gl-fbo: Can\'t resize FBO, invalid dimensions')
  }

  //Update shape
  fbo._shape[0] = w
  fbo._shape[1] = h

  //Save framebuffer state
  var state = saveFBOState(gl)

  //Resize framebuffer attachments
  for(var i=0; i<fbo.color.length; ++i) {
    fbo.color[i].shape = fbo._shape
  }
  if(fbo._color_rb) {
    gl.bindRenderbuffer(gl.RENDERBUFFER, fbo._color_rb)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, fbo._shape[0], fbo._shape[1])
  }
  if(fbo.depth) {
    fbo.depth.shape = fbo._shape
  }
  if(fbo._depth_rb) {
    gl.bindRenderbuffer(gl.RENDERBUFFER, fbo._depth_rb)
    if(fbo._useDepth && fbo._useStencil) {
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, fbo._shape[0], fbo._shape[1])
    } else if(fbo._useDepth) {
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, fbo._shape[0], fbo._shape[1])
    } else if(fbo._useStencil) {
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX, fbo._shape[0], fbo._shape[1])
    }
  }

  //Check FBO status after resize, if something broke then die in a fire
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.handle)
  var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if(status !== gl.FRAMEBUFFER_COMPLETE) {
    fbo.dispose()
    restoreFBOState(gl, state)
    throwFBOError(status)
  }

  //Restore framebuffer state
  restoreFBOState(gl, state)
}

Object.defineProperties(proto, {
  'shape': {
    get: function() {
      if(this._destroyed) {
        return [0,0]
      }
      return this._shapeVector
    },
    set: function(x) {
      if(!Array.isArray(x)) {
        x = [x|0, x|0]
      }
      if(x.length !== 2) {
        throw new Error('gl-fbo: Shape vector must be length 2')
      }

      var w = x[0]|0
      var h = x[1]|0
      reshapeFBO(this, w, h)

      return [w, h]
    },
    enumerable: false
  },
  'width': {
    get: function() {
      if(this._destroyed) {
        return 0
      }
      return this._shape[0]
    },
    set: function(w) {
      w = w|0
      reshapeFBO(this, w, this._shape[1])
      return w
    },
    enumerable: false
  },
  'height': {
    get: function() {
      if(this._destroyed) {
        return 0
      }
      return this._shape[1]
    },
    set: function(h) {
      h = h|0
      reshapeFBO(this, this._shape[0], h)
      return h
    },
    enumerable: false
  }
})

proto.bind = function() {
  if(this._destroyed) {
    return
  }
  var gl = this.gl
  gl.bindFramebuffer(gl.FRAMEBUFFER, this.handle)
  gl.viewport(0, 0, this._shape[0], this._shape[1])
}

proto.dispose = function() {
  if(this._destroyed) {
    return
  }
  this._destroyed = true
  var gl = this.gl
  gl.deleteFramebuffer(this.handle)
  this.handle = null
  if(this.depth) {
    this.depth.dispose()
    this.depth = null
  }
  if(this._depth_rb) {
    gl.deleteRenderbuffer(this._depth_rb)
    this._depth_rb = null
  }
  for(var i=0; i<this.color.length; ++i) {
    this.color[i].dispose()
    this.color[i] = null
  }
  if(this._color_rb) {
    gl.deleteRenderbuffer(this._color_rb)
    this._color_rb = null
  }
}

function createFBO(gl, width, height, options) {

  //Update frame buffer error code values
  if(!FRAMEBUFFER_UNSUPPORTED) {
    FRAMEBUFFER_UNSUPPORTED = gl.FRAMEBUFFER_UNSUPPORTED
    FRAMEBUFFER_INCOMPLETE_ATTACHMENT = gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT
    FRAMEBUFFER_INCOMPLETE_DIMENSIONS = gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS
    FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT = gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT
  }

  //Lazily initialize color attachment arrays
  var WEBGL_draw_buffers = gl.getExtension('WEBGL_draw_buffers')
  if(!colorAttachmentArrays && WEBGL_draw_buffers) {
    lazyInitColorAttachments(gl, WEBGL_draw_buffers)
  }

  //Special case: Can accept an array as argument
  if(Array.isArray(width)) {
    options = height
    height = width[1]|0
    width = width[0]|0
  }

  if(typeof width !== 'number') {
    throw new Error('gl-fbo: Missing shape parameter')
  }

  //Validate width/height properties
  var maxFBOSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)
  if(width < 0 || width > maxFBOSize || height < 0 || height > maxFBOSize) {
    throw new Error('gl-fbo: Parameters are too large for FBO')
  }

  //Handle each option type
  options = options || {}

  //Figure out number of color buffers to use
  var numColors = 1
  if('color' in options) {
    numColors = Math.max(options.color|0, 0)
    if(numColors < 0) {
      throw new Error('gl-fbo: Must specify a nonnegative number of colors')
    }
    if(numColors > 1) {
      //Check if multiple render targets supported
      if(!WEBGL_draw_buffers) {
        throw new Error('gl-fbo: Multiple draw buffer extension not supported')
      } else if(numColors > gl.getParameter(WEBGL_draw_buffers.MAX_COLOR_ATTACHMENTS_WEBGL)) {
        throw new Error('gl-fbo: Context does not support ' + numColors + ' draw buffers')
      }
    }
  }

  //Determine whether to use floating point textures
  var colorType = gl.UNSIGNED_BYTE
  var OES_texture_float = gl.getExtension('OES_texture_float')
  if(options.float && numColors > 0) {
    if(!OES_texture_float) {
      throw new Error('gl-fbo: Context does not support floating point textures')
    }
    colorType = gl.FLOAT
  } else if(options.preferFloat && numColors > 0) {
    if(OES_texture_float) {
      colorType = gl.FLOAT
    }
  }

  //Check if we should use depth buffer
  var useDepth = true
  if('depth' in options) {
    useDepth = !!options.depth
  }

  //Check if we should use a stencil buffer
  var useStencil = false
  if('stencil' in options) {
    useStencil = !!options.stencil
  }

  return new Framebuffer(
    gl,
    width,
    height,
    colorType,
    numColors,
    useDepth,
    useStencil,
    WEBGL_draw_buffers)
}

},{"gl-texture2d":124}],85:[function(require,module,exports){

var sprintf = require('sprintf-js').sprintf;
var glConstants = require('gl-constants/lookup');
var shaderName = require('glsl-shader-name');
var addLineNumbers = require('add-line-numbers');

module.exports = formatCompilerError;

function formatCompilerError(errLog, src, type) {
    "use strict";

    var name = shaderName(src) || 'of unknown name (see npm glsl-shader-name)';

    var typeName = 'unknown type';
    if (type !== undefined) {
        typeName = type === glConstants.FRAGMENT_SHADER ? 'fragment' : 'vertex'
    }

    var longForm = sprintf('Error compiling %s shader %s:\n', typeName, name);
    var shortForm = sprintf("%s%s", longForm, errLog);

    var errorStrings = errLog.split('\n');
    var errors = {};

    for (var i = 0; i < errorStrings.length; i++) {
        var errorString = errorStrings[i];
        if (errorString === '' || errorString === "\0") continue;
        var lineNo = parseInt(errorString.split(':')[2]);
        if (isNaN(lineNo)) {
            throw new Error(sprintf('Could not parse error: %s', errorString));
        }
        errors[lineNo] = errorString;
    }

    var lines = addLineNumbers(src).split('\n');

    for (var i = 0; i < lines.length; i++) {
        if (!errors[i+3] && !errors[i+2] && !errors[i+1]) continue;
        var line = lines[i];
        longForm += line + '\n';
        if (errors[i+1]) {
            var e = errors[i+1];
            e = e.substr(e.split(':', 3).join(':').length + 1).trim();
            longForm += sprintf('^^^ %s\n\n', e);
        }
    }

    return {
        long: longForm.trim(),
        short: shortForm.trim()
    };
}


},{"add-line-numbers":14,"gl-constants/lookup":83,"glsl-shader-name":134,"sprintf-js":205}],86:[function(require,module,exports){
module.exports = adjoint;

/**
 * Calculates the adjugate of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
function adjoint(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    out[0]  =  (a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22));
    out[1]  = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
    out[2]  =  (a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12));
    out[3]  = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
    out[4]  = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
    out[5]  =  (a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22));
    out[6]  = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
    out[7]  =  (a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12));
    out[8]  =  (a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21));
    out[9]  = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
    out[10] =  (a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11));
    out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
    out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
    out[13] =  (a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21));
    out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
    out[15] =  (a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11));
    return out;
};
},{}],87:[function(require,module,exports){
module.exports = clone;

/**
 * Creates a new mat4 initialized with values from an existing matrix
 *
 * @param {mat4} a matrix to clone
 * @returns {mat4} a new 4x4 matrix
 */
function clone(a) {
    var out = new Float32Array(16);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};
},{}],88:[function(require,module,exports){
module.exports = copy;

/**
 * Copy the values from one mat4 to another
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
function copy(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};
},{}],89:[function(require,module,exports){
module.exports = create;

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */
function create() {
    var out = new Float32Array(16);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
};
},{}],90:[function(require,module,exports){
module.exports = determinant;

/**
 * Calculates the determinant of a mat4
 *
 * @param {mat4} a the source matrix
 * @returns {Number} determinant of a
 */
function determinant(a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32;

    // Calculate the determinant
    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
};
},{}],91:[function(require,module,exports){
module.exports = fromQuat;

/**
 * Creates a matrix from a quaternion rotation.
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @returns {mat4} out
 */
function fromQuat(out, q) {
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        yx = y * x2,
        yy = y * y2,
        zx = z * x2,
        zy = z * y2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - yy - zz;
    out[1] = yx + wz;
    out[2] = zx - wy;
    out[3] = 0;

    out[4] = yx - wz;
    out[5] = 1 - xx - zz;
    out[6] = zy + wx;
    out[7] = 0;

    out[8] = zx + wy;
    out[9] = zy - wx;
    out[10] = 1 - xx - yy;
    out[11] = 0;

    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;

    return out;
};
},{}],92:[function(require,module,exports){
module.exports = fromRotationTranslation;

/**
 * Creates a matrix from a quaternion rotation and vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     var quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {vec3} v Translation vector
 * @returns {mat4} out
 */
function fromRotationTranslation(out, q, v) {
    // Quaternion math
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;
    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;
    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    
    return out;
};
},{}],93:[function(require,module,exports){
module.exports = frustum;

/**
 * Generates a frustum matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {Number} left Left bound of the frustum
 * @param {Number} right Right bound of the frustum
 * @param {Number} bottom Bottom bound of the frustum
 * @param {Number} top Top bound of the frustum
 * @param {Number} near Near bound of the frustum
 * @param {Number} far Far bound of the frustum
 * @returns {mat4} out
 */
function frustum(out, left, right, bottom, top, near, far) {
    var rl = 1 / (right - left),
        tb = 1 / (top - bottom),
        nf = 1 / (near - far);
    out[0] = (near * 2) * rl;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = (near * 2) * tb;
    out[6] = 0;
    out[7] = 0;
    out[8] = (right + left) * rl;
    out[9] = (top + bottom) * tb;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (far * near * 2) * nf;
    out[15] = 0;
    return out;
};
},{}],94:[function(require,module,exports){
module.exports = identity;

/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */
function identity(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
};
},{}],95:[function(require,module,exports){
module.exports = {
  create: require('./create')
  , clone: require('./clone')
  , copy: require('./copy')
  , identity: require('./identity')
  , transpose: require('./transpose')
  , invert: require('./invert')
  , adjoint: require('./adjoint')
  , determinant: require('./determinant')
  , multiply: require('./multiply')
  , translate: require('./translate')
  , scale: require('./scale')
  , rotate: require('./rotate')
  , rotateX: require('./rotateX')
  , rotateY: require('./rotateY')
  , rotateZ: require('./rotateZ')
  , fromRotationTranslation: require('./fromRotationTranslation')
  , fromQuat: require('./fromQuat')
  , frustum: require('./frustum')
  , perspective: require('./perspective')
  , perspectiveFromFieldOfView: require('./perspectiveFromFieldOfView')
  , ortho: require('./ortho')
  , lookAt: require('./lookAt')
  , str: require('./str')
}
},{"./adjoint":86,"./clone":87,"./copy":88,"./create":89,"./determinant":90,"./fromQuat":91,"./fromRotationTranslation":92,"./frustum":93,"./identity":94,"./invert":96,"./lookAt":97,"./multiply":98,"./ortho":99,"./perspective":100,"./perspectiveFromFieldOfView":101,"./rotate":102,"./rotateX":103,"./rotateY":104,"./rotateZ":105,"./scale":106,"./str":107,"./translate":108,"./transpose":109}],96:[function(require,module,exports){
module.exports = invert;

/**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
function invert(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
};
},{}],97:[function(require,module,exports){
var identity = require('./identity');

module.exports = lookAt;

/**
 * Generates a look-at matrix with the given eye position, focal point, and up axis
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {vec3} eye Position of the viewer
 * @param {vec3} center Point the viewer is looking at
 * @param {vec3} up vec3 pointing up
 * @returns {mat4} out
 */
function lookAt(out, eye, center, up) {
    var x0, x1, x2, y0, y1, y2, z0, z1, z2, len,
        eyex = eye[0],
        eyey = eye[1],
        eyez = eye[2],
        upx = up[0],
        upy = up[1],
        upz = up[2],
        centerx = center[0],
        centery = center[1],
        centerz = center[2];

    if (Math.abs(eyex - centerx) < 0.000001 &&
        Math.abs(eyey - centery) < 0.000001 &&
        Math.abs(eyez - centerz) < 0.000001) {
        return identity(out);
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;

    len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;

    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    } else {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;

    len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len) {
        y0 = 0;
        y1 = 0;
        y2 = 0;
    } else {
        len = 1 / len;
        y0 *= len;
        y1 *= len;
        y2 *= len;
    }

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;

    return out;
};
},{"./identity":94}],98:[function(require,module,exports){
module.exports = multiply;

/**
 * Multiplies two mat4's
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the first operand
 * @param {mat4} b the second operand
 * @returns {mat4} out
 */
function multiply(out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    // Cache only the current line of the second matrix
    var b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];  
    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return out;
};
},{}],99:[function(require,module,exports){
module.exports = ortho;

/**
 * Generates a orthogonal projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} left Left bound of the frustum
 * @param {number} right Right bound of the frustum
 * @param {number} bottom Bottom bound of the frustum
 * @param {number} top Top bound of the frustum
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
function ortho(out, left, right, bottom, top, near, far) {
    var lr = 1 / (left - right),
        bt = 1 / (bottom - top),
        nf = 1 / (near - far);
    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
};
},{}],100:[function(require,module,exports){
module.exports = perspective;

/**
 * Generates a perspective projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
function perspective(out, fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy / 2),
        nf = 1 / (near - far);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) * nf;
    out[15] = 0;
    return out;
};
},{}],101:[function(require,module,exports){
module.exports = perspectiveFromFieldOfView;

/**
 * Generates a perspective projection matrix with the given field of view.
 * This is primarily useful for generating projection matrices to be used
 * with the still experiemental WebVR API.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fov Object containing the following values: upDegrees, downDegrees, leftDegrees, rightDegrees
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
function perspectiveFromFieldOfView(out, fov, near, far) {
    var upTan = Math.tan(fov.upDegrees * Math.PI/180.0),
        downTan = Math.tan(fov.downDegrees * Math.PI/180.0),
        leftTan = Math.tan(fov.leftDegrees * Math.PI/180.0),
        rightTan = Math.tan(fov.rightDegrees * Math.PI/180.0),
        xScale = 2.0 / (leftTan + rightTan),
        yScale = 2.0 / (upTan + downTan);

    out[0] = xScale;
    out[1] = 0.0;
    out[2] = 0.0;
    out[3] = 0.0;
    out[4] = 0.0;
    out[5] = yScale;
    out[6] = 0.0;
    out[7] = 0.0;
    out[8] = -((leftTan - rightTan) * xScale * 0.5);
    out[9] = ((upTan - downTan) * yScale * 0.5);
    out[10] = far / (near - far);
    out[11] = -1.0;
    out[12] = 0.0;
    out[13] = 0.0;
    out[14] = (far * near) / (near - far);
    out[15] = 0.0;
    return out;
}


},{}],102:[function(require,module,exports){
module.exports = rotate;

/**
 * Rotates a mat4 by the given angle
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {vec3} axis the axis to rotate around
 * @returns {mat4} out
 */
function rotate(out, a, rad, axis) {
    var x = axis[0], y = axis[1], z = axis[2],
        len = Math.sqrt(x * x + y * y + z * z),
        s, c, t,
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23,
        b00, b01, b02,
        b10, b11, b12,
        b20, b21, b22;

    if (Math.abs(len) < 0.000001) { return null; }
    
    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;

    s = Math.sin(rad);
    c = Math.cos(rad);
    t = 1 - c;

    a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
    a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
    a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

    // Construct the elements of the rotation matrix
    b00 = x * x * t + c; b01 = y * x * t + z * s; b02 = z * x * t - y * s;
    b10 = x * y * t - z * s; b11 = y * y * t + c; b12 = z * y * t + x * s;
    b20 = x * z * t + y * s; b21 = y * z * t - x * s; b22 = z * z * t + c;

    // Perform rotation-specific matrix multiplication
    out[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02;
    out[4] = a00 * b10 + a10 * b11 + a20 * b12;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12;
    out[8] = a00 * b20 + a10 * b21 + a20 * b22;
    out[9] = a01 * b20 + a11 * b21 + a21 * b22;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22;

    if (a !== out) { // If the source and destination differ, copy the unchanged last row
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }
    return out;
};
},{}],103:[function(require,module,exports){
module.exports = rotateX;

/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
function rotateX(out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    if (a !== out) { // If the source and destination differ, copy the unchanged rows
        out[0]  = a[0];
        out[1]  = a[1];
        out[2]  = a[2];
        out[3]  = a[3];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
};
},{}],104:[function(require,module,exports){
module.exports = rotateY;

/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
function rotateY(out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    if (a !== out) { // If the source and destination differ, copy the unchanged rows
        out[4]  = a[4];
        out[5]  = a[5];
        out[6]  = a[6];
        out[7]  = a[7];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
};
},{}],105:[function(require,module,exports){
module.exports = rotateZ;

/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
function rotateZ(out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];

    if (a !== out) { // If the source and destination differ, copy the unchanged last row
        out[8]  = a[8];
        out[9]  = a[9];
        out[10] = a[10];
        out[11] = a[11];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
    return out;
};
},{}],106:[function(require,module,exports){
module.exports = scale;

/**
 * Scales the mat4 by the dimensions in the given vec3
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to scale
 * @param {vec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/
function scale(out, a, v) {
    var x = v[0], y = v[1], z = v[2];

    out[0] = a[0] * x;
    out[1] = a[1] * x;
    out[2] = a[2] * x;
    out[3] = a[3] * x;
    out[4] = a[4] * y;
    out[5] = a[5] * y;
    out[6] = a[6] * y;
    out[7] = a[7] * y;
    out[8] = a[8] * z;
    out[9] = a[9] * z;
    out[10] = a[10] * z;
    out[11] = a[11] * z;
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};
},{}],107:[function(require,module,exports){
module.exports = str;

/**
 * Returns a string representation of a mat4
 *
 * @param {mat4} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
function str(a) {
    return 'mat4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' +
                    a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' +
                    a[8] + ', ' + a[9] + ', ' + a[10] + ', ' + a[11] + ', ' + 
                    a[12] + ', ' + a[13] + ', ' + a[14] + ', ' + a[15] + ')';
};
},{}],108:[function(require,module,exports){
module.exports = translate;

/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to translate
 * @param {vec3} v vector to translate by
 * @returns {mat4} out
 */
function translate(out, a, v) {
    var x = v[0], y = v[1], z = v[2],
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23;

    if (a === out) {
        out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
        out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
        out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
        out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    } else {
        a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
        a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
        a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

        out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
        out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
        out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;

        out[12] = a00 * x + a10 * y + a20 * z + a[12];
        out[13] = a01 * x + a11 * y + a21 * z + a[13];
        out[14] = a02 * x + a12 * y + a22 * z + a[14];
        out[15] = a03 * x + a13 * y + a23 * z + a[15];
    }

    return out;
};
},{}],109:[function(require,module,exports){
module.exports = transpose;

/**
 * Transpose the values of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
function transpose(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a01 = a[1], a02 = a[2], a03 = a[3],
            a12 = a[6], a13 = a[7],
            a23 = a[11];

        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a01;
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a02;
        out[9] = a12;
        out[11] = a[14];
        out[12] = a03;
        out[13] = a13;
        out[14] = a23;
    } else {
        out[0] = a[0];
        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a[1];
        out[5] = a[5];
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a[2];
        out[9] = a[6];
        out[10] = a[10];
        out[11] = a[14];
        out[12] = a[3];
        out[13] = a[7];
        out[14] = a[11];
        out[15] = a[15];
    }
    
    return out;
};
},{}],110:[function(require,module,exports){
module.exports = slerp

/**
 * Performs a spherical linear interpolation between two quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 */
function slerp (out, a, b, t) {
  // benchmarks:
  //    http://jsperf.com/quaternion-slerp-implementations

  var ax = a[0], ay = a[1], az = a[2], aw = a[3],
    bx = b[0], by = b[1], bz = b[2], bw = b[3]

  var omega, cosom, sinom, scale0, scale1

  // calc cosine
  cosom = ax * bx + ay * by + az * bz + aw * bw
  // adjust signs (if necessary)
  if (cosom < 0.0) {
    cosom = -cosom
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
  }
  // calculate coefficients
  if ((1.0 - cosom) > 0.000001) {
    // standard case (slerp)
    omega = Math.acos(cosom)
    sinom = Math.sin(omega)
    scale0 = Math.sin((1.0 - t) * omega) / sinom
    scale1 = Math.sin(t * omega) / sinom
  } else {
    // "from" and "to" quaternions are very close
    //  ... so we can do a linear interpolation
    scale0 = 1.0 - t
    scale1 = t
  }
  // calculate final values
  out[0] = scale0 * ax + scale1 * bx
  out[1] = scale0 * ay + scale1 * by
  out[2] = scale0 * az + scale1 * bz
  out[3] = scale0 * aw + scale1 * bw

  return out
}

},{}],111:[function(require,module,exports){
"use strict"

var vectorizeText = require("vectorize-text")

module.exports = getGlyph

var GLYPH_CACHE = {}

function getGlyph(symbol, font) {
  var fontCache = GLYPH_CACHE[font]
  if(!fontCache) {
    fontCache = GLYPH_CACHE[font] = {}
  }
  if(symbol in fontCache) {
    return fontCache[symbol]
  }

  //Get line and triangle meshes for glyph
  var lineSymbol = vectorizeText(symbol, {
      textAlign: "center",
      textBaseline: "middle",
      lineHeight: 1.0,
      font: font
    }) 
  var triSymbol = vectorizeText(symbol, {
      triangles: true,
      textAlign: "center",
      textBaseline: "middle",
      lineHeight: 1.0,
      font: font
    })

  //Calculate bounding box
  var bounds = [[Infinity,Infinity], [-Infinity,-Infinity]]
  for(var i=0; i<lineSymbol.positions.length; ++i) {
    var p = lineSymbol.positions[i]
    for(var j=0; j<2; ++j) {
      bounds[0][j] = Math.min(bounds[0][j], p[j])
      bounds[1][j] = Math.max(bounds[1][j], p[j])
    }
  }

  //Save cached symbol
  return fontCache[symbol] = [triSymbol, lineSymbol, bounds]
}
},{"vectorize-text":215}],112:[function(require,module,exports){
var createShaderWrapper = require('gl-shader')


var perspectiveVertSrc = "precision mediump float;\n#define GLSLIFY 1\n\nattribute vec3 position;\nattribute vec4 color;\nattribute vec2 glyph;\nattribute vec4 id;\n\n\nuniform vec4 highlightId;\nuniform float highlightScale;\nuniform mat4 model, view, projection;\nuniform vec3 clipBounds[2];\n\nvarying vec4 interpColor;\nvarying vec4 pickId;\nvarying vec3 dataCoordinate;\n\nvoid main() {\n  if(any(lessThan(position, clipBounds[0]))   || \n     any(greaterThan(position, clipBounds[1])) ) {\n    gl_Position = vec4(0,0,0,0);\n  } else {\n    float scale = 1.0;\n    if(distance(highlightId, id) < 0.0001) {\n      scale = highlightScale;\n    }\n\n    vec4 worldPosition = model * vec4(position, 1);\n    vec4 viewPosition = view * worldPosition;\n    viewPosition = viewPosition / viewPosition.w;\n    vec4 clipPosition = projection * (viewPosition + scale * vec4(glyph.x, -glyph.y, 0, 0));\n    \n    gl_Position = clipPosition;\n    interpColor = color;\n    pickId = id;\n    dataCoordinate = position;\n  }\n}"
var orthographicVertSrc = "precision mediump float;\n#define GLSLIFY 1\n\nattribute vec3 position;\nattribute vec4 color;\nattribute vec2 glyph;\nattribute vec4 id;\n\nuniform mat4 model, view, projection;\nuniform vec2 screenSize;\nuniform vec3 clipBounds[2];\nuniform float highlightScale, pixelRatio;\nuniform vec4 highlightId;\n\nvarying vec4 interpColor;\nvarying vec4 pickId;\nvarying vec3 dataCoordinate;\n\nvoid main() {\n  if(any(lessThan(position, clipBounds[0])) || any(greaterThan(position, clipBounds[1]))) {\n    gl_Position = vec4(0,0,0,0);\n  } else {\n    float scale = pixelRatio;\n    if(distance(highlightId.bgr, id.bgr) < 0.001) {\n      scale *= highlightScale;\n    }\n\n    vec4 worldPosition = model * vec4(position, 1.0);\n    vec4 viewPosition = view * worldPosition;\n    vec4 clipPosition = projection * viewPosition;\n    clipPosition /= clipPosition.w;\n    \n    gl_Position = clipPosition + vec4(screenSize * scale * vec2(glyph.x, -glyph.y), 0.0, 0.0);\n    interpColor = color;\n    pickId = id;\n    dataCoordinate = position;\n  }\n}"
var projectionVertSrc = "precision mediump float;\n#define GLSLIFY 1\n\nattribute vec3 position;\nattribute vec4 color;\nattribute vec2 glyph;\nattribute vec4 id;\n\nuniform float highlightScale;\nuniform vec4 highlightId;\nuniform vec3 axes[2];\nuniform mat4 model, view, projection;\nuniform vec2 screenSize;\nuniform vec3 clipBounds[2];\nuniform float scale, pixelRatio;\n\nvarying vec4 interpColor;\nvarying vec4 pickId;\nvarying vec3 dataCoordinate;\n\nvoid main() {\n  if(any(lessThan(position, clipBounds[0]))   ||\n     any(greaterThan(position, clipBounds[1])) ) {\n    gl_Position = vec4(0,0,0,0);\n  } else {\n    float lscale = pixelRatio * scale;\n    if(distance(highlightId, id) < 0.0001) {\n      lscale *= highlightScale;\n    }\n\n    vec4 clipCenter   = projection * view * model * vec4(position, 1);\n    vec3 dataPosition = position + 0.5*lscale*(axes[0] * glyph.x + axes[1] * glyph.y) * clipCenter.w * screenSize.y;\n    vec4 clipPosition = projection * view * model * vec4(dataPosition, 1);\n\n    gl_Position = clipPosition;\n    interpColor = color;\n    pickId = id;\n    dataCoordinate = dataPosition;\n  }\n}\n"
var drawFragSrc = "precision mediump float;\n#define GLSLIFY 1\n\nuniform vec3 fragClipBounds[2];\nuniform float opacity;\n\nvarying vec4 interpColor;\nvarying vec4 pickId;\nvarying vec3 dataCoordinate;\n\nvoid main() {\n  if(any(lessThan(dataCoordinate, fragClipBounds[0]))   ||\n     any(greaterThan(dataCoordinate, fragClipBounds[1])) ) {\n    discard;\n  } else {\n    gl_FragColor = interpColor * opacity;\n  }\n}\n"
var pickFragSrc = "precision mediump float;\n#define GLSLIFY 1\n\nuniform vec3 fragClipBounds[2];\nuniform float pickGroup;\n\nvarying vec4 pickId;\nvarying vec3 dataCoordinate;\n\nvoid main() {\n  if(any(lessThan(dataCoordinate, fragClipBounds[0]))   || \n     any(greaterThan(dataCoordinate, fragClipBounds[1])) ) {\n    discard;\n  } else {\n    gl_FragColor = vec4(pickGroup, pickId.bgr);\n  }\n}"

var ATTRIBUTES = [
  {name: 'position', type: 'vec3'},
  {name: 'color', type: 'vec4'},
  {name: 'glyph', type: 'vec2'},
  {name: 'id', type: 'vec4'}
]

var perspective = {
    vertex: perspectiveVertSrc,
    fragment: drawFragSrc,
    attributes: ATTRIBUTES
  },
  ortho = {
    vertex: orthographicVertSrc,
    fragment: drawFragSrc,
    attributes: ATTRIBUTES
  },
  project = {
    vertex: projectionVertSrc,
    fragment: drawFragSrc,
    attributes: ATTRIBUTES
  },
  pickPerspective = {
    vertex: perspectiveVertSrc,
    fragment: pickFragSrc,
    attributes: ATTRIBUTES
  },
  pickOrtho = {
    vertex: orthographicVertSrc,
    fragment: pickFragSrc,
    attributes: ATTRIBUTES
  },
  pickProject = {
    vertex: projectionVertSrc,
    fragment: pickFragSrc,
    attributes: ATTRIBUTES
  }

function createShader(gl, src) {
  var shader = createShaderWrapper(gl, src)
  var attr = shader.attributes
  attr.position.location = 0
  attr.color.location = 1
  attr.glyph.location = 2
  attr.id.location = 3
  return shader
}

exports.createPerspective = function(gl) {
  return createShader(gl, perspective)
}
exports.createOrtho = function(gl) {
  return createShader(gl, ortho)
}
exports.createProject = function(gl) {
  return createShader(gl, project)
}
exports.createPickPerspective = function(gl) {
  return createShader(gl, pickPerspective)
}
exports.createPickOrtho = function(gl) {
  return createShader(gl, pickOrtho)
}
exports.createPickProject = function(gl) {
  return createShader(gl, pickProject)
}

},{"gl-shader":115}],113:[function(require,module,exports){
'use strict'

var createBuffer  = require('gl-buffer')
var createVAO     = require('gl-vao')
var pool          = require('typedarray-pool')
var mat4mult      = require('gl-mat4/multiply')
var shaders       = require('./lib/shaders')
var getGlyph      = require('./lib/glyphs')

var IDENTITY = [1,0,0,0,
                0,1,0,0,
                0,0,1,0,
                0,0,0,1]

module.exports = createPointCloud

function transformMat4(x, m) {
  var x0 = x[0]
  var x1 = x[1]
  var x2 = x[2]
  var x3 = x[3]
  x[0] = m[0] * x0 + m[4] * x1 + m[8]  * x2 + m[12] * x3
  x[1] = m[1] * x0 + m[5] * x1 + m[9]  * x2 + m[13] * x3
  x[2] = m[2] * x0 + m[6] * x1 + m[10] * x2 + m[14] * x3
  x[3] = m[3] * x0 + m[7] * x1 + m[11] * x2 + m[15] * x3
  return x
}

function project(p, v, m, x) {
  transformMat4(x, x, m)
  transformMat4(x, x, v)
  return transformMat4(x, x, p)
}

function clampVec(v) {
  var result = new Array(3)
  for(var i=0; i<3; ++i) {
    result[i] = Math.min(Math.max(v[i], -1e8), 1e8)
  }
  return result
}

function ScatterPlotPickResult(index, position) {
  this.index = index
  this.dataCoordinate = this.position = position
}

function PointCloud(
  gl,
  shader,
  orthoShader,
  projectShader,
  pointBuffer,
  colorBuffer,
  glyphBuffer,
  idBuffer,
  vao,
  pickPerspectiveShader,
  pickOrthoShader,
  pickProjectShader) {

  this.gl              = gl

  this.pixelRatio      = 1

  this.shader          = shader
  this.orthoShader     = orthoShader
  this.projectShader   = projectShader

  this.pointBuffer     = pointBuffer
  this.colorBuffer     = colorBuffer
  this.glyphBuffer     = glyphBuffer
  this.idBuffer        = idBuffer
  this.vao             = vao
  this.vertexCount     = 0
  this.lineVertexCount = 0

  this.opacity         = 1.0

  this.lineWidth       = 0
  this.projectScale    = [2.0/3.0, 2.0/3.0, 2.0/3.0]
  this.projectOpacity  = [1,1,1]

  this.pickId                = 0
  this.pickPerspectiveShader = pickPerspectiveShader
  this.pickOrthoShader       = pickOrthoShader
  this.pickProjectShader     = pickProjectShader
  this.points                = []

  this._selectResult = new ScatterPlotPickResult(0, [0,0,0])

  this.useOrtho = true
  this.bounds   = [[ Infinity,Infinity,Infinity],
                   [-Infinity,-Infinity,-Infinity]]

  //Axes projections
  this.axesProject = [ true, true, true ]
  this.axesBounds = [[-Infinity,-Infinity,-Infinity],
                     [ Infinity, Infinity, Infinity]]

  this.highlightId    = [1,1,1,1]
  this.highlightScale = 2

  this.clipBounds = [[-Infinity,-Infinity,-Infinity],
                     [ Infinity, Infinity, Infinity]]

  this.dirty = true
}

var proto = PointCloud.prototype

proto.pickSlots = 1

proto.setPickBase = function(pickBase) {
  this.pickId = pickBase
}

proto.isTransparent = function() {
  if(this.opacity < 1)  {
    return true
  }
  for(var i=0; i<3; ++i) {
    if(this.axesProject[i] && this.projectOpacity[i] < 1) {
      return true
    }
  }
  return false
}

proto.isOpaque = function() {
  if(this.opacity >= 1)  {
    return true
  }
  for(var i=0; i<3; ++i) {
    if(this.axesProject[i] && this.projectOpacity[i] >= 1) {
      return true
    }
  }
  return false
}

var VIEW_SHAPE = [0,0]
var U_VEC = [0,0,0]
var V_VEC = [0,0,0]
var MU_VEC = [0,0,0,1]
var MV_VEC = [0,0,0,1]
var SCRATCH_MATRIX = IDENTITY.slice()
var SCRATCH_VEC = [0,0,0]
var CLIP_BOUNDS = [[0,0,0], [0,0,0]]

function zeroVec(a) {
  a[0] = a[1] = a[2] = 0
  return a
}

function augment(hg, af) {
  hg[0] = af[0]
  hg[1] = af[1]
  hg[2] = af[2]
  hg[3] = 1
  return hg
}

function setComponent(out, v, i, x) {
  out[0] = v[0]
  out[1] = v[1]
  out[2] = v[2]
  out[i] = x
  return out
}

function getClipBounds(bounds) {
  var result = CLIP_BOUNDS
  for(var i=0; i<2; ++i) {
    for(var j=0; j<3; ++j) {
      result[i][j] = Math.max(Math.min(bounds[i][j], 1e8), -1e8)
    }
  }
  return result
}

function drawProject(shader, points, camera, transparent, forceDraw) {
  var axesProject = points.axesProject

  var gl         = points.gl
  var uniforms   = shader.uniforms
  var model      = camera.model      || IDENTITY
  var view       = camera.view       || IDENTITY
  var projection = camera.projection || IDENTITY
  var bounds     = points.axesBounds
  var clipBounds = getClipBounds(points.clipBounds)

  var cubeAxis
  if(points.axes) {
    cubeAxis = points.axes.lastCubeProps.axis
  } else {
    cubeAxis = [1,1,1]
  }

  VIEW_SHAPE[0] = 2.0/gl.drawingBufferWidth
  VIEW_SHAPE[1] = 2.0/gl.drawingBufferHeight

  shader.bind()
  uniforms.view           = view
  uniforms.projection     = projection
  uniforms.screenSize     = VIEW_SHAPE
  uniforms.highlightId    = points.highlightId
  uniforms.highlightScale = points.highlightScale
  uniforms.clipBounds     = clipBounds
  uniforms.pickGroup      = points.pickId / 255.0
  uniforms.pixelRatio     = points.pixelRatio

  for(var i=0; i<3; ++i) {
    if(!axesProject[i]) {
      continue
    }
    if((points.projectOpacity[i] < 1) !== transparent) {
      continue
    }

    uniforms.scale          = points.projectScale[i]
    uniforms.opacity        = points.projectOpacity[i]

    //Project model matrix
    var pmodel = SCRATCH_MATRIX
    for(var j=0; j<16; ++j) {
      pmodel[j] = 0
    }
    for(var j=0; j<4; ++j) {
      pmodel[5*j] = 1
    }
    pmodel[5*i] = 0
    if(cubeAxis[i] < 0) {
      pmodel[12+i] = bounds[0][i]
    } else {
      pmodel[12+i] = bounds[1][i]
    }
    mat4mult(pmodel, model, pmodel)
    uniforms.model = pmodel

    //Compute initial axes
    var u = (i+1)%3
    var v = (i+2)%3
    var du = zeroVec(U_VEC)
    var dv = zeroVec(V_VEC)
    du[u] = 1
    dv[v] = 1

    //Align orientation relative to viewer
    var mdu = project(projection, view, model, augment(MU_VEC, du))
    var mdv = project(projection, view, model, augment(MV_VEC, dv))
    if(Math.abs(mdu[1]) > Math.abs(mdv[1])) {
      var tmp = mdu
      mdu = mdv
      mdv = tmp
      tmp = du
      du = dv
      dv = tmp
      var t = u
      u = v
      v = t
    }
    if(mdu[0] < 0) {
      du[u] = -1
    }
    if(mdv[1] > 0) {
      dv[v] = -1
    }
    var su = 0.0
    var sv = 0.0
    for(var j=0; j<4; ++j) {
      su += Math.pow(model[4*u+j], 2)
      sv += Math.pow(model[4*v+j], 2)
    }
    du[u] /= Math.sqrt(su)
    dv[v] /= Math.sqrt(sv)
    uniforms.axes[0] = du
    uniforms.axes[1] = dv

    //Update fragment clip bounds
    uniforms.fragClipBounds[0] = setComponent(SCRATCH_VEC, clipBounds[0], i, -1e8)
    uniforms.fragClipBounds[1] = setComponent(SCRATCH_VEC, clipBounds[1], i, 1e8)

    //Draw interior
    points.vao.draw(gl.TRIANGLES, points.vertexCount)

    //Draw edges
    if(points.lineWidth > 0) {
      gl.lineWidth(points.lineWidth)
      points.vao.draw(gl.LINES, points.lineVertexCount, points.vertexCount)
    }
  }
}


var NEG_INFINITY3 = [-1e8, -1e8, -1e8]
var POS_INFINITY3 = [1e8, 1e8, 1e8]
var CLIP_GROUP    = [NEG_INFINITY3, POS_INFINITY3]

function drawFull(shader, pshader, points, camera, transparent, forceDraw) {
  var gl = points.gl

  points.vao.bind()

  if(transparent === (points.opacity < 1) || forceDraw) {
    shader.bind()
    var uniforms = shader.uniforms

    uniforms.model      = camera.model      || IDENTITY
    uniforms.view       = camera.view       || IDENTITY
    uniforms.projection = camera.projection || IDENTITY

    VIEW_SHAPE[0]       = 2.0/gl.drawingBufferWidth
    VIEW_SHAPE[1]       = 2.0/gl.drawingBufferHeight
    uniforms.screenSize = VIEW_SHAPE

    uniforms.highlightId    = points.highlightId
    uniforms.highlightScale = points.highlightScale

    uniforms.fragClipBounds = CLIP_GROUP
    uniforms.clipBounds     = points.axes.bounds

    uniforms.opacity    = points.opacity
    uniforms.pickGroup  = points.pickId / 255.0

    uniforms.pixelRatio = points.pixelRatio

    //Draw interior
    points.vao.draw(gl.TRIANGLES, points.vertexCount)

    //Draw edges
    if(points.lineWidth > 0) {
      gl.lineWidth(points.lineWidth)
      points.vao.draw(gl.LINES, points.lineVertexCount, points.vertexCount)
    }
  }

  drawProject(pshader, points, camera, transparent, forceDraw)

  points.vao.unbind()
}

proto.draw = function(camera) {
  var shader = this.useOrtho ? this.orthoShader : this.shader
  drawFull(shader, this.projectShader, this, camera, false, false)
}

proto.drawTransparent = function(camera) {
  var shader = this.useOrtho ? this.orthoShader : this.shader
  drawFull(shader, this.projectShader, this, camera, true, false)
}

proto.drawPick = function(camera) {
  var shader = this.useOrtho ? this.pickOrthoShader : this.pickPerspectiveShader
  drawFull(shader, this.pickProjectShader, this, camera, false, true)
}

proto.pick = function(selected) {
  if(!selected) {
    return null
  }
  if(selected.id !== this.pickId) {
    return null
  }
  var x = selected.value[2] + (selected.value[1]<<8) + (selected.value[0]<<16)
  if(x >= this.pointCount || x < 0) {
    return null
  }

  //Unpack result
  var coord = this.points[x]
  var result = this._selectResult
  result.index = x
  for(var i=0; i<3; ++i) {
    result.position[i] = result.dataCoordinate[i] = coord[i]
  }
  return result
}

proto.highlight = function(selection) {
  if(!selection) {
    this.highlightId = [1,1,1,1]
  } else {
    var pointId = selection.index
    var a0 =  pointId     &0xff
    var a1 = (pointId>>8) &0xff
    var a2 = (pointId>>16)&0xff
    this.highlightId = [a0/255.0, a1/255.0, a2/255.0, 0]
  }
}

proto.update = function(options) {

  options = options || {}

  if('perspective' in options) {
    this.useOrtho = !options.perspective
  }
  if('orthographic' in options) {
    this.useOrtho = !!options.orthographic
  }
  if('lineWidth' in options) {
    this.lineWidth = options.lineWidth
  }
  if('project' in options) {
    if(Array.isArray(options.project)) {
      this.axesProject = options.project
    } else {
      var v = !!options.project
      this.axesProject = [v,v,v]
    }
  }
  if('projectScale' in options) {
    if(Array.isArray(options.projectScale)) {
      this.projectScale = options.projectScale.slice()
    } else {
      var s = +options.projectScale
      this.projectScale = [s,s,s]
    }
  }
  if('projectOpacity' in options) {
    if(Array.isArray(options.projectOpacity)) {
      this.projectOpacity = options.projectOpacity.slice()
    } else {
      var s = +options.projectOpacity
      this.projectOpacity = [s,s,s]
    }
  }
  if('opacity' in options) {
    this.opacity = options.opacity
  }

  //Set dirty flag
  this.dirty = true

  //Create new buffers
  var points = options.position
  if(!points) {
    return
  }

  //Text font
  var font      = options.font      || 'normal'
  var alignment = options.alignment || [0,0]

  //Bounds
  var lowerBound = [ Infinity, Infinity, Infinity]
  var upperBound = [-Infinity,-Infinity,-Infinity]

  //Unpack options
  var glyphs     = options.glyph
  var colors     = options.color
  var sizes      = options.size
  var angles     = options.angle
  var lineColors = options.lineColor

  //Picking geometry
  var pickCounter = 0

  //First do pass to compute buffer sizes
  var triVertexCount     = 0
  var lineVertexCount = 0

  //Count number of points and buffer size
  var numPoints   = points.length

count_loop:
  for(var i=0; i<numPoints; ++i) {
    var x = points[i]
    for(var j=0; j<3; ++j) {
      if(isNaN(x[j]) || !isFinite(x[j])) {
        continue count_loop
      }
    }

    var glyphData
    if(Array.isArray(glyphs)) {
      glyphData = getGlyph(glyphs[i], font)
    } else if(glyphs) {
      glyphData = getGlyph(glyphs, font)
    } else {
      glyphData = getGlyph('●', font)
    }
    var glyphMesh   = glyphData[0]
    var glyphLines  = glyphData[1]
    var glyphBounds = glyphData[2]

    triVertexCount  += glyphMesh.cells.length * 3
    lineVertexCount += glyphLines.edges.length * 2
  }


  //Preallocate data
  var vertexCount   = triVertexCount + lineVertexCount
  var positionArray = pool.mallocFloat(3*vertexCount)
  var colorArray    = pool.mallocFloat(4*vertexCount)
  var glyphArray    = pool.mallocFloat(2*vertexCount)
  var idArray       = pool.mallocUint32(vertexCount)

  var textOffset = [0,alignment[1]]

  var triOffset  = 0
  var lineOffset = triVertexCount
  var color      = [0,0,0,1]
  var lineColor  = [0,0,0,1]

  var isColorArray      = Array.isArray(colors)     && Array.isArray(colors[0])
  var isLineColorArray  = Array.isArray(lineColors) && Array.isArray(lineColors[0])

fill_loop:
  for(var i=0; i<numPoints; ++i) {
    var x = points[i]
    for(var j=0; j<3; ++j) {
      if(isNaN(x[j]) || !isFinite(x[j])) {
        pickCounter += 1
        continue fill_loop
      }

      upperBound[j] = Math.max(upperBound[j], x[j])
      lowerBound[j] = Math.min(lowerBound[j], x[j])
    }

    var glyphData
    if(Array.isArray(glyphs)) {
      glyphData = getGlyph(glyphs[i], font)
    } else if(glyphs) {
      glyphData = getGlyph(glyphs, font)
    } else {
      glyphData = getGlyph('●', font)
    }
    var glyphMesh   = glyphData[0]
    var glyphLines  = glyphData[1]
    var glyphBounds = glyphData[2]


    //Get color
    if(Array.isArray(colors)) {
      var c
      if(isColorArray) {
        c = colors[i]
      } else {
        c = colors
      }
      if(c.length === 3) {
        for(var j=0; j<3; ++j) {
          color[j] = c[j]
        }
        color[3] = 1
      } else if(c.length === 4) {
        for(var j=0; j<4; ++j) {
          color[j] = c[j]
        }
      }
    } else {
      color[0] = color[1] = color[2] = 0
      color[3] = 1
    }

    //Get lineColor
    if(Array.isArray(lineColors)) {
      var c
      if(isLineColorArray) {
        c = lineColors[i]
      } else {
        c = lineColors
      }
      if(c.length === 3) {
        for(var j=0; j<3; ++j) {
          lineColor[j] = c[j]
        }
        lineColor[j] = 1
      } else if(c.length === 4) {
        for(var j=0; j<4; ++j) {
          lineColor[j] = c[j]
        }
      }
    } else {
      lineColor[0] = lineColor[1] = lineColor[2] = 0
      lineColor[3] = 1
    }

    var size = 0.5
    if(Array.isArray(sizes)) {
      size = +sizes[i]
    } else if(sizes) {
      size = +sizes
    } else if(this.useOrtho) {
      size = 12
    }

    var angle = 0
    if(Array.isArray(angles)) {
      angle = +angles[i]
    } else if(angles) {
      angle = +angles
    }

    //Loop through markers and append to buffers
    var cos = Math.cos(angle)
    var sin = Math.sin(angle)

    var x = points[i]
    for(var j=0; j<3; ++j) {
      upperBound[j] = Math.max(upperBound[j], x[j])
      lowerBound[j] = Math.min(lowerBound[j], x[j])
    }

    //Calculate text offset
    if(alignment[0] < 0) {
      textOffset[0] = alignment[0]  * (1+glyphBounds[1][0])
    } else if(alignment[0] > 0) {
      textOffset[0] = -alignment[0] * (1+glyphBounds[0][0])
    }

    //Write out inner marker
    var cells = glyphMesh.cells
    var verts = glyphMesh.positions

    for(var j=0; j<cells.length; ++j) {
      var cell = cells[j]
      for(var k=0; k<3; ++k) {
        for(var l=0; l<3; ++l) {
          positionArray[3*triOffset+l] = x[l]
        }
        for(var l=0; l<4; ++l) {
          colorArray[4*triOffset+l] = color[l]
        }
        idArray[triOffset] = pickCounter
        var p = verts[cell[k]]
        glyphArray[2*triOffset]   = size * (cos*p[0] - sin*p[1] + textOffset[0])
        glyphArray[2*triOffset+1] = size * (sin*p[0] + cos*p[1] + textOffset[1])
        triOffset += 1
      }
    }

    var cells = glyphLines.edges
    var verts = glyphLines.positions

    for(var j=0; j<cells.length; ++j) {
      var cell = cells[j]
      for(var k=0; k<2; ++k) {
        for(var l=0; l<3; ++l) {
          positionArray[3*lineOffset+l] = x[l]
        }
        for(var l=0; l<4; ++l) {
          colorArray[4*lineOffset+l] = lineColor[l]
        }
        idArray[lineOffset] = pickCounter
        var p = verts[cell[k]]
        glyphArray[2*lineOffset]   = size * (cos*p[0] - sin*p[1] + textOffset[0])
        glyphArray[2*lineOffset+1] = size * (sin*p[0] + cos*p[1] + textOffset[1])
        lineOffset += 1
      }
    }

    //Increment pickCounter
    pickCounter += 1
  }


  //Update vertex counts
  this.vertexCount      = triVertexCount
  this.lineVertexCount  = lineVertexCount

  //Update buffers
  this.pointBuffer.update(positionArray)
  this.colorBuffer.update(colorArray)
  this.glyphBuffer.update(glyphArray)
  this.idBuffer.update(new Uint32Array(idArray))

  pool.free(positionArray)
  pool.free(colorArray)
  pool.free(glyphArray)
  pool.free(idArray)

  //Update bounds
  this.bounds = [lowerBound, upperBound]

  //Save points
  this.points = points

  //Save number of points
  this.pointCount = points.length
}

proto.dispose = function() {
  //Shaders
  this.shader.dispose()
  this.orthoShader.dispose()
  this.pickPerspectiveShader.dispose()
  this.pickOrthoShader.dispose()

  //Vertex array
  this.vao.dispose()

  //Buffers
  this.pointBuffer.dispose()
  this.colorBuffer.dispose()
  this.glyphBuffer.dispose()
  this.idBuffer.dispose()
}

function createPointCloud(options) {
  var gl = options.gl

  var shader                = shaders.createPerspective(gl)
  var orthoShader           = shaders.createOrtho(gl)
  var projectShader         = shaders.createProject(gl)
  var pickPerspectiveShader = shaders.createPickPerspective(gl)
  var pickOrthoShader       = shaders.createPickOrtho(gl)
  var pickProjectShader     = shaders.createPickProject(gl)

  var pointBuffer = createBuffer(gl)
  var colorBuffer = createBuffer(gl)
  var glyphBuffer = createBuffer(gl)
  var idBuffer    = createBuffer(gl)
  var vao = createVAO(gl, [
    {
      buffer: pointBuffer,
      size: 3,
      type: gl.FLOAT
    },
    {
      buffer: colorBuffer,
      size: 4,
      type: gl.FLOAT
    },
    {
      buffer: glyphBuffer,
      size: 2,
      type: gl.FLOAT
    },
    {
      buffer: idBuffer,
      size: 4,
      type: gl.UNSIGNED_BYTE,
      normalized: true
    }
  ])

  var pointCloud = new PointCloud(
    gl,
    shader,
    orthoShader,
    projectShader,
    pointBuffer,
    colorBuffer,
    glyphBuffer,
    idBuffer,
    vao,
    pickPerspectiveShader,
    pickOrthoShader,
    pickProjectShader)

  pointCloud.update(options)

  return pointCloud
}

},{"./lib/glyphs":111,"./lib/shaders":112,"gl-buffer":81,"gl-mat4/multiply":98,"gl-vao":128,"typedarray-pool":212}],114:[function(require,module,exports){
'use strict'

module.exports = createSelectBuffer

var createFBO = require('gl-fbo')
var pool      = require('typedarray-pool')
var ndarray   = require('ndarray')

var nextPow2  = require('bit-twiddle').nextPow2

var selectRange = require('cwise/lib/wrapper')({"args":["array",{"offset":[0,0,1],"array":0},{"offset":[0,0,2],"array":0},{"offset":[0,0,3],"array":0},"scalar","scalar","index"],"pre":{"body":"{this_closestD2=1e8,this_closestX=-1,this_closestY=-1}","args":[],"thisVars":["this_closestD2","this_closestX","this_closestY"],"localVars":[]},"body":{"body":"{if(_inline_1_arg0_<255||_inline_1_arg1_<255||_inline_1_arg2_<255||_inline_1_arg3_<255){var _inline_1_l=_inline_1_arg4_-_inline_1_arg6_[0],_inline_1_a=_inline_1_arg5_-_inline_1_arg6_[1],_inline_1_f=_inline_1_l*_inline_1_l+_inline_1_a*_inline_1_a;_inline_1_f<this_closestD2&&(this_closestD2=_inline_1_f,this_closestX=_inline_1_arg6_[0],this_closestY=_inline_1_arg6_[1])}}","args":[{"name":"_inline_1_arg0_","lvalue":false,"rvalue":true,"count":1},{"name":"_inline_1_arg1_","lvalue":false,"rvalue":true,"count":1},{"name":"_inline_1_arg2_","lvalue":false,"rvalue":true,"count":1},{"name":"_inline_1_arg3_","lvalue":false,"rvalue":true,"count":1},{"name":"_inline_1_arg4_","lvalue":false,"rvalue":true,"count":1},{"name":"_inline_1_arg5_","lvalue":false,"rvalue":true,"count":1},{"name":"_inline_1_arg6_","lvalue":false,"rvalue":true,"count":4}],"thisVars":["this_closestD2","this_closestX","this_closestY"],"localVars":["_inline_1_a","_inline_1_f","_inline_1_l"]},"post":{"body":"{return[this_closestX,this_closestY,this_closestD2]}","args":[],"thisVars":["this_closestD2","this_closestX","this_closestY"],"localVars":[]},"debug":false,"funcName":"cwise","blockSize":64})

function SelectResult(x, y, id, value, distance) {
  this.coord = [x, y]
  this.id = id
  this.value = value
  this.distance = distance
}

function SelectBuffer(gl, fbo, buffer) {
  this.gl     = gl
  this.fbo    = fbo
  this.buffer = buffer
  this._readTimeout = null
  var self = this

  this._readCallback = function() {
    if(!self.gl) {
      return
    }
    fbo.bind()
    gl.readPixels(0,0,fbo.shape[0],fbo.shape[1],gl.RGBA,gl.UNSIGNED_BYTE,self.buffer)
    self._readTimeout = null
  }
}

var proto = SelectBuffer.prototype

Object.defineProperty(proto, 'shape', {
  get: function() {
    if(!this.gl) {
      return [0,0]
    }
    return this.fbo.shape.slice()
  },
  set: function(v) {
    if(!this.gl) {
      return
    }
    this.fbo.shape = v
    var c = this.fbo.shape[0]
    var r = this.fbo.shape[1]
    if(r*c*4 > this.buffer.length) {
      pool.free(this.buffer)
      var buffer = this.buffer = pool.mallocUint8(nextPow2(r*c*4))
      for(var i=0; i<r*c*4; ++i) {
        buffer[i] = 0xff
      }
    }
    return v
  }
})

proto.begin = function() {
  var gl = this.gl
  var shape = this.shape
  if(!gl) {
    return
  }

  this.fbo.bind()
  gl.clearColor(1,1,1,1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
}

proto.end = function() {
  var gl = this.gl
  if(!gl) {
    return
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  if(!this._readTimeout) {
    clearTimeout(this._readTimeout)
  }
  this._readTimeout = setTimeout(this._readCallback, 1)
}

proto.query = function(x, y, radius) {
  if(!this.gl) {
    return null
  }

  var shape = this.fbo.shape.slice()

  x = x|0
  y = y|0
  if(typeof radius !== 'number') {
    radius = 1.0
  }

  var x0 = Math.min(Math.max(x - radius, 0), shape[0])|0
  var x1 = Math.min(Math.max(x + radius, 0), shape[0])|0
  var y0 = Math.min(Math.max(y - radius, 0), shape[1])|0
  var y1 = Math.min(Math.max(y + radius, 0), shape[1])|0

  if(x1 <= x0 || y1 <= y0) {
    return null
  }

  var dims   = [x1-x0,y1-y0]
  var region = ndarray(
    this.buffer,
    [dims[0], dims[1], 4],
    [4, shape[0]*4, 1],
    4*(x0 + shape[0]*y0));

  var closest = selectRange(region.hi(dims[0],dims[1],1), radius, radius)
  var dx = closest[0]
  var dy = closest[1]
  if(dx < 0 || Math.pow(this.radius, 2) < closest[2]) {
    return null
  }

  var c0 = region.get(dx, dy, 0)
  var c1 = region.get(dx, dy, 1)
  var c2 = region.get(dx, dy, 2)
  var c3 = region.get(dx, dy, 3)

  return new SelectResult(
     (dx + x0)|0,
     (dy + y0)|0,
     c0,
     [c1, c2, c3],
     Math.sqrt(closest[2]))
}

proto.dispose = function() {
  if(!this.gl) {
    return
  }
  this.fbo.dispose()
  pool.free(this.buffer)
  this.gl = null
  if(this._readTimeout) {
    clearTimeout(this._readTimeout)
  }
}

function createSelectBuffer(gl, shape) {
  var fbo = createFBO(gl, shape)
  var buffer = pool.mallocUint8(shape[0]*shape[1]*4)
  return new SelectBuffer(gl, fbo, buffer)
}

},{"bit-twiddle":35,"cwise/lib/wrapper":66,"gl-fbo":84,"ndarray":164,"typedarray-pool":212}],115:[function(require,module,exports){
'use strict'

var createUniformWrapper   = require('./lib/create-uniforms')
var createAttributeWrapper = require('./lib/create-attributes')
var makeReflect            = require('./lib/reflect')
var shaderCache            = require('./lib/shader-cache')
var runtime                = require('./lib/runtime-reflect')
var GLError                = require("./lib/GLError")

//Shader object
function Shader(gl) {
  this.gl         = gl

  //Default initialize these to null
  this._vref      =
  this._fref      =
  this._relink    =
  this.vertShader =
  this.fragShader =
  this.program    =
  this.attributes =
  this.uniforms   =
  this.types      = null
}

var proto = Shader.prototype

proto.bind = function() {
  if(!this.program) {
    this._relink()
  }
  this.gl.useProgram(this.program)
}

proto.dispose = function() {
  if(this._fref) {
    this._fref.dispose()
  }
  if(this._vref) {
    this._vref.dispose()
  }
  this.attributes =
  this.types      =
  this.vertShader =
  this.fragShader =
  this.program    =
  this._relink    =
  this._fref      =
  this._vref      = null
}

function compareAttributes(a, b) {
  if(a.name < b.name) {
    return -1
  }
  return 1
}

//Update export hook for glslify-live
proto.update = function(
    vertSource
  , fragSource
  , uniforms
  , attributes) {

  //If only one object passed, assume glslify style output
  if(!fragSource || arguments.length === 1) {
    var obj = vertSource
    vertSource = obj.vertex
    fragSource = obj.fragment
    uniforms   = obj.uniforms
    attributes = obj.attributes
  }

  var wrapper = this
  var gl      = wrapper.gl

  //Compile vertex and fragment shaders
  var pvref = wrapper._vref
  wrapper._vref = shaderCache.shader(gl, gl.VERTEX_SHADER, vertSource)
  if(pvref) {
    pvref.dispose()
  }
  wrapper.vertShader = wrapper._vref.shader
  var pfref = this._fref
  wrapper._fref = shaderCache.shader(gl, gl.FRAGMENT_SHADER, fragSource)
  if(pfref) {
    pfref.dispose()
  }
  wrapper.fragShader = wrapper._fref.shader

  //If uniforms/attributes is not specified, use RT reflection
  if(!uniforms || !attributes) {

    //Create initial test program
    var testProgram = gl.createProgram()
    gl.attachShader(testProgram, wrapper.fragShader)
    gl.attachShader(testProgram, wrapper.vertShader)
    gl.linkProgram(testProgram)
    if(!gl.getProgramParameter(testProgram, gl.LINK_STATUS)) {
      var errLog = gl.getProgramInfoLog(testProgram)
      throw new GLError(errLog, 'Error linking program:' + errLog)
    }

    //Load data from runtime
    uniforms   = uniforms   || runtime.uniforms(gl, testProgram)
    attributes = attributes || runtime.attributes(gl, testProgram)

    //Release test program
    gl.deleteProgram(testProgram)
  }

  //Sort attributes lexicographically
  // overrides undefined WebGL behavior for attribute locations
  attributes = attributes.slice()
  attributes.sort(compareAttributes)

  //Convert attribute types, read out locations
  var attributeUnpacked  = []
  var attributeNames     = []
  var attributeLocations = []
  for(var i=0; i<attributes.length; ++i) {
    var attr = attributes[i]
    if(attr.type.indexOf('mat') >= 0) {
      var size = attr.type.charAt(attr.type.length-1)|0
      var locVector = new Array(size)
      for(var j=0; j<size; ++j) {
        locVector[j] = attributeLocations.length
        attributeNames.push(attr.name + '[' + j + ']')
        if(typeof attr.location === 'number') {
          attributeLocations.push(attr.location + j)
        } else if(Array.isArray(attr.location) &&
                  attr.location.length === size &&
                  typeof attr.location[j] === 'number') {
          attributeLocations.push(attr.location[j]|0)
        } else {
          attributeLocations.push(-1)
        }
      }
      attributeUnpacked.push({
        name: attr.name,
        type: attr.type,
        locations: locVector
      })
    } else {
      attributeUnpacked.push({
        name: attr.name,
        type: attr.type,
        locations: [ attributeLocations.length ]
      })
      attributeNames.push(attr.name)
      if(typeof attr.location === 'number') {
        attributeLocations.push(attr.location|0)
      } else {
        attributeLocations.push(-1)
      }
    }
  }

  //For all unspecified attributes, assign them lexicographically min attribute
  var curLocation = 0
  for(var i=0; i<attributeLocations.length; ++i) {
    if(attributeLocations[i] < 0) {
      while(attributeLocations.indexOf(curLocation) >= 0) {
        curLocation += 1
      }
      attributeLocations[i] = curLocation
    }
  }

  //Rebuild program and recompute all uniform locations
  var uniformLocations = new Array(uniforms.length)
  function relink() {
    wrapper.program = shaderCache.program(
        gl
      , wrapper._vref
      , wrapper._fref
      , attributeNames
      , attributeLocations)

    for(var i=0; i<uniforms.length; ++i) {
      uniformLocations[i] = gl.getUniformLocation(
          wrapper.program
        , uniforms[i].name)
    }
  }

  //Perform initial linking, reuse program used for reflection
  relink()

  //Save relinking procedure, defer until runtime
  wrapper._relink = relink

  //Generate type info
  wrapper.types = {
    uniforms:   makeReflect(uniforms),
    attributes: makeReflect(attributes)
  }

  //Generate attribute wrappers
  wrapper.attributes = createAttributeWrapper(
      gl
    , wrapper
    , attributeUnpacked
    , attributeLocations)

  //Generate uniform wrappers
  Object.defineProperty(wrapper, 'uniforms', createUniformWrapper(
      gl
    , wrapper
    , uniforms
    , uniformLocations))
}

//Compiles and links a shader program with the given attribute and vertex list
function createShader(
    gl
  , vertSource
  , fragSource
  , uniforms
  , attributes) {

  var shader = new Shader(gl)

  shader.update(
      vertSource
    , fragSource
    , uniforms
    , attributes)

  return shader
}

module.exports = createShader

},{"./lib/GLError":116,"./lib/create-attributes":117,"./lib/create-uniforms":118,"./lib/reflect":119,"./lib/runtime-reflect":120,"./lib/shader-cache":121}],116:[function(require,module,exports){
function GLError (rawError, shortMessage, longMessage) {
    this.shortMessage = shortMessage || ''
    this.longMessage = longMessage || ''
    this.rawError = rawError || ''
    this.message =
      'gl-shader: ' + (shortMessage || rawError || '') +
      (longMessage ? '\n'+longMessage : '')
    this.stack = (new Error()).stack
}
GLError.prototype = new Error
GLError.prototype.name = 'GLError'
GLError.prototype.constructor = GLError
module.exports = GLError

},{}],117:[function(require,module,exports){
'use strict'

module.exports = createAttributeWrapper

var GLError = require("./GLError")

function ShaderAttribute(
    gl
  , wrapper
  , index
  , locations
  , dimension
  , constFunc) {
  this._gl        = gl
  this._wrapper   = wrapper
  this._index     = index
  this._locations = locations
  this._dimension = dimension
  this._constFunc = constFunc
}

var proto = ShaderAttribute.prototype

proto.pointer = function setAttribPointer(
    type
  , normalized
  , stride
  , offset) {

  var self      = this
  var gl        = self._gl
  var location  = self._locations[self._index]

  gl.vertexAttribPointer(
      location
    , self._dimension
    , type || gl.FLOAT
    , !!normalized
    , stride || 0
    , offset || 0)
  gl.enableVertexAttribArray(location)
}

proto.set = function(x0, x1, x2, x3) {
  return this._constFunc(this._locations[this._index], x0, x1, x2, x3)
}

Object.defineProperty(proto, 'location', {
  get: function() {
    return this._locations[this._index]
  }
  , set: function(v) {
    if(v !== this._locations[this._index]) {
      this._locations[this._index] = v|0
      this._wrapper.program = null
    }
    return v|0
  }
})

//Adds a vector attribute to obj
function addVectorAttribute(
    gl
  , wrapper
  , index
  , locations
  , dimension
  , obj
  , name) {

  //Construct constant function
  var constFuncArgs = [ 'gl', 'v' ]
  var varNames = []
  for(var i=0; i<dimension; ++i) {
    constFuncArgs.push('x'+i)
    varNames.push('x'+i)
  }
  constFuncArgs.push(
    'if(x0.length===void 0){return gl.vertexAttrib' +
    dimension + 'f(v,' +
    varNames.join() +
    ')}else{return gl.vertexAttrib' +
    dimension +
    'fv(v,x0)}')
  var constFunc = Function.apply(null, constFuncArgs)

  //Create attribute wrapper
  var attr = new ShaderAttribute(
      gl
    , wrapper
    , index
    , locations
    , dimension
    , constFunc)

  //Create accessor
  Object.defineProperty(obj, name, {
    set: function(x) {
      gl.disableVertexAttribArray(locations[index])
      constFunc(gl, locations[index], x)
      return x
    }
    , get: function() {
      return attr
    }
    , enumerable: true
  })
}

function addMatrixAttribute(
    gl
  , wrapper
  , index
  , locations
  , dimension
  , obj
  , name) {

  var parts = new Array(dimension)
  var attrs = new Array(dimension)
  for(var i=0; i<dimension; ++i) {
    addVectorAttribute(
        gl
      , wrapper
      , index[i]
      , locations
      , dimension
      , parts
      , i)
    attrs[i] = parts[i]
  }

  Object.defineProperty(parts, 'location', {
    set: function(v) {
      if(Array.isArray(v)) {
        for(var i=0; i<dimension; ++i) {
          attrs[i].location = v[i]
        }
      } else {
        for(var i=0; i<dimension; ++i) {
          attrs[i].location = v + i
        }
      }
      return v
    }
    , get: function() {
      var result = new Array(dimension)
      for(var i=0; i<dimension; ++i) {
        result[i] = locations[index[i]]
      }
      return result
    }
    , enumerable: true
  })

  parts.pointer = function(type, normalized, stride, offset) {
    type       = type || gl.FLOAT
    normalized = !!normalized
    stride     = stride || (dimension * dimension)
    offset     = offset || 0
    for(var i=0; i<dimension; ++i) {
      var location = locations[index[i]]
      gl.vertexAttribPointer(
            location
          , dimension
          , type
          , normalized
          , stride
          , offset + i * dimension)
      gl.enableVertexAttribArray(location)
    }
  }

  var scratch = new Array(dimension)
  var vertexAttrib = gl['vertexAttrib' + dimension + 'fv']

  Object.defineProperty(obj, name, {
    set: function(x) {
      for(var i=0; i<dimension; ++i) {
        var loc = locations[index[i]]
        gl.disableVertexAttribArray(loc)
        if(Array.isArray(x[0])) {
          vertexAttrib.call(gl, loc, x[i])
        } else {
          for(var j=0; j<dimension; ++j) {
            scratch[j] = x[dimension*i + j]
          }
          vertexAttrib.call(gl, loc, scratch)
        }
      }
      return x
    }
    , get: function() {
      return parts
    }
    , enumerable: true
  })
}

//Create shims for attributes
function createAttributeWrapper(
    gl
  , wrapper
  , attributes
  , locations) {

  var obj = {}
  for(var i=0, n=attributes.length; i<n; ++i) {

    var a = attributes[i]
    var name = a.name
    var type = a.type
    var locs = a.locations

    switch(type) {
      case 'bool':
      case 'int':
      case 'float':
        addVectorAttribute(
            gl
          , wrapper
          , locs[0]
          , locations
          , 1
          , obj
          , name)
      break

      default:
        if(type.indexOf('vec') >= 0) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid data type for attribute ' + name + ': ' + type)
          }
          addVectorAttribute(
              gl
            , wrapper
            , locs[0]
            , locations
            , d
            , obj
            , name)
        } else if(type.indexOf('mat') >= 0) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid data type for attribute ' + name + ': ' + type)
          }
          addMatrixAttribute(
              gl
            , wrapper
            , locs
            , locations
            , d
            , obj
            , name)
        } else {
          throw new GLError('', 'Unknown data type for attribute ' + name + ': ' + type)
        }
      break
    }
  }
  return obj
}

},{"./GLError":116}],118:[function(require,module,exports){
'use strict'

var coallesceUniforms = require('./reflect')
var GLError = require("./GLError")

module.exports = createUniformWrapper

//Binds a function and returns a value
function identity(x) {
  var c = new Function('y', 'return function(){return y}')
  return c(x)
}

function makeVector(length, fill) {
  var result = new Array(length)
  for(var i=0; i<length; ++i) {
    result[i] = fill
  }
  return result
}

//Create shims for uniforms
function createUniformWrapper(gl, wrapper, uniforms, locations) {

  function makeGetter(index) {
    var proc = new Function(
        'gl'
      , 'wrapper'
      , 'locations'
      , 'return function(){return gl.getUniform(wrapper.program,locations[' + index + '])}')
    return proc(gl, wrapper, locations)
  }

  function makePropSetter(path, index, type) {
    switch(type) {
      case 'bool':
      case 'int':
      case 'sampler2D':
      case 'samplerCube':
        return 'gl.uniform1i(locations[' + index + '],obj' + path + ')'
      case 'float':
        return 'gl.uniform1f(locations[' + index + '],obj' + path + ')'
      default:
        var vidx = type.indexOf('vec')
        if(0 <= vidx && vidx <= 1 && type.length === 4 + vidx) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid data type')
          }
          switch(type.charAt(0)) {
            case 'b':
            case 'i':
              return 'gl.uniform' + d + 'iv(locations[' + index + '],obj' + path + ')'
            case 'v':
              return 'gl.uniform' + d + 'fv(locations[' + index + '],obj' + path + ')'
            default:
              throw new GLError('', 'Unrecognized data type for vector ' + name + ': ' + type)
          }
        } else if(type.indexOf('mat') === 0 && type.length === 4) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid uniform dimension type for matrix ' + name + ': ' + type)
          }
          return 'gl.uniformMatrix' + d + 'fv(locations[' + index + '],false,obj' + path + ')'
        } else {
          throw new GLError('', 'Unknown uniform data type for ' + name + ': ' + type)
        }
      break
    }
  }

  function enumerateIndices(prefix, type) {
    if(typeof type !== 'object') {
      return [ [prefix, type] ]
    }
    var indices = []
    for(var id in type) {
      var prop = type[id]
      var tprefix = prefix
      if(parseInt(id) + '' === id) {
        tprefix += '[' + id + ']'
      } else {
        tprefix += '.' + id
      }
      if(typeof prop === 'object') {
        indices.push.apply(indices, enumerateIndices(tprefix, prop))
      } else {
        indices.push([tprefix, prop])
      }
    }
    return indices
  }

  function makeSetter(type) {
    var code = [ 'return function updateProperty(obj){' ]
    var indices = enumerateIndices('', type)
    for(var i=0; i<indices.length; ++i) {
      var item = indices[i]
      var path = item[0]
      var idx  = item[1]
      if(locations[idx]) {
        code.push(makePropSetter(path, idx, uniforms[idx].type))
      }
    }
    code.push('return obj}')
    var proc = new Function('gl', 'locations', code.join('\n'))
    return proc(gl, locations)
  }

  function defaultValue(type) {
    switch(type) {
      case 'bool':
        return false
      case 'int':
      case 'sampler2D':
      case 'samplerCube':
        return 0
      case 'float':
        return 0.0
      default:
        var vidx = type.indexOf('vec')
        if(0 <= vidx && vidx <= 1 && type.length === 4 + vidx) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid data type')
          }
          if(type.charAt(0) === 'b') {
            return makeVector(d, false)
          }
          return makeVector(d, 0)
        } else if(type.indexOf('mat') === 0 && type.length === 4) {
          var d = type.charCodeAt(type.length-1) - 48
          if(d < 2 || d > 4) {
            throw new GLError('', 'Invalid uniform dimension type for matrix ' + name + ': ' + type)
          }
          return makeVector(d*d, 0)
        } else {
          throw new GLError('', 'Unknown uniform data type for ' + name + ': ' + type)
        }
      break
    }
  }

  function storeProperty(obj, prop, type) {
    if(typeof type === 'object') {
      var child = processObject(type)
      Object.defineProperty(obj, prop, {
        get: identity(child),
        set: makeSetter(type),
        enumerable: true,
        configurable: false
      })
    } else {
      if(locations[type]) {
        Object.defineProperty(obj, prop, {
          get: makeGetter(type),
          set: makeSetter(type),
          enumerable: true,
          configurable: false
        })
      } else {
        obj[prop] = defaultValue(uniforms[type].type)
      }
    }
  }

  function processObject(obj) {
    var result
    if(Array.isArray(obj)) {
      result = new Array(obj.length)
      for(var i=0; i<obj.length; ++i) {
        storeProperty(result, i, obj[i])
      }
    } else {
      result = {}
      for(var id in obj) {
        storeProperty(result, id, obj[id])
      }
    }
    return result
  }

  //Return data
  var coallesced = coallesceUniforms(uniforms, true)
  return {
    get: identity(processObject(coallesced)),
    set: makeSetter(coallesced),
    enumerable: true,
    configurable: true
  }
}

},{"./GLError":116,"./reflect":119}],119:[function(require,module,exports){
'use strict'

module.exports = makeReflectTypes

//Construct type info for reflection.
//
// This iterates over the flattened list of uniform type values and smashes them into a JSON object.
//
// The leaves of the resulting object are either indices or type strings representing primitive glslify types
function makeReflectTypes(uniforms, useIndex) {
  var obj = {}
  for(var i=0; i<uniforms.length; ++i) {
    var n = uniforms[i].name
    var parts = n.split(".")
    var o = obj
    for(var j=0; j<parts.length; ++j) {
      var x = parts[j].split("[")
      if(x.length > 1) {
        if(!(x[0] in o)) {
          o[x[0]] = []
        }
        o = o[x[0]]
        for(var k=1; k<x.length; ++k) {
          var y = parseInt(x[k])
          if(k<x.length-1 || j<parts.length-1) {
            if(!(y in o)) {
              if(k < x.length-1) {
                o[y] = []
              } else {
                o[y] = {}
              }
            }
            o = o[y]
          } else {
            if(useIndex) {
              o[y] = i
            } else {
              o[y] = uniforms[i].type
            }
          }
        }
      } else if(j < parts.length-1) {
        if(!(x[0] in o)) {
          o[x[0]] = {}
        }
        o = o[x[0]]
      } else {
        if(useIndex) {
          o[x[0]] = i
        } else {
          o[x[0]] = uniforms[i].type
        }
      }
    }
  }
  return obj
}
},{}],120:[function(require,module,exports){
'use strict'

exports.uniforms    = runtimeUniforms
exports.attributes  = runtimeAttributes

var GL_TO_GLSL_TYPES = {
  'FLOAT':       'float',
  'FLOAT_VEC2':  'vec2',
  'FLOAT_VEC3':  'vec3',
  'FLOAT_VEC4':  'vec4',
  'INT':         'int',
  'INT_VEC2':    'ivec2',
  'INT_VEC3':    'ivec3',
  'INT_VEC4':    'ivec4',
  'BOOL':        'bool',
  'BOOL_VEC2':   'bvec2',
  'BOOL_VEC3':   'bvec3',
  'BOOL_VEC4':   'bvec4',
  'FLOAT_MAT2':  'mat2',
  'FLOAT_MAT3':  'mat3',
  'FLOAT_MAT4':  'mat4',
  'SAMPLER_2D':  'sampler2D',
  'SAMPLER_CUBE':'samplerCube'
}

var GL_TABLE = null

function getType(gl, type) {
  if(!GL_TABLE) {
    var typeNames = Object.keys(GL_TO_GLSL_TYPES)
    GL_TABLE = {}
    for(var i=0; i<typeNames.length; ++i) {
      var tn = typeNames[i]
      GL_TABLE[gl[tn]] = GL_TO_GLSL_TYPES[tn]
    }
  }
  return GL_TABLE[type]
}

function runtimeUniforms(gl, program) {
  var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
  var result = []
  for(var i=0; i<numUniforms; ++i) {
    var info = gl.getActiveUniform(program, i)
    if(info) {
      var type = getType(gl, info.type)
      if(info.size > 1) {
        for(var j=0; j<info.size; ++j) {
          result.push({
            name: info.name.replace('[0]', '[' + j + ']'),
            type: type
          })
        }
      } else {
        result.push({
          name: info.name,
          type: type
        })
      }
    }
  }
  return result
}

function runtimeAttributes(gl, program) {
  var numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
  var result = []
  for(var i=0; i<numAttributes; ++i) {
    var info = gl.getActiveAttrib(program, i)
    if(info) {
      result.push({
        name: info.name,
        type: getType(gl, info.type)
      })
    }
  }
  return result
}

},{}],121:[function(require,module,exports){
'use strict'

exports.shader   = getShaderReference
exports.program  = createProgram

var GLError = require("./GLError")
var formatCompilerError = require('gl-format-compiler-error');

var weakMap = typeof WeakMap === 'undefined' ? require('weakmap-shim') : WeakMap
var CACHE = new weakMap()

var SHADER_COUNTER = 0

function ShaderReference(id, src, type, shader, programs, count, cache) {
  this.id       = id
  this.src      = src
  this.type     = type
  this.shader   = shader
  this.count    = count
  this.programs = []
  this.cache    = cache
}

ShaderReference.prototype.dispose = function() {
  if(--this.count === 0) {
    var cache    = this.cache
    var gl       = cache.gl

    //Remove program references
    var programs = this.programs
    for(var i=0, n=programs.length; i<n; ++i) {
      var p = cache.programs[programs[i]]
      if(p) {
        delete cache.programs[i]
        gl.deleteProgram(p)
      }
    }

    //Remove shader reference
    gl.deleteShader(this.shader)
    delete cache.shaders[(this.type === gl.FRAGMENT_SHADER)|0][this.src]
  }
}

function ContextCache(gl) {
  this.gl       = gl
  this.shaders  = [{}, {}]
  this.programs = {}
}

var proto = ContextCache.prototype

function compileShader(gl, type, src) {
  var shader = gl.createShader(type)
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    var errLog = gl.getShaderInfoLog(shader)
    try {
        var fmt = formatCompilerError(errLog, src, type);
    } catch (e){
        console.warn('Failed to format compiler error: ' + e);
        throw new GLError(errLog, 'Error compiling shader:\n' + errLog)
    }
    throw new GLError(errLog, fmt.short, fmt.long)
  }
  return shader
}

proto.getShaderReference = function(type, src) {
  var gl      = this.gl
  var shaders = this.shaders[(type === gl.FRAGMENT_SHADER)|0]
  var shader  = shaders[src]
  if(!shader || !gl.isShader(shader.shader)) {
    var shaderObj = compileShader(gl, type, src)
    shader = shaders[src] = new ShaderReference(
      SHADER_COUNTER++,
      src,
      type,
      shaderObj,
      [],
      1,
      this)
  } else {
    shader.count += 1
  }
  return shader
}

function linkProgram(gl, vshader, fshader, attribs, locations) {
  var program = gl.createProgram()
  gl.attachShader(program, vshader)
  gl.attachShader(program, fshader)
  for(var i=0; i<attribs.length; ++i) {
    gl.bindAttribLocation(program, locations[i], attribs[i])
  }
  gl.linkProgram(program)
  if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    var errLog = gl.getProgramInfoLog(program)
    throw new GLError(errLog, 'Error linking program: ' + errLog)
  }
  return program
}

proto.getProgram = function(vref, fref, attribs, locations) {
  var token = [vref.id, fref.id, attribs.join(':'), locations.join(':')].join('@')
  var prog  = this.programs[token]
  if(!prog || !this.gl.isProgram(prog)) {
    this.programs[token] = prog = linkProgram(
      this.gl,
      vref.shader,
      fref.shader,
      attribs,
      locations)
    vref.programs.push(token)
    fref.programs.push(token)
  }
  return prog
}

function getCache(gl) {
  var ctxCache = CACHE.get(gl)
  if(!ctxCache) {
    ctxCache = new ContextCache(gl)
    CACHE.set(gl, ctxCache)
  }
  return ctxCache
}

function getShaderReference(gl, type, src) {
  return getCache(gl).getShaderReference(type, src)
}

function createProgram(gl, vref, fref, attribs, locations) {
  return getCache(gl).getProgram(vref, fref, attribs, locations)
}

},{"./GLError":116,"gl-format-compiler-error":85,"weakmap-shim":219}],122:[function(require,module,exports){
'use strict'


var createShader = require('gl-shader')

var vertSrc = "precision mediump float;\n#define GLSLIFY 1\n\nattribute vec3 position, color;\nattribute float weight;\n\nuniform mat4 model, view, projection;\nuniform vec3 coordinates[3];\nuniform vec4 colors[3];\nuniform vec2 screenShape;\nuniform float lineWidth;\n\nvarying vec4 fragColor;\n\nvoid main() {\n  vec3 vertexPosition = mix(coordinates[0],\n    mix(coordinates[2], coordinates[1], 0.5 * (position + 1.0)), abs(position));\n\n  vec4 clipPos = projection * view * model * vec4(vertexPosition, 1.0);\n  vec2 clipOffset = (projection * view * model * vec4(color, 0.0)).xy;\n  vec2 delta = weight * clipOffset * screenShape;\n  vec2 lineOffset = normalize(vec2(delta.y, -delta.x)) / screenShape;\n\n  gl_Position   = vec4(clipPos.xy + clipPos.w * 0.5 * lineWidth * lineOffset, clipPos.z, clipPos.w);\n  fragColor     = color.x * colors[0] + color.y * colors[1] + color.z * colors[2];\n}\n"
var fragSrc = "precision mediump float;\n#define GLSLIFY 1\n\nvarying vec4 fragColor;\n\nvoid main() {\n  gl_FragColor = fragColor;\n}"

module.exports = function(gl) {
  return createShader(gl, vertSrc, fragSrc, null, [
    {name: 'position', type: 'vec3'},
    {name: 'color', type: 'vec3'},
    {name: 'weight', type: 'float'}
  ])
}

},{"gl-shader":115}],123:[function(require,module,exports){
'use strict'

var createBuffer = require('gl-buffer')
var createVAO = require('gl-vao')
var createShader = require('./shaders/index')

module.exports = createSpikes

var identity = [1,0,0,0,
                0,1,0,0,
                0,0,1,0,
                0,0,0,1]

function AxisSpikes(gl, buffer, vao, shader) {
  this.gl         = gl
  this.buffer     = buffer
  this.vao        = vao
  this.shader     = shader
  this.pixelRatio = 1
  this.bounds     = [[-1000,-1000,-1000], [1000,1000,1000]]
  this.position   = [0,0,0]
  this.lineWidth  = [2,2,2]
  this.colors     = [[0,0,0,1], [0,0,0,1], [0,0,0,1]]
  this.enabled    = [true,true,true]
  this.drawSides  = [true,true,true]
  this.axes       = null
}

var proto = AxisSpikes.prototype

var OUTER_FACE = [0,0,0]
var INNER_FACE = [0,0,0]

var SHAPE = [0,0]

proto.isTransparent = function() {
  return false
}

proto.drawTransparent = function(camera) {}

proto.draw = function(camera) {
  var gl = this.gl
  var vao = this.vao
  var shader = this.shader

  vao.bind()
  shader.bind()

  var model      = camera.model || identity
  var view       = camera.view || identity
  var projection = camera.projection || identity

  var axis
  if(this.axes) {
    axis = this.axes.lastCubeProps.axis
  }

  var outerFace = OUTER_FACE
  var innerFace = INNER_FACE
  for(var i=0; i<3; ++i) {
    if(axis && axis[i] < 0) {
      outerFace[i] = this.bounds[0][i]
      innerFace[i] = this.bounds[1][i]
    } else {
      outerFace[i] = this.bounds[1][i]
      innerFace[i] = this.bounds[0][i]
    }
  }

  SHAPE[0] = gl.drawingBufferWidth
  SHAPE[1] = gl.drawingBufferHeight

  shader.uniforms.model       = model
  shader.uniforms.view        = view
  shader.uniforms.projection  = projection
  shader.uniforms.coordinates = [this.position, outerFace, innerFace]
  shader.uniforms.colors      = this.colors
  shader.uniforms.screenShape = SHAPE

  for(var i=0; i<3; ++i) {
    shader.uniforms.lineWidth = this.lineWidth[i] * this.pixelRatio
    if(this.enabled[i]) {
      vao.draw(gl.TRIANGLES, 6, 6*i)
      if(this.drawSides[i]) {
        vao.draw(gl.TRIANGLES, 12, 18+12*i)
      }
    }
  }

  vao.unbind()
}

proto.update = function(options) {
  if(!options) {
    return
  }
  if("bounds" in options) {
    this.bounds = options.bounds
  }
  if("position" in options) {
    this.position = options.position
  }
  if("lineWidth" in options) {
    this.lineWidth = options.lineWidth
  }
  if("colors" in options) {
    this.colors = options.colors
  }
  if("enabled" in options) {
    this.enabled = options.enabled
  }
  if("drawSides" in options) {
    this.drawSides = options.drawSides
  }
}

proto.dispose = function() {
  this.vao.dispose()
  this.buffer.dispose()
  this.shader.dispose()
}



function createSpikes(gl, options) {
  //Create buffers
  var data = [ ]

  function line(x,y,z,i,l,h) {
    var row = [x,y,z,  0,0,0,  1]
    row[i+3] = 1
    row[i] = l
    data.push.apply(data, row)
    row[6] = -1
    data.push.apply(data, row)
    row[i] = h
    data.push.apply(data, row)
    data.push.apply(data, row)
    row[6] = 1
    data.push.apply(data, row)
    row[i] = l
    data.push.apply(data, row)
  }

  line(0,0,0, 0, 0, 1)
  line(0,0,0, 1, 0, 1)
  line(0,0,0, 2, 0, 1)

  line(1,0,0,  1,  -1,1)
  line(1,0,0,  2,  -1,1)

  line(0,1,0,  0,  -1,1)
  line(0,1,0,  2,  -1,1)

  line(0,0,1,  0,  -1,1)
  line(0,0,1,  1,  -1,1)

  var buffer = createBuffer(gl, data)
  var vao = createVAO(gl, [{
    type: gl.FLOAT,
    buffer: buffer,
    size: 3,
    offset: 0,
    stride: 28
  }, {
    type: gl.FLOAT,
    buffer: buffer,
    size: 3,
    offset: 12,
    stride: 28
  }, {
    type: gl.FLOAT,
    buffer: buffer,
    size: 1,
    offset: 24,
    stride: 28
  }])

  //Create shader
  var shader = createShader(gl)
  shader.attributes.position.location = 0
  shader.attributes.color.location = 1
  shader.attributes.weight.location = 2

  //Create spike object
  var spikes = new AxisSpikes(gl, buffer, vao, shader)

  //Set parameters
  spikes.update(options)

  //Return resulting object
  return spikes
}

},{"./shaders/index":122,"gl-buffer":81,"gl-vao":128}],124:[function(require,module,exports){
'use strict'

var ndarray = require('ndarray')
var ops     = require('ndarray-ops')
var pool    = require('typedarray-pool')

module.exports = createTexture2D

var linearTypes = null
var filterTypes = null
var wrapTypes   = null

function lazyInitLinearTypes(gl) {
  linearTypes = [
    gl.LINEAR,
    gl.NEAREST_MIPMAP_LINEAR,
    gl.LINEAR_MIPMAP_NEAREST,
    gl.LINEAR_MIPMAP_NEAREST
  ]
  filterTypes = [
    gl.NEAREST,
    gl.LINEAR,
    gl.NEAREST_MIPMAP_NEAREST,
    gl.NEAREST_MIPMAP_LINEAR,
    gl.LINEAR_MIPMAP_NEAREST,
    gl.LINEAR_MIPMAP_LINEAR
  ]
  wrapTypes = [
    gl.REPEAT,
    gl.CLAMP_TO_EDGE,
    gl.MIRRORED_REPEAT
  ]
}

function acceptTextureDOM (obj) {
  return (
    ('undefined' != typeof HTMLCanvasElement && obj instanceof HTMLCanvasElement) ||
    ('undefined' != typeof HTMLImageElement && obj instanceof HTMLImageElement) ||
    ('undefined' != typeof HTMLVideoElement && obj instanceof HTMLVideoElement) ||
    ('undefined' != typeof ImageData && obj instanceof ImageData))
}

var convertFloatToUint8 = function(out, inp) {
  ops.muls(out, inp, 255.0)
}

function reshapeTexture(tex, w, h) {
  var gl = tex.gl
  var maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  if(w < 0 || w > maxSize || h < 0 || h > maxSize) {
    throw new Error('gl-texture2d: Invalid texture size')
  }
  tex._shape = [w, h]
  tex.bind()
  gl.texImage2D(gl.TEXTURE_2D, 0, tex.format, w, h, 0, tex.format, tex.type, null)
  tex._mipLevels = [0]
  return tex
}

function Texture2D(gl, handle, width, height, format, type) {
  this.gl = gl
  this.handle = handle
  this.format = format
  this.type = type
  this._shape = [width, height]
  this._mipLevels = [0]
  this._magFilter = gl.NEAREST
  this._minFilter = gl.NEAREST
  this._wrapS = gl.CLAMP_TO_EDGE
  this._wrapT = gl.CLAMP_TO_EDGE
  this._anisoSamples = 1

  var parent = this
  var wrapVector = [this._wrapS, this._wrapT]
  Object.defineProperties(wrapVector, [
    {
      get: function() {
        return parent._wrapS
      },
      set: function(v) {
        return parent.wrapS = v
      }
    },
    {
      get: function() {
        return parent._wrapT
      },
      set: function(v) {
        return parent.wrapT = v
      }
    }
  ])
  this._wrapVector = wrapVector

  var shapeVector = [this._shape[0], this._shape[1]]
  Object.defineProperties(shapeVector, [
    {
      get: function() {
        return parent._shape[0]
      },
      set: function(v) {
        return parent.width = v
      }
    },
    {
      get: function() {
        return parent._shape[1]
      },
      set: function(v) {
        return parent.height = v
      }
    }
  ])
  this._shapeVector = shapeVector
}

var proto = Texture2D.prototype

Object.defineProperties(proto, {
  minFilter: {
    get: function() {
      return this._minFilter
    },
    set: function(v) {
      this.bind()
      var gl = this.gl
      if(this.type === gl.FLOAT && linearTypes.indexOf(v) >= 0) {
        if(!gl.getExtension('OES_texture_float_linear')) {
          v = gl.NEAREST
        }
      }
      if(filterTypes.indexOf(v) < 0) {
        throw new Error('gl-texture2d: Unknown filter mode ' + v)
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, v)
      return this._minFilter = v
    }
  },
  magFilter: {
    get: function() {
      return this._magFilter
    },
    set: function(v) {
      this.bind()
      var gl = this.gl
      if(this.type === gl.FLOAT && linearTypes.indexOf(v) >= 0) {
        if(!gl.getExtension('OES_texture_float_linear')) {
          v = gl.NEAREST
        }
      }
      if(filterTypes.indexOf(v) < 0) {
        throw new Error('gl-texture2d: Unknown filter mode ' + v)
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, v)
      return this._magFilter = v
    }
  },
  mipSamples: {
    get: function() {
      return this._anisoSamples
    },
    set: function(i) {
      var psamples = this._anisoSamples
      this._anisoSamples = Math.max(i, 1)|0
      if(psamples !== this._anisoSamples) {
        var ext = this.gl.getExtension('EXT_texture_filter_anisotropic')
        if(ext) {
          this.gl.texParameterf(this.gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, this._anisoSamples)
        }
      }
      return this._anisoSamples
    }
  },
  wrapS: {
    get: function() {
      return this._wrapS
    },
    set: function(v) {
      this.bind()
      if(wrapTypes.indexOf(v) < 0) {
        throw new Error('gl-texture2d: Unknown wrap mode ' + v)
      }
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, v)
      return this._wrapS = v
    }
  },
  wrapT: {
    get: function() {
      return this._wrapT
    },
    set: function(v) {
      this.bind()
      if(wrapTypes.indexOf(v) < 0) {
        throw new Error('gl-texture2d: Unknown wrap mode ' + v)
      }
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, v)
      return this._wrapT = v
    }
  },
  wrap: {
    get: function() {
      return this._wrapVector
    },
    set: function(v) {
      if(!Array.isArray(v)) {
        v = [v,v]
      }
      if(v.length !== 2) {
        throw new Error('gl-texture2d: Must specify wrap mode for rows and columns')
      }
      for(var i=0; i<2; ++i) {
        if(wrapTypes.indexOf(v[i]) < 0) {
          throw new Error('gl-texture2d: Unknown wrap mode ' + v)
        }
      }
      this._wrapS = v[0]
      this._wrapT = v[1]

      var gl = this.gl
      this.bind()
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, this._wrapS)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, this._wrapT)

      return v
    }
  },
  shape: {
    get: function() {
      return this._shapeVector
    },
    set: function(x) {
      if(!Array.isArray(x)) {
        x = [x|0,x|0]
      } else {
        if(x.length !== 2) {
          throw new Error('gl-texture2d: Invalid texture shape')
        }
      }
      reshapeTexture(this, x[0]|0, x[1]|0)
      return [x[0]|0, x[1]|0]
    }
  },
  width: {
    get: function() {
      return this._shape[0]
    },
    set: function(w) {
      w = w|0
      reshapeTexture(this, w, this._shape[1])
      return w
    }
  },
  height: {
    get: function() {
      return this._shape[1]
    },
    set: function(h) {
      h = h|0
      reshapeTexture(this, this._shape[0], h)
      return h
    }
  }
})

proto.bind = function(unit) {
  var gl = this.gl
  if(unit !== undefined) {
    gl.activeTexture(gl.TEXTURE0 + (unit|0))
  }
  gl.bindTexture(gl.TEXTURE_2D, this.handle)
  if(unit !== undefined) {
    return (unit|0)
  }
  return gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0
}

proto.dispose = function() {
  this.gl.deleteTexture(this.handle)
}

proto.generateMipmap = function() {
  this.bind()
  this.gl.generateMipmap(this.gl.TEXTURE_2D)

  //Update mip levels
  var l = Math.min(this._shape[0], this._shape[1])
  for(var i=0; l>0; ++i, l>>>=1) {
    if(this._mipLevels.indexOf(i) < 0) {
      this._mipLevels.push(i)
    }
  }
}

proto.setPixels = function(data, x_off, y_off, mip_level) {
  var gl = this.gl
  this.bind()
  if(Array.isArray(x_off)) {
    mip_level = y_off
    y_off = x_off[1]|0
    x_off = x_off[0]|0
  } else {
    x_off = x_off || 0
    y_off = y_off || 0
  }
  mip_level = mip_level || 0
  var directData = acceptTextureDOM(data) ? data : data.raw
  if(directData) {
    var needsMip = this._mipLevels.indexOf(mip_level) < 0
    if(needsMip) {
      gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, this.type, directData)
      this._mipLevels.push(mip_level)
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, mip_level, x_off, y_off, this.format, this.type, directData)
    }
  } else if(data.shape && data.stride && data.data) {
    if(data.shape.length < 2 ||
       x_off + data.shape[1] > this._shape[1]>>>mip_level ||
       y_off + data.shape[0] > this._shape[0]>>>mip_level ||
       x_off < 0 ||
       y_off < 0) {
      throw new Error('gl-texture2d: Texture dimensions are out of bounds')
    }
    texSubImageArray(gl, x_off, y_off, mip_level, this.format, this.type, this._mipLevels, data)
  } else {
    throw new Error('gl-texture2d: Unsupported data type')
  }
}


function isPacked(shape, stride) {
  if(shape.length === 3) {
    return  (stride[2] === 1) &&
            (stride[1] === shape[0]*shape[2]) &&
            (stride[0] === shape[2])
  }
  return  (stride[0] === 1) &&
          (stride[1] === shape[0])
}

function texSubImageArray(gl, x_off, y_off, mip_level, cformat, ctype, mipLevels, array) {
  var dtype = array.dtype
  var shape = array.shape.slice()
  if(shape.length < 2 || shape.length > 3) {
    throw new Error('gl-texture2d: Invalid ndarray, must be 2d or 3d')
  }
  var type = 0, format = 0
  var packed = isPacked(shape, array.stride.slice())
  if(dtype === 'float32') {
    type = gl.FLOAT
  } else if(dtype === 'float64') {
    type = gl.FLOAT
    packed = false
    dtype = 'float32'
  } else if(dtype === 'uint8') {
    type = gl.UNSIGNED_BYTE
  } else {
    type = gl.UNSIGNED_BYTE
    packed = false
    dtype = 'uint8'
  }
  var channels = 1
  if(shape.length === 2) {
    format = gl.LUMINANCE
    shape = [shape[0], shape[1], 1]
    array = ndarray(array.data, shape, [array.stride[0], array.stride[1], 1], array.offset)
  } else if(shape.length === 3) {
    if(shape[2] === 1) {
      format = gl.ALPHA
    } else if(shape[2] === 2) {
      format = gl.LUMINANCE_ALPHA
    } else if(shape[2] === 3) {
      format = gl.RGB
    } else if(shape[2] === 4) {
      format = gl.RGBA
    } else {
      throw new Error('gl-texture2d: Invalid shape for pixel coords')
    }
    channels = shape[2]
  } else {
    throw new Error('gl-texture2d: Invalid shape for texture')
  }
  //For 1-channel textures allow conversion between formats
  if((format  === gl.LUMINANCE || format  === gl.ALPHA) &&
     (cformat === gl.LUMINANCE || cformat === gl.ALPHA)) {
    format = cformat
  }
  if(format !== cformat) {
    throw new Error('gl-texture2d: Incompatible texture format for setPixels')
  }
  var size = array.size
  var needsMip = mipLevels.indexOf(mip_level) < 0
  if(needsMip) {
    mipLevels.push(mip_level)
  }
  if(type === ctype && packed) {
    //Array data types are compatible, can directly copy into texture
    if(array.offset === 0 && array.data.length === size) {
      if(needsMip) {
        gl.texImage2D(gl.TEXTURE_2D, mip_level, cformat, shape[0], shape[1], 0, cformat, ctype, array.data)
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, mip_level, x_off, y_off, shape[0], shape[1], cformat, ctype, array.data)
      }
    } else {
      if(needsMip) {
        gl.texImage2D(gl.TEXTURE_2D, mip_level, cformat, shape[0], shape[1], 0, cformat, ctype, array.data.subarray(array.offset, array.offset+size))
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, mip_level, x_off, y_off, shape[0], shape[1], cformat, ctype, array.data.subarray(array.offset, array.offset+size))
      }
    }
  } else {
    //Need to do type conversion to pack data into buffer
    var pack_buffer
    if(ctype === gl.FLOAT) {
      pack_buffer = pool.mallocFloat32(size)
    } else {
      pack_buffer = pool.mallocUint8(size)
    }
    var pack_view = ndarray(pack_buffer, shape, [shape[2], shape[2]*shape[0], 1])
    if(type === gl.FLOAT && ctype === gl.UNSIGNED_BYTE) {
      convertFloatToUint8(pack_view, array)
    } else {
      ops.assign(pack_view, array)
    }
    if(needsMip) {
      gl.texImage2D(gl.TEXTURE_2D, mip_level, cformat, shape[0], shape[1], 0, cformat, ctype, pack_buffer.subarray(0, size))
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, mip_level, x_off, y_off, shape[0], shape[1], cformat, ctype, pack_buffer.subarray(0, size))
    }
    if(ctype === gl.FLOAT) {
      pool.freeFloat32(pack_buffer)
    } else {
      pool.freeUint8(pack_buffer)
    }
  }
}

function initTexture(gl) {
  var tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
}

function createTextureShape(gl, width, height, format, type) {
  var maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  if(width < 0 || width > maxTextureSize || height < 0 || height  > maxTextureSize) {
    throw new Error('gl-texture2d: Invalid texture shape')
  }
  if(type === gl.FLOAT && !gl.getExtension('OES_texture_float')) {
    throw new Error('gl-texture2d: Floating point textures not supported on this platform')
  }
  var tex = initTexture(gl)
  gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, null)
  return new Texture2D(gl, tex, width, height, format, type)
}

function createTextureDOM(gl, directData, width, height, format, type) {
  var tex = initTexture(gl)
  gl.texImage2D(gl.TEXTURE_2D, 0, format, format, type, directData)
  return new Texture2D(gl, tex, width, height, format, type)
}

//Creates a texture from an ndarray
function createTextureArray(gl, array) {
  var dtype = array.dtype
  var shape = array.shape.slice()
  var maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  if(shape[0] < 0 || shape[0] > maxSize || shape[1] < 0 || shape[1] > maxSize) {
    throw new Error('gl-texture2d: Invalid texture size')
  }
  var packed = isPacked(shape, array.stride.slice())
  var type = 0
  if(dtype === 'float32') {
    type = gl.FLOAT
  } else if(dtype === 'float64') {
    type = gl.FLOAT
    packed = false
    dtype = 'float32'
  } else if(dtype === 'uint8') {
    type = gl.UNSIGNED_BYTE
  } else {
    type = gl.UNSIGNED_BYTE
    packed = false
    dtype = 'uint8'
  }
  var format = 0
  if(shape.length === 2) {
    format = gl.LUMINANCE
    shape = [shape[0], shape[1], 1]
    array = ndarray(array.data, shape, [array.stride[0], array.stride[1], 1], array.offset)
  } else if(shape.length === 3) {
    if(shape[2] === 1) {
      format = gl.ALPHA
    } else if(shape[2] === 2) {
      format = gl.LUMINANCE_ALPHA
    } else if(shape[2] === 3) {
      format = gl.RGB
    } else if(shape[2] === 4) {
      format = gl.RGBA
    } else {
      throw new Error('gl-texture2d: Invalid shape for pixel coords')
    }
  } else {
    throw new Error('gl-texture2d: Invalid shape for texture')
  }
  if(type === gl.FLOAT && !gl.getExtension('OES_texture_float')) {
    type = gl.UNSIGNED_BYTE
    packed = false
  }
  var buffer, buf_store
  var size = array.size
  if(!packed) {
    var stride = [shape[2], shape[2]*shape[0], 1]
    buf_store = pool.malloc(size, dtype)
    var buf_array = ndarray(buf_store, shape, stride, 0)
    if((dtype === 'float32' || dtype === 'float64') && type === gl.UNSIGNED_BYTE) {
      convertFloatToUint8(buf_array, array)
    } else {
      ops.assign(buf_array, array)
    }
    buffer = buf_store.subarray(0, size)
  } else if (array.offset === 0 && array.data.length === size) {
    buffer = array.data
  } else {
    buffer = array.data.subarray(array.offset, array.offset + size)
  }
  var tex = initTexture(gl)
  gl.texImage2D(gl.TEXTURE_2D, 0, format, shape[0], shape[1], 0, format, type, buffer)
  if(!packed) {
    pool.free(buf_store)
  }
  return new Texture2D(gl, tex, shape[0], shape[1], format, type)
}

function createTexture2D(gl) {
  if(arguments.length <= 1) {
    throw new Error('gl-texture2d: Missing arguments for texture2d constructor')
  }
  if(!linearTypes) {
    lazyInitLinearTypes(gl)
  }
  if(typeof arguments[1] === 'number') {
    return createTextureShape(gl, arguments[1], arguments[2], arguments[3]||gl.RGBA, arguments[4]||gl.UNSIGNED_BYTE)
  }
  if(Array.isArray(arguments[1])) {
    return createTextureShape(gl, arguments[1][0]|0, arguments[1][1]|0, arguments[2]||gl.RGBA, arguments[3]||gl.UNSIGNED_BYTE)
  }
  if(typeof arguments[1] === 'object') {
    var obj = arguments[1]
    var directData = acceptTextureDOM(obj) ? obj : obj.raw
    if (directData) {
      return createTextureDOM(gl, directData, obj.width|0, obj.height|0, arguments[2]||gl.RGBA, arguments[3]||gl.UNSIGNED_BYTE)
    } else if(obj.shape && obj.data && obj.stride) {
      return createTextureArray(gl, obj)
    }
  }
  throw new Error('gl-texture2d: Invalid arguments for texture2d constructor')
}

},{"ndarray":164,"ndarray-ops":161,"typedarray-pool":212}],125:[function(require,module,exports){
"use strict"

function doBind(gl, elements, attributes) {
  if(elements) {
    elements.bind()
  } else {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }
  var nattribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS)|0
  if(attributes) {
    if(attributes.length > nattribs) {
      throw new Error("gl-vao: Too many vertex attributes")
    }
    for(var i=0; i<attributes.length; ++i) {
      var attrib = attributes[i]
      if(attrib.buffer) {
        var buffer = attrib.buffer
        var size = attrib.size || 4
        var type = attrib.type || gl.FLOAT
        var normalized = !!attrib.normalized
        var stride = attrib.stride || 0
        var offset = attrib.offset || 0
        buffer.bind()
        gl.enableVertexAttribArray(i)
        gl.vertexAttribPointer(i, size, type, normalized, stride, offset)
      } else {
        if(typeof attrib === "number") {
          gl.vertexAttrib1f(i, attrib)
        } else if(attrib.length === 1) {
          gl.vertexAttrib1f(i, attrib[0])
        } else if(attrib.length === 2) {
          gl.vertexAttrib2f(i, attrib[0], attrib[1])
        } else if(attrib.length === 3) {
          gl.vertexAttrib3f(i, attrib[0], attrib[1], attrib[2])
        } else if(attrib.length === 4) {
          gl.vertexAttrib4f(i, attrib[0], attrib[1], attrib[2], attrib[3])
        } else {
          throw new Error("gl-vao: Invalid vertex attribute")
        }
        gl.disableVertexAttribArray(i)
      }
    }
    for(; i<nattribs; ++i) {
      gl.disableVertexAttribArray(i)
    }
  } else {
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    for(var i=0; i<nattribs; ++i) {
      gl.disableVertexAttribArray(i)
    }
  }
}

module.exports = doBind
},{}],126:[function(require,module,exports){
"use strict"

var bindAttribs = require("./do-bind.js")

function VAOEmulated(gl) {
  this.gl = gl
  this._elements = null
  this._attributes = null
  this._elementsType = gl.UNSIGNED_SHORT
}

VAOEmulated.prototype.bind = function() {
  bindAttribs(this.gl, this._elements, this._attributes)
}

VAOEmulated.prototype.update = function(attributes, elements, elementsType) {
  this._elements = elements
  this._attributes = attributes
  this._elementsType = elementsType || this.gl.UNSIGNED_SHORT
}

VAOEmulated.prototype.dispose = function() { }
VAOEmulated.prototype.unbind = function() { }

VAOEmulated.prototype.draw = function(mode, count, offset) {
  offset = offset || 0
  var gl = this.gl
  if(this._elements) {
    gl.drawElements(mode, count, this._elementsType, offset)
  } else {
    gl.drawArrays(mode, offset, count)
  }
}

function createVAOEmulated(gl) {
  return new VAOEmulated(gl)
}

module.exports = createVAOEmulated
},{"./do-bind.js":125}],127:[function(require,module,exports){
"use strict"

var bindAttribs = require("./do-bind.js")

function VertexAttribute(location, dimension, a, b, c, d) {
  this.location = location
  this.dimension = dimension
  this.a = a
  this.b = b
  this.c = c
  this.d = d
}

VertexAttribute.prototype.bind = function(gl) {
  switch(this.dimension) {
    case 1:
      gl.vertexAttrib1f(this.location, this.a)
    break
    case 2:
      gl.vertexAttrib2f(this.location, this.a, this.b)
    break
    case 3:
      gl.vertexAttrib3f(this.location, this.a, this.b, this.c)
    break
    case 4:
      gl.vertexAttrib4f(this.location, this.a, this.b, this.c, this.d)
    break
  }
}

function VAONative(gl, ext, handle) {
  this.gl = gl
  this._ext = ext
  this.handle = handle
  this._attribs = []
  this._useElements = false
  this._elementsType = gl.UNSIGNED_SHORT
}

VAONative.prototype.bind = function() {
  this._ext.bindVertexArrayOES(this.handle)
  for(var i=0; i<this._attribs.length; ++i) {
    this._attribs[i].bind(this.gl)
  }
}

VAONative.prototype.unbind = function() {
  this._ext.bindVertexArrayOES(null)
}

VAONative.prototype.dispose = function() {
  this._ext.deleteVertexArrayOES(this.handle)
}

VAONative.prototype.update = function(attributes, elements, elementsType) {
  this.bind()
  bindAttribs(this.gl, elements, attributes)
  this.unbind()
  this._attribs.length = 0
  if(attributes)
  for(var i=0; i<attributes.length; ++i) {
    var a = attributes[i]
    if(typeof a === "number") {
      this._attribs.push(new VertexAttribute(i, 1, a))
    } else if(Array.isArray(a)) {
      this._attribs.push(new VertexAttribute(i, a.length, a[0], a[1], a[2], a[3]))
    }
  }
  this._useElements = !!elements
  this._elementsType = elementsType || this.gl.UNSIGNED_SHORT
}

VAONative.prototype.draw = function(mode, count, offset) {
  offset = offset || 0
  var gl = this.gl
  if(this._useElements) {
    gl.drawElements(mode, count, this._elementsType, offset)
  } else {
    gl.drawArrays(mode, offset, count)
  }
}

function createVAONative(gl, ext) {
  return new VAONative(gl, ext, ext.createVertexArrayOES())
}

module.exports = createVAONative
},{"./do-bind.js":125}],128:[function(require,module,exports){
"use strict"

var createVAONative = require("./lib/vao-native.js")
var createVAOEmulated = require("./lib/vao-emulated.js")

function ExtensionShim (gl) {
  this.bindVertexArrayOES = gl.bindVertexArray.bind(gl)
  this.createVertexArrayOES = gl.createVertexArray.bind(gl)
  this.deleteVertexArrayOES = gl.deleteVertexArray.bind(gl)
}

function createVAO(gl, attributes, elements, elementsType) {
  var ext = gl.createVertexArray
    ? new ExtensionShim(gl)
    : gl.getExtension('OES_vertex_array_object')
  var vao

  if(ext) {
    vao = createVAONative(gl, ext)
  } else {
    vao = createVAOEmulated(gl)
  }
  vao.update(attributes, elements, elementsType)
  return vao
}

module.exports = createVAO

},{"./lib/vao-emulated.js":126,"./lib/vao-native.js":127}],129:[function(require,module,exports){
module.exports = cross;

/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
function cross(out, a, b) {
    var ax = a[0], ay = a[1], az = a[2],
        bx = b[0], by = b[1], bz = b[2]

    out[0] = ay * bz - az * by
    out[1] = az * bx - ax * bz
    out[2] = ax * by - ay * bx
    return out
}
},{}],130:[function(require,module,exports){
module.exports = dot;

/**
 * Calculates the dot product of two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} dot product of a and b
 */
function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
},{}],131:[function(require,module,exports){
module.exports = length;

/**
 * Calculates the length of a vec3
 *
 * @param {vec3} a vector to calculate length of
 * @returns {Number} length of a
 */
function length(a) {
    var x = a[0],
        y = a[1],
        z = a[2]
    return Math.sqrt(x*x + y*y + z*z)
}
},{}],132:[function(require,module,exports){
module.exports = lerp;

/**
 * Performs a linear interpolation between two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec3} out
 */
function lerp(out, a, b, t) {
    var ax = a[0],
        ay = a[1],
        az = a[2]
    out[0] = ax + t * (b[0] - ax)
    out[1] = ay + t * (b[1] - ay)
    out[2] = az + t * (b[2] - az)
    return out
}
},{}],133:[function(require,module,exports){
module.exports = normalize;

/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to normalize
 * @returns {vec3} out
 */
function normalize(out, a) {
    var x = a[0],
        y = a[1],
        z = a[2]
    var len = x*x + y*y + z*z
    if (len > 0) {
        //TODO: evaluate use of glm_invsqrt here?
        len = 1 / Math.sqrt(len)
        out[0] = a[0] * len
        out[1] = a[1] * len
        out[2] = a[2] * len
    }
    return out
}
},{}],134:[function(require,module,exports){
var tokenize = require('glsl-tokenizer')
var atob     = require('atob-lite')

module.exports = getName

function getName(src) {
  var tokens = Array.isArray(src)
    ? src
    : tokenize(src)

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]
    if (token.type !== 'preprocessor') continue
    var match = token.data.match(/\#define\s+SHADER_NAME(_B64)?\s+(.+)$/)
    if (!match) continue
    if (!match[2]) continue

    var b64  = match[1]
    var name = match[2]

    return (b64 ? atob(name) : name).trim()
  }
}

},{"atob-lite":16,"glsl-tokenizer":141}],135:[function(require,module,exports){
module.exports = tokenize

var literals100 = require('./lib/literals')
  , operators = require('./lib/operators')
  , builtins100 = require('./lib/builtins')
  , literals300es = require('./lib/literals-300es')
  , builtins300es = require('./lib/builtins-300es')

var NORMAL = 999          // <-- never emitted
  , TOKEN = 9999          // <-- never emitted
  , BLOCK_COMMENT = 0
  , LINE_COMMENT = 1
  , PREPROCESSOR = 2
  , OPERATOR = 3
  , INTEGER = 4
  , FLOAT = 5
  , IDENT = 6
  , BUILTIN = 7
  , KEYWORD = 8
  , WHITESPACE = 9
  , EOF = 10
  , HEX = 11

var map = [
    'block-comment'
  , 'line-comment'
  , 'preprocessor'
  , 'operator'
  , 'integer'
  , 'float'
  , 'ident'
  , 'builtin'
  , 'keyword'
  , 'whitespace'
  , 'eof'
  , 'integer'
]

function tokenize(opt) {
  var i = 0
    , total = 0
    , mode = NORMAL
    , c
    , last
    , content = []
    , tokens = []
    , token_idx = 0
    , token_offs = 0
    , line = 1
    , col = 0
    , start = 0
    , isnum = false
    , isoperator = false
    , input = ''
    , len

  opt = opt || {}
  var allBuiltins = builtins100
  var allLiterals = literals100
  if (opt.version === '300 es') {
    allBuiltins = builtins300es
    allLiterals = literals300es
  }

  return function(data) {
    tokens = []
    if (data !== null) return write(data.replace ? data.replace(/\r\n/g, '\n') : data)
    return end()
  }

  function token(data) {
    if (data.length) {
      tokens.push({
        type: map[mode]
      , data: data
      , position: start
      , line: line
      , column: col
      })
    }
  }

  function write(chunk) {
    i = 0
    input += chunk
    len = input.length

    var last

    while(c = input[i], i < len) {
      last = i

      switch(mode) {
        case BLOCK_COMMENT: i = block_comment(); break
        case LINE_COMMENT: i = line_comment(); break
        case PREPROCESSOR: i = preprocessor(); break
        case OPERATOR: i = operator(); break
        case INTEGER: i = integer(); break
        case HEX: i = hex(); break
        case FLOAT: i = decimal(); break
        case TOKEN: i = readtoken(); break
        case WHITESPACE: i = whitespace(); break
        case NORMAL: i = normal(); break
      }

      if(last !== i) {
        switch(input[last]) {
          case '\n': col = 0; ++line; break
          default: ++col; break
        }
      }
    }

    total += i
    input = input.slice(i)
    return tokens
  }

  function end(chunk) {
    if(content.length) {
      token(content.join(''))
    }

    mode = EOF
    token('(eof)')
    return tokens
  }

  function normal() {
    content = content.length ? [] : content

    if(last === '/' && c === '*') {
      start = total + i - 1
      mode = BLOCK_COMMENT
      last = c
      return i + 1
    }

    if(last === '/' && c === '/') {
      start = total + i - 1
      mode = LINE_COMMENT
      last = c
      return i + 1
    }

    if(c === '#') {
      mode = PREPROCESSOR
      start = total + i
      return i
    }

    if(/\s/.test(c)) {
      mode = WHITESPACE
      start = total + i
      return i
    }

    isnum = /\d/.test(c)
    isoperator = /[^\w_]/.test(c)

    start = total + i
    mode = isnum ? INTEGER : isoperator ? OPERATOR : TOKEN
    return i
  }

  function whitespace() {
    if(/[^\s]/g.test(c)) {
      token(content.join(''))
      mode = NORMAL
      return i
    }
    content.push(c)
    last = c
    return i + 1
  }

  function preprocessor() {
    if((c === '\r' || c === '\n') && last !== '\\') {
      token(content.join(''))
      mode = NORMAL
      return i
    }
    content.push(c)
    last = c
    return i + 1
  }

  function line_comment() {
    return preprocessor()
  }

  function block_comment() {
    if(c === '/' && last === '*') {
      content.push(c)
      token(content.join(''))
      mode = NORMAL
      return i + 1
    }

    content.push(c)
    last = c
    return i + 1
  }

  function operator() {
    if(last === '.' && /\d/.test(c)) {
      mode = FLOAT
      return i
    }

    if(last === '/' && c === '*') {
      mode = BLOCK_COMMENT
      return i
    }

    if(last === '/' && c === '/') {
      mode = LINE_COMMENT
      return i
    }

    if(c === '.' && content.length) {
      while(determine_operator(content));

      mode = FLOAT
      return i
    }

    if(c === ';' || c === ')' || c === '(') {
      if(content.length) while(determine_operator(content));
      token(c)
      mode = NORMAL
      return i + 1
    }

    var is_composite_operator = content.length === 2 && c !== '='
    if(/[\w_\d\s]/.test(c) || is_composite_operator) {
      while(determine_operator(content));
      mode = NORMAL
      return i
    }

    content.push(c)
    last = c
    return i + 1
  }

  function determine_operator(buf) {
    var j = 0
      , idx
      , res

    do {
      idx = operators.indexOf(buf.slice(0, buf.length + j).join(''))
      res = operators[idx]

      if(idx === -1) {
        if(j-- + buf.length > 0) continue
        res = buf.slice(0, 1).join('')
      }

      token(res)

      start += res.length
      content = content.slice(res.length)
      return content.length
    } while(1)
  }

  function hex() {
    if(/[^a-fA-F0-9]/.test(c)) {
      token(content.join(''))
      mode = NORMAL
      return i
    }

    content.push(c)
    last = c
    return i + 1
  }

  function integer() {
    if(c === '.') {
      content.push(c)
      mode = FLOAT
      last = c
      return i + 1
    }

    if(/[eE]/.test(c)) {
      content.push(c)
      mode = FLOAT
      last = c
      return i + 1
    }

    if(c === 'x' && content.length === 1 && content[0] === '0') {
      mode = HEX
      content.push(c)
      last = c
      return i + 1
    }

    if(/[^\d]/.test(c)) {
      token(content.join(''))
      mode = NORMAL
      return i
    }

    content.push(c)
    last = c
    return i + 1
  }

  function decimal() {
    if(c === 'f') {
      content.push(c)
      last = c
      i += 1
    }

    if(/[eE]/.test(c)) {
      content.push(c)
      last = c
      return i + 1
    }

    if (c === '-' && /[eE]/.test(last)) {
      content.push(c)
      last = c
      return i + 1
    }

    if(/[^\d]/.test(c)) {
      token(content.join(''))
      mode = NORMAL
      return i
    }

    content.push(c)
    last = c
    return i + 1
  }

  function readtoken() {
    if(/[^\d\w_]/.test(c)) {
      var contentstr = content.join('')
      if(allLiterals.indexOf(contentstr) > -1) {
        mode = KEYWORD
      } else if(allBuiltins.indexOf(contentstr) > -1) {
        mode = BUILTIN
      } else {
        mode = IDENT
      }
      token(content.join(''))
      mode = NORMAL
      return i
    }
    content.push(c)
    last = c
    return i + 1
  }
}

},{"./lib/builtins":137,"./lib/builtins-300es":136,"./lib/literals":139,"./lib/literals-300es":138,"./lib/operators":140}],136:[function(require,module,exports){
// 300es builtins/reserved words that were previously valid in v100
var v100 = require('./builtins')

// The texture2D|Cube functions have been removed
// And the gl_ features are updated
v100 = v100.slice().filter(function (b) {
  return !/^(gl\_|texture)/.test(b)
})

module.exports = v100.concat([
  // the updated gl_ constants
    'gl_VertexID'
  , 'gl_InstanceID'
  , 'gl_Position'
  , 'gl_PointSize'
  , 'gl_FragCoord'
  , 'gl_FrontFacing'
  , 'gl_FragDepth'
  , 'gl_PointCoord'
  , 'gl_MaxVertexAttribs'
  , 'gl_MaxVertexUniformVectors'
  , 'gl_MaxVertexOutputVectors'
  , 'gl_MaxFragmentInputVectors'
  , 'gl_MaxVertexTextureImageUnits'
  , 'gl_MaxCombinedTextureImageUnits'
  , 'gl_MaxTextureImageUnits'
  , 'gl_MaxFragmentUniformVectors'
  , 'gl_MaxDrawBuffers'
  , 'gl_MinProgramTexelOffset'
  , 'gl_MaxProgramTexelOffset'
  , 'gl_DepthRangeParameters'
  , 'gl_DepthRange'

  // other builtins
  , 'trunc'
  , 'round'
  , 'roundEven'
  , 'isnan'
  , 'isinf'
  , 'floatBitsToInt'
  , 'floatBitsToUint'
  , 'intBitsToFloat'
  , 'uintBitsToFloat'
  , 'packSnorm2x16'
  , 'unpackSnorm2x16'
  , 'packUnorm2x16'
  , 'unpackUnorm2x16'
  , 'packHalf2x16'
  , 'unpackHalf2x16'
  , 'outerProduct'
  , 'transpose'
  , 'determinant'
  , 'inverse'
  , 'texture'
  , 'textureSize'
  , 'textureProj'
  , 'textureLod'
  , 'textureOffset'
  , 'texelFetch'
  , 'texelFetchOffset'
  , 'textureProjOffset'
  , 'textureLodOffset'
  , 'textureProjLod'
  , 'textureProjLodOffset'
  , 'textureGrad'
  , 'textureGradOffset'
  , 'textureProjGrad'
  , 'textureProjGradOffset'
])

},{"./builtins":137}],137:[function(require,module,exports){
module.exports = [
  // Keep this list sorted
  'abs'
  , 'acos'
  , 'all'
  , 'any'
  , 'asin'
  , 'atan'
  , 'ceil'
  , 'clamp'
  , 'cos'
  , 'cross'
  , 'dFdx'
  , 'dFdy'
  , 'degrees'
  , 'distance'
  , 'dot'
  , 'equal'
  , 'exp'
  , 'exp2'
  , 'faceforward'
  , 'floor'
  , 'fract'
  , 'gl_BackColor'
  , 'gl_BackLightModelProduct'
  , 'gl_BackLightProduct'
  , 'gl_BackMaterial'
  , 'gl_BackSecondaryColor'
  , 'gl_ClipPlane'
  , 'gl_ClipVertex'
  , 'gl_Color'
  , 'gl_DepthRange'
  , 'gl_DepthRangeParameters'
  , 'gl_EyePlaneQ'
  , 'gl_EyePlaneR'
  , 'gl_EyePlaneS'
  , 'gl_EyePlaneT'
  , 'gl_Fog'
  , 'gl_FogCoord'
  , 'gl_FogFragCoord'
  , 'gl_FogParameters'
  , 'gl_FragColor'
  , 'gl_FragCoord'
  , 'gl_FragData'
  , 'gl_FragDepth'
  , 'gl_FragDepthEXT'
  , 'gl_FrontColor'
  , 'gl_FrontFacing'
  , 'gl_FrontLightModelProduct'
  , 'gl_FrontLightProduct'
  , 'gl_FrontMaterial'
  , 'gl_FrontSecondaryColor'
  , 'gl_LightModel'
  , 'gl_LightModelParameters'
  , 'gl_LightModelProducts'
  , 'gl_LightProducts'
  , 'gl_LightSource'
  , 'gl_LightSourceParameters'
  , 'gl_MaterialParameters'
  , 'gl_MaxClipPlanes'
  , 'gl_MaxCombinedTextureImageUnits'
  , 'gl_MaxDrawBuffers'
  , 'gl_MaxFragmentUniformComponents'
  , 'gl_MaxLights'
  , 'gl_MaxTextureCoords'
  , 'gl_MaxTextureImageUnits'
  , 'gl_MaxTextureUnits'
  , 'gl_MaxVaryingFloats'
  , 'gl_MaxVertexAttribs'
  , 'gl_MaxVertexTextureImageUnits'
  , 'gl_MaxVertexUniformComponents'
  , 'gl_ModelViewMatrix'
  , 'gl_ModelViewMatrixInverse'
  , 'gl_ModelViewMatrixInverseTranspose'
  , 'gl_ModelViewMatrixTranspose'
  , 'gl_ModelViewProjectionMatrix'
  , 'gl_ModelViewProjectionMatrixInverse'
  , 'gl_ModelViewProjectionMatrixInverseTranspose'
  , 'gl_ModelViewProjectionMatrixTranspose'
  , 'gl_MultiTexCoord0'
  , 'gl_MultiTexCoord1'
  , 'gl_MultiTexCoord2'
  , 'gl_MultiTexCoord3'
  , 'gl_MultiTexCoord4'
  , 'gl_MultiTexCoord5'
  , 'gl_MultiTexCoord6'
  , 'gl_MultiTexCoord7'
  , 'gl_Normal'
  , 'gl_NormalMatrix'
  , 'gl_NormalScale'
  , 'gl_ObjectPlaneQ'
  , 'gl_ObjectPlaneR'
  , 'gl_ObjectPlaneS'
  , 'gl_ObjectPlaneT'
  , 'gl_Point'
  , 'gl_PointCoord'
  , 'gl_PointParameters'
  , 'gl_PointSize'
  , 'gl_Position'
  , 'gl_ProjectionMatrix'
  , 'gl_ProjectionMatrixInverse'
  , 'gl_ProjectionMatrixInverseTranspose'
  , 'gl_ProjectionMatrixTranspose'
  , 'gl_SecondaryColor'
  , 'gl_TexCoord'
  , 'gl_TextureEnvColor'
  , 'gl_TextureMatrix'
  , 'gl_TextureMatrixInverse'
  , 'gl_TextureMatrixInverseTranspose'
  , 'gl_TextureMatrixTranspose'
  , 'gl_Vertex'
  , 'greaterThan'
  , 'greaterThanEqual'
  , 'inversesqrt'
  , 'length'
  , 'lessThan'
  , 'lessThanEqual'
  , 'log'
  , 'log2'
  , 'matrixCompMult'
  , 'max'
  , 'min'
  , 'mix'
  , 'mod'
  , 'normalize'
  , 'not'
  , 'notEqual'
  , 'pow'
  , 'radians'
  , 'reflect'
  , 'refract'
  , 'sign'
  , 'sin'
  , 'smoothstep'
  , 'sqrt'
  , 'step'
  , 'tan'
  , 'texture2D'
  , 'texture2DLod'
  , 'texture2DProj'
  , 'texture2DProjLod'
  , 'textureCube'
  , 'textureCubeLod'
  , 'texture2DLodEXT'
  , 'texture2DProjLodEXT'
  , 'textureCubeLodEXT'
  , 'texture2DGradEXT'
  , 'texture2DProjGradEXT'
  , 'textureCubeGradEXT'
]

},{}],138:[function(require,module,exports){
var v100 = require('./literals')

module.exports = v100.slice().concat([
   'layout'
  , 'centroid'
  , 'smooth'
  , 'case'
  , 'mat2x2'
  , 'mat2x3'
  , 'mat2x4'
  , 'mat3x2'
  , 'mat3x3'
  , 'mat3x4'
  , 'mat4x2'
  , 'mat4x3'
  , 'mat4x4'
  , 'uint'
  , 'uvec2'
  , 'uvec3'
  , 'uvec4'
  , 'samplerCubeShadow'
  , 'sampler2DArray'
  , 'sampler2DArrayShadow'
  , 'isampler2D'
  , 'isampler3D'
  , 'isamplerCube'
  , 'isampler2DArray'
  , 'usampler2D'
  , 'usampler3D'
  , 'usamplerCube'
  , 'usampler2DArray'
  , 'coherent'
  , 'restrict'
  , 'readonly'
  , 'writeonly'
  , 'resource'
  , 'atomic_uint'
  , 'noperspective'
  , 'patch'
  , 'sample'
  , 'subroutine'
  , 'common'
  , 'partition'
  , 'active'
  , 'filter'
  , 'image1D'
  , 'image2D'
  , 'image3D'
  , 'imageCube'
  , 'iimage1D'
  , 'iimage2D'
  , 'iimage3D'
  , 'iimageCube'
  , 'uimage1D'
  , 'uimage2D'
  , 'uimage3D'
  , 'uimageCube'
  , 'image1DArray'
  , 'image2DArray'
  , 'iimage1DArray'
  , 'iimage2DArray'
  , 'uimage1DArray'
  , 'uimage2DArray'
  , 'image1DShadow'
  , 'image2DShadow'
  , 'image1DArrayShadow'
  , 'image2DArrayShadow'
  , 'imageBuffer'
  , 'iimageBuffer'
  , 'uimageBuffer'
  , 'sampler1DArray'
  , 'sampler1DArrayShadow'
  , 'isampler1D'
  , 'isampler1DArray'
  , 'usampler1D'
  , 'usampler1DArray'
  , 'isampler2DRect'
  , 'usampler2DRect'
  , 'samplerBuffer'
  , 'isamplerBuffer'
  , 'usamplerBuffer'
  , 'sampler2DMS'
  , 'isampler2DMS'
  , 'usampler2DMS'
  , 'sampler2DMSArray'
  , 'isampler2DMSArray'
  , 'usampler2DMSArray'
])

},{"./literals":139}],139:[function(require,module,exports){
module.exports = [
  // current
    'precision'
  , 'highp'
  , 'mediump'
  , 'lowp'
  , 'attribute'
  , 'const'
  , 'uniform'
  , 'varying'
  , 'break'
  , 'continue'
  , 'do'
  , 'for'
  , 'while'
  , 'if'
  , 'else'
  , 'in'
  , 'out'
  , 'inout'
  , 'float'
  , 'int'
  , 'void'
  , 'bool'
  , 'true'
  , 'false'
  , 'discard'
  , 'return'
  , 'mat2'
  , 'mat3'
  , 'mat4'
  , 'vec2'
  , 'vec3'
  , 'vec4'
  , 'ivec2'
  , 'ivec3'
  , 'ivec4'
  , 'bvec2'
  , 'bvec3'
  , 'bvec4'
  , 'sampler1D'
  , 'sampler2D'
  , 'sampler3D'
  , 'samplerCube'
  , 'sampler1DShadow'
  , 'sampler2DShadow'
  , 'struct'

  // future
  , 'asm'
  , 'class'
  , 'union'
  , 'enum'
  , 'typedef'
  , 'template'
  , 'this'
  , 'packed'
  , 'goto'
  , 'switch'
  , 'default'
  , 'inline'
  , 'noinline'
  , 'volatile'
  , 'public'
  , 'static'
  , 'extern'
  , 'external'
  , 'interface'
  , 'long'
  , 'short'
  , 'double'
  , 'half'
  , 'fixed'
  , 'unsigned'
  , 'input'
  , 'output'
  , 'hvec2'
  , 'hvec3'
  , 'hvec4'
  , 'dvec2'
  , 'dvec3'
  , 'dvec4'
  , 'fvec2'
  , 'fvec3'
  , 'fvec4'
  , 'sampler2DRect'
  , 'sampler3DRect'
  , 'sampler2DRectShadow'
  , 'sizeof'
  , 'cast'
  , 'namespace'
  , 'using'
]

},{}],140:[function(require,module,exports){
module.exports = [
    '<<='
  , '>>='
  , '++'
  , '--'
  , '<<'
  , '>>'
  , '<='
  , '>='
  , '=='
  , '!='
  , '&&'
  , '||'
  , '+='
  , '-='
  , '*='
  , '/='
  , '%='
  , '&='
  , '^^'
  , '^='
  , '|='
  , '('
  , ')'
  , '['
  , ']'
  , '.'
  , '!'
  , '~'
  , '*'
  , '/'
  , '%'
  , '+'
  , '-'
  , '<'
  , '>'
  , '&'
  , '^'
  , '|'
  , '?'
  , ':'
  , '='
  , ','
  , ';'
  , '{'
  , '}'
]

},{}],141:[function(require,module,exports){
var tokenize = require('./index')

module.exports = tokenizeString

function tokenizeString(str, opt) {
  var generator = tokenize(opt)
  var tokens = []

  tokens = tokens.concat(generator(str))
  tokens = tokens.concat(generator(null))

  return tokens
}

},{"./index":135}],142:[function(require,module,exports){
"use strict"

//High level idea:
// 1. Use Clarkson's incremental construction to find convex hull
// 2. Point location in triangulation by jump and walk

module.exports = incrementalConvexHull

var orient = require("robust-orientation")
var compareCell = require("simplicial-complex").compareCells

function compareInt(a, b) {
  return a - b
}

function Simplex(vertices, adjacent, boundary) {
  this.vertices = vertices
  this.adjacent = adjacent
  this.boundary = boundary
  this.lastVisited = -1
}

Simplex.prototype.flip = function() {
  var t = this.vertices[0]
  this.vertices[0] = this.vertices[1]
  this.vertices[1] = t
  var u = this.adjacent[0]
  this.adjacent[0] = this.adjacent[1]
  this.adjacent[1] = u
}

function GlueFacet(vertices, cell, index) {
  this.vertices = vertices
  this.cell = cell
  this.index = index
}

function compareGlue(a, b) {
  return compareCell(a.vertices, b.vertices)
}

function bakeOrient(d) {
  var code = ["function orient(){var tuple=this.tuple;return test("]
  for(var i=0; i<=d; ++i) {
    if(i > 0) {
      code.push(",")
    }
    code.push("tuple[", i, "]")
  }
  code.push(")}return orient")
  var proc = new Function("test", code.join(""))
  var test = orient[d+1]
  if(!test) {
    test = orient
  }
  return proc(test)
}

var BAKED = []

function Triangulation(dimension, vertices, simplices) {
  this.dimension = dimension
  this.vertices = vertices
  this.simplices = simplices
  this.interior = simplices.filter(function(c) {
    return !c.boundary
  })

  this.tuple = new Array(dimension+1)
  for(var i=0; i<=dimension; ++i) {
    this.tuple[i] = this.vertices[i]
  }

  var o = BAKED[dimension]
  if(!o) {
    o = BAKED[dimension] = bakeOrient(dimension)
  }
  this.orient = o
}

var proto = Triangulation.prototype

//Degenerate situation where we are on boundary, but coplanar to face
proto.handleBoundaryDegeneracy = function(cell, point) {
  var d = this.dimension
  var n = this.vertices.length - 1
  var tuple = this.tuple
  var verts = this.vertices

  //Dumb solution: Just do dfs from boundary cell until we find any peak, or terminate
  var toVisit = [ cell ]
  cell.lastVisited = -n
  while(toVisit.length > 0) {
    cell = toVisit.pop()
    var cellVerts = cell.vertices
    var cellAdj = cell.adjacent
    for(var i=0; i<=d; ++i) {
      var neighbor = cellAdj[i]
      if(!neighbor.boundary || neighbor.lastVisited <= -n) {
        continue
      }
      var nv = neighbor.vertices
      for(var j=0; j<=d; ++j) {
        var vv = nv[j]
        if(vv < 0) {
          tuple[j] = point
        } else {
          tuple[j] = verts[vv]
        }
      }
      var o = this.orient()
      if(o > 0) {
        return neighbor
      }
      neighbor.lastVisited = -n
      if(o === 0) {
        toVisit.push(neighbor)
      }
    }
  }
  return null
}

proto.walk = function(point, random) {
  //Alias local properties
  var n = this.vertices.length - 1
  var d = this.dimension
  var verts = this.vertices
  var tuple = this.tuple

  //Compute initial jump cell
  var initIndex = random ? (this.interior.length * Math.random())|0 : (this.interior.length-1)
  var cell = this.interior[ initIndex ]

  //Start walking
outerLoop:
  while(!cell.boundary) {
    var cellVerts = cell.vertices
    var cellAdj = cell.adjacent

    for(var i=0; i<=d; ++i) {
      tuple[i] = verts[cellVerts[i]]
    }
    cell.lastVisited = n

    //Find farthest adjacent cell
    for(var i=0; i<=d; ++i) {
      var neighbor = cellAdj[i]
      if(neighbor.lastVisited >= n) {
        continue
      }
      var prev = tuple[i]
      tuple[i] = point
      var o = this.orient()
      tuple[i] = prev
      if(o < 0) {
        cell = neighbor
        continue outerLoop
      } else {
        if(!neighbor.boundary) {
          neighbor.lastVisited = n
        } else {
          neighbor.lastVisited = -n
        }
      }
    }
    return
  }

  return cell
}

proto.addPeaks = function(point, cell) {
  var n = this.vertices.length - 1
  var d = this.dimension
  var verts = this.vertices
  var tuple = this.tuple
  var interior = this.interior
  var simplices = this.simplices

  //Walking finished at boundary, time to add peaks
  var tovisit = [ cell ]

  //Stretch initial boundary cell into a peak
  cell.lastVisited = n
  cell.vertices[cell.vertices.indexOf(-1)] = n
  cell.boundary = false
  interior.push(cell)

  //Record a list of all new boundaries created by added peaks so we can glue them together when we are all done
  var glueFacets = []

  //Do a traversal of the boundary walking outward from starting peak
  while(tovisit.length > 0) {
    //Pop off peak and walk over adjacent cells
    var cell = tovisit.pop()
    var cellVerts = cell.vertices
    var cellAdj = cell.adjacent
    var indexOfN = cellVerts.indexOf(n)
    if(indexOfN < 0) {
      continue
    }

    for(var i=0; i<=d; ++i) {
      if(i === indexOfN) {
        continue
      }

      //For each boundary neighbor of the cell
      var neighbor = cellAdj[i]
      if(!neighbor.boundary || neighbor.lastVisited >= n) {
        continue
      }

      var nv = neighbor.vertices

      //Test if neighbor is a peak
      if(neighbor.lastVisited !== -n) {      
        //Compute orientation of p relative to each boundary peak
        var indexOfNeg1 = 0
        for(var j=0; j<=d; ++j) {
          if(nv[j] < 0) {
            indexOfNeg1 = j
            tuple[j] = point
          } else {
            tuple[j] = verts[nv[j]]
          }
        }
        var o = this.orient()

        //Test if neighbor cell is also a peak
        if(o > 0) {
          nv[indexOfNeg1] = n
          neighbor.boundary = false
          interior.push(neighbor)
          tovisit.push(neighbor)
          neighbor.lastVisited = n
          continue
        } else {
          neighbor.lastVisited = -n
        }
      }

      var na = neighbor.adjacent

      //Otherwise, replace neighbor with new face
      var vverts = cellVerts.slice()
      var vadj = cellAdj.slice()
      var ncell = new Simplex(vverts, vadj, true)
      simplices.push(ncell)

      //Connect to neighbor
      var opposite = na.indexOf(cell)
      if(opposite < 0) {
        continue
      }
      na[opposite] = ncell
      vadj[indexOfN] = neighbor

      //Connect to cell
      vverts[i] = -1
      vadj[i] = cell
      cellAdj[i] = ncell

      //Flip facet
      ncell.flip()

      //Add to glue list
      for(var j=0; j<=d; ++j) {
        var uu = vverts[j]
        if(uu < 0 || uu === n) {
          continue
        }
        var nface = new Array(d-1)
        var nptr = 0
        for(var k=0; k<=d; ++k) {
          var vv = vverts[k]
          if(vv < 0 || k === j) {
            continue
          }
          nface[nptr++] = vv
        }
        glueFacets.push(new GlueFacet(nface, ncell, j))
      }
    }
  }

  //Glue boundary facets together
  glueFacets.sort(compareGlue)

  for(var i=0; i+1<glueFacets.length; i+=2) {
    var a = glueFacets[i]
    var b = glueFacets[i+1]
    var ai = a.index
    var bi = b.index
    if(ai < 0 || bi < 0) {
      continue
    }
    a.cell.adjacent[a.index] = b.cell
    b.cell.adjacent[b.index] = a.cell
  }
}

proto.insert = function(point, random) {
  //Add point
  var verts = this.vertices
  verts.push(point)

  var cell = this.walk(point, random)
  if(!cell) {
    return
  }

  //Alias local properties
  var d = this.dimension
  var tuple = this.tuple

  //Degenerate case: If point is coplanar to cell, then walk until we find a non-degenerate boundary
  for(var i=0; i<=d; ++i) {
    var vv = cell.vertices[i]
    if(vv < 0) {
      tuple[i] = point
    } else {
      tuple[i] = verts[vv]
    }
  }
  var o = this.orient(tuple)
  if(o < 0) {
    return
  } else if(o === 0) {
    cell = this.handleBoundaryDegeneracy(cell, point)
    if(!cell) {
      return
    }
  }

  //Add peaks
  this.addPeaks(point, cell)
}

//Extract all boundary cells
proto.boundary = function() {
  var d = this.dimension
  var boundary = []
  var cells = this.simplices
  var nc = cells.length
  for(var i=0; i<nc; ++i) {
    var c = cells[i]
    if(c.boundary) {
      var bcell = new Array(d)
      var cv = c.vertices
      var ptr = 0
      var parity = 0
      for(var j=0; j<=d; ++j) {
        if(cv[j] >= 0) {
          bcell[ptr++] = cv[j]
        } else {
          parity = j&1
        }
      }
      if(parity === (d&1)) {
        var t = bcell[0]
        bcell[0] = bcell[1]
        bcell[1] = t
      }
      boundary.push(bcell)
    }
  }
  return boundary
}

function incrementalConvexHull(points, randomSearch) {
  var n = points.length
  if(n === 0) {
    throw new Error("Must have at least d+1 points")
  }
  var d = points[0].length
  if(n <= d) {
    throw new Error("Must input at least d+1 points")
  }

  //FIXME: This could be degenerate, but need to select d+1 non-coplanar points to bootstrap process
  var initialSimplex = points.slice(0, d+1)

  //Make sure initial simplex is positively oriented
  var o = orient.apply(void 0, initialSimplex)
  if(o === 0) {
    throw new Error("Input not in general position")
  }
  var initialCoords = new Array(d+1)
  for(var i=0; i<=d; ++i) {
    initialCoords[i] = i
  }
  if(o < 0) {
    initialCoords[0] = 1
    initialCoords[1] = 0
  }

  //Create initial topological index, glue pointers together (kind of messy)
  var initialCell = new Simplex(initialCoords, new Array(d+1), false)
  var boundary = initialCell.adjacent
  var list = new Array(d+2)
  for(var i=0; i<=d; ++i) {
    var verts = initialCoords.slice()
    for(var j=0; j<=d; ++j) {
      if(j === i) {
        verts[j] = -1
      }
    }
    var t = verts[0]
    verts[0] = verts[1]
    verts[1] = t
    var cell = new Simplex(verts, new Array(d+1), true)
    boundary[i] = cell
    list[i] = cell
  }
  list[d+1] = initialCell
  for(var i=0; i<=d; ++i) {
    var verts = boundary[i].vertices
    var adj = boundary[i].adjacent
    for(var j=0; j<=d; ++j) {
      var v = verts[j]
      if(v < 0) {
        adj[j] = initialCell
        continue
      }
      for(var k=0; k<=d; ++k) {
        if(boundary[k].vertices.indexOf(v) < 0) {
          adj[j] = boundary[k]
        }
      }
    }
  }

  //Initialize triangles
  var triangles = new Triangulation(d, initialSimplex, list)

  //Insert remaining points
  var useRandom = !!randomSearch
  for(var i=d+1; i<n; ++i) {
    triangles.insert(points[i], useRandom)
  }
  
  //Extract boundary cells
  return triangles.boundary()
}
},{"robust-orientation":190,"simplicial-complex":143}],143:[function(require,module,exports){
"use strict"; "use restrict";

var bits      = require("bit-twiddle")
  , UnionFind = require("union-find")

//Returns the dimension of a cell complex
function dimension(cells) {
  var d = 0
    , max = Math.max
  for(var i=0, il=cells.length; i<il; ++i) {
    d = max(d, cells[i].length)
  }
  return d-1
}
exports.dimension = dimension

//Counts the number of vertices in faces
function countVertices(cells) {
  var vc = -1
    , max = Math.max
  for(var i=0, il=cells.length; i<il; ++i) {
    var c = cells[i]
    for(var j=0, jl=c.length; j<jl; ++j) {
      vc = max(vc, c[j])
    }
  }
  return vc+1
}
exports.countVertices = countVertices

//Returns a deep copy of cells
function cloneCells(cells) {
  var ncells = new Array(cells.length)
  for(var i=0, il=cells.length; i<il; ++i) {
    ncells[i] = cells[i].slice(0)
  }
  return ncells
}
exports.cloneCells = cloneCells

//Ranks a pair of cells up to permutation
function compareCells(a, b) {
  var n = a.length
    , t = a.length - b.length
    , min = Math.min
  if(t) {
    return t
  }
  switch(n) {
    case 0:
      return 0;
    case 1:
      return a[0] - b[0];
    case 2:
      var d = a[0]+a[1]-b[0]-b[1]
      if(d) {
        return d
      }
      return min(a[0],a[1]) - min(b[0],b[1])
    case 3:
      var l1 = a[0]+a[1]
        , m1 = b[0]+b[1]
      d = l1+a[2] - (m1+b[2])
      if(d) {
        return d
      }
      var l0 = min(a[0], a[1])
        , m0 = min(b[0], b[1])
        , d  = min(l0, a[2]) - min(m0, b[2])
      if(d) {
        return d
      }
      return min(l0+a[2], l1) - min(m0+b[2], m1)
    
    //TODO: Maybe optimize n=4 as well?
    
    default:
      var as = a.slice(0)
      as.sort()
      var bs = b.slice(0)
      bs.sort()
      for(var i=0; i<n; ++i) {
        t = as[i] - bs[i]
        if(t) {
          return t
        }
      }
      return 0
  }
}
exports.compareCells = compareCells

function compareZipped(a, b) {
  return compareCells(a[0], b[0])
}

//Puts a cell complex into normal order for the purposes of findCell queries
function normalize(cells, attr) {
  if(attr) {
    var len = cells.length
    var zipped = new Array(len)
    for(var i=0; i<len; ++i) {
      zipped[i] = [cells[i], attr[i]]
    }
    zipped.sort(compareZipped)
    for(var i=0; i<len; ++i) {
      cells[i] = zipped[i][0]
      attr[i] = zipped[i][1]
    }
    return cells
  } else {
    cells.sort(compareCells)
    return cells
  }
}
exports.normalize = normalize

//Removes all duplicate cells in the complex
function unique(cells) {
  if(cells.length === 0) {
    return []
  }
  var ptr = 1
    , len = cells.length
  for(var i=1; i<len; ++i) {
    var a = cells[i]
    if(compareCells(a, cells[i-1])) {
      if(i === ptr) {
        ptr++
        continue
      }
      cells[ptr++] = a
    }
  }
  cells.length = ptr
  return cells
}
exports.unique = unique;

//Finds a cell in a normalized cell complex
function findCell(cells, c) {
  var lo = 0
    , hi = cells.length-1
    , r  = -1
  while (lo <= hi) {
    var mid = (lo + hi) >> 1
      , s   = compareCells(cells[mid], c)
    if(s <= 0) {
      if(s === 0) {
        r = mid
      }
      lo = mid + 1
    } else if(s > 0) {
      hi = mid - 1
    }
  }
  return r
}
exports.findCell = findCell;

//Builds an index for an n-cell.  This is more general than dual, but less efficient
function incidence(from_cells, to_cells) {
  var index = new Array(from_cells.length)
  for(var i=0, il=index.length; i<il; ++i) {
    index[i] = []
  }
  var b = []
  for(var i=0, n=to_cells.length; i<n; ++i) {
    var c = to_cells[i]
    var cl = c.length
    for(var k=1, kn=(1<<cl); k<kn; ++k) {
      b.length = bits.popCount(k)
      var l = 0
      for(var j=0; j<cl; ++j) {
        if(k & (1<<j)) {
          b[l++] = c[j]
        }
      }
      var idx=findCell(from_cells, b)
      if(idx < 0) {
        continue
      }
      while(true) {
        index[idx++].push(i)
        if(idx >= from_cells.length || compareCells(from_cells[idx], b) !== 0) {
          break
        }
      }
    }
  }
  return index
}
exports.incidence = incidence

//Computes the dual of the mesh.  This is basically an optimized version of buildIndex for the situation where from_cells is just the list of vertices
function dual(cells, vertex_count) {
  if(!vertex_count) {
    return incidence(unique(skeleton(cells, 0)), cells, 0)
  }
  var res = new Array(vertex_count)
  for(var i=0; i<vertex_count; ++i) {
    res[i] = []
  }
  for(var i=0, len=cells.length; i<len; ++i) {
    var c = cells[i]
    for(var j=0, cl=c.length; j<cl; ++j) {
      res[c[j]].push(i)
    }
  }
  return res
}
exports.dual = dual

//Enumerates all cells in the complex
function explode(cells) {
  var result = []
  for(var i=0, il=cells.length; i<il; ++i) {
    var c = cells[i]
      , cl = c.length|0
    for(var j=1, jl=(1<<cl); j<jl; ++j) {
      var b = []
      for(var k=0; k<cl; ++k) {
        if((j >>> k) & 1) {
          b.push(c[k])
        }
      }
      result.push(b)
    }
  }
  return normalize(result)
}
exports.explode = explode

//Enumerates all of the n-cells of a cell complex
function skeleton(cells, n) {
  if(n < 0) {
    return []
  }
  var result = []
    , k0     = (1<<(n+1))-1
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i]
    for(var k=k0; k<(1<<c.length); k=bits.nextCombination(k)) {
      var b = new Array(n+1)
        , l = 0
      for(var j=0; j<c.length; ++j) {
        if(k & (1<<j)) {
          b[l++] = c[j]
        }
      }
      result.push(b)
    }
  }
  return normalize(result)
}
exports.skeleton = skeleton;

//Computes the boundary of all cells, does not remove duplicates
function boundary(cells) {
  var res = []
  for(var i=0,il=cells.length; i<il; ++i) {
    var c = cells[i]
    for(var j=0,cl=c.length; j<cl; ++j) {
      var b = new Array(c.length-1)
      for(var k=0, l=0; k<cl; ++k) {
        if(k !== j) {
          b[l++] = c[k]
        }
      }
      res.push(b)
    }
  }
  return normalize(res)
}
exports.boundary = boundary;

//Computes connected components for a dense cell complex
function connectedComponents_dense(cells, vertex_count) {
  var labels = new UnionFind(vertex_count)
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i]
    for(var j=0; j<c.length; ++j) {
      for(var k=j+1; k<c.length; ++k) {
        labels.link(c[j], c[k])
      }
    }
  }
  var components = []
    , component_labels = labels.ranks
  for(var i=0; i<component_labels.length; ++i) {
    component_labels[i] = -1
  }
  for(var i=0; i<cells.length; ++i) {
    var l = labels.find(cells[i][0])
    if(component_labels[l] < 0) {
      component_labels[l] = components.length
      components.push([cells[i].slice(0)])
    } else {
      components[component_labels[l]].push(cells[i].slice(0))
    }
  }
  return components
}

//Computes connected components for a sparse graph
function connectedComponents_sparse(cells) {
  var vertices  = unique(normalize(skeleton(cells, 0)))
    , labels    = new UnionFind(vertices.length)
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i]
    for(var j=0; j<c.length; ++j) {
      var vj = findCell(vertices, [c[j]])
      for(var k=j+1; k<c.length; ++k) {
        labels.link(vj, findCell(vertices, [c[k]]))
      }
    }
  }
  var components        = []
    , component_labels  = labels.ranks
  for(var i=0; i<component_labels.length; ++i) {
    component_labels[i] = -1
  }
  for(var i=0; i<cells.length; ++i) {
    var l = labels.find(findCell(vertices, [cells[i][0]]));
    if(component_labels[l] < 0) {
      component_labels[l] = components.length
      components.push([cells[i].slice(0)])
    } else {
      components[component_labels[l]].push(cells[i].slice(0))
    }
  }
  return components
}

//Computes connected components for a cell complex
function connectedComponents(cells, vertex_count) {
  if(vertex_count) {
    return connectedComponents_dense(cells, vertex_count)
  }
  return connectedComponents_sparse(cells)
}
exports.connectedComponents = connectedComponents

},{"bit-twiddle":35,"union-find":213}],144:[function(require,module,exports){
"use strict"

var bounds = require("binary-search-bounds")

var NOT_FOUND = 0
var SUCCESS = 1
var EMPTY = 2

module.exports = createWrapper

function IntervalTreeNode(mid, left, right, leftPoints, rightPoints) {
  this.mid = mid
  this.left = left
  this.right = right
  this.leftPoints = leftPoints
  this.rightPoints = rightPoints
  this.count = (left ? left.count : 0) + (right ? right.count : 0) + leftPoints.length
}

var proto = IntervalTreeNode.prototype

function copy(a, b) {
  a.mid = b.mid
  a.left = b.left
  a.right = b.right
  a.leftPoints = b.leftPoints
  a.rightPoints = b.rightPoints
  a.count = b.count
}

function rebuild(node, intervals) {
  var ntree = createIntervalTree(intervals)
  node.mid = ntree.mid
  node.left = ntree.left
  node.right = ntree.right
  node.leftPoints = ntree.leftPoints
  node.rightPoints = ntree.rightPoints
  node.count = ntree.count
}

function rebuildWithInterval(node, interval) {
  var intervals = node.intervals([])
  intervals.push(interval)
  rebuild(node, intervals)    
}

function rebuildWithoutInterval(node, interval) {
  var intervals = node.intervals([])
  var idx = intervals.indexOf(interval)
  if(idx < 0) {
    return NOT_FOUND
  }
  intervals.splice(idx, 1)
  rebuild(node, intervals)
  return SUCCESS
}

proto.intervals = function(result) {
  result.push.apply(result, this.leftPoints)
  if(this.left) {
    this.left.intervals(result)
  }
  if(this.right) {
    this.right.intervals(result)
  }
  return result
}

proto.insert = function(interval) {
  var weight = this.count - this.leftPoints.length
  this.count += 1
  if(interval[1] < this.mid) {
    if(this.left) {
      if(4*(this.left.count+1) > 3*(weight+1)) {
        rebuildWithInterval(this, interval)
      } else {
        this.left.insert(interval)
      }
    } else {
      this.left = createIntervalTree([interval])
    }
  } else if(interval[0] > this.mid) {
    if(this.right) {
      if(4*(this.right.count+1) > 3*(weight+1)) {
        rebuildWithInterval(this, interval)
      } else {
        this.right.insert(interval)
      }
    } else {
      this.right = createIntervalTree([interval])
    }
  } else {
    var l = bounds.ge(this.leftPoints, interval, compareBegin)
    var r = bounds.ge(this.rightPoints, interval, compareEnd)
    this.leftPoints.splice(l, 0, interval)
    this.rightPoints.splice(r, 0, interval)
  }
}

proto.remove = function(interval) {
  var weight = this.count - this.leftPoints
  if(interval[1] < this.mid) {
    if(!this.left) {
      return NOT_FOUND
    }
    var rw = this.right ? this.right.count : 0
    if(4 * rw > 3 * (weight-1)) {
      return rebuildWithoutInterval(this, interval)
    }
    var r = this.left.remove(interval)
    if(r === EMPTY) {
      this.left = null
      this.count -= 1
      return SUCCESS
    } else if(r === SUCCESS) {
      this.count -= 1
    }
    return r
  } else if(interval[0] > this.mid) {
    if(!this.right) {
      return NOT_FOUND
    }
    var lw = this.left ? this.left.count : 0
    if(4 * lw > 3 * (weight-1)) {
      return rebuildWithoutInterval(this, interval)
    }
    var r = this.right.remove(interval)
    if(r === EMPTY) {
      this.right = null
      this.count -= 1
      return SUCCESS
    } else if(r === SUCCESS) {
      this.count -= 1
    }
    return r
  } else {
    if(this.count === 1) {
      if(this.leftPoints[0] === interval) {
        return EMPTY
      } else {
        return NOT_FOUND
      }
    }
    if(this.leftPoints.length === 1 && this.leftPoints[0] === interval) {
      if(this.left && this.right) {
        var p = this
        var n = this.left
        while(n.right) {
          p = n
          n = n.right
        }
        if(p === this) {
          n.right = this.right
        } else {
          var l = this.left
          var r = this.right
          p.count -= n.count
          p.right = n.left
          n.left = l
          n.right = r
        }
        copy(this, n)
        this.count = (this.left?this.left.count:0) + (this.right?this.right.count:0) + this.leftPoints.length
      } else if(this.left) {
        copy(this, this.left)
      } else {
        copy(this, this.right)
      }
      return SUCCESS
    }
    for(var l = bounds.ge(this.leftPoints, interval, compareBegin); l<this.leftPoints.length; ++l) {
      if(this.leftPoints[l][0] !== interval[0]) {
        break
      }
      if(this.leftPoints[l] === interval) {
        this.count -= 1
        this.leftPoints.splice(l, 1)
        for(var r = bounds.ge(this.rightPoints, interval, compareEnd); r<this.rightPoints.length; ++r) {
          if(this.rightPoints[r][1] !== interval[1]) {
            break
          } else if(this.rightPoints[r] === interval) {
            this.rightPoints.splice(r, 1)
            return SUCCESS
          }
        }
      }
    }
    return NOT_FOUND
  }
}

function reportLeftRange(arr, hi, cb) {
  for(var i=0; i<arr.length && arr[i][0] <= hi; ++i) {
    var r = cb(arr[i])
    if(r) { return r }
  }
}

function reportRightRange(arr, lo, cb) {
  for(var i=arr.length-1; i>=0 && arr[i][1] >= lo; --i) {
    var r = cb(arr[i])
    if(r) { return r }
  }
}

function reportRange(arr, cb) {
  for(var i=0; i<arr.length; ++i) {
    var r = cb(arr[i])
    if(r) { return r }
  }
}

proto.queryPoint = function(x, cb) {
  if(x < this.mid) {
    if(this.left) {
      var r = this.left.queryPoint(x, cb)
      if(r) { return r }
    }
    return reportLeftRange(this.leftPoints, x, cb)
  } else if(x > this.mid) {
    if(this.right) {
      var r = this.right.queryPoint(x, cb)
      if(r) { return r }
    }
    return reportRightRange(this.rightPoints, x, cb)
  } else {
    return reportRange(this.leftPoints, cb)
  }
}

proto.queryInterval = function(lo, hi, cb) {
  if(lo < this.mid && this.left) {
    var r = this.left.queryInterval(lo, hi, cb)
    if(r) { return r }
  }
  if(hi > this.mid && this.right) {
    var r = this.right.queryInterval(lo, hi, cb)
    if(r) { return r }
  }
  if(hi < this.mid) {
    return reportLeftRange(this.leftPoints, hi, cb)
  } else if(lo > this.mid) {
    return reportRightRange(this.rightPoints, lo, cb)
  } else {
    return reportRange(this.leftPoints, cb)
  }
}

function compareNumbers(a, b) {
  return a - b
}

function compareBegin(a, b) {
  var d = a[0] - b[0]
  if(d) { return d }
  return a[1] - b[1]
}

function compareEnd(a, b) {
  var d = a[1] - b[1]
  if(d) { return d }
  return a[0] - b[0]
}

function createIntervalTree(intervals) {
  if(intervals.length === 0) {
    return null
  }
  var pts = []
  for(var i=0; i<intervals.length; ++i) {
    pts.push(intervals[i][0], intervals[i][1])
  }
  pts.sort(compareNumbers)

  var mid = pts[pts.length>>1]

  var leftIntervals = []
  var rightIntervals = []
  var centerIntervals = []
  for(var i=0; i<intervals.length; ++i) {
    var s = intervals[i]
    if(s[1] < mid) {
      leftIntervals.push(s)
    } else if(mid < s[0]) {
      rightIntervals.push(s)
    } else {
      centerIntervals.push(s)
    }
  }

  //Split center intervals
  var leftPoints = centerIntervals
  var rightPoints = centerIntervals.slice()
  leftPoints.sort(compareBegin)
  rightPoints.sort(compareEnd)

  return new IntervalTreeNode(mid, 
    createIntervalTree(leftIntervals),
    createIntervalTree(rightIntervals),
    leftPoints,
    rightPoints)
}

//User friendly wrapper that makes it possible to support empty trees
function IntervalTree(root) {
  this.root = root
}

var tproto = IntervalTree.prototype

tproto.insert = function(interval) {
  if(this.root) {
    this.root.insert(interval)
  } else {
    this.root = new IntervalTreeNode(interval[0], null, null, [interval], [interval])
  }
}

tproto.remove = function(interval) {
  if(this.root) {
    var r = this.root.remove(interval)
    if(r === EMPTY) {
      this.root = null
    }
    return r !== NOT_FOUND
  }
  return false
}

tproto.queryPoint = function(p, cb) {
  if(this.root) {
    return this.root.queryPoint(p, cb)
  }
}

tproto.queryInterval = function(lo, hi, cb) {
  if(lo <= hi && this.root) {
    return this.root.queryInterval(lo, hi, cb)
  }
}

Object.defineProperty(tproto, "count", {
  get: function() {
    if(this.root) {
      return this.root.count
    }
    return 0
  }
})

Object.defineProperty(tproto, "intervals", {
  get: function() {
    if(this.root) {
      return this.root.intervals([])
    }
    return []
  }
})

function createWrapper(intervals) {
  if(!intervals || intervals.length === 0) {
    return new IntervalTree(null)
  }
  return new IntervalTree(createIntervalTree(intervals))
}

},{"binary-search-bounds":34}],145:[function(require,module,exports){
"use strict"

function invertPermutation(pi, result) {
  result = result || new Array(pi.length)
  for(var i=0; i<pi.length; ++i) {
    result[pi[i]] = i
  }
  return result
}

module.exports = invertPermutation
},{}],146:[function(require,module,exports){
"use strict"

function iota(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = i
  }
  return result
}

module.exports = iota
},{}],147:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],148:[function(require,module,exports){
function lerp(v0, v1, t) {
    return v0*(1-t)+v1*t
}
module.exports = lerp
},{}],149:[function(require,module,exports){
'use strict'

module.exports = createTable

var chull = require('convex-hull')

function constructVertex(d, a, b) {
  var x = new Array(d)
  for(var i=0; i<d; ++i) {
    x[i] = 0.0
    if(i === a) {
      x[i] += 0.5
    }
    if(i === b) {
      x[i] += 0.5
    }
  }
  return x
}

function constructCell(dimension, mask) {
  if(mask === 0 || mask === (1<<(dimension+1))-1) {
    return []
  }
  var points = []
  var index  = []
  for(var i=0; i<=dimension; ++i) {
    if(mask & (1<<i)) {
      points.push(constructVertex(dimension, i-1, i-1))
      index.push(null)
      for(var j=0; j<=dimension; ++j) {
        if(~mask & (1<<j)) {
          points.push(constructVertex(dimension, i-1, j-1))
          index.push([i,j])
        }
      }
    }
  }
  
  //Preprocess points so first d+1 points are linearly independent
  var hull = chull(points)
  var faces = []
i_loop:
  for(var i=0; i<hull.length; ++i) {
    var face = hull[i]
    var nface = []
    for(var j=0; j<face.length; ++j) {
      if(!index[face[j]]) {
        continue i_loop
      }
      nface.push(index[face[j]].slice())
    }
    faces.push(nface)
  }
  return faces
}

function createTable(dimension) {
  var numCells = 1<<(dimension+1)
  var result = new Array(numCells)
  for(var i=0; i<numCells; ++i) {
    result[i] = constructCell(dimension, i)
  }
  return result
}
},{"convex-hull":58}],150:[function(require,module,exports){
/*jshint unused:true*/
/*
Input:  matrix      ; a 4x4 matrix
Output: translation ; a 3 component vector
        scale       ; a 3 component vector
        skew        ; skew factors XY,XZ,YZ represented as a 3 component vector
        perspective ; a 4 component vector
        quaternion  ; a 4 component vector
Returns false if the matrix cannot be decomposed, true if it can


References:
https://github.com/kamicane/matrix3d/blob/master/lib/Matrix3d.js
https://github.com/ChromiumWebApps/chromium/blob/master/ui/gfx/transform_util.cc
http://www.w3.org/TR/css3-transforms/#decomposing-a-3d-matrix
*/

var normalize = require('./normalize')

var create = require('gl-mat4/create')
var clone = require('gl-mat4/clone')
var determinant = require('gl-mat4/determinant')
var invert = require('gl-mat4/invert')
var transpose = require('gl-mat4/transpose')
var vec3 = {
    length: require('gl-vec3/length'),
    normalize: require('gl-vec3/normalize'),
    dot: require('gl-vec3/dot'),
    cross: require('gl-vec3/cross')
}

var tmp = create()
var perspectiveMatrix = create()
var tmpVec4 = [0, 0, 0, 0]
var row = [ [0,0,0], [0,0,0], [0,0,0] ]
var pdum3 = [0,0,0]

module.exports = function decomposeMat4(matrix, translation, scale, skew, perspective, quaternion) {
    if (!translation) translation = [0,0,0]
    if (!scale) scale = [0,0,0]
    if (!skew) skew = [0,0,0]
    if (!perspective) perspective = [0,0,0,1]
    if (!quaternion) quaternion = [0,0,0,1]

    //normalize, if not possible then bail out early
    if (!normalize(tmp, matrix))
        return false

    // perspectiveMatrix is used to solve for perspective, but it also provides
    // an easy way to test for singularity of the upper 3x3 component.
    clone(perspectiveMatrix, tmp)

    perspectiveMatrix[3] = 0
    perspectiveMatrix[7] = 0
    perspectiveMatrix[11] = 0
    perspectiveMatrix[15] = 1

    // If the perspectiveMatrix is not invertible, we are also unable to
    // decompose, so we'll bail early. Constant taken from SkMatrix44::invert.
    if (Math.abs(determinant(perspectiveMatrix) < 1e-8))
        return false

    var a03 = tmp[3], a13 = tmp[7], a23 = tmp[11],
            a30 = tmp[12], a31 = tmp[13], a32 = tmp[14], a33 = tmp[15]

    // First, isolate perspective.
    if (a03 !== 0 || a13 !== 0 || a23 !== 0) {
        tmpVec4[0] = a03
        tmpVec4[1] = a13
        tmpVec4[2] = a23
        tmpVec4[3] = a33

        // Solve the equation by inverting perspectiveMatrix and multiplying
        // rightHandSide by the inverse.
        // resuing the perspectiveMatrix here since it's no longer needed
        var ret = invert(perspectiveMatrix, perspectiveMatrix)
        if (!ret) return false
        transpose(perspectiveMatrix, perspectiveMatrix)

        //multiply by transposed inverse perspective matrix, into perspective vec4
        vec4multMat4(perspective, tmpVec4, perspectiveMatrix)
    } else { 
        //no perspective
        perspective[0] = perspective[1] = perspective[2] = 0
        perspective[3] = 1
    }

    // Next take care of translation
    translation[0] = a30
    translation[1] = a31
    translation[2] = a32

    // Now get scale and shear. 'row' is a 3 element array of 3 component vectors
    mat3from4(row, tmp)

    // Compute X scale factor and normalize first row.
    scale[0] = vec3.length(row[0])
    vec3.normalize(row[0], row[0])

    // Compute XY shear factor and make 2nd row orthogonal to 1st.
    skew[0] = vec3.dot(row[0], row[1])
    combine(row[1], row[1], row[0], 1.0, -skew[0])

    // Now, compute Y scale and normalize 2nd row.
    scale[1] = vec3.length(row[1])
    vec3.normalize(row[1], row[1])
    skew[0] /= scale[1]

    // Compute XZ and YZ shears, orthogonalize 3rd row
    skew[1] = vec3.dot(row[0], row[2])
    combine(row[2], row[2], row[0], 1.0, -skew[1])
    skew[2] = vec3.dot(row[1], row[2])
    combine(row[2], row[2], row[1], 1.0, -skew[2])

    // Next, get Z scale and normalize 3rd row.
    scale[2] = vec3.length(row[2])
    vec3.normalize(row[2], row[2])
    skew[1] /= scale[2]
    skew[2] /= scale[2]


    // At this point, the matrix (in rows) is orthonormal.
    // Check for a coordinate system flip.  If the determinant
    // is -1, then negate the matrix and the scaling factors.
    vec3.cross(pdum3, row[1], row[2])
    if (vec3.dot(row[0], pdum3) < 0) {
        for (var i = 0; i < 3; i++) {
            scale[i] *= -1;
            row[i][0] *= -1
            row[i][1] *= -1
            row[i][2] *= -1
        }
    }

    // Now, get the rotations out
    quaternion[0] = 0.5 * Math.sqrt(Math.max(1 + row[0][0] - row[1][1] - row[2][2], 0))
    quaternion[1] = 0.5 * Math.sqrt(Math.max(1 - row[0][0] + row[1][1] - row[2][2], 0))
    quaternion[2] = 0.5 * Math.sqrt(Math.max(1 - row[0][0] - row[1][1] + row[2][2], 0))
    quaternion[3] = 0.5 * Math.sqrt(Math.max(1 + row[0][0] + row[1][1] + row[2][2], 0))

    if (row[2][1] > row[1][2])
        quaternion[0] = -quaternion[0]
    if (row[0][2] > row[2][0])
        quaternion[1] = -quaternion[1]
    if (row[1][0] > row[0][1])
        quaternion[2] = -quaternion[2]
    return true
}

//will be replaced by gl-vec4 eventually
function vec4multMat4(out, a, m) {
    var x = a[0], y = a[1], z = a[2], w = a[3];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
}

//gets upper-left of a 4x4 matrix into a 3x3 of vectors
function mat3from4(out, mat4x4) {
    out[0][0] = mat4x4[0]
    out[0][1] = mat4x4[1]
    out[0][2] = mat4x4[2]
    
    out[1][0] = mat4x4[4]
    out[1][1] = mat4x4[5]
    out[1][2] = mat4x4[6]

    out[2][0] = mat4x4[8]
    out[2][1] = mat4x4[9]
    out[2][2] = mat4x4[10]
}

function combine(out, a, b, scale1, scale2) {
    out[0] = a[0] * scale1 + b[0] * scale2
    out[1] = a[1] * scale1 + b[1] * scale2
    out[2] = a[2] * scale1 + b[2] * scale2
}
},{"./normalize":151,"gl-mat4/clone":87,"gl-mat4/create":89,"gl-mat4/determinant":90,"gl-mat4/invert":96,"gl-mat4/transpose":109,"gl-vec3/cross":129,"gl-vec3/dot":130,"gl-vec3/length":131,"gl-vec3/normalize":133}],151:[function(require,module,exports){
module.exports = function normalize(out, mat) {
    var m44 = mat[15]
    // Cannot normalize.
    if (m44 === 0) 
        return false
    var scale = 1 / m44
    for (var i=0; i<16; i++)
        out[i] = mat[i] * scale
    return true
}
},{}],152:[function(require,module,exports){
var lerp = require('gl-vec3/lerp')

var recompose = require('mat4-recompose')
var decompose = require('mat4-decompose')
var determinant = require('gl-mat4/determinant')
var slerp = require('quat-slerp')

var state0 = state()
var state1 = state()
var tmp = state()

module.exports = interpolate
function interpolate(out, start, end, alpha) {
    if (determinant(start) === 0 || determinant(end) === 0)
        return false

    //decompose the start and end matrices into individual components
    var r0 = decompose(start, state0.translate, state0.scale, state0.skew, state0.perspective, state0.quaternion)
    var r1 = decompose(end, state1.translate, state1.scale, state1.skew, state1.perspective, state1.quaternion)
    if (!r0 || !r1)
        return false    


    //now lerp/slerp the start and end components into a temporary     lerp(tmptranslate, state0.translate, state1.translate, alpha)
    lerp(tmp.translate, state0.translate, state1.translate, alpha)
    lerp(tmp.skew, state0.skew, state1.skew, alpha)
    lerp(tmp.scale, state0.scale, state1.scale, alpha)
    lerp(tmp.perspective, state0.perspective, state1.perspective, alpha)
    slerp(tmp.quaternion, state0.quaternion, state1.quaternion, alpha)

    //and recompose into our 'out' matrix
    recompose(out, tmp.translate, tmp.scale, tmp.skew, tmp.perspective, tmp.quaternion)
    return true
}

function state() {
    return {
        translate: vec3(),
        scale: vec3(1),
        skew: vec3(),
        perspective: vec4(),
        quaternion: vec4()
    }
}

function vec3(n) {
    return [n||0,n||0,n||0]
}

function vec4() {
    return [0,0,0,1]
}
},{"gl-mat4/determinant":90,"gl-vec3/lerp":132,"mat4-decompose":150,"mat4-recompose":153,"quat-slerp":178}],153:[function(require,module,exports){
/*
Input:  translation ; a 3 component vector
        scale       ; a 3 component vector
        skew        ; skew factors XY,XZ,YZ represented as a 3 component vector
        perspective ; a 4 component vector
        quaternion  ; a 4 component vector
Output: matrix      ; a 4x4 matrix

From: http://www.w3.org/TR/css3-transforms/#recomposing-to-a-3d-matrix
*/

var mat4 = {
    identity: require('gl-mat4/identity'),
    translate: require('gl-mat4/translate'),
    multiply: require('gl-mat4/multiply'),
    create: require('gl-mat4/create'),
    scale: require('gl-mat4/scale'),
    fromRotationTranslation: require('gl-mat4/fromRotationTranslation')
}

var rotationMatrix = mat4.create()
var temp = mat4.create()

module.exports = function recomposeMat4(matrix, translation, scale, skew, perspective, quaternion) {
    mat4.identity(matrix)

    //apply translation & rotation
    mat4.fromRotationTranslation(matrix, quaternion, translation)

    //apply perspective
    matrix[3] = perspective[0]
    matrix[7] = perspective[1]
    matrix[11] = perspective[2]
    matrix[15] = perspective[3]
        
    // apply skew
    // temp is a identity 4x4 matrix initially
    mat4.identity(temp)

    if (skew[2] !== 0) {
        temp[9] = skew[2]
        mat4.multiply(matrix, matrix, temp)
    }

    if (skew[1] !== 0) {
        temp[9] = 0
        temp[8] = skew[1]
        mat4.multiply(matrix, matrix, temp)
    }

    if (skew[0] !== 0) {
        temp[8] = 0
        temp[4] = skew[0]
        mat4.multiply(matrix, matrix, temp)
    }

    //apply scale
    mat4.scale(matrix, matrix, scale)
    return matrix
}
},{"gl-mat4/create":89,"gl-mat4/fromRotationTranslation":92,"gl-mat4/identity":94,"gl-mat4/multiply":98,"gl-mat4/scale":106,"gl-mat4/translate":108}],154:[function(require,module,exports){
'use strict'

var bsearch   = require('binary-search-bounds')
var m4interp  = require('mat4-interpolate')
var invert44  = require('gl-mat4/invert')
var rotateX   = require('gl-mat4/rotateX')
var rotateY   = require('gl-mat4/rotateY')
var rotateZ   = require('gl-mat4/rotateZ')
var lookAt    = require('gl-mat4/lookAt')
var translate = require('gl-mat4/translate')
var scale     = require('gl-mat4/scale')
var normalize = require('gl-vec3/normalize')

var DEFAULT_CENTER = [0,0,0]

module.exports = createMatrixCameraController

function MatrixCameraController(initialMatrix) {
  this._components    = initialMatrix.slice()
  this._time          = [0]
  this.prevMatrix     = initialMatrix.slice()
  this.nextMatrix     = initialMatrix.slice()
  this.computedMatrix = initialMatrix.slice()
  this.computedInverse = initialMatrix.slice()
  this.computedEye    = [0,0,0]
  this.computedUp     = [0,0,0]
  this.computedCenter = [0,0,0]
  this.computedRadius = [0]
  this._limits        = [-Infinity, Infinity]
}

var proto = MatrixCameraController.prototype

proto.recalcMatrix = function(t) {
  var time = this._time
  var tidx = bsearch.le(time, t)
  var mat = this.computedMatrix
  if(tidx < 0) {
    return
  }
  var comps = this._components
  if(tidx === time.length-1) {
    var ptr = 16*tidx
    for(var i=0; i<16; ++i) {
      mat[i] = comps[ptr++]
    }
  } else {
    var dt = (time[tidx+1] - time[tidx])
    var ptr = 16*tidx
    var prev = this.prevMatrix
    var allEqual = true
    for(var i=0; i<16; ++i) {
      prev[i] = comps[ptr++]
    }
    var next = this.nextMatrix
    for(var i=0; i<16; ++i) {
      next[i] = comps[ptr++]
      allEqual = allEqual && (prev[i] === next[i])
    }
    if(dt < 1e-6 || allEqual) {
      for(var i=0; i<16; ++i) {
        mat[i] = prev[i]
      }
    } else {
      m4interp(mat, prev, next, (t - time[tidx])/dt)
    }
  }

  var up = this.computedUp
  up[0] = mat[1]
  up[1] = mat[5]
  up[2] = mat[9]
  normalize(up, up)

  var imat = this.computedInverse
  invert44(imat, mat)
  var eye = this.computedEye
  var w = imat[15]
  eye[0] = imat[12]/w
  eye[1] = imat[13]/w
  eye[2] = imat[14]/w

  var center = this.computedCenter
  var radius = Math.exp(this.computedRadius[0])
  for(var i=0; i<3; ++i) {
    center[i] = eye[i] - mat[2+4*i] * radius
  }
}

proto.idle = function(t) {
  if(t < this.lastT()) {
    return
  }
  var mc = this._components
  var ptr = mc.length-16
  for(var i=0; i<16; ++i) {
    mc.push(mc[ptr++])
  }
  this._time.push(t)
}

proto.flush = function(t) {
  var idx = bsearch.gt(this._time, t) - 2
  if(idx < 0) {
    return
  }
  this._time.splice(0, idx)
  this._components.splice(0, 16*idx)
}

proto.lastT = function() {
  return this._time[this._time.length-1]
}

proto.lookAt = function(t, eye, center, up) {
  this.recalcMatrix(t)
  eye    = eye || this.computedEye
  center = center || DEFAULT_CENTER
  up     = up || this.computedUp
  this.setMatrix(t, lookAt(this.computedMatrix, eye, center, up))
  var d2 = 0.0
  for(var i=0; i<3; ++i) {
    d2 += Math.pow(center[i] - eye[i], 2)
  }
  d2 = Math.log(Math.sqrt(d2))
  this.computedRadius[0] = d2
}

proto.rotate = function(t, yaw, pitch, roll) {
  this.recalcMatrix(t)
  var mat = this.computedInverse
  if(yaw)   rotateY(mat, mat, yaw)
  if(pitch) rotateX(mat, mat, pitch)
  if(roll)  rotateZ(mat, mat, roll)
  this.setMatrix(t, invert44(this.computedMatrix, mat))
}

var tvec = [0,0,0]

proto.pan = function(t, dx, dy, dz) {
  tvec[0] = -(dx || 0.0)
  tvec[1] = -(dy || 0.0)
  tvec[2] = -(dz || 0.0)
  this.recalcMatrix(t)
  var mat = this.computedInverse
  translate(mat, mat, tvec)
  this.setMatrix(t, invert44(mat, mat))
}

proto.translate = function(t, dx, dy, dz) {
  tvec[0] = dx || 0.0
  tvec[1] = dy || 0.0
  tvec[2] = dz || 0.0
  this.recalcMatrix(t)
  var mat = this.computedMatrix
  translate(mat, mat, tvec)
  this.setMatrix(t, mat)
}

proto.setMatrix = function(t, mat) {
  if(t < this.lastT()) {
    return
  }
  this._time.push(t)
  for(var i=0; i<16; ++i) {
    this._components.push(mat[i])
  }
}

proto.setDistance = function(t, d) {
  this.computedRadius[0] = d
}

proto.setDistanceLimits = function(a,b) {
  var lim = this._limits
  lim[0] = a
  lim[1] = b
}

proto.getDistanceLimits = function(out) {
  var lim = this._limits
  if(out) {
    out[0] = lim[0]
    out[1] = lim[1]
    return out
  }
  return lim
}

function createMatrixCameraController(options) {
  options = options || {}
  var matrix = options.matrix || 
              [1,0,0,0,
               0,1,0,0,
               0,0,1,0,
               0,0,0,1]
  return new MatrixCameraController(matrix)
}

},{"binary-search-bounds":34,"gl-mat4/invert":96,"gl-mat4/lookAt":97,"gl-mat4/rotateX":103,"gl-mat4/rotateY":104,"gl-mat4/rotateZ":105,"gl-mat4/scale":106,"gl-mat4/translate":108,"gl-vec3/normalize":133,"mat4-interpolate":152}],155:[function(require,module,exports){
'use strict'

module.exports = monotoneConvexHull2D

var orient = require('robust-orientation')[3]

function monotoneConvexHull2D(points) {
  var n = points.length

  if(n < 3) {
    var result = new Array(n)
    for(var i=0; i<n; ++i) {
      result[i] = i
    }

    if(n === 2 &&
       points[0][0] === points[1][0] &&
       points[0][1] === points[1][1]) {
      return [0]
    }

    return result
  }

  //Sort point indices along x-axis
  var sorted = new Array(n)
  for(var i=0; i<n; ++i) {
    sorted[i] = i
  }
  sorted.sort(function(a,b) {
    var d = points[a][0]-points[b][0]
    if(d) {
      return d
    }
    return points[a][1] - points[b][1]
  })

  //Construct upper and lower hulls
  var lower = [sorted[0], sorted[1]]
  var upper = [sorted[0], sorted[1]]

  for(var i=2; i<n; ++i) {
    var idx = sorted[i]
    var p   = points[idx]

    //Insert into lower list
    var m = lower.length
    while(m > 1 && orient(
        points[lower[m-2]], 
        points[lower[m-1]], 
        p) <= 0) {
      m -= 1
      lower.pop()
    }
    lower.push(idx)

    //Insert into upper list
    m = upper.length
    while(m > 1 && orient(
        points[upper[m-2]], 
        points[upper[m-1]], 
        p) >= 0) {
      m -= 1
      upper.pop()
    }
    upper.push(idx)
  }

  //Merge lists together
  var result = new Array(upper.length + lower.length - 2)
  var ptr    = 0
  for(var i=0, nl=lower.length; i<nl; ++i) {
    result[ptr++] = lower[i]
  }
  for(var j=upper.length-2; j>0; --j) {
    result[ptr++] = upper[j]
  }

  //Return result
  return result
}
},{"robust-orientation":190}],156:[function(require,module,exports){
'use strict'

module.exports = mouseListen

var mouse = require('mouse-event')

function mouseListen (element, callback) {
  if (!callback) {
    callback = element
    element = window
  }

  var buttonState = 0
  var x = 0
  var y = 0
  var mods = {
    shift: false,
    alt: false,
    control: false,
    meta: false
  }
  var attached = false

  function updateMods (ev) {
    var changed = false
    if ('altKey' in ev) {
      changed = changed || ev.altKey !== mods.alt
      mods.alt = !!ev.altKey
    }
    if ('shiftKey' in ev) {
      changed = changed || ev.shiftKey !== mods.shift
      mods.shift = !!ev.shiftKey
    }
    if ('ctrlKey' in ev) {
      changed = changed || ev.ctrlKey !== mods.control
      mods.control = !!ev.ctrlKey
    }
    if ('metaKey' in ev) {
      changed = changed || ev.metaKey !== mods.meta
      mods.meta = !!ev.metaKey
    }
    return changed
  }

  function handleEvent (nextButtons, ev) {
    var nextX = mouse.x(ev)
    var nextY = mouse.y(ev)
    if ('buttons' in ev) {
      nextButtons = ev.buttons | 0
    }
    if (nextButtons !== buttonState ||
      nextX !== x ||
      nextY !== y ||
      updateMods(ev)) {
      buttonState = nextButtons | 0
      x = nextX || 0
      y = nextY || 0
      callback && callback(buttonState, x, y, mods)
    }
  }

  function clearState (ev) {
    handleEvent(0, ev)
  }

  function handleBlur () {
    if (buttonState ||
      x ||
      y ||
      mods.shift ||
      mods.alt ||
      mods.meta ||
      mods.control) {
      x = y = 0
      buttonState = 0
      mods.shift = mods.alt = mods.control = mods.meta = false
      callback && callback(0, 0, 0, mods)
    }
  }

  function handleMods (ev) {
    if (updateMods(ev)) {
      callback && callback(buttonState, x, y, mods)
    }
  }

  function handleMouseMove (ev) {
    if (mouse.buttons(ev) === 0) {
      handleEvent(0, ev)
    } else {
      handleEvent(buttonState, ev)
    }
  }

  function handleMouseDown (ev) {
    handleEvent(buttonState | mouse.buttons(ev), ev)
  }

  function handleMouseUp (ev) {
    handleEvent(buttonState & ~mouse.buttons(ev), ev)
  }

  function attachListeners () {
    if (attached) {
      return
    }
    attached = true

    element.addEventListener('mousemove', handleMouseMove)

    element.addEventListener('mousedown', handleMouseDown)

    element.addEventListener('mouseup', handleMouseUp)

    element.addEventListener('mouseleave', clearState)
    element.addEventListener('mouseenter', clearState)
    element.addEventListener('mouseout', clearState)
    element.addEventListener('mouseover', clearState)

    element.addEventListener('blur', handleBlur)

    element.addEventListener('keyup', handleMods)
    element.addEventListener('keydown', handleMods)
    element.addEventListener('keypress', handleMods)

    if (element !== window) {
      window.addEventListener('blur', handleBlur)

      window.addEventListener('keyup', handleMods)
      window.addEventListener('keydown', handleMods)
      window.addEventListener('keypress', handleMods)
    }
  }

  function detachListeners () {
    if (!attached) {
      return
    }
    attached = false

    element.removeEventListener('mousemove', handleMouseMove)

    element.removeEventListener('mousedown', handleMouseDown)

    element.removeEventListener('mouseup', handleMouseUp)

    element.removeEventListener('mouseleave', clearState)
    element.removeEventListener('mouseenter', clearState)
    element.removeEventListener('mouseout', clearState)
    element.removeEventListener('mouseover', clearState)

    element.removeEventListener('blur', handleBlur)

    element.removeEventListener('keyup', handleMods)
    element.removeEventListener('keydown', handleMods)
    element.removeEventListener('keypress', handleMods)

    if (element !== window) {
      window.removeEventListener('blur', handleBlur)

      window.removeEventListener('keyup', handleMods)
      window.removeEventListener('keydown', handleMods)
      window.removeEventListener('keypress', handleMods)
    }
  }

  // Attach listeners
  attachListeners()

  var result = {
    element: element
  }

  Object.defineProperties(result, {
    enabled: {
      get: function () { return attached },
      set: function (f) {
        if (f) {
          attachListeners()
        } else {
          detachListeners()
        }
      },
      enumerable: true
    },
    buttons: {
      get: function () { return buttonState },
      enumerable: true
    },
    x: {
      get: function () { return x },
      enumerable: true
    },
    y: {
      get: function () { return y },
      enumerable: true
    },
    mods: {
      get: function () { return mods },
      enumerable: true
    }
  })

  return result
}

},{"mouse-event":158}],157:[function(require,module,exports){
var rootPosition = { left: 0, top: 0 }

module.exports = mouseEventOffset
function mouseEventOffset (ev, target, out) {
  target = target || ev.currentTarget || ev.srcElement
  if (!Array.isArray(out)) {
    out = [ 0, 0 ]
  }
  var cx = ev.clientX || 0
  var cy = ev.clientY || 0
  var rect = getBoundingClientOffset(target)
  out[0] = cx - rect.left
  out[1] = cy - rect.top
  return out
}

function getBoundingClientOffset (element) {
  if (element === window ||
      element === document ||
      element === document.body) {
    return rootPosition
  } else {
    return element.getBoundingClientRect()
  }
}

},{}],158:[function(require,module,exports){
'use strict'

function mouseButtons(ev) {
  if(typeof ev === 'object') {
    if('buttons' in ev) {
      return ev.buttons
    } else if('which' in ev) {
      var b = ev.which
      if(b === 2) {
        return 4
      } else if(b === 3) {
        return 2
      } else if(b > 0) {
        return 1<<(b-1)
      }
    } else if('button' in ev) {
      var b = ev.button
      if(b === 1) {
        return 4
      } else if(b === 2) {
        return 2
      } else if(b >= 0) {
        return 1<<b
      }
    }
  }
  return 0
}
exports.buttons = mouseButtons

function mouseElement(ev) {
  return ev.target || ev.srcElement || window
}
exports.element = mouseElement

function mouseRelativeX(ev) {
  if(typeof ev === 'object') {
    if('offsetX' in ev) {
      return ev.offsetX
    }
    var target = mouseElement(ev)
    var bounds = target.getBoundingClientRect()
    return ev.clientX - bounds.left
  }
  return 0
}
exports.x = mouseRelativeX

function mouseRelativeY(ev) {
  if(typeof ev === 'object') {
    if('offsetY' in ev) {
      return ev.offsetY
    }
    var target = mouseElement(ev)
    var bounds = target.getBoundingClientRect()
    return ev.clientY - bounds.top
  }
  return 0
}
exports.y = mouseRelativeY

},{}],159:[function(require,module,exports){
'use strict'

var toPX = require('to-px')

module.exports = mouseWheelListen

function mouseWheelListen(element, callback, noScroll) {
  if(typeof element === 'function') {
    noScroll = !!callback
    callback = element
    element = window
  }
  var lineHeight = toPX('ex', element)
  var listener = function(ev) {
    if(noScroll) {
      ev.preventDefault()
    }
    var dx = ev.deltaX || 0
    var dy = ev.deltaY || 0
    var dz = ev.deltaZ || 0
    var mode = ev.deltaMode
    var scale = 1
    switch(mode) {
      case 1:
        scale = lineHeight
      break
      case 2:
        scale = window.innerHeight
      break
    }
    dx *= scale
    dy *= scale
    dz *= scale
    if(dx || dy || dz) {
      return callback(dx, dy, dz, ev)
    }
  }
  element.addEventListener('wheel', listener)
  return listener
}

},{"to-px":207}],160:[function(require,module,exports){
"use strict"

var pool = require("typedarray-pool")

module.exports = createSurfaceExtractor

//Helper macros
function array(i) {
  return "a" + i
}
function data(i) {
  return "d" + i
}
function cube(i,bitmask) {
  return "c" + i + "_" + bitmask
}
function shape(i) {
  return "s" + i
}
function stride(i,j) {
  return "t" + i + "_" + j
}
function offset(i) {
  return "o" + i
}
function scalar(i) {
  return "x" + i
}
function pointer(i) {
  return "p" + i
}
function delta(i,bitmask) {
  return "d" + i + "_" + bitmask
}
function index(i) {
  return "i" + i
}
function step(i,j) {
  return "u" + i + "_" + j
}
function pcube(bitmask) {
  return "b" + bitmask
}
function qcube(bitmask) {
  return "y" + bitmask
}
function pdelta(bitmask) {
  return "e" + bitmask
}
function vert(i) {
  return "v" + i
}
var VERTEX_IDS = "V"
var PHASES = "P"
var VERTEX_COUNT = "N"
var POOL_SIZE = "Q"
var POINTER = "X"
var TEMPORARY = "T"

function permBitmask(dimension, mask, order) {
  var r = 0
  for(var i=0; i<dimension; ++i) {
    if(mask & (1<<i)) {
      r |= (1<<order[i])
    }
  }
  return r
}

//Generates the surface procedure
function compileSurfaceProcedure(vertexFunc, faceFunc, phaseFunc, scalarArgs, order, typesig) {
  var arrayArgs = typesig.length
  var dimension = order.length

  if(dimension < 2) {
    throw new Error("ndarray-extract-contour: Dimension must be at least 2")
  }

  var funcName = "extractContour" + order.join("_")
  var code = []
  var vars = []
  var args = []

  //Assemble arguments
  for(var i=0; i<arrayArgs; ++i) {
    args.push(array(i))  
  }
  for(var i=0; i<scalarArgs; ++i) {
    args.push(scalar(i))
  }

  //Shape
  for(var i=0; i<dimension; ++i) {
    vars.push(shape(i) + "=" + array(0) + ".shape[" + i + "]|0")
  }
  //Data, stride, offset pointers
  for(var i=0; i<arrayArgs; ++i) {
    vars.push(data(i) + "=" + array(i) + ".data",
              offset(i) + "=" + array(i) + ".offset|0")
    for(var j=0; j<dimension; ++j) {
      vars.push(stride(i,j) + "=" + array(i) + ".stride[" + j + "]|0")
    }
  }
  //Pointer, delta and cube variables
  for(var i=0; i<arrayArgs; ++i) {
    vars.push(pointer(i) + "=" + offset(i))
    vars.push(cube(i,0))
    for(var j=1; j<(1<<dimension); ++j) {
      var ptrStr = []
      for(var k=0; k<dimension; ++k) {
        if(j & (1<<k)) {
          ptrStr.push("-" + stride(i,k))
        }
      }
      vars.push(delta(i,j) + "=(" + ptrStr.join("") + ")|0")
      vars.push(cube(i,j) + "=0")
    }
  }
  //Create step variables
  for(var i=0; i<arrayArgs; ++i) {
    for(var j=0; j<dimension; ++j) {
      var stepVal = [ stride(i,order[j]) ]
      if(j > 0) {
        stepVal.push(stride(i, order[j-1]) + "*" + shape(order[j-1]) )
      }
      vars.push(step(i,order[j]) + "=(" + stepVal.join("-") + ")|0")
    }
  }
  //Create index variables
  for(var i=0; i<dimension; ++i) {
    vars.push(index(i) + "=0")
  }
  //Vertex count
  vars.push(VERTEX_COUNT + "=0")
  //Compute pool size, initialize pool step
  var sizeVariable = ["2"]
  for(var i=dimension-2; i>=0; --i) {
    sizeVariable.push(shape(order[i]))
  }
  //Previous phases and vertex_ids
  vars.push(POOL_SIZE + "=(" + sizeVariable.join("*") + ")|0",
            PHASES + "=mallocUint32(" + POOL_SIZE + ")",
            VERTEX_IDS + "=mallocUint32(" + POOL_SIZE + ")",
            POINTER + "=0")
  //Create cube variables for phases
  vars.push(pcube(0) + "=0")
  for(var j=1; j<(1<<dimension); ++j) {
    var cubeDelta = []
    var cubeStep = [ ]
    for(var k=0; k<dimension; ++k) {
      if(j & (1<<k)) {
        if(cubeStep.length === 0) {
          cubeDelta.push("1")
        } else {
          cubeDelta.unshift(cubeStep.join("*"))
        }
      }
      cubeStep.push(shape(order[k]))
    }
    var signFlag = ""
    if(cubeDelta[0].indexOf(shape(order[dimension-2])) < 0) {
      signFlag = "-"
    }
    var jperm = permBitmask(dimension, j, order)
    vars.push(pdelta(jperm) + "=(-" + cubeDelta.join("-") + ")|0",
              qcube(jperm) + "=(" + signFlag + cubeDelta.join("-") + ")|0",
              pcube(jperm) + "=0")
  }
  vars.push(vert(0) + "=0", TEMPORARY + "=0")

  function forLoopBegin(i, start) {
    code.push("for(", index(order[i]), "=", start, ";",
      index(order[i]), "<", shape(order[i]), ";",
      "++", index(order[i]), "){")
  }

  function forLoopEnd(i) {
    for(var j=0; j<arrayArgs; ++j) {
      code.push(pointer(j), "+=", step(j,order[i]), ";")
    }
    code.push("}")
  }

  function fillEmptySlice(k) {
    for(var i=k-1; i>=0; --i) {
      forLoopBegin(i, 0) 
    }
    var phaseFuncArgs = []
    for(var i=0; i<arrayArgs; ++i) {
      if(typesig[i]) {
        phaseFuncArgs.push(data(i) + ".get(" + pointer(i) + ")")
      } else {
        phaseFuncArgs.push(data(i) + "[" + pointer(i) + "]")
      }
    }
    for(var i=0; i<scalarArgs; ++i) {
      phaseFuncArgs.push(scalar(i))
    }
    code.push(PHASES, "[", POINTER, "++]=phase(", phaseFuncArgs.join(), ");")
    for(var i=0; i<k; ++i) {
      forLoopEnd(i)
    }
    for(var j=0; j<arrayArgs; ++j) {
      code.push(pointer(j), "+=", step(j,order[k]), ";")
    }
  }

  function processGridCell(mask) {
    //Read in local data
    for(var i=0; i<arrayArgs; ++i) {
      if(typesig[i]) {
        code.push(cube(i,0), "=", data(i), ".get(", pointer(i), ");")
      } else {
        code.push(cube(i,0), "=", data(i), "[", pointer(i), "];")
      }
    }

    //Read in phase
    var phaseFuncArgs = []
    for(var i=0; i<arrayArgs; ++i) {
      phaseFuncArgs.push(cube(i,0))
    }
    for(var i=0; i<scalarArgs; ++i) {
      phaseFuncArgs.push(scalar(i))
    }
    
    code.push(pcube(0), "=", PHASES, "[", POINTER, "]=phase(", phaseFuncArgs.join(), ");")
    
    //Read in other cube data
    for(var j=1; j<(1<<dimension); ++j) {
      code.push(pcube(j), "=", PHASES, "[", POINTER, "+", pdelta(j), "];")
    }

    //Check for boundary crossing
    var vertexPredicate = []
    for(var j=1; j<(1<<dimension); ++j) {
      vertexPredicate.push("(" + pcube(0) + "!==" + pcube(j) + ")")
    }
    code.push("if(", vertexPredicate.join("||"), "){")

    //Read in boundary data
    var vertexArgs = []
    for(var i=0; i<dimension; ++i) {
      vertexArgs.push(index(i))
    }
    for(var i=0; i<arrayArgs; ++i) {
      vertexArgs.push(cube(i,0))
      for(var j=1; j<(1<<dimension); ++j) {
        if(typesig[i]) {
          code.push(cube(i,j), "=", data(i), ".get(", pointer(i), "+", delta(i,j), ");")
        } else {
          code.push(cube(i,j), "=", data(i), "[", pointer(i), "+", delta(i,j), "];")
        }
        vertexArgs.push(cube(i,j))
      }
    }
    for(var i=0; i<(1<<dimension); ++i) {
      vertexArgs.push(pcube(i))
    }
    for(var i=0; i<scalarArgs; ++i) {
      vertexArgs.push(scalar(i))
    }

    //Generate vertex
    code.push("vertex(", vertexArgs.join(), ");",
      vert(0), "=", VERTEX_IDS, "[", POINTER, "]=", VERTEX_COUNT, "++;")

    //Check for face crossings
    var base = (1<<dimension)-1
    var corner = pcube(base)
    for(var j=0; j<dimension; ++j) {
      if((mask & ~(1<<j))===0) {
        //Check face
        var subset = base^(1<<j)
        var edge = pcube(subset)
        var faceArgs = [ ]
        for(var k=subset; k>0; k=(k-1)&subset) {
          faceArgs.push(VERTEX_IDS + "[" + POINTER + "+" + pdelta(k) + "]")
        }
        faceArgs.push(vert(0))
        for(var k=0; k<arrayArgs; ++k) {
          if(j&1) {
            faceArgs.push(cube(k,base), cube(k,subset))
          } else {
            faceArgs.push(cube(k,subset), cube(k,base))
          }
        }
        if(j&1) {
          faceArgs.push(corner, edge)
        } else {
          faceArgs.push(edge, corner)
        }
        for(var k=0; k<scalarArgs; ++k) {
          faceArgs.push(scalar(k))
        }
        code.push("if(", corner, "!==", edge, "){",
          "face(", faceArgs.join(), ")}")
      }
    }
    
    //Increment pointer, close off if statement
    code.push("}",
      POINTER, "+=1;")
  }

  function flip() {
    for(var j=1; j<(1<<dimension); ++j) {
      code.push(TEMPORARY, "=", pdelta(j), ";",
                pdelta(j), "=", qcube(j), ";",
                qcube(j), "=", TEMPORARY, ";")
    }
  }

  function createLoop(i, mask) {
    if(i < 0) {
      processGridCell(mask)
      return
    }
    fillEmptySlice(i)
    code.push("if(", shape(order[i]), ">0){",
      index(order[i]), "=1;")
    createLoop(i-1, mask|(1<<order[i]))

    for(var j=0; j<arrayArgs; ++j) {
      code.push(pointer(j), "+=", step(j,order[i]), ";")
    }
    if(i === dimension-1) {
      code.push(POINTER, "=0;")
      flip()
    }
    forLoopBegin(i, 2)
    createLoop(i-1, mask)
    if(i === dimension-1) {
      code.push("if(", index(order[dimension-1]), "&1){",
        POINTER, "=0;}")
      flip()
    }
    forLoopEnd(i)
    code.push("}")
  }

  createLoop(dimension-1, 0)

  //Release scratch memory
  code.push("freeUint32(", VERTEX_IDS, ");freeUint32(", PHASES, ");")

  //Compile and link procedure
  var procedureCode = [
    "'use strict';",
    "function ", funcName, "(", args.join(), "){",
      "var ", vars.join(), ";",
      code.join(""),
    "}",
    "return ", funcName ].join("")

  var proc = new Function(
    "vertex", 
    "face", 
    "phase", 
    "mallocUint32", 
    "freeUint32",
    procedureCode)
  return proc(
    vertexFunc, 
    faceFunc, 
    phaseFunc, 
    pool.mallocUint32, 
    pool.freeUint32)
}

function createSurfaceExtractor(args) {
  function error(msg) {
    throw new Error("ndarray-extract-contour: " + msg)
  }
  if(typeof args !== "object") {
    error("Must specify arguments")
  }
  var order = args.order
  if(!Array.isArray(order)) {
    error("Must specify order")
  }
  var arrays = args.arrayArguments||1
  if(arrays < 1) {
    error("Must have at least one array argument")
  }
  var scalars = args.scalarArguments||0
  if(scalars < 0) {
    error("Scalar arg count must be > 0")
  }
  if(typeof args.vertex !== "function") {
    error("Must specify vertex creation function")
  }
  if(typeof args.cell !== "function") {
    error("Must specify cell creation function")
  }
  if(typeof args.phase !== "function") {
    error("Must specify phase function")
  }
  var getters = args.getters || []
  var typesig = new Array(arrays)
  for(var i=0; i<arrays; ++i) {
    if(getters.indexOf(i) >= 0) {
      typesig[i] = true
    } else {
      typesig[i] = false
    }
  }
  return compileSurfaceProcedure(
    args.vertex,
    args.cell,
    args.phase,
    scalars,
    order,
    typesig)
}
},{"typedarray-pool":212}],161:[function(require,module,exports){
"use strict"

var compile = require("cwise-compiler")

var EmptyProc = {
  body: "",
  args: [],
  thisVars: [],
  localVars: []
}

function fixup(x) {
  if(!x) {
    return EmptyProc
  }
  for(var i=0; i<x.args.length; ++i) {
    var a = x.args[i]
    if(i === 0) {
      x.args[i] = {name: a, lvalue:true, rvalue: !!x.rvalue, count:x.count||1 }
    } else {
      x.args[i] = {name: a, lvalue:false, rvalue:true, count: 1}
    }
  }
  if(!x.thisVars) {
    x.thisVars = []
  }
  if(!x.localVars) {
    x.localVars = []
  }
  return x
}

function pcompile(user_args) {
  return compile({
    args:     user_args.args,
    pre:      fixup(user_args.pre),
    body:     fixup(user_args.body),
    post:     fixup(user_args.proc),
    funcName: user_args.funcName
  })
}

function makeOp(user_args) {
  var args = []
  for(var i=0; i<user_args.args.length; ++i) {
    args.push("a"+i)
  }
  var wrapper = new Function("P", [
    "return function ", user_args.funcName, "_ndarrayops(", args.join(","), ") {P(", args.join(","), ");return a0}"
  ].join(""))
  return wrapper(pcompile(user_args))
}

var assign_ops = {
  add:  "+",
  sub:  "-",
  mul:  "*",
  div:  "/",
  mod:  "%",
  band: "&",
  bor:  "|",
  bxor: "^",
  lshift: "<<",
  rshift: ">>",
  rrshift: ">>>"
}
;(function(){
  for(var id in assign_ops) {
    var op = assign_ops[id]
    exports[id] = makeOp({
      args: ["array","array","array"],
      body: {args:["a","b","c"],
             body: "a=b"+op+"c"},
      funcName: id
    })
    exports[id+"eq"] = makeOp({
      args: ["array","array"],
      body: {args:["a","b"],
             body:"a"+op+"=b"},
      rvalue: true,
      funcName: id+"eq"
    })
    exports[id+"s"] = makeOp({
      args: ["array", "array", "scalar"],
      body: {args:["a","b","s"],
             body:"a=b"+op+"s"},
      funcName: id+"s"
    })
    exports[id+"seq"] = makeOp({
      args: ["array","scalar"],
      body: {args:["a","s"],
             body:"a"+op+"=s"},
      rvalue: true,
      funcName: id+"seq"
    })
  }
})();

var unary_ops = {
  not: "!",
  bnot: "~",
  neg: "-",
  recip: "1.0/"
}
;(function(){
  for(var id in unary_ops) {
    var op = unary_ops[id]
    exports[id] = makeOp({
      args: ["array", "array"],
      body: {args:["a","b"],
             body:"a="+op+"b"},
      funcName: id
    })
    exports[id+"eq"] = makeOp({
      args: ["array"],
      body: {args:["a"],
             body:"a="+op+"a"},
      rvalue: true,
      count: 2,
      funcName: id+"eq"
    })
  }
})();

var binary_ops = {
  and: "&&",
  or: "||",
  eq: "===",
  neq: "!==",
  lt: "<",
  gt: ">",
  leq: "<=",
  geq: ">="
}
;(function() {
  for(var id in binary_ops) {
    var op = binary_ops[id]
    exports[id] = makeOp({
      args: ["array","array","array"],
      body: {args:["a", "b", "c"],
             body:"a=b"+op+"c"},
      funcName: id
    })
    exports[id+"s"] = makeOp({
      args: ["array","array","scalar"],
      body: {args:["a", "b", "s"],
             body:"a=b"+op+"s"},
      funcName: id+"s"
    })
    exports[id+"eq"] = makeOp({
      args: ["array", "array"],
      body: {args:["a", "b"],
             body:"a=a"+op+"b"},
      rvalue:true,
      count:2,
      funcName: id+"eq"
    })
    exports[id+"seq"] = makeOp({
      args: ["array", "scalar"],
      body: {args:["a","s"],
             body:"a=a"+op+"s"},
      rvalue:true,
      count:2,
      funcName: id+"seq"
    })
  }
})();

var math_unary = [
  "abs",
  "acos",
  "asin",
  "atan",
  "ceil",
  "cos",
  "exp",
  "floor",
  "log",
  "round",
  "sin",
  "sqrt",
  "tan"
]
;(function() {
  for(var i=0; i<math_unary.length; ++i) {
    var f = math_unary[i]
    exports[f] = makeOp({
                    args: ["array", "array"],
                    pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                    body: {args:["a","b"], body:"a=this_f(b)", thisVars:["this_f"]},
                    funcName: f
                  })
    exports[f+"eq"] = makeOp({
                      args: ["array"],
                      pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                      body: {args: ["a"], body:"a=this_f(a)", thisVars:["this_f"]},
                      rvalue: true,
                      count: 2,
                      funcName: f+"eq"
                    })
  }
})();

var math_comm = [
  "max",
  "min",
  "atan2",
  "pow"
]
;(function(){
  for(var i=0; i<math_comm.length; ++i) {
    var f= math_comm[i]
    exports[f] = makeOp({
                  args:["array", "array", "array"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b","c"], body:"a=this_f(b,c)", thisVars:["this_f"]},
                  funcName: f
                })
    exports[f+"s"] = makeOp({
                  args:["array", "array", "scalar"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b","c"], body:"a=this_f(b,c)", thisVars:["this_f"]},
                  funcName: f+"s"
                  })
    exports[f+"eq"] = makeOp({ args:["array", "array"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b"], body:"a=this_f(a,b)", thisVars:["this_f"]},
                  rvalue: true,
                  count: 2,
                  funcName: f+"eq"
                  })
    exports[f+"seq"] = makeOp({ args:["array", "scalar"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b"], body:"a=this_f(a,b)", thisVars:["this_f"]},
                  rvalue:true,
                  count:2,
                  funcName: f+"seq"
                  })
  }
})();

var math_noncomm = [
  "atan2",
  "pow"
]
;(function(){
  for(var i=0; i<math_noncomm.length; ++i) {
    var f= math_noncomm[i]
    exports[f+"op"] = makeOp({
                  args:["array", "array", "array"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b","c"], body:"a=this_f(c,b)", thisVars:["this_f"]},
                  funcName: f+"op"
                })
    exports[f+"ops"] = makeOp({
                  args:["array", "array", "scalar"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b","c"], body:"a=this_f(c,b)", thisVars:["this_f"]},
                  funcName: f+"ops"
                  })
    exports[f+"opeq"] = makeOp({ args:["array", "array"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b"], body:"a=this_f(b,a)", thisVars:["this_f"]},
                  rvalue: true,
                  count: 2,
                  funcName: f+"opeq"
                  })
    exports[f+"opseq"] = makeOp({ args:["array", "scalar"],
                  pre: {args:[], body:"this_f=Math."+f, thisVars:["this_f"]},
                  body: {args:["a","b"], body:"a=this_f(b,a)", thisVars:["this_f"]},
                  rvalue:true,
                  count:2,
                  funcName: f+"opseq"
                  })
  }
})();

exports.any = compile({
  args:["array"],
  pre: EmptyProc,
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:1}], body: "if(a){return true}", localVars: [], thisVars: []},
  post: {args:[], localVars:[], thisVars:[], body:"return false"},
  funcName: "any"
})

exports.all = compile({
  args:["array"],
  pre: EmptyProc,
  body: {args:[{name:"x", lvalue:false, rvalue:true, count:1}], body: "if(!x){return false}", localVars: [], thisVars: []},
  post: {args:[], localVars:[], thisVars:[], body:"return true"},
  funcName: "all"
})

exports.sum = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=0"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:1}], body: "this_s+=a", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return this_s"},
  funcName: "sum"
})

exports.prod = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=1"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:1}], body: "this_s*=a", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return this_s"},
  funcName: "prod"
})

exports.norm2squared = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=0"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:2}], body: "this_s+=a*a", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return this_s"},
  funcName: "norm2squared"
})
  
exports.norm2 = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=0"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:2}], body: "this_s+=a*a", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return Math.sqrt(this_s)"},
  funcName: "norm2"
})
  

exports.norminf = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=0"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:4}], body:"if(-a>this_s){this_s=-a}else if(a>this_s){this_s=a}", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return this_s"},
  funcName: "norminf"
})

exports.norm1 = compile({
  args:["array"],
  pre: {args:[], localVars:[], thisVars:["this_s"], body:"this_s=0"},
  body: {args:[{name:"a", lvalue:false, rvalue:true, count:3}], body: "this_s+=a<0?-a:a", localVars: [], thisVars: ["this_s"]},
  post: {args:[], localVars:[], thisVars:["this_s"], body:"return this_s"},
  funcName: "norm1"
})

exports.sup = compile({
  args: [ "array" ],
  pre:
   { body: "this_h=-Infinity",
     args: [],
     thisVars: [ "this_h" ],
     localVars: [] },
  body:
   { body: "if(_inline_1_arg0_>this_h)this_h=_inline_1_arg0_",
     args: [{"name":"_inline_1_arg0_","lvalue":false,"rvalue":true,"count":2} ],
     thisVars: [ "this_h" ],
     localVars: [] },
  post:
   { body: "return this_h",
     args: [],
     thisVars: [ "this_h" ],
     localVars: [] }
 })

exports.inf = compile({
  args: [ "array" ],
  pre:
   { body: "this_h=Infinity",
     args: [],
     thisVars: [ "this_h" ],
     localVars: [] },
  body:
   { body: "if(_inline_1_arg0_<this_h)this_h=_inline_1_arg0_",
     args: [{"name":"_inline_1_arg0_","lvalue":false,"rvalue":true,"count":2} ],
     thisVars: [ "this_h" ],
     localVars: [] },
  post:
   { body: "return this_h",
     args: [],
     thisVars: [ "this_h" ],
     localVars: [] }
 })

exports.argmin = compile({
  args:["index","array","shape"],
  pre:{
    body:"{this_v=Infinity;this_i=_inline_0_arg2_.slice(0)}",
    args:[
      {name:"_inline_0_arg0_",lvalue:false,rvalue:false,count:0},
      {name:"_inline_0_arg1_",lvalue:false,rvalue:false,count:0},
      {name:"_inline_0_arg2_",lvalue:false,rvalue:true,count:1}
      ],
    thisVars:["this_i","this_v"],
    localVars:[]},
  body:{
    body:"{if(_inline_1_arg1_<this_v){this_v=_inline_1_arg1_;for(var _inline_1_k=0;_inline_1_k<_inline_1_arg0_.length;++_inline_1_k){this_i[_inline_1_k]=_inline_1_arg0_[_inline_1_k]}}}",
    args:[
      {name:"_inline_1_arg0_",lvalue:false,rvalue:true,count:2},
      {name:"_inline_1_arg1_",lvalue:false,rvalue:true,count:2}],
    thisVars:["this_i","this_v"],
    localVars:["_inline_1_k"]},
  post:{
    body:"{return this_i}",
    args:[],
    thisVars:["this_i"],
    localVars:[]}
})

exports.argmax = compile({
  args:["index","array","shape"],
  pre:{
    body:"{this_v=-Infinity;this_i=_inline_0_arg2_.slice(0)}",
    args:[
      {name:"_inline_0_arg0_",lvalue:false,rvalue:false,count:0},
      {name:"_inline_0_arg1_",lvalue:false,rvalue:false,count:0},
      {name:"_inline_0_arg2_",lvalue:false,rvalue:true,count:1}
      ],
    thisVars:["this_i","this_v"],
    localVars:[]},
  body:{
    body:"{if(_inline_1_arg1_>this_v){this_v=_inline_1_arg1_;for(var _inline_1_k=0;_inline_1_k<_inline_1_arg0_.length;++_inline_1_k){this_i[_inline_1_k]=_inline_1_arg0_[_inline_1_k]}}}",
    args:[
      {name:"_inline_1_arg0_",lvalue:false,rvalue:true,count:2},
      {name:"_inline_1_arg1_",lvalue:false,rvalue:true,count:2}],
    thisVars:["this_i","this_v"],
    localVars:["_inline_1_k"]},
  post:{
    body:"{return this_i}",
    args:[],
    thisVars:["this_i"],
    localVars:[]}
})  

exports.random = makeOp({
  args: ["array"],
  pre: {args:[], body:"this_f=Math.random", thisVars:["this_f"]},
  body: {args: ["a"], body:"a=this_f()", thisVars:["this_f"]},
  funcName: "random"
})

exports.assign = makeOp({
  args:["array", "array"],
  body: {args:["a", "b"], body:"a=b"},
  funcName: "assign" })

exports.assigns = makeOp({
  args:["array", "scalar"],
  body: {args:["a", "b"], body:"a=b"},
  funcName: "assigns" })


exports.equals = compile({
  args:["array", "array"],
  pre: EmptyProc,
  body: {args:[{name:"x", lvalue:false, rvalue:true, count:1},
               {name:"y", lvalue:false, rvalue:true, count:1}], 
        body: "if(x!==y){return false}", 
        localVars: [], 
        thisVars: []},
  post: {args:[], localVars:[], thisVars:[], body:"return true"},
  funcName: "equals"
})



},{"cwise-compiler":63}],162:[function(require,module,exports){
"use strict"

var pool = require("typedarray-pool")

var INSERTION_SORT_THRESHOLD = 32

function getMallocFree(dtype) {
  switch(dtype) {
    case "uint8":
      return [pool.mallocUint8, pool.freeUint8]
    case "uint16":
      return [pool.mallocUint16, pool.freeUint16]
    case "uint32":
      return [pool.mallocUint32, pool.freeUint32]
    case "int8":
      return [pool.mallocInt8, pool.freeInt8]
    case "int16":
      return [pool.mallocInt16, pool.freeInt16]
    case "int32":
      return [pool.mallocInt32, pool.freeInt32]
    case "float32":
      return [pool.mallocFloat, pool.freeFloat]
    case "float64":
      return [pool.mallocDouble, pool.freeDouble]
    default:
      return null
  }
}

function shapeArgs(dimension) {
  var args = []
  for(var i=0; i<dimension; ++i) {
    args.push("s"+i)
  }
  for(var i=0; i<dimension; ++i) {
    args.push("n"+i)
  }
  for(var i=1; i<dimension; ++i) {
    args.push("d"+i)
  }
  for(var i=1; i<dimension; ++i) {
    args.push("e"+i)
  }
  for(var i=1; i<dimension; ++i) {
    args.push("f"+i)
  }
  return args
}

function createInsertionSort(order, dtype) {

  var code = ["'use strict'"]
  var funcName = ["ndarrayInsertionSort", order.join("d"), dtype].join("")
  var funcArgs = ["left", "right", "data", "offset" ].concat(shapeArgs(order.length))
  var allocator = getMallocFree(dtype)
  
  var vars = [ "i,j,cptr,ptr=left*s0+offset" ]
  
  if(order.length > 1) {
    var scratch_shape = []
    for(var i=1; i<order.length; ++i) {
      vars.push("i"+i)
      scratch_shape.push("n"+i)
    }
    if(allocator) {
      vars.push("scratch=malloc(" + scratch_shape.join("*") + ")")
    } else {
      vars.push("scratch=new Array("+scratch_shape.join("*") + ")")
    }
    vars.push("dptr","sptr","a","b")
  } else {
    vars.push("scratch")
  }
  
  function dataRead(ptr) {
    if(dtype === "generic") {
      return ["data.get(", ptr, ")"].join("")
    }
    return ["data[",ptr,"]"].join("")
  }
  
  function dataWrite(ptr, v) {
    if(dtype === "generic") {
      return ["data.set(", ptr, ",", v, ")"].join("")
    }
    return ["data[",ptr,"]=",v].join("")
  }
  
  //Create function header
  code.push(
    ["function ", funcName, "(", funcArgs.join(","), "){var ", vars.join(",")].join(""),
      "for(i=left+1;i<=right;++i){",
        "j=i;ptr+=s0",
        "cptr=ptr")
  
  
  if(order.length > 1) {
  
    //Copy data into scratch
    code.push("dptr=0;sptr=ptr")
    for(var i=order.length-1; i>=0; --i) {
      var j = order[i]
      if(j === 0) {
        continue
      }
      code.push(["for(i",j,"=0;i",j,"<n",j,";++i",j,"){"].join(""))
    }
    code.push("scratch[dptr++]=",dataRead("sptr"))
    for(var i=0; i<order.length; ++i) {
      var j = order[i]
      if(j === 0) {
        continue
      }
      code.push("sptr+=d"+j,"}")
    }

    
    //Compare items in outer loop
    code.push("__g:while(j-->left){",
              "dptr=0",
              "sptr=cptr-s0")
    for(var i=1; i<order.length; ++i) {
      if(i === 1) {
        code.push("__l:")
      }
      code.push(["for(i",i,"=0;i",i,"<n",i,";++i",i,"){"].join(""))
    }
    code.push(["a=", dataRead("sptr"),"\nb=scratch[dptr]\nif(a<b){break __g}\nif(a>b){break __l}"].join(""))
    for(var i=order.length-1; i>=1; --i) {
      code.push(
        "sptr+=e"+i,
        "dptr+=f"+i,
        "}")
    }
    
    //Copy data back
    code.push("dptr=cptr;sptr=cptr-s0")
    for(var i=order.length-1; i>=0; --i) {
      var j = order[i]
      if(j === 0) {
        continue
      }
      code.push(["for(i",j,"=0;i",j,"<n",j,";++i",j,"){"].join(""))
    }
    code.push(dataWrite("dptr", dataRead("sptr")))
    for(var i=0; i<order.length; ++i) {
      var j = order[i]
      if(j === 0) {
        continue
      }
      code.push(["dptr+=d",j,";sptr+=d",j].join(""),"}")
    }
    
    //Close while loop
    code.push("cptr-=s0\n}")

    //Copy scratch into cptr
    code.push("dptr=cptr;sptr=0")
    for(var i=order.length-1; i>=0; --i) {
      var j = order[i]
      if(j === 0) {
        continue
      }
      code.push(["for(i",j,"=0;i",j,"<n",j,";++i",j,"){"].join(""))
    }
    code.push(dataWrite("dptr", "scratch[sptr++]"))
    for(var i=0; i<order.length; ++i) {
      var j = order[i]
      if(j === 0) {
        continue
      }
      code.push("dptr+=d"+j,"}")
    }
  } else {
    code.push("scratch=" + dataRead("ptr"),
              "while((j-->left)&&("+dataRead("cptr-s0")+">scratch)){",
                dataWrite("cptr", dataRead("cptr-s0")),
                "cptr-=s0",
              "}",
              dataWrite("cptr", "scratch"))
  }
  
  //Close outer loop body
  code.push("}")
  if(order.length > 1 && allocator) {
    code.push("free(scratch)")
  }
  code.push("} return " + funcName)
  
  //Compile and link function
  if(allocator) {
    var result = new Function("malloc", "free", code.join("\n"))
    return result(allocator[0], allocator[1])
  } else {
    var result = new Function(code.join("\n"))
    return result()
  }
}

function createQuickSort(order, dtype, insertionSort) {
  var code = [ "'use strict'" ]
  var funcName = ["ndarrayQuickSort", order.join("d"), dtype].join("")
  var funcArgs = ["left", "right", "data", "offset" ].concat(shapeArgs(order.length))
  var allocator = getMallocFree(dtype)
  var labelCounter=0
  
  code.push(["function ", funcName, "(", funcArgs.join(","), "){"].join(""))
  
  var vars = [
    "sixth=((right-left+1)/6)|0",
    "index1=left+sixth",
    "index5=right-sixth",
    "index3=(left+right)>>1",
    "index2=index3-sixth",
    "index4=index3+sixth",
    "el1=index1",
    "el2=index2",
    "el3=index3",
    "el4=index4",
    "el5=index5",
    "less=left+1",
    "great=right-1",
    "pivots_are_equal=true",
    "tmp",
    "tmp0",
    "x",
    "y",
    "z",
    "k",
    "ptr0",
    "ptr1",
    "ptr2",
    "comp_pivot1=0",
    "comp_pivot2=0",
    "comp=0"
  ]
  
  if(order.length > 1) {
    var ele_size = []
    for(var i=1; i<order.length; ++i) {
      ele_size.push("n"+i)
      vars.push("i"+i)
    }
    for(var i=0; i<8; ++i) {
      vars.push("b_ptr"+i)
    }
    vars.push(
      "ptr3",
      "ptr4",
      "ptr5",
      "ptr6",
      "ptr7",
      "pivot_ptr",
      "ptr_shift",
      "elementSize="+ele_size.join("*"))
    if(allocator) {
      vars.push("pivot1=malloc(elementSize)",
                "pivot2=malloc(elementSize)")
    } else {
      vars.push("pivot1=new Array(elementSize),pivot2=new Array(elementSize)")
    }
  } else {
    vars.push("pivot1", "pivot2")
  }
  
  //Initialize local variables
  code.push("var " + vars.join(","))
  
  function toPointer(v) {
    return ["(offset+",v,"*s0)"].join("")
  }
  
  function dataRead(ptr) {
    if(dtype === "generic") {
      return ["data.get(", ptr, ")"].join("")
    }
    return ["data[",ptr,"]"].join("")
  }
  
  function dataWrite(ptr, v) {
    if(dtype === "generic") {
      return ["data.set(", ptr, ",", v, ")"].join("")
    }
    return ["data[",ptr,"]=",v].join("")
  }
  
  function cacheLoop(ptrs, usePivot, body) {
    if(ptrs.length === 1) {
      code.push("ptr0="+toPointer(ptrs[0]))
    } else {
      for(var i=0; i<ptrs.length; ++i) {
        code.push(["b_ptr",i,"=s0*",ptrs[i]].join(""))
      }
    }
    if(usePivot) {
      code.push("pivot_ptr=0")
    }
    code.push("ptr_shift=offset")
    for(var i=order.length-1; i>=0; --i) {
      var j = order[i]
      if(j === 0) {
        continue
      }
      code.push(["for(i",j,"=0;i",j,"<n",j,";++i",j,"){"].join(""))
    }
    if(ptrs.length > 1) {
      for(var i=0; i<ptrs.length; ++i) {
        code.push(["ptr",i,"=b_ptr",i,"+ptr_shift"].join(""))
      }
    }
    code.push(body)
    if(usePivot) {
      code.push("++pivot_ptr")
    }
    for(var i=0; i<order.length; ++i) {
      var j = order[i]
      if(j === 0) {
        continue
      }
      if(ptrs.length>1) {
        code.push("ptr_shift+=d"+j)
      } else {
        code.push("ptr0+=d"+j)
      }
      code.push("}")
    }
  }
  
  function lexicoLoop(label, ptrs, usePivot, body) {
    if(ptrs.length === 1) {
      code.push("ptr0="+toPointer(ptrs[0]))
    } else {
      for(var i=0; i<ptrs.length; ++i) {
        code.push(["b_ptr",i,"=s0*",ptrs[i]].join(""))
      }
      code.push("ptr_shift=offset")
    }
    if(usePivot) {
      code.push("pivot_ptr=0")
    }
    if(label) {
      code.push(label+":")
    }
    for(var i=1; i<order.length; ++i) {
      code.push(["for(i",i,"=0;i",i,"<n",i,";++i",i,"){"].join(""))
    }
    if(ptrs.length > 1) {
      for(var i=0; i<ptrs.length; ++i) {
        code.push(["ptr",i,"=b_ptr",i,"+ptr_shift"].join(""))
      }
    }
    code.push(body)
    for(var i=order.length-1; i>=1; --i) {
      if(usePivot) {
        code.push("pivot_ptr+=f"+i)
      }
      if(ptrs.length > 1) {
        code.push("ptr_shift+=e"+i)
      } else {
        code.push("ptr0+=e"+i)
      }
      code.push("}")
    }
  }
  
  function cleanUp() {
    if(order.length > 1 && allocator) {
      code.push("free(pivot1)", "free(pivot2)")
    }
  }
  
  function compareSwap(a_id, b_id) {
    var a = "el"+a_id
    var b = "el"+b_id
    if(order.length > 1) {
      var lbl = "__l" + (++labelCounter)
      lexicoLoop(lbl, [a, b], false, [
        "comp=",dataRead("ptr0"),"-",dataRead("ptr1"),"\n",
        "if(comp>0){tmp0=", a, ";",a,"=",b,";", b,"=tmp0;break ", lbl,"}\n",
        "if(comp<0){break ", lbl, "}"
      ].join(""))
    } else {
      code.push(["if(", dataRead(toPointer(a)), ">", dataRead(toPointer(b)), "){tmp0=", a, ";",a,"=",b,";", b,"=tmp0}"].join(""))
    }
  }
  
  compareSwap(1, 2)
  compareSwap(4, 5)
  compareSwap(1, 3)
  compareSwap(2, 3)
  compareSwap(1, 4)
  compareSwap(3, 4)
  compareSwap(2, 5)
  compareSwap(2, 3)
  compareSwap(4, 5)
  
  if(order.length > 1) {
    cacheLoop(["el1", "el2", "el3", "el4", "el5", "index1", "index3", "index5"], true, [
      "pivot1[pivot_ptr]=",dataRead("ptr1"),"\n",
      "pivot2[pivot_ptr]=",dataRead("ptr3"),"\n",
      "pivots_are_equal=pivots_are_equal&&(pivot1[pivot_ptr]===pivot2[pivot_ptr])\n",
      "x=",dataRead("ptr0"),"\n",
      "y=",dataRead("ptr2"),"\n",
      "z=",dataRead("ptr4"),"\n",
      dataWrite("ptr5", "x"),"\n",
      dataWrite("ptr6", "y"),"\n",
      dataWrite("ptr7", "z")
    ].join(""))
  } else {
    code.push([
      "pivot1=", dataRead(toPointer("el2")), "\n",
      "pivot2=", dataRead(toPointer("el4")), "\n",
      "pivots_are_equal=pivot1===pivot2\n",
      "x=", dataRead(toPointer("el1")), "\n",
      "y=", dataRead(toPointer("el3")), "\n",
      "z=", dataRead(toPointer("el5")), "\n",
      dataWrite(toPointer("index1"), "x"), "\n",
      dataWrite(toPointer("index3"), "y"), "\n",
      dataWrite(toPointer("index5"), "z")
    ].join(""))
  }
  

  function moveElement(dst, src) {
    if(order.length > 1) {
      cacheLoop([dst, src], false,
        dataWrite("ptr0", dataRead("ptr1"))
      )
    } else {
      code.push(dataWrite(toPointer(dst), dataRead(toPointer(src))))
    }
  }
  
  moveElement("index2", "left")
  moveElement("index4", "right")
  
  function comparePivot(result, ptr, n) {
    if(order.length > 1) {
      var lbl = "__l" + (++labelCounter)
      lexicoLoop(lbl, [ptr], true, [
        result,"=",dataRead("ptr0"),"-pivot",n,"[pivot_ptr]\n",
        "if(",result,"!==0){break ", lbl, "}"
      ].join(""))
    } else {
      code.push([result,"=", dataRead(toPointer(ptr)), "-pivot", n].join(""))
    }
  }
  
  function swapElements(a, b) {
    if(order.length > 1) {
      cacheLoop([a,b],false,[
        "tmp=",dataRead("ptr0"),"\n",
        dataWrite("ptr0", dataRead("ptr1")),"\n",
        dataWrite("ptr1", "tmp")
      ].join(""))
    } else {
      code.push([
        "ptr0=",toPointer(a),"\n",
        "ptr1=",toPointer(b),"\n",
        "tmp=",dataRead("ptr0"),"\n",
        dataWrite("ptr0", dataRead("ptr1")),"\n",
        dataWrite("ptr1", "tmp")
      ].join(""))
    }
  }
  
  function tripleSwap(k, less, great) {
    if(order.length > 1) {
      cacheLoop([k,less,great], false, [
        "tmp=",dataRead("ptr0"),"\n",
        dataWrite("ptr0", dataRead("ptr1")),"\n",
        dataWrite("ptr1", dataRead("ptr2")),"\n",
        dataWrite("ptr2", "tmp")
      ].join(""))
      code.push("++"+less, "--"+great)
    } else {
      code.push([
        "ptr0=",toPointer(k),"\n",
        "ptr1=",toPointer(less),"\n",
        "ptr2=",toPointer(great),"\n",
        "++",less,"\n",
        "--",great,"\n",
        "tmp=", dataRead("ptr0"), "\n",
        dataWrite("ptr0", dataRead("ptr1")), "\n",
        dataWrite("ptr1", dataRead("ptr2")), "\n",
        dataWrite("ptr2", "tmp")
      ].join(""))
    }
  }
  
  function swapAndDecrement(k, great) {
    swapElements(k, great)
    code.push("--"+great)
  }
    
  code.push("if(pivots_are_equal){")
    //Pivots are equal case
    code.push("for(k=less;k<=great;++k){")
      comparePivot("comp", "k", 1)
      code.push("if(comp===0){continue}")
      code.push("if(comp<0){")
        code.push("if(k!==less){")
          swapElements("k", "less")
        code.push("}")
        code.push("++less")
      code.push("}else{")
        code.push("while(true){")
          comparePivot("comp", "great", 1)
          code.push("if(comp>0){")
            code.push("great--")
          code.push("}else if(comp<0){")
            tripleSwap("k", "less", "great")
            code.push("break")
          code.push("}else{")
            swapAndDecrement("k", "great")
            code.push("break")
          code.push("}")
        code.push("}")
      code.push("}")
    code.push("}")
  code.push("}else{")
    //Pivots not equal case
    code.push("for(k=less;k<=great;++k){")
      comparePivot("comp_pivot1", "k", 1)
      code.push("if(comp_pivot1<0){")
        code.push("if(k!==less){")
          swapElements("k", "less")
        code.push("}")
        code.push("++less")
      code.push("}else{")
        comparePivot("comp_pivot2", "k", 2)
        code.push("if(comp_pivot2>0){")
          code.push("while(true){")
            comparePivot("comp", "great", 2)
            code.push("if(comp>0){")
              code.push("if(--great<k){break}")
              code.push("continue")
            code.push("}else{")
              comparePivot("comp", "great", 1)
              code.push("if(comp<0){")
                tripleSwap("k", "less", "great")
              code.push("}else{")
                swapAndDecrement("k", "great")
              code.push("}")
              code.push("break")
            code.push("}")
          code.push("}")
        code.push("}")
      code.push("}")
    code.push("}")
  code.push("}")
  
  //Move pivots to correct place
  function storePivot(mem_dest, pivot_dest, pivot) {
    if(order.length>1) {
      cacheLoop([mem_dest, pivot_dest], true, [
        dataWrite("ptr0", dataRead("ptr1")), "\n",
        dataWrite("ptr1", ["pivot",pivot,"[pivot_ptr]"].join(""))
      ].join(""))
    } else {
      code.push(
          dataWrite(toPointer(mem_dest), dataRead(toPointer(pivot_dest))),
          dataWrite(toPointer(pivot_dest), "pivot"+pivot))
    }
  }
  
  storePivot("left", "(less-1)", 1)
  storePivot("right", "(great+1)", 2)

  //Recursive sort call
  function doSort(left, right) {
    code.push([
      "if((",right,"-",left,")<=",INSERTION_SORT_THRESHOLD,"){\n",
        "insertionSort(", left, ",", right, ",data,offset,", shapeArgs(order.length).join(","), ")\n",
      "}else{\n",
        funcName, "(", left, ",", right, ",data,offset,", shapeArgs(order.length).join(","), ")\n",
      "}"
    ].join(""))
  }
  doSort("left", "(less-2)")
  doSort("(great+2)", "right")
  
  //If pivots are equal, then early out
  code.push("if(pivots_are_equal){")
    cleanUp()
    code.push("return")
  code.push("}")
  
  function walkPointer(ptr, pivot, body) {
    if(order.length > 1) {
      code.push(["__l",++labelCounter,":while(true){"].join(""))
      cacheLoop([ptr], true, [
        "if(", dataRead("ptr0"), "!==pivot", pivot, "[pivot_ptr]){break __l", labelCounter, "}"
      ].join(""))
      code.push(body, "}")
    } else {
      code.push(["while(", dataRead(toPointer(ptr)), "===pivot", pivot, "){", body, "}"].join(""))
    }
  }
  
  //Check bounds
  code.push("if(less<index1&&great>index5){")
  
    walkPointer("less", 1, "++less")
    walkPointer("great", 2, "--great")
  
    code.push("for(k=less;k<=great;++k){")
      comparePivot("comp_pivot1", "k", 1)
      code.push("if(comp_pivot1===0){")
        code.push("if(k!==less){")
          swapElements("k", "less")
        code.push("}")
        code.push("++less")
      code.push("}else{")
        comparePivot("comp_pivot2", "k", 2)
        code.push("if(comp_pivot2===0){")
          code.push("while(true){")
            comparePivot("comp", "great", 2)
            code.push("if(comp===0){")
              code.push("if(--great<k){break}")
              code.push("continue")
            code.push("}else{")
              comparePivot("comp", "great", 1)
              code.push("if(comp<0){")
                tripleSwap("k", "less", "great")
              code.push("}else{")
                swapAndDecrement("k", "great")
              code.push("}")
              code.push("break")
            code.push("}")
          code.push("}")
        code.push("}")
      code.push("}")
    code.push("}")
  code.push("}")
  
  //Clean up and do a final sorting pass
  cleanUp()
  doSort("less", "great")
 
  //Close off main loop
  code.push("}return " + funcName)
  
  //Compile and link
  if(order.length > 1 && allocator) {
    var compiled = new Function("insertionSort", "malloc", "free", code.join("\n"))
    return compiled(insertionSort, allocator[0], allocator[1])
  }
  var compiled = new Function("insertionSort", code.join("\n"))
  return compiled(insertionSort)
}

function compileSort(order, dtype) {
  var code = ["'use strict'"]
  var funcName = ["ndarraySortWrapper", order.join("d"), dtype].join("")
  var funcArgs = [ "array" ]
  
  code.push(["function ", funcName, "(", funcArgs.join(","), "){"].join(""))
  
  //Unpack local variables from array
  var vars = ["data=array.data,offset=array.offset|0,shape=array.shape,stride=array.stride"]
  for(var i=0; i<order.length; ++i) {
    vars.push(["s",i,"=stride[",i,"]|0,n",i,"=shape[",i,"]|0"].join(""))
  }
  
  var scratch_stride = new Array(order.length)
  var nprod = []
  for(var i=0; i<order.length; ++i) {
    var k = order[i]
    if(k === 0) {
      continue
    }
    if(nprod.length === 0) {
      scratch_stride[k] = "1"
    } else {
      scratch_stride[k] = nprod.join("*")
    }
    nprod.push("n"+k)
  }
  
  var p = -1, q = -1
  for(var i=0; i<order.length; ++i) {
    var j = order[i]
    if(j !== 0) {
      if(p > 0) {
        vars.push(["d",j,"=s",j,"-d",p,"*n",p].join(""))
      } else {
        vars.push(["d",j,"=s",j].join(""))
      }
      p = j
    }
    var k = order.length-1-i
    if(k !== 0) {
      if(q > 0) {
        vars.push(["e",k,"=s",k,"-e",q,"*n",q,
                  ",f",k,"=",scratch_stride[k],"-f",q,"*n",q].join(""))
      } else {
        vars.push(["e",k,"=s",k,",f",k,"=",scratch_stride[k]].join(""))
      }
      q = k
    }
  }
  
  //Declare local variables
  code.push("var " + vars.join(","))
  
  //Create arguments for subroutine
  var sortArgs = ["0", "n0-1", "data", "offset"].concat(shapeArgs(order.length))
  
  //Call main sorting routine
  code.push([
    "if(n0<=",INSERTION_SORT_THRESHOLD,"){",
      "insertionSort(", sortArgs.join(","), ")}else{",
      "quickSort(", sortArgs.join(","),
    ")}"
  ].join(""))
  
  //Return
  code.push("}return " + funcName)
  
  //Link everything together
  var result = new Function("insertionSort", "quickSort", code.join("\n"))
  var insertionSort = createInsertionSort(order, dtype)
  var quickSort = createQuickSort(order, dtype, insertionSort)
  return result(insertionSort, quickSort)
}

module.exports = compileSort
},{"typedarray-pool":212}],163:[function(require,module,exports){
"use strict"

var compile = require("./lib/compile_sort.js")
var CACHE = {}

function sort(array) {
  var order = array.order
  var dtype = array.dtype
  var typeSig = [order, dtype ]
  var typeName = typeSig.join(":")
  var compiled = CACHE[typeName]
  if(!compiled) {
    CACHE[typeName] = compiled = compile(order, dtype)
  }
  compiled(array)
  return array
}

module.exports = sort
},{"./lib/compile_sort.js":162}],164:[function(require,module,exports){
var iota = require("iota-array")
var isBuffer = require("is-buffer")

var hasTypedArrays  = ((typeof Float64Array) !== "undefined")

function compare1st(a, b) {
  return a[0] - b[0]
}

function order() {
  var stride = this.stride
  var terms = new Array(stride.length)
  var i
  for(i=0; i<terms.length; ++i) {
    terms[i] = [Math.abs(stride[i]), i]
  }
  terms.sort(compare1st)
  var result = new Array(terms.length)
  for(i=0; i<result.length; ++i) {
    result[i] = terms[i][1]
  }
  return result
}

function compileConstructor(dtype, dimension) {
  var className = ["View", dimension, "d", dtype].join("")
  if(dimension < 0) {
    className = "View_Nil" + dtype
  }
  var useGetters = (dtype === "generic")

  if(dimension === -1) {
    //Special case for trivial arrays
    var code =
      "function "+className+"(a){this.data=a;};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return -1};\
proto.size=0;\
proto.dimension=-1;\
proto.shape=proto.stride=proto.order=[];\
proto.lo=proto.hi=proto.transpose=proto.step=\
function(){return new "+className+"(this.data);};\
proto.get=proto.set=function(){};\
proto.pick=function(){return null};\
return function construct_"+className+"(a){return new "+className+"(a);}"
    var procedure = new Function(code)
    return procedure()
  } else if(dimension === 0) {
    //Special case for 0d arrays
    var code =
      "function "+className+"(a,d) {\
this.data = a;\
this.offset = d\
};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return this.offset};\
proto.dimension=0;\
proto.size=1;\
proto.shape=\
proto.stride=\
proto.order=[];\
proto.lo=\
proto.hi=\
proto.transpose=\
proto.step=function "+className+"_copy() {\
return new "+className+"(this.data,this.offset)\
};\
proto.pick=function "+className+"_pick(){\
return TrivialArray(this.data);\
};\
proto.valueOf=proto.get=function "+className+"_get(){\
return "+(useGetters ? "this.data.get(this.offset)" : "this.data[this.offset]")+
"};\
proto.set=function "+className+"_set(v){\
return "+(useGetters ? "this.data.set(this.offset,v)" : "this.data[this.offset]=v")+"\
};\
return function construct_"+className+"(a,b,c,d){return new "+className+"(a,d)}"
    var procedure = new Function("TrivialArray", code)
    return procedure(CACHED_CONSTRUCTORS[dtype][0])
  }

  var code = ["'use strict'"]

  //Create constructor for view
  var indices = iota(dimension)
  var args = indices.map(function(i) { return "i"+i })
  var index_str = "this.offset+" + indices.map(function(i) {
        return "this.stride[" + i + "]*i" + i
      }).join("+")
  var shapeArg = indices.map(function(i) {
      return "b"+i
    }).join(",")
  var strideArg = indices.map(function(i) {
      return "c"+i
    }).join(",")
  code.push(
    "function "+className+"(a," + shapeArg + "," + strideArg + ",d){this.data=a",
      "this.shape=[" + shapeArg + "]",
      "this.stride=[" + strideArg + "]",
      "this.offset=d|0}",
    "var proto="+className+".prototype",
    "proto.dtype='"+dtype+"'",
    "proto.dimension="+dimension)

  //view.size:
  code.push("Object.defineProperty(proto,'size',{get:function "+className+"_size(){\
return "+indices.map(function(i) { return "this.shape["+i+"]" }).join("*"),
"}})")

  //view.order:
  if(dimension === 1) {
    code.push("proto.order=[0]")
  } else {
    code.push("Object.defineProperty(proto,'order',{get:")
    if(dimension < 4) {
      code.push("function "+className+"_order(){")
      if(dimension === 2) {
        code.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})")
      } else if(dimension === 3) {
        code.push(
"var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);\
if(s0>s1){\
if(s1>s2){\
return [2,1,0];\
}else if(s0>s2){\
return [1,2,0];\
}else{\
return [1,0,2];\
}\
}else if(s0>s2){\
return [2,0,1];\
}else if(s2>s1){\
return [0,1,2];\
}else{\
return [0,2,1];\
}}})")
      }
    } else {
      code.push("ORDER})")
    }
  }

  //view.set(i0, ..., v):
  code.push(
"proto.set=function "+className+"_set("+args.join(",")+",v){")
  if(useGetters) {
    code.push("return this.data.set("+index_str+",v)}")
  } else {
    code.push("return this.data["+index_str+"]=v}")
  }

  //view.get(i0, ...):
  code.push("proto.get=function "+className+"_get("+args.join(",")+"){")
  if(useGetters) {
    code.push("return this.data.get("+index_str+")}")
  } else {
    code.push("return this.data["+index_str+"]}")
  }

  //view.index:
  code.push(
    "proto.index=function "+className+"_index(", args.join(), "){return "+index_str+"}")

  //view.hi():
  code.push("proto.hi=function "+className+"_hi("+args.join(",")+"){return new "+className+"(this.data,"+
    indices.map(function(i) {
      return ["(typeof i",i,"!=='number'||i",i,"<0)?this.shape[", i, "]:i", i,"|0"].join("")
    }).join(",")+","+
    indices.map(function(i) {
      return "this.stride["+i + "]"
    }).join(",")+",this.offset)}")

  //view.lo():
  var a_vars = indices.map(function(i) { return "a"+i+"=this.shape["+i+"]" })
  var c_vars = indices.map(function(i) { return "c"+i+"=this.stride["+i+"]" })
  code.push("proto.lo=function "+className+"_lo("+args.join(",")+"){var b=this.offset,d=0,"+a_vars.join(",")+","+c_vars.join(","))
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'&&i"+i+">=0){\
d=i"+i+"|0;\
b+=c"+i+"*d;\
a"+i+"-=d}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a"+i
    }).join(",")+","+
    indices.map(function(i) {
      return "c"+i
    }).join(",")+",b)}")

  //view.step():
  code.push("proto.step=function "+className+"_step("+args.join(",")+"){var "+
    indices.map(function(i) {
      return "a"+i+"=this.shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "b"+i+"=this.stride["+i+"]"
    }).join(",")+",c=this.offset,d=0,ceil=Math.ceil")
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'){\
d=i"+i+"|0;\
if(d<0){\
c+=b"+i+"*(a"+i+"-1);\
a"+i+"=ceil(-a"+i+"/d)\
}else{\
a"+i+"=ceil(a"+i+"/d)\
}\
b"+i+"*=d\
}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a" + i
    }).join(",")+","+
    indices.map(function(i) {
      return "b" + i
    }).join(",")+",c)}")

  //view.transpose():
  var tShape = new Array(dimension)
  var tStride = new Array(dimension)
  for(var i=0; i<dimension; ++i) {
    tShape[i] = "a[i"+i+"]"
    tStride[i] = "b[i"+i+"]"
  }
  code.push("proto.transpose=function "+className+"_transpose("+args+"){"+
    args.map(function(n,idx) { return n + "=(" + n + "===undefined?" + idx + ":" + n + "|0)"}).join(";"),
    "var a=this.shape,b=this.stride;return new "+className+"(this.data,"+tShape.join(",")+","+tStride.join(",")+",this.offset)}")

  //view.pick():
  code.push("proto.pick=function "+className+"_pick("+args+"){var a=[],b=[],c=this.offset")
  for(var i=0; i<dimension; ++i) {
    code.push("if(typeof i"+i+"==='number'&&i"+i+">=0){c=(c+this.stride["+i+"]*i"+i+")|0}else{a.push(this.shape["+i+"]);b.push(this.stride["+i+"])}")
  }
  code.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}")

  //Add return statement
  code.push("return function construct_"+className+"(data,shape,stride,offset){return new "+className+"(data,"+
    indices.map(function(i) {
      return "shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "stride["+i+"]"
    }).join(",")+",offset)}")

  //Compile procedure
  var procedure = new Function("CTOR_LIST", "ORDER", code.join("\n"))
  return procedure(CACHED_CONSTRUCTORS[dtype], order)
}

function arrayDType(data) {
  if(isBuffer(data)) {
    return "buffer"
  }
  if(hasTypedArrays) {
    switch(Object.prototype.toString.call(data)) {
      case "[object Float64Array]":
        return "float64"
      case "[object Float32Array]":
        return "float32"
      case "[object Int8Array]":
        return "int8"
      case "[object Int16Array]":
        return "int16"
      case "[object Int32Array]":
        return "int32"
      case "[object Uint8Array]":
        return "uint8"
      case "[object Uint16Array]":
        return "uint16"
      case "[object Uint32Array]":
        return "uint32"
      case "[object Uint8ClampedArray]":
        return "uint8_clamped"
    }
  }
  if(Array.isArray(data)) {
    return "array"
  }
  return "generic"
}

var CACHED_CONSTRUCTORS = {
  "float32":[],
  "float64":[],
  "int8":[],
  "int16":[],
  "int32":[],
  "uint8":[],
  "uint16":[],
  "uint32":[],
  "array":[],
  "uint8_clamped":[],
  "buffer":[],
  "generic":[]
}

;(function() {
  for(var id in CACHED_CONSTRUCTORS) {
    CACHED_CONSTRUCTORS[id].push(compileConstructor(id, -1))
  }
});

function wrappedNDArrayCtor(data, shape, stride, offset) {
  if(data === undefined) {
    var ctor = CACHED_CONSTRUCTORS.array[0]
    return ctor([])
  } else if(typeof data === "number") {
    data = [data]
  }
  if(shape === undefined) {
    shape = [ data.length ]
  }
  var d = shape.length
  if(stride === undefined) {
    stride = new Array(d)
    for(var i=d-1, sz=1; i>=0; --i) {
      stride[i] = sz
      sz *= shape[i]
    }
  }
  if(offset === undefined) {
    offset = 0
    for(var i=0; i<d; ++i) {
      if(stride[i] < 0) {
        offset -= (shape[i]-1)*stride[i]
      }
    }
  }
  var dtype = arrayDType(data)
  var ctor_list = CACHED_CONSTRUCTORS[dtype]
  while(ctor_list.length <= d+1) {
    ctor_list.push(compileConstructor(dtype, ctor_list.length-1))
  }
  var ctor = ctor_list[d+1]
  return ctor(data, shape, stride, offset)
}

module.exports = wrappedNDArrayCtor

},{"iota-array":146,"is-buffer":147}],165:[function(require,module,exports){
"use strict"

var doubleBits = require("double-bits")

var SMALLEST_DENORM = Math.pow(2, -1074)
var UINT_MAX = (-1)>>>0

module.exports = nextafter

function nextafter(x, y) {
  if(isNaN(x) || isNaN(y)) {
    return NaN
  }
  if(x === y) {
    return x
  }
  if(x === 0) {
    if(y < 0) {
      return -SMALLEST_DENORM
    } else {
      return SMALLEST_DENORM
    }
  }
  var hi = doubleBits.hi(x)
  var lo = doubleBits.lo(x)
  if((y > x) === (x > 0)) {
    if(lo === UINT_MAX) {
      hi += 1
      lo = 0
    } else {
      lo += 1
    }
  } else {
    if(lo === 0) {
      lo = UINT_MAX
      hi -= 1
    } else {
      lo -= 1
    }
  }
  return doubleBits.pack(lo, hi)
}
},{"double-bits":67}],166:[function(require,module,exports){
var DEFAULT_NORMALS_EPSILON = 1e-6;
var DEFAULT_FACE_EPSILON = 1e-6;

//Estimate the vertex normals of a mesh
exports.vertexNormals = function(faces, positions, specifiedEpsilon) {

  var N         = positions.length;
  var normals   = new Array(N);
  var epsilon   = specifiedEpsilon === void(0) ? DEFAULT_NORMALS_EPSILON : specifiedEpsilon;

  //Initialize normal array
  for(var i=0; i<N; ++i) {
    normals[i] = [0.0, 0.0, 0.0];
  }

  //Walk over all the faces and add per-vertex contribution to normal weights
  for(var i=0; i<faces.length; ++i) {
    var f = faces[i];
    var p = 0;
    var c = f[f.length-1];
    var n = f[0];
    for(var j=0; j<f.length; ++j) {

      //Shift indices back
      p = c;
      c = n;
      n = f[(j+1) % f.length];

      var v0 = positions[p];
      var v1 = positions[c];
      var v2 = positions[n];

      //Compute infineteismal arcs
      var d01 = new Array(3);
      var m01 = 0.0;
      var d21 = new Array(3);
      var m21 = 0.0;
      for(var k=0; k<3; ++k) {
        d01[k] = v0[k]  - v1[k];
        m01   += d01[k] * d01[k];
        d21[k] = v2[k]  - v1[k];
        m21   += d21[k] * d21[k];
      }

      //Accumulate values in normal
      if(m01 * m21 > epsilon) {
        var norm = normals[c];
        var w = 1.0 / Math.sqrt(m01 * m21);
        for(var k=0; k<3; ++k) {
          var u = (k+1)%3;
          var v = (k+2)%3;
          norm[k] += w * (d21[u] * d01[v] - d21[v] * d01[u]);
        }
      }
    }
  }

  //Scale all normals to unit length
  for(var i=0; i<N; ++i) {
    var norm = normals[i];
    var m = 0.0;
    for(var k=0; k<3; ++k) {
      m += norm[k] * norm[k];
    }
    if(m > epsilon) {
      var w = 1.0 / Math.sqrt(m);
      for(var k=0; k<3; ++k) {
        norm[k] *= w;
      }
    } else {
      for(var k=0; k<3; ++k) {
        norm[k] = 0.0;
      }
    }
  }

  //Return the resulting set of patches
  return normals;
}

//Compute face normals of a mesh
exports.faceNormals = function(faces, positions, specifiedEpsilon) {

  var N         = faces.length;
  var normals   = new Array(N);
  var epsilon   = specifiedEpsilon === void(0) ? DEFAULT_FACE_EPSILON : specifiedEpsilon;

  for(var i=0; i<N; ++i) {
    var f = faces[i];
    var pos = new Array(3);
    for(var j=0; j<3; ++j) {
      pos[j] = positions[f[j]];
    }

    var d01 = new Array(3);
    var d21 = new Array(3);
    for(var j=0; j<3; ++j) {
      d01[j] = pos[1][j] - pos[0][j];
      d21[j] = pos[2][j] - pos[0][j];
    }

    var n = new Array(3);
    var l = 0.0;
    for(var j=0; j<3; ++j) {
      var u = (j+1)%3;
      var v = (j+2)%3;
      n[j] = d01[u] * d21[v] - d01[v] * d21[u];
      l += n[j] * n[j];
    }
    if(l > epsilon) {
      l = 1.0 / Math.sqrt(l);
    } else {
      l = 0.0;
    }
    for(var j=0; j<3; ++j) {
      n[j] *= l;
    }
    normals[i] = n;
  }
  return normals;
}



},{}],167:[function(require,module,exports){
'use strict'

module.exports = quatFromFrame

function quatFromFrame(
  out,
  rx, ry, rz,
  ux, uy, uz,
  fx, fy, fz) {
  var tr = rx + uy + fz
  if(l > 0) {
    var l = Math.sqrt(tr + 1.0)
    out[0] = 0.5 * (uz - fy) / l
    out[1] = 0.5 * (fx - rz) / l
    out[2] = 0.5 * (ry - uy) / l
    out[3] = 0.5 * l
  } else {
    var tf = Math.max(rx, uy, fz)
    var l = Math.sqrt(2 * tf - tr + 1.0)
    if(rx >= tf) {
      //x y z  order
      out[0] = 0.5 * l
      out[1] = 0.5 * (ux + ry) / l
      out[2] = 0.5 * (fx + rz) / l
      out[3] = 0.5 * (uz - fy) / l
    } else if(uy >= tf) {
      //y z x  order
      out[0] = 0.5 * (ry + ux) / l
      out[1] = 0.5 * l
      out[2] = 0.5 * (fy + uz) / l
      out[3] = 0.5 * (fx - rz) / l
    } else {
      //z x y  order
      out[0] = 0.5 * (rz + fx) / l
      out[1] = 0.5 * (uz + fy) / l
      out[2] = 0.5 * l
      out[3] = 0.5 * (ry - ux) / l
    }
  }
  return out
}
},{}],168:[function(require,module,exports){
'use strict'

module.exports = createOrbitController

var filterVector  = require('filtered-vector')
var lookAt        = require('gl-mat4/lookAt')
var mat4FromQuat  = require('gl-mat4/fromQuat')
var invert44      = require('gl-mat4/invert')
var quatFromFrame = require('./lib/quatFromFrame')

function len3(x,y,z) {
  return Math.sqrt(Math.pow(x,2) + Math.pow(y,2) + Math.pow(z,2))
}

function len4(w,x,y,z) {
  return Math.sqrt(Math.pow(w,2) + Math.pow(x,2) + Math.pow(y,2) + Math.pow(z,2))
}

function normalize4(out, a) {
  var ax = a[0]
  var ay = a[1]
  var az = a[2]
  var aw = a[3]
  var al = len4(ax, ay, az, aw)
  if(al > 1e-6) {
    out[0] = ax/al
    out[1] = ay/al
    out[2] = az/al
    out[3] = aw/al
  } else {
    out[0] = out[1] = out[2] = 0.0
    out[3] = 1.0
  }
}

function OrbitCameraController(initQuat, initCenter, initRadius) {
  this.radius    = filterVector([initRadius])
  this.center    = filterVector(initCenter)
  this.rotation  = filterVector(initQuat)

  this.computedRadius   = this.radius.curve(0)
  this.computedCenter   = this.center.curve(0)
  this.computedRotation = this.rotation.curve(0)
  this.computedUp       = [0.1,0,0]
  this.computedEye      = [0.1,0,0]
  this.computedMatrix   = [0.1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]

  this.recalcMatrix(0)
}

var proto = OrbitCameraController.prototype

proto.lastT = function() {
  return Math.max(
    this.radius.lastT(),
    this.center.lastT(),
    this.rotation.lastT())
}

proto.recalcMatrix = function(t) {
  this.radius.curve(t)
  this.center.curve(t)
  this.rotation.curve(t)

  var quat = this.computedRotation
  normalize4(quat, quat)

  var mat = this.computedMatrix
  mat4FromQuat(mat, quat)

  var center = this.computedCenter
  var eye    = this.computedEye
  var up     = this.computedUp
  var radius = Math.exp(this.computedRadius[0])

  eye[0] = center[0] + radius * mat[2]
  eye[1] = center[1] + radius * mat[6]
  eye[2] = center[2] + radius * mat[10]
  up[0] = mat[1]
  up[1] = mat[5]
  up[2] = mat[9]

  for(var i=0; i<3; ++i) {
    var rr = 0.0
    for(var j=0; j<3; ++j) {
      rr += mat[i+4*j] * eye[j]
    }
    mat[12+i] = -rr
  }
}

proto.getMatrix = function(t, result) {
  this.recalcMatrix(t)
  var m = this.computedMatrix
  if(result) {
    for(var i=0; i<16; ++i) {
      result[i] = m[i]
    }
    return result
  }
  return m
}

proto.idle = function(t) {
  this.center.idle(t)
  this.radius.idle(t)
  this.rotation.idle(t)
}

proto.flush = function(t) {
  this.center.flush(t)
  this.radius.flush(t)
  this.rotation.flush(t)
}

proto.pan = function(t, dx, dy, dz) {
  dx = dx || 0.0
  dy = dy || 0.0
  dz = dz || 0.0

  this.recalcMatrix(t)
  var mat = this.computedMatrix

  var ux = mat[1]
  var uy = mat[5]
  var uz = mat[9]
  var ul = len3(ux, uy, uz)
  ux /= ul
  uy /= ul
  uz /= ul

  var rx = mat[0]
  var ry = mat[4]
  var rz = mat[8]
  var ru = rx * ux + ry * uy + rz * uz
  rx -= ux * ru
  ry -= uy * ru
  rz -= uz * ru
  var rl = len3(rx, ry, rz)
  rx /= rl
  ry /= rl
  rz /= rl

  var fx = mat[2]
  var fy = mat[6]
  var fz = mat[10]
  var fu = fx * ux + fy * uy + fz * uz
  var fr = fx * rx + fy * ry + fz * rz
  fx -= fu * ux + fr * rx
  fy -= fu * uy + fr * ry
  fz -= fu * uz + fr * rz
  var fl = len3(fx, fy, fz)
  fx /= fl
  fy /= fl
  fz /= fl

  var vx = rx * dx + ux * dy
  var vy = ry * dx + uy * dy
  var vz = rz * dx + uz * dy

  this.center.move(t, vx, vy, vz)

  //Update z-component of radius
  var radius = Math.exp(this.computedRadius[0])
  radius = Math.max(1e-4, radius + dz)
  this.radius.set(t, Math.log(radius))
}

proto.rotate = function(t, dx, dy, dz) {
  this.recalcMatrix(t)

  dx = dx||0.0
  dy = dy||0.0

  var mat = this.computedMatrix

  var rx = mat[0]
  var ry = mat[4]
  var rz = mat[8]

  var ux = mat[1]
  var uy = mat[5]
  var uz = mat[9]

  var fx = mat[2]
  var fy = mat[6]
  var fz = mat[10]

  var qx = dx * rx + dy * ux
  var qy = dx * ry + dy * uy
  var qz = dx * rz + dy * uz

  var bx = -(fy * qz - fz * qy)
  var by = -(fz * qx - fx * qz)
  var bz = -(fx * qy - fy * qx)  
  var bw = Math.sqrt(Math.max(0.0, 1.0 - Math.pow(bx,2) - Math.pow(by,2) - Math.pow(bz,2)))
  var bl = len4(bx, by, bz, bw)
  if(bl > 1e-6) {
    bx /= bl
    by /= bl
    bz /= bl
    bw /= bl
  } else {
    bx = by = bz = 0.0
    bw = 1.0
  }

  var rotation = this.computedRotation
  var ax = rotation[0]
  var ay = rotation[1]
  var az = rotation[2]
  var aw = rotation[3]

  var cx = ax*bw + aw*bx + ay*bz - az*by
  var cy = ay*bw + aw*by + az*bx - ax*bz
  var cz = az*bw + aw*bz + ax*by - ay*bx
  var cw = aw*bw - ax*bx - ay*by - az*bz
  
  //Apply roll
  if(dz) {
    bx = fx
    by = fy
    bz = fz
    var s = Math.sin(dz) / len3(bx, by, bz)
    bx *= s
    by *= s
    bz *= s
    bw = Math.cos(dx)
    cx = cx*bw + cw*bx + cy*bz - cz*by
    cy = cy*bw + cw*by + cz*bx - cx*bz
    cz = cz*bw + cw*bz + cx*by - cy*bx
    cw = cw*bw - cx*bx - cy*by - cz*bz
  }

  var cl = len4(cx, cy, cz, cw)
  if(cl > 1e-6) {
    cx /= cl
    cy /= cl
    cz /= cl
    cw /= cl
  } else {
    cx = cy = cz = 0.0
    cw = 1.0
  }

  this.rotation.set(t, cx, cy, cz, cw)
}

proto.lookAt = function(t, eye, center, up) {
  this.recalcMatrix(t)

  center = center || this.computedCenter
  eye    = eye    || this.computedEye
  up     = up     || this.computedUp

  var mat = this.computedMatrix
  lookAt(mat, eye, center, up)

  var rotation = this.computedRotation
  quatFromFrame(rotation,
    mat[0], mat[1], mat[2],
    mat[4], mat[5], mat[6],
    mat[8], mat[9], mat[10])
  normalize4(rotation, rotation)
  this.rotation.set(t, rotation[0], rotation[1], rotation[2], rotation[3])

  var fl = 0.0
  for(var i=0; i<3; ++i) {
    fl += Math.pow(center[i] - eye[i], 2)
  }
  this.radius.set(t, 0.5 * Math.log(Math.max(fl, 1e-6)))

  this.center.set(t, center[0], center[1], center[2])
}

proto.translate = function(t, dx, dy, dz) {
  this.center.move(t,
    dx||0.0,
    dy||0.0,
    dz||0.0)
}

proto.setMatrix = function(t, matrix) {

  var rotation = this.computedRotation
  quatFromFrame(rotation,
    matrix[0], matrix[1], matrix[2],
    matrix[4], matrix[5], matrix[6],
    matrix[8], matrix[9], matrix[10])
  normalize4(rotation, rotation)
  this.rotation.set(t, rotation[0], rotation[1], rotation[2], rotation[3])

  var mat = this.computedMatrix
  invert44(mat, matrix)
  var w = mat[15]
  if(Math.abs(w) > 1e-6) {
    var cx = mat[12]/w
    var cy = mat[13]/w
    var cz = mat[14]/w

    this.recalcMatrix(t)  
    var r = Math.exp(this.computedRadius[0])
    this.center.set(t, cx-mat[2]*r, cy-mat[6]*r, cz-mat[10]*r)
    this.radius.idle(t)
  } else {
    this.center.idle(t)
    this.radius.idle(t)
  }
}

proto.setDistance = function(t, d) {
  if(d > 0) {
    this.radius.set(t, Math.log(d))
  }
}

proto.setDistanceLimits = function(lo, hi) {
  if(lo > 0) {
    lo = Math.log(lo)
  } else {
    lo = -Infinity    
  }
  if(hi > 0) {
    hi = Math.log(hi)
  } else {
    hi = Infinity
  }
  hi = Math.max(hi, lo)
  this.radius.bounds[0][0] = lo
  this.radius.bounds[1][0] = hi
}

proto.getDistanceLimits = function(out) {
  var bounds = this.radius.bounds
  if(out) {
    out[0] = Math.exp(bounds[0][0])
    out[1] = Math.exp(bounds[1][0])
    return out
  }
  return [ Math.exp(bounds[0][0]), Math.exp(bounds[1][0]) ]
}

proto.toJSON = function() {
  this.recalcMatrix(this.lastT())
  return {
    center:   this.computedCenter.slice(),
    rotation: this.computedRotation.slice(),
    distance: Math.log(this.computedRadius[0]),
    zoomMin:  this.radius.bounds[0][0],
    zoomMax:  this.radius.bounds[1][0]
  }
}

proto.fromJSON = function(options) {
  var t = this.lastT()
  var c = options.center
  if(c) {
    this.center.set(t, c[0], c[1], c[2])
  }
  var r = options.rotation
  if(r) {
    this.rotation.set(t, r[0], r[1], r[2], r[3])
  }
  var d = options.distance
  if(d && d > 0) {
    this.radius.set(t, Math.log(d))
  }
  this.setDistanceLimits(options.zoomMin, options.zoomMax)
}

function createOrbitController(options) {
  options = options || {}
  var center   = options.center   || [0,0,0]
  var rotation = options.rotation || [0,0,0,1]
  var radius   = options.radius   || 1.0

  center = [].slice.call(center, 0, 3)
  rotation = [].slice.call(rotation, 0, 4)
  normalize4(rotation, rotation)

  var result = new OrbitCameraController(
    rotation,
    center,
    Math.log(radius))

  result.setDistanceLimits(options.zoomMin, options.zoomMax)

  if('eye' in options || 'up' in options) {
    result.lookAt(0, options.eye, options.center, options.up)
  }

  return result
}
},{"./lib/quatFromFrame":167,"filtered-vector":71,"gl-mat4/fromQuat":91,"gl-mat4/invert":96,"gl-mat4/lookAt":97}],169:[function(require,module,exports){
/*!
 * pad-left <https://github.com/jonschlinkert/pad-left>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT license.
 */

'use strict';

var repeat = require('repeat-string');

module.exports = function padLeft(str, num, ch) {
  ch = typeof ch !== 'undefined' ? (ch + '') : ' ';
  return repeat(ch, num) + str;
};
},{"repeat-string":183}],170:[function(require,module,exports){
module.exports = function parseUnit(str, out) {
    if (!out)
        out = [ 0, '' ]

    str = String(str)
    var num = parseFloat(str, 10)
    out[0] = num
    out[1] = str.match(/[\d.\-\+]*\s*(.*)/)[1] || ''
    return out
}
},{}],171:[function(require,module,exports){
"use strict"

module.exports = permutationSign

var BRUTE_FORCE_CUTOFF = 32

var pool = require("typedarray-pool")

function permutationSign(p) {
  var n = p.length
  if(n < BRUTE_FORCE_CUTOFF) {
    //Use quadratic algorithm for small n
    var sgn = 1
    for(var i=0; i<n; ++i) {
      for(var j=0; j<i; ++j) {
        if(p[i] < p[j]) {
          sgn = -sgn
        } else if(p[i] === p[j]) {
          return 0
        }
      }
    }
    return sgn
  } else {
    //Otherwise use linear time algorithm
    var visited = pool.mallocUint8(n)
    for(var i=0; i<n; ++i) {
      visited[i] = 0
    }
    var sgn = 1
    for(var i=0; i<n; ++i) {
      if(!visited[i]) {
        var count = 1
        visited[i] = 1
        for(var j=p[i]; j!==i; j=p[j]) {
          if(visited[j]) {
            pool.freeUint8(visited)
            return 0
          }
          count += 1
          visited[j] = 1
        }
        if(!(count & 1)) {
          sgn = -sgn
        }
      }
    }
    pool.freeUint8(visited)
    return sgn
  }
}
},{"typedarray-pool":212}],172:[function(require,module,exports){
"use strict"

var pool = require("typedarray-pool")
var inverse = require("invert-permutation")

function rank(permutation) {
  var n = permutation.length
  switch(n) {
    case 0:
    case 1:
      return 0
    case 2:
      return permutation[1]
    default:
      break
  }
  var p = pool.mallocUint32(n)
  var pinv = pool.mallocUint32(n)
  var r = 0, s, t, i
  inverse(permutation, pinv)
  for(i=0; i<n; ++i) {
    p[i] = permutation[i]
  }
  for(i=n-1; i>0; --i) {
    t = pinv[i]
    s = p[i]
    p[i] = p[t]
    p[t] = s
    pinv[i] = pinv[s]
    pinv[s] = t
    r = (r + s) * i
  }
  pool.freeUint32(pinv)
  pool.freeUint32(p)
  return r
}

function unrank(n, r, p) {
  switch(n) {
    case 0:
      if(p) { return p }
      return []
    case 1:
      if(p) {
        p[0] = 0
        return p
      } else {
        return [0]
      }
    case 2:
      if(p) {
        if(r) {
          p[0] = 0
          p[1] = 1
        } else {
          p[0] = 1
          p[1] = 0
        }
        return p
      } else {
        return r ? [0,1] : [1,0]
      }
    default:
      break
  }
  p = p || new Array(n)
  var s, t, i, nf=1
  p[0] = 0
  for(i=1; i<n; ++i) {
    p[i] = i
    nf = (nf*i)|0
  }
  for(i=n-1; i>0; --i) {
    s = (r / nf)|0
    r = (r - s * nf)|0
    nf = (nf / i)|0
    t = p[i]|0
    p[i] = p[s]|0
    p[s] = t|0
  }
  return p
}

exports.rank = rank
exports.unrank = unrank

},{"invert-permutation":145,"typedarray-pool":212}],173:[function(require,module,exports){
"use strict"

module.exports = planarDual

var compareAngle = require("compare-angle")

function planarDual(cells, positions) {

  var numVertices = positions.length|0
  var numEdges = cells.length
  var adj = [new Array(numVertices), new Array(numVertices)]
  for(var i=0; i<numVertices; ++i) {
    adj[0][i] = []
    adj[1][i] = []
  }
  for(var i=0; i<numEdges; ++i) {
    var c = cells[i]
    adj[0][c[0]].push(c)
    adj[1][c[1]].push(c)
  }

  var cycles = []

  //Add isolated vertices as trivial case
  for(var i=0; i<numVertices; ++i) {
    if(adj[0][i].length + adj[1][i].length === 0) {
      cycles.push( [i] )
    }
  }

  //Remove a half edge
  function cut(c, i) {
    var a = adj[i][c[i]]
    a.splice(a.indexOf(c), 1)
  }

  //Find next vertex and cut edge
  function next(a, b, noCut) {
    var nextCell, nextVertex, nextDir
    for(var i=0; i<2; ++i) {
      if(adj[i][b].length > 0) {
        nextCell = adj[i][b][0]
        nextDir = i
        break
      }
    }
    nextVertex = nextCell[nextDir^1]

    for(var dir=0; dir<2; ++dir) {
      var nbhd = adj[dir][b]
      for(var k=0; k<nbhd.length; ++k) {
        var e = nbhd[k]
        var p = e[dir^1]
        var cmp = compareAngle(
            positions[a], 
            positions[b], 
            positions[nextVertex],
            positions[p])
        if(cmp > 0) {
          nextCell = e
          nextVertex = p
          nextDir = dir
        }
      }
    }
    if(noCut) {
      return nextVertex
    }
    if(nextCell) {
      cut(nextCell, nextDir)
    }
    return nextVertex
  }

  function extractCycle(v, dir) {
    var e0 = adj[dir][v][0]
    var cycle = [v]
    cut(e0, dir)
    var u = e0[dir^1]
    var d0 = dir
    while(true) {
      while(u !== v) {
        cycle.push(u)
        u = next(cycle[cycle.length-2], u, false)
      }
      if(adj[0][v].length + adj[1][v].length === 0) {
        break
      }
      var a = cycle[cycle.length-1]
      var b = v
      var c = cycle[1]
      var d = next(a, b, true)
      if(compareAngle(positions[a], positions[b], positions[c], positions[d]) < 0) {
        break
      }
      cycle.push(v)
      u = next(a, b)
    }
    return cycle
  }

  function shouldGlue(pcycle, ncycle) {
    return (ncycle[1] === ncycle[ncycle.length-1])
  }

  for(var i=0; i<numVertices; ++i) {
    for(var j=0; j<2; ++j) {
      var pcycle = []
      while(adj[j][i].length > 0) {
        var ni = adj[0][i].length
        var ncycle = extractCycle(i,j)
        if(shouldGlue(pcycle, ncycle)) {
          //Glue together trivial cycles
          pcycle.push.apply(pcycle, ncycle)
        } else {
          if(pcycle.length > 0) {
            cycles.push(pcycle)
          }
          pcycle = ncycle
        }
      }
      if(pcycle.length > 0) {
        cycles.push(pcycle)
      }
    }
  }

  //Combine paths and loops together
  return cycles
}
},{"compare-angle":56}],174:[function(require,module,exports){
'use strict'

module.exports = trimLeaves

var e2a = require('edges-to-adjacency-list')

function trimLeaves(edges, positions) {
  var adj = e2a(edges, positions.length)
  var live = new Array(positions.length)
  var nbhd = new Array(positions.length)

  var dead = []
  for(var i=0; i<positions.length; ++i) {
    var count = adj[i].length
    nbhd[i] = count
    live[i] = true
    if(count <= 1) {
      dead.push(i)
    }
  }

  while(dead.length > 0) {
    var v = dead.pop()
    live[v] = false
    var n = adj[v]
    for(var i=0; i<n.length; ++i) {
      var u = n[i]
      if(--nbhd[u] === 0) {
        dead.push(u)
      }
    }
  }

  var newIndex = new Array(positions.length)
  var npositions = []
  for(var i=0; i<positions.length; ++i) {
    if(live[i]) {
      var v = npositions.length
      newIndex[i] = v
      npositions.push(positions[i])
    } else {
      newIndex[i] = -1
    }
  }

  var nedges = []
  for(var i=0; i<edges.length; ++i) {
    var e = edges[i]
    if(live[e[0]] && live[e[1]]) {
      nedges.push([ newIndex[e[0]], newIndex[e[1]] ])
    }
  }
  
  return [ nedges, npositions ]
}
},{"edges-to-adjacency-list":69}],175:[function(require,module,exports){
'use strict'

module.exports = planarGraphToPolyline

var e2a = require('edges-to-adjacency-list')
var planarDual = require('planar-dual')
var preprocessPolygon = require('point-in-big-polygon')
var twoProduct = require('two-product')
var robustSum = require('robust-sum')
var uniq = require('uniq')
var trimLeaves = require('./lib/trim-leaves')

function makeArray(length, fill) {
  var result = new Array(length)
  for(var i=0; i<length; ++i) {
    result[i] = fill
  }
  return result
}

function makeArrayOfArrays(length) {
  var result = new Array(length)
  for(var i=0; i<length; ++i) {
    result[i] = []
  }
  return result
}


function planarGraphToPolyline(edges, positions) {

  //Trim leaves
  var result = trimLeaves(edges, positions)
  edges = result[0]
  positions = result[1]

  var numVertices = positions.length
  var numEdges = edges.length

  //Calculate adjacency list, check manifold
  var adj = e2a(edges, positions.length)
  for(var i=0; i<numVertices; ++i) {
    if(adj[i].length % 2 === 1) {
      throw new Error('planar-graph-to-polyline: graph must be manifold')
    }
  }

  //Get faces
  var faces = planarDual(edges, positions)

  //Check orientation of a polygon using exact arithmetic
  function ccw(c) {
    var n = c.length
    var area = [0]
    for(var j=0; j<n; ++j) {
      var a = positions[c[j]]
      var b = positions[c[(j+1)%n]]
      var t00 = twoProduct(-a[0], a[1])
      var t01 = twoProduct(-a[0], b[1])
      var t10 = twoProduct( b[0], a[1])
      var t11 = twoProduct( b[0], b[1])
      area = robustSum(area, robustSum(robustSum(t00, t01), robustSum(t10, t11)))
    }
    return area[area.length-1] > 0
  }

  //Extract all clockwise faces
  faces = faces.filter(ccw)

  //Detect which loops are contained in one another to handle parent-of relation
  var numFaces = faces.length
  var parent = new Array(numFaces)
  var containment = new Array(numFaces)
  for(var i=0; i<numFaces; ++i) {
    parent[i] = i
    var row = new Array(numFaces)
    var loopVertices = faces[i].map(function(v) {
      return positions[v]
    })
    var pmc = preprocessPolygon([loopVertices])
    var count = 0
    outer:
    for(var j=0; j<numFaces; ++j) {
      row[j] = 0
      if(i === j) {
        continue
      }
      var c = faces[j]
      var n = c.length
      for(var k=0; k<n; ++k) {
        var d = pmc(positions[c[k]])
        if(d !== 0) {
          if(d < 0) {
            row[j] = 1
            count += 1
          }
          continue outer
        }
      }
      row[j] = 1
      count += 1
    }
    containment[i] = [count, i, row]
  }
  containment.sort(function(a,b) {
    return b[0] - a[0]
  })
  for(var i=0; i<numFaces; ++i) {
    var row = containment[i]
    var idx = row[1]
    var children = row[2]
    for(var j=0; j<numFaces; ++j) {
      if(children[j]) {
        parent[j] = idx
      }
    }
  }

  //Initialize face adjacency list
  var fadj = makeArrayOfArrays(numFaces)
  for(var i=0; i<numFaces; ++i) {
    fadj[i].push(parent[i])
    fadj[parent[i]].push(i)
  }

  //Build adjacency matrix for edges
  var edgeAdjacency = {}
  var internalVertices = makeArray(numVertices, false)
  for(var i=0; i<numFaces; ++i) {
    var c = faces[i]
    var n = c.length
    for(var j=0; j<n; ++j) {
      var a = c[j]
      var b = c[(j+1)%n]
      var key = Math.min(a,b) + ":" + Math.max(a,b)
      if(key in edgeAdjacency) {
        var neighbor = edgeAdjacency[key]
        fadj[neighbor].push(i)
        fadj[i].push(neighbor)
        internalVertices[a] = internalVertices[b] = true
      } else {
        edgeAdjacency[key] = i
      }
    }
  }

  function sharedBoundary(c) {
    var n = c.length
    for(var i=0; i<n; ++i) {
      if(!internalVertices[c[i]]) {
        return false
      }
    }
    return true
  }

  var toVisit = []
  var parity = makeArray(numFaces, -1)
  for(var i=0; i<numFaces; ++i) {
    if(parent[i] === i && !sharedBoundary(faces[i])) {
      toVisit.push(i)
      parity[i] = 0
    } else {
      parity[i] = -1
    }
  }

  //Using face adjacency, classify faces as in/out
  var result = []
  while(toVisit.length > 0) {
    var top = toVisit.pop()
    var nbhd = fadj[top]
    uniq(nbhd, function(a,b) {
      return a-b
    })
    var nnbhr = nbhd.length
    var p = parity[top]
    var polyline
    if(p === 0) {
      var c = faces[top]
      polyline = [c]
    }
    for(var i=0; i<nnbhr; ++i) {
      var f = nbhd[i]
      if(parity[f] >= 0) {
        continue
      }
      parity[f] = p^1
      toVisit.push(f)
      if(p === 0) {
        var c = faces[f]
        if(!sharedBoundary(c)) {
          c.reverse()
          polyline.push(c)
        }
      }
    }
    if(p === 0) {
      result.push(polyline)
    }
  }

  return result
}
},{"./lib/trim-leaves":174,"edges-to-adjacency-list":69,"planar-dual":173,"point-in-big-polygon":176,"robust-sum":195,"two-product":210,"uniq":214}],176:[function(require,module,exports){
module.exports = preprocessPolygon

var orient = require('robust-orientation')[3]
var makeSlabs = require('slab-decomposition')
var makeIntervalTree = require('interval-tree-1d')
var bsearch = require('binary-search-bounds')

function visitInterval() {
  return true
}

function intervalSearch(table) {
  return function(x, y) {
    var tree = table[x]
    if(tree) {
      return !!tree.queryPoint(y, visitInterval)
    }
    return false
  }
}

function buildVerticalIndex(segments) {
  var table = {}
  for(var i=0; i<segments.length; ++i) {
    var s = segments[i]
    var x = s[0][0]
    var y0 = s[0][1]
    var y1 = s[1][1]
    var p = [ Math.min(y0, y1), Math.max(y0, y1) ]
    if(x in table) {
      table[x].push(p)
    } else {
      table[x] = [ p ]
    }
  }
  var intervalTable = {}
  var keys = Object.keys(table)
  for(var i=0; i<keys.length; ++i) {
    var segs = table[keys[i]]
    intervalTable[keys[i]] = makeIntervalTree(segs)
  }
  return intervalSearch(intervalTable)
}

function buildSlabSearch(slabs, coordinates) {
  return function(p) {
    var bucket = bsearch.le(coordinates, p[0])
    if(bucket < 0) {
      return 1
    }
    var root = slabs[bucket]
    if(!root) {
      if(bucket > 0 && coordinates[bucket] === p[0]) {
        root = slabs[bucket-1]
      } else {
        return 1
      }
    }
    var lastOrientation = 1
    while(root) {
      var s = root.key
      var o = orient(p, s[0], s[1])
      if(s[0][0] < s[1][0]) {
        if(o < 0) {
          root = root.left
        } else if(o > 0) {
          lastOrientation = -1
          root = root.right
        } else {
          return 0
        }
      } else {
        if(o > 0) {
          root = root.left
        } else if(o < 0) {
          lastOrientation = 1
          root = root.right
        } else {
          return 0
        }
      }
    }
    return lastOrientation
  }
}

function classifyEmpty(p) {
  return 1
}

function createClassifyVertical(testVertical) {
  return function classify(p) {
    if(testVertical(p[0], p[1])) {
      return 0
    }
    return 1
  }
}

function createClassifyPointDegen(testVertical, testNormal) {
  return function classify(p) {
    if(testVertical(p[0], p[1])) {
      return 0
    }
    return testNormal(p)
  }
}

function preprocessPolygon(loops) {
  //Compute number of loops
  var numLoops = loops.length

  //Unpack segments
  var segments = []
  var vsegments = []
  var ptr = 0
  for(var i=0; i<numLoops; ++i) {
    var loop = loops[i]
    var numVertices = loop.length
    for(var s=numVertices-1,t=0; t<numVertices; s=(t++)) {
      var a = loop[s]
      var b = loop[t]
      if(a[0] === b[0]) {
        vsegments.push([a,b])
      } else {
        segments.push([a,b])
      }
    }
  }

  //Degenerate case: All loops are empty
  if(segments.length === 0) {
    if(vsegments.length === 0) {
      return classifyEmpty
    } else {
      return createClassifyVertical(buildVerticalIndex(vsegments))
    }
  }

  //Build slab decomposition
  var slabs = makeSlabs(segments)
  var testSlab = buildSlabSearch(slabs.slabs, slabs.coordinates)

  if(vsegments.length === 0) {
    return testSlab
  } else {
    return createClassifyPointDegen(
      buildVerticalIndex(vsegments),
      testSlab)
  }
}
},{"binary-search-bounds":34,"interval-tree-1d":144,"robust-orientation":190,"slab-decomposition":203}],177:[function(require,module,exports){
//Optimized version for triangle closest point
// Based on Eberly's WildMagick codes
// http://www.geometrictools.com/LibMathematics/Distance/Distance.html
"use strict";

var diff = new Float64Array(4);
var edge0 = new Float64Array(4);
var edge1 = new Float64Array(4);

function closestPoint2d(V0, V1, V2, point, result) {
  //Reallocate buffers if necessary
  if(diff.length < point.length) {
    diff = new Float64Array(point.length);
    edge0 = new Float64Array(point.length);
    edge1 = new Float64Array(point.length);
  }
  //Compute edges
  for(var i=0; i<point.length; ++i) {
    diff[i]  = V0[i] - point[i];
    edge0[i] = V1[i] - V0[i];
    edge1[i] = V2[i] - V0[i];
  }
  //Compute coefficients for quadratic func
  var a00 = 0.0
    , a01 = 0.0
    , a11 = 0.0
    , b0  = 0.0
    , b1  = 0.0
    , c   = 0.0;
  for(var i=0; i<point.length; ++i) {
    var e0 = edge0[i]
      , e1 = edge1[i]
      , d  = diff[i];
    a00 += e0 * e0;
    a01 += e0 * e1;
    a11 += e1 * e1;
    b0  += d * e0;
    b1  += d * e1;
    c   += d * d;
  }
  //Compute determinant/coeffs
  var det = Math.abs(a00*a11 - a01*a01);
  var s   = a01*b1 - a11*b0;
  var t   = a01*b0 - a00*b1;
  var sqrDistance;
  //Hardcoded Voronoi diagram classification
  if (s + t <= det) {
    if (s < 0) {
      if (t < 0) { // region 4
        if (b0 < 0) {
          t = 0;
          if (-b0 >= a00) {
            s = 1.0;
            sqrDistance = a00 + 2.0*b0 + c;
          } else {
            s = -b0/a00;
            sqrDistance = b0*s + c;
          }
        } else {
          s = 0;
          if (b1 >= 0) {
            t = 0;
            sqrDistance = c;
          } else if (-b1 >= a11) {
            t = 1;
            sqrDistance = a11 + 2.0*b1 + c;
          } else {
            t = -b1/a11;
            sqrDistance = b1*t + c;
          }
        }
      } else {  // region 3
        s = 0;
        if (b1 >= 0) {
          t = 0;
          sqrDistance = c;
        } else if (-b1 >= a11) {
          t = 1;
          sqrDistance = a11 + 2.0*b1 + c;
        } else {
          t = -b1/a11;
          sqrDistance = b1*t + c;
        }
      }
    } else if (t < 0) { // region 5
      t = 0;
      if (b0 >= 0) {
        s = 0;
        sqrDistance = c;
      } else if (-b0 >= a00) {
        s = 1;
        sqrDistance = a00 + 2.0*b0 + c;
      } else {
        s = -b0/a00;
        sqrDistance = b0*s + c;
      }
    } else {  // region 0
      // minimum at interior point
      var invDet = 1.0 / det;
      s *= invDet;
      t *= invDet;
      sqrDistance = s*(a00*s + a01*t + 2.0*b0) + t*(a01*s + a11*t + 2.0*b1) + c;
    }
  } else {
    var tmp0, tmp1, numer, denom;
    
    if (s < 0) {  // region 2
      tmp0 = a01 + b0;
      tmp1 = a11 + b1;
      if (tmp1 > tmp0) {
        numer = tmp1 - tmp0;
        denom = a00 - 2.0*a01 + a11;
        if (numer >= denom) {
          s = 1;
          t = 0;
          sqrDistance = a00 + 2.0*b0 + c;
        } else {
          s = numer/denom;
          t = 1 - s;
          sqrDistance = s*(a00*s + a01*t + 2.0*b0) +
          t*(a01*s + a11*t + 2.0*b1) + c;
        }
      } else {
        s = 0;
        if (tmp1 <= 0) {
          t = 1;
          sqrDistance = a11 + 2.0*b1 + c;
        } else if (b1 >= 0) {
          t = 0;
          sqrDistance = c;
        } else {
          t = -b1/a11;
          sqrDistance = b1*t + c;
        }
      }
    } else if (t < 0) {  // region 6
      tmp0 = a01 + b1;
      tmp1 = a00 + b0;
      if (tmp1 > tmp0) {
        numer = tmp1 - tmp0;
        denom = a00 - 2.0*a01 + a11;
        if (numer >= denom) {
          t = 1;
          s = 0;
          sqrDistance = a11 + 2.0*b1 + c;
        } else {
          t = numer/denom;
          s = 1 - t;
          sqrDistance = s*(a00*s + a01*t + 2.0*b0) +
          t*(a01*s + a11*t + 2.0*b1) + c;
        }
      } else {
        t = 0;
        if (tmp1 <= 0) {
          s = 1;
          sqrDistance = a00 + 2.0*b0 + c;
        } else if (b0 >= 0) {
          s = 0;
          sqrDistance = c;
        } else {
          s = -b0/a00;
          sqrDistance = b0*s + c;
        }
      }
    } else {  // region 1
      numer = a11 + b1 - a01 - b0;
      if (numer <= 0) {
        s = 0;
        t = 1;
        sqrDistance = a11 + 2.0*b1 + c;
      } else {
        denom = a00 - 2.0*a01 + a11;
        if (numer >= denom) {
          s = 1;
          t = 0;
          sqrDistance = a00 + 2.0*b0 + c;
        } else {
          s = numer/denom;
          t = 1 - s;
          sqrDistance = s*(a00*s + a01*t + 2.0*b0) +
          t*(a01*s + a11*t + 2.0*b1) + c;
        }
      }
    }
  }
  var u = 1.0 - s - t;
  for(var i=0; i<point.length; ++i) {
    result[i] = u * V0[i] + s * V1[i] + t * V2[i];
  }
  if(sqrDistance < 0) {
    return 0;
  }
  return sqrDistance;
}

module.exports = closestPoint2d;

},{}],178:[function(require,module,exports){
module.exports = require('gl-quat/slerp')
},{"gl-quat/slerp":110}],179:[function(require,module,exports){
'use strict'

var bnadd = require('big-rat/add')

module.exports = add

function add (a, b) {
  var n = a.length
  var r = new Array(n)
  for (var i=0; i<n; ++i) {
    r[i] = bnadd(a[i], b[i])
  }
  return r
}

},{"big-rat/add":18}],180:[function(require,module,exports){
'use strict'

module.exports = float2rat

var rat = require('big-rat')

function float2rat(v) {
  var result = new Array(v.length)
  for(var i=0; i<v.length; ++i) {
    result[i] = rat(v[i])
  }
  return result
}

},{"big-rat":21}],181:[function(require,module,exports){
'use strict'

var rat = require('big-rat')
var mul = require('big-rat/mul')

module.exports = muls

function muls(a, x) {
  var s = rat(x)
  var n = a.length
  var r = new Array(n)
  for(var i=0; i<n; ++i) {
    r[i] = mul(a[i], s)
  }
  return r
}

},{"big-rat":21,"big-rat/mul":30}],182:[function(require,module,exports){
'use strict'

var bnsub = require('big-rat/sub')

module.exports = sub

function sub(a, b) {
  var n = a.length
  var r = new Array(n)
    for(var i=0; i<n; ++i) {
    r[i] = bnsub(a[i], b[i])
  }
  return r
}

},{"big-rat/sub":32}],183:[function(require,module,exports){
/*!
 * repeat-string <https://github.com/jonschlinkert/repeat-string>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

/**
 * Results cache
 */

var res = '';
var cache;

/**
 * Expose `repeat`
 */

module.exports = repeat;

/**
 * Repeat the given `string` the specified `number`
 * of times.
 *
 * **Example:**
 *
 * ```js
 * var repeat = require('repeat-string');
 * repeat('A', 5);
 * //=> AAAAA
 * ```
 *
 * @param {String} `string` The string to repeat
 * @param {Number} `number` The number of times to repeat the string
 * @return {String} Repeated string
 * @api public
 */

function repeat(str, num) {
  if (typeof str !== 'string') {
    throw new TypeError('expected a string');
  }

  // cover common, quick use cases
  if (num === 1) return str;
  if (num === 2) return str + str;

  var max = str.length * num;
  if (cache !== str || typeof cache === 'undefined') {
    cache = str;
    res = '';
  } else if (res.length >= max) {
    return res.substr(0, max);
  }

  while (max > res.length && num > 1) {
    if (num & 1) {
      res += str;
    }

    num >>= 1;
    str += str;
  }

  res += str;
  res = res.substr(0, max);
  return res;
}

},{}],184:[function(require,module,exports){
(function (global){
module.exports =
  global.performance &&
  global.performance.now ? function now() {
    return performance.now()
  } : Date.now || function now() {
    return +new Date
  }

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],185:[function(require,module,exports){
"use strict"

module.exports = compressExpansion

function compressExpansion(e) {
  var m = e.length
  var Q = e[e.length-1]
  var bottom = m
  for(var i=m-2; i>=0; --i) {
    var a = Q
    var b = e[i]
    Q = a + b
    var bv = Q - a
    var q = b - bv
    if(q) {
      e[--bottom] = Q
      Q = q
    }
  }
  var top = 0
  for(var i=bottom; i<m; ++i) {
    var a = e[i]
    var b = Q
    Q = a + b
    var bv = Q - a
    var q = b - bv
    if(q) {
      e[top++] = q
    }
  }
  e[top++] = Q
  e.length = top
  return e
}
},{}],186:[function(require,module,exports){
"use strict"

var twoProduct = require("two-product")
var robustSum = require("robust-sum")
var robustScale = require("robust-scale")
var compress = require("robust-compress")

var NUM_EXPANDED = 6

function cofactor(m, c) {
  var result = new Array(m.length-1)
  for(var i=1; i<m.length; ++i) {
    var r = result[i-1] = new Array(m.length-1)
    for(var j=0,k=0; j<m.length; ++j) {
      if(j === c) {
        continue
      }
      r[k++] = m[i][j]
    }
  }
  return result
}

function matrix(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = new Array(n)
    for(var j=0; j<n; ++j) {
      result[i][j] = ["m[", i, "][", j, "]"].join("")
    }
  }
  return result
}

function sign(n) {
  if(n & 1) {
    return "-"
  }
  return ""
}

function generateSum(expr) {
  if(expr.length === 1) {
    return expr[0]
  } else if(expr.length === 2) {
    return ["sum(", expr[0], ",", expr[1], ")"].join("")
  } else {
    var m = expr.length>>1
    return ["sum(", generateSum(expr.slice(0, m)), ",", generateSum(expr.slice(m)), ")"].join("")
  }
}

function determinant(m) {
  if(m.length === 2) {
    return ["sum(prod(", m[0][0], ",", m[1][1], "),prod(-", m[0][1], ",", m[1][0], "))"].join("")
  } else {
    var expr = []
    for(var i=0; i<m.length; ++i) {
      expr.push(["scale(", determinant(cofactor(m, i)), ",", sign(i), m[0][i], ")"].join(""))
    }
    return generateSum(expr)
  }
}

function compileDeterminant(n) {
  var proc = new Function("sum", "scale", "prod", "compress", [
    "function robustDeterminant",n, "(m){return compress(", 
      determinant(matrix(n)),
    ")};return robustDeterminant", n].join(""))
  return proc(robustSum, robustScale, twoProduct, compress)
}

var CACHE = [
  function robustDeterminant0() { return [0] },
  function robustDeterminant1(m) { return [m[0][0]] }
]

function generateDispatch() {
  while(CACHE.length < NUM_EXPANDED) {
    CACHE.push(compileDeterminant(CACHE.length))
  }
  var procArgs = []
  var code = ["function robustDeterminant(m){switch(m.length){"]
  for(var i=0; i<NUM_EXPANDED; ++i) {
    procArgs.push("det" + i)
    code.push("case ", i, ":return det", i, "(m);")
  }
  code.push("}\
var det=CACHE[m.length];\
if(!det)\
det=CACHE[m.length]=gen(m.length);\
return det(m);\
}\
return robustDeterminant")
  procArgs.push("CACHE", "gen", code.join(""))
  var proc = Function.apply(undefined, procArgs)
  module.exports = proc.apply(undefined, CACHE.concat([CACHE, compileDeterminant]))
  for(var i=0; i<CACHE.length; ++i) {
    module.exports[i] = CACHE[i]
  }
}

generateDispatch()
},{"robust-compress":185,"robust-scale":192,"robust-sum":195,"two-product":210}],187:[function(require,module,exports){
"use strict"

var twoProduct = require("two-product")
var robustSum = require("robust-sum")

module.exports = robustDotProduct

function robustDotProduct(a, b) {
  var r = twoProduct(a[0], b[0])
  for(var i=1; i<a.length; ++i) {
    r = robustSum(r, twoProduct(a[i], b[i]))
  }
  return r
}
},{"robust-sum":195,"two-product":210}],188:[function(require,module,exports){
"use strict"

var twoProduct = require("two-product")
var robustSum = require("robust-sum")
var robustDiff = require("robust-subtract")
var robustScale = require("robust-scale")

var NUM_EXPAND = 6

function cofactor(m, c) {
  var result = new Array(m.length-1)
  for(var i=1; i<m.length; ++i) {
    var r = result[i-1] = new Array(m.length-1)
    for(var j=0,k=0; j<m.length; ++j) {
      if(j === c) {
        continue
      }
      r[k++] = m[i][j]
    }
  }
  return result
}

function matrix(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = new Array(n)
    for(var j=0; j<n; ++j) {
      result[i][j] = ["m", j, "[", (n-i-2), "]"].join("")
    }
  }
  return result
}

function generateSum(expr) {
  if(expr.length === 1) {
    return expr[0]
  } else if(expr.length === 2) {
    return ["sum(", expr[0], ",", expr[1], ")"].join("")
  } else {
    var m = expr.length>>1
    return ["sum(", generateSum(expr.slice(0, m)), ",", generateSum(expr.slice(m)), ")"].join("")
  }
}

function makeProduct(a, b) {
  if(a.charAt(0) === "m") {
    if(b.charAt(0) === "w") {
      var toks = a.split("[")
      return ["w", b.substr(1), "m", toks[0].substr(1)].join("")
    } else {
      return ["prod(", a, ",", b, ")"].join("")
    }
  } else {
    return makeProduct(b, a)
  }
}

function sign(s) {
  if(s & 1 !== 0) {
    return "-"
  }
  return ""
}

function determinant(m) {
  if(m.length === 2) {
    return [["diff(", makeProduct(m[0][0], m[1][1]), ",", makeProduct(m[1][0], m[0][1]), ")"].join("")]
  } else {
    var expr = []
    for(var i=0; i<m.length; ++i) {
      expr.push(["scale(", generateSum(determinant(cofactor(m, i))), ",", sign(i), m[0][i], ")"].join(""))
    }
    return expr
  }
}

function makeSquare(d, n) {
  var terms = []
  for(var i=0; i<n-2; ++i) {
    terms.push(["prod(m", d, "[", i, "],m", d, "[", i, "])"].join(""))
  }
  return generateSum(terms)
}

function orientation(n) {
  var pos = []
  var neg = []
  var m = matrix(n)
  for(var i=0; i<n; ++i) {
    m[0][i] = "1"
    m[n-1][i] = "w"+i
  } 
  for(var i=0; i<n; ++i) {
    if((i&1)===0) {
      pos.push.apply(pos,determinant(cofactor(m, i)))
    } else {
      neg.push.apply(neg,determinant(cofactor(m, i)))
    }
  }
  var posExpr = generateSum(pos)
  var negExpr = generateSum(neg)
  var funcName = "exactInSphere" + n
  var funcArgs = []
  for(var i=0; i<n; ++i) {
    funcArgs.push("m" + i)
  }
  var code = ["function ", funcName, "(", funcArgs.join(), "){"]
  for(var i=0; i<n; ++i) {
    code.push("var w",i,"=",makeSquare(i,n),";")
    for(var j=0; j<n; ++j) {
      if(j !== i) {
        code.push("var w",i,"m",j,"=scale(w",i,",m",j,"[0]);")
      }
    }
  }
  code.push("var p=", posExpr, ",n=", negExpr, ",d=diff(p,n);return d[d.length-1];}return ", funcName)
  var proc = new Function("sum", "diff", "prod", "scale", code.join(""))
  return proc(robustSum, robustDiff, twoProduct, robustScale)
}

function inSphere0() { return 0 }
function inSphere1() { return 0 }
function inSphere2() { return 0 }

var CACHED = [
  inSphere0,
  inSphere1,
  inSphere2
]

function slowInSphere(args) {
  var proc = CACHED[args.length]
  if(!proc) {
    proc = CACHED[args.length] = orientation(args.length)
  }
  return proc.apply(undefined, args)
}

function generateInSphereTest() {
  while(CACHED.length <= NUM_EXPAND) {
    CACHED.push(orientation(CACHED.length))
  }
  var args = []
  var procArgs = ["slow"]
  for(var i=0; i<=NUM_EXPAND; ++i) {
    args.push("a" + i)
    procArgs.push("o" + i)
  }
  var code = [
    "function testInSphere(", args.join(), "){switch(arguments.length){case 0:case 1:return 0;"
  ]
  for(var i=2; i<=NUM_EXPAND; ++i) {
    code.push("case ", i, ":return o", i, "(", args.slice(0, i).join(), ");")
  }
  code.push("}var s=new Array(arguments.length);for(var i=0;i<arguments.length;++i){s[i]=arguments[i]};return slow(s);}return testInSphere")
  procArgs.push(code.join(""))

  var proc = Function.apply(undefined, procArgs)

  module.exports = proc.apply(undefined, [slowInSphere].concat(CACHED))
  for(var i=0; i<=NUM_EXPAND; ++i) {
    module.exports[i] = CACHED[i]
  }
}

generateInSphereTest()
},{"robust-scale":192,"robust-subtract":194,"robust-sum":195,"two-product":210}],189:[function(require,module,exports){
"use strict"

var determinant = require("robust-determinant")

var NUM_EXPAND = 6

function generateSolver(n) {
  var funcName = "robustLinearSolve" + n + "d"
  var code = ["function ", funcName, "(A,b){return ["]
  for(var i=0; i<n; ++i) {
    code.push("det([")
    for(var j=0; j<n; ++j) {
      if(j > 0) {
        code.push(",")
      }
      code.push("[")
      for(var k=0; k<n; ++k) {
        if(k > 0) {
          code.push(",")
        }
        if(k === i) {
          code.push("+b[", j, "]")
        } else {
          code.push("+A[", j, "][", k, "]")
        }
      }
      code.push("]")
    }
    code.push("]),")
  }
  code.push("det(A)]}return ", funcName)
  var proc = new Function("det", code.join(""))
  if(n < 6) {
    return proc(determinant[n])
  }
  return proc(determinant)
}

function robustLinearSolve0d() {
  return [ 0 ]
}

function robustLinearSolve1d(A, b) {
  return [ [ b[0] ], [ A[0][0] ] ]
}

var CACHE = [
  robustLinearSolve0d,
  robustLinearSolve1d
]

function generateDispatch() {
  while(CACHE.length < NUM_EXPAND) {
    CACHE.push(generateSolver(CACHE.length))
  }
  var procArgs = []
  var code = ["function dispatchLinearSolve(A,b){switch(A.length){"]
  for(var i=0; i<NUM_EXPAND; ++i) {
    procArgs.push("s" + i)
    code.push("case ", i, ":return s", i, "(A,b);")
  }
  code.push("}var s=CACHE[A.length];if(!s)s=CACHE[A.length]=g(A.length);return s(A,b)}return dispatchLinearSolve")
  procArgs.push("CACHE", "g", code.join(""))
  var proc = Function.apply(undefined, procArgs)
  module.exports = proc.apply(undefined, CACHE.concat([CACHE, generateSolver]))
  for(var i=0; i<NUM_EXPAND; ++i) {
    module.exports[i] = CACHE[i]
  }
}

generateDispatch()
},{"robust-determinant":186}],190:[function(require,module,exports){
"use strict"

var twoProduct = require("two-product")
var robustSum = require("robust-sum")
var robustScale = require("robust-scale")
var robustSubtract = require("robust-subtract")

var NUM_EXPAND = 5

var EPSILON     = 1.1102230246251565e-16
var ERRBOUND3   = (3.0 + 16.0 * EPSILON) * EPSILON
var ERRBOUND4   = (7.0 + 56.0 * EPSILON) * EPSILON

function cofactor(m, c) {
  var result = new Array(m.length-1)
  for(var i=1; i<m.length; ++i) {
    var r = result[i-1] = new Array(m.length-1)
    for(var j=0,k=0; j<m.length; ++j) {
      if(j === c) {
        continue
      }
      r[k++] = m[i][j]
    }
  }
  return result
}

function matrix(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = new Array(n)
    for(var j=0; j<n; ++j) {
      result[i][j] = ["m", j, "[", (n-i-1), "]"].join("")
    }
  }
  return result
}

function sign(n) {
  if(n & 1) {
    return "-"
  }
  return ""
}

function generateSum(expr) {
  if(expr.length === 1) {
    return expr[0]
  } else if(expr.length === 2) {
    return ["sum(", expr[0], ",", expr[1], ")"].join("")
  } else {
    var m = expr.length>>1
    return ["sum(", generateSum(expr.slice(0, m)), ",", generateSum(expr.slice(m)), ")"].join("")
  }
}

function determinant(m) {
  if(m.length === 2) {
    return [["sum(prod(", m[0][0], ",", m[1][1], "),prod(-", m[0][1], ",", m[1][0], "))"].join("")]
  } else {
    var expr = []
    for(var i=0; i<m.length; ++i) {
      expr.push(["scale(", generateSum(determinant(cofactor(m, i))), ",", sign(i), m[0][i], ")"].join(""))
    }
    return expr
  }
}

function orientation(n) {
  var pos = []
  var neg = []
  var m = matrix(n)
  var args = []
  for(var i=0; i<n; ++i) {
    if((i&1)===0) {
      pos.push.apply(pos, determinant(cofactor(m, i)))
    } else {
      neg.push.apply(neg, determinant(cofactor(m, i)))
    }
    args.push("m" + i)
  }
  var posExpr = generateSum(pos)
  var negExpr = generateSum(neg)
  var funcName = "orientation" + n + "Exact"
  var code = ["function ", funcName, "(", args.join(), "){var p=", posExpr, ",n=", negExpr, ",d=sub(p,n);\
return d[d.length-1];};return ", funcName].join("")
  var proc = new Function("sum", "prod", "scale", "sub", code)
  return proc(robustSum, twoProduct, robustScale, robustSubtract)
}

var orientation3Exact = orientation(3)
var orientation4Exact = orientation(4)

var CACHED = [
  function orientation0() { return 0 },
  function orientation1() { return 0 },
  function orientation2(a, b) { 
    return b[0] - a[0]
  },
  function orientation3(a, b, c) {
    var l = (a[1] - c[1]) * (b[0] - c[0])
    var r = (a[0] - c[0]) * (b[1] - c[1])
    var det = l - r
    var s
    if(l > 0) {
      if(r <= 0) {
        return det
      } else {
        s = l + r
      }
    } else if(l < 0) {
      if(r >= 0) {
        return det
      } else {
        s = -(l + r)
      }
    } else {
      return det
    }
    var tol = ERRBOUND3 * s
    if(det >= tol || det <= -tol) {
      return det
    }
    return orientation3Exact(a, b, c)
  },
  function orientation4(a,b,c,d) {
    var adx = a[0] - d[0]
    var bdx = b[0] - d[0]
    var cdx = c[0] - d[0]
    var ady = a[1] - d[1]
    var bdy = b[1] - d[1]
    var cdy = c[1] - d[1]
    var adz = a[2] - d[2]
    var bdz = b[2] - d[2]
    var cdz = c[2] - d[2]
    var bdxcdy = bdx * cdy
    var cdxbdy = cdx * bdy
    var cdxady = cdx * ady
    var adxcdy = adx * cdy
    var adxbdy = adx * bdy
    var bdxady = bdx * ady
    var det = adz * (bdxcdy - cdxbdy) 
            + bdz * (cdxady - adxcdy)
            + cdz * (adxbdy - bdxady)
    var permanent = (Math.abs(bdxcdy) + Math.abs(cdxbdy)) * Math.abs(adz)
                  + (Math.abs(cdxady) + Math.abs(adxcdy)) * Math.abs(bdz)
                  + (Math.abs(adxbdy) + Math.abs(bdxady)) * Math.abs(cdz)
    var tol = ERRBOUND4 * permanent
    if ((det > tol) || (-det > tol)) {
      return det
    }
    return orientation4Exact(a,b,c,d)
  }
]

function slowOrient(args) {
  var proc = CACHED[args.length]
  if(!proc) {
    proc = CACHED[args.length] = orientation(args.length)
  }
  return proc.apply(undefined, args)
}

function generateOrientationProc() {
  while(CACHED.length <= NUM_EXPAND) {
    CACHED.push(orientation(CACHED.length))
  }
  var args = []
  var procArgs = ["slow"]
  for(var i=0; i<=NUM_EXPAND; ++i) {
    args.push("a" + i)
    procArgs.push("o" + i)
  }
  var code = [
    "function getOrientation(", args.join(), "){switch(arguments.length){case 0:case 1:return 0;"
  ]
  for(var i=2; i<=NUM_EXPAND; ++i) {
    code.push("case ", i, ":return o", i, "(", args.slice(0, i).join(), ");")
  }
  code.push("}var s=new Array(arguments.length);for(var i=0;i<arguments.length;++i){s[i]=arguments[i]};return slow(s);}return getOrientation")
  procArgs.push(code.join(""))

  var proc = Function.apply(undefined, procArgs)
  module.exports = proc.apply(undefined, [slowOrient].concat(CACHED))
  for(var i=0; i<=NUM_EXPAND; ++i) {
    module.exports[i] = CACHED[i]
  }
}

generateOrientationProc()
},{"robust-scale":192,"robust-subtract":194,"robust-sum":195,"two-product":210}],191:[function(require,module,exports){
"use strict"

var robustSum = require("robust-sum")
var robustScale = require("robust-scale")

module.exports = robustProduct

function robustProduct(a, b) {
  if(a.length === 1) {
    return robustScale(b, a[0])
  }
  if(b.length === 1) {
    return robustScale(a, b[0])
  }
  if(a.length === 0 || b.length === 0) {
    return [0]
  }
  var r = [0]
  if(a.length < b.length) {
    for(var i=0; i<a.length; ++i) {
      r = robustSum(r, robustScale(b, a[i]))
    }
  } else {
    for(var i=0; i<b.length; ++i) {
      r = robustSum(r, robustScale(a, b[i]))
    }    
  }
  return r
}
},{"robust-scale":192,"robust-sum":195}],192:[function(require,module,exports){
"use strict"

var twoProduct = require("two-product")
var twoSum = require("two-sum")

module.exports = scaleLinearExpansion

function scaleLinearExpansion(e, scale) {
  var n = e.length
  if(n === 1) {
    var ts = twoProduct(e[0], scale)
    if(ts[0]) {
      return ts
    }
    return [ ts[1] ]
  }
  var g = new Array(2 * n)
  var q = [0.1, 0.1]
  var t = [0.1, 0.1]
  var count = 0
  twoProduct(e[0], scale, q)
  if(q[0]) {
    g[count++] = q[0]
  }
  for(var i=1; i<n; ++i) {
    twoProduct(e[i], scale, t)
    var pq = q[1]
    twoSum(pq, t[0], q)
    if(q[0]) {
      g[count++] = q[0]
    }
    var a = t[1]
    var b = q[1]
    var x = a + b
    var bv = x - a
    var y = b - bv
    q[1] = x
    if(y) {
      g[count++] = y
    }
  }
  if(q[1]) {
    g[count++] = q[1]
  }
  if(count === 0) {
    g[count++] = 0.0
  }
  g.length = count
  return g
}
},{"two-product":210,"two-sum":211}],193:[function(require,module,exports){
"use strict"

module.exports = segmentsIntersect

var orient = require("robust-orientation")[3]

function checkCollinear(a0, a1, b0, b1) {

  for(var d=0; d<2; ++d) {
    var x0 = a0[d]
    var y0 = a1[d]
    var l0 = Math.min(x0, y0)
    var h0 = Math.max(x0, y0)    

    var x1 = b0[d]
    var y1 = b1[d]
    var l1 = Math.min(x1, y1)
    var h1 = Math.max(x1, y1)    

    if(h1 < l0 || h0 < l1) {
      return false
    }
  }

  return true
}

function segmentsIntersect(a0, a1, b0, b1) {
  var x0 = orient(a0, b0, b1)
  var y0 = orient(a1, b0, b1)
  if((x0 > 0 && y0 > 0) || (x0 < 0 && y0 < 0)) {
    return false
  }

  var x1 = orient(b0, a0, a1)
  var y1 = orient(b1, a0, a1)
  if((x1 > 0 && y1 > 0) || (x1 < 0 && y1 < 0)) {
    return false
  }

  //Check for degenerate collinear case
  if(x0 === 0 && y0 === 0 && x1 === 0 && y1 === 0) {
    return checkCollinear(a0, a1, b0, b1)
  }

  return true
}
},{"robust-orientation":190}],194:[function(require,module,exports){
"use strict"

module.exports = robustSubtract

//Easy case: Add two scalars
function scalarScalar(a, b) {
  var x = a + b
  var bv = x - a
  var av = x - bv
  var br = b - bv
  var ar = a - av
  var y = ar + br
  if(y) {
    return [y, x]
  }
  return [x]
}

function robustSubtract(e, f) {
  var ne = e.length|0
  var nf = f.length|0
  if(ne === 1 && nf === 1) {
    return scalarScalar(e[0], -f[0])
  }
  var n = ne + nf
  var g = new Array(n)
  var count = 0
  var eptr = 0
  var fptr = 0
  var abs = Math.abs
  var ei = e[eptr]
  var ea = abs(ei)
  var fi = -f[fptr]
  var fa = abs(fi)
  var a, b
  if(ea < fa) {
    b = ei
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
      ea = abs(ei)
    }
  } else {
    b = fi
    fptr += 1
    if(fptr < nf) {
      fi = -f[fptr]
      fa = abs(fi)
    }
  }
  if((eptr < ne && ea < fa) || (fptr >= nf)) {
    a = ei
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
      ea = abs(ei)
    }
  } else {
    a = fi
    fptr += 1
    if(fptr < nf) {
      fi = -f[fptr]
      fa = abs(fi)
    }
  }
  var x = a + b
  var bv = x - a
  var y = b - bv
  var q0 = y
  var q1 = x
  var _x, _bv, _av, _br, _ar
  while(eptr < ne && fptr < nf) {
    if(ea < fa) {
      a = ei
      eptr += 1
      if(eptr < ne) {
        ei = e[eptr]
        ea = abs(ei)
      }
    } else {
      a = fi
      fptr += 1
      if(fptr < nf) {
        fi = -f[fptr]
        fa = abs(fi)
      }
    }
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    }
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
  }
  while(eptr < ne) {
    a = ei
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    }
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
    }
  }
  while(fptr < nf) {
    a = fi
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    } 
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
    fptr += 1
    if(fptr < nf) {
      fi = -f[fptr]
    }
  }
  if(q0) {
    g[count++] = q0
  }
  if(q1) {
    g[count++] = q1
  }
  if(!count) {
    g[count++] = 0.0  
  }
  g.length = count
  return g
}
},{}],195:[function(require,module,exports){
"use strict"

module.exports = linearExpansionSum

//Easy case: Add two scalars
function scalarScalar(a, b) {
  var x = a + b
  var bv = x - a
  var av = x - bv
  var br = b - bv
  var ar = a - av
  var y = ar + br
  if(y) {
    return [y, x]
  }
  return [x]
}

function linearExpansionSum(e, f) {
  var ne = e.length|0
  var nf = f.length|0
  if(ne === 1 && nf === 1) {
    return scalarScalar(e[0], f[0])
  }
  var n = ne + nf
  var g = new Array(n)
  var count = 0
  var eptr = 0
  var fptr = 0
  var abs = Math.abs
  var ei = e[eptr]
  var ea = abs(ei)
  var fi = f[fptr]
  var fa = abs(fi)
  var a, b
  if(ea < fa) {
    b = ei
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
      ea = abs(ei)
    }
  } else {
    b = fi
    fptr += 1
    if(fptr < nf) {
      fi = f[fptr]
      fa = abs(fi)
    }
  }
  if((eptr < ne && ea < fa) || (fptr >= nf)) {
    a = ei
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
      ea = abs(ei)
    }
  } else {
    a = fi
    fptr += 1
    if(fptr < nf) {
      fi = f[fptr]
      fa = abs(fi)
    }
  }
  var x = a + b
  var bv = x - a
  var y = b - bv
  var q0 = y
  var q1 = x
  var _x, _bv, _av, _br, _ar
  while(eptr < ne && fptr < nf) {
    if(ea < fa) {
      a = ei
      eptr += 1
      if(eptr < ne) {
        ei = e[eptr]
        ea = abs(ei)
      }
    } else {
      a = fi
      fptr += 1
      if(fptr < nf) {
        fi = f[fptr]
        fa = abs(fi)
      }
    }
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    }
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
  }
  while(eptr < ne) {
    a = ei
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    }
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
    eptr += 1
    if(eptr < ne) {
      ei = e[eptr]
    }
  }
  while(fptr < nf) {
    a = fi
    b = q0
    x = a + b
    bv = x - a
    y = b - bv
    if(y) {
      g[count++] = y
    } 
    _x = q1 + x
    _bv = _x - q1
    _av = _x - _bv
    _br = x - _bv
    _ar = q1 - _av
    q0 = _ar + _br
    q1 = _x
    fptr += 1
    if(fptr < nf) {
      fi = f[fptr]
    }
  }
  if(q0) {
    g[count++] = q0
  }
  if(q1) {
    g[count++] = q1
  }
  if(!count) {
    g[count++] = 0.0  
  }
  g.length = count
  return g
}
},{}],196:[function(require,module,exports){
'use strict'

module.exports = extractContour

var ndarray = require('ndarray')
var pool    = require('typedarray-pool')
var ndsort  = require('ndarray-sort')

var contourAlgorithm = require('./lib/codegen')

function getDimension(cells) {
  var numCells = cells.length
  var d = 0
  for(var i=0; i<numCells; ++i) {
    d = Math.max(d, cells[i].length)|0
  }
  return d-1
}

function getSigns(values, level) {
  var numVerts    = values.length
  var vertexSigns = pool.mallocUint8(numVerts)
  for(var i=0; i<numVerts; ++i) {
    vertexSigns[i] = (values[i] < level)|0
  }
  return vertexSigns
}

function getEdges(cells, d) {
  var numCells = cells.length
  var maxEdges = ((d * (d+1)/2) * numCells)|0
  var edges    = pool.mallocUint32(maxEdges*2)
  var ePtr     = 0
  for(var i=0; i<numCells; ++i) {
    var c = cells[i]
    var d = c.length
    for(var j=0; j<d; ++j) {
      for(var k=0; k<j; ++k) {
        var a = c[k]
        var b = c[j]
        edges[ePtr++] = Math.min(a,b)|0
        edges[ePtr++] = Math.max(a,b)|0
      }
    }
  }
  var nedges = (ePtr/2)|0
  ndsort(ndarray(edges, [nedges,2])) 
  var ptr = 2
  for(var i=2; i<ePtr; i+=2) {
    if(edges[i-2] === edges[i] &&
       edges[i-1] === edges[i+1]) {
      continue
    }
    edges[ptr++] = edges[i]
    edges[ptr++] = edges[i+1]
  }

  return ndarray(edges, [(ptr/2)|0, 2])
}

function getCrossingWeights(edges, values, signs, level) {
  var edata     = edges.data
  var numEdges  = edges.shape[0]
  var weights   = pool.mallocDouble(numEdges)
  var ptr       = 0
  for(var i=0; i<numEdges; ++i) {
    var a  = edata[2*i]
    var b  = edata[2*i+1]
    if(signs[a] === signs[b]) {
      continue
    }
    var va = values[a]
    var vb = values[b]
    edata[2*ptr]     = a
    edata[2*ptr+1]   = b
    weights[ptr++]   = (vb - level) / (vb - va)
  }
  edges.shape[0] = ptr
  return ndarray(weights, [ptr])
}

function getCascade(edges, numVerts) {
  var result   = pool.mallocInt32(numVerts*2)
  var numEdges = edges.shape[0]
  var edata    = edges.data
  result[0]    = 0
  var lastV    = 0
  for(var i=0; i<numEdges; ++i) {
    var a = edata[2*i]
    if(a !== lastV) {
      result[2*lastV+1] = i
      while(++lastV < a) {
        result[2*lastV] = i
        result[2*lastV+1] = i
      }
      result[2*lastV] = i
    }
  }
  result[2*lastV+1] = numEdges
  while(++lastV < numVerts) {
    result[2*lastV] = result[2*lastV+1] = numEdges
  }
  return result
}

function unpackEdges(edges) {
  var ne = edges.shape[0]|0
  var edata = edges.data
  var result = new Array(ne)
  for(var i=0; i<ne; ++i) {
    result[i] = [edata[2*i], edata[2*i+1]]
  }
  return result
}

function extractContour(cells, values, level, d) {
  level = level||0.0

  //If user didn't specify `d`, use brute force scan
  if(typeof d === 'undefined') {
    d = getDimension(cells)
  }

  //Count number of cells
  var numCells = cells.length
  if(numCells === 0 || d < 1) {
    return {
      cells:         [],
      vertexIds:     [],
      vertexWeights: []
    }
  }

  //Read in vertex signs
  var vertexSigns = getSigns(values, +level)

  //First get 1-skeleton, find all crossings
  var edges   = getEdges(cells, d)
  var weights = getCrossingWeights(edges, values, vertexSigns, +level)

  //Build vertex cascade to speed up binary search
  var vcascade = getCascade(edges, values.length|0)

  //Then construct cells
  var faces = contourAlgorithm(d)(cells, edges.data, vcascade, vertexSigns)

  //Unpack data into pretty format
  var uedges   = unpackEdges(edges)
  var uweights = [].slice.call(weights.data, 0, weights.shape[0])

  //Release data
  pool.free(vertexSigns)
  pool.free(edges.data)
  pool.free(weights.data)
  pool.free(vcascade)
  
  return {
    cells:         faces,
    vertexIds:     uedges,
    vertexWeights: uweights
  }
}
},{"./lib/codegen":197,"ndarray":164,"ndarray-sort":163,"typedarray-pool":212}],197:[function(require,module,exports){
'use strict'

module.exports = getPolygonizer

var pool = require('typedarray-pool')
var createMSTable = require('marching-simplex-table')

var CACHE = {}

function createCellPolygonizer(d) {
  var maxCellSize = 0
  var tables = new Array(d+1)
  tables[0] = [ [] ]
  for(var i=1; i<=d; ++i) {
    var tab = tables[i] = createMSTable(i)
    for(var j=0; j<tab.length; ++j) {
      maxCellSize = Math.max(maxCellSize, tab[i].length)
    }
  }

  var code  = [
  'function B(C,E,i,j){',
    'var a=Math.min(i,j)|0,b=Math.max(i,j)|0,l=C[2*a],h=C[2*a+1];',
    'while(l<h){',
      'var m=(l+h)>>1,v=E[2*m+1];',
      'if(v===b){return m}',
      'if(b<v){h=m}else{l=m+1}',
    '}',
    'return l;',
  '};',
  'function getContour', d, 'd(F,E,C,S){',
    'var n=F.length,R=[];',
    'for(var i=0;i<n;++i){var c=F[i],l=c.length;'
  ]

  function generateCase(facets) {
    if(facets.length <= 0) {
      return
    }
    code.push('R.push(')
    for(var i=0; i<facets.length; ++i) {
      var facet = facets[i]
      if(i > 0) {
        code.push(',')
      }
      code.push('[')
      for(var j=0; j<facet.length; ++j) {
        var f = facet[j]
        if(j > 0) {
          code.push(',')
        }
        code.push('B(C,E,c[', f[0], '],c[', f[1], '])')
      }
      code.push(']')
    }
    code.push(');')
  }

  for(var i=d+1; i>1; --i) {
    if(i < d+1) {
      code.push('else ')
    }
    code.push('if(l===', i, '){')

    //Generate mask
    var maskStr = []
    for(var j=0; j<i; ++j) {
      maskStr.push('(S[c['+j+']]<<'+j+')')
    }

    //Perform table look up
    code.push('var M=', maskStr.join('+'), 
      ';if(M===0||M===', (1<<i)-1, 
        '){continue}switch(M){')

    var tab = tables[i-1]
    for(var j=0; j<tab.length; ++j) {
      code.push('case ', j, ':')
      generateCase(tab[j])
      code.push('break;')
    }
    code.push('}}')
  }
  code.push('}return R;};return getContour', d, 'd')

  var proc = new Function('pool', code.join(''))
  return proc(pool)
}

function getPolygonizer(d) {
  var alg = CACHE[d]
  if(!alg) {
    alg = CACHE[d] = createCellPolygonizer(d) 
  }
  return alg
}
},{"marching-simplex-table":149,"typedarray-pool":212}],198:[function(require,module,exports){
arguments[4][35][0].apply(exports,arguments)
},{"dup":35}],199:[function(require,module,exports){
"use strict"; "use restrict";

module.exports = UnionFind;

function UnionFind(count) {
  this.roots = new Array(count);
  this.ranks = new Array(count);
  
  for(var i=0; i<count; ++i) {
    this.roots[i] = i;
    this.ranks[i] = 0;
  }
}

UnionFind.prototype.length = function() {
  return this.roots.length;
}

UnionFind.prototype.makeSet = function() {
  var n = this.roots.length;
  this.roots.push(n);
  this.ranks.push(0);
  return n;
}

UnionFind.prototype.find = function(x) {
  var roots = this.roots;
  while(roots[x] !== x) {
    var y = roots[x];
    roots[x] = roots[y];
    x = y;
  }
  return x;
}

UnionFind.prototype.link = function(x, y) {
  var xr = this.find(x)
    , yr = this.find(y);
  if(xr === yr) {
    return;
  }
  var ranks = this.ranks
    , roots = this.roots
    , xd    = ranks[xr]
    , yd    = ranks[yr];
  if(xd < yd) {
    roots[xr] = yr;
  } else if(yd < xd) {
    roots[yr] = xr;
  } else {
    roots[yr] = xr;
    ++ranks[xr];
  }
}


},{}],200:[function(require,module,exports){
arguments[4][143][0].apply(exports,arguments)
},{"bit-twiddle":198,"dup":143,"union-find":199}],201:[function(require,module,exports){
"use strict"

module.exports = simplifyPolygon

var orient = require("robust-orientation")
var sc = require("simplicial-complex")

function errorWeight(base, a, b) {
  var area = Math.abs(orient(base, a, b))
  var perim = Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1]-b[1], 2))
  return area / perim
}

function simplifyPolygon(cells, positions, minArea) {

  var n = positions.length
  var nc = cells.length
  var inv = new Array(n)
  var outv = new Array(n)
  var weights = new Array(n)
  var dead = new Array(n)
  
  //Initialize tables
  for(var i=0; i<n; ++i) {
    inv[i] = outv[i] = -1
    weights[i] = Infinity
    dead[i] = false
  }

  //Compute neighbors
  for(var i=0; i<nc; ++i) {
    var c = cells[i]
    if(c.length !== 2) {
      throw new Error("Input must be a graph")
    }
    var s = c[1]
    var t = c[0]
    if(outv[t] !== -1) {
      outv[t] = -2
    } else {
      outv[t] = s
    }
    if(inv[s] !== -1) {
      inv[s] = -2
    } else {
      inv[s] = t
    }
  }

  //Updates the weight for vertex i
  function computeWeight(i) {
    if(dead[i]) {
      return Infinity
    }
    //TODO: Check that the line segment doesn't cross once simplified
    var s = inv[i]
    var t = outv[i]
    if((s<0) || (t<0)) {
      return Infinity
    } else {
      return errorWeight(positions[i], positions[s], positions[t])
    }
  }

  //Swaps two nodes on the heap (i,j) are the index of the nodes
  function heapSwap(i,j) {
    var a = heap[i]
    var b = heap[j]
    heap[i] = b
    heap[j] = a
    index[a] = j
    index[b] = i
  }

  //Returns the weight of node i on the heap
  function heapWeight(i) {
    return weights[heap[i]]
  }

  function heapParent(i) {
    if(i & 1) {
      return (i - 1) >> 1
    }
    return (i >> 1) - 1
  }

  //Bubble element i down the heap
  function heapDown(i) {
    var w = heapWeight(i)
    while(true) {
      var tw = w
      var left  = 2*i + 1
      var right = 2*(i + 1)
      var next = i
      if(left < heapCount) {
        var lw = heapWeight(left)
        if(lw < tw) {
          next = left
          tw = lw
        }
      }
      if(right < heapCount) {
        var rw = heapWeight(right)
        if(rw < tw) {
          next = right
        }
      }
      if(next === i) {
        return i
      }
      heapSwap(i, next)
      i = next      
    }
  }

  //Bubbles element i up the heap
  function heapUp(i) {
    var w = heapWeight(i)
    while(i > 0) {
      var parent = heapParent(i)
      if(parent >= 0) {
        var pw = heapWeight(parent)
        if(w < pw) {
          heapSwap(i, parent)
          i = parent
          continue
        }
      }
      return i
    }
  }

  //Pop minimum element
  function heapPop() {
    if(heapCount > 0) {
      var head = heap[0]
      heapSwap(0, heapCount-1)
      heapCount -= 1
      heapDown(0)
      return head
    }
    return -1
  }

  //Update heap item i
  function heapUpdate(i, w) {
    var a = heap[i]
    if(weights[a] === w) {
      return i
    }
    weights[a] = -Infinity
    heapUp(i)
    heapPop()
    weights[a] = w
    heapCount += 1
    return heapUp(heapCount-1)
  }

  //Kills a vertex (assume vertex already removed from heap)
  function kill(i) {
    if(dead[i]) {
      return
    }
    //Kill vertex
    dead[i] = true
    //Fixup topology
    var s = inv[i]
    var t = outv[i]
    if(inv[t] >= 0) {
      inv[t] = s
    }
    if(outv[s] >= 0) {
      outv[s] = t
    }

    //Update weights on s and t
    if(index[s] >= 0) {
      heapUpdate(index[s], computeWeight(s))
    }
    if(index[t] >= 0) {
      heapUpdate(index[t], computeWeight(t))
    }
  }

  //Initialize weights and heap
  var heap = []
  var index = new Array(n)
  for(var i=0; i<n; ++i) {
    var w = weights[i] = computeWeight(i)
    if(w < Infinity) {
      index[i] = heap.length
      heap.push(i)
    } else {
      index[i] = -1
    }
  }
  var heapCount = heap.length
  for(var i=heapCount>>1; i>=0; --i) {
    heapDown(i)
  }
  
  //Kill vertices
  while(true) {
    var hmin = heapPop()
    if((hmin < 0) || (weights[hmin] > minArea)) {
      break
    }
    kill(hmin)
  }

  //Build collapsed vertex table
  var npositions = []
  for(var i=0; i<n; ++i) {
    if(!dead[i]) {
      index[i] = npositions.length
      npositions.push(positions[i].slice())
    }
  }
  var nv = npositions.length

  function tortoiseHare(seq, start) {
    if(seq[start] < 0) {
      return start
    }
    var t = start
    var h = start
    do {
      //Walk two steps with h
      var nh = seq[h]
      if(!dead[h] || nh < 0 || nh === h) {
        break
      }
      h = nh
      nh = seq[h]
      if(!dead[h] || nh < 0 || nh === h) {
        break
      }
      h = nh

      //Walk one step with t
      t = seq[t]
    } while(t !== h)
    //Compress cycles
    for(var v=start; v!==h; v = seq[v]) {
      seq[v] = h
    }
    return h
  }

  var ncells = []
  cells.forEach(function(c) {
    var tin = tortoiseHare(inv, c[0])
    var tout = tortoiseHare(outv, c[1])
    if(tin >= 0 && tout >= 0 && tin !== tout) {
      var cin = index[tin]
      var cout = index[tout]
      if(cin !== cout) {
        ncells.push([ cin, cout ])
      }
    }
  })

  //Normalize result
  sc.unique(sc.normalize(ncells))

  //Return final list of cells
  return {
    positions: npositions,
    edges: ncells
  }
}
},{"robust-orientation":190,"simplicial-complex":200}],202:[function(require,module,exports){
"use strict"

module.exports = orderSegments

var orient = require("robust-orientation")

function horizontalOrder(a, b) {
  var bl, br
  if(b[0][0] < b[1][0]) {
    bl = b[0]
    br = b[1]
  } else if(b[0][0] > b[1][0]) {
    bl = b[1]
    br = b[0]
  } else {
    var alo = Math.min(a[0][1], a[1][1])
    var ahi = Math.max(a[0][1], a[1][1])
    var blo = Math.min(b[0][1], b[1][1])
    var bhi = Math.max(b[0][1], b[1][1])
    if(ahi < blo) {
      return ahi - blo
    }
    if(alo > bhi) {
      return alo - bhi
    }
    return ahi - bhi
  }
  var al, ar
  if(a[0][1] < a[1][1]) {
    al = a[0]
    ar = a[1]
  } else {
    al = a[1]
    ar = a[0]
  }
  var d = orient(br, bl, al)
  if(d) {
    return d
  }
  d = orient(br, bl, ar)
  if(d) {
    return d
  }
  return ar - br
}

function orderSegments(b, a) {
  var al, ar
  if(a[0][0] < a[1][0]) {
    al = a[0]
    ar = a[1]
  } else if(a[0][0] > a[1][0]) {
    al = a[1]
    ar = a[0]
  } else {
    return horizontalOrder(a, b)
  }
  var bl, br
  if(b[0][0] < b[1][0]) {
    bl = b[0]
    br = b[1]
  } else if(b[0][0] > b[1][0]) {
    bl = b[1]
    br = b[0]
  } else {
    return -horizontalOrder(b, a)
  }
  var d1 = orient(al, ar, br)
  var d2 = orient(al, ar, bl)
  if(d1 < 0) {
    if(d2 <= 0) {
      return d1
    }
  } else if(d1 > 0) {
    if(d2 >= 0) {
      return d1
    }
  } else if(d2) {
    return d2
  }
  d1 = orient(br, bl, ar)
  d2 = orient(br, bl, al)
  if(d1 < 0) {
    if(d2 <= 0) {
      return d1
    }
  } else if(d1 > 0) {
    if(d2 >= 0) {
      return d1
    }
  } else if(d2) {
    return d2
  }
  return ar[0] - br[0]
}
},{"robust-orientation":190}],203:[function(require,module,exports){
"use strict"

module.exports = createSlabDecomposition

var bounds = require("binary-search-bounds")
var createRBTree = require("functional-red-black-tree")
var orient = require("robust-orientation")
var orderSegments = require("./lib/order-segments")

function SlabDecomposition(slabs, coordinates, horizontal) {
  this.slabs = slabs
  this.coordinates = coordinates
  this.horizontal = horizontal
}

var proto = SlabDecomposition.prototype

function compareHorizontal(e, y) {
  return e.y - y
}

function searchBucket(root, p) {
  var lastNode = null
  while(root) {
    var seg = root.key
    var l, r
    if(seg[0][0] < seg[1][0]) {
      l = seg[0]
      r = seg[1]
    } else {
      l = seg[1]
      r = seg[0]
    }
    var o = orient(l, r, p)
    if(o < 0) {
      root = root.left
    } else if(o > 0) {
      if(p[0] !== seg[1][0]) {
        lastNode = root
        root = root.right
      } else {
        var val = searchBucket(root.right, p)
        if(val) {
          return val
        }
        root = root.left
      }
    } else {
      if(p[0] !== seg[1][0]) {
        return root
      } else {
        var val = searchBucket(root.right, p)
        if(val) {
          return val
        }
        root = root.left
      }
    }
  }
  return lastNode
}

proto.castUp = function(p) {
  var bucket = bounds.le(this.coordinates, p[0])
  if(bucket < 0) {
    return -1
  }
  var root = this.slabs[bucket]
  var hitNode = searchBucket(this.slabs[bucket], p)
  var lastHit = -1
  if(hitNode) {
    lastHit = hitNode.value
  }
  //Edge case: need to handle horizontal segments (sucks)
  if(this.coordinates[bucket] === p[0]) {
    var lastSegment = null
    if(hitNode) {
      lastSegment = hitNode.key
    }
    if(bucket > 0) {
      var otherHitNode = searchBucket(this.slabs[bucket-1], p)
      if(otherHitNode) {
        if(lastSegment) {
          if(orderSegments(otherHitNode.key, lastSegment) > 0) {
            lastSegment = otherHitNode.key
            lastHit = otherHitNode.value
          }
        } else {
          lastHit = otherHitNode.value
          lastSegment = otherHitNode.key
        }
      }
    }
    var horiz = this.horizontal[bucket]
    if(horiz.length > 0) {
      var hbucket = bounds.ge(horiz, p[1], compareHorizontal)
      if(hbucket < horiz.length) {
        var e = horiz[hbucket]
        if(p[1] === e.y) {
          if(e.closed) {
            return e.index
          } else {
            while(hbucket < horiz.length-1 && horiz[hbucket+1].y === p[1]) {
              hbucket = hbucket+1
              e = horiz[hbucket]
              if(e.closed) {
                return e.index
              }
            }
            if(e.y === p[1] && !e.start) {
              hbucket = hbucket+1
              if(hbucket >= horiz.length) {
                return lastHit
              }
              e = horiz[hbucket]
            }
          }
        }
        //Check if e is above/below last segment
        if(e.start) {
          if(lastSegment) {
            var o = orient(lastSegment[0], lastSegment[1], [p[0], e.y])
            if(lastSegment[0][0] > lastSegment[1][0]) {
              o = -o
            }
            if(o > 0) {
              lastHit = e.index
            }
          } else {
            lastHit = e.index
          }
        } else if(e.y !== p[1]) {
          lastHit = e.index
        }
      }
    }
  }
  return lastHit
}

function IntervalSegment(y, index, start, closed) {
  this.y = y
  this.index = index
  this.start = start
  this.closed = closed
}

function Event(x, segment, create, index) {
  this.x = x
  this.segment = segment
  this.create = create
  this.index = index
}


function createSlabDecomposition(segments) {
  var numSegments = segments.length
  var numEvents = 2 * numSegments
  var events = new Array(numEvents)
  for(var i=0; i<numSegments; ++i) {
    var s = segments[i]
    var f = s[0][0] < s[1][0]
    events[2*i] = new Event(s[0][0], s, f, i)
    events[2*i+1] = new Event(s[1][0], s, !f, i)
  }
  events.sort(function(a,b) {
    var d = a.x - b.x
    if(d) {
      return d
    }
    d = a.create - b.create
    if(d) {
      return d
    }
    return Math.min(a.segment[0][1], a.segment[1][1]) - Math.min(b.segment[0][1], b.segment[1][1])
  })
  var tree = createRBTree(orderSegments)
  var slabs = []
  var lines = []
  var horizontal = []
  var lastX = -Infinity
  for(var i=0; i<numEvents; ) {
    var x = events[i].x
    var horiz = []
    while(i < numEvents) {
      var e = events[i]
      if(e.x !== x) {
        break
      }
      i += 1
      if(e.segment[0][0] === e.x && e.segment[1][0] === e.x) {
        if(e.create) {
          if(e.segment[0][1] < e.segment[1][1]) {
            horiz.push(new IntervalSegment(
                e.segment[0][1],
                e.index,
                true,
                true))
            horiz.push(new IntervalSegment(
                e.segment[1][1],
                e.index,
                false,
                false))
          } else {
            horiz.push(new IntervalSegment(
                e.segment[1][1],
                e.index,
                true,
                false))
            horiz.push(new IntervalSegment(
                e.segment[0][1],
                e.index,
                false,
                true))
          }
        }
      } else {
        if(e.create) {
          tree = tree.insert(e.segment, e.index)
        } else {
          tree = tree.remove(e.segment)
        }
      }
    }
    slabs.push(tree.root)
    lines.push(x)
    horizontal.push(horiz)
  }
  return new SlabDecomposition(slabs, lines, horizontal)
}
},{"./lib/order-segments":202,"binary-search-bounds":34,"functional-red-black-tree":72,"robust-orientation":190}],204:[function(require,module,exports){
"use strict"

var robustDot = require("robust-dot-product")
var robustSum = require("robust-sum")

module.exports = splitPolygon
module.exports.positive = positive
module.exports.negative = negative

function planeT(p, plane) {
  var r = robustSum(robustDot(p, plane), [plane[plane.length-1]])
  return r[r.length-1]
}


//Can't do this exactly and emit a floating point result
function lerpW(a, wa, b, wb) {
  var d = wb - wa
  var t = -wa / d
  if(t < 0.0) {
    t = 0.0
  } else if(t > 1.0) {
    t = 1.0
  }
  var ti = 1.0 - t
  var n = a.length
  var r = new Array(n)
  for(var i=0; i<n; ++i) {
    r[i] = t * a[i] + ti * b[i]
  }
  return r
}

function splitPolygon(points, plane) {
  var pos = []
  var neg = []
  var a = planeT(points[points.length-1], plane)
  for(var s=points[points.length-1], t=points[0], i=0; i<points.length; ++i, s=t) {
    t = points[i]
    var b = planeT(t, plane)
    if((a < 0 && b > 0) || (a > 0 && b < 0)) {
      var p = lerpW(s, b, t, a)
      pos.push(p)
      neg.push(p.slice())
    }
    if(b < 0) {
      neg.push(t.slice())
    } else if(b > 0) {
      pos.push(t.slice())
    } else {
      pos.push(t.slice())
      neg.push(t.slice())
    }
    a = b
  }
  return { positive: pos, negative: neg }
}

function positive(points, plane) {
  var pos = []
  var a = planeT(points[points.length-1], plane)
  for(var s=points[points.length-1], t=points[0], i=0; i<points.length; ++i, s=t) {
    t = points[i]
    var b = planeT(t, plane)
    if((a < 0 && b > 0) || (a > 0 && b < 0)) {
      pos.push(lerpW(s, b, t, a))
    }
    if(b >= 0) {
      pos.push(t.slice())
    }
    a = b
  }
  return pos
}

function negative(points, plane) {
  var neg = []
  var a = planeT(points[points.length-1], plane)
  for(var s=points[points.length-1], t=points[0], i=0; i<points.length; ++i, s=t) {
    t = points[i]
    var b = planeT(t, plane)
    if((a < 0 && b > 0) || (a > 0 && b < 0)) {
      neg.push(lerpW(s, b, t, a))
    }
    if(b <= 0) {
      neg.push(t.slice())
    }
    a = b
  }
  return neg
}
},{"robust-dot-product":187,"robust-sum":195}],205:[function(require,module,exports){
/* global window, exports, define */

!function() {
    'use strict'

    var re = {
        not_string: /[^s]/,
        not_bool: /[^t]/,
        not_type: /[^T]/,
        not_primitive: /[^v]/,
        number: /[diefg]/,
        numeric_arg: /[bcdiefguxX]/,
        json: /[j]/,
        not_json: /[^j]/,
        text: /^[^\x25]+/,
        modulo: /^\x25{2}/,
        placeholder: /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-gijostTuvxX])/,
        key: /^([a-z_][a-z_\d]*)/i,
        key_access: /^\.([a-z_][a-z_\d]*)/i,
        index_access: /^\[(\d+)\]/,
        sign: /^[\+\-]/
    }

    function sprintf(key) {
        // `arguments` is not an array, but should be fine for this call
        return sprintf_format(sprintf_parse(key), arguments)
    }

    function vsprintf(fmt, argv) {
        return sprintf.apply(null, [fmt].concat(argv || []))
    }

    function sprintf_format(parse_tree, argv) {
        var cursor = 1, tree_length = parse_tree.length, arg, output = '', i, k, match, pad, pad_character, pad_length, is_positive, sign
        for (i = 0; i < tree_length; i++) {
            if (typeof parse_tree[i] === 'string') {
                output += parse_tree[i]
            }
            else if (Array.isArray(parse_tree[i])) {
                match = parse_tree[i] // convenience purposes only
                if (match[2]) { // keyword argument
                    arg = argv[cursor]
                    for (k = 0; k < match[2].length; k++) {
                        if (!arg.hasOwnProperty(match[2][k])) {
                            throw new Error(sprintf('[sprintf] property "%s" does not exist', match[2][k]))
                        }
                        arg = arg[match[2][k]]
                    }
                }
                else if (match[1]) { // positional argument (explicit)
                    arg = argv[match[1]]
                }
                else { // positional argument (implicit)
                    arg = argv[cursor++]
                }

                if (re.not_type.test(match[8]) && re.not_primitive.test(match[8]) && arg instanceof Function) {
                    arg = arg()
                }

                if (re.numeric_arg.test(match[8]) && (typeof arg !== 'number' && isNaN(arg))) {
                    throw new TypeError(sprintf('[sprintf] expecting number but found %T', arg))
                }

                if (re.number.test(match[8])) {
                    is_positive = arg >= 0
                }

                switch (match[8]) {
                    case 'b':
                        arg = parseInt(arg, 10).toString(2)
                        break
                    case 'c':
                        arg = String.fromCharCode(parseInt(arg, 10))
                        break
                    case 'd':
                    case 'i':
                        arg = parseInt(arg, 10)
                        break
                    case 'j':
                        arg = JSON.stringify(arg, null, match[6] ? parseInt(match[6]) : 0)
                        break
                    case 'e':
                        arg = match[7] ? parseFloat(arg).toExponential(match[7]) : parseFloat(arg).toExponential()
                        break
                    case 'f':
                        arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg)
                        break
                    case 'g':
                        arg = match[7] ? String(Number(arg.toPrecision(match[7]))) : parseFloat(arg)
                        break
                    case 'o':
                        arg = (parseInt(arg, 10) >>> 0).toString(8)
                        break
                    case 's':
                        arg = String(arg)
                        arg = (match[7] ? arg.substring(0, match[7]) : arg)
                        break
                    case 't':
                        arg = String(!!arg)
                        arg = (match[7] ? arg.substring(0, match[7]) : arg)
                        break
                    case 'T':
                        arg = Object.prototype.toString.call(arg).slice(8, -1).toLowerCase()
                        arg = (match[7] ? arg.substring(0, match[7]) : arg)
                        break
                    case 'u':
                        arg = parseInt(arg, 10) >>> 0
                        break
                    case 'v':
                        arg = arg.valueOf()
                        arg = (match[7] ? arg.substring(0, match[7]) : arg)
                        break
                    case 'x':
                        arg = (parseInt(arg, 10) >>> 0).toString(16)
                        break
                    case 'X':
                        arg = (parseInt(arg, 10) >>> 0).toString(16).toUpperCase()
                        break
                }
                if (re.json.test(match[8])) {
                    output += arg
                }
                else {
                    if (re.number.test(match[8]) && (!is_positive || match[3])) {
                        sign = is_positive ? '+' : '-'
                        arg = arg.toString().replace(re.sign, '')
                    }
                    else {
                        sign = ''
                    }
                    pad_character = match[4] ? match[4] === '0' ? '0' : match[4].charAt(1) : ' '
                    pad_length = match[6] - (sign + arg).length
                    pad = match[6] ? (pad_length > 0 ? pad_character.repeat(pad_length) : '') : ''
                    output += match[5] ? sign + arg + pad : (pad_character === '0' ? sign + pad + arg : pad + sign + arg)
                }
            }
        }
        return output
    }

    var sprintf_cache = Object.create(null)

    function sprintf_parse(fmt) {
        if (sprintf_cache[fmt]) {
            return sprintf_cache[fmt]
        }

        var _fmt = fmt, match, parse_tree = [], arg_names = 0
        while (_fmt) {
            if ((match = re.text.exec(_fmt)) !== null) {
                parse_tree.push(match[0])
            }
            else if ((match = re.modulo.exec(_fmt)) !== null) {
                parse_tree.push('%')
            }
            else if ((match = re.placeholder.exec(_fmt)) !== null) {
                if (match[2]) {
                    arg_names |= 1
                    var field_list = [], replacement_field = match[2], field_match = []
                    if ((field_match = re.key.exec(replacement_field)) !== null) {
                        field_list.push(field_match[1])
                        while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
                            if ((field_match = re.key_access.exec(replacement_field)) !== null) {
                                field_list.push(field_match[1])
                            }
                            else if ((field_match = re.index_access.exec(replacement_field)) !== null) {
                                field_list.push(field_match[1])
                            }
                            else {
                                throw new SyntaxError('[sprintf] failed to parse named argument key')
                            }
                        }
                    }
                    else {
                        throw new SyntaxError('[sprintf] failed to parse named argument key')
                    }
                    match[2] = field_list
                }
                else {
                    arg_names |= 2
                }
                if (arg_names === 3) {
                    throw new Error('[sprintf] mixing positional and named placeholders is not (yet) supported')
                }
                parse_tree.push(match)
            }
            else {
                throw new SyntaxError('[sprintf] unexpected placeholder')
            }
            _fmt = _fmt.substring(match[0].length)
        }
        return sprintf_cache[fmt] = parse_tree
    }

    /**
     * export to either browser or node.js
     */
    /* eslint-disable quote-props */
    if (typeof exports !== 'undefined') {
        exports['sprintf'] = sprintf
        exports['vsprintf'] = vsprintf
    }
    if (typeof window !== 'undefined') {
        window['sprintf'] = sprintf
        window['vsprintf'] = vsprintf

        if (typeof define === 'function' && define['amd']) {
            define(function() {
                return {
                    'sprintf': sprintf,
                    'vsprintf': vsprintf
                }
            })
        }
    }
    /* eslint-enable quote-props */
}()

},{}],206:[function(require,module,exports){
"use strict"

module.exports = surfaceNets

var generateContourExtractor = require("ndarray-extract-contour")
var triangulateCube = require("triangulate-hypercube")
var zeroCrossings = require("zero-crossings")

function buildSurfaceNets(order, dtype) {
  var dimension = order.length
  var code = ["'use strict';"]
  var funcName = "surfaceNets" + order.join("_") + "d" + dtype

  //Contour extraction function
  code.push(
    "var contour=genContour({",
      "order:[", order.join(), "],",
      "scalarArguments: 3,",
      "phase:function phaseFunc(p,a,b,c) { return (p > c)|0 },")
  if(dtype === "generic") {
    code.push("getters:[0],")
  }

  //Generate vertex function
  var cubeArgs = []
  var extraArgs = []
  for(var i=0; i<dimension; ++i) {
    cubeArgs.push("d" + i)
    extraArgs.push("d" + i)
  }
  for(var i=0; i<(1<<dimension); ++i) {
    cubeArgs.push("v" + i)
    extraArgs.push("v" + i)
  }
  for(var i=0; i<(1<<dimension); ++i) {
    cubeArgs.push("p" + i)
    extraArgs.push("p" + i)
  }
  cubeArgs.push("a", "b", "c")
  extraArgs.push("a", "c")
  code.push("vertex:function vertexFunc(", cubeArgs.join(), "){")
  //Mask args together
  var maskStr = []
  for(var i=0; i<(1<<dimension); ++i) {
    maskStr.push("(p" + i + "<<" + i + ")")
  }
  //Generate variables and giganto switch statement
  code.push("var m=(", maskStr.join("+"), ")|0;if(m===0||m===", (1<<(1<<dimension))-1, "){return}")
  var extraFuncs = []
  var currentFunc = []
  if(1<<(1<<dimension) <= 128) {
    code.push("switch(m){")
    currentFunc = code
  } else {
    code.push("switch(m>>>7){")
  }
  for(var i=0; i<1<<(1<<dimension); ++i) {
    if(1<<(1<<dimension) > 128) {
      if((i%128)===0) {
        if(extraFuncs.length > 0) {
          currentFunc.push("}}")
        }
        var efName = "vExtra" + extraFuncs.length
        code.push("case ", (i>>>7), ":", efName, "(m&0x7f,", extraArgs.join(), ");break;")
        currentFunc = [
          "function ", efName, "(m,", extraArgs.join(), "){switch(m){"
        ]
        extraFuncs.push(currentFunc)
      }  
    }
    currentFunc.push("case ", (i&0x7f), ":")
    var crossings = new Array(dimension)
    var denoms = new Array(dimension)
    var crossingCount = new Array(dimension)
    var bias = new Array(dimension)
    var totalCrossings = 0
    for(var j=0; j<dimension; ++j) {
      crossings[j] = []
      denoms[j] = []
      crossingCount[j] = 0
      bias[j] = 0
    }
    for(var j=0; j<(1<<dimension); ++j) {
      for(var k=0; k<dimension; ++k) {
        var u = j ^ (1<<k)
        if(u > j) {
          continue
        }
        if(!(i&(1<<u)) !== !(i&(1<<j))) {
          var sign = 1
          if(i&(1<<u)) {
            denoms[k].push("v" + u + "-v" + j)
          } else {
            denoms[k].push("v" + j + "-v" + u)
            sign = -sign
          }
          if(sign < 0) {
            crossings[k].push("-v" + j + "-v" + u)
            crossingCount[k] += 2
          } else {
            crossings[k].push("v" + j + "+v" + u)
            crossingCount[k] -= 2            
          }
          totalCrossings += 1
          for(var l=0; l<dimension; ++l) {
            if(l === k) {
              continue
            }
            if(u&(1<<l)) {
              bias[l] += 1
            } else {
              bias[l] -= 1
            }
          }
        }
      }
    }
    var vertexStr = []
    for(var k=0; k<dimension; ++k) {
      if(crossings[k].length === 0) {
        vertexStr.push("d" + k + "-0.5")
      } else {
        var cStr = ""
        if(crossingCount[k] < 0) {
          cStr = crossingCount[k] + "*c"
        } else if(crossingCount[k] > 0) {
          cStr = "+" + crossingCount[k] + "*c"
        }
        var weight = 0.5 * (crossings[k].length / totalCrossings)
        var shift = 0.5 + 0.5 * (bias[k] / totalCrossings)
        vertexStr.push("d" + k + "-" + shift + "-" + weight + "*(" + crossings[k].join("+") + cStr + ")/(" + denoms[k].join("+") + ")")
        
      }
    }
    currentFunc.push("a.push([", vertexStr.join(), "]);",
      "break;")
  }
  code.push("}},")
  if(extraFuncs.length > 0) {
    currentFunc.push("}}")
  }

  //Create face function
  var faceArgs = []
  for(var i=0; i<(1<<(dimension-1)); ++i) {
    faceArgs.push("v" + i)
  }
  faceArgs.push("c0", "c1", "p0", "p1", "a", "b", "c")
  code.push("cell:function cellFunc(", faceArgs.join(), "){")

  var facets = triangulateCube(dimension-1)
  code.push("if(p0){b.push(",
    facets.map(function(f) {
      return "[" + f.map(function(v) {
        return "v" + v
      }) + "]"
    }).join(), ")}else{b.push(",
    facets.map(function(f) {
      var e = f.slice()
      e.reverse()
      return "[" + e.map(function(v) {
        return "v" + v
      }) + "]"
    }).join(),
    ")}}});function ", funcName, "(array,level){var verts=[],cells=[];contour(array,verts,cells,level);return {positions:verts,cells:cells};} return ", funcName, ";")

  for(var i=0; i<extraFuncs.length; ++i) {
    code.push(extraFuncs[i].join(""))
  }

  //Compile and link
  var proc = new Function("genContour", code.join(""))
  return proc(generateContourExtractor)
}

//1D case: Need to handle specially
function mesh1D(array, level) {
  var zc = zeroCrossings(array, level)
  var n = zc.length
  var npos = new Array(n)
  var ncel = new Array(n)
  for(var i=0; i<n; ++i) {
    npos[i] = [ zc[i] ]
    ncel[i] = [ i ]
  }
  return {
    positions: npos,
    cells: ncel
  }
}

var CACHE = {}

function surfaceNets(array,level) {
  if(array.dimension <= 0) {
    return { positions: [], cells: [] }
  } else if(array.dimension === 1) {
    return mesh1D(array, level)
  }
  var typesig = array.order.join() + "-" + array.dtype
  var proc = CACHE[typesig]
  var level = (+level) || 0.0
  if(!proc) {
    proc = CACHE[typesig] = buildSurfaceNets(array.order, array.dtype)
  }
  return proc(array,level)
}
},{"ndarray-extract-contour":160,"triangulate-hypercube":208,"zero-crossings":221}],207:[function(require,module,exports){
'use strict'

var parseUnit = require('parse-unit')

module.exports = toPX

var PIXELS_PER_INCH = 96

function getPropertyInPX(element, prop) {
  var parts = parseUnit(getComputedStyle(element).getPropertyValue(prop))
  return parts[0] * toPX(parts[1], element)
}

//This brutal hack is needed
function getSizeBrutal(unit, element) {
  var testDIV = document.createElement('div')
  testDIV.style['font-size'] = '128' + unit
  element.appendChild(testDIV)
  var size = getPropertyInPX(testDIV, 'font-size') / 128
  element.removeChild(testDIV)
  return size
}

function toPX(str, element) {
  element = element || document.body
  str = (str || 'px').trim().toLowerCase()
  if(element === window || element === document) {
    element = document.body 
  }
  switch(str) {
    case '%':  //Ambiguous, not sure if we should use width or height
      return element.clientHeight / 100.0
    case 'ch':
    case 'ex':
      return getSizeBrutal(str, element)
    case 'em':
      return getPropertyInPX(element, 'font-size')
    case 'rem':
      return getPropertyInPX(document.body, 'font-size')
    case 'vw':
      return window.innerWidth/100
    case 'vh':
      return window.innerHeight/100
    case 'vmin':
      return Math.min(window.innerWidth, window.innerHeight) / 100
    case 'vmax':
      return Math.max(window.innerWidth, window.innerHeight) / 100
    case 'in':
      return PIXELS_PER_INCH
    case 'cm':
      return PIXELS_PER_INCH / 2.54
    case 'mm':
      return PIXELS_PER_INCH / 25.4
    case 'pt':
      return PIXELS_PER_INCH / 72
    case 'pc':
      return PIXELS_PER_INCH / 6
  }
  return 1
}
},{"parse-unit":170}],208:[function(require,module,exports){
"use strict"

module.exports = triangulateCube

var perm = require("permutation-rank")
var sgn = require("permutation-parity")
var gamma = require("gamma")

function triangulateCube(dimension) {
  if(dimension < 0) {
    return [ ]
  }
  if(dimension === 0) {
    return [ [0] ]
  }
  var dfactorial = Math.round(gamma(dimension+1))|0
  var result = []
  for(var i=0; i<dfactorial; ++i) {
    var p = perm.unrank(dimension, i)
    var cell = [ 0 ]
    var v = 0
    for(var j=0; j<p.length; ++j) {
      v += (1<<p[j])
      cell.push(v)
    }
    if(sgn(p) < 1) {
      cell[0] = v
      cell[dimension] = 0
    }
    result.push(cell)
  }
  return result
}
},{"gamma":73,"permutation-parity":171,"permutation-rank":172}],209:[function(require,module,exports){
'use strict'

module.exports = createTurntableController

var filterVector = require('filtered-vector')
var invert44     = require('gl-mat4/invert')
var rotateM      = require('gl-mat4/rotate')
var cross        = require('gl-vec3/cross')
var normalize3   = require('gl-vec3/normalize')
var dot3         = require('gl-vec3/dot')

function len3(x, y, z) {
  return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2))
}

function clamp1(x) {
  return Math.min(1.0, Math.max(-1.0, x))
}

function findOrthoPair(v) {
  var vx = Math.abs(v[0])
  var vy = Math.abs(v[1])
  var vz = Math.abs(v[2])

  var u = [0,0,0]
  if(vx > Math.max(vy, vz)) {
    u[2] = 1
  } else if(vy > Math.max(vx, vz)) {
    u[0] = 1
  } else {
    u[1] = 1
  }

  var vv = 0
  var uv = 0
  for(var i=0; i<3; ++i ) {
    vv += v[i] * v[i]
    uv += u[i] * v[i]
  }
  for(var i=0; i<3; ++i) {
    u[i] -= (uv / vv) *  v[i]
  }
  normalize3(u, u)
  return u
}

function TurntableController(zoomMin, zoomMax, center, up, right, radius, theta, phi) {
  this.center = filterVector(center)
  this.up     = filterVector(up)
  this.right  = filterVector(right)
  this.radius = filterVector([radius])
  this.angle  = filterVector([theta, phi])
  this.angle.bounds = [[-Infinity,-Math.PI/2], [Infinity,Math.PI/2]]
  this.setDistanceLimits(zoomMin, zoomMax)

  this.computedCenter = this.center.curve(0)
  this.computedUp     = this.up.curve(0)
  this.computedRight  = this.right.curve(0)
  this.computedRadius = this.radius.curve(0)
  this.computedAngle  = this.angle.curve(0)
  this.computedToward = [0,0,0]
  this.computedEye    = [0,0,0]
  this.computedMatrix = new Array(16)
  for(var i=0; i<16; ++i) {
    this.computedMatrix[i] = 0.5
  }

  this.recalcMatrix(0)
}

var proto = TurntableController.prototype

proto.setDistanceLimits = function(minDist, maxDist) {
  if(minDist > 0) {
    minDist = Math.log(minDist)
  } else {
    minDist = -Infinity
  }
  if(maxDist > 0) {
    maxDist = Math.log(maxDist)
  } else {
    maxDist = Infinity
  }
  maxDist = Math.max(maxDist, minDist)
  this.radius.bounds[0][0] = minDist
  this.radius.bounds[1][0] = maxDist
}

proto.getDistanceLimits = function(out) {
  var bounds = this.radius.bounds[0]
  if(out) {
    out[0] = Math.exp(bounds[0][0])
    out[1] = Math.exp(bounds[1][0])
    return out
  }
  return [ Math.exp(bounds[0][0]), Math.exp(bounds[1][0]) ]
}

proto.recalcMatrix = function(t) {
  //Recompute curves
  this.center.curve(t)
  this.up.curve(t)
  this.right.curve(t)
  this.radius.curve(t)
  this.angle.curve(t)

  //Compute frame for camera matrix
  var up     = this.computedUp
  var right  = this.computedRight
  var uu = 0.0
  var ur = 0.0
  for(var i=0; i<3; ++i) {
    ur += up[i] * right[i]
    uu += up[i] * up[i]
  }
  var ul = Math.sqrt(uu)
  var rr = 0.0
  for(var i=0; i<3; ++i) {
    right[i] -= up[i] * ur / uu
    rr       += right[i] * right[i]
    up[i]    /= ul
  }
  var rl = Math.sqrt(rr)
  for(var i=0; i<3; ++i) {
    right[i] /= rl
  }

  //Compute toward vector
  var toward = this.computedToward
  cross(toward, up, right)
  normalize3(toward, toward)

  //Compute angular parameters
  var radius = Math.exp(this.computedRadius[0])
  var theta  = this.computedAngle[0]
  var phi    = this.computedAngle[1]

  var ctheta = Math.cos(theta)
  var stheta = Math.sin(theta)
  var cphi   = Math.cos(phi)
  var sphi   = Math.sin(phi)

  var center = this.computedCenter

  var wx = ctheta * cphi 
  var wy = stheta * cphi
  var wz = sphi

  var sx = -ctheta * sphi
  var sy = -stheta * sphi
  var sz = cphi

  var eye = this.computedEye
  var mat = this.computedMatrix
  for(var i=0; i<3; ++i) {
    var x      = wx * right[i] + wy * toward[i] + wz * up[i]
    mat[4*i+1] = sx * right[i] + sy * toward[i] + sz * up[i]
    mat[4*i+2] = x
    mat[4*i+3] = 0.0
  }

  var ax = mat[1]
  var ay = mat[5]
  var az = mat[9]
  var bx = mat[2]
  var by = mat[6]
  var bz = mat[10]
  var cx = ay * bz - az * by
  var cy = az * bx - ax * bz
  var cz = ax * by - ay * bx
  var cl = len3(cx, cy, cz)
  cx /= cl
  cy /= cl
  cz /= cl
  mat[0] = cx
  mat[4] = cy
  mat[8] = cz

  for(var i=0; i<3; ++i) {
    eye[i] = center[i] + mat[2+4*i]*radius
  }

  for(var i=0; i<3; ++i) {
    var rr = 0.0
    for(var j=0; j<3; ++j) {
      rr += mat[i+4*j] * eye[j]
    }
    mat[12+i] = -rr
  }
  mat[15] = 1.0
}

proto.getMatrix = function(t, result) {
  this.recalcMatrix(t)
  var mat = this.computedMatrix
  if(result) {
    for(var i=0; i<16; ++i) {
      result[i] = mat[i]
    }
    return result
  }
  return mat
}

var zAxis = [0,0,0]
proto.rotate = function(t, dtheta, dphi, droll) {
  this.angle.move(t, dtheta, dphi)
  if(droll) {
    this.recalcMatrix(t)

    var mat = this.computedMatrix
    zAxis[0] = mat[2]
    zAxis[1] = mat[6]
    zAxis[2] = mat[10]

    var up     = this.computedUp
    var right  = this.computedRight
    var toward = this.computedToward

    for(var i=0; i<3; ++i) {
      mat[4*i]   = up[i]
      mat[4*i+1] = right[i]
      mat[4*i+2] = toward[i]
    }
    rotateM(mat, mat, droll, zAxis)
    for(var i=0; i<3; ++i) {
      up[i] =    mat[4*i]
      right[i] = mat[4*i+1]
    }

    this.up.set(t, up[0], up[1], up[2])
    this.right.set(t, right[0], right[1], right[2])
  }
}

proto.pan = function(t, dx, dy, dz) {
  dx = dx || 0.0
  dy = dy || 0.0
  dz = dz || 0.0

  this.recalcMatrix(t)
  var mat = this.computedMatrix

  var dist = Math.exp(this.computedRadius[0])

  var ux = mat[1]
  var uy = mat[5]
  var uz = mat[9]
  var ul = len3(ux, uy, uz)
  ux /= ul
  uy /= ul
  uz /= ul

  var rx = mat[0]
  var ry = mat[4]
  var rz = mat[8]
  var ru = rx * ux + ry * uy + rz * uz
  rx -= ux * ru
  ry -= uy * ru
  rz -= uz * ru
  var rl = len3(rx, ry, rz)
  rx /= rl
  ry /= rl
  rz /= rl

  var vx = rx * dx + ux * dy
  var vy = ry * dx + uy * dy
  var vz = rz * dx + uz * dy
  this.center.move(t, vx, vy, vz)

  //Update z-component of radius
  var radius = Math.exp(this.computedRadius[0])
  radius = Math.max(1e-4, radius + dz)
  this.radius.set(t, Math.log(radius))
}

proto.translate = function(t, dx, dy, dz) {
  this.center.move(t,
    dx||0.0,
    dy||0.0,
    dz||0.0)
}

//Recenters the coordinate axes
proto.setMatrix = function(t, mat, axes, noSnap) {
  
  //Get the axes for tare
  var ushift = 1
  if(typeof axes === 'number') {
    ushift = (axes)|0
  } 
  if(ushift < 0 || ushift > 3) {
    ushift = 1
  }
  var vshift = (ushift + 2) % 3
  var fshift = (ushift + 1) % 3

  //Recompute state for new t value
  if(!mat) { 
    this.recalcMatrix(t)
    mat = this.computedMatrix
  }

  //Get right and up vectors
  var ux = mat[ushift]
  var uy = mat[ushift+4]
  var uz = mat[ushift+8]
  if(!noSnap) {
    var ul = len3(ux, uy, uz)
    ux /= ul
    uy /= ul
    uz /= ul
  } else {
    var ax = Math.abs(ux)
    var ay = Math.abs(uy)
    var az = Math.abs(uz)
    var am = Math.max(ax,ay,az)
    if(ax === am) {
      ux = (ux < 0) ? -1 : 1
      uy = uz = 0
    } else if(az === am) {
      uz = (uz < 0) ? -1 : 1
      ux = uy = 0
    } else {
      uy = (uy < 0) ? -1 : 1
      ux = uz = 0
    }
  }

  var rx = mat[vshift]
  var ry = mat[vshift+4]
  var rz = mat[vshift+8]
  var ru = rx * ux + ry * uy + rz * uz
  rx -= ux * ru
  ry -= uy * ru
  rz -= uz * ru
  var rl = len3(rx, ry, rz)
  rx /= rl
  ry /= rl
  rz /= rl
  
  var fx = uy * rz - uz * ry
  var fy = uz * rx - ux * rz
  var fz = ux * ry - uy * rx
  var fl = len3(fx, fy, fz)
  fx /= fl
  fy /= fl
  fz /= fl

  this.center.jump(t, ex, ey, ez)
  this.radius.idle(t)
  this.up.jump(t, ux, uy, uz)
  this.right.jump(t, rx, ry, rz)

  var phi, theta
  if(ushift === 2) {
    var cx = mat[1]
    var cy = mat[5]
    var cz = mat[9]
    var cr = cx * rx + cy * ry + cz * rz
    var cf = cx * fx + cy * fy + cz * fz
    if(tu < 0) {
      phi = -Math.PI/2
    } else {
      phi = Math.PI/2
    }
    theta = Math.atan2(cf, cr)
  } else {
    var tx = mat[2]
    var ty = mat[6]
    var tz = mat[10]
    var tu = tx * ux + ty * uy + tz * uz
    var tr = tx * rx + ty * ry + tz * rz
    var tf = tx * fx + ty * fy + tz * fz

    phi = Math.asin(clamp1(tu))
    theta = Math.atan2(tf, tr)
  }

  this.angle.jump(t, theta, phi)

  this.recalcMatrix(t)
  var dx = mat[2]
  var dy = mat[6]
  var dz = mat[10]

  var imat = this.computedMatrix
  invert44(imat, mat)
  var w  = imat[15]
  var ex = imat[12] / w
  var ey = imat[13] / w
  var ez = imat[14] / w

  var gs = Math.exp(this.computedRadius[0])
  this.center.jump(t, ex-dx*gs, ey-dy*gs, ez-dz*gs)
}

proto.lastT = function() {
  return Math.max(
    this.center.lastT(),
    this.up.lastT(),
    this.right.lastT(),
    this.radius.lastT(),
    this.angle.lastT())
}

proto.idle = function(t) {
  this.center.idle(t)
  this.up.idle(t)
  this.right.idle(t)
  this.radius.idle(t)
  this.angle.idle(t)
}

proto.flush = function(t) {
  this.center.flush(t)
  this.up.flush(t)
  this.right.flush(t)
  this.radius.flush(t)
  this.angle.flush(t)
}

proto.setDistance = function(t, d) {
  if(d > 0) {
    this.radius.set(t, Math.log(d))
  }
}

proto.lookAt = function(t, eye, center, up) {
  this.recalcMatrix(t)

  eye    = eye    || this.computedEye
  center = center || this.computedCenter
  up     = up     || this.computedUp

  var ux = up[0]
  var uy = up[1]
  var uz = up[2]
  var ul = len3(ux, uy, uz)
  if(ul < 1e-6) {
    return
  }
  ux /= ul
  uy /= ul
  uz /= ul

  var tx = eye[0] - center[0]
  var ty = eye[1] - center[1]
  var tz = eye[2] - center[2]
  var tl = len3(tx, ty, tz)
  if(tl < 1e-6) {
    return
  }
  tx /= tl
  ty /= tl
  tz /= tl

  var right = this.computedRight
  var rx = right[0]
  var ry = right[1]
  var rz = right[2]
  var ru = ux*rx + uy*ry + uz*rz
  rx -= ru * ux
  ry -= ru * uy
  rz -= ru * uz
  var rl = len3(rx, ry, rz)

  if(rl < 0.01) {
    rx = uy * tz - uz * ty
    ry = uz * tx - ux * tz
    rz = ux * ty - uy * tx
    rl = len3(rx, ry, rz)
    if(rl < 1e-6) {
      return
    }
  }
  rx /= rl
  ry /= rl
  rz /= rl

  this.up.set(t, ux, uy, uz)
  this.right.set(t, rx, ry, rz)
  this.center.set(t, center[0], center[1], center[2])
  this.radius.set(t, Math.log(tl))

  var fx = uy * rz - uz * ry
  var fy = uz * rx - ux * rz
  var fz = ux * ry - uy * rx
  var fl = len3(fx, fy, fz)
  fx /= fl
  fy /= fl
  fz /= fl

  var tu = ux*tx + uy*ty + uz*tz
  var tr = rx*tx + ry*ty + rz*tz
  var tf = fx*tx + fy*ty + fz*tz

  var phi   = Math.asin(clamp1(tu))
  var theta = Math.atan2(tf, tr)

  var angleState = this.angle._state
  var lastTheta  = angleState[angleState.length-1]
  var lastPhi    = angleState[angleState.length-2]
  lastTheta      = lastTheta % (2.0 * Math.PI)
  var dp = Math.abs(lastTheta + 2.0 * Math.PI - theta)
  var d0 = Math.abs(lastTheta - theta)
  var dn = Math.abs(lastTheta - 2.0 * Math.PI - theta)
  if(dp < d0) {
    lastTheta += 2.0 * Math.PI
  }
  if(dn < d0) {
    lastTheta -= 2.0 * Math.PI
  }

  this.angle.jump(this.angle.lastT(), lastTheta, lastPhi)
  this.angle.set(t, theta, phi)
}

function createTurntableController(options) {
  options = options || {}

  var center = options.center || [0,0,0]
  var up     = options.up     || [0,1,0]
  var right  = options.right  || findOrthoPair(up)
  var radius = options.radius || 1.0
  var theta  = options.theta  || 0.0
  var phi    = options.phi    || 0.0

  center = [].slice.call(center, 0, 3)

  up = [].slice.call(up, 0, 3)
  normalize3(up, up)

  right = [].slice.call(right, 0, 3)
  normalize3(right, right)

  if('eye' in options) {
    var eye = options.eye
    var toward = [
      eye[0]-center[0],
      eye[1]-center[1],
      eye[2]-center[2]
    ]
    cross(right, toward, up)
    if(len3(right[0], right[1], right[2]) < 1e-6) {
      right = findOrthoPair(up)
    } else {
      normalize3(right, right)
    }

    radius = len3(toward[0], toward[1], toward[2])

    var ut = dot3(up, toward) / radius
    var rt = dot3(right, toward) / radius
    phi    = Math.acos(ut)
    theta  = Math.acos(rt)
  }

  //Use logarithmic coordinates for radius
  radius = Math.log(radius)

  //Return the controller
  return new TurntableController(
    options.zoomMin,
    options.zoomMax,
    center,
    up,
    right,
    radius,
    theta,
    phi)
}
},{"filtered-vector":71,"gl-mat4/invert":96,"gl-mat4/rotate":102,"gl-vec3/cross":129,"gl-vec3/dot":130,"gl-vec3/normalize":133}],210:[function(require,module,exports){
"use strict"

module.exports = twoProduct

var SPLITTER = +(Math.pow(2, 27) + 1.0)

function twoProduct(a, b, result) {
  var x = a * b

  var c = SPLITTER * a
  var abig = c - a
  var ahi = c - abig
  var alo = a - ahi

  var d = SPLITTER * b
  var bbig = d - b
  var bhi = d - bbig
  var blo = b - bhi

  var err1 = x - (ahi * bhi)
  var err2 = err1 - (alo * bhi)
  var err3 = err2 - (ahi * blo)

  var y = alo * blo - err3

  if(result) {
    result[0] = y
    result[1] = x
    return result
  }

  return [ y, x ]
}
},{}],211:[function(require,module,exports){
"use strict"

module.exports = fastTwoSum

function fastTwoSum(a, b, result) {
	var x = a + b
	var bv = x - a
	var av = x - bv
	var br = b - bv
	var ar = a - av
	if(result) {
		result[0] = ar + br
		result[1] = x
		return result
	}
	return [ar+br, x]
}
},{}],212:[function(require,module,exports){
(function (global,Buffer){
'use strict'

var bits = require('bit-twiddle')
var dup = require('dup')

//Legacy pool support
if(!global.__TYPEDARRAY_POOL) {
  global.__TYPEDARRAY_POOL = {
      UINT8   : dup([32, 0])
    , UINT16  : dup([32, 0])
    , UINT32  : dup([32, 0])
    , INT8    : dup([32, 0])
    , INT16   : dup([32, 0])
    , INT32   : dup([32, 0])
    , FLOAT   : dup([32, 0])
    , DOUBLE  : dup([32, 0])
    , DATA    : dup([32, 0])
    , UINT8C  : dup([32, 0])
    , BUFFER  : dup([32, 0])
  }
}

var hasUint8C = (typeof Uint8ClampedArray) !== 'undefined'
var POOL = global.__TYPEDARRAY_POOL

//Upgrade pool
if(!POOL.UINT8C) {
  POOL.UINT8C = dup([32, 0])
}
if(!POOL.BUFFER) {
  POOL.BUFFER = dup([32, 0])
}

//New technique: Only allocate from ArrayBufferView and Buffer
var DATA    = POOL.DATA
  , BUFFER  = POOL.BUFFER

exports.free = function free(array) {
  if(Buffer.isBuffer(array)) {
    BUFFER[bits.log2(array.length)].push(array)
  } else {
    if(Object.prototype.toString.call(array) !== '[object ArrayBuffer]') {
      array = array.buffer
    }
    if(!array) {
      return
    }
    var n = array.length || array.byteLength
    var log_n = bits.log2(n)|0
    DATA[log_n].push(array)
  }
}

function freeArrayBuffer(buffer) {
  if(!buffer) {
    return
  }
  var n = buffer.length || buffer.byteLength
  var log_n = bits.log2(n)
  DATA[log_n].push(buffer)
}

function freeTypedArray(array) {
  freeArrayBuffer(array.buffer)
}

exports.freeUint8 =
exports.freeUint16 =
exports.freeUint32 =
exports.freeInt8 =
exports.freeInt16 =
exports.freeInt32 =
exports.freeFloat32 = 
exports.freeFloat =
exports.freeFloat64 = 
exports.freeDouble = 
exports.freeUint8Clamped = 
exports.freeDataView = freeTypedArray

exports.freeArrayBuffer = freeArrayBuffer

exports.freeBuffer = function freeBuffer(array) {
  BUFFER[bits.log2(array.length)].push(array)
}

exports.malloc = function malloc(n, dtype) {
  if(dtype === undefined || dtype === 'arraybuffer') {
    return mallocArrayBuffer(n)
  } else {
    switch(dtype) {
      case 'uint8':
        return mallocUint8(n)
      case 'uint16':
        return mallocUint16(n)
      case 'uint32':
        return mallocUint32(n)
      case 'int8':
        return mallocInt8(n)
      case 'int16':
        return mallocInt16(n)
      case 'int32':
        return mallocInt32(n)
      case 'float':
      case 'float32':
        return mallocFloat(n)
      case 'double':
      case 'float64':
        return mallocDouble(n)
      case 'uint8_clamped':
        return mallocUint8Clamped(n)
      case 'buffer':
        return mallocBuffer(n)
      case 'data':
      case 'dataview':
        return mallocDataView(n)

      default:
        return null
    }
  }
  return null
}

function mallocArrayBuffer(n) {
  var n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var d = DATA[log_n]
  if(d.length > 0) {
    return d.pop()
  }
  return new ArrayBuffer(n)
}
exports.mallocArrayBuffer = mallocArrayBuffer

function mallocUint8(n) {
  return new Uint8Array(mallocArrayBuffer(n), 0, n)
}
exports.mallocUint8 = mallocUint8

function mallocUint16(n) {
  return new Uint16Array(mallocArrayBuffer(2*n), 0, n)
}
exports.mallocUint16 = mallocUint16

function mallocUint32(n) {
  return new Uint32Array(mallocArrayBuffer(4*n), 0, n)
}
exports.mallocUint32 = mallocUint32

function mallocInt8(n) {
  return new Int8Array(mallocArrayBuffer(n), 0, n)
}
exports.mallocInt8 = mallocInt8

function mallocInt16(n) {
  return new Int16Array(mallocArrayBuffer(2*n), 0, n)
}
exports.mallocInt16 = mallocInt16

function mallocInt32(n) {
  return new Int32Array(mallocArrayBuffer(4*n), 0, n)
}
exports.mallocInt32 = mallocInt32

function mallocFloat(n) {
  return new Float32Array(mallocArrayBuffer(4*n), 0, n)
}
exports.mallocFloat32 = exports.mallocFloat = mallocFloat

function mallocDouble(n) {
  return new Float64Array(mallocArrayBuffer(8*n), 0, n)
}
exports.mallocFloat64 = exports.mallocDouble = mallocDouble

function mallocUint8Clamped(n) {
  if(hasUint8C) {
    return new Uint8ClampedArray(mallocArrayBuffer(n), 0, n)
  } else {
    return mallocUint8(n)
  }
}
exports.mallocUint8Clamped = mallocUint8Clamped

function mallocDataView(n) {
  return new DataView(mallocArrayBuffer(n), 0, n)
}
exports.mallocDataView = mallocDataView

function mallocBuffer(n) {
  n = bits.nextPow2(n)
  var log_n = bits.log2(n)
  var cache = BUFFER[log_n]
  if(cache.length > 0) {
    return cache.pop()
  }
  return new Buffer(n)
}
exports.mallocBuffer = mallocBuffer

exports.clearCache = function clearCache() {
  for(var i=0; i<32; ++i) {
    POOL.UINT8[i].length = 0
    POOL.UINT16[i].length = 0
    POOL.UINT32[i].length = 0
    POOL.INT8[i].length = 0
    POOL.INT16[i].length = 0
    POOL.INT32[i].length = 0
    POOL.FLOAT[i].length = 0
    POOL.DOUBLE[i].length = 0
    POOL.UINT8C[i].length = 0
    DATA[i].length = 0
    BUFFER[i].length = 0
  }
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"bit-twiddle":35,"buffer":3,"dup":68}],213:[function(require,module,exports){
"use strict"; "use restrict";

module.exports = UnionFind;

function UnionFind(count) {
  this.roots = new Array(count);
  this.ranks = new Array(count);
  
  for(var i=0; i<count; ++i) {
    this.roots[i] = i;
    this.ranks[i] = 0;
  }
}

var proto = UnionFind.prototype

Object.defineProperty(proto, "length", {
  "get": function() {
    return this.roots.length
  }
})

proto.makeSet = function() {
  var n = this.roots.length;
  this.roots.push(n);
  this.ranks.push(0);
  return n;
}

proto.find = function(x) {
  var x0 = x
  var roots = this.roots;
  while(roots[x] !== x) {
    x = roots[x]
  }
  while(roots[x0] !== x) {
    var y = roots[x0]
    roots[x0] = x
    x0 = y
  }
  return x;
}

proto.link = function(x, y) {
  var xr = this.find(x)
    , yr = this.find(y);
  if(xr === yr) {
    return;
  }
  var ranks = this.ranks
    , roots = this.roots
    , xd    = ranks[xr]
    , yd    = ranks[yr];
  if(xd < yd) {
    roots[xr] = yr;
  } else if(yd < xd) {
    roots[yr] = xr;
  } else {
    roots[yr] = xr;
    ++ranks[xr];
  }
}
},{}],214:[function(require,module,exports){
"use strict"

function unique_pred(list, compare) {
  var ptr = 1
    , len = list.length
    , a=list[0], b=list[0]
  for(var i=1; i<len; ++i) {
    b = a
    a = list[i]
    if(compare(a, b)) {
      if(i === ptr) {
        ptr++
        continue
      }
      list[ptr++] = a
    }
  }
  list.length = ptr
  return list
}

function unique_eq(list) {
  var ptr = 1
    , len = list.length
    , a=list[0], b = list[0]
  for(var i=1; i<len; ++i, b=a) {
    b = a
    a = list[i]
    if(a !== b) {
      if(i === ptr) {
        ptr++
        continue
      }
      list[ptr++] = a
    }
  }
  list.length = ptr
  return list
}

function unique(list, compare, sorted) {
  if(list.length === 0) {
    return list
  }
  if(compare) {
    if(!sorted) {
      list.sort(compare)
    }
    return unique_pred(list, compare)
  }
  if(!sorted) {
    list.sort()
  }
  return unique_eq(list)
}

module.exports = unique

},{}],215:[function(require,module,exports){
"use strict"

module.exports = createText

var vectorizeText = require("./lib/vtext")
var defaultCanvas = null
var defaultContext = null

if(typeof document !== 'undefined') {
  defaultCanvas = document.createElement('canvas')
  defaultCanvas.width = 8192
  defaultCanvas.height = 1024
  defaultContext = defaultCanvas.getContext("2d")
}

function createText(str, options) {
  if((typeof options !== "object") || (options === null)) {
    options = {}
  }
  return vectorizeText(
    str,
    options.canvas || defaultCanvas,
    options.context || defaultContext,
    options)
}

},{"./lib/vtext":216}],216:[function(require,module,exports){
"use strict"

module.exports = vectorizeText
module.exports.processPixels = processPixels

var surfaceNets = require('surface-nets')
var ndarray = require('ndarray')
var simplify = require('simplify-planar-graph')
var cleanPSLG = require('clean-pslg')
var cdt2d = require('cdt2d')
var toPolygonCrappy = require('planar-graph-to-polyline')

function transformPositions(positions, options, size) {
  var align = options.textAlign || "start"
  var baseline = options.textBaseline || "alphabetic"

  var lo = [1<<30, 1<<30]
  var hi = [0,0]
  var n = positions.length
  for(var i=0; i<n; ++i) {
    var p = positions[i]
    for(var j=0; j<2; ++j) {
      lo[j] = Math.min(lo[j], p[j])|0
      hi[j] = Math.max(hi[j], p[j])|0
    }
  }

  var xShift = 0
  switch(align) {
    case "center":
      xShift = -0.5 * (lo[0] + hi[0])
    break

    case "right":
    case "end":
      xShift = -hi[0]
    break

    case "left":
    case "start":
      xShift = -lo[0]
    break

    default:
      throw new Error("vectorize-text: Unrecognized textAlign: '" + align + "'")
  }

  var yShift = 0
  switch(baseline) {
    case "hanging":
    case "top":
      yShift = -lo[1]
    break

    case "middle":
      yShift = -0.5 * (lo[1] + hi[1])
    break

    case "alphabetic":
    case "ideographic":
      yShift = -3 * size
    break

    case "bottom":
      yShift = -hi[1]
    break

    default:
      throw new Error("vectorize-text: Unrecoginized textBaseline: '" + baseline + "'")
  }

  var scale = 1.0 / size
  if("lineHeight" in options) {
    scale *= +options.lineHeight
  } else if("width" in options) {
    scale = options.width / (hi[0] - lo[0])
  } else if("height" in options) {
    scale = options.height / (hi[1] - lo[1])
  }

  return positions.map(function(p) {
    return [ scale * (p[0] + xShift), scale * (p[1] + yShift) ]
  })
}

function getPixels(canvas, context, str, size) {
  var width = Math.ceil(context.measureText(str).width + 2*size)|0
  if(width > 8192) {
    throw new Error("vectorize-text: String too long (sorry, this will get fixed later)")
  }
  var height = 3 * size
  if(canvas.height < height) {
    canvas.height = height
  }

  context.fillStyle = "#000"
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = "#fff"
  context.fillText(str, size, 2*size)

  //Cut pixels from image
  var pixelData = context.getImageData(0, 0, width, height)
  var pixels = ndarray(pixelData.data, [height, width, 4])

  return pixels.pick(-1,-1,0).transpose(1,0)
}

function getContour(pixels, doSimplify) {
  var contour = surfaceNets(pixels, 128)
  if(doSimplify) {
    return simplify(contour.cells, contour.positions, 0.25)
  }
  return {
    edges: contour.cells,
    positions: contour.positions
  }
}

function processPixelsImpl(pixels, options, size, simplify) {
  //Extract contour
  var contour = getContour(pixels, simplify)

  //Apply warp to positions
  var positions = transformPositions(contour.positions, options, size)
  var edges     = contour.edges
  var flip = "ccw" === options.orientation

  //Clean up the PSLG, resolve self intersections, etc.
  cleanPSLG(positions, edges)

  //If triangulate flag passed, triangulate the result
  if(options.polygons || options.polygon || options.polyline) {
    var result = toPolygonCrappy(edges, positions)
    var nresult = new Array(result.length)
    for(var i=0; i<result.length; ++i) {
      var loops = result[i]
      var nloops = new Array(loops.length)
      for(var j=0; j<loops.length; ++j) {
        var loop = loops[j]
        var nloop = new Array(loop.length)
        for(var k=0; k<loop.length; ++k) {
          nloop[k] = positions[loop[k]].slice()
        }
        if(flip) {
          nloop.reverse()
        }
        nloops[j] = nloop
      }
      nresult[i] = nloops
    }
    return nresult
  } else if(options.triangles || options.triangulate || options.triangle) {
    return {
      cells: cdt2d(positions, edges, {
        delaunay: false,
        exterior: false,
        interior: true
      }),
      positions: positions
    }
  } else {
    return {
      edges:     edges,
      positions: positions
    }
  }
}

function processPixels(pixels, options, size) {
  try {
    return processPixelsImpl(pixels, options, size, true)
  } catch(e) {}
  try {
    return processPixelsImpl(pixels, options, size, false)
  } catch(e) {}
  if(options.polygons || options.polyline || options.polygon) {
    return []
  }
  if(options.triangles || options.triangulate || options.triangle) {
    return {
      cells: [],
      positions: []
    }
  }
  return {
    edges: [],
    positions: []
  }
}

function vectorizeText(str, canvas, context, options) {
  var size = options.size || 64
  var family = options.font || "normal"

  context.font = size + "px " + family
  context.textAlign = "start"
  context.textBaseline = "alphabetic"
  context.direction = "ltr"

  var pixels = getPixels(canvas, context, str, size)

  return processPixels(pixels, options, size)
}

},{"cdt2d":46,"clean-pslg":52,"ndarray":164,"planar-graph-to-polyline":175,"simplify-planar-graph":201,"surface-nets":206}],217:[function(require,module,exports){
var hiddenStore = require('./hidden-store.js');

module.exports = createStore;

function createStore() {
    var key = {};

    return function (obj) {
        if ((typeof obj !== 'object' || obj === null) &&
            typeof obj !== 'function'
        ) {
            throw new Error('Weakmap-shim: Key must be object')
        }

        var store = obj.valueOf(key);
        return store && store.identity === key ?
            store : hiddenStore(obj, key);
    };
}

},{"./hidden-store.js":218}],218:[function(require,module,exports){
module.exports = hiddenStore;

function hiddenStore(obj, key) {
    var store = { identity: key };
    var valueOf = obj.valueOf;

    Object.defineProperty(obj, "valueOf", {
        value: function (value) {
            return value !== key ?
                valueOf.apply(this, arguments) : store;
        },
        writable: true
    });

    return store;
}

},{}],219:[function(require,module,exports){
// Original - @Gozola.
// https://gist.github.com/Gozala/1269991
// This is a reimplemented version (with a few bug fixes).

var createStore = require('./create-store.js');

module.exports = weakMap;

function weakMap() {
    var privates = createStore();

    return {
        'get': function (key, fallback) {
            var store = privates(key)
            return store.hasOwnProperty('value') ?
                store.value : fallback
        },
        'set': function (key, value) {
            privates(key).value = value;
            return this;
        },
        'has': function(key) {
            return 'value' in privates(key);
        },
        'delete': function (key) {
            return delete privates(key).value;
        }
    }
}

},{"./create-store.js":217}],220:[function(require,module,exports){
module.exports = require('cwise-compiler')({
    args: ['array', {
        offset: [1],
        array: 0
    }, 'scalar', 'scalar', 'index'],
    pre: {
        "body": "{}",
        "args": [],
        "thisVars": [],
        "localVars": []
    },
    post: {
        "body": "{}",
        "args": [],
        "thisVars": [],
        "localVars": []
    },
    body: {
        "body": "{\n        var _inline_1_da = _inline_1_arg0_ - _inline_1_arg3_\n        var _inline_1_db = _inline_1_arg1_ - _inline_1_arg3_\n        if((_inline_1_da >= 0) !== (_inline_1_db >= 0)) {\n          _inline_1_arg2_.push(_inline_1_arg4_[0] + 0.5 + 0.5 * (_inline_1_da + _inline_1_db) / (_inline_1_da - _inline_1_db))\n        }\n      }",
        "args": [{
            "name": "_inline_1_arg0_",
            "lvalue": false,
            "rvalue": true,
            "count": 1
        }, {
            "name": "_inline_1_arg1_",
            "lvalue": false,
            "rvalue": true,
            "count": 1
        }, {
            "name": "_inline_1_arg2_",
            "lvalue": false,
            "rvalue": true,
            "count": 1
        }, {
            "name": "_inline_1_arg3_",
            "lvalue": false,
            "rvalue": true,
            "count": 2
        }, {
            "name": "_inline_1_arg4_",
            "lvalue": false,
            "rvalue": true,
            "count": 1
        }],
        "thisVars": [],
        "localVars": ["_inline_1_da", "_inline_1_db"]
    },
    funcName: 'zeroCrossings'
})

},{"cwise-compiler":63}],221:[function(require,module,exports){
"use strict"

module.exports = findZeroCrossings

var core = require("./lib/zc-core")

function findZeroCrossings(array, level) {
  var cross = []
  level = +level || 0.0
  core(array.hi(array.shape[0]-1), cross, level)
  return cross
}
},{"./lib/zc-core":220}]},{},[6]);
