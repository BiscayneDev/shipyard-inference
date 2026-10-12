"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod2) => function __require2() {
    try {
      return mod2 || (0, cb[__getOwnPropNames(cb)[0]])((mod2 = { exports: {} }).exports, mod2), mod2.exports;
    } catch (e) {
      throw mod2 = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod2, isNodeMode, target) => (target = mod2 != null ? __create(__getProtoOf(mod2)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod2 || !mod2.__esModule ? __defProp(target, "default", { value: mod2, enumerable: true }) : target,
    mod2
  ));
  var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // node_modules/base64-js/index.js
  var require_base64_js = __commonJS({
    "node_modules/base64-js/index.js"(exports) {
      "use strict";
      init_buffer_shim();
      exports.byteLength = byteLength;
      exports.toByteArray = toByteArray;
      exports.fromByteArray = fromByteArray;
      var lookup = [];
      var revLookup = [];
      var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
      var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      for (i2 = 0, len = code.length; i2 < len; ++i2) {
        lookup[i2] = code[i2];
        revLookup[code.charCodeAt(i2)] = i2;
      }
      var i2;
      var len;
      revLookup["-".charCodeAt(0)] = 62;
      revLookup["_".charCodeAt(0)] = 63;
      function getLens(b64) {
        var len2 = b64.length;
        if (len2 % 4 > 0) {
          throw new Error("Invalid string. Length must be a multiple of 4");
        }
        var validLen = b64.indexOf("=");
        if (validLen === -1) validLen = len2;
        var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
        return [validLen, placeHoldersLen];
      }
      function byteLength(b64) {
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function _byteLength(b64, validLen, placeHoldersLen) {
        return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
      }
      function toByteArray(b64) {
        var tmp;
        var lens = getLens(b64);
        var validLen = lens[0];
        var placeHoldersLen = lens[1];
        var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
        var curByte = 0;
        var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
        var i3;
        for (i3 = 0; i3 < len2; i3 += 4) {
          tmp = revLookup[b64.charCodeAt(i3)] << 18 | revLookup[b64.charCodeAt(i3 + 1)] << 12 | revLookup[b64.charCodeAt(i3 + 2)] << 6 | revLookup[b64.charCodeAt(i3 + 3)];
          arr[curByte++] = tmp >> 16 & 255;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 2) {
          tmp = revLookup[b64.charCodeAt(i3)] << 2 | revLookup[b64.charCodeAt(i3 + 1)] >> 4;
          arr[curByte++] = tmp & 255;
        }
        if (placeHoldersLen === 1) {
          tmp = revLookup[b64.charCodeAt(i3)] << 10 | revLookup[b64.charCodeAt(i3 + 1)] << 4 | revLookup[b64.charCodeAt(i3 + 2)] >> 2;
          arr[curByte++] = tmp >> 8 & 255;
          arr[curByte++] = tmp & 255;
        }
        return arr;
      }
      function tripletToBase64(num) {
        return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
      }
      function encodeChunk(uint8, start, end) {
        var tmp;
        var output = [];
        for (var i3 = start; i3 < end; i3 += 3) {
          tmp = (uint8[i3] << 16 & 16711680) + (uint8[i3 + 1] << 8 & 65280) + (uint8[i3 + 2] & 255);
          output.push(tripletToBase64(tmp));
        }
        return output.join("");
      }
      function fromByteArray(uint8) {
        var tmp;
        var len2 = uint8.length;
        var extraBytes = len2 % 3;
        var parts = [];
        var maxChunkLength = 16383;
        for (var i3 = 0, len22 = len2 - extraBytes; i3 < len22; i3 += maxChunkLength) {
          parts.push(encodeChunk(uint8, i3, i3 + maxChunkLength > len22 ? len22 : i3 + maxChunkLength));
        }
        if (extraBytes === 1) {
          tmp = uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "=="
          );
        } else if (extraBytes === 2) {
          tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
          parts.push(
            lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
          );
        }
        return parts.join("");
      }
    }
  });

  // node_modules/ieee754/index.js
  var require_ieee754 = __commonJS({
    "node_modules/ieee754/index.js"(exports) {
      init_buffer_shim();
      exports.read = function(buffer, offset2, isLE2, mLen, nBytes) {
        var e, m;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var nBits = -7;
        var i2 = isLE2 ? nBytes - 1 : 0;
        var d = isLE2 ? -1 : 1;
        var s = buffer[offset2 + i2];
        i2 += d;
        e = s & (1 << -nBits) - 1;
        s >>= -nBits;
        nBits += eLen;
        for (; nBits > 0; e = e * 256 + buffer[offset2 + i2], i2 += d, nBits -= 8) {
        }
        m = e & (1 << -nBits) - 1;
        e >>= -nBits;
        nBits += mLen;
        for (; nBits > 0; m = m * 256 + buffer[offset2 + i2], i2 += d, nBits -= 8) {
        }
        if (e === 0) {
          e = 1 - eBias;
        } else if (e === eMax) {
          return m ? NaN : (s ? -1 : 1) * Infinity;
        } else {
          m = m + Math.pow(2, mLen);
          e = e - eBias;
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
      };
      exports.write = function(buffer, value, offset2, isLE2, mLen, nBytes) {
        var e, m, c;
        var eLen = nBytes * 8 - mLen - 1;
        var eMax = (1 << eLen) - 1;
        var eBias = eMax >> 1;
        var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
        var i2 = isLE2 ? 0 : nBytes - 1;
        var d = isLE2 ? 1 : -1;
        var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
        value = Math.abs(value);
        if (isNaN(value) || value === Infinity) {
          m = isNaN(value) ? 1 : 0;
          e = eMax;
        } else {
          e = Math.floor(Math.log(value) / Math.LN2);
          if (value * (c = Math.pow(2, -e)) < 1) {
            e--;
            c *= 2;
          }
          if (e + eBias >= 1) {
            value += rt / c;
          } else {
            value += rt * Math.pow(2, 1 - eBias);
          }
          if (value * c >= 2) {
            e++;
            c /= 2;
          }
          if (e + eBias >= eMax) {
            m = 0;
            e = eMax;
          } else if (e + eBias >= 1) {
            m = (value * c - 1) * Math.pow(2, mLen);
            e = e + eBias;
          } else {
            m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
            e = 0;
          }
        }
        for (; mLen >= 8; buffer[offset2 + i2] = m & 255, i2 += d, m /= 256, mLen -= 8) {
        }
        e = e << mLen | m;
        eLen += mLen;
        for (; eLen > 0; buffer[offset2 + i2] = e & 255, i2 += d, e /= 256, eLen -= 8) {
        }
        buffer[offset2 + i2 - d] |= s * 128;
      };
    }
  });

  // node_modules/buffer/index.js
  var require_buffer = __commonJS({
    "node_modules/buffer/index.js"(exports) {
      "use strict";
      init_buffer_shim();
      var base64 = require_base64_js();
      var ieee754 = require_ieee754();
      var customInspectSymbol = typeof Symbol === "function" && typeof Symbol["for"] === "function" ? Symbol["for"]("nodejs.util.inspect.custom") : null;
      exports.Buffer = Buffer5;
      exports.SlowBuffer = SlowBuffer;
      exports.INSPECT_MAX_BYTES = 50;
      var K_MAX_LENGTH = 2147483647;
      exports.kMaxLength = K_MAX_LENGTH;
      Buffer5.TYPED_ARRAY_SUPPORT = typedArraySupport();
      if (!Buffer5.TYPED_ARRAY_SUPPORT && typeof console !== "undefined" && typeof console.error === "function") {
        console.error(
          "This browser lacks typed array (Uint8Array) support which is required by `buffer` v5.x. Use `buffer` v4.x if you require old browser support."
        );
      }
      function typedArraySupport() {
        try {
          const arr = new Uint8Array(1);
          const proto = { foo: function() {
            return 42;
          } };
          Object.setPrototypeOf(proto, Uint8Array.prototype);
          Object.setPrototypeOf(arr, proto);
          return arr.foo() === 42;
        } catch (e) {
          return false;
        }
      }
      Object.defineProperty(Buffer5.prototype, "parent", {
        enumerable: true,
        get: function() {
          if (!Buffer5.isBuffer(this)) return void 0;
          return this.buffer;
        }
      });
      Object.defineProperty(Buffer5.prototype, "offset", {
        enumerable: true,
        get: function() {
          if (!Buffer5.isBuffer(this)) return void 0;
          return this.byteOffset;
        }
      });
      function createBuffer(length) {
        if (length > K_MAX_LENGTH) {
          throw new RangeError('The value "' + length + '" is invalid for option "size"');
        }
        const buf = new Uint8Array(length);
        Object.setPrototypeOf(buf, Buffer5.prototype);
        return buf;
      }
      function Buffer5(arg, encodingOrOffset, length) {
        if (typeof arg === "number") {
          if (typeof encodingOrOffset === "string") {
            throw new TypeError(
              'The "string" argument must be of type string. Received type number'
            );
          }
          return allocUnsafe(arg);
        }
        return from(arg, encodingOrOffset, length);
      }
      Buffer5.poolSize = 8192;
      function from(value, encodingOrOffset, length) {
        if (typeof value === "string") {
          return fromString(value, encodingOrOffset);
        }
        if (ArrayBuffer.isView(value)) {
          return fromArrayView(value);
        }
        if (value == null) {
          throw new TypeError(
            "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
          );
        }
        if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof SharedArrayBuffer !== "undefined" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
          return fromArrayBuffer(value, encodingOrOffset, length);
        }
        if (typeof value === "number") {
          throw new TypeError(
            'The "value" argument must not be of type number. Received type number'
          );
        }
        const valueOf = value.valueOf && value.valueOf();
        if (valueOf != null && valueOf !== value) {
          return Buffer5.from(valueOf, encodingOrOffset, length);
        }
        const b = fromObject(value);
        if (b) return b;
        if (typeof Symbol !== "undefined" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function") {
          return Buffer5.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
        }
        throw new TypeError(
          "The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value
        );
      }
      Buffer5.from = function(value, encodingOrOffset, length) {
        return from(value, encodingOrOffset, length);
      };
      Object.setPrototypeOf(Buffer5.prototype, Uint8Array.prototype);
      Object.setPrototypeOf(Buffer5, Uint8Array);
      function assertSize(size) {
        if (typeof size !== "number") {
          throw new TypeError('"size" argument must be of type number');
        } else if (size < 0) {
          throw new RangeError('The value "' + size + '" is invalid for option "size"');
        }
      }
      function alloc(size, fill, encoding) {
        assertSize(size);
        if (size <= 0) {
          return createBuffer(size);
        }
        if (fill !== void 0) {
          return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
        }
        return createBuffer(size);
      }
      Buffer5.alloc = function(size, fill, encoding) {
        return alloc(size, fill, encoding);
      };
      function allocUnsafe(size) {
        assertSize(size);
        return createBuffer(size < 0 ? 0 : checked(size) | 0);
      }
      Buffer5.allocUnsafe = function(size) {
        return allocUnsafe(size);
      };
      Buffer5.allocUnsafeSlow = function(size) {
        return allocUnsafe(size);
      };
      function fromString(string2, encoding) {
        if (typeof encoding !== "string" || encoding === "") {
          encoding = "utf8";
        }
        if (!Buffer5.isEncoding(encoding)) {
          throw new TypeError("Unknown encoding: " + encoding);
        }
        const length = byteLength(string2, encoding) | 0;
        let buf = createBuffer(length);
        const actual = buf.write(string2, encoding);
        if (actual !== length) {
          buf = buf.slice(0, actual);
        }
        return buf;
      }
      function fromArrayLike(array2) {
        const length = array2.length < 0 ? 0 : checked(array2.length) | 0;
        const buf = createBuffer(length);
        for (let i2 = 0; i2 < length; i2 += 1) {
          buf[i2] = array2[i2] & 255;
        }
        return buf;
      }
      function fromArrayView(arrayView) {
        if (isInstance(arrayView, Uint8Array)) {
          const copy = new Uint8Array(arrayView);
          return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
        }
        return fromArrayLike(arrayView);
      }
      function fromArrayBuffer(array2, byteOffset, length) {
        if (byteOffset < 0 || array2.byteLength < byteOffset) {
          throw new RangeError('"offset" is outside of buffer bounds');
        }
        if (array2.byteLength < byteOffset + (length || 0)) {
          throw new RangeError('"length" is outside of buffer bounds');
        }
        let buf;
        if (byteOffset === void 0 && length === void 0) {
          buf = new Uint8Array(array2);
        } else if (length === void 0) {
          buf = new Uint8Array(array2, byteOffset);
        } else {
          buf = new Uint8Array(array2, byteOffset, length);
        }
        Object.setPrototypeOf(buf, Buffer5.prototype);
        return buf;
      }
      function fromObject(obj) {
        if (Buffer5.isBuffer(obj)) {
          const len = checked(obj.length) | 0;
          const buf = createBuffer(len);
          if (buf.length === 0) {
            return buf;
          }
          obj.copy(buf, 0, 0, len);
          return buf;
        }
        if (obj.length !== void 0) {
          if (typeof obj.length !== "number" || numberIsNaN(obj.length)) {
            return createBuffer(0);
          }
          return fromArrayLike(obj);
        }
        if (obj.type === "Buffer" && Array.isArray(obj.data)) {
          return fromArrayLike(obj.data);
        }
      }
      function checked(length) {
        if (length >= K_MAX_LENGTH) {
          throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + K_MAX_LENGTH.toString(16) + " bytes");
        }
        return length | 0;
      }
      function SlowBuffer(length) {
        if (+length != length) {
          length = 0;
        }
        return Buffer5.alloc(+length);
      }
      Buffer5.isBuffer = function isBuffer(b) {
        return b != null && b._isBuffer === true && b !== Buffer5.prototype;
      };
      Buffer5.compare = function compare2(a, b) {
        if (isInstance(a, Uint8Array)) a = Buffer5.from(a, a.offset, a.byteLength);
        if (isInstance(b, Uint8Array)) b = Buffer5.from(b, b.offset, b.byteLength);
        if (!Buffer5.isBuffer(a) || !Buffer5.isBuffer(b)) {
          throw new TypeError(
            'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
          );
        }
        if (a === b) return 0;
        let x = a.length;
        let y = b.length;
        for (let i2 = 0, len = Math.min(x, y); i2 < len; ++i2) {
          if (a[i2] !== b[i2]) {
            x = a[i2];
            y = b[i2];
            break;
          }
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
      };
      Buffer5.isEncoding = function isEncoding(encoding) {
        switch (String(encoding).toLowerCase()) {
          case "hex":
          case "utf8":
          case "utf-8":
          case "ascii":
          case "latin1":
          case "binary":
          case "base64":
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return true;
          default:
            return false;
        }
      };
      Buffer5.concat = function concat(list, length) {
        if (!Array.isArray(list)) {
          throw new TypeError('"list" argument must be an Array of Buffers');
        }
        if (list.length === 0) {
          return Buffer5.alloc(0);
        }
        let i2;
        if (length === void 0) {
          length = 0;
          for (i2 = 0; i2 < list.length; ++i2) {
            length += list[i2].length;
          }
        }
        const buffer = Buffer5.allocUnsafe(length);
        let pos = 0;
        for (i2 = 0; i2 < list.length; ++i2) {
          let buf = list[i2];
          if (isInstance(buf, Uint8Array)) {
            if (pos + buf.length > buffer.length) {
              if (!Buffer5.isBuffer(buf)) buf = Buffer5.from(buf);
              buf.copy(buffer, pos);
            } else {
              Uint8Array.prototype.set.call(
                buffer,
                buf,
                pos
              );
            }
          } else if (!Buffer5.isBuffer(buf)) {
            throw new TypeError('"list" argument must be an Array of Buffers');
          } else {
            buf.copy(buffer, pos);
          }
          pos += buf.length;
        }
        return buffer;
      };
      function byteLength(string2, encoding) {
        if (Buffer5.isBuffer(string2)) {
          return string2.length;
        }
        if (ArrayBuffer.isView(string2) || isInstance(string2, ArrayBuffer)) {
          return string2.byteLength;
        }
        if (typeof string2 !== "string") {
          throw new TypeError(
            'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string2
          );
        }
        const len = string2.length;
        const mustMatch = arguments.length > 2 && arguments[2] === true;
        if (!mustMatch && len === 0) return 0;
        let loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "ascii":
            case "latin1":
            case "binary":
              return len;
            case "utf8":
            case "utf-8":
              return utf8ToBytes2(string2).length;
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return len * 2;
            case "hex":
              return len >>> 1;
            case "base64":
              return base64ToBytes(string2).length;
            default:
              if (loweredCase) {
                return mustMatch ? -1 : utf8ToBytes2(string2).length;
              }
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer5.byteLength = byteLength;
      function slowToString(encoding, start, end) {
        let loweredCase = false;
        if (start === void 0 || start < 0) {
          start = 0;
        }
        if (start > this.length) {
          return "";
        }
        if (end === void 0 || end > this.length) {
          end = this.length;
        }
        if (end <= 0) {
          return "";
        }
        end >>>= 0;
        start >>>= 0;
        if (end <= start) {
          return "";
        }
        if (!encoding) encoding = "utf8";
        while (true) {
          switch (encoding) {
            case "hex":
              return hexSlice(this, start, end);
            case "utf8":
            case "utf-8":
              return utf8Slice(this, start, end);
            case "ascii":
              return asciiSlice(this, start, end);
            case "latin1":
            case "binary":
              return latin1Slice(this, start, end);
            case "base64":
              return base64Slice(this, start, end);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return utf16leSlice(this, start, end);
            default:
              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
              encoding = (encoding + "").toLowerCase();
              loweredCase = true;
          }
        }
      }
      Buffer5.prototype._isBuffer = true;
      function swap(b, n, m) {
        const i2 = b[n];
        b[n] = b[m];
        b[m] = i2;
      }
      Buffer5.prototype.swap16 = function swap16() {
        const len = this.length;
        if (len % 2 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 16-bits");
        }
        for (let i2 = 0; i2 < len; i2 += 2) {
          swap(this, i2, i2 + 1);
        }
        return this;
      };
      Buffer5.prototype.swap32 = function swap32() {
        const len = this.length;
        if (len % 4 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 32-bits");
        }
        for (let i2 = 0; i2 < len; i2 += 4) {
          swap(this, i2, i2 + 3);
          swap(this, i2 + 1, i2 + 2);
        }
        return this;
      };
      Buffer5.prototype.swap64 = function swap64() {
        const len = this.length;
        if (len % 8 !== 0) {
          throw new RangeError("Buffer size must be a multiple of 64-bits");
        }
        for (let i2 = 0; i2 < len; i2 += 8) {
          swap(this, i2, i2 + 7);
          swap(this, i2 + 1, i2 + 6);
          swap(this, i2 + 2, i2 + 5);
          swap(this, i2 + 3, i2 + 4);
        }
        return this;
      };
      Buffer5.prototype.toString = function toString() {
        const length = this.length;
        if (length === 0) return "";
        if (arguments.length === 0) return utf8Slice(this, 0, length);
        return slowToString.apply(this, arguments);
      };
      Buffer5.prototype.toLocaleString = Buffer5.prototype.toString;
      Buffer5.prototype.equals = function equals(b) {
        if (!Buffer5.isBuffer(b)) throw new TypeError("Argument must be a Buffer");
        if (this === b) return true;
        return Buffer5.compare(this, b) === 0;
      };
      Buffer5.prototype.inspect = function inspect() {
        let str = "";
        const max = exports.INSPECT_MAX_BYTES;
        str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim();
        if (this.length > max) str += " ... ";
        return "<Buffer " + str + ">";
      };
      if (customInspectSymbol) {
        Buffer5.prototype[customInspectSymbol] = Buffer5.prototype.inspect;
      }
      Buffer5.prototype.compare = function compare2(target, start, end, thisStart, thisEnd) {
        if (isInstance(target, Uint8Array)) {
          target = Buffer5.from(target, target.offset, target.byteLength);
        }
        if (!Buffer5.isBuffer(target)) {
          throw new TypeError(
            'The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target
          );
        }
        if (start === void 0) {
          start = 0;
        }
        if (end === void 0) {
          end = target ? target.length : 0;
        }
        if (thisStart === void 0) {
          thisStart = 0;
        }
        if (thisEnd === void 0) {
          thisEnd = this.length;
        }
        if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
          throw new RangeError("out of range index");
        }
        if (thisStart >= thisEnd && start >= end) {
          return 0;
        }
        if (thisStart >= thisEnd) {
          return -1;
        }
        if (start >= end) {
          return 1;
        }
        start >>>= 0;
        end >>>= 0;
        thisStart >>>= 0;
        thisEnd >>>= 0;
        if (this === target) return 0;
        let x = thisEnd - thisStart;
        let y = end - start;
        const len = Math.min(x, y);
        const thisCopy = this.slice(thisStart, thisEnd);
        const targetCopy = target.slice(start, end);
        for (let i2 = 0; i2 < len; ++i2) {
          if (thisCopy[i2] !== targetCopy[i2]) {
            x = thisCopy[i2];
            y = targetCopy[i2];
            break;
          }
        }
        if (x < y) return -1;
        if (y < x) return 1;
        return 0;
      };
      function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
        if (buffer.length === 0) return -1;
        if (typeof byteOffset === "string") {
          encoding = byteOffset;
          byteOffset = 0;
        } else if (byteOffset > 2147483647) {
          byteOffset = 2147483647;
        } else if (byteOffset < -2147483648) {
          byteOffset = -2147483648;
        }
        byteOffset = +byteOffset;
        if (numberIsNaN(byteOffset)) {
          byteOffset = dir ? 0 : buffer.length - 1;
        }
        if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
        if (byteOffset >= buffer.length) {
          if (dir) return -1;
          else byteOffset = buffer.length - 1;
        } else if (byteOffset < 0) {
          if (dir) byteOffset = 0;
          else return -1;
        }
        if (typeof val === "string") {
          val = Buffer5.from(val, encoding);
        }
        if (Buffer5.isBuffer(val)) {
          if (val.length === 0) {
            return -1;
          }
          return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
        } else if (typeof val === "number") {
          val = val & 255;
          if (typeof Uint8Array.prototype.indexOf === "function") {
            if (dir) {
              return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
            } else {
              return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
            }
          }
          return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
        }
        throw new TypeError("val must be string, number or Buffer");
      }
      function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
        let indexSize = 1;
        let arrLength = arr.length;
        let valLength = val.length;
        if (encoding !== void 0) {
          encoding = String(encoding).toLowerCase();
          if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
            if (arr.length < 2 || val.length < 2) {
              return -1;
            }
            indexSize = 2;
            arrLength /= 2;
            valLength /= 2;
            byteOffset /= 2;
          }
        }
        function read(buf, i3) {
          if (indexSize === 1) {
            return buf[i3];
          } else {
            return buf.readUInt16BE(i3 * indexSize);
          }
        }
        let i2;
        if (dir) {
          let foundIndex = -1;
          for (i2 = byteOffset; i2 < arrLength; i2++) {
            if (read(arr, i2) === read(val, foundIndex === -1 ? 0 : i2 - foundIndex)) {
              if (foundIndex === -1) foundIndex = i2;
              if (i2 - foundIndex + 1 === valLength) return foundIndex * indexSize;
            } else {
              if (foundIndex !== -1) i2 -= i2 - foundIndex;
              foundIndex = -1;
            }
          }
        } else {
          if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
          for (i2 = byteOffset; i2 >= 0; i2--) {
            let found = true;
            for (let j = 0; j < valLength; j++) {
              if (read(arr, i2 + j) !== read(val, j)) {
                found = false;
                break;
              }
            }
            if (found) return i2;
          }
        }
        return -1;
      }
      Buffer5.prototype.includes = function includes(val, byteOffset, encoding) {
        return this.indexOf(val, byteOffset, encoding) !== -1;
      };
      Buffer5.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
      };
      Buffer5.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
        return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
      };
      function hexWrite(buf, string2, offset2, length) {
        offset2 = Number(offset2) || 0;
        const remaining = buf.length - offset2;
        if (!length) {
          length = remaining;
        } else {
          length = Number(length);
          if (length > remaining) {
            length = remaining;
          }
        }
        const strLen = string2.length;
        if (length > strLen / 2) {
          length = strLen / 2;
        }
        let i2;
        for (i2 = 0; i2 < length; ++i2) {
          const parsed = parseInt(string2.substr(i2 * 2, 2), 16);
          if (numberIsNaN(parsed)) return i2;
          buf[offset2 + i2] = parsed;
        }
        return i2;
      }
      function utf8Write(buf, string2, offset2, length) {
        return blitBuffer(utf8ToBytes2(string2, buf.length - offset2), buf, offset2, length);
      }
      function asciiWrite(buf, string2, offset2, length) {
        return blitBuffer(asciiToBytes(string2), buf, offset2, length);
      }
      function base64Write(buf, string2, offset2, length) {
        return blitBuffer(base64ToBytes(string2), buf, offset2, length);
      }
      function ucs2Write(buf, string2, offset2, length) {
        return blitBuffer(utf16leToBytes(string2, buf.length - offset2), buf, offset2, length);
      }
      Buffer5.prototype.write = function write(string2, offset2, length, encoding) {
        if (offset2 === void 0) {
          encoding = "utf8";
          length = this.length;
          offset2 = 0;
        } else if (length === void 0 && typeof offset2 === "string") {
          encoding = offset2;
          length = this.length;
          offset2 = 0;
        } else if (isFinite(offset2)) {
          offset2 = offset2 >>> 0;
          if (isFinite(length)) {
            length = length >>> 0;
            if (encoding === void 0) encoding = "utf8";
          } else {
            encoding = length;
            length = void 0;
          }
        } else {
          throw new Error(
            "Buffer.write(string, encoding, offset[, length]) is no longer supported"
          );
        }
        const remaining = this.length - offset2;
        if (length === void 0 || length > remaining) length = remaining;
        if (string2.length > 0 && (length < 0 || offset2 < 0) || offset2 > this.length) {
          throw new RangeError("Attempt to write outside buffer bounds");
        }
        if (!encoding) encoding = "utf8";
        let loweredCase = false;
        for (; ; ) {
          switch (encoding) {
            case "hex":
              return hexWrite(this, string2, offset2, length);
            case "utf8":
            case "utf-8":
              return utf8Write(this, string2, offset2, length);
            case "ascii":
            case "latin1":
            case "binary":
              return asciiWrite(this, string2, offset2, length);
            case "base64":
              return base64Write(this, string2, offset2, length);
            case "ucs2":
            case "ucs-2":
            case "utf16le":
            case "utf-16le":
              return ucs2Write(this, string2, offset2, length);
            default:
              if (loweredCase) throw new TypeError("Unknown encoding: " + encoding);
              encoding = ("" + encoding).toLowerCase();
              loweredCase = true;
          }
        }
      };
      Buffer5.prototype.toJSON = function toJSON() {
        return {
          type: "Buffer",
          data: Array.prototype.slice.call(this._arr || this, 0)
        };
      };
      function base64Slice(buf, start, end) {
        if (start === 0 && end === buf.length) {
          return base64.fromByteArray(buf);
        } else {
          return base64.fromByteArray(buf.slice(start, end));
        }
      }
      function utf8Slice(buf, start, end) {
        end = Math.min(buf.length, end);
        const res = [];
        let i2 = start;
        while (i2 < end) {
          const firstByte = buf[i2];
          let codePoint = null;
          let bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
          if (i2 + bytesPerSequence <= end) {
            let secondByte, thirdByte, fourthByte, tempCodePoint;
            switch (bytesPerSequence) {
              case 1:
                if (firstByte < 128) {
                  codePoint = firstByte;
                }
                break;
              case 2:
                secondByte = buf[i2 + 1];
                if ((secondByte & 192) === 128) {
                  tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
                  if (tempCodePoint > 127) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 3:
                secondByte = buf[i2 + 1];
                thirdByte = buf[i2 + 2];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
                  if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
                    codePoint = tempCodePoint;
                  }
                }
                break;
              case 4:
                secondByte = buf[i2 + 1];
                thirdByte = buf[i2 + 2];
                fourthByte = buf[i2 + 3];
                if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
                  tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
                  if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
                    codePoint = tempCodePoint;
                  }
                }
            }
          }
          if (codePoint === null) {
            codePoint = 65533;
            bytesPerSequence = 1;
          } else if (codePoint > 65535) {
            codePoint -= 65536;
            res.push(codePoint >>> 10 & 1023 | 55296);
            codePoint = 56320 | codePoint & 1023;
          }
          res.push(codePoint);
          i2 += bytesPerSequence;
        }
        return decodeCodePointsArray(res);
      }
      var MAX_ARGUMENTS_LENGTH = 4096;
      function decodeCodePointsArray(codePoints) {
        const len = codePoints.length;
        if (len <= MAX_ARGUMENTS_LENGTH) {
          return String.fromCharCode.apply(String, codePoints);
        }
        let res = "";
        let i2 = 0;
        while (i2 < len) {
          res += String.fromCharCode.apply(
            String,
            codePoints.slice(i2, i2 += MAX_ARGUMENTS_LENGTH)
          );
        }
        return res;
      }
      function asciiSlice(buf, start, end) {
        let ret = "";
        end = Math.min(buf.length, end);
        for (let i2 = start; i2 < end; ++i2) {
          ret += String.fromCharCode(buf[i2] & 127);
        }
        return ret;
      }
      function latin1Slice(buf, start, end) {
        let ret = "";
        end = Math.min(buf.length, end);
        for (let i2 = start; i2 < end; ++i2) {
          ret += String.fromCharCode(buf[i2]);
        }
        return ret;
      }
      function hexSlice(buf, start, end) {
        const len = buf.length;
        if (!start || start < 0) start = 0;
        if (!end || end < 0 || end > len) end = len;
        let out = "";
        for (let i2 = start; i2 < end; ++i2) {
          out += hexSliceLookupTable[buf[i2]];
        }
        return out;
      }
      function utf16leSlice(buf, start, end) {
        const bytes = buf.slice(start, end);
        let res = "";
        for (let i2 = 0; i2 < bytes.length - 1; i2 += 2) {
          res += String.fromCharCode(bytes[i2] + bytes[i2 + 1] * 256);
        }
        return res;
      }
      Buffer5.prototype.slice = function slice(start, end) {
        const len = this.length;
        start = ~~start;
        end = end === void 0 ? len : ~~end;
        if (start < 0) {
          start += len;
          if (start < 0) start = 0;
        } else if (start > len) {
          start = len;
        }
        if (end < 0) {
          end += len;
          if (end < 0) end = 0;
        } else if (end > len) {
          end = len;
        }
        if (end < start) end = start;
        const newBuf = this.subarray(start, end);
        Object.setPrototypeOf(newBuf, Buffer5.prototype);
        return newBuf;
      };
      function checkOffset(offset2, ext, length) {
        if (offset2 % 1 !== 0 || offset2 < 0) throw new RangeError("offset is not uint");
        if (offset2 + ext > length) throw new RangeError("Trying to access beyond buffer length");
      }
      Buffer5.prototype.readUintLE = Buffer5.prototype.readUIntLE = function readUIntLE(offset2, byteLength2, noAssert) {
        offset2 = offset2 >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset2, byteLength2, this.length);
        let val = this[offset2];
        let mul = 1;
        let i2 = 0;
        while (++i2 < byteLength2 && (mul *= 256)) {
          val += this[offset2 + i2] * mul;
        }
        return val;
      };
      Buffer5.prototype.readUintBE = Buffer5.prototype.readUIntBE = function readUIntBE(offset2, byteLength2, noAssert) {
        offset2 = offset2 >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          checkOffset(offset2, byteLength2, this.length);
        }
        let val = this[offset2 + --byteLength2];
        let mul = 1;
        while (byteLength2 > 0 && (mul *= 256)) {
          val += this[offset2 + --byteLength2] * mul;
        }
        return val;
      };
      Buffer5.prototype.readUint8 = Buffer5.prototype.readUInt8 = function readUInt8(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 1, this.length);
        return this[offset2];
      };
      Buffer5.prototype.readUint16LE = Buffer5.prototype.readUInt16LE = function readUInt16LE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 2, this.length);
        return this[offset2] | this[offset2 + 1] << 8;
      };
      Buffer5.prototype.readUint16BE = Buffer5.prototype.readUInt16BE = function readUInt16BE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 2, this.length);
        return this[offset2] << 8 | this[offset2 + 1];
      };
      Buffer5.prototype.readUint32LE = Buffer5.prototype.readUInt32LE = function readUInt32LE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 4, this.length);
        return (this[offset2] | this[offset2 + 1] << 8 | this[offset2 + 2] << 16) + this[offset2 + 3] * 16777216;
      };
      Buffer5.prototype.readUint32BE = Buffer5.prototype.readUInt32BE = function readUInt32BE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 4, this.length);
        return this[offset2] * 16777216 + (this[offset2 + 1] << 16 | this[offset2 + 2] << 8 | this[offset2 + 3]);
      };
      Buffer5.prototype.readBigUInt64LE = defineBigIntMethod(function readBigUInt64LE(offset2) {
        offset2 = offset2 >>> 0;
        validateNumber(offset2, "offset");
        const first = this[offset2];
        const last = this[offset2 + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset2, this.length - 8);
        }
        const lo = first + this[++offset2] * 2 ** 8 + this[++offset2] * 2 ** 16 + this[++offset2] * 2 ** 24;
        const hi = this[++offset2] + this[++offset2] * 2 ** 8 + this[++offset2] * 2 ** 16 + last * 2 ** 24;
        return BigInt(lo) + (BigInt(hi) << BigInt(32));
      });
      Buffer5.prototype.readBigUInt64BE = defineBigIntMethod(function readBigUInt64BE(offset2) {
        offset2 = offset2 >>> 0;
        validateNumber(offset2, "offset");
        const first = this[offset2];
        const last = this[offset2 + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset2, this.length - 8);
        }
        const hi = first * 2 ** 24 + this[++offset2] * 2 ** 16 + this[++offset2] * 2 ** 8 + this[++offset2];
        const lo = this[++offset2] * 2 ** 24 + this[++offset2] * 2 ** 16 + this[++offset2] * 2 ** 8 + last;
        return (BigInt(hi) << BigInt(32)) + BigInt(lo);
      });
      Buffer5.prototype.readIntLE = function readIntLE(offset2, byteLength2, noAssert) {
        offset2 = offset2 >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset2, byteLength2, this.length);
        let val = this[offset2];
        let mul = 1;
        let i2 = 0;
        while (++i2 < byteLength2 && (mul *= 256)) {
          val += this[offset2 + i2] * mul;
        }
        mul *= 128;
        if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
        return val;
      };
      Buffer5.prototype.readIntBE = function readIntBE(offset2, byteLength2, noAssert) {
        offset2 = offset2 >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) checkOffset(offset2, byteLength2, this.length);
        let i2 = byteLength2;
        let mul = 1;
        let val = this[offset2 + --i2];
        while (i2 > 0 && (mul *= 256)) {
          val += this[offset2 + --i2] * mul;
        }
        mul *= 128;
        if (val >= mul) val -= Math.pow(2, 8 * byteLength2);
        return val;
      };
      Buffer5.prototype.readInt8 = function readInt8(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 1, this.length);
        if (!(this[offset2] & 128)) return this[offset2];
        return (255 - this[offset2] + 1) * -1;
      };
      Buffer5.prototype.readInt16LE = function readInt16LE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 2, this.length);
        const val = this[offset2] | this[offset2 + 1] << 8;
        return val & 32768 ? val | 4294901760 : val;
      };
      Buffer5.prototype.readInt16BE = function readInt16BE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 2, this.length);
        const val = this[offset2 + 1] | this[offset2] << 8;
        return val & 32768 ? val | 4294901760 : val;
      };
      Buffer5.prototype.readInt32LE = function readInt32LE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 4, this.length);
        return this[offset2] | this[offset2 + 1] << 8 | this[offset2 + 2] << 16 | this[offset2 + 3] << 24;
      };
      Buffer5.prototype.readInt32BE = function readInt32BE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 4, this.length);
        return this[offset2] << 24 | this[offset2 + 1] << 16 | this[offset2 + 2] << 8 | this[offset2 + 3];
      };
      Buffer5.prototype.readBigInt64LE = defineBigIntMethod(function readBigInt64LE(offset2) {
        offset2 = offset2 >>> 0;
        validateNumber(offset2, "offset");
        const first = this[offset2];
        const last = this[offset2 + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset2, this.length - 8);
        }
        const val = this[offset2 + 4] + this[offset2 + 5] * 2 ** 8 + this[offset2 + 6] * 2 ** 16 + (last << 24);
        return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset2] * 2 ** 8 + this[++offset2] * 2 ** 16 + this[++offset2] * 2 ** 24);
      });
      Buffer5.prototype.readBigInt64BE = defineBigIntMethod(function readBigInt64BE(offset2) {
        offset2 = offset2 >>> 0;
        validateNumber(offset2, "offset");
        const first = this[offset2];
        const last = this[offset2 + 7];
        if (first === void 0 || last === void 0) {
          boundsError(offset2, this.length - 8);
        }
        const val = (first << 24) + // Overflow
        this[++offset2] * 2 ** 16 + this[++offset2] * 2 ** 8 + this[++offset2];
        return (BigInt(val) << BigInt(32)) + BigInt(this[++offset2] * 2 ** 24 + this[++offset2] * 2 ** 16 + this[++offset2] * 2 ** 8 + last);
      });
      Buffer5.prototype.readFloatLE = function readFloatLE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 4, this.length);
        return ieee754.read(this, offset2, true, 23, 4);
      };
      Buffer5.prototype.readFloatBE = function readFloatBE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 4, this.length);
        return ieee754.read(this, offset2, false, 23, 4);
      };
      Buffer5.prototype.readDoubleLE = function readDoubleLE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 8, this.length);
        return ieee754.read(this, offset2, true, 52, 8);
      };
      Buffer5.prototype.readDoubleBE = function readDoubleBE(offset2, noAssert) {
        offset2 = offset2 >>> 0;
        if (!noAssert) checkOffset(offset2, 8, this.length);
        return ieee754.read(this, offset2, false, 52, 8);
      };
      function checkInt(buf, value, offset2, ext, max, min) {
        if (!Buffer5.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
        if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
        if (offset2 + ext > buf.length) throw new RangeError("Index out of range");
      }
      Buffer5.prototype.writeUintLE = Buffer5.prototype.writeUIntLE = function writeUIntLE(value, offset2, byteLength2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
          checkInt(this, value, offset2, byteLength2, maxBytes, 0);
        }
        let mul = 1;
        let i2 = 0;
        this[offset2] = value & 255;
        while (++i2 < byteLength2 && (mul *= 256)) {
          this[offset2 + i2] = value / mul & 255;
        }
        return offset2 + byteLength2;
      };
      Buffer5.prototype.writeUintBE = Buffer5.prototype.writeUIntBE = function writeUIntBE(value, offset2, byteLength2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        byteLength2 = byteLength2 >>> 0;
        if (!noAssert) {
          const maxBytes = Math.pow(2, 8 * byteLength2) - 1;
          checkInt(this, value, offset2, byteLength2, maxBytes, 0);
        }
        let i2 = byteLength2 - 1;
        let mul = 1;
        this[offset2 + i2] = value & 255;
        while (--i2 >= 0 && (mul *= 256)) {
          this[offset2 + i2] = value / mul & 255;
        }
        return offset2 + byteLength2;
      };
      Buffer5.prototype.writeUint8 = Buffer5.prototype.writeUInt8 = function writeUInt8(value, offset2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) checkInt(this, value, offset2, 1, 255, 0);
        this[offset2] = value & 255;
        return offset2 + 1;
      };
      Buffer5.prototype.writeUint16LE = Buffer5.prototype.writeUInt16LE = function writeUInt16LE(value, offset2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) checkInt(this, value, offset2, 2, 65535, 0);
        this[offset2] = value & 255;
        this[offset2 + 1] = value >>> 8;
        return offset2 + 2;
      };
      Buffer5.prototype.writeUint16BE = Buffer5.prototype.writeUInt16BE = function writeUInt16BE(value, offset2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) checkInt(this, value, offset2, 2, 65535, 0);
        this[offset2] = value >>> 8;
        this[offset2 + 1] = value & 255;
        return offset2 + 2;
      };
      Buffer5.prototype.writeUint32LE = Buffer5.prototype.writeUInt32LE = function writeUInt32LE(value, offset2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) checkInt(this, value, offset2, 4, 4294967295, 0);
        this[offset2 + 3] = value >>> 24;
        this[offset2 + 2] = value >>> 16;
        this[offset2 + 1] = value >>> 8;
        this[offset2] = value & 255;
        return offset2 + 4;
      };
      Buffer5.prototype.writeUint32BE = Buffer5.prototype.writeUInt32BE = function writeUInt32BE(value, offset2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) checkInt(this, value, offset2, 4, 4294967295, 0);
        this[offset2] = value >>> 24;
        this[offset2 + 1] = value >>> 16;
        this[offset2 + 2] = value >>> 8;
        this[offset2 + 3] = value & 255;
        return offset2 + 4;
      };
      function wrtBigUInt64LE(buf, value, offset2, min, max) {
        checkIntBI(value, min, max, buf, offset2, 7);
        let lo = Number(value & BigInt(4294967295));
        buf[offset2++] = lo;
        lo = lo >> 8;
        buf[offset2++] = lo;
        lo = lo >> 8;
        buf[offset2++] = lo;
        lo = lo >> 8;
        buf[offset2++] = lo;
        let hi = Number(value >> BigInt(32) & BigInt(4294967295));
        buf[offset2++] = hi;
        hi = hi >> 8;
        buf[offset2++] = hi;
        hi = hi >> 8;
        buf[offset2++] = hi;
        hi = hi >> 8;
        buf[offset2++] = hi;
        return offset2;
      }
      function wrtBigUInt64BE(buf, value, offset2, min, max) {
        checkIntBI(value, min, max, buf, offset2, 7);
        let lo = Number(value & BigInt(4294967295));
        buf[offset2 + 7] = lo;
        lo = lo >> 8;
        buf[offset2 + 6] = lo;
        lo = lo >> 8;
        buf[offset2 + 5] = lo;
        lo = lo >> 8;
        buf[offset2 + 4] = lo;
        let hi = Number(value >> BigInt(32) & BigInt(4294967295));
        buf[offset2 + 3] = hi;
        hi = hi >> 8;
        buf[offset2 + 2] = hi;
        hi = hi >> 8;
        buf[offset2 + 1] = hi;
        hi = hi >> 8;
        buf[offset2] = hi;
        return offset2 + 8;
      }
      Buffer5.prototype.writeBigUInt64LE = defineBigIntMethod(function writeBigUInt64LE(value, offset2 = 0) {
        return wrtBigUInt64LE(this, value, offset2, BigInt(0), BigInt("0xffffffffffffffff"));
      });
      Buffer5.prototype.writeBigUInt64BE = defineBigIntMethod(function writeBigUInt64BE(value, offset2 = 0) {
        return wrtBigUInt64BE(this, value, offset2, BigInt(0), BigInt("0xffffffffffffffff"));
      });
      Buffer5.prototype.writeIntLE = function writeIntLE(value, offset2, byteLength2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) {
          const limit = Math.pow(2, 8 * byteLength2 - 1);
          checkInt(this, value, offset2, byteLength2, limit - 1, -limit);
        }
        let i2 = 0;
        let mul = 1;
        let sub = 0;
        this[offset2] = value & 255;
        while (++i2 < byteLength2 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset2 + i2 - 1] !== 0) {
            sub = 1;
          }
          this[offset2 + i2] = (value / mul >> 0) - sub & 255;
        }
        return offset2 + byteLength2;
      };
      Buffer5.prototype.writeIntBE = function writeIntBE(value, offset2, byteLength2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) {
          const limit = Math.pow(2, 8 * byteLength2 - 1);
          checkInt(this, value, offset2, byteLength2, limit - 1, -limit);
        }
        let i2 = byteLength2 - 1;
        let mul = 1;
        let sub = 0;
        this[offset2 + i2] = value & 255;
        while (--i2 >= 0 && (mul *= 256)) {
          if (value < 0 && sub === 0 && this[offset2 + i2 + 1] !== 0) {
            sub = 1;
          }
          this[offset2 + i2] = (value / mul >> 0) - sub & 255;
        }
        return offset2 + byteLength2;
      };
      Buffer5.prototype.writeInt8 = function writeInt8(value, offset2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) checkInt(this, value, offset2, 1, 127, -128);
        if (value < 0) value = 255 + value + 1;
        this[offset2] = value & 255;
        return offset2 + 1;
      };
      Buffer5.prototype.writeInt16LE = function writeInt16LE(value, offset2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) checkInt(this, value, offset2, 2, 32767, -32768);
        this[offset2] = value & 255;
        this[offset2 + 1] = value >>> 8;
        return offset2 + 2;
      };
      Buffer5.prototype.writeInt16BE = function writeInt16BE(value, offset2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) checkInt(this, value, offset2, 2, 32767, -32768);
        this[offset2] = value >>> 8;
        this[offset2 + 1] = value & 255;
        return offset2 + 2;
      };
      Buffer5.prototype.writeInt32LE = function writeInt32LE(value, offset2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) checkInt(this, value, offset2, 4, 2147483647, -2147483648);
        this[offset2] = value & 255;
        this[offset2 + 1] = value >>> 8;
        this[offset2 + 2] = value >>> 16;
        this[offset2 + 3] = value >>> 24;
        return offset2 + 4;
      };
      Buffer5.prototype.writeInt32BE = function writeInt32BE(value, offset2, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) checkInt(this, value, offset2, 4, 2147483647, -2147483648);
        if (value < 0) value = 4294967295 + value + 1;
        this[offset2] = value >>> 24;
        this[offset2 + 1] = value >>> 16;
        this[offset2 + 2] = value >>> 8;
        this[offset2 + 3] = value & 255;
        return offset2 + 4;
      };
      Buffer5.prototype.writeBigInt64LE = defineBigIntMethod(function writeBigInt64LE(value, offset2 = 0) {
        return wrtBigUInt64LE(this, value, offset2, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
      });
      Buffer5.prototype.writeBigInt64BE = defineBigIntMethod(function writeBigInt64BE(value, offset2 = 0) {
        return wrtBigUInt64BE(this, value, offset2, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
      });
      function checkIEEE754(buf, value, offset2, ext, max, min) {
        if (offset2 + ext > buf.length) throw new RangeError("Index out of range");
        if (offset2 < 0) throw new RangeError("Index out of range");
      }
      function writeFloat(buf, value, offset2, littleEndian, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset2, 4, 34028234663852886e22, -34028234663852886e22);
        }
        ieee754.write(buf, value, offset2, littleEndian, 23, 4);
        return offset2 + 4;
      }
      Buffer5.prototype.writeFloatLE = function writeFloatLE(value, offset2, noAssert) {
        return writeFloat(this, value, offset2, true, noAssert);
      };
      Buffer5.prototype.writeFloatBE = function writeFloatBE(value, offset2, noAssert) {
        return writeFloat(this, value, offset2, false, noAssert);
      };
      function writeDouble(buf, value, offset2, littleEndian, noAssert) {
        value = +value;
        offset2 = offset2 >>> 0;
        if (!noAssert) {
          checkIEEE754(buf, value, offset2, 8, 17976931348623157e292, -17976931348623157e292);
        }
        ieee754.write(buf, value, offset2, littleEndian, 52, 8);
        return offset2 + 8;
      }
      Buffer5.prototype.writeDoubleLE = function writeDoubleLE(value, offset2, noAssert) {
        return writeDouble(this, value, offset2, true, noAssert);
      };
      Buffer5.prototype.writeDoubleBE = function writeDoubleBE(value, offset2, noAssert) {
        return writeDouble(this, value, offset2, false, noAssert);
      };
      Buffer5.prototype.copy = function copy(target, targetStart, start, end) {
        if (!Buffer5.isBuffer(target)) throw new TypeError("argument should be a Buffer");
        if (!start) start = 0;
        if (!end && end !== 0) end = this.length;
        if (targetStart >= target.length) targetStart = target.length;
        if (!targetStart) targetStart = 0;
        if (end > 0 && end < start) end = start;
        if (end === start) return 0;
        if (target.length === 0 || this.length === 0) return 0;
        if (targetStart < 0) {
          throw new RangeError("targetStart out of bounds");
        }
        if (start < 0 || start >= this.length) throw new RangeError("Index out of range");
        if (end < 0) throw new RangeError("sourceEnd out of bounds");
        if (end > this.length) end = this.length;
        if (target.length - targetStart < end - start) {
          end = target.length - targetStart + start;
        }
        const len = end - start;
        if (this === target && typeof Uint8Array.prototype.copyWithin === "function") {
          this.copyWithin(targetStart, start, end);
        } else {
          Uint8Array.prototype.set.call(
            target,
            this.subarray(start, end),
            targetStart
          );
        }
        return len;
      };
      Buffer5.prototype.fill = function fill(val, start, end, encoding) {
        if (typeof val === "string") {
          if (typeof start === "string") {
            encoding = start;
            start = 0;
            end = this.length;
          } else if (typeof end === "string") {
            encoding = end;
            end = this.length;
          }
          if (encoding !== void 0 && typeof encoding !== "string") {
            throw new TypeError("encoding must be a string");
          }
          if (typeof encoding === "string" && !Buffer5.isEncoding(encoding)) {
            throw new TypeError("Unknown encoding: " + encoding);
          }
          if (val.length === 1) {
            const code = val.charCodeAt(0);
            if (encoding === "utf8" && code < 128 || encoding === "latin1") {
              val = code;
            }
          }
        } else if (typeof val === "number") {
          val = val & 255;
        } else if (typeof val === "boolean") {
          val = Number(val);
        }
        if (start < 0 || this.length < start || this.length < end) {
          throw new RangeError("Out of range index");
        }
        if (end <= start) {
          return this;
        }
        start = start >>> 0;
        end = end === void 0 ? this.length : end >>> 0;
        if (!val) val = 0;
        let i2;
        if (typeof val === "number") {
          for (i2 = start; i2 < end; ++i2) {
            this[i2] = val;
          }
        } else {
          const bytes = Buffer5.isBuffer(val) ? val : Buffer5.from(val, encoding);
          const len = bytes.length;
          if (len === 0) {
            throw new TypeError('The value "' + val + '" is invalid for argument "value"');
          }
          for (i2 = 0; i2 < end - start; ++i2) {
            this[i2 + start] = bytes[i2 % len];
          }
        }
        return this;
      };
      var errors = {};
      function E(sym, getMessage, Base) {
        errors[sym] = class NodeError extends Base {
          constructor() {
            super();
            Object.defineProperty(this, "message", {
              value: getMessage.apply(this, arguments),
              writable: true,
              configurable: true
            });
            this.name = `${this.name} [${sym}]`;
            this.stack;
            delete this.name;
          }
          get code() {
            return sym;
          }
          set code(value) {
            Object.defineProperty(this, "code", {
              configurable: true,
              enumerable: true,
              value,
              writable: true
            });
          }
          toString() {
            return `${this.name} [${sym}]: ${this.message}`;
          }
        };
      }
      E(
        "ERR_BUFFER_OUT_OF_BOUNDS",
        function(name) {
          if (name) {
            return `${name} is outside of buffer bounds`;
          }
          return "Attempt to access memory outside buffer bounds";
        },
        RangeError
      );
      E(
        "ERR_INVALID_ARG_TYPE",
        function(name, actual) {
          return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
        },
        TypeError
      );
      E(
        "ERR_OUT_OF_RANGE",
        function(str, range, input) {
          let msg = `The value of "${str}" is out of range.`;
          let received = input;
          if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
            received = addNumericalSeparator(String(input));
          } else if (typeof input === "bigint") {
            received = String(input);
            if (input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32))) {
              received = addNumericalSeparator(received);
            }
            received += "n";
          }
          msg += ` It must be ${range}. Received ${received}`;
          return msg;
        },
        RangeError
      );
      function addNumericalSeparator(val) {
        let res = "";
        let i2 = val.length;
        const start = val[0] === "-" ? 1 : 0;
        for (; i2 >= start + 4; i2 -= 3) {
          res = `_${val.slice(i2 - 3, i2)}${res}`;
        }
        return `${val.slice(0, i2)}${res}`;
      }
      function checkBounds(buf, offset2, byteLength2) {
        validateNumber(offset2, "offset");
        if (buf[offset2] === void 0 || buf[offset2 + byteLength2] === void 0) {
          boundsError(offset2, buf.length - (byteLength2 + 1));
        }
      }
      function checkIntBI(value, min, max, buf, offset2, byteLength2) {
        if (value > max || value < min) {
          const n = typeof min === "bigint" ? "n" : "";
          let range;
          if (byteLength2 > 3) {
            if (min === 0 || min === BigInt(0)) {
              range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
            } else {
              range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
            }
          } else {
            range = `>= ${min}${n} and <= ${max}${n}`;
          }
          throw new errors.ERR_OUT_OF_RANGE("value", range, value);
        }
        checkBounds(buf, offset2, byteLength2);
      }
      function validateNumber(value, name) {
        if (typeof value !== "number") {
          throw new errors.ERR_INVALID_ARG_TYPE(name, "number", value);
        }
      }
      function boundsError(value, length, type2) {
        if (Math.floor(value) !== value) {
          validateNumber(value, type2);
          throw new errors.ERR_OUT_OF_RANGE(type2 || "offset", "an integer", value);
        }
        if (length < 0) {
          throw new errors.ERR_BUFFER_OUT_OF_BOUNDS();
        }
        throw new errors.ERR_OUT_OF_RANGE(
          type2 || "offset",
          `>= ${type2 ? 1 : 0} and <= ${length}`,
          value
        );
      }
      var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
      function base64clean(str) {
        str = str.split("=")[0];
        str = str.trim().replace(INVALID_BASE64_RE, "");
        if (str.length < 2) return "";
        while (str.length % 4 !== 0) {
          str = str + "=";
        }
        return str;
      }
      function utf8ToBytes2(string2, units) {
        units = units || Infinity;
        let codePoint;
        const length = string2.length;
        let leadSurrogate = null;
        const bytes = [];
        for (let i2 = 0; i2 < length; ++i2) {
          codePoint = string2.charCodeAt(i2);
          if (codePoint > 55295 && codePoint < 57344) {
            if (!leadSurrogate) {
              if (codePoint > 56319) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                continue;
              } else if (i2 + 1 === length) {
                if ((units -= 3) > -1) bytes.push(239, 191, 189);
                continue;
              }
              leadSurrogate = codePoint;
              continue;
            }
            if (codePoint < 56320) {
              if ((units -= 3) > -1) bytes.push(239, 191, 189);
              leadSurrogate = codePoint;
              continue;
            }
            codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
          } else if (leadSurrogate) {
            if ((units -= 3) > -1) bytes.push(239, 191, 189);
          }
          leadSurrogate = null;
          if (codePoint < 128) {
            if ((units -= 1) < 0) break;
            bytes.push(codePoint);
          } else if (codePoint < 2048) {
            if ((units -= 2) < 0) break;
            bytes.push(
              codePoint >> 6 | 192,
              codePoint & 63 | 128
            );
          } else if (codePoint < 65536) {
            if ((units -= 3) < 0) break;
            bytes.push(
              codePoint >> 12 | 224,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else if (codePoint < 1114112) {
            if ((units -= 4) < 0) break;
            bytes.push(
              codePoint >> 18 | 240,
              codePoint >> 12 & 63 | 128,
              codePoint >> 6 & 63 | 128,
              codePoint & 63 | 128
            );
          } else {
            throw new Error("Invalid code point");
          }
        }
        return bytes;
      }
      function asciiToBytes(str) {
        const byteArray = [];
        for (let i2 = 0; i2 < str.length; ++i2) {
          byteArray.push(str.charCodeAt(i2) & 255);
        }
        return byteArray;
      }
      function utf16leToBytes(str, units) {
        let c, hi, lo;
        const byteArray = [];
        for (let i2 = 0; i2 < str.length; ++i2) {
          if ((units -= 2) < 0) break;
          c = str.charCodeAt(i2);
          hi = c >> 8;
          lo = c % 256;
          byteArray.push(lo);
          byteArray.push(hi);
        }
        return byteArray;
      }
      function base64ToBytes(str) {
        return base64.toByteArray(base64clean(str));
      }
      function blitBuffer(src, dst, offset2, length) {
        let i2;
        for (i2 = 0; i2 < length; ++i2) {
          if (i2 + offset2 >= dst.length || i2 >= src.length) break;
          dst[i2 + offset2] = src[i2];
        }
        return i2;
      }
      function isInstance(obj, type2) {
        return obj instanceof type2 || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type2.name;
      }
      function numberIsNaN(obj) {
        return obj !== obj;
      }
      var hexSliceLookupTable = (function() {
        const alphabet = "0123456789abcdef";
        const table = new Array(256);
        for (let i2 = 0; i2 < 16; ++i2) {
          const i16 = i2 * 16;
          for (let j = 0; j < 16; ++j) {
            table[i16 + j] = alphabet[i2] + alphabet[j];
          }
        }
        return table;
      })();
      function defineBigIntMethod(fn) {
        return typeof BigInt === "undefined" ? BufferBigIntNotDefined : fn;
      }
      function BufferBigIntNotDefined() {
        throw new Error("BigInt not supported");
      }
    }
  });

  // examples/chat-portal/public/src/buffer-shim.js
  var import_buffer;
  var init_buffer_shim = __esm({
    "examples/chat-portal/public/src/buffer-shim.js"() {
      "use strict";
      import_buffer = __toESM(require_buffer(), 1);
      globalThis.Buffer = globalThis.Buffer || import_buffer.Buffer;
    }
  });

  // (disabled):node_modules/buffer/index.js
  var require_buffer2 = __commonJS({
    "(disabled):node_modules/buffer/index.js"() {
      init_buffer_shim();
    }
  });

  // node_modules/bn.js/lib/bn.js
  var require_bn = __commonJS({
    "node_modules/bn.js/lib/bn.js"(exports, module) {
      init_buffer_shim();
      (function(module2, exports2) {
        "use strict";
        function assert3(val, msg) {
          if (!val) throw new Error(msg || "Assertion failed");
        }
        function inherits(ctor, superCtor) {
          ctor.super_ = superCtor;
          var TempCtor = function() {
          };
          TempCtor.prototype = superCtor.prototype;
          ctor.prototype = new TempCtor();
          ctor.prototype.constructor = ctor;
        }
        function BN2(number2, base, endian) {
          if (BN2.isBN(number2)) {
            return number2;
          }
          this.negative = 0;
          this.words = null;
          this.length = 0;
          this.red = null;
          if (number2 !== null) {
            if (base === "le" || base === "be") {
              endian = base;
              base = 10;
            }
            this._init(number2 || 0, base || 10, endian || "be");
          }
        }
        if (typeof module2 === "object") {
          module2.exports = BN2;
        } else {
          exports2.BN = BN2;
        }
        BN2.BN = BN2;
        BN2.wordSize = 26;
        var Buffer5;
        try {
          if (typeof window !== "undefined" && typeof window.Buffer !== "undefined") {
            Buffer5 = window.Buffer;
          } else {
            Buffer5 = require_buffer2().Buffer;
          }
        } catch (e) {
        }
        BN2.isBN = function isBN(num) {
          if (num instanceof BN2) {
            return true;
          }
          return num !== null && typeof num === "object" && num.constructor.wordSize === BN2.wordSize && Array.isArray(num.words);
        };
        BN2.max = function max(left, right) {
          if (left.cmp(right) > 0) return left;
          return right;
        };
        BN2.min = function min(left, right) {
          if (left.cmp(right) < 0) return left;
          return right;
        };
        BN2.prototype._init = function init(number2, base, endian) {
          if (typeof number2 === "number") {
            return this._initNumber(number2, base, endian);
          }
          if (typeof number2 === "object") {
            return this._initArray(number2, base, endian);
          }
          if (base === "hex") {
            base = 16;
          }
          assert3(base === (base | 0) && base >= 2 && base <= 36);
          number2 = number2.toString().replace(/\s+/g, "");
          var start = 0;
          if (number2[0] === "-") {
            start++;
            this.negative = 1;
          }
          if (start < number2.length) {
            if (base === 16) {
              this._parseHex(number2, start, endian);
            } else {
              this._parseBase(number2, base, start);
              if (endian === "le") {
                this._initArray(this.toArray(), base, endian);
              }
            }
          }
        };
        BN2.prototype._initNumber = function _initNumber(number2, base, endian) {
          if (number2 < 0) {
            this.negative = 1;
            number2 = -number2;
          }
          if (number2 < 67108864) {
            this.words = [number2 & 67108863];
            this.length = 1;
          } else if (number2 < 4503599627370496) {
            this.words = [
              number2 & 67108863,
              number2 / 67108864 & 67108863
            ];
            this.length = 2;
          } else {
            assert3(number2 < 9007199254740992);
            this.words = [
              number2 & 67108863,
              number2 / 67108864 & 67108863,
              1
            ];
            this.length = 3;
          }
          if (endian !== "le") return;
          this._initArray(this.toArray(), base, endian);
        };
        BN2.prototype._initArray = function _initArray(number2, base, endian) {
          assert3(typeof number2.length === "number");
          if (number2.length <= 0) {
            this.words = [0];
            this.length = 1;
            return this;
          }
          this.length = Math.ceil(number2.length / 3);
          this.words = new Array(this.length);
          for (var i2 = 0; i2 < this.length; i2++) {
            this.words[i2] = 0;
          }
          var j, w;
          var off = 0;
          if (endian === "be") {
            for (i2 = number2.length - 1, j = 0; i2 >= 0; i2 -= 3) {
              w = number2[i2] | number2[i2 - 1] << 8 | number2[i2 - 2] << 16;
              this.words[j] |= w << off & 67108863;
              this.words[j + 1] = w >>> 26 - off & 67108863;
              off += 24;
              if (off >= 26) {
                off -= 26;
                j++;
              }
            }
          } else if (endian === "le") {
            for (i2 = 0, j = 0; i2 < number2.length; i2 += 3) {
              w = number2[i2] | number2[i2 + 1] << 8 | number2[i2 + 2] << 16;
              this.words[j] |= w << off & 67108863;
              this.words[j + 1] = w >>> 26 - off & 67108863;
              off += 24;
              if (off >= 26) {
                off -= 26;
                j++;
              }
            }
          }
          return this._strip();
        };
        function parseHex4Bits(string2, index) {
          var c = string2.charCodeAt(index);
          if (c >= 48 && c <= 57) {
            return c - 48;
          } else if (c >= 65 && c <= 70) {
            return c - 55;
          } else if (c >= 97 && c <= 102) {
            return c - 87;
          } else {
            assert3(false, "Invalid character in " + string2);
          }
        }
        function parseHexByte(string2, lowerBound, index) {
          var r = parseHex4Bits(string2, index);
          if (index - 1 >= lowerBound) {
            r |= parseHex4Bits(string2, index - 1) << 4;
          }
          return r;
        }
        BN2.prototype._parseHex = function _parseHex(number2, start, endian) {
          this.length = Math.ceil((number2.length - start) / 6);
          this.words = new Array(this.length);
          for (var i2 = 0; i2 < this.length; i2++) {
            this.words[i2] = 0;
          }
          var off = 0;
          var j = 0;
          var w;
          if (endian === "be") {
            for (i2 = number2.length - 1; i2 >= start; i2 -= 2) {
              w = parseHexByte(number2, start, i2) << off;
              this.words[j] |= w & 67108863;
              if (off >= 18) {
                off -= 18;
                j += 1;
                this.words[j] |= w >>> 26;
              } else {
                off += 8;
              }
            }
          } else {
            var parseLength = number2.length - start;
            for (i2 = parseLength % 2 === 0 ? start + 1 : start; i2 < number2.length; i2 += 2) {
              w = parseHexByte(number2, start, i2) << off;
              this.words[j] |= w & 67108863;
              if (off >= 18) {
                off -= 18;
                j += 1;
                this.words[j] |= w >>> 26;
              } else {
                off += 8;
              }
            }
          }
          this._strip();
        };
        function parseBase(str, start, end, mul) {
          var r = 0;
          var b = 0;
          var len = Math.min(str.length, end);
          for (var i2 = start; i2 < len; i2++) {
            var c = str.charCodeAt(i2) - 48;
            r *= mul;
            if (c >= 49) {
              b = c - 49 + 10;
            } else if (c >= 17) {
              b = c - 17 + 10;
            } else {
              b = c;
            }
            assert3(c >= 0 && b < mul, "Invalid character");
            r += b;
          }
          return r;
        }
        BN2.prototype._parseBase = function _parseBase(number2, base, start) {
          this.words = [0];
          this.length = 1;
          for (var limbLen = 0, limbPow = 1; limbPow <= 67108863; limbPow *= base) {
            limbLen++;
          }
          limbLen--;
          limbPow = limbPow / base | 0;
          var total = number2.length - start;
          var mod2 = total % limbLen;
          var end = Math.min(total, total - mod2) + start;
          var word = 0;
          for (var i2 = start; i2 < end; i2 += limbLen) {
            word = parseBase(number2, i2, i2 + limbLen, base);
            this.imuln(limbPow);
            if (this.words[0] + word < 67108864) {
              this.words[0] += word;
            } else {
              this._iaddn(word);
            }
          }
          if (mod2 !== 0) {
            var pow = 1;
            word = parseBase(number2, i2, number2.length, base);
            for (i2 = 0; i2 < mod2; i2++) {
              pow *= base;
            }
            this.imuln(pow);
            if (this.words[0] + word < 67108864) {
              this.words[0] += word;
            } else {
              this._iaddn(word);
            }
          }
          this._strip();
        };
        BN2.prototype.copy = function copy(dest) {
          dest.words = new Array(this.length);
          for (var i2 = 0; i2 < this.length; i2++) {
            dest.words[i2] = this.words[i2];
          }
          dest.length = this.length;
          dest.negative = this.negative;
          dest.red = this.red;
        };
        function move(dest, src) {
          dest.words = src.words;
          dest.length = src.length;
          dest.negative = src.negative;
          dest.red = src.red;
        }
        BN2.prototype._move = function _move(dest) {
          move(dest, this);
        };
        BN2.prototype.clone = function clone2() {
          var r = new BN2(null);
          this.copy(r);
          return r;
        };
        BN2.prototype._expand = function _expand(size) {
          while (this.length < size) {
            this.words[this.length++] = 0;
          }
          return this;
        };
        BN2.prototype._strip = function strip() {
          while (this.length > 1 && this.words[this.length - 1] === 0) {
            this.length--;
          }
          return this._normSign();
        };
        BN2.prototype._normSign = function _normSign() {
          if (this.length === 1 && this.words[0] === 0) {
            this.negative = 0;
          }
          return this;
        };
        if (typeof Symbol !== "undefined" && typeof Symbol.for === "function") {
          try {
            BN2.prototype[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = inspect;
          } catch (e) {
            BN2.prototype.inspect = inspect;
          }
        } else {
          BN2.prototype.inspect = inspect;
        }
        function inspect() {
          return (this.red ? "<BN-R: " : "<BN: ") + this.toString(16) + ">";
        }
        var zeros = [
          "",
          "0",
          "00",
          "000",
          "0000",
          "00000",
          "000000",
          "0000000",
          "00000000",
          "000000000",
          "0000000000",
          "00000000000",
          "000000000000",
          "0000000000000",
          "00000000000000",
          "000000000000000",
          "0000000000000000",
          "00000000000000000",
          "000000000000000000",
          "0000000000000000000",
          "00000000000000000000",
          "000000000000000000000",
          "0000000000000000000000",
          "00000000000000000000000",
          "000000000000000000000000",
          "0000000000000000000000000"
        ];
        var groupSizes = [
          0,
          0,
          25,
          16,
          12,
          11,
          10,
          9,
          8,
          8,
          7,
          7,
          7,
          7,
          6,
          6,
          6,
          6,
          6,
          6,
          6,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5,
          5
        ];
        var groupBases = [
          0,
          0,
          33554432,
          43046721,
          16777216,
          48828125,
          60466176,
          40353607,
          16777216,
          43046721,
          1e7,
          19487171,
          35831808,
          62748517,
          7529536,
          11390625,
          16777216,
          24137569,
          34012224,
          47045881,
          64e6,
          4084101,
          5153632,
          6436343,
          7962624,
          9765625,
          11881376,
          14348907,
          17210368,
          20511149,
          243e5,
          28629151,
          33554432,
          39135393,
          45435424,
          52521875,
          60466176
        ];
        BN2.prototype.toString = function toString(base, padding) {
          base = base || 10;
          padding = padding | 0 || 1;
          var out;
          if (base === 16 || base === "hex") {
            out = "";
            var off = 0;
            var carry = 0;
            for (var i2 = 0; i2 < this.length; i2++) {
              var w = this.words[i2];
              var word = ((w << off | carry) & 16777215).toString(16);
              carry = w >>> 24 - off & 16777215;
              off += 2;
              if (off >= 26) {
                off -= 26;
                i2--;
              }
              if (carry !== 0 || i2 !== this.length - 1) {
                out = zeros[6 - word.length] + word + out;
              } else {
                out = word + out;
              }
            }
            if (carry !== 0) {
              out = carry.toString(16) + out;
            }
            while (out.length % padding !== 0) {
              out = "0" + out;
            }
            if (this.negative !== 0) {
              out = "-" + out;
            }
            return out;
          }
          if (base === (base | 0) && base >= 2 && base <= 36) {
            var groupSize = groupSizes[base];
            var groupBase = groupBases[base];
            out = "";
            var c = this.clone();
            c.negative = 0;
            while (!c.isZero()) {
              var r = c.modrn(groupBase).toString(base);
              c = c.idivn(groupBase);
              if (!c.isZero()) {
                out = zeros[groupSize - r.length] + r + out;
              } else {
                out = r + out;
              }
            }
            if (this.isZero()) {
              out = "0" + out;
            }
            while (out.length % padding !== 0) {
              out = "0" + out;
            }
            if (this.negative !== 0) {
              out = "-" + out;
            }
            return out;
          }
          assert3(false, "Base should be between 2 and 36");
        };
        BN2.prototype.toNumber = function toNumber() {
          var ret = this.words[0];
          if (this.length === 2) {
            ret += this.words[1] * 67108864;
          } else if (this.length === 3 && this.words[2] === 1) {
            ret += 4503599627370496 + this.words[1] * 67108864;
          } else if (this.length > 2) {
            assert3(false, "Number can only safely store up to 53 bits");
          }
          return this.negative !== 0 ? -ret : ret;
        };
        BN2.prototype.toJSON = function toJSON() {
          return this.toString(16, 2);
        };
        if (Buffer5) {
          BN2.prototype.toBuffer = function toBuffer2(endian, length) {
            return this.toArrayLike(Buffer5, endian, length);
          };
        }
        BN2.prototype.toArray = function toArray(endian, length) {
          return this.toArrayLike(Array, endian, length);
        };
        var allocate = function allocate2(ArrayType, size) {
          if (ArrayType.allocUnsafe) {
            return ArrayType.allocUnsafe(size);
          }
          return new ArrayType(size);
        };
        BN2.prototype.toArrayLike = function toArrayLike(ArrayType, endian, length) {
          this._strip();
          var byteLength = this.byteLength();
          var reqLength = length || Math.max(1, byteLength);
          assert3(byteLength <= reqLength, "byte array longer than desired length");
          assert3(reqLength > 0, "Requested array length <= 0");
          var res = allocate(ArrayType, reqLength);
          var postfix = endian === "le" ? "LE" : "BE";
          this["_toArrayLike" + postfix](res, byteLength);
          return res;
        };
        BN2.prototype._toArrayLikeLE = function _toArrayLikeLE(res, byteLength) {
          var position = 0;
          var carry = 0;
          for (var i2 = 0, shift = 0; i2 < this.length; i2++) {
            var word = this.words[i2] << shift | carry;
            res[position++] = word & 255;
            if (position < res.length) {
              res[position++] = word >> 8 & 255;
            }
            if (position < res.length) {
              res[position++] = word >> 16 & 255;
            }
            if (shift === 6) {
              if (position < res.length) {
                res[position++] = word >> 24 & 255;
              }
              carry = 0;
              shift = 0;
            } else {
              carry = word >>> 24;
              shift += 2;
            }
          }
          if (position < res.length) {
            res[position++] = carry;
            while (position < res.length) {
              res[position++] = 0;
            }
          }
        };
        BN2.prototype._toArrayLikeBE = function _toArrayLikeBE(res, byteLength) {
          var position = res.length - 1;
          var carry = 0;
          for (var i2 = 0, shift = 0; i2 < this.length; i2++) {
            var word = this.words[i2] << shift | carry;
            res[position--] = word & 255;
            if (position >= 0) {
              res[position--] = word >> 8 & 255;
            }
            if (position >= 0) {
              res[position--] = word >> 16 & 255;
            }
            if (shift === 6) {
              if (position >= 0) {
                res[position--] = word >> 24 & 255;
              }
              carry = 0;
              shift = 0;
            } else {
              carry = word >>> 24;
              shift += 2;
            }
          }
          if (position >= 0) {
            res[position--] = carry;
            while (position >= 0) {
              res[position--] = 0;
            }
          }
        };
        if (Math.clz32) {
          BN2.prototype._countBits = function _countBits(w) {
            return 32 - Math.clz32(w);
          };
        } else {
          BN2.prototype._countBits = function _countBits(w) {
            var t = w;
            var r = 0;
            if (t >= 4096) {
              r += 13;
              t >>>= 13;
            }
            if (t >= 64) {
              r += 7;
              t >>>= 7;
            }
            if (t >= 8) {
              r += 4;
              t >>>= 4;
            }
            if (t >= 2) {
              r += 2;
              t >>>= 2;
            }
            return r + t;
          };
        }
        BN2.prototype._zeroBits = function _zeroBits(w) {
          if (w === 0) return 26;
          var t = w;
          var r = 0;
          if ((t & 8191) === 0) {
            r += 13;
            t >>>= 13;
          }
          if ((t & 127) === 0) {
            r += 7;
            t >>>= 7;
          }
          if ((t & 15) === 0) {
            r += 4;
            t >>>= 4;
          }
          if ((t & 3) === 0) {
            r += 2;
            t >>>= 2;
          }
          if ((t & 1) === 0) {
            r++;
          }
          return r;
        };
        BN2.prototype.bitLength = function bitLength() {
          var w = this.words[this.length - 1];
          var hi = this._countBits(w);
          return (this.length - 1) * 26 + hi;
        };
        function toBitArray(num) {
          var w = new Array(num.bitLength());
          for (var bit = 0; bit < w.length; bit++) {
            var off = bit / 26 | 0;
            var wbit = bit % 26;
            w[bit] = num.words[off] >>> wbit & 1;
          }
          return w;
        }
        BN2.prototype.zeroBits = function zeroBits() {
          if (this.isZero()) return 0;
          var r = 0;
          for (var i2 = 0; i2 < this.length; i2++) {
            var b = this._zeroBits(this.words[i2]);
            r += b;
            if (b !== 26) break;
          }
          return r;
        };
        BN2.prototype.byteLength = function byteLength() {
          return Math.ceil(this.bitLength() / 8);
        };
        BN2.prototype.toTwos = function toTwos(width) {
          if (this.negative !== 0) {
            return this.abs().inotn(width).iaddn(1);
          }
          return this.clone();
        };
        BN2.prototype.fromTwos = function fromTwos(width) {
          if (this.testn(width - 1)) {
            return this.notn(width).iaddn(1).ineg();
          }
          return this.clone();
        };
        BN2.prototype.isNeg = function isNeg() {
          return this.negative !== 0;
        };
        BN2.prototype.neg = function neg() {
          return this.clone().ineg();
        };
        BN2.prototype.ineg = function ineg() {
          if (!this.isZero()) {
            this.negative ^= 1;
          }
          return this;
        };
        BN2.prototype.iuor = function iuor(num) {
          while (this.length < num.length) {
            this.words[this.length++] = 0;
          }
          for (var i2 = 0; i2 < num.length; i2++) {
            this.words[i2] = this.words[i2] | num.words[i2];
          }
          return this._strip();
        };
        BN2.prototype.ior = function ior(num) {
          assert3((this.negative | num.negative) === 0);
          return this.iuor(num);
        };
        BN2.prototype.or = function or(num) {
          if (this.length > num.length) return this.clone().ior(num);
          return num.clone().ior(this);
        };
        BN2.prototype.uor = function uor(num) {
          if (this.length > num.length) return this.clone().iuor(num);
          return num.clone().iuor(this);
        };
        BN2.prototype.iuand = function iuand(num) {
          var b;
          if (this.length > num.length) {
            b = num;
          } else {
            b = this;
          }
          for (var i2 = 0; i2 < b.length; i2++) {
            this.words[i2] = this.words[i2] & num.words[i2];
          }
          this.length = b.length;
          return this._strip();
        };
        BN2.prototype.iand = function iand(num) {
          assert3((this.negative | num.negative) === 0);
          return this.iuand(num);
        };
        BN2.prototype.and = function and(num) {
          if (this.length > num.length) return this.clone().iand(num);
          return num.clone().iand(this);
        };
        BN2.prototype.uand = function uand(num) {
          if (this.length > num.length) return this.clone().iuand(num);
          return num.clone().iuand(this);
        };
        BN2.prototype.iuxor = function iuxor(num) {
          var a;
          var b;
          if (this.length > num.length) {
            a = this;
            b = num;
          } else {
            a = num;
            b = this;
          }
          for (var i2 = 0; i2 < b.length; i2++) {
            this.words[i2] = a.words[i2] ^ b.words[i2];
          }
          if (this !== a) {
            for (; i2 < a.length; i2++) {
              this.words[i2] = a.words[i2];
            }
          }
          this.length = a.length;
          return this._strip();
        };
        BN2.prototype.ixor = function ixor(num) {
          assert3((this.negative | num.negative) === 0);
          return this.iuxor(num);
        };
        BN2.prototype.xor = function xor(num) {
          if (this.length > num.length) return this.clone().ixor(num);
          return num.clone().ixor(this);
        };
        BN2.prototype.uxor = function uxor(num) {
          if (this.length > num.length) return this.clone().iuxor(num);
          return num.clone().iuxor(this);
        };
        BN2.prototype.inotn = function inotn(width) {
          assert3(typeof width === "number" && width >= 0);
          var bytesNeeded = Math.ceil(width / 26) | 0;
          var bitsLeft = width % 26;
          this._expand(bytesNeeded);
          if (bitsLeft > 0) {
            bytesNeeded--;
          }
          for (var i2 = 0; i2 < bytesNeeded; i2++) {
            this.words[i2] = ~this.words[i2] & 67108863;
          }
          if (bitsLeft > 0) {
            this.words[i2] = ~this.words[i2] & 67108863 >> 26 - bitsLeft;
            i2++;
          }
          for (; i2 < this.length; i2++) {
            this.words[i2] = 0;
          }
          return this._strip();
        };
        BN2.prototype.notn = function notn(width) {
          return this.clone().inotn(width);
        };
        BN2.prototype.setn = function setn(bit, val) {
          assert3(typeof bit === "number" && bit >= 0);
          var off = bit / 26 | 0;
          var wbit = bit % 26;
          this._expand(off + 1);
          if (val) {
            this.words[off] = this.words[off] | 1 << wbit;
          } else {
            this.words[off] = this.words[off] & ~(1 << wbit);
          }
          return this._strip();
        };
        BN2.prototype.iadd = function iadd(num) {
          var r;
          if (this.negative !== 0 && num.negative === 0) {
            this.negative = 0;
            r = this.isub(num);
            this.negative ^= 1;
            return this._normSign();
          } else if (this.negative === 0 && num.negative !== 0) {
            num.negative = 0;
            r = this.isub(num);
            num.negative = 1;
            return r._normSign();
          }
          var a, b;
          if (this.length > num.length) {
            a = this;
            b = num;
          } else {
            a = num;
            b = this;
          }
          var carry = 0;
          for (var i2 = 0; i2 < b.length; i2++) {
            r = (a.words[i2] | 0) + (b.words[i2] | 0) + carry;
            this.words[i2] = r & 67108863;
            carry = r >>> 26;
          }
          for (; carry !== 0 && i2 < a.length; i2++) {
            r = (a.words[i2] | 0) + carry;
            this.words[i2] = r & 67108863;
            carry = r >>> 26;
          }
          this.length = a.length;
          if (carry !== 0) {
            this.words[this.length] = carry;
            this.length++;
          } else if (a !== this) {
            for (; i2 < a.length; i2++) {
              this.words[i2] = a.words[i2];
            }
          }
          return this;
        };
        BN2.prototype.add = function add2(num) {
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
        BN2.prototype.isub = function isub(num) {
          if (num.negative !== 0) {
            num.negative = 0;
            var r = this.iadd(num);
            num.negative = 1;
            return r._normSign();
          } else if (this.negative !== 0) {
            this.negative = 0;
            this.iadd(num);
            this.negative = 1;
            return this._normSign();
          }
          var cmp = this.cmp(num);
          if (cmp === 0) {
            this.negative = 0;
            this.length = 1;
            this.words[0] = 0;
            return this;
          }
          var a, b;
          if (cmp > 0) {
            a = this;
            b = num;
          } else {
            a = num;
            b = this;
          }
          var carry = 0;
          for (var i2 = 0; i2 < b.length; i2++) {
            r = (a.words[i2] | 0) - (b.words[i2] | 0) + carry;
            carry = r >> 26;
            this.words[i2] = r & 67108863;
          }
          for (; carry !== 0 && i2 < a.length; i2++) {
            r = (a.words[i2] | 0) + carry;
            carry = r >> 26;
            this.words[i2] = r & 67108863;
          }
          if (carry === 0 && i2 < a.length && a !== this) {
            for (; i2 < a.length; i2++) {
              this.words[i2] = a.words[i2];
            }
          }
          this.length = Math.max(this.length, i2);
          if (a !== this) {
            this.negative = 1;
          }
          return this._strip();
        };
        BN2.prototype.sub = function sub(num) {
          return this.clone().isub(num);
        };
        function smallMulTo(self, num, out) {
          out.negative = num.negative ^ self.negative;
          var len = self.length + num.length | 0;
          out.length = len;
          len = len - 1 | 0;
          var a = self.words[0] | 0;
          var b = num.words[0] | 0;
          var r = a * b;
          var lo = r & 67108863;
          var carry = r / 67108864 | 0;
          out.words[0] = lo;
          for (var k = 1; k < len; k++) {
            var ncarry = carry >>> 26;
            var rword = carry & 67108863;
            var maxJ = Math.min(k, num.length - 1);
            for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
              var i2 = k - j | 0;
              a = self.words[i2] | 0;
              b = num.words[j] | 0;
              r = a * b + rword;
              ncarry += r / 67108864 | 0;
              rword = r & 67108863;
            }
            out.words[k] = rword | 0;
            carry = ncarry | 0;
          }
          if (carry !== 0) {
            out.words[k] = carry | 0;
          } else {
            out.length--;
          }
          return out._strip();
        }
        var comb10MulTo = function comb10MulTo2(self, num, out) {
          var a = self.words;
          var b = num.words;
          var o = out.words;
          var c = 0;
          var lo;
          var mid;
          var hi;
          var a0 = a[0] | 0;
          var al0 = a0 & 8191;
          var ah0 = a0 >>> 13;
          var a1 = a[1] | 0;
          var al1 = a1 & 8191;
          var ah1 = a1 >>> 13;
          var a2 = a[2] | 0;
          var al2 = a2 & 8191;
          var ah2 = a2 >>> 13;
          var a3 = a[3] | 0;
          var al3 = a3 & 8191;
          var ah3 = a3 >>> 13;
          var a4 = a[4] | 0;
          var al4 = a4 & 8191;
          var ah4 = a4 >>> 13;
          var a5 = a[5] | 0;
          var al5 = a5 & 8191;
          var ah5 = a5 >>> 13;
          var a6 = a[6] | 0;
          var al6 = a6 & 8191;
          var ah6 = a6 >>> 13;
          var a7 = a[7] | 0;
          var al7 = a7 & 8191;
          var ah7 = a7 >>> 13;
          var a8 = a[8] | 0;
          var al8 = a8 & 8191;
          var ah8 = a8 >>> 13;
          var a9 = a[9] | 0;
          var al9 = a9 & 8191;
          var ah9 = a9 >>> 13;
          var b0 = b[0] | 0;
          var bl0 = b0 & 8191;
          var bh0 = b0 >>> 13;
          var b1 = b[1] | 0;
          var bl1 = b1 & 8191;
          var bh1 = b1 >>> 13;
          var b2 = b[2] | 0;
          var bl2 = b2 & 8191;
          var bh2 = b2 >>> 13;
          var b3 = b[3] | 0;
          var bl3 = b3 & 8191;
          var bh3 = b3 >>> 13;
          var b4 = b[4] | 0;
          var bl4 = b4 & 8191;
          var bh4 = b4 >>> 13;
          var b5 = b[5] | 0;
          var bl5 = b5 & 8191;
          var bh5 = b5 >>> 13;
          var b6 = b[6] | 0;
          var bl6 = b6 & 8191;
          var bh6 = b6 >>> 13;
          var b7 = b[7] | 0;
          var bl7 = b7 & 8191;
          var bh7 = b7 >>> 13;
          var b8 = b[8] | 0;
          var bl8 = b8 & 8191;
          var bh8 = b8 >>> 13;
          var b9 = b[9] | 0;
          var bl9 = b9 & 8191;
          var bh9 = b9 >>> 13;
          out.negative = self.negative ^ num.negative;
          out.length = 19;
          lo = Math.imul(al0, bl0);
          mid = Math.imul(al0, bh0);
          mid = mid + Math.imul(ah0, bl0) | 0;
          hi = Math.imul(ah0, bh0);
          var w0 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w0 >>> 26) | 0;
          w0 &= 67108863;
          lo = Math.imul(al1, bl0);
          mid = Math.imul(al1, bh0);
          mid = mid + Math.imul(ah1, bl0) | 0;
          hi = Math.imul(ah1, bh0);
          lo = lo + Math.imul(al0, bl1) | 0;
          mid = mid + Math.imul(al0, bh1) | 0;
          mid = mid + Math.imul(ah0, bl1) | 0;
          hi = hi + Math.imul(ah0, bh1) | 0;
          var w1 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w1 >>> 26) | 0;
          w1 &= 67108863;
          lo = Math.imul(al2, bl0);
          mid = Math.imul(al2, bh0);
          mid = mid + Math.imul(ah2, bl0) | 0;
          hi = Math.imul(ah2, bh0);
          lo = lo + Math.imul(al1, bl1) | 0;
          mid = mid + Math.imul(al1, bh1) | 0;
          mid = mid + Math.imul(ah1, bl1) | 0;
          hi = hi + Math.imul(ah1, bh1) | 0;
          lo = lo + Math.imul(al0, bl2) | 0;
          mid = mid + Math.imul(al0, bh2) | 0;
          mid = mid + Math.imul(ah0, bl2) | 0;
          hi = hi + Math.imul(ah0, bh2) | 0;
          var w2 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w2 >>> 26) | 0;
          w2 &= 67108863;
          lo = Math.imul(al3, bl0);
          mid = Math.imul(al3, bh0);
          mid = mid + Math.imul(ah3, bl0) | 0;
          hi = Math.imul(ah3, bh0);
          lo = lo + Math.imul(al2, bl1) | 0;
          mid = mid + Math.imul(al2, bh1) | 0;
          mid = mid + Math.imul(ah2, bl1) | 0;
          hi = hi + Math.imul(ah2, bh1) | 0;
          lo = lo + Math.imul(al1, bl2) | 0;
          mid = mid + Math.imul(al1, bh2) | 0;
          mid = mid + Math.imul(ah1, bl2) | 0;
          hi = hi + Math.imul(ah1, bh2) | 0;
          lo = lo + Math.imul(al0, bl3) | 0;
          mid = mid + Math.imul(al0, bh3) | 0;
          mid = mid + Math.imul(ah0, bl3) | 0;
          hi = hi + Math.imul(ah0, bh3) | 0;
          var w3 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w3 >>> 26) | 0;
          w3 &= 67108863;
          lo = Math.imul(al4, bl0);
          mid = Math.imul(al4, bh0);
          mid = mid + Math.imul(ah4, bl0) | 0;
          hi = Math.imul(ah4, bh0);
          lo = lo + Math.imul(al3, bl1) | 0;
          mid = mid + Math.imul(al3, bh1) | 0;
          mid = mid + Math.imul(ah3, bl1) | 0;
          hi = hi + Math.imul(ah3, bh1) | 0;
          lo = lo + Math.imul(al2, bl2) | 0;
          mid = mid + Math.imul(al2, bh2) | 0;
          mid = mid + Math.imul(ah2, bl2) | 0;
          hi = hi + Math.imul(ah2, bh2) | 0;
          lo = lo + Math.imul(al1, bl3) | 0;
          mid = mid + Math.imul(al1, bh3) | 0;
          mid = mid + Math.imul(ah1, bl3) | 0;
          hi = hi + Math.imul(ah1, bh3) | 0;
          lo = lo + Math.imul(al0, bl4) | 0;
          mid = mid + Math.imul(al0, bh4) | 0;
          mid = mid + Math.imul(ah0, bl4) | 0;
          hi = hi + Math.imul(ah0, bh4) | 0;
          var w4 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w4 >>> 26) | 0;
          w4 &= 67108863;
          lo = Math.imul(al5, bl0);
          mid = Math.imul(al5, bh0);
          mid = mid + Math.imul(ah5, bl0) | 0;
          hi = Math.imul(ah5, bh0);
          lo = lo + Math.imul(al4, bl1) | 0;
          mid = mid + Math.imul(al4, bh1) | 0;
          mid = mid + Math.imul(ah4, bl1) | 0;
          hi = hi + Math.imul(ah4, bh1) | 0;
          lo = lo + Math.imul(al3, bl2) | 0;
          mid = mid + Math.imul(al3, bh2) | 0;
          mid = mid + Math.imul(ah3, bl2) | 0;
          hi = hi + Math.imul(ah3, bh2) | 0;
          lo = lo + Math.imul(al2, bl3) | 0;
          mid = mid + Math.imul(al2, bh3) | 0;
          mid = mid + Math.imul(ah2, bl3) | 0;
          hi = hi + Math.imul(ah2, bh3) | 0;
          lo = lo + Math.imul(al1, bl4) | 0;
          mid = mid + Math.imul(al1, bh4) | 0;
          mid = mid + Math.imul(ah1, bl4) | 0;
          hi = hi + Math.imul(ah1, bh4) | 0;
          lo = lo + Math.imul(al0, bl5) | 0;
          mid = mid + Math.imul(al0, bh5) | 0;
          mid = mid + Math.imul(ah0, bl5) | 0;
          hi = hi + Math.imul(ah0, bh5) | 0;
          var w5 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w5 >>> 26) | 0;
          w5 &= 67108863;
          lo = Math.imul(al6, bl0);
          mid = Math.imul(al6, bh0);
          mid = mid + Math.imul(ah6, bl0) | 0;
          hi = Math.imul(ah6, bh0);
          lo = lo + Math.imul(al5, bl1) | 0;
          mid = mid + Math.imul(al5, bh1) | 0;
          mid = mid + Math.imul(ah5, bl1) | 0;
          hi = hi + Math.imul(ah5, bh1) | 0;
          lo = lo + Math.imul(al4, bl2) | 0;
          mid = mid + Math.imul(al4, bh2) | 0;
          mid = mid + Math.imul(ah4, bl2) | 0;
          hi = hi + Math.imul(ah4, bh2) | 0;
          lo = lo + Math.imul(al3, bl3) | 0;
          mid = mid + Math.imul(al3, bh3) | 0;
          mid = mid + Math.imul(ah3, bl3) | 0;
          hi = hi + Math.imul(ah3, bh3) | 0;
          lo = lo + Math.imul(al2, bl4) | 0;
          mid = mid + Math.imul(al2, bh4) | 0;
          mid = mid + Math.imul(ah2, bl4) | 0;
          hi = hi + Math.imul(ah2, bh4) | 0;
          lo = lo + Math.imul(al1, bl5) | 0;
          mid = mid + Math.imul(al1, bh5) | 0;
          mid = mid + Math.imul(ah1, bl5) | 0;
          hi = hi + Math.imul(ah1, bh5) | 0;
          lo = lo + Math.imul(al0, bl6) | 0;
          mid = mid + Math.imul(al0, bh6) | 0;
          mid = mid + Math.imul(ah0, bl6) | 0;
          hi = hi + Math.imul(ah0, bh6) | 0;
          var w6 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w6 >>> 26) | 0;
          w6 &= 67108863;
          lo = Math.imul(al7, bl0);
          mid = Math.imul(al7, bh0);
          mid = mid + Math.imul(ah7, bl0) | 0;
          hi = Math.imul(ah7, bh0);
          lo = lo + Math.imul(al6, bl1) | 0;
          mid = mid + Math.imul(al6, bh1) | 0;
          mid = mid + Math.imul(ah6, bl1) | 0;
          hi = hi + Math.imul(ah6, bh1) | 0;
          lo = lo + Math.imul(al5, bl2) | 0;
          mid = mid + Math.imul(al5, bh2) | 0;
          mid = mid + Math.imul(ah5, bl2) | 0;
          hi = hi + Math.imul(ah5, bh2) | 0;
          lo = lo + Math.imul(al4, bl3) | 0;
          mid = mid + Math.imul(al4, bh3) | 0;
          mid = mid + Math.imul(ah4, bl3) | 0;
          hi = hi + Math.imul(ah4, bh3) | 0;
          lo = lo + Math.imul(al3, bl4) | 0;
          mid = mid + Math.imul(al3, bh4) | 0;
          mid = mid + Math.imul(ah3, bl4) | 0;
          hi = hi + Math.imul(ah3, bh4) | 0;
          lo = lo + Math.imul(al2, bl5) | 0;
          mid = mid + Math.imul(al2, bh5) | 0;
          mid = mid + Math.imul(ah2, bl5) | 0;
          hi = hi + Math.imul(ah2, bh5) | 0;
          lo = lo + Math.imul(al1, bl6) | 0;
          mid = mid + Math.imul(al1, bh6) | 0;
          mid = mid + Math.imul(ah1, bl6) | 0;
          hi = hi + Math.imul(ah1, bh6) | 0;
          lo = lo + Math.imul(al0, bl7) | 0;
          mid = mid + Math.imul(al0, bh7) | 0;
          mid = mid + Math.imul(ah0, bl7) | 0;
          hi = hi + Math.imul(ah0, bh7) | 0;
          var w7 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w7 >>> 26) | 0;
          w7 &= 67108863;
          lo = Math.imul(al8, bl0);
          mid = Math.imul(al8, bh0);
          mid = mid + Math.imul(ah8, bl0) | 0;
          hi = Math.imul(ah8, bh0);
          lo = lo + Math.imul(al7, bl1) | 0;
          mid = mid + Math.imul(al7, bh1) | 0;
          mid = mid + Math.imul(ah7, bl1) | 0;
          hi = hi + Math.imul(ah7, bh1) | 0;
          lo = lo + Math.imul(al6, bl2) | 0;
          mid = mid + Math.imul(al6, bh2) | 0;
          mid = mid + Math.imul(ah6, bl2) | 0;
          hi = hi + Math.imul(ah6, bh2) | 0;
          lo = lo + Math.imul(al5, bl3) | 0;
          mid = mid + Math.imul(al5, bh3) | 0;
          mid = mid + Math.imul(ah5, bl3) | 0;
          hi = hi + Math.imul(ah5, bh3) | 0;
          lo = lo + Math.imul(al4, bl4) | 0;
          mid = mid + Math.imul(al4, bh4) | 0;
          mid = mid + Math.imul(ah4, bl4) | 0;
          hi = hi + Math.imul(ah4, bh4) | 0;
          lo = lo + Math.imul(al3, bl5) | 0;
          mid = mid + Math.imul(al3, bh5) | 0;
          mid = mid + Math.imul(ah3, bl5) | 0;
          hi = hi + Math.imul(ah3, bh5) | 0;
          lo = lo + Math.imul(al2, bl6) | 0;
          mid = mid + Math.imul(al2, bh6) | 0;
          mid = mid + Math.imul(ah2, bl6) | 0;
          hi = hi + Math.imul(ah2, bh6) | 0;
          lo = lo + Math.imul(al1, bl7) | 0;
          mid = mid + Math.imul(al1, bh7) | 0;
          mid = mid + Math.imul(ah1, bl7) | 0;
          hi = hi + Math.imul(ah1, bh7) | 0;
          lo = lo + Math.imul(al0, bl8) | 0;
          mid = mid + Math.imul(al0, bh8) | 0;
          mid = mid + Math.imul(ah0, bl8) | 0;
          hi = hi + Math.imul(ah0, bh8) | 0;
          var w8 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w8 >>> 26) | 0;
          w8 &= 67108863;
          lo = Math.imul(al9, bl0);
          mid = Math.imul(al9, bh0);
          mid = mid + Math.imul(ah9, bl0) | 0;
          hi = Math.imul(ah9, bh0);
          lo = lo + Math.imul(al8, bl1) | 0;
          mid = mid + Math.imul(al8, bh1) | 0;
          mid = mid + Math.imul(ah8, bl1) | 0;
          hi = hi + Math.imul(ah8, bh1) | 0;
          lo = lo + Math.imul(al7, bl2) | 0;
          mid = mid + Math.imul(al7, bh2) | 0;
          mid = mid + Math.imul(ah7, bl2) | 0;
          hi = hi + Math.imul(ah7, bh2) | 0;
          lo = lo + Math.imul(al6, bl3) | 0;
          mid = mid + Math.imul(al6, bh3) | 0;
          mid = mid + Math.imul(ah6, bl3) | 0;
          hi = hi + Math.imul(ah6, bh3) | 0;
          lo = lo + Math.imul(al5, bl4) | 0;
          mid = mid + Math.imul(al5, bh4) | 0;
          mid = mid + Math.imul(ah5, bl4) | 0;
          hi = hi + Math.imul(ah5, bh4) | 0;
          lo = lo + Math.imul(al4, bl5) | 0;
          mid = mid + Math.imul(al4, bh5) | 0;
          mid = mid + Math.imul(ah4, bl5) | 0;
          hi = hi + Math.imul(ah4, bh5) | 0;
          lo = lo + Math.imul(al3, bl6) | 0;
          mid = mid + Math.imul(al3, bh6) | 0;
          mid = mid + Math.imul(ah3, bl6) | 0;
          hi = hi + Math.imul(ah3, bh6) | 0;
          lo = lo + Math.imul(al2, bl7) | 0;
          mid = mid + Math.imul(al2, bh7) | 0;
          mid = mid + Math.imul(ah2, bl7) | 0;
          hi = hi + Math.imul(ah2, bh7) | 0;
          lo = lo + Math.imul(al1, bl8) | 0;
          mid = mid + Math.imul(al1, bh8) | 0;
          mid = mid + Math.imul(ah1, bl8) | 0;
          hi = hi + Math.imul(ah1, bh8) | 0;
          lo = lo + Math.imul(al0, bl9) | 0;
          mid = mid + Math.imul(al0, bh9) | 0;
          mid = mid + Math.imul(ah0, bl9) | 0;
          hi = hi + Math.imul(ah0, bh9) | 0;
          var w9 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w9 >>> 26) | 0;
          w9 &= 67108863;
          lo = Math.imul(al9, bl1);
          mid = Math.imul(al9, bh1);
          mid = mid + Math.imul(ah9, bl1) | 0;
          hi = Math.imul(ah9, bh1);
          lo = lo + Math.imul(al8, bl2) | 0;
          mid = mid + Math.imul(al8, bh2) | 0;
          mid = mid + Math.imul(ah8, bl2) | 0;
          hi = hi + Math.imul(ah8, bh2) | 0;
          lo = lo + Math.imul(al7, bl3) | 0;
          mid = mid + Math.imul(al7, bh3) | 0;
          mid = mid + Math.imul(ah7, bl3) | 0;
          hi = hi + Math.imul(ah7, bh3) | 0;
          lo = lo + Math.imul(al6, bl4) | 0;
          mid = mid + Math.imul(al6, bh4) | 0;
          mid = mid + Math.imul(ah6, bl4) | 0;
          hi = hi + Math.imul(ah6, bh4) | 0;
          lo = lo + Math.imul(al5, bl5) | 0;
          mid = mid + Math.imul(al5, bh5) | 0;
          mid = mid + Math.imul(ah5, bl5) | 0;
          hi = hi + Math.imul(ah5, bh5) | 0;
          lo = lo + Math.imul(al4, bl6) | 0;
          mid = mid + Math.imul(al4, bh6) | 0;
          mid = mid + Math.imul(ah4, bl6) | 0;
          hi = hi + Math.imul(ah4, bh6) | 0;
          lo = lo + Math.imul(al3, bl7) | 0;
          mid = mid + Math.imul(al3, bh7) | 0;
          mid = mid + Math.imul(ah3, bl7) | 0;
          hi = hi + Math.imul(ah3, bh7) | 0;
          lo = lo + Math.imul(al2, bl8) | 0;
          mid = mid + Math.imul(al2, bh8) | 0;
          mid = mid + Math.imul(ah2, bl8) | 0;
          hi = hi + Math.imul(ah2, bh8) | 0;
          lo = lo + Math.imul(al1, bl9) | 0;
          mid = mid + Math.imul(al1, bh9) | 0;
          mid = mid + Math.imul(ah1, bl9) | 0;
          hi = hi + Math.imul(ah1, bh9) | 0;
          var w10 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w10 >>> 26) | 0;
          w10 &= 67108863;
          lo = Math.imul(al9, bl2);
          mid = Math.imul(al9, bh2);
          mid = mid + Math.imul(ah9, bl2) | 0;
          hi = Math.imul(ah9, bh2);
          lo = lo + Math.imul(al8, bl3) | 0;
          mid = mid + Math.imul(al8, bh3) | 0;
          mid = mid + Math.imul(ah8, bl3) | 0;
          hi = hi + Math.imul(ah8, bh3) | 0;
          lo = lo + Math.imul(al7, bl4) | 0;
          mid = mid + Math.imul(al7, bh4) | 0;
          mid = mid + Math.imul(ah7, bl4) | 0;
          hi = hi + Math.imul(ah7, bh4) | 0;
          lo = lo + Math.imul(al6, bl5) | 0;
          mid = mid + Math.imul(al6, bh5) | 0;
          mid = mid + Math.imul(ah6, bl5) | 0;
          hi = hi + Math.imul(ah6, bh5) | 0;
          lo = lo + Math.imul(al5, bl6) | 0;
          mid = mid + Math.imul(al5, bh6) | 0;
          mid = mid + Math.imul(ah5, bl6) | 0;
          hi = hi + Math.imul(ah5, bh6) | 0;
          lo = lo + Math.imul(al4, bl7) | 0;
          mid = mid + Math.imul(al4, bh7) | 0;
          mid = mid + Math.imul(ah4, bl7) | 0;
          hi = hi + Math.imul(ah4, bh7) | 0;
          lo = lo + Math.imul(al3, bl8) | 0;
          mid = mid + Math.imul(al3, bh8) | 0;
          mid = mid + Math.imul(ah3, bl8) | 0;
          hi = hi + Math.imul(ah3, bh8) | 0;
          lo = lo + Math.imul(al2, bl9) | 0;
          mid = mid + Math.imul(al2, bh9) | 0;
          mid = mid + Math.imul(ah2, bl9) | 0;
          hi = hi + Math.imul(ah2, bh9) | 0;
          var w11 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w11 >>> 26) | 0;
          w11 &= 67108863;
          lo = Math.imul(al9, bl3);
          mid = Math.imul(al9, bh3);
          mid = mid + Math.imul(ah9, bl3) | 0;
          hi = Math.imul(ah9, bh3);
          lo = lo + Math.imul(al8, bl4) | 0;
          mid = mid + Math.imul(al8, bh4) | 0;
          mid = mid + Math.imul(ah8, bl4) | 0;
          hi = hi + Math.imul(ah8, bh4) | 0;
          lo = lo + Math.imul(al7, bl5) | 0;
          mid = mid + Math.imul(al7, bh5) | 0;
          mid = mid + Math.imul(ah7, bl5) | 0;
          hi = hi + Math.imul(ah7, bh5) | 0;
          lo = lo + Math.imul(al6, bl6) | 0;
          mid = mid + Math.imul(al6, bh6) | 0;
          mid = mid + Math.imul(ah6, bl6) | 0;
          hi = hi + Math.imul(ah6, bh6) | 0;
          lo = lo + Math.imul(al5, bl7) | 0;
          mid = mid + Math.imul(al5, bh7) | 0;
          mid = mid + Math.imul(ah5, bl7) | 0;
          hi = hi + Math.imul(ah5, bh7) | 0;
          lo = lo + Math.imul(al4, bl8) | 0;
          mid = mid + Math.imul(al4, bh8) | 0;
          mid = mid + Math.imul(ah4, bl8) | 0;
          hi = hi + Math.imul(ah4, bh8) | 0;
          lo = lo + Math.imul(al3, bl9) | 0;
          mid = mid + Math.imul(al3, bh9) | 0;
          mid = mid + Math.imul(ah3, bl9) | 0;
          hi = hi + Math.imul(ah3, bh9) | 0;
          var w12 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w12 >>> 26) | 0;
          w12 &= 67108863;
          lo = Math.imul(al9, bl4);
          mid = Math.imul(al9, bh4);
          mid = mid + Math.imul(ah9, bl4) | 0;
          hi = Math.imul(ah9, bh4);
          lo = lo + Math.imul(al8, bl5) | 0;
          mid = mid + Math.imul(al8, bh5) | 0;
          mid = mid + Math.imul(ah8, bl5) | 0;
          hi = hi + Math.imul(ah8, bh5) | 0;
          lo = lo + Math.imul(al7, bl6) | 0;
          mid = mid + Math.imul(al7, bh6) | 0;
          mid = mid + Math.imul(ah7, bl6) | 0;
          hi = hi + Math.imul(ah7, bh6) | 0;
          lo = lo + Math.imul(al6, bl7) | 0;
          mid = mid + Math.imul(al6, bh7) | 0;
          mid = mid + Math.imul(ah6, bl7) | 0;
          hi = hi + Math.imul(ah6, bh7) | 0;
          lo = lo + Math.imul(al5, bl8) | 0;
          mid = mid + Math.imul(al5, bh8) | 0;
          mid = mid + Math.imul(ah5, bl8) | 0;
          hi = hi + Math.imul(ah5, bh8) | 0;
          lo = lo + Math.imul(al4, bl9) | 0;
          mid = mid + Math.imul(al4, bh9) | 0;
          mid = mid + Math.imul(ah4, bl9) | 0;
          hi = hi + Math.imul(ah4, bh9) | 0;
          var w13 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w13 >>> 26) | 0;
          w13 &= 67108863;
          lo = Math.imul(al9, bl5);
          mid = Math.imul(al9, bh5);
          mid = mid + Math.imul(ah9, bl5) | 0;
          hi = Math.imul(ah9, bh5);
          lo = lo + Math.imul(al8, bl6) | 0;
          mid = mid + Math.imul(al8, bh6) | 0;
          mid = mid + Math.imul(ah8, bl6) | 0;
          hi = hi + Math.imul(ah8, bh6) | 0;
          lo = lo + Math.imul(al7, bl7) | 0;
          mid = mid + Math.imul(al7, bh7) | 0;
          mid = mid + Math.imul(ah7, bl7) | 0;
          hi = hi + Math.imul(ah7, bh7) | 0;
          lo = lo + Math.imul(al6, bl8) | 0;
          mid = mid + Math.imul(al6, bh8) | 0;
          mid = mid + Math.imul(ah6, bl8) | 0;
          hi = hi + Math.imul(ah6, bh8) | 0;
          lo = lo + Math.imul(al5, bl9) | 0;
          mid = mid + Math.imul(al5, bh9) | 0;
          mid = mid + Math.imul(ah5, bl9) | 0;
          hi = hi + Math.imul(ah5, bh9) | 0;
          var w14 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w14 >>> 26) | 0;
          w14 &= 67108863;
          lo = Math.imul(al9, bl6);
          mid = Math.imul(al9, bh6);
          mid = mid + Math.imul(ah9, bl6) | 0;
          hi = Math.imul(ah9, bh6);
          lo = lo + Math.imul(al8, bl7) | 0;
          mid = mid + Math.imul(al8, bh7) | 0;
          mid = mid + Math.imul(ah8, bl7) | 0;
          hi = hi + Math.imul(ah8, bh7) | 0;
          lo = lo + Math.imul(al7, bl8) | 0;
          mid = mid + Math.imul(al7, bh8) | 0;
          mid = mid + Math.imul(ah7, bl8) | 0;
          hi = hi + Math.imul(ah7, bh8) | 0;
          lo = lo + Math.imul(al6, bl9) | 0;
          mid = mid + Math.imul(al6, bh9) | 0;
          mid = mid + Math.imul(ah6, bl9) | 0;
          hi = hi + Math.imul(ah6, bh9) | 0;
          var w15 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w15 >>> 26) | 0;
          w15 &= 67108863;
          lo = Math.imul(al9, bl7);
          mid = Math.imul(al9, bh7);
          mid = mid + Math.imul(ah9, bl7) | 0;
          hi = Math.imul(ah9, bh7);
          lo = lo + Math.imul(al8, bl8) | 0;
          mid = mid + Math.imul(al8, bh8) | 0;
          mid = mid + Math.imul(ah8, bl8) | 0;
          hi = hi + Math.imul(ah8, bh8) | 0;
          lo = lo + Math.imul(al7, bl9) | 0;
          mid = mid + Math.imul(al7, bh9) | 0;
          mid = mid + Math.imul(ah7, bl9) | 0;
          hi = hi + Math.imul(ah7, bh9) | 0;
          var w16 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w16 >>> 26) | 0;
          w16 &= 67108863;
          lo = Math.imul(al9, bl8);
          mid = Math.imul(al9, bh8);
          mid = mid + Math.imul(ah9, bl8) | 0;
          hi = Math.imul(ah9, bh8);
          lo = lo + Math.imul(al8, bl9) | 0;
          mid = mid + Math.imul(al8, bh9) | 0;
          mid = mid + Math.imul(ah8, bl9) | 0;
          hi = hi + Math.imul(ah8, bh9) | 0;
          var w17 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w17 >>> 26) | 0;
          w17 &= 67108863;
          lo = Math.imul(al9, bl9);
          mid = Math.imul(al9, bh9);
          mid = mid + Math.imul(ah9, bl9) | 0;
          hi = Math.imul(ah9, bh9);
          var w18 = (c + lo | 0) + ((mid & 8191) << 13) | 0;
          c = (hi + (mid >>> 13) | 0) + (w18 >>> 26) | 0;
          w18 &= 67108863;
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
        if (!Math.imul) {
          comb10MulTo = smallMulTo;
        }
        function bigMulTo(self, num, out) {
          out.negative = num.negative ^ self.negative;
          out.length = self.length + num.length;
          var carry = 0;
          var hncarry = 0;
          for (var k = 0; k < out.length - 1; k++) {
            var ncarry = hncarry;
            hncarry = 0;
            var rword = carry & 67108863;
            var maxJ = Math.min(k, num.length - 1);
            for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
              var i2 = k - j;
              var a = self.words[i2] | 0;
              var b = num.words[j] | 0;
              var r = a * b;
              var lo = r & 67108863;
              ncarry = ncarry + (r / 67108864 | 0) | 0;
              lo = lo + rword | 0;
              rword = lo & 67108863;
              ncarry = ncarry + (lo >>> 26) | 0;
              hncarry += ncarry >>> 26;
              ncarry &= 67108863;
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
          return out._strip();
        }
        function jumboMulTo(self, num, out) {
          return bigMulTo(self, num, out);
        }
        BN2.prototype.mulTo = function mulTo(num, out) {
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
        function FFTM(x, y) {
          this.x = x;
          this.y = y;
        }
        FFTM.prototype.makeRBT = function makeRBT(N) {
          var t = new Array(N);
          var l = BN2.prototype._countBits(N) - 1;
          for (var i2 = 0; i2 < N; i2++) {
            t[i2] = this.revBin(i2, l, N);
          }
          return t;
        };
        FFTM.prototype.revBin = function revBin(x, l, N) {
          if (x === 0 || x === N - 1) return x;
          var rb = 0;
          for (var i2 = 0; i2 < l; i2++) {
            rb |= (x & 1) << l - i2 - 1;
            x >>= 1;
          }
          return rb;
        };
        FFTM.prototype.permute = function permute(rbt, rws, iws, rtws, itws, N) {
          for (var i2 = 0; i2 < N; i2++) {
            rtws[i2] = rws[rbt[i2]];
            itws[i2] = iws[rbt[i2]];
          }
        };
        FFTM.prototype.transform = function transform(rws, iws, rtws, itws, N, rbt) {
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
                if (j !== l) {
                  rx = rtwdf * rtwdf_ - itwdf * itwdf_;
                  itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_;
                  rtwdf_ = rx;
                }
              }
            }
          }
        };
        FFTM.prototype.guessLen13b = function guessLen13b(n, m) {
          var N = Math.max(m, n) | 1;
          var odd = N & 1;
          var i2 = 0;
          for (N = N / 2 | 0; N; N = N >>> 1) {
            i2++;
          }
          return 1 << i2 + 1 + odd;
        };
        FFTM.prototype.conjugate = function conjugate(rws, iws, N) {
          if (N <= 1) return;
          for (var i2 = 0; i2 < N / 2; i2++) {
            var t = rws[i2];
            rws[i2] = rws[N - i2 - 1];
            rws[N - i2 - 1] = t;
            t = iws[i2];
            iws[i2] = -iws[N - i2 - 1];
            iws[N - i2 - 1] = -t;
          }
        };
        FFTM.prototype.normalize13b = function normalize13b(ws, N) {
          var carry = 0;
          for (var i2 = 0; i2 < N / 2; i2++) {
            var w = Math.round(ws[2 * i2 + 1] / N) * 8192 + Math.round(ws[2 * i2] / N) + carry;
            ws[i2] = w & 67108863;
            if (w < 67108864) {
              carry = 0;
            } else {
              carry = w / 67108864 | 0;
            }
          }
          return ws;
        };
        FFTM.prototype.convert13b = function convert13b(ws, len, rws, N) {
          var carry = 0;
          for (var i2 = 0; i2 < len; i2++) {
            carry = carry + (ws[i2] | 0);
            rws[2 * i2] = carry & 8191;
            carry = carry >>> 13;
            rws[2 * i2 + 1] = carry & 8191;
            carry = carry >>> 13;
          }
          for (i2 = 2 * len; i2 < N; ++i2) {
            rws[i2] = 0;
          }
          assert3(carry === 0);
          assert3((carry & ~8191) === 0);
        };
        FFTM.prototype.stub = function stub(N) {
          var ph = new Array(N);
          for (var i2 = 0; i2 < N; i2++) {
            ph[i2] = 0;
          }
          return ph;
        };
        FFTM.prototype.mulp = function mulp(x, y, out) {
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
          for (var i2 = 0; i2 < N; i2++) {
            var rx = rwst[i2] * nrwst[i2] - iwst[i2] * niwst[i2];
            iwst[i2] = rwst[i2] * niwst[i2] + iwst[i2] * nrwst[i2];
            rwst[i2] = rx;
          }
          this.conjugate(rwst, iwst, N);
          this.transform(rwst, iwst, rmws, _, N, rbt);
          this.conjugate(rmws, _, N);
          this.normalize13b(rmws, N);
          out.negative = x.negative ^ y.negative;
          out.length = x.length + y.length;
          return out._strip();
        };
        BN2.prototype.mul = function mul(num) {
          var out = new BN2(null);
          out.words = new Array(this.length + num.length);
          return this.mulTo(num, out);
        };
        BN2.prototype.mulf = function mulf(num) {
          var out = new BN2(null);
          out.words = new Array(this.length + num.length);
          return jumboMulTo(this, num, out);
        };
        BN2.prototype.imul = function imul(num) {
          return this.clone().mulTo(num, this);
        };
        BN2.prototype.imuln = function imuln(num) {
          var isNegNum = num < 0;
          if (isNegNum) num = -num;
          assert3(typeof num === "number");
          assert3(num < 67108864);
          var carry = 0;
          for (var i2 = 0; i2 < this.length; i2++) {
            var w = (this.words[i2] | 0) * num;
            var lo = (w & 67108863) + (carry & 67108863);
            carry >>= 26;
            carry += w / 67108864 | 0;
            carry += lo >>> 26;
            this.words[i2] = lo & 67108863;
          }
          if (carry !== 0) {
            this.words[i2] = carry;
            this.length++;
          }
          if (num === 0) {
            this.length = 1;
            this._normSign();
          }
          return isNegNum ? this.ineg() : this;
        };
        BN2.prototype.muln = function muln(num) {
          return this.clone().imuln(num);
        };
        BN2.prototype.sqr = function sqr() {
          return this.mul(this);
        };
        BN2.prototype.isqr = function isqr() {
          return this.imul(this.clone());
        };
        BN2.prototype.pow = function pow(num) {
          var w = toBitArray(num);
          if (w.length === 0) return new BN2(1);
          var res = this;
          for (var i2 = 0; i2 < w.length; i2++, res = res.sqr()) {
            if (w[i2] !== 0) break;
          }
          if (++i2 < w.length) {
            for (var q = res.sqr(); i2 < w.length; i2++, q = q.sqr()) {
              if (w[i2] === 0) continue;
              res = res.mul(q);
            }
          }
          return res;
        };
        BN2.prototype.iushln = function iushln(bits) {
          assert3(typeof bits === "number" && bits >= 0);
          var r = bits % 26;
          var s = (bits - r) / 26;
          var carryMask = 67108863 >>> 26 - r << 26 - r;
          var i2;
          if (r !== 0) {
            var carry = 0;
            for (i2 = 0; i2 < this.length; i2++) {
              var newCarry = this.words[i2] & carryMask;
              var c = (this.words[i2] | 0) - newCarry << r;
              this.words[i2] = c | carry;
              carry = newCarry >>> 26 - r;
            }
            if (carry) {
              this.words[i2] = carry;
              this.length++;
            }
          }
          if (s !== 0) {
            for (i2 = this.length - 1; i2 >= 0; i2--) {
              this.words[i2 + s] = this.words[i2];
            }
            for (i2 = 0; i2 < s; i2++) {
              this.words[i2] = 0;
            }
            this.length += s;
          }
          return this._strip();
        };
        BN2.prototype.ishln = function ishln(bits) {
          assert3(this.negative === 0);
          return this.iushln(bits);
        };
        BN2.prototype.iushrn = function iushrn(bits, hint, extended) {
          assert3(typeof bits === "number" && bits >= 0);
          var h;
          if (hint) {
            h = (hint - hint % 26) / 26;
          } else {
            h = 0;
          }
          var r = bits % 26;
          var s = Math.min((bits - r) / 26, this.length);
          var mask2 = 67108863 ^ 67108863 >>> r << r;
          var maskedWords = extended;
          h -= s;
          h = Math.max(0, h);
          if (maskedWords) {
            for (var i2 = 0; i2 < s; i2++) {
              maskedWords.words[i2] = this.words[i2];
            }
            maskedWords.length = s;
          }
          if (s === 0) {
          } else if (this.length > s) {
            this.length -= s;
            for (i2 = 0; i2 < this.length; i2++) {
              this.words[i2] = this.words[i2 + s];
            }
          } else {
            this.words[0] = 0;
            this.length = 1;
          }
          var carry = 0;
          for (i2 = this.length - 1; i2 >= 0 && (carry !== 0 || i2 >= h); i2--) {
            var word = this.words[i2] | 0;
            this.words[i2] = carry << 26 - r | word >>> r;
            carry = word & mask2;
          }
          if (maskedWords && carry !== 0) {
            maskedWords.words[maskedWords.length++] = carry;
          }
          if (this.length === 0) {
            this.words[0] = 0;
            this.length = 1;
          }
          return this._strip();
        };
        BN2.prototype.ishrn = function ishrn(bits, hint, extended) {
          assert3(this.negative === 0);
          return this.iushrn(bits, hint, extended);
        };
        BN2.prototype.shln = function shln(bits) {
          return this.clone().ishln(bits);
        };
        BN2.prototype.ushln = function ushln(bits) {
          return this.clone().iushln(bits);
        };
        BN2.prototype.shrn = function shrn(bits) {
          return this.clone().ishrn(bits);
        };
        BN2.prototype.ushrn = function ushrn(bits) {
          return this.clone().iushrn(bits);
        };
        BN2.prototype.testn = function testn(bit) {
          assert3(typeof bit === "number" && bit >= 0);
          var r = bit % 26;
          var s = (bit - r) / 26;
          var q = 1 << r;
          if (this.length <= s) return false;
          var w = this.words[s];
          return !!(w & q);
        };
        BN2.prototype.imaskn = function imaskn(bits) {
          assert3(typeof bits === "number" && bits >= 0);
          var r = bits % 26;
          var s = (bits - r) / 26;
          assert3(this.negative === 0, "imaskn works only with positive numbers");
          if (this.length <= s) {
            return this;
          }
          if (r !== 0) {
            s++;
          }
          this.length = Math.min(s, this.length);
          if (r !== 0) {
            var mask2 = 67108863 ^ 67108863 >>> r << r;
            this.words[this.length - 1] &= mask2;
          }
          if (this.length === 0) {
            this.words[0] = 0;
            this.length = 1;
          }
          return this._strip();
        };
        BN2.prototype.maskn = function maskn(bits) {
          return this.clone().imaskn(bits);
        };
        BN2.prototype.iaddn = function iaddn(num) {
          assert3(typeof num === "number");
          assert3(num < 67108864);
          if (num < 0) return this.isubn(-num);
          if (this.negative !== 0) {
            if (this.length === 1 && (this.words[0] | 0) <= num) {
              this.words[0] = num - (this.words[0] | 0);
              this.negative = 0;
              return this;
            }
            this.negative = 0;
            this.isubn(num);
            this.negative = 1;
            return this;
          }
          return this._iaddn(num);
        };
        BN2.prototype._iaddn = function _iaddn(num) {
          this.words[0] += num;
          for (var i2 = 0; i2 < this.length && this.words[i2] >= 67108864; i2++) {
            this.words[i2] -= 67108864;
            if (i2 === this.length - 1) {
              this.words[i2 + 1] = 1;
            } else {
              this.words[i2 + 1]++;
            }
          }
          this.length = Math.max(this.length, i2 + 1);
          return this;
        };
        BN2.prototype.isubn = function isubn(num) {
          assert3(typeof num === "number");
          assert3(num < 67108864);
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
            for (var i2 = 0; i2 < this.length && this.words[i2] < 0; i2++) {
              this.words[i2] += 67108864;
              this.words[i2 + 1] -= 1;
            }
          }
          return this._strip();
        };
        BN2.prototype.addn = function addn(num) {
          return this.clone().iaddn(num);
        };
        BN2.prototype.subn = function subn(num) {
          return this.clone().isubn(num);
        };
        BN2.prototype.iabs = function iabs() {
          this.negative = 0;
          return this;
        };
        BN2.prototype.abs = function abs() {
          return this.clone().iabs();
        };
        BN2.prototype._ishlnsubmul = function _ishlnsubmul(num, mul, shift) {
          var len = num.length + shift;
          var i2;
          this._expand(len);
          var w;
          var carry = 0;
          for (i2 = 0; i2 < num.length; i2++) {
            w = (this.words[i2 + shift] | 0) + carry;
            var right = (num.words[i2] | 0) * mul;
            w -= right & 67108863;
            carry = (w >> 26) - (right / 67108864 | 0);
            this.words[i2 + shift] = w & 67108863;
          }
          for (; i2 < this.length - shift; i2++) {
            w = (this.words[i2 + shift] | 0) + carry;
            carry = w >> 26;
            this.words[i2 + shift] = w & 67108863;
          }
          if (carry === 0) return this._strip();
          assert3(carry === -1);
          carry = 0;
          for (i2 = 0; i2 < this.length; i2++) {
            w = -(this.words[i2] | 0) + carry;
            carry = w >> 26;
            this.words[i2] = w & 67108863;
          }
          this.negative = 1;
          return this._strip();
        };
        BN2.prototype._wordDiv = function _wordDiv(num, mode) {
          var shift = this.length - num.length;
          var a = this.clone();
          var b = num;
          var bhi = b.words[b.length - 1] | 0;
          var bhiBits = this._countBits(bhi);
          shift = 26 - bhiBits;
          if (shift !== 0) {
            b = b.ushln(shift);
            a.iushln(shift);
            bhi = b.words[b.length - 1] | 0;
          }
          var m = a.length - b.length;
          var q;
          if (mode !== "mod") {
            q = new BN2(null);
            q.length = m + 1;
            q.words = new Array(q.length);
            for (var i2 = 0; i2 < q.length; i2++) {
              q.words[i2] = 0;
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
            var qj = (a.words[b.length + j] | 0) * 67108864 + (a.words[b.length + j - 1] | 0);
            qj = Math.min(qj / bhi | 0, 67108863);
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
            q._strip();
          }
          a._strip();
          if (mode !== "div" && shift !== 0) {
            a.iushrn(shift);
          }
          return {
            div: q || null,
            mod: a
          };
        };
        BN2.prototype.divmod = function divmod(num, mode, positive) {
          assert3(!num.isZero());
          if (this.isZero()) {
            return {
              div: new BN2(0),
              mod: new BN2(0)
            };
          }
          var div, mod2, res;
          if (this.negative !== 0 && num.negative === 0) {
            res = this.neg().divmod(num, mode);
            if (mode !== "mod") {
              div = res.div.neg();
            }
            if (mode !== "div") {
              mod2 = res.mod.neg();
              if (positive && mod2.negative !== 0) {
                mod2.iadd(num);
              }
            }
            return {
              div,
              mod: mod2
            };
          }
          if (this.negative === 0 && num.negative !== 0) {
            res = this.divmod(num.neg(), mode);
            if (mode !== "mod") {
              div = res.div.neg();
            }
            return {
              div,
              mod: res.mod
            };
          }
          if ((this.negative & num.negative) !== 0) {
            res = this.neg().divmod(num.neg(), mode);
            if (mode !== "div") {
              mod2 = res.mod.neg();
              if (positive && mod2.negative !== 0) {
                mod2.isub(num);
              }
            }
            return {
              div: res.div,
              mod: mod2
            };
          }
          if (num.length > this.length || this.cmp(num) < 0) {
            return {
              div: new BN2(0),
              mod: this
            };
          }
          if (num.length === 1) {
            if (mode === "div") {
              return {
                div: this.divn(num.words[0]),
                mod: null
              };
            }
            if (mode === "mod") {
              return {
                div: null,
                mod: new BN2(this.modrn(num.words[0]))
              };
            }
            return {
              div: this.divn(num.words[0]),
              mod: new BN2(this.modrn(num.words[0]))
            };
          }
          return this._wordDiv(num, mode);
        };
        BN2.prototype.div = function div(num) {
          return this.divmod(num, "div", false).div;
        };
        BN2.prototype.mod = function mod2(num) {
          return this.divmod(num, "mod", false).mod;
        };
        BN2.prototype.umod = function umod(num) {
          return this.divmod(num, "mod", true).mod;
        };
        BN2.prototype.divRound = function divRound(num) {
          var dm = this.divmod(num);
          if (dm.mod.isZero()) return dm.div;
          var mod2 = dm.mod.abs();
          var half = num.abs().iushrn(1);
          var r2 = num.words[0] & 1;
          var cmp = mod2.cmp(half);
          if (cmp < 0 || r2 === 1 && cmp === 0) return dm.div;
          var up = new BN2(1);
          up.negative = this.negative ^ num.negative;
          return dm.div.iadd(up);
        };
        BN2.prototype.modrn = function modrn(num) {
          var isNegNum = num < 0;
          if (isNegNum) num = -num;
          assert3(num <= 67108863);
          var p = (1 << 26) % num;
          var acc = 0;
          for (var i2 = this.length - 1; i2 >= 0; i2--) {
            acc = (p * acc + (this.words[i2] | 0)) % num;
          }
          return isNegNum ? -acc : acc;
        };
        BN2.prototype.modn = function modn(num) {
          return this.modrn(num);
        };
        BN2.prototype.idivn = function idivn(num) {
          var isNegNum = num < 0;
          if (isNegNum) num = -num;
          assert3(num <= 67108863);
          var carry = 0;
          for (var i2 = this.length - 1; i2 >= 0; i2--) {
            var w = (this.words[i2] | 0) + carry * 67108864;
            this.words[i2] = w / num | 0;
            carry = w % num;
          }
          this._strip();
          return isNegNum ? this.ineg() : this;
        };
        BN2.prototype.divn = function divn(num) {
          return this.clone().idivn(num);
        };
        BN2.prototype.egcd = function egcd(p) {
          assert3(p.negative === 0);
          assert3(!p.isZero());
          var x = this;
          var y = p.clone();
          if (x.negative !== 0) {
            x = x.umod(p);
          } else {
            x = x.clone();
          }
          var A = new BN2(1);
          var B = new BN2(0);
          var C = new BN2(0);
          var D = new BN2(1);
          var g = 0;
          while (x.isEven() && y.isEven()) {
            x.iushrn(1);
            y.iushrn(1);
            ++g;
          }
          var yp = y.clone();
          var xp = x.clone();
          while (!x.isZero()) {
            for (var i2 = 0, im = 1; (x.words[0] & im) === 0 && i2 < 26; ++i2, im <<= 1) ;
            if (i2 > 0) {
              x.iushrn(i2);
              while (i2-- > 0) {
                if (A.isOdd() || B.isOdd()) {
                  A.iadd(yp);
                  B.isub(xp);
                }
                A.iushrn(1);
                B.iushrn(1);
              }
            }
            for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1) ;
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
        BN2.prototype._invmp = function _invmp(p) {
          assert3(p.negative === 0);
          assert3(!p.isZero());
          var a = this;
          var b = p.clone();
          if (a.negative !== 0) {
            a = a.umod(p);
          } else {
            a = a.clone();
          }
          var x1 = new BN2(1);
          var x2 = new BN2(0);
          var delta = b.clone();
          while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
            for (var i2 = 0, im = 1; (a.words[0] & im) === 0 && i2 < 26; ++i2, im <<= 1) ;
            if (i2 > 0) {
              a.iushrn(i2);
              while (i2-- > 0) {
                if (x1.isOdd()) {
                  x1.iadd(delta);
                }
                x1.iushrn(1);
              }
            }
            for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1) ;
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
        BN2.prototype.gcd = function gcd(num) {
          if (this.isZero()) return num.abs();
          if (num.isZero()) return this.abs();
          var a = this.clone();
          var b = num.clone();
          a.negative = 0;
          b.negative = 0;
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
        BN2.prototype.invm = function invm(num) {
          return this.egcd(num).a.umod(num);
        };
        BN2.prototype.isEven = function isEven() {
          return (this.words[0] & 1) === 0;
        };
        BN2.prototype.isOdd = function isOdd2() {
          return (this.words[0] & 1) === 1;
        };
        BN2.prototype.andln = function andln(num) {
          return this.words[0] & num;
        };
        BN2.prototype.bincn = function bincn(bit) {
          assert3(typeof bit === "number");
          var r = bit % 26;
          var s = (bit - r) / 26;
          var q = 1 << r;
          if (this.length <= s) {
            this._expand(s + 1);
            this.words[s] |= q;
            return this;
          }
          var carry = q;
          for (var i2 = s; carry !== 0 && i2 < this.length; i2++) {
            var w = this.words[i2] | 0;
            w += carry;
            carry = w >>> 26;
            w &= 67108863;
            this.words[i2] = w;
          }
          if (carry !== 0) {
            this.words[i2] = carry;
            this.length++;
          }
          return this;
        };
        BN2.prototype.isZero = function isZero() {
          return this.length === 1 && this.words[0] === 0;
        };
        BN2.prototype.cmpn = function cmpn(num) {
          var negative = num < 0;
          if (this.negative !== 0 && !negative) return -1;
          if (this.negative === 0 && negative) return 1;
          this._strip();
          var res;
          if (this.length > 1) {
            res = 1;
          } else {
            if (negative) {
              num = -num;
            }
            assert3(num <= 67108863, "Number is too big");
            var w = this.words[0] | 0;
            res = w === num ? 0 : w < num ? -1 : 1;
          }
          if (this.negative !== 0) return -res | 0;
          return res;
        };
        BN2.prototype.cmp = function cmp(num) {
          if (this.negative !== 0 && num.negative === 0) return -1;
          if (this.negative === 0 && num.negative !== 0) return 1;
          var res = this.ucmp(num);
          if (this.negative !== 0) return -res | 0;
          return res;
        };
        BN2.prototype.ucmp = function ucmp(num) {
          if (this.length > num.length) return 1;
          if (this.length < num.length) return -1;
          var res = 0;
          for (var i2 = this.length - 1; i2 >= 0; i2--) {
            var a = this.words[i2] | 0;
            var b = num.words[i2] | 0;
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
        BN2.prototype.gtn = function gtn(num) {
          return this.cmpn(num) === 1;
        };
        BN2.prototype.gt = function gt(num) {
          return this.cmp(num) === 1;
        };
        BN2.prototype.gten = function gten(num) {
          return this.cmpn(num) >= 0;
        };
        BN2.prototype.gte = function gte(num) {
          return this.cmp(num) >= 0;
        };
        BN2.prototype.ltn = function ltn(num) {
          return this.cmpn(num) === -1;
        };
        BN2.prototype.lt = function lt(num) {
          return this.cmp(num) === -1;
        };
        BN2.prototype.lten = function lten(num) {
          return this.cmpn(num) <= 0;
        };
        BN2.prototype.lte = function lte(num) {
          return this.cmp(num) <= 0;
        };
        BN2.prototype.eqn = function eqn(num) {
          return this.cmpn(num) === 0;
        };
        BN2.prototype.eq = function eq(num) {
          return this.cmp(num) === 0;
        };
        BN2.red = function red(num) {
          return new Red(num);
        };
        BN2.prototype.toRed = function toRed(ctx) {
          assert3(!this.red, "Already a number in reduction context");
          assert3(this.negative === 0, "red works only with positives");
          return ctx.convertTo(this)._forceRed(ctx);
        };
        BN2.prototype.fromRed = function fromRed() {
          assert3(this.red, "fromRed works only with numbers in reduction context");
          return this.red.convertFrom(this);
        };
        BN2.prototype._forceRed = function _forceRed(ctx) {
          this.red = ctx;
          return this;
        };
        BN2.prototype.forceRed = function forceRed(ctx) {
          assert3(!this.red, "Already a number in reduction context");
          return this._forceRed(ctx);
        };
        BN2.prototype.redAdd = function redAdd(num) {
          assert3(this.red, "redAdd works only with red numbers");
          return this.red.add(this, num);
        };
        BN2.prototype.redIAdd = function redIAdd(num) {
          assert3(this.red, "redIAdd works only with red numbers");
          return this.red.iadd(this, num);
        };
        BN2.prototype.redSub = function redSub(num) {
          assert3(this.red, "redSub works only with red numbers");
          return this.red.sub(this, num);
        };
        BN2.prototype.redISub = function redISub(num) {
          assert3(this.red, "redISub works only with red numbers");
          return this.red.isub(this, num);
        };
        BN2.prototype.redShl = function redShl(num) {
          assert3(this.red, "redShl works only with red numbers");
          return this.red.shl(this, num);
        };
        BN2.prototype.redMul = function redMul(num) {
          assert3(this.red, "redMul works only with red numbers");
          this.red._verify2(this, num);
          return this.red.mul(this, num);
        };
        BN2.prototype.redIMul = function redIMul(num) {
          assert3(this.red, "redMul works only with red numbers");
          this.red._verify2(this, num);
          return this.red.imul(this, num);
        };
        BN2.prototype.redSqr = function redSqr() {
          assert3(this.red, "redSqr works only with red numbers");
          this.red._verify1(this);
          return this.red.sqr(this);
        };
        BN2.prototype.redISqr = function redISqr() {
          assert3(this.red, "redISqr works only with red numbers");
          this.red._verify1(this);
          return this.red.isqr(this);
        };
        BN2.prototype.redSqrt = function redSqrt() {
          assert3(this.red, "redSqrt works only with red numbers");
          this.red._verify1(this);
          return this.red.sqrt(this);
        };
        BN2.prototype.redInvm = function redInvm() {
          assert3(this.red, "redInvm works only with red numbers");
          this.red._verify1(this);
          return this.red.invm(this);
        };
        BN2.prototype.redNeg = function redNeg() {
          assert3(this.red, "redNeg works only with red numbers");
          this.red._verify1(this);
          return this.red.neg(this);
        };
        BN2.prototype.redPow = function redPow(num) {
          assert3(this.red && !num.red, "redPow(normalNum)");
          this.red._verify1(this);
          return this.red.pow(this, num);
        };
        var primes = {
          k256: null,
          p224: null,
          p192: null,
          p25519: null
        };
        function MPrime(name, p) {
          this.name = name;
          this.p = new BN2(p, 16);
          this.n = this.p.bitLength();
          this.k = new BN2(1).iushln(this.n).isub(this.p);
          this.tmp = this._tmp();
        }
        MPrime.prototype._tmp = function _tmp() {
          var tmp = new BN2(null);
          tmp.words = new Array(Math.ceil(this.n / 13));
          return tmp;
        };
        MPrime.prototype.ireduce = function ireduce(num) {
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
            if (r.strip !== void 0) {
              r.strip();
            } else {
              r._strip();
            }
          }
          return r;
        };
        MPrime.prototype.split = function split2(input, out) {
          input.iushrn(this.n, 0, out);
        };
        MPrime.prototype.imulK = function imulK(num) {
          return num.imul(this.k);
        };
        function K256() {
          MPrime.call(
            this,
            "k256",
            "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f"
          );
        }
        inherits(K256, MPrime);
        K256.prototype.split = function split2(input, output) {
          var mask2 = 4194303;
          var outLen = Math.min(input.length, 9);
          for (var i2 = 0; i2 < outLen; i2++) {
            output.words[i2] = input.words[i2];
          }
          output.length = outLen;
          if (input.length <= 9) {
            input.words[0] = 0;
            input.length = 1;
            return;
          }
          var prev = input.words[9];
          output.words[output.length++] = prev & mask2;
          for (i2 = 10; i2 < input.length; i2++) {
            var next = input.words[i2] | 0;
            input.words[i2 - 10] = (next & mask2) << 4 | prev >>> 22;
            prev = next;
          }
          prev >>>= 22;
          input.words[i2 - 10] = prev;
          if (prev === 0 && input.length > 10) {
            input.length -= 10;
          } else {
            input.length -= 9;
          }
        };
        K256.prototype.imulK = function imulK(num) {
          num.words[num.length] = 0;
          num.words[num.length + 1] = 0;
          num.length += 2;
          var lo = 0;
          for (var i2 = 0; i2 < num.length; i2++) {
            var w = num.words[i2] | 0;
            lo += w * 977;
            num.words[i2] = lo & 67108863;
            lo = w * 64 + (lo / 67108864 | 0);
          }
          if (num.words[num.length - 1] === 0) {
            num.length--;
            if (num.words[num.length - 1] === 0) {
              num.length--;
            }
          }
          return num;
        };
        function P224() {
          MPrime.call(
            this,
            "p224",
            "ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001"
          );
        }
        inherits(P224, MPrime);
        function P192() {
          MPrime.call(
            this,
            "p192",
            "ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff"
          );
        }
        inherits(P192, MPrime);
        function P25519() {
          MPrime.call(
            this,
            "25519",
            "7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed"
          );
        }
        inherits(P25519, MPrime);
        P25519.prototype.imulK = function imulK(num) {
          var carry = 0;
          for (var i2 = 0; i2 < num.length; i2++) {
            var hi = (num.words[i2] | 0) * 19 + carry;
            var lo = hi & 67108863;
            hi >>>= 26;
            num.words[i2] = lo;
            carry = hi;
          }
          if (carry !== 0) {
            num.words[num.length++] = carry;
          }
          return num;
        };
        BN2._prime = function prime(name) {
          if (primes[name]) return primes[name];
          var prime2;
          if (name === "k256") {
            prime2 = new K256();
          } else if (name === "p224") {
            prime2 = new P224();
          } else if (name === "p192") {
            prime2 = new P192();
          } else if (name === "p25519") {
            prime2 = new P25519();
          } else {
            throw new Error("Unknown prime " + name);
          }
          primes[name] = prime2;
          return prime2;
        };
        function Red(m) {
          if (typeof m === "string") {
            var prime = BN2._prime(m);
            this.m = prime.p;
            this.prime = prime;
          } else {
            assert3(m.gtn(1), "modulus must be greater than 1");
            this.m = m;
            this.prime = null;
          }
        }
        Red.prototype._verify1 = function _verify1(a) {
          assert3(a.negative === 0, "red works only with positives");
          assert3(a.red, "red works only with red numbers");
        };
        Red.prototype._verify2 = function _verify2(a, b) {
          assert3((a.negative | b.negative) === 0, "red works only with positives");
          assert3(
            a.red && a.red === b.red,
            "red works only with red numbers"
          );
        };
        Red.prototype.imod = function imod(a) {
          if (this.prime) return this.prime.ireduce(a)._forceRed(this);
          move(a, a.umod(this.m)._forceRed(this));
          return a;
        };
        Red.prototype.neg = function neg(a) {
          if (a.isZero()) {
            return a.clone();
          }
          return this.m.sub(a)._forceRed(this);
        };
        Red.prototype.add = function add2(a, b) {
          this._verify2(a, b);
          var res = a.add(b);
          if (res.cmp(this.m) >= 0) {
            res.isub(this.m);
          }
          return res._forceRed(this);
        };
        Red.prototype.iadd = function iadd(a, b) {
          this._verify2(a, b);
          var res = a.iadd(b);
          if (res.cmp(this.m) >= 0) {
            res.isub(this.m);
          }
          return res;
        };
        Red.prototype.sub = function sub(a, b) {
          this._verify2(a, b);
          var res = a.sub(b);
          if (res.cmpn(0) < 0) {
            res.iadd(this.m);
          }
          return res._forceRed(this);
        };
        Red.prototype.isub = function isub(a, b) {
          this._verify2(a, b);
          var res = a.isub(b);
          if (res.cmpn(0) < 0) {
            res.iadd(this.m);
          }
          return res;
        };
        Red.prototype.shl = function shl(a, num) {
          this._verify1(a);
          return this.imod(a.ushln(num));
        };
        Red.prototype.imul = function imul(a, b) {
          this._verify2(a, b);
          return this.imod(a.imul(b));
        };
        Red.prototype.mul = function mul(a, b) {
          this._verify2(a, b);
          return this.imod(a.mul(b));
        };
        Red.prototype.isqr = function isqr(a) {
          return this.imul(a, a.clone());
        };
        Red.prototype.sqr = function sqr(a) {
          return this.mul(a, a);
        };
        Red.prototype.sqrt = function sqrt(a) {
          if (a.isZero()) return a.clone();
          var mod3 = this.m.andln(3);
          assert3(mod3 % 2 === 1);
          if (mod3 === 3) {
            var pow = this.m.add(new BN2(1)).iushrn(2);
            return this.pow(a, pow);
          }
          var q = this.m.subn(1);
          var s = 0;
          while (!q.isZero() && q.andln(1) === 0) {
            s++;
            q.iushrn(1);
          }
          assert3(!q.isZero());
          var one = new BN2(1).toRed(this);
          var nOne = one.redNeg();
          var lpow = this.m.subn(1).iushrn(1);
          var z = this.m.bitLength();
          z = new BN2(2 * z * z).toRed(this);
          while (this.pow(z, lpow).cmp(nOne) !== 0) {
            z.redIAdd(nOne);
          }
          var c = this.pow(z, q);
          var r = this.pow(a, q.addn(1).iushrn(1));
          var t = this.pow(a, q);
          var m = s;
          while (t.cmp(one) !== 0) {
            var tmp = t;
            for (var i2 = 0; tmp.cmp(one) !== 0; i2++) {
              tmp = tmp.redSqr();
            }
            assert3(i2 < m);
            var b = this.pow(c, new BN2(1).iushln(m - i2 - 1));
            r = r.redMul(b);
            c = b.redSqr();
            t = t.redMul(c);
            m = i2;
          }
          return r;
        };
        Red.prototype.invm = function invm(a) {
          var inv = a._invmp(this.m);
          if (inv.negative !== 0) {
            inv.negative = 0;
            return this.imod(inv).redNeg();
          } else {
            return this.imod(inv);
          }
        };
        Red.prototype.pow = function pow(a, num) {
          if (num.isZero()) return new BN2(1).toRed(this);
          if (num.cmpn(1) === 0) return a.clone();
          var windowSize = 4;
          var wnd = new Array(1 << windowSize);
          wnd[0] = new BN2(1).toRed(this);
          wnd[1] = a;
          for (var i2 = 2; i2 < wnd.length; i2++) {
            wnd[i2] = this.mul(wnd[i2 - 1], a);
          }
          var res = wnd[0];
          var current = 0;
          var currentLen = 0;
          var start = num.bitLength() % 26;
          if (start === 0) {
            start = 26;
          }
          for (i2 = num.length - 1; i2 >= 0; i2--) {
            var word = num.words[i2];
            for (var j = start - 1; j >= 0; j--) {
              var bit = word >> j & 1;
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
              if (currentLen !== windowSize && (i2 !== 0 || j !== 0)) continue;
              res = this.mul(res, wnd[current]);
              currentLen = 0;
              current = 0;
            }
            start = 26;
          }
          return res;
        };
        Red.prototype.convertTo = function convertTo(num) {
          var r = num.umod(this.m);
          return r === num ? r.clone() : r;
        };
        Red.prototype.convertFrom = function convertFrom(num) {
          var res = num.clone();
          res.red = null;
          return res;
        };
        BN2.mont = function mont(num) {
          return new Mont(num);
        };
        function Mont(m) {
          Red.call(this, m);
          this.shift = this.m.bitLength();
          if (this.shift % 26 !== 0) {
            this.shift += 26 - this.shift % 26;
          }
          this.r = new BN2(1).iushln(this.shift);
          this.r2 = this.imod(this.r.sqr());
          this.rinv = this.r._invmp(this.m);
          this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
          this.minv = this.minv.umod(this.r);
          this.minv = this.r.sub(this.minv);
        }
        inherits(Mont, Red);
        Mont.prototype.convertTo = function convertTo(num) {
          return this.imod(num.ushln(this.shift));
        };
        Mont.prototype.convertFrom = function convertFrom(num) {
          var r = this.imod(num.mul(this.rinv));
          r.red = null;
          return r;
        };
        Mont.prototype.imul = function imul(a, b) {
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
        Mont.prototype.mul = function mul(a, b) {
          if (a.isZero() || b.isZero()) return new BN2(0)._forceRed(this);
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
        Mont.prototype.invm = function invm(a) {
          var res = this.imod(a._invmp(this.m).mul(this.r2));
          return res._forceRed(this);
        };
      })(typeof module === "undefined" || module, exports);
    }
  });

  // node_modules/safe-buffer/index.js
  var require_safe_buffer = __commonJS({
    "node_modules/safe-buffer/index.js"(exports, module) {
      init_buffer_shim();
      var buffer = require_buffer();
      var Buffer5 = buffer.Buffer;
      function copyProps(src, dst) {
        for (var key in src) {
          dst[key] = src[key];
        }
      }
      if (Buffer5.from && Buffer5.alloc && Buffer5.allocUnsafe && Buffer5.allocUnsafeSlow) {
        module.exports = buffer;
      } else {
        copyProps(buffer, exports);
        exports.Buffer = SafeBuffer;
      }
      function SafeBuffer(arg, encodingOrOffset, length) {
        return Buffer5(arg, encodingOrOffset, length);
      }
      SafeBuffer.prototype = Object.create(Buffer5.prototype);
      copyProps(Buffer5, SafeBuffer);
      SafeBuffer.from = function(arg, encodingOrOffset, length) {
        if (typeof arg === "number") {
          throw new TypeError("Argument must not be a number");
        }
        return Buffer5(arg, encodingOrOffset, length);
      };
      SafeBuffer.alloc = function(size, fill, encoding) {
        if (typeof size !== "number") {
          throw new TypeError("Argument must be a number");
        }
        var buf = Buffer5(size);
        if (fill !== void 0) {
          if (typeof encoding === "string") {
            buf.fill(fill, encoding);
          } else {
            buf.fill(fill);
          }
        } else {
          buf.fill(0);
        }
        return buf;
      };
      SafeBuffer.allocUnsafe = function(size) {
        if (typeof size !== "number") {
          throw new TypeError("Argument must be a number");
        }
        return Buffer5(size);
      };
      SafeBuffer.allocUnsafeSlow = function(size) {
        if (typeof size !== "number") {
          throw new TypeError("Argument must be a number");
        }
        return buffer.SlowBuffer(size);
      };
    }
  });

  // node_modules/@solana/web3.js/node_modules/base-x/src/index.js
  var require_src = __commonJS({
    "node_modules/@solana/web3.js/node_modules/base-x/src/index.js"(exports, module) {
      "use strict";
      init_buffer_shim();
      var _Buffer = require_safe_buffer().Buffer;
      function base(ALPHABET) {
        if (ALPHABET.length >= 255) {
          throw new TypeError("Alphabet too long");
        }
        var BASE_MAP = new Uint8Array(256);
        for (var j = 0; j < BASE_MAP.length; j++) {
          BASE_MAP[j] = 255;
        }
        for (var i2 = 0; i2 < ALPHABET.length; i2++) {
          var x = ALPHABET.charAt(i2);
          var xc = x.charCodeAt(0);
          if (BASE_MAP[xc] !== 255) {
            throw new TypeError(x + " is ambiguous");
          }
          BASE_MAP[xc] = i2;
        }
        var BASE2 = ALPHABET.length;
        var LEADER = ALPHABET.charAt(0);
        var FACTOR = Math.log(BASE2) / Math.log(256);
        var iFACTOR = Math.log(256) / Math.log(BASE2);
        function encode(source) {
          if (Array.isArray(source) || source instanceof Uint8Array) {
            source = _Buffer.from(source);
          }
          if (!_Buffer.isBuffer(source)) {
            throw new TypeError("Expected Buffer");
          }
          if (source.length === 0) {
            return "";
          }
          var zeroes = 0;
          var length = 0;
          var pbegin = 0;
          var pend = source.length;
          while (pbegin !== pend && source[pbegin] === 0) {
            pbegin++;
            zeroes++;
          }
          var size = (pend - pbegin) * iFACTOR + 1 >>> 0;
          var b58 = new Uint8Array(size);
          while (pbegin !== pend) {
            var carry = source[pbegin];
            var i3 = 0;
            for (var it1 = size - 1; (carry !== 0 || i3 < length) && it1 !== -1; it1--, i3++) {
              carry += 256 * b58[it1] >>> 0;
              b58[it1] = carry % BASE2 >>> 0;
              carry = carry / BASE2 >>> 0;
            }
            if (carry !== 0) {
              throw new Error("Non-zero carry");
            }
            length = i3;
            pbegin++;
          }
          var it2 = size - length;
          while (it2 !== size && b58[it2] === 0) {
            it2++;
          }
          var str = LEADER.repeat(zeroes);
          for (; it2 < size; ++it2) {
            str += ALPHABET.charAt(b58[it2]);
          }
          return str;
        }
        function decodeUnsafe(source) {
          if (typeof source !== "string") {
            throw new TypeError("Expected String");
          }
          if (source.length === 0) {
            return _Buffer.alloc(0);
          }
          var psz = 0;
          var zeroes = 0;
          var length = 0;
          while (source[psz] === LEADER) {
            zeroes++;
            psz++;
          }
          var size = (source.length - psz) * FACTOR + 1 >>> 0;
          var b256 = new Uint8Array(size);
          while (psz < source.length) {
            var charCode = source.charCodeAt(psz);
            if (charCode > 255) {
              return;
            }
            var carry = BASE_MAP[charCode];
            if (carry === 255) {
              return;
            }
            var i3 = 0;
            for (var it3 = size - 1; (carry !== 0 || i3 < length) && it3 !== -1; it3--, i3++) {
              carry += BASE2 * b256[it3] >>> 0;
              b256[it3] = carry % 256 >>> 0;
              carry = carry / 256 >>> 0;
            }
            if (carry !== 0) {
              throw new Error("Non-zero carry");
            }
            length = i3;
            psz++;
          }
          var it4 = size - length;
          while (it4 !== size && b256[it4] === 0) {
            it4++;
          }
          var vch = _Buffer.allocUnsafe(zeroes + (size - it4));
          vch.fill(0, 0, zeroes);
          var j2 = zeroes;
          while (it4 !== size) {
            vch[j2++] = b256[it4++];
          }
          return vch;
        }
        function decode(string2) {
          var buffer = decodeUnsafe(string2);
          if (buffer) {
            return buffer;
          }
          throw new Error("Non-base" + BASE2 + " character");
        }
        return {
          encode,
          decodeUnsafe,
          decode
        };
      }
      module.exports = base;
    }
  });

  // node_modules/@solana/web3.js/node_modules/bs58/index.js
  var require_bs58 = __commonJS({
    "node_modules/@solana/web3.js/node_modules/bs58/index.js"(exports, module) {
      init_buffer_shim();
      var basex = require_src();
      var ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      module.exports = basex(ALPHABET);
    }
  });

  // node_modules/borsh/node_modules/base-x/src/index.js
  var require_src2 = __commonJS({
    "node_modules/borsh/node_modules/base-x/src/index.js"(exports, module) {
      "use strict";
      init_buffer_shim();
      var _Buffer = require_safe_buffer().Buffer;
      function base(ALPHABET) {
        if (ALPHABET.length >= 255) {
          throw new TypeError("Alphabet too long");
        }
        var BASE_MAP = new Uint8Array(256);
        for (var j = 0; j < BASE_MAP.length; j++) {
          BASE_MAP[j] = 255;
        }
        for (var i2 = 0; i2 < ALPHABET.length; i2++) {
          var x = ALPHABET.charAt(i2);
          var xc = x.charCodeAt(0);
          if (BASE_MAP[xc] !== 255) {
            throw new TypeError(x + " is ambiguous");
          }
          BASE_MAP[xc] = i2;
        }
        var BASE2 = ALPHABET.length;
        var LEADER = ALPHABET.charAt(0);
        var FACTOR = Math.log(BASE2) / Math.log(256);
        var iFACTOR = Math.log(256) / Math.log(BASE2);
        function encode(source) {
          if (Array.isArray(source) || source instanceof Uint8Array) {
            source = _Buffer.from(source);
          }
          if (!_Buffer.isBuffer(source)) {
            throw new TypeError("Expected Buffer");
          }
          if (source.length === 0) {
            return "";
          }
          var zeroes = 0;
          var length = 0;
          var pbegin = 0;
          var pend = source.length;
          while (pbegin !== pend && source[pbegin] === 0) {
            pbegin++;
            zeroes++;
          }
          var size = (pend - pbegin) * iFACTOR + 1 >>> 0;
          var b58 = new Uint8Array(size);
          while (pbegin !== pend) {
            var carry = source[pbegin];
            var i3 = 0;
            for (var it1 = size - 1; (carry !== 0 || i3 < length) && it1 !== -1; it1--, i3++) {
              carry += 256 * b58[it1] >>> 0;
              b58[it1] = carry % BASE2 >>> 0;
              carry = carry / BASE2 >>> 0;
            }
            if (carry !== 0) {
              throw new Error("Non-zero carry");
            }
            length = i3;
            pbegin++;
          }
          var it2 = size - length;
          while (it2 !== size && b58[it2] === 0) {
            it2++;
          }
          var str = LEADER.repeat(zeroes);
          for (; it2 < size; ++it2) {
            str += ALPHABET.charAt(b58[it2]);
          }
          return str;
        }
        function decodeUnsafe(source) {
          if (typeof source !== "string") {
            throw new TypeError("Expected String");
          }
          if (source.length === 0) {
            return _Buffer.alloc(0);
          }
          var psz = 0;
          var zeroes = 0;
          var length = 0;
          while (source[psz] === LEADER) {
            zeroes++;
            psz++;
          }
          var size = (source.length - psz) * FACTOR + 1 >>> 0;
          var b256 = new Uint8Array(size);
          while (psz < source.length) {
            var charCode = source.charCodeAt(psz);
            if (charCode > 255) {
              return;
            }
            var carry = BASE_MAP[charCode];
            if (carry === 255) {
              return;
            }
            var i3 = 0;
            for (var it3 = size - 1; (carry !== 0 || i3 < length) && it3 !== -1; it3--, i3++) {
              carry += BASE2 * b256[it3] >>> 0;
              b256[it3] = carry % 256 >>> 0;
              carry = carry / 256 >>> 0;
            }
            if (carry !== 0) {
              throw new Error("Non-zero carry");
            }
            length = i3;
            psz++;
          }
          var it4 = size - length;
          while (it4 !== size && b256[it4] === 0) {
            it4++;
          }
          var vch = _Buffer.allocUnsafe(zeroes + (size - it4));
          vch.fill(0, 0, zeroes);
          var j2 = zeroes;
          while (it4 !== size) {
            vch[j2++] = b256[it4++];
          }
          return vch;
        }
        function decode(string2) {
          var buffer = decodeUnsafe(string2);
          if (buffer) {
            return buffer;
          }
          throw new Error("Non-base" + BASE2 + " character");
        }
        return {
          encode,
          decodeUnsafe,
          decode
        };
      }
      module.exports = base;
    }
  });

  // node_modules/borsh/node_modules/bs58/index.js
  var require_bs582 = __commonJS({
    "node_modules/borsh/node_modules/bs58/index.js"(exports, module) {
      init_buffer_shim();
      var basex = require_src2();
      var ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      module.exports = basex(ALPHABET);
    }
  });

  // node_modules/text-encoding-utf-8/lib/encoding.lib.js
  var require_encoding_lib = __commonJS({
    "node_modules/text-encoding-utf-8/lib/encoding.lib.js"(exports) {
      "use strict";
      init_buffer_shim();
      function inRange2(a, min, max) {
        return min <= a && a <= max;
      }
      function ToDictionary(o) {
        if (o === void 0) return {};
        if (o === Object(o)) return o;
        throw TypeError("Could not convert argument to dictionary");
      }
      function stringToCodePoints(string2) {
        var s = String(string2);
        var n = s.length;
        var i2 = 0;
        var u = [];
        while (i2 < n) {
          var c = s.charCodeAt(i2);
          if (c < 55296 || c > 57343) {
            u.push(c);
          } else if (56320 <= c && c <= 57343) {
            u.push(65533);
          } else if (55296 <= c && c <= 56319) {
            if (i2 === n - 1) {
              u.push(65533);
            } else {
              var d = string2.charCodeAt(i2 + 1);
              if (56320 <= d && d <= 57343) {
                var a = c & 1023;
                var b = d & 1023;
                u.push(65536 + (a << 10) + b);
                i2 += 1;
              } else {
                u.push(65533);
              }
            }
          }
          i2 += 1;
        }
        return u;
      }
      function codePointsToString(code_points) {
        var s = "";
        for (var i2 = 0; i2 < code_points.length; ++i2) {
          var cp = code_points[i2];
          if (cp <= 65535) {
            s += String.fromCharCode(cp);
          } else {
            cp -= 65536;
            s += String.fromCharCode(
              (cp >> 10) + 55296,
              (cp & 1023) + 56320
            );
          }
        }
        return s;
      }
      var end_of_stream = -1;
      function Stream(tokens) {
        this.tokens = [].slice.call(tokens);
      }
      Stream.prototype = {
        /**
         * @return {boolean} True if end-of-stream has been hit.
         */
        endOfStream: function() {
          return !this.tokens.length;
        },
        /**
         * When a token is read from a stream, the first token in the
         * stream must be returned and subsequently removed, and
         * end-of-stream must be returned otherwise.
         *
         * @return {number} Get the next token from the stream, or
         * end_of_stream.
         */
        read: function() {
          if (!this.tokens.length)
            return end_of_stream;
          return this.tokens.shift();
        },
        /**
         * When one or more tokens are prepended to a stream, those tokens
         * must be inserted, in given order, before the first token in the
         * stream.
         *
         * @param {(number|!Array.<number>)} token The token(s) to prepend to the stream.
         */
        prepend: function(token) {
          if (Array.isArray(token)) {
            var tokens = (
              /**@type {!Array.<number>}*/
              token
            );
            while (tokens.length)
              this.tokens.unshift(tokens.pop());
          } else {
            this.tokens.unshift(token);
          }
        },
        /**
         * When one or more tokens are pushed to a stream, those tokens
         * must be inserted, in given order, after the last token in the
         * stream.
         *
         * @param {(number|!Array.<number>)} token The tokens(s) to prepend to the stream.
         */
        push: function(token) {
          if (Array.isArray(token)) {
            var tokens = (
              /**@type {!Array.<number>}*/
              token
            );
            while (tokens.length)
              this.tokens.push(tokens.shift());
          } else {
            this.tokens.push(token);
          }
        }
      };
      var finished = -1;
      function decoderError(fatal, opt_code_point) {
        if (fatal)
          throw TypeError("Decoder error");
        return opt_code_point || 65533;
      }
      var DEFAULT_ENCODING = "utf-8";
      function TextDecoder2(encoding, options) {
        if (!(this instanceof TextDecoder2)) {
          return new TextDecoder2(encoding, options);
        }
        encoding = encoding !== void 0 ? String(encoding).toLowerCase() : DEFAULT_ENCODING;
        if (encoding !== DEFAULT_ENCODING) {
          throw new Error("Encoding not supported. Only utf-8 is supported");
        }
        options = ToDictionary(options);
        this._streaming = false;
        this._BOMseen = false;
        this._decoder = null;
        this._fatal = Boolean(options["fatal"]);
        this._ignoreBOM = Boolean(options["ignoreBOM"]);
        Object.defineProperty(this, "encoding", { value: "utf-8" });
        Object.defineProperty(this, "fatal", { value: this._fatal });
        Object.defineProperty(this, "ignoreBOM", { value: this._ignoreBOM });
      }
      TextDecoder2.prototype = {
        /**
         * @param {ArrayBufferView=} input The buffer of bytes to decode.
         * @param {Object=} options
         * @return {string} The decoded string.
         */
        decode: function decode(input, options) {
          var bytes;
          if (typeof input === "object" && input instanceof ArrayBuffer) {
            bytes = new Uint8Array(input);
          } else if (typeof input === "object" && "buffer" in input && input.buffer instanceof ArrayBuffer) {
            bytes = new Uint8Array(
              input.buffer,
              input.byteOffset,
              input.byteLength
            );
          } else {
            bytes = new Uint8Array(0);
          }
          options = ToDictionary(options);
          if (!this._streaming) {
            this._decoder = new UTF8Decoder({ fatal: this._fatal });
            this._BOMseen = false;
          }
          this._streaming = Boolean(options["stream"]);
          var input_stream = new Stream(bytes);
          var code_points = [];
          var result;
          while (!input_stream.endOfStream()) {
            result = this._decoder.handler(input_stream, input_stream.read());
            if (result === finished)
              break;
            if (result === null)
              continue;
            if (Array.isArray(result))
              code_points.push.apply(
                code_points,
                /**@type {!Array.<number>}*/
                result
              );
            else
              code_points.push(result);
          }
          if (!this._streaming) {
            do {
              result = this._decoder.handler(input_stream, input_stream.read());
              if (result === finished)
                break;
              if (result === null)
                continue;
              if (Array.isArray(result))
                code_points.push.apply(
                  code_points,
                  /**@type {!Array.<number>}*/
                  result
                );
              else
                code_points.push(result);
            } while (!input_stream.endOfStream());
            this._decoder = null;
          }
          if (code_points.length) {
            if (["utf-8"].indexOf(this.encoding) !== -1 && !this._ignoreBOM && !this._BOMseen) {
              if (code_points[0] === 65279) {
                this._BOMseen = true;
                code_points.shift();
              } else {
                this._BOMseen = true;
              }
            }
          }
          return codePointsToString(code_points);
        }
      };
      function TextEncoder2(encoding, options) {
        if (!(this instanceof TextEncoder2))
          return new TextEncoder2(encoding, options);
        encoding = encoding !== void 0 ? String(encoding).toLowerCase() : DEFAULT_ENCODING;
        if (encoding !== DEFAULT_ENCODING) {
          throw new Error("Encoding not supported. Only utf-8 is supported");
        }
        options = ToDictionary(options);
        this._streaming = false;
        this._encoder = null;
        this._options = { fatal: Boolean(options["fatal"]) };
        Object.defineProperty(this, "encoding", { value: "utf-8" });
      }
      TextEncoder2.prototype = {
        /**
         * @param {string=} opt_string The string to encode.
         * @param {Object=} options
         * @return {Uint8Array} Encoded bytes, as a Uint8Array.
         */
        encode: function encode(opt_string, options) {
          opt_string = opt_string ? String(opt_string) : "";
          options = ToDictionary(options);
          if (!this._streaming)
            this._encoder = new UTF8Encoder(this._options);
          this._streaming = Boolean(options["stream"]);
          var bytes = [];
          var input_stream = new Stream(stringToCodePoints(opt_string));
          var result;
          while (!input_stream.endOfStream()) {
            result = this._encoder.handler(input_stream, input_stream.read());
            if (result === finished)
              break;
            if (Array.isArray(result))
              bytes.push.apply(
                bytes,
                /**@type {!Array.<number>}*/
                result
              );
            else
              bytes.push(result);
          }
          if (!this._streaming) {
            while (true) {
              result = this._encoder.handler(input_stream, input_stream.read());
              if (result === finished)
                break;
              if (Array.isArray(result))
                bytes.push.apply(
                  bytes,
                  /**@type {!Array.<number>}*/
                  result
                );
              else
                bytes.push(result);
            }
            this._encoder = null;
          }
          return new Uint8Array(bytes);
        }
      };
      function UTF8Decoder(options) {
        var fatal = options.fatal;
        var utf8_code_point = 0, utf8_bytes_seen = 0, utf8_bytes_needed = 0, utf8_lower_boundary = 128, utf8_upper_boundary = 191;
        this.handler = function(stream, bite) {
          if (bite === end_of_stream && utf8_bytes_needed !== 0) {
            utf8_bytes_needed = 0;
            return decoderError(fatal);
          }
          if (bite === end_of_stream)
            return finished;
          if (utf8_bytes_needed === 0) {
            if (inRange2(bite, 0, 127)) {
              return bite;
            }
            if (inRange2(bite, 194, 223)) {
              utf8_bytes_needed = 1;
              utf8_code_point = bite - 192;
            } else if (inRange2(bite, 224, 239)) {
              if (bite === 224)
                utf8_lower_boundary = 160;
              if (bite === 237)
                utf8_upper_boundary = 159;
              utf8_bytes_needed = 2;
              utf8_code_point = bite - 224;
            } else if (inRange2(bite, 240, 244)) {
              if (bite === 240)
                utf8_lower_boundary = 144;
              if (bite === 244)
                utf8_upper_boundary = 143;
              utf8_bytes_needed = 3;
              utf8_code_point = bite - 240;
            } else {
              return decoderError(fatal);
            }
            utf8_code_point = utf8_code_point << 6 * utf8_bytes_needed;
            return null;
          }
          if (!inRange2(bite, utf8_lower_boundary, utf8_upper_boundary)) {
            utf8_code_point = utf8_bytes_needed = utf8_bytes_seen = 0;
            utf8_lower_boundary = 128;
            utf8_upper_boundary = 191;
            stream.prepend(bite);
            return decoderError(fatal);
          }
          utf8_lower_boundary = 128;
          utf8_upper_boundary = 191;
          utf8_bytes_seen += 1;
          utf8_code_point += bite - 128 << 6 * (utf8_bytes_needed - utf8_bytes_seen);
          if (utf8_bytes_seen !== utf8_bytes_needed)
            return null;
          var code_point = utf8_code_point;
          utf8_code_point = utf8_bytes_needed = utf8_bytes_seen = 0;
          return code_point;
        };
      }
      function UTF8Encoder(options) {
        var fatal = options.fatal;
        this.handler = function(stream, code_point) {
          if (code_point === end_of_stream)
            return finished;
          if (inRange2(code_point, 0, 127))
            return code_point;
          var count, offset2;
          if (inRange2(code_point, 128, 2047)) {
            count = 1;
            offset2 = 192;
          } else if (inRange2(code_point, 2048, 65535)) {
            count = 2;
            offset2 = 224;
          } else if (inRange2(code_point, 65536, 1114111)) {
            count = 3;
            offset2 = 240;
          }
          var bytes = [(code_point >> 6 * count) + offset2];
          while (count > 0) {
            var temp = code_point >> 6 * (count - 1);
            bytes.push(128 | temp & 63);
            count -= 1;
          }
          return bytes;
        };
      }
      exports.TextEncoder = TextEncoder2;
      exports.TextDecoder = TextDecoder2;
    }
  });

  // node_modules/borsh/lib/index.js
  var require_lib = __commonJS({
    "node_modules/borsh/lib/index.js"(exports) {
      "use strict";
      init_buffer_shim();
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        Object.defineProperty(o, k2, { enumerable: true, get: function() {
          return m[k];
        } });
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }) : function(o, v) {
        o["default"] = v;
      });
      var __decorate = exports && exports.__decorate || function(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i2 = decorators.length - 1; i2 >= 0; i2--) if (d = decorators[i2]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
      };
      var __importStar = exports && exports.__importStar || function(mod2) {
        if (mod2 && mod2.__esModule) return mod2;
        var result = {};
        if (mod2 != null) {
          for (var k in mod2) if (k !== "default" && Object.hasOwnProperty.call(mod2, k)) __createBinding(result, mod2, k);
        }
        __setModuleDefault(result, mod2);
        return result;
      };
      var __importDefault = exports && exports.__importDefault || function(mod2) {
        return mod2 && mod2.__esModule ? mod2 : { "default": mod2 };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.deserializeUnchecked = exports.deserialize = exports.serialize = exports.BinaryReader = exports.BinaryWriter = exports.BorshError = exports.baseDecode = exports.baseEncode = void 0;
      var bn_js_1 = __importDefault(require_bn());
      var bs58_1 = __importDefault(require_bs582());
      var encoding = __importStar(require_encoding_lib());
      var ResolvedTextDecoder = typeof TextDecoder !== "function" ? encoding.TextDecoder : TextDecoder;
      var textDecoder = new ResolvedTextDecoder("utf-8", { fatal: true });
      function baseEncode(value) {
        if (typeof value === "string") {
          value = Buffer.from(value, "utf8");
        }
        return bs58_1.default.encode(Buffer.from(value));
      }
      exports.baseEncode = baseEncode;
      function baseDecode(value) {
        return Buffer.from(bs58_1.default.decode(value));
      }
      exports.baseDecode = baseDecode;
      var INITIAL_LENGTH = 1024;
      var BorshError = class extends Error {
        constructor(message) {
          super(message);
          this.fieldPath = [];
          this.originalMessage = message;
        }
        addToFieldPath(fieldName) {
          this.fieldPath.splice(0, 0, fieldName);
          this.message = this.originalMessage + ": " + this.fieldPath.join(".");
        }
      };
      exports.BorshError = BorshError;
      var BinaryWriter = class {
        constructor() {
          this.buf = Buffer.alloc(INITIAL_LENGTH);
          this.length = 0;
        }
        maybeResize() {
          if (this.buf.length < 16 + this.length) {
            this.buf = Buffer.concat([this.buf, Buffer.alloc(INITIAL_LENGTH)]);
          }
        }
        writeU8(value) {
          this.maybeResize();
          this.buf.writeUInt8(value, this.length);
          this.length += 1;
        }
        writeU16(value) {
          this.maybeResize();
          this.buf.writeUInt16LE(value, this.length);
          this.length += 2;
        }
        writeU32(value) {
          this.maybeResize();
          this.buf.writeUInt32LE(value, this.length);
          this.length += 4;
        }
        writeU64(value) {
          this.maybeResize();
          this.writeBuffer(Buffer.from(new bn_js_1.default(value).toArray("le", 8)));
        }
        writeU128(value) {
          this.maybeResize();
          this.writeBuffer(Buffer.from(new bn_js_1.default(value).toArray("le", 16)));
        }
        writeU256(value) {
          this.maybeResize();
          this.writeBuffer(Buffer.from(new bn_js_1.default(value).toArray("le", 32)));
        }
        writeU512(value) {
          this.maybeResize();
          this.writeBuffer(Buffer.from(new bn_js_1.default(value).toArray("le", 64)));
        }
        writeBuffer(buffer) {
          this.buf = Buffer.concat([
            Buffer.from(this.buf.subarray(0, this.length)),
            buffer,
            Buffer.alloc(INITIAL_LENGTH)
          ]);
          this.length += buffer.length;
        }
        writeString(str) {
          this.maybeResize();
          const b = Buffer.from(str, "utf8");
          this.writeU32(b.length);
          this.writeBuffer(b);
        }
        writeFixedArray(array2) {
          this.writeBuffer(Buffer.from(array2));
        }
        writeArray(array2, fn) {
          this.maybeResize();
          this.writeU32(array2.length);
          for (const elem of array2) {
            this.maybeResize();
            fn(elem);
          }
        }
        toArray() {
          return this.buf.subarray(0, this.length);
        }
      };
      exports.BinaryWriter = BinaryWriter;
      function handlingRangeError(target, propertyKey, propertyDescriptor) {
        const originalMethod = propertyDescriptor.value;
        propertyDescriptor.value = function(...args) {
          try {
            return originalMethod.apply(this, args);
          } catch (e) {
            if (e instanceof RangeError) {
              const code = e.code;
              if (["ERR_BUFFER_OUT_OF_BOUNDS", "ERR_OUT_OF_RANGE"].indexOf(code) >= 0) {
                throw new BorshError("Reached the end of buffer when deserializing");
              }
            }
            throw e;
          }
        };
      }
      var BinaryReader = class {
        constructor(buf) {
          this.buf = buf;
          this.offset = 0;
        }
        readU8() {
          const value = this.buf.readUInt8(this.offset);
          this.offset += 1;
          return value;
        }
        readU16() {
          const value = this.buf.readUInt16LE(this.offset);
          this.offset += 2;
          return value;
        }
        readU32() {
          const value = this.buf.readUInt32LE(this.offset);
          this.offset += 4;
          return value;
        }
        readU64() {
          const buf = this.readBuffer(8);
          return new bn_js_1.default(buf, "le");
        }
        readU128() {
          const buf = this.readBuffer(16);
          return new bn_js_1.default(buf, "le");
        }
        readU256() {
          const buf = this.readBuffer(32);
          return new bn_js_1.default(buf, "le");
        }
        readU512() {
          const buf = this.readBuffer(64);
          return new bn_js_1.default(buf, "le");
        }
        readBuffer(len) {
          if (this.offset + len > this.buf.length) {
            throw new BorshError(`Expected buffer length ${len} isn't within bounds`);
          }
          const result = this.buf.slice(this.offset, this.offset + len);
          this.offset += len;
          return result;
        }
        readString() {
          const len = this.readU32();
          const buf = this.readBuffer(len);
          try {
            return textDecoder.decode(buf);
          } catch (e) {
            throw new BorshError(`Error decoding UTF-8 string: ${e}`);
          }
        }
        readFixedArray(len) {
          return new Uint8Array(this.readBuffer(len));
        }
        readArray(fn) {
          const len = this.readU32();
          const result = Array();
          for (let i2 = 0; i2 < len; ++i2) {
            result.push(fn());
          }
          return result;
        }
      };
      __decorate([
        handlingRangeError
      ], BinaryReader.prototype, "readU8", null);
      __decorate([
        handlingRangeError
      ], BinaryReader.prototype, "readU16", null);
      __decorate([
        handlingRangeError
      ], BinaryReader.prototype, "readU32", null);
      __decorate([
        handlingRangeError
      ], BinaryReader.prototype, "readU64", null);
      __decorate([
        handlingRangeError
      ], BinaryReader.prototype, "readU128", null);
      __decorate([
        handlingRangeError
      ], BinaryReader.prototype, "readU256", null);
      __decorate([
        handlingRangeError
      ], BinaryReader.prototype, "readU512", null);
      __decorate([
        handlingRangeError
      ], BinaryReader.prototype, "readString", null);
      __decorate([
        handlingRangeError
      ], BinaryReader.prototype, "readFixedArray", null);
      __decorate([
        handlingRangeError
      ], BinaryReader.prototype, "readArray", null);
      exports.BinaryReader = BinaryReader;
      function capitalizeFirstLetter(string2) {
        return string2.charAt(0).toUpperCase() + string2.slice(1);
      }
      function serializeField(schema, fieldName, value, fieldType, writer) {
        try {
          if (typeof fieldType === "string") {
            writer[`write${capitalizeFirstLetter(fieldType)}`](value);
          } else if (fieldType instanceof Array) {
            if (typeof fieldType[0] === "number") {
              if (value.length !== fieldType[0]) {
                throw new BorshError(`Expecting byte array of length ${fieldType[0]}, but got ${value.length} bytes`);
              }
              writer.writeFixedArray(value);
            } else if (fieldType.length === 2 && typeof fieldType[1] === "number") {
              if (value.length !== fieldType[1]) {
                throw new BorshError(`Expecting byte array of length ${fieldType[1]}, but got ${value.length} bytes`);
              }
              for (let i2 = 0; i2 < fieldType[1]; i2++) {
                serializeField(schema, null, value[i2], fieldType[0], writer);
              }
            } else {
              writer.writeArray(value, (item) => {
                serializeField(schema, fieldName, item, fieldType[0], writer);
              });
            }
          } else if (fieldType.kind !== void 0) {
            switch (fieldType.kind) {
              case "option": {
                if (value === null || value === void 0) {
                  writer.writeU8(0);
                } else {
                  writer.writeU8(1);
                  serializeField(schema, fieldName, value, fieldType.type, writer);
                }
                break;
              }
              case "map": {
                writer.writeU32(value.size);
                value.forEach((val, key) => {
                  serializeField(schema, fieldName, key, fieldType.key, writer);
                  serializeField(schema, fieldName, val, fieldType.value, writer);
                });
                break;
              }
              default:
                throw new BorshError(`FieldType ${fieldType} unrecognized`);
            }
          } else {
            serializeStruct(schema, value, writer);
          }
        } catch (error) {
          if (error instanceof BorshError) {
            error.addToFieldPath(fieldName);
          }
          throw error;
        }
      }
      function serializeStruct(schema, obj, writer) {
        if (typeof obj.borshSerialize === "function") {
          obj.borshSerialize(writer);
          return;
        }
        const structSchema = schema.get(obj.constructor);
        if (!structSchema) {
          throw new BorshError(`Class ${obj.constructor.name} is missing in schema`);
        }
        if (structSchema.kind === "struct") {
          structSchema.fields.map(([fieldName, fieldType]) => {
            serializeField(schema, fieldName, obj[fieldName], fieldType, writer);
          });
        } else if (structSchema.kind === "enum") {
          const name = obj[structSchema.field];
          for (let idx = 0; idx < structSchema.values.length; ++idx) {
            const [fieldName, fieldType] = structSchema.values[idx];
            if (fieldName === name) {
              writer.writeU8(idx);
              serializeField(schema, fieldName, obj[fieldName], fieldType, writer);
              break;
            }
          }
        } else {
          throw new BorshError(`Unexpected schema kind: ${structSchema.kind} for ${obj.constructor.name}`);
        }
      }
      function serialize2(schema, obj, Writer = BinaryWriter) {
        const writer = new Writer();
        serializeStruct(schema, obj, writer);
        return writer.toArray();
      }
      exports.serialize = serialize2;
      function deserializeField(schema, fieldName, fieldType, reader) {
        try {
          if (typeof fieldType === "string") {
            return reader[`read${capitalizeFirstLetter(fieldType)}`]();
          }
          if (fieldType instanceof Array) {
            if (typeof fieldType[0] === "number") {
              return reader.readFixedArray(fieldType[0]);
            } else if (typeof fieldType[1] === "number") {
              const arr = [];
              for (let i2 = 0; i2 < fieldType[1]; i2++) {
                arr.push(deserializeField(schema, null, fieldType[0], reader));
              }
              return arr;
            } else {
              return reader.readArray(() => deserializeField(schema, fieldName, fieldType[0], reader));
            }
          }
          if (fieldType.kind === "option") {
            const option = reader.readU8();
            if (option) {
              return deserializeField(schema, fieldName, fieldType.type, reader);
            }
            return void 0;
          }
          if (fieldType.kind === "map") {
            let map = /* @__PURE__ */ new Map();
            const length = reader.readU32();
            for (let i2 = 0; i2 < length; i2++) {
              const key = deserializeField(schema, fieldName, fieldType.key, reader);
              const val = deserializeField(schema, fieldName, fieldType.value, reader);
              map.set(key, val);
            }
            return map;
          }
          return deserializeStruct(schema, fieldType, reader);
        } catch (error) {
          if (error instanceof BorshError) {
            error.addToFieldPath(fieldName);
          }
          throw error;
        }
      }
      function deserializeStruct(schema, classType, reader) {
        if (typeof classType.borshDeserialize === "function") {
          return classType.borshDeserialize(reader);
        }
        const structSchema = schema.get(classType);
        if (!structSchema) {
          throw new BorshError(`Class ${classType.name} is missing in schema`);
        }
        if (structSchema.kind === "struct") {
          const result = {};
          for (const [fieldName, fieldType] of schema.get(classType).fields) {
            result[fieldName] = deserializeField(schema, fieldName, fieldType, reader);
          }
          return new classType(result);
        }
        if (structSchema.kind === "enum") {
          const idx = reader.readU8();
          if (idx >= structSchema.values.length) {
            throw new BorshError(`Enum index: ${idx} is out of range`);
          }
          const [fieldName, fieldType] = structSchema.values[idx];
          const fieldValue = deserializeField(schema, fieldName, fieldType, reader);
          return new classType({ [fieldName]: fieldValue });
        }
        throw new BorshError(`Unexpected schema kind: ${structSchema.kind} for ${classType.constructor.name}`);
      }
      function deserialize2(schema, classType, buffer, Reader = BinaryReader) {
        const reader = new Reader(buffer);
        const result = deserializeStruct(schema, classType, reader);
        if (reader.offset < buffer.length) {
          throw new BorshError(`Unexpected ${buffer.length - reader.offset} bytes after deserialized data`);
        }
        return result;
      }
      exports.deserialize = deserialize2;
      function deserializeUnchecked2(schema, classType, buffer, Reader = BinaryReader) {
        const reader = new Reader(buffer);
        return deserializeStruct(schema, classType, reader);
      }
      exports.deserializeUnchecked = deserializeUnchecked2;
    }
  });

  // node_modules/@solana/buffer-layout/lib/Layout.js
  var require_Layout = __commonJS({
    "node_modules/@solana/buffer-layout/lib/Layout.js"(exports) {
      "use strict";
      init_buffer_shim();
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.s16 = exports.s8 = exports.nu64be = exports.u48be = exports.u40be = exports.u32be = exports.u24be = exports.u16be = exports.nu64 = exports.u48 = exports.u40 = exports.u32 = exports.u24 = exports.u16 = exports.u8 = exports.offset = exports.greedy = exports.Constant = exports.UTF8 = exports.CString = exports.Blob = exports.Boolean = exports.BitField = exports.BitStructure = exports.VariantLayout = exports.Union = exports.UnionLayoutDiscriminator = exports.UnionDiscriminator = exports.Structure = exports.Sequence = exports.DoubleBE = exports.Double = exports.FloatBE = exports.Float = exports.NearInt64BE = exports.NearInt64 = exports.NearUInt64BE = exports.NearUInt64 = exports.IntBE = exports.Int = exports.UIntBE = exports.UInt = exports.OffsetLayout = exports.GreedyCount = exports.ExternalLayout = exports.bindConstructorLayout = exports.nameWithProperty = exports.Layout = exports.uint8ArrayToBuffer = exports.checkUint8Array = void 0;
      exports.constant = exports.utf8 = exports.cstr = exports.blob = exports.unionLayoutDiscriminator = exports.union = exports.seq = exports.bits = exports.struct = exports.f64be = exports.f64 = exports.f32be = exports.f32 = exports.ns64be = exports.s48be = exports.s40be = exports.s32be = exports.s24be = exports.s16be = exports.ns64 = exports.s48 = exports.s40 = exports.s32 = exports.s24 = void 0;
      var buffer_1 = require_buffer();
      function checkUint8Array(b) {
        if (!(b instanceof Uint8Array)) {
          throw new TypeError("b must be a Uint8Array");
        }
      }
      exports.checkUint8Array = checkUint8Array;
      function uint8ArrayToBuffer(b) {
        checkUint8Array(b);
        return buffer_1.Buffer.from(b.buffer, b.byteOffset, b.length);
      }
      exports.uint8ArrayToBuffer = uint8ArrayToBuffer;
      var Layout = class {
        constructor(span, property) {
          if (!Number.isInteger(span)) {
            throw new TypeError("span must be an integer");
          }
          this.span = span;
          this.property = property;
        }
        /** Function to create an Object into which decoded properties will
         * be written.
         *
         * Used only for layouts that {@link Layout#decode|decode} to Object
         * instances, which means:
         * * {@link Structure}
         * * {@link Union}
         * * {@link VariantLayout}
         * * {@link BitStructure}
         *
         * If left undefined the JavaScript representation of these layouts
         * will be Object instances.
         *
         * See {@link bindConstructorLayout}.
         */
        makeDestinationObject() {
          return {};
        }
        /**
         * Calculate the span of a specific instance of a layout.
         *
         * @param {Uint8Array} b - the buffer that contains an encoded instance.
         *
         * @param {Number} [offset] - the offset at which the encoded instance
         * starts.  If absent a zero offset is inferred.
         *
         * @return {Number} - the number of bytes covered by the layout
         * instance.  If this method is not overridden in a subclass the
         * definition-time constant {@link Layout#span|span} will be
         * returned.
         *
         * @throws {RangeError} - if the length of the value cannot be
         * determined.
         */
        getSpan(b, offset2) {
          if (0 > this.span) {
            throw new RangeError("indeterminate span");
          }
          return this.span;
        }
        /**
         * Replicate the layout using a new property.
         *
         * This function must be used to get a structurally-equivalent layout
         * with a different name since all {@link Layout} instances are
         * immutable.
         *
         * **NOTE** This is a shallow copy.  All fields except {@link
         * Layout#property|property} are strictly equal to the origin layout.
         *
         * @param {String} property - the value for {@link
         * Layout#property|property} in the replica.
         *
         * @returns {Layout} - the copy with {@link Layout#property|property}
         * set to `property`.
         */
        replicate(property) {
          const rv = Object.create(this.constructor.prototype);
          Object.assign(rv, this);
          rv.property = property;
          return rv;
        }
        /**
         * Create an object from layout properties and an array of values.
         *
         * **NOTE** This function returns `undefined` if invoked on a layout
         * that does not return its value as an Object.  Objects are
         * returned for things that are a {@link Structure}, which includes
         * {@link VariantLayout|variant layouts} if they are structures, and
         * excludes {@link Union}s.  If you want this feature for a union
         * you must use {@link Union.getVariant|getVariant} to select the
         * desired layout.
         *
         * @param {Array} values - an array of values that correspond to the
         * default order for properties.  As with {@link Layout#decode|decode}
         * layout elements that have no property name are skipped when
         * iterating over the array values.  Only the top-level properties are
         * assigned; arguments are not assigned to properties of contained
         * layouts.  Any unused values are ignored.
         *
         * @return {(Object|undefined)}
         */
        fromArray(values) {
          return void 0;
        }
      };
      exports.Layout = Layout;
      function nameWithProperty(name, lo) {
        if (lo.property) {
          return name + "[" + lo.property + "]";
        }
        return name;
      }
      exports.nameWithProperty = nameWithProperty;
      function bindConstructorLayout(Class, layout) {
        if ("function" !== typeof Class) {
          throw new TypeError("Class must be constructor");
        }
        if (Object.prototype.hasOwnProperty.call(Class, "layout_")) {
          throw new Error("Class is already bound to a layout");
        }
        if (!(layout && layout instanceof Layout)) {
          throw new TypeError("layout must be a Layout");
        }
        if (Object.prototype.hasOwnProperty.call(layout, "boundConstructor_")) {
          throw new Error("layout is already bound to a constructor");
        }
        Class.layout_ = layout;
        layout.boundConstructor_ = Class;
        layout.makeDestinationObject = (() => new Class());
        Object.defineProperty(Class.prototype, "encode", {
          value(b, offset2) {
            return layout.encode(this, b, offset2);
          },
          writable: true
        });
        Object.defineProperty(Class, "decode", {
          value(b, offset2) {
            return layout.decode(b, offset2);
          },
          writable: true
        });
      }
      exports.bindConstructorLayout = bindConstructorLayout;
      var ExternalLayout = class extends Layout {
        /**
         * Return `true` iff the external layout decodes to an unsigned
         * integer layout.
         *
         * In that case it can be used as the source of {@link
         * Sequence#count|Sequence counts}, {@link Blob#length|Blob lengths},
         * or as {@link UnionLayoutDiscriminator#layout|external union
         * discriminators}.
         *
         * @abstract
         */
        isCount() {
          throw new Error("ExternalLayout is abstract");
        }
      };
      exports.ExternalLayout = ExternalLayout;
      var GreedyCount = class extends ExternalLayout {
        constructor(elementSpan = 1, property) {
          if (!Number.isInteger(elementSpan) || 0 >= elementSpan) {
            throw new TypeError("elementSpan must be a (positive) integer");
          }
          super(-1, property);
          this.elementSpan = elementSpan;
        }
        /** @override */
        isCount() {
          return true;
        }
        /** @override */
        decode(b, offset2 = 0) {
          checkUint8Array(b);
          const rem = b.length - offset2;
          return Math.floor(rem / this.elementSpan);
        }
        /** @override */
        encode(src, b, offset2) {
          return 0;
        }
      };
      exports.GreedyCount = GreedyCount;
      var OffsetLayout = class extends ExternalLayout {
        constructor(layout, offset2 = 0, property) {
          if (!(layout instanceof Layout)) {
            throw new TypeError("layout must be a Layout");
          }
          if (!Number.isInteger(offset2)) {
            throw new TypeError("offset must be integer or undefined");
          }
          super(layout.span, property || layout.property);
          this.layout = layout;
          this.offset = offset2;
        }
        /** @override */
        isCount() {
          return this.layout instanceof UInt || this.layout instanceof UIntBE;
        }
        /** @override */
        decode(b, offset2 = 0) {
          return this.layout.decode(b, offset2 + this.offset);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          return this.layout.encode(src, b, offset2 + this.offset);
        }
      };
      exports.OffsetLayout = OffsetLayout;
      var UInt = class extends Layout {
        constructor(span, property) {
          super(span, property);
          if (6 < this.span) {
            throw new RangeError("span must not exceed 6 bytes");
          }
        }
        /** @override */
        decode(b, offset2 = 0) {
          return uint8ArrayToBuffer(b).readUIntLE(offset2, this.span);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          uint8ArrayToBuffer(b).writeUIntLE(src, offset2, this.span);
          return this.span;
        }
      };
      exports.UInt = UInt;
      var UIntBE = class extends Layout {
        constructor(span, property) {
          super(span, property);
          if (6 < this.span) {
            throw new RangeError("span must not exceed 6 bytes");
          }
        }
        /** @override */
        decode(b, offset2 = 0) {
          return uint8ArrayToBuffer(b).readUIntBE(offset2, this.span);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          uint8ArrayToBuffer(b).writeUIntBE(src, offset2, this.span);
          return this.span;
        }
      };
      exports.UIntBE = UIntBE;
      var Int = class extends Layout {
        constructor(span, property) {
          super(span, property);
          if (6 < this.span) {
            throw new RangeError("span must not exceed 6 bytes");
          }
        }
        /** @override */
        decode(b, offset2 = 0) {
          return uint8ArrayToBuffer(b).readIntLE(offset2, this.span);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          uint8ArrayToBuffer(b).writeIntLE(src, offset2, this.span);
          return this.span;
        }
      };
      exports.Int = Int;
      var IntBE = class extends Layout {
        constructor(span, property) {
          super(span, property);
          if (6 < this.span) {
            throw new RangeError("span must not exceed 6 bytes");
          }
        }
        /** @override */
        decode(b, offset2 = 0) {
          return uint8ArrayToBuffer(b).readIntBE(offset2, this.span);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          uint8ArrayToBuffer(b).writeIntBE(src, offset2, this.span);
          return this.span;
        }
      };
      exports.IntBE = IntBE;
      var V2E32 = Math.pow(2, 32);
      function divmodInt64(src) {
        const hi32 = Math.floor(src / V2E32);
        const lo32 = src - hi32 * V2E32;
        return { hi32, lo32 };
      }
      function roundedInt64(hi32, lo32) {
        return hi32 * V2E32 + lo32;
      }
      var NearUInt64 = class extends Layout {
        constructor(property) {
          super(8, property);
        }
        /** @override */
        decode(b, offset2 = 0) {
          const buffer = uint8ArrayToBuffer(b);
          const lo32 = buffer.readUInt32LE(offset2);
          const hi32 = buffer.readUInt32LE(offset2 + 4);
          return roundedInt64(hi32, lo32);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          const split2 = divmodInt64(src);
          const buffer = uint8ArrayToBuffer(b);
          buffer.writeUInt32LE(split2.lo32, offset2);
          buffer.writeUInt32LE(split2.hi32, offset2 + 4);
          return 8;
        }
      };
      exports.NearUInt64 = NearUInt64;
      var NearUInt64BE = class extends Layout {
        constructor(property) {
          super(8, property);
        }
        /** @override */
        decode(b, offset2 = 0) {
          const buffer = uint8ArrayToBuffer(b);
          const hi32 = buffer.readUInt32BE(offset2);
          const lo32 = buffer.readUInt32BE(offset2 + 4);
          return roundedInt64(hi32, lo32);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          const split2 = divmodInt64(src);
          const buffer = uint8ArrayToBuffer(b);
          buffer.writeUInt32BE(split2.hi32, offset2);
          buffer.writeUInt32BE(split2.lo32, offset2 + 4);
          return 8;
        }
      };
      exports.NearUInt64BE = NearUInt64BE;
      var NearInt64 = class extends Layout {
        constructor(property) {
          super(8, property);
        }
        /** @override */
        decode(b, offset2 = 0) {
          const buffer = uint8ArrayToBuffer(b);
          const lo32 = buffer.readUInt32LE(offset2);
          const hi32 = buffer.readInt32LE(offset2 + 4);
          return roundedInt64(hi32, lo32);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          const split2 = divmodInt64(src);
          const buffer = uint8ArrayToBuffer(b);
          buffer.writeUInt32LE(split2.lo32, offset2);
          buffer.writeInt32LE(split2.hi32, offset2 + 4);
          return 8;
        }
      };
      exports.NearInt64 = NearInt64;
      var NearInt64BE = class extends Layout {
        constructor(property) {
          super(8, property);
        }
        /** @override */
        decode(b, offset2 = 0) {
          const buffer = uint8ArrayToBuffer(b);
          const hi32 = buffer.readInt32BE(offset2);
          const lo32 = buffer.readUInt32BE(offset2 + 4);
          return roundedInt64(hi32, lo32);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          const split2 = divmodInt64(src);
          const buffer = uint8ArrayToBuffer(b);
          buffer.writeInt32BE(split2.hi32, offset2);
          buffer.writeUInt32BE(split2.lo32, offset2 + 4);
          return 8;
        }
      };
      exports.NearInt64BE = NearInt64BE;
      var Float = class extends Layout {
        constructor(property) {
          super(4, property);
        }
        /** @override */
        decode(b, offset2 = 0) {
          return uint8ArrayToBuffer(b).readFloatLE(offset2);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          uint8ArrayToBuffer(b).writeFloatLE(src, offset2);
          return 4;
        }
      };
      exports.Float = Float;
      var FloatBE = class extends Layout {
        constructor(property) {
          super(4, property);
        }
        /** @override */
        decode(b, offset2 = 0) {
          return uint8ArrayToBuffer(b).readFloatBE(offset2);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          uint8ArrayToBuffer(b).writeFloatBE(src, offset2);
          return 4;
        }
      };
      exports.FloatBE = FloatBE;
      var Double = class extends Layout {
        constructor(property) {
          super(8, property);
        }
        /** @override */
        decode(b, offset2 = 0) {
          return uint8ArrayToBuffer(b).readDoubleLE(offset2);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          uint8ArrayToBuffer(b).writeDoubleLE(src, offset2);
          return 8;
        }
      };
      exports.Double = Double;
      var DoubleBE = class extends Layout {
        constructor(property) {
          super(8, property);
        }
        /** @override */
        decode(b, offset2 = 0) {
          return uint8ArrayToBuffer(b).readDoubleBE(offset2);
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          uint8ArrayToBuffer(b).writeDoubleBE(src, offset2);
          return 8;
        }
      };
      exports.DoubleBE = DoubleBE;
      var Sequence = class extends Layout {
        constructor(elementLayout, count, property) {
          if (!(elementLayout instanceof Layout)) {
            throw new TypeError("elementLayout must be a Layout");
          }
          if (!(count instanceof ExternalLayout && count.isCount() || Number.isInteger(count) && 0 <= count)) {
            throw new TypeError("count must be non-negative integer or an unsigned integer ExternalLayout");
          }
          let span = -1;
          if (!(count instanceof ExternalLayout) && 0 < elementLayout.span) {
            span = count * elementLayout.span;
          }
          super(span, property);
          this.elementLayout = elementLayout;
          this.count = count;
        }
        /** @override */
        getSpan(b, offset2 = 0) {
          if (0 <= this.span) {
            return this.span;
          }
          let span = 0;
          let count = this.count;
          if (count instanceof ExternalLayout) {
            count = count.decode(b, offset2);
          }
          if (0 < this.elementLayout.span) {
            span = count * this.elementLayout.span;
          } else {
            let idx = 0;
            while (idx < count) {
              span += this.elementLayout.getSpan(b, offset2 + span);
              ++idx;
            }
          }
          return span;
        }
        /** @override */
        decode(b, offset2 = 0) {
          const rv = [];
          let i2 = 0;
          let count = this.count;
          if (count instanceof ExternalLayout) {
            count = count.decode(b, offset2);
          }
          while (i2 < count) {
            rv.push(this.elementLayout.decode(b, offset2));
            offset2 += this.elementLayout.getSpan(b, offset2);
            i2 += 1;
          }
          return rv;
        }
        /** Implement {@link Layout#encode|encode} for {@link Sequence}.
         *
         * **NOTE** If `src` is shorter than {@link Sequence#count|count} then
         * the unused space in the buffer is left unchanged.  If `src` is
         * longer than {@link Sequence#count|count} the unneeded elements are
         * ignored.
         *
         * **NOTE** If {@link Layout#count|count} is an instance of {@link
         * ExternalLayout} then the length of `src` will be encoded as the
         * count after `src` is encoded. */
        encode(src, b, offset2 = 0) {
          const elo = this.elementLayout;
          const span = src.reduce((span2, v) => {
            return span2 + elo.encode(v, b, offset2 + span2);
          }, 0);
          if (this.count instanceof ExternalLayout) {
            this.count.encode(src.length, b, offset2);
          }
          return span;
        }
      };
      exports.Sequence = Sequence;
      var Structure = class extends Layout {
        constructor(fields, property, decodePrefixes) {
          if (!(Array.isArray(fields) && fields.reduce((acc, v) => acc && v instanceof Layout, true))) {
            throw new TypeError("fields must be array of Layout instances");
          }
          if ("boolean" === typeof property && void 0 === decodePrefixes) {
            decodePrefixes = property;
            property = void 0;
          }
          for (const fd of fields) {
            if (0 > fd.span && void 0 === fd.property) {
              throw new Error("fields cannot contain unnamed variable-length layout");
            }
          }
          let span = -1;
          try {
            span = fields.reduce((span2, fd) => span2 + fd.getSpan(), 0);
          } catch (e) {
          }
          super(span, property);
          this.fields = fields;
          this.decodePrefixes = !!decodePrefixes;
        }
        /** @override */
        getSpan(b, offset2 = 0) {
          if (0 <= this.span) {
            return this.span;
          }
          let span = 0;
          try {
            span = this.fields.reduce((span2, fd) => {
              const fsp = fd.getSpan(b, offset2);
              offset2 += fsp;
              return span2 + fsp;
            }, 0);
          } catch (e) {
            throw new RangeError("indeterminate span");
          }
          return span;
        }
        /** @override */
        decode(b, offset2 = 0) {
          checkUint8Array(b);
          const dest = this.makeDestinationObject();
          for (const fd of this.fields) {
            if (void 0 !== fd.property) {
              dest[fd.property] = fd.decode(b, offset2);
            }
            offset2 += fd.getSpan(b, offset2);
            if (this.decodePrefixes && b.length === offset2) {
              break;
            }
          }
          return dest;
        }
        /** Implement {@link Layout#encode|encode} for {@link Structure}.
         *
         * If `src` is missing a property for a member with a defined {@link
         * Layout#property|property} the corresponding region of the buffer is
         * left unmodified. */
        encode(src, b, offset2 = 0) {
          const firstOffset = offset2;
          let lastOffset = 0;
          let lastWrote = 0;
          for (const fd of this.fields) {
            let span = fd.span;
            lastWrote = 0 < span ? span : 0;
            if (void 0 !== fd.property) {
              const fv = src[fd.property];
              if (void 0 !== fv) {
                lastWrote = fd.encode(fv, b, offset2);
                if (0 > span) {
                  span = fd.getSpan(b, offset2);
                }
              }
            }
            lastOffset = offset2;
            offset2 += span;
          }
          return lastOffset + lastWrote - firstOffset;
        }
        /** @override */
        fromArray(values) {
          const dest = this.makeDestinationObject();
          for (const fd of this.fields) {
            if (void 0 !== fd.property && 0 < values.length) {
              dest[fd.property] = values.shift();
            }
          }
          return dest;
        }
        /**
         * Get access to the layout of a given property.
         *
         * @param {String} property - the structure member of interest.
         *
         * @return {Layout} - the layout associated with `property`, or
         * undefined if there is no such property.
         */
        layoutFor(property) {
          if ("string" !== typeof property) {
            throw new TypeError("property must be string");
          }
          for (const fd of this.fields) {
            if (fd.property === property) {
              return fd;
            }
          }
          return void 0;
        }
        /**
         * Get the offset of a structure member.
         *
         * @param {String} property - the structure member of interest.
         *
         * @return {Number} - the offset in bytes to the start of `property`
         * within the structure, or undefined if `property` is not a field
         * within the structure.  If the property is a member but follows a
         * variable-length structure member a negative number will be
         * returned.
         */
        offsetOf(property) {
          if ("string" !== typeof property) {
            throw new TypeError("property must be string");
          }
          let offset2 = 0;
          for (const fd of this.fields) {
            if (fd.property === property) {
              return offset2;
            }
            if (0 > fd.span) {
              offset2 = -1;
            } else if (0 <= offset2) {
              offset2 += fd.span;
            }
          }
          return void 0;
        }
      };
      exports.Structure = Structure;
      var UnionDiscriminator = class {
        constructor(property) {
          this.property = property;
        }
        /** Analog to {@link Layout#decode|Layout decode} for union discriminators.
         *
         * The implementation of this method need not reference the buffer if
         * variant information is available through other means. */
        decode(b, offset2) {
          throw new Error("UnionDiscriminator is abstract");
        }
        /** Analog to {@link Layout#decode|Layout encode} for union discriminators.
         *
         * The implementation of this method need not store the value if
         * variant information is maintained through other means. */
        encode(src, b, offset2) {
          throw new Error("UnionDiscriminator is abstract");
        }
      };
      exports.UnionDiscriminator = UnionDiscriminator;
      var UnionLayoutDiscriminator = class extends UnionDiscriminator {
        constructor(layout, property) {
          if (!(layout instanceof ExternalLayout && layout.isCount())) {
            throw new TypeError("layout must be an unsigned integer ExternalLayout");
          }
          super(property || layout.property || "variant");
          this.layout = layout;
        }
        /** Delegate decoding to {@link UnionLayoutDiscriminator#layout|layout}. */
        decode(b, offset2) {
          return this.layout.decode(b, offset2);
        }
        /** Delegate encoding to {@link UnionLayoutDiscriminator#layout|layout}. */
        encode(src, b, offset2) {
          return this.layout.encode(src, b, offset2);
        }
      };
      exports.UnionLayoutDiscriminator = UnionLayoutDiscriminator;
      var Union = class extends Layout {
        constructor(discr, defaultLayout, property) {
          let discriminator;
          if (discr instanceof UInt || discr instanceof UIntBE) {
            discriminator = new UnionLayoutDiscriminator(new OffsetLayout(discr));
          } else if (discr instanceof ExternalLayout && discr.isCount()) {
            discriminator = new UnionLayoutDiscriminator(discr);
          } else if (!(discr instanceof UnionDiscriminator)) {
            throw new TypeError("discr must be a UnionDiscriminator or an unsigned integer layout");
          } else {
            discriminator = discr;
          }
          if (void 0 === defaultLayout) {
            defaultLayout = null;
          }
          if (!(null === defaultLayout || defaultLayout instanceof Layout)) {
            throw new TypeError("defaultLayout must be null or a Layout");
          }
          if (null !== defaultLayout) {
            if (0 > defaultLayout.span) {
              throw new Error("defaultLayout must have constant span");
            }
            if (void 0 === defaultLayout.property) {
              defaultLayout = defaultLayout.replicate("content");
            }
          }
          let span = -1;
          if (defaultLayout) {
            span = defaultLayout.span;
            if (0 <= span && (discr instanceof UInt || discr instanceof UIntBE)) {
              span += discriminator.layout.span;
            }
          }
          super(span, property);
          this.discriminator = discriminator;
          this.usesPrefixDiscriminator = discr instanceof UInt || discr instanceof UIntBE;
          this.defaultLayout = defaultLayout;
          this.registry = {};
          let boundGetSourceVariant = this.defaultGetSourceVariant.bind(this);
          this.getSourceVariant = function(src) {
            return boundGetSourceVariant(src);
          };
          this.configGetSourceVariant = function(gsv) {
            boundGetSourceVariant = gsv.bind(this);
          };
        }
        /** @override */
        getSpan(b, offset2 = 0) {
          if (0 <= this.span) {
            return this.span;
          }
          const vlo = this.getVariant(b, offset2);
          if (!vlo) {
            throw new Error("unable to determine span for unrecognized variant");
          }
          return vlo.getSpan(b, offset2);
        }
        /**
         * Method to infer a registered Union variant compatible with `src`.
         *
         * The first satisfied rule in the following sequence defines the
         * return value:
         * * If `src` has properties matching the Union discriminator and
         *   the default layout, `undefined` is returned regardless of the
         *   value of the discriminator property (this ensures the default
         *   layout will be used);
         * * If `src` has a property matching the Union discriminator, the
         *   value of the discriminator identifies a registered variant, and
         *   either (a) the variant has no layout, or (b) `src` has the
         *   variant's property, then the variant is returned (because the
         *   source satisfies the constraints of the variant it identifies);
         * * If `src` does not have a property matching the Union
         *   discriminator, but does have a property matching a registered
         *   variant, then the variant is returned (because the source
         *   matches a variant without an explicit conflict);
         * * An error is thrown (because we either can't identify a variant,
         *   or we were explicitly told the variant but can't satisfy it).
         *
         * @param {Object} src - an object presumed to be compatible with
         * the content of the Union.
         *
         * @return {(undefined|VariantLayout)} - as described above.
         *
         * @throws {Error} - if `src` cannot be associated with a default or
         * registered variant.
         */
        defaultGetSourceVariant(src) {
          if (Object.prototype.hasOwnProperty.call(src, this.discriminator.property)) {
            if (this.defaultLayout && this.defaultLayout.property && Object.prototype.hasOwnProperty.call(src, this.defaultLayout.property)) {
              return void 0;
            }
            const vlo = this.registry[src[this.discriminator.property]];
            if (vlo && (!vlo.layout || vlo.property && Object.prototype.hasOwnProperty.call(src, vlo.property))) {
              return vlo;
            }
          } else {
            for (const tag in this.registry) {
              const vlo = this.registry[tag];
              if (vlo.property && Object.prototype.hasOwnProperty.call(src, vlo.property)) {
                return vlo;
              }
            }
          }
          throw new Error("unable to infer src variant");
        }
        /** Implement {@link Layout#decode|decode} for {@link Union}.
         *
         * If the variant is {@link Union#addVariant|registered} the return
         * value is an instance of that variant, with no explicit
         * discriminator.  Otherwise the {@link Union#defaultLayout|default
         * layout} is used to decode the content. */
        decode(b, offset2 = 0) {
          let dest;
          const dlo = this.discriminator;
          const discr = dlo.decode(b, offset2);
          const clo = this.registry[discr];
          if (void 0 === clo) {
            const defaultLayout = this.defaultLayout;
            let contentOffset = 0;
            if (this.usesPrefixDiscriminator) {
              contentOffset = dlo.layout.span;
            }
            dest = this.makeDestinationObject();
            dest[dlo.property] = discr;
            dest[defaultLayout.property] = defaultLayout.decode(b, offset2 + contentOffset);
          } else {
            dest = clo.decode(b, offset2);
          }
          return dest;
        }
        /** Implement {@link Layout#encode|encode} for {@link Union}.
         *
         * This API assumes the `src` object is consistent with the union's
         * {@link Union#defaultLayout|default layout}.  To encode variants
         * use the appropriate variant-specific {@link VariantLayout#encode}
         * method. */
        encode(src, b, offset2 = 0) {
          const vlo = this.getSourceVariant(src);
          if (void 0 === vlo) {
            const dlo = this.discriminator;
            const clo = this.defaultLayout;
            let contentOffset = 0;
            if (this.usesPrefixDiscriminator) {
              contentOffset = dlo.layout.span;
            }
            dlo.encode(src[dlo.property], b, offset2);
            return contentOffset + clo.encode(src[clo.property], b, offset2 + contentOffset);
          }
          return vlo.encode(src, b, offset2);
        }
        /** Register a new variant structure within a union.  The newly
         * created variant is returned.
         *
         * @param {Number} variant - initializer for {@link
         * VariantLayout#variant|variant}.
         *
         * @param {Layout} layout - initializer for {@link
         * VariantLayout#layout|layout}.
         *
         * @param {String} property - initializer for {@link
         * Layout#property|property}.
         *
         * @return {VariantLayout} */
        addVariant(variant, layout, property) {
          const rv = new VariantLayout(this, variant, layout, property);
          this.registry[variant] = rv;
          return rv;
        }
        /**
         * Get the layout associated with a registered variant.
         *
         * If `vb` does not produce a registered variant the function returns
         * `undefined`.
         *
         * @param {(Number|Uint8Array)} vb - either the variant number, or a
         * buffer from which the discriminator is to be read.
         *
         * @param {Number} offset - offset into `vb` for the start of the
         * union.  Used only when `vb` is an instance of {Uint8Array}.
         *
         * @return {({VariantLayout}|undefined)}
         */
        getVariant(vb, offset2 = 0) {
          let variant;
          if (vb instanceof Uint8Array) {
            variant = this.discriminator.decode(vb, offset2);
          } else {
            variant = vb;
          }
          return this.registry[variant];
        }
      };
      exports.Union = Union;
      var VariantLayout = class extends Layout {
        constructor(union2, variant, layout, property) {
          if (!(union2 instanceof Union)) {
            throw new TypeError("union must be a Union");
          }
          if (!Number.isInteger(variant) || 0 > variant) {
            throw new TypeError("variant must be a (non-negative) integer");
          }
          if ("string" === typeof layout && void 0 === property) {
            property = layout;
            layout = null;
          }
          if (layout) {
            if (!(layout instanceof Layout)) {
              throw new TypeError("layout must be a Layout");
            }
            if (null !== union2.defaultLayout && 0 <= layout.span && layout.span > union2.defaultLayout.span) {
              throw new Error("variant span exceeds span of containing union");
            }
            if ("string" !== typeof property) {
              throw new TypeError("variant must have a String property");
            }
          }
          let span = union2.span;
          if (0 > union2.span) {
            span = layout ? layout.span : 0;
            if (0 <= span && union2.usesPrefixDiscriminator) {
              span += union2.discriminator.layout.span;
            }
          }
          super(span, property);
          this.union = union2;
          this.variant = variant;
          this.layout = layout || null;
        }
        /** @override */
        getSpan(b, offset2 = 0) {
          if (0 <= this.span) {
            return this.span;
          }
          let contentOffset = 0;
          if (this.union.usesPrefixDiscriminator) {
            contentOffset = this.union.discriminator.layout.span;
          }
          let span = 0;
          if (this.layout) {
            span = this.layout.getSpan(b, offset2 + contentOffset);
          }
          return contentOffset + span;
        }
        /** @override */
        decode(b, offset2 = 0) {
          const dest = this.makeDestinationObject();
          if (this !== this.union.getVariant(b, offset2)) {
            throw new Error("variant mismatch");
          }
          let contentOffset = 0;
          if (this.union.usesPrefixDiscriminator) {
            contentOffset = this.union.discriminator.layout.span;
          }
          if (this.layout) {
            dest[this.property] = this.layout.decode(b, offset2 + contentOffset);
          } else if (this.property) {
            dest[this.property] = true;
          } else if (this.union.usesPrefixDiscriminator) {
            dest[this.union.discriminator.property] = this.variant;
          }
          return dest;
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          let contentOffset = 0;
          if (this.union.usesPrefixDiscriminator) {
            contentOffset = this.union.discriminator.layout.span;
          }
          if (this.layout && !Object.prototype.hasOwnProperty.call(src, this.property)) {
            throw new TypeError("variant lacks property " + this.property);
          }
          this.union.discriminator.encode(this.variant, b, offset2);
          let span = contentOffset;
          if (this.layout) {
            this.layout.encode(src[this.property], b, offset2 + contentOffset);
            span += this.layout.getSpan(b, offset2 + contentOffset);
            if (0 <= this.union.span && span > this.union.span) {
              throw new Error("encoded variant overruns containing union");
            }
          }
          return span;
        }
        /** Delegate {@link Layout#fromArray|fromArray} to {@link
         * VariantLayout#layout|layout}. */
        fromArray(values) {
          if (this.layout) {
            return this.layout.fromArray(values);
          }
          return void 0;
        }
      };
      exports.VariantLayout = VariantLayout;
      function fixBitwiseResult(v) {
        if (0 > v) {
          v += 4294967296;
        }
        return v;
      }
      var BitStructure = class extends Layout {
        constructor(word, msb, property) {
          if (!(word instanceof UInt || word instanceof UIntBE)) {
            throw new TypeError("word must be a UInt or UIntBE layout");
          }
          if ("string" === typeof msb && void 0 === property) {
            property = msb;
            msb = false;
          }
          if (4 < word.span) {
            throw new RangeError("word cannot exceed 32 bits");
          }
          super(word.span, property);
          this.word = word;
          this.msb = !!msb;
          this.fields = [];
          let value = 0;
          this._packedSetValue = function(v) {
            value = fixBitwiseResult(v);
            return this;
          };
          this._packedGetValue = function() {
            return value;
          };
        }
        /** @override */
        decode(b, offset2 = 0) {
          const dest = this.makeDestinationObject();
          const value = this.word.decode(b, offset2);
          this._packedSetValue(value);
          for (const fd of this.fields) {
            if (void 0 !== fd.property) {
              dest[fd.property] = fd.decode(b);
            }
          }
          return dest;
        }
        /** Implement {@link Layout#encode|encode} for {@link BitStructure}.
         *
         * If `src` is missing a property for a member with a defined {@link
         * Layout#property|property} the corresponding region of the packed
         * value is left unmodified.  Unused bits are also left unmodified. */
        encode(src, b, offset2 = 0) {
          const value = this.word.decode(b, offset2);
          this._packedSetValue(value);
          for (const fd of this.fields) {
            if (void 0 !== fd.property) {
              const fv = src[fd.property];
              if (void 0 !== fv) {
                fd.encode(fv);
              }
            }
          }
          return this.word.encode(this._packedGetValue(), b, offset2);
        }
        /** Register a new bitfield with a containing bit structure.  The
         * resulting bitfield is returned.
         *
         * @param {Number} bits - initializer for {@link BitField#bits|bits}.
         *
         * @param {string} property - initializer for {@link
         * Layout#property|property}.
         *
         * @return {BitField} */
        addField(bits, property) {
          const bf = new BitField(this, bits, property);
          this.fields.push(bf);
          return bf;
        }
        /** As with {@link BitStructure#addField|addField} for single-bit
         * fields with `boolean` value representation.
         *
         * @param {string} property - initializer for {@link
         * Layout#property|property}.
         *
         * @return {Boolean} */
        // `Boolean` conflicts with the native primitive type
        // eslint-disable-next-line @typescript-eslint/ban-types
        addBoolean(property) {
          const bf = new Boolean2(this, property);
          this.fields.push(bf);
          return bf;
        }
        /**
         * Get access to the bit field for a given property.
         *
         * @param {String} property - the bit field of interest.
         *
         * @return {BitField} - the field associated with `property`, or
         * undefined if there is no such property.
         */
        fieldFor(property) {
          if ("string" !== typeof property) {
            throw new TypeError("property must be string");
          }
          for (const fd of this.fields) {
            if (fd.property === property) {
              return fd;
            }
          }
          return void 0;
        }
      };
      exports.BitStructure = BitStructure;
      var BitField = class {
        constructor(container, bits, property) {
          if (!(container instanceof BitStructure)) {
            throw new TypeError("container must be a BitStructure");
          }
          if (!Number.isInteger(bits) || 0 >= bits) {
            throw new TypeError("bits must be positive integer");
          }
          const totalBits = 8 * container.span;
          const usedBits = container.fields.reduce((sum, fd) => sum + fd.bits, 0);
          if (bits + usedBits > totalBits) {
            throw new Error("bits too long for span remainder (" + (totalBits - usedBits) + " of " + totalBits + " remain)");
          }
          this.container = container;
          this.bits = bits;
          this.valueMask = (1 << bits) - 1;
          if (32 === bits) {
            this.valueMask = 4294967295;
          }
          this.start = usedBits;
          if (this.container.msb) {
            this.start = totalBits - usedBits - bits;
          }
          this.wordMask = fixBitwiseResult(this.valueMask << this.start);
          this.property = property;
        }
        /** Store a value into the corresponding subsequence of the containing
         * bit field. */
        decode(b, offset2) {
          const word = this.container._packedGetValue();
          const wordValue = fixBitwiseResult(word & this.wordMask);
          const value = wordValue >>> this.start;
          return value;
        }
        /** Store a value into the corresponding subsequence of the containing
         * bit field.
         *
         * **NOTE** This is not a specialization of {@link
         * Layout#encode|Layout.encode} and there is no return value. */
        encode(value) {
          if ("number" !== typeof value || !Number.isInteger(value) || value !== fixBitwiseResult(value & this.valueMask)) {
            throw new TypeError(nameWithProperty("BitField.encode", this) + " value must be integer not exceeding " + this.valueMask);
          }
          const word = this.container._packedGetValue();
          const wordValue = fixBitwiseResult(value << this.start);
          this.container._packedSetValue(fixBitwiseResult(word & ~this.wordMask) | wordValue);
        }
      };
      exports.BitField = BitField;
      var Boolean2 = class extends BitField {
        constructor(container, property) {
          super(container, 1, property);
        }
        /** Override {@link BitField#decode|decode} for {@link Boolean|Boolean}.
         *
         * @returns {boolean} */
        decode(b, offset2) {
          return !!super.decode(b, offset2);
        }
        /** @override */
        encode(value) {
          if ("boolean" === typeof value) {
            value = +value;
          }
          super.encode(value);
        }
      };
      exports.Boolean = Boolean2;
      var Blob = class extends Layout {
        constructor(length, property) {
          if (!(length instanceof ExternalLayout && length.isCount() || Number.isInteger(length) && 0 <= length)) {
            throw new TypeError("length must be positive integer or an unsigned integer ExternalLayout");
          }
          let span = -1;
          if (!(length instanceof ExternalLayout)) {
            span = length;
          }
          super(span, property);
          this.length = length;
        }
        /** @override */
        getSpan(b, offset2) {
          let span = this.span;
          if (0 > span) {
            span = this.length.decode(b, offset2);
          }
          return span;
        }
        /** @override */
        decode(b, offset2 = 0) {
          let span = this.span;
          if (0 > span) {
            span = this.length.decode(b, offset2);
          }
          return uint8ArrayToBuffer(b).slice(offset2, offset2 + span);
        }
        /** Implement {@link Layout#encode|encode} for {@link Blob}.
         *
         * **NOTE** If {@link Layout#count|count} is an instance of {@link
         * ExternalLayout} then the length of `src` will be encoded as the
         * count after `src` is encoded. */
        encode(src, b, offset2) {
          let span = this.length;
          if (this.length instanceof ExternalLayout) {
            span = src.length;
          }
          if (!(src instanceof Uint8Array && span === src.length)) {
            throw new TypeError(nameWithProperty("Blob.encode", this) + " requires (length " + span + ") Uint8Array as src");
          }
          if (offset2 + span > b.length) {
            throw new RangeError("encoding overruns Uint8Array");
          }
          const srcBuffer = uint8ArrayToBuffer(src);
          uint8ArrayToBuffer(b).write(srcBuffer.toString("hex"), offset2, span, "hex");
          if (this.length instanceof ExternalLayout) {
            this.length.encode(span, b, offset2);
          }
          return span;
        }
      };
      exports.Blob = Blob;
      var CString = class extends Layout {
        constructor(property) {
          super(-1, property);
        }
        /** @override */
        getSpan(b, offset2 = 0) {
          checkUint8Array(b);
          let idx = offset2;
          while (idx < b.length && 0 !== b[idx]) {
            idx += 1;
          }
          return 1 + idx - offset2;
        }
        /** @override */
        decode(b, offset2 = 0) {
          const span = this.getSpan(b, offset2);
          return uint8ArrayToBuffer(b).slice(offset2, offset2 + span - 1).toString("utf-8");
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          if ("string" !== typeof src) {
            src = String(src);
          }
          const srcb = buffer_1.Buffer.from(src, "utf8");
          const span = srcb.length;
          if (offset2 + span > b.length) {
            throw new RangeError("encoding overruns Buffer");
          }
          const buffer = uint8ArrayToBuffer(b);
          srcb.copy(buffer, offset2);
          buffer[offset2 + span] = 0;
          return span + 1;
        }
      };
      exports.CString = CString;
      var UTF8 = class extends Layout {
        constructor(maxSpan, property) {
          if ("string" === typeof maxSpan && void 0 === property) {
            property = maxSpan;
            maxSpan = void 0;
          }
          if (void 0 === maxSpan) {
            maxSpan = -1;
          } else if (!Number.isInteger(maxSpan)) {
            throw new TypeError("maxSpan must be an integer");
          }
          super(-1, property);
          this.maxSpan = maxSpan;
        }
        /** @override */
        getSpan(b, offset2 = 0) {
          checkUint8Array(b);
          return b.length - offset2;
        }
        /** @override */
        decode(b, offset2 = 0) {
          const span = this.getSpan(b, offset2);
          if (0 <= this.maxSpan && this.maxSpan < span) {
            throw new RangeError("text length exceeds maxSpan");
          }
          return uint8ArrayToBuffer(b).slice(offset2, offset2 + span).toString("utf-8");
        }
        /** @override */
        encode(src, b, offset2 = 0) {
          if ("string" !== typeof src) {
            src = String(src);
          }
          const srcb = buffer_1.Buffer.from(src, "utf8");
          const span = srcb.length;
          if (0 <= this.maxSpan && this.maxSpan < span) {
            throw new RangeError("text length exceeds maxSpan");
          }
          if (offset2 + span > b.length) {
            throw new RangeError("encoding overruns Buffer");
          }
          srcb.copy(uint8ArrayToBuffer(b), offset2);
          return span;
        }
      };
      exports.UTF8 = UTF8;
      var Constant = class extends Layout {
        constructor(value, property) {
          super(0, property);
          this.value = value;
        }
        /** @override */
        decode(b, offset2) {
          return this.value;
        }
        /** @override */
        encode(src, b, offset2) {
          return 0;
        }
      };
      exports.Constant = Constant;
      exports.greedy = ((elementSpan, property) => new GreedyCount(elementSpan, property));
      exports.offset = ((layout, offset2, property) => new OffsetLayout(layout, offset2, property));
      exports.u8 = ((property) => new UInt(1, property));
      exports.u16 = ((property) => new UInt(2, property));
      exports.u24 = ((property) => new UInt(3, property));
      exports.u32 = ((property) => new UInt(4, property));
      exports.u40 = ((property) => new UInt(5, property));
      exports.u48 = ((property) => new UInt(6, property));
      exports.nu64 = ((property) => new NearUInt64(property));
      exports.u16be = ((property) => new UIntBE(2, property));
      exports.u24be = ((property) => new UIntBE(3, property));
      exports.u32be = ((property) => new UIntBE(4, property));
      exports.u40be = ((property) => new UIntBE(5, property));
      exports.u48be = ((property) => new UIntBE(6, property));
      exports.nu64be = ((property) => new NearUInt64BE(property));
      exports.s8 = ((property) => new Int(1, property));
      exports.s16 = ((property) => new Int(2, property));
      exports.s24 = ((property) => new Int(3, property));
      exports.s32 = ((property) => new Int(4, property));
      exports.s40 = ((property) => new Int(5, property));
      exports.s48 = ((property) => new Int(6, property));
      exports.ns64 = ((property) => new NearInt64(property));
      exports.s16be = ((property) => new IntBE(2, property));
      exports.s24be = ((property) => new IntBE(3, property));
      exports.s32be = ((property) => new IntBE(4, property));
      exports.s40be = ((property) => new IntBE(5, property));
      exports.s48be = ((property) => new IntBE(6, property));
      exports.ns64be = ((property) => new NearInt64BE(property));
      exports.f32 = ((property) => new Float(property));
      exports.f32be = ((property) => new FloatBE(property));
      exports.f64 = ((property) => new Double(property));
      exports.f64be = ((property) => new DoubleBE(property));
      exports.struct = ((fields, property, decodePrefixes) => new Structure(fields, property, decodePrefixes));
      exports.bits = ((word, msb, property) => new BitStructure(word, msb, property));
      exports.seq = ((elementLayout, count, property) => new Sequence(elementLayout, count, property));
      exports.union = ((discr, defaultLayout, property) => new Union(discr, defaultLayout, property));
      exports.unionLayoutDiscriminator = ((layout, property) => new UnionLayoutDiscriminator(layout, property));
      exports.blob = ((length, property) => new Blob(length, property));
      exports.cstr = ((property) => new CString(property));
      exports.utf8 = ((maxSpan, property) => new UTF8(maxSpan, property));
      exports.constant = ((value, property) => new Constant(value, property));
    }
  });

  // node_modules/uuid/dist/esm-browser/rng.js
  function rng() {
    if (!getRandomValues) {
      getRandomValues = typeof crypto !== "undefined" && crypto.getRandomValues && crypto.getRandomValues.bind(crypto) || typeof msCrypto !== "undefined" && typeof msCrypto.getRandomValues === "function" && msCrypto.getRandomValues.bind(msCrypto);
      if (!getRandomValues) {
        throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
      }
    }
    return getRandomValues(rnds8);
  }
  var getRandomValues, rnds8;
  var init_rng = __esm({
    "node_modules/uuid/dist/esm-browser/rng.js"() {
      init_buffer_shim();
      rnds8 = new Uint8Array(16);
    }
  });

  // node_modules/uuid/dist/esm-browser/regex.js
  var regex_default;
  var init_regex = __esm({
    "node_modules/uuid/dist/esm-browser/regex.js"() {
      init_buffer_shim();
      regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
    }
  });

  // node_modules/uuid/dist/esm-browser/validate.js
  function validate2(uuid) {
    return typeof uuid === "string" && regex_default.test(uuid);
  }
  var validate_default;
  var init_validate = __esm({
    "node_modules/uuid/dist/esm-browser/validate.js"() {
      init_buffer_shim();
      init_regex();
      validate_default = validate2;
    }
  });

  // node_modules/uuid/dist/esm-browser/stringify.js
  function stringify(arr) {
    var offset2 = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    var uuid = (byteToHex[arr[offset2 + 0]] + byteToHex[arr[offset2 + 1]] + byteToHex[arr[offset2 + 2]] + byteToHex[arr[offset2 + 3]] + "-" + byteToHex[arr[offset2 + 4]] + byteToHex[arr[offset2 + 5]] + "-" + byteToHex[arr[offset2 + 6]] + byteToHex[arr[offset2 + 7]] + "-" + byteToHex[arr[offset2 + 8]] + byteToHex[arr[offset2 + 9]] + "-" + byteToHex[arr[offset2 + 10]] + byteToHex[arr[offset2 + 11]] + byteToHex[arr[offset2 + 12]] + byteToHex[arr[offset2 + 13]] + byteToHex[arr[offset2 + 14]] + byteToHex[arr[offset2 + 15]]).toLowerCase();
    if (!validate_default(uuid)) {
      throw TypeError("Stringified UUID is invalid");
    }
    return uuid;
  }
  var byteToHex, i, stringify_default;
  var init_stringify = __esm({
    "node_modules/uuid/dist/esm-browser/stringify.js"() {
      init_buffer_shim();
      init_validate();
      byteToHex = [];
      for (i = 0; i < 256; ++i) {
        byteToHex.push((i + 256).toString(16).substr(1));
      }
      stringify_default = stringify;
    }
  });

  // node_modules/uuid/dist/esm-browser/v1.js
  function v1(options, buf, offset2) {
    var i2 = buf && offset2 || 0;
    var b = buf || new Array(16);
    options = options || {};
    var node = options.node || _nodeId;
    var clockseq = options.clockseq !== void 0 ? options.clockseq : _clockseq;
    if (node == null || clockseq == null) {
      var seedBytes = options.random || (options.rng || rng)();
      if (node == null) {
        node = _nodeId = [seedBytes[0] | 1, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
      }
      if (clockseq == null) {
        clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 16383;
      }
    }
    var msecs = options.msecs !== void 0 ? options.msecs : Date.now();
    var nsecs = options.nsecs !== void 0 ? options.nsecs : _lastNSecs + 1;
    var dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 1e4;
    if (dt < 0 && options.clockseq === void 0) {
      clockseq = clockseq + 1 & 16383;
    }
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === void 0) {
      nsecs = 0;
    }
    if (nsecs >= 1e4) {
      throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
    }
    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq;
    msecs += 122192928e5;
    var tl = ((msecs & 268435455) * 1e4 + nsecs) % 4294967296;
    b[i2++] = tl >>> 24 & 255;
    b[i2++] = tl >>> 16 & 255;
    b[i2++] = tl >>> 8 & 255;
    b[i2++] = tl & 255;
    var tmh = msecs / 4294967296 * 1e4 & 268435455;
    b[i2++] = tmh >>> 8 & 255;
    b[i2++] = tmh & 255;
    b[i2++] = tmh >>> 24 & 15 | 16;
    b[i2++] = tmh >>> 16 & 255;
    b[i2++] = clockseq >>> 8 | 128;
    b[i2++] = clockseq & 255;
    for (var n = 0; n < 6; ++n) {
      b[i2 + n] = node[n];
    }
    return buf || stringify_default(b);
  }
  var _nodeId, _clockseq, _lastMSecs, _lastNSecs, v1_default;
  var init_v1 = __esm({
    "node_modules/uuid/dist/esm-browser/v1.js"() {
      init_buffer_shim();
      init_rng();
      init_stringify();
      _lastMSecs = 0;
      _lastNSecs = 0;
      v1_default = v1;
    }
  });

  // node_modules/uuid/dist/esm-browser/parse.js
  function parse(uuid) {
    if (!validate_default(uuid)) {
      throw TypeError("Invalid UUID");
    }
    var v;
    var arr = new Uint8Array(16);
    arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
    arr[1] = v >>> 16 & 255;
    arr[2] = v >>> 8 & 255;
    arr[3] = v & 255;
    arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
    arr[5] = v & 255;
    arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
    arr[7] = v & 255;
    arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
    arr[9] = v & 255;
    arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255;
    arr[11] = v / 4294967296 & 255;
    arr[12] = v >>> 24 & 255;
    arr[13] = v >>> 16 & 255;
    arr[14] = v >>> 8 & 255;
    arr[15] = v & 255;
    return arr;
  }
  var parse_default;
  var init_parse = __esm({
    "node_modules/uuid/dist/esm-browser/parse.js"() {
      init_buffer_shim();
      init_validate();
      parse_default = parse;
    }
  });

  // node_modules/uuid/dist/esm-browser/v35.js
  function stringToBytes(str) {
    str = unescape(encodeURIComponent(str));
    var bytes = [];
    for (var i2 = 0; i2 < str.length; ++i2) {
      bytes.push(str.charCodeAt(i2));
    }
    return bytes;
  }
  function v35_default(name, version2, hashfunc) {
    function generateUUID(value, namespace, buf, offset2) {
      if (typeof value === "string") {
        value = stringToBytes(value);
      }
      if (typeof namespace === "string") {
        namespace = parse_default(namespace);
      }
      if (namespace.length !== 16) {
        throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
      }
      var bytes = new Uint8Array(16 + value.length);
      bytes.set(namespace);
      bytes.set(value, namespace.length);
      bytes = hashfunc(bytes);
      bytes[6] = bytes[6] & 15 | version2;
      bytes[8] = bytes[8] & 63 | 128;
      if (buf) {
        offset2 = offset2 || 0;
        for (var i2 = 0; i2 < 16; ++i2) {
          buf[offset2 + i2] = bytes[i2];
        }
        return buf;
      }
      return stringify_default(bytes);
    }
    try {
      generateUUID.name = name;
    } catch (err) {
    }
    generateUUID.DNS = DNS;
    generateUUID.URL = URL;
    return generateUUID;
  }
  var DNS, URL;
  var init_v35 = __esm({
    "node_modules/uuid/dist/esm-browser/v35.js"() {
      init_buffer_shim();
      init_stringify();
      init_parse();
      DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
      URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
    }
  });

  // node_modules/uuid/dist/esm-browser/md5.js
  function md5(bytes) {
    if (typeof bytes === "string") {
      var msg = unescape(encodeURIComponent(bytes));
      bytes = new Uint8Array(msg.length);
      for (var i2 = 0; i2 < msg.length; ++i2) {
        bytes[i2] = msg.charCodeAt(i2);
      }
    }
    return md5ToHexEncodedArray(wordsToMd5(bytesToWords(bytes), bytes.length * 8));
  }
  function md5ToHexEncodedArray(input) {
    var output = [];
    var length32 = input.length * 32;
    var hexTab = "0123456789abcdef";
    for (var i2 = 0; i2 < length32; i2 += 8) {
      var x = input[i2 >> 5] >>> i2 % 32 & 255;
      var hex = parseInt(hexTab.charAt(x >>> 4 & 15) + hexTab.charAt(x & 15), 16);
      output.push(hex);
    }
    return output;
  }
  function getOutputLength(inputLength8) {
    return (inputLength8 + 64 >>> 9 << 4) + 14 + 1;
  }
  function wordsToMd5(x, len) {
    x[len >> 5] |= 128 << len % 32;
    x[getOutputLength(len) - 1] = len;
    var a = 1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d = 271733878;
    for (var i2 = 0; i2 < x.length; i2 += 16) {
      var olda = a;
      var oldb = b;
      var oldc = c;
      var oldd = d;
      a = md5ff(a, b, c, d, x[i2], 7, -680876936);
      d = md5ff(d, a, b, c, x[i2 + 1], 12, -389564586);
      c = md5ff(c, d, a, b, x[i2 + 2], 17, 606105819);
      b = md5ff(b, c, d, a, x[i2 + 3], 22, -1044525330);
      a = md5ff(a, b, c, d, x[i2 + 4], 7, -176418897);
      d = md5ff(d, a, b, c, x[i2 + 5], 12, 1200080426);
      c = md5ff(c, d, a, b, x[i2 + 6], 17, -1473231341);
      b = md5ff(b, c, d, a, x[i2 + 7], 22, -45705983);
      a = md5ff(a, b, c, d, x[i2 + 8], 7, 1770035416);
      d = md5ff(d, a, b, c, x[i2 + 9], 12, -1958414417);
      c = md5ff(c, d, a, b, x[i2 + 10], 17, -42063);
      b = md5ff(b, c, d, a, x[i2 + 11], 22, -1990404162);
      a = md5ff(a, b, c, d, x[i2 + 12], 7, 1804603682);
      d = md5ff(d, a, b, c, x[i2 + 13], 12, -40341101);
      c = md5ff(c, d, a, b, x[i2 + 14], 17, -1502002290);
      b = md5ff(b, c, d, a, x[i2 + 15], 22, 1236535329);
      a = md5gg(a, b, c, d, x[i2 + 1], 5, -165796510);
      d = md5gg(d, a, b, c, x[i2 + 6], 9, -1069501632);
      c = md5gg(c, d, a, b, x[i2 + 11], 14, 643717713);
      b = md5gg(b, c, d, a, x[i2], 20, -373897302);
      a = md5gg(a, b, c, d, x[i2 + 5], 5, -701558691);
      d = md5gg(d, a, b, c, x[i2 + 10], 9, 38016083);
      c = md5gg(c, d, a, b, x[i2 + 15], 14, -660478335);
      b = md5gg(b, c, d, a, x[i2 + 4], 20, -405537848);
      a = md5gg(a, b, c, d, x[i2 + 9], 5, 568446438);
      d = md5gg(d, a, b, c, x[i2 + 14], 9, -1019803690);
      c = md5gg(c, d, a, b, x[i2 + 3], 14, -187363961);
      b = md5gg(b, c, d, a, x[i2 + 8], 20, 1163531501);
      a = md5gg(a, b, c, d, x[i2 + 13], 5, -1444681467);
      d = md5gg(d, a, b, c, x[i2 + 2], 9, -51403784);
      c = md5gg(c, d, a, b, x[i2 + 7], 14, 1735328473);
      b = md5gg(b, c, d, a, x[i2 + 12], 20, -1926607734);
      a = md5hh(a, b, c, d, x[i2 + 5], 4, -378558);
      d = md5hh(d, a, b, c, x[i2 + 8], 11, -2022574463);
      c = md5hh(c, d, a, b, x[i2 + 11], 16, 1839030562);
      b = md5hh(b, c, d, a, x[i2 + 14], 23, -35309556);
      a = md5hh(a, b, c, d, x[i2 + 1], 4, -1530992060);
      d = md5hh(d, a, b, c, x[i2 + 4], 11, 1272893353);
      c = md5hh(c, d, a, b, x[i2 + 7], 16, -155497632);
      b = md5hh(b, c, d, a, x[i2 + 10], 23, -1094730640);
      a = md5hh(a, b, c, d, x[i2 + 13], 4, 681279174);
      d = md5hh(d, a, b, c, x[i2], 11, -358537222);
      c = md5hh(c, d, a, b, x[i2 + 3], 16, -722521979);
      b = md5hh(b, c, d, a, x[i2 + 6], 23, 76029189);
      a = md5hh(a, b, c, d, x[i2 + 9], 4, -640364487);
      d = md5hh(d, a, b, c, x[i2 + 12], 11, -421815835);
      c = md5hh(c, d, a, b, x[i2 + 15], 16, 530742520);
      b = md5hh(b, c, d, a, x[i2 + 2], 23, -995338651);
      a = md5ii(a, b, c, d, x[i2], 6, -198630844);
      d = md5ii(d, a, b, c, x[i2 + 7], 10, 1126891415);
      c = md5ii(c, d, a, b, x[i2 + 14], 15, -1416354905);
      b = md5ii(b, c, d, a, x[i2 + 5], 21, -57434055);
      a = md5ii(a, b, c, d, x[i2 + 12], 6, 1700485571);
      d = md5ii(d, a, b, c, x[i2 + 3], 10, -1894986606);
      c = md5ii(c, d, a, b, x[i2 + 10], 15, -1051523);
      b = md5ii(b, c, d, a, x[i2 + 1], 21, -2054922799);
      a = md5ii(a, b, c, d, x[i2 + 8], 6, 1873313359);
      d = md5ii(d, a, b, c, x[i2 + 15], 10, -30611744);
      c = md5ii(c, d, a, b, x[i2 + 6], 15, -1560198380);
      b = md5ii(b, c, d, a, x[i2 + 13], 21, 1309151649);
      a = md5ii(a, b, c, d, x[i2 + 4], 6, -145523070);
      d = md5ii(d, a, b, c, x[i2 + 11], 10, -1120210379);
      c = md5ii(c, d, a, b, x[i2 + 2], 15, 718787259);
      b = md5ii(b, c, d, a, x[i2 + 9], 21, -343485551);
      a = safeAdd(a, olda);
      b = safeAdd(b, oldb);
      c = safeAdd(c, oldc);
      d = safeAdd(d, oldd);
    }
    return [a, b, c, d];
  }
  function bytesToWords(input) {
    if (input.length === 0) {
      return [];
    }
    var length8 = input.length * 8;
    var output = new Uint32Array(getOutputLength(length8));
    for (var i2 = 0; i2 < length8; i2 += 8) {
      output[i2 >> 5] |= (input[i2 / 8] & 255) << i2 % 32;
    }
    return output;
  }
  function safeAdd(x, y) {
    var lsw = (x & 65535) + (y & 65535);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return msw << 16 | lsw & 65535;
  }
  function bitRotateLeft(num, cnt) {
    return num << cnt | num >>> 32 - cnt;
  }
  function md5cmn(q, a, b, x, s, t) {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a, b, c, d, x, s, t) {
    return md5cmn(b & c | ~b & d, a, b, x, s, t);
  }
  function md5gg(a, b, c, d, x, s, t) {
    return md5cmn(b & d | c & ~d, a, b, x, s, t);
  }
  function md5hh(a, b, c, d, x, s, t) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a, b, c, d, x, s, t) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  var md5_default;
  var init_md5 = __esm({
    "node_modules/uuid/dist/esm-browser/md5.js"() {
      init_buffer_shim();
      md5_default = md5;
    }
  });

  // node_modules/uuid/dist/esm-browser/v3.js
  var v3, v3_default;
  var init_v3 = __esm({
    "node_modules/uuid/dist/esm-browser/v3.js"() {
      init_buffer_shim();
      init_v35();
      init_md5();
      v3 = v35_default("v3", 48, md5_default);
      v3_default = v3;
    }
  });

  // node_modules/uuid/dist/esm-browser/v4.js
  function v4(options, buf, offset2) {
    options = options || {};
    var rnds = options.random || (options.rng || rng)();
    rnds[6] = rnds[6] & 15 | 64;
    rnds[8] = rnds[8] & 63 | 128;
    if (buf) {
      offset2 = offset2 || 0;
      for (var i2 = 0; i2 < 16; ++i2) {
        buf[offset2 + i2] = rnds[i2];
      }
      return buf;
    }
    return stringify_default(rnds);
  }
  var v4_default;
  var init_v4 = __esm({
    "node_modules/uuid/dist/esm-browser/v4.js"() {
      init_buffer_shim();
      init_rng();
      init_stringify();
      v4_default = v4;
    }
  });

  // node_modules/uuid/dist/esm-browser/sha1.js
  function f(s, x, y, z) {
    switch (s) {
      case 0:
        return x & y ^ ~x & z;
      case 1:
        return x ^ y ^ z;
      case 2:
        return x & y ^ x & z ^ y & z;
      case 3:
        return x ^ y ^ z;
    }
  }
  function ROTL(x, n) {
    return x << n | x >>> 32 - n;
  }
  function sha1(bytes) {
    var K = [1518500249, 1859775393, 2400959708, 3395469782];
    var H = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
    if (typeof bytes === "string") {
      var msg = unescape(encodeURIComponent(bytes));
      bytes = [];
      for (var i2 = 0; i2 < msg.length; ++i2) {
        bytes.push(msg.charCodeAt(i2));
      }
    } else if (!Array.isArray(bytes)) {
      bytes = Array.prototype.slice.call(bytes);
    }
    bytes.push(128);
    var l = bytes.length / 4 + 2;
    var N = Math.ceil(l / 16);
    var M = new Array(N);
    for (var _i = 0; _i < N; ++_i) {
      var arr = new Uint32Array(16);
      for (var j = 0; j < 16; ++j) {
        arr[j] = bytes[_i * 64 + j * 4] << 24 | bytes[_i * 64 + j * 4 + 1] << 16 | bytes[_i * 64 + j * 4 + 2] << 8 | bytes[_i * 64 + j * 4 + 3];
      }
      M[_i] = arr;
    }
    M[N - 1][14] = (bytes.length - 1) * 8 / Math.pow(2, 32);
    M[N - 1][14] = Math.floor(M[N - 1][14]);
    M[N - 1][15] = (bytes.length - 1) * 8 & 4294967295;
    for (var _i2 = 0; _i2 < N; ++_i2) {
      var W = new Uint32Array(80);
      for (var t = 0; t < 16; ++t) {
        W[t] = M[_i2][t];
      }
      for (var _t = 16; _t < 80; ++_t) {
        W[_t] = ROTL(W[_t - 3] ^ W[_t - 8] ^ W[_t - 14] ^ W[_t - 16], 1);
      }
      var a = H[0];
      var b = H[1];
      var c = H[2];
      var d = H[3];
      var e = H[4];
      for (var _t2 = 0; _t2 < 80; ++_t2) {
        var s = Math.floor(_t2 / 20);
        var T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[_t2] >>> 0;
        e = d;
        d = c;
        c = ROTL(b, 30) >>> 0;
        b = a;
        a = T;
      }
      H[0] = H[0] + a >>> 0;
      H[1] = H[1] + b >>> 0;
      H[2] = H[2] + c >>> 0;
      H[3] = H[3] + d >>> 0;
      H[4] = H[4] + e >>> 0;
    }
    return [H[0] >> 24 & 255, H[0] >> 16 & 255, H[0] >> 8 & 255, H[0] & 255, H[1] >> 24 & 255, H[1] >> 16 & 255, H[1] >> 8 & 255, H[1] & 255, H[2] >> 24 & 255, H[2] >> 16 & 255, H[2] >> 8 & 255, H[2] & 255, H[3] >> 24 & 255, H[3] >> 16 & 255, H[3] >> 8 & 255, H[3] & 255, H[4] >> 24 & 255, H[4] >> 16 & 255, H[4] >> 8 & 255, H[4] & 255];
  }
  var sha1_default;
  var init_sha1 = __esm({
    "node_modules/uuid/dist/esm-browser/sha1.js"() {
      init_buffer_shim();
      sha1_default = sha1;
    }
  });

  // node_modules/uuid/dist/esm-browser/v5.js
  var v5, v5_default;
  var init_v5 = __esm({
    "node_modules/uuid/dist/esm-browser/v5.js"() {
      init_buffer_shim();
      init_v35();
      init_sha1();
      v5 = v35_default("v5", 80, sha1_default);
      v5_default = v5;
    }
  });

  // node_modules/uuid/dist/esm-browser/nil.js
  var nil_default;
  var init_nil = __esm({
    "node_modules/uuid/dist/esm-browser/nil.js"() {
      init_buffer_shim();
      nil_default = "00000000-0000-0000-0000-000000000000";
    }
  });

  // node_modules/uuid/dist/esm-browser/version.js
  function version(uuid) {
    if (!validate_default(uuid)) {
      throw TypeError("Invalid UUID");
    }
    return parseInt(uuid.substr(14, 1), 16);
  }
  var version_default;
  var init_version = __esm({
    "node_modules/uuid/dist/esm-browser/version.js"() {
      init_buffer_shim();
      init_validate();
      version_default = version;
    }
  });

  // node_modules/uuid/dist/esm-browser/index.js
  var esm_browser_exports = {};
  __export(esm_browser_exports, {
    NIL: () => nil_default,
    parse: () => parse_default,
    stringify: () => stringify_default,
    v1: () => v1_default,
    v3: () => v3_default,
    v4: () => v4_default,
    v5: () => v5_default,
    validate: () => validate_default,
    version: () => version_default
  });
  var init_esm_browser = __esm({
    "node_modules/uuid/dist/esm-browser/index.js"() {
      init_buffer_shim();
      init_v1();
      init_v3();
      init_v4();
      init_v5();
      init_nil();
      init_version();
      init_validate();
      init_stringify();
      init_parse();
    }
  });

  // node_modules/jayson/lib/generateRequest.js
  var require_generateRequest = __commonJS({
    "node_modules/jayson/lib/generateRequest.js"(exports, module) {
      "use strict";
      init_buffer_shim();
      var uuid = (init_esm_browser(), __toCommonJS(esm_browser_exports)).v4;
      var generateRequest = function(method, params, id, options) {
        if (typeof method !== "string") {
          throw new TypeError(method + " must be a string");
        }
        options = options || {};
        const version2 = typeof options.version === "number" ? options.version : 2;
        if (version2 !== 1 && version2 !== 2) {
          throw new TypeError(version2 + " must be 1 or 2");
        }
        const request = {
          method
        };
        if (version2 === 2) {
          request.jsonrpc = "2.0";
        }
        if (params) {
          if (typeof params !== "object" && !Array.isArray(params)) {
            throw new TypeError(params + " must be an object, array or omitted");
          }
          request.params = params;
        }
        if (typeof id === "undefined") {
          const generator = typeof options.generator === "function" ? options.generator : function() {
            return uuid();
          };
          request.id = generator(request, options);
        } else if (version2 === 2 && id === null) {
          if (options.notificationIdNull) {
            request.id = null;
          }
        } else {
          request.id = id;
        }
        return request;
      };
      module.exports = generateRequest;
    }
  });

  // node_modules/jayson/lib/client/browser/index.js
  var require_browser = __commonJS({
    "node_modules/jayson/lib/client/browser/index.js"(exports, module) {
      "use strict";
      init_buffer_shim();
      var uuid = (init_esm_browser(), __toCommonJS(esm_browser_exports)).v4;
      var generateRequest = require_generateRequest();
      var ClientBrowser = function(callServer, options) {
        if (!(this instanceof ClientBrowser)) {
          return new ClientBrowser(callServer, options);
        }
        if (!options) {
          options = {};
        }
        this.options = {
          reviver: typeof options.reviver !== "undefined" ? options.reviver : null,
          replacer: typeof options.replacer !== "undefined" ? options.replacer : null,
          generator: typeof options.generator !== "undefined" ? options.generator : function() {
            return uuid();
          },
          version: typeof options.version !== "undefined" ? options.version : 2,
          notificationIdNull: typeof options.notificationIdNull === "boolean" ? options.notificationIdNull : false
        };
        this.callServer = callServer;
      };
      module.exports = ClientBrowser;
      ClientBrowser.prototype.request = function(method, params, id, callback) {
        const self = this;
        let request = null;
        const isBatch = Array.isArray(method) && typeof params === "function";
        if (this.options.version === 1 && isBatch) {
          throw new TypeError("JSON-RPC 1.0 does not support batching");
        }
        const isRaw = !isBatch && method && typeof method === "object" && typeof params === "function";
        if (isBatch || isRaw) {
          callback = params;
          request = method;
        } else {
          if (typeof id === "function") {
            callback = id;
            id = void 0;
          }
          const hasCallback = typeof callback === "function";
          try {
            request = generateRequest(method, params, id, {
              generator: this.options.generator,
              version: this.options.version,
              notificationIdNull: this.options.notificationIdNull
            });
          } catch (err) {
            if (hasCallback) {
              callback(err);
              return;
            }
            throw err;
          }
          if (!hasCallback) {
            return request;
          }
        }
        let message;
        try {
          message = JSON.stringify(request, this.options.replacer);
        } catch (err) {
          callback(err);
          return;
        }
        this.callServer(message, function(err, response) {
          self._parseResponse(err, response, callback);
        });
        return request;
      };
      ClientBrowser.prototype._parseResponse = function(err, responseText, callback) {
        if (err) {
          callback(err);
          return;
        }
        if (!responseText) {
          callback();
          return;
        }
        let response;
        try {
          response = JSON.parse(responseText, this.options.reviver);
        } catch (err2) {
          callback(err2);
          return;
        }
        if (callback.length === 3) {
          if (Array.isArray(response)) {
            const isError = function(res) {
              return typeof res.error !== "undefined";
            };
            const isNotError = function(res) {
              return !isError(res);
            };
            callback(null, response.filter(isError), response.filter(isNotError));
            return;
          } else {
            callback(null, response.error, response.result);
            return;
          }
        }
        callback(null, response);
      };
    }
  });

  // node_modules/rpc-websockets/node_modules/eventemitter3/index.js
  var require_eventemitter3 = __commonJS({
    "node_modules/rpc-websockets/node_modules/eventemitter3/index.js"(exports, module) {
      "use strict";
      init_buffer_shim();
      var has = Object.prototype.hasOwnProperty;
      var prefix = "~";
      function Events() {
      }
      if (Object.create) {
        Events.prototype = /* @__PURE__ */ Object.create(null);
        if (!new Events().__proto__) prefix = false;
      }
      function EE(fn, context, once) {
        this.fn = fn;
        this.context = context;
        this.once = once || false;
      }
      function addListener(emitter, event, fn, context, once) {
        if (typeof fn !== "function") {
          throw new TypeError("The listener must be a function");
        }
        var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
        if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
        else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
        else emitter._events[evt] = [emitter._events[evt], listener];
        return emitter;
      }
      function clearEvent(emitter, evt) {
        if (--emitter._eventsCount === 0) emitter._events = new Events();
        else delete emitter._events[evt];
      }
      function EventEmitter2() {
        this._events = new Events();
        this._eventsCount = 0;
      }
      EventEmitter2.prototype.eventNames = function eventNames() {
        var names = [], events, name;
        if (this._eventsCount === 0) return names;
        for (name in events = this._events) {
          if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
        }
        if (Object.getOwnPropertySymbols) {
          return names.concat(Object.getOwnPropertySymbols(events));
        }
        return names;
      };
      EventEmitter2.prototype.listeners = function listeners(event) {
        var evt = prefix ? prefix + event : event, handlers = this._events[evt];
        if (!handlers) return [];
        if (handlers.fn) return [handlers.fn];
        for (var i2 = 0, l = handlers.length, ee = new Array(l); i2 < l; i2++) {
          ee[i2] = handlers[i2].fn;
        }
        return ee;
      };
      EventEmitter2.prototype.listenerCount = function listenerCount(event) {
        var evt = prefix ? prefix + event : event, listeners = this._events[evt];
        if (!listeners) return 0;
        if (listeners.fn) return 1;
        return listeners.length;
      };
      EventEmitter2.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
        var evt = prefix ? prefix + event : event;
        if (!this._events[evt]) return false;
        var listeners = this._events[evt], len = arguments.length, args, i2;
        if (listeners.fn) {
          if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
          switch (len) {
            case 1:
              return listeners.fn.call(listeners.context), true;
            case 2:
              return listeners.fn.call(listeners.context, a1), true;
            case 3:
              return listeners.fn.call(listeners.context, a1, a2), true;
            case 4:
              return listeners.fn.call(listeners.context, a1, a2, a3), true;
            case 5:
              return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
            case 6:
              return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
          }
          for (i2 = 1, args = new Array(len - 1); i2 < len; i2++) {
            args[i2 - 1] = arguments[i2];
          }
          listeners.fn.apply(listeners.context, args);
        } else {
          var length = listeners.length, j;
          for (i2 = 0; i2 < length; i2++) {
            if (listeners[i2].once) this.removeListener(event, listeners[i2].fn, void 0, true);
            switch (len) {
              case 1:
                listeners[i2].fn.call(listeners[i2].context);
                break;
              case 2:
                listeners[i2].fn.call(listeners[i2].context, a1);
                break;
              case 3:
                listeners[i2].fn.call(listeners[i2].context, a1, a2);
                break;
              case 4:
                listeners[i2].fn.call(listeners[i2].context, a1, a2, a3);
                break;
              default:
                if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) {
                  args[j - 1] = arguments[j];
                }
                listeners[i2].fn.apply(listeners[i2].context, args);
            }
          }
        }
        return true;
      };
      EventEmitter2.prototype.on = function on(event, fn, context) {
        return addListener(this, event, fn, context, false);
      };
      EventEmitter2.prototype.once = function once(event, fn, context) {
        return addListener(this, event, fn, context, true);
      };
      EventEmitter2.prototype.removeListener = function removeListener(event, fn, context, once) {
        var evt = prefix ? prefix + event : event;
        if (!this._events[evt]) return this;
        if (!fn) {
          clearEvent(this, evt);
          return this;
        }
        var listeners = this._events[evt];
        if (listeners.fn) {
          if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
            clearEvent(this, evt);
          }
        } else {
          for (var i2 = 0, events = [], length = listeners.length; i2 < length; i2++) {
            if (listeners[i2].fn !== fn || once && !listeners[i2].once || context && listeners[i2].context !== context) {
              events.push(listeners[i2]);
            }
          }
          if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
          else clearEvent(this, evt);
        }
        return this;
      };
      EventEmitter2.prototype.removeAllListeners = function removeAllListeners(event) {
        var evt;
        if (event) {
          evt = prefix ? prefix + event : event;
          if (this._events[evt]) clearEvent(this, evt);
        } else {
          this._events = new Events();
          this._eventsCount = 0;
        }
        return this;
      };
      EventEmitter2.prototype.off = EventEmitter2.prototype.removeListener;
      EventEmitter2.prototype.addListener = EventEmitter2.prototype.on;
      EventEmitter2.prefixed = prefix;
      EventEmitter2.EventEmitter = EventEmitter2;
      if ("undefined" !== typeof module) {
        module.exports = EventEmitter2;
      }
    }
  });

  // node_modules/bigint-buffer/dist/browser.js
  var require_browser2 = __commonJS({
    "node_modules/bigint-buffer/dist/browser.js"(exports) {
      "use strict";
      init_buffer_shim();
      Object.defineProperty(exports, "__esModule", { value: true });
      var converter;
      function toBigIntLE2(buf) {
        {
          const reversed = Buffer.from(buf);
          reversed.reverse();
          const hex = reversed.toString("hex");
          if (hex.length === 0) {
            return BigInt(0);
          }
          return BigInt(`0x${hex}`);
        }
        return converter.toBigInt(buf, false);
      }
      exports.toBigIntLE = toBigIntLE2;
      function toBigIntBE2(buf) {
        {
          const hex = buf.toString("hex");
          if (hex.length === 0) {
            return BigInt(0);
          }
          return BigInt(`0x${hex}`);
        }
        return converter.toBigInt(buf, true);
      }
      exports.toBigIntBE = toBigIntBE2;
      function toBufferLE2(num, width) {
        {
          const hex = num.toString(16);
          const buffer = Buffer.from(hex.padStart(width * 2, "0").slice(0, width * 2), "hex");
          buffer.reverse();
          return buffer;
        }
        return converter.fromBigInt(num, Buffer.allocUnsafe(width), false);
      }
      exports.toBufferLE = toBufferLE2;
      function toBufferBE2(num, width) {
        {
          const hex = num.toString(16);
          return Buffer.from(hex.padStart(width * 2, "0").slice(0, width * 2), "hex");
        }
        return converter.fromBigInt(num, Buffer.allocUnsafe(width), true);
      }
      exports.toBufferBE = toBufferBE2;
    }
  });

  // examples/chat-portal/public/src/connect-pay.js
  init_buffer_shim();

  // node_modules/@solana/web3.js/lib/index.browser.esm.js
  init_buffer_shim();
  var import_buffer3 = __toESM(require_buffer());

  // node_modules/@noble/curves/esm/ed25519.js
  init_buffer_shim();

  // node_modules/@noble/hashes/esm/sha2.js
  init_buffer_shim();

  // node_modules/@noble/hashes/esm/_md.js
  init_buffer_shim();

  // node_modules/@noble/hashes/esm/utils.js
  init_buffer_shim();

  // node_modules/@noble/hashes/esm/crypto.js
  init_buffer_shim();
  var crypto2 = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;

  // node_modules/@noble/hashes/esm/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
  }
  function anumber(n) {
    if (!Number.isSafeInteger(n) || n < 0)
      throw new Error("positive integer expected, got " + n);
  }
  function abytes(b, ...lengths) {
    if (!isBytes(b))
      throw new Error("Uint8Array expected");
    if (lengths.length > 0 && !lengths.includes(b.length))
      throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
  }
  function ahash(h) {
    if (typeof h !== "function" || typeof h.create !== "function")
      throw new Error("Hash should be wrapped by utils.createHasher");
    anumber(h.outputLen);
    anumber(h.blockLen);
  }
  function aexists(instance2, checkFinished = true) {
    if (instance2.destroyed)
      throw new Error("Hash instance has been destroyed");
    if (checkFinished && instance2.finished)
      throw new Error("Hash#digest() has already been called");
  }
  function aoutput(out, instance2) {
    abytes(out);
    const min = instance2.outputLen;
    if (out.length < min) {
      throw new Error("digestInto() expects output buffer of length at least " + min);
    }
  }
  function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  }
  function clean(...arrays) {
    for (let i2 = 0; i2 < arrays.length; i2++) {
      arrays[i2].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  var isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
  function byteSwap(word) {
    return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
  }
  function byteSwap32(arr) {
    for (let i2 = 0; i2 < arr.length; i2++) {
      arr[i2] = byteSwap(arr[i2]);
    }
    return arr;
  }
  var swap32IfBE = isLE ? (u) => u : byteSwap32;
  var hasHexBuiltin = /* @__PURE__ */ (() => (
    // @ts-ignore
    typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
  ))();
  var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i2) => i2.toString(16).padStart(2, "0"));
  function bytesToHex(bytes) {
    abytes(bytes);
    if (hasHexBuiltin)
      return bytes.toHex();
    let hex = "";
    for (let i2 = 0; i2 < bytes.length; i2++) {
      hex += hexes[bytes[i2]];
    }
    return hex;
  }
  var asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
  function asciiToBase16(ch) {
    if (ch >= asciis._0 && ch <= asciis._9)
      return ch - asciis._0;
    if (ch >= asciis.A && ch <= asciis.F)
      return ch - (asciis.A - 10);
    if (ch >= asciis.a && ch <= asciis.f)
      return ch - (asciis.a - 10);
    return;
  }
  function hexToBytes(hex) {
    if (typeof hex !== "string")
      throw new Error("hex string expected, got " + typeof hex);
    if (hasHexBuiltin)
      return Uint8Array.fromHex(hex);
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
      throw new Error("hex string expected, got unpadded hex of length " + hl);
    const array2 = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
      const n1 = asciiToBase16(hex.charCodeAt(hi));
      const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
      if (n1 === void 0 || n2 === void 0) {
        const char = hex[hi] + hex[hi + 1];
        throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
      }
      array2[ai] = n1 * 16 + n2;
    }
    return array2;
  }
  function utf8ToBytes(str) {
    if (typeof str !== "string")
      throw new Error("string expected");
    return new Uint8Array(new TextEncoder().encode(str));
  }
  function toBytes(data) {
    if (typeof data === "string")
      data = utf8ToBytes(data);
    abytes(data);
    return data;
  }
  function concatBytes(...arrays) {
    let sum = 0;
    for (let i2 = 0; i2 < arrays.length; i2++) {
      const a = arrays[i2];
      abytes(a);
      sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i2 = 0, pad = 0; i2 < arrays.length; i2++) {
      const a = arrays[i2];
      res.set(a, pad);
      pad += a.length;
    }
    return res;
  }
  var Hash = class {
  };
  function createHasher(hashCons) {
    const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
    const tmp = hashCons();
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = () => hashCons();
    return hashC;
  }
  function randomBytes(bytesLength = 32) {
    if (crypto2 && typeof crypto2.getRandomValues === "function") {
      return crypto2.getRandomValues(new Uint8Array(bytesLength));
    }
    if (crypto2 && typeof crypto2.randomBytes === "function") {
      return Uint8Array.from(crypto2.randomBytes(bytesLength));
    }
    throw new Error("crypto.getRandomValues must be defined");
  }

  // node_modules/@noble/hashes/esm/_md.js
  function setBigUint64(view, byteOffset, value, isLE2) {
    if (typeof view.setBigUint64 === "function")
      return view.setBigUint64(byteOffset, value, isLE2);
    const _32n2 = BigInt(32);
    const _u32_max = BigInt(4294967295);
    const wh = Number(value >> _32n2 & _u32_max);
    const wl = Number(value & _u32_max);
    const h = isLE2 ? 4 : 0;
    const l = isLE2 ? 0 : 4;
    view.setUint32(byteOffset + h, wh, isLE2);
    view.setUint32(byteOffset + l, wl, isLE2);
  }
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  var HashMD = class extends Hash {
    constructor(blockLen, outputLen, padOffset, isLE2) {
      super();
      this.finished = false;
      this.length = 0;
      this.pos = 0;
      this.destroyed = false;
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE2;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView(this.buffer);
    }
    update(data) {
      aexists(this);
      data = toBytes(data);
      abytes(data);
      const { view, buffer, blockLen } = this;
      const len = data.length;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          continue;
        }
        buffer.set(data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
        }
      }
      this.length += data.length;
      this.roundClean();
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const { buffer, view, blockLen, isLE: isLE2 } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      clean(this.buffer.subarray(pos));
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        pos = 0;
      }
      for (let i2 = pos; i2 < blockLen; i2++)
        buffer[i2] = 0;
      setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE2);
      this.process(view, 0);
      const oview = createView(out);
      const len = this.outputLen;
      if (len % 4)
        throw new Error("_sha2: outputLen should be aligned to 32bit");
      const outLen = len / 4;
      const state = this.get();
      if (outLen > state.length)
        throw new Error("_sha2: outputLen bigger than state");
      for (let i2 = 0; i2 < outLen; i2++)
        oview.setUint32(4 * i2, state[i2], isLE2);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneInto(to) {
      to || (to = new this.constructor());
      to.set(...this.get());
      const { blockLen, buffer, length, finished, destroyed, pos } = this;
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      if (length % blockLen)
        to.buffer.set(buffer);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  var SHA512_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    4089235720,
    3144134277,
    2227873595,
    1013904242,
    4271175723,
    2773480762,
    1595750129,
    1359893119,
    2917565137,
    2600822924,
    725511199,
    528734635,
    4215389547,
    1541459225,
    327033209
  ]);

  // node_modules/@noble/hashes/esm/_u64.js
  init_buffer_shim();
  var U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
  var _32n = /* @__PURE__ */ BigInt(32);
  function fromBig(n, le = false) {
    if (le)
      return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
    return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
  }
  function split(lst, le = false) {
    const len = lst.length;
    let Ah = new Uint32Array(len);
    let Al = new Uint32Array(len);
    for (let i2 = 0; i2 < len; i2++) {
      const { h, l } = fromBig(lst[i2], le);
      [Ah[i2], Al[i2]] = [h, l];
    }
    return [Ah, Al];
  }
  var shrSH = (h, _l, s) => h >>> s;
  var shrSL = (h, l, s) => h << 32 - s | l >>> s;
  var rotrSH = (h, l, s) => h >>> s | l << 32 - s;
  var rotrSL = (h, l, s) => h << 32 - s | l >>> s;
  var rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
  var rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
  var rotlSH = (h, l, s) => h << s | l >>> 32 - s;
  var rotlSL = (h, l, s) => l << s | h >>> 32 - s;
  var rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
  var rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
  function add(Ah, Al, Bh, Bl) {
    const l = (Al >>> 0) + (Bl >>> 0);
    return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
  }
  var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
  var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
  var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
  var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
  var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
  var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

  // node_modules/@noble/hashes/esm/sha2.js
  var SHA256_K = /* @__PURE__ */ Uint32Array.from([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
  var SHA256 = class extends HashMD {
    constructor(outputLen = 32) {
      super(64, outputLen, 8, false);
      this.A = SHA256_IV[0] | 0;
      this.B = SHA256_IV[1] | 0;
      this.C = SHA256_IV[2] | 0;
      this.D = SHA256_IV[3] | 0;
      this.E = SHA256_IV[4] | 0;
      this.F = SHA256_IV[5] | 0;
      this.G = SHA256_IV[6] | 0;
      this.H = SHA256_IV[7] | 0;
    }
    get() {
      const { A, B, C, D, E, F, G, H } = this;
      return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
      this.A = A | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    process(view, offset2) {
      for (let i2 = 0; i2 < 16; i2++, offset2 += 4)
        SHA256_W[i2] = view.getUint32(offset2, false);
      for (let i2 = 16; i2 < 64; i2++) {
        const W15 = SHA256_W[i2 - 15];
        const W2 = SHA256_W[i2 - 2];
        const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
        const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
        SHA256_W[i2] = s1 + SHA256_W[i2 - 7] + s0 + SHA256_W[i2 - 16] | 0;
      }
      let { A, B, C, D, E, F, G, H } = this;
      for (let i2 = 0; i2 < 64; i2++) {
        const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
        const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i2] + SHA256_W[i2] | 0;
        const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
        const T2 = sigma0 + Maj(A, B, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B;
        B = A;
        A = T1 + T2 | 0;
      }
      A = A + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
      clean(SHA256_W);
    }
    destroy() {
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      clean(this.buffer);
    }
  };
  var K512 = /* @__PURE__ */ (() => split([
    "0x428a2f98d728ae22",
    "0x7137449123ef65cd",
    "0xb5c0fbcfec4d3b2f",
    "0xe9b5dba58189dbbc",
    "0x3956c25bf348b538",
    "0x59f111f1b605d019",
    "0x923f82a4af194f9b",
    "0xab1c5ed5da6d8118",
    "0xd807aa98a3030242",
    "0x12835b0145706fbe",
    "0x243185be4ee4b28c",
    "0x550c7dc3d5ffb4e2",
    "0x72be5d74f27b896f",
    "0x80deb1fe3b1696b1",
    "0x9bdc06a725c71235",
    "0xc19bf174cf692694",
    "0xe49b69c19ef14ad2",
    "0xefbe4786384f25e3",
    "0x0fc19dc68b8cd5b5",
    "0x240ca1cc77ac9c65",
    "0x2de92c6f592b0275",
    "0x4a7484aa6ea6e483",
    "0x5cb0a9dcbd41fbd4",
    "0x76f988da831153b5",
    "0x983e5152ee66dfab",
    "0xa831c66d2db43210",
    "0xb00327c898fb213f",
    "0xbf597fc7beef0ee4",
    "0xc6e00bf33da88fc2",
    "0xd5a79147930aa725",
    "0x06ca6351e003826f",
    "0x142929670a0e6e70",
    "0x27b70a8546d22ffc",
    "0x2e1b21385c26c926",
    "0x4d2c6dfc5ac42aed",
    "0x53380d139d95b3df",
    "0x650a73548baf63de",
    "0x766a0abb3c77b2a8",
    "0x81c2c92e47edaee6",
    "0x92722c851482353b",
    "0xa2bfe8a14cf10364",
    "0xa81a664bbc423001",
    "0xc24b8b70d0f89791",
    "0xc76c51a30654be30",
    "0xd192e819d6ef5218",
    "0xd69906245565a910",
    "0xf40e35855771202a",
    "0x106aa07032bbd1b8",
    "0x19a4c116b8d2d0c8",
    "0x1e376c085141ab53",
    "0x2748774cdf8eeb99",
    "0x34b0bcb5e19b48a8",
    "0x391c0cb3c5c95a63",
    "0x4ed8aa4ae3418acb",
    "0x5b9cca4f7763e373",
    "0x682e6ff3d6b2b8a3",
    "0x748f82ee5defb2fc",
    "0x78a5636f43172f60",
    "0x84c87814a1f0ab72",
    "0x8cc702081a6439ec",
    "0x90befffa23631e28",
    "0xa4506cebde82bde9",
    "0xbef9a3f7b2c67915",
    "0xc67178f2e372532b",
    "0xca273eceea26619c",
    "0xd186b8c721c0c207",
    "0xeada7dd6cde0eb1e",
    "0xf57d4f7fee6ed178",
    "0x06f067aa72176fba",
    "0x0a637dc5a2c898a6",
    "0x113f9804bef90dae",
    "0x1b710b35131c471b",
    "0x28db77f523047d84",
    "0x32caab7b40c72493",
    "0x3c9ebe0a15c9bebc",
    "0x431d67c49c100d4c",
    "0x4cc5d4becb3e42b6",
    "0x597f299cfc657e2a",
    "0x5fcb6fab3ad6faec",
    "0x6c44198c4a475817"
  ].map((n) => BigInt(n))))();
  var SHA512_Kh = /* @__PURE__ */ (() => K512[0])();
  var SHA512_Kl = /* @__PURE__ */ (() => K512[1])();
  var SHA512_W_H = /* @__PURE__ */ new Uint32Array(80);
  var SHA512_W_L = /* @__PURE__ */ new Uint32Array(80);
  var SHA512 = class extends HashMD {
    constructor(outputLen = 64) {
      super(128, outputLen, 16, false);
      this.Ah = SHA512_IV[0] | 0;
      this.Al = SHA512_IV[1] | 0;
      this.Bh = SHA512_IV[2] | 0;
      this.Bl = SHA512_IV[3] | 0;
      this.Ch = SHA512_IV[4] | 0;
      this.Cl = SHA512_IV[5] | 0;
      this.Dh = SHA512_IV[6] | 0;
      this.Dl = SHA512_IV[7] | 0;
      this.Eh = SHA512_IV[8] | 0;
      this.El = SHA512_IV[9] | 0;
      this.Fh = SHA512_IV[10] | 0;
      this.Fl = SHA512_IV[11] | 0;
      this.Gh = SHA512_IV[12] | 0;
      this.Gl = SHA512_IV[13] | 0;
      this.Hh = SHA512_IV[14] | 0;
      this.Hl = SHA512_IV[15] | 0;
    }
    // prettier-ignore
    get() {
      const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
      return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
    }
    // prettier-ignore
    set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
      this.Ah = Ah | 0;
      this.Al = Al | 0;
      this.Bh = Bh | 0;
      this.Bl = Bl | 0;
      this.Ch = Ch | 0;
      this.Cl = Cl | 0;
      this.Dh = Dh | 0;
      this.Dl = Dl | 0;
      this.Eh = Eh | 0;
      this.El = El | 0;
      this.Fh = Fh | 0;
      this.Fl = Fl | 0;
      this.Gh = Gh | 0;
      this.Gl = Gl | 0;
      this.Hh = Hh | 0;
      this.Hl = Hl | 0;
    }
    process(view, offset2) {
      for (let i2 = 0; i2 < 16; i2++, offset2 += 4) {
        SHA512_W_H[i2] = view.getUint32(offset2);
        SHA512_W_L[i2] = view.getUint32(offset2 += 4);
      }
      for (let i2 = 16; i2 < 80; i2++) {
        const W15h = SHA512_W_H[i2 - 15] | 0;
        const W15l = SHA512_W_L[i2 - 15] | 0;
        const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
        const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
        const W2h = SHA512_W_H[i2 - 2] | 0;
        const W2l = SHA512_W_L[i2 - 2] | 0;
        const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
        const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
        const SUMl = add4L(s0l, s1l, SHA512_W_L[i2 - 7], SHA512_W_L[i2 - 16]);
        const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i2 - 7], SHA512_W_H[i2 - 16]);
        SHA512_W_H[i2] = SUMh | 0;
        SHA512_W_L[i2] = SUMl | 0;
      }
      let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
      for (let i2 = 0; i2 < 80; i2++) {
        const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
        const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
        const CHIh = Eh & Fh ^ ~Eh & Gh;
        const CHIl = El & Fl ^ ~El & Gl;
        const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i2], SHA512_W_L[i2]);
        const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i2], SHA512_W_H[i2]);
        const T1l = T1ll | 0;
        const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
        const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
        const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
        const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
        Hh = Gh | 0;
        Hl = Gl | 0;
        Gh = Fh | 0;
        Gl = Fl | 0;
        Fh = Eh | 0;
        Fl = El | 0;
        ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
        Dh = Ch | 0;
        Dl = Cl | 0;
        Ch = Bh | 0;
        Cl = Bl | 0;
        Bh = Ah | 0;
        Bl = Al | 0;
        const All = add3L(T1l, sigma0l, MAJl);
        Ah = add3H(All, T1h, sigma0h, MAJh);
        Al = All | 0;
      }
      ({ h: Ah, l: Al } = add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
      ({ h: Bh, l: Bl } = add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
      ({ h: Ch, l: Cl } = add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
      ({ h: Dh, l: Dl } = add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
      ({ h: Eh, l: El } = add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
      ({ h: Fh, l: Fl } = add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
      ({ h: Gh, l: Gl } = add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
      ({ h: Hh, l: Hl } = add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
      this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
    }
    roundClean() {
      clean(SHA512_W_H, SHA512_W_L);
    }
    destroy() {
      clean(this.buffer);
      this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
  };
  var sha256 = /* @__PURE__ */ createHasher(() => new SHA256());
  var sha512 = /* @__PURE__ */ createHasher(() => new SHA512());

  // node_modules/@noble/curves/esm/abstract/curve.js
  init_buffer_shim();

  // node_modules/@noble/curves/esm/utils.js
  init_buffer_shim();
  var _0n = /* @__PURE__ */ BigInt(0);
  var _1n = /* @__PURE__ */ BigInt(1);
  function _abool2(value, title = "") {
    if (typeof value !== "boolean") {
      const prefix = title && `"${title}"`;
      throw new Error(prefix + "expected boolean, got type=" + typeof value);
    }
    return value;
  }
  function _abytes2(value, length, title = "") {
    const bytes = isBytes(value);
    const len = value?.length;
    const needsLen = length !== void 0;
    if (!bytes || needsLen && len !== length) {
      const prefix = title && `"${title}" `;
      const ofLen = needsLen ? ` of length ${length}` : "";
      const got = bytes ? `length=${len}` : `type=${typeof value}`;
      throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
    }
    return value;
  }
  function numberToHexUnpadded(num) {
    const hex = num.toString(16);
    return hex.length & 1 ? "0" + hex : hex;
  }
  function hexToNumber(hex) {
    if (typeof hex !== "string")
      throw new Error("hex string expected, got " + typeof hex);
    return hex === "" ? _0n : BigInt("0x" + hex);
  }
  function bytesToNumberBE(bytes) {
    return hexToNumber(bytesToHex(bytes));
  }
  function bytesToNumberLE(bytes) {
    abytes(bytes);
    return hexToNumber(bytesToHex(Uint8Array.from(bytes).reverse()));
  }
  function numberToBytesBE(n, len) {
    return hexToBytes(n.toString(16).padStart(len * 2, "0"));
  }
  function numberToBytesLE(n, len) {
    return numberToBytesBE(n, len).reverse();
  }
  function ensureBytes(title, hex, expectedLength) {
    let res;
    if (typeof hex === "string") {
      try {
        res = hexToBytes(hex);
      } catch (e) {
        throw new Error(title + " must be hex string or Uint8Array, cause: " + e);
      }
    } else if (isBytes(hex)) {
      res = Uint8Array.from(hex);
    } else {
      throw new Error(title + " must be hex string or Uint8Array");
    }
    const len = res.length;
    if (typeof expectedLength === "number" && len !== expectedLength)
      throw new Error(title + " of length " + expectedLength + " expected, got " + len);
    return res;
  }
  function equalBytes(a, b) {
    if (a.length !== b.length)
      return false;
    let diff = 0;
    for (let i2 = 0; i2 < a.length; i2++)
      diff |= a[i2] ^ b[i2];
    return diff === 0;
  }
  function copyBytes(bytes) {
    return Uint8Array.from(bytes);
  }
  var isPosBig = (n) => typeof n === "bigint" && _0n <= n;
  function inRange(n, min, max) {
    return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
  }
  function aInRange(title, n, min, max) {
    if (!inRange(n, min, max))
      throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
  }
  function bitLen(n) {
    let len;
    for (len = 0; n > _0n; n >>= _1n, len += 1)
      ;
    return len;
  }
  var bitMask = (n) => (_1n << BigInt(n)) - _1n;
  function createHmacDrbg(hashLen, qByteLen, hmacFn) {
    if (typeof hashLen !== "number" || hashLen < 2)
      throw new Error("hashLen must be a number");
    if (typeof qByteLen !== "number" || qByteLen < 2)
      throw new Error("qByteLen must be a number");
    if (typeof hmacFn !== "function")
      throw new Error("hmacFn must be a function");
    const u8n = (len) => new Uint8Array(len);
    const u8of = (byte) => Uint8Array.of(byte);
    let v = u8n(hashLen);
    let k = u8n(hashLen);
    let i2 = 0;
    const reset = () => {
      v.fill(1);
      k.fill(0);
      i2 = 0;
    };
    const h = (...b) => hmacFn(k, v, ...b);
    const reseed = (seed = u8n(0)) => {
      k = h(u8of(0), seed);
      v = h();
      if (seed.length === 0)
        return;
      k = h(u8of(1), seed);
      v = h();
    };
    const gen2 = () => {
      if (i2++ >= 1e3)
        throw new Error("drbg: tried 1000 values");
      let len = 0;
      const out = [];
      while (len < qByteLen) {
        v = h();
        const sl = v.slice();
        out.push(sl);
        len += v.length;
      }
      return concatBytes(...out);
    };
    const genUntil = (seed, pred) => {
      reset();
      reseed(seed);
      let res = void 0;
      while (!(res = pred(gen2())))
        reseed();
      reset();
      return res;
    };
    return genUntil;
  }
  function _validateObject(object, fields, optFields = {}) {
    if (!object || typeof object !== "object")
      throw new Error("expected valid options object");
    function checkField(fieldName, expectedType, isOpt) {
      const val = object[fieldName];
      if (isOpt && val === void 0)
        return;
      const current = typeof val;
      if (current !== expectedType || val === null)
        throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
    }
    Object.entries(fields).forEach(([k, v]) => checkField(k, v, false));
    Object.entries(optFields).forEach(([k, v]) => checkField(k, v, true));
  }
  var notImplemented = () => {
    throw new Error("not implemented");
  };
  function memoized(fn) {
    const map = /* @__PURE__ */ new WeakMap();
    return (arg, ...args) => {
      const val = map.get(arg);
      if (val !== void 0)
        return val;
      const computed = fn(arg, ...args);
      map.set(arg, computed);
      return computed;
    };
  }

  // node_modules/@noble/curves/esm/abstract/modular.js
  init_buffer_shim();
  var _0n2 = BigInt(0);
  var _1n2 = BigInt(1);
  var _2n = /* @__PURE__ */ BigInt(2);
  var _3n = /* @__PURE__ */ BigInt(3);
  var _4n = /* @__PURE__ */ BigInt(4);
  var _5n = /* @__PURE__ */ BigInt(5);
  var _7n = /* @__PURE__ */ BigInt(7);
  var _8n = /* @__PURE__ */ BigInt(8);
  var _9n = /* @__PURE__ */ BigInt(9);
  var _16n = /* @__PURE__ */ BigInt(16);
  function mod(a, b) {
    const result = a % b;
    return result >= _0n2 ? result : b + result;
  }
  function pow2(x, power, modulo) {
    let res = x;
    while (power-- > _0n2) {
      res *= res;
      res %= modulo;
    }
    return res;
  }
  function invert(number2, modulo) {
    if (number2 === _0n2)
      throw new Error("invert: expected non-zero number");
    if (modulo <= _0n2)
      throw new Error("invert: expected positive modulus, got " + modulo);
    let a = mod(number2, modulo);
    let b = modulo;
    let x = _0n2, y = _1n2, u = _1n2, v = _0n2;
    while (a !== _0n2) {
      const q = b / a;
      const r = b % a;
      const m = x - u * q;
      const n = y - v * q;
      b = a, a = r, x = u, y = v, u = m, v = n;
    }
    const gcd = b;
    if (gcd !== _1n2)
      throw new Error("invert: does not exist");
    return mod(x, modulo);
  }
  function assertIsSquare(Fp2, root, n) {
    if (!Fp2.eql(Fp2.sqr(root), n))
      throw new Error("Cannot find square root");
  }
  function sqrt3mod4(Fp2, n) {
    const p1div4 = (Fp2.ORDER + _1n2) / _4n;
    const root = Fp2.pow(n, p1div4);
    assertIsSquare(Fp2, root, n);
    return root;
  }
  function sqrt5mod8(Fp2, n) {
    const p5div8 = (Fp2.ORDER - _5n) / _8n;
    const n2 = Fp2.mul(n, _2n);
    const v = Fp2.pow(n2, p5div8);
    const nv = Fp2.mul(n, v);
    const i2 = Fp2.mul(Fp2.mul(nv, _2n), v);
    const root = Fp2.mul(nv, Fp2.sub(i2, Fp2.ONE));
    assertIsSquare(Fp2, root, n);
    return root;
  }
  function sqrt9mod16(P) {
    const Fp_ = Field(P);
    const tn = tonelliShanks(P);
    const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
    const c2 = tn(Fp_, c1);
    const c3 = tn(Fp_, Fp_.neg(c1));
    const c4 = (P + _7n) / _16n;
    return (Fp2, n) => {
      let tv1 = Fp2.pow(n, c4);
      let tv2 = Fp2.mul(tv1, c1);
      const tv3 = Fp2.mul(tv1, c2);
      const tv4 = Fp2.mul(tv1, c3);
      const e1 = Fp2.eql(Fp2.sqr(tv2), n);
      const e2 = Fp2.eql(Fp2.sqr(tv3), n);
      tv1 = Fp2.cmov(tv1, tv2, e1);
      tv2 = Fp2.cmov(tv4, tv3, e2);
      const e3 = Fp2.eql(Fp2.sqr(tv2), n);
      const root = Fp2.cmov(tv1, tv2, e3);
      assertIsSquare(Fp2, root, n);
      return root;
    };
  }
  function tonelliShanks(P) {
    if (P < _3n)
      throw new Error("sqrt is not defined for small field");
    let Q = P - _1n2;
    let S = 0;
    while (Q % _2n === _0n2) {
      Q /= _2n;
      S++;
    }
    let Z = _2n;
    const _Fp = Field(P);
    while (FpLegendre(_Fp, Z) === 1) {
      if (Z++ > 1e3)
        throw new Error("Cannot find square root: probably non-prime P");
    }
    if (S === 1)
      return sqrt3mod4;
    let cc = _Fp.pow(Z, Q);
    const Q1div2 = (Q + _1n2) / _2n;
    return function tonelliSlow(Fp2, n) {
      if (Fp2.is0(n))
        return n;
      if (FpLegendre(Fp2, n) !== 1)
        throw new Error("Cannot find square root");
      let M = S;
      let c = Fp2.mul(Fp2.ONE, cc);
      let t = Fp2.pow(n, Q);
      let R = Fp2.pow(n, Q1div2);
      while (!Fp2.eql(t, Fp2.ONE)) {
        if (Fp2.is0(t))
          return Fp2.ZERO;
        let i2 = 1;
        let t_tmp = Fp2.sqr(t);
        while (!Fp2.eql(t_tmp, Fp2.ONE)) {
          i2++;
          t_tmp = Fp2.sqr(t_tmp);
          if (i2 === M)
            throw new Error("Cannot find square root");
        }
        const exponent = _1n2 << BigInt(M - i2 - 1);
        const b = Fp2.pow(c, exponent);
        M = i2;
        c = Fp2.sqr(b);
        t = Fp2.mul(t, c);
        R = Fp2.mul(R, b);
      }
      return R;
    };
  }
  function FpSqrt(P) {
    if (P % _4n === _3n)
      return sqrt3mod4;
    if (P % _8n === _5n)
      return sqrt5mod8;
    if (P % _16n === _9n)
      return sqrt9mod16(P);
    return tonelliShanks(P);
  }
  var isNegativeLE = (num, modulo) => (mod(num, modulo) & _1n2) === _1n2;
  var FIELD_FIELDS = [
    "create",
    "isValid",
    "is0",
    "neg",
    "inv",
    "sqrt",
    "sqr",
    "eql",
    "add",
    "sub",
    "mul",
    "pow",
    "div",
    "addN",
    "subN",
    "mulN",
    "sqrN"
  ];
  function validateField(field) {
    const initial = {
      ORDER: "bigint",
      MASK: "bigint",
      BYTES: "number",
      BITS: "number"
    };
    const opts = FIELD_FIELDS.reduce((map, val) => {
      map[val] = "function";
      return map;
    }, initial);
    _validateObject(field, opts);
    return field;
  }
  function FpPow(Fp2, num, power) {
    if (power < _0n2)
      throw new Error("invalid exponent, negatives unsupported");
    if (power === _0n2)
      return Fp2.ONE;
    if (power === _1n2)
      return num;
    let p = Fp2.ONE;
    let d = num;
    while (power > _0n2) {
      if (power & _1n2)
        p = Fp2.mul(p, d);
      d = Fp2.sqr(d);
      power >>= _1n2;
    }
    return p;
  }
  function FpInvertBatch(Fp2, nums, passZero = false) {
    const inverted = new Array(nums.length).fill(passZero ? Fp2.ZERO : void 0);
    const multipliedAcc = nums.reduce((acc, num, i2) => {
      if (Fp2.is0(num))
        return acc;
      inverted[i2] = acc;
      return Fp2.mul(acc, num);
    }, Fp2.ONE);
    const invertedAcc = Fp2.inv(multipliedAcc);
    nums.reduceRight((acc, num, i2) => {
      if (Fp2.is0(num))
        return acc;
      inverted[i2] = Fp2.mul(acc, inverted[i2]);
      return Fp2.mul(acc, num);
    }, invertedAcc);
    return inverted;
  }
  function FpLegendre(Fp2, n) {
    const p1mod2 = (Fp2.ORDER - _1n2) / _2n;
    const powered = Fp2.pow(n, p1mod2);
    const yes = Fp2.eql(powered, Fp2.ONE);
    const zero = Fp2.eql(powered, Fp2.ZERO);
    const no = Fp2.eql(powered, Fp2.neg(Fp2.ONE));
    if (!yes && !zero && !no)
      throw new Error("invalid Legendre symbol result");
    return yes ? 1 : zero ? 0 : -1;
  }
  function nLength(n, nBitLength) {
    if (nBitLength !== void 0)
      anumber(nBitLength);
    const _nBitLength = nBitLength !== void 0 ? nBitLength : n.toString(2).length;
    const nByteLength = Math.ceil(_nBitLength / 8);
    return { nBitLength: _nBitLength, nByteLength };
  }
  function Field(ORDER, bitLenOrOpts, isLE2 = false, opts = {}) {
    if (ORDER <= _0n2)
      throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
    let _nbitLength = void 0;
    let _sqrt = void 0;
    let modFromBytes = false;
    let allowedLengths = void 0;
    if (typeof bitLenOrOpts === "object" && bitLenOrOpts != null) {
      if (opts.sqrt || isLE2)
        throw new Error("cannot specify opts in two arguments");
      const _opts = bitLenOrOpts;
      if (_opts.BITS)
        _nbitLength = _opts.BITS;
      if (_opts.sqrt)
        _sqrt = _opts.sqrt;
      if (typeof _opts.isLE === "boolean")
        isLE2 = _opts.isLE;
      if (typeof _opts.modFromBytes === "boolean")
        modFromBytes = _opts.modFromBytes;
      allowedLengths = _opts.allowedLengths;
    } else {
      if (typeof bitLenOrOpts === "number")
        _nbitLength = bitLenOrOpts;
      if (opts.sqrt)
        _sqrt = opts.sqrt;
    }
    const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, _nbitLength);
    if (BYTES > 2048)
      throw new Error("invalid field: expected ORDER of <= 2048 bytes");
    let sqrtP;
    const f2 = Object.freeze({
      ORDER,
      isLE: isLE2,
      BITS,
      BYTES,
      MASK: bitMask(BITS),
      ZERO: _0n2,
      ONE: _1n2,
      allowedLengths,
      create: (num) => mod(num, ORDER),
      isValid: (num) => {
        if (typeof num !== "bigint")
          throw new Error("invalid field element: expected bigint, got " + typeof num);
        return _0n2 <= num && num < ORDER;
      },
      is0: (num) => num === _0n2,
      // is valid and invertible
      isValidNot0: (num) => !f2.is0(num) && f2.isValid(num),
      isOdd: (num) => (num & _1n2) === _1n2,
      neg: (num) => mod(-num, ORDER),
      eql: (lhs, rhs) => lhs === rhs,
      sqr: (num) => mod(num * num, ORDER),
      add: (lhs, rhs) => mod(lhs + rhs, ORDER),
      sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
      mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
      pow: (num, power) => FpPow(f2, num, power),
      div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
      // Same as above, but doesn't normalize
      sqrN: (num) => num * num,
      addN: (lhs, rhs) => lhs + rhs,
      subN: (lhs, rhs) => lhs - rhs,
      mulN: (lhs, rhs) => lhs * rhs,
      inv: (num) => invert(num, ORDER),
      sqrt: _sqrt || ((n) => {
        if (!sqrtP)
          sqrtP = FpSqrt(ORDER);
        return sqrtP(f2, n);
      }),
      toBytes: (num) => isLE2 ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES),
      fromBytes: (bytes, skipValidation = true) => {
        if (allowedLengths) {
          if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
            throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
          }
          const padded = new Uint8Array(BYTES);
          padded.set(bytes, isLE2 ? 0 : padded.length - bytes.length);
          bytes = padded;
        }
        if (bytes.length !== BYTES)
          throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
        let scalar = isLE2 ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
        if (modFromBytes)
          scalar = mod(scalar, ORDER);
        if (!skipValidation) {
          if (!f2.isValid(scalar))
            throw new Error("invalid field element: outside of range 0..ORDER");
        }
        return scalar;
      },
      // TODO: we don't need it here, move out to separate fn
      invertBatch: (lst) => FpInvertBatch(f2, lst),
      // We can't move this out because Fp6, Fp12 implement it
      // and it's unclear what to return in there.
      cmov: (a, b, c) => c ? b : a
    });
    return Object.freeze(f2);
  }
  function getFieldBytesLength(fieldOrder) {
    if (typeof fieldOrder !== "bigint")
      throw new Error("field order must be bigint");
    const bitLength = fieldOrder.toString(2).length;
    return Math.ceil(bitLength / 8);
  }
  function getMinHashLength(fieldOrder) {
    const length = getFieldBytesLength(fieldOrder);
    return length + Math.ceil(length / 2);
  }
  function mapHashToField(key, fieldOrder, isLE2 = false) {
    const len = key.length;
    const fieldLen = getFieldBytesLength(fieldOrder);
    const minLen = getMinHashLength(fieldOrder);
    if (len < 16 || len < minLen || len > 1024)
      throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
    const num = isLE2 ? bytesToNumberLE(key) : bytesToNumberBE(key);
    const reduced = mod(num, fieldOrder - _1n2) + _1n2;
    return isLE2 ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
  }

  // node_modules/@noble/curves/esm/abstract/curve.js
  var _0n3 = BigInt(0);
  var _1n3 = BigInt(1);
  function negateCt(condition, item) {
    const neg = item.negate();
    return condition ? neg : item;
  }
  function normalizeZ(c, points) {
    const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
    return points.map((p, i2) => c.fromAffine(p.toAffine(invertedZs[i2])));
  }
  function validateW(W, bits) {
    if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
      throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
  }
  function calcWOpts(W, scalarBits) {
    validateW(W, scalarBits);
    const windows = Math.ceil(scalarBits / W) + 1;
    const windowSize = 2 ** (W - 1);
    const maxNumber = 2 ** W;
    const mask2 = bitMask(W);
    const shiftBy = BigInt(W);
    return { windows, windowSize, mask: mask2, maxNumber, shiftBy };
  }
  function calcOffsets(n, window2, wOpts) {
    const { windowSize, mask: mask2, maxNumber, shiftBy } = wOpts;
    let wbits = Number(n & mask2);
    let nextN = n >> shiftBy;
    if (wbits > windowSize) {
      wbits -= maxNumber;
      nextN += _1n3;
    }
    const offsetStart = window2 * windowSize;
    const offset2 = offsetStart + Math.abs(wbits) - 1;
    const isZero = wbits === 0;
    const isNeg = wbits < 0;
    const isNegF = window2 % 2 !== 0;
    const offsetF = offsetStart;
    return { nextN, offset: offset2, isZero, isNeg, isNegF, offsetF };
  }
  function validateMSMPoints(points, c) {
    if (!Array.isArray(points))
      throw new Error("array expected");
    points.forEach((p, i2) => {
      if (!(p instanceof c))
        throw new Error("invalid point at index " + i2);
    });
  }
  function validateMSMScalars(scalars, field) {
    if (!Array.isArray(scalars))
      throw new Error("array of scalars expected");
    scalars.forEach((s, i2) => {
      if (!field.isValid(s))
        throw new Error("invalid scalar at index " + i2);
    });
  }
  var pointPrecomputes = /* @__PURE__ */ new WeakMap();
  var pointWindowSizes = /* @__PURE__ */ new WeakMap();
  function getW(P) {
    return pointWindowSizes.get(P) || 1;
  }
  function assert0(n) {
    if (n !== _0n3)
      throw new Error("invalid wNAF");
  }
  var wNAF = class {
    // Parametrized with a given Point class (not individual point)
    constructor(Point, bits) {
      this.BASE = Point.BASE;
      this.ZERO = Point.ZERO;
      this.Fn = Point.Fn;
      this.bits = bits;
    }
    // non-const time multiplication ladder
    _unsafeLadder(elm, n, p = this.ZERO) {
      let d = elm;
      while (n > _0n3) {
        if (n & _1n3)
          p = p.add(d);
        d = d.double();
        n >>= _1n3;
      }
      return p;
    }
    /**
     * Creates a wNAF precomputation window. Used for caching.
     * Default window size is set by `utils.precompute()` and is equal to 8.
     * Number of precomputed points depends on the curve size:
     * 2^(𝑊−1) * (Math.ceil(𝑛 / 𝑊) + 1), where:
     * - 𝑊 is the window size
     * - 𝑛 is the bitlength of the curve order.
     * For a 256-bit curve and window size 8, the number of precomputed points is 128 * 33 = 4224.
     * @param point Point instance
     * @param W window size
     * @returns precomputed point tables flattened to a single array
     */
    precomputeWindow(point, W) {
      const { windows, windowSize } = calcWOpts(W, this.bits);
      const points = [];
      let p = point;
      let base = p;
      for (let window2 = 0; window2 < windows; window2++) {
        base = p;
        points.push(base);
        for (let i2 = 1; i2 < windowSize; i2++) {
          base = base.add(p);
          points.push(base);
        }
        p = base.double();
      }
      return points;
    }
    /**
     * Implements ec multiplication using precomputed tables and w-ary non-adjacent form.
     * More compact implementation:
     * https://github.com/paulmillr/noble-secp256k1/blob/47cb1669b6e506ad66b35fe7d76132ae97465da2/index.ts#L502-L541
     * @returns real and fake (for const-time) points
     */
    wNAF(W, precomputes, n) {
      if (!this.Fn.isValid(n))
        throw new Error("invalid scalar");
      let p = this.ZERO;
      let f2 = this.BASE;
      const wo = calcWOpts(W, this.bits);
      for (let window2 = 0; window2 < wo.windows; window2++) {
        const { nextN, offset: offset2, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window2, wo);
        n = nextN;
        if (isZero) {
          f2 = f2.add(negateCt(isNegF, precomputes[offsetF]));
        } else {
          p = p.add(negateCt(isNeg, precomputes[offset2]));
        }
      }
      assert0(n);
      return { p, f: f2 };
    }
    /**
     * Implements ec unsafe (non const-time) multiplication using precomputed tables and w-ary non-adjacent form.
     * @param acc accumulator point to add result of multiplication
     * @returns point
     */
    wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
      const wo = calcWOpts(W, this.bits);
      for (let window2 = 0; window2 < wo.windows; window2++) {
        if (n === _0n3)
          break;
        const { nextN, offset: offset2, isZero, isNeg } = calcOffsets(n, window2, wo);
        n = nextN;
        if (isZero) {
          continue;
        } else {
          const item = precomputes[offset2];
          acc = acc.add(isNeg ? item.negate() : item);
        }
      }
      assert0(n);
      return acc;
    }
    getPrecomputes(W, point, transform) {
      let comp = pointPrecomputes.get(point);
      if (!comp) {
        comp = this.precomputeWindow(point, W);
        if (W !== 1) {
          if (typeof transform === "function")
            comp = transform(comp);
          pointPrecomputes.set(point, comp);
        }
      }
      return comp;
    }
    cached(point, scalar, transform) {
      const W = getW(point);
      return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
    }
    unsafe(point, scalar, transform, prev) {
      const W = getW(point);
      if (W === 1)
        return this._unsafeLadder(point, scalar, prev);
      return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
    }
    // We calculate precomputes for elliptic curve point multiplication
    // using windowed method. This specifies window size and
    // stores precomputed values. Usually only base point would be precomputed.
    createCache(P, W) {
      validateW(W, this.bits);
      pointWindowSizes.set(P, W);
      pointPrecomputes.delete(P);
    }
    hasCache(elm) {
      return getW(elm) !== 1;
    }
  };
  function mulEndoUnsafe(Point, point, k1, k2) {
    let acc = point;
    let p1 = Point.ZERO;
    let p2 = Point.ZERO;
    while (k1 > _0n3 || k2 > _0n3) {
      if (k1 & _1n3)
        p1 = p1.add(acc);
      if (k2 & _1n3)
        p2 = p2.add(acc);
      acc = acc.double();
      k1 >>= _1n3;
      k2 >>= _1n3;
    }
    return { p1, p2 };
  }
  function pippenger(c, fieldN, points, scalars) {
    validateMSMPoints(points, c);
    validateMSMScalars(scalars, fieldN);
    const plength = points.length;
    const slength = scalars.length;
    if (plength !== slength)
      throw new Error("arrays of points and scalars must have equal length");
    const zero = c.ZERO;
    const wbits = bitLen(BigInt(plength));
    let windowSize = 1;
    if (wbits > 12)
      windowSize = wbits - 3;
    else if (wbits > 4)
      windowSize = wbits - 2;
    else if (wbits > 0)
      windowSize = 2;
    const MASK = bitMask(windowSize);
    const buckets = new Array(Number(MASK) + 1).fill(zero);
    const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
    let sum = zero;
    for (let i2 = lastBits; i2 >= 0; i2 -= windowSize) {
      buckets.fill(zero);
      for (let j = 0; j < slength; j++) {
        const scalar = scalars[j];
        const wbits2 = Number(scalar >> BigInt(i2) & MASK);
        buckets[wbits2] = buckets[wbits2].add(points[j]);
      }
      let resI = zero;
      for (let j = buckets.length - 1, sumI = zero; j > 0; j--) {
        sumI = sumI.add(buckets[j]);
        resI = resI.add(sumI);
      }
      sum = sum.add(resI);
      if (i2 !== 0)
        for (let j = 0; j < windowSize; j++)
          sum = sum.double();
    }
    return sum;
  }
  function createField(order, field, isLE2) {
    if (field) {
      if (field.ORDER !== order)
        throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
      validateField(field);
      return field;
    } else {
      return Field(order, { isLE: isLE2 });
    }
  }
  function _createCurveFields(type2, CURVE, curveOpts = {}, FpFnLE) {
    if (FpFnLE === void 0)
      FpFnLE = type2 === "edwards";
    if (!CURVE || typeof CURVE !== "object")
      throw new Error(`expected valid ${type2} CURVE object`);
    for (const p of ["p", "n", "h"]) {
      const val = CURVE[p];
      if (!(typeof val === "bigint" && val > _0n3))
        throw new Error(`CURVE.${p} must be positive bigint`);
    }
    const Fp2 = createField(CURVE.p, curveOpts.Fp, FpFnLE);
    const Fn2 = createField(CURVE.n, curveOpts.Fn, FpFnLE);
    const _b = type2 === "weierstrass" ? "b" : "d";
    const params = ["Gx", "Gy", "a", _b];
    for (const p of params) {
      if (!Fp2.isValid(CURVE[p]))
        throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
    }
    CURVE = Object.freeze(Object.assign({}, CURVE));
    return { CURVE, Fp: Fp2, Fn: Fn2 };
  }

  // node_modules/@noble/curves/esm/abstract/edwards.js
  init_buffer_shim();
  var _0n4 = BigInt(0);
  var _1n4 = BigInt(1);
  var _2n2 = BigInt(2);
  var _8n2 = BigInt(8);
  function isEdValidXY(Fp2, CURVE, x, y) {
    const x2 = Fp2.sqr(x);
    const y2 = Fp2.sqr(y);
    const left = Fp2.add(Fp2.mul(CURVE.a, x2), y2);
    const right = Fp2.add(Fp2.ONE, Fp2.mul(CURVE.d, Fp2.mul(x2, y2)));
    return Fp2.eql(left, right);
  }
  function edwards(params, extraOpts = {}) {
    const validated = _createCurveFields("edwards", params, extraOpts, extraOpts.FpFnLE);
    const { Fp: Fp2, Fn: Fn2 } = validated;
    let CURVE = validated.CURVE;
    const { h: cofactor } = CURVE;
    _validateObject(extraOpts, {}, { uvRatio: "function" });
    const MASK = _2n2 << BigInt(Fn2.BYTES * 8) - _1n4;
    const modP = (n) => Fp2.create(n);
    const uvRatio2 = extraOpts.uvRatio || ((u, v) => {
      try {
        return { isValid: true, value: Fp2.sqrt(Fp2.div(u, v)) };
      } catch (e) {
        return { isValid: false, value: _0n4 };
      }
    });
    if (!isEdValidXY(Fp2, CURVE, CURVE.Gx, CURVE.Gy))
      throw new Error("bad curve params: generator point");
    function acoord(title, n, banZero = false) {
      const min = banZero ? _1n4 : _0n4;
      aInRange("coordinate " + title, n, min, MASK);
      return n;
    }
    function aextpoint(other) {
      if (!(other instanceof Point))
        throw new Error("ExtendedPoint expected");
    }
    const toAffineMemo = memoized((p, iz) => {
      const { X, Y, Z } = p;
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? _8n2 : Fp2.inv(Z);
      const x = modP(X * iz);
      const y = modP(Y * iz);
      const zz = Fp2.mul(Z, iz);
      if (is0)
        return { x: _0n4, y: _1n4 };
      if (zz !== _1n4)
        throw new Error("invZ was invalid");
      return { x, y };
    });
    const assertValidMemo = memoized((p) => {
      const { a, d } = CURVE;
      if (p.is0())
        throw new Error("bad point: ZERO");
      const { X, Y, Z, T } = p;
      const X2 = modP(X * X);
      const Y2 = modP(Y * Y);
      const Z2 = modP(Z * Z);
      const Z4 = modP(Z2 * Z2);
      const aX2 = modP(X2 * a);
      const left = modP(Z2 * modP(aX2 + Y2));
      const right = modP(Z4 + modP(d * modP(X2 * Y2)));
      if (left !== right)
        throw new Error("bad point: equation left != right (1)");
      const XY = modP(X * Y);
      const ZT = modP(Z * T);
      if (XY !== ZT)
        throw new Error("bad point: equation left != right (2)");
      return true;
    });
    class Point {
      constructor(X, Y, Z, T) {
        this.X = acoord("x", X);
        this.Y = acoord("y", Y);
        this.Z = acoord("z", Z, true);
        this.T = acoord("t", T);
        Object.freeze(this);
      }
      static CURVE() {
        return CURVE;
      }
      static fromAffine(p) {
        if (p instanceof Point)
          throw new Error("extended point not allowed");
        const { x, y } = p || {};
        acoord("x", x);
        acoord("y", y);
        return new Point(x, y, _1n4, modP(x * y));
      }
      // Uses algo from RFC8032 5.1.3.
      static fromBytes(bytes, zip215 = false) {
        const len = Fp2.BYTES;
        const { a, d } = CURVE;
        bytes = copyBytes(_abytes2(bytes, len, "point"));
        _abool2(zip215, "zip215");
        const normed = copyBytes(bytes);
        const lastByte = bytes[len - 1];
        normed[len - 1] = lastByte & ~128;
        const y = bytesToNumberLE(normed);
        const max = zip215 ? MASK : Fp2.ORDER;
        aInRange("point.y", y, _0n4, max);
        const y2 = modP(y * y);
        const u = modP(y2 - _1n4);
        const v = modP(d * y2 - a);
        let { isValid, value: x } = uvRatio2(u, v);
        if (!isValid)
          throw new Error("bad point: invalid y coordinate");
        const isXOdd = (x & _1n4) === _1n4;
        const isLastByteOdd = (lastByte & 128) !== 0;
        if (!zip215 && x === _0n4 && isLastByteOdd)
          throw new Error("bad point: x=0 and x_0=1");
        if (isLastByteOdd !== isXOdd)
          x = modP(-x);
        return Point.fromAffine({ x, y });
      }
      static fromHex(bytes, zip215 = false) {
        return Point.fromBytes(ensureBytes("point", bytes), zip215);
      }
      get x() {
        return this.toAffine().x;
      }
      get y() {
        return this.toAffine().y;
      }
      precompute(windowSize = 8, isLazy = true) {
        wnaf.createCache(this, windowSize);
        if (!isLazy)
          this.multiply(_2n2);
        return this;
      }
      // Useful in fromAffine() - not for fromBytes(), which always created valid points.
      assertValidity() {
        assertValidMemo(this);
      }
      // Compare one point to another.
      equals(other) {
        aextpoint(other);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const { X: X2, Y: Y2, Z: Z2 } = other;
        const X1Z2 = modP(X1 * Z2);
        const X2Z1 = modP(X2 * Z1);
        const Y1Z2 = modP(Y1 * Z2);
        const Y2Z1 = modP(Y2 * Z1);
        return X1Z2 === X2Z1 && Y1Z2 === Y2Z1;
      }
      is0() {
        return this.equals(Point.ZERO);
      }
      negate() {
        return new Point(modP(-this.X), this.Y, this.Z, modP(-this.T));
      }
      // Fast algo for doubling Extended Point.
      // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#doubling-dbl-2008-hwcd
      // Cost: 4M + 4S + 1*a + 6add + 1*2.
      double() {
        const { a } = CURVE;
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const A = modP(X1 * X1);
        const B = modP(Y1 * Y1);
        const C = modP(_2n2 * modP(Z1 * Z1));
        const D = modP(a * A);
        const x1y1 = X1 + Y1;
        const E = modP(modP(x1y1 * x1y1) - A - B);
        const G = D + B;
        const F = G - C;
        const H = D - B;
        const X3 = modP(E * F);
        const Y3 = modP(G * H);
        const T3 = modP(E * H);
        const Z3 = modP(F * G);
        return new Point(X3, Y3, Z3, T3);
      }
      // Fast algo for adding 2 Extended Points.
      // https://hyperelliptic.org/EFD/g1p/auto-twisted-extended.html#addition-add-2008-hwcd
      // Cost: 9M + 1*a + 1*d + 7add.
      add(other) {
        aextpoint(other);
        const { a, d } = CURVE;
        const { X: X1, Y: Y1, Z: Z1, T: T1 } = this;
        const { X: X2, Y: Y2, Z: Z2, T: T2 } = other;
        const A = modP(X1 * X2);
        const B = modP(Y1 * Y2);
        const C = modP(T1 * d * T2);
        const D = modP(Z1 * Z2);
        const E = modP((X1 + Y1) * (X2 + Y2) - A - B);
        const F = D - C;
        const G = D + C;
        const H = modP(B - a * A);
        const X3 = modP(E * F);
        const Y3 = modP(G * H);
        const T3 = modP(E * H);
        const Z3 = modP(F * G);
        return new Point(X3, Y3, Z3, T3);
      }
      subtract(other) {
        return this.add(other.negate());
      }
      // Constant-time multiplication.
      multiply(scalar) {
        if (!Fn2.isValidNot0(scalar))
          throw new Error("invalid scalar: expected 1 <= sc < curve.n");
        const { p, f: f2 } = wnaf.cached(this, scalar, (p2) => normalizeZ(Point, p2));
        return normalizeZ(Point, [p, f2])[0];
      }
      // Non-constant-time multiplication. Uses double-and-add algorithm.
      // It's faster, but should only be used when you don't care about
      // an exposed private key e.g. sig verification.
      // Does NOT allow scalars higher than CURVE.n.
      // Accepts optional accumulator to merge with multiply (important for sparse scalars)
      multiplyUnsafe(scalar, acc = Point.ZERO) {
        if (!Fn2.isValid(scalar))
          throw new Error("invalid scalar: expected 0 <= sc < curve.n");
        if (scalar === _0n4)
          return Point.ZERO;
        if (this.is0() || scalar === _1n4)
          return this;
        return wnaf.unsafe(this, scalar, (p) => normalizeZ(Point, p), acc);
      }
      // Checks if point is of small order.
      // If you add something to small order point, you will have "dirty"
      // point with torsion component.
      // Multiplies point by cofactor and checks if the result is 0.
      isSmallOrder() {
        return this.multiplyUnsafe(cofactor).is0();
      }
      // Multiplies point by curve order and checks if the result is 0.
      // Returns `false` is the point is dirty.
      isTorsionFree() {
        return wnaf.unsafe(this, CURVE.n).is0();
      }
      // Converts Extended point to default (x, y) coordinates.
      // Can accept precomputed Z^-1 - for example, from invertBatch.
      toAffine(invertedZ) {
        return toAffineMemo(this, invertedZ);
      }
      clearCofactor() {
        if (cofactor === _1n4)
          return this;
        return this.multiplyUnsafe(cofactor);
      }
      toBytes() {
        const { x, y } = this.toAffine();
        const bytes = Fp2.toBytes(y);
        bytes[bytes.length - 1] |= x & _1n4 ? 128 : 0;
        return bytes;
      }
      toHex() {
        return bytesToHex(this.toBytes());
      }
      toString() {
        return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
      }
      // TODO: remove
      get ex() {
        return this.X;
      }
      get ey() {
        return this.Y;
      }
      get ez() {
        return this.Z;
      }
      get et() {
        return this.T;
      }
      static normalizeZ(points) {
        return normalizeZ(Point, points);
      }
      static msm(points, scalars) {
        return pippenger(Point, Fn2, points, scalars);
      }
      _setWindowSize(windowSize) {
        this.precompute(windowSize);
      }
      toRawBytes() {
        return this.toBytes();
      }
    }
    Point.BASE = new Point(CURVE.Gx, CURVE.Gy, _1n4, modP(CURVE.Gx * CURVE.Gy));
    Point.ZERO = new Point(_0n4, _1n4, _1n4, _0n4);
    Point.Fp = Fp2;
    Point.Fn = Fn2;
    const wnaf = new wNAF(Point, Fn2.BITS);
    Point.BASE.precompute(8);
    return Point;
  }
  var PrimeEdwardsPoint = class {
    constructor(ep) {
      this.ep = ep;
    }
    // Static methods that must be implemented by subclasses
    static fromBytes(_bytes) {
      notImplemented();
    }
    static fromHex(_hex) {
      notImplemented();
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    // Common implementations
    clearCofactor() {
      return this;
    }
    assertValidity() {
      this.ep.assertValidity();
    }
    toAffine(invertedZ) {
      return this.ep.toAffine(invertedZ);
    }
    toHex() {
      return bytesToHex(this.toBytes());
    }
    toString() {
      return this.toHex();
    }
    isTorsionFree() {
      return true;
    }
    isSmallOrder() {
      return false;
    }
    add(other) {
      this.assertSame(other);
      return this.init(this.ep.add(other.ep));
    }
    subtract(other) {
      this.assertSame(other);
      return this.init(this.ep.subtract(other.ep));
    }
    multiply(scalar) {
      return this.init(this.ep.multiply(scalar));
    }
    multiplyUnsafe(scalar) {
      return this.init(this.ep.multiplyUnsafe(scalar));
    }
    double() {
      return this.init(this.ep.double());
    }
    negate() {
      return this.init(this.ep.negate());
    }
    precompute(windowSize, isLazy) {
      return this.init(this.ep.precompute(windowSize, isLazy));
    }
    /** @deprecated use `toBytes` */
    toRawBytes() {
      return this.toBytes();
    }
  };
  function eddsa(Point, cHash, eddsaOpts = {}) {
    if (typeof cHash !== "function")
      throw new Error('"hash" function param is required');
    _validateObject(eddsaOpts, {}, {
      adjustScalarBytes: "function",
      randomBytes: "function",
      domain: "function",
      prehash: "function",
      mapToCurve: "function"
    });
    const { prehash } = eddsaOpts;
    const { BASE: BASE2, Fp: Fp2, Fn: Fn2 } = Point;
    const randomBytes2 = eddsaOpts.randomBytes || randomBytes;
    const adjustScalarBytes2 = eddsaOpts.adjustScalarBytes || ((bytes) => bytes);
    const domain = eddsaOpts.domain || ((data, ctx, phflag) => {
      _abool2(phflag, "phflag");
      if (ctx.length || phflag)
        throw new Error("Contexts/pre-hash are not supported");
      return data;
    });
    function modN_LE(hash) {
      return Fn2.create(bytesToNumberLE(hash));
    }
    function getPrivateScalar(key) {
      const len = lengths.secretKey;
      key = ensureBytes("private key", key, len);
      const hashed = ensureBytes("hashed private key", cHash(key), 2 * len);
      const head = adjustScalarBytes2(hashed.slice(0, len));
      const prefix = hashed.slice(len, 2 * len);
      const scalar = modN_LE(head);
      return { head, prefix, scalar };
    }
    function getExtendedPublicKey(secretKey) {
      const { head, prefix, scalar } = getPrivateScalar(secretKey);
      const point = BASE2.multiply(scalar);
      const pointBytes = point.toBytes();
      return { head, prefix, scalar, point, pointBytes };
    }
    function getPublicKey2(secretKey) {
      return getExtendedPublicKey(secretKey).pointBytes;
    }
    function hashDomainToScalar(context = Uint8Array.of(), ...msgs) {
      const msg = concatBytes(...msgs);
      return modN_LE(cHash(domain(msg, ensureBytes("context", context), !!prehash)));
    }
    function sign2(msg, secretKey, options = {}) {
      msg = ensureBytes("message", msg);
      if (prehash)
        msg = prehash(msg);
      const { prefix, scalar, pointBytes } = getExtendedPublicKey(secretKey);
      const r = hashDomainToScalar(options.context, prefix, msg);
      const R = BASE2.multiply(r).toBytes();
      const k = hashDomainToScalar(options.context, R, pointBytes, msg);
      const s = Fn2.create(r + k * scalar);
      if (!Fn2.isValid(s))
        throw new Error("sign failed: invalid s");
      const rs = concatBytes(R, Fn2.toBytes(s));
      return _abytes2(rs, lengths.signature, "result");
    }
    const verifyOpts = { zip215: true };
    function verify2(sig, msg, publicKey3, options = verifyOpts) {
      const { context, zip215 } = options;
      const len = lengths.signature;
      sig = ensureBytes("signature", sig, len);
      msg = ensureBytes("message", msg);
      publicKey3 = ensureBytes("publicKey", publicKey3, lengths.publicKey);
      if (zip215 !== void 0)
        _abool2(zip215, "zip215");
      if (prehash)
        msg = prehash(msg);
      const mid = len / 2;
      const r = sig.subarray(0, mid);
      const s = bytesToNumberLE(sig.subarray(mid, len));
      let A, R, SB;
      try {
        A = Point.fromBytes(publicKey3, zip215);
        R = Point.fromBytes(r, zip215);
        SB = BASE2.multiplyUnsafe(s);
      } catch (error) {
        return false;
      }
      if (!zip215 && A.isSmallOrder())
        return false;
      const k = hashDomainToScalar(context, R.toBytes(), A.toBytes(), msg);
      const RkA = R.add(A.multiplyUnsafe(k));
      return RkA.subtract(SB).clearCofactor().is0();
    }
    const _size = Fp2.BYTES;
    const lengths = {
      secretKey: _size,
      publicKey: _size,
      signature: 2 * _size,
      seed: _size
    };
    function randomSecretKey(seed = randomBytes2(lengths.seed)) {
      return _abytes2(seed, lengths.seed, "seed");
    }
    function keygen(seed) {
      const secretKey = utils.randomSecretKey(seed);
      return { secretKey, publicKey: getPublicKey2(secretKey) };
    }
    function isValidSecretKey(key) {
      return isBytes(key) && key.length === Fn2.BYTES;
    }
    function isValidPublicKey(key, zip215) {
      try {
        return !!Point.fromBytes(key, zip215);
      } catch (error) {
        return false;
      }
    }
    const utils = {
      getExtendedPublicKey,
      randomSecretKey,
      isValidSecretKey,
      isValidPublicKey,
      /**
       * Converts ed public key to x public key. Uses formula:
       * - ed25519:
       *   - `(u, v) = ((1+y)/(1-y), sqrt(-486664)*u/x)`
       *   - `(x, y) = (sqrt(-486664)*u/v, (u-1)/(u+1))`
       * - ed448:
       *   - `(u, v) = ((y-1)/(y+1), sqrt(156324)*u/x)`
       *   - `(x, y) = (sqrt(156324)*u/v, (1+u)/(1-u))`
       */
      toMontgomery(publicKey3) {
        const { y } = Point.fromBytes(publicKey3);
        const size = lengths.publicKey;
        const is25519 = size === 32;
        if (!is25519 && size !== 57)
          throw new Error("only defined for 25519 and 448");
        const u = is25519 ? Fp2.div(_1n4 + y, _1n4 - y) : Fp2.div(y - _1n4, y + _1n4);
        return Fp2.toBytes(u);
      },
      toMontgomerySecret(secretKey) {
        const size = lengths.secretKey;
        _abytes2(secretKey, size);
        const hashed = cHash(secretKey.subarray(0, size));
        return adjustScalarBytes2(hashed).subarray(0, size);
      },
      /** @deprecated */
      randomPrivateKey: randomSecretKey,
      /** @deprecated */
      precompute(windowSize = 8, point = Point.BASE) {
        return point.precompute(windowSize, false);
      }
    };
    return Object.freeze({
      keygen,
      getPublicKey: getPublicKey2,
      sign: sign2,
      verify: verify2,
      utils,
      Point,
      lengths
    });
  }
  function _eddsa_legacy_opts_to_new(c) {
    const CURVE = {
      a: c.a,
      d: c.d,
      p: c.Fp.ORDER,
      n: c.n,
      h: c.h,
      Gx: c.Gx,
      Gy: c.Gy
    };
    const Fp2 = c.Fp;
    const Fn2 = Field(CURVE.n, c.nBitLength, true);
    const curveOpts = { Fp: Fp2, Fn: Fn2, uvRatio: c.uvRatio };
    const eddsaOpts = {
      randomBytes: c.randomBytes,
      adjustScalarBytes: c.adjustScalarBytes,
      domain: c.domain,
      prehash: c.prehash,
      mapToCurve: c.mapToCurve
    };
    return { CURVE, curveOpts, hash: c.hash, eddsaOpts };
  }
  function _eddsa_new_output_to_legacy(c, eddsa2) {
    const Point = eddsa2.Point;
    const legacy = Object.assign({}, eddsa2, {
      ExtendedPoint: Point,
      CURVE: c,
      nBitLength: Point.Fn.BITS,
      nByteLength: Point.Fn.BYTES
    });
    return legacy;
  }
  function twistedEdwards(c) {
    const { CURVE, curveOpts, hash, eddsaOpts } = _eddsa_legacy_opts_to_new(c);
    const Point = edwards(CURVE, curveOpts);
    const EDDSA = eddsa(Point, hash, eddsaOpts);
    return _eddsa_new_output_to_legacy(c, EDDSA);
  }

  // node_modules/@noble/curves/esm/ed25519.js
  var _0n5 = /* @__PURE__ */ BigInt(0);
  var _1n5 = BigInt(1);
  var _2n3 = BigInt(2);
  var _3n2 = BigInt(3);
  var _5n2 = BigInt(5);
  var _8n3 = BigInt(8);
  var ed25519_CURVE_p = BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffed");
  var ed25519_CURVE = /* @__PURE__ */ (() => ({
    p: ed25519_CURVE_p,
    n: BigInt("0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed"),
    h: _8n3,
    a: BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffec"),
    d: BigInt("0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3"),
    Gx: BigInt("0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a"),
    Gy: BigInt("0x6666666666666666666666666666666666666666666666666666666666666658")
  }))();
  function ed25519_pow_2_252_3(x) {
    const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
    const P = ed25519_CURVE_p;
    const x2 = x * x % P;
    const b2 = x2 * x % P;
    const b4 = pow2(b2, _2n3, P) * b2 % P;
    const b5 = pow2(b4, _1n5, P) * x % P;
    const b10 = pow2(b5, _5n2, P) * b5 % P;
    const b20 = pow2(b10, _10n, P) * b10 % P;
    const b40 = pow2(b20, _20n, P) * b20 % P;
    const b80 = pow2(b40, _40n, P) * b40 % P;
    const b160 = pow2(b80, _80n, P) * b80 % P;
    const b240 = pow2(b160, _80n, P) * b80 % P;
    const b250 = pow2(b240, _10n, P) * b10 % P;
    const pow_p_5_8 = pow2(b250, _2n3, P) * x % P;
    return { pow_p_5_8, b2 };
  }
  function adjustScalarBytes(bytes) {
    bytes[0] &= 248;
    bytes[31] &= 127;
    bytes[31] |= 64;
    return bytes;
  }
  var ED25519_SQRT_M1 = /* @__PURE__ */ BigInt("19681161376707505956807079304988542015446066515923890162744021073123829784752");
  function uvRatio(u, v) {
    const P = ed25519_CURVE_p;
    const v32 = mod(v * v * v, P);
    const v7 = mod(v32 * v32 * v, P);
    const pow = ed25519_pow_2_252_3(u * v7).pow_p_5_8;
    let x = mod(u * v32 * pow, P);
    const vx2 = mod(v * x * x, P);
    const root1 = x;
    const root2 = mod(x * ED25519_SQRT_M1, P);
    const useRoot1 = vx2 === u;
    const useRoot2 = vx2 === mod(-u, P);
    const noRoot = vx2 === mod(-u * ED25519_SQRT_M1, P);
    if (useRoot1)
      x = root1;
    if (useRoot2 || noRoot)
      x = root2;
    if (isNegativeLE(x, P))
      x = mod(-x, P);
    return { isValid: useRoot1 || useRoot2, value: x };
  }
  var Fp = /* @__PURE__ */ (() => Field(ed25519_CURVE.p, { isLE: true }))();
  var Fn = /* @__PURE__ */ (() => Field(ed25519_CURVE.n, { isLE: true }))();
  var ed25519Defaults = /* @__PURE__ */ (() => ({
    ...ed25519_CURVE,
    Fp,
    hash: sha512,
    adjustScalarBytes,
    // dom2
    // Ratio of u to v. Allows us to combine inversion and square root. Uses algo from RFC8032 5.1.3.
    // Constant-time, u/√v
    uvRatio
  }))();
  var ed25519 = /* @__PURE__ */ (() => twistedEdwards(ed25519Defaults))();
  var SQRT_M1 = ED25519_SQRT_M1;
  var SQRT_AD_MINUS_ONE = /* @__PURE__ */ BigInt("25063068953384623474111414158702152701244531502492656460079210482610430750235");
  var INVSQRT_A_MINUS_D = /* @__PURE__ */ BigInt("54469307008909316920995813868745141605393597292927456921205312896311721017578");
  var ONE_MINUS_D_SQ = /* @__PURE__ */ BigInt("1159843021668779879193775521855586647937357759715417654439879720876111806838");
  var D_MINUS_ONE_SQ = /* @__PURE__ */ BigInt("40440834346308536858101042469323190826248399146238708352240133220865137265952");
  var invertSqrt = (number2) => uvRatio(_1n5, number2);
  var MAX_255B = /* @__PURE__ */ BigInt("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  var bytes255ToNumberLE = (bytes) => ed25519.Point.Fp.create(bytesToNumberLE(bytes) & MAX_255B);
  function calcElligatorRistrettoMap(r0) {
    const { d } = ed25519_CURVE;
    const P = ed25519_CURVE_p;
    const mod2 = (n) => Fp.create(n);
    const r = mod2(SQRT_M1 * r0 * r0);
    const Ns = mod2((r + _1n5) * ONE_MINUS_D_SQ);
    let c = BigInt(-1);
    const D = mod2((c - d * r) * mod2(r + d));
    let { isValid: Ns_D_is_sq, value: s } = uvRatio(Ns, D);
    let s_ = mod2(s * r0);
    if (!isNegativeLE(s_, P))
      s_ = mod2(-s_);
    if (!Ns_D_is_sq)
      s = s_;
    if (!Ns_D_is_sq)
      c = r;
    const Nt = mod2(c * (r - _1n5) * D_MINUS_ONE_SQ - D);
    const s2 = s * s;
    const W0 = mod2((s + s) * D);
    const W1 = mod2(Nt * SQRT_AD_MINUS_ONE);
    const W2 = mod2(_1n5 - s2);
    const W3 = mod2(_1n5 + s2);
    return new ed25519.Point(mod2(W0 * W3), mod2(W2 * W1), mod2(W1 * W3), mod2(W0 * W2));
  }
  function ristretto255_map(bytes) {
    abytes(bytes, 64);
    const r1 = bytes255ToNumberLE(bytes.subarray(0, 32));
    const R1 = calcElligatorRistrettoMap(r1);
    const r2 = bytes255ToNumberLE(bytes.subarray(32, 64));
    const R2 = calcElligatorRistrettoMap(r2);
    return new _RistrettoPoint(R1.add(R2));
  }
  var _RistrettoPoint = class __RistrettoPoint extends PrimeEdwardsPoint {
    constructor(ep) {
      super(ep);
    }
    static fromAffine(ap) {
      return new __RistrettoPoint(ed25519.Point.fromAffine(ap));
    }
    assertSame(other) {
      if (!(other instanceof __RistrettoPoint))
        throw new Error("RistrettoPoint expected");
    }
    init(ep) {
      return new __RistrettoPoint(ep);
    }
    /** @deprecated use `import { ristretto255_hasher } from '@noble/curves/ed25519.js';` */
    static hashToCurve(hex) {
      return ristretto255_map(ensureBytes("ristrettoHash", hex, 64));
    }
    static fromBytes(bytes) {
      abytes(bytes, 32);
      const { a, d } = ed25519_CURVE;
      const P = ed25519_CURVE_p;
      const mod2 = (n) => Fp.create(n);
      const s = bytes255ToNumberLE(bytes);
      if (!equalBytes(Fp.toBytes(s), bytes) || isNegativeLE(s, P))
        throw new Error("invalid ristretto255 encoding 1");
      const s2 = mod2(s * s);
      const u1 = mod2(_1n5 + a * s2);
      const u2 = mod2(_1n5 - a * s2);
      const u1_2 = mod2(u1 * u1);
      const u2_2 = mod2(u2 * u2);
      const v = mod2(a * d * u1_2 - u2_2);
      const { isValid, value: I } = invertSqrt(mod2(v * u2_2));
      const Dx = mod2(I * u2);
      const Dy = mod2(I * Dx * v);
      let x = mod2((s + s) * Dx);
      if (isNegativeLE(x, P))
        x = mod2(-x);
      const y = mod2(u1 * Dy);
      const t = mod2(x * y);
      if (!isValid || isNegativeLE(t, P) || y === _0n5)
        throw new Error("invalid ristretto255 encoding 2");
      return new __RistrettoPoint(new ed25519.Point(x, y, _1n5, t));
    }
    /**
     * Converts ristretto-encoded string to ristretto point.
     * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-decode).
     * @param hex Ristretto-encoded 32 bytes. Not every 32-byte string is valid ristretto encoding
     */
    static fromHex(hex) {
      return __RistrettoPoint.fromBytes(ensureBytes("ristrettoHex", hex, 32));
    }
    static msm(points, scalars) {
      return pippenger(__RistrettoPoint, ed25519.Point.Fn, points, scalars);
    }
    /**
     * Encodes ristretto point to Uint8Array.
     * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-encode).
     */
    toBytes() {
      let { X, Y, Z, T } = this.ep;
      const P = ed25519_CURVE_p;
      const mod2 = (n) => Fp.create(n);
      const u1 = mod2(mod2(Z + Y) * mod2(Z - Y));
      const u2 = mod2(X * Y);
      const u2sq = mod2(u2 * u2);
      const { value: invsqrt } = invertSqrt(mod2(u1 * u2sq));
      const D1 = mod2(invsqrt * u1);
      const D2 = mod2(invsqrt * u2);
      const zInv = mod2(D1 * D2 * T);
      let D;
      if (isNegativeLE(T * zInv, P)) {
        let _x = mod2(Y * SQRT_M1);
        let _y = mod2(X * SQRT_M1);
        X = _x;
        Y = _y;
        D = mod2(D1 * INVSQRT_A_MINUS_D);
      } else {
        D = D2;
      }
      if (isNegativeLE(X * zInv, P))
        Y = mod2(-Y);
      let s = mod2((Z - Y) * D);
      if (isNegativeLE(s, P))
        s = mod2(-s);
      return Fp.toBytes(s);
    }
    /**
     * Compares two Ristretto points.
     * Described in [RFC9496](https://www.rfc-editor.org/rfc/rfc9496#name-equals).
     */
    equals(other) {
      this.assertSame(other);
      const { X: X1, Y: Y1 } = this.ep;
      const { X: X2, Y: Y2 } = other.ep;
      const mod2 = (n) => Fp.create(n);
      const one = mod2(X1 * Y2) === mod2(Y1 * X2);
      const two = mod2(Y1 * Y2) === mod2(X1 * X2);
      return one || two;
    }
    is0() {
      return this.equals(__RistrettoPoint.ZERO);
    }
  };
  _RistrettoPoint.BASE = /* @__PURE__ */ (() => new _RistrettoPoint(ed25519.Point.BASE))();
  _RistrettoPoint.ZERO = /* @__PURE__ */ (() => new _RistrettoPoint(ed25519.Point.ZERO))();
  _RistrettoPoint.Fp = /* @__PURE__ */ (() => Fp)();
  _RistrettoPoint.Fn = /* @__PURE__ */ (() => Fn)();

  // node_modules/@solana/web3.js/lib/index.browser.esm.js
  var import_bn = __toESM(require_bn());
  var import_bs58 = __toESM(require_bs58());

  // node_modules/@noble/hashes/esm/sha256.js
  init_buffer_shim();
  var sha2562 = sha256;

  // node_modules/@solana/web3.js/lib/index.browser.esm.js
  var import_borsh = __toESM(require_lib());
  var BufferLayout = __toESM(require_Layout());
  var import_buffer_layout = __toESM(require_Layout());

  // node_modules/@solana/web3.js/node_modules/@solana/codecs-numbers/dist/index.browser.mjs
  init_buffer_shim();

  // node_modules/@solana/web3.js/node_modules/@solana/errors/dist/index.browser.mjs
  init_buffer_shim();
  var SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED = 1;
  var SOLANA_ERROR__INVALID_NONCE = 2;
  var SOLANA_ERROR__NONCE_ACCOUNT_NOT_FOUND = 3;
  var SOLANA_ERROR__BLOCKHASH_STRING_LENGTH_OUT_OF_RANGE = 4;
  var SOLANA_ERROR__INVALID_BLOCKHASH_BYTE_LENGTH = 5;
  var SOLANA_ERROR__LAMPORTS_OUT_OF_RANGE = 6;
  var SOLANA_ERROR__MALFORMED_BIGINT_STRING = 7;
  var SOLANA_ERROR__MALFORMED_NUMBER_STRING = 8;
  var SOLANA_ERROR__TIMESTAMP_OUT_OF_RANGE = 9;
  var SOLANA_ERROR__MALFORMED_JSON_RPC_ERROR = 10;
  var SOLANA_ERROR__JSON_RPC__PARSE_ERROR = -32700;
  var SOLANA_ERROR__JSON_RPC__INTERNAL_ERROR = -32603;
  var SOLANA_ERROR__JSON_RPC__INVALID_PARAMS = -32602;
  var SOLANA_ERROR__JSON_RPC__METHOD_NOT_FOUND = -32601;
  var SOLANA_ERROR__JSON_RPC__INVALID_REQUEST = -32600;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_UNREACHABLE = -32019;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_NOT_EPOCH_BOUNDARY = -32018;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_EPOCH_REWARDS_PERIOD_ACTIVE = -32017;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_MIN_CONTEXT_SLOT_NOT_REACHED = -32016;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_UNSUPPORTED_TRANSACTION_VERSION = -32015;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_STATUS_NOT_AVAILABLE_YET = -32014;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_LEN_MISMATCH = -32013;
  var SOLANA_ERROR__JSON_RPC__SCAN_ERROR = -32012;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_HISTORY_NOT_AVAILABLE = -32011;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_KEY_EXCLUDED_FROM_SECONDARY_INDEX = -32010;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_SLOT_SKIPPED = -32009;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NO_SNAPSHOT = -32008;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_SKIPPED = -32007;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE = -32006;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NODE_UNHEALTHY = -32005;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_NOT_AVAILABLE = -32004;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_VERIFICATION_FAILURE = -32003;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE = -32002;
  var SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_CLEANED_UP = -32001;
  var SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH = 28e5;
  var SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE = 2800001;
  var SOLANA_ERROR__ADDRESSES__INVALID_BASE58_ENCODED_ADDRESS = 2800002;
  var SOLANA_ERROR__ADDRESSES__INVALID_ED25519_PUBLIC_KEY = 2800003;
  var SOLANA_ERROR__ADDRESSES__MALFORMED_PDA = 2800004;
  var SOLANA_ERROR__ADDRESSES__PDA_BUMP_SEED_OUT_OF_RANGE = 2800005;
  var SOLANA_ERROR__ADDRESSES__MAX_NUMBER_OF_PDA_SEEDS_EXCEEDED = 2800006;
  var SOLANA_ERROR__ADDRESSES__MAX_PDA_SEED_LENGTH_EXCEEDED = 2800007;
  var SOLANA_ERROR__ADDRESSES__INVALID_SEEDS_POINT_ON_CURVE = 2800008;
  var SOLANA_ERROR__ADDRESSES__FAILED_TO_FIND_VIABLE_PDA_BUMP_SEED = 2800009;
  var SOLANA_ERROR__ADDRESSES__PDA_ENDS_WITH_PDA_MARKER = 2800010;
  var SOLANA_ERROR__ADDRESSES__INVALID_OFF_CURVE_ADDRESS = 2800011;
  var SOLANA_ERROR__ACCOUNTS__ACCOUNT_NOT_FOUND = 323e4;
  var SOLANA_ERROR__ACCOUNTS__ONE_OR_MORE_ACCOUNTS_NOT_FOUND = 32300001;
  var SOLANA_ERROR__ACCOUNTS__FAILED_TO_DECODE_ACCOUNT = 3230002;
  var SOLANA_ERROR__ACCOUNTS__EXPECTED_DECODED_ACCOUNT = 3230003;
  var SOLANA_ERROR__ACCOUNTS__EXPECTED_ALL_ACCOUNTS_TO_BE_DECODED = 3230004;
  var SOLANA_ERROR__SUBTLE_CRYPTO__DISALLOWED_IN_INSECURE_CONTEXT = 361e4;
  var SOLANA_ERROR__SUBTLE_CRYPTO__DIGEST_UNIMPLEMENTED = 3610001;
  var SOLANA_ERROR__SUBTLE_CRYPTO__ED25519_ALGORITHM_UNIMPLEMENTED = 3610002;
  var SOLANA_ERROR__SUBTLE_CRYPTO__EXPORT_FUNCTION_UNIMPLEMENTED = 3610003;
  var SOLANA_ERROR__SUBTLE_CRYPTO__GENERATE_FUNCTION_UNIMPLEMENTED = 3610004;
  var SOLANA_ERROR__SUBTLE_CRYPTO__SIGN_FUNCTION_UNIMPLEMENTED = 3610005;
  var SOLANA_ERROR__SUBTLE_CRYPTO__VERIFY_FUNCTION_UNIMPLEMENTED = 3610006;
  var SOLANA_ERROR__SUBTLE_CRYPTO__CANNOT_EXPORT_NON_EXTRACTABLE_KEY = 3610007;
  var SOLANA_ERROR__CRYPTO__RANDOM_VALUES_FUNCTION_UNIMPLEMENTED = 3611e3;
  var SOLANA_ERROR__KEYS__INVALID_KEY_PAIR_BYTE_LENGTH = 3704e3;
  var SOLANA_ERROR__KEYS__INVALID_PRIVATE_KEY_BYTE_LENGTH = 3704001;
  var SOLANA_ERROR__KEYS__INVALID_SIGNATURE_BYTE_LENGTH = 3704002;
  var SOLANA_ERROR__KEYS__SIGNATURE_STRING_LENGTH_OUT_OF_RANGE = 3704003;
  var SOLANA_ERROR__KEYS__PUBLIC_KEY_MUST_MATCH_PRIVATE_KEY = 3704004;
  var SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_ACCOUNTS = 4128e3;
  var SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_DATA = 4128001;
  var SOLANA_ERROR__INSTRUCTION__PROGRAM_ID_MISMATCH = 4128002;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN = 4615e3;
  var SOLANA_ERROR__INSTRUCTION_ERROR__GENERIC_ERROR = 4615001;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ARGUMENT = 4615002;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_INSTRUCTION_DATA = 4615003;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_DATA = 4615004;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_TOO_SMALL = 4615005;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS = 4615006;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_PROGRAM_ID = 4615007;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_REQUIRED_SIGNATURE = 4615008;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_ALREADY_INITIALIZED = 4615009;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNINITIALIZED_ACCOUNT = 4615010;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNBALANCED_INSTRUCTION = 4615011;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MODIFIED_PROGRAM_ID = 4615012;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_LAMPORT_SPEND = 4615013;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_DATA_MODIFIED = 4615014;
  var SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_LAMPORT_CHANGE = 4615015;
  var SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_DATA_MODIFIED = 4615016;
  var SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_INDEX = 4615017;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_MODIFIED = 4615018;
  var SOLANA_ERROR__INSTRUCTION_ERROR__RENT_EPOCH_MODIFIED = 4615019;
  var SOLANA_ERROR__INSTRUCTION_ERROR__NOT_ENOUGH_ACCOUNT_KEYS = 4615020;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_SIZE_CHANGED = 4615021;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_EXECUTABLE = 4615022;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_FAILED = 4615023;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_OUTSTANDING = 4615024;
  var SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_OUT_OF_SYNC = 4615025;
  var SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM = 4615026;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ERROR = 4615027;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_DATA_MODIFIED = 4615028;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_LAMPORT_CHANGE = 4615029;
  var SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_ACCOUNT_NOT_RENT_EXEMPT = 4615030;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_PROGRAM_ID = 4615031;
  var SOLANA_ERROR__INSTRUCTION_ERROR__CALL_DEPTH = 4615032;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_ACCOUNT = 4615033;
  var SOLANA_ERROR__INSTRUCTION_ERROR__REENTRANCY_NOT_ALLOWED = 4615034;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_SEED_LENGTH_EXCEEDED = 4615035;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_SEEDS = 4615036;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_REALLOC = 4615037;
  var SOLANA_ERROR__INSTRUCTION_ERROR__COMPUTATIONAL_BUDGET_EXCEEDED = 4615038;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PRIVILEGE_ESCALATION = 4615039;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_ENVIRONMENT_SETUP_FAILURE = 4615040;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPLETE = 4615041;
  var SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPILE = 4615042;
  var SOLANA_ERROR__INSTRUCTION_ERROR__IMMUTABLE = 4615043;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_AUTHORITY = 4615044;
  var SOLANA_ERROR__INSTRUCTION_ERROR__BORSH_IO_ERROR = 4615045;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_RENT_EXEMPT = 4615046;
  var SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_OWNER = 4615047;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ARITHMETIC_OVERFLOW = 4615048;
  var SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_SYSVAR = 4615049;
  var SOLANA_ERROR__INSTRUCTION_ERROR__ILLEGAL_OWNER = 4615050;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_DATA_ALLOCATIONS_EXCEEDED = 4615051;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_EXCEEDED = 4615052;
  var SOLANA_ERROR__INSTRUCTION_ERROR__MAX_INSTRUCTION_TRACE_LENGTH_EXCEEDED = 4615053;
  var SOLANA_ERROR__INSTRUCTION_ERROR__BUILTIN_PROGRAMS_MUST_CONSUME_COMPUTE_UNITS = 4615054;
  var SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS = 5508e3;
  var SOLANA_ERROR__SIGNER__EXPECTED_KEY_PAIR_SIGNER = 5508001;
  var SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_SIGNER = 5508002;
  var SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_MODIFYING_SIGNER = 5508003;
  var SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_PARTIAL_SIGNER = 5508004;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SIGNER = 5508005;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_MODIFYING_SIGNER = 5508006;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_PARTIAL_SIGNER = 5508007;
  var SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SENDING_SIGNER = 5508008;
  var SOLANA_ERROR__SIGNER__TRANSACTION_CANNOT_HAVE_MULTIPLE_SENDING_SIGNERS = 5508009;
  var SOLANA_ERROR__SIGNER__TRANSACTION_SENDING_SIGNER_MISSING = 5508010;
  var SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED = 5508011;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__MAXIMUM_LENGTH_EXCEEDED = 5607e3;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__RESTRICTED_ASCII_BODY_CHARACTER_OUT_OF_RANGE = 5607001;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__APPLICATION_DOMAIN_STRING_LENGTH_OUT_OF_RANGE = 5607002;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__INVALID_APPLICATION_DOMAIN_BYTE_LENGTH = 5607003;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_SIGNATURES_MISMATCH = 5607004;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO = 5607005;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__VERSION_NUMBER_NOT_SUPPORTED = 5607006;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_FORMAT_MISMATCH = 5607007;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_LENGTH_MISMATCH = 5607008;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_MUST_BE_NON_EMPTY = 5607009;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_ENVELOPE_SIGNATURES_CANNOT_BE_ZERO = 5607010;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURES_MISSING = 5607011;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__ENVELOPE_SIGNERS_MISMATCH = 5607012;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__ADDRESSES_CANNOT_SIGN_OFFCHAIN_MESSAGE = 5607013;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__UNEXPECTED_VERSION = 5607014;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_SORTED = 5607015;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_UNIQUE = 5607016;
  var SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURE_VERIFICATION_FAILURE = 5607017;
  var SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_CANNOT_PAY_FEES = 5663e3;
  var SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_MUST_NOT_BE_WRITABLE = 5663001;
  var SOLANA_ERROR__TRANSACTION__EXPECTED_BLOCKHASH_LIFETIME = 5663002;
  var SOLANA_ERROR__TRANSACTION__EXPECTED_NONCE_LIFETIME = 5663003;
  var SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_OUT_OF_RANGE = 5663004;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_CONTENTS_MISSING = 5663005;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_INDEX_OUT_OF_RANGE = 5663006;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_PROGRAM_ADDRESS_NOT_FOUND = 5663007;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_FEE_PAYER_MISSING = 5663008;
  var SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING = 5663009;
  var SOLANA_ERROR__TRANSACTION__ADDRESS_MISSING = 5663010;
  var SOLANA_ERROR__TRANSACTION__FEE_PAYER_MISSING = 5663011;
  var SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING = 5663012;
  var SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_INSTRUCTIONS_MISSING = 5663013;
  var SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_FIRST_INSTRUCTION_MUST_BE_ADVANCE_NONCE = 5663014;
  var SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION = 5663015;
  var SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_SIGNATURES = 5663016;
  var SOLANA_ERROR__TRANSACTION__MESSAGE_SIGNATURES_MISMATCH = 5663017;
  var SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_COMPUTE_LIMIT = 5663018;
  var SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_COMPUTE_LIMIT = 5663019;
  var SOLANA_ERROR__TRANSACTION__EXCEEDS_SIZE_LIMIT = 5663020;
  var SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_NOT_SUPPORTED = 5663021;
  var SOLANA_ERROR__TRANSACTION__NONCE_ACCOUNT_CANNOT_BE_IN_LOOKUP_TABLE = 5663022;
  var SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN = 705e4;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_IN_USE = 7050001;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_LOADED_TWICE = 7050002;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND = 7050003;
  var SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_ACCOUNT_NOT_FOUND = 7050004;
  var SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE = 7050005;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_FOR_FEE = 7050006;
  var SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED = 7050007;
  var SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND = 7050008;
  var SOLANA_ERROR__TRANSACTION_ERROR__CALL_CHAIN_TOO_DEEP = 7050009;
  var SOLANA_ERROR__TRANSACTION_ERROR__MISSING_SIGNATURE_FOR_FEE = 7050010;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_INDEX = 7050011;
  var SOLANA_ERROR__TRANSACTION_ERROR__SIGNATURE_FAILURE = 7050012;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_PROGRAM_FOR_EXECUTION = 7050013;
  var SOLANA_ERROR__TRANSACTION_ERROR__SANITIZE_FAILURE = 7050014;
  var SOLANA_ERROR__TRANSACTION_ERROR__CLUSTER_MAINTENANCE = 7050015;
  var SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_BORROW_OUTSTANDING = 7050016;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_BLOCK_COST_LIMIT = 7050017;
  var SOLANA_ERROR__TRANSACTION_ERROR__UNSUPPORTED_VERSION = 7050018;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_WRITABLE_ACCOUNT = 7050019;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_ACCOUNT_COST_LIMIT = 7050020;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_BLOCK_LIMIT = 7050021;
  var SOLANA_ERROR__TRANSACTION_ERROR__TOO_MANY_ACCOUNT_LOCKS = 7050022;
  var SOLANA_ERROR__TRANSACTION_ERROR__ADDRESS_LOOKUP_TABLE_NOT_FOUND = 7050023;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_OWNER = 7050024;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_DATA = 7050025;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_INDEX = 7050026;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_RENT_PAYING_ACCOUNT = 7050027;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_VOTE_COST_LIMIT = 7050028;
  var SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_TOTAL_LIMIT = 7050029;
  var SOLANA_ERROR__TRANSACTION_ERROR__DUPLICATE_INSTRUCTION = 7050030;
  var SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT = 7050031;
  var SOLANA_ERROR__TRANSACTION_ERROR__MAX_LOADED_ACCOUNTS_DATA_SIZE_EXCEEDED = 7050032;
  var SOLANA_ERROR__TRANSACTION_ERROR__INVALID_LOADED_ACCOUNTS_DATA_SIZE_LIMIT = 7050033;
  var SOLANA_ERROR__TRANSACTION_ERROR__RESANITIZATION_NEEDED = 7050034;
  var SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_EXECUTION_TEMPORARILY_RESTRICTED = 7050035;
  var SOLANA_ERROR__TRANSACTION_ERROR__UNBALANCED_TRANSACTION = 7050036;
  var SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_CANNOT_ACCOMMODATE_PLAN = 7618e3;
  var SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_PACKER_ALREADY_COMPLETE = 7618001;
  var SOLANA_ERROR__INSTRUCTION_PLANS__EMPTY_INSTRUCTION_PLAN = 7618002;
  var SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN = 7618003;
  var SOLANA_ERROR__INSTRUCTION_PLANS__NON_DIVISIBLE_TRANSACTION_PLANS_NOT_SUPPORTED = 7618004;
  var SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_SINGLE_TRANSACTION_PLAN_RESULT_NOT_FOUND = 7618005;
  var SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_INSTRUCTION_PLAN = 7618006;
  var SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN = 7618007;
  var SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT = 7618008;
  var SOLANA_ERROR__INSTRUCTION_PLANS__EXPECTED_SUCCESSFUL_TRANSACTION_PLAN_RESULT = 7618009;
  var SOLANA_ERROR__CODECS__CANNOT_DECODE_EMPTY_BYTE_ARRAY = 8078e3;
  var SOLANA_ERROR__CODECS__INVALID_BYTE_LENGTH = 8078001;
  var SOLANA_ERROR__CODECS__EXPECTED_FIXED_LENGTH = 8078002;
  var SOLANA_ERROR__CODECS__EXPECTED_VARIABLE_LENGTH = 8078003;
  var SOLANA_ERROR__CODECS__ENCODER_DECODER_SIZE_COMPATIBILITY_MISMATCH = 8078004;
  var SOLANA_ERROR__CODECS__ENCODER_DECODER_FIXED_SIZE_MISMATCH = 8078005;
  var SOLANA_ERROR__CODECS__ENCODER_DECODER_MAX_SIZE_MISMATCH = 8078006;
  var SOLANA_ERROR__CODECS__INVALID_NUMBER_OF_ITEMS = 8078007;
  var SOLANA_ERROR__CODECS__ENUM_DISCRIMINATOR_OUT_OF_RANGE = 8078008;
  var SOLANA_ERROR__CODECS__INVALID_DISCRIMINATED_UNION_VARIANT = 8078009;
  var SOLANA_ERROR__CODECS__INVALID_ENUM_VARIANT = 8078010;
  var SOLANA_ERROR__CODECS__NUMBER_OUT_OF_RANGE = 8078011;
  var SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE = 8078012;
  var SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH = 8078013;
  var SOLANA_ERROR__CODECS__OFFSET_OUT_OF_RANGE = 8078014;
  var SOLANA_ERROR__CODECS__INVALID_LITERAL_UNION_VARIANT = 8078015;
  var SOLANA_ERROR__CODECS__LITERAL_UNION_DISCRIMINATOR_OUT_OF_RANGE = 8078016;
  var SOLANA_ERROR__CODECS__UNION_VARIANT_OUT_OF_RANGE = 8078017;
  var SOLANA_ERROR__CODECS__INVALID_CONSTANT = 8078018;
  var SOLANA_ERROR__CODECS__EXPECTED_ZERO_VALUE_TO_MATCH_ITEM_FIXED_SIZE = 8078019;
  var SOLANA_ERROR__CODECS__ENCODED_BYTES_MUST_NOT_INCLUDE_SENTINEL = 8078020;
  var SOLANA_ERROR__CODECS__SENTINEL_MISSING_IN_DECODED_BYTES = 8078021;
  var SOLANA_ERROR__CODECS__CANNOT_USE_LEXICAL_VALUES_AS_ENUM_DISCRIMINATORS = 8078022;
  var SOLANA_ERROR__CODECS__EXPECTED_DECODER_TO_CONSUME_ENTIRE_BYTE_ARRAY = 8078023;
  var SOLANA_ERROR__RPC__INTEGER_OVERFLOW = 81e5;
  var SOLANA_ERROR__RPC__TRANSPORT_HTTP_HEADER_FORBIDDEN = 8100001;
  var SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR = 8100002;
  var SOLANA_ERROR__RPC__API_PLAN_MISSING_FOR_RPC_METHOD = 8100003;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CANNOT_CREATE_SUBSCRIPTION_PLAN = 819e4;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__EXPECTED_SERVER_SUBSCRIPTION_ID = 8190001;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CLOSED_BEFORE_MESSAGE_BUFFERED = 8190002;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED = 8190003;
  var SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_FAILED_TO_CONNECT = 8190004;
  var SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_STATE_MISSING = 99e5;
  var SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_MUST_NOT_POLL_BEFORE_RESOLVING_EXISTING_MESSAGE_PROMISE = 9900001;
  var SOLANA_ERROR__INVARIANT_VIOLATION__CACHED_ABORTABLE_ITERABLE_CACHE_ENTRY_MISSING = 9900002;
  var SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE = 9900003;
  var SOLANA_ERROR__INVARIANT_VIOLATION__DATA_PUBLISHER_CHANNEL_UNIMPLEMENTED = 9900004;
  var SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_INSTRUCTION_PLAN_KIND = 9900005;
  var SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_TRANSACTION_PLAN_KIND = 9900006;
  var SolanaErrorMessages = {
    [SOLANA_ERROR__ACCOUNTS__ACCOUNT_NOT_FOUND]: "Account not found at address: $address",
    [SOLANA_ERROR__ACCOUNTS__EXPECTED_ALL_ACCOUNTS_TO_BE_DECODED]: "Not all accounts were decoded. Encoded accounts found at addresses: $addresses.",
    [SOLANA_ERROR__ACCOUNTS__EXPECTED_DECODED_ACCOUNT]: "Expected decoded account at address: $address",
    [SOLANA_ERROR__ACCOUNTS__FAILED_TO_DECODE_ACCOUNT]: "Failed to decode account data at address: $address",
    [SOLANA_ERROR__ACCOUNTS__ONE_OR_MORE_ACCOUNTS_NOT_FOUND]: "Accounts not found at addresses: $addresses",
    [SOLANA_ERROR__ADDRESSES__FAILED_TO_FIND_VIABLE_PDA_BUMP_SEED]: "Unable to find a viable program address bump seed.",
    [SOLANA_ERROR__ADDRESSES__INVALID_BASE58_ENCODED_ADDRESS]: "$putativeAddress is not a base58-encoded address.",
    [SOLANA_ERROR__ADDRESSES__INVALID_BYTE_LENGTH]: "Expected base58 encoded address to decode to a byte array of length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__ADDRESSES__INVALID_ED25519_PUBLIC_KEY]: "The `CryptoKey` must be an `Ed25519` public key.",
    [SOLANA_ERROR__ADDRESSES__INVALID_OFF_CURVE_ADDRESS]: "$putativeOffCurveAddress is not a base58-encoded off-curve address.",
    [SOLANA_ERROR__ADDRESSES__INVALID_SEEDS_POINT_ON_CURVE]: "Invalid seeds; point must fall off the Ed25519 curve.",
    [SOLANA_ERROR__ADDRESSES__MALFORMED_PDA]: "Expected given program derived address to have the following format: [Address, ProgramDerivedAddressBump].",
    [SOLANA_ERROR__ADDRESSES__MAX_NUMBER_OF_PDA_SEEDS_EXCEEDED]: "A maximum of $maxSeeds seeds, including the bump seed, may be supplied when creating an address. Received: $actual.",
    [SOLANA_ERROR__ADDRESSES__MAX_PDA_SEED_LENGTH_EXCEEDED]: "The seed at index $index with length $actual exceeds the maximum length of $maxSeedLength bytes.",
    [SOLANA_ERROR__ADDRESSES__PDA_BUMP_SEED_OUT_OF_RANGE]: "Expected program derived address bump to be in the range [0, 255], got: $bump.",
    [SOLANA_ERROR__ADDRESSES__PDA_ENDS_WITH_PDA_MARKER]: "Program address cannot end with PDA marker.",
    [SOLANA_ERROR__ADDRESSES__STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded address string of length in the range [32, 44]. Actual length: $actualLength.",
    [SOLANA_ERROR__BLOCKHASH_STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded blockash string of length in the range [32, 44]. Actual length: $actualLength.",
    [SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED]: "The network has progressed past the last block for which this transaction could have been committed.",
    [SOLANA_ERROR__CODECS__CANNOT_DECODE_EMPTY_BYTE_ARRAY]: "Codec [$codecDescription] cannot decode empty byte arrays.",
    [SOLANA_ERROR__CODECS__CANNOT_USE_LEXICAL_VALUES_AS_ENUM_DISCRIMINATORS]: "Enum codec cannot use lexical values [$stringValues] as discriminators. Either remove all lexical values or set `useValuesAsDiscriminators` to `false`.",
    [SOLANA_ERROR__CODECS__ENCODED_BYTES_MUST_NOT_INCLUDE_SENTINEL]: "Sentinel [$hexSentinel] must not be present in encoded bytes [$hexEncodedBytes].",
    [SOLANA_ERROR__CODECS__ENCODER_DECODER_FIXED_SIZE_MISMATCH]: "Encoder and decoder must have the same fixed size, got [$encoderFixedSize] and [$decoderFixedSize].",
    [SOLANA_ERROR__CODECS__ENCODER_DECODER_MAX_SIZE_MISMATCH]: "Encoder and decoder must have the same max size, got [$encoderMaxSize] and [$decoderMaxSize].",
    [SOLANA_ERROR__CODECS__ENCODER_DECODER_SIZE_COMPATIBILITY_MISMATCH]: "Encoder and decoder must either both be fixed-size or variable-size.",
    [SOLANA_ERROR__CODECS__ENUM_DISCRIMINATOR_OUT_OF_RANGE]: "Enum discriminator out of range. Expected a number in [$formattedValidDiscriminators], got $discriminator.",
    [SOLANA_ERROR__CODECS__EXPECTED_FIXED_LENGTH]: "Expected a fixed-size codec, got a variable-size one.",
    [SOLANA_ERROR__CODECS__EXPECTED_POSITIVE_BYTE_LENGTH]: "Codec [$codecDescription] expected a positive byte length, got $bytesLength.",
    [SOLANA_ERROR__CODECS__EXPECTED_VARIABLE_LENGTH]: "Expected a variable-size codec, got a fixed-size one.",
    [SOLANA_ERROR__CODECS__EXPECTED_ZERO_VALUE_TO_MATCH_ITEM_FIXED_SIZE]: "Codec [$codecDescription] expected zero-value [$hexZeroValue] to have the same size as the provided fixed-size item [$expectedSize bytes].",
    [SOLANA_ERROR__CODECS__INVALID_BYTE_LENGTH]: "Codec [$codecDescription] expected $expected bytes, got $bytesLength.",
    [SOLANA_ERROR__CODECS__INVALID_CONSTANT]: "Expected byte array constant [$hexConstant] to be present in data [$hexData] at offset [$offset].",
    [SOLANA_ERROR__CODECS__INVALID_DISCRIMINATED_UNION_VARIANT]: "Invalid discriminated union variant. Expected one of [$variants], got $value.",
    [SOLANA_ERROR__CODECS__INVALID_ENUM_VARIANT]: "Invalid enum variant. Expected one of [$stringValues] or a number in [$formattedNumericalValues], got $variant.",
    [SOLANA_ERROR__CODECS__INVALID_LITERAL_UNION_VARIANT]: "Invalid literal union variant. Expected one of [$variants], got $value.",
    [SOLANA_ERROR__CODECS__INVALID_NUMBER_OF_ITEMS]: "Expected [$codecDescription] to have $expected items, got $actual.",
    [SOLANA_ERROR__CODECS__INVALID_STRING_FOR_BASE]: "Invalid value $value for base $base with alphabet $alphabet.",
    [SOLANA_ERROR__CODECS__LITERAL_UNION_DISCRIMINATOR_OUT_OF_RANGE]: "Literal union discriminator out of range. Expected a number between $minRange and $maxRange, got $discriminator.",
    [SOLANA_ERROR__CODECS__NUMBER_OUT_OF_RANGE]: "Codec [$codecDescription] expected number to be in the range [$min, $max], got $value.",
    [SOLANA_ERROR__CODECS__OFFSET_OUT_OF_RANGE]: "Codec [$codecDescription] expected offset to be in the range [0, $bytesLength], got $offset.",
    [SOLANA_ERROR__CODECS__SENTINEL_MISSING_IN_DECODED_BYTES]: "Expected sentinel [$hexSentinel] to be present in decoded bytes [$hexDecodedBytes].",
    [SOLANA_ERROR__CODECS__UNION_VARIANT_OUT_OF_RANGE]: "Union variant out of range. Expected an index between $minRange and $maxRange, got $variant.",
    [SOLANA_ERROR__CODECS__EXPECTED_DECODER_TO_CONSUME_ENTIRE_BYTE_ARRAY]: "This decoder expected a byte array of exactly $expectedLength bytes, but $numExcessBytes unexpected excess bytes remained after decoding. Are you sure that you have chosen the correct decoder for this data?",
    [SOLANA_ERROR__CRYPTO__RANDOM_VALUES_FUNCTION_UNIMPLEMENTED]: "No random values implementation could be found.",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_ALREADY_INITIALIZED]: "instruction requires an uninitialized account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_FAILED]: "instruction tries to borrow reference for an account which is already borrowed",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_BORROW_OUTSTANDING]: "instruction left account with an outstanding borrowed reference",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_SIZE_CHANGED]: "program other than the account's owner changed the size of the account data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_DATA_TOO_SMALL]: "account data too small for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_EXECUTABLE]: "instruction expected an executable account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ACCOUNT_NOT_RENT_EXEMPT]: "An account does not have enough lamports to be rent-exempt",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ARITHMETIC_OVERFLOW]: "Program arithmetic overflowed",
    [SOLANA_ERROR__INSTRUCTION_ERROR__BORSH_IO_ERROR]: "Failed to serialize or deserialize account data: $encodedData",
    [SOLANA_ERROR__INSTRUCTION_ERROR__BUILTIN_PROGRAMS_MUST_CONSUME_COMPUTE_UNITS]: "Builtin programs must consume compute units",
    [SOLANA_ERROR__INSTRUCTION_ERROR__CALL_DEPTH]: "Cross-program invocation call depth too deep",
    [SOLANA_ERROR__INSTRUCTION_ERROR__COMPUTATIONAL_BUDGET_EXCEEDED]: "Computational budget exceeded",
    [SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM]: "custom program error: #$code",
    [SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_INDEX]: "instruction contains duplicate accounts",
    [SOLANA_ERROR__INSTRUCTION_ERROR__DUPLICATE_ACCOUNT_OUT_OF_SYNC]: "instruction modifications of multiply-passed account differ",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_ACCOUNT_NOT_RENT_EXEMPT]: "executable accounts must be rent exempt",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_DATA_MODIFIED]: "instruction changed executable accounts data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_LAMPORT_CHANGE]: "instruction changed the balance of an executable account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXECUTABLE_MODIFIED]: "instruction changed executable bit of an account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_DATA_MODIFIED]: "instruction modified data of an account it does not own",
    [SOLANA_ERROR__INSTRUCTION_ERROR__EXTERNAL_ACCOUNT_LAMPORT_SPEND]: "instruction spent from the balance of an account it does not own",
    [SOLANA_ERROR__INSTRUCTION_ERROR__GENERIC_ERROR]: "generic instruction error",
    [SOLANA_ERROR__INSTRUCTION_ERROR__ILLEGAL_OWNER]: "Provided owner is not allowed",
    [SOLANA_ERROR__INSTRUCTION_ERROR__IMMUTABLE]: "Account is immutable",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_AUTHORITY]: "Incorrect authority provided",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INCORRECT_PROGRAM_ID]: "incorrect program id for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INSUFFICIENT_FUNDS]: "insufficient funds for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_DATA]: "invalid account data for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ACCOUNT_OWNER]: "Invalid account owner",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ARGUMENT]: "invalid program argument",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_ERROR]: "program returned invalid error code",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_INSTRUCTION_DATA]: "invalid instruction data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_REALLOC]: "Failed to reallocate account data",
    [SOLANA_ERROR__INSTRUCTION_ERROR__INVALID_SEEDS]: "Provided seeds do not result in a valid address",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_DATA_ALLOCATIONS_EXCEEDED]: "Accounts data allocations exceeded the maximum allowed per transaction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_ACCOUNTS_EXCEEDED]: "Max accounts exceeded",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_INSTRUCTION_TRACE_LENGTH_EXCEEDED]: "Max instruction trace length exceeded",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MAX_SEED_LENGTH_EXCEEDED]: "Length of the seed is too long for address generation",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_ACCOUNT]: "An account required by the instruction is missing",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MISSING_REQUIRED_SIGNATURE]: "missing required signature for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__MODIFIED_PROGRAM_ID]: "instruction illegally modified the program id of an account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__NOT_ENOUGH_ACCOUNT_KEYS]: "insufficient account keys for instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PRIVILEGE_ESCALATION]: "Cross-program invocation with unauthorized signer or writable account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_ENVIRONMENT_SETUP_FAILURE]: "Failed to create program execution environment",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPILE]: "Program failed to compile",
    [SOLANA_ERROR__INSTRUCTION_ERROR__PROGRAM_FAILED_TO_COMPLETE]: "Program failed to complete",
    [SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_DATA_MODIFIED]: "instruction modified data of a read-only account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__READONLY_LAMPORT_CHANGE]: "instruction changed the balance of a read-only account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__REENTRANCY_NOT_ALLOWED]: "Cross-program invocation reentrancy not allowed for this instruction",
    [SOLANA_ERROR__INSTRUCTION_ERROR__RENT_EPOCH_MODIFIED]: "instruction modified rent epoch of an account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNBALANCED_INSTRUCTION]: "sum of account balances before and after instruction do not match",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNINITIALIZED_ACCOUNT]: "instruction requires an initialized account",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNKNOWN]: "",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_PROGRAM_ID]: "Unsupported program id",
    [SOLANA_ERROR__INSTRUCTION_ERROR__UNSUPPORTED_SYSVAR]: "Unsupported sysvar",
    [SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_INSTRUCTION_PLAN_KIND]: "Invalid instruction plan kind: $kind.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__EMPTY_INSTRUCTION_PLAN]: "The provided instruction plan is empty.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_SINGLE_TRANSACTION_PLAN_RESULT_NOT_FOUND]: "No failed transaction plan result was found in the provided transaction plan result.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__NON_DIVISIBLE_TRANSACTION_PLANS_NOT_SUPPORTED]: "This transaction plan executor does not support non-divisible sequential plans. To support them, you may create your own executor such that multi-transaction atomicity is preserved \u2014 e.g. by targetting RPCs that support transaction bundles.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__FAILED_TO_EXECUTE_TRANSACTION_PLAN]: "The provided transaction plan failed to execute. See the `transactionPlanResult` attribute for more details. Note that the `cause` property is deprecated, and a future version will not set it.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_CANNOT_ACCOMMODATE_PLAN]: "The provided message has insufficient capacity to accommodate the next instruction(s) in this plan. Expected at least $numBytesRequired free byte(s), got $numFreeBytes byte(s).",
    [SOLANA_ERROR__INVARIANT_VIOLATION__INVALID_TRANSACTION_PLAN_KIND]: "Invalid transaction plan kind: $kind.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__MESSAGE_PACKER_ALREADY_COMPLETE]: "No more instructions to pack; the message packer has completed the instruction plan.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_INSTRUCTION_PLAN]: "Unexpected instruction plan. Expected $expectedKind plan, got $actualKind plan.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN]: "Unexpected transaction plan. Expected $expectedKind plan, got $actualKind plan.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__UNEXPECTED_TRANSACTION_PLAN_RESULT]: "Unexpected transaction plan result. Expected $expectedKind plan, got $actualKind plan.",
    [SOLANA_ERROR__INSTRUCTION_PLANS__EXPECTED_SUCCESSFUL_TRANSACTION_PLAN_RESULT]: "Expected a successful transaction plan result. I.e. there is at least one failed or cancelled transaction in the plan.",
    [SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_ACCOUNTS]: "The instruction does not have any accounts.",
    [SOLANA_ERROR__INSTRUCTION__EXPECTED_TO_HAVE_DATA]: "The instruction does not have any data.",
    [SOLANA_ERROR__INSTRUCTION__PROGRAM_ID_MISMATCH]: "Expected instruction to have progress address $expectedProgramAddress, got $actualProgramAddress.",
    [SOLANA_ERROR__INVALID_BLOCKHASH_BYTE_LENGTH]: "Expected base58 encoded blockhash to decode to a byte array of length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__INVALID_NONCE]: "The nonce `$expectedNonceValue` is no longer valid. It has advanced to `$actualNonceValue`",
    [SOLANA_ERROR__INVARIANT_VIOLATION__CACHED_ABORTABLE_ITERABLE_CACHE_ENTRY_MISSING]: "Invariant violation: Found no abortable iterable cache entry for key `$cacheKey`. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__INVARIANT_VIOLATION__DATA_PUBLISHER_CHANNEL_UNIMPLEMENTED]: "Invariant violation: This data publisher does not publish to the channel named `$channelName`. Supported channels include $supportedChannelNames.",
    [SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_MUST_NOT_POLL_BEFORE_RESOLVING_EXISTING_MESSAGE_PROMISE]: "Invariant violation: WebSocket message iterator state is corrupt; iterated without first resolving existing message promise. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__INVARIANT_VIOLATION__SUBSCRIPTION_ITERATOR_STATE_MISSING]: "Invariant violation: WebSocket message iterator is missing state storage. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__INVARIANT_VIOLATION__SWITCH_MUST_BE_EXHAUSTIVE]: "Invariant violation: Switch statement non-exhaustive. Received unexpected value `$unexpectedValue`. It should be impossible to hit this error; please file an issue at https://sola.na/web3invariant",
    [SOLANA_ERROR__JSON_RPC__INTERNAL_ERROR]: "JSON-RPC error: Internal JSON-RPC error ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__INVALID_PARAMS]: "JSON-RPC error: Invalid method parameter(s) ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__INVALID_REQUEST]: "JSON-RPC error: The JSON sent is not a valid `Request` object ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__METHOD_NOT_FOUND]: "JSON-RPC error: The method does not exist / is not available ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__PARSE_ERROR]: "JSON-RPC error: An error occurred on the server while parsing the JSON text ($__serverMessage)",
    [SOLANA_ERROR__JSON_RPC__SCAN_ERROR]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_CLEANED_UP]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_NOT_AVAILABLE]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_BLOCK_STATUS_NOT_AVAILABLE_YET]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_EPOCH_REWARDS_PERIOD_ACTIVE]: "Epoch rewards period still active at slot $slot",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_KEY_EXCLUDED_FROM_SECONDARY_INDEX]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_SLOT_SKIPPED]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_LONG_TERM_STORAGE_UNREACHABLE]: "Failed to query long-term storage; please try again",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_MIN_CONTEXT_SLOT_NOT_REACHED]: "Minimum context slot has not been reached",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NODE_UNHEALTHY]: "Node is unhealthy; behind by $numSlotsBehind slots",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_NO_SNAPSHOT]: "No snapshot",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE]: "Transaction simulation failed",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_NOT_EPOCH_BOUNDARY]: "Rewards cannot be found because slot $slot is not the epoch boundary. This may be due to gap in the queried node's local ledger or long-term storage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SLOT_SKIPPED]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_HISTORY_NOT_AVAILABLE]: "Transaction history is not available from this node",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE]: "$__serverMessage",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_LEN_MISMATCH]: "Transaction signature length mismatch",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_TRANSACTION_SIGNATURE_VERIFICATION_FAILURE]: "Transaction signature verification failure",
    [SOLANA_ERROR__JSON_RPC__SERVER_ERROR_UNSUPPORTED_TRANSACTION_VERSION]: "$__serverMessage",
    [SOLANA_ERROR__KEYS__INVALID_KEY_PAIR_BYTE_LENGTH]: "Key pair bytes must be of length 64, got $byteLength.",
    [SOLANA_ERROR__KEYS__INVALID_PRIVATE_KEY_BYTE_LENGTH]: "Expected private key bytes with length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__KEYS__INVALID_SIGNATURE_BYTE_LENGTH]: "Expected base58-encoded signature to decode to a byte array of length 64. Actual length: $actualLength.",
    [SOLANA_ERROR__KEYS__PUBLIC_KEY_MUST_MATCH_PRIVATE_KEY]: "The provided private key does not match the provided public key.",
    [SOLANA_ERROR__KEYS__SIGNATURE_STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded signature string of length in the range [64, 88]. Actual length: $actualLength.",
    [SOLANA_ERROR__LAMPORTS_OUT_OF_RANGE]: "Lamports value must be in the range [0, 2e64-1]",
    [SOLANA_ERROR__MALFORMED_BIGINT_STRING]: "`$value` cannot be parsed as a `BigInt`",
    [SOLANA_ERROR__MALFORMED_JSON_RPC_ERROR]: "$message",
    [SOLANA_ERROR__MALFORMED_NUMBER_STRING]: "`$value` cannot be parsed as a `Number`",
    [SOLANA_ERROR__NONCE_ACCOUNT_NOT_FOUND]: "No nonce account could be found at address `$nonceAccountAddress`",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__INVALID_APPLICATION_DOMAIN_BYTE_LENGTH]: "Expected base58 encoded application domain to decode to a byte array of length 32. Actual length: $actualLength.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__ADDRESSES_CANNOT_SIGN_OFFCHAIN_MESSAGE]: "Attempted to sign an offchain message with an address that is not a signer for it",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__APPLICATION_DOMAIN_STRING_LENGTH_OUT_OF_RANGE]: "Expected base58-encoded application domain string of length in the range [32, 44]. Actual length: $actualLength.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__ENVELOPE_SIGNERS_MISMATCH]: "The signer addresses in this offchain message envelope do not match the list of required signers in the message preamble. These unexpected signers were present in the envelope: `[$unexpectedSigners]`. These required signers were missing from the envelope `[$missingSigners]`.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__MAXIMUM_LENGTH_EXCEEDED]: "The message body provided has a byte-length of $actualBytes. The maximum allowable byte-length is $maxBytes",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_FORMAT_MISMATCH]: "Expected message format $expectedMessageFormat, got $actualMessageFormat",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_LENGTH_MISMATCH]: "The message length specified in the message preamble is $specifiedLength bytes. The actual length of the message is $actualLength bytes.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__MESSAGE_MUST_BE_NON_EMPTY]: "Offchain message content must be non-empty",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_REQUIRED_SIGNERS_CANNOT_BE_ZERO]: "Offchain message must specify the address of at least one required signer",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_ENVELOPE_SIGNATURES_CANNOT_BE_ZERO]: "Offchain message envelope must reserve space for at least one signature",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__NUM_SIGNATURES_MISMATCH]: "The offchain message preamble specifies $numRequiredSignatures required signature(s), got $signaturesLength.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_SORTED]: "The signatories of this offchain message must be listed in lexicographical order",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATORIES_MUST_BE_UNIQUE]: "An address must be listed no more than once among the signatories of an offchain message",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURES_MISSING]: "Offchain message is missing signatures for addresses: $addresses.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__SIGNATURE_VERIFICATION_FAILURE]: "Offchain message signature verification failed. Signature mismatch for required signatories [$signatoriesWithInvalidSignatures]. Missing signatures for signatories [$signatoriesWithMissingSignatures]",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__RESTRICTED_ASCII_BODY_CHARACTER_OUT_OF_RANGE]: "The message body provided contains characters whose codes fall outside the allowed range. In order to ensure clear-signing compatiblity with hardware wallets, the message may only contain line feeds and characters in the range [\\x20-\\x7e].",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__UNEXPECTED_VERSION]: "Expected offchain message version $expectedVersion. Got $actualVersion.",
    [SOLANA_ERROR__OFFCHAIN_MESSAGE__VERSION_NUMBER_NOT_SUPPORTED]: "This version of Kit does not support decoding offchain messages with version $unsupportedVersion. The current max supported version is 0.",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CANNOT_CREATE_SUBSCRIPTION_PLAN]: "The notification name must end in 'Notifications' and the API must supply a subscription plan creator function for the notification '$notificationName'.",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CLOSED_BEFORE_MESSAGE_BUFFERED]: "WebSocket was closed before payload could be added to the send buffer",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_CONNECTION_CLOSED]: "WebSocket connection closed",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__CHANNEL_FAILED_TO_CONNECT]: "WebSocket failed to connect",
    [SOLANA_ERROR__RPC_SUBSCRIPTIONS__EXPECTED_SERVER_SUBSCRIPTION_ID]: "Failed to obtain a subscription id from the server",
    [SOLANA_ERROR__RPC__API_PLAN_MISSING_FOR_RPC_METHOD]: "Could not find an API plan for RPC method: `$method`",
    [SOLANA_ERROR__RPC__INTEGER_OVERFLOW]: "The $argumentLabel argument to the `$methodName` RPC method$optionalPathLabel was `$value`. This number is unsafe for use with the Solana JSON-RPC because it exceeds `Number.MAX_SAFE_INTEGER`.",
    [SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR]: "HTTP error ($statusCode): $message",
    [SOLANA_ERROR__RPC__TRANSPORT_HTTP_HEADER_FORBIDDEN]: "HTTP header(s) forbidden: $headers. Learn more at https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name.",
    [SOLANA_ERROR__SIGNER__ADDRESS_CANNOT_HAVE_MULTIPLE_SIGNERS]: "Multiple distinct signers were identified for address `$address`. Please ensure that you are using the same signer instance for each address.",
    [SOLANA_ERROR__SIGNER__EXPECTED_KEY_PAIR_SIGNER]: "The provided value does not implement the `KeyPairSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_MODIFYING_SIGNER]: "The provided value does not implement the `MessageModifyingSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_PARTIAL_SIGNER]: "The provided value does not implement the `MessagePartialSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_MESSAGE_SIGNER]: "The provided value does not implement any of the `MessageSigner` interfaces",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_MODIFYING_SIGNER]: "The provided value does not implement the `TransactionModifyingSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_PARTIAL_SIGNER]: "The provided value does not implement the `TransactionPartialSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SENDING_SIGNER]: "The provided value does not implement the `TransactionSendingSigner` interface",
    [SOLANA_ERROR__SIGNER__EXPECTED_TRANSACTION_SIGNER]: "The provided value does not implement any of the `TransactionSigner` interfaces",
    [SOLANA_ERROR__SIGNER__TRANSACTION_CANNOT_HAVE_MULTIPLE_SENDING_SIGNERS]: "More than one `TransactionSendingSigner` was identified.",
    [SOLANA_ERROR__SIGNER__TRANSACTION_SENDING_SIGNER_MISSING]: "No `TransactionSendingSigner` was identified. Please provide a valid `TransactionWithSingleSendingSigner` transaction.",
    [SOLANA_ERROR__SIGNER__WALLET_MULTISIGN_UNIMPLEMENTED]: "Wallet account signers do not support signing multiple messages/transactions in a single operation",
    [SOLANA_ERROR__SUBTLE_CRYPTO__CANNOT_EXPORT_NON_EXTRACTABLE_KEY]: "Cannot export a non-extractable key.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__DIGEST_UNIMPLEMENTED]: "No digest implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__DISALLOWED_IN_INSECURE_CONTEXT]: "Cryptographic operations are only allowed in secure browser contexts. Read more here: https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__ED25519_ALGORITHM_UNIMPLEMENTED]: "This runtime does not support the generation of Ed25519 key pairs.\n\nInstall @solana/webcrypto-ed25519-polyfill and call its `install` function before generating keys in environments that do not support Ed25519.\n\nFor a list of runtimes that currently support Ed25519 operations, visit https://github.com/WICG/webcrypto-secure-curves/issues/20.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__EXPORT_FUNCTION_UNIMPLEMENTED]: "No signature verification implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__GENERATE_FUNCTION_UNIMPLEMENTED]: "No key generation implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__SIGN_FUNCTION_UNIMPLEMENTED]: "No signing implementation could be found.",
    [SOLANA_ERROR__SUBTLE_CRYPTO__VERIFY_FUNCTION_UNIMPLEMENTED]: "No key export implementation could be found.",
    [SOLANA_ERROR__TIMESTAMP_OUT_OF_RANGE]: "Timestamp value must be in the range [-(2n ** 63n), (2n ** 63n) - 1]. `$value` given",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_BORROW_OUTSTANDING]: "Transaction processing left an account with an outstanding borrowed reference",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_IN_USE]: "Account in use",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_LOADED_TWICE]: "Account loaded twice",
    [SOLANA_ERROR__TRANSACTION_ERROR__ACCOUNT_NOT_FOUND]: "Attempt to debit an account but found no record of a prior credit.",
    [SOLANA_ERROR__TRANSACTION_ERROR__ADDRESS_LOOKUP_TABLE_NOT_FOUND]: "Transaction loads an address table account that doesn't exist",
    [SOLANA_ERROR__TRANSACTION_ERROR__ALREADY_PROCESSED]: "This transaction has already been processed",
    [SOLANA_ERROR__TRANSACTION_ERROR__BLOCKHASH_NOT_FOUND]: "Blockhash not found",
    [SOLANA_ERROR__TRANSACTION_ERROR__CALL_CHAIN_TOO_DEEP]: "Loader call chain is too deep",
    [SOLANA_ERROR__TRANSACTION_ERROR__CLUSTER_MAINTENANCE]: "Transactions are currently disabled due to cluster maintenance",
    [SOLANA_ERROR__TRANSACTION_ERROR__DUPLICATE_INSTRUCTION]: "Transaction contains a duplicate instruction ($index) that is not allowed",
    [SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_FEE]: "Insufficient funds for fee",
    [SOLANA_ERROR__TRANSACTION_ERROR__INSUFFICIENT_FUNDS_FOR_RENT]: "Transaction results in an account ($accountIndex) with insufficient funds for rent",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_FOR_FEE]: "This account may not be used to pay transaction fees",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ACCOUNT_INDEX]: "Transaction contains an invalid account reference",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_DATA]: "Transaction loads an address table account with invalid data",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_INDEX]: "Transaction address table lookup uses an invalid index",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_ADDRESS_LOOKUP_TABLE_OWNER]: "Transaction loads an address table account with an invalid owner",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_LOADED_ACCOUNTS_DATA_SIZE_LIMIT]: "LoadedAccountsDataSizeLimit set for transaction must be greater than 0.",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_PROGRAM_FOR_EXECUTION]: "This program may not be used for executing instructions",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_RENT_PAYING_ACCOUNT]: "Transaction leaves an account with a lower balance than rent-exempt minimum",
    [SOLANA_ERROR__TRANSACTION_ERROR__INVALID_WRITABLE_ACCOUNT]: "Transaction loads a writable account that cannot be written",
    [SOLANA_ERROR__TRANSACTION_ERROR__MAX_LOADED_ACCOUNTS_DATA_SIZE_EXCEEDED]: "Transaction exceeded max loaded accounts data size cap",
    [SOLANA_ERROR__TRANSACTION_ERROR__MISSING_SIGNATURE_FOR_FEE]: "Transaction requires a fee but has no signature present",
    [SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_ACCOUNT_NOT_FOUND]: "Attempt to load a program that does not exist",
    [SOLANA_ERROR__TRANSACTION_ERROR__PROGRAM_EXECUTION_TEMPORARILY_RESTRICTED]: "Execution of the program referenced by account at index $accountIndex is temporarily restricted.",
    [SOLANA_ERROR__TRANSACTION_ERROR__RESANITIZATION_NEEDED]: "ResanitizationNeeded",
    [SOLANA_ERROR__TRANSACTION_ERROR__SANITIZE_FAILURE]: "Transaction failed to sanitize accounts offsets correctly",
    [SOLANA_ERROR__TRANSACTION_ERROR__SIGNATURE_FAILURE]: "Transaction did not pass signature verification",
    [SOLANA_ERROR__TRANSACTION_ERROR__TOO_MANY_ACCOUNT_LOCKS]: "Transaction locked too many accounts",
    [SOLANA_ERROR__TRANSACTION_ERROR__UNBALANCED_TRANSACTION]: "Sum of account balances before and after transaction do not match",
    [SOLANA_ERROR__TRANSACTION_ERROR__UNKNOWN]: "The transaction failed with the error `$errorName`",
    [SOLANA_ERROR__TRANSACTION_ERROR__UNSUPPORTED_VERSION]: "Transaction version is unsupported",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_BLOCK_LIMIT]: "Transaction would exceed account data limit within the block",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_ACCOUNT_DATA_TOTAL_LIMIT]: "Transaction would exceed total account data limit",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_ACCOUNT_COST_LIMIT]: "Transaction would exceed max account limit within the block",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_BLOCK_COST_LIMIT]: "Transaction would exceed max Block Cost Limit",
    [SOLANA_ERROR__TRANSACTION_ERROR__WOULD_EXCEED_MAX_VOTE_COST_LIMIT]: "Transaction would exceed max Vote Cost Limit",
    [SOLANA_ERROR__TRANSACTION__ADDRESSES_CANNOT_SIGN_TRANSACTION]: "Attempted to sign a transaction with an address that is not a signer for it",
    [SOLANA_ERROR__TRANSACTION__ADDRESS_MISSING]: "Transaction is missing an address at index: $index.",
    [SOLANA_ERROR__TRANSACTION__CANNOT_ENCODE_WITH_EMPTY_SIGNATURES]: "Transaction has no expected signers therefore it cannot be encoded",
    [SOLANA_ERROR__TRANSACTION__EXCEEDS_SIZE_LIMIT]: "Transaction size $transactionSize exceeds limit of $transactionSizeLimit bytes",
    [SOLANA_ERROR__TRANSACTION__EXPECTED_BLOCKHASH_LIFETIME]: "Transaction does not have a blockhash lifetime",
    [SOLANA_ERROR__TRANSACTION__EXPECTED_NONCE_LIFETIME]: "Transaction is not a durable nonce transaction",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_CONTENTS_MISSING]: "Contents of these address lookup tables unknown: $lookupTableAddresses",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_ADDRESS_LOOKUP_TABLE_INDEX_OUT_OF_RANGE]: "Lookup of address at index $highestRequestedIndex failed for lookup table `$lookupTableAddress`. Highest known index is $highestKnownIndex. The lookup table may have been extended since its contents were retrieved",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_FEE_PAYER_MISSING]: "No fee payer set in CompiledTransaction",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_DECOMPILE_INSTRUCTION_PROGRAM_ADDRESS_NOT_FOUND]: "Could not find program address at index $index",
    [SOLANA_ERROR__TRANSACTION__FAILED_TO_ESTIMATE_COMPUTE_LIMIT]: "Failed to estimate the compute unit consumption for this transaction message. This is likely because simulating the transaction failed. Inspect the `cause` property of this error to learn more",
    [SOLANA_ERROR__TRANSACTION__FAILED_WHEN_SIMULATING_TO_ESTIMATE_COMPUTE_LIMIT]: "Transaction failed when it was simulated in order to estimate the compute unit consumption. The compute unit estimate provided is for a transaction that failed when simulated and may not be representative of the compute units this transaction would consume if successful. Inspect the `cause` property of this error to learn more",
    [SOLANA_ERROR__TRANSACTION__FEE_PAYER_MISSING]: "Transaction is missing a fee payer.",
    [SOLANA_ERROR__TRANSACTION__FEE_PAYER_SIGNATURE_MISSING]: "Could not determine this transaction's signature. Make sure that the transaction has been signed by its fee payer.",
    [SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_FIRST_INSTRUCTION_MUST_BE_ADVANCE_NONCE]: "Transaction first instruction is not advance nonce account instruction.",
    [SOLANA_ERROR__TRANSACTION__INVALID_NONCE_TRANSACTION_INSTRUCTIONS_MISSING]: "Transaction with no instructions cannot be durable nonce transaction.",
    [SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_CANNOT_PAY_FEES]: "This transaction includes an address (`$programAddress`) which is both invoked and set as the fee payer. Program addresses may not pay fees",
    [SOLANA_ERROR__TRANSACTION__INVOKED_PROGRAMS_MUST_NOT_BE_WRITABLE]: "This transaction includes an address (`$programAddress`) which is both invoked and marked writable. Program addresses may not be writable",
    [SOLANA_ERROR__TRANSACTION__MESSAGE_SIGNATURES_MISMATCH]: "The transaction message expected the transaction to have $numRequiredSignatures signatures, got $signaturesLength.",
    [SOLANA_ERROR__TRANSACTION__SIGNATURES_MISSING]: "Transaction is missing signatures for addresses: $addresses.",
    [SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_OUT_OF_RANGE]: "Transaction version must be in the range [0, 127]. `$actualVersion` given",
    [SOLANA_ERROR__TRANSACTION__VERSION_NUMBER_NOT_SUPPORTED]: "This version of Kit does not support decoding transactions with version $unsupportedVersion. The current max supported version is 0.",
    [SOLANA_ERROR__TRANSACTION__NONCE_ACCOUNT_CANNOT_BE_IN_LOOKUP_TABLE]: "The transaction has a durable nonce lifetime (with nonce `$nonce`), but the nonce account address is in a lookup table. The lifetime constraint cannot be constructed without fetching the lookup tables for the transaction."
  };
  var START_INDEX = "i";
  var TYPE = "t";
  function getHumanReadableErrorMessage(code, context = {}) {
    const messageFormatString = SolanaErrorMessages[code];
    if (messageFormatString.length === 0) {
      return "";
    }
    let state;
    function commitStateUpTo(endIndex) {
      if (state[TYPE] === 2) {
        const variableName = messageFormatString.slice(state[START_INDEX] + 1, endIndex);
        fragments.push(
          variableName in context ? (
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `${context[variableName]}`
          ) : `$${variableName}`
        );
      } else if (state[TYPE] === 1) {
        fragments.push(messageFormatString.slice(state[START_INDEX], endIndex));
      }
    }
    const fragments = [];
    messageFormatString.split("").forEach((char, ii) => {
      if (ii === 0) {
        state = {
          [START_INDEX]: 0,
          [TYPE]: messageFormatString[0] === "\\" ? 0 : messageFormatString[0] === "$" ? 2 : 1
          /* Text */
        };
        return;
      }
      let nextState;
      switch (state[TYPE]) {
        case 0:
          nextState = {
            [START_INDEX]: ii,
            [TYPE]: 1
            /* Text */
          };
          break;
        case 1:
          if (char === "\\") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 0
              /* EscapeSequence */
            };
          } else if (char === "$") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 2
              /* Variable */
            };
          }
          break;
        case 2:
          if (char === "\\") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 0
              /* EscapeSequence */
            };
          } else if (char === "$") {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 2
              /* Variable */
            };
          } else if (!char.match(/\w/)) {
            nextState = {
              [START_INDEX]: ii,
              [TYPE]: 1
              /* Text */
            };
          }
          break;
      }
      if (nextState) {
        if (state !== nextState) {
          commitStateUpTo(ii);
        }
        state = nextState;
      }
    });
    commitStateUpTo();
    return fragments.join("");
  }
  function getErrorMessage(code, context = {}) {
    if (true) {
      return getHumanReadableErrorMessage(code, context);
    } else {
      let decodingAdviceMessage = `Solana error #${code}; Decode this error by running \`npx @solana/errors decode -- ${code}`;
      if (Object.keys(context).length) {
        decodingAdviceMessage += ` '${encodeContextObject(context)}'`;
      }
      return `${decodingAdviceMessage}\``;
    }
  }
  var SolanaError = class extends Error {
    constructor(...[code, contextAndErrorOptions]) {
      let context;
      let errorOptions;
      if (contextAndErrorOptions) {
        Object.entries(Object.getOwnPropertyDescriptors(contextAndErrorOptions)).forEach(([name, descriptor]) => {
          if (name === "cause") {
            errorOptions = { cause: descriptor.value };
          } else {
            if (context === void 0) {
              context = {
                __code: code
              };
            }
            Object.defineProperty(context, name, descriptor);
          }
        });
      }
      const message = getErrorMessage(code, context);
      super(message, errorOptions);
      /**
       * Indicates the root cause of this {@link SolanaError}, if any.
       *
       * For example, a transaction error might have an instruction error as its root cause. In this
       * case, you will be able to access the instruction error on the transaction error as `cause`.
       */
      __publicField(this, "cause", this.cause);
      /**
       * Contains context that can assist in understanding or recovering from a {@link SolanaError}.
       */
      __publicField(this, "context");
      this.context = Object.freeze(
        context === void 0 ? {
          __code: code
        } : context
      );
      this.name = "SolanaError";
    }
  };

  // node_modules/@solana/web3.js/node_modules/@solana/codecs-core/dist/index.browser.mjs
  init_buffer_shim();
  function getEncodedSize(value, encoder) {
    return "fixedSize" in encoder ? encoder.fixedSize : encoder.getSizeFromValue(value);
  }
  function createEncoder(encoder) {
    return Object.freeze({
      ...encoder,
      encode: (value) => {
        const bytes = new Uint8Array(getEncodedSize(value, encoder));
        encoder.write(value, bytes, 0);
        return bytes;
      }
    });
  }
  function createDecoder(decoder) {
    return Object.freeze({
      ...decoder,
      decode: (bytes, offset2 = 0) => decoder.read(bytes, offset2)[0]
    });
  }
  function isFixedSize(codec) {
    return "fixedSize" in codec && typeof codec.fixedSize === "number";
  }
  function combineCodec(encoder, decoder) {
    if (isFixedSize(encoder) !== isFixedSize(decoder)) {
      throw new SolanaError(SOLANA_ERROR__CODECS__ENCODER_DECODER_SIZE_COMPATIBILITY_MISMATCH);
    }
    if (isFixedSize(encoder) && isFixedSize(decoder) && encoder.fixedSize !== decoder.fixedSize) {
      throw new SolanaError(SOLANA_ERROR__CODECS__ENCODER_DECODER_FIXED_SIZE_MISMATCH, {
        decoderFixedSize: decoder.fixedSize,
        encoderFixedSize: encoder.fixedSize
      });
    }
    if (!isFixedSize(encoder) && !isFixedSize(decoder) && encoder.maxSize !== decoder.maxSize) {
      throw new SolanaError(SOLANA_ERROR__CODECS__ENCODER_DECODER_MAX_SIZE_MISMATCH, {
        decoderMaxSize: decoder.maxSize,
        encoderMaxSize: encoder.maxSize
      });
    }
    return {
      ...decoder,
      ...encoder,
      decode: decoder.decode,
      encode: encoder.encode,
      read: decoder.read,
      write: encoder.write
    };
  }
  function assertByteArrayIsNotEmptyForCodec(codecDescription, bytes, offset2 = 0) {
    if (bytes.length - offset2 <= 0) {
      throw new SolanaError(SOLANA_ERROR__CODECS__CANNOT_DECODE_EMPTY_BYTE_ARRAY, {
        codecDescription
      });
    }
  }
  function assertByteArrayHasEnoughBytesForCodec(codecDescription, expected, bytes, offset2 = 0) {
    const bytesLength = bytes.length - offset2;
    if (bytesLength < expected) {
      throw new SolanaError(SOLANA_ERROR__CODECS__INVALID_BYTE_LENGTH, {
        bytesLength,
        codecDescription,
        expected
      });
    }
  }
  function toArrayBuffer(bytes, offset2, length) {
    const bytesOffset = bytes.byteOffset + (offset2 ?? 0);
    const bytesLength = length ?? bytes.byteLength;
    let buffer;
    if (typeof SharedArrayBuffer === "undefined") {
      buffer = bytes.buffer;
    } else if (bytes.buffer instanceof SharedArrayBuffer) {
      buffer = new ArrayBuffer(bytes.length);
      new Uint8Array(buffer).set(new Uint8Array(bytes));
    } else {
      buffer = bytes.buffer;
    }
    return (bytesOffset === 0 || bytesOffset === -bytes.byteLength) && bytesLength === bytes.byteLength ? buffer : buffer.slice(bytesOffset, bytesOffset + bytesLength);
  }

  // node_modules/@solana/web3.js/node_modules/@solana/codecs-numbers/dist/index.browser.mjs
  function assertNumberIsBetweenForCodec(codecDescription, min, max, value) {
    if (value < min || value > max) {
      throw new SolanaError(SOLANA_ERROR__CODECS__NUMBER_OUT_OF_RANGE, {
        codecDescription,
        max,
        min,
        value
      });
    }
  }
  function isLittleEndian(config) {
    return config?.endian === 1 ? false : true;
  }
  function numberEncoderFactory(input) {
    return createEncoder({
      fixedSize: input.size,
      write(value, bytes, offset2) {
        if (input.range) {
          assertNumberIsBetweenForCodec(input.name, input.range[0], input.range[1], value);
        }
        const arrayBuffer = new ArrayBuffer(input.size);
        input.set(new DataView(arrayBuffer), value, isLittleEndian(input.config));
        bytes.set(new Uint8Array(arrayBuffer), offset2);
        return offset2 + input.size;
      }
    });
  }
  function numberDecoderFactory(input) {
    return createDecoder({
      fixedSize: input.size,
      read(bytes, offset2 = 0) {
        assertByteArrayIsNotEmptyForCodec(input.name, bytes, offset2);
        assertByteArrayHasEnoughBytesForCodec(input.name, input.size, bytes, offset2);
        const view = new DataView(toArrayBuffer(bytes, offset2, input.size));
        return [input.get(view, isLittleEndian(input.config)), offset2 + input.size];
      }
    });
  }
  var getU64Encoder = (config = {}) => numberEncoderFactory({
    config,
    name: "u64",
    range: [0n, BigInt("0xffffffffffffffff")],
    set: (view, value, le) => view.setBigUint64(0, BigInt(value), le),
    size: 8
  });
  var getU64Decoder = (config = {}) => numberDecoderFactory({
    config,
    get: (view, le) => view.getBigUint64(0, le),
    name: "u64",
    size: 8
  });
  var getU64Codec = (config = {}) => combineCodec(getU64Encoder(config), getU64Decoder(config));

  // node_modules/@solana/web3.js/node_modules/superstruct/dist/index.mjs
  init_buffer_shim();
  var StructError = class extends TypeError {
    constructor(failure, failures) {
      let cached;
      const { message, explanation, ...rest } = failure;
      const { path } = failure;
      const msg = path.length === 0 ? message : `At path: ${path.join(".")} -- ${message}`;
      super(explanation ?? msg);
      if (explanation != null)
        this.cause = msg;
      Object.assign(this, rest);
      this.name = this.constructor.name;
      this.failures = () => {
        return cached ?? (cached = [failure, ...failures()]);
      };
    }
  };
  function isIterable(x) {
    return isObject(x) && typeof x[Symbol.iterator] === "function";
  }
  function isObject(x) {
    return typeof x === "object" && x != null;
  }
  function isNonArrayObject(x) {
    return isObject(x) && !Array.isArray(x);
  }
  function print(value) {
    if (typeof value === "symbol") {
      return value.toString();
    }
    return typeof value === "string" ? JSON.stringify(value) : `${value}`;
  }
  function shiftIterator(input) {
    const { done, value } = input.next();
    return done ? void 0 : value;
  }
  function toFailure(result, context, struct4, value) {
    if (result === true) {
      return;
    } else if (result === false) {
      result = {};
    } else if (typeof result === "string") {
      result = { message: result };
    }
    const { path, branch } = context;
    const { type: type2 } = struct4;
    const { refinement, message = `Expected a value of type \`${type2}\`${refinement ? ` with refinement \`${refinement}\`` : ""}, but received: \`${print(value)}\`` } = result;
    return {
      value,
      type: type2,
      refinement,
      key: path[path.length - 1],
      path,
      branch,
      ...result,
      message
    };
  }
  function* toFailures(result, context, struct4, value) {
    if (!isIterable(result)) {
      result = [result];
    }
    for (const r of result) {
      const failure = toFailure(r, context, struct4, value);
      if (failure) {
        yield failure;
      }
    }
  }
  function* run(value, struct4, options = {}) {
    const { path = [], branch = [value], coerce: coerce2 = false, mask: mask2 = false } = options;
    const ctx = { path, branch, mask: mask2 };
    if (coerce2) {
      value = struct4.coercer(value, ctx);
    }
    let status = "valid";
    for (const failure of struct4.validator(value, ctx)) {
      failure.explanation = options.message;
      status = "not_valid";
      yield [failure, void 0];
    }
    for (let [k, v, s] of struct4.entries(value, ctx)) {
      const ts = run(v, s, {
        path: k === void 0 ? path : [...path, k],
        branch: k === void 0 ? branch : [...branch, v],
        coerce: coerce2,
        mask: mask2,
        message: options.message
      });
      for (const t of ts) {
        if (t[0]) {
          status = t[0].refinement != null ? "not_refined" : "not_valid";
          yield [t[0], void 0];
        } else if (coerce2) {
          v = t[1];
          if (k === void 0) {
            value = v;
          } else if (value instanceof Map) {
            value.set(k, v);
          } else if (value instanceof Set) {
            value.add(v);
          } else if (isObject(value)) {
            if (v !== void 0 || k in value)
              value[k] = v;
          }
        }
      }
    }
    if (status !== "not_valid") {
      for (const failure of struct4.refiner(value, ctx)) {
        failure.explanation = options.message;
        status = "not_refined";
        yield [failure, void 0];
      }
    }
    if (status === "valid") {
      yield [void 0, value];
    }
  }
  var Struct = class {
    constructor(props) {
      const { type: type2, schema, validator, refiner, coercer = (value) => value, entries = function* () {
      } } = props;
      this.type = type2;
      this.schema = schema;
      this.entries = entries;
      this.coercer = coercer;
      if (validator) {
        this.validator = (value, context) => {
          const result = validator(value, context);
          return toFailures(result, context, this, value);
        };
      } else {
        this.validator = () => [];
      }
      if (refiner) {
        this.refiner = (value, context) => {
          const result = refiner(value, context);
          return toFailures(result, context, this, value);
        };
      } else {
        this.refiner = () => [];
      }
    }
    /**
     * Assert that a value passes the struct's validation, throwing if it doesn't.
     */
    assert(value, message) {
      return assert(value, this, message);
    }
    /**
     * Create a value with the struct's coercion logic, then validate it.
     */
    create(value, message) {
      return create(value, this, message);
    }
    /**
     * Check if a value passes the struct's validation.
     */
    is(value) {
      return is(value, this);
    }
    /**
     * Mask a value, coercing and validating it, but returning only the subset of
     * properties defined by the struct's schema. Masking applies recursively to
     * props of `object` structs only.
     */
    mask(value, message) {
      return mask(value, this, message);
    }
    /**
     * Validate a value with the struct's validation logic, returning a tuple
     * representing the result.
     *
     * You may optionally pass `true` for the `coerce` argument to coerce
     * the value before attempting to validate it. If you do, the result will
     * contain the coerced result when successful. Also, `mask` will turn on
     * masking of the unknown `object` props recursively if passed.
     */
    validate(value, options = {}) {
      return validate(value, this, options);
    }
  };
  function assert(value, struct4, message) {
    const result = validate(value, struct4, { message });
    if (result[0]) {
      throw result[0];
    }
  }
  function create(value, struct4, message) {
    const result = validate(value, struct4, { coerce: true, message });
    if (result[0]) {
      throw result[0];
    } else {
      return result[1];
    }
  }
  function mask(value, struct4, message) {
    const result = validate(value, struct4, { coerce: true, mask: true, message });
    if (result[0]) {
      throw result[0];
    } else {
      return result[1];
    }
  }
  function is(value, struct4) {
    const result = validate(value, struct4);
    return !result[0];
  }
  function validate(value, struct4, options = {}) {
    const tuples = run(value, struct4, options);
    const tuple2 = shiftIterator(tuples);
    if (tuple2[0]) {
      const error = new StructError(tuple2[0], function* () {
        for (const t of tuples) {
          if (t[0]) {
            yield t[0];
          }
        }
      });
      return [error, void 0];
    } else {
      const v = tuple2[1];
      return [void 0, v];
    }
  }
  function define(name, validator) {
    return new Struct({ type: name, schema: null, validator });
  }
  function any() {
    return define("any", () => true);
  }
  function array(Element) {
    return new Struct({
      type: "array",
      schema: Element,
      *entries(value) {
        if (Element && Array.isArray(value)) {
          for (const [i2, v] of value.entries()) {
            yield [i2, v, Element];
          }
        }
      },
      coercer(value) {
        return Array.isArray(value) ? value.slice() : value;
      },
      validator(value) {
        return Array.isArray(value) || `Expected an array value, but received: ${print(value)}`;
      }
    });
  }
  function boolean() {
    return define("boolean", (value) => {
      return typeof value === "boolean";
    });
  }
  function instance(Class) {
    return define("instance", (value) => {
      return value instanceof Class || `Expected a \`${Class.name}\` instance, but received: ${print(value)}`;
    });
  }
  function literal(constant) {
    const description = print(constant);
    const t = typeof constant;
    return new Struct({
      type: "literal",
      schema: t === "string" || t === "number" || t === "boolean" ? constant : null,
      validator(value) {
        return value === constant || `Expected the literal \`${description}\`, but received: ${print(value)}`;
      }
    });
  }
  function never() {
    return define("never", () => false);
  }
  function nullable(struct4) {
    return new Struct({
      ...struct4,
      validator: (value, ctx) => value === null || struct4.validator(value, ctx),
      refiner: (value, ctx) => value === null || struct4.refiner(value, ctx)
    });
  }
  function number() {
    return define("number", (value) => {
      return typeof value === "number" && !isNaN(value) || `Expected a number, but received: ${print(value)}`;
    });
  }
  function optional(struct4) {
    return new Struct({
      ...struct4,
      validator: (value, ctx) => value === void 0 || struct4.validator(value, ctx),
      refiner: (value, ctx) => value === void 0 || struct4.refiner(value, ctx)
    });
  }
  function record(Key, Value) {
    return new Struct({
      type: "record",
      schema: null,
      *entries(value) {
        if (isObject(value)) {
          for (const k in value) {
            const v = value[k];
            yield [k, k, Key];
            yield [k, v, Value];
          }
        }
      },
      validator(value) {
        return isNonArrayObject(value) || `Expected an object, but received: ${print(value)}`;
      },
      coercer(value) {
        return isNonArrayObject(value) ? { ...value } : value;
      }
    });
  }
  function string() {
    return define("string", (value) => {
      return typeof value === "string" || `Expected a string, but received: ${print(value)}`;
    });
  }
  function tuple(Structs) {
    const Never = never();
    return new Struct({
      type: "tuple",
      schema: null,
      *entries(value) {
        if (Array.isArray(value)) {
          const length = Math.max(Structs.length, value.length);
          for (let i2 = 0; i2 < length; i2++) {
            yield [i2, value[i2], Structs[i2] || Never];
          }
        }
      },
      validator(value) {
        return Array.isArray(value) || `Expected an array, but received: ${print(value)}`;
      },
      coercer(value) {
        return Array.isArray(value) ? value.slice() : value;
      }
    });
  }
  function type(schema) {
    const keys = Object.keys(schema);
    return new Struct({
      type: "type",
      schema,
      *entries(value) {
        if (isObject(value)) {
          for (const k of keys) {
            yield [k, value[k], schema[k]];
          }
        }
      },
      validator(value) {
        return isNonArrayObject(value) || `Expected an object, but received: ${print(value)}`;
      },
      coercer(value) {
        return isNonArrayObject(value) ? { ...value } : value;
      }
    });
  }
  function union(Structs) {
    const description = Structs.map((s) => s.type).join(" | ");
    return new Struct({
      type: "union",
      schema: null,
      coercer(value, ctx) {
        for (const S of Structs) {
          const [error, coerced] = S.validate(value, {
            coerce: true,
            mask: ctx.mask
          });
          if (!error) {
            return coerced;
          }
        }
        return value;
      },
      validator(value, ctx) {
        const failures = [];
        for (const S of Structs) {
          const [...tuples] = run(value, S, ctx);
          const [first] = tuples;
          if (!first[0]) {
            return [];
          } else {
            for (const [failure] of tuples) {
              if (failure) {
                failures.push(failure);
              }
            }
          }
        }
        return [
          `Expected the value to satisfy a union of \`${description}\`, but received: ${print(value)}`,
          ...failures
        ];
      }
    });
  }
  function unknown() {
    return define("unknown", () => true);
  }
  function coerce(struct4, condition, coercer) {
    return new Struct({
      ...struct4,
      coercer: (value, ctx) => {
        return is(value, condition) ? struct4.coercer(coercer(value, ctx), ctx) : struct4.coercer(value, ctx);
      }
    });
  }

  // node_modules/@solana/web3.js/lib/index.browser.esm.js
  var import_browser = __toESM(require_browser());

  // node_modules/rpc-websockets/dist/index.browser.mjs
  init_buffer_shim();
  var import_buffer2 = __toESM(require_buffer(), 1);

  // node_modules/rpc-websockets/node_modules/eventemitter3/index.mjs
  init_buffer_shim();
  var import_index = __toESM(require_eventemitter3(), 1);

  // node_modules/rpc-websockets/dist/index.browser.mjs
  var WebSocketBrowserImpl = class extends import_index.default {
    /** Instantiate a WebSocket class
    * @constructor
    * @param {String} address - url to a websocket server
    * @param {WebSocketBrowserOptions} options - websocket options
    * @return {WebSocketBrowserImpl} - returns a WebSocket instance
    */
    constructor(address, options) {
      super();
      __publicField(this, "socket");
      this.socket = new window.WebSocket(address, options.protocols);
      this.socket.onopen = () => this.emit("open");
      this.socket.onmessage = (event) => this.emit("message", event.data);
      this.socket.onerror = (error) => this.emit("error", error);
      this.socket.onclose = (event) => {
        this.emit("close", event.code, event.reason);
      };
    }
    /**
    * Sends data through a websocket connection
    * @method
    * @param {(String|Object)} data - data to be sent via websocket
    * @param {Object} optionsOrCallback - ws options
    * @param {Function} callback - a callback called once the data is sent
    * @return {Undefined}
    */
    send(data, optionsOrCallback, callback) {
      const cb = callback || optionsOrCallback;
      try {
        this.socket.send(data);
        cb();
      } catch (error) {
        cb(error);
      }
    }
    /**
    * Closes an underlying socket
    * @method
    * @param {Number} code - status code explaining why the connection is being closed
    * @param {String} reason - a description why the connection is closing
    * @return {Undefined}
    * @throws {Error}
    */
    close(code, reason) {
      this.socket.close(code, reason);
    }
    addEventListener(type2, listener, options) {
      this.socket.addEventListener(type2, listener, options);
    }
  };
  function WebSocket(address, options) {
    return new WebSocketBrowserImpl(address, options);
  }
  var DefaultDataPack = class {
    encode(value) {
      return JSON.stringify(value);
    }
    decode(value) {
      return JSON.parse(value);
    }
  };
  var CommonClient = class extends import_index.default {
    /**
    * Instantiate a Client class.
    * @constructor
    * @param {webSocketFactory} webSocketFactory - factory method for WebSocket
    * @param {String} address - url to a websocket server
    * @param {Object} options - ws options object with reconnect parameters
    * @param {Function} generate_request_id - custom generation request Id
    * @param {DataPack} dataPack - data pack contains encoder and decoder
    * @return {CommonClient}
    */
    constructor(webSocketFactory, address = "ws://localhost:8080", {
      autoconnect = true,
      reconnect = true,
      reconnect_interval = 1e3,
      max_reconnects = 5,
      ...rest_options
    } = {}, generate_request_id, dataPack) {
      super();
      __publicField(this, "address");
      __publicField(this, "rpc_id");
      __publicField(this, "queue");
      __publicField(this, "options");
      __publicField(this, "autoconnect");
      __publicField(this, "ready");
      __publicField(this, "reconnect");
      __publicField(this, "reconnect_timer_id");
      __publicField(this, "reconnect_interval");
      __publicField(this, "max_reconnects");
      __publicField(this, "rest_options");
      __publicField(this, "current_reconnects");
      __publicField(this, "generate_request_id");
      __publicField(this, "socket");
      __publicField(this, "webSocketFactory");
      __publicField(this, "dataPack");
      this.webSocketFactory = webSocketFactory;
      this.queue = {};
      this.rpc_id = 0;
      this.address = address;
      this.autoconnect = autoconnect;
      this.ready = false;
      this.reconnect = reconnect;
      this.reconnect_timer_id = void 0;
      this.reconnect_interval = reconnect_interval;
      this.max_reconnects = max_reconnects;
      this.rest_options = rest_options;
      this.current_reconnects = 0;
      this.generate_request_id = generate_request_id || (() => typeof this.rpc_id === "number" ? ++this.rpc_id : Number(this.rpc_id) + 1);
      if (!dataPack) this.dataPack = new DefaultDataPack();
      else this.dataPack = dataPack;
      if (this.autoconnect)
        this._connect(this.address, {
          autoconnect: this.autoconnect,
          reconnect: this.reconnect,
          reconnect_interval: this.reconnect_interval,
          max_reconnects: this.max_reconnects,
          ...this.rest_options
        });
    }
    /**
    * Connects to a defined server if not connected already.
    * @method
    * @return {Undefined}
    */
    connect() {
      if (this.socket) return;
      this._connect(this.address, {
        autoconnect: this.autoconnect,
        reconnect: this.reconnect,
        reconnect_interval: this.reconnect_interval,
        max_reconnects: this.max_reconnects,
        ...this.rest_options
      });
    }
    /**
    * Calls a registered RPC method on server.
    * @method
    * @param {String} method - RPC method name
    * @param {Object|Array} params - optional method parameters
    * @param {Number} timeout - RPC reply timeout value
    * @param {Object} ws_opts - options passed to ws
    * @return {Promise}
    */
    call(method, params, timeout, ws_opts) {
      if (!ws_opts && "object" === typeof timeout) {
        ws_opts = timeout;
        timeout = null;
      }
      return new Promise((resolve, reject) => {
        if (!this.ready) return reject(new Error("socket not ready"));
        const rpc_id = this.generate_request_id(method, params);
        const message = {
          jsonrpc: "2.0",
          method,
          params: params || void 0,
          id: rpc_id
        };
        this.socket.send(this.dataPack.encode(message), ws_opts, (error) => {
          if (error) return reject(error);
          this.queue[rpc_id] = { promise: [resolve, reject] };
          if (timeout) {
            this.queue[rpc_id].timeout = setTimeout(() => {
              delete this.queue[rpc_id];
              reject(new Error("reply timeout"));
            }, timeout);
          }
        });
      });
    }
    /**
    * Logins with the other side of the connection.
    * @method
    * @param {Object} params - Login credentials object
    * @return {Promise}
    */
    async login(params) {
      const resp = await this.call("rpc.login", params);
      if (!resp) throw new Error("authentication failed");
      return resp;
    }
    /**
    * Fetches a list of client's methods registered on server.
    * @method
    * @return {Array}
    */
    async listMethods() {
      return await this.call("__listMethods");
    }
    /**
    * Sends a JSON-RPC 2.0 notification to server.
    * @method
    * @param {String} method - RPC method name
    * @param {Object} params - optional method parameters
    * @return {Promise}
    */
    notify(method, params) {
      return new Promise((resolve, reject) => {
        if (!this.ready) return reject(new Error("socket not ready"));
        const message = {
          jsonrpc: "2.0",
          method,
          params
        };
        this.socket.send(this.dataPack.encode(message), (error) => {
          if (error) return reject(error);
          resolve();
        });
      });
    }
    /**
    * Subscribes for a defined event.
    * @method
    * @param {String|Array} event - event name
    * @return {Undefined}
    * @throws {Error}
    */
    async subscribe(event) {
      if (typeof event === "string") event = [event];
      const result = await this.call("rpc.on", event);
      if (typeof event === "string" && result[event] !== "ok")
        throw new Error(
          "Failed subscribing to an event '" + event + "' with: " + result[event]
        );
      return result;
    }
    /**
    * Unsubscribes from a defined event.
    * @method
    * @param {String|Array} event - event name
    * @return {Undefined}
    * @throws {Error}
    */
    async unsubscribe(event) {
      if (typeof event === "string") event = [event];
      const result = await this.call("rpc.off", event);
      if (typeof event === "string" && result[event] !== "ok")
        throw new Error("Failed unsubscribing from an event with: " + result);
      return result;
    }
    /**
    * Closes a WebSocket connection gracefully.
    * @method
    * @param {Number} code - socket close code
    * @param {String} data - optional data to be sent before closing
    * @return {Undefined}
    */
    close(code, data) {
      if (this.socket) this.socket.close(code || 1e3, data);
    }
    /**
    * Enable / disable automatic reconnection.
    * @method
    * @param {Boolean} reconnect - enable / disable reconnection
    * @return {Undefined}
    */
    setAutoReconnect(reconnect) {
      this.reconnect = reconnect;
    }
    /**
    * Set the interval between reconnection attempts.
    * @method
    * @param {Number} interval - reconnection interval in milliseconds
    * @return {Undefined}
    */
    setReconnectInterval(interval) {
      this.reconnect_interval = interval;
    }
    /**
    * Set the maximum number of reconnection attempts.
    * @method
    * @param {Number} max_reconnects - maximum reconnection attempts
    * @return {Undefined}
    */
    setMaxReconnects(max_reconnects) {
      this.max_reconnects = max_reconnects;
    }
    /**
    * Get the current number of reconnection attempts made.
    * @method
    * @return {Number} current reconnection attempts
    */
    getCurrentReconnects() {
      return this.current_reconnects;
    }
    /**
    * Get the maximum number of reconnection attempts.
    * @method
    * @return {Number} maximum reconnection attempts
    */
    getMaxReconnects() {
      return this.max_reconnects;
    }
    /**
    * Check if the client is currently attempting to reconnect.
    * @method
    * @return {Boolean} true if reconnection is in progress
    */
    isReconnecting() {
      return this.reconnect_timer_id !== void 0;
    }
    /**
    * Check if the client will attempt to reconnect on the next close event.
    * @method
    * @return {Boolean} true if reconnection will be attempted
    */
    willReconnect() {
      return this.reconnect && (this.max_reconnects === 0 || this.current_reconnects < this.max_reconnects);
    }
    /**
    * Connection/Message handler.
    * @method
    * @private
    * @param {String} address - WebSocket API address
    * @param {Object} options - ws options object
    * @return {Undefined}
    */
    _connect(address, options) {
      clearTimeout(this.reconnect_timer_id);
      this.socket = this.webSocketFactory(address, options);
      this.socket.addEventListener("open", () => {
        this.ready = true;
        this.emit("open");
        this.current_reconnects = 0;
      });
      this.socket.addEventListener("message", ({ data: message }) => {
        if (message instanceof ArrayBuffer)
          message = import_buffer2.Buffer.from(message).toString();
        try {
          message = this.dataPack.decode(message);
        } catch (_error) {
          return;
        }
        if (message.notification && this.listeners(message.notification).length) {
          if (!Object.keys(message.params).length)
            return this.emit(message.notification);
          const args = [message.notification];
          if (message.params.constructor === Object) args.push(message.params);
          else
            for (let i2 = 0; i2 < message.params.length; i2++)
              args.push(message.params[i2]);
          return Promise.resolve().then(() => {
            this.emit.apply(this, args);
          });
        }
        if (!this.queue[message.id]) {
          if (message.method) {
            return Promise.resolve().then(() => {
              this.emit(message.method, message?.params);
            });
          }
          return;
        }
        if ("error" in message === "result" in message)
          this.queue[message.id].promise[1](
            new Error(
              'Server response malformed. Response must include either "result" or "error", but not both.'
            )
          );
        if (this.queue[message.id].timeout)
          clearTimeout(this.queue[message.id].timeout);
        if (message.error) this.queue[message.id].promise[1](message.error);
        else this.queue[message.id].promise[0](message.result);
        delete this.queue[message.id];
      });
      this.socket.addEventListener("error", (error) => this.emit("error", error));
      this.socket.addEventListener("close", ({ code, reason }) => {
        if (this.ready)
          setTimeout(() => this.emit("close", code, reason), 0);
        this.ready = false;
        this.socket = void 0;
        if (code === 1e3) return;
        this.current_reconnects++;
        if (this.reconnect && (this.max_reconnects > this.current_reconnects || this.max_reconnects === 0))
          this.reconnect_timer_id = setTimeout(
            () => this._connect(address, options),
            this.reconnect_interval
          );
        else if (this.reconnect && this.max_reconnects > 0 && this.current_reconnects >= this.max_reconnects) {
          setTimeout(() => this.emit("max_reconnects_reached", code, reason), 1);
        }
      });
    }
  };

  // node_modules/@noble/hashes/esm/sha3.js
  init_buffer_shim();
  var _0n6 = BigInt(0);
  var _1n6 = BigInt(1);
  var _2n4 = BigInt(2);
  var _7n2 = BigInt(7);
  var _256n = BigInt(256);
  var _0x71n = BigInt(113);
  var SHA3_PI = [];
  var SHA3_ROTL = [];
  var _SHA3_IOTA = [];
  for (let round = 0, R = _1n6, x = 1, y = 0; round < 24; round++) {
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
    let t = _0n6;
    for (let j = 0; j < 7; j++) {
      R = (R << _1n6 ^ (R >> _7n2) * _0x71n) % _256n;
      if (R & _2n4)
        t ^= _1n6 << (_1n6 << /* @__PURE__ */ BigInt(j)) - _1n6;
    }
    _SHA3_IOTA.push(t);
  }
  var IOTAS = split(_SHA3_IOTA, true);
  var SHA3_IOTA_H = IOTAS[0];
  var SHA3_IOTA_L = IOTAS[1];
  var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
  var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
  function keccakP(s, rounds = 24) {
    const B = new Uint32Array(5 * 2);
    for (let round = 24 - rounds; round < 24; round++) {
      for (let x = 0; x < 10; x++)
        B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
      for (let x = 0; x < 10; x += 2) {
        const idx1 = (x + 8) % 10;
        const idx0 = (x + 2) % 10;
        const B0 = B[idx0];
        const B1 = B[idx0 + 1];
        const Th = rotlH(B0, B1, 1) ^ B[idx1];
        const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
        for (let y = 0; y < 50; y += 10) {
          s[x + y] ^= Th;
          s[x + y + 1] ^= Tl;
        }
      }
      let curH = s[2];
      let curL = s[3];
      for (let t = 0; t < 24; t++) {
        const shift = SHA3_ROTL[t];
        const Th = rotlH(curH, curL, shift);
        const Tl = rotlL(curH, curL, shift);
        const PI = SHA3_PI[t];
        curH = s[PI];
        curL = s[PI + 1];
        s[PI] = Th;
        s[PI + 1] = Tl;
      }
      for (let y = 0; y < 50; y += 10) {
        for (let x = 0; x < 10; x++)
          B[x] = s[y + x];
        for (let x = 0; x < 10; x++)
          s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
      }
      s[0] ^= SHA3_IOTA_H[round];
      s[1] ^= SHA3_IOTA_L[round];
    }
    clean(B);
  }
  var Keccak = class _Keccak extends Hash {
    // NOTE: we accept arguments in bytes instead of bits here.
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
      super();
      this.pos = 0;
      this.posOut = 0;
      this.finished = false;
      this.destroyed = false;
      this.enableXOF = false;
      this.blockLen = blockLen;
      this.suffix = suffix;
      this.outputLen = outputLen;
      this.enableXOF = enableXOF;
      this.rounds = rounds;
      anumber(outputLen);
      if (!(0 < blockLen && blockLen < 200))
        throw new Error("only keccak-f1600 function is supported");
      this.state = new Uint8Array(200);
      this.state32 = u32(this.state);
    }
    clone() {
      return this._cloneInto();
    }
    keccak() {
      swap32IfBE(this.state32);
      keccakP(this.state32, this.rounds);
      swap32IfBE(this.state32);
      this.posOut = 0;
      this.pos = 0;
    }
    update(data) {
      aexists(this);
      data = toBytes(data);
      abytes(data);
      const { blockLen, state } = this;
      const len = data.length;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        for (let i2 = 0; i2 < take; i2++)
          state[this.pos++] ^= data[pos++];
        if (this.pos === blockLen)
          this.keccak();
      }
      return this;
    }
    finish() {
      if (this.finished)
        return;
      this.finished = true;
      const { state, suffix, pos, blockLen } = this;
      state[pos] ^= suffix;
      if ((suffix & 128) !== 0 && pos === blockLen - 1)
        this.keccak();
      state[blockLen - 1] ^= 128;
      this.keccak();
    }
    writeInto(out) {
      aexists(this, false);
      abytes(out);
      this.finish();
      const bufferOut = this.state;
      const { blockLen } = this;
      for (let pos = 0, len = out.length; pos < len; ) {
        if (this.posOut >= blockLen)
          this.keccak();
        const take = Math.min(blockLen - this.posOut, len - pos);
        out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
        this.posOut += take;
        pos += take;
      }
      return out;
    }
    xofInto(out) {
      if (!this.enableXOF)
        throw new Error("XOF is not possible for this instance");
      return this.writeInto(out);
    }
    xof(bytes) {
      anumber(bytes);
      return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
      aoutput(out, this);
      if (this.finished)
        throw new Error("digest() was already called");
      this.writeInto(out);
      this.destroy();
      return out;
    }
    digest() {
      return this.digestInto(new Uint8Array(this.outputLen));
    }
    destroy() {
      this.destroyed = true;
      clean(this.state);
    }
    _cloneInto(to) {
      const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
      to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
      to.state32.set(this.state32);
      to.pos = this.pos;
      to.posOut = this.posOut;
      to.finished = this.finished;
      to.rounds = rounds;
      to.suffix = suffix;
      to.outputLen = outputLen;
      to.enableXOF = enableXOF;
      to.destroyed = this.destroyed;
      return to;
    }
  };
  var gen = (suffix, blockLen, outputLen) => createHasher(() => new Keccak(blockLen, suffix, outputLen));
  var keccak_256 = /* @__PURE__ */ (() => gen(1, 136, 256 / 8))();

  // node_modules/@noble/curves/esm/secp256k1.js
  init_buffer_shim();

  // node_modules/@noble/curves/esm/_shortw_utils.js
  init_buffer_shim();

  // node_modules/@noble/curves/esm/abstract/weierstrass.js
  init_buffer_shim();

  // node_modules/@noble/hashes/esm/hmac.js
  init_buffer_shim();
  var HMAC = class extends Hash {
    constructor(hash, _key) {
      super();
      this.finished = false;
      this.destroyed = false;
      ahash(hash);
      const key = toBytes(_key);
      this.iHash = hash.create();
      if (typeof this.iHash.update !== "function")
        throw new Error("Expected instance of class which extends utils.Hash");
      this.blockLen = this.iHash.blockLen;
      this.outputLen = this.iHash.outputLen;
      const blockLen = this.blockLen;
      const pad = new Uint8Array(blockLen);
      pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
      for (let i2 = 0; i2 < pad.length; i2++)
        pad[i2] ^= 54;
      this.iHash.update(pad);
      this.oHash = hash.create();
      for (let i2 = 0; i2 < pad.length; i2++)
        pad[i2] ^= 54 ^ 92;
      this.oHash.update(pad);
      clean(pad);
    }
    update(buf) {
      aexists(this);
      this.iHash.update(buf);
      return this;
    }
    digestInto(out) {
      aexists(this);
      abytes(out, this.outputLen);
      this.finished = true;
      this.iHash.digestInto(out);
      this.oHash.update(out);
      this.oHash.digestInto(out);
      this.destroy();
    }
    digest() {
      const out = new Uint8Array(this.oHash.outputLen);
      this.digestInto(out);
      return out;
    }
    _cloneInto(to) {
      to || (to = Object.create(Object.getPrototypeOf(this), {}));
      const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
      to = to;
      to.finished = finished;
      to.destroyed = destroyed;
      to.blockLen = blockLen;
      to.outputLen = outputLen;
      to.oHash = oHash._cloneInto(to.oHash);
      to.iHash = iHash._cloneInto(to.iHash);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
    destroy() {
      this.destroyed = true;
      this.oHash.destroy();
      this.iHash.destroy();
    }
  };
  var hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
  hmac.create = (hash, key) => new HMAC(hash, key);

  // node_modules/@noble/curves/esm/abstract/weierstrass.js
  var divNearest = (num, den) => (num + (num >= 0 ? den : -den) / _2n5) / den;
  function _splitEndoScalar(k, basis, n) {
    const [[a1, b1], [a2, b2]] = basis;
    const c1 = divNearest(b2 * k, n);
    const c2 = divNearest(-b1 * k, n);
    let k1 = k - c1 * a1 - c2 * a2;
    let k2 = -c1 * b1 - c2 * b2;
    const k1neg = k1 < _0n7;
    const k2neg = k2 < _0n7;
    if (k1neg)
      k1 = -k1;
    if (k2neg)
      k2 = -k2;
    const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n7;
    if (k1 < _0n7 || k1 >= MAX_NUM || k2 < _0n7 || k2 >= MAX_NUM) {
      throw new Error("splitScalar (endomorphism): failed, k=" + k);
    }
    return { k1neg, k1, k2neg, k2 };
  }
  function validateSigFormat(format) {
    if (!["compact", "recovered", "der"].includes(format))
      throw new Error('Signature format must be "compact", "recovered", or "der"');
    return format;
  }
  function validateSigOpts(opts, def) {
    const optsn = {};
    for (let optName of Object.keys(def)) {
      optsn[optName] = opts[optName] === void 0 ? def[optName] : opts[optName];
    }
    _abool2(optsn.lowS, "lowS");
    _abool2(optsn.prehash, "prehash");
    if (optsn.format !== void 0)
      validateSigFormat(optsn.format);
    return optsn;
  }
  var DERErr = class extends Error {
    constructor(m = "") {
      super(m);
    }
  };
  var DER = {
    // asn.1 DER encoding utils
    Err: DERErr,
    // Basic building block is TLV (Tag-Length-Value)
    _tlv: {
      encode: (tag, data) => {
        const { Err: E } = DER;
        if (tag < 0 || tag > 256)
          throw new E("tlv.encode: wrong tag");
        if (data.length & 1)
          throw new E("tlv.encode: unpadded data");
        const dataLen = data.length / 2;
        const len = numberToHexUnpadded(dataLen);
        if (len.length / 2 & 128)
          throw new E("tlv.encode: long form length too big");
        const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
        const t = numberToHexUnpadded(tag);
        return t + lenLen + len + data;
      },
      // v - value, l - left bytes (unparsed)
      decode(tag, data) {
        const { Err: E } = DER;
        let pos = 0;
        if (tag < 0 || tag > 256)
          throw new E("tlv.encode: wrong tag");
        if (data.length < 2 || data[pos++] !== tag)
          throw new E("tlv.decode: wrong tlv");
        const first = data[pos++];
        const isLong = !!(first & 128);
        let length = 0;
        if (!isLong)
          length = first;
        else {
          const lenLen = first & 127;
          if (!lenLen)
            throw new E("tlv.decode(long): indefinite length not supported");
          if (lenLen > 4)
            throw new E("tlv.decode(long): byte length is too big");
          const lengthBytes = data.subarray(pos, pos + lenLen);
          if (lengthBytes.length !== lenLen)
            throw new E("tlv.decode: length bytes not complete");
          if (lengthBytes[0] === 0)
            throw new E("tlv.decode(long): zero leftmost byte");
          for (const b of lengthBytes)
            length = length << 8 | b;
          pos += lenLen;
          if (length < 128)
            throw new E("tlv.decode(long): not minimal encoding");
        }
        const v = data.subarray(pos, pos + length);
        if (v.length !== length)
          throw new E("tlv.decode: wrong value length");
        return { v, l: data.subarray(pos + length) };
      }
    },
    // https://crypto.stackexchange.com/a/57734 Leftmost bit of first byte is 'negative' flag,
    // since we always use positive integers here. It must always be empty:
    // - add zero byte if exists
    // - if next byte doesn't have a flag, leading zero is not allowed (minimal encoding)
    _int: {
      encode(num) {
        const { Err: E } = DER;
        if (num < _0n7)
          throw new E("integer: negative integers are not allowed");
        let hex = numberToHexUnpadded(num);
        if (Number.parseInt(hex[0], 16) & 8)
          hex = "00" + hex;
        if (hex.length & 1)
          throw new E("unexpected DER parsing assertion: unpadded hex");
        return hex;
      },
      decode(data) {
        const { Err: E } = DER;
        if (data[0] & 128)
          throw new E("invalid signature integer: negative");
        if (data[0] === 0 && !(data[1] & 128))
          throw new E("invalid signature integer: unnecessary leading zero");
        return bytesToNumberBE(data);
      }
    },
    toSig(hex) {
      const { Err: E, _int: int, _tlv: tlv } = DER;
      const data = ensureBytes("signature", hex);
      const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
      if (seqLeftBytes.length)
        throw new E("invalid signature: left bytes after parsing");
      const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
      const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
      if (sLeftBytes.length)
        throw new E("invalid signature: left bytes after parsing");
      return { r: int.decode(rBytes), s: int.decode(sBytes) };
    },
    hexFromSig(sig) {
      const { _tlv: tlv, _int: int } = DER;
      const rs = tlv.encode(2, int.encode(sig.r));
      const ss = tlv.encode(2, int.encode(sig.s));
      const seq2 = rs + ss;
      return tlv.encode(48, seq2);
    }
  };
  var _0n7 = BigInt(0);
  var _1n7 = BigInt(1);
  var _2n5 = BigInt(2);
  var _3n3 = BigInt(3);
  var _4n2 = BigInt(4);
  function _normFnElement(Fn2, key) {
    const { BYTES: expected } = Fn2;
    let num;
    if (typeof key === "bigint") {
      num = key;
    } else {
      let bytes = ensureBytes("private key", key);
      try {
        num = Fn2.fromBytes(bytes);
      } catch (error) {
        throw new Error(`invalid private key: expected ui8a of size ${expected}, got ${typeof key}`);
      }
    }
    if (!Fn2.isValidNot0(num))
      throw new Error("invalid private key: out of range [1..N-1]");
    return num;
  }
  function weierstrassN(params, extraOpts = {}) {
    const validated = _createCurveFields("weierstrass", params, extraOpts);
    const { Fp: Fp2, Fn: Fn2 } = validated;
    let CURVE = validated.CURVE;
    const { h: cofactor, n: CURVE_ORDER } = CURVE;
    _validateObject(extraOpts, {}, {
      allowInfinityPoint: "boolean",
      clearCofactor: "function",
      isTorsionFree: "function",
      fromBytes: "function",
      toBytes: "function",
      endo: "object",
      wrapPrivateKey: "boolean"
    });
    const { endo } = extraOpts;
    if (endo) {
      if (!Fp2.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
        throw new Error('invalid endo: expected "beta": bigint and "basises": array');
      }
    }
    const lengths = getWLengths(Fp2, Fn2);
    function assertCompressionIsSupported() {
      if (!Fp2.isOdd)
        throw new Error("compression is not supported: Field does not have .isOdd()");
    }
    function pointToBytes(_c, point, isCompressed) {
      const { x, y } = point.toAffine();
      const bx = Fp2.toBytes(x);
      _abool2(isCompressed, "isCompressed");
      if (isCompressed) {
        assertCompressionIsSupported();
        const hasEvenY = !Fp2.isOdd(y);
        return concatBytes(pprefix(hasEvenY), bx);
      } else {
        return concatBytes(Uint8Array.of(4), bx, Fp2.toBytes(y));
      }
    }
    function pointFromBytes(bytes) {
      _abytes2(bytes, void 0, "Point");
      const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
      const length = bytes.length;
      const head = bytes[0];
      const tail = bytes.subarray(1);
      if (length === comp && (head === 2 || head === 3)) {
        const x = Fp2.fromBytes(tail);
        if (!Fp2.isValid(x))
          throw new Error("bad point: is not on curve, wrong x");
        const y2 = weierstrassEquation(x);
        let y;
        try {
          y = Fp2.sqrt(y2);
        } catch (sqrtError) {
          const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
          throw new Error("bad point: is not on curve, sqrt error" + err);
        }
        assertCompressionIsSupported();
        const isYOdd = Fp2.isOdd(y);
        const isHeadOdd = (head & 1) === 1;
        if (isHeadOdd !== isYOdd)
          y = Fp2.neg(y);
        return { x, y };
      } else if (length === uncomp && head === 4) {
        const L = Fp2.BYTES;
        const x = Fp2.fromBytes(tail.subarray(0, L));
        const y = Fp2.fromBytes(tail.subarray(L, L * 2));
        if (!isValidXY(x, y))
          throw new Error("bad point: is not on curve");
        return { x, y };
      } else {
        throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
      }
    }
    const encodePoint = extraOpts.toBytes || pointToBytes;
    const decodePoint = extraOpts.fromBytes || pointFromBytes;
    function weierstrassEquation(x) {
      const x2 = Fp2.sqr(x);
      const x3 = Fp2.mul(x2, x);
      return Fp2.add(Fp2.add(x3, Fp2.mul(x, CURVE.a)), CURVE.b);
    }
    function isValidXY(x, y) {
      const left = Fp2.sqr(y);
      const right = weierstrassEquation(x);
      return Fp2.eql(left, right);
    }
    if (!isValidXY(CURVE.Gx, CURVE.Gy))
      throw new Error("bad curve params: generator point");
    const _4a3 = Fp2.mul(Fp2.pow(CURVE.a, _3n3), _4n2);
    const _27b2 = Fp2.mul(Fp2.sqr(CURVE.b), BigInt(27));
    if (Fp2.is0(Fp2.add(_4a3, _27b2)))
      throw new Error("bad curve params: a or b");
    function acoord(title, n, banZero = false) {
      if (!Fp2.isValid(n) || banZero && Fp2.is0(n))
        throw new Error(`bad point coordinate ${title}`);
      return n;
    }
    function aprjpoint(other) {
      if (!(other instanceof Point))
        throw new Error("ProjectivePoint expected");
    }
    function splitEndoScalarN(k) {
      if (!endo || !endo.basises)
        throw new Error("no endo");
      return _splitEndoScalar(k, endo.basises, Fn2.ORDER);
    }
    const toAffineMemo = memoized((p, iz) => {
      const { X, Y, Z } = p;
      if (Fp2.eql(Z, Fp2.ONE))
        return { x: X, y: Y };
      const is0 = p.is0();
      if (iz == null)
        iz = is0 ? Fp2.ONE : Fp2.inv(Z);
      const x = Fp2.mul(X, iz);
      const y = Fp2.mul(Y, iz);
      const zz = Fp2.mul(Z, iz);
      if (is0)
        return { x: Fp2.ZERO, y: Fp2.ZERO };
      if (!Fp2.eql(zz, Fp2.ONE))
        throw new Error("invZ was invalid");
      return { x, y };
    });
    const assertValidMemo = memoized((p) => {
      if (p.is0()) {
        if (extraOpts.allowInfinityPoint && !Fp2.is0(p.Y))
          return;
        throw new Error("bad point: ZERO");
      }
      const { x, y } = p.toAffine();
      if (!Fp2.isValid(x) || !Fp2.isValid(y))
        throw new Error("bad point: x or y not field elements");
      if (!isValidXY(x, y))
        throw new Error("bad point: equation left != right");
      if (!p.isTorsionFree())
        throw new Error("bad point: not in prime-order subgroup");
      return true;
    });
    function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
      k2p = new Point(Fp2.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
      k1p = negateCt(k1neg, k1p);
      k2p = negateCt(k2neg, k2p);
      return k1p.add(k2p);
    }
    class Point {
      /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
      constructor(X, Y, Z) {
        this.X = acoord("x", X);
        this.Y = acoord("y", Y, true);
        this.Z = acoord("z", Z);
        Object.freeze(this);
      }
      static CURVE() {
        return CURVE;
      }
      /** Does NOT validate if the point is valid. Use `.assertValidity()`. */
      static fromAffine(p) {
        const { x, y } = p || {};
        if (!p || !Fp2.isValid(x) || !Fp2.isValid(y))
          throw new Error("invalid affine point");
        if (p instanceof Point)
          throw new Error("projective point not allowed");
        if (Fp2.is0(x) && Fp2.is0(y))
          return Point.ZERO;
        return new Point(x, y, Fp2.ONE);
      }
      static fromBytes(bytes) {
        const P = Point.fromAffine(decodePoint(_abytes2(bytes, void 0, "point")));
        P.assertValidity();
        return P;
      }
      static fromHex(hex) {
        return Point.fromBytes(ensureBytes("pointHex", hex));
      }
      get x() {
        return this.toAffine().x;
      }
      get y() {
        return this.toAffine().y;
      }
      /**
       *
       * @param windowSize
       * @param isLazy true will defer table computation until the first multiplication
       * @returns
       */
      precompute(windowSize = 8, isLazy = true) {
        wnaf.createCache(this, windowSize);
        if (!isLazy)
          this.multiply(_3n3);
        return this;
      }
      // TODO: return `this`
      /** A point on curve is valid if it conforms to equation. */
      assertValidity() {
        assertValidMemo(this);
      }
      hasEvenY() {
        const { y } = this.toAffine();
        if (!Fp2.isOdd)
          throw new Error("Field doesn't support isOdd");
        return !Fp2.isOdd(y);
      }
      /** Compare one point to another. */
      equals(other) {
        aprjpoint(other);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const { X: X2, Y: Y2, Z: Z2 } = other;
        const U1 = Fp2.eql(Fp2.mul(X1, Z2), Fp2.mul(X2, Z1));
        const U2 = Fp2.eql(Fp2.mul(Y1, Z2), Fp2.mul(Y2, Z1));
        return U1 && U2;
      }
      /** Flips point to one corresponding to (x, -y) in Affine coordinates. */
      negate() {
        return new Point(this.X, Fp2.neg(this.Y), this.Z);
      }
      // Renes-Costello-Batina exception-free doubling formula.
      // There is 30% faster Jacobian formula, but it is not complete.
      // https://eprint.iacr.org/2015/1060, algorithm 3
      // Cost: 8M + 3S + 3*a + 2*b3 + 15add.
      double() {
        const { a, b } = CURVE;
        const b3 = Fp2.mul(b, _3n3);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
        let t0 = Fp2.mul(X1, X1);
        let t1 = Fp2.mul(Y1, Y1);
        let t2 = Fp2.mul(Z1, Z1);
        let t3 = Fp2.mul(X1, Y1);
        t3 = Fp2.add(t3, t3);
        Z3 = Fp2.mul(X1, Z1);
        Z3 = Fp2.add(Z3, Z3);
        X3 = Fp2.mul(a, Z3);
        Y3 = Fp2.mul(b3, t2);
        Y3 = Fp2.add(X3, Y3);
        X3 = Fp2.sub(t1, Y3);
        Y3 = Fp2.add(t1, Y3);
        Y3 = Fp2.mul(X3, Y3);
        X3 = Fp2.mul(t3, X3);
        Z3 = Fp2.mul(b3, Z3);
        t2 = Fp2.mul(a, t2);
        t3 = Fp2.sub(t0, t2);
        t3 = Fp2.mul(a, t3);
        t3 = Fp2.add(t3, Z3);
        Z3 = Fp2.add(t0, t0);
        t0 = Fp2.add(Z3, t0);
        t0 = Fp2.add(t0, t2);
        t0 = Fp2.mul(t0, t3);
        Y3 = Fp2.add(Y3, t0);
        t2 = Fp2.mul(Y1, Z1);
        t2 = Fp2.add(t2, t2);
        t0 = Fp2.mul(t2, t3);
        X3 = Fp2.sub(X3, t0);
        Z3 = Fp2.mul(t2, t1);
        Z3 = Fp2.add(Z3, Z3);
        Z3 = Fp2.add(Z3, Z3);
        return new Point(X3, Y3, Z3);
      }
      // Renes-Costello-Batina exception-free addition formula.
      // There is 30% faster Jacobian formula, but it is not complete.
      // https://eprint.iacr.org/2015/1060, algorithm 1
      // Cost: 12M + 0S + 3*a + 3*b3 + 23add.
      add(other) {
        aprjpoint(other);
        const { X: X1, Y: Y1, Z: Z1 } = this;
        const { X: X2, Y: Y2, Z: Z2 } = other;
        let X3 = Fp2.ZERO, Y3 = Fp2.ZERO, Z3 = Fp2.ZERO;
        const a = CURVE.a;
        const b3 = Fp2.mul(CURVE.b, _3n3);
        let t0 = Fp2.mul(X1, X2);
        let t1 = Fp2.mul(Y1, Y2);
        let t2 = Fp2.mul(Z1, Z2);
        let t3 = Fp2.add(X1, Y1);
        let t4 = Fp2.add(X2, Y2);
        t3 = Fp2.mul(t3, t4);
        t4 = Fp2.add(t0, t1);
        t3 = Fp2.sub(t3, t4);
        t4 = Fp2.add(X1, Z1);
        let t5 = Fp2.add(X2, Z2);
        t4 = Fp2.mul(t4, t5);
        t5 = Fp2.add(t0, t2);
        t4 = Fp2.sub(t4, t5);
        t5 = Fp2.add(Y1, Z1);
        X3 = Fp2.add(Y2, Z2);
        t5 = Fp2.mul(t5, X3);
        X3 = Fp2.add(t1, t2);
        t5 = Fp2.sub(t5, X3);
        Z3 = Fp2.mul(a, t4);
        X3 = Fp2.mul(b3, t2);
        Z3 = Fp2.add(X3, Z3);
        X3 = Fp2.sub(t1, Z3);
        Z3 = Fp2.add(t1, Z3);
        Y3 = Fp2.mul(X3, Z3);
        t1 = Fp2.add(t0, t0);
        t1 = Fp2.add(t1, t0);
        t2 = Fp2.mul(a, t2);
        t4 = Fp2.mul(b3, t4);
        t1 = Fp2.add(t1, t2);
        t2 = Fp2.sub(t0, t2);
        t2 = Fp2.mul(a, t2);
        t4 = Fp2.add(t4, t2);
        t0 = Fp2.mul(t1, t4);
        Y3 = Fp2.add(Y3, t0);
        t0 = Fp2.mul(t5, t4);
        X3 = Fp2.mul(t3, X3);
        X3 = Fp2.sub(X3, t0);
        t0 = Fp2.mul(t3, t1);
        Z3 = Fp2.mul(t5, Z3);
        Z3 = Fp2.add(Z3, t0);
        return new Point(X3, Y3, Z3);
      }
      subtract(other) {
        return this.add(other.negate());
      }
      is0() {
        return this.equals(Point.ZERO);
      }
      /**
       * Constant time multiplication.
       * Uses wNAF method. Windowed method may be 10% faster,
       * but takes 2x longer to generate and consumes 2x memory.
       * Uses precomputes when available.
       * Uses endomorphism for Koblitz curves.
       * @param scalar by which the point would be multiplied
       * @returns New point
       */
      multiply(scalar) {
        const { endo: endo2 } = extraOpts;
        if (!Fn2.isValidNot0(scalar))
          throw new Error("invalid scalar: out of range");
        let point, fake;
        const mul = (n) => wnaf.cached(this, n, (p) => normalizeZ(Point, p));
        if (endo2) {
          const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
          const { p: k1p, f: k1f } = mul(k1);
          const { p: k2p, f: k2f } = mul(k2);
          fake = k1f.add(k2f);
          point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
        } else {
          const { p, f: f2 } = mul(scalar);
          point = p;
          fake = f2;
        }
        return normalizeZ(Point, [point, fake])[0];
      }
      /**
       * Non-constant-time multiplication. Uses double-and-add algorithm.
       * It's faster, but should only be used when you don't care about
       * an exposed secret key e.g. sig verification, which works over *public* keys.
       */
      multiplyUnsafe(sc) {
        const { endo: endo2 } = extraOpts;
        const p = this;
        if (!Fn2.isValid(sc))
          throw new Error("invalid scalar: out of range");
        if (sc === _0n7 || p.is0())
          return Point.ZERO;
        if (sc === _1n7)
          return p;
        if (wnaf.hasCache(this))
          return this.multiply(sc);
        if (endo2) {
          const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
          const { p1, p2 } = mulEndoUnsafe(Point, p, k1, k2);
          return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
        } else {
          return wnaf.unsafe(p, sc);
        }
      }
      multiplyAndAddUnsafe(Q, a, b) {
        const sum = this.multiplyUnsafe(a).add(Q.multiplyUnsafe(b));
        return sum.is0() ? void 0 : sum;
      }
      /**
       * Converts Projective point to affine (x, y) coordinates.
       * @param invertedZ Z^-1 (inverted zero) - optional, precomputation is useful for invertBatch
       */
      toAffine(invertedZ) {
        return toAffineMemo(this, invertedZ);
      }
      /**
       * Checks whether Point is free of torsion elements (is in prime subgroup).
       * Always torsion-free for cofactor=1 curves.
       */
      isTorsionFree() {
        const { isTorsionFree } = extraOpts;
        if (cofactor === _1n7)
          return true;
        if (isTorsionFree)
          return isTorsionFree(Point, this);
        return wnaf.unsafe(this, CURVE_ORDER).is0();
      }
      clearCofactor() {
        const { clearCofactor } = extraOpts;
        if (cofactor === _1n7)
          return this;
        if (clearCofactor)
          return clearCofactor(Point, this);
        return this.multiplyUnsafe(cofactor);
      }
      isSmallOrder() {
        return this.multiplyUnsafe(cofactor).is0();
      }
      toBytes(isCompressed = true) {
        _abool2(isCompressed, "isCompressed");
        this.assertValidity();
        return encodePoint(Point, this, isCompressed);
      }
      toHex(isCompressed = true) {
        return bytesToHex(this.toBytes(isCompressed));
      }
      toString() {
        return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
      }
      // TODO: remove
      get px() {
        return this.X;
      }
      get py() {
        return this.X;
      }
      get pz() {
        return this.Z;
      }
      toRawBytes(isCompressed = true) {
        return this.toBytes(isCompressed);
      }
      _setWindowSize(windowSize) {
        this.precompute(windowSize);
      }
      static normalizeZ(points) {
        return normalizeZ(Point, points);
      }
      static msm(points, scalars) {
        return pippenger(Point, Fn2, points, scalars);
      }
      static fromPrivateKey(privateKey) {
        return Point.BASE.multiply(_normFnElement(Fn2, privateKey));
      }
    }
    Point.BASE = new Point(CURVE.Gx, CURVE.Gy, Fp2.ONE);
    Point.ZERO = new Point(Fp2.ZERO, Fp2.ONE, Fp2.ZERO);
    Point.Fp = Fp2;
    Point.Fn = Fn2;
    const bits = Fn2.BITS;
    const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
    Point.BASE.precompute(8);
    return Point;
  }
  function pprefix(hasEvenY) {
    return Uint8Array.of(hasEvenY ? 2 : 3);
  }
  function getWLengths(Fp2, Fn2) {
    return {
      secretKey: Fn2.BYTES,
      publicKey: 1 + Fp2.BYTES,
      publicKeyUncompressed: 1 + 2 * Fp2.BYTES,
      publicKeyHasPrefix: true,
      signature: 2 * Fn2.BYTES
    };
  }
  function ecdh(Point, ecdhOpts = {}) {
    const { Fn: Fn2 } = Point;
    const randomBytes_ = ecdhOpts.randomBytes || randomBytes;
    const lengths = Object.assign(getWLengths(Point.Fp, Fn2), { seed: getMinHashLength(Fn2.ORDER) });
    function isValidSecretKey(secretKey) {
      try {
        return !!_normFnElement(Fn2, secretKey);
      } catch (error) {
        return false;
      }
    }
    function isValidPublicKey(publicKey3, isCompressed) {
      const { publicKey: comp, publicKeyUncompressed } = lengths;
      try {
        const l = publicKey3.length;
        if (isCompressed === true && l !== comp)
          return false;
        if (isCompressed === false && l !== publicKeyUncompressed)
          return false;
        return !!Point.fromBytes(publicKey3);
      } catch (error) {
        return false;
      }
    }
    function randomSecretKey(seed = randomBytes_(lengths.seed)) {
      return mapHashToField(_abytes2(seed, lengths.seed, "seed"), Fn2.ORDER);
    }
    function getPublicKey2(secretKey, isCompressed = true) {
      return Point.BASE.multiply(_normFnElement(Fn2, secretKey)).toBytes(isCompressed);
    }
    function keygen(seed) {
      const secretKey = randomSecretKey(seed);
      return { secretKey, publicKey: getPublicKey2(secretKey) };
    }
    function isProbPub(item) {
      if (typeof item === "bigint")
        return false;
      if (item instanceof Point)
        return true;
      const { secretKey, publicKey: publicKey3, publicKeyUncompressed } = lengths;
      if (Fn2.allowedLengths || secretKey === publicKey3)
        return void 0;
      const l = ensureBytes("key", item).length;
      return l === publicKey3 || l === publicKeyUncompressed;
    }
    function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
      if (isProbPub(secretKeyA) === true)
        throw new Error("first arg must be private key");
      if (isProbPub(publicKeyB) === false)
        throw new Error("second arg must be public key");
      const s = _normFnElement(Fn2, secretKeyA);
      const b = Point.fromHex(publicKeyB);
      return b.multiply(s).toBytes(isCompressed);
    }
    const utils = {
      isValidSecretKey,
      isValidPublicKey,
      randomSecretKey,
      // TODO: remove
      isValidPrivateKey: isValidSecretKey,
      randomPrivateKey: randomSecretKey,
      normPrivateKeyToScalar: (key) => _normFnElement(Fn2, key),
      precompute(windowSize = 8, point = Point.BASE) {
        return point.precompute(windowSize, false);
      }
    };
    return Object.freeze({ getPublicKey: getPublicKey2, getSharedSecret, keygen, Point, utils, lengths });
  }
  function ecdsa(Point, hash, ecdsaOpts = {}) {
    ahash(hash);
    _validateObject(ecdsaOpts, {}, {
      hmac: "function",
      lowS: "boolean",
      randomBytes: "function",
      bits2int: "function",
      bits2int_modN: "function"
    });
    const randomBytes2 = ecdsaOpts.randomBytes || randomBytes;
    const hmac2 = ecdsaOpts.hmac || ((key, ...msgs) => hmac(hash, key, concatBytes(...msgs)));
    const { Fp: Fp2, Fn: Fn2 } = Point;
    const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn2;
    const { keygen, getPublicKey: getPublicKey2, getSharedSecret, utils, lengths } = ecdh(Point, ecdsaOpts);
    const defaultSigOpts = {
      prehash: false,
      lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : false,
      format: void 0,
      //'compact' as ECDSASigFormat,
      extraEntropy: false
    };
    const defaultSigOpts_format = "compact";
    function isBiggerThanHalfOrder(number2) {
      const HALF = CURVE_ORDER >> _1n7;
      return number2 > HALF;
    }
    function validateRS(title, num) {
      if (!Fn2.isValidNot0(num))
        throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
      return num;
    }
    function validateSigLength(bytes, format) {
      validateSigFormat(format);
      const size = lengths.signature;
      const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : void 0;
      return _abytes2(bytes, sizer, `${format} signature`);
    }
    class Signature {
      constructor(r, s, recovery) {
        this.r = validateRS("r", r);
        this.s = validateRS("s", s);
        if (recovery != null)
          this.recovery = recovery;
        Object.freeze(this);
      }
      static fromBytes(bytes, format = defaultSigOpts_format) {
        validateSigLength(bytes, format);
        let recid;
        if (format === "der") {
          const { r: r2, s: s2 } = DER.toSig(_abytes2(bytes));
          return new Signature(r2, s2);
        }
        if (format === "recovered") {
          recid = bytes[0];
          format = "compact";
          bytes = bytes.subarray(1);
        }
        const L = Fn2.BYTES;
        const r = bytes.subarray(0, L);
        const s = bytes.subarray(L, L * 2);
        return new Signature(Fn2.fromBytes(r), Fn2.fromBytes(s), recid);
      }
      static fromHex(hex, format) {
        return this.fromBytes(hexToBytes(hex), format);
      }
      addRecoveryBit(recovery) {
        return new Signature(this.r, this.s, recovery);
      }
      recoverPublicKey(messageHash) {
        const FIELD_ORDER = Fp2.ORDER;
        const { r, s, recovery: rec } = this;
        if (rec == null || ![0, 1, 2, 3].includes(rec))
          throw new Error("recovery id invalid");
        const hasCofactor = CURVE_ORDER * _2n5 < FIELD_ORDER;
        if (hasCofactor && rec > 1)
          throw new Error("recovery id is ambiguous for h>1 curve");
        const radj = rec === 2 || rec === 3 ? r + CURVE_ORDER : r;
        if (!Fp2.isValid(radj))
          throw new Error("recovery id 2 or 3 invalid");
        const x = Fp2.toBytes(radj);
        const R = Point.fromBytes(concatBytes(pprefix((rec & 1) === 0), x));
        const ir = Fn2.inv(radj);
        const h = bits2int_modN(ensureBytes("msgHash", messageHash));
        const u1 = Fn2.create(-h * ir);
        const u2 = Fn2.create(s * ir);
        const Q = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
        if (Q.is0())
          throw new Error("point at infinify");
        Q.assertValidity();
        return Q;
      }
      // Signatures should be low-s, to prevent malleability.
      hasHighS() {
        return isBiggerThanHalfOrder(this.s);
      }
      toBytes(format = defaultSigOpts_format) {
        validateSigFormat(format);
        if (format === "der")
          return hexToBytes(DER.hexFromSig(this));
        const r = Fn2.toBytes(this.r);
        const s = Fn2.toBytes(this.s);
        if (format === "recovered") {
          if (this.recovery == null)
            throw new Error("recovery bit must be present");
          return concatBytes(Uint8Array.of(this.recovery), r, s);
        }
        return concatBytes(r, s);
      }
      toHex(format) {
        return bytesToHex(this.toBytes(format));
      }
      // TODO: remove
      assertValidity() {
      }
      static fromCompact(hex) {
        return Signature.fromBytes(ensureBytes("sig", hex), "compact");
      }
      static fromDER(hex) {
        return Signature.fromBytes(ensureBytes("sig", hex), "der");
      }
      normalizeS() {
        return this.hasHighS() ? new Signature(this.r, Fn2.neg(this.s), this.recovery) : this;
      }
      toDERRawBytes() {
        return this.toBytes("der");
      }
      toDERHex() {
        return bytesToHex(this.toBytes("der"));
      }
      toCompactRawBytes() {
        return this.toBytes("compact");
      }
      toCompactHex() {
        return bytesToHex(this.toBytes("compact"));
      }
    }
    const bits2int = ecdsaOpts.bits2int || function bits2int_def(bytes) {
      if (bytes.length > 8192)
        throw new Error("input is too large");
      const num = bytesToNumberBE(bytes);
      const delta = bytes.length * 8 - fnBits;
      return delta > 0 ? num >> BigInt(delta) : num;
    };
    const bits2int_modN = ecdsaOpts.bits2int_modN || function bits2int_modN_def(bytes) {
      return Fn2.create(bits2int(bytes));
    };
    const ORDER_MASK = bitMask(fnBits);
    function int2octets(num) {
      aInRange("num < 2^" + fnBits, num, _0n7, ORDER_MASK);
      return Fn2.toBytes(num);
    }
    function validateMsgAndHash(message, prehash) {
      _abytes2(message, void 0, "message");
      return prehash ? _abytes2(hash(message), void 0, "prehashed message") : message;
    }
    function prepSig(message, privateKey, opts) {
      if (["recovered", "canonical"].some((k) => k in opts))
        throw new Error("sign() legacy options not supported");
      const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
      message = validateMsgAndHash(message, prehash);
      const h1int = bits2int_modN(message);
      const d = _normFnElement(Fn2, privateKey);
      const seedArgs = [int2octets(d), int2octets(h1int)];
      if (extraEntropy != null && extraEntropy !== false) {
        const e = extraEntropy === true ? randomBytes2(lengths.secretKey) : extraEntropy;
        seedArgs.push(ensureBytes("extraEntropy", e));
      }
      const seed = concatBytes(...seedArgs);
      const m = h1int;
      function k2sig(kBytes) {
        const k = bits2int(kBytes);
        if (!Fn2.isValidNot0(k))
          return;
        const ik = Fn2.inv(k);
        const q = Point.BASE.multiply(k).toAffine();
        const r = Fn2.create(q.x);
        if (r === _0n7)
          return;
        const s = Fn2.create(ik * Fn2.create(m + r * d));
        if (s === _0n7)
          return;
        let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n7);
        let normS = s;
        if (lowS && isBiggerThanHalfOrder(s)) {
          normS = Fn2.neg(s);
          recovery ^= 1;
        }
        return new Signature(r, normS, recovery);
      }
      return { seed, k2sig };
    }
    function sign2(message, secretKey, opts = {}) {
      message = ensureBytes("message", message);
      const { seed, k2sig } = prepSig(message, secretKey, opts);
      const drbg = createHmacDrbg(hash.outputLen, Fn2.BYTES, hmac2);
      const sig = drbg(seed, k2sig);
      return sig;
    }
    function tryParsingSig(sg) {
      let sig = void 0;
      const isHex = typeof sg === "string" || isBytes(sg);
      const isObj = !isHex && sg !== null && typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint";
      if (!isHex && !isObj)
        throw new Error("invalid signature, expected Uint8Array, hex string or Signature instance");
      if (isObj) {
        sig = new Signature(sg.r, sg.s);
      } else if (isHex) {
        try {
          sig = Signature.fromBytes(ensureBytes("sig", sg), "der");
        } catch (derError) {
          if (!(derError instanceof DER.Err))
            throw derError;
        }
        if (!sig) {
          try {
            sig = Signature.fromBytes(ensureBytes("sig", sg), "compact");
          } catch (error) {
            return false;
          }
        }
      }
      if (!sig)
        return false;
      return sig;
    }
    function verify2(signature2, message, publicKey3, opts = {}) {
      const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
      publicKey3 = ensureBytes("publicKey", publicKey3);
      message = validateMsgAndHash(ensureBytes("message", message), prehash);
      if ("strict" in opts)
        throw new Error("options.strict was renamed to lowS");
      const sig = format === void 0 ? tryParsingSig(signature2) : Signature.fromBytes(ensureBytes("sig", signature2), format);
      if (sig === false)
        return false;
      try {
        const P = Point.fromBytes(publicKey3);
        if (lowS && sig.hasHighS())
          return false;
        const { r, s } = sig;
        const h = bits2int_modN(message);
        const is2 = Fn2.inv(s);
        const u1 = Fn2.create(h * is2);
        const u2 = Fn2.create(r * is2);
        const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
        if (R.is0())
          return false;
        const v = Fn2.create(R.x);
        return v === r;
      } catch (e) {
        return false;
      }
    }
    function recoverPublicKey(signature2, message, opts = {}) {
      const { prehash } = validateSigOpts(opts, defaultSigOpts);
      message = validateMsgAndHash(message, prehash);
      return Signature.fromBytes(signature2, "recovered").recoverPublicKey(message).toBytes();
    }
    return Object.freeze({
      keygen,
      getPublicKey: getPublicKey2,
      getSharedSecret,
      utils,
      lengths,
      Point,
      sign: sign2,
      verify: verify2,
      recoverPublicKey,
      Signature,
      hash
    });
  }
  function _weierstrass_legacy_opts_to_new(c) {
    const CURVE = {
      a: c.a,
      b: c.b,
      p: c.Fp.ORDER,
      n: c.n,
      h: c.h,
      Gx: c.Gx,
      Gy: c.Gy
    };
    const Fp2 = c.Fp;
    let allowedLengths = c.allowedPrivateKeyLengths ? Array.from(new Set(c.allowedPrivateKeyLengths.map((l) => Math.ceil(l / 2)))) : void 0;
    const Fn2 = Field(CURVE.n, {
      BITS: c.nBitLength,
      allowedLengths,
      modFromBytes: c.wrapPrivateKey
    });
    const curveOpts = {
      Fp: Fp2,
      Fn: Fn2,
      allowInfinityPoint: c.allowInfinityPoint,
      endo: c.endo,
      isTorsionFree: c.isTorsionFree,
      clearCofactor: c.clearCofactor,
      fromBytes: c.fromBytes,
      toBytes: c.toBytes
    };
    return { CURVE, curveOpts };
  }
  function _ecdsa_legacy_opts_to_new(c) {
    const { CURVE, curveOpts } = _weierstrass_legacy_opts_to_new(c);
    const ecdsaOpts = {
      hmac: c.hmac,
      randomBytes: c.randomBytes,
      lowS: c.lowS,
      bits2int: c.bits2int,
      bits2int_modN: c.bits2int_modN
    };
    return { CURVE, curveOpts, hash: c.hash, ecdsaOpts };
  }
  function _ecdsa_new_output_to_legacy(c, _ecdsa) {
    const Point = _ecdsa.Point;
    return Object.assign({}, _ecdsa, {
      ProjectivePoint: Point,
      CURVE: Object.assign({}, c, nLength(Point.Fn.ORDER, Point.Fn.BITS))
    });
  }
  function weierstrass(c) {
    const { CURVE, curveOpts, hash, ecdsaOpts } = _ecdsa_legacy_opts_to_new(c);
    const Point = weierstrassN(CURVE, curveOpts);
    const signs = ecdsa(Point, hash, ecdsaOpts);
    return _ecdsa_new_output_to_legacy(c, signs);
  }

  // node_modules/@noble/curves/esm/_shortw_utils.js
  function createCurve(curveDef, defHash) {
    const create2 = (hash) => weierstrass({ ...curveDef, hash });
    return { ...create2(defHash), create: create2 };
  }

  // node_modules/@noble/curves/esm/secp256k1.js
  var secp256k1_CURVE = {
    p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
    n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
    h: BigInt(1),
    a: BigInt(0),
    b: BigInt(7),
    Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
    Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
  };
  var secp256k1_ENDO = {
    beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
    basises: [
      [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
      [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
    ]
  };
  var _2n6 = /* @__PURE__ */ BigInt(2);
  function sqrtMod(y) {
    const P = secp256k1_CURVE.p;
    const _3n4 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
    const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
    const b2 = y * y * y % P;
    const b3 = b2 * b2 * y % P;
    const b6 = pow2(b3, _3n4, P) * b3 % P;
    const b9 = pow2(b6, _3n4, P) * b3 % P;
    const b11 = pow2(b9, _2n6, P) * b2 % P;
    const b22 = pow2(b11, _11n, P) * b11 % P;
    const b44 = pow2(b22, _22n, P) * b22 % P;
    const b88 = pow2(b44, _44n, P) * b44 % P;
    const b176 = pow2(b88, _88n, P) * b88 % P;
    const b220 = pow2(b176, _44n, P) * b44 % P;
    const b223 = pow2(b220, _3n4, P) * b3 % P;
    const t1 = pow2(b223, _23n, P) * b22 % P;
    const t2 = pow2(t1, _6n, P) * b2 % P;
    const root = pow2(t2, _2n6, P);
    if (!Fpk1.eql(Fpk1.sqr(root), y))
      throw new Error("Cannot find square root");
    return root;
  }
  var Fpk1 = Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
  var secp256k1 = createCurve({ ...secp256k1_CURVE, Fp: Fpk1, lowS: true, endo: secp256k1_ENDO }, sha256);

  // node_modules/@solana/web3.js/lib/index.browser.esm.js
  var generatePrivateKey = ed25519.utils.randomPrivateKey;
  var generateKeypair = () => {
    const privateScalar = ed25519.utils.randomPrivateKey();
    const publicKey3 = getPublicKey(privateScalar);
    const secretKey = new Uint8Array(64);
    secretKey.set(privateScalar);
    secretKey.set(publicKey3, 32);
    return {
      publicKey: publicKey3,
      secretKey
    };
  };
  var getPublicKey = ed25519.getPublicKey;
  function isOnCurve(publicKey3) {
    try {
      ed25519.ExtendedPoint.fromHex(publicKey3);
      return true;
    } catch {
      return false;
    }
  }
  var sign = (message, secretKey) => ed25519.sign(message, secretKey.slice(0, 32));
  var verify = ed25519.verify;
  var toBuffer = (arr) => {
    if (import_buffer3.Buffer.isBuffer(arr)) {
      return arr;
    } else if (arr instanceof Uint8Array) {
      return import_buffer3.Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    } else {
      return import_buffer3.Buffer.from(arr);
    }
  };
  var Struct2 = class {
    constructor(properties) {
      Object.assign(this, properties);
    }
    encode() {
      return import_buffer3.Buffer.from((0, import_borsh.serialize)(SOLANA_SCHEMA, this));
    }
    static decode(data) {
      return (0, import_borsh.deserialize)(SOLANA_SCHEMA, this, data);
    }
    static decodeUnchecked(data) {
      return (0, import_borsh.deserializeUnchecked)(SOLANA_SCHEMA, this, data);
    }
  };
  var SOLANA_SCHEMA = /* @__PURE__ */ new Map();
  var _PublicKey;
  var MAX_SEED_LENGTH = 32;
  var PUBLIC_KEY_LENGTH = 32;
  function isPublicKeyData(value) {
    return value._bn !== void 0;
  }
  var uniquePublicKeyCounter = 1;
  var PublicKey = class _PublicKey2 extends Struct2 {
    /**
     * Create a new PublicKey object
     * @param value ed25519 public key as buffer or base-58 encoded string
     */
    constructor(value) {
      super({});
      this._bn = void 0;
      if (isPublicKeyData(value)) {
        this._bn = value._bn;
      } else {
        if (typeof value === "string") {
          const decoded = import_bs58.default.decode(value);
          if (decoded.length != PUBLIC_KEY_LENGTH) {
            throw new Error(`Invalid public key input`);
          }
          this._bn = new import_bn.default(decoded);
        } else {
          this._bn = new import_bn.default(value);
        }
        if (this._bn.byteLength() > PUBLIC_KEY_LENGTH) {
          throw new Error(`Invalid public key input`);
        }
      }
    }
    /**
     * Returns a unique PublicKey for tests and benchmarks using a counter
     */
    static unique() {
      const key = new _PublicKey2(uniquePublicKeyCounter);
      uniquePublicKeyCounter += 1;
      return new _PublicKey2(key.toBuffer());
    }
    /**
     * Default public key value. The base58-encoded string representation is all ones (as seen below)
     * The underlying BN number is 32 bytes that are all zeros
     */
    /**
     * Checks if two publicKeys are equal
     */
    equals(publicKey3) {
      return this._bn.eq(publicKey3._bn);
    }
    /**
     * Return the base-58 representation of the public key
     */
    toBase58() {
      return import_bs58.default.encode(this.toBytes());
    }
    toJSON() {
      return this.toBase58();
    }
    /**
     * Return the byte array representation of the public key in big endian
     */
    toBytes() {
      const buf = this.toBuffer();
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    /**
     * Return the Buffer representation of the public key in big endian
     */
    toBuffer() {
      const b = this._bn.toArrayLike(import_buffer3.Buffer);
      if (b.length === PUBLIC_KEY_LENGTH) {
        return b;
      }
      const zeroPad = import_buffer3.Buffer.alloc(32);
      b.copy(zeroPad, 32 - b.length);
      return zeroPad;
    }
    get [Symbol.toStringTag]() {
      return `PublicKey(${this.toString()})`;
    }
    /**
     * Return the base-58 representation of the public key
     */
    toString() {
      return this.toBase58();
    }
    /**
     * Derive a public key from another key, a seed, and a program ID.
     * The program ID will also serve as the owner of the public key, giving
     * it permission to write data to the account.
     */
    /* eslint-disable require-await */
    static async createWithSeed(fromPublicKey, seed, programId) {
      const buffer = import_buffer3.Buffer.concat([fromPublicKey.toBuffer(), import_buffer3.Buffer.from(seed), programId.toBuffer()]);
      const publicKeyBytes = sha2562(buffer);
      return new _PublicKey2(publicKeyBytes);
    }
    /**
     * Derive a program address from seeds and a program ID.
     */
    /* eslint-disable require-await */
    static createProgramAddressSync(seeds, programId) {
      let buffer = import_buffer3.Buffer.alloc(0);
      seeds.forEach(function(seed) {
        if (seed.length > MAX_SEED_LENGTH) {
          throw new TypeError(`Max seed length exceeded`);
        }
        buffer = import_buffer3.Buffer.concat([buffer, toBuffer(seed)]);
      });
      buffer = import_buffer3.Buffer.concat([buffer, programId.toBuffer(), import_buffer3.Buffer.from("ProgramDerivedAddress")]);
      const publicKeyBytes = sha2562(buffer);
      if (isOnCurve(publicKeyBytes)) {
        throw new Error(`Invalid seeds, address must fall off the curve`);
      }
      return new _PublicKey2(publicKeyBytes);
    }
    /**
     * Async version of createProgramAddressSync
     * For backwards compatibility
     *
     * @deprecated Use {@link createProgramAddressSync} instead
     */
    /* eslint-disable require-await */
    static async createProgramAddress(seeds, programId) {
      return this.createProgramAddressSync(seeds, programId);
    }
    /**
     * Find a valid program address
     *
     * Valid program addresses must fall off the ed25519 curve.  This function
     * iterates a nonce until it finds one that when combined with the seeds
     * results in a valid program address.
     */
    static findProgramAddressSync(seeds, programId) {
      let nonce = 255;
      let address;
      while (nonce != 0) {
        try {
          const seedsWithNonce = seeds.concat(import_buffer3.Buffer.from([nonce]));
          address = this.createProgramAddressSync(seedsWithNonce, programId);
        } catch (err) {
          if (err instanceof TypeError) {
            throw err;
          }
          nonce--;
          continue;
        }
        return [address, nonce];
      }
      throw new Error(`Unable to find a viable program address nonce`);
    }
    /**
     * Async version of findProgramAddressSync
     * For backwards compatibility
     *
     * @deprecated Use {@link findProgramAddressSync} instead
     */
    static async findProgramAddress(seeds, programId) {
      return this.findProgramAddressSync(seeds, programId);
    }
    /**
     * Check that a pubkey is on the ed25519 curve.
     */
    static isOnCurve(pubkeyData) {
      const pubkey = new _PublicKey2(pubkeyData);
      return isOnCurve(pubkey.toBytes());
    }
  };
  _PublicKey = PublicKey;
  PublicKey.default = new _PublicKey("11111111111111111111111111111111");
  SOLANA_SCHEMA.set(PublicKey, {
    kind: "struct",
    fields: [["_bn", "u256"]]
  });
  var BPF_LOADER_DEPRECATED_PROGRAM_ID = new PublicKey("BPFLoader1111111111111111111111111111111111");
  var PACKET_DATA_SIZE = 1280 - 40 - 8;
  var VERSION_PREFIX_MASK = 127;
  var SIGNATURE_LENGTH_IN_BYTES = 64;
  var VERSION_1_MESSAGE_PREFIX = 129;
  var TransactionExpiredBlockheightExceededError = class extends Error {
    constructor(signature2) {
      super(`Signature ${signature2} has expired: block height exceeded.`);
      this.signature = void 0;
      this.signature = signature2;
    }
  };
  Object.defineProperty(TransactionExpiredBlockheightExceededError.prototype, "name", {
    value: "TransactionExpiredBlockheightExceededError"
  });
  var TransactionExpiredTimeoutError = class extends Error {
    constructor(signature2, timeoutSeconds) {
      super(`Transaction was not confirmed in ${timeoutSeconds.toFixed(2)} seconds. It is unknown if it succeeded or failed. Check signature ${signature2} using the Solana Explorer or CLI tools.`);
      this.signature = void 0;
      this.signature = signature2;
    }
  };
  Object.defineProperty(TransactionExpiredTimeoutError.prototype, "name", {
    value: "TransactionExpiredTimeoutError"
  });
  var TransactionExpiredNonceInvalidError = class extends Error {
    constructor(signature2) {
      super(`Signature ${signature2} has expired: the nonce is no longer valid.`);
      this.signature = void 0;
      this.signature = signature2;
    }
  };
  Object.defineProperty(TransactionExpiredNonceInvalidError.prototype, "name", {
    value: "TransactionExpiredNonceInvalidError"
  });
  var MessageAccountKeys = class {
    constructor(staticAccountKeys, accountKeysFromLookups) {
      this.staticAccountKeys = void 0;
      this.accountKeysFromLookups = void 0;
      this.staticAccountKeys = staticAccountKeys;
      this.accountKeysFromLookups = accountKeysFromLookups;
    }
    keySegments() {
      const keySegments = [this.staticAccountKeys];
      if (this.accountKeysFromLookups) {
        keySegments.push(this.accountKeysFromLookups.writable);
        keySegments.push(this.accountKeysFromLookups.readonly);
      }
      return keySegments;
    }
    get(index) {
      for (const keySegment of this.keySegments()) {
        if (index < keySegment.length) {
          return keySegment[index];
        } else {
          index -= keySegment.length;
        }
      }
      return;
    }
    get length() {
      return this.keySegments().flat().length;
    }
    compileInstructions(instructions) {
      const U8_MAX = 255;
      if (this.length > U8_MAX + 1) {
        throw new Error("Account index overflow encountered during compilation");
      }
      const keyIndexMap = /* @__PURE__ */ new Map();
      this.keySegments().flat().forEach((key, index) => {
        keyIndexMap.set(key.toBase58(), index);
      });
      const findKeyIndex = (key) => {
        const keyIndex = keyIndexMap.get(key.toBase58());
        if (keyIndex === void 0) throw new Error("Encountered an unknown instruction account key during compilation");
        return keyIndex;
      };
      return instructions.map((instruction) => {
        return {
          programIdIndex: findKeyIndex(instruction.programId),
          accountKeyIndexes: instruction.keys.map((meta) => findKeyIndex(meta.pubkey)),
          data: instruction.data
        };
      });
    }
  };
  var publicKey = (property = "publicKey") => {
    return BufferLayout.blob(32, property);
  };
  var signature = (property = "signature") => {
    return BufferLayout.blob(64, property);
  };
  var rustString = (property = "string") => {
    const rsl = BufferLayout.struct([BufferLayout.u32("length"), BufferLayout.u32("lengthPadding"), BufferLayout.blob(BufferLayout.offset(BufferLayout.u32(), -8), "chars")], property);
    const _decode = rsl.decode.bind(rsl);
    const _encode = rsl.encode.bind(rsl);
    const rslShim = rsl;
    rslShim.decode = (b, offset2) => {
      const data = _decode(b, offset2);
      return data["chars"].toString();
    };
    rslShim.encode = (str, b, offset2) => {
      const data = {
        chars: import_buffer3.Buffer.from(str, "utf8")
      };
      return _encode(data, b, offset2);
    };
    rslShim.alloc = (str) => {
      return BufferLayout.u32().span + BufferLayout.u32().span + import_buffer3.Buffer.from(str, "utf8").length;
    };
    return rslShim;
  };
  var authorized = (property = "authorized") => {
    return BufferLayout.struct([publicKey("staker"), publicKey("withdrawer")], property);
  };
  var lockup = (property = "lockup") => {
    return BufferLayout.struct([BufferLayout.ns64("unixTimestamp"), BufferLayout.ns64("epoch"), publicKey("custodian")], property);
  };
  var voteInit = (property = "voteInit") => {
    return BufferLayout.struct([publicKey("nodePubkey"), publicKey("authorizedVoter"), publicKey("authorizedWithdrawer"), BufferLayout.u8("commission")], property);
  };
  var voteAuthorizeWithSeedArgs = (property = "voteAuthorizeWithSeedArgs") => {
    return BufferLayout.struct([BufferLayout.u32("voteAuthorizationType"), publicKey("currentAuthorityDerivedKeyOwnerPubkey"), rustString("currentAuthorityDerivedKeySeed"), publicKey("newAuthorized")], property);
  };
  function getAlloc(type2, fields) {
    const getItemAlloc = (item) => {
      if (item.span >= 0) {
        return item.span;
      } else if (typeof item.alloc === "function") {
        return item.alloc(fields[item.property]);
      } else if ("count" in item && "elementLayout" in item) {
        const field = fields[item.property];
        if (Array.isArray(field)) {
          return field.length * getItemAlloc(item.elementLayout);
        }
      } else if ("fields" in item) {
        return getAlloc({
          layout: item
        }, fields[item.property]);
      }
      return 0;
    };
    let alloc = 0;
    type2.layout.fields.forEach((item) => {
      alloc += getItemAlloc(item);
    });
    return alloc;
  }
  function decodeLength(bytes) {
    let len = 0;
    let size = 0;
    for (; ; ) {
      let elem = bytes.shift();
      len |= (elem & 127) << size * 7;
      size += 1;
      if ((elem & 128) === 0) {
        break;
      }
    }
    return len;
  }
  function encodeLength(bytes, len) {
    let rem_len = len;
    for (; ; ) {
      let elem = rem_len & 127;
      rem_len >>= 7;
      if (rem_len == 0) {
        bytes.push(elem);
        break;
      } else {
        elem |= 128;
        bytes.push(elem);
      }
    }
  }
  function assert2(condition, message) {
    if (!condition) {
      throw new Error(message || "Assertion failed");
    }
  }
  var CompiledKeys = class _CompiledKeys {
    constructor(payer, keyMetaMap) {
      this.payer = void 0;
      this.keyMetaMap = void 0;
      this.payer = payer;
      this.keyMetaMap = keyMetaMap;
    }
    static compile(instructions, payer) {
      const keyMetaMap = /* @__PURE__ */ new Map();
      const getOrInsertDefault = (pubkey) => {
        const address = pubkey.toBase58();
        let keyMeta = keyMetaMap.get(address);
        if (keyMeta === void 0) {
          keyMeta = {
            isSigner: false,
            isWritable: false,
            isInvoked: false
          };
          keyMetaMap.set(address, keyMeta);
        }
        return keyMeta;
      };
      const payerKeyMeta = getOrInsertDefault(payer);
      payerKeyMeta.isSigner = true;
      payerKeyMeta.isWritable = true;
      for (const ix of instructions) {
        getOrInsertDefault(ix.programId).isInvoked = true;
        for (const accountMeta of ix.keys) {
          const keyMeta = getOrInsertDefault(accountMeta.pubkey);
          keyMeta.isSigner || (keyMeta.isSigner = accountMeta.isSigner);
          keyMeta.isWritable || (keyMeta.isWritable = accountMeta.isWritable);
        }
      }
      return new _CompiledKeys(payer, keyMetaMap);
    }
    getMessageComponents() {
      const mapEntries = [...this.keyMetaMap.entries()];
      assert2(mapEntries.length <= 256, "Max static account keys length exceeded");
      const writableSigners = mapEntries.filter(([, meta]) => meta.isSigner && meta.isWritable);
      const readonlySigners = mapEntries.filter(([, meta]) => meta.isSigner && !meta.isWritable);
      const writableNonSigners = mapEntries.filter(([, meta]) => !meta.isSigner && meta.isWritable);
      const readonlyNonSigners = mapEntries.filter(([, meta]) => !meta.isSigner && !meta.isWritable);
      const header = {
        numRequiredSignatures: writableSigners.length + readonlySigners.length,
        numReadonlySignedAccounts: readonlySigners.length,
        numReadonlyUnsignedAccounts: readonlyNonSigners.length
      };
      {
        assert2(writableSigners.length > 0, "Expected at least one writable signer key");
        const [payerAddress] = writableSigners[0];
        assert2(payerAddress === this.payer.toBase58(), "Expected first writable signer key to be the fee payer");
      }
      const staticAccountKeys = [...writableSigners.map(([address]) => new PublicKey(address)), ...readonlySigners.map(([address]) => new PublicKey(address)), ...writableNonSigners.map(([address]) => new PublicKey(address)), ...readonlyNonSigners.map(([address]) => new PublicKey(address))];
      return [header, staticAccountKeys];
    }
    extractTableLookup(lookupTable) {
      const [writableIndexes, drainedWritableKeys] = this.drainKeysFoundInLookupTable(lookupTable.state.addresses, (keyMeta) => !keyMeta.isSigner && !keyMeta.isInvoked && keyMeta.isWritable);
      const [readonlyIndexes, drainedReadonlyKeys] = this.drainKeysFoundInLookupTable(lookupTable.state.addresses, (keyMeta) => !keyMeta.isSigner && !keyMeta.isInvoked && !keyMeta.isWritable);
      if (writableIndexes.length === 0 && readonlyIndexes.length === 0) {
        return;
      }
      return [{
        accountKey: lookupTable.key,
        writableIndexes,
        readonlyIndexes
      }, {
        writable: drainedWritableKeys,
        readonly: drainedReadonlyKeys
      }];
    }
    /** @internal */
    drainKeysFoundInLookupTable(lookupTableEntries, keyMetaFilter) {
      const lookupTableIndexes = new Array();
      const drainedKeys = new Array();
      for (const [address, keyMeta] of this.keyMetaMap.entries()) {
        if (keyMetaFilter(keyMeta)) {
          const key = new PublicKey(address);
          const lookupTableIndex = lookupTableEntries.findIndex((entry) => entry.equals(key));
          if (lookupTableIndex >= 0) {
            assert2(lookupTableIndex < 256, "Max lookup table index exceeded");
            lookupTableIndexes.push(lookupTableIndex);
            drainedKeys.push(key);
            this.keyMetaMap.delete(address);
          }
        }
      }
      return [lookupTableIndexes, drainedKeys];
    }
  };
  var END_OF_BUFFER_ERROR_MESSAGE = "Reached end of buffer unexpectedly";
  function guardedShift(byteArray) {
    if (byteArray.length === 0) {
      throw new Error(END_OF_BUFFER_ERROR_MESSAGE);
    }
    return byteArray.shift();
  }
  function guardedSplice(byteArray, ...args) {
    const [start] = args;
    if (args.length === 2 ? start + (args[1] ?? 0) > byteArray.length : start >= byteArray.length) {
      throw new Error(END_OF_BUFFER_ERROR_MESSAGE);
    }
    return byteArray.splice(...args);
  }
  var Message = class _Message {
    constructor(args) {
      this.header = void 0;
      this.accountKeys = void 0;
      this.recentBlockhash = void 0;
      this.instructions = void 0;
      this.indexToProgramIds = /* @__PURE__ */ new Map();
      this.header = args.header;
      this.accountKeys = args.accountKeys.map((account) => new PublicKey(account));
      this.recentBlockhash = args.recentBlockhash;
      this.instructions = args.instructions;
      this.instructions.forEach((ix) => this.indexToProgramIds.set(ix.programIdIndex, this.accountKeys[ix.programIdIndex]));
    }
    get version() {
      return "legacy";
    }
    get staticAccountKeys() {
      return this.accountKeys;
    }
    get compiledInstructions() {
      return this.instructions.map((ix) => ({
        programIdIndex: ix.programIdIndex,
        accountKeyIndexes: ix.accounts,
        data: import_bs58.default.decode(ix.data)
      }));
    }
    get addressTableLookups() {
      return [];
    }
    getAccountKeys() {
      return new MessageAccountKeys(this.staticAccountKeys);
    }
    static compile(args) {
      const compiledKeys = CompiledKeys.compile(args.instructions, args.payerKey);
      const [header, staticAccountKeys] = compiledKeys.getMessageComponents();
      const accountKeys = new MessageAccountKeys(staticAccountKeys);
      const instructions = accountKeys.compileInstructions(args.instructions).map((ix) => ({
        programIdIndex: ix.programIdIndex,
        accounts: ix.accountKeyIndexes,
        data: import_bs58.default.encode(ix.data)
      }));
      return new _Message({
        header,
        accountKeys: staticAccountKeys,
        recentBlockhash: args.recentBlockhash,
        instructions
      });
    }
    isAccountSigner(index) {
      return index < this.header.numRequiredSignatures;
    }
    isAccountWritable(index) {
      const numSignedAccounts = this.header.numRequiredSignatures;
      if (index >= this.header.numRequiredSignatures) {
        const unsignedAccountIndex = index - numSignedAccounts;
        const numUnsignedAccounts = this.accountKeys.length - numSignedAccounts;
        const numWritableUnsignedAccounts = numUnsignedAccounts - this.header.numReadonlyUnsignedAccounts;
        return unsignedAccountIndex < numWritableUnsignedAccounts;
      } else {
        const numWritableSignedAccounts = numSignedAccounts - this.header.numReadonlySignedAccounts;
        return index < numWritableSignedAccounts;
      }
    }
    isProgramId(index) {
      return this.indexToProgramIds.has(index);
    }
    programIds() {
      return [...this.indexToProgramIds.values()];
    }
    nonProgramIds() {
      return this.accountKeys.filter((_, index) => !this.isProgramId(index));
    }
    serialize() {
      const numKeys = this.accountKeys.length;
      let keyCount = [];
      encodeLength(keyCount, numKeys);
      const instructions = this.instructions.map((instruction) => {
        const {
          accounts,
          programIdIndex
        } = instruction;
        const data = Array.from(import_bs58.default.decode(instruction.data));
        let keyIndicesCount = [];
        encodeLength(keyIndicesCount, accounts.length);
        let dataCount = [];
        encodeLength(dataCount, data.length);
        return {
          programIdIndex,
          keyIndicesCount: import_buffer3.Buffer.from(keyIndicesCount),
          keyIndices: accounts,
          dataLength: import_buffer3.Buffer.from(dataCount),
          data
        };
      });
      let instructionCount = [];
      encodeLength(instructionCount, instructions.length);
      let instructionBuffer = import_buffer3.Buffer.alloc(PACKET_DATA_SIZE);
      import_buffer3.Buffer.from(instructionCount).copy(instructionBuffer);
      let instructionBufferLength = instructionCount.length;
      instructions.forEach((instruction) => {
        const instructionLayout = BufferLayout.struct([BufferLayout.u8("programIdIndex"), BufferLayout.blob(instruction.keyIndicesCount.length, "keyIndicesCount"), BufferLayout.seq(BufferLayout.u8("keyIndex"), instruction.keyIndices.length, "keyIndices"), BufferLayout.blob(instruction.dataLength.length, "dataLength"), BufferLayout.seq(BufferLayout.u8("userdatum"), instruction.data.length, "data")]);
        const length2 = instructionLayout.encode(instruction, instructionBuffer, instructionBufferLength);
        instructionBufferLength += length2;
      });
      instructionBuffer = instructionBuffer.slice(0, instructionBufferLength);
      const signDataLayout = BufferLayout.struct([BufferLayout.blob(1, "numRequiredSignatures"), BufferLayout.blob(1, "numReadonlySignedAccounts"), BufferLayout.blob(1, "numReadonlyUnsignedAccounts"), BufferLayout.blob(keyCount.length, "keyCount"), BufferLayout.seq(publicKey("key"), numKeys, "keys"), publicKey("recentBlockhash")]);
      const transaction = {
        numRequiredSignatures: import_buffer3.Buffer.from([this.header.numRequiredSignatures]),
        numReadonlySignedAccounts: import_buffer3.Buffer.from([this.header.numReadonlySignedAccounts]),
        numReadonlyUnsignedAccounts: import_buffer3.Buffer.from([this.header.numReadonlyUnsignedAccounts]),
        keyCount: import_buffer3.Buffer.from(keyCount),
        keys: this.accountKeys.map((key) => toBuffer(key.toBytes())),
        recentBlockhash: import_bs58.default.decode(this.recentBlockhash)
      };
      let signData = import_buffer3.Buffer.alloc(2048);
      const length = signDataLayout.encode(transaction, signData);
      instructionBuffer.copy(signData, length);
      return signData.slice(0, length + instructionBuffer.length);
    }
    /**
     * Decode a compiled message into a Message object.
     */
    static from(buffer) {
      let byteArray = [...buffer];
      const numRequiredSignatures = guardedShift(byteArray);
      if (numRequiredSignatures !== (numRequiredSignatures & VERSION_PREFIX_MASK)) {
        throw new Error("Versioned messages must be deserialized with VersionedMessage.deserialize()");
      }
      const numReadonlySignedAccounts = guardedShift(byteArray);
      const numReadonlyUnsignedAccounts = guardedShift(byteArray);
      const accountCount = decodeLength(byteArray);
      let accountKeys = [];
      for (let i2 = 0; i2 < accountCount; i2++) {
        const account = guardedSplice(byteArray, 0, PUBLIC_KEY_LENGTH);
        accountKeys.push(new PublicKey(import_buffer3.Buffer.from(account)));
      }
      const recentBlockhash = guardedSplice(byteArray, 0, PUBLIC_KEY_LENGTH);
      const instructionCount = decodeLength(byteArray);
      let instructions = [];
      for (let i2 = 0; i2 < instructionCount; i2++) {
        const programIdIndex = guardedShift(byteArray);
        const accountCount2 = decodeLength(byteArray);
        const accounts = guardedSplice(byteArray, 0, accountCount2);
        const dataLength = decodeLength(byteArray);
        const dataSlice = guardedSplice(byteArray, 0, dataLength);
        const data = import_bs58.default.encode(import_buffer3.Buffer.from(dataSlice));
        instructions.push({
          programIdIndex,
          accounts,
          data
        });
      }
      const messageArgs = {
        header: {
          numRequiredSignatures,
          numReadonlySignedAccounts,
          numReadonlyUnsignedAccounts
        },
        recentBlockhash: import_bs58.default.encode(import_buffer3.Buffer.from(recentBlockhash)),
        accountKeys,
        instructions
      };
      return new _Message(messageArgs);
    }
  };
  var MessageV0 = class _MessageV0 {
    constructor(args) {
      this.header = void 0;
      this.staticAccountKeys = void 0;
      this.recentBlockhash = void 0;
      this.compiledInstructions = void 0;
      this.addressTableLookups = void 0;
      this.header = args.header;
      this.staticAccountKeys = args.staticAccountKeys;
      this.recentBlockhash = args.recentBlockhash;
      this.compiledInstructions = args.compiledInstructions;
      this.addressTableLookups = args.addressTableLookups;
    }
    get version() {
      return 0;
    }
    get numAccountKeysFromLookups() {
      let count = 0;
      for (const lookup of this.addressTableLookups) {
        count += lookup.readonlyIndexes.length + lookup.writableIndexes.length;
      }
      return count;
    }
    getAccountKeys(args) {
      let accountKeysFromLookups;
      if (args && "accountKeysFromLookups" in args && args.accountKeysFromLookups) {
        if (this.numAccountKeysFromLookups != args.accountKeysFromLookups.writable.length + args.accountKeysFromLookups.readonly.length) {
          throw new Error("Failed to get account keys because of a mismatch in the number of account keys from lookups");
        }
        accountKeysFromLookups = args.accountKeysFromLookups;
      } else if (args && "addressLookupTableAccounts" in args && args.addressLookupTableAccounts) {
        accountKeysFromLookups = this.resolveAddressTableLookups(args.addressLookupTableAccounts);
      } else if (this.addressTableLookups.length > 0) {
        throw new Error("Failed to get account keys because address table lookups were not resolved");
      }
      return new MessageAccountKeys(this.staticAccountKeys, accountKeysFromLookups);
    }
    isAccountSigner(index) {
      return index < this.header.numRequiredSignatures;
    }
    isAccountWritable(index) {
      const numSignedAccounts = this.header.numRequiredSignatures;
      const numStaticAccountKeys = this.staticAccountKeys.length;
      if (index >= numStaticAccountKeys) {
        const lookupAccountKeysIndex = index - numStaticAccountKeys;
        const numWritableLookupAccountKeys = this.addressTableLookups.reduce((count, lookup) => count + lookup.writableIndexes.length, 0);
        return lookupAccountKeysIndex < numWritableLookupAccountKeys;
      } else if (index >= this.header.numRequiredSignatures) {
        const unsignedAccountIndex = index - numSignedAccounts;
        const numUnsignedAccounts = numStaticAccountKeys - numSignedAccounts;
        const numWritableUnsignedAccounts = numUnsignedAccounts - this.header.numReadonlyUnsignedAccounts;
        return unsignedAccountIndex < numWritableUnsignedAccounts;
      } else {
        const numWritableSignedAccounts = numSignedAccounts - this.header.numReadonlySignedAccounts;
        return index < numWritableSignedAccounts;
      }
    }
    resolveAddressTableLookups(addressLookupTableAccounts) {
      const accountKeysFromLookups = {
        writable: [],
        readonly: []
      };
      for (const tableLookup of this.addressTableLookups) {
        const tableAccount = addressLookupTableAccounts.find((account) => account.key.equals(tableLookup.accountKey));
        if (!tableAccount) {
          throw new Error(`Failed to find address lookup table account for table key ${tableLookup.accountKey.toBase58()}`);
        }
        for (const index of tableLookup.writableIndexes) {
          if (index < tableAccount.state.addresses.length) {
            accountKeysFromLookups.writable.push(tableAccount.state.addresses[index]);
          } else {
            throw new Error(`Failed to find address for index ${index} in address lookup table ${tableLookup.accountKey.toBase58()}`);
          }
        }
        for (const index of tableLookup.readonlyIndexes) {
          if (index < tableAccount.state.addresses.length) {
            accountKeysFromLookups.readonly.push(tableAccount.state.addresses[index]);
          } else {
            throw new Error(`Failed to find address for index ${index} in address lookup table ${tableLookup.accountKey.toBase58()}`);
          }
        }
      }
      return accountKeysFromLookups;
    }
    static compile(args) {
      const compiledKeys = CompiledKeys.compile(args.instructions, args.payerKey);
      const addressTableLookups = new Array();
      const accountKeysFromLookups = {
        writable: new Array(),
        readonly: new Array()
      };
      const lookupTableAccounts = args.addressLookupTableAccounts || [];
      for (const lookupTable of lookupTableAccounts) {
        const extractResult = compiledKeys.extractTableLookup(lookupTable);
        if (extractResult !== void 0) {
          const [addressTableLookup, {
            writable,
            readonly
          }] = extractResult;
          addressTableLookups.push(addressTableLookup);
          accountKeysFromLookups.writable.push(...writable);
          accountKeysFromLookups.readonly.push(...readonly);
        }
      }
      const [header, staticAccountKeys] = compiledKeys.getMessageComponents();
      const accountKeys = new MessageAccountKeys(staticAccountKeys, accountKeysFromLookups);
      const compiledInstructions = accountKeys.compileInstructions(args.instructions);
      return new _MessageV0({
        header,
        staticAccountKeys,
        recentBlockhash: args.recentBlockhash,
        compiledInstructions,
        addressTableLookups
      });
    }
    serialize() {
      const encodedStaticAccountKeysLength = Array();
      encodeLength(encodedStaticAccountKeysLength, this.staticAccountKeys.length);
      const serializedInstructions = this.serializeInstructions();
      const encodedInstructionsLength = Array();
      encodeLength(encodedInstructionsLength, this.compiledInstructions.length);
      const serializedAddressTableLookups = this.serializeAddressTableLookups();
      const encodedAddressTableLookupsLength = Array();
      encodeLength(encodedAddressTableLookupsLength, this.addressTableLookups.length);
      const messageLayout = BufferLayout.struct([BufferLayout.u8("prefix"), BufferLayout.struct([BufferLayout.u8("numRequiredSignatures"), BufferLayout.u8("numReadonlySignedAccounts"), BufferLayout.u8("numReadonlyUnsignedAccounts")], "header"), BufferLayout.blob(encodedStaticAccountKeysLength.length, "staticAccountKeysLength"), BufferLayout.seq(publicKey(), this.staticAccountKeys.length, "staticAccountKeys"), publicKey("recentBlockhash"), BufferLayout.blob(encodedInstructionsLength.length, "instructionsLength"), BufferLayout.blob(serializedInstructions.length, "serializedInstructions"), BufferLayout.blob(encodedAddressTableLookupsLength.length, "addressTableLookupsLength"), BufferLayout.blob(serializedAddressTableLookups.length, "serializedAddressTableLookups")]);
      const serializedMessage = new Uint8Array(PACKET_DATA_SIZE);
      const MESSAGE_VERSION_0_PREFIX = 1 << 7;
      const serializedMessageLength = messageLayout.encode({
        prefix: MESSAGE_VERSION_0_PREFIX,
        header: this.header,
        staticAccountKeysLength: new Uint8Array(encodedStaticAccountKeysLength),
        staticAccountKeys: this.staticAccountKeys.map((key) => key.toBytes()),
        recentBlockhash: import_bs58.default.decode(this.recentBlockhash),
        instructionsLength: new Uint8Array(encodedInstructionsLength),
        serializedInstructions,
        addressTableLookupsLength: new Uint8Array(encodedAddressTableLookupsLength),
        serializedAddressTableLookups
      }, serializedMessage);
      return serializedMessage.slice(0, serializedMessageLength);
    }
    serializeInstructions() {
      let serializedLength = 0;
      const serializedInstructions = new Uint8Array(PACKET_DATA_SIZE);
      for (const instruction of this.compiledInstructions) {
        const encodedAccountKeyIndexesLength = Array();
        encodeLength(encodedAccountKeyIndexesLength, instruction.accountKeyIndexes.length);
        const encodedDataLength = Array();
        encodeLength(encodedDataLength, instruction.data.length);
        const instructionLayout = BufferLayout.struct([BufferLayout.u8("programIdIndex"), BufferLayout.blob(encodedAccountKeyIndexesLength.length, "encodedAccountKeyIndexesLength"), BufferLayout.seq(BufferLayout.u8(), instruction.accountKeyIndexes.length, "accountKeyIndexes"), BufferLayout.blob(encodedDataLength.length, "encodedDataLength"), BufferLayout.blob(instruction.data.length, "data")]);
        serializedLength += instructionLayout.encode({
          programIdIndex: instruction.programIdIndex,
          encodedAccountKeyIndexesLength: new Uint8Array(encodedAccountKeyIndexesLength),
          accountKeyIndexes: instruction.accountKeyIndexes,
          encodedDataLength: new Uint8Array(encodedDataLength),
          data: instruction.data
        }, serializedInstructions, serializedLength);
      }
      return serializedInstructions.slice(0, serializedLength);
    }
    serializeAddressTableLookups() {
      let serializedLength = 0;
      const serializedAddressTableLookups = new Uint8Array(PACKET_DATA_SIZE);
      for (const lookup of this.addressTableLookups) {
        const encodedWritableIndexesLength = Array();
        encodeLength(encodedWritableIndexesLength, lookup.writableIndexes.length);
        const encodedReadonlyIndexesLength = Array();
        encodeLength(encodedReadonlyIndexesLength, lookup.readonlyIndexes.length);
        const addressTableLookupLayout = BufferLayout.struct([publicKey("accountKey"), BufferLayout.blob(encodedWritableIndexesLength.length, "encodedWritableIndexesLength"), BufferLayout.seq(BufferLayout.u8(), lookup.writableIndexes.length, "writableIndexes"), BufferLayout.blob(encodedReadonlyIndexesLength.length, "encodedReadonlyIndexesLength"), BufferLayout.seq(BufferLayout.u8(), lookup.readonlyIndexes.length, "readonlyIndexes")]);
        serializedLength += addressTableLookupLayout.encode({
          accountKey: lookup.accountKey.toBytes(),
          encodedWritableIndexesLength: new Uint8Array(encodedWritableIndexesLength),
          writableIndexes: lookup.writableIndexes,
          encodedReadonlyIndexesLength: new Uint8Array(encodedReadonlyIndexesLength),
          readonlyIndexes: lookup.readonlyIndexes
        }, serializedAddressTableLookups, serializedLength);
      }
      return serializedAddressTableLookups.slice(0, serializedLength);
    }
    static deserialize(serializedMessage) {
      let byteArray = [...serializedMessage];
      const prefix = guardedShift(byteArray);
      const maskedPrefix = prefix & VERSION_PREFIX_MASK;
      assert2(prefix !== maskedPrefix, `Expected versioned message but received legacy message`);
      const version2 = maskedPrefix;
      assert2(version2 === 0, `Expected versioned message with version 0 but found version ${version2}`);
      const header = {
        numRequiredSignatures: guardedShift(byteArray),
        numReadonlySignedAccounts: guardedShift(byteArray),
        numReadonlyUnsignedAccounts: guardedShift(byteArray)
      };
      const staticAccountKeys = [];
      const staticAccountKeysLength = decodeLength(byteArray);
      for (let i2 = 0; i2 < staticAccountKeysLength; i2++) {
        staticAccountKeys.push(new PublicKey(guardedSplice(byteArray, 0, PUBLIC_KEY_LENGTH)));
      }
      const recentBlockhash = import_bs58.default.encode(guardedSplice(byteArray, 0, PUBLIC_KEY_LENGTH));
      const instructionCount = decodeLength(byteArray);
      const compiledInstructions = [];
      for (let i2 = 0; i2 < instructionCount; i2++) {
        const programIdIndex = guardedShift(byteArray);
        const accountKeyIndexesLength = decodeLength(byteArray);
        const accountKeyIndexes = guardedSplice(byteArray, 0, accountKeyIndexesLength);
        const dataLength = decodeLength(byteArray);
        const data = new Uint8Array(guardedSplice(byteArray, 0, dataLength));
        compiledInstructions.push({
          programIdIndex,
          accountKeyIndexes,
          data
        });
      }
      const addressTableLookupsCount = decodeLength(byteArray);
      const addressTableLookups = [];
      for (let i2 = 0; i2 < addressTableLookupsCount; i2++) {
        const accountKey = new PublicKey(guardedSplice(byteArray, 0, PUBLIC_KEY_LENGTH));
        const writableIndexesLength = decodeLength(byteArray);
        const writableIndexes = guardedSplice(byteArray, 0, writableIndexesLength);
        const readonlyIndexesLength = decodeLength(byteArray);
        const readonlyIndexes = guardedSplice(byteArray, 0, readonlyIndexesLength);
        addressTableLookups.push({
          accountKey,
          writableIndexes,
          readonlyIndexes
        });
      }
      return new _MessageV0({
        header,
        staticAccountKeys,
        recentBlockhash,
        compiledInstructions,
        addressTableLookups
      });
    }
  };
  var CONFIG_MASK_PRIORITY_FEE_BITS = 3;
  var CONFIG_MASK_COMPUTE_UNIT_LIMIT_BIT = 4;
  var CONFIG_MASK_LOADED_ACCOUNTS_DATA_SIZE_LIMIT_BIT = 8;
  var CONFIG_MASK_HEAP_SIZE_BIT = 16;
  function decodeU32(byteArray) {
    const bytes = guardedSplice(byteArray, 0, 4);
    return bytes[0] + bytes[1] * 2 ** 8 + bytes[2] * 2 ** 16 + bytes[3] * 2 ** 24;
  }
  function decodeU64(byteArray) {
    const bytes = guardedSplice(byteArray, 0, 8);
    let value = BigInt(0);
    for (let i2 = bytes.length - 1; i2 >= 0; i2--) {
      value = value << BigInt(8) | BigInt(bytes[i2]);
    }
    assert2(value <= BigInt(Number.MAX_SAFE_INTEGER), "Expected u64 value to be within the safe integer range");
    return Number(value);
  }
  var MessageV1 = class _MessageV1 {
    constructor(args) {
      this.header = void 0;
      this.staticAccountKeys = void 0;
      this.recentBlockhash = void 0;
      this.compiledInstructions = void 0;
      this.transactionConfig = void 0;
      this.header = args.header;
      this.staticAccountKeys = args.staticAccountKeys;
      this.recentBlockhash = args.recentBlockhash;
      this.compiledInstructions = args.compiledInstructions;
      this.transactionConfig = args.transactionConfig ?? {
        computeUnitLimit: null,
        heapSize: null,
        loadedAccountsDataSizeLimit: null,
        priorityFee: null
      };
    }
    get version() {
      return 1;
    }
    get addressTableLookups() {
      return [];
    }
    getAccountKeys() {
      return new MessageAccountKeys(this.staticAccountKeys);
    }
    isAccountSigner(index) {
      return index < this.header.numRequiredSignatures;
    }
    isAccountWritable(index) {
      const numSignedAccounts = this.header.numRequiredSignatures;
      const numStaticAccountKeys = this.staticAccountKeys.length;
      if (index >= numStaticAccountKeys) {
        return false;
      } else if (index >= this.header.numRequiredSignatures) {
        const unsignedAccountIndex = index - numSignedAccounts;
        const numUnsignedAccounts = numStaticAccountKeys - numSignedAccounts;
        const numWritableUnsignedAccounts = numUnsignedAccounts - this.header.numReadonlyUnsignedAccounts;
        return unsignedAccountIndex < numWritableUnsignedAccounts;
      } else {
        const numWritableSignedAccounts = numSignedAccounts - this.header.numReadonlySignedAccounts;
        return index < numWritableSignedAccounts;
      }
    }
    serialize() {
      throw new Error("Serialization of version 1 transaction messages is not supported");
    }
    static deserialize(serializedMessage) {
      let byteArray = [...serializedMessage];
      const prefix = guardedShift(byteArray);
      const maskedPrefix = prefix & VERSION_PREFIX_MASK;
      assert2(prefix !== maskedPrefix, `Expected versioned message but received legacy message`);
      const version2 = maskedPrefix;
      assert2(version2 === 1, `Expected versioned message with version 1 but found version ${version2}`);
      const header = {
        numRequiredSignatures: guardedShift(byteArray),
        numReadonlySignedAccounts: guardedShift(byteArray),
        numReadonlyUnsignedAccounts: guardedShift(byteArray)
      };
      const configMask = decodeU32(byteArray);
      assert2((configMask & -32) === 0, "Unexpected bits set in the transaction config mask");
      const priorityFeeBits = configMask & CONFIG_MASK_PRIORITY_FEE_BITS;
      assert2(priorityFeeBits === 0 || priorityFeeBits === CONFIG_MASK_PRIORITY_FEE_BITS, "Expected both or neither of the priority fee bits to be set in the transaction config mask");
      const recentBlockhash = import_bs58.default.encode(guardedSplice(byteArray, 0, PUBLIC_KEY_LENGTH));
      const instructionCount = guardedShift(byteArray);
      const staticAccountKeysLength = guardedShift(byteArray);
      const staticAccountKeys = [];
      for (let i2 = 0; i2 < staticAccountKeysLength; i2++) {
        staticAccountKeys.push(new PublicKey(guardedSplice(byteArray, 0, PUBLIC_KEY_LENGTH)));
      }
      const transactionConfig = {
        computeUnitLimit: null,
        heapSize: null,
        loadedAccountsDataSizeLimit: null,
        priorityFee: null
      };
      if (priorityFeeBits !== 0) {
        transactionConfig.priorityFee = decodeU64(byteArray);
      }
      if (configMask & CONFIG_MASK_COMPUTE_UNIT_LIMIT_BIT) {
        transactionConfig.computeUnitLimit = decodeU32(byteArray);
      }
      if (configMask & CONFIG_MASK_LOADED_ACCOUNTS_DATA_SIZE_LIMIT_BIT) {
        transactionConfig.loadedAccountsDataSizeLimit = decodeU32(byteArray);
      }
      if (configMask & CONFIG_MASK_HEAP_SIZE_BIT) {
        transactionConfig.heapSize = decodeU32(byteArray);
      }
      const instructionHeaders = [];
      for (let i2 = 0; i2 < instructionCount; i2++) {
        const programIdIndex = guardedShift(byteArray);
        const accountKeyIndexesLength = guardedShift(byteArray);
        const dataLength = guardedShift(byteArray) + guardedShift(byteArray) * 256;
        instructionHeaders.push({
          accountKeyIndexesLength,
          dataLength,
          programIdIndex
        });
      }
      const compiledInstructions = [];
      for (const instructionHeader of instructionHeaders) {
        compiledInstructions.push({
          programIdIndex: instructionHeader.programIdIndex,
          accountKeyIndexes: guardedSplice(byteArray, 0, instructionHeader.accountKeyIndexesLength),
          data: new Uint8Array(guardedSplice(byteArray, 0, instructionHeader.dataLength))
        });
      }
      assert2(byteArray.length === 0, "Expected no bytes to remain after deserializing a version 1 message");
      return new _MessageV1({
        header,
        staticAccountKeys,
        recentBlockhash,
        compiledInstructions,
        transactionConfig
      });
    }
  };
  var VersionedMessage = {
    deserializeMessageVersion(serializedMessage) {
      const prefix = serializedMessage[0];
      const maskedPrefix = prefix & VERSION_PREFIX_MASK;
      if (maskedPrefix === prefix) {
        return "legacy";
      }
      return maskedPrefix;
    },
    deserialize: (serializedMessage) => {
      const version2 = VersionedMessage.deserializeMessageVersion(serializedMessage);
      if (version2 === "legacy") {
        return Message.from(serializedMessage);
      }
      if (version2 === 0) {
        return MessageV0.deserialize(serializedMessage);
      } else if (version2 === 1) {
        return MessageV1.deserialize(serializedMessage);
      } else {
        throw new Error(`Transaction message version ${version2} deserialization is not supported`);
      }
    }
  };
  var TransactionStatus = /* @__PURE__ */ (function(TransactionStatus2) {
    TransactionStatus2[TransactionStatus2["BLOCKHEIGHT_EXCEEDED"] = 0] = "BLOCKHEIGHT_EXCEEDED";
    TransactionStatus2[TransactionStatus2["PROCESSED"] = 1] = "PROCESSED";
    TransactionStatus2[TransactionStatus2["TIMED_OUT"] = 2] = "TIMED_OUT";
    TransactionStatus2[TransactionStatus2["NONCE_INVALID"] = 3] = "NONCE_INVALID";
    return TransactionStatus2;
  })({});
  var DEFAULT_SIGNATURE = import_buffer3.Buffer.alloc(SIGNATURE_LENGTH_IN_BYTES).fill(0);
  var TransactionInstruction = class {
    constructor(opts) {
      this.keys = void 0;
      this.programId = void 0;
      this.data = import_buffer3.Buffer.alloc(0);
      this.programId = opts.programId;
      this.keys = opts.keys;
      if (opts.data) {
        this.data = opts.data;
      }
    }
    /**
     * @internal
     */
    toJSON() {
      return {
        keys: this.keys.map(({
          pubkey,
          isSigner,
          isWritable
        }) => ({
          pubkey: pubkey.toJSON(),
          isSigner,
          isWritable
        })),
        programId: this.programId.toJSON(),
        data: [...this.data]
      };
    }
  };
  var Transaction = class _Transaction {
    /**
     * The first (payer) Transaction signature
     *
     * @returns {Buffer | null} Buffer of payer's signature
     */
    get signature() {
      if (this.signatures.length > 0) {
        return this.signatures[0].signature;
      }
      return null;
    }
    /**
     * The transaction fee payer
     */
    // Construct a transaction with a blockhash and lastValidBlockHeight
    // Construct a transaction using a durable nonce
    /**
     * @deprecated `TransactionCtorFields` has been deprecated and will be removed in a future version.
     * Please supply a `TransactionBlockhashCtor` instead.
     */
    /**
     * Construct an empty Transaction
     */
    constructor(opts) {
      this.signatures = [];
      this.feePayer = void 0;
      this.instructions = [];
      this.recentBlockhash = void 0;
      this.lastValidBlockHeight = void 0;
      this.nonceInfo = void 0;
      this.minNonceContextSlot = void 0;
      this._message = void 0;
      this._json = void 0;
      if (!opts) {
        return;
      }
      if (opts.feePayer) {
        this.feePayer = opts.feePayer;
      }
      if (opts.signatures) {
        this.signatures = opts.signatures;
      }
      if (Object.prototype.hasOwnProperty.call(opts, "nonceInfo")) {
        const {
          minContextSlot,
          nonceInfo
        } = opts;
        this.minNonceContextSlot = minContextSlot;
        this.nonceInfo = nonceInfo;
      } else if (Object.prototype.hasOwnProperty.call(opts, "lastValidBlockHeight")) {
        const {
          blockhash,
          lastValidBlockHeight
        } = opts;
        this.recentBlockhash = blockhash;
        this.lastValidBlockHeight = lastValidBlockHeight;
      } else {
        const {
          recentBlockhash,
          nonceInfo
        } = opts;
        if (nonceInfo) {
          this.nonceInfo = nonceInfo;
        }
        this.recentBlockhash = recentBlockhash;
      }
    }
    /**
     * @internal
     */
    toJSON() {
      return {
        recentBlockhash: this.recentBlockhash || null,
        feePayer: this.feePayer ? this.feePayer.toJSON() : null,
        nonceInfo: this.nonceInfo ? {
          nonce: this.nonceInfo.nonce,
          nonceInstruction: this.nonceInfo.nonceInstruction.toJSON()
        } : null,
        instructions: this.instructions.map((instruction) => instruction.toJSON()),
        signers: this.signatures.map(({
          publicKey: publicKey3
        }) => {
          return publicKey3.toJSON();
        })
      };
    }
    /**
     * Add one or more instructions to this Transaction
     *
     * @param {Array< Transaction | TransactionInstruction | TransactionInstructionCtorFields >} items - Instructions to add to the Transaction
     */
    add(...items) {
      if (items.length === 0) {
        throw new Error("No instructions");
      }
      items.forEach((item) => {
        if ("instructions" in item) {
          this.instructions = this.instructions.concat(item.instructions);
        } else if ("data" in item && "programId" in item && "keys" in item) {
          this.instructions.push(item);
        } else {
          this.instructions.push(new TransactionInstruction(item));
        }
      });
      return this;
    }
    /**
     * Compile transaction data
     */
    compileMessage() {
      if (this._message && JSON.stringify(this.toJSON()) === JSON.stringify(this._json)) {
        return this._message;
      }
      let recentBlockhash;
      let instructions;
      if (this.nonceInfo) {
        recentBlockhash = this.nonceInfo.nonce;
        if (this.instructions[0] != this.nonceInfo.nonceInstruction) {
          instructions = [this.nonceInfo.nonceInstruction, ...this.instructions];
        } else {
          instructions = this.instructions;
        }
      } else {
        recentBlockhash = this.recentBlockhash;
        instructions = this.instructions;
      }
      if (!recentBlockhash) {
        throw new Error("Transaction recentBlockhash required");
      }
      if (instructions.length < 1) {
        console.warn("No instructions provided");
      }
      let feePayer;
      if (this.feePayer) {
        feePayer = this.feePayer;
      } else if (this.signatures.length > 0 && this.signatures[0].publicKey) {
        feePayer = this.signatures[0].publicKey;
      } else {
        throw new Error("Transaction fee payer required");
      }
      for (let i2 = 0; i2 < instructions.length; i2++) {
        if (instructions[i2].programId === void 0) {
          throw new Error(`Transaction instruction index ${i2} has undefined program id`);
        }
      }
      const programIds = [];
      const accountMetas = [];
      instructions.forEach((instruction) => {
        instruction.keys.forEach((accountMeta) => {
          accountMetas.push({
            ...accountMeta
          });
        });
        const programId = instruction.programId.toString();
        if (!programIds.includes(programId)) {
          programIds.push(programId);
        }
      });
      programIds.forEach((programId) => {
        accountMetas.push({
          pubkey: new PublicKey(programId),
          isSigner: false,
          isWritable: false
        });
      });
      const uniqueMetas = [];
      accountMetas.forEach((accountMeta) => {
        const pubkeyString = accountMeta.pubkey.toString();
        const uniqueIndex = uniqueMetas.findIndex((x) => {
          return x.pubkey.toString() === pubkeyString;
        });
        if (uniqueIndex > -1) {
          uniqueMetas[uniqueIndex].isWritable = uniqueMetas[uniqueIndex].isWritable || accountMeta.isWritable;
          uniqueMetas[uniqueIndex].isSigner = uniqueMetas[uniqueIndex].isSigner || accountMeta.isSigner;
        } else {
          uniqueMetas.push(accountMeta);
        }
      });
      uniqueMetas.sort(function(x, y) {
        if (x.isSigner !== y.isSigner) {
          return x.isSigner ? -1 : 1;
        }
        if (x.isWritable !== y.isWritable) {
          return x.isWritable ? -1 : 1;
        }
        const options = {
          localeMatcher: "best fit",
          usage: "sort",
          sensitivity: "variant",
          ignorePunctuation: false,
          numeric: false,
          caseFirst: "lower"
        };
        return x.pubkey.toBase58().localeCompare(y.pubkey.toBase58(), "en", options);
      });
      const feePayerIndex = uniqueMetas.findIndex((x) => {
        return x.pubkey.equals(feePayer);
      });
      if (feePayerIndex > -1) {
        const [payerMeta] = uniqueMetas.splice(feePayerIndex, 1);
        payerMeta.isSigner = true;
        payerMeta.isWritable = true;
        uniqueMetas.unshift(payerMeta);
      } else {
        uniqueMetas.unshift({
          pubkey: feePayer,
          isSigner: true,
          isWritable: true
        });
      }
      for (const signature2 of this.signatures) {
        const uniqueIndex = uniqueMetas.findIndex((x) => {
          return x.pubkey.equals(signature2.publicKey);
        });
        if (uniqueIndex > -1) {
          if (!uniqueMetas[uniqueIndex].isSigner) {
            uniqueMetas[uniqueIndex].isSigner = true;
            console.warn("Transaction references a signature that is unnecessary, only the fee payer and instruction signer accounts should sign a transaction. This behavior is deprecated and will throw an error in the next major version release.");
          }
        } else {
          throw new Error(`unknown signer: ${signature2.publicKey.toString()}`);
        }
      }
      let numRequiredSignatures = 0;
      let numReadonlySignedAccounts = 0;
      let numReadonlyUnsignedAccounts = 0;
      const signedKeys = [];
      const unsignedKeys = [];
      uniqueMetas.forEach(({
        pubkey,
        isSigner,
        isWritable
      }) => {
        if (isSigner) {
          signedKeys.push(pubkey.toString());
          numRequiredSignatures += 1;
          if (!isWritable) {
            numReadonlySignedAccounts += 1;
          }
        } else {
          unsignedKeys.push(pubkey.toString());
          if (!isWritable) {
            numReadonlyUnsignedAccounts += 1;
          }
        }
      });
      const accountKeys = signedKeys.concat(unsignedKeys);
      const compiledInstructions = instructions.map((instruction) => {
        const {
          data,
          programId
        } = instruction;
        return {
          programIdIndex: accountKeys.indexOf(programId.toString()),
          accounts: instruction.keys.map((meta) => accountKeys.indexOf(meta.pubkey.toString())),
          data: import_bs58.default.encode(data)
        };
      });
      compiledInstructions.forEach((instruction) => {
        assert2(instruction.programIdIndex >= 0);
        instruction.accounts.forEach((keyIndex) => assert2(keyIndex >= 0));
      });
      return new Message({
        header: {
          numRequiredSignatures,
          numReadonlySignedAccounts,
          numReadonlyUnsignedAccounts
        },
        accountKeys,
        recentBlockhash,
        instructions: compiledInstructions
      });
    }
    /**
     * @internal
     */
    _compile() {
      const message = this.compileMessage();
      const signedKeys = message.accountKeys.slice(0, message.header.numRequiredSignatures);
      if (this.signatures.length === signedKeys.length) {
        const valid = this.signatures.every((pair, index) => {
          return signedKeys[index].equals(pair.publicKey);
        });
        if (valid) return message;
      }
      this.signatures = signedKeys.map((publicKey3) => ({
        signature: null,
        publicKey: publicKey3
      }));
      return message;
    }
    /**
     * Get a buffer of the Transaction data that need to be covered by signatures
     */
    serializeMessage() {
      return this._compile().serialize();
    }
    /**
     * Get the estimated fee associated with a transaction
     *
     * @param {Connection} connection Connection to RPC Endpoint.
     *
     * @returns {Promise<number | null>} The estimated fee for the transaction
     */
    async getEstimatedFee(connection) {
      return (await connection.getFeeForMessage(this.compileMessage())).value;
    }
    /**
     * Specify the public keys which will be used to sign the Transaction.
     * The first signer will be used as the transaction fee payer account.
     *
     * Signatures can be added with either `partialSign` or `addSignature`
     *
     * @deprecated Deprecated since v0.84.0. Only the fee payer needs to be
     * specified and it can be set in the Transaction constructor or with the
     * `feePayer` property.
     */
    setSigners(...signers) {
      if (signers.length === 0) {
        throw new Error("No signers");
      }
      const seen = /* @__PURE__ */ new Set();
      this.signatures = signers.filter((publicKey3) => {
        const key = publicKey3.toString();
        if (seen.has(key)) {
          return false;
        } else {
          seen.add(key);
          return true;
        }
      }).map((publicKey3) => ({
        signature: null,
        publicKey: publicKey3
      }));
    }
    /**
     * Sign the Transaction with the specified signers. Multiple signatures may
     * be applied to a Transaction. The first signature is considered "primary"
     * and is used identify and confirm transactions.
     *
     * If the Transaction `feePayer` is not set, the first signer will be used
     * as the transaction fee payer account.
     *
     * Transaction fields should not be modified after the first call to `sign`,
     * as doing so may invalidate the signature and cause the Transaction to be
     * rejected.
     *
     * The Transaction must be assigned a valid `recentBlockhash` before invoking this method
     *
     * @param {Array<Signer>} signers Array of signers that will sign the transaction
     */
    sign(...signers) {
      if (signers.length === 0) {
        throw new Error("No signers");
      }
      const seen = /* @__PURE__ */ new Set();
      const uniqueSigners = [];
      for (const signer of signers) {
        const key = signer.publicKey.toString();
        if (seen.has(key)) {
          continue;
        } else {
          seen.add(key);
          uniqueSigners.push(signer);
        }
      }
      this.signatures = uniqueSigners.map((signer) => ({
        signature: null,
        publicKey: signer.publicKey
      }));
      const message = this._compile();
      this._partialSign(message, ...uniqueSigners);
    }
    /**
     * Partially sign a transaction with the specified accounts. All accounts must
     * correspond to either the fee payer or a signer account in the transaction
     * instructions.
     *
     * All the caveats from the `sign` method apply to `partialSign`
     *
     * @param {Array<Signer>} signers Array of signers that will sign the transaction
     */
    partialSign(...signers) {
      if (signers.length === 0) {
        throw new Error("No signers");
      }
      const seen = /* @__PURE__ */ new Set();
      const uniqueSigners = [];
      for (const signer of signers) {
        const key = signer.publicKey.toString();
        if (seen.has(key)) {
          continue;
        } else {
          seen.add(key);
          uniqueSigners.push(signer);
        }
      }
      const message = this._compile();
      this._partialSign(message, ...uniqueSigners);
    }
    /**
     * @internal
     */
    _partialSign(message, ...signers) {
      const signData = message.serialize();
      signers.forEach((signer) => {
        const signature2 = sign(signData, signer.secretKey);
        this._addSignature(signer.publicKey, toBuffer(signature2));
      });
    }
    /**
     * Add an externally created signature to a transaction. The public key
     * must correspond to either the fee payer or a signer account in the transaction
     * instructions.
     *
     * @param {PublicKey} pubkey Public key that will be added to the transaction.
     * @param {Buffer} signature An externally created signature to add to the transaction.
     */
    addSignature(pubkey, signature2) {
      this._compile();
      this._addSignature(pubkey, signature2);
    }
    /**
     * @internal
     */
    _addSignature(pubkey, signature2) {
      assert2(signature2.length === 64);
      const index = this.signatures.findIndex((sigpair) => pubkey.equals(sigpair.publicKey));
      if (index < 0) {
        throw new Error(`unknown signer: ${pubkey.toString()}`);
      }
      this.signatures[index].signature = import_buffer3.Buffer.from(signature2);
    }
    /**
     * Verify signatures of a Transaction
     * Optional parameter specifies if we're expecting a fully signed Transaction or a partially signed one.
     * If no boolean is provided, we expect a fully signed Transaction by default.
     *
     * @param {boolean} [requireAllSignatures=true] Require a fully signed Transaction
     */
    verifySignatures(requireAllSignatures = true) {
      const signatureErrors = this._getMessageSignednessErrors(this.serializeMessage(), requireAllSignatures);
      return !signatureErrors;
    }
    /**
     * @internal
     */
    _getMessageSignednessErrors(message, requireAllSignatures) {
      const errors = {};
      for (const {
        signature: signature2,
        publicKey: publicKey3
      } of this.signatures) {
        if (signature2 === null) {
          if (requireAllSignatures) {
            (errors.missing || (errors.missing = [])).push(publicKey3);
          }
        } else {
          if (!verify(signature2, message, publicKey3.toBytes())) {
            (errors.invalid || (errors.invalid = [])).push(publicKey3);
          }
        }
      }
      return errors.invalid || errors.missing ? errors : void 0;
    }
    /**
     * Serialize the Transaction in the wire format.
     *
     * @param {Buffer} [config] Config of transaction.
     *
     * @returns {Buffer} Signature of transaction in wire format.
     */
    serialize(config) {
      const {
        requireAllSignatures,
        verifySignatures
      } = Object.assign({
        requireAllSignatures: true,
        verifySignatures: true
      }, config);
      const signData = this.serializeMessage();
      if (verifySignatures) {
        const sigErrors = this._getMessageSignednessErrors(signData, requireAllSignatures);
        if (sigErrors) {
          let errorMessage = "Signature verification failed.";
          if (sigErrors.invalid) {
            errorMessage += `
Invalid signature for public key${sigErrors.invalid.length === 1 ? "" : "(s)"} [\`${sigErrors.invalid.map((p) => p.toBase58()).join("`, `")}\`].`;
          }
          if (sigErrors.missing) {
            errorMessage += `
Missing signature for public key${sigErrors.missing.length === 1 ? "" : "(s)"} [\`${sigErrors.missing.map((p) => p.toBase58()).join("`, `")}\`].`;
          }
          throw new Error(errorMessage);
        }
      }
      return this._serialize(signData);
    }
    /**
     * @internal
     */
    _serialize(signData) {
      const {
        signatures
      } = this;
      const signatureCount = [];
      encodeLength(signatureCount, signatures.length);
      const transactionLength = signatureCount.length + signatures.length * 64 + signData.length;
      const wireTransaction = import_buffer3.Buffer.alloc(transactionLength);
      assert2(signatures.length < 256);
      import_buffer3.Buffer.from(signatureCount).copy(wireTransaction, 0);
      signatures.forEach(({
        signature: signature2
      }, index) => {
        if (signature2 !== null) {
          assert2(signature2.length === 64, `signature has invalid length`);
          import_buffer3.Buffer.from(signature2).copy(wireTransaction, signatureCount.length + index * 64);
        }
      });
      signData.copy(wireTransaction, signatureCount.length + signatures.length * 64);
      assert2(wireTransaction.length <= PACKET_DATA_SIZE, `Transaction too large: ${wireTransaction.length} > ${PACKET_DATA_SIZE}`);
      return wireTransaction;
    }
    /**
     * Deprecated method
     * @internal
     */
    get keys() {
      assert2(this.instructions.length === 1);
      return this.instructions[0].keys.map((keyObj) => keyObj.pubkey);
    }
    /**
     * Deprecated method
     * @internal
     */
    get programId() {
      assert2(this.instructions.length === 1);
      return this.instructions[0].programId;
    }
    /**
     * Deprecated method
     * @internal
     */
    get data() {
      assert2(this.instructions.length === 1);
      return this.instructions[0].data;
    }
    /**
     * Parse a wire transaction into a Transaction object.
     *
     * @param {Buffer | Uint8Array | Array<number>} buffer Signature of wire Transaction
     *
     * @returns {Transaction} Transaction associated with the signature
     */
    static from(buffer) {
      let byteArray = [...buffer];
      const signatureCount = decodeLength(byteArray);
      let signatures = [];
      for (let i2 = 0; i2 < signatureCount; i2++) {
        const signature2 = guardedSplice(byteArray, 0, SIGNATURE_LENGTH_IN_BYTES);
        signatures.push(import_bs58.default.encode(import_buffer3.Buffer.from(signature2)));
      }
      return _Transaction.populate(Message.from(byteArray), signatures);
    }
    /**
     * Populate Transaction object from message and signatures
     *
     * @param {Message} message Message of transaction
     * @param {Array<string>} signatures List of signatures to assign to the transaction
     *
     * @returns {Transaction} The populated Transaction
     */
    static populate(message, signatures = []) {
      const transaction = new _Transaction();
      transaction.recentBlockhash = message.recentBlockhash;
      if (message.header.numRequiredSignatures > 0) {
        transaction.feePayer = message.accountKeys[0];
      }
      signatures.forEach((signature2, index) => {
        const sigPubkeyPair = {
          signature: signature2 == import_bs58.default.encode(DEFAULT_SIGNATURE) ? null : import_bs58.default.decode(signature2),
          publicKey: message.accountKeys[index]
        };
        transaction.signatures.push(sigPubkeyPair);
      });
      message.instructions.forEach((instruction) => {
        const keys = instruction.accounts.map((account) => {
          const pubkey = message.accountKeys[account];
          return {
            pubkey,
            isSigner: transaction.signatures.some((keyObj) => keyObj.publicKey.toString() === pubkey.toString()) || message.isAccountSigner(account),
            isWritable: message.isAccountWritable(account)
          };
        });
        transaction.instructions.push(new TransactionInstruction({
          keys,
          programId: message.accountKeys[instruction.programIdIndex],
          data: import_bs58.default.decode(instruction.data)
        }));
      });
      transaction._message = message;
      transaction._json = transaction.toJSON();
      return transaction;
    }
  };
  var TransactionMessage = class _TransactionMessage {
    constructor(args) {
      this.payerKey = void 0;
      this.instructions = void 0;
      this.recentBlockhash = void 0;
      this.payerKey = args.payerKey;
      this.instructions = args.instructions;
      this.recentBlockhash = args.recentBlockhash;
    }
    static decompile(message, args) {
      const {
        header,
        compiledInstructions,
        recentBlockhash
      } = message;
      const {
        numRequiredSignatures,
        numReadonlySignedAccounts,
        numReadonlyUnsignedAccounts
      } = header;
      const numWritableSignedAccounts = numRequiredSignatures - numReadonlySignedAccounts;
      assert2(numWritableSignedAccounts > 0, "Message header is invalid");
      const numWritableUnsignedAccounts = message.staticAccountKeys.length - numRequiredSignatures - numReadonlyUnsignedAccounts;
      assert2(numWritableUnsignedAccounts >= 0, "Message header is invalid");
      const accountKeys = message.getAccountKeys(args);
      const payerKey = accountKeys.get(0);
      if (payerKey === void 0) {
        throw new Error("Failed to decompile message because no account keys were found");
      }
      const instructions = [];
      for (const compiledIx of compiledInstructions) {
        const keys = [];
        for (const keyIndex of compiledIx.accountKeyIndexes) {
          const pubkey = accountKeys.get(keyIndex);
          if (pubkey === void 0) {
            throw new Error(`Failed to find key for account key index ${keyIndex}`);
          }
          const isSigner = keyIndex < numRequiredSignatures;
          let isWritable;
          if (isSigner) {
            isWritable = keyIndex < numWritableSignedAccounts;
          } else if (keyIndex < accountKeys.staticAccountKeys.length) {
            isWritable = keyIndex - numRequiredSignatures < numWritableUnsignedAccounts;
          } else {
            isWritable = keyIndex - accountKeys.staticAccountKeys.length < // accountKeysFromLookups cannot be undefined because we already found a pubkey for this index above
            accountKeys.accountKeysFromLookups.writable.length;
          }
          keys.push({
            pubkey,
            isSigner: keyIndex < header.numRequiredSignatures,
            isWritable
          });
        }
        const programId = accountKeys.get(compiledIx.programIdIndex);
        if (programId === void 0) {
          throw new Error(`Failed to find program id for program id index ${compiledIx.programIdIndex}`);
        }
        instructions.push(new TransactionInstruction({
          programId,
          data: toBuffer(compiledIx.data),
          keys
        }));
      }
      return new _TransactionMessage({
        payerKey,
        instructions,
        recentBlockhash
      });
    }
    compileToLegacyMessage() {
      return Message.compile({
        payerKey: this.payerKey,
        recentBlockhash: this.recentBlockhash,
        instructions: this.instructions
      });
    }
    compileToV0Message(addressLookupTableAccounts) {
      return MessageV0.compile({
        payerKey: this.payerKey,
        recentBlockhash: this.recentBlockhash,
        instructions: this.instructions,
        addressLookupTableAccounts
      });
    }
  };
  var VersionedTransaction = class _VersionedTransaction {
    get version() {
      return this.message.version;
    }
    constructor(message, signatures) {
      this.signatures = void 0;
      this.message = void 0;
      if (signatures !== void 0) {
        assert2(signatures.length === message.header.numRequiredSignatures, "Expected signatures length to be equal to the number of required signatures");
        this.signatures = signatures;
      } else {
        const defaultSignatures = [];
        for (let i2 = 0; i2 < message.header.numRequiredSignatures; i2++) {
          defaultSignatures.push(new Uint8Array(SIGNATURE_LENGTH_IN_BYTES));
        }
        this.signatures = defaultSignatures;
      }
      this.message = message;
    }
    serialize() {
      const serializedMessage = this.message.serialize();
      const encodedSignaturesLength = Array();
      encodeLength(encodedSignaturesLength, this.signatures.length);
      const transactionLayout = BufferLayout.struct([BufferLayout.blob(encodedSignaturesLength.length, "encodedSignaturesLength"), BufferLayout.seq(signature(), this.signatures.length, "signatures"), BufferLayout.blob(serializedMessage.length, "serializedMessage")]);
      const serializedTransaction = new Uint8Array(2048);
      const serializedTransactionLength = transactionLayout.encode({
        encodedSignaturesLength: new Uint8Array(encodedSignaturesLength),
        signatures: this.signatures,
        serializedMessage
      }, serializedTransaction);
      return serializedTransaction.slice(0, serializedTransactionLength);
    }
    static deserialize(serializedTransaction) {
      if (serializedTransaction[0] === VERSION_1_MESSAGE_PREFIX) {
        return this.deserializeV1(serializedTransaction);
      }
      let byteArray = [...serializedTransaction];
      const signatures = [];
      const signaturesLength = decodeLength(byteArray);
      for (let i2 = 0; i2 < signaturesLength; i2++) {
        signatures.push(new Uint8Array(guardedSplice(byteArray, 0, SIGNATURE_LENGTH_IN_BYTES)));
      }
      const message = VersionedMessage.deserialize(new Uint8Array(byteArray));
      return new _VersionedTransaction(message, signatures);
    }
    static deserializeV1(serializedTransaction) {
      const numRequiredSignatures = serializedTransaction[1];
      const signaturesLength = numRequiredSignatures * SIGNATURE_LENGTH_IN_BYTES;
      const messageLength = serializedTransaction.length - signaturesLength;
      assert2(messageLength > 0, "Expected transaction to have enough bytes for its signatures");
      const message = VersionedMessage.deserialize(serializedTransaction.slice(0, messageLength));
      const signatures = [];
      for (let i2 = 0; i2 < numRequiredSignatures; i2++) {
        const offset2 = messageLength + i2 * SIGNATURE_LENGTH_IN_BYTES;
        signatures.push(serializedTransaction.slice(offset2, offset2 + SIGNATURE_LENGTH_IN_BYTES));
      }
      return new _VersionedTransaction(message, signatures);
    }
    sign(signers) {
      const messageData = this.message.serialize();
      const signerPubkeys = this.message.staticAccountKeys.slice(0, this.message.header.numRequiredSignatures);
      for (const signer of signers) {
        const signerIndex = signerPubkeys.findIndex((pubkey) => pubkey.equals(signer.publicKey));
        assert2(signerIndex >= 0, `Cannot sign with non signer key ${signer.publicKey.toBase58()}`);
        this.signatures[signerIndex] = sign(messageData, signer.secretKey);
      }
    }
    addSignature(publicKey3, signature2) {
      assert2(signature2.byteLength === 64, "Signature must be 64 bytes long");
      const signerPubkeys = this.message.staticAccountKeys.slice(0, this.message.header.numRequiredSignatures);
      const signerIndex = signerPubkeys.findIndex((pubkey) => pubkey.equals(publicKey3));
      assert2(signerIndex >= 0, `Can not add signature; \`${publicKey3.toBase58()}\` is not required to sign this transaction`);
      this.signatures[signerIndex] = signature2;
    }
  };
  var NUM_TICKS_PER_SECOND = 160;
  var DEFAULT_TICKS_PER_SLOT = 64;
  var NUM_SLOTS_PER_SECOND = NUM_TICKS_PER_SECOND / DEFAULT_TICKS_PER_SLOT;
  var MS_PER_SLOT = 1e3 / NUM_SLOTS_PER_SECOND;
  var SYSVAR_CLOCK_PUBKEY = new PublicKey("SysvarC1ock11111111111111111111111111111111");
  var SYSVAR_EPOCH_SCHEDULE_PUBKEY = new PublicKey("SysvarEpochSchedu1e111111111111111111111111");
  var SYSVAR_INSTRUCTIONS_PUBKEY = new PublicKey("Sysvar1nstructions1111111111111111111111111");
  var SYSVAR_RECENT_BLOCKHASHES_PUBKEY = new PublicKey("SysvarRecentB1ockHashes11111111111111111111");
  var SYSVAR_RENT_PUBKEY = new PublicKey("SysvarRent111111111111111111111111111111111");
  var SYSVAR_REWARDS_PUBKEY = new PublicKey("SysvarRewards111111111111111111111111111111");
  var SYSVAR_SLOT_HASHES_PUBKEY = new PublicKey("SysvarS1otHashes111111111111111111111111111");
  var SYSVAR_SLOT_HISTORY_PUBKEY = new PublicKey("SysvarS1otHistory11111111111111111111111111");
  var SYSVAR_STAKE_HISTORY_PUBKEY = new PublicKey("SysvarStakeHistory1111111111111111111111111");
  var SendTransactionError = class extends Error {
    constructor({
      action,
      signature: signature2,
      transactionMessage,
      logs
    }) {
      const maybeLogsOutput = logs ? `Logs: 
${JSON.stringify(logs.slice(-10), null, 2)}. ` : "";
      const guideText = "\nCatch the `SendTransactionError` and call `getLogs()` on it for full details.";
      let message;
      switch (action) {
        case "send":
          message = `Transaction ${signature2} resulted in an error. 
${transactionMessage}. ` + maybeLogsOutput + guideText;
          break;
        case "simulate":
          message = `Simulation failed. 
Message: ${transactionMessage}. 
` + maybeLogsOutput + guideText;
          break;
        default: {
          message = `Unknown action '${/* @__PURE__ */ ((a) => a)(action)}'`;
        }
      }
      super(message);
      this.signature = void 0;
      this.transactionMessage = void 0;
      this.transactionLogs = void 0;
      this.signature = signature2;
      this.transactionMessage = transactionMessage;
      this.transactionLogs = logs ? logs : void 0;
    }
    get transactionError() {
      return {
        message: this.transactionMessage,
        logs: Array.isArray(this.transactionLogs) ? this.transactionLogs : void 0
      };
    }
    /* @deprecated Use `await getLogs()` instead */
    get logs() {
      const cachedLogs = this.transactionLogs;
      if (cachedLogs != null && typeof cachedLogs === "object" && "then" in cachedLogs) {
        return void 0;
      }
      return cachedLogs;
    }
    async getLogs(connection) {
      if (!Array.isArray(this.transactionLogs)) {
        this.transactionLogs = new Promise((resolve, reject) => {
          connection.getTransaction(this.signature).then((tx) => {
            if (tx && tx.meta && tx.meta.logMessages) {
              const logs = tx.meta.logMessages;
              this.transactionLogs = logs;
              resolve(logs);
            } else {
              reject(new Error("Log messages not found"));
            }
          }).catch(reject);
        });
      }
      return await this.transactionLogs;
    }
  };
  var SolanaJSONRPCError = class extends Error {
    constructor({
      code,
      message,
      data
    }, customMessage) {
      super(customMessage != null ? `${customMessage}: ${message}` : message);
      this.code = void 0;
      this.data = void 0;
      this.code = code;
      this.data = data;
      this.name = "SolanaJSONRPCError";
    }
  };
  async function sendAndConfirmTransaction(connection, transaction, signers, options) {
    const sendOptions = options && {
      skipPreflight: options.skipPreflight,
      preflightCommitment: options.preflightCommitment || options.commitment,
      maxRetries: options.maxRetries,
      minContextSlot: options.minContextSlot
    };
    const signature2 = await connection.sendTransaction(transaction, signers, sendOptions);
    let status;
    if (transaction.recentBlockhash != null && transaction.lastValidBlockHeight != null) {
      status = (await connection.confirmTransaction({
        abortSignal: options?.abortSignal,
        signature: signature2,
        blockhash: transaction.recentBlockhash,
        lastValidBlockHeight: transaction.lastValidBlockHeight
      }, options && options.commitment)).value;
    } else if (transaction.minNonceContextSlot != null && transaction.nonceInfo != null) {
      const {
        nonceInstruction
      } = transaction.nonceInfo;
      const nonceAccountPubkey = nonceInstruction.keys[0].pubkey;
      status = (await connection.confirmTransaction({
        abortSignal: options?.abortSignal,
        minContextSlot: transaction.minNonceContextSlot,
        nonceAccountPubkey,
        nonceValue: transaction.nonceInfo.nonce,
        signature: signature2
      }, options && options.commitment)).value;
    } else {
      if (options?.abortSignal != null) {
        console.warn("sendAndConfirmTransaction(): A transaction with a deprecated confirmation strategy was supplied along with an `abortSignal`. Only transactions having `lastValidBlockHeight` or a combination of `nonceInfo` and `minNonceContextSlot` are abortable.");
      }
      status = (await connection.confirmTransaction(signature2, options && options.commitment)).value;
    }
    if (status.err) {
      if (signature2 != null) {
        throw new SendTransactionError({
          action: "send",
          signature: signature2,
          transactionMessage: `Status: (${JSON.stringify(status)})`
        });
      }
      throw new Error(`Transaction ${signature2} failed (${JSON.stringify(status)})`);
    }
    return signature2;
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function encodeData(type2, fields) {
    const allocLength = type2.layout.span >= 0 ? type2.layout.span : getAlloc(type2, fields);
    const data = import_buffer3.Buffer.alloc(allocLength);
    const layoutFields = Object.assign({
      instruction: type2.index
    }, fields);
    type2.layout.encode(layoutFields, data);
    return data;
  }
  var FeeCalculatorLayout = BufferLayout.nu64("lamportsPerSignature");
  var NonceAccountLayout = BufferLayout.struct([BufferLayout.u32("version"), BufferLayout.u32("state"), publicKey("authorizedPubkey"), publicKey("nonce"), BufferLayout.struct([FeeCalculatorLayout], "feeCalculator")]);
  var NONCE_ACCOUNT_LENGTH = NonceAccountLayout.span;
  var NonceAccount = class _NonceAccount {
    /**
     * @internal
     */
    constructor(args) {
      this.authorizedPubkey = void 0;
      this.nonce = void 0;
      this.feeCalculator = void 0;
      this.authorizedPubkey = args.authorizedPubkey;
      this.nonce = args.nonce;
      this.feeCalculator = args.feeCalculator;
    }
    /**
     * Deserialize NonceAccount from the account data.
     *
     * @param buffer account data
     * @return NonceAccount
     */
    static fromAccountData(buffer) {
      const nonceAccount = NonceAccountLayout.decode(toBuffer(buffer), 0);
      return new _NonceAccount({
        authorizedPubkey: new PublicKey(nonceAccount.authorizedPubkey),
        nonce: new PublicKey(nonceAccount.nonce).toString(),
        feeCalculator: nonceAccount.feeCalculator
      });
    }
  };
  function u64(property) {
    const layout = (0, import_buffer_layout.blob)(8, property);
    const decode = layout.decode.bind(layout);
    const encode = layout.encode.bind(layout);
    const bigIntLayout = layout;
    const codec = getU64Codec();
    bigIntLayout.decode = (buffer, offset2) => {
      const src = decode(buffer, offset2);
      return codec.decode(src);
    };
    bigIntLayout.encode = (bigInt2, buffer, offset2) => {
      const src = codec.encode(bigInt2);
      return encode(src, buffer, offset2);
    };
    return bigIntLayout;
  }
  var SYSTEM_INSTRUCTION_LAYOUTS = Object.freeze({
    Create: {
      index: 0,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), BufferLayout.ns64("lamports"), BufferLayout.ns64("space"), publicKey("programId")])
    },
    Assign: {
      index: 1,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), publicKey("programId")])
    },
    Transfer: {
      index: 2,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), u64("lamports")])
    },
    CreateWithSeed: {
      index: 3,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), publicKey("base"), rustString("seed"), BufferLayout.ns64("lamports"), BufferLayout.ns64("space"), publicKey("programId")])
    },
    AdvanceNonceAccount: {
      index: 4,
      layout: BufferLayout.struct([BufferLayout.u32("instruction")])
    },
    WithdrawNonceAccount: {
      index: 5,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), BufferLayout.ns64("lamports")])
    },
    InitializeNonceAccount: {
      index: 6,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), publicKey("authorized")])
    },
    AuthorizeNonceAccount: {
      index: 7,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), publicKey("authorized")])
    },
    Allocate: {
      index: 8,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), BufferLayout.ns64("space")])
    },
    AllocateWithSeed: {
      index: 9,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), publicKey("base"), rustString("seed"), BufferLayout.ns64("space"), publicKey("programId")])
    },
    AssignWithSeed: {
      index: 10,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), publicKey("base"), rustString("seed"), publicKey("programId")])
    },
    TransferWithSeed: {
      index: 11,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), u64("lamports"), rustString("seed"), publicKey("programId")])
    },
    UpgradeNonceAccount: {
      index: 12,
      layout: BufferLayout.struct([BufferLayout.u32("instruction")])
    }
  });
  var SystemProgram = class _SystemProgram {
    /**
     * @internal
     */
    constructor() {
    }
    /**
     * Public key that identifies the System program
     */
    /**
     * Generate a transaction instruction that creates a new account
     */
    static createAccount(params) {
      const type2 = SYSTEM_INSTRUCTION_LAYOUTS.Create;
      const data = encodeData(type2, {
        lamports: params.lamports,
        space: params.space,
        programId: toBuffer(params.programId.toBuffer())
      });
      return new TransactionInstruction({
        keys: [{
          pubkey: params.fromPubkey,
          isSigner: true,
          isWritable: true
        }, {
          pubkey: params.newAccountPubkey,
          isSigner: true,
          isWritable: true
        }],
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a transaction instruction that transfers lamports from one account to another
     */
    static transfer(params) {
      let data;
      let keys;
      if ("basePubkey" in params) {
        const type2 = SYSTEM_INSTRUCTION_LAYOUTS.TransferWithSeed;
        data = encodeData(type2, {
          lamports: BigInt(params.lamports),
          seed: params.seed,
          programId: toBuffer(params.programId.toBuffer())
        });
        keys = [{
          pubkey: params.fromPubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: params.basePubkey,
          isSigner: true,
          isWritable: false
        }, {
          pubkey: params.toPubkey,
          isSigner: false,
          isWritable: true
        }];
      } else {
        const type2 = SYSTEM_INSTRUCTION_LAYOUTS.Transfer;
        data = encodeData(type2, {
          lamports: BigInt(params.lamports)
        });
        keys = [{
          pubkey: params.fromPubkey,
          isSigner: true,
          isWritable: true
        }, {
          pubkey: params.toPubkey,
          isSigner: false,
          isWritable: true
        }];
      }
      return new TransactionInstruction({
        keys,
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a transaction instruction that assigns an account to a program
     */
    static assign(params) {
      let data;
      let keys;
      if ("basePubkey" in params) {
        const type2 = SYSTEM_INSTRUCTION_LAYOUTS.AssignWithSeed;
        data = encodeData(type2, {
          base: toBuffer(params.basePubkey.toBuffer()),
          seed: params.seed,
          programId: toBuffer(params.programId.toBuffer())
        });
        keys = [{
          pubkey: params.accountPubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: params.basePubkey,
          isSigner: true,
          isWritable: false
        }];
      } else {
        const type2 = SYSTEM_INSTRUCTION_LAYOUTS.Assign;
        data = encodeData(type2, {
          programId: toBuffer(params.programId.toBuffer())
        });
        keys = [{
          pubkey: params.accountPubkey,
          isSigner: true,
          isWritable: true
        }];
      }
      return new TransactionInstruction({
        keys,
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a transaction instruction that creates a new account at
     *   an address generated with `from`, a seed, and programId
     */
    static createAccountWithSeed(params) {
      const type2 = SYSTEM_INSTRUCTION_LAYOUTS.CreateWithSeed;
      const data = encodeData(type2, {
        base: toBuffer(params.basePubkey.toBuffer()),
        seed: params.seed,
        lamports: params.lamports,
        space: params.space,
        programId: toBuffer(params.programId.toBuffer())
      });
      let keys = [{
        pubkey: params.fromPubkey,
        isSigner: true,
        isWritable: true
      }, {
        pubkey: params.newAccountPubkey,
        isSigner: false,
        isWritable: true
      }];
      if (!params.basePubkey.equals(params.fromPubkey)) {
        keys.push({
          pubkey: params.basePubkey,
          isSigner: true,
          isWritable: false
        });
      }
      return new TransactionInstruction({
        keys,
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a transaction that creates a new Nonce account
     */
    static createNonceAccount(params) {
      const transaction = new Transaction();
      if ("basePubkey" in params && "seed" in params) {
        transaction.add(_SystemProgram.createAccountWithSeed({
          fromPubkey: params.fromPubkey,
          newAccountPubkey: params.noncePubkey,
          basePubkey: params.basePubkey,
          seed: params.seed,
          lamports: params.lamports,
          space: NONCE_ACCOUNT_LENGTH,
          programId: this.programId
        }));
      } else {
        transaction.add(_SystemProgram.createAccount({
          fromPubkey: params.fromPubkey,
          newAccountPubkey: params.noncePubkey,
          lamports: params.lamports,
          space: NONCE_ACCOUNT_LENGTH,
          programId: this.programId
        }));
      }
      const initParams = {
        noncePubkey: params.noncePubkey,
        authorizedPubkey: params.authorizedPubkey
      };
      transaction.add(this.nonceInitialize(initParams));
      return transaction;
    }
    /**
     * Generate an instruction to initialize a Nonce account
     */
    static nonceInitialize(params) {
      const type2 = SYSTEM_INSTRUCTION_LAYOUTS.InitializeNonceAccount;
      const data = encodeData(type2, {
        authorized: toBuffer(params.authorizedPubkey.toBuffer())
      });
      const instructionData = {
        keys: [{
          pubkey: params.noncePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_RENT_PUBKEY,
          isSigner: false,
          isWritable: false
        }],
        programId: this.programId,
        data
      };
      return new TransactionInstruction(instructionData);
    }
    /**
     * Generate an instruction to advance the nonce in a Nonce account
     */
    static nonceAdvance(params) {
      const type2 = SYSTEM_INSTRUCTION_LAYOUTS.AdvanceNonceAccount;
      const data = encodeData(type2);
      const instructionData = {
        keys: [{
          pubkey: params.noncePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: params.authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data
      };
      return new TransactionInstruction(instructionData);
    }
    /**
     * Generate a transaction instruction that withdraws lamports from a Nonce account
     */
    static nonceWithdraw(params) {
      const type2 = SYSTEM_INSTRUCTION_LAYOUTS.WithdrawNonceAccount;
      const data = encodeData(type2, {
        lamports: params.lamports
      });
      return new TransactionInstruction({
        keys: [{
          pubkey: params.noncePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: params.toPubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_RENT_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: params.authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a transaction instruction that authorizes a new PublicKey as the authority
     * on a Nonce account.
     */
    static nonceAuthorize(params) {
      const type2 = SYSTEM_INSTRUCTION_LAYOUTS.AuthorizeNonceAccount;
      const data = encodeData(type2, {
        authorized: toBuffer(params.newAuthorizedPubkey.toBuffer())
      });
      return new TransactionInstruction({
        keys: [{
          pubkey: params.noncePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: params.authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a transaction instruction that allocates space in an account without funding
     */
    static allocate(params) {
      let data;
      let keys;
      if ("basePubkey" in params) {
        const type2 = SYSTEM_INSTRUCTION_LAYOUTS.AllocateWithSeed;
        data = encodeData(type2, {
          base: toBuffer(params.basePubkey.toBuffer()),
          seed: params.seed,
          space: params.space,
          programId: toBuffer(params.programId.toBuffer())
        });
        keys = [{
          pubkey: params.accountPubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: params.basePubkey,
          isSigner: true,
          isWritable: false
        }];
      } else {
        const type2 = SYSTEM_INSTRUCTION_LAYOUTS.Allocate;
        data = encodeData(type2, {
          space: params.space
        });
        keys = [{
          pubkey: params.accountPubkey,
          isSigner: true,
          isWritable: true
        }];
      }
      return new TransactionInstruction({
        keys,
        programId: this.programId,
        data
      });
    }
  };
  SystemProgram.programId = new PublicKey("11111111111111111111111111111111");
  var CHUNK_SIZE = PACKET_DATA_SIZE - 300;
  var Loader = class _Loader {
    /**
     * @internal
     */
    constructor() {
    }
    /**
     * Amount of program data placed in each load Transaction
     */
    /**
     * Minimum number of signatures required to load a program not including
     * retries
     *
     * Can be used to calculate transaction fees
     */
    static getMinNumSignatures(dataLength) {
      return 2 * // Every transaction requires two signatures (payer + program)
      (Math.ceil(dataLength / _Loader.chunkSize) + 1 + // Add one for Create transaction
      1);
    }
    /**
     * Loads a generic program
     *
     * @param connection The connection to use
     * @param payer System account that pays to load the program
     * @param program Account to load the program into
     * @param programId Public key that identifies the loader
     * @param data Program octets
     * @return true if program was loaded successfully, false if program was already loaded
     */
    static async load(connection, payer, program, programId, data) {
      {
        const balanceNeeded = await connection.getMinimumBalanceForRentExemption(data.length);
        const programInfo = await connection.getAccountInfo(program.publicKey, "confirmed");
        let transaction = null;
        if (programInfo !== null) {
          if (programInfo.executable) {
            console.error("Program load failed, account is already executable");
            return false;
          }
          if (programInfo.data.length !== data.length) {
            transaction = transaction || new Transaction();
            transaction.add(SystemProgram.allocate({
              accountPubkey: program.publicKey,
              space: data.length
            }));
          }
          if (!programInfo.owner.equals(programId)) {
            transaction = transaction || new Transaction();
            transaction.add(SystemProgram.assign({
              accountPubkey: program.publicKey,
              programId
            }));
          }
          if (programInfo.lamports < balanceNeeded) {
            transaction = transaction || new Transaction();
            transaction.add(SystemProgram.transfer({
              fromPubkey: payer.publicKey,
              toPubkey: program.publicKey,
              lamports: balanceNeeded - programInfo.lamports
            }));
          }
        } else {
          transaction = new Transaction().add(SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: program.publicKey,
            lamports: balanceNeeded > 0 ? balanceNeeded : 1,
            space: data.length,
            programId
          }));
        }
        if (transaction !== null) {
          await sendAndConfirmTransaction(connection, transaction, [payer, program], {
            commitment: "confirmed"
          });
        }
      }
      const dataLayout = BufferLayout.struct([BufferLayout.u32("instruction"), BufferLayout.u32("offset"), BufferLayout.u32("bytesLength"), BufferLayout.u32("bytesLengthPadding"), BufferLayout.seq(BufferLayout.u8("byte"), BufferLayout.offset(BufferLayout.u32(), -8), "bytes")]);
      const chunkSize = _Loader.chunkSize;
      let offset2 = 0;
      let array2 = data;
      let transactions = [];
      while (array2.length > 0) {
        const bytes = array2.slice(0, chunkSize);
        const data2 = import_buffer3.Buffer.alloc(chunkSize + 16);
        dataLayout.encode({
          instruction: 0,
          // Load instruction
          offset: offset2,
          bytes,
          bytesLength: 0,
          bytesLengthPadding: 0
        }, data2);
        const transaction = new Transaction().add({
          keys: [{
            pubkey: program.publicKey,
            isSigner: true,
            isWritable: true
          }],
          programId,
          data: data2
        });
        transactions.push(sendAndConfirmTransaction(connection, transaction, [payer, program], {
          commitment: "confirmed"
        }));
        if (connection._rpcEndpoint.includes("solana.com")) {
          const REQUESTS_PER_SECOND = 4;
          await sleep(1e3 / REQUESTS_PER_SECOND);
        }
        offset2 += chunkSize;
        array2 = array2.slice(chunkSize);
      }
      await Promise.all(transactions);
      {
        const dataLayout2 = BufferLayout.struct([BufferLayout.u32("instruction")]);
        const data2 = import_buffer3.Buffer.alloc(dataLayout2.span);
        dataLayout2.encode({
          instruction: 1
          // Finalize instruction
        }, data2);
        const transaction = new Transaction().add({
          keys: [{
            pubkey: program.publicKey,
            isSigner: true,
            isWritable: true
          }, {
            pubkey: SYSVAR_RENT_PUBKEY,
            isSigner: false,
            isWritable: false
          }],
          programId,
          data: data2
        });
        const deployCommitment = "processed";
        const finalizeSignature = await connection.sendTransaction(transaction, [payer, program], {
          preflightCommitment: deployCommitment
        });
        const {
          context,
          value
        } = await connection.confirmTransaction({
          signature: finalizeSignature,
          lastValidBlockHeight: transaction.lastValidBlockHeight,
          blockhash: transaction.recentBlockhash
        }, deployCommitment);
        if (value.err) {
          throw new Error(`Transaction ${finalizeSignature} failed (${JSON.stringify(value)})`);
        }
        while (true) {
          try {
            const currentSlot = await connection.getSlot({
              commitment: deployCommitment
            });
            if (currentSlot > context.slot) {
              break;
            }
          } catch {
          }
          await new Promise((resolve) => setTimeout(resolve, Math.round(MS_PER_SLOT / 2)));
        }
      }
      return true;
    }
  };
  Loader.chunkSize = CHUNK_SIZE;
  var BPF_LOADER_PROGRAM_ID = new PublicKey("BPFLoader2111111111111111111111111111111111");
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var fastStableStringify$1;
  var hasRequiredFastStableStringify;
  function requireFastStableStringify() {
    if (hasRequiredFastStableStringify) return fastStableStringify$1;
    hasRequiredFastStableStringify = 1;
    var objToString = Object.prototype.toString;
    var objKeys = Object.keys || function(obj) {
      var keys = [];
      for (var name in obj) {
        keys.push(name);
      }
      return keys;
    };
    function stringify2(val, isArrayProp) {
      var i2, max, str, keys, key, propVal, toStr;
      if (val === true) {
        return "true";
      }
      if (val === false) {
        return "false";
      }
      switch (typeof val) {
        case "object":
          if (val === null) {
            return null;
          } else if (val.toJSON && typeof val.toJSON === "function") {
            return stringify2(val.toJSON(), isArrayProp);
          } else {
            toStr = objToString.call(val);
            if (toStr === "[object Array]") {
              str = "[";
              max = val.length - 1;
              for (i2 = 0; i2 < max; i2++) {
                str += stringify2(val[i2], true) + ",";
              }
              if (max > -1) {
                str += stringify2(val[i2], true);
              }
              return str + "]";
            } else if (toStr === "[object Object]") {
              keys = objKeys(val).sort();
              max = keys.length;
              str = "";
              i2 = 0;
              while (i2 < max) {
                key = keys[i2];
                propVal = stringify2(val[key], false);
                if (propVal !== void 0) {
                  if (str) {
                    str += ",";
                  }
                  str += JSON.stringify(key) + ":" + propVal;
                }
                i2++;
              }
              return "{" + str + "}";
            } else {
              return JSON.stringify(val);
            }
          }
        case "function":
        case "undefined":
          return isArrayProp ? null : void 0;
        case "string":
          return JSON.stringify(val);
        default:
          return isFinite(val) ? val : null;
      }
    }
    fastStableStringify$1 = function(val) {
      var returnVal = stringify2(val, false);
      if (returnVal !== void 0) {
        return "" + returnVal;
      }
    };
    return fastStableStringify$1;
  }
  var fastStableStringifyExports = /* @__PURE__ */ requireFastStableStringify();
  var fastStableStringify = /* @__PURE__ */ getDefaultExportFromCjs(fastStableStringifyExports);
  var MINIMUM_SLOT_PER_EPOCH = 32;
  function trailingZeros(n) {
    let trailingZeros2 = 0;
    while (n > 1) {
      n /= 2;
      trailingZeros2++;
    }
    return trailingZeros2;
  }
  function nextPowerOfTwo(n) {
    if (n === 0) return 1;
    n--;
    n |= n >> 1;
    n |= n >> 2;
    n |= n >> 4;
    n |= n >> 8;
    n |= n >> 16;
    n |= n >> 32;
    return n + 1;
  }
  var EpochSchedule = class {
    constructor(slotsPerEpoch, leaderScheduleSlotOffset, warmup, firstNormalEpoch, firstNormalSlot) {
      this.slotsPerEpoch = void 0;
      this.leaderScheduleSlotOffset = void 0;
      this.warmup = void 0;
      this.firstNormalEpoch = void 0;
      this.firstNormalSlot = void 0;
      this.slotsPerEpoch = slotsPerEpoch;
      this.leaderScheduleSlotOffset = leaderScheduleSlotOffset;
      this.warmup = warmup;
      this.firstNormalEpoch = firstNormalEpoch;
      this.firstNormalSlot = firstNormalSlot;
    }
    getEpoch(slot) {
      return this.getEpochAndSlotIndex(slot)[0];
    }
    getEpochAndSlotIndex(slot) {
      if (slot < this.firstNormalSlot) {
        const epoch = trailingZeros(nextPowerOfTwo(slot + MINIMUM_SLOT_PER_EPOCH + 1)) - trailingZeros(MINIMUM_SLOT_PER_EPOCH) - 1;
        const epochLen = this.getSlotsInEpoch(epoch);
        const slotIndex = slot - (epochLen - MINIMUM_SLOT_PER_EPOCH);
        return [epoch, slotIndex];
      } else {
        const normalSlotIndex = slot - this.firstNormalSlot;
        const normalEpochIndex = Math.floor(normalSlotIndex / this.slotsPerEpoch);
        const epoch = this.firstNormalEpoch + normalEpochIndex;
        const slotIndex = normalSlotIndex % this.slotsPerEpoch;
        return [epoch, slotIndex];
      }
    }
    getFirstSlotInEpoch(epoch) {
      if (epoch <= this.firstNormalEpoch) {
        return (Math.pow(2, epoch) - 1) * MINIMUM_SLOT_PER_EPOCH;
      } else {
        return (epoch - this.firstNormalEpoch) * this.slotsPerEpoch + this.firstNormalSlot;
      }
    }
    getLastSlotInEpoch(epoch) {
      return this.getFirstSlotInEpoch(epoch) + this.getSlotsInEpoch(epoch) - 1;
    }
    getSlotsInEpoch(epoch) {
      if (epoch < this.firstNormalEpoch) {
        return Math.pow(2, epoch + trailingZeros(MINIMUM_SLOT_PER_EPOCH));
      } else {
        return this.slotsPerEpoch;
      }
    }
  };
  var fetchImpl = globalThis.fetch;
  var RpcWebSocketClient = class extends CommonClient {
    constructor(address, options, generate_request_id) {
      const webSocketFactory = (url) => {
        const rpc = WebSocket(url, {
          autoconnect: true,
          max_reconnects: 5,
          reconnect: true,
          reconnect_interval: 1e3,
          ...options
        });
        if ("socket" in rpc) {
          this.underlyingSocket = rpc.socket;
        } else {
          this.underlyingSocket = rpc;
        }
        return rpc;
      };
      super(webSocketFactory, address, options, generate_request_id);
      this.underlyingSocket = void 0;
    }
    call(...args) {
      const readyState = this.underlyingSocket?.readyState;
      if (readyState === 1) {
        return super.call(...args);
      }
      return Promise.reject(new Error("Tried to call a JSON-RPC method `" + args[0] + "` but the socket was not `CONNECTING` or `OPEN` (`readyState` was " + readyState + ")"));
    }
    notify(...args) {
      const readyState = this.underlyingSocket?.readyState;
      if (readyState === 1) {
        return super.notify(...args);
      }
      return Promise.reject(new Error("Tried to send a JSON-RPC notification `" + args[0] + "` but the socket was not `CONNECTING` or `OPEN` (`readyState` was " + readyState + ")"));
    }
  };
  function decodeData(type2, data) {
    let decoded;
    try {
      decoded = type2.layout.decode(data);
    } catch (err) {
      throw new Error("invalid instruction; " + err);
    }
    if (decoded.typeIndex !== type2.index) {
      throw new Error(`invalid account data; account type mismatch ${decoded.typeIndex} != ${type2.index}`);
    }
    return decoded;
  }
  var LOOKUP_TABLE_META_SIZE = 56;
  var AddressLookupTableAccount = class {
    constructor(args) {
      this.key = void 0;
      this.state = void 0;
      this.key = args.key;
      this.state = args.state;
    }
    isActive() {
      const U64_MAX = BigInt("0xffffffffffffffff");
      return this.state.deactivationSlot === U64_MAX;
    }
    static deserialize(accountData) {
      const meta = decodeData(LookupTableMetaLayout, accountData);
      const serializedAddressesLen = accountData.length - LOOKUP_TABLE_META_SIZE;
      assert2(serializedAddressesLen >= 0, "lookup table is invalid");
      assert2(serializedAddressesLen % 32 === 0, "lookup table is invalid");
      const numSerializedAddresses = serializedAddressesLen / 32;
      const {
        addresses
      } = BufferLayout.struct([BufferLayout.seq(publicKey(), numSerializedAddresses, "addresses")]).decode(accountData.slice(LOOKUP_TABLE_META_SIZE));
      return {
        deactivationSlot: meta.deactivationSlot,
        lastExtendedSlot: meta.lastExtendedSlot,
        lastExtendedSlotStartIndex: meta.lastExtendedStartIndex,
        authority: meta.authority.length !== 0 ? new PublicKey(meta.authority[0]) : void 0,
        addresses: addresses.map((address) => new PublicKey(address))
      };
    }
  };
  var LookupTableMetaLayout = {
    index: 1,
    layout: BufferLayout.struct([
      BufferLayout.u32("typeIndex"),
      u64("deactivationSlot"),
      BufferLayout.nu64("lastExtendedSlot"),
      BufferLayout.u8("lastExtendedStartIndex"),
      BufferLayout.u8(),
      // option
      BufferLayout.seq(publicKey(), BufferLayout.offset(BufferLayout.u8(), -1), "authority")
    ])
  };
  var URL_RE = /^[^:]+:\/\/([^:[]+|\[[^\]]+\])(:\d+)?(.*)/i;
  function makeWebsocketUrl(endpoint) {
    const matches = endpoint.match(URL_RE);
    if (matches == null) {
      throw TypeError(`Failed to validate endpoint URL \`${endpoint}\``);
    }
    const [
      _,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      hostish,
      portWithColon,
      rest
    ] = matches;
    const protocol = endpoint.startsWith("https:") ? "wss:" : "ws:";
    const startPort = portWithColon == null ? null : parseInt(portWithColon.slice(1), 10);
    const websocketPort = (
      // Only shift the port by +1 as a convention for ws(s) only if given endpoint
      // is explicitly specifying the endpoint port (HTTP-based RPC), assuming
      // we're directly trying to connect to agave-validator's ws listening port.
      // When the endpoint omits the port, we're connecting to the protocol
      // default ports: http(80) or https(443) and it's assumed we're behind a reverse
      // proxy which manages WebSocket upgrade and backend port redirection.
      startPort == null ? "" : `:${startPort + 1}`
    );
    return `${protocol}//${hostish}${websocketPort}${rest}`;
  }
  var PublicKeyFromString = coerce(instance(PublicKey), string(), (value) => new PublicKey(value));
  var RawAccountDataResult = tuple([string(), literal("base64")]);
  var BufferFromRawAccountData = coerce(instance(import_buffer3.Buffer), RawAccountDataResult, (value) => import_buffer3.Buffer.from(value[0], "base64"));
  var BLOCKHASH_CACHE_TIMEOUT_MS = 30 * 1e3;
  function assertEndpointUrl(putativeUrl) {
    if (/^https?:/.test(putativeUrl) === false) {
      throw new TypeError("Endpoint URL must start with `http:` or `https:`.");
    }
    return putativeUrl;
  }
  function extractCommitmentFromConfig(commitmentOrConfig) {
    let commitment;
    let config;
    if (typeof commitmentOrConfig === "string") {
      commitment = commitmentOrConfig;
    } else if (commitmentOrConfig) {
      const {
        commitment: specifiedCommitment,
        ...specifiedConfig
      } = commitmentOrConfig;
      commitment = specifiedCommitment;
      config = specifiedConfig;
    }
    return {
      commitment,
      config
    };
  }
  function applyDefaultMemcmpEncodingToFilters(filters) {
    return filters.map((filter) => "memcmp" in filter ? {
      ...filter,
      memcmp: {
        ...filter.memcmp,
        encoding: filter.memcmp.encoding ?? "base58"
      }
    } : filter);
  }
  function createRpcResult(result) {
    return union([type({
      jsonrpc: literal("2.0"),
      id: string(),
      result
    }), type({
      jsonrpc: literal("2.0"),
      id: string(),
      error: type({
        code: unknown(),
        message: string(),
        data: optional(any())
      })
    })]);
  }
  var UnknownRpcResult = createRpcResult(unknown());
  function jsonRpcResult(schema) {
    return coerce(createRpcResult(schema), UnknownRpcResult, (value) => {
      if ("error" in value) {
        return value;
      } else {
        return {
          ...value,
          result: create(value.result, schema)
        };
      }
    });
  }
  function jsonRpcResultAndContext(value) {
    return jsonRpcResult(type({
      context: type({
        slot: number()
      }),
      value
    }));
  }
  function notificationResultAndContext(value) {
    return type({
      context: type({
        slot: number()
      }),
      value
    });
  }
  function versionedMessageFromResponse(version2, response) {
    if (version2 === 0) {
      return new MessageV0({
        header: response.header,
        staticAccountKeys: response.accountKeys.map((accountKey) => new PublicKey(accountKey)),
        recentBlockhash: response.recentBlockhash,
        compiledInstructions: response.instructions.map((ix) => ({
          programIdIndex: ix.programIdIndex,
          accountKeyIndexes: ix.accounts,
          data: import_bs58.default.decode(ix.data)
        })),
        addressTableLookups: response.addressTableLookups
      });
    } else if (version2 === 1) {
      const transactionConfig = response.transactionConfig;
      if (transactionConfig == null) {
        throw new Error("Expected a version 1 transaction message response to have a `transactionConfig`");
      }
      return new MessageV1({
        header: response.header,
        staticAccountKeys: response.accountKeys.map((accountKey) => new PublicKey(accountKey)),
        recentBlockhash: response.recentBlockhash,
        compiledInstructions: response.instructions.map((ix) => ({
          programIdIndex: ix.programIdIndex,
          accountKeyIndexes: ix.accounts,
          data: import_bs58.default.decode(ix.data)
        })),
        transactionConfig
      });
    } else {
      return new Message(response);
    }
  }
  var GetInflationGovernorResult = type({
    foundation: number(),
    foundationTerm: number(),
    initial: number(),
    taper: number(),
    terminal: number()
  });
  var GetInflationRewardResult = jsonRpcResult(array(nullable(type({
    epoch: number(),
    effectiveSlot: number(),
    amount: number(),
    postBalance: number(),
    commission: optional(nullable(number()))
  }))));
  var GetRecentPrioritizationFeesResult = array(type({
    slot: number(),
    prioritizationFee: number()
  }));
  var GetInflationRateResult = type({
    total: number(),
    validator: number(),
    foundation: number(),
    epoch: number()
  });
  var GetEpochInfoResult = type({
    epoch: number(),
    slotIndex: number(),
    slotsInEpoch: number(),
    absoluteSlot: number(),
    blockHeight: optional(number()),
    transactionCount: optional(number())
  });
  var GetEpochScheduleResult = type({
    slotsPerEpoch: number(),
    leaderScheduleSlotOffset: number(),
    warmup: boolean(),
    firstNormalEpoch: number(),
    firstNormalSlot: number()
  });
  var GetLeaderScheduleResult = record(string(), array(number()));
  var TransactionErrorResult = nullable(union([type({}), string()]));
  var SignatureStatusResult = type({
    err: TransactionErrorResult
  });
  var SignatureReceivedResult = literal("receivedSignature");
  var VersionResult = type({
    "solana-core": string(),
    "feature-set": optional(number())
  });
  var ParsedInstructionStruct = type({
    program: string(),
    programId: PublicKeyFromString,
    parsed: unknown()
  });
  var PartiallyDecodedInstructionStruct = type({
    programId: PublicKeyFromString,
    accounts: array(PublicKeyFromString),
    data: string()
  });
  var SimulatedTransactionResponseStruct = jsonRpcResultAndContext(type({
    err: nullable(union([type({}), string()])),
    logs: nullable(array(string())),
    accounts: optional(nullable(array(nullable(type({
      executable: boolean(),
      owner: string(),
      lamports: number(),
      data: array(string()),
      rentEpoch: optional(number())
    }))))),
    unitsConsumed: optional(number()),
    returnData: optional(nullable(type({
      programId: string(),
      data: tuple([string(), literal("base64")])
    }))),
    innerInstructions: optional(nullable(array(type({
      index: number(),
      instructions: array(union([ParsedInstructionStruct, PartiallyDecodedInstructionStruct]))
    }))))
  }));
  var BlockProductionResponseStruct = jsonRpcResultAndContext(type({
    byIdentity: record(string(), array(number())),
    range: type({
      firstSlot: number(),
      lastSlot: number()
    })
  }));
  function createRpcClient(url, httpHeaders, customFetch, fetchMiddleware, disableRetryOnRateLimit, httpAgent) {
    const fetch2 = customFetch ? customFetch : fetchImpl;
    let agent;
    {
      if (httpAgent != null) {
        console.warn("You have supplied an `httpAgent` when creating a `Connection` in a browser environment.It has been ignored; `httpAgent` is only used in Node environments.");
      }
    }
    let fetchWithMiddleware;
    if (fetchMiddleware) {
      fetchWithMiddleware = async (info, init) => {
        const modifiedFetchArgs = await new Promise((resolve, reject) => {
          try {
            fetchMiddleware(info, init, (modifiedInfo, modifiedInit) => resolve([modifiedInfo, modifiedInit]));
          } catch (error) {
            reject(error);
          }
        });
        return await fetch2(...modifiedFetchArgs);
      };
    }
    const clientBrowser = new import_browser.default(async (request, callback) => {
      const options = {
        method: "POST",
        body: request,
        agent,
        headers: Object.assign({
          "Content-Type": "application/json"
        }, httpHeaders || {}, COMMON_HTTP_HEADERS)
      };
      try {
        let too_many_requests_retries = 5;
        let res;
        let waitTime = 500;
        for (; ; ) {
          if (fetchWithMiddleware) {
            res = await fetchWithMiddleware(url, options);
          } else {
            res = await fetch2(url, options);
          }
          if (res.status !== 429) {
            break;
          }
          if (disableRetryOnRateLimit === true) {
            break;
          }
          too_many_requests_retries -= 1;
          if (too_many_requests_retries === 0) {
            break;
          }
          console.error(`Server responded with ${res.status} ${res.statusText}.  Retrying after ${waitTime}ms delay...`);
          await sleep(waitTime);
          waitTime *= 2;
        }
        const text = await res.text();
        if (res.ok) {
          callback(null, text);
        } else {
          callback(new Error(`${res.status} ${res.statusText}: ${text}`));
        }
      } catch (err) {
        if (err instanceof Error) callback(err);
      }
    }, {});
    return clientBrowser;
  }
  function createRpcRequest(client) {
    return (method, args) => {
      return new Promise((resolve, reject) => {
        client.request(method, args, (err, response) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(response);
        });
      });
    };
  }
  function createRpcBatchRequest(client) {
    return (requests) => {
      return new Promise((resolve, reject) => {
        if (requests.length === 0) resolve([]);
        const batch = requests.map((params) => {
          return client.request(params.methodName, params.args);
        });
        client.request(batch, (err, response) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(response);
        });
      });
    };
  }
  var GetInflationGovernorRpcResult = jsonRpcResult(GetInflationGovernorResult);
  var GetInflationRateRpcResult = jsonRpcResult(GetInflationRateResult);
  var GetRecentPrioritizationFeesRpcResult = jsonRpcResult(GetRecentPrioritizationFeesResult);
  var GetEpochInfoRpcResult = jsonRpcResult(GetEpochInfoResult);
  var GetEpochScheduleRpcResult = jsonRpcResult(GetEpochScheduleResult);
  var GetLeaderScheduleRpcResult = jsonRpcResult(GetLeaderScheduleResult);
  var SlotRpcResult = jsonRpcResult(number());
  var GetSupplyRpcResult = jsonRpcResultAndContext(type({
    total: number(),
    circulating: number(),
    nonCirculating: number(),
    nonCirculatingAccounts: array(PublicKeyFromString)
  }));
  var TokenAmountResult = type({
    amount: string(),
    uiAmount: nullable(number()),
    decimals: number(),
    uiAmountString: optional(string())
  });
  var GetTokenLargestAccountsResult = jsonRpcResultAndContext(array(type({
    address: PublicKeyFromString,
    amount: string(),
    uiAmount: nullable(number()),
    decimals: number(),
    uiAmountString: optional(string())
  })));
  var GetTokenAccountsByOwner = jsonRpcResultAndContext(array(type({
    pubkey: PublicKeyFromString,
    account: type({
      executable: boolean(),
      owner: PublicKeyFromString,
      lamports: number(),
      data: BufferFromRawAccountData,
      rentEpoch: number()
    })
  })));
  var ParsedAccountDataResult = type({
    program: string(),
    parsed: unknown(),
    space: number()
  });
  var GetParsedTokenAccountsByOwner = jsonRpcResultAndContext(array(type({
    pubkey: PublicKeyFromString,
    account: type({
      executable: boolean(),
      owner: PublicKeyFromString,
      lamports: number(),
      data: ParsedAccountDataResult,
      rentEpoch: number()
    })
  })));
  var GetLargestAccountsRpcResult = jsonRpcResultAndContext(array(type({
    lamports: number(),
    address: PublicKeyFromString
  })));
  var AccountInfoResult = type({
    executable: boolean(),
    owner: PublicKeyFromString,
    lamports: number(),
    data: BufferFromRawAccountData,
    rentEpoch: number()
  });
  var KeyedAccountInfoResult = type({
    pubkey: PublicKeyFromString,
    account: AccountInfoResult
  });
  var ParsedOrRawAccountData = coerce(union([instance(import_buffer3.Buffer), ParsedAccountDataResult]), union([RawAccountDataResult, ParsedAccountDataResult]), (value) => {
    if (Array.isArray(value)) {
      return create(value, BufferFromRawAccountData);
    } else {
      return value;
    }
  });
  var ParsedAccountInfoResult = type({
    executable: boolean(),
    owner: PublicKeyFromString,
    lamports: number(),
    data: ParsedOrRawAccountData,
    rentEpoch: number()
  });
  var KeyedParsedAccountInfoResult = type({
    pubkey: PublicKeyFromString,
    account: ParsedAccountInfoResult
  });
  var StakeActivationResult = type({
    state: union([literal("active"), literal("inactive"), literal("activating"), literal("deactivating")]),
    active: number(),
    inactive: number()
  });
  var GetConfirmedSignaturesForAddress2RpcResult = jsonRpcResult(array(type({
    signature: string(),
    slot: number(),
    err: TransactionErrorResult,
    memo: nullable(string()),
    blockTime: optional(nullable(number()))
  })));
  var GetSignaturesForAddressRpcResult = jsonRpcResult(array(type({
    signature: string(),
    slot: number(),
    err: TransactionErrorResult,
    memo: nullable(string()),
    blockTime: optional(nullable(number()))
  })));
  var AccountNotificationResult = type({
    subscription: number(),
    result: notificationResultAndContext(AccountInfoResult)
  });
  var ProgramAccountInfoResult = type({
    pubkey: PublicKeyFromString,
    account: AccountInfoResult
  });
  var ProgramAccountNotificationResult = type({
    subscription: number(),
    result: notificationResultAndContext(ProgramAccountInfoResult)
  });
  var SlotInfoResult = type({
    parent: number(),
    slot: number(),
    root: number()
  });
  var SlotNotificationResult = type({
    subscription: number(),
    result: SlotInfoResult
  });
  var SlotUpdateResult = union([type({
    type: union([literal("firstShredReceived"), literal("completed"), literal("optimisticConfirmation"), literal("root")]),
    slot: number(),
    timestamp: number()
  }), type({
    type: literal("createdBank"),
    parent: number(),
    slot: number(),
    timestamp: number()
  }), type({
    type: literal("frozen"),
    slot: number(),
    timestamp: number(),
    stats: type({
      numTransactionEntries: number(),
      numSuccessfulTransactions: number(),
      numFailedTransactions: number(),
      maxTransactionsPerEntry: number()
    })
  }), type({
    type: literal("dead"),
    slot: number(),
    timestamp: number(),
    err: string()
  })]);
  var SlotUpdateNotificationResult = type({
    subscription: number(),
    result: SlotUpdateResult
  });
  var SignatureNotificationResult = type({
    subscription: number(),
    result: notificationResultAndContext(union([SignatureStatusResult, SignatureReceivedResult]))
  });
  var RootNotificationResult = type({
    subscription: number(),
    result: number()
  });
  var ContactInfoResult = type({
    pubkey: string(),
    gossip: nullable(string()),
    tpu: nullable(string()),
    rpc: nullable(string()),
    version: nullable(string())
  });
  var VoteAccountInfoResult = type({
    votePubkey: string(),
    nodePubkey: string(),
    activatedStake: number(),
    epochVoteAccount: boolean(),
    epochCredits: array(tuple([number(), number(), number()])),
    commission: number(),
    lastVote: number(),
    rootSlot: nullable(number())
  });
  var GetVoteAccounts = jsonRpcResult(type({
    current: array(VoteAccountInfoResult),
    delinquent: array(VoteAccountInfoResult)
  }));
  var ConfirmationStatus = union([literal("processed"), literal("confirmed"), literal("finalized")]);
  var SignatureStatusResponse = type({
    slot: number(),
    confirmations: nullable(number()),
    err: TransactionErrorResult,
    confirmationStatus: optional(ConfirmationStatus)
  });
  var GetSignatureStatusesRpcResult = jsonRpcResultAndContext(array(nullable(SignatureStatusResponse)));
  var GetMinimumBalanceForRentExemptionRpcResult = jsonRpcResult(number());
  var AddressTableLookupStruct = type({
    accountKey: PublicKeyFromString,
    writableIndexes: array(number()),
    readonlyIndexes: array(number())
  });
  var TransactionConfigResult = type({
    computeUnitLimit: nullable(number()),
    heapSize: nullable(number()),
    loadedAccountsDataSizeLimit: nullable(number()),
    priorityFee: nullable(number())
  });
  var ConfirmedTransactionResult = type({
    signatures: array(string()),
    message: type({
      accountKeys: array(string()),
      header: type({
        numRequiredSignatures: number(),
        numReadonlySignedAccounts: number(),
        numReadonlyUnsignedAccounts: number()
      }),
      instructions: array(type({
        accounts: array(number()),
        data: string(),
        programIdIndex: number()
      })),
      recentBlockhash: string(),
      addressTableLookups: optional(array(AddressTableLookupStruct)),
      transactionConfig: optional(nullable(TransactionConfigResult))
    })
  });
  var AnnotatedAccountKey = type({
    pubkey: PublicKeyFromString,
    signer: boolean(),
    writable: boolean(),
    source: optional(union([literal("transaction"), literal("lookupTable")]))
  });
  var ConfirmedTransactionAccountsModeResult = type({
    accountKeys: array(AnnotatedAccountKey),
    signatures: array(string())
  });
  var ParsedInstructionResult = type({
    parsed: unknown(),
    program: string(),
    programId: PublicKeyFromString
  });
  var RawInstructionResult = type({
    accounts: array(PublicKeyFromString),
    data: string(),
    programId: PublicKeyFromString
  });
  var InstructionResult = union([RawInstructionResult, ParsedInstructionResult]);
  var UnknownInstructionResult = union([type({
    parsed: unknown(),
    program: string(),
    programId: string()
  }), type({
    accounts: array(string()),
    data: string(),
    programId: string()
  })]);
  var ParsedOrRawInstruction = coerce(InstructionResult, UnknownInstructionResult, (value) => {
    if ("accounts" in value) {
      return create(value, RawInstructionResult);
    } else {
      return create(value, ParsedInstructionResult);
    }
  });
  var ParsedConfirmedTransactionResult = type({
    signatures: array(string()),
    message: type({
      accountKeys: array(AnnotatedAccountKey),
      instructions: array(ParsedOrRawInstruction),
      recentBlockhash: string(),
      addressTableLookups: optional(nullable(array(AddressTableLookupStruct))),
      transactionConfig: optional(nullable(TransactionConfigResult))
    })
  });
  var TokenBalanceResult = type({
    accountIndex: number(),
    mint: string(),
    owner: optional(string()),
    programId: optional(string()),
    uiTokenAmount: TokenAmountResult
  });
  var LoadedAddressesResult = type({
    writable: array(PublicKeyFromString),
    readonly: array(PublicKeyFromString)
  });
  var ConfirmedTransactionMetaResult = type({
    err: TransactionErrorResult,
    fee: number(),
    innerInstructions: optional(nullable(array(type({
      index: number(),
      instructions: array(type({
        accounts: array(number()),
        data: string(),
        programIdIndex: number()
      }))
    })))),
    preBalances: array(number()),
    postBalances: array(number()),
    logMessages: optional(nullable(array(string()))),
    preTokenBalances: optional(nullable(array(TokenBalanceResult))),
    postTokenBalances: optional(nullable(array(TokenBalanceResult))),
    loadedAddresses: optional(LoadedAddressesResult),
    computeUnitsConsumed: optional(number()),
    costUnits: optional(number())
  });
  var ParsedConfirmedTransactionMetaResult = type({
    err: TransactionErrorResult,
    fee: number(),
    innerInstructions: optional(nullable(array(type({
      index: number(),
      instructions: array(ParsedOrRawInstruction)
    })))),
    preBalances: array(number()),
    postBalances: array(number()),
    logMessages: optional(nullable(array(string()))),
    preTokenBalances: optional(nullable(array(TokenBalanceResult))),
    postTokenBalances: optional(nullable(array(TokenBalanceResult))),
    loadedAddresses: optional(LoadedAddressesResult),
    computeUnitsConsumed: optional(number()),
    costUnits: optional(number())
  });
  var TransactionVersionStruct = union([literal(0), literal(1), literal("legacy")]);
  var RewardsResult = type({
    pubkey: string(),
    lamports: number(),
    postBalance: nullable(number()),
    rewardType: nullable(string()),
    commission: optional(nullable(number()))
  });
  var GetBlockRpcResult = jsonRpcResult(nullable(type({
    blockhash: string(),
    previousBlockhash: string(),
    parentSlot: number(),
    transactions: array(type({
      transaction: ConfirmedTransactionResult,
      meta: nullable(ConfirmedTransactionMetaResult),
      version: optional(TransactionVersionStruct)
    })),
    rewards: optional(array(RewardsResult)),
    blockTime: nullable(number()),
    blockHeight: nullable(number())
  })));
  var GetNoneModeBlockRpcResult = jsonRpcResult(nullable(type({
    blockhash: string(),
    previousBlockhash: string(),
    parentSlot: number(),
    rewards: optional(array(RewardsResult)),
    blockTime: nullable(number()),
    blockHeight: nullable(number())
  })));
  var GetAccountsModeBlockRpcResult = jsonRpcResult(nullable(type({
    blockhash: string(),
    previousBlockhash: string(),
    parentSlot: number(),
    transactions: array(type({
      transaction: ConfirmedTransactionAccountsModeResult,
      meta: nullable(ConfirmedTransactionMetaResult),
      version: optional(TransactionVersionStruct)
    })),
    rewards: optional(array(RewardsResult)),
    blockTime: nullable(number()),
    blockHeight: nullable(number())
  })));
  var GetParsedBlockRpcResult = jsonRpcResult(nullable(type({
    blockhash: string(),
    previousBlockhash: string(),
    parentSlot: number(),
    transactions: array(type({
      transaction: ParsedConfirmedTransactionResult,
      meta: nullable(ParsedConfirmedTransactionMetaResult),
      version: optional(TransactionVersionStruct)
    })),
    rewards: optional(array(RewardsResult)),
    blockTime: nullable(number()),
    blockHeight: nullable(number())
  })));
  var GetParsedAccountsModeBlockRpcResult = jsonRpcResult(nullable(type({
    blockhash: string(),
    previousBlockhash: string(),
    parentSlot: number(),
    transactions: array(type({
      transaction: ConfirmedTransactionAccountsModeResult,
      meta: nullable(ParsedConfirmedTransactionMetaResult),
      version: optional(TransactionVersionStruct)
    })),
    rewards: optional(array(RewardsResult)),
    blockTime: nullable(number()),
    blockHeight: nullable(number())
  })));
  var GetParsedNoneModeBlockRpcResult = jsonRpcResult(nullable(type({
    blockhash: string(),
    previousBlockhash: string(),
    parentSlot: number(),
    rewards: optional(array(RewardsResult)),
    blockTime: nullable(number()),
    blockHeight: nullable(number())
  })));
  var GetConfirmedBlockRpcResult = jsonRpcResult(nullable(type({
    blockhash: string(),
    previousBlockhash: string(),
    parentSlot: number(),
    transactions: array(type({
      transaction: ConfirmedTransactionResult,
      meta: nullable(ConfirmedTransactionMetaResult)
    })),
    rewards: optional(array(RewardsResult)),
    blockTime: nullable(number())
  })));
  var GetBlockSignaturesRpcResult = jsonRpcResult(nullable(type({
    blockhash: string(),
    previousBlockhash: string(),
    parentSlot: number(),
    signatures: array(string()),
    blockTime: nullable(number())
  })));
  var GetTransactionRpcResult = jsonRpcResult(nullable(type({
    slot: number(),
    meta: nullable(ConfirmedTransactionMetaResult),
    blockTime: optional(nullable(number())),
    transaction: ConfirmedTransactionResult,
    version: optional(TransactionVersionStruct)
  })));
  var GetParsedTransactionRpcResult = jsonRpcResult(nullable(type({
    slot: number(),
    transaction: ParsedConfirmedTransactionResult,
    meta: nullable(ParsedConfirmedTransactionMetaResult),
    blockTime: optional(nullable(number())),
    version: optional(TransactionVersionStruct)
  })));
  var GetLatestBlockhashRpcResult = jsonRpcResultAndContext(type({
    blockhash: string(),
    lastValidBlockHeight: number()
  }));
  var IsBlockhashValidRpcResult = jsonRpcResultAndContext(boolean());
  var PerfSampleResult = type({
    slot: number(),
    numTransactions: number(),
    numSlots: number(),
    samplePeriodSecs: number()
  });
  var GetRecentPerformanceSamplesRpcResult = jsonRpcResult(array(PerfSampleResult));
  var GetFeeCalculatorRpcResult = jsonRpcResultAndContext(nullable(type({
    feeCalculator: type({
      lamportsPerSignature: number()
    })
  })));
  var RequestAirdropRpcResult = jsonRpcResult(string());
  var SendTransactionRpcResult = jsonRpcResult(string());
  var LogsResult = type({
    err: TransactionErrorResult,
    logs: array(string()),
    signature: string()
  });
  var LogsNotificationResult = type({
    result: notificationResultAndContext(LogsResult),
    subscription: number()
  });
  var COMMON_HTTP_HEADERS = {
    "solana-client": `js/${"1.99.0"}`
  };
  var Connection = class {
    /**
     * Establish a JSON RPC connection
     *
     * @param endpoint URL to the fullnode JSON RPC endpoint
     * @param commitmentOrConfig optional default commitment level or optional ConnectionConfig configuration object
     */
    constructor(endpoint, _commitmentOrConfig) {
      this._commitment = void 0;
      this._confirmTransactionInitialTimeout = void 0;
      this._rpcEndpoint = void 0;
      this._rpcWsEndpoint = void 0;
      this._rpcClient = void 0;
      this._rpcRequest = void 0;
      this._rpcBatchRequest = void 0;
      this._rpcWebSocket = void 0;
      this._rpcWebSocketConnected = false;
      this._rpcWebSocketHeartbeat = null;
      this._rpcWebSocketIdleTimeout = null;
      this._rpcWebSocketGeneration = 0;
      this._disableBlockhashCaching = false;
      this._pollingBlockhash = false;
      this._blockhashInfo = {
        latestBlockhash: null,
        lastFetch: 0,
        transactionSignatures: [],
        simulatedSignatures: []
      };
      this._nextClientSubscriptionId = 0;
      this._subscriptionDisposeFunctionsByClientSubscriptionId = {};
      this._subscriptionHashByClientSubscriptionId = {};
      this._subscriptionStateChangeCallbacksByHash = {};
      this._subscriptionCallbacksByServerSubscriptionId = {};
      this._subscriptionsByHash = {};
      this._subscriptionsAutoDisposedByRpc = /* @__PURE__ */ new Set();
      this.getBlockHeight = /* @__PURE__ */ (() => {
        const requestPromises = {};
        return async (commitmentOrConfig) => {
          const {
            commitment,
            config
          } = extractCommitmentFromConfig(commitmentOrConfig);
          const args = this._buildArgs([], commitment, void 0, config);
          const requestHash = fastStableStringify(args);
          requestPromises[requestHash] = requestPromises[requestHash] ?? (async () => {
            try {
              const unsafeRes = await this._rpcRequest("getBlockHeight", args);
              const res = create(unsafeRes, jsonRpcResult(number()));
              if ("error" in res) {
                throw new SolanaJSONRPCError(res.error, "failed to get block height information");
              }
              return res.result;
            } finally {
              delete requestPromises[requestHash];
            }
          })();
          return await requestPromises[requestHash];
        };
      })();
      let wsEndpoint;
      let httpHeaders;
      let fetch2;
      let fetchMiddleware;
      let disableRetryOnRateLimit;
      let httpAgent;
      if (_commitmentOrConfig && typeof _commitmentOrConfig === "string") {
        this._commitment = _commitmentOrConfig;
      } else if (_commitmentOrConfig) {
        this._commitment = _commitmentOrConfig.commitment;
        this._confirmTransactionInitialTimeout = _commitmentOrConfig.confirmTransactionInitialTimeout;
        wsEndpoint = _commitmentOrConfig.wsEndpoint;
        httpHeaders = _commitmentOrConfig.httpHeaders;
        fetch2 = _commitmentOrConfig.fetch;
        fetchMiddleware = _commitmentOrConfig.fetchMiddleware;
        disableRetryOnRateLimit = _commitmentOrConfig.disableRetryOnRateLimit;
        httpAgent = _commitmentOrConfig.httpAgent;
      }
      this._rpcEndpoint = assertEndpointUrl(endpoint);
      this._rpcWsEndpoint = wsEndpoint || makeWebsocketUrl(endpoint);
      this._rpcClient = createRpcClient(endpoint, httpHeaders, fetch2, fetchMiddleware, disableRetryOnRateLimit, httpAgent);
      this._rpcRequest = createRpcRequest(this._rpcClient);
      this._rpcBatchRequest = createRpcBatchRequest(this._rpcClient);
      this._rpcWebSocket = new RpcWebSocketClient(this._rpcWsEndpoint, {
        autoconnect: false,
        max_reconnects: Infinity
      });
      this._rpcWebSocket.on("open", this._wsOnOpen.bind(this));
      this._rpcWebSocket.on("error", this._wsOnError.bind(this));
      this._rpcWebSocket.on("close", this._wsOnClose.bind(this));
      this._rpcWebSocket.on("accountNotification", this._wsOnAccountNotification.bind(this));
      this._rpcWebSocket.on("programNotification", this._wsOnProgramAccountNotification.bind(this));
      this._rpcWebSocket.on("slotNotification", this._wsOnSlotNotification.bind(this));
      this._rpcWebSocket.on("slotsUpdatesNotification", this._wsOnSlotUpdatesNotification.bind(this));
      this._rpcWebSocket.on("signatureNotification", this._wsOnSignatureNotification.bind(this));
      this._rpcWebSocket.on("rootNotification", this._wsOnRootNotification.bind(this));
      this._rpcWebSocket.on("logsNotification", this._wsOnLogsNotification.bind(this));
    }
    /**
     * The default commitment used for requests
     */
    get commitment() {
      return this._commitment;
    }
    /**
     * The RPC endpoint
     */
    get rpcEndpoint() {
      return this._rpcEndpoint;
    }
    /**
     * Fetch the balance for the specified public key, return with context
     */
    async getBalanceAndContext(publicKey3, commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs([publicKey3.toBase58()], commitment, void 0, config);
      const unsafeRes = await this._rpcRequest("getBalance", args);
      const res = create(unsafeRes, jsonRpcResultAndContext(number()));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get balance for ${publicKey3.toBase58()}`);
      }
      return res.result;
    }
    /**
     * Fetch the balance for the specified public key
     */
    async getBalance(publicKey3, commitmentOrConfig) {
      return await this.getBalanceAndContext(publicKey3, commitmentOrConfig).then((x) => x.value).catch((e) => {
        throw new Error("failed to get balance of account " + publicKey3.toBase58() + ": " + e);
      });
    }
    /**
     * Fetch the estimated production time of a block
     */
    async getBlockTime(slot) {
      const unsafeRes = await this._rpcRequest("getBlockTime", [slot]);
      const res = create(unsafeRes, jsonRpcResult(nullable(number())));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get block time for slot ${slot}`);
      }
      return res.result;
    }
    /**
     * Fetch the lowest slot that the node has information about in its ledger.
     * This value may increase over time if the node is configured to purge older ledger data
     */
    async getMinimumLedgerSlot() {
      const unsafeRes = await this._rpcRequest("minimumLedgerSlot", []);
      const res = create(unsafeRes, jsonRpcResult(number()));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get minimum ledger slot");
      }
      return res.result;
    }
    /**
     * Fetch the slot of the lowest confirmed block that has not been purged from the ledger
     */
    async getFirstAvailableBlock() {
      const unsafeRes = await this._rpcRequest("getFirstAvailableBlock", []);
      const res = create(unsafeRes, SlotRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get first available block");
      }
      return res.result;
    }
    /**
     * Fetch information about the current supply
     */
    async getSupply(config) {
      let configArg = {};
      if (typeof config === "string") {
        configArg = {
          commitment: config
        };
      } else if (config) {
        configArg = {
          ...config,
          commitment: config && config.commitment || this.commitment
        };
      } else {
        configArg = {
          commitment: this.commitment
        };
      }
      const unsafeRes = await this._rpcRequest("getSupply", [configArg]);
      const res = create(unsafeRes, GetSupplyRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get supply");
      }
      return res.result;
    }
    /**
     * Fetch the current supply of a token mint
     */
    async getTokenSupply(tokenMintAddress, commitment) {
      const args = this._buildArgs([tokenMintAddress.toBase58()], commitment);
      const unsafeRes = await this._rpcRequest("getTokenSupply", args);
      const res = create(unsafeRes, jsonRpcResultAndContext(TokenAmountResult));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get token supply");
      }
      return res.result;
    }
    /**
     * Fetch the current balance of a token account
     */
    async getTokenAccountBalance(tokenAddress, commitment) {
      const args = this._buildArgs([tokenAddress.toBase58()], commitment);
      const unsafeRes = await this._rpcRequest("getTokenAccountBalance", args);
      const res = create(unsafeRes, jsonRpcResultAndContext(TokenAmountResult));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get token account balance");
      }
      return res.result;
    }
    /**
     * Fetch all the token accounts owned by the specified account
     *
     * @return {Promise<RpcResponseAndContext<GetProgramAccountsResponse>}
     */
    async getTokenAccountsByOwner(ownerAddress, filter, commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      let _args = [ownerAddress.toBase58()];
      if ("mint" in filter) {
        _args.push({
          mint: filter.mint.toBase58()
        });
      } else {
        _args.push({
          programId: filter.programId.toBase58()
        });
      }
      const args = this._buildArgs(_args, commitment, "base64", config);
      const unsafeRes = await this._rpcRequest("getTokenAccountsByOwner", args);
      const res = create(unsafeRes, GetTokenAccountsByOwner);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get token accounts owned by account ${ownerAddress.toBase58()}`);
      }
      return res.result;
    }
    /**
     * Fetch parsed token accounts owned by the specified account
     *
     * @return {Promise<RpcResponseAndContext<Array<{pubkey: PublicKey, account: AccountInfo<ParsedAccountData>}>>>}
     */
    async getParsedTokenAccountsByOwner(ownerAddress, filter, commitment) {
      let _args = [ownerAddress.toBase58()];
      if ("mint" in filter) {
        _args.push({
          mint: filter.mint.toBase58()
        });
      } else {
        _args.push({
          programId: filter.programId.toBase58()
        });
      }
      const args = this._buildArgs(_args, commitment, "jsonParsed");
      const unsafeRes = await this._rpcRequest("getTokenAccountsByOwner", args);
      const res = create(unsafeRes, GetParsedTokenAccountsByOwner);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get token accounts owned by account ${ownerAddress.toBase58()}`);
      }
      return res.result;
    }
    /**
     * Fetch the 20 largest accounts with their current balances
     */
    async getLargestAccounts(config) {
      const arg = {
        ...config,
        commitment: config && config.commitment || this.commitment
      };
      const args = arg.filter || arg.commitment ? [arg] : [];
      const unsafeRes = await this._rpcRequest("getLargestAccounts", args);
      const res = create(unsafeRes, GetLargestAccountsRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get largest accounts");
      }
      return res.result;
    }
    /**
     * Fetch the 20 largest token accounts with their current balances
     * for a given mint.
     */
    async getTokenLargestAccounts(mintAddress, commitment) {
      const args = this._buildArgs([mintAddress.toBase58()], commitment);
      const unsafeRes = await this._rpcRequest("getTokenLargestAccounts", args);
      const res = create(unsafeRes, GetTokenLargestAccountsResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get token largest accounts");
      }
      return res.result;
    }
    /**
     * Fetch all the account info for the specified public key, return with context
     */
    async getAccountInfoAndContext(publicKey3, commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs([publicKey3.toBase58()], commitment, "base64", config);
      const unsafeRes = await this._rpcRequest("getAccountInfo", args);
      const res = create(unsafeRes, jsonRpcResultAndContext(nullable(AccountInfoResult)));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get info about account ${publicKey3.toBase58()}`);
      }
      return res.result;
    }
    /**
     * Fetch parsed account info for the specified public key
     */
    async getParsedAccountInfo(publicKey3, commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs([publicKey3.toBase58()], commitment, "jsonParsed", config);
      const unsafeRes = await this._rpcRequest("getAccountInfo", args);
      const res = create(unsafeRes, jsonRpcResultAndContext(nullable(ParsedAccountInfoResult)));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get info about account ${publicKey3.toBase58()}`);
      }
      return res.result;
    }
    /**
     * Fetch all the account info for the specified public key
     */
    async getAccountInfo(publicKey3, commitmentOrConfig) {
      try {
        const res = await this.getAccountInfoAndContext(publicKey3, commitmentOrConfig);
        return res.value;
      } catch (e) {
        throw new Error("failed to get info about account " + publicKey3.toBase58() + ": " + e);
      }
    }
    /**
     * Fetch all the account info for multiple accounts specified by an array of public keys, return with context
     */
    async getMultipleParsedAccounts(publicKeys, rawConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(rawConfig);
      const keys = publicKeys.map((key) => key.toBase58());
      const args = this._buildArgs([keys], commitment, "jsonParsed", config);
      const unsafeRes = await this._rpcRequest("getMultipleAccounts", args);
      const res = create(unsafeRes, jsonRpcResultAndContext(array(nullable(ParsedAccountInfoResult))));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get info for accounts ${keys}`);
      }
      return res.result;
    }
    /**
     * Fetch all the account info for multiple accounts specified by an array of public keys, return with context
     */
    async getMultipleAccountsInfoAndContext(publicKeys, commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const keys = publicKeys.map((key) => key.toBase58());
      const args = this._buildArgs([keys], commitment, "base64", config);
      const unsafeRes = await this._rpcRequest("getMultipleAccounts", args);
      const res = create(unsafeRes, jsonRpcResultAndContext(array(nullable(AccountInfoResult))));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get info for accounts ${keys}`);
      }
      return res.result;
    }
    /**
     * Fetch all the account info for multiple accounts specified by an array of public keys
     */
    async getMultipleAccountsInfo(publicKeys, commitmentOrConfig) {
      const res = await this.getMultipleAccountsInfoAndContext(publicKeys, commitmentOrConfig);
      return res.value;
    }
    /**
     * Returns epoch activation information for a stake account that has been delegated
     *
     * @deprecated Deprecated since RPC v1.18; will be removed in a future version.
     */
    async getStakeActivation(publicKey3, commitmentOrConfig, epoch) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs([publicKey3.toBase58()], commitment, void 0, {
        ...config,
        epoch: epoch != null ? epoch : config?.epoch
      });
      const unsafeRes = await this._rpcRequest("getStakeActivation", args);
      const res = create(unsafeRes, jsonRpcResult(StakeActivationResult));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get Stake Activation ${publicKey3.toBase58()}`);
      }
      return res.result;
    }
    /**
     * Fetch all the accounts owned by the specified program id
     *
     * @return {Promise<Array<{pubkey: PublicKey, account: AccountInfo<Buffer>}>>}
     */
    // eslint-disable-next-line no-dupe-class-members
    // eslint-disable-next-line no-dupe-class-members
    async getProgramAccounts(programId, configOrCommitment) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(configOrCommitment);
      const {
        encoding,
        ...configWithoutEncoding
      } = config || {};
      const args = this._buildArgs([programId.toBase58()], commitment, encoding || "base64", {
        ...configWithoutEncoding,
        ...configWithoutEncoding.filters ? {
          filters: applyDefaultMemcmpEncodingToFilters(configWithoutEncoding.filters)
        } : null
      });
      const unsafeRes = await this._rpcRequest("getProgramAccounts", args);
      const baseSchema = array(KeyedAccountInfoResult);
      const res = configWithoutEncoding.withContext === true ? create(unsafeRes, jsonRpcResultAndContext(baseSchema)) : create(unsafeRes, jsonRpcResult(baseSchema));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get accounts owned by program ${programId.toBase58()}`);
      }
      return res.result;
    }
    /**
     * Fetch and parse all the accounts owned by the specified program id
     *
     * @return {Promise<Array<{pubkey: PublicKey, account: AccountInfo<Buffer | ParsedAccountData>}>>}
     */
    async getParsedProgramAccounts(programId, configOrCommitment) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(configOrCommitment);
      const args = this._buildArgs([programId.toBase58()], commitment, "jsonParsed", config);
      const unsafeRes = await this._rpcRequest("getProgramAccounts", args);
      const res = create(unsafeRes, jsonRpcResult(array(KeyedParsedAccountInfoResult)));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get accounts owned by program ${programId.toBase58()}`);
      }
      return res.result;
    }
    /** @deprecated Instead, call `confirmTransaction` and pass in {@link TransactionConfirmationStrategy} */
    // eslint-disable-next-line no-dupe-class-members
    // eslint-disable-next-line no-dupe-class-members
    async confirmTransaction(strategy, commitment) {
      let rawSignature;
      if (typeof strategy == "string") {
        rawSignature = strategy;
      } else {
        const config = strategy;
        if (config.abortSignal?.aborted) {
          return Promise.reject(config.abortSignal.reason);
        }
        rawSignature = config.signature;
      }
      let decodedSignature;
      try {
        decodedSignature = import_bs58.default.decode(rawSignature);
      } catch (err) {
        throw new Error("signature must be base58 encoded: " + rawSignature);
      }
      assert2(decodedSignature.length === 64, "signature has invalid length");
      if (typeof strategy === "string") {
        return await this.confirmTransactionUsingLegacyTimeoutStrategy({
          commitment: commitment || this.commitment,
          signature: rawSignature
        });
      } else if ("lastValidBlockHeight" in strategy) {
        return await this.confirmTransactionUsingBlockHeightExceedanceStrategy({
          commitment: commitment || this.commitment,
          strategy
        });
      } else {
        return await this.confirmTransactionUsingDurableNonceStrategy({
          commitment: commitment || this.commitment,
          strategy
        });
      }
    }
    getCancellationPromise(signal) {
      return new Promise((_, reject) => {
        if (signal == null) {
          return;
        }
        if (signal.aborted) {
          reject(signal.reason);
        } else {
          signal.addEventListener("abort", () => {
            reject(signal.reason);
          });
        }
      });
    }
    getTransactionConfirmationPromise({
      commitment,
      signature: signature2
    }) {
      let signatureSubscriptionId;
      let disposeSignatureSubscriptionStateChangeObserver;
      let done = false;
      const confirmationPromise = new Promise((resolve, reject) => {
        try {
          signatureSubscriptionId = this.onSignature(signature2, (result, context) => {
            signatureSubscriptionId = void 0;
            const response = {
              context,
              value: result
            };
            resolve({
              __type: TransactionStatus.PROCESSED,
              response
            });
          }, commitment);
          const subscriptionSetupPromise = new Promise((resolveSubscriptionSetup) => {
            if (signatureSubscriptionId == null) {
              resolveSubscriptionSetup();
            } else {
              disposeSignatureSubscriptionStateChangeObserver = this._onSubscriptionStateChange(signatureSubscriptionId, (nextState) => {
                if (nextState === "subscribed") {
                  resolveSubscriptionSetup();
                }
              });
            }
          });
          (async () => {
            await subscriptionSetupPromise;
            if (done) return;
            const response = await this.getSignatureStatus(signature2);
            if (done) return;
            if (response == null) {
              return;
            }
            const {
              context,
              value
            } = response;
            if (value == null) {
              return;
            }
            if (value?.err) {
              reject(value.err);
            } else {
              switch (commitment) {
                case "confirmed":
                case "single":
                case "singleGossip": {
                  if (value.confirmationStatus === "processed") {
                    return;
                  }
                  break;
                }
                case "finalized":
                case "max":
                case "root": {
                  if (value.confirmationStatus === "processed" || value.confirmationStatus === "confirmed") {
                    return;
                  }
                  break;
                }
                // exhaust enums to ensure full coverage
                case "processed":
                case "recent":
              }
              done = true;
              resolve({
                __type: TransactionStatus.PROCESSED,
                response: {
                  context,
                  value
                }
              });
            }
          })();
        } catch (err) {
          reject(err);
        }
      });
      const abortConfirmation = () => {
        if (disposeSignatureSubscriptionStateChangeObserver) {
          disposeSignatureSubscriptionStateChangeObserver();
          disposeSignatureSubscriptionStateChangeObserver = void 0;
        }
        if (signatureSubscriptionId != null) {
          this.removeSignatureListener(signatureSubscriptionId);
          signatureSubscriptionId = void 0;
        }
      };
      return {
        abortConfirmation,
        confirmationPromise
      };
    }
    async confirmTransactionUsingBlockHeightExceedanceStrategy({
      commitment,
      strategy: {
        abortSignal,
        lastValidBlockHeight,
        signature: signature2
      }
    }) {
      let done = false;
      const expiryPromise = new Promise((resolve) => {
        const checkBlockHeight = async () => {
          try {
            const blockHeight = await this.getBlockHeight(commitment);
            return blockHeight;
          } catch (_e) {
            return -1;
          }
        };
        (async () => {
          let currentBlockHeight = await checkBlockHeight();
          if (done) return;
          while (currentBlockHeight <= lastValidBlockHeight) {
            await sleep(1e3);
            if (done) return;
            currentBlockHeight = await checkBlockHeight();
            if (done) return;
          }
          resolve({
            __type: TransactionStatus.BLOCKHEIGHT_EXCEEDED
          });
        })();
      });
      const {
        abortConfirmation,
        confirmationPromise
      } = this.getTransactionConfirmationPromise({
        commitment,
        signature: signature2
      });
      const cancellationPromise = this.getCancellationPromise(abortSignal);
      let result;
      try {
        const outcome = await Promise.race([cancellationPromise, confirmationPromise, expiryPromise]);
        if (outcome.__type === TransactionStatus.PROCESSED) {
          result = outcome.response;
        } else {
          throw new TransactionExpiredBlockheightExceededError(signature2);
        }
      } finally {
        done = true;
        abortConfirmation();
      }
      return result;
    }
    async confirmTransactionUsingDurableNonceStrategy({
      commitment,
      strategy: {
        abortSignal,
        minContextSlot,
        nonceAccountPubkey,
        nonceValue,
        signature: signature2
      }
    }) {
      let done = false;
      const expiryPromise = new Promise((resolve) => {
        let currentNonceValue = nonceValue;
        let lastCheckedSlot = null;
        const getCurrentNonceValue = async () => {
          try {
            const {
              context,
              value: nonceAccount
            } = await this.getNonceAndContext(nonceAccountPubkey, {
              commitment,
              minContextSlot
            });
            lastCheckedSlot = context.slot;
            return nonceAccount?.nonce;
          } catch (e) {
            return currentNonceValue;
          }
        };
        (async () => {
          currentNonceValue = await getCurrentNonceValue();
          if (done) return;
          while (true) {
            if (nonceValue !== currentNonceValue) {
              resolve({
                __type: TransactionStatus.NONCE_INVALID,
                slotInWhichNonceDidAdvance: lastCheckedSlot
              });
              return;
            }
            await sleep(2e3);
            if (done) return;
            currentNonceValue = await getCurrentNonceValue();
            if (done) return;
          }
        })();
      });
      const {
        abortConfirmation,
        confirmationPromise
      } = this.getTransactionConfirmationPromise({
        commitment,
        signature: signature2
      });
      const cancellationPromise = this.getCancellationPromise(abortSignal);
      let result;
      try {
        const outcome = await Promise.race([cancellationPromise, confirmationPromise, expiryPromise]);
        if (outcome.__type === TransactionStatus.PROCESSED) {
          result = outcome.response;
        } else {
          let signatureStatus;
          while (true) {
            const status = await this.getSignatureStatus(signature2);
            if (status == null) {
              break;
            }
            if (status.context.slot < (outcome.slotInWhichNonceDidAdvance ?? minContextSlot)) {
              await sleep(400);
              continue;
            }
            signatureStatus = status;
            break;
          }
          if (signatureStatus?.value) {
            const commitmentForStatus = commitment || "finalized";
            const {
              confirmationStatus
            } = signatureStatus.value;
            switch (commitmentForStatus) {
              case "processed":
              case "recent":
                if (confirmationStatus !== "processed" && confirmationStatus !== "confirmed" && confirmationStatus !== "finalized") {
                  throw new TransactionExpiredNonceInvalidError(signature2);
                }
                break;
              case "confirmed":
              case "single":
              case "singleGossip":
                if (confirmationStatus !== "confirmed" && confirmationStatus !== "finalized") {
                  throw new TransactionExpiredNonceInvalidError(signature2);
                }
                break;
              case "finalized":
              case "max":
              case "root":
                if (confirmationStatus !== "finalized") {
                  throw new TransactionExpiredNonceInvalidError(signature2);
                }
                break;
              default:
                /* @__PURE__ */ ((_) => {
                })(commitmentForStatus);
            }
            result = {
              context: signatureStatus.context,
              value: {
                err: signatureStatus.value.err
              }
            };
          } else {
            throw new TransactionExpiredNonceInvalidError(signature2);
          }
        }
      } finally {
        done = true;
        abortConfirmation();
      }
      return result;
    }
    async confirmTransactionUsingLegacyTimeoutStrategy({
      commitment,
      signature: signature2
    }) {
      let timeoutId;
      const expiryPromise = new Promise((resolve) => {
        let timeoutMs = this._confirmTransactionInitialTimeout || 60 * 1e3;
        switch (commitment) {
          case "processed":
          case "recent":
          case "single":
          case "confirmed":
          case "singleGossip": {
            timeoutMs = this._confirmTransactionInitialTimeout || 30 * 1e3;
            break;
          }
        }
        timeoutId = setTimeout(() => resolve({
          __type: TransactionStatus.TIMED_OUT,
          timeoutMs
        }), timeoutMs);
      });
      const {
        abortConfirmation,
        confirmationPromise
      } = this.getTransactionConfirmationPromise({
        commitment,
        signature: signature2
      });
      let result;
      try {
        const outcome = await Promise.race([confirmationPromise, expiryPromise]);
        if (outcome.__type === TransactionStatus.PROCESSED) {
          result = outcome.response;
        } else {
          throw new TransactionExpiredTimeoutError(signature2, outcome.timeoutMs / 1e3);
        }
      } finally {
        clearTimeout(timeoutId);
        abortConfirmation();
      }
      return result;
    }
    /**
     * Return the list of nodes that are currently participating in the cluster
     */
    async getClusterNodes() {
      const unsafeRes = await this._rpcRequest("getClusterNodes", []);
      const res = create(unsafeRes, jsonRpcResult(array(ContactInfoResult)));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get cluster nodes");
      }
      return res.result;
    }
    /**
     * Return the list of nodes that are currently participating in the cluster
     */
    async getVoteAccounts(commitment) {
      const args = this._buildArgs([], commitment);
      const unsafeRes = await this._rpcRequest("getVoteAccounts", args);
      const res = create(unsafeRes, GetVoteAccounts);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get vote accounts");
      }
      return res.result;
    }
    /**
     * Fetch the current slot that the node is processing
     */
    async getSlot(commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs([], commitment, void 0, config);
      const unsafeRes = await this._rpcRequest("getSlot", args);
      const res = create(unsafeRes, jsonRpcResult(number()));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get slot");
      }
      return res.result;
    }
    /**
     * Fetch the current slot leader of the cluster
     */
    async getSlotLeader(commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs([], commitment, void 0, config);
      const unsafeRes = await this._rpcRequest("getSlotLeader", args);
      const res = create(unsafeRes, jsonRpcResult(string()));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get slot leader");
      }
      return res.result;
    }
    /**
     * Fetch `limit` number of slot leaders starting from `startSlot`
     *
     * @param startSlot fetch slot leaders starting from this slot
     * @param limit number of slot leaders to return
     */
    async getSlotLeaders(startSlot, limit) {
      const args = [startSlot, limit];
      const unsafeRes = await this._rpcRequest("getSlotLeaders", args);
      const res = create(unsafeRes, jsonRpcResult(array(PublicKeyFromString)));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get slot leaders");
      }
      return res.result;
    }
    /**
     * Fetch the current status of a signature
     */
    async getSignatureStatus(signature2, config) {
      const {
        context,
        value: values
      } = await this.getSignatureStatuses([signature2], config);
      assert2(values.length === 1);
      const value = values[0];
      return {
        context,
        value
      };
    }
    /**
     * Fetch the current statuses of a batch of signatures
     */
    async getSignatureStatuses(signatures, config) {
      const params = [signatures];
      if (config) {
        params.push(config);
      }
      const unsafeRes = await this._rpcRequest("getSignatureStatuses", params);
      const res = create(unsafeRes, GetSignatureStatusesRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get signature status");
      }
      return res.result;
    }
    /**
     * Fetch the current transaction count of the cluster
     */
    async getTransactionCount(commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs([], commitment, void 0, config);
      const unsafeRes = await this._rpcRequest("getTransactionCount", args);
      const res = create(unsafeRes, jsonRpcResult(number()));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get transaction count");
      }
      return res.result;
    }
    /**
     * Fetch the current total currency supply of the cluster in lamports
     *
     * @deprecated Deprecated since RPC v1.2.8. Please use {@link getSupply} instead.
     */
    async getTotalSupply(commitment) {
      const result = await this.getSupply({
        commitment,
        excludeNonCirculatingAccountsList: true
      });
      return result.value.total;
    }
    /**
     * Fetch the cluster InflationGovernor parameters
     */
    async getInflationGovernor(commitment) {
      const args = this._buildArgs([], commitment);
      const unsafeRes = await this._rpcRequest("getInflationGovernor", args);
      const res = create(unsafeRes, GetInflationGovernorRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get inflation");
      }
      return res.result;
    }
    /**
     * Fetch the inflation reward for a list of addresses for an epoch
     */
    async getInflationReward(addresses, epoch, commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs([addresses.map((pubkey) => pubkey.toBase58())], commitment, void 0, {
        ...config,
        epoch: epoch != null ? epoch : config?.epoch
      });
      const unsafeRes = await this._rpcRequest("getInflationReward", args);
      const res = create(unsafeRes, GetInflationRewardResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get inflation reward");
      }
      return res.result;
    }
    /**
     * Fetch the specific inflation values for the current epoch
     */
    async getInflationRate() {
      const unsafeRes = await this._rpcRequest("getInflationRate", []);
      const res = create(unsafeRes, GetInflationRateRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get inflation rate");
      }
      return res.result;
    }
    /**
     * Fetch the Epoch Info parameters
     */
    async getEpochInfo(commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs([], commitment, void 0, config);
      const unsafeRes = await this._rpcRequest("getEpochInfo", args);
      const res = create(unsafeRes, GetEpochInfoRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get epoch info");
      }
      return res.result;
    }
    /**
     * Fetch the Epoch Schedule parameters
     */
    async getEpochSchedule() {
      const unsafeRes = await this._rpcRequest("getEpochSchedule", []);
      const res = create(unsafeRes, GetEpochScheduleRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get epoch schedule");
      }
      const epochSchedule = res.result;
      return new EpochSchedule(epochSchedule.slotsPerEpoch, epochSchedule.leaderScheduleSlotOffset, epochSchedule.warmup, epochSchedule.firstNormalEpoch, epochSchedule.firstNormalSlot);
    }
    /**
     * Fetch the leader schedule for the current epoch
     * @return {Promise<RpcResponseAndContext<LeaderSchedule>>}
     */
    async getLeaderSchedule() {
      const unsafeRes = await this._rpcRequest("getLeaderSchedule", []);
      const res = create(unsafeRes, GetLeaderScheduleRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get leader schedule");
      }
      return res.result;
    }
    /**
     * Fetch the minimum balance needed to exempt an account of `dataLength`
     * size from rent
     */
    async getMinimumBalanceForRentExemption(dataLength, commitment) {
      const args = this._buildArgs([dataLength], commitment);
      const unsafeRes = await this._rpcRequest("getMinimumBalanceForRentExemption", args);
      const res = create(unsafeRes, GetMinimumBalanceForRentExemptionRpcResult);
      if ("error" in res) {
        console.warn("Unable to fetch minimum balance for rent exemption");
        return 0;
      }
      return res.result;
    }
    /**
     * Fetch a recent blockhash from the cluster, return with context
     * @return {Promise<RpcResponseAndContext<{blockhash: Blockhash, feeCalculator: FeeCalculator}>>}
     *
     * @deprecated Deprecated since RPC v1.9.0. Please use {@link getLatestBlockhash} instead.
     */
    async getRecentBlockhashAndContext(commitment) {
      const {
        context,
        value: {
          blockhash
        }
      } = await this.getLatestBlockhashAndContext(commitment);
      const feeCalculator = {
        get lamportsPerSignature() {
          throw new Error("The capability to fetch `lamportsPerSignature` using the `getRecentBlockhash` API is no longer offered by the network. Use the `getFeeForMessage` API to obtain the fee for a given message.");
        },
        toJSON() {
          return {};
        }
      };
      return {
        context,
        value: {
          blockhash,
          feeCalculator
        }
      };
    }
    /**
     * Fetch recent performance samples
     * @return {Promise<Array<PerfSample>>}
     */
    async getRecentPerformanceSamples(limit) {
      const unsafeRes = await this._rpcRequest("getRecentPerformanceSamples", limit ? [limit] : []);
      const res = create(unsafeRes, GetRecentPerformanceSamplesRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get recent performance samples");
      }
      return res.result;
    }
    /**
     * Fetch the fee calculator for a recent blockhash from the cluster, return with context
     *
     * @deprecated Deprecated since RPC v1.9.0. Please use {@link getFeeForMessage} instead.
     */
    async getFeeCalculatorForBlockhash(blockhash, commitment) {
      const args = this._buildArgs([blockhash], commitment);
      const unsafeRes = await this._rpcRequest("getFeeCalculatorForBlockhash", args);
      const res = create(unsafeRes, GetFeeCalculatorRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get fee calculator");
      }
      const {
        context,
        value
      } = res.result;
      return {
        context,
        value: value !== null ? value.feeCalculator : null
      };
    }
    /**
     * Fetch the fee for a message from the cluster, return with context
     */
    async getFeeForMessage(message, commitment) {
      const wireMessage = toBuffer(message.serialize()).toString("base64");
      const args = this._buildArgs([wireMessage], commitment);
      const unsafeRes = await this._rpcRequest("getFeeForMessage", args);
      const res = create(unsafeRes, jsonRpcResultAndContext(nullable(number())));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get fee for message");
      }
      if (res.result === null) {
        throw new Error("invalid blockhash");
      }
      return res.result;
    }
    /**
     * Fetch a list of prioritization fees from recent blocks.
     */
    async getRecentPrioritizationFees(config) {
      const accounts = config?.lockedWritableAccounts?.map((key) => key.toBase58());
      const args = accounts?.length ? [accounts] : [];
      const unsafeRes = await this._rpcRequest("getRecentPrioritizationFees", args);
      const res = create(unsafeRes, GetRecentPrioritizationFeesRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get recent prioritization fees");
      }
      return res.result;
    }
    /**
     * Fetch a recent blockhash from the cluster
     * @return {Promise<{blockhash: Blockhash, feeCalculator: FeeCalculator}>}
     *
     * @deprecated Deprecated since RPC v1.8.0. Please use {@link getLatestBlockhash} instead.
     */
    async getRecentBlockhash(commitment) {
      try {
        const res = await this.getRecentBlockhashAndContext(commitment);
        return res.value;
      } catch (e) {
        throw new Error("failed to get recent blockhash: " + e);
      }
    }
    /**
     * Fetch the latest blockhash from the cluster
     * @return {Promise<BlockhashWithExpiryBlockHeight>}
     */
    async getLatestBlockhash(commitmentOrConfig) {
      try {
        const res = await this.getLatestBlockhashAndContext(commitmentOrConfig);
        return res.value;
      } catch (e) {
        throw new Error("failed to get recent blockhash: " + e);
      }
    }
    /**
     * Fetch the latest blockhash from the cluster
     * @return {Promise<BlockhashWithExpiryBlockHeight>}
     */
    async getLatestBlockhashAndContext(commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs([], commitment, void 0, config);
      const unsafeRes = await this._rpcRequest("getLatestBlockhash", args);
      const res = create(unsafeRes, GetLatestBlockhashRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get latest blockhash");
      }
      return res.result;
    }
    /**
     * Returns whether a blockhash is still valid or not
     */
    async isBlockhashValid(blockhash, rawConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(rawConfig);
      const args = this._buildArgs([blockhash], commitment, void 0, config);
      const unsafeRes = await this._rpcRequest("isBlockhashValid", args);
      const res = create(unsafeRes, IsBlockhashValidRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to determine if the blockhash `" + blockhash + "`is valid");
      }
      return res.result;
    }
    /**
     * Fetch the node version
     */
    async getVersion() {
      const unsafeRes = await this._rpcRequest("getVersion", []);
      const res = create(unsafeRes, jsonRpcResult(VersionResult));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get version");
      }
      return res.result;
    }
    /**
     * Fetch the genesis hash
     */
    async getGenesisHash() {
      const unsafeRes = await this._rpcRequest("getGenesisHash", []);
      const res = create(unsafeRes, jsonRpcResult(string()));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get genesis hash");
      }
      return res.result;
    }
    /**
     * Fetch a processed block from the cluster.
     *
     * @deprecated Instead, call `getBlock` using a `GetVersionedBlockConfig` by
     * setting the `maxSupportedTransactionVersion` property.
     */
    /**
     * @deprecated Instead, call `getBlock` using a `GetVersionedBlockConfig` by
     * setting the `maxSupportedTransactionVersion` property.
     */
    // eslint-disable-next-line no-dupe-class-members
    /**
     * @deprecated Instead, call `getBlock` using a `GetVersionedBlockConfig` by
     * setting the `maxSupportedTransactionVersion` property.
     */
    // eslint-disable-next-line no-dupe-class-members
    /**
     * Fetch a processed block from the cluster.
     */
    // eslint-disable-next-line no-dupe-class-members
    // eslint-disable-next-line no-dupe-class-members
    // eslint-disable-next-line no-dupe-class-members
    /**
     * Fetch a processed block from the cluster.
     */
    // eslint-disable-next-line no-dupe-class-members
    async getBlock(slot, rawConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(rawConfig);
      const args = this._buildArgsAtLeastConfirmed([slot], commitment, void 0, config);
      const unsafeRes = await this._rpcRequest("getBlock", args);
      try {
        switch (config?.transactionDetails) {
          case "accounts": {
            const res = create(unsafeRes, GetAccountsModeBlockRpcResult);
            if ("error" in res) {
              throw res.error;
            }
            return res.result;
          }
          case "none": {
            const res = create(unsafeRes, GetNoneModeBlockRpcResult);
            if ("error" in res) {
              throw res.error;
            }
            return res.result;
          }
          default: {
            const res = create(unsafeRes, GetBlockRpcResult);
            if ("error" in res) {
              throw res.error;
            }
            const {
              result
            } = res;
            return result ? {
              ...result,
              transactions: result.transactions.map(({
                transaction,
                meta,
                version: version2
              }) => ({
                meta,
                transaction: {
                  ...transaction,
                  message: versionedMessageFromResponse(version2, transaction.message)
                },
                version: version2
              }))
            } : null;
          }
        }
      } catch (e) {
        throw new SolanaJSONRPCError(e, "failed to get confirmed block");
      }
    }
    /**
     * Fetch parsed transaction details for a confirmed or finalized block
     */
    // eslint-disable-next-line no-dupe-class-members
    // eslint-disable-next-line no-dupe-class-members
    // eslint-disable-next-line no-dupe-class-members
    async getParsedBlock(slot, rawConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(rawConfig);
      const args = this._buildArgsAtLeastConfirmed([slot], commitment, "jsonParsed", config);
      const unsafeRes = await this._rpcRequest("getBlock", args);
      try {
        switch (config?.transactionDetails) {
          case "accounts": {
            const res = create(unsafeRes, GetParsedAccountsModeBlockRpcResult);
            if ("error" in res) {
              throw res.error;
            }
            return res.result;
          }
          case "none": {
            const res = create(unsafeRes, GetParsedNoneModeBlockRpcResult);
            if ("error" in res) {
              throw res.error;
            }
            return res.result;
          }
          default: {
            const res = create(unsafeRes, GetParsedBlockRpcResult);
            if ("error" in res) {
              throw res.error;
            }
            return res.result;
          }
        }
      } catch (e) {
        throw new SolanaJSONRPCError(e, "failed to get block");
      }
    }
    /*
     * Returns recent block production information from the current or previous epoch
     */
    async getBlockProduction(configOrCommitment) {
      let extra;
      let commitment;
      if (typeof configOrCommitment === "string") {
        commitment = configOrCommitment;
      } else if (configOrCommitment) {
        const {
          commitment: c,
          ...rest
        } = configOrCommitment;
        commitment = c;
        extra = rest;
      }
      const args = this._buildArgs([], commitment, "base64", extra);
      const unsafeRes = await this._rpcRequest("getBlockProduction", args);
      const res = create(unsafeRes, BlockProductionResponseStruct);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get block production information");
      }
      return res.result;
    }
    /**
     * Fetch a confirmed or finalized transaction from the cluster.
     *
     * @deprecated Instead, call `getTransaction` using a
     * `GetVersionedTransactionConfig` by setting the
     * `maxSupportedTransactionVersion` property.
     */
    /**
     * Fetch a confirmed or finalized transaction from the cluster.
     */
    // eslint-disable-next-line no-dupe-class-members
    /**
     * Fetch a confirmed or finalized transaction from the cluster.
     */
    // eslint-disable-next-line no-dupe-class-members
    async getTransaction(signature2, rawConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(rawConfig);
      const args = this._buildArgsAtLeastConfirmed([signature2], commitment, void 0, config);
      const unsafeRes = await this._rpcRequest("getTransaction", args);
      const res = create(unsafeRes, GetTransactionRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get transaction");
      }
      const result = res.result;
      if (!result) return result;
      return {
        ...result,
        transaction: {
          ...result.transaction,
          message: versionedMessageFromResponse(result.version, result.transaction.message)
        }
      };
    }
    /**
     * Fetch parsed transaction details for a confirmed or finalized transaction
     */
    async getParsedTransaction(signature2, commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgsAtLeastConfirmed([signature2], commitment, "jsonParsed", config);
      const unsafeRes = await this._rpcRequest("getTransaction", args);
      const res = create(unsafeRes, GetParsedTransactionRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get transaction");
      }
      return res.result;
    }
    /**
     * Fetch parsed transaction details for a batch of confirmed transactions
     */
    async getParsedTransactions(signatures, commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const batch = signatures.map((signature2) => {
        const args = this._buildArgsAtLeastConfirmed([signature2], commitment, "jsonParsed", config);
        return {
          methodName: "getTransaction",
          args
        };
      });
      const unsafeRes = await this._rpcBatchRequest(batch);
      const res = unsafeRes.map((unsafeRes2) => {
        const res2 = create(unsafeRes2, GetParsedTransactionRpcResult);
        if ("error" in res2) {
          throw new SolanaJSONRPCError(res2.error, "failed to get transactions");
        }
        return res2.result;
      });
      return res;
    }
    /**
     * Fetch transaction details for a batch of confirmed transactions.
     * Similar to {@link getParsedTransactions} but returns a {@link TransactionResponse}.
     *
     * @deprecated Instead, call `getTransactions` using a
     * `GetVersionedTransactionConfig` by setting the
     * `maxSupportedTransactionVersion` property.
     */
    /**
     * Fetch transaction details for a batch of confirmed transactions.
     * Similar to {@link getParsedTransactions} but returns a {@link
     * VersionedTransactionResponse}.
     */
    // eslint-disable-next-line no-dupe-class-members
    /**
     * Fetch transaction details for a batch of confirmed transactions.
     * Similar to {@link getParsedTransactions} but returns a {@link
     * VersionedTransactionResponse}.
     */
    // eslint-disable-next-line no-dupe-class-members
    async getTransactions(signatures, commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const batch = signatures.map((signature2) => {
        const args = this._buildArgsAtLeastConfirmed([signature2], commitment, void 0, config);
        return {
          methodName: "getTransaction",
          args
        };
      });
      const unsafeRes = await this._rpcBatchRequest(batch);
      const res = unsafeRes.map((unsafeRes2) => {
        const res2 = create(unsafeRes2, GetTransactionRpcResult);
        if ("error" in res2) {
          throw new SolanaJSONRPCError(res2.error, "failed to get transactions");
        }
        const result = res2.result;
        if (!result) return result;
        return {
          ...result,
          transaction: {
            ...result.transaction,
            message: versionedMessageFromResponse(result.version, result.transaction.message)
          }
        };
      });
      return res;
    }
    /**
     * Fetch a list of Transactions and transaction statuses from the cluster
     * for a confirmed block.
     *
     * @deprecated Deprecated since RPC v1.7.0. Please use {@link getBlock} instead.
     */
    async getConfirmedBlock(slot, commitment) {
      const args = this._buildArgsAtLeastConfirmed([slot], commitment);
      const unsafeRes = await this._rpcRequest("getBlock", args);
      const res = create(unsafeRes, GetConfirmedBlockRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get confirmed block");
      }
      const result = res.result;
      if (!result) {
        throw new Error("Confirmed block " + slot + " not found");
      }
      const block = {
        ...result,
        transactions: result.transactions.map(({
          transaction,
          meta
        }) => {
          const message = new Message(transaction.message);
          return {
            meta,
            transaction: {
              ...transaction,
              message
            }
          };
        })
      };
      return {
        ...block,
        transactions: block.transactions.map(({
          transaction,
          meta
        }) => {
          return {
            meta,
            transaction: Transaction.populate(transaction.message, transaction.signatures)
          };
        })
      };
    }
    /**
     * Fetch confirmed blocks between two slots
     */
    async getBlocks(startSlot, endSlot, commitment) {
      const args = this._buildArgsAtLeastConfirmed(endSlot !== void 0 ? [startSlot, endSlot] : [startSlot], commitment);
      const unsafeRes = await this._rpcRequest("getBlocks", args);
      const res = create(unsafeRes, jsonRpcResult(array(number())));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get blocks");
      }
      return res.result;
    }
    /**
     * Fetch a list of Signatures from the cluster for a block, excluding rewards
     */
    async getBlockSignatures(slot, commitment) {
      const args = this._buildArgsAtLeastConfirmed([slot], commitment, void 0, {
        transactionDetails: "signatures",
        rewards: false
      });
      const unsafeRes = await this._rpcRequest("getBlock", args);
      const res = create(unsafeRes, GetBlockSignaturesRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get block");
      }
      const result = res.result;
      if (!result) {
        throw new Error("Block " + slot + " not found");
      }
      return result;
    }
    /**
     * Fetch a list of Signatures from the cluster for a confirmed block, excluding rewards
     *
     * @deprecated Deprecated since RPC v1.7.0. Please use {@link getBlockSignatures} instead.
     */
    async getConfirmedBlockSignatures(slot, commitment) {
      const args = this._buildArgsAtLeastConfirmed([slot], commitment, void 0, {
        transactionDetails: "signatures",
        rewards: false
      });
      const unsafeRes = await this._rpcRequest("getBlock", args);
      const res = create(unsafeRes, GetBlockSignaturesRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get confirmed block");
      }
      const result = res.result;
      if (!result) {
        throw new Error("Confirmed block " + slot + " not found");
      }
      return result;
    }
    /**
     * Fetch a transaction details for a confirmed transaction
     *
     * @deprecated Deprecated since RPC v1.7.0. Please use {@link getTransaction} instead.
     */
    async getConfirmedTransaction(signature2, commitment) {
      const args = this._buildArgsAtLeastConfirmed([signature2], commitment);
      const unsafeRes = await this._rpcRequest("getTransaction", args);
      const res = create(unsafeRes, GetTransactionRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get transaction");
      }
      const result = res.result;
      if (!result) return result;
      const message = new Message(result.transaction.message);
      const signatures = result.transaction.signatures;
      return {
        ...result,
        transaction: Transaction.populate(message, signatures)
      };
    }
    /**
     * Fetch parsed transaction details for a confirmed transaction
     *
     * @deprecated Deprecated since RPC v1.7.0. Please use {@link getParsedTransaction} instead.
     */
    async getParsedConfirmedTransaction(signature2, commitment) {
      const args = this._buildArgsAtLeastConfirmed([signature2], commitment, "jsonParsed");
      const unsafeRes = await this._rpcRequest("getTransaction", args);
      const res = create(unsafeRes, GetParsedTransactionRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get confirmed transaction");
      }
      return res.result;
    }
    /**
     * Fetch parsed transaction details for a batch of confirmed transactions
     *
     * @deprecated Deprecated since RPC v1.7.0. Please use {@link getParsedTransactions} instead.
     */
    async getParsedConfirmedTransactions(signatures, commitment) {
      const batch = signatures.map((signature2) => {
        const args = this._buildArgsAtLeastConfirmed([signature2], commitment, "jsonParsed");
        return {
          methodName: "getTransaction",
          args
        };
      });
      const unsafeRes = await this._rpcBatchRequest(batch);
      const res = unsafeRes.map((unsafeRes2) => {
        const res2 = create(unsafeRes2, GetParsedTransactionRpcResult);
        if ("error" in res2) {
          throw new SolanaJSONRPCError(res2.error, "failed to get confirmed transactions");
        }
        return res2.result;
      });
      return res;
    }
    /**
     * Fetch a list of all the confirmed signatures for transactions involving an address
     * within a specified slot range. Max range allowed is 10,000 slots.
     *
     * @deprecated Deprecated since RPC v1.3. Please use {@link getConfirmedSignaturesForAddress2} instead.
     *
     * @param address queried address
     * @param startSlot start slot, inclusive
     * @param endSlot end slot, inclusive
     */
    async getConfirmedSignaturesForAddress(address, startSlot, endSlot) {
      let options = {};
      let firstAvailableBlock = await this.getFirstAvailableBlock();
      while (!("until" in options)) {
        startSlot--;
        if (startSlot <= 0 || startSlot < firstAvailableBlock) {
          break;
        }
        try {
          const block = await this.getConfirmedBlockSignatures(startSlot, "finalized");
          if (block.signatures.length > 0) {
            options.until = block.signatures[block.signatures.length - 1].toString();
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes("skipped")) {
            continue;
          } else {
            throw err;
          }
        }
      }
      let highestConfirmedRoot = await this.getSlot("finalized");
      while (!("before" in options)) {
        endSlot++;
        if (endSlot > highestConfirmedRoot) {
          break;
        }
        try {
          const block = await this.getConfirmedBlockSignatures(endSlot);
          if (block.signatures.length > 0) {
            options.before = block.signatures[block.signatures.length - 1].toString();
          }
        } catch (err) {
          if (err instanceof Error && err.message.includes("skipped")) {
            continue;
          } else {
            throw err;
          }
        }
      }
      const confirmedSignatureInfo = await this.getConfirmedSignaturesForAddress2(address, options);
      return confirmedSignatureInfo.map((info) => info.signature);
    }
    /**
     * Returns confirmed signatures for transactions involving an
     * address backwards in time from the provided signature or most recent confirmed block
     *
     * @deprecated Deprecated since RPC v1.7.0. Please use {@link getSignaturesForAddress} instead.
     */
    async getConfirmedSignaturesForAddress2(address, options, commitment) {
      const args = this._buildArgsAtLeastConfirmed([address.toBase58()], commitment, void 0, options);
      const unsafeRes = await this._rpcRequest("getConfirmedSignaturesForAddress2", args);
      const res = create(unsafeRes, GetConfirmedSignaturesForAddress2RpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get confirmed signatures for address");
      }
      return res.result;
    }
    /**
     * Returns confirmed signatures for transactions involving an
     * address backwards in time from the provided signature or most recent confirmed block
     *
     *
     * @param address queried address
     * @param options
     */
    async getSignaturesForAddress(address, options, commitment) {
      const args = this._buildArgsAtLeastConfirmed([address.toBase58()], commitment, void 0, options);
      const unsafeRes = await this._rpcRequest("getSignaturesForAddress", args);
      const res = create(unsafeRes, GetSignaturesForAddressRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, "failed to get signatures for address");
      }
      return res.result;
    }
    async getAddressLookupTable(accountKey, config) {
      const {
        context,
        value: accountInfo
      } = await this.getAccountInfoAndContext(accountKey, config);
      let value = null;
      if (accountInfo !== null) {
        value = new AddressLookupTableAccount({
          key: accountKey,
          state: AddressLookupTableAccount.deserialize(accountInfo.data)
        });
      }
      return {
        context,
        value
      };
    }
    /**
     * Fetch the contents of a Nonce account from the cluster, return with context
     */
    async getNonceAndContext(nonceAccount, commitmentOrConfig) {
      const {
        context,
        value: accountInfo
      } = await this.getAccountInfoAndContext(nonceAccount, commitmentOrConfig);
      let value = null;
      if (accountInfo !== null) {
        value = NonceAccount.fromAccountData(accountInfo.data);
      }
      return {
        context,
        value
      };
    }
    /**
     * Fetch the contents of a Nonce account from the cluster
     */
    async getNonce(nonceAccount, commitmentOrConfig) {
      return await this.getNonceAndContext(nonceAccount, commitmentOrConfig).then((x) => x.value).catch((e) => {
        throw new Error("failed to get nonce for account " + nonceAccount.toBase58() + ": " + e);
      });
    }
    /**
     * Request an allocation of lamports to the specified address
     *
     * ```typescript
     * import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
     *
     * (async () => {
     *   const connection = new Connection("https://api.testnet.solana.com", "confirmed");
     *   const myAddress = new PublicKey("2nr1bHFT86W9tGnyvmYW4vcHKsQB3sVQfnddasz4kExM");
     *   const signature = await connection.requestAirdrop(myAddress, LAMPORTS_PER_SOL);
     *   await connection.confirmTransaction(signature);
     * })();
     * ```
     */
    async requestAirdrop(to, lamports) {
      const unsafeRes = await this._rpcRequest("requestAirdrop", [to.toBase58(), lamports]);
      const res = create(unsafeRes, RequestAirdropRpcResult);
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `airdrop to ${to.toBase58()} failed`);
      }
      return res.result;
    }
    /**
     * @internal
     */
    async _blockhashWithExpiryBlockHeight(disableCache) {
      if (!disableCache) {
        while (this._pollingBlockhash) {
          await sleep(100);
        }
        const timeSinceFetch = Date.now() - this._blockhashInfo.lastFetch;
        const expired = timeSinceFetch >= BLOCKHASH_CACHE_TIMEOUT_MS;
        if (this._blockhashInfo.latestBlockhash !== null && !expired) {
          return this._blockhashInfo.latestBlockhash;
        }
      }
      return await this._pollNewBlockhash();
    }
    /**
     * @internal
     */
    async _pollNewBlockhash() {
      this._pollingBlockhash = true;
      try {
        const startTime = Date.now();
        const cachedLatestBlockhash = this._blockhashInfo.latestBlockhash;
        const cachedBlockhash = cachedLatestBlockhash ? cachedLatestBlockhash.blockhash : null;
        for (let i2 = 0; i2 < 50; i2++) {
          const latestBlockhash2 = await this.getLatestBlockhash("finalized");
          if (cachedBlockhash !== latestBlockhash2.blockhash) {
            this._blockhashInfo = {
              latestBlockhash: latestBlockhash2,
              lastFetch: Date.now(),
              transactionSignatures: [],
              simulatedSignatures: []
            };
            return latestBlockhash2;
          }
          await sleep(MS_PER_SLOT / 2);
        }
        throw new Error(`Unable to obtain a new blockhash after ${Date.now() - startTime}ms`);
      } finally {
        this._pollingBlockhash = false;
      }
    }
    /**
     * get the stake minimum delegation
     */
    async getStakeMinimumDelegation(config) {
      const {
        commitment,
        config: configArg
      } = extractCommitmentFromConfig(config);
      const args = this._buildArgs([], commitment, "base64", configArg);
      const unsafeRes = await this._rpcRequest("getStakeMinimumDelegation", args);
      const res = create(unsafeRes, jsonRpcResultAndContext(number()));
      if ("error" in res) {
        throw new SolanaJSONRPCError(res.error, `failed to get stake minimum delegation`);
      }
      return res.result;
    }
    /**
     * Simulate a transaction
     *
     * @deprecated Instead, call {@link simulateTransaction} with {@link
     * VersionedTransaction} and {@link SimulateTransactionConfig} parameters
     */
    /**
     * Simulate a transaction
     */
    // eslint-disable-next-line no-dupe-class-members
    /**
     * Simulate a transaction
     */
    // eslint-disable-next-line no-dupe-class-members
    async simulateTransaction(transactionOrMessage, configOrSigners, includeAccounts) {
      if ("message" in transactionOrMessage) {
        const versionedTx = transactionOrMessage;
        const wireTransaction2 = versionedTx.serialize();
        const encodedTransaction2 = import_buffer3.Buffer.from(wireTransaction2).toString("base64");
        if (Array.isArray(configOrSigners) || includeAccounts !== void 0) {
          throw new Error("Invalid arguments");
        }
        const config2 = configOrSigners || {};
        config2.encoding = "base64";
        if (!("commitment" in config2)) {
          config2.commitment = this.commitment;
        }
        if (configOrSigners && typeof configOrSigners === "object" && "innerInstructions" in configOrSigners) {
          config2.innerInstructions = configOrSigners.innerInstructions;
        }
        const args2 = [encodedTransaction2, config2];
        const unsafeRes2 = await this._rpcRequest("simulateTransaction", args2);
        const res2 = create(unsafeRes2, SimulatedTransactionResponseStruct);
        if ("error" in res2) {
          throw new Error("failed to simulate transaction: " + res2.error.message);
        }
        return res2.result;
      }
      let transaction;
      if (transactionOrMessage instanceof Transaction) {
        let originalTx = transactionOrMessage;
        transaction = new Transaction();
        transaction.feePayer = originalTx.feePayer;
        transaction.instructions = transactionOrMessage.instructions;
        transaction.nonceInfo = originalTx.nonceInfo;
        transaction.signatures = originalTx.signatures;
      } else {
        transaction = Transaction.populate(transactionOrMessage);
        transaction._message = transaction._json = void 0;
      }
      if (configOrSigners !== void 0 && !Array.isArray(configOrSigners)) {
        throw new Error("Invalid arguments");
      }
      const signers = configOrSigners;
      if (transaction.nonceInfo && signers) {
        transaction.sign(...signers);
      } else {
        let disableCache = this._disableBlockhashCaching;
        for (; ; ) {
          const latestBlockhash2 = await this._blockhashWithExpiryBlockHeight(disableCache);
          transaction.lastValidBlockHeight = latestBlockhash2.lastValidBlockHeight;
          transaction.recentBlockhash = latestBlockhash2.blockhash;
          if (!signers) break;
          transaction.sign(...signers);
          if (!transaction.signature) {
            throw new Error("!signature");
          }
          const signature2 = transaction.signature.toString("base64");
          if (!this._blockhashInfo.simulatedSignatures.includes(signature2) && !this._blockhashInfo.transactionSignatures.includes(signature2)) {
            this._blockhashInfo.simulatedSignatures.push(signature2);
            break;
          } else {
            disableCache = true;
          }
        }
      }
      const message = transaction._compile();
      const signData = message.serialize();
      const wireTransaction = transaction._serialize(signData);
      const encodedTransaction = wireTransaction.toString("base64");
      const config = {
        encoding: "base64",
        commitment: this.commitment
      };
      if (includeAccounts) {
        const addresses = (Array.isArray(includeAccounts) ? includeAccounts : message.nonProgramIds()).map((key) => key.toBase58());
        config["accounts"] = {
          encoding: "base64",
          addresses
        };
      }
      if (signers) {
        config.sigVerify = true;
      }
      if (configOrSigners && typeof configOrSigners === "object" && "innerInstructions" in configOrSigners) {
        config.innerInstructions = configOrSigners.innerInstructions;
      }
      const args = [encodedTransaction, config];
      const unsafeRes = await this._rpcRequest("simulateTransaction", args);
      const res = create(unsafeRes, SimulatedTransactionResponseStruct);
      if ("error" in res) {
        let logs;
        if ("data" in res.error) {
          logs = res.error.data.logs;
          if (logs && Array.isArray(logs)) {
            const traceIndent = "\n    ";
            const logTrace = traceIndent + logs.join(traceIndent);
            console.error(res.error.message, logTrace);
          }
        }
        throw new SendTransactionError({
          action: "simulate",
          signature: "",
          transactionMessage: res.error.message,
          logs
        });
      }
      return res.result;
    }
    /**
     * Sign and send a transaction
     *
     * @deprecated Instead, call {@link sendTransaction} with a {@link
     * VersionedTransaction}
     */
    /**
     * Send a signed transaction
     */
    // eslint-disable-next-line no-dupe-class-members
    /**
     * Sign and send a transaction
     */
    // eslint-disable-next-line no-dupe-class-members
    async sendTransaction(transaction, signersOrOptions, options) {
      if ("version" in transaction) {
        if (signersOrOptions && Array.isArray(signersOrOptions)) {
          throw new Error("Invalid arguments");
        }
        const wireTransaction2 = transaction.serialize();
        return await this.sendRawTransaction(wireTransaction2, signersOrOptions);
      }
      if (signersOrOptions === void 0 || !Array.isArray(signersOrOptions)) {
        throw new Error("Invalid arguments");
      }
      const signers = signersOrOptions;
      if (transaction.nonceInfo) {
        transaction.sign(...signers);
      } else {
        let disableCache = this._disableBlockhashCaching;
        for (; ; ) {
          const latestBlockhash2 = await this._blockhashWithExpiryBlockHeight(disableCache);
          transaction.lastValidBlockHeight = latestBlockhash2.lastValidBlockHeight;
          transaction.recentBlockhash = latestBlockhash2.blockhash;
          transaction.sign(...signers);
          if (!transaction.signature) {
            throw new Error("!signature");
          }
          const signature2 = transaction.signature.toString("base64");
          if (!this._blockhashInfo.transactionSignatures.includes(signature2)) {
            this._blockhashInfo.transactionSignatures.push(signature2);
            break;
          } else {
            disableCache = true;
          }
        }
      }
      const wireTransaction = transaction.serialize();
      return await this.sendRawTransaction(wireTransaction, options);
    }
    /**
     * Send a transaction that has already been signed and serialized into the
     * wire format
     */
    async sendRawTransaction(rawTransaction, options) {
      const encodedTransaction = toBuffer(rawTransaction).toString("base64");
      const result = await this.sendEncodedTransaction(encodedTransaction, options);
      return result;
    }
    /**
     * Send a transaction that has already been signed, serialized into the
     * wire format, and encoded as a base64 string
     */
    async sendEncodedTransaction(encodedTransaction, options) {
      const config = {
        encoding: "base64"
      };
      const skipPreflight = options && options.skipPreflight;
      const preflightCommitment = skipPreflight === true ? "processed" : options && options.preflightCommitment || this.commitment;
      if (options && options.maxRetries != null) {
        config.maxRetries = options.maxRetries;
      }
      if (options && options.minContextSlot != null) {
        config.minContextSlot = options.minContextSlot;
      }
      if (skipPreflight) {
        config.skipPreflight = skipPreflight;
      }
      if (preflightCommitment) {
        config.preflightCommitment = preflightCommitment;
      }
      const args = [encodedTransaction, config];
      const unsafeRes = await this._rpcRequest("sendTransaction", args);
      const res = create(unsafeRes, SendTransactionRpcResult);
      if ("error" in res) {
        let logs = void 0;
        if ("data" in res.error) {
          logs = res.error.data.logs;
        }
        throw new SendTransactionError({
          action: skipPreflight ? "send" : "simulate",
          signature: "",
          transactionMessage: res.error.message,
          logs
        });
      }
      return res.result;
    }
    /**
     * @internal
     */
    _wsOnOpen() {
      this._rpcWebSocketConnected = true;
      this._rpcWebSocketHeartbeat = setInterval(() => {
        (async () => {
          try {
            await this._rpcWebSocket.notify("ping");
          } catch {
          }
        })();
      }, 5e3);
      this._updateSubscriptions();
    }
    /**
     * @internal
     */
    _wsOnError(err) {
      this._rpcWebSocketConnected = false;
      console.error("ws error:", err.message);
    }
    /**
     * @internal
     */
    _wsOnClose(code) {
      this._rpcWebSocketConnected = false;
      this._rpcWebSocketGeneration = (this._rpcWebSocketGeneration + 1) % Number.MAX_SAFE_INTEGER;
      if (this._rpcWebSocketIdleTimeout) {
        clearTimeout(this._rpcWebSocketIdleTimeout);
        this._rpcWebSocketIdleTimeout = null;
      }
      if (this._rpcWebSocketHeartbeat) {
        clearInterval(this._rpcWebSocketHeartbeat);
        this._rpcWebSocketHeartbeat = null;
      }
      if (code === 1e3) {
        this._updateSubscriptions();
        return;
      }
      this._subscriptionCallbacksByServerSubscriptionId = {};
      Object.entries(this._subscriptionsByHash).forEach(([hash, subscription]) => {
        this._setSubscription(hash, {
          ...subscription,
          state: "pending"
        });
      });
    }
    /**
     * @internal
     */
    _setSubscription(hash, nextSubscription) {
      const prevState = this._subscriptionsByHash[hash]?.state;
      this._subscriptionsByHash[hash] = nextSubscription;
      if (prevState !== nextSubscription.state) {
        const stateChangeCallbacks = this._subscriptionStateChangeCallbacksByHash[hash];
        if (stateChangeCallbacks) {
          stateChangeCallbacks.forEach((cb) => {
            try {
              cb(nextSubscription.state);
            } catch {
            }
          });
        }
      }
    }
    /**
     * @internal
     */
    _onSubscriptionStateChange(clientSubscriptionId, callback) {
      var _a;
      const hash = this._subscriptionHashByClientSubscriptionId[clientSubscriptionId];
      if (hash == null) {
        return () => {
        };
      }
      const stateChangeCallbacks = (_a = this._subscriptionStateChangeCallbacksByHash)[hash] || (_a[hash] = /* @__PURE__ */ new Set());
      stateChangeCallbacks.add(callback);
      return () => {
        stateChangeCallbacks.delete(callback);
        if (stateChangeCallbacks.size === 0) {
          delete this._subscriptionStateChangeCallbacksByHash[hash];
        }
      };
    }
    /**
     * @internal
     */
    async _updateSubscriptions() {
      if (Object.keys(this._subscriptionsByHash).length === 0) {
        if (this._rpcWebSocketConnected) {
          this._rpcWebSocketConnected = false;
          this._rpcWebSocketIdleTimeout = setTimeout(() => {
            this._rpcWebSocketIdleTimeout = null;
            try {
              this._rpcWebSocket.close();
            } catch (err) {
              if (err instanceof Error) {
                console.log(`Error when closing socket connection: ${err.message}`);
              }
            }
          }, 500);
        }
        return;
      }
      if (this._rpcWebSocketIdleTimeout !== null) {
        clearTimeout(this._rpcWebSocketIdleTimeout);
        this._rpcWebSocketIdleTimeout = null;
        this._rpcWebSocketConnected = true;
      }
      if (!this._rpcWebSocketConnected) {
        this._rpcWebSocket.connect();
        return;
      }
      const activeWebSocketGeneration = this._rpcWebSocketGeneration;
      const isCurrentConnectionStillActive = () => {
        return activeWebSocketGeneration === this._rpcWebSocketGeneration;
      };
      await Promise.all(
        // Don't be tempted to change this to `Object.entries`. We call
        // `_updateSubscriptions` recursively when processing the state,
        // so it's important that we look up the *current* version of
        // each subscription, every time we process a hash.
        Object.keys(this._subscriptionsByHash).map(async (hash) => {
          const subscription = this._subscriptionsByHash[hash];
          if (subscription === void 0) {
            return;
          }
          switch (subscription.state) {
            case "pending":
            case "unsubscribed":
              if (subscription.callbacks.size === 0) {
                delete this._subscriptionsByHash[hash];
                if (subscription.state === "unsubscribed") {
                  delete this._subscriptionCallbacksByServerSubscriptionId[subscription.serverSubscriptionId];
                }
                await this._updateSubscriptions();
                return;
              }
              await (async () => {
                const {
                  args,
                  method
                } = subscription;
                try {
                  this._setSubscription(hash, {
                    ...subscription,
                    state: "subscribing"
                  });
                  const serverSubscriptionId = await this._rpcWebSocket.call(method, args);
                  this._setSubscription(hash, {
                    ...subscription,
                    serverSubscriptionId,
                    state: "subscribed"
                  });
                  this._subscriptionCallbacksByServerSubscriptionId[serverSubscriptionId] = subscription.callbacks;
                  await this._updateSubscriptions();
                } catch (e) {
                  console.error(`Received ${e instanceof Error ? "" : "JSON-RPC "}error calling \`${method}\``, {
                    args,
                    error: e
                  });
                  if (!isCurrentConnectionStillActive()) {
                    return;
                  }
                  this._setSubscription(hash, {
                    ...subscription,
                    state: "pending"
                  });
                  await this._updateSubscriptions();
                }
              })();
              break;
            case "subscribed":
              if (subscription.callbacks.size === 0) {
                await (async () => {
                  const {
                    serverSubscriptionId,
                    unsubscribeMethod
                  } = subscription;
                  if (this._subscriptionsAutoDisposedByRpc.has(serverSubscriptionId)) {
                    this._subscriptionsAutoDisposedByRpc.delete(serverSubscriptionId);
                  } else {
                    this._setSubscription(hash, {
                      ...subscription,
                      state: "unsubscribing"
                    });
                    this._setSubscription(hash, {
                      ...subscription,
                      state: "unsubscribing"
                    });
                    try {
                      await this._rpcWebSocket.call(unsubscribeMethod, [serverSubscriptionId]);
                    } catch (e) {
                      if (e instanceof Error) {
                        console.error(`${unsubscribeMethod} error:`, e.message);
                      }
                      if (!isCurrentConnectionStillActive()) {
                        return;
                      }
                      this._setSubscription(hash, {
                        ...subscription,
                        state: "subscribed"
                      });
                      await this._updateSubscriptions();
                      return;
                    }
                  }
                  this._setSubscription(hash, {
                    ...subscription,
                    state: "unsubscribed"
                  });
                  await this._updateSubscriptions();
                })();
              }
              break;
          }
        })
      );
    }
    /**
     * @internal
     */
    _handleServerNotification(serverSubscriptionId, callbackArgs) {
      const callbacks = this._subscriptionCallbacksByServerSubscriptionId[serverSubscriptionId];
      if (callbacks === void 0) {
        return;
      }
      callbacks.forEach((cb) => {
        try {
          cb(
            ...callbackArgs
          );
        } catch (e) {
          console.error(e);
        }
      });
    }
    /**
     * @internal
     */
    _wsOnAccountNotification(notification) {
      const {
        result,
        subscription
      } = create(notification, AccountNotificationResult);
      this._handleServerNotification(subscription, [result.value, result.context]);
    }
    /**
     * @internal
     */
    _makeSubscription(subscriptionConfig, args) {
      const clientSubscriptionId = this._nextClientSubscriptionId++;
      const hash = fastStableStringify([subscriptionConfig.method, args]);
      const existingSubscription = this._subscriptionsByHash[hash];
      if (existingSubscription === void 0) {
        this._subscriptionsByHash[hash] = {
          ...subscriptionConfig,
          args,
          callbacks: /* @__PURE__ */ new Set([subscriptionConfig.callback]),
          state: "pending"
        };
      } else {
        existingSubscription.callbacks.add(subscriptionConfig.callback);
      }
      this._subscriptionHashByClientSubscriptionId[clientSubscriptionId] = hash;
      this._subscriptionDisposeFunctionsByClientSubscriptionId[clientSubscriptionId] = async () => {
        delete this._subscriptionDisposeFunctionsByClientSubscriptionId[clientSubscriptionId];
        delete this._subscriptionHashByClientSubscriptionId[clientSubscriptionId];
        const subscription = this._subscriptionsByHash[hash];
        assert2(subscription !== void 0, `Could not find a \`Subscription\` when tearing down client subscription #${clientSubscriptionId}`);
        subscription.callbacks.delete(subscriptionConfig.callback);
        await this._updateSubscriptions();
      };
      this._updateSubscriptions();
      return clientSubscriptionId;
    }
    /**
     * Register a callback to be invoked whenever the specified account changes
     *
     * @param publicKey Public key of the account to monitor
     * @param callback Function to invoke whenever the account is changed
     * @param config
     * @return subscription id
     */
    /** @deprecated Instead, pass in an {@link AccountSubscriptionConfig} */
    // eslint-disable-next-line no-dupe-class-members
    // eslint-disable-next-line no-dupe-class-members
    onAccountChange(publicKey3, callback, commitmentOrConfig) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs(
        [publicKey3.toBase58()],
        commitment || this._commitment || "finalized",
        // Apply connection/server default.
        "base64",
        config
      );
      return this._makeSubscription({
        callback,
        method: "accountSubscribe",
        unsubscribeMethod: "accountUnsubscribe"
      }, args);
    }
    /**
     * Deregister an account notification callback
     *
     * @param clientSubscriptionId client subscription id to deregister
     */
    async removeAccountChangeListener(clientSubscriptionId) {
      await this._unsubscribeClientSubscription(clientSubscriptionId, "account change");
    }
    /**
     * @internal
     */
    _wsOnProgramAccountNotification(notification) {
      const {
        result,
        subscription
      } = create(notification, ProgramAccountNotificationResult);
      this._handleServerNotification(subscription, [{
        accountId: result.value.pubkey,
        accountInfo: result.value.account
      }, result.context]);
    }
    /**
     * Register a callback to be invoked whenever accounts owned by the
     * specified program change
     *
     * @param programId Public key of the program to monitor
     * @param callback Function to invoke whenever the account is changed
     * @param config
     * @return subscription id
     */
    /** @deprecated Instead, pass in a {@link ProgramAccountSubscriptionConfig} */
    // eslint-disable-next-line no-dupe-class-members
    // eslint-disable-next-line no-dupe-class-members
    onProgramAccountChange(programId, callback, commitmentOrConfig, maybeFilters) {
      const {
        commitment,
        config
      } = extractCommitmentFromConfig(commitmentOrConfig);
      const args = this._buildArgs(
        [programId.toBase58()],
        commitment || this._commitment || "finalized",
        // Apply connection/server default.
        "base64",
        config ? config : maybeFilters ? {
          filters: applyDefaultMemcmpEncodingToFilters(maybeFilters)
        } : void 0
        /* extra */
      );
      return this._makeSubscription({
        callback,
        method: "programSubscribe",
        unsubscribeMethod: "programUnsubscribe"
      }, args);
    }
    /**
     * Deregister an account notification callback
     *
     * @param clientSubscriptionId client subscription id to deregister
     */
    async removeProgramAccountChangeListener(clientSubscriptionId) {
      await this._unsubscribeClientSubscription(clientSubscriptionId, "program account change");
    }
    /**
     * Registers a callback to be invoked whenever logs are emitted.
     */
    onLogs(filter, callback, commitment) {
      const args = this._buildArgs(
        [typeof filter === "object" ? {
          mentions: [filter.toString()]
        } : filter],
        commitment || this._commitment || "finalized"
        // Apply connection/server default.
      );
      return this._makeSubscription({
        callback,
        method: "logsSubscribe",
        unsubscribeMethod: "logsUnsubscribe"
      }, args);
    }
    /**
     * Deregister a logs callback.
     *
     * @param clientSubscriptionId client subscription id to deregister.
     */
    async removeOnLogsListener(clientSubscriptionId) {
      await this._unsubscribeClientSubscription(clientSubscriptionId, "logs");
    }
    /**
     * @internal
     */
    _wsOnLogsNotification(notification) {
      const {
        result,
        subscription
      } = create(notification, LogsNotificationResult);
      this._handleServerNotification(subscription, [result.value, result.context]);
    }
    /**
     * @internal
     */
    _wsOnSlotNotification(notification) {
      const {
        result,
        subscription
      } = create(notification, SlotNotificationResult);
      this._handleServerNotification(subscription, [result]);
    }
    /**
     * Register a callback to be invoked upon slot changes
     *
     * @param callback Function to invoke whenever the slot changes
     * @return subscription id
     */
    onSlotChange(callback) {
      return this._makeSubscription(
        {
          callback,
          method: "slotSubscribe",
          unsubscribeMethod: "slotUnsubscribe"
        },
        []
        /* args */
      );
    }
    /**
     * Deregister a slot notification callback
     *
     * @param clientSubscriptionId client subscription id to deregister
     */
    async removeSlotChangeListener(clientSubscriptionId) {
      await this._unsubscribeClientSubscription(clientSubscriptionId, "slot change");
    }
    /**
     * @internal
     */
    _wsOnSlotUpdatesNotification(notification) {
      const {
        result,
        subscription
      } = create(notification, SlotUpdateNotificationResult);
      this._handleServerNotification(subscription, [result]);
    }
    /**
     * Register a callback to be invoked upon slot updates. {@link SlotUpdate}'s
     * may be useful to track live progress of a cluster.
     *
     * @param callback Function to invoke whenever the slot updates
     * @return subscription id
     */
    onSlotUpdate(callback) {
      return this._makeSubscription(
        {
          callback,
          method: "slotsUpdatesSubscribe",
          unsubscribeMethod: "slotsUpdatesUnsubscribe"
        },
        []
        /* args */
      );
    }
    /**
     * Deregister a slot update notification callback
     *
     * @param clientSubscriptionId client subscription id to deregister
     */
    async removeSlotUpdateListener(clientSubscriptionId) {
      await this._unsubscribeClientSubscription(clientSubscriptionId, "slot update");
    }
    /**
     * @internal
     */
    async _unsubscribeClientSubscription(clientSubscriptionId, subscriptionName) {
      const dispose = this._subscriptionDisposeFunctionsByClientSubscriptionId[clientSubscriptionId];
      if (dispose) {
        await dispose();
      } else {
        console.warn(`Ignored unsubscribe request because an active subscription with id \`${clientSubscriptionId}\` for '${subscriptionName}' events could not be found.`);
      }
    }
    _buildArgs(args, override, encoding, extra) {
      const commitment = override || this._commitment;
      if (commitment || encoding || extra) {
        let options = {};
        if (encoding) {
          options.encoding = encoding;
        }
        if (commitment) {
          options.commitment = commitment;
        }
        if (extra) {
          options = Object.assign(options, extra);
        }
        args.push(options);
      }
      return args;
    }
    /**
     * @internal
     */
    _buildArgsAtLeastConfirmed(args, override, encoding, extra) {
      const commitment = override || this._commitment;
      if (commitment && !["confirmed", "finalized"].includes(commitment)) {
        throw new Error("Using Connection with default commitment: `" + this._commitment + "`, but method requires at least `confirmed`");
      }
      return this._buildArgs(args, override, encoding, extra);
    }
    /**
     * @internal
     */
    _wsOnSignatureNotification(notification) {
      const {
        result,
        subscription
      } = create(notification, SignatureNotificationResult);
      if (result.value !== "receivedSignature") {
        this._subscriptionsAutoDisposedByRpc.add(subscription);
      }
      this._handleServerNotification(subscription, result.value === "receivedSignature" ? [{
        type: "received"
      }, result.context] : [{
        type: "status",
        result: result.value
      }, result.context]);
    }
    /**
     * Register a callback to be invoked upon signature updates
     *
     * @param signature Transaction signature string in base 58
     * @param callback Function to invoke on signature notifications
     * @param commitment Specify the commitment level signature must reach before notification
     * @return subscription id
     */
    onSignature(signature2, callback, commitment) {
      const args = this._buildArgs(
        [signature2],
        commitment || this._commitment || "finalized"
        // Apply connection/server default.
      );
      const clientSubscriptionId = this._makeSubscription({
        callback: (notification, context) => {
          if (notification.type === "status") {
            callback(notification.result, context);
            try {
              this.removeSignatureListener(clientSubscriptionId);
            } catch (_err) {
            }
          }
        },
        method: "signatureSubscribe",
        unsubscribeMethod: "signatureUnsubscribe"
      }, args);
      return clientSubscriptionId;
    }
    /**
     * Register a callback to be invoked when a transaction is
     * received and/or processed.
     *
     * @param signature Transaction signature string in base 58
     * @param callback Function to invoke on signature notifications
     * @param options Enable received notifications and set the commitment
     *   level that signature must reach before notification
     * @return subscription id
     */
    onSignatureWithOptions(signature2, callback, options) {
      const {
        commitment,
        ...extra
      } = {
        ...options,
        commitment: options && options.commitment || this._commitment || "finalized"
        // Apply connection/server default.
      };
      const args = this._buildArgs([signature2], commitment, void 0, extra);
      const clientSubscriptionId = this._makeSubscription({
        callback: (notification, context) => {
          callback(notification, context);
          try {
            this.removeSignatureListener(clientSubscriptionId);
          } catch (_err) {
          }
        },
        method: "signatureSubscribe",
        unsubscribeMethod: "signatureUnsubscribe"
      }, args);
      return clientSubscriptionId;
    }
    /**
     * Deregister a signature notification callback
     *
     * @param clientSubscriptionId client subscription id to deregister
     */
    async removeSignatureListener(clientSubscriptionId) {
      await this._unsubscribeClientSubscription(clientSubscriptionId, "signature result");
    }
    /**
     * @internal
     */
    _wsOnRootNotification(notification) {
      const {
        result,
        subscription
      } = create(notification, RootNotificationResult);
      this._handleServerNotification(subscription, [result]);
    }
    /**
     * Register a callback to be invoked upon root changes
     *
     * @param callback Function to invoke whenever the root changes
     * @return subscription id
     */
    onRootChange(callback) {
      return this._makeSubscription(
        {
          callback,
          method: "rootSubscribe",
          unsubscribeMethod: "rootUnsubscribe"
        },
        []
        /* args */
      );
    }
    /**
     * Deregister a root notification callback
     *
     * @param clientSubscriptionId client subscription id to deregister
     */
    async removeRootChangeListener(clientSubscriptionId) {
      await this._unsubscribeClientSubscription(clientSubscriptionId, "root change");
    }
  };
  var Keypair = class _Keypair {
    /**
     * Create a new keypair instance.
     * Generate random keypair if no {@link Ed25519Keypair} is provided.
     *
     * @param {Ed25519Keypair} keypair ed25519 keypair
     */
    constructor(keypair) {
      this._keypair = void 0;
      this._keypair = keypair ?? generateKeypair();
    }
    /**
     * Generate a new random keypair
     *
     * @returns {Keypair} Keypair
     */
    static generate() {
      return new _Keypair(generateKeypair());
    }
    /**
     * Create a keypair from a raw secret key byte array.
     *
     * This method should only be used to recreate a keypair from a previously
     * generated secret key. Generating keypairs from a random seed should be done
     * with the {@link Keypair.fromSeed} method.
     *
     * @throws error if the provided secret key is invalid and validation is not skipped.
     *
     * @param secretKey secret key byte array
     * @param options skip secret key validation
     *
     * @returns {Keypair} Keypair
     */
    static fromSecretKey(secretKey, options) {
      if (secretKey.byteLength !== 64) {
        throw new Error("bad secret key size");
      }
      const publicKey3 = secretKey.slice(32, 64);
      if (!options || !options.skipValidation) {
        const privateScalar = secretKey.slice(0, 32);
        const computedPublicKey = getPublicKey(privateScalar);
        for (let ii = 0; ii < 32; ii++) {
          if (publicKey3[ii] !== computedPublicKey[ii]) {
            throw new Error("provided secretKey is invalid");
          }
        }
      }
      return new _Keypair({
        publicKey: publicKey3,
        secretKey
      });
    }
    /**
     * Generate a keypair from a 32 byte seed.
     *
     * @param seed seed byte array
     *
     * @returns {Keypair} Keypair
     */
    static fromSeed(seed) {
      const publicKey3 = getPublicKey(seed);
      const secretKey = new Uint8Array(64);
      secretKey.set(seed);
      secretKey.set(publicKey3, 32);
      return new _Keypair({
        publicKey: publicKey3,
        secretKey
      });
    }
    /**
     * The public key for this keypair
     *
     * @returns {PublicKey} PublicKey
     */
    get publicKey() {
      return new PublicKey(this._keypair.publicKey);
    }
    /**
     * The raw secret key for this keypair
     * @returns {Uint8Array} Secret key in an array of Uint8 bytes
     */
    get secretKey() {
      return new Uint8Array(this._keypair.secretKey);
    }
  };
  var LOOKUP_TABLE_INSTRUCTION_LAYOUTS = Object.freeze({
    CreateLookupTable: {
      index: 0,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), u64("recentSlot"), BufferLayout.u8("bumpSeed")])
    },
    FreezeLookupTable: {
      index: 1,
      layout: BufferLayout.struct([BufferLayout.u32("instruction")])
    },
    ExtendLookupTable: {
      index: 2,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), u64(), BufferLayout.seq(publicKey(), BufferLayout.offset(BufferLayout.u32(), -8), "addresses")])
    },
    DeactivateLookupTable: {
      index: 3,
      layout: BufferLayout.struct([BufferLayout.u32("instruction")])
    },
    CloseLookupTable: {
      index: 4,
      layout: BufferLayout.struct([BufferLayout.u32("instruction")])
    }
  });
  var AddressLookupTableProgram = class {
    /**
     * @internal
     */
    constructor() {
    }
    static createLookupTable(params) {
      const [lookupTableAddress, bumpSeed] = PublicKey.findProgramAddressSync([params.authority.toBuffer(), getU64Encoder().encode(params.recentSlot)], this.programId);
      const type2 = LOOKUP_TABLE_INSTRUCTION_LAYOUTS.CreateLookupTable;
      const data = encodeData(type2, {
        recentSlot: BigInt(params.recentSlot),
        bumpSeed
      });
      const keys = [{
        pubkey: lookupTableAddress,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: params.authority,
        isSigner: true,
        isWritable: false
      }, {
        pubkey: params.payer,
        isSigner: true,
        isWritable: true
      }, {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false
      }];
      return [new TransactionInstruction({
        programId: this.programId,
        keys,
        data
      }), lookupTableAddress];
    }
    static freezeLookupTable(params) {
      const type2 = LOOKUP_TABLE_INSTRUCTION_LAYOUTS.FreezeLookupTable;
      const data = encodeData(type2);
      const keys = [{
        pubkey: params.lookupTable,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: params.authority,
        isSigner: true,
        isWritable: false
      }];
      return new TransactionInstruction({
        programId: this.programId,
        keys,
        data
      });
    }
    static extendLookupTable(params) {
      const type2 = LOOKUP_TABLE_INSTRUCTION_LAYOUTS.ExtendLookupTable;
      const data = encodeData(type2, {
        addresses: params.addresses.map((addr) => addr.toBytes())
      });
      const keys = [{
        pubkey: params.lookupTable,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: params.authority,
        isSigner: true,
        isWritable: false
      }];
      if (params.payer) {
        keys.push({
          pubkey: params.payer,
          isSigner: true,
          isWritable: true
        }, {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false
        });
      }
      return new TransactionInstruction({
        programId: this.programId,
        keys,
        data
      });
    }
    static deactivateLookupTable(params) {
      const type2 = LOOKUP_TABLE_INSTRUCTION_LAYOUTS.DeactivateLookupTable;
      const data = encodeData(type2);
      const keys = [{
        pubkey: params.lookupTable,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: params.authority,
        isSigner: true,
        isWritable: false
      }];
      return new TransactionInstruction({
        programId: this.programId,
        keys,
        data
      });
    }
    static closeLookupTable(params) {
      const type2 = LOOKUP_TABLE_INSTRUCTION_LAYOUTS.CloseLookupTable;
      const data = encodeData(type2);
      const keys = [{
        pubkey: params.lookupTable,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: params.authority,
        isSigner: true,
        isWritable: false
      }, {
        pubkey: params.recipient,
        isSigner: false,
        isWritable: true
      }];
      return new TransactionInstruction({
        programId: this.programId,
        keys,
        data
      });
    }
  };
  AddressLookupTableProgram.programId = new PublicKey("AddressLookupTab1e1111111111111111111111111");
  var COMPUTE_BUDGET_INSTRUCTION_LAYOUTS = Object.freeze({
    RequestUnits: {
      index: 0,
      layout: BufferLayout.struct([BufferLayout.u8("instruction"), BufferLayout.u32("units"), BufferLayout.u32("additionalFee")])
    },
    RequestHeapFrame: {
      index: 1,
      layout: BufferLayout.struct([BufferLayout.u8("instruction"), BufferLayout.u32("bytes")])
    },
    SetComputeUnitLimit: {
      index: 2,
      layout: BufferLayout.struct([BufferLayout.u8("instruction"), BufferLayout.u32("units")])
    },
    SetComputeUnitPrice: {
      index: 3,
      layout: BufferLayout.struct([BufferLayout.u8("instruction"), u64("microLamports")])
    }
  });
  var ComputeBudgetProgram = class {
    /**
     * @internal
     */
    constructor() {
    }
    /**
     * Public key that identifies the Compute Budget program
     */
    /**
     * @deprecated Instead, call {@link setComputeUnitLimit} and/or {@link setComputeUnitPrice}
     */
    static requestUnits(params) {
      const type2 = COMPUTE_BUDGET_INSTRUCTION_LAYOUTS.RequestUnits;
      const data = encodeData(type2, params);
      return new TransactionInstruction({
        keys: [],
        programId: this.programId,
        data
      });
    }
    static requestHeapFrame(params) {
      const type2 = COMPUTE_BUDGET_INSTRUCTION_LAYOUTS.RequestHeapFrame;
      const data = encodeData(type2, params);
      return new TransactionInstruction({
        keys: [],
        programId: this.programId,
        data
      });
    }
    static setComputeUnitLimit(params) {
      const type2 = COMPUTE_BUDGET_INSTRUCTION_LAYOUTS.SetComputeUnitLimit;
      const data = encodeData(type2, params);
      return new TransactionInstruction({
        keys: [],
        programId: this.programId,
        data
      });
    }
    static setComputeUnitPrice(params) {
      const type2 = COMPUTE_BUDGET_INSTRUCTION_LAYOUTS.SetComputeUnitPrice;
      const data = encodeData(type2, {
        microLamports: BigInt(params.microLamports)
      });
      return new TransactionInstruction({
        keys: [],
        programId: this.programId,
        data
      });
    }
  };
  ComputeBudgetProgram.programId = new PublicKey("ComputeBudget111111111111111111111111111111");
  var PRIVATE_KEY_BYTES$1 = 64;
  var PUBLIC_KEY_BYTES$1 = 32;
  var SIGNATURE_BYTES = 64;
  var ED25519_INSTRUCTION_LAYOUT = BufferLayout.struct([BufferLayout.u8("numSignatures"), BufferLayout.u8("padding"), BufferLayout.u16("signatureOffset"), BufferLayout.u16("signatureInstructionIndex"), BufferLayout.u16("publicKeyOffset"), BufferLayout.u16("publicKeyInstructionIndex"), BufferLayout.u16("messageDataOffset"), BufferLayout.u16("messageDataSize"), BufferLayout.u16("messageInstructionIndex")]);
  var Ed25519Program = class _Ed25519Program {
    /**
     * @internal
     */
    constructor() {
    }
    /**
     * Public key that identifies the ed25519 program
     */
    /**
     * Create an ed25519 instruction with a public key and signature. The
     * public key must be a buffer that is 32 bytes long, and the signature
     * must be a buffer of 64 bytes.
     */
    static createInstructionWithPublicKey(params) {
      const {
        publicKey: publicKey3,
        message,
        signature: signature2,
        instructionIndex
      } = params;
      assert2(publicKey3.length === PUBLIC_KEY_BYTES$1, `Public Key must be ${PUBLIC_KEY_BYTES$1} bytes but received ${publicKey3.length} bytes`);
      assert2(signature2.length === SIGNATURE_BYTES, `Signature must be ${SIGNATURE_BYTES} bytes but received ${signature2.length} bytes`);
      const publicKeyOffset = ED25519_INSTRUCTION_LAYOUT.span;
      const signatureOffset = publicKeyOffset + publicKey3.length;
      const messageDataOffset = signatureOffset + signature2.length;
      const numSignatures = 1;
      const instructionData = import_buffer3.Buffer.alloc(messageDataOffset + message.length);
      const index = instructionIndex == null ? 65535 : instructionIndex;
      ED25519_INSTRUCTION_LAYOUT.encode({
        numSignatures,
        padding: 0,
        signatureOffset,
        signatureInstructionIndex: index,
        publicKeyOffset,
        publicKeyInstructionIndex: index,
        messageDataOffset,
        messageDataSize: message.length,
        messageInstructionIndex: index
      }, instructionData);
      instructionData.fill(publicKey3, publicKeyOffset);
      instructionData.fill(signature2, signatureOffset);
      instructionData.fill(message, messageDataOffset);
      return new TransactionInstruction({
        keys: [],
        programId: _Ed25519Program.programId,
        data: instructionData
      });
    }
    /**
     * Create an ed25519 instruction with a private key. The private key
     * must be a buffer that is 64 bytes long.
     */
    static createInstructionWithPrivateKey(params) {
      const {
        privateKey,
        message,
        instructionIndex
      } = params;
      assert2(privateKey.length === PRIVATE_KEY_BYTES$1, `Private key must be ${PRIVATE_KEY_BYTES$1} bytes but received ${privateKey.length} bytes`);
      try {
        const keypair = Keypair.fromSecretKey(privateKey);
        const publicKey3 = keypair.publicKey.toBytes();
        const signature2 = sign(message, keypair.secretKey);
        return this.createInstructionWithPublicKey({
          publicKey: publicKey3,
          message,
          signature: signature2,
          instructionIndex
        });
      } catch (error) {
        throw new Error(`Error creating instruction; ${error}`);
      }
    }
  };
  Ed25519Program.programId = new PublicKey("Ed25519SigVerify111111111111111111111111111");
  var ecdsaSign = (msgHash, privKey) => {
    const signature2 = secp256k1.sign(msgHash, privKey);
    return [signature2.toCompactRawBytes(), signature2.recovery];
  };
  secp256k1.utils.isValidPrivateKey;
  var publicKeyCreate = secp256k1.getPublicKey;
  var PRIVATE_KEY_BYTES = 32;
  var ETHEREUM_ADDRESS_BYTES = 20;
  var PUBLIC_KEY_BYTES = 64;
  var SIGNATURE_OFFSETS_SERIALIZED_SIZE = 11;
  var SECP256K1_INSTRUCTION_LAYOUT = BufferLayout.struct([BufferLayout.u8("numSignatures"), BufferLayout.u16("signatureOffset"), BufferLayout.u8("signatureInstructionIndex"), BufferLayout.u16("ethAddressOffset"), BufferLayout.u8("ethAddressInstructionIndex"), BufferLayout.u16("messageDataOffset"), BufferLayout.u16("messageDataSize"), BufferLayout.u8("messageInstructionIndex"), BufferLayout.blob(20, "ethAddress"), BufferLayout.blob(64, "signature"), BufferLayout.u8("recoveryId")]);
  var Secp256k1Program = class _Secp256k1Program {
    /**
     * @internal
     */
    constructor() {
    }
    /**
     * Public key that identifies the secp256k1 program
     */
    /**
     * Construct an Ethereum address from a secp256k1 public key buffer.
     * @param {Buffer} publicKey a 64 byte secp256k1 public key buffer
     */
    static publicKeyToEthAddress(publicKey3) {
      assert2(publicKey3.length === PUBLIC_KEY_BYTES, `Public key must be ${PUBLIC_KEY_BYTES} bytes but received ${publicKey3.length} bytes`);
      try {
        return import_buffer3.Buffer.from(keccak_256(toBuffer(publicKey3))).slice(-ETHEREUM_ADDRESS_BYTES);
      } catch (error) {
        throw new Error(`Error constructing Ethereum address: ${error}`);
      }
    }
    /**
     * Create an secp256k1 instruction with a public key. The public key
     * must be a buffer that is 64 bytes long.
     */
    static createInstructionWithPublicKey(params) {
      const {
        publicKey: publicKey3,
        message,
        signature: signature2,
        recoveryId,
        instructionIndex
      } = params;
      return _Secp256k1Program.createInstructionWithEthAddress({
        ethAddress: _Secp256k1Program.publicKeyToEthAddress(publicKey3),
        message,
        signature: signature2,
        recoveryId,
        instructionIndex
      });
    }
    /**
     * Create an secp256k1 instruction with an Ethereum address. The address
     * must be a hex string or a buffer that is 20 bytes long.
     */
    static createInstructionWithEthAddress(params) {
      const {
        ethAddress: rawAddress,
        message,
        signature: signature2,
        recoveryId,
        instructionIndex = 0
      } = params;
      let ethAddress;
      if (typeof rawAddress === "string") {
        if (rawAddress.startsWith("0x")) {
          ethAddress = import_buffer3.Buffer.from(rawAddress.substr(2), "hex");
        } else {
          ethAddress = import_buffer3.Buffer.from(rawAddress, "hex");
        }
      } else {
        ethAddress = rawAddress;
      }
      assert2(ethAddress.length === ETHEREUM_ADDRESS_BYTES, `Address must be ${ETHEREUM_ADDRESS_BYTES} bytes but received ${ethAddress.length} bytes`);
      const dataStart = 1 + SIGNATURE_OFFSETS_SERIALIZED_SIZE;
      const ethAddressOffset = dataStart;
      const signatureOffset = dataStart + ethAddress.length;
      const messageDataOffset = signatureOffset + signature2.length + 1;
      const numSignatures = 1;
      const instructionData = import_buffer3.Buffer.alloc(SECP256K1_INSTRUCTION_LAYOUT.span + message.length);
      SECP256K1_INSTRUCTION_LAYOUT.encode({
        numSignatures,
        signatureOffset,
        signatureInstructionIndex: instructionIndex,
        ethAddressOffset,
        ethAddressInstructionIndex: instructionIndex,
        messageDataOffset,
        messageDataSize: message.length,
        messageInstructionIndex: instructionIndex,
        signature: toBuffer(signature2),
        ethAddress: toBuffer(ethAddress),
        recoveryId
      }, instructionData);
      instructionData.fill(toBuffer(message), SECP256K1_INSTRUCTION_LAYOUT.span);
      return new TransactionInstruction({
        keys: [],
        programId: _Secp256k1Program.programId,
        data: instructionData
      });
    }
    /**
     * Create an secp256k1 instruction with a private key. The private key
     * must be a buffer that is 32 bytes long.
     */
    static createInstructionWithPrivateKey(params) {
      const {
        privateKey: pkey,
        message,
        instructionIndex
      } = params;
      assert2(pkey.length === PRIVATE_KEY_BYTES, `Private key must be ${PRIVATE_KEY_BYTES} bytes but received ${pkey.length} bytes`);
      try {
        const privateKey = toBuffer(pkey);
        const publicKey3 = publicKeyCreate(
          privateKey,
          false
          /* isCompressed */
        ).slice(1);
        const messageHash = import_buffer3.Buffer.from(keccak_256(toBuffer(message)));
        const [signature2, recoveryId] = ecdsaSign(messageHash, privateKey);
        return this.createInstructionWithPublicKey({
          publicKey: publicKey3,
          message,
          signature: signature2,
          recoveryId,
          instructionIndex
        });
      } catch (error) {
        throw new Error(`Error creating instruction; ${error}`);
      }
    }
  };
  Secp256k1Program.programId = new PublicKey("KeccakSecp256k11111111111111111111111111111");
  var _Lockup;
  var STAKE_CONFIG_ID = new PublicKey("StakeConfig11111111111111111111111111111111");
  var Lockup = class {
    /**
     * Create a new Lockup object
     */
    constructor(unixTimestamp, epoch, custodian) {
      this.unixTimestamp = void 0;
      this.epoch = void 0;
      this.custodian = void 0;
      this.unixTimestamp = unixTimestamp;
      this.epoch = epoch;
      this.custodian = custodian;
    }
    /**
     * Default, inactive Lockup value
     */
  };
  _Lockup = Lockup;
  Lockup.default = new _Lockup(0, 0, PublicKey.default);
  var STAKE_INSTRUCTION_LAYOUTS = Object.freeze({
    Initialize: {
      index: 0,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), authorized(), lockup()])
    },
    Authorize: {
      index: 1,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), publicKey("newAuthorized"), BufferLayout.u32("stakeAuthorizationType")])
    },
    Delegate: {
      index: 2,
      layout: BufferLayout.struct([BufferLayout.u32("instruction")])
    },
    Split: {
      index: 3,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), BufferLayout.ns64("lamports")])
    },
    Withdraw: {
      index: 4,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), BufferLayout.ns64("lamports")])
    },
    Deactivate: {
      index: 5,
      layout: BufferLayout.struct([BufferLayout.u32("instruction")])
    },
    Merge: {
      index: 7,
      layout: BufferLayout.struct([BufferLayout.u32("instruction")])
    },
    AuthorizeWithSeed: {
      index: 8,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), publicKey("newAuthorized"), BufferLayout.u32("stakeAuthorizationType"), rustString("authoritySeed"), publicKey("authorityOwner")])
    }
  });
  var StakeAuthorizationLayout = Object.freeze({
    Staker: {
      index: 0
    },
    Withdrawer: {
      index: 1
    }
  });
  var StakeProgram = class {
    /**
     * @internal
     */
    constructor() {
    }
    /**
     * Public key that identifies the Stake program
     */
    /**
     * Generate an Initialize instruction to add to a Stake Create transaction
     */
    static initialize(params) {
      const {
        stakePubkey,
        authorized: authorized2,
        lockup: maybeLockup
      } = params;
      const lockup2 = maybeLockup || Lockup.default;
      const type2 = STAKE_INSTRUCTION_LAYOUTS.Initialize;
      const data = encodeData(type2, {
        authorized: {
          staker: toBuffer(authorized2.staker.toBuffer()),
          withdrawer: toBuffer(authorized2.withdrawer.toBuffer())
        },
        lockup: {
          unixTimestamp: lockup2.unixTimestamp,
          epoch: lockup2.epoch,
          custodian: toBuffer(lockup2.custodian.toBuffer())
        }
      });
      const instructionData = {
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_RENT_PUBKEY,
          isSigner: false,
          isWritable: false
        }],
        programId: this.programId,
        data
      };
      return new TransactionInstruction(instructionData);
    }
    /**
     * Generate a Transaction that creates a new Stake account at
     *   an address generated with `from`, a seed, and the Stake programId
     */
    static createAccountWithSeed(params) {
      const transaction = new Transaction();
      transaction.add(SystemProgram.createAccountWithSeed({
        fromPubkey: params.fromPubkey,
        newAccountPubkey: params.stakePubkey,
        basePubkey: params.basePubkey,
        seed: params.seed,
        lamports: params.lamports,
        space: this.space,
        programId: this.programId
      }));
      const {
        stakePubkey,
        authorized: authorized2,
        lockup: lockup2
      } = params;
      return transaction.add(this.initialize({
        stakePubkey,
        authorized: authorized2,
        lockup: lockup2
      }));
    }
    /**
     * Generate a Transaction that creates a new Stake account
     */
    static createAccount(params) {
      const transaction = new Transaction();
      transaction.add(SystemProgram.createAccount({
        fromPubkey: params.fromPubkey,
        newAccountPubkey: params.stakePubkey,
        lamports: params.lamports,
        space: this.space,
        programId: this.programId
      }));
      const {
        stakePubkey,
        authorized: authorized2,
        lockup: lockup2
      } = params;
      return transaction.add(this.initialize({
        stakePubkey,
        authorized: authorized2,
        lockup: lockup2
      }));
    }
    /**
     * Generate a Transaction that delegates Stake tokens to a validator
     * Vote PublicKey. This transaction can also be used to redelegate Stake
     * to a new validator Vote PublicKey.
     */
    static delegate(params) {
      const {
        stakePubkey,
        authorizedPubkey,
        votePubkey
      } = params;
      const type2 = STAKE_INSTRUCTION_LAYOUTS.Delegate;
      const data = encodeData(type2);
      return new Transaction().add({
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: votePubkey,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_CLOCK_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_STAKE_HISTORY_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: STAKE_CONFIG_ID,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a Transaction that authorizes a new PublicKey as Staker
     * or Withdrawer on the Stake account.
     */
    static authorize(params) {
      const {
        stakePubkey,
        authorizedPubkey,
        newAuthorizedPubkey,
        stakeAuthorizationType,
        custodianPubkey
      } = params;
      const type2 = STAKE_INSTRUCTION_LAYOUTS.Authorize;
      const data = encodeData(type2, {
        newAuthorized: toBuffer(newAuthorizedPubkey.toBuffer()),
        stakeAuthorizationType: stakeAuthorizationType.index
      });
      const keys = [{
        pubkey: stakePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SYSVAR_CLOCK_PUBKEY,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: authorizedPubkey,
        isSigner: true,
        isWritable: false
      }];
      if (custodianPubkey) {
        keys.push({
          pubkey: custodianPubkey,
          isSigner: true,
          isWritable: false
        });
      }
      return new Transaction().add({
        keys,
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a Transaction that authorizes a new PublicKey as Staker
     * or Withdrawer on the Stake account.
     */
    static authorizeWithSeed(params) {
      const {
        stakePubkey,
        authorityBase,
        authoritySeed,
        authorityOwner,
        newAuthorizedPubkey,
        stakeAuthorizationType,
        custodianPubkey
      } = params;
      const type2 = STAKE_INSTRUCTION_LAYOUTS.AuthorizeWithSeed;
      const data = encodeData(type2, {
        newAuthorized: toBuffer(newAuthorizedPubkey.toBuffer()),
        stakeAuthorizationType: stakeAuthorizationType.index,
        authoritySeed,
        authorityOwner: toBuffer(authorityOwner.toBuffer())
      });
      const keys = [{
        pubkey: stakePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: authorityBase,
        isSigner: true,
        isWritable: false
      }, {
        pubkey: SYSVAR_CLOCK_PUBKEY,
        isSigner: false,
        isWritable: false
      }];
      if (custodianPubkey) {
        keys.push({
          pubkey: custodianPubkey,
          isSigner: true,
          isWritable: false
        });
      }
      return new Transaction().add({
        keys,
        programId: this.programId,
        data
      });
    }
    /**
     * @internal
     */
    static splitInstruction(params) {
      const {
        stakePubkey,
        authorizedPubkey,
        splitStakePubkey,
        lamports
      } = params;
      const type2 = STAKE_INSTRUCTION_LAYOUTS.Split;
      const data = encodeData(type2, {
        lamports
      });
      return new TransactionInstruction({
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: splitStakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a Transaction that splits Stake tokens into another stake account
     */
    static split(params, rentExemptReserve) {
      const transaction = new Transaction();
      transaction.add(SystemProgram.createAccount({
        fromPubkey: params.authorizedPubkey,
        newAccountPubkey: params.splitStakePubkey,
        lamports: rentExemptReserve,
        space: this.space,
        programId: this.programId
      }));
      return transaction.add(this.splitInstruction(params));
    }
    /**
     * Generate a Transaction that splits Stake tokens into another account
     * derived from a base public key and seed
     */
    static splitWithSeed(params, rentExemptReserve) {
      const {
        stakePubkey,
        authorizedPubkey,
        splitStakePubkey,
        basePubkey,
        seed,
        lamports
      } = params;
      const transaction = new Transaction();
      transaction.add(SystemProgram.allocate({
        accountPubkey: splitStakePubkey,
        basePubkey,
        seed,
        space: this.space,
        programId: this.programId
      }));
      if (rentExemptReserve && rentExemptReserve > 0) {
        transaction.add(SystemProgram.transfer({
          fromPubkey: params.authorizedPubkey,
          toPubkey: splitStakePubkey,
          lamports: rentExemptReserve
        }));
      }
      return transaction.add(this.splitInstruction({
        stakePubkey,
        authorizedPubkey,
        splitStakePubkey,
        lamports
      }));
    }
    /**
     * Generate a Transaction that merges Stake accounts.
     */
    static merge(params) {
      const {
        stakePubkey,
        sourceStakePubKey,
        authorizedPubkey
      } = params;
      const type2 = STAKE_INSTRUCTION_LAYOUTS.Merge;
      const data = encodeData(type2);
      return new Transaction().add({
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: sourceStakePubKey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_CLOCK_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_STAKE_HISTORY_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a Transaction that withdraws deactivated Stake tokens.
     */
    static withdraw(params) {
      const {
        stakePubkey,
        authorizedPubkey,
        toPubkey,
        lamports,
        custodianPubkey
      } = params;
      const type2 = STAKE_INSTRUCTION_LAYOUTS.Withdraw;
      const data = encodeData(type2, {
        lamports
      });
      const keys = [{
        pubkey: stakePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: toPubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SYSVAR_CLOCK_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: SYSVAR_STAKE_HISTORY_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: authorizedPubkey,
        isSigner: true,
        isWritable: false
      }];
      if (custodianPubkey) {
        keys.push({
          pubkey: custodianPubkey,
          isSigner: true,
          isWritable: false
        });
      }
      return new Transaction().add({
        keys,
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a Transaction that deactivates Stake tokens.
     */
    static deactivate(params) {
      const {
        stakePubkey,
        authorizedPubkey
      } = params;
      const type2 = STAKE_INSTRUCTION_LAYOUTS.Deactivate;
      const data = encodeData(type2);
      return new Transaction().add({
        keys: [{
          pubkey: stakePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_CLOCK_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: authorizedPubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data
      });
    }
  };
  StakeProgram.programId = new PublicKey("Stake11111111111111111111111111111111111111");
  StakeProgram.space = 200;
  var VOTE_INSTRUCTION_LAYOUTS = Object.freeze({
    InitializeAccount: {
      index: 0,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), voteInit()])
    },
    Authorize: {
      index: 1,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), publicKey("newAuthorized"), BufferLayout.u32("voteAuthorizationType")])
    },
    Withdraw: {
      index: 3,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), BufferLayout.ns64("lamports")])
    },
    UpdateValidatorIdentity: {
      index: 4,
      layout: BufferLayout.struct([BufferLayout.u32("instruction")])
    },
    AuthorizeWithSeed: {
      index: 10,
      layout: BufferLayout.struct([BufferLayout.u32("instruction"), voteAuthorizeWithSeedArgs()])
    }
  });
  var VoteAuthorizationLayout = Object.freeze({
    Voter: {
      index: 0
    },
    Withdrawer: {
      index: 1
    }
  });
  var VoteProgram = class _VoteProgram {
    /**
     * @internal
     */
    constructor() {
    }
    /**
     * Public key that identifies the Vote program
     */
    /**
     * Generate an Initialize instruction.
     */
    static initializeAccount(params) {
      const {
        votePubkey,
        nodePubkey,
        voteInit: voteInit2
      } = params;
      const type2 = VOTE_INSTRUCTION_LAYOUTS.InitializeAccount;
      const data = encodeData(type2, {
        voteInit: {
          nodePubkey: toBuffer(voteInit2.nodePubkey.toBuffer()),
          authorizedVoter: toBuffer(voteInit2.authorizedVoter.toBuffer()),
          authorizedWithdrawer: toBuffer(voteInit2.authorizedWithdrawer.toBuffer()),
          commission: voteInit2.commission
        }
      });
      const instructionData = {
        keys: [{
          pubkey: votePubkey,
          isSigner: false,
          isWritable: true
        }, {
          pubkey: SYSVAR_RENT_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: SYSVAR_CLOCK_PUBKEY,
          isSigner: false,
          isWritable: false
        }, {
          pubkey: nodePubkey,
          isSigner: true,
          isWritable: false
        }],
        programId: this.programId,
        data
      };
      return new TransactionInstruction(instructionData);
    }
    /**
     * Generate a transaction that creates a new Vote account.
     */
    static createAccount(params) {
      const transaction = new Transaction();
      transaction.add(SystemProgram.createAccount({
        fromPubkey: params.fromPubkey,
        newAccountPubkey: params.votePubkey,
        lamports: params.lamports,
        space: this.space,
        programId: this.programId
      }));
      return transaction.add(this.initializeAccount({
        votePubkey: params.votePubkey,
        nodePubkey: params.voteInit.nodePubkey,
        voteInit: params.voteInit
      }));
    }
    /**
     * Generate a transaction that authorizes a new Voter or Withdrawer on the Vote account.
     */
    static authorize(params) {
      const {
        votePubkey,
        authorizedPubkey,
        newAuthorizedPubkey,
        voteAuthorizationType
      } = params;
      const type2 = VOTE_INSTRUCTION_LAYOUTS.Authorize;
      const data = encodeData(type2, {
        newAuthorized: toBuffer(newAuthorizedPubkey.toBuffer()),
        voteAuthorizationType: voteAuthorizationType.index
      });
      const keys = [{
        pubkey: votePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SYSVAR_CLOCK_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: authorizedPubkey,
        isSigner: true,
        isWritable: false
      }];
      return new Transaction().add({
        keys,
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a transaction that authorizes a new Voter or Withdrawer on the Vote account
     * where the current Voter or Withdrawer authority is a derived key.
     */
    static authorizeWithSeed(params) {
      const {
        currentAuthorityDerivedKeyBasePubkey,
        currentAuthorityDerivedKeyOwnerPubkey,
        currentAuthorityDerivedKeySeed,
        newAuthorizedPubkey,
        voteAuthorizationType,
        votePubkey
      } = params;
      const type2 = VOTE_INSTRUCTION_LAYOUTS.AuthorizeWithSeed;
      const data = encodeData(type2, {
        voteAuthorizeWithSeedArgs: {
          currentAuthorityDerivedKeyOwnerPubkey: toBuffer(currentAuthorityDerivedKeyOwnerPubkey.toBuffer()),
          currentAuthorityDerivedKeySeed,
          newAuthorized: toBuffer(newAuthorizedPubkey.toBuffer()),
          voteAuthorizationType: voteAuthorizationType.index
        }
      });
      const keys = [{
        pubkey: votePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: SYSVAR_CLOCK_PUBKEY,
        isSigner: false,
        isWritable: false
      }, {
        pubkey: currentAuthorityDerivedKeyBasePubkey,
        isSigner: true,
        isWritable: false
      }];
      return new Transaction().add({
        keys,
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a transaction to withdraw from a Vote account.
     */
    static withdraw(params) {
      const {
        votePubkey,
        authorizedWithdrawerPubkey,
        lamports,
        toPubkey
      } = params;
      const type2 = VOTE_INSTRUCTION_LAYOUTS.Withdraw;
      const data = encodeData(type2, {
        lamports
      });
      const keys = [{
        pubkey: votePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: toPubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: authorizedWithdrawerPubkey,
        isSigner: true,
        isWritable: false
      }];
      return new Transaction().add({
        keys,
        programId: this.programId,
        data
      });
    }
    /**
     * Generate a transaction to withdraw safely from a Vote account.
     *
     * This function was created as a safeguard for vote accounts running validators, `safeWithdraw`
     * checks that the withdraw amount will not exceed the specified balance while leaving enough left
     * to cover rent. If you wish to close the vote account by withdrawing the full amount, call the
     * `withdraw` method directly.
     */
    static safeWithdraw(params, currentVoteAccountBalance, rentExemptMinimum) {
      if (params.lamports > currentVoteAccountBalance - rentExemptMinimum) {
        throw new Error("Withdraw will leave vote account with insufficient funds.");
      }
      return _VoteProgram.withdraw(params);
    }
    /**
     * Generate a transaction to update the validator identity (node pubkey) of a Vote account.
     */
    static updateValidatorIdentity(params) {
      const {
        votePubkey,
        authorizedWithdrawerPubkey,
        nodePubkey
      } = params;
      const type2 = VOTE_INSTRUCTION_LAYOUTS.UpdateValidatorIdentity;
      const data = encodeData(type2);
      const keys = [{
        pubkey: votePubkey,
        isSigner: false,
        isWritable: true
      }, {
        pubkey: nodePubkey,
        isSigner: true,
        isWritable: false
      }, {
        pubkey: authorizedWithdrawerPubkey,
        isSigner: true,
        isWritable: false
      }];
      return new Transaction().add({
        keys,
        programId: this.programId,
        data
      });
    }
  };
  VoteProgram.programId = new PublicKey("Vote111111111111111111111111111111111111111");
  VoteProgram.space = 3762;
  var VALIDATOR_INFO_KEY = new PublicKey("Va1idator1nfo111111111111111111111111111111");
  var InfoString = type({
    name: string(),
    website: optional(string()),
    details: optional(string()),
    iconUrl: optional(string()),
    keybaseUsername: optional(string())
  });
  var VOTE_PROGRAM_ID = new PublicKey("Vote111111111111111111111111111111111111111");
  var VoteAccountLayout = BufferLayout.struct([
    publicKey("nodePubkey"),
    publicKey("authorizedWithdrawer"),
    BufferLayout.u8("commission"),
    BufferLayout.nu64(),
    // votes.length
    BufferLayout.seq(BufferLayout.struct([BufferLayout.nu64("slot"), BufferLayout.u32("confirmationCount")]), BufferLayout.offset(BufferLayout.u32(), -8), "votes"),
    BufferLayout.u8("rootSlotValid"),
    BufferLayout.nu64("rootSlot"),
    BufferLayout.nu64(),
    // authorizedVoters.length
    BufferLayout.seq(BufferLayout.struct([BufferLayout.nu64("epoch"), publicKey("authorizedVoter")]), BufferLayout.offset(BufferLayout.u32(), -8), "authorizedVoters"),
    BufferLayout.struct([BufferLayout.seq(BufferLayout.struct([publicKey("authorizedPubkey"), BufferLayout.nu64("epochOfLastAuthorizedSwitch"), BufferLayout.nu64("targetEpoch")]), 32, "buf"), BufferLayout.nu64("idx"), BufferLayout.u8("isEmpty")], "priorVoters"),
    BufferLayout.nu64(),
    // epochCredits.length
    BufferLayout.seq(BufferLayout.struct([BufferLayout.nu64("epoch"), BufferLayout.nu64("credits"), BufferLayout.nu64("prevCredits")]), BufferLayout.offset(BufferLayout.u32(), -8), "epochCredits"),
    BufferLayout.struct([BufferLayout.nu64("slot"), BufferLayout.nu64("timestamp")], "lastTimestamp")
  ]);

  // node_modules/@solana/spl-token/lib/esm/constants.js
  init_buffer_shim();
  var TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  var TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
  var ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  var NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");
  var NATIVE_MINT_2022 = new PublicKey("9pan9bMn5HatX4EJdBwg9VgCa7Uz5HL8N1m5D3NdXejP");

  // node_modules/@solana/buffer-layout-utils/lib/esm/index.mjs
  init_buffer_shim();

  // node_modules/@solana/buffer-layout-utils/lib/esm/base.mjs
  init_buffer_shim();
  var encodeDecode = (layout) => {
    const decode = layout.decode.bind(layout);
    const encode = layout.encode.bind(layout);
    return { decode, encode };
  };

  // node_modules/@solana/buffer-layout-utils/lib/esm/bigint.mjs
  init_buffer_shim();
  var import_buffer_layout2 = __toESM(require_Layout(), 1);
  var import_bigint_buffer = __toESM(require_browser2(), 1);
  var bigInt = (length) => (property) => {
    const layout = (0, import_buffer_layout2.blob)(length, property);
    const { encode, decode } = encodeDecode(layout);
    const bigIntLayout = layout;
    bigIntLayout.decode = (buffer, offset2) => {
      const src = decode(buffer, offset2);
      return (0, import_bigint_buffer.toBigIntLE)(Buffer.from(src));
    };
    bigIntLayout.encode = (bigInt2, buffer, offset2) => {
      const src = (0, import_bigint_buffer.toBufferLE)(bigInt2, length);
      return encode(src, buffer, offset2);
    };
    return bigIntLayout;
  };
  var bigIntBE = (length) => (property) => {
    const layout = (0, import_buffer_layout2.blob)(length, property);
    const { encode, decode } = encodeDecode(layout);
    const bigIntLayout = layout;
    bigIntLayout.decode = (buffer, offset2) => {
      const src = decode(buffer, offset2);
      return (0, import_bigint_buffer.toBigIntBE)(Buffer.from(src));
    };
    bigIntLayout.encode = (bigInt2, buffer, offset2) => {
      const src = (0, import_bigint_buffer.toBufferBE)(bigInt2, length);
      return encode(src, buffer, offset2);
    };
    return bigIntLayout;
  };
  var u642 = bigInt(8);
  var u64be = bigIntBE(8);
  var u128 = bigInt(16);
  var u128be = bigIntBE(16);
  var u192 = bigInt(24);
  var u192be = bigIntBE(24);
  var u256 = bigInt(32);
  var u256be = bigIntBE(32);

  // node_modules/@solana/buffer-layout-utils/lib/esm/decimal.mjs
  init_buffer_shim();

  // node_modules/bignumber.js/bignumber.mjs
  init_buffer_shim();
  var isNumeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  var mathceil = Math.ceil;
  var mathfloor = Math.floor;
  var bignumberError = "[BigNumber Error] ";
  var tooManyDigits = bignumberError + "Number primitive has more than 15 significant digits: ";
  var BASE = 1e14;
  var LOG_BASE = 14;
  var MAX_SAFE_INTEGER = 9007199254740991;
  var POWS_TEN = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13];
  var SQRT_BASE = 1e7;
  var MAX = 1e9;
  function clone(configObject) {
    var div, convertBase, parseNumeric, P = BigNumber2.prototype = { constructor: BigNumber2, toString: null, valueOf: null }, ONE = new BigNumber2(1), DECIMAL_PLACES = 20, ROUNDING_MODE = 4, TO_EXP_NEG = -7, TO_EXP_POS = 21, MIN_EXP = -1e7, MAX_EXP = 1e7, CRYPTO = false, MODULO_MODE = 1, POW_PRECISION = 0, FORMAT = {
      prefix: "",
      groupSize: 3,
      secondaryGroupSize: 0,
      groupSeparator: ",",
      decimalSeparator: ".",
      fractionGroupSize: 0,
      fractionGroupSeparator: "\xA0",
      // non-breaking space
      suffix: ""
    }, ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz", alphabetHasNormalDecimalDigits = true;
    function BigNumber2(v, b) {
      var alphabet, c, caseChanged, e, i2, isNum, len, str, x = this;
      if (!(x instanceof BigNumber2)) return new BigNumber2(v, b);
      if (b == null) {
        if (v && v._isBigNumber === true) {
          x.s = v.s;
          if (!v.c || v.e > MAX_EXP) {
            x.c = x.e = null;
          } else if (v.e < MIN_EXP) {
            x.c = [x.e = 0];
          } else {
            x.e = v.e;
            x.c = v.c.slice();
          }
          return;
        }
        if ((isNum = typeof v == "number") && v * 0 == 0) {
          x.s = 1 / v < 0 ? (v = -v, -1) : 1;
          if (v === ~~v) {
            for (e = 0, i2 = v; i2 >= 10; i2 /= 10, e++) ;
            if (e > MAX_EXP) {
              x.c = x.e = null;
            } else {
              x.e = e;
              x.c = [v];
            }
            return;
          }
          str = String(v);
        } else {
          if (!isNumeric.test(str = String(v))) return parseNumeric(x, str, isNum);
          x.s = str.charCodeAt(0) == 45 ? (str = str.slice(1), -1) : 1;
        }
        if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
        if ((i2 = str.search(/e/i)) > 0) {
          if (e < 0) e = i2;
          e += +str.slice(i2 + 1);
          str = str.substring(0, i2);
        } else if (e < 0) {
          e = str.length;
        }
      } else {
        intCheck(b, 2, ALPHABET.length, "Base");
        if (b == 10 && alphabetHasNormalDecimalDigits) {
          x = new BigNumber2(v);
          return round(x, DECIMAL_PLACES + x.e + 1, ROUNDING_MODE);
        }
        str = String(v);
        if (isNum = typeof v == "number") {
          if (v * 0 != 0) return parseNumeric(x, str, isNum, b);
          x.s = 1 / v < 0 ? (str = str.slice(1), -1) : 1;
          if (BigNumber2.DEBUG && str.replace(/^0\.0*|\./, "").length > 15) {
            throw Error(tooManyDigits + v);
          }
        } else {
          x.s = str.charCodeAt(0) === 45 ? (str = str.slice(1), -1) : 1;
        }
        alphabet = ALPHABET.slice(0, b);
        e = i2 = 0;
        for (len = str.length; i2 < len; i2++) {
          if (alphabet.indexOf(c = str.charAt(i2)) < 0) {
            if (c == ".") {
              if (i2 > e) {
                e = len;
                continue;
              }
            } else if (!caseChanged) {
              if (str == str.toUpperCase() && (str = str.toLowerCase()) || str == str.toLowerCase() && (str = str.toUpperCase())) {
                caseChanged = true;
                i2 = -1;
                e = 0;
                continue;
              }
            }
            return parseNumeric(x, String(v), isNum, b);
          }
        }
        isNum = false;
        str = convertBase(str, b, 10, x.s);
        if ((e = str.indexOf(".")) > -1) str = str.replace(".", "");
        else e = str.length;
      }
      for (i2 = 0; str.charCodeAt(i2) === 48; i2++) ;
      for (len = str.length; str.charCodeAt(--len) === 48; ) ;
      if (str = str.slice(i2, ++len)) {
        len -= i2;
        if (isNum && BigNumber2.DEBUG && len > 15 && (v > MAX_SAFE_INTEGER || v !== mathfloor(v))) {
          throw Error(tooManyDigits + x.s * v);
        }
        if ((e = e - i2 - 1) > MAX_EXP) {
          x.c = x.e = null;
        } else if (e < MIN_EXP) {
          x.c = [x.e = 0];
        } else {
          x.e = e;
          x.c = [];
          i2 = (e + 1) % LOG_BASE;
          if (e < 0) i2 += LOG_BASE;
          if (i2 < len) {
            if (i2) x.c.push(+str.slice(0, i2));
            for (len -= LOG_BASE; i2 < len; ) {
              x.c.push(+str.slice(i2, i2 += LOG_BASE));
            }
            i2 = LOG_BASE - (str = str.slice(i2)).length;
          } else {
            i2 -= len;
          }
          for (; i2--; str += "0") ;
          x.c.push(+str);
        }
      } else {
        x.c = [x.e = 0];
      }
    }
    BigNumber2.clone = clone;
    BigNumber2.ROUND_UP = 0;
    BigNumber2.ROUND_DOWN = 1;
    BigNumber2.ROUND_CEIL = 2;
    BigNumber2.ROUND_FLOOR = 3;
    BigNumber2.ROUND_HALF_UP = 4;
    BigNumber2.ROUND_HALF_DOWN = 5;
    BigNumber2.ROUND_HALF_EVEN = 6;
    BigNumber2.ROUND_HALF_CEIL = 7;
    BigNumber2.ROUND_HALF_FLOOR = 8;
    BigNumber2.EUCLID = 9;
    BigNumber2.config = BigNumber2.set = function(obj) {
      var p, v;
      if (obj != null) {
        if (typeof obj == "object") {
          if (obj.hasOwnProperty(p = "DECIMAL_PLACES")) {
            v = obj[p];
            intCheck(v, 0, MAX, p);
            DECIMAL_PLACES = v;
          }
          if (obj.hasOwnProperty(p = "ROUNDING_MODE")) {
            v = obj[p];
            intCheck(v, 0, 8, p);
            ROUNDING_MODE = v;
          }
          if (obj.hasOwnProperty(p = "EXPONENTIAL_AT")) {
            v = obj[p];
            if (v && v.pop) {
              intCheck(v[0], -MAX, 0, p);
              intCheck(v[1], 0, MAX, p);
              TO_EXP_NEG = v[0];
              TO_EXP_POS = v[1];
            } else {
              intCheck(v, -MAX, MAX, p);
              TO_EXP_NEG = -(TO_EXP_POS = v < 0 ? -v : v);
            }
          }
          if (obj.hasOwnProperty(p = "RANGE")) {
            v = obj[p];
            if (v && v.pop) {
              intCheck(v[0], -MAX, -1, p);
              intCheck(v[1], 1, MAX, p);
              MIN_EXP = v[0];
              MAX_EXP = v[1];
            } else {
              intCheck(v, -MAX, MAX, p);
              if (v) {
                MIN_EXP = -(MAX_EXP = v < 0 ? -v : v);
              } else {
                throw Error(bignumberError + p + " cannot be zero: " + v);
              }
            }
          }
          if (obj.hasOwnProperty(p = "CRYPTO")) {
            v = obj[p];
            if (v === !!v) {
              if (v) {
                if (typeof crypto != "undefined" && crypto && (crypto.getRandomValues || crypto.randomBytes)) {
                  CRYPTO = v;
                } else {
                  CRYPTO = !v;
                  throw Error(bignumberError + "crypto unavailable");
                }
              } else {
                CRYPTO = v;
              }
            } else {
              throw Error(bignumberError + p + " not true or false: " + v);
            }
          }
          if (obj.hasOwnProperty(p = "MODULO_MODE")) {
            v = obj[p];
            intCheck(v, 0, 9, p);
            MODULO_MODE = v;
          }
          if (obj.hasOwnProperty(p = "POW_PRECISION")) {
            v = obj[p];
            intCheck(v, 0, MAX, p);
            POW_PRECISION = v;
          }
          if (obj.hasOwnProperty(p = "FORMAT")) {
            v = obj[p];
            if (typeof v == "object") FORMAT = v;
            else throw Error(bignumberError + p + " not an object: " + v);
          }
          if (obj.hasOwnProperty(p = "ALPHABET")) {
            v = obj[p];
            if (typeof v == "string" && !/^.?$|[+\-.\s]|(.).*\1/.test(v)) {
              alphabetHasNormalDecimalDigits = v.slice(0, 10) == "0123456789";
              ALPHABET = v;
            } else {
              throw Error(bignumberError + p + " invalid: " + v);
            }
          }
        } else {
          throw Error(bignumberError + "Object expected: " + obj);
        }
      }
      return {
        DECIMAL_PLACES,
        ROUNDING_MODE,
        EXPONENTIAL_AT: [TO_EXP_NEG, TO_EXP_POS],
        RANGE: [MIN_EXP, MAX_EXP],
        CRYPTO,
        MODULO_MODE,
        POW_PRECISION,
        FORMAT,
        ALPHABET
      };
    };
    BigNumber2.isBigNumber = function(v) {
      if (!v || v._isBigNumber !== true) return false;
      if (!BigNumber2.DEBUG) return true;
      var i2, n, c = v.c, e = v.e, s = v.s;
      out: if ({}.toString.call(c) == "[object Array]") {
        if ((s === 1 || s === -1) && e >= -MAX && e <= MAX && e === mathfloor(e)) {
          if (c[0] === 0) {
            if (e === 0 && c.length === 1) return true;
            break out;
          }
          i2 = (e + 1) % LOG_BASE;
          if (i2 < 1) i2 += LOG_BASE;
          if (String(c[0]).length == i2) {
            for (i2 = 0; i2 < c.length; i2++) {
              n = c[i2];
              if (n < 0 || n >= BASE || n !== mathfloor(n)) break out;
            }
            if (n !== 0) return true;
          }
        }
      } else if (c === null && e === null && (s === null || s === 1 || s === -1)) {
        return true;
      }
      throw Error(bignumberError + "Invalid BigNumber: " + v);
    };
    BigNumber2.maximum = BigNumber2.max = function() {
      return maxOrMin(arguments, -1);
    };
    BigNumber2.minimum = BigNumber2.min = function() {
      return maxOrMin(arguments, 1);
    };
    BigNumber2.random = (function() {
      var pow2_53 = 9007199254740992;
      var random53bitInt = Math.random() * pow2_53 & 2097151 ? function() {
        return mathfloor(Math.random() * pow2_53);
      } : function() {
        return (Math.random() * 1073741824 | 0) * 8388608 + (Math.random() * 8388608 | 0);
      };
      return function(dp) {
        var a, b, e, k, v, i2 = 0, c = [], rand = new BigNumber2(ONE);
        if (dp == null) dp = DECIMAL_PLACES;
        else intCheck(dp, 0, MAX);
        k = mathceil(dp / LOG_BASE);
        if (CRYPTO) {
          if (crypto.getRandomValues) {
            a = crypto.getRandomValues(new Uint32Array(k *= 2));
            for (; i2 < k; ) {
              v = a[i2] * 131072 + (a[i2 + 1] >>> 11);
              if (v >= 9e15) {
                b = crypto.getRandomValues(new Uint32Array(2));
                a[i2] = b[0];
                a[i2 + 1] = b[1];
              } else {
                c.push(v % 1e14);
                i2 += 2;
              }
            }
            i2 = k / 2;
          } else if (crypto.randomBytes) {
            a = crypto.randomBytes(k *= 7);
            for (; i2 < k; ) {
              v = (a[i2] & 31) * 281474976710656 + a[i2 + 1] * 1099511627776 + a[i2 + 2] * 4294967296 + a[i2 + 3] * 16777216 + (a[i2 + 4] << 16) + (a[i2 + 5] << 8) + a[i2 + 6];
              if (v >= 9e15) {
                crypto.randomBytes(7).copy(a, i2);
              } else {
                c.push(v % 1e14);
                i2 += 7;
              }
            }
            i2 = k / 7;
          } else {
            CRYPTO = false;
            throw Error(bignumberError + "crypto unavailable");
          }
        }
        if (!CRYPTO) {
          for (; i2 < k; ) {
            v = random53bitInt();
            if (v < 9e15) c[i2++] = v % 1e14;
          }
        }
        k = c[--i2];
        dp %= LOG_BASE;
        if (k && dp) {
          v = POWS_TEN[LOG_BASE - dp];
          c[i2] = mathfloor(k / v) * v;
        }
        for (; c[i2] === 0; c.pop(), i2--) ;
        if (i2 < 0) {
          c = [e = 0];
        } else {
          for (e = -1; c[0] === 0; c.splice(0, 1), e -= LOG_BASE) ;
          for (i2 = 1, v = c[0]; v >= 10; v /= 10, i2++) ;
          if (i2 < LOG_BASE) e -= LOG_BASE - i2;
        }
        rand.e = e;
        rand.c = c;
        return rand;
      };
    })();
    BigNumber2.sum = function() {
      var i2 = 1, args = arguments, sum = new BigNumber2(args[0]);
      for (; i2 < args.length; ) sum = sum.plus(args[i2++]);
      return sum;
    };
    convertBase = /* @__PURE__ */ (function() {
      var decimal = "0123456789";
      function toBaseOut(str, baseIn, baseOut, alphabet) {
        var j, arr = [0], arrL, i2 = 0, len = str.length;
        for (; i2 < len; ) {
          for (arrL = arr.length; arrL--; arr[arrL] *= baseIn) ;
          arr[0] += alphabet.indexOf(str.charAt(i2++));
          for (j = 0; j < arr.length; j++) {
            if (arr[j] > baseOut - 1) {
              if (arr[j + 1] == null) arr[j + 1] = 0;
              arr[j + 1] += arr[j] / baseOut | 0;
              arr[j] %= baseOut;
            }
          }
        }
        return arr.reverse();
      }
      return function(str, baseIn, baseOut, sign2, callerIsToString) {
        var alphabet, d, e, k, r, x, xc, y, i2 = str.indexOf("."), dp = DECIMAL_PLACES, rm = ROUNDING_MODE;
        if (i2 >= 0) {
          k = POW_PRECISION;
          POW_PRECISION = 0;
          str = str.replace(".", "");
          y = new BigNumber2(baseIn);
          x = y.pow(str.length - i2);
          POW_PRECISION = k;
          y.c = toBaseOut(
            toFixedPoint(coeffToString(x.c), x.e, "0"),
            10,
            baseOut,
            decimal
          );
          y.e = y.c.length;
        }
        xc = toBaseOut(str, baseIn, baseOut, callerIsToString ? (alphabet = ALPHABET, decimal) : (alphabet = decimal, ALPHABET));
        e = k = xc.length;
        for (; xc[--k] == 0; xc.pop()) ;
        if (!xc[0]) return alphabet.charAt(0);
        if (i2 < 0) {
          --e;
        } else {
          x.c = xc;
          x.e = e;
          x.s = sign2;
          x = div(x, y, dp, rm, baseOut);
          xc = x.c;
          r = x.r;
          e = x.e;
        }
        d = e + dp + 1;
        i2 = xc[d];
        k = baseOut / 2;
        r = r || d < 0 || xc[d + 1] != null;
        r = rm < 4 ? (i2 != null || r) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : i2 > k || i2 == k && (rm == 4 || r || rm == 6 && xc[d - 1] & 1 || rm == (x.s < 0 ? 8 : 7));
        if (d < 1 || !xc[0]) {
          str = r ? toFixedPoint(alphabet.charAt(1), -dp, alphabet.charAt(0)) : alphabet.charAt(0);
        } else {
          xc.length = d;
          if (r) {
            for (--baseOut; ++xc[--d] > baseOut; ) {
              xc[d] = 0;
              if (!d) {
                ++e;
                xc = [1].concat(xc);
              }
            }
          }
          for (k = xc.length; !xc[--k]; ) ;
          for (i2 = 0, str = ""; i2 <= k; str += alphabet.charAt(xc[i2++])) ;
          str = toFixedPoint(str, e, alphabet.charAt(0));
        }
        return str;
      };
    })();
    div = /* @__PURE__ */ (function() {
      function multiply(x, k, base) {
        var m, temp, xlo, xhi, carry = 0, i2 = x.length, klo = k % SQRT_BASE, khi = k / SQRT_BASE | 0;
        for (x = x.slice(); i2--; ) {
          xlo = x[i2] % SQRT_BASE;
          xhi = x[i2] / SQRT_BASE | 0;
          m = khi * xlo + xhi * klo;
          temp = klo * xlo + m % SQRT_BASE * SQRT_BASE + carry;
          carry = (temp / base | 0) + (m / SQRT_BASE | 0) + khi * xhi;
          x[i2] = temp % base;
        }
        if (carry) x = [carry].concat(x);
        return x;
      }
      function compare2(a, b, aL, bL) {
        var i2, cmp;
        if (aL != bL) {
          cmp = aL > bL ? 1 : -1;
        } else {
          for (i2 = cmp = 0; i2 < aL; i2++) {
            if (a[i2] != b[i2]) {
              cmp = a[i2] > b[i2] ? 1 : -1;
              break;
            }
          }
        }
        return cmp;
      }
      function subtract(a, b, aL, base) {
        var i2 = 0;
        for (; aL--; ) {
          a[aL] -= i2;
          i2 = a[aL] < b[aL] ? 1 : 0;
          a[aL] = i2 * base + a[aL] - b[aL];
        }
        for (; !a[0] && a.length > 1; a.splice(0, 1)) ;
      }
      return function(x, y, dp, rm, base) {
        var cmp, e, i2, more, n, prod, prodL, q, qc, rem, remL, rem0, xi, xL, yc0, yL, yz, s = x.s == y.s ? 1 : -1, xc = x.c, yc = y.c;
        if (!xc || !xc[0] || !yc || !yc[0]) {
          return new BigNumber2(
            // Return NaN if either NaN, or both Infinity or 0.
            !x.s || !y.s || (xc ? yc && xc[0] == yc[0] : !yc) ? NaN : (
              // Return ±0 if x is ±0 or y is ±Infinity, or return ±Infinity as y is ±0.
              xc && xc[0] == 0 || !yc ? s * 0 : s / 0
            )
          );
        }
        q = new BigNumber2(s);
        qc = q.c = [];
        e = x.e - y.e;
        s = dp + e + 1;
        if (!base) {
          base = BASE;
          e = bitFloor(x.e / LOG_BASE) - bitFloor(y.e / LOG_BASE);
          s = s / LOG_BASE | 0;
        }
        for (i2 = 0; yc[i2] == (xc[i2] || 0); i2++) ;
        if (yc[i2] > (xc[i2] || 0)) e--;
        if (s < 0) {
          qc.push(1);
          more = true;
        } else {
          xL = xc.length;
          yL = yc.length;
          i2 = 0;
          s += 2;
          n = mathfloor(base / (yc[0] + 1));
          if (n > 1) {
            yc = multiply(yc, n, base);
            xc = multiply(xc, n, base);
            yL = yc.length;
            xL = xc.length;
          }
          xi = yL;
          rem = xc.slice(0, yL);
          remL = rem.length;
          for (; remL < yL; rem[remL++] = 0) ;
          yz = yc.slice();
          yz = [0].concat(yz);
          yc0 = yc[0];
          if (yc[1] >= base / 2) yc0++;
          do {
            n = 0;
            cmp = compare2(yc, rem, yL, remL);
            if (cmp < 0) {
              rem0 = rem[0];
              if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);
              n = mathfloor(rem0 / yc0);
              if (n > 1) {
                if (n >= base) n = base - 1;
                prod = multiply(yc, n, base);
                prodL = prod.length;
                remL = rem.length;
                while (compare2(prod, rem, prodL, remL) == 1) {
                  n--;
                  subtract(prod, yL < prodL ? yz : yc, prodL, base);
                  prodL = prod.length;
                  cmp = 1;
                }
              } else {
                if (n == 0) {
                  cmp = n = 1;
                }
                prod = yc.slice();
                prodL = prod.length;
              }
              if (prodL < remL) prod = [0].concat(prod);
              subtract(rem, prod, remL, base);
              remL = rem.length;
              if (cmp == -1) {
                while (compare2(yc, rem, yL, remL) < 1) {
                  n++;
                  subtract(rem, yL < remL ? yz : yc, remL, base);
                  remL = rem.length;
                }
              }
            } else if (cmp === 0) {
              n++;
              rem = [0];
            }
            qc[i2++] = n;
            if (rem[0]) {
              rem[remL++] = xc[xi] || 0;
            } else {
              rem = [xc[xi]];
              remL = 1;
            }
          } while ((xi++ < xL || rem[0] != null) && s--);
          more = rem[0] != null;
          if (!qc[0]) qc.splice(0, 1);
        }
        if (base == BASE) {
          for (i2 = 1, s = qc[0]; s >= 10; s /= 10, i2++) ;
          round(q, dp + (q.e = i2 + e * LOG_BASE - 1) + 1, rm, more);
        } else {
          q.e = e;
          q.r = +more;
        }
        return q;
      };
    })();
    function format(n, i2, rm, id) {
      var c0, e, ne, len, str;
      if (rm == null) rm = ROUNDING_MODE;
      else intCheck(rm, 0, 8);
      if (!n.c) return n.toString();
      c0 = n.c[0];
      ne = n.e;
      if (i2 == null) {
        str = coeffToString(n.c);
        str = id == 1 || id == 2 && (ne <= TO_EXP_NEG || ne >= TO_EXP_POS) ? toExponential(str, ne) : toFixedPoint(str, ne, "0");
      } else {
        n = round(new BigNumber2(n), i2, rm);
        e = n.e;
        str = coeffToString(n.c);
        len = str.length;
        if (id == 1 || id == 2 && (i2 <= e || e <= TO_EXP_NEG)) {
          for (; len < i2; str += "0", len++) ;
          str = toExponential(str, e);
        } else {
          i2 -= ne + (id === 2 && e > ne);
          str = toFixedPoint(str, e, "0");
          if (e + 1 > len) {
            if (--i2 > 0) for (str += "."; i2--; str += "0") ;
          } else {
            i2 += e - len;
            if (i2 > 0) {
              if (e + 1 == len) str += ".";
              for (; i2--; str += "0") ;
            }
          }
        }
      }
      return n.s < 0 && c0 ? "-" + str : str;
    }
    function maxOrMin(args, n) {
      var k, y, i2 = 1, x = new BigNumber2(args[0]);
      for (; i2 < args.length; i2++) {
        y = new BigNumber2(args[i2]);
        if (!y.s || (k = compare(x, y)) === n || k === 0 && x.s === n) {
          x = y;
        }
      }
      return x;
    }
    function normalise(n, c, e) {
      var i2 = 1, j = c.length;
      for (; !c[--j]; c.pop()) ;
      for (j = c[0]; j >= 10; j /= 10, i2++) ;
      if ((e = i2 + e * LOG_BASE - 1) > MAX_EXP) {
        n.c = n.e = null;
      } else if (e < MIN_EXP) {
        n.c = [n.e = 0];
      } else {
        n.e = e;
        n.c = c;
      }
      return n;
    }
    parseNumeric = /* @__PURE__ */ (function() {
      var basePrefix = /^(-?)0([xbo])(?=\w[\w.]*$)/i, dotAfter = /^([^.]+)\.$/, dotBefore = /^\.([^.]+)$/, isInfinityOrNaN = /^-?(Infinity|NaN)$/, whitespaceOrPlus = /^\s*\+(?=[\w.])|^\s+|\s+$/g;
      return function(x, str, isNum, b) {
        var base, s = isNum ? str : str.replace(whitespaceOrPlus, "");
        if (isInfinityOrNaN.test(s)) {
          x.s = isNaN(s) ? null : s < 0 ? -1 : 1;
        } else {
          if (!isNum) {
            s = s.replace(basePrefix, function(m, p1, p2) {
              base = (p2 = p2.toLowerCase()) == "x" ? 16 : p2 == "b" ? 2 : 8;
              return !b || b == base ? p1 : m;
            });
            if (b) {
              base = b;
              s = s.replace(dotAfter, "$1").replace(dotBefore, "0.$1");
            }
            if (str != s) return new BigNumber2(s, base);
          }
          if (BigNumber2.DEBUG) {
            throw Error(bignumberError + "Not a" + (b ? " base " + b : "") + " number: " + str);
          }
          x.s = null;
        }
        x.c = x.e = null;
      };
    })();
    function round(x, sd, rm, r) {
      var d, i2, j, k, n, ni, rd, xc = x.c, pows10 = POWS_TEN;
      if (xc) {
        out: {
          for (d = 1, k = xc[0]; k >= 10; k /= 10, d++) ;
          i2 = sd - d;
          if (i2 < 0) {
            i2 += LOG_BASE;
            j = sd;
            n = xc[ni = 0];
            rd = mathfloor(n / pows10[d - j - 1] % 10);
          } else {
            ni = mathceil((i2 + 1) / LOG_BASE);
            if (ni >= xc.length) {
              if (r) {
                for (; xc.length <= ni; xc.push(0)) ;
                n = rd = 0;
                d = 1;
                i2 %= LOG_BASE;
                j = i2 - LOG_BASE + 1;
              } else {
                break out;
              }
            } else {
              n = k = xc[ni];
              for (d = 1; k >= 10; k /= 10, d++) ;
              i2 %= LOG_BASE;
              j = i2 - LOG_BASE + d;
              rd = j < 0 ? 0 : mathfloor(n / pows10[d - j - 1] % 10);
            }
          }
          r = r || sd < 0 || // Are there any non-zero digits after the rounding digit?
          // The expression  n % pows10[d - j - 1]  returns all digits of n to the right
          // of the digit at j, e.g. if n is 908714 and j is 2, the expression gives 714.
          xc[ni + 1] != null || (j < 0 ? n : n % pows10[d - j - 1]);
          r = rm < 4 ? (rd || r) && (rm == 0 || rm == (x.s < 0 ? 3 : 2)) : rd > 5 || rd == 5 && (rm == 4 || r || rm == 6 && // Check whether the digit to the left of the rounding digit is odd.
          (i2 > 0 ? j > 0 ? n / pows10[d - j] : 0 : xc[ni - 1]) % 10 & 1 || rm == (x.s < 0 ? 8 : 7));
          if (sd < 1 || !xc[0]) {
            xc.length = 0;
            if (r) {
              sd -= x.e + 1;
              xc[0] = pows10[(LOG_BASE - sd % LOG_BASE) % LOG_BASE];
              x.e = -sd || 0;
            } else {
              xc[0] = x.e = 0;
            }
            return x;
          }
          if (i2 == 0) {
            xc.length = ni;
            k = 1;
            ni--;
          } else {
            xc.length = ni + 1;
            k = pows10[LOG_BASE - i2];
            xc[ni] = j > 0 ? mathfloor(n / pows10[d - j] % pows10[j]) * k : 0;
          }
          if (r) {
            for (; ; ) {
              if (ni == 0) {
                for (i2 = 1, j = xc[0]; j >= 10; j /= 10, i2++) ;
                j = xc[0] += k;
                for (k = 1; j >= 10; j /= 10, k++) ;
                if (i2 != k) {
                  x.e++;
                  if (xc[0] == BASE) xc[0] = 1;
                }
                break;
              } else {
                xc[ni] += k;
                if (xc[ni] != BASE) break;
                xc[ni--] = 0;
                k = 1;
              }
            }
          }
          for (i2 = xc.length; xc[--i2] === 0; xc.pop()) ;
        }
        if (x.e > MAX_EXP) {
          x.c = x.e = null;
        } else if (x.e < MIN_EXP) {
          x.c = [x.e = 0];
        }
      }
      return x;
    }
    function valueOf(n) {
      var str, e = n.e;
      if (e === null) return n.toString();
      str = coeffToString(n.c);
      str = e <= TO_EXP_NEG || e >= TO_EXP_POS ? toExponential(str, e) : toFixedPoint(str, e, "0");
      return n.s < 0 ? "-" + str : str;
    }
    P.absoluteValue = P.abs = function() {
      var x = new BigNumber2(this);
      if (x.s < 0) x.s = 1;
      return x;
    };
    P.comparedTo = function(y, b) {
      return compare(this, new BigNumber2(y, b));
    };
    P.decimalPlaces = P.dp = function(dp, rm) {
      var c, n, v, x = this;
      if (dp != null) {
        intCheck(dp, 0, MAX);
        if (rm == null) rm = ROUNDING_MODE;
        else intCheck(rm, 0, 8);
        return round(new BigNumber2(x), dp + x.e + 1, rm);
      }
      if (!(c = x.c)) return null;
      n = ((v = c.length - 1) - bitFloor(this.e / LOG_BASE)) * LOG_BASE;
      if (v = c[v]) for (; v % 10 == 0; v /= 10, n--) ;
      if (n < 0) n = 0;
      return n;
    };
    P.dividedBy = P.div = function(y, b) {
      return div(this, new BigNumber2(y, b), DECIMAL_PLACES, ROUNDING_MODE);
    };
    P.dividedToIntegerBy = P.idiv = function(y, b) {
      return div(this, new BigNumber2(y, b), 0, 1);
    };
    P.exponentiatedBy = P.pow = function(n, m) {
      var half, isModExp, i2, k, more, nIsBig, nIsNeg, nIsOdd, y, x = this;
      n = new BigNumber2(n);
      if (n.c && !n.isInteger()) {
        throw Error(bignumberError + "Exponent not an integer: " + valueOf(n));
      }
      if (m != null) m = new BigNumber2(m);
      nIsBig = n.e > 14;
      if (!x.c || !x.c[0] || x.c[0] == 1 && !x.e && x.c.length == 1 || !n.c || !n.c[0]) {
        y = new BigNumber2(Math.pow(+valueOf(x), nIsBig ? n.s * (2 - isOdd(n)) : +valueOf(n)));
        return m ? y.mod(m) : y;
      }
      nIsNeg = n.s < 0;
      if (m) {
        if (m.c ? !m.c[0] : !m.s) return new BigNumber2(NaN);
        isModExp = !nIsNeg && x.isInteger() && m.isInteger();
        if (isModExp) x = x.mod(m);
      } else if (n.e > 9 && (x.e > 0 || x.e < -1 || (x.e == 0 ? x.c[0] > 1 || nIsBig && x.c[1] >= 24e7 : x.c[0] < 8e13 || nIsBig && x.c[0] <= 9999975e7))) {
        k = x.s < 0 && isOdd(n) ? -0 : 0;
        if (x.e > -1) k = 1 / k;
        return new BigNumber2(nIsNeg ? 1 / k : k);
      } else if (POW_PRECISION) {
        k = mathceil(POW_PRECISION / LOG_BASE + 2);
      }
      if (nIsBig) {
        half = new BigNumber2(0.5);
        if (nIsNeg) n.s = 1;
        nIsOdd = isOdd(n);
      } else {
        i2 = Math.abs(+valueOf(n));
        nIsOdd = i2 % 2;
      }
      y = new BigNumber2(ONE);
      for (; ; ) {
        if (nIsOdd) {
          y = y.times(x);
          if (!y.c) break;
          if (k) {
            if (y.c.length > k) y.c.length = k;
          } else if (isModExp) {
            y = y.mod(m);
          }
        }
        if (i2) {
          i2 = mathfloor(i2 / 2);
          if (i2 === 0) break;
          nIsOdd = i2 % 2;
        } else {
          n = n.times(half);
          round(n, n.e + 1, 1);
          if (n.e > 14) {
            nIsOdd = isOdd(n);
          } else {
            i2 = +valueOf(n);
            if (i2 === 0) break;
            nIsOdd = i2 % 2;
          }
        }
        x = x.times(x);
        if (k) {
          if (x.c && x.c.length > k) x.c.length = k;
        } else if (isModExp) {
          x = x.mod(m);
        }
      }
      if (isModExp) return y;
      if (nIsNeg) y = ONE.div(y);
      return m ? y.mod(m) : k ? round(y, POW_PRECISION, ROUNDING_MODE, more) : y;
    };
    P.integerValue = function(rm) {
      var n = new BigNumber2(this);
      if (rm == null) rm = ROUNDING_MODE;
      else intCheck(rm, 0, 8);
      return round(n, n.e + 1, rm);
    };
    P.isEqualTo = P.eq = function(y, b) {
      return compare(this, new BigNumber2(y, b)) === 0;
    };
    P.isFinite = function() {
      return !!this.c;
    };
    P.isGreaterThan = P.gt = function(y, b) {
      return compare(this, new BigNumber2(y, b)) > 0;
    };
    P.isGreaterThanOrEqualTo = P.gte = function(y, b) {
      return (b = compare(this, new BigNumber2(y, b))) === 1 || b === 0;
    };
    P.isInteger = function() {
      return !!this.c && bitFloor(this.e / LOG_BASE) > this.c.length - 2;
    };
    P.isLessThan = P.lt = function(y, b) {
      return compare(this, new BigNumber2(y, b)) < 0;
    };
    P.isLessThanOrEqualTo = P.lte = function(y, b) {
      return (b = compare(this, new BigNumber2(y, b))) === -1 || b === 0;
    };
    P.isNaN = function() {
      return !this.s;
    };
    P.isNegative = function() {
      return this.s < 0;
    };
    P.isPositive = function() {
      return this.s > 0;
    };
    P.isZero = function() {
      return !!this.c && this.c[0] == 0;
    };
    P.minus = function(y, b) {
      var i2, j, t, xLTy, x = this, a = x.s;
      y = new BigNumber2(y, b);
      b = y.s;
      if (!a || !b) return new BigNumber2(NaN);
      if (a != b) {
        y.s = -b;
        return x.plus(y);
      }
      var xe = x.e / LOG_BASE, ye = y.e / LOG_BASE, xc = x.c, yc = y.c;
      if (!xe || !ye) {
        if (!xc || !yc) return xc ? (y.s = -b, y) : new BigNumber2(yc ? x : NaN);
        if (!xc[0] || !yc[0]) {
          return yc[0] ? (y.s = -b, y) : new BigNumber2(xc[0] ? x : (
            // IEEE 754 (2008) 6.3: n - n = -0 when rounding to -Infinity
            ROUNDING_MODE == 3 ? -0 : 0
          ));
        }
      }
      xe = bitFloor(xe);
      ye = bitFloor(ye);
      xc = xc.slice();
      if (a = xe - ye) {
        if (xLTy = a < 0) {
          a = -a;
          t = xc;
        } else {
          ye = xe;
          t = yc;
        }
        t.reverse();
        for (b = a; b--; t.push(0)) ;
        t.reverse();
      } else {
        j = (xLTy = (a = xc.length) < (b = yc.length)) ? a : b;
        for (a = b = 0; b < j; b++) {
          if (xc[b] != yc[b]) {
            xLTy = xc[b] < yc[b];
            break;
          }
        }
      }
      if (xLTy) {
        t = xc;
        xc = yc;
        yc = t;
        y.s = -y.s;
      }
      b = (j = yc.length) - (i2 = xc.length);
      if (b > 0) for (; b--; xc[i2++] = 0) ;
      b = BASE - 1;
      for (; j > a; ) {
        if (xc[--j] < yc[j]) {
          for (i2 = j; i2 && !xc[--i2]; xc[i2] = b) ;
          --xc[i2];
          xc[j] += BASE;
        }
        xc[j] -= yc[j];
      }
      for (; xc[0] == 0; xc.splice(0, 1), --ye) ;
      if (!xc[0]) {
        y.s = ROUNDING_MODE == 3 ? -1 : 1;
        y.c = [y.e = 0];
        return y;
      }
      return normalise(y, xc, ye);
    };
    P.modulo = P.mod = function(y, b) {
      var q, s, x = this;
      y = new BigNumber2(y, b);
      if (!x.c || !y.s || y.c && !y.c[0]) {
        return new BigNumber2(NaN);
      } else if (!y.c || x.c && !x.c[0]) {
        return new BigNumber2(x);
      }
      if (MODULO_MODE == 9) {
        s = y.s;
        y.s = 1;
        q = div(x, y, 0, 3);
        y.s = s;
        q.s *= s;
      } else {
        q = div(x, y, 0, MODULO_MODE);
      }
      y = x.minus(q.times(y));
      if (!y.c[0] && MODULO_MODE == 1) y.s = x.s;
      return y;
    };
    P.multipliedBy = P.times = function(y, b) {
      var c, e, i2, j, k, m, xcL, xlo, xhi, ycL, ylo, yhi, zc, base, sqrtBase, x = this, xc = x.c, yc = (y = new BigNumber2(y, b)).c;
      if (!xc || !yc || !xc[0] || !yc[0]) {
        if (!x.s || !y.s || xc && !xc[0] && !yc || yc && !yc[0] && !xc) {
          y.c = y.e = y.s = null;
        } else {
          y.s *= x.s;
          if (!xc || !yc) {
            y.c = y.e = null;
          } else {
            y.c = [0];
            y.e = 0;
          }
        }
        return y;
      }
      e = bitFloor(x.e / LOG_BASE) + bitFloor(y.e / LOG_BASE);
      y.s *= x.s;
      xcL = xc.length;
      ycL = yc.length;
      if (xcL < ycL) {
        zc = xc;
        xc = yc;
        yc = zc;
        i2 = xcL;
        xcL = ycL;
        ycL = i2;
      }
      for (i2 = xcL + ycL, zc = []; i2--; zc.push(0)) ;
      base = BASE;
      sqrtBase = SQRT_BASE;
      for (i2 = ycL; --i2 >= 0; ) {
        c = 0;
        ylo = yc[i2] % sqrtBase;
        yhi = yc[i2] / sqrtBase | 0;
        for (k = xcL, j = i2 + k; j > i2; ) {
          xlo = xc[--k] % sqrtBase;
          xhi = xc[k] / sqrtBase | 0;
          m = yhi * xlo + xhi * ylo;
          xlo = ylo * xlo + m % sqrtBase * sqrtBase + zc[j] + c;
          c = (xlo / base | 0) + (m / sqrtBase | 0) + yhi * xhi;
          zc[j--] = xlo % base;
        }
        zc[j] = c;
      }
      if (c) {
        ++e;
      } else {
        zc.splice(0, 1);
      }
      return normalise(y, zc, e);
    };
    P.negated = function() {
      var x = new BigNumber2(this);
      x.s = -x.s || null;
      return x;
    };
    P.plus = function(y, b) {
      var t, x = this, a = x.s;
      y = new BigNumber2(y, b);
      b = y.s;
      if (!a || !b) return new BigNumber2(NaN);
      if (a != b) {
        y.s = -b;
        return x.minus(y);
      }
      var xe = x.e / LOG_BASE, ye = y.e / LOG_BASE, xc = x.c, yc = y.c;
      if (!xe || !ye) {
        if (!xc || !yc) return new BigNumber2(a / 0);
        if (!xc[0] || !yc[0]) return yc[0] ? y : new BigNumber2(xc[0] ? x : a * 0);
      }
      xe = bitFloor(xe);
      ye = bitFloor(ye);
      xc = xc.slice();
      if (a = xe - ye) {
        if (a > 0) {
          ye = xe;
          t = yc;
        } else {
          a = -a;
          t = xc;
        }
        t.reverse();
        for (; a--; t.push(0)) ;
        t.reverse();
      }
      a = xc.length;
      b = yc.length;
      if (a - b < 0) {
        t = yc;
        yc = xc;
        xc = t;
        b = a;
      }
      for (a = 0; b; ) {
        a = (xc[--b] = xc[b] + yc[b] + a) / BASE | 0;
        xc[b] = BASE === xc[b] ? 0 : xc[b] % BASE;
      }
      if (a) {
        xc = [a].concat(xc);
        ++ye;
      }
      return normalise(y, xc, ye);
    };
    P.precision = P.sd = function(sd, rm) {
      var c, n, v, x = this;
      if (sd != null && sd !== !!sd) {
        intCheck(sd, 1, MAX);
        if (rm == null) rm = ROUNDING_MODE;
        else intCheck(rm, 0, 8);
        return round(new BigNumber2(x), sd, rm);
      }
      if (!(c = x.c)) return null;
      v = c.length - 1;
      n = v * LOG_BASE + 1;
      if (v = c[v]) {
        for (; v % 10 == 0; v /= 10, n--) ;
        for (v = c[0]; v >= 10; v /= 10, n++) ;
      }
      if (sd && x.e + 1 > n) n = x.e + 1;
      return n;
    };
    P.shiftedBy = function(k) {
      intCheck(k, -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER);
      return this.times("1e" + k);
    };
    P.squareRoot = P.sqrt = function() {
      var m, n, r, rep, t, x = this, c = x.c, s = x.s, e = x.e, dp = DECIMAL_PLACES + 4, half = new BigNumber2("0.5");
      if (s !== 1 || !c || !c[0]) {
        return new BigNumber2(!s || s < 0 && (!c || c[0]) ? NaN : c ? x : 1 / 0);
      }
      s = Math.sqrt(+valueOf(x));
      if (s == 0 || s == 1 / 0) {
        n = coeffToString(c);
        if ((n.length + e) % 2 == 0) n += "0";
        s = Math.sqrt(+n);
        e = bitFloor((e + 1) / 2) - (e < 0 || e % 2);
        if (s == 1 / 0) {
          n = "5e" + e;
        } else {
          n = s.toExponential();
          n = n.slice(0, n.indexOf("e") + 1) + e;
        }
        r = new BigNumber2(n);
      } else {
        r = new BigNumber2(s + "");
      }
      if (r.c[0]) {
        e = r.e;
        s = e + dp;
        if (s < 3) s = 0;
        for (; ; ) {
          t = r;
          r = half.times(t.plus(div(x, t, dp, 1)));
          if (coeffToString(t.c).slice(0, s) === (n = coeffToString(r.c)).slice(0, s)) {
            if (r.e < e) --s;
            n = n.slice(s - 3, s + 1);
            if (n == "9999" || !rep && n == "4999") {
              if (!rep) {
                round(t, t.e + DECIMAL_PLACES + 2, 0);
                if (t.times(t).eq(x)) {
                  r = t;
                  break;
                }
              }
              dp += 4;
              s += 4;
              rep = 1;
            } else {
              if (!+n || !+n.slice(1) && n.charAt(0) == "5") {
                round(r, r.e + DECIMAL_PLACES + 2, 1);
                m = !r.times(r).eq(x);
              }
              break;
            }
          }
        }
      }
      return round(r, r.e + DECIMAL_PLACES + 1, ROUNDING_MODE, m);
    };
    P.toExponential = function(dp, rm) {
      if (dp != null) {
        intCheck(dp, 0, MAX);
        dp++;
      }
      return format(this, dp, rm, 1);
    };
    P.toFixed = function(dp, rm) {
      if (dp != null) {
        intCheck(dp, 0, MAX);
        dp = dp + this.e + 1;
      }
      return format(this, dp, rm);
    };
    P.toFormat = function(dp, rm, format2) {
      var str, x = this;
      if (format2 == null) {
        if (dp != null && rm && typeof rm == "object") {
          format2 = rm;
          rm = null;
        } else if (dp && typeof dp == "object") {
          format2 = dp;
          dp = rm = null;
        } else {
          format2 = FORMAT;
        }
      } else if (typeof format2 != "object") {
        throw Error(bignumberError + "Argument not an object: " + format2);
      }
      str = x.toFixed(dp, rm);
      if (x.c) {
        var i2, arr = str.split("."), g1 = +format2.groupSize, g2 = +format2.secondaryGroupSize, groupSeparator = format2.groupSeparator || "", intPart = arr[0], fractionPart = arr[1], isNeg = x.s < 0, intDigits = isNeg ? intPart.slice(1) : intPart, len = intDigits.length;
        if (g2) {
          i2 = g1;
          g1 = g2;
          g2 = i2;
          len -= i2;
        }
        if (g1 > 0 && len > 0) {
          i2 = len % g1 || g1;
          intPart = intDigits.substr(0, i2);
          for (; i2 < len; i2 += g1) intPart += groupSeparator + intDigits.substr(i2, g1);
          if (g2 > 0) intPart += groupSeparator + intDigits.slice(i2);
          if (isNeg) intPart = "-" + intPart;
        }
        str = fractionPart ? intPart + (format2.decimalSeparator || "") + ((g2 = +format2.fractionGroupSize) ? fractionPart.replace(
          new RegExp("\\d{" + g2 + "}\\B", "g"),
          "$&" + (format2.fractionGroupSeparator || "")
        ) : fractionPart) : intPart;
      }
      return (format2.prefix || "") + str + (format2.suffix || "");
    };
    P.toFraction = function(md) {
      var d, d0, d1, d2, e, exp, n, n0, n1, q, r, s, x = this, xc = x.c;
      if (md != null) {
        n = new BigNumber2(md);
        if (!n.isInteger() && (n.c || n.s !== 1) || n.lt(ONE)) {
          throw Error(bignumberError + "Argument " + (n.isInteger() ? "out of range: " : "not an integer: ") + valueOf(n));
        }
      }
      if (!xc) return new BigNumber2(x);
      d = new BigNumber2(ONE);
      n1 = d0 = new BigNumber2(ONE);
      d1 = n0 = new BigNumber2(ONE);
      s = coeffToString(xc);
      e = d.e = s.length - x.e - 1;
      d.c[0] = POWS_TEN[(exp = e % LOG_BASE) < 0 ? LOG_BASE + exp : exp];
      md = !md || n.comparedTo(d) > 0 ? e > 0 ? d : n1 : n;
      exp = MAX_EXP;
      MAX_EXP = 1 / 0;
      n = new BigNumber2(s);
      n0.c[0] = 0;
      for (; ; ) {
        q = div(n, d, 0, 1);
        d2 = d0.plus(q.times(d1));
        if (d2.comparedTo(md) == 1) break;
        d0 = d1;
        d1 = d2;
        n1 = n0.plus(q.times(d2 = n1));
        n0 = d2;
        d = n.minus(q.times(d2 = d));
        n = d2;
      }
      d2 = div(md.minus(d0), d1, 0, 1);
      n0 = n0.plus(d2.times(n1));
      d0 = d0.plus(d2.times(d1));
      n0.s = n1.s = x.s;
      e = e * 2;
      r = div(n1, d1, e, ROUNDING_MODE).minus(x).abs().comparedTo(
        div(n0, d0, e, ROUNDING_MODE).minus(x).abs()
      ) < 1 ? [n1, d1] : [n0, d0];
      MAX_EXP = exp;
      return r;
    };
    P.toNumber = function() {
      return +valueOf(this);
    };
    P.toPrecision = function(sd, rm) {
      if (sd != null) intCheck(sd, 1, MAX);
      return format(this, sd, rm, 2);
    };
    P.toString = function(b) {
      var str, n = this, s = n.s, e = n.e;
      if (e === null) {
        if (s) {
          str = "Infinity";
          if (s < 0) str = "-" + str;
        } else {
          str = "NaN";
        }
      } else {
        if (b == null) {
          str = e <= TO_EXP_NEG || e >= TO_EXP_POS ? toExponential(coeffToString(n.c), e) : toFixedPoint(coeffToString(n.c), e, "0");
        } else if (b === 10 && alphabetHasNormalDecimalDigits) {
          n = round(new BigNumber2(n), DECIMAL_PLACES + e + 1, ROUNDING_MODE);
          str = toFixedPoint(coeffToString(n.c), n.e, "0");
        } else {
          intCheck(b, 2, ALPHABET.length, "Base");
          str = convertBase(toFixedPoint(coeffToString(n.c), e, "0"), 10, b, s, true);
        }
        if (s < 0 && n.c[0]) str = "-" + str;
      }
      return str;
    };
    P.valueOf = P.toJSON = function() {
      return valueOf(this);
    };
    P._isBigNumber = true;
    P[Symbol.toStringTag] = "BigNumber";
    P[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")] = P.valueOf;
    if (configObject != null) BigNumber2.set(configObject);
    return BigNumber2;
  }
  function bitFloor(n) {
    var i2 = n | 0;
    return n > 0 || n === i2 ? i2 : i2 - 1;
  }
  function coeffToString(a) {
    var s, z, i2 = 1, j = a.length, r = a[0] + "";
    for (; i2 < j; ) {
      s = a[i2++] + "";
      z = LOG_BASE - s.length;
      for (; z--; s = "0" + s) ;
      r += s;
    }
    for (j = r.length; r.charCodeAt(--j) === 48; ) ;
    return r.slice(0, j + 1 || 1);
  }
  function compare(x, y) {
    var a, b, xc = x.c, yc = y.c, i2 = x.s, j = y.s, k = x.e, l = y.e;
    if (!i2 || !j) return null;
    a = xc && !xc[0];
    b = yc && !yc[0];
    if (a || b) return a ? b ? 0 : -j : i2;
    if (i2 != j) return i2;
    a = i2 < 0;
    b = k == l;
    if (!xc || !yc) return b ? 0 : !xc ^ a ? 1 : -1;
    if (!b) return k > l ^ a ? 1 : -1;
    j = (k = xc.length) < (l = yc.length) ? k : l;
    for (i2 = 0; i2 < j; i2++) if (xc[i2] != yc[i2]) return xc[i2] > yc[i2] ^ a ? 1 : -1;
    return k == l ? 0 : k > l ^ a ? 1 : -1;
  }
  function intCheck(n, min, max, name) {
    if (n < min || n > max || n !== mathfloor(n)) {
      throw Error(bignumberError + (name || "Argument") + (typeof n == "number" ? n < min || n > max ? " out of range: " : " not an integer: " : " not a primitive number: ") + String(n));
    }
  }
  function isOdd(n) {
    var k = n.c.length - 1;
    return bitFloor(n.e / LOG_BASE) == k && n.c[k] % 2 != 0;
  }
  function toExponential(str, e) {
    return (str.length > 1 ? str.charAt(0) + "." + str.slice(1) : str) + (e < 0 ? "e" : "e+") + e;
  }
  function toFixedPoint(str, e, z) {
    var len, zs;
    if (e < 0) {
      for (zs = z + "."; ++e; zs += z) ;
      str = zs + str;
    } else {
      len = str.length;
      if (++e > len) {
        for (zs = z, e -= len; --e; zs += z) ;
        str += zs;
      } else if (e < len) {
        str = str.slice(0, e) + "." + str.slice(e);
      }
    }
    return str;
  }
  var BigNumber = clone();
  var bignumber_default = BigNumber;

  // node_modules/@solana/buffer-layout-utils/lib/esm/decimal.mjs
  var WAD = new bignumber_default("1e+18");

  // node_modules/@solana/buffer-layout-utils/lib/esm/native.mjs
  init_buffer_shim();
  var import_buffer_layout3 = __toESM(require_Layout(), 1);
  var bool = (property) => {
    const layout = (0, import_buffer_layout3.u8)(property);
    const { encode, decode } = encodeDecode(layout);
    const boolLayout = layout;
    boolLayout.decode = (buffer, offset2) => {
      const src = decode(buffer, offset2);
      return !!src;
    };
    boolLayout.encode = (bool2, buffer, offset2) => {
      const src = Number(bool2);
      return encode(src, buffer, offset2);
    };
    return boolLayout;
  };

  // node_modules/@solana/buffer-layout-utils/lib/esm/web3.mjs
  init_buffer_shim();
  var import_buffer_layout4 = __toESM(require_Layout(), 1);
  var publicKey2 = (property) => {
    const layout = (0, import_buffer_layout4.blob)(32, property);
    const { encode, decode } = encodeDecode(layout);
    const publicKeyLayout = layout;
    publicKeyLayout.decode = (buffer, offset2) => {
      const src = decode(buffer, offset2);
      return new PublicKey(src);
    };
    publicKeyLayout.encode = (publicKey3, buffer, offset2) => {
      const src = publicKey3.toBuffer();
      return encode(src, buffer, offset2);
    };
    return publicKeyLayout;
  };

  // node_modules/@solana/spl-token/lib/esm/errors.js
  init_buffer_shim();
  var TokenError = class extends Error {
    constructor(message) {
      super(message);
    }
  };
  var TokenOwnerOffCurveError = class extends TokenError {
    constructor() {
      super(...arguments);
      this.name = "TokenOwnerOffCurveError";
    }
  };

  // node_modules/@solana/spl-token/lib/esm/instructions/types.js
  init_buffer_shim();
  var TokenInstruction;
  (function(TokenInstruction2) {
    TokenInstruction2[TokenInstruction2["InitializeMint"] = 0] = "InitializeMint";
    TokenInstruction2[TokenInstruction2["InitializeAccount"] = 1] = "InitializeAccount";
    TokenInstruction2[TokenInstruction2["InitializeMultisig"] = 2] = "InitializeMultisig";
    TokenInstruction2[TokenInstruction2["Transfer"] = 3] = "Transfer";
    TokenInstruction2[TokenInstruction2["Approve"] = 4] = "Approve";
    TokenInstruction2[TokenInstruction2["Revoke"] = 5] = "Revoke";
    TokenInstruction2[TokenInstruction2["SetAuthority"] = 6] = "SetAuthority";
    TokenInstruction2[TokenInstruction2["MintTo"] = 7] = "MintTo";
    TokenInstruction2[TokenInstruction2["Burn"] = 8] = "Burn";
    TokenInstruction2[TokenInstruction2["CloseAccount"] = 9] = "CloseAccount";
    TokenInstruction2[TokenInstruction2["FreezeAccount"] = 10] = "FreezeAccount";
    TokenInstruction2[TokenInstruction2["ThawAccount"] = 11] = "ThawAccount";
    TokenInstruction2[TokenInstruction2["TransferChecked"] = 12] = "TransferChecked";
    TokenInstruction2[TokenInstruction2["ApproveChecked"] = 13] = "ApproveChecked";
    TokenInstruction2[TokenInstruction2["MintToChecked"] = 14] = "MintToChecked";
    TokenInstruction2[TokenInstruction2["BurnChecked"] = 15] = "BurnChecked";
    TokenInstruction2[TokenInstruction2["InitializeAccount2"] = 16] = "InitializeAccount2";
    TokenInstruction2[TokenInstruction2["SyncNative"] = 17] = "SyncNative";
    TokenInstruction2[TokenInstruction2["InitializeAccount3"] = 18] = "InitializeAccount3";
    TokenInstruction2[TokenInstruction2["InitializeMultisig2"] = 19] = "InitializeMultisig2";
    TokenInstruction2[TokenInstruction2["InitializeMint2"] = 20] = "InitializeMint2";
    TokenInstruction2[TokenInstruction2["GetAccountDataSize"] = 21] = "GetAccountDataSize";
    TokenInstruction2[TokenInstruction2["InitializeImmutableOwner"] = 22] = "InitializeImmutableOwner";
    TokenInstruction2[TokenInstruction2["AmountToUiAmount"] = 23] = "AmountToUiAmount";
    TokenInstruction2[TokenInstruction2["UiAmountToAmount"] = 24] = "UiAmountToAmount";
    TokenInstruction2[TokenInstruction2["InitializeMintCloseAuthority"] = 25] = "InitializeMintCloseAuthority";
    TokenInstruction2[TokenInstruction2["TransferFeeExtension"] = 26] = "TransferFeeExtension";
    TokenInstruction2[TokenInstruction2["ConfidentialTransferExtension"] = 27] = "ConfidentialTransferExtension";
    TokenInstruction2[TokenInstruction2["DefaultAccountStateExtension"] = 28] = "DefaultAccountStateExtension";
    TokenInstruction2[TokenInstruction2["Reallocate"] = 29] = "Reallocate";
    TokenInstruction2[TokenInstruction2["MemoTransferExtension"] = 30] = "MemoTransferExtension";
    TokenInstruction2[TokenInstruction2["CreateNativeMint"] = 31] = "CreateNativeMint";
    TokenInstruction2[TokenInstruction2["InitializeNonTransferableMint"] = 32] = "InitializeNonTransferableMint";
    TokenInstruction2[TokenInstruction2["InterestBearingMintExtension"] = 33] = "InterestBearingMintExtension";
    TokenInstruction2[TokenInstruction2["CpiGuardExtension"] = 34] = "CpiGuardExtension";
    TokenInstruction2[TokenInstruction2["InitializePermanentDelegate"] = 35] = "InitializePermanentDelegate";
    TokenInstruction2[TokenInstruction2["TransferHookExtension"] = 36] = "TransferHookExtension";
    TokenInstruction2[TokenInstruction2["MetadataPointerExtension"] = 39] = "MetadataPointerExtension";
    TokenInstruction2[TokenInstruction2["GroupPointerExtension"] = 40] = "GroupPointerExtension";
    TokenInstruction2[TokenInstruction2["GroupMemberPointerExtension"] = 41] = "GroupMemberPointerExtension";
    TokenInstruction2[TokenInstruction2["ScaledUiAmountExtension"] = 43] = "ScaledUiAmountExtension";
    TokenInstruction2[TokenInstruction2["PausableExtension"] = 44] = "PausableExtension";
  })(TokenInstruction || (TokenInstruction = {}));

  // node_modules/@solana/spl-token/lib/esm/state/mint.js
  init_buffer_shim();
  var import_buffer_layout6 = __toESM(require_Layout(), 1);

  // node_modules/@solana/spl-token/lib/esm/instructions/internal.js
  init_buffer_shim();
  function addSigners(keys, ownerOrAuthority, multiSigners) {
    if (multiSigners.length) {
      keys.push({ pubkey: ownerOrAuthority, isSigner: false, isWritable: false });
      for (const signer of multiSigners) {
        keys.push({
          pubkey: signer instanceof PublicKey ? signer : signer.publicKey,
          isSigner: true,
          isWritable: false
        });
      }
    } else {
      keys.push({ pubkey: ownerOrAuthority, isSigner: true, isWritable: false });
    }
    return keys;
  }

  // node_modules/@solana/spl-token/lib/esm/instructions/transferChecked.js
  init_buffer_shim();
  var import_buffer_layout5 = __toESM(require_Layout(), 1);
  var transferCheckedInstructionData = (0, import_buffer_layout5.struct)([
    (0, import_buffer_layout5.u8)("instruction"),
    u642("amount"),
    (0, import_buffer_layout5.u8)("decimals")
  ]);
  function createTransferCheckedInstruction(source, mint, destination, owner, amount, decimals, multiSigners = [], programId = TOKEN_PROGRAM_ID) {
    const keys = addSigners([
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: destination, isSigner: false, isWritable: true }
    ], owner, multiSigners);
    const data = Buffer.alloc(transferCheckedInstructionData.span);
    transferCheckedInstructionData.encode({
      instruction: TokenInstruction.TransferChecked,
      amount: BigInt(amount),
      decimals
    }, data);
    return new TransactionInstruction({ keys, programId, data });
  }

  // node_modules/@solana/spl-token/lib/esm/state/mint.js
  var MintLayout = (0, import_buffer_layout6.struct)([
    (0, import_buffer_layout6.u32)("mintAuthorityOption"),
    publicKey2("mintAuthority"),
    u642("supply"),
    (0, import_buffer_layout6.u8)("decimals"),
    bool("isInitialized"),
    (0, import_buffer_layout6.u32)("freezeAuthorityOption"),
    publicKey2("freezeAuthority")
  ]);
  var MINT_SIZE = MintLayout.span;
  async function getAssociatedTokenAddress(mint, owner, allowOwnerOffCurve = false, programId = TOKEN_PROGRAM_ID, associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID) {
    if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBuffer()))
      throw new TokenOwnerOffCurveError();
    const [address] = await PublicKey.findProgramAddress([owner.toBuffer(), programId.toBuffer(), mint.toBuffer()], associatedTokenProgramId);
    return address;
  }

  // node_modules/@solana/spl-token/lib/esm/instructions/associatedTokenAccount.js
  init_buffer_shim();
  function createAssociatedTokenAccountIdempotentInstruction(payer, associatedToken, owner, mint, programId = TOKEN_PROGRAM_ID, associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID) {
    return buildAssociatedTokenAccountInstruction(payer, associatedToken, owner, mint, Buffer.from([1]), programId, associatedTokenProgramId);
  }
  function buildAssociatedTokenAccountInstruction(payer, associatedToken, owner, mint, instructionData, programId = TOKEN_PROGRAM_ID, associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID) {
    const keys = [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false }
    ];
    return new TransactionInstruction({
      keys,
      programId: associatedTokenProgramId,
      data: instructionData
    });
  }

  // examples/chat-portal/public/src/connect-pay.js
  var u8ToB64 = (u85) => {
    let s = "";
    for (let i2 = 0; i2 < u85.length; i2++) s += String.fromCharCode(u85[i2]);
    return btoa(s);
  };
  var MAINNET_RPCS = [
    "https://solana-rpc.publicnode.com",
    "https://api.mainnet-beta.solana.com",
    "https://rpc.ankr.com/solana",
    "https://solana-mainnet.g.alchemy.com/v2/demo"
  ];
  var DEVNET_RPCS = ["https://api.devnet.solana.com"];
  function rpcList(net) {
    return net === "mainnet" ? MAINNET_RPCS : DEVNET_RPCS;
  }
  async function latestBlockhash(net) {
    let lastErr;
    for (const url of rpcList(net)) {
      try {
        const conn = new Connection(url, "confirmed");
        const bh = await conn.getLatestBlockhash();
        if (bh && bh.blockhash) return { conn, blockhash: bh.blockhash };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("all Solana RPCs failed to return a blockhash");
  }
  async function buildTransfer(conn, pay, payer, blockhash) {
    const mint = new PublicKey(pay.asset);
    const treasury = new PublicKey(pay.payTo);
    const payerAta = await getAssociatedTokenAddress(mint, payer);
    const destAta = await getAssociatedTokenAddress(mint, treasury);
    const atomic = BigInt(pay.amount);
    const transferIx = createTransferCheckedInstruction(payerAta, mint, destAta, payer, atomic, 6);
    const msg = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions: [
        createAssociatedTokenAccountIdempotentInstruction(payer, destAta, treasury, mint),
        transferIx
      ]
    }).compileToV0Message();
    return new VersionedTransaction(msg);
  }
  async function listWallets() {
    try {
      const mod2 = await import("https://esm.sh/@wallet-standard/app@1.1.0");
      const ws = mod2.getWallets().get();
      return ws.filter((w) => w.chains && w.chains.some((c) => c.indexOf("solana:") === 0) && w.features["standard:connect"] && (w.features["solana:signAndSendTransaction"] || w.features["solana:signTransaction"]));
    } catch (e) {
      return [];
    }
  }
  async function topup(url, init = {}) {
    const probe = await fetch(url, init);
    if (probe.status !== 402) return probe;
    const body = await probe.json();
    const accept = body.accepts && body.accepts[0] || body;
    if (!accept.payTo || !accept.amount) throw new Error("No payable challenge returned");
    const pay = {
      network: accept.network || "solana-mainnet",
      asset: accept.asset,
      amount: String(accept.maxAmountRequired ?? accept.amount),
      payTo: accept.payTo
    };
    const net = pay.network === "solana-mainnet" ? "mainnet" : "devnet";
    const { conn, blockhash } = await latestBlockhash(net);
    const ws = await listWallets();
    const legacy = window.phantom && window.phantom.solana ? window.phantom.solana : window.solana;
    let payer, tx;
    if (ws.length) {
      const cr = await ws[0].features["standard:connect"].connect();
      const acct = cr && cr.accounts && cr.accounts[0] || ws[0].accounts[0];
      payer = new PublicKey(acct.publicKey);
      tx = await buildTransfer(conn, pay, payer, blockhash);
      const chain = "solana:" + (net === "mainnet" ? "mainnet" : "devnet");
      const sg = await ws[0].features["solana:signTransaction"].signTransaction({ account: acct, chain, transaction: tx.serialize() });
      tx = sg[0].signedTransaction;
    } else if (legacy && legacy.signTransaction) {
      const res = await legacy.connect();
      const pk = res && res.publicKey ? res.publicKey : legacy.publicKey;
      payer = new PublicKey(pk.toString());
      tx = await buildTransfer(conn, pay, payer, blockhash);
      const out = await legacy.signTransaction(tx);
      tx = out && out.signedTransaction ? out.signedTransaction : out;
    } else {
      throw new Error("No Solana wallet detected \u2014 install Phantom/Solflare/Backpack.");
    }
    const wire = tx.serialize ? tx.serialize() : tx;
    const headers = { ...init.headers ?? {} };
    headers["X-PAYMENT"] = u8ToB64(new TextEncoder().encode(JSON.stringify({ payload: { transaction: u8ToB64(wire) } })));
    return await fetch(url, { ...init, headers });
  }
  window.ShipyardFund = {
    hasWallet: () => !!(window.phantom?.solana || window.solana),
    topup
  };
})();
/*! Bundled license information:

ieee754/index.js:
  (*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> *)

buffer/index.js:
  (*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)

safe-buffer/index.js:
  (*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> *)

@solana/buffer-layout/lib/Layout.js:
  (**
   * Support for translating between Uint8Array instances and JavaScript
   * native types.
   *
   * {@link module:Layout~Layout|Layout} is the basis of a class
   * hierarchy that associates property names with sequences of encoded
   * bytes.
   *
   * Layouts are supported for these scalar (numeric) types:
   * * {@link module:Layout~UInt|Unsigned integers in little-endian
   *   format} with {@link module:Layout.u8|8-bit}, {@link
   *   module:Layout.u16|16-bit}, {@link module:Layout.u24|24-bit},
   *   {@link module:Layout.u32|32-bit}, {@link
   *   module:Layout.u40|40-bit}, and {@link module:Layout.u48|48-bit}
   *   representation ranges;
   * * {@link module:Layout~UIntBE|Unsigned integers in big-endian
   *   format} with {@link module:Layout.u16be|16-bit}, {@link
   *   module:Layout.u24be|24-bit}, {@link module:Layout.u32be|32-bit},
   *   {@link module:Layout.u40be|40-bit}, and {@link
   *   module:Layout.u48be|48-bit} representation ranges;
   * * {@link module:Layout~Int|Signed integers in little-endian
   *   format} with {@link module:Layout.s8|8-bit}, {@link
   *   module:Layout.s16|16-bit}, {@link module:Layout.s24|24-bit},
   *   {@link module:Layout.s32|32-bit}, {@link
   *   module:Layout.s40|40-bit}, and {@link module:Layout.s48|48-bit}
   *   representation ranges;
   * * {@link module:Layout~IntBE|Signed integers in big-endian format}
   *   with {@link module:Layout.s16be|16-bit}, {@link
   *   module:Layout.s24be|24-bit}, {@link module:Layout.s32be|32-bit},
   *   {@link module:Layout.s40be|40-bit}, and {@link
   *   module:Layout.s48be|48-bit} representation ranges;
   * * 64-bit integral values that decode to an exact (if magnitude is
   *   less than 2^53) or nearby integral Number in {@link
   *   module:Layout.nu64|unsigned little-endian}, {@link
   *   module:Layout.nu64be|unsigned big-endian}, {@link
   *   module:Layout.ns64|signed little-endian}, and {@link
   *   module:Layout.ns64be|unsigned big-endian} encodings;
   * * 32-bit floating point values with {@link
   *   module:Layout.f32|little-endian} and {@link
   *   module:Layout.f32be|big-endian} representations;
   * * 64-bit floating point values with {@link
   *   module:Layout.f64|little-endian} and {@link
   *   module:Layout.f64be|big-endian} representations;
   * * {@link module:Layout.const|Constants} that take no space in the
   *   encoded expression.
   *
   * and for these aggregate types:
   * * {@link module:Layout.seq|Sequence}s of instances of a {@link
   *   module:Layout~Layout|Layout}, with JavaScript representation as
   *   an Array and constant or data-dependent {@link
   *   module:Layout~Sequence#count|length};
   * * {@link module:Layout.struct|Structure}s that aggregate a
   *   heterogeneous sequence of {@link module:Layout~Layout|Layout}
   *   instances, with JavaScript representation as an Object;
   * * {@link module:Layout.union|Union}s that support multiple {@link
   *   module:Layout~VariantLayout|variant layouts} over a fixed
   *   (padded) or variable (not padded) span of bytes, using an
   *   unsigned integer at the start of the data or a separate {@link
   *   module:Layout.unionLayoutDiscriminator|layout element} to
   *   determine which layout to use when interpreting the buffer
   *   contents;
   * * {@link module:Layout.bits|BitStructure}s that contain a sequence
   *   of individual {@link
   *   module:Layout~BitStructure#addField|BitField}s packed into an 8,
   *   16, 24, or 32-bit unsigned integer starting at the least- or
   *   most-significant bit;
   * * {@link module:Layout.cstr|C strings} of varying length;
   * * {@link module:Layout.blob|Blobs} of fixed- or variable-{@link
   *   module:Layout~Blob#length|length} raw data.
   *
   * All {@link module:Layout~Layout|Layout} instances are immutable
   * after construction, to prevent internal state from becoming
   * inconsistent.
   *
   * @local Layout
   * @local ExternalLayout
   * @local GreedyCount
   * @local OffsetLayout
   * @local UInt
   * @local UIntBE
   * @local Int
   * @local IntBE
   * @local NearUInt64
   * @local NearUInt64BE
   * @local NearInt64
   * @local NearInt64BE
   * @local Float
   * @local FloatBE
   * @local Double
   * @local DoubleBE
   * @local Sequence
   * @local Structure
   * @local UnionDiscriminator
   * @local UnionLayoutDiscriminator
   * @local Union
   * @local VariantLayout
   * @local BitStructure
   * @local BitField
   * @local Boolean
   * @local Blob
   * @local CString
   * @local Constant
   * @local bindConstructorLayout
   * @module Layout
   * @license MIT
   * @author Peter A. Bigot
   * @see {@link https://github.com/pabigot/buffer-layout|buffer-layout on GitHub}
   *)

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)

@noble/curves/esm/utils.js:
@noble/curves/esm/abstract/modular.js:
@noble/curves/esm/abstract/curve.js:
@noble/curves/esm/abstract/edwards.js:
@noble/curves/esm/ed25519.js:
@noble/curves/esm/abstract/weierstrass.js:
@noble/curves/esm/_shortw_utils.js:
@noble/curves/esm/secp256k1.js:
  (*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
