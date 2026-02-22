var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-gOS1K0/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= new Response(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = new Response(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = new Response(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return new Response(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => new Response();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #getHandlerSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              handlerSets.push(
                ...this.#getHandlerSets(nextNode.#children["*"], method, node.#params)
              );
            }
            handlerSets.push(...this.#getHandlerSets(nextNode, method, node.#params));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              handlerSets.push(...this.#getHandlerSets(astNode, method, node.#params));
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp) {
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              handlerSets.push(...this.#getHandlerSets(child, method, node.#params, params));
              if (Object.keys(child.#children).length) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              handlerSets.push(...this.#getHandlerSets(child, method, params, node.#params));
              if (child.#children["*"]) {
                handlerSets.push(
                  ...this.#getHandlerSets(child.#children["*"], method, params, node.#params)
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      curNodes = tempNodes.concat(curNodesQueue.shift() ?? []);
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// ../../../node_modules/.pnpm/hono@4.11.9/node_modules/hono/dist/middleware/cors/index.js
var cors = /* @__PURE__ */ __name((options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return /* @__PURE__ */ __name(async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    __name(set, "set");
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  }, "cors2");
}, "cors");

// ../../../packages/game-sdk/dist/index.js
var SPECTATOR_ROLE_ID = "nexus_reserved_specator";
function isSpectator(roleId) {
  return roleId === SPECTATOR_ROLE_ID;
}
__name(isSpectator, "isSpectator");

// ../logic/config.ts
var WEREWOLF_RULES = `
# \u89D2\u8272\u8BBE\u5B9A
\u4F60\u6B63\u5728\u53C2\u4E0E\u72FC\u4EBA\u6740\u5BF9\u5C40\uFF0C\u8BF7\u6839\u636E\u4F60\u7684\u8EAB\u4EFD\u4E0E\u76EE\u6807\u4F5C\u51FA\u884C\u52A8\u51B3\u7B56\u3002

## \u9635\u8425\u4E0E\u80DC\u5229\u6761\u4EF6
- \u597D\u4EBA\u9635\u8425\uFF1A\u653E\u9010\u6240\u6709\u72FC\u4EBA\u3002
- \u72FC\u4EBA\u9635\u8425\uFF1A\u5C60\u8FB9\uFF08\u6740\u5149\u6240\u6709\u5E73\u6C11\u6216\u6240\u6709\u795E\u804C\uFF09\u3002
`;
var PLAYER_COUNT_RANGE = [6, 7, 8, 9, 10, 11, 12];
var PLAYER_ROLE_IDS_BY_COUNT = PLAYER_COUNT_RANGE.reduce(
  (acc, count) => {
    acc[count] = Array.from({ length: count }, (_, idx) => `${idx + 1}`);
    return acc;
  },
  {}
);
var ROLE_DISTRIBUTIONS = {
  6: ["werewolf", "werewolf", "seer", "witch", "villager", "villager"],
  7: ["werewolf", "werewolf", "seer", "witch", "villager", "villager", "villager"],
  8: ["werewolf", "werewolf", "seer", "witch", "hunter", "villager", "villager", "villager"],
  9: ["werewolf", "werewolf", "werewolf", "seer", "witch", "hunter", "villager", "villager", "villager"],
  10: ["werewolf", "werewolf", "werewolf", "seer", "witch", "hunter", "guard", "villager", "villager", "villager"],
  11: ["werewolf", "werewolf", "werewolf", "werewolf", "seer", "witch", "hunter", "guard", "villager", "villager", "villager"],
  12: ["werewolf", "werewolf", "werewolf", "werewolf", "seer", "witch", "hunter", "guard", "villager", "villager", "villager", "villager"]
};
var PLAYER_COUNT_LABELS = {
  6: "6\u4EBA\u6807\u51C6\u5C40\uFF082\u72FC 2\u795E 2\u6C11\uFF09",
  7: "7\u4EBA\u5C40\uFF082\u72FC 2\u795E 3\u6C11\uFF09",
  8: "8\u4EBA\u5C40\uFF082\u72FC 3\u795E 3\u6C11\uFF09",
  9: "9\u4EBA\u5C40\uFF083\u72FC 3\u795E 3\u6C11\uFF09",
  10: "10\u4EBA\u5C40\uFF083\u72FC 4\u795E 3\u6C11\uFF09",
  11: "11\u4EBA\u5C40\uFF084\u72FC 4\u795E 3\u6C11\uFF09",
  12: "12\u4EBA\u5C40\uFF084\u72FC 4\u795E 4\u6C11\uFF09"
};

// ../logic/utils.ts
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
__name(shuffle, "shuffle");
function getInitialNightSubPhase(identities) {
  return Object.values(identities).includes("guard") ? "guard" : "werewolf";
}
__name(getInitialNightSubPhase, "getInitialNightSubPhase");
function cloneState(state) {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state));
}
__name(cloneState, "cloneState");
function getAlivePlayers(state) {
  return state.players.filter((playerId) => state.alive[playerId]);
}
__name(getAlivePlayers, "getAlivePlayers");
function findAliveIdentity(state, identity) {
  return state.players.find((playerId) => state.alive[playerId] && state.identities[playerId] === identity) ?? null;
}
__name(findAliveIdentity, "findAliveIdentity");
function hasAliveIdentity(state, identity) {
  return findAliveIdentity(state, identity) !== null;
}
__name(hasAliveIdentity, "hasAliveIdentity");
function getAliveWerewolves(state) {
  return getAlivePlayers(state).filter((playerId) => state.identities[playerId] === "werewolf");
}
__name(getAliveWerewolves, "getAliveWerewolves");
function getWerewolfTeammates(state, roleId) {
  return Object.entries(state.identities).filter(([playerId, playerIdentity]) => playerIdentity === "werewolf" && playerId !== roleId).map(([playerId]) => playerId);
}
__name(getWerewolfTeammates, "getWerewolfTeammates");
function getSeerHistory(state) {
  return state.nightHistory.filter((record) => record.seer_check).map((record) => ({
    night: record.night,
    target: record.seer_check.target,
    result: record.seer_check.result
  }));
}
__name(getSeerHistory, "getSeerHistory");
function calculateWerewolfTarget(state) {
  const votes = state.currentNightActions.werewolf_votes;
  const tally = /* @__PURE__ */ new Map();
  Object.values(votes).forEach((target) => {
    if (!target || target === "skip") return;
    if (!state.alive[target]) return;
    tally.set(target, (tally.get(target) ?? 0) + 1);
  });
  if (tally.size === 0) return null;
  const sorted = Array.from(tally.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const top = sorted[0];
  const tied = sorted.filter(([, count]) => count === top[1]);
  if (tied.length > 1) {
    return tied[Math.floor(Math.random() * tied.length)][0];
  }
  return top[0];
}
__name(calculateWerewolfTarget, "calculateWerewolfTarget");
function getCamp(identity) {
  return identity === "werewolf" ? "werewolf" : "villager";
}
__name(getCamp, "getCamp");
function isHunterShootPhase(state) {
  return state.phase === "hunter_shoot";
}
__name(isHunterShootPhase, "isHunterShootPhase");
function normalizeTargetFromAction(actionId, params, legacyPrefix) {
  if (params && typeof params.target === "string" && params.target.trim().length > 0) {
    return params.target.trim();
  }
  const match2 = actionId.match(new RegExp(`^${legacyPrefix}_(.+)$`));
  return match2 ? match2[1] : null;
}
__name(normalizeTargetFromAction, "normalizeTargetFromAction");

// ../logic/actions.ts
function buildTargetSchema(candidates, desc) {
  return {
    target: {
      type: "string",
      description: desc,
      enum: candidates
    }
  };
}
__name(buildTargetSchema, "buildTargetSchema");
function getNightLegalActions(state, roleId) {
  switch (state.nightSubPhase) {
    case "guard":
      return getGuardLegalActions(state);
    case "werewolf":
      return getWerewolfLegalActions(state);
    case "seer":
      return getSeerLegalActions(state, roleId);
    case "witch":
      return getWitchLegalActions(state, roleId);
    default:
      return { actions: [] };
  }
}
__name(getNightLegalActions, "getNightLegalActions");
function getGuardLegalActions(state) {
  const alivePlayers = getAlivePlayers(state).filter((playerId) => playerId !== state.lastGuardTarget);
  const actions = [];
  if (alivePlayers.length > 0) {
    actions.push({
      action_id: "guard",
      description: "\u5B88\u62A4\u4E00\u540D\u73A9\u5BB6",
      params_schema: buildTargetSchema(alivePlayers, "\u8981\u5B88\u62A4\u7684\u73A9\u5BB6ID")
    });
  }
  actions.push({ action_id: "guard_skip", description: "\u4E0D\u5B88\u62A4\u4EFB\u4F55\u73A9\u5BB6", params_schema: null });
  return { actions };
}
__name(getGuardLegalActions, "getGuardLegalActions");
function getWerewolfLegalActions(state) {
  const alivePlayers = getAlivePlayers(state);
  const actions = [];
  if (alivePlayers.length > 0) {
    actions.push({
      action_id: "kill",
      description: "\u6295\u7968\u6740\u5BB3\u4E00\u540D\u73A9\u5BB6",
      params_schema: buildTargetSchema(alivePlayers, "\u8981\u51FB\u6740\u7684\u73A9\u5BB6ID")
    });
  }
  actions.push({ action_id: "kill_none", description: "\u672C\u665A\u4E0D\u6740\u4EBA", params_schema: null });
  return { actions };
}
__name(getWerewolfLegalActions, "getWerewolfLegalActions");
function getSeerLegalActions(state, roleId) {
  const candidates = getAlivePlayers(state).filter((playerId) => playerId !== roleId);
  if (candidates.length === 0) return { actions: [] };
  return {
    actions: [{
      action_id: "check",
      description: "\u67E5\u9A8C\u4E00\u540D\u73A9\u5BB6",
      params_schema: buildTargetSchema(candidates, "\u8981\u67E5\u9A8C\u7684\u73A9\u5BB6ID")
    }]
  };
}
__name(getSeerLegalActions, "getSeerLegalActions");
function getWitchLegalActions(state, roleId) {
  const actions = [];
  const victim = state.currentNightActions.werewolf_target;
  if (!state.witchPotions.antidote_used && victim && victim !== roleId) {
    actions.push({ action_id: "use_antidote", description: `\u4F7F\u7528\u89E3\u836F\u6551\u4E0B ${victim}`, params_schema: null });
  }
  if (!state.witchPotions.poison_used) {
    const candidates = getAlivePlayers(state).filter((playerId) => playerId !== roleId);
    if (candidates.length > 0) {
      actions.push({
        action_id: "use_poison",
        description: "\u4F7F\u7528\u6BD2\u836F\u6BD2\u6740\u4E00\u540D\u73A9\u5BB6",
        params_schema: buildTargetSchema(candidates, "\u8981\u6BD2\u6740\u7684\u73A9\u5BB6ID")
      });
    }
  }
  actions.push({ action_id: "witch_skip", description: "\u4E0D\u4F7F\u7528\u4EFB\u4F55\u836F\u5242", params_schema: null });
  return { actions };
}
__name(getWitchLegalActions, "getWitchLegalActions");
function getDayDiscussionLegalActions() {
  return {
    actions: [{
      action_id: "speak",
      description: "\u53D1\u8868\u53D1\u8A00",
      params_schema: {
        content: {
          type: "string",
          description: "\u8BF7\u8F93\u5165\u4F60\u7684\u53D1\u8A00\u5185\u5BB9"
        }
      }
    }]
  };
}
__name(getDayDiscussionLegalActions, "getDayDiscussionLegalActions");
function getDayVotingLegalActions(state) {
  const alivePlayers = getAlivePlayers(state);
  const actions = [];
  if (alivePlayers.length > 0) {
    actions.push({
      action_id: "vote",
      description: "\u6295\u7968\u653E\u9010\u4E00\u540D\u73A9\u5BB6",
      params_schema: buildTargetSchema(alivePlayers, "\u8981\u653E\u9010\u7684\u73A9\u5BB6ID")
    });
  }
  actions.push({ action_id: "vote_skip", description: "\u5F03\u7968", params_schema: null });
  return { actions };
}
__name(getDayVotingLegalActions, "getDayVotingLegalActions");
function getHunterLegalActions(state, roleId) {
  const alivePlayers = getAlivePlayers(state).filter((playerId) => playerId !== roleId);
  const actions = [];
  if (alivePlayers.length > 0) {
    actions.push({
      action_id: "shoot",
      description: "\u5F00\u67AA\u5E26\u8D70\u4E00\u540D\u73A9\u5BB6",
      params_schema: buildTargetSchema(alivePlayers, "\u8981\u5E26\u8D70\u7684\u73A9\u5BB6ID")
    });
  }
  actions.push({ action_id: "shoot_skip", description: "\u4E0D\u5F00\u67AA", params_schema: null });
  return { actions };
}
__name(getHunterLegalActions, "getHunterLegalActions");
function applyGuardAction(state, action, consumeActor) {
  if (action.action_id === "guard_skip") {
    state.currentNightActions.guard_target = null;
    consumeActor(state);
    return { success: true, nextState: state };
  }
  const targetId = normalizeTargetFromAction(action.action_id, action.params, "guard");
  if (!targetId) return { success: false, error: "\u65E0\u6548\u7684\u5B88\u536B\u884C\u52A8", errorCode: "INVALID_ACTION" };
  if (!state.alive[targetId]) return { success: false, error: "\u76EE\u6807\u5DF2\u51FA\u5C40\uFF0C\u65E0\u6CD5\u5B88\u62A4", errorCode: "TARGET_DEAD" };
  if (state.lastGuardTarget && state.lastGuardTarget === targetId) {
    return { success: false, error: "\u5B88\u536B\u4E0D\u80FD\u8FDE\u7EED\u4E24\u665A\u5B88\u62A4\u540C\u4E00\u540D\u73A9\u5BB6", errorCode: "REPEATED_GUARD" };
  }
  state.currentNightActions.guard_target = targetId;
  state.lastGuardTarget = targetId;
  consumeActor(state);
  return { success: true, nextState: state };
}
__name(applyGuardAction, "applyGuardAction");
function applyWerewolfAction(state, action, consumeActor) {
  if (action.action_id === "kill_none") {
    state.currentNightActions.werewolf_votes[action.role_id] = "skip";
  } else {
    const targetId = normalizeTargetFromAction(action.action_id, action.params, "kill");
    if (!targetId) return { success: false, error: "\u65E0\u6548\u7684\u72FC\u4EBA\u884C\u52A8", errorCode: "INVALID_ACTION" };
    if (!state.alive[targetId]) return { success: false, error: "\u76EE\u6807\u5DF2\u51FA\u5C40\uFF0C\u65E0\u6CD5\u88AB\u6740\u5BB3", errorCode: "TARGET_DEAD" };
    state.currentNightActions.werewolf_votes[action.role_id] = targetId;
  }
  consumeActor(state);
  if (state.pendingRoles.length === 0) {
    state.currentNightActions.werewolf_target = calculateWerewolfTarget(state);
  }
  return { success: true, nextState: state };
}
__name(applyWerewolfAction, "applyWerewolfAction");
function applySeerAction(state, action, consumeActor) {
  const targetId = normalizeTargetFromAction(action.action_id, action.params, "check");
  if (!targetId) return { success: false, error: "\u65E0\u6548\u7684\u9884\u8A00\u5BB6\u884C\u52A8", errorCode: "INVALID_ACTION" };
  if (!state.alive[targetId]) return { success: false, error: "\u76EE\u6807\u5DF2\u51FA\u5C40\uFF0C\u65E0\u6CD5\u67E5\u9A8C", errorCode: "TARGET_DEAD" };
  if (targetId === action.role_id) return { success: false, error: "\u9884\u8A00\u5BB6\u4E0D\u80FD\u67E5\u9A8C\u81EA\u5DF1", errorCode: "INVALID_TARGET" };
  state.currentNightActions.seer_target = targetId;
  state.currentNightActions.seer_result = getCamp(state.identities[targetId]) === "werewolf" ? "werewolf" : "good";
  consumeActor(state);
  return { success: true, nextState: state };
}
__name(applySeerAction, "applySeerAction");
function applyWitchAction(state, action, consumeActor) {
  if (action.action_id === "use_antidote") {
    const victim = state.currentNightActions.werewolf_target;
    if (!victim || victim === action.role_id) return { success: false, error: "\u5F53\u524D\u65E0\u6CD5\u4F7F\u7528\u89E3\u836F", errorCode: "INVALID_ACTION" };
    if (state.witchPotions.antidote_used) return { success: false, error: "\u89E3\u836F\u5DF2\u7ECF\u7528\u5B8C", errorCode: "POTION_USED" };
    state.currentNightActions.witch_save = true;
    state.witchPotions.antidote_used = true;
  } else if (action.action_id === "witch_skip") {
  } else {
    const targetId = normalizeTargetFromAction(action.action_id, action.params, "use_poison");
    if (!targetId) return { success: false, error: "\u65E0\u6548\u7684\u5973\u5DEB\u884C\u52A8", errorCode: "INVALID_ACTION" };
    if (state.witchPotions.poison_used) return { success: false, error: "\u6BD2\u836F\u5DF2\u7ECF\u7528\u5B8C", errorCode: "POTION_USED" };
    if (!state.alive[targetId]) return { success: false, error: "\u76EE\u6807\u5DF2\u51FA\u5C40\uFF0C\u65E0\u6CD5\u6BD2\u6740", errorCode: "TARGET_DEAD" };
    if (targetId === action.role_id) return { success: false, error: "\u5973\u5DEB\u4E0D\u80FD\u6BD2\u6740\u81EA\u5DF1", errorCode: "INVALID_TARGET" };
    state.currentNightActions.witch_poison_target = targetId;
    state.witchPotions.poison_used = true;
  }
  consumeActor(state);
  return { success: true, nextState: state };
}
__name(applyWitchAction, "applyWitchAction");
function applyDayDiscussionAction(state, action, consumeActor) {
  if (action.action_id !== "speak") return { success: false, error: "\u65E0\u6548\u7684\u53D1\u8A00\u884C\u52A8", errorCode: "INVALID_ACTION" };
  const content = action.params?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    return { success: false, error: "\u53D1\u8A00\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A", errorCode: "INVALID_PARAMS" };
  }
  state.speechHistory.push({
    day: state.day,
    speaker: action.role_id,
    content,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  consumeActor(state);
  return { success: true, nextState: state };
}
__name(applyDayDiscussionAction, "applyDayDiscussionAction");
function applyDayVotingAction(state, action, consumeActor) {
  if (action.action_id === "vote_skip") {
    state.currentDayVotes[action.role_id] = "skip";
  } else {
    const targetId = normalizeTargetFromAction(action.action_id, action.params, "vote");
    if (!targetId) return { success: false, error: "\u65E0\u6548\u7684\u6295\u7968\u884C\u52A8", errorCode: "INVALID_ACTION" };
    if (!state.alive[targetId]) return { success: false, error: "\u76EE\u6807\u5DF2\u51FA\u5C40\uFF0C\u65E0\u6CD5\u88AB\u6295\u7968", errorCode: "TARGET_DEAD" };
    state.currentDayVotes[action.role_id] = targetId;
  }
  consumeActor(state);
  return { success: true, nextState: state };
}
__name(applyDayVotingAction, "applyDayVotingAction");
function applyHunterAction(state, action, consumeActor) {
  const hunterId = action.role_id;
  state.hunterCanShoot = false;
  let shotDeath = null;
  if (action.action_id === "shoot_skip") {
  } else {
    const targetId = normalizeTargetFromAction(action.action_id, action.params, "shoot");
    if (!targetId) return { success: false, error: "\u65E0\u6548\u7684\u730E\u4EBA\u884C\u52A8", shotDeath: null };
    if (!state.alive[targetId]) return { success: false, error: "\u76EE\u6807\u5DF2\u51FA\u5C40\uFF0C\u65E0\u6CD5\u88AB\u5E26\u8D70", shotDeath: null };
    if (targetId === hunterId) return { success: false, error: "\u730E\u4EBA\u4E0D\u80FD\u5E26\u8D70\u81EA\u5DF1", shotDeath: null };
    shotDeath = {
      day: state.day,
      phase: "hunter_shoot",
      victim: targetId,
      cause: "hunter"
    };
  }
  consumeActor(state);
  return { success: true, shotDeath };
}
__name(applyHunterAction, "applyHunterAction");

// ../logic/phases.ts
function ensurePendingRoles(state, callbacks) {
  if (state.phase === "game_over") {
    state.pendingRoles = [];
    return;
  }
  let guard = 0;
  while (state.pendingRoles.length === 0) {
    guard += 1;
    if (guard > 32) throw new Error("ensurePendingRoles safety break");
    if (state.phase === "night") {
      switch (state.nightSubPhase) {
        case "guard":
          callbacks.prepareNightSubPhase(state, "werewolf");
          break;
        case "werewolf":
          callbacks.prepareNightSubPhase(state, "seer");
          break;
        case "seer":
          callbacks.prepareNightSubPhase(state, "witch");
          break;
        case "witch":
          callbacks.resolveNight(state);
          if (isHunterShootPhase(state)) return;
          break;
        default:
          state.pendingRoles = [];
          return;
      }
    } else if (state.phase === "day_discussion") {
      callbacks.startDayVoting(state);
    } else if (state.phase === "day_voting") {
      callbacks.resolveDayVoting(state);
      if (isHunterShootPhase(state)) return;
    } else {
      break;
    }
  }
}
__name(ensurePendingRoles, "ensurePendingRoles");
function prepareNightSubPhase(state, subPhase) {
  state.phase = "night";
  state.nightSubPhase = subPhase;
  state.pendingRoles = [];
  switch (subPhase) {
    case "guard": {
      const guardId = findAliveIdentity(state, "guard");
      if (guardId) state.pendingRoles = [guardId];
      break;
    }
    case "werewolf":
      state.pendingRoles = getAliveWerewolves(state);
      break;
    case "seer": {
      const seerId = findAliveIdentity(state, "seer");
      if (seerId) state.pendingRoles = [seerId];
      break;
    }
    case "witch": {
      const witchId = findAliveIdentity(state, "witch");
      if (witchId) state.pendingRoles = [witchId];
      break;
    }
    default:
      state.pendingRoles = [];
      break;
  }
}
__name(prepareNightSubPhase, "prepareNightSubPhase");
function resolveNight(state, applyDeathsCallback, startDayDiscussionCallback) {
  const guardTarget = state.currentNightActions.guard_target;
  const werewolfTarget = state.currentNightActions.werewolf_target;
  const witchSaved = state.currentNightActions.witch_save;
  const poisonTarget = state.currentNightActions.witch_poison_target;
  let actualWerewolfKill = null;
  if (werewolfTarget) {
    const guardProtected = guardTarget === werewolfTarget;
    const savedByWitch = witchSaved;
    if (guardProtected && savedByWitch) actualWerewolfKill = werewolfTarget;
    else if (guardProtected || savedByWitch) actualWerewolfKill = null;
    else actualWerewolfKill = werewolfTarget;
  }
  const nightDeaths = [];
  if (actualWerewolfKill) {
    nightDeaths.push({ day: state.day, phase: "night", victim: actualWerewolfKill, cause: "werewolf" });
  }
  if (poisonTarget && !nightDeaths.some((record) => record.victim === poisonTarget)) {
    nightDeaths.push({ day: state.day, phase: "night", victim: poisonTarget, cause: "poison" });
  }
  const nightRecord = {
    night: state.day,
    guard_target: guardTarget,
    werewolf_target: werewolfTarget,
    werewolf_killed: actualWerewolfKill,
    seer_check: state.currentNightActions.seer_target ? { target: state.currentNightActions.seer_target, result: state.currentNightActions.seer_result ?? "good" } : null,
    witch_actions: {
      saved: witchSaved,
      poisoned: poisonTarget ?? null
    }
  };
  state.nightHistory.push(nightRecord);
  state.lastNightDeaths = nightDeaths;
  state.lastDayExile = null;
  applyDeathsCallback(state, nightDeaths, "day_discussion");
  if (state.phase === "hunter_shoot" || state.phase === "last_words") return;
  startDayDiscussionCallback(state);
}
__name(resolveNight, "resolveNight");
function startDayDiscussion(state) {
  state.phase = "day_discussion";
  state.nightSubPhase = null;
  state.pendingRoles = getAlivePlayers(state);
  state.currentDayVotes = {};
}
__name(startDayDiscussion, "startDayDiscussion");
function startDayVoting(state) {
  state.phase = "day_voting";
  state.nightSubPhase = null;
  state.pendingRoles = getAlivePlayers(state);
  state.currentDayVotes = {};
}
__name(startDayVoting, "startDayVoting");
function resolveDayVoting(state, applyDeathsCallback, startNextNightCallback) {
  const voteEntries = Object.entries(state.currentDayVotes).map(([voter, target]) => ({ voter, target }));
  const tally = /* @__PURE__ */ new Map();
  for (const { target } of voteEntries) {
    if (!target || target === "skip") continue;
    tally.set(target, (tally.get(target) ?? 0) + 1);
  }
  let exiled = null;
  const sorted = Array.from(tally.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  if (sorted.length > 0) {
    const [topTarget, topVotes] = sorted[0];
    const tied = sorted.filter(([, count]) => count === topVotes);
    if (tied.length === 1) exiled = topTarget;
  }
  const voteRecord = {
    day: state.day,
    votes: voteEntries.map(({ voter, target }) => ({ voter, target })),
    exiled
  };
  state.voteHistory.push(voteRecord);
  state.currentDayVotes = {};
  state.pendingRoles = [];
  if (exiled) {
    state.lastDayExile = exiled;
    const death = { day: state.day, phase: "day_voting", victim: exiled, cause: "vote" };
    applyDeathsCallback(state, [death], "night");
    if (state.phase === "hunter_shoot" || state.phase === "last_words") return;
  } else {
    state.lastDayExile = null;
  }
  startNextNightCallback(state);
}
__name(resolveDayVoting, "resolveDayVoting");
function startNextNight(state) {
  state.day += 1;
  state.phase = "night";
  state.nightSubPhase = null;
  state.pendingRoles = [];
  state.currentNightActions = {
    guard_target: null,
    werewolf_votes: {},
    werewolf_target: null,
    seer_target: null,
    seer_result: null,
    witch_save: false,
    witch_poison_target: null
  };
  state.lastNightDeaths = [];
  const hasGuard = hasAliveIdentity(state, "guard");
  prepareNightSubPhase(state, hasGuard ? "guard" : "werewolf");
}
__name(startNextNight, "startNextNight");
function applyDeaths(state, deaths, resumePhaseIfHunter) {
  const actualDeaths = deaths.filter((record) => state.alive[record.victim]);
  if (actualDeaths.length === 0) return;
  state.phase = "last_words";
  state.nightSubPhase = null;
  state.pendingRoles = actualDeaths.map((d) => d.victim);
  state.lastWordsContext = {
    pendingDeaths: actualDeaths,
    resumePhase: resumePhaseIfHunter,
    completedLastWords: []
  };
}
__name(applyDeaths, "applyDeaths");
function resumeAfterHunter(state, shotDeath, applyDeathsCallback, startDayDiscussionCallback, startNextNightCallback) {
  const context = state.hunterShootContext;
  state.hunterShootContext = null;
  const pendingDeaths = [];
  if (shotDeath) pendingDeaths.push(shotDeath);
  if (context) pendingDeaths.push(...context.queuedDeaths);
  if (pendingDeaths.length > 0) {
    applyDeathsCallback(state, pendingDeaths, context ? context.resumePhase : "day_discussion");
    if (state.phase === "hunter_shoot" || state.phase === "last_words") return;
  }
  if (!context) {
    startDayDiscussionCallback(state);
    return;
  }
  if (context.resumePhase === "night") startNextNightCallback(state);
  else startDayDiscussionCallback(state);
}
__name(resumeAfterHunter, "resumeAfterHunter");
function checkVictory(state) {
  const alivePlayers = getAlivePlayers(state);
  const aliveWerewolves = alivePlayers.filter((playerId) => state.identities[playerId] === "werewolf");
  if (aliveWerewolves.length === 0) return "villager";
  const aliveGods = alivePlayers.filter((playerId) => ["seer", "witch", "hunter", "guard"].includes(state.identities[playerId]));
  const aliveVillagers = alivePlayers.filter((playerId) => state.identities[playerId] === "villager");
  if (aliveGods.length === 0 || aliveVillagers.length === 0) return "werewolf";
  return null;
}
__name(checkVictory, "checkVictory");
function updateWinnerIfNeeded(state) {
  if (state.winner) {
    state.phase = "game_over";
    state.pendingRoles = [];
    return;
  }
  const winner = checkVictory(state);
  if (winner) {
    state.winner = winner;
    state.phase = "game_over";
    state.pendingRoles = [];
  }
}
__name(updateWinnerIfNeeded, "updateWinnerIfNeeded");
function consumeCurrentActor(state) {
  state.pendingRoles.shift();
}
__name(consumeCurrentActor, "consumeCurrentActor");

// ../logic/stateFormatter.ts
function formatStateToNaturalLanguage(currentState) {
  const globalInfo = formatGlobalInfo(currentState);
  const perspectiveInfo = formatPerspectiveInfo(currentState);
  return { globalInfo, perspectiveInfo };
}
__name(formatStateToNaturalLanguage, "formatStateToNaturalLanguage");
function formatGlobalInfo(state) {
  const sections = [];
  sections.push(formatGamePhase(state));
  sections.push(formatAliveStatus(state, state.last_words_history || []));
  if (state.last_night_deaths?.length > 0) sections.push(formatLastNightDeaths(state.last_night_deaths));
  if (state.last_day_exile) sections.push(`\u6628\u5929\u88AB\u653E\u9010\u7684\u73A9\u5BB6\uFF1A${state.last_day_exile}`);
  if (state.speech_history?.length > 0) sections.push(formatSpeechHistory(state.speech_history));
  if (state.phase === "day_voting" && state.current_votes) sections.push(formatCurrentVotes(state.current_votes));
  if (state.phase === "day_discussion" && state.current_speaker) sections.push(`\u5F53\u524D\u53D1\u8A00\u8005\uFF1A${state.current_speaker}`);
  if (state.phase === "hunter_shoot" && state.hunter_pending) sections.push(`\u730E\u4EBA ${state.hunter_pending} \u6B63\u5728\u51B3\u5B9A\u662F\u5426\u5F00\u67AA`);
  if (state.phase === "last_words" && state.last_words_pending) {
    const players = Array.isArray(state.last_words_pending) ? state.last_words_pending.join("\u3001") : state.last_words_pending;
    sections.push(`\u7B49\u5F85\u4EE5\u4E0B\u73A9\u5BB6\u53D1\u8868\u9057\u8A00\uFF1A${players}`);
  }
  return sections.filter(Boolean).join("\n\n");
}
__name(formatGlobalInfo, "formatGlobalInfo");
function formatGamePhase(state) {
  const day = state.day || 1;
  switch (state.phase) {
    case "night":
      return `\u7B2C ${day} \u591C - ${formatNightSubPhaseLabel(state.night_sub_phase)}`;
    case "day_discussion":
      return `\u7B2C ${day} \u5929 - \u767D\u5929\u8BA8\u8BBA\u9636\u6BB5`;
    case "day_voting":
      return `\u7B2C ${day} \u5929 - \u516C\u6295\u653E\u9010\u9636\u6BB5`;
    case "last_words":
      return `\u7B2C ${day} \u5929 - \u9057\u8A00\u9636\u6BB5`;
    case "hunter_shoot":
      return `\u7B2C ${day} \u5929 - \u730E\u4EBA\u5F00\u67AA\u9636\u6BB5`;
    case "game_over":
      return "\u6E38\u620F\u7ED3\u675F";
    default:
      return `\u7B2C ${day} \u5929`;
  }
}
__name(formatGamePhase, "formatGamePhase");
function formatNightSubPhaseLabel(subPhase) {
  const labels = {
    guard: "\u5B88\u536B\u5B88\u62A4",
    werewolf: "\u72FC\u4EBA\u51FB\u6740",
    seer: "\u9884\u8A00\u5BB6\u67E5\u9A8C",
    witch: "\u5973\u5DEB\u7528\u836F"
  };
  return subPhase ? labels[subPhase] || "\u591C\u665A\u884C\u52A8" : "\u591C\u665A\u9636\u6BB5";
}
__name(formatNightSubPhaseLabel, "formatNightSubPhaseLabel");
function formatAliveStatus(state, lastWords = []) {
  const sections = [];
  if (Array.isArray(state.alive_players)) {
    sections.push(`\u5B58\u6D3B\u73A9\u5BB6\uFF08${state.alive_players.length}\u4EBA\uFF09\uFF1A${state.alive_players.join("\u3001")}`);
  }
  if (state.dead_players && Object.keys(state.dead_players).length > 0) {
    const lastWordsMap = /* @__PURE__ */ new Map();
    lastWords.forEach((words) => lastWordsMap.set(words.speaker, words.content));
    const deadInfoLines = [];
    Object.entries(state.dead_players).forEach(([player, identity]) => {
      const identityStr = translateIdentity(identity);
      const lastWord = lastWordsMap.get(player);
      if (lastWord) deadInfoLines.push(`- ${player}\uFF08${identityStr}\uFF09\u9057\u8A00\uFF1A"${lastWord}"`);
      else deadInfoLines.push(`- ${player}\uFF08${identityStr}\uFF09`);
    });
    sections.push(`\u5DF2\u51FA\u5C40\u73A9\u5BB6\uFF1A
${deadInfoLines.join("\n")}`);
  }
  return sections.join("\n");
}
__name(formatAliveStatus, "formatAliveStatus");
function formatLastNightDeaths(deaths) {
  if (deaths.length === 0) return "\u6628\u665A\u662F\u5E73\u5B89\u591C\uFF0C\u65E0\u4EBA\u6B7B\u4EA1";
  return `\u6628\u665A\u6B7B\u4EA1\u7684\u73A9\u5BB6\uFF1A${deaths.map((death) => death.victim).join("\u3001")}`;
}
__name(formatLastNightDeaths, "formatLastNightDeaths");
function formatSpeechHistory(speeches) {
  const lines = speeches.map((speech, index) => `${index + 1}. ${speech.speaker}\uFF1A${speech.content}`);
  return `\u4ECA\u65E5\u53D1\u8A00\u8BB0\u5F55\uFF1A
${lines.join("\n")}`;
}
__name(formatSpeechHistory, "formatSpeechHistory");
function formatCurrentVotes(votes) {
  if (Object.keys(votes).length === 0) return "\u5F53\u524D\u8FD8\u6CA1\u6709\u73A9\u5BB6\u6295\u7968";
  const voteCount = {};
  for (const [voter, target] of Object.entries(votes)) {
    if (!voteCount[target]) voteCount[target] = [];
    voteCount[target].push(voter);
  }
  const lines = Object.entries(voteCount).sort((a, b) => b[1].length - a[1].length).map(([target, voters]) => `- ${target}\uFF08${voters.length}\u7968\uFF09\uFF1A${voters.join("\u3001")}`);
  return `\u5F53\u524D\u6295\u7968\u60C5\u51B5\uFF1A
${lines.join("\n")}`;
}
__name(formatCurrentVotes, "formatCurrentVotes");
function formatPerspectiveInfo(state) {
  if (state.all_identities) return formatSpectatorInfo(state);
  if (!state.my_role_id) return "";
  if (state.teammates !== void 0) return formatWerewolfInfo(state);
  if (state.seer_checks !== void 0) return formatSeerInfo(state);
  if (state.antidote_available !== void 0 || state.poison_available !== void 0) return formatWitchInfo(state);
  if (state.last_guard_target !== void 0) return formatGuardInfo(state);
  if (state.can_shoot !== void 0) return formatHunterInfo(state);
  return "\u4F60\u662F\u5E73\u6C11\uFF0C\u6CA1\u6709\u7279\u6B8A\u6280\u80FD\uFF0C\u4F46\u4F60\u53EF\u4EE5\u901A\u8FC7\u89C2\u5BDF\u548C\u63A8\u7406\u5E2E\u52A9\u597D\u4EBA\u9635\u8425\u627E\u51FA\u72FC\u4EBA\u3002";
}
__name(formatPerspectiveInfo, "formatPerspectiveInfo");
function formatSpectatorInfo(state) {
  const sections = ["\u3010\u89C2\u6218\u6A21\u5F0F - \u5168\u77E5\u89C6\u89D2\u3011"];
  if (state.all_identities) {
    const identityList = Object.entries(state.all_identities).map(([player, identity]) => `${player}: ${translateIdentity(identity)}`).join("\u3001");
    sections.push(`\u73A9\u5BB6\u8EAB\u4EFD\uFF1A${identityList}`);
  }
  if (state.pending_roles?.length > 0) sections.push(`\u5F85\u884C\u52A8\u89D2\u8272\uFF1A${state.pending_roles.join("\u3001")}`);
  return sections.join("\n");
}
__name(formatSpectatorInfo, "formatSpectatorInfo");
function formatWerewolfInfo(state) {
  const teammates = Array.isArray(state.teammates) && state.teammates.length > 0 ? state.teammates.join("\u3001") : "\u65E0";
  return `\u3010\u4F60\u7684\u8EAB\u4EFD\uFF1A\u72FC\u4EBA\u3011
\u72FC\u4EBA\u961F\u53CB\uFF1A${teammates}`;
}
__name(formatWerewolfInfo, "formatWerewolfInfo");
function formatSeerInfo(state) {
  const checks = (state.seer_checks || []).map((check) => `- \u7B2C${check.night}\u591C\u67E5\u9A8C ${check.target}\uFF1A${check.result === "werewolf" ? "\u72FC\u4EBA" : "\u597D\u4EBA"}`).join("\n");
  return `\u3010\u4F60\u7684\u8EAB\u4EFD\uFF1A\u9884\u8A00\u5BB6\u3011
${checks || "\u4F60\u8FD8\u6CA1\u6709\u67E5\u9A8C\u8BB0\u5F55\u3002"}`;
}
__name(formatSeerInfo, "formatSeerInfo");
function formatWitchInfo(state) {
  return `\u3010\u4F60\u7684\u8EAB\u4EFD\uFF1A\u5973\u5DEB\u3011
\u89E3\u836F\uFF1A${state.antidote_available ? "\u53EF\u7528" : "\u5DF2\u4F7F\u7528"}
\u6BD2\u836F\uFF1A${state.poison_available ? "\u53EF\u7528" : "\u5DF2\u4F7F\u7528"}`;
}
__name(formatWitchInfo, "formatWitchInfo");
function formatGuardInfo(state) {
  return `\u3010\u4F60\u7684\u8EAB\u4EFD\uFF1A\u5B88\u536B\u3011
\u4E0A\u6B21\u5B88\u62A4\uFF1A${state.last_guard_target || "\u65E0"}`;
}
__name(formatGuardInfo, "formatGuardInfo");
function formatHunterInfo(state) {
  return `\u3010\u4F60\u7684\u8EAB\u4EFD\uFF1A\u730E\u4EBA\u3011
\u6280\u80FD\uFF1A${state.can_shoot ? "\u53EF\u53D1\u52A8" : "\u4E0D\u53EF\u53D1\u52A8"}`;
}
__name(formatHunterInfo, "formatHunterInfo");
function translateIdentity(identity) {
  const labels = {
    werewolf: "\u72FC\u4EBA",
    seer: "\u9884\u8A00\u5BB6",
    witch: "\u5973\u5DEB",
    hunter: "\u730E\u4EBA",
    guard: "\u5B88\u536B",
    villager: "\u5E73\u6C11"
  };
  return labels[identity] || identity;
}
__name(translateIdentity, "translateIdentity");

// ../logic/action-prompts.json
var action_prompts_default = {
  night: {
    guard: {
      prompt: "\u73B0\u5728\u662F\u5B88\u536B\u884C\u52A8\u9636\u6BB5\u3002\u4F60\u53EF\u4EE5\u9009\u62E9\u5B88\u62A4\u4E00\u540D\u73A9\u5BB6\u3002\u6CE8\u610F\uFF1A\u4F60\u4E0D\u80FD\u8FDE\u7EED\u4E24\u665A\u5B88\u62A4\u540C\u4E00\u540D\u73A9\u5BB6\u3002"
    },
    werewolf: {
      prompt: "\u73B0\u5728\u662F\u72FC\u4EBA\u884C\u52A8\u9636\u6BB5\u3002\u8BF7\u4E0E\u961F\u53CB\u534F\u5546\u5E76\u9009\u62E9\u88AD\u51FB\u76EE\u6807\uFF0C\u6216\u51B3\u5B9A\u7A7A\u5200\u3002"
    },
    seer: {
      prompt: "\u73B0\u5728\u662F\u9884\u8A00\u5BB6\u67E5\u9A8C\u9636\u6BB5\u3002\u8BF7\u9009\u62E9\u4F60\u8981\u67E5\u9A8C\u7684\u73A9\u5BB6\u3002"
    },
    witch: {
      prompt: "\u73B0\u5728\u662F\u5973\u5DEB\u7528\u836F\u9636\u6BB5\u3002\u4F60\u53EF\u4EE5\u4F7F\u7528\u89E3\u836F\u6216\u6BD2\u836F\uFF08\u5404\u9650\u4E00\u6B21\uFF09\u3002"
    }
  },
  day_discussion: {
    default: {
      prompt: "\u73B0\u5728\u662F\u767D\u5929\u8BA8\u8BBA\u9636\u6BB5\u3002\u8BF7\u7ED9\u51FA\u4F60\u7684\u5206\u6790\u3001\u7AD9\u8FB9\u548C\u6295\u7968\u5EFA\u8BAE\u3002"
    }
  },
  day_voting: {
    default: {
      prompt: "\u73B0\u5728\u662F\u767D\u5929\u6295\u7968\u9636\u6BB5\u3002\u8BF7\u9009\u62E9\u4F60\u8981\u653E\u9010\u7684\u73A9\u5BB6\uFF0C\u6216\u5F03\u7968\u3002"
    }
  },
  last_words: {
    default: {
      prompt: "\u4F60\u5DF2\u7ECF\u51FA\u5C40\u3002\u73B0\u5728\u8BF7\u53D1\u8868\u9057\u8A00\u3002"
    }
  },
  hunter_shoot: {
    default: {
      prompt: "\u4F60\u662F\u730E\u4EBA\uFF0C\u5DF2\u51FA\u5C40\u3002\u4F60\u53EF\u4EE5\u9009\u62E9\u5F00\u67AA\u5E26\u8D70\u4E00\u540D\u73A9\u5BB6\uFF0C\u6216\u4E0D\u5F00\u67AA\u3002"
    }
  }
};

// ../logic/perspective.ts
function toRolePerspective(state, roleId, wholeHistory, diffHistory, getLegalActionsCallback, isSpectatorFn) {
  const knownIdentity = state.identities[roleId] ?? null;
  const isSpectator2 = isSpectatorFn(roleId) || knownIdentity === null;
  const identity = isSpectator2 ? null : knownIdentity;
  const isAlive = identity ? state.alive[roleId] : false;
  const isHunterShooting = state.phase === "hunter_shoot" && state.pendingRoles[0] === roleId;
  const isGivingLastWords = state.phase === "last_words" && state.pendingRoles.includes(roleId);
  const isDeadButActive = isHunterShooting || isGivingLastWords;
  const isCurrent = !isSpectator2 && (isAlive || isDeadButActive) && state.pendingRoles[0] === roleId;
  const baseState = {
    phase: state.phase,
    day: state.day,
    night_sub_phase: state.phase === "night" ? state.nightSubPhase : null,
    alive_players: getAlivePlayers(state),
    dead_players: state.dead_players,
    alive_identity: state.alive_identity,
    last_night_deaths: state.lastNightDeaths.map(({ cause, ...rest }) => rest),
    last_day_exile: state.lastDayExile
  };
  if (!isSpectator2) baseState.my_role_id = roleId;
  if (state.phase === "day_discussion") baseState.current_speaker = state.pendingRoles[0] ?? null;
  if (state.phase === "day_voting") baseState.current_votes = state.currentDayVotes;
  if (state.phase === "hunter_shoot") baseState.hunter_pending = state.pendingRoles[0] ?? null;
  if (state.phase === "last_words") baseState.last_words_pending = state.pendingRoles;
  const todaySpeeches = state.speechHistory.filter((record) => record.day === state.day);
  if (todaySpeeches.length > 0) baseState.speech_history = todaySpeeches.map(({ timestamp, ...rest }) => rest);
  if (state.lastWordsHistory.length > 0) baseState.last_words_history = state.lastWordsHistory;
  if (isSpectator2) baseState.pending_roles = state.pendingRoles;
  const identityInfo = getIdentitySpecificState(state, roleId, identity, isSpectator2);
  const currentState = { ...baseState, ...identityInfo };
  const needActionSpace = !isSpectator2 && (isAlive || isDeadButActive);
  const actionSpace = needActionSpace ? getLegalActionsCallback(state, roleId) : { actions: [] };
  return {
    global_rules: WEREWOLF_RULES,
    whole_history: wholeHistory,
    diff_history: diffHistory,
    current_state: currentState,
    your_role: {
      identity: isSpectator2 ? "Spectator (\u89C2\u6218\u8005)" : describeIdentity(identity),
      goal: isSpectator2 ? "\u89C2\u770B\u5BF9\u5C40\uFF0C\u5B66\u4E60\u63A8\u7406\u4E0E\u535A\u5F08\u7B56\u7565\u3002" : describeGoal(identity),
      is_current: isCurrent
    },
    action_space_definition: actionSpace,
    message: buildPerspectiveMessage(state, identity, isAlive, isSpectator2, isCurrent)
  };
}
__name(toRolePerspective, "toRolePerspective");
function generateStatePrompt(perspective) {
  const { global_rules, current_state, your_role } = perspective;
  const roleIdText = current_state.my_role_id ? `ID: ${current_state.my_role_id}
` : "";
  const formattedState = formatStateToNaturalLanguage(current_state);
  const sections = [];
  sections.push(`# \u6E38\u620F\u89C4\u5219
${global_rules}`);
  sections.push(`# \u4F60\u7684\u8EAB\u4EFD
${roleIdText}\u89D2\u8272: ${your_role.identity}
\u76EE\u6807: ${your_role.goal}
${your_role.is_current ? "**\u73B0\u5728\u8F6E\u5230\u4F60\u884C\u52A8**" : "(\u76EE\u524D\u4E0D\u662F\u4F60\u7684\u56DE\u5408)"}`);
  if (formattedState.globalInfo) sections.push(`# \u5168\u5C40\u4FE1\u606F\uFF08\u516C\u5F00\u4FE1\u606F\uFF09
${formattedState.globalInfo}`);
  if (formattedState.perspectiveInfo) sections.push(`# \u4F60\u7684\u89C6\u89D2\u4FE1\u606F\uFF08\u79C1\u6709\u4FE1\u606F\uFF09
${formattedState.perspectiveInfo}`);
  const actionPrompt = getActionPrompt(perspective);
  if (actionPrompt) sections.push(`# \u884C\u52A8\u63D0\u793A
${actionPrompt}`);
  return sections.join("\n\n");
}
__name(generateStatePrompt, "generateStatePrompt");
function getActionPrompt(perspective) {
  const { current_state, action_space_definition } = perspective;
  if (!action_space_definition.actions || action_space_definition.actions.length === 0) return null;
  if (!current_state.my_role_id) return null;
  const phase = current_state.phase;
  const nightSubPhase = current_state.night_sub_phase;
  if (phase === "night" && nightSubPhase) return action_prompts_default.night?.[nightSubPhase]?.prompt || null;
  return action_prompts_default[phase]?.default?.prompt || null;
}
__name(getActionPrompt, "getActionPrompt");
function getIdentitySpecificState(state, roleId, identity, isSpectator2) {
  if (state.phase === "game_over") {
    return {
      all_identities: state.identities,
      night_history: state.nightHistory,
      vote_history: state.voteHistory,
      death_history: state.deathHistory,
      current_night_actions: state.currentNightActions
    };
  }
  if (isSpectator2) {
    return {
      all_identities: state.identities,
      night_history: state.nightHistory,
      vote_history: state.voteHistory,
      death_history: state.deathHistory,
      current_night_actions: state.currentNightActions
    };
  }
  if (!identity) return {};
  switch (identity) {
    case "werewolf":
      return {
        teammates: getWerewolfTeammates(state, roleId),
        werewolf_votes: state.currentNightActions.werewolf_votes,
        werewolf_target: state.currentNightActions.werewolf_target
      };
    case "seer":
      return {
        seer_checks: getSeerHistory(state),
        last_check: state.currentNightActions.seer_target ? { target: state.currentNightActions.seer_target, result: state.currentNightActions.seer_result } : null
      };
    case "witch":
      return {
        antidote_available: !state.witchPotions.antidote_used,
        poison_available: !state.witchPotions.poison_used,
        tonight_werewolf_target: state.currentNightActions.werewolf_target,
        tonight_poison_target: state.currentNightActions.witch_poison_target
      };
    case "guard":
      return { last_guard_target: state.lastGuardTarget };
    case "hunter":
      return { can_shoot: state.hunterCanShoot, is_alive: state.hunterAlive };
    default:
      return {};
  }
}
__name(getIdentitySpecificState, "getIdentitySpecificState");
function describeIdentity(identity) {
  const labels = {
    werewolf: "\u72FC\u4EBA",
    seer: "\u9884\u8A00\u5BB6",
    witch: "\u5973\u5DEB",
    hunter: "\u730E\u4EBA",
    guard: "\u5B88\u536B",
    villager: "\u5E73\u6C11"
  };
  return labels[identity];
}
__name(describeIdentity, "describeIdentity");
function describeGoal(identity) {
  switch (identity) {
    case "werewolf":
      return "\u9690\u85CF\u8EAB\u4EFD\uFF0C\u4E0E\u72FC\u961F\u53CB\u534F\u4F5C\u51FB\u6740\u6240\u6709\u597D\u4EBA\u9635\u8425\u89D2\u8272\u3002";
    case "seer":
      return "\u591C\u665A\u67E5\u9A8C\u73A9\u5BB6\u8EAB\u4EFD\uFF0C\u5C06\u7ED3\u8BBA\u4F20\u9012\u7ED9\u597D\u4EBA\u9635\u8425\u5E76\u627E\u51FA\u72FC\u4EBA\u3002";
    case "witch":
      return "\u5408\u7406\u4F7F\u7528\u89E3\u836F\u4E0E\u6BD2\u836F\uFF0C\u5B88\u62A4\u540C\u9635\u8425\u5E76\u60E9\u7F5A\u72FC\u4EBA\u3002";
    case "hunter":
      return "\u5373\u4FBF\u9635\u4EA1\u4E5F\u8981\u9009\u62E9\u5408\u9002\u76EE\u6807\u5E26\u8D70\uFF0C\u5E2E\u52A9\u597D\u4EBA\u9635\u8425\u3002";
    case "guard":
      return "\u591C\u665A\u5B88\u62A4\u5173\u952E\u89D2\u8272\uFF0C\u907F\u514D\u72FC\u4EBA\u5C60\u6740\u6838\u5FC3\u529B\u91CF\u3002";
    case "villager":
      return "\u901A\u8FC7\u53D1\u8A00\u548C\u6295\u7968\u8FA8\u522B\u72FC\u4EBA\uFF0C\u4E0E\u795E\u804C\u534F\u540C\u5B88\u62A4\u6751\u5E84\u3002";
    default:
      return "\u5E2E\u52A9\u5DF1\u65B9\u9635\u8425\u53D6\u5F97\u80DC\u5229\u3002";
  }
}
__name(describeGoal, "describeGoal");
function getCampLabel(camp) {
  if (camp === "werewolf") return "\u72FC\u4EBA\u9635\u8425";
  if (camp === "villager") return "\u597D\u4EBA\u9635\u8425";
  return "\u672A\u77E5\u9635\u8425";
}
__name(getCampLabel, "getCampLabel");
function buildPerspectiveMessage(state, identity, isAlive, isSpectator2, isCurrent) {
  if (state.phase === "game_over") {
    const campLabel = getCampLabel(state.winner);
    if (isSpectator2 || !identity) return `\u{1F440} \u89C2\u6218\u6A21\u5F0F - ${campLabel}\u83B7\u80DC`;
    const myCamp = getCamp(identity);
    if (state.winner && myCamp === state.winner) return `\u{1F389} \u6E38\u620F\u7ED3\u675F - ${campLabel}\u83B7\u80DC\uFF0C\u4F60\u7684\u9635\u8425\u53D6\u5F97\u80DC\u5229\uFF01`;
    return `\u{1F614} \u6E38\u620F\u7ED3\u675F - ${campLabel}\u83B7\u80DC\uFF0C\u4F60\u7684\u9635\u8425\u9057\u61BE\u843D\u8D25\u3002`;
  }
  if (isSpectator2) return buildSpectatorMessage(state);
  if (!isAlive) return "\u{1F480} \u4F60\u5DF2\u51FA\u5C40\uFF0C\u53EF\u4EE5\u7EE7\u7EED\u89C2\u6218\u5E76\u7B49\u5F85\u6E38\u620F\u7ED3\u679C\u3002";
  switch (state.phase) {
    case "night": {
      const label = formatNightSubPhase(state.nightSubPhase);
      return isCurrent ? `\u{1F319} \u7B2C${state.day}\u591C - ${label}\uFF0C\u8BF7\u7ACB\u5373\u884C\u52A8\u3002` : `\u{1F319} \u7B2C${state.day}\u591C - ${label}\u8FDB\u884C\u4E2D\uFF0C\u8BF7\u8010\u5FC3\u7B49\u5F85\u3002`;
    }
    case "day_discussion":
      return isCurrent ? `\u2600\uFE0F \u7B2C${state.day}\u5929 - \u8F6E\u5230\u4F60\u53D1\u8A00\uFF0C\u5206\u4EAB\u4F60\u7684\u5206\u6790\u3002` : `\u2600\uFE0F \u7B2C${state.day}\u5929 - \u7B49\u5F85\u5176\u4ED6\u73A9\u5BB6\u53D1\u8A00\u3002`;
    case "day_voting":
      return isCurrent ? `\u{1F5F3}\uFE0F \u7B2C${state.day}\u5929 - \u8BF7\u6295\u7968\u51B3\u5B9A\u8981\u653E\u9010\u7684\u73A9\u5BB6\u3002` : `\u{1F5F3}\uFE0F \u7B2C${state.day}\u5929 - \u7B49\u5F85\u5176\u4ED6\u73A9\u5BB6\u5B8C\u6210\u6295\u7968\u3002`;
    case "last_words":
      return isCurrent ? "\u{1F4AC} \u4F60\u5373\u5C06\u9635\u4EA1\uFF0C\u8BF7\u53D1\u8868\u4F60\u7684\u9057\u8A00\u3002" : "\u{1F4AC} \u7B49\u5F85\u5373\u5C06\u9635\u4EA1\u7684\u73A9\u5BB6\u53D1\u8868\u9057\u8A00\u3002";
    case "hunter_shoot":
      return identity === "hunter" ? "\u{1F52B} \u4F60\u5DF2\u9635\u4EA1\uFF0C\u53EF\u4EE5\u9009\u62E9\u662F\u5426\u5E26\u8D70\u4E00\u540D\u73A9\u5BB6\u3002" : "\u{1F52B} \u730E\u4EBA\u5728\u884C\u52A8\uFF0C\u8BF7\u7A0D\u5019\u7247\u523B\u3002";
    default:
      return "\u23F3 \u7B49\u5F85\u6E38\u620F\u63A8\u8FDB\u3002";
  }
}
__name(buildPerspectiveMessage, "buildPerspectiveMessage");
function buildSpectatorMessage(state) {
  switch (state.phase) {
    case "night":
      return `\u{1F440} \u89C2\u6218\u6A21\u5F0F - \u7B2C${state.day}\u591C\uFF0C${formatNightSubPhase(state.nightSubPhase)}\u3002`;
    case "day_discussion":
      return `\u{1F440} \u89C2\u6218\u6A21\u5F0F - \u7B2C${state.day}\u5929\uFF0C\u8BA8\u8BBA\u9636\u6BB5\u3002`;
    case "day_voting":
      return `\u{1F440} \u89C2\u6218\u6A21\u5F0F - \u7B2C${state.day}\u5929\uFF0C\u6295\u7968\u9636\u6BB5\u3002`;
    case "last_words":
      return `\u{1F440} \u89C2\u6218\u6A21\u5F0F - \u7B2C${state.day}\u5929\uFF0C\u9057\u8A00\u9636\u6BB5\u3002`;
    case "hunter_shoot":
      return "\u{1F440} \u89C2\u6218\u6A21\u5F0F - \u730E\u4EBA\u6B63\u5728\u53D1\u52A8\u6280\u80FD\u3002";
    default:
      return "\u{1F440} \u89C2\u6218\u6A21\u5F0F - \u6E38\u620F\u8FDB\u884C\u4E2D\u3002";
  }
}
__name(buildSpectatorMessage, "buildSpectatorMessage");
function formatNightSubPhase(subPhase) {
  const labels = {
    guard: "\u5B88\u536B\u884C\u52A8",
    werewolf: "\u72FC\u4EBA\u884C\u52A8",
    seer: "\u9884\u8A00\u5BB6\u67E5\u9A8C",
    witch: "\u5973\u5DEB\u7528\u836F"
  };
  if (!subPhase) return "\u591C\u665A\u9636\u6BB5";
  return labels[subPhase];
}
__name(formatNightSubPhase, "formatNightSubPhase");

// ../logic/index.ts
var WerewolfLogic = class {
  static {
    __name(this, "WerewolfLogic");
  }
  getMetadata() {
    const metadata = {
      id: "werewolf",
      name: "\u72FC\u4EBA\u6740 (Werewolf)",
      description: "\u7ECF\u5178\u72FC\u4EBA\u6740\uFF1A\u72FC\u4EBA\u9635\u8425\u4E0E\u597D\u4EBA\u9635\u8425\u7684\u63A8\u7406\u535A\u5F08\uFF0C\u5305\u542B\u9884\u8A00\u5BB6\u3001\u5973\u5DEB\u3001\u730E\u4EBA\u3001\u5B88\u536B\u7B49\u89D2\u8272\u3002",
      minPlayers: 6,
      maxPlayers: 12,
      roleIds: PLAYER_ROLE_IDS_BY_COUNT,
      enable_llm_memory: true,
      getStatusText: /* @__PURE__ */ __name((perspective) => {
        const current = perspective.current_state;
        if (current?.winner) return `\u6E38\u620F\u7ED3\u675F - ${current.winner === "werewolf" ? "\u72FC\u4EBA\u9635\u8425" : "\u597D\u4EBA\u9635\u8425"}\u83B7\u80DC`;
        if (current?.phase === "night") {
          const subPhaseLabel = current?.nightSubPhase ? { guard: "\u5B88\u536B\u884C\u52A8", werewolf: "\u72FC\u4EBA\u884C\u52A8", seer: "\u9884\u8A00\u5BB6\u67E5\u9A8C", witch: "\u5973\u5DEB\u7528\u836F" }[current.nightSubPhase] ?? "\u591C\u665A\u9636\u6BB5" : "\u591C\u665A\u9636\u6BB5";
          return `\u7B2C ${current?.day ?? 1} \u591C - ${subPhaseLabel}`;
        }
        if (current?.phase === "day_discussion") return `\u7B2C ${current?.day ?? 1} \u5929 - \u767D\u5929\u8BA8\u8BBA`;
        if (current?.phase === "day_voting") return `\u7B2C ${current?.day ?? 1} \u5929 - \u516C\u6295\u653E\u9010`;
        if (current?.phase === "last_words") return `\u7B2C ${current?.day ?? 1} \u5929 - \u9057\u8A00\u9636\u6BB5`;
        if (current?.phase === "hunter_shoot") return `\u7B2C ${current?.day ?? 1} \u5929 - \u730E\u4EBA\u53D1\u52A8\u6280\u80FD`;
        return "\u72FC\u4EBA\u6740 - \u63A8\u7406\u8FDB\u884C\u4E2D";
      }, "getStatusText")
    };
    return { ...metadata, playerCountLabels: PLAYER_COUNT_LABELS };
  }
  initState(ctx) {
    const playerCount = ctx.players.length;
    if (!PLAYER_COUNT_RANGE.includes(playerCount)) {
      throw new Error(`\u72FC\u4EBA\u6740\u6682\u4E0D\u652F\u6301 ${playerCount} \u4EBA\u5C40`);
    }
    const expectedSeats = PLAYER_ROLE_IDS_BY_COUNT[playerCount]?.length ?? playerCount;
    if (ctx.players.length !== expectedSeats) {
      throw new Error(`\u521D\u59CB\u5316\u73A9\u5BB6\u6570\u91CF\u4E0E\u5EA7\u4F4D\u914D\u7F6E\u4E0D\u5339\u914D\uFF08\u671F\u671B ${expectedSeats}\uFF0C\u5B9E\u9645 ${ctx.players.length}\uFF09`);
    }
    const availableIdentities = ROLE_DISTRIBUTIONS[playerCount];
    if (!availableIdentities || availableIdentities.length !== playerCount) {
      throw new Error(`\u7F3A\u5C11 ${playerCount} \u4EBA\u5C40\u7684\u8EAB\u4EFD\u914D\u7F6E`);
    }
    const shuffledIdentities = shuffle(availableIdentities);
    const identities = {};
    ctx.players.forEach((playerId, index) => {
      identities[playerId] = shuffledIdentities[index];
    });
    const alive = Object.fromEntries(ctx.players.map((playerId) => [playerId, true]));
    const alive_identity = {
      werewolf: 0,
      seer: 0,
      witch: 0,
      hunter: 0,
      guard: 0,
      villager: 0
    };
    Object.values(identities).forEach((identity) => {
      alive_identity[identity] = (alive_identity[identity] || 0) + 1;
    });
    const state = {
      players: [...ctx.players],
      playerCount,
      identities,
      day: 1,
      phase: "night",
      nightSubPhase: getInitialNightSubPhase(identities),
      pendingRoles: [],
      alive,
      dead_players: {},
      alive_identity,
      currentNightActions: {
        guard_target: null,
        werewolf_votes: {},
        werewolf_target: null,
        seer_target: null,
        seer_result: null,
        witch_save: false,
        witch_poison_target: null
      },
      currentDayVotes: {},
      witchPotions: { antidote_used: false, poison_used: false },
      lastGuardTarget: null,
      hunterAlive: Object.values(identities).includes("hunter"),
      hunterCanShoot: true,
      deathHistory: [],
      nightHistory: [],
      voteHistory: [],
      speechHistory: [],
      lastNightDeaths: [],
      lastDayExile: null,
      hunterShootContext: null,
      lastWordsHistory: [],
      lastWordsContext: null,
      winner: null
    };
    this.ensurePendingRoles(state);
    return state;
  }
  getCurrentRole(state) {
    const s = state;
    if (s.phase === "game_over" || s.winner) return "__game_over__";
    return s.pendingRoles[0] ?? "__system__";
  }
  getLegalActions(state, roleId) {
    const s = state;
    if (s.phase === "game_over" || s.winner) return { actions: [] };
    if (s.pendingRoles[0] !== roleId) return { actions: [] };
    switch (s.phase) {
      case "night":
        return getNightLegalActions(s, roleId);
      case "day_discussion":
        return getDayDiscussionLegalActions();
      case "day_voting":
        return getDayVotingLegalActions(s);
      case "last_words":
        return {
          actions: [{
            action_id: "last_words",
            description: "\u53D1\u8868\u9057\u8A00",
            params_schema: { content: { type: "string", description: "\u8BF7\u8F93\u5165\u4F60\u7684\u9057\u8A00" } }
          }]
        };
      case "hunter_shoot":
        return getHunterLegalActions(s, roleId);
      default:
        return { actions: [] };
    }
  }
  applyAction(state, action) {
    const nextState = cloneState(state);
    this.ensurePendingRoles(nextState);
    if (nextState.phase === "game_over" || nextState.winner) {
      return { success: false, error: "\u6E38\u620F\u5DF2\u7ED3\u675F", errorCode: "GAME_FINISHED" };
    }
    const currentRole = nextState.pendingRoles[0];
    if (!currentRole) return { success: false, error: "\u5F53\u524D\u6CA1\u6709\u53EF\u884C\u52A8\u7684\u89D2\u8272", errorCode: "NO_AVAILABLE_ACTOR" };
    if (currentRole !== action.role_id) return { success: false, error: "\u4E0D\u662F\u4F60\u7684\u56DE\u5408", errorCode: "NOT_YOUR_TURN" };
    switch (nextState.phase) {
      case "night":
        return this.applyNightAction(nextState, action);
      case "day_discussion":
        return this.applyDayDiscussionAction(nextState, action);
      case "day_voting":
        return this.applyDayVotingAction(nextState, action);
      case "last_words":
        return this.applyLastWordsAction(nextState, action);
      case "hunter_shoot":
        return this.applyHunterAction(nextState, action);
      default:
        return { success: false, error: "\u672A\u77E5\u7684\u6E38\u620F\u9636\u6BB5", errorCode: "INVALID_PHASE" };
    }
  }
  isTerminal(state) {
    const s = state;
    return s.phase === "game_over" || s.winner !== null;
  }
  getWinners(state) {
    const s = state;
    if (!s.winner) return null;
    const winningCamp = s.winner;
    return s.players.filter((playerId) => getCamp(s.identities[playerId]) === winningCamp);
  }
  toRolePerspective(state, roleId, wholeHistory, diffHistory) {
    return toRolePerspective(
      state,
      roleId,
      wholeHistory,
      diffHistory,
      (s, rid) => this.getLegalActions(s, rid),
      isSpectator
    );
  }
  generateStatePrompt(perspective) {
    return generateStatePrompt(perspective);
  }
  ensurePendingRoles(state) {
    ensurePendingRoles(state, {
      prepareNightSubPhase: /* @__PURE__ */ __name((s, subPhase) => prepareNightSubPhase(s, subPhase), "prepareNightSubPhase"),
      resolveNight: /* @__PURE__ */ __name((s) => this.resolveNight(s), "resolveNight"),
      startDayVoting: /* @__PURE__ */ __name((s) => startDayVoting(s), "startDayVoting"),
      resolveDayVoting: /* @__PURE__ */ __name((s) => this.resolveDayVoting(s), "resolveDayVoting")
    });
  }
  resolveNight(state) {
    resolveNight(
      state,
      (s, deaths, resumePhase) => this.applyDeaths(s, deaths, resumePhase),
      (s) => startDayDiscussion(s)
    );
  }
  resolveDayVoting(state) {
    resolveDayVoting(
      state,
      (s, deaths, resumePhase) => this.applyDeaths(s, deaths, resumePhase),
      (s) => startNextNight(s)
    );
  }
  applyDeaths(state, deaths, resumePhaseIfHunter) {
    applyDeaths(state, deaths, resumePhaseIfHunter);
  }
  resumeAfterHunter(state, shotDeath) {
    resumeAfterHunter(
      state,
      shotDeath,
      (s, deaths, resumePhase) => this.applyDeaths(s, deaths, resumePhase),
      (s) => startDayDiscussion(s),
      (s) => startNextNight(s)
    );
  }
  applyNightAction(state, action) {
    const consumeActor = /* @__PURE__ */ __name((s) => consumeCurrentActor(s), "consumeActor");
    switch (state.nightSubPhase) {
      case "guard": {
        const result = applyGuardAction(state, action, consumeActor);
        if (result.success) this.finalizeAction(state);
        return result;
      }
      case "werewolf": {
        const result = applyWerewolfAction(state, action, consumeActor);
        if (result.success) this.finalizeAction(state);
        return result;
      }
      case "seer": {
        const result = applySeerAction(state, action, consumeActor);
        if (result.success) this.finalizeAction(state);
        return result;
      }
      case "witch": {
        const result = applyWitchAction(state, action, consumeActor);
        if (result.success) this.finalizeAction(state);
        return result;
      }
      default:
        return { success: false, error: "\u591C\u665A\u9636\u6BB5\u672A\u51C6\u5907\u597D", errorCode: "INVALID_PHASE" };
    }
  }
  applyDayDiscussionAction(state, action) {
    const result = applyDayDiscussionAction(state, action, (s) => consumeCurrentActor(s));
    if (result.success) this.finalizeAction(state);
    return result;
  }
  applyDayVotingAction(state, action) {
    const result = applyDayVotingAction(state, action, (s) => consumeCurrentActor(s));
    if (result.success) this.finalizeAction(state);
    return result;
  }
  applyLastWordsAction(state, action) {
    if (action.action_id !== "last_words") return { success: false, error: "\u65E0\u6548\u7684\u9057\u8A00\u884C\u52A8", errorCode: "INVALID_ACTION" };
    const content = action.params?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      return { success: false, error: "\u9057\u8A00\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A", errorCode: "INVALID_PARAMS" };
    }
    const context = state.lastWordsContext;
    if (!context) return { success: false, error: "\u5F53\u524D\u6CA1\u6709\u5F85\u53D1\u8868\u9057\u8A00\u7684\u73A9\u5BB6", errorCode: "NO_LAST_WORDS_CONTEXT" };
    const pendingDeath = context.pendingDeaths.find((d) => d.victim === action.role_id);
    if (!pendingDeath) return { success: false, error: "\u4F60\u4E0D\u5728\u5F85\u53D1\u8868\u9057\u8A00\u7684\u540D\u5355\u4E2D", errorCode: "NOT_IN_LAST_WORDS_LIST" };
    state.lastWordsHistory.push({ day: state.day, speaker: action.role_id, content, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    context.completedLastWords.push(action.role_id);
    consumeCurrentActor(state);
    if (state.pendingRoles.length === 0) this.resumeAfterLastWords(state);
    this.finalizeAction(state);
    return { success: true, nextState: state };
  }
  resumeAfterLastWords(state) {
    const context = state.lastWordsContext;
    if (!context) return;
    const deaths = context.pendingDeaths;
    const resumePhase = context.resumePhase;
    state.lastWordsContext = null;
    this.applyDeathsDirectly(state, deaths, resumePhase);
    if (state.phase !== "hunter_shoot") {
      if (resumePhase === "day_discussion") startDayDiscussion(state);
      else if (resumePhase === "night") startNextNight(state);
    }
  }
  applyDeathsDirectly(state, deaths, resumePhaseIfHunter) {
    for (let i = 0; i < deaths.length; i += 1) {
      const record = deaths[i];
      const victim = record.victim;
      if (!state.alive[victim]) continue;
      state.alive[victim] = false;
      const victimIdentity = state.identities[victim];
      state.dead_players[victim] = victimIdentity;
      state.alive_identity[victimIdentity] = Math.max(0, (state.alive_identity[victimIdentity] || 0) - 1);
      state.deathHistory.push(record);
      if (state.identities[victim] === "hunter") {
        state.hunterAlive = false;
        if (record.cause === "poison") state.hunterCanShoot = false;
        if (state.hunterCanShoot && record.cause !== "poison") {
          state.phase = "hunter_shoot";
          state.pendingRoles = [victim];
          state.hunterShootContext = { resumePhase: resumePhaseIfHunter, queuedDeaths: deaths.slice(i + 1) };
          return;
        }
      }
    }
    state.pendingRoles = state.pendingRoles.filter((playerId) => state.alive[playerId]);
  }
  applyHunterAction(state, action) {
    const result = applyHunterAction(state, action, (s) => consumeCurrentActor(s));
    if (result.success) {
      this.resumeAfterHunter(state, result.shotDeath);
      this.finalizeAction(state);
      return { success: true, nextState: state };
    }
    return { success: false, error: result.error ?? "\u730E\u4EBA\u884C\u52A8\u5931\u8D25", errorCode: "HUNTER_ACTION_FAILED" };
  }
  finalizeAction(state) {
    this.ensurePendingRoles(state);
    if (state.phase !== "hunter_shoot" && state.phase !== "last_words") {
      updateWinnerIfNeeded(state);
    }
  }
};
var logic_default = new WerewolfLogic();

// src/index.ts
var app = new Hono2();
var WORKER_VERIFY_SIGNATURE = "NEXUS_GAME_WORKER_VERIFIED_V1";
app.use("/*", cors());
app.get("/game-ui.js", async (c) => {
  const url = new URL(c.req.url);
  url.pathname = "/_ui.js";
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  newResponse.headers.set("Content-Type", "application/javascript");
  return newResponse;
});
app.get("/style.css", async (c) => {
  const url = new URL(c.req.url);
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  newResponse.headers.set("Content-Type", "text/css");
  return newResponse;
});
app.get("/game-ui.html", async (c) => {
  const url = new URL(c.req.url);
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  newResponse.headers.set("Content-Type", "text/html");
  return newResponse;
});
app.get("/metadata", async (c) => {
  const metadata = await logic_default.getMetadata();
  const uiBaseUrl = c.env.UI_BASE_URL || new URL(c.req.url).origin;
  return c.json({
    ...metadata,
    ui: {
      mode: "url",
      url: `${uiBaseUrl}/game-ui.html`
    }
  });
});
app.get("/__nexus_worker_verify", (c) => {
  return c.text(WORKER_VERIFY_SIGNATURE, 200, {
    "Content-Type": "text/plain; charset=utf-8"
  });
});
app.post("/init", async (c) => {
  const body = await c.req.json();
  try {
    const state = await logic_default.initState(body);
    return c.json(state);
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});
app.post("/legal-actions", async (c) => {
  const body = await c.req.json();
  try {
    const actions = await logic_default.getLegalActions(body.state, body.roleId);
    return c.json(actions);
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});
app.post("/action", async (c) => {
  const body = await c.req.json();
  try {
    const result = await logic_default.applyAction(body.state, body.action);
    return c.json(result);
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});
app.post("/is-terminal", async (c) => {
  const body = await c.req.json();
  try {
    const isTerminal = await logic_default.isTerminal(body.state);
    const winners = isTerminal ? await logic_default.getWinners(body.state) : null;
    return c.json({ isTerminal, winners });
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});
app.post("/perspective", async (c) => {
  const body = await c.req.json();
  try {
    const perspective = await logic_default.toRolePerspective(
      body.state,
      body.roleId,
      body.wholeHistory || [],
      body.diffHistory || []
    );
    let statePrompt;
    if (typeof logic_default.generateStatePrompt === "function") {
      statePrompt = logic_default.generateStatePrompt(perspective);
    }
    return c.json({ ...perspective, statePrompt });
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});
app.post("/current-role", async (c) => {
  const body = await c.req.json();
  try {
    const roleId = await logic_default.getCurrentRole(body.state);
    return c.json({ roleId });
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});
var src_default = app;

// ../../../node_modules/.pnpm/wrangler@4.65.0_@cloudflare+workers-types@4.20260213.0/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../node_modules/.pnpm/wrangler@4.65.0_@cloudflare+workers-types@4.20260213.0/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-gOS1K0/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../node_modules/.pnpm/wrangler@4.65.0_@cloudflare+workers-types@4.20260213.0/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-gOS1K0/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
