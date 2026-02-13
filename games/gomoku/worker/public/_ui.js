var T = { exports: {} }, E = {}, L = { exports: {} }, n = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var k = Symbol.for("react.element"), Y = Symbol.for("react.portal"), K = Symbol.for("react.fragment"), Q = Symbol.for("react.strict_mode"), X = Symbol.for("react.profiler"), Z = Symbol.for("react.provider"), ee = Symbol.for("react.context"), te = Symbol.for("react.forward_ref"), re = Symbol.for("react.suspense"), ne = Symbol.for("react.memo"), oe = Symbol.for("react.lazy"), P = Symbol.iterator;
function ue(e) {
  return e === null || typeof e != "object" ? null : (e = P && e[P] || e["@@iterator"], typeof e == "function" ? e : null);
}
var U = { isMounted: function() {
  return !1;
}, enqueueForceUpdate: function() {
}, enqueueReplaceState: function() {
}, enqueueSetState: function() {
} }, D = Object.assign, I = {};
function h(e, t, o) {
  this.props = e, this.context = t, this.refs = I, this.updater = o || U;
}
h.prototype.isReactComponent = {};
h.prototype.setState = function(e, t) {
  if (typeof e != "object" && typeof e != "function" && e != null) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
  this.updater.enqueueSetState(this, e, t, "setState");
};
h.prototype.forceUpdate = function(e) {
  this.updater.enqueueForceUpdate(this, e, "forceUpdate");
};
function F() {
}
F.prototype = h.prototype;
function j(e, t, o) {
  this.props = e, this.context = t, this.refs = I, this.updater = o || U;
}
var w = j.prototype = new F();
w.constructor = j;
D(w, h.prototype);
w.isPureReactComponent = !0;
var N = Array.isArray, V = Object.prototype.hasOwnProperty, C = { current: null }, q = { key: !0, ref: !0, __self: !0, __source: !0 };
function B(e, t, o) {
  var r, u = {}, s = null, i = null;
  if (t != null) for (r in t.ref !== void 0 && (i = t.ref), t.key !== void 0 && (s = "" + t.key), t) V.call(t, r) && !q.hasOwnProperty(r) && (u[r] = t[r]);
  var l = arguments.length - 2;
  if (l === 1) u.children = o;
  else if (1 < l) {
    for (var c = Array(l), y = 0; y < l; y++) c[y] = arguments[y + 2];
    u.children = c;
  }
  if (e && e.defaultProps) for (r in l = e.defaultProps, l) u[r] === void 0 && (u[r] = l[r]);
  return { $$typeof: k, type: e, key: s, ref: i, props: u, _owner: C.current };
}
function se(e, t) {
  return { $$typeof: k, type: e.type, key: t, ref: e.ref, props: e.props, _owner: e._owner };
}
function g(e) {
  return typeof e == "object" && e !== null && e.$$typeof === k;
}
function ie(e) {
  var t = { "=": "=0", ":": "=2" };
  return "$" + e.replace(/[=:]/g, function(o) {
    return t[o];
  });
}
var A = /\/+/g;
function R(e, t) {
  return typeof e == "object" && e !== null && e.key != null ? ie("" + e.key) : t.toString(36);
}
function S(e, t, o, r, u) {
  var s = typeof e;
  (s === "undefined" || s === "boolean") && (e = null);
  var i = !1;
  if (e === null) i = !0;
  else switch (s) {
    case "string":
    case "number":
      i = !0;
      break;
    case "object":
      switch (e.$$typeof) {
        case k:
        case Y:
          i = !0;
      }
  }
  if (i) return i = e, u = u(i), e = r === "" ? "." + R(i, 0) : r, N(u) ? (o = "", e != null && (o = e.replace(A, "$&/") + "/"), S(u, t, o, "", function(y) {
    return y;
  })) : u != null && (g(u) && (u = se(u, o + (!u.key || i && i.key === u.key ? "" : ("" + u.key).replace(A, "$&/") + "/") + e)), t.push(u)), 1;
  if (i = 0, r = r === "" ? "." : r + ":", N(e)) for (var l = 0; l < e.length; l++) {
    s = e[l];
    var c = r + R(s, l);
    i += S(s, t, o, c, u);
  }
  else if (c = ue(e), typeof c == "function") for (e = c.call(e), l = 0; !(s = e.next()).done; ) s = s.value, c = r + R(s, l++), i += S(s, t, o, c, u);
  else if (s === "object") throw t = String(e), Error("Objects are not valid as a React child (found: " + (t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t) + "). If you meant to render a collection of children, use an array instead.");
  return i;
}
function b(e, t, o) {
  if (e == null) return e;
  var r = [], u = 0;
  return S(e, r, "", "", function(s) {
    return t.call(o, s, u++);
  }), r;
}
function ce(e) {
  if (e._status === -1) {
    var t = e._result;
    t = t(), t.then(function(o) {
      (e._status === 0 || e._status === -1) && (e._status = 1, e._result = o);
    }, function(o) {
      (e._status === 0 || e._status === -1) && (e._status = 2, e._result = o);
    }), e._status === -1 && (e._status = 0, e._result = t);
  }
  if (e._status === 1) return e._result.default;
  throw e._result;
}
var p = { current: null }, x = { transition: null }, le = { ReactCurrentDispatcher: p, ReactCurrentBatchConfig: x, ReactCurrentOwner: C };
function M() {
  throw Error("act(...) is not supported in production builds of React.");
}
n.Children = { map: b, forEach: function(e, t, o) {
  b(e, function() {
    t.apply(this, arguments);
  }, o);
}, count: function(e) {
  var t = 0;
  return b(e, function() {
    t++;
  }), t;
}, toArray: function(e) {
  return b(e, function(t) {
    return t;
  }) || [];
}, only: function(e) {
  if (!g(e)) throw Error("React.Children.only expected to receive a single React element child.");
  return e;
} };
n.Component = h;
n.Fragment = K;
n.Profiler = X;
n.PureComponent = j;
n.StrictMode = Q;
n.Suspense = re;
n.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = le;
n.act = M;
n.cloneElement = function(e, t, o) {
  if (e == null) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + e + ".");
  var r = D({}, e.props), u = e.key, s = e.ref, i = e._owner;
  if (t != null) {
    if (t.ref !== void 0 && (s = t.ref, i = C.current), t.key !== void 0 && (u = "" + t.key), e.type && e.type.defaultProps) var l = e.type.defaultProps;
    for (c in t) V.call(t, c) && !q.hasOwnProperty(c) && (r[c] = t[c] === void 0 && l !== void 0 ? l[c] : t[c]);
  }
  var c = arguments.length - 2;
  if (c === 1) r.children = o;
  else if (1 < c) {
    l = Array(c);
    for (var y = 0; y < c; y++) l[y] = arguments[y + 2];
    r.children = l;
  }
  return { $$typeof: k, type: e.type, key: u, ref: s, props: r, _owner: i };
};
n.createContext = function(e) {
  return e = { $$typeof: ee, _currentValue: e, _currentValue2: e, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null }, e.Provider = { $$typeof: Z, _context: e }, e.Consumer = e;
};
n.createElement = B;
n.createFactory = function(e) {
  var t = B.bind(null, e);
  return t.type = e, t;
};
n.createRef = function() {
  return { current: null };
};
n.forwardRef = function(e) {
  return { $$typeof: te, render: e };
};
n.isValidElement = g;
n.lazy = function(e) {
  return { $$typeof: oe, _payload: { _status: -1, _result: e }, _init: ce };
};
n.memo = function(e, t) {
  return { $$typeof: ne, type: e, compare: t === void 0 ? null : t };
};
n.startTransition = function(e) {
  var t = x.transition;
  x.transition = {};
  try {
    e();
  } finally {
    x.transition = t;
  }
};
n.unstable_act = M;
n.useCallback = function(e, t) {
  return p.current.useCallback(e, t);
};
n.useContext = function(e) {
  return p.current.useContext(e);
};
n.useDebugValue = function() {
};
n.useDeferredValue = function(e) {
  return p.current.useDeferredValue(e);
};
n.useEffect = function(e, t) {
  return p.current.useEffect(e, t);
};
n.useId = function() {
  return p.current.useId();
};
n.useImperativeHandle = function(e, t, o) {
  return p.current.useImperativeHandle(e, t, o);
};
n.useInsertionEffect = function(e, t) {
  return p.current.useInsertionEffect(e, t);
};
n.useLayoutEffect = function(e, t) {
  return p.current.useLayoutEffect(e, t);
};
n.useMemo = function(e, t) {
  return p.current.useMemo(e, t);
};
n.useReducer = function(e, t, o) {
  return p.current.useReducer(e, t, o);
};
n.useRef = function(e) {
  return p.current.useRef(e);
};
n.useState = function(e) {
  return p.current.useState(e);
};
n.useSyncExternalStore = function(e, t, o) {
  return p.current.useSyncExternalStore(e, t, o);
};
n.useTransition = function() {
  return p.current.useTransition();
};
n.version = "18.3.1";
L.exports = n;
var ae = L.exports;
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var fe = ae, pe = Symbol.for("react.element"), ye = Symbol.for("react.fragment"), _e = Object.prototype.hasOwnProperty, de = fe.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, me = { key: !0, ref: !0, __self: !0, __source: !0 };
function W(e, t, o) {
  var r, u = {}, s = null, i = null;
  o !== void 0 && (s = "" + o), t.key !== void 0 && (s = "" + t.key), t.ref !== void 0 && (i = t.ref);
  for (r in t) _e.call(t, r) && !me.hasOwnProperty(r) && (u[r] = t[r]);
  if (e && e.defaultProps) for (r in t = e.defaultProps, t) u[r] === void 0 && (u[r] = t[r]);
  return { $$typeof: pe, type: e, key: s, ref: i, props: u, _owner: de.current };
}
E.Fragment = ye;
E.jsx = W;
E.jsxs = W;
T.exports = E;
var m = T.exports;
const ve = "_intersections_6mc94_57", he = "_intersection_6mc94_57", ke = "_clickable_6mc94_77", $e = "_stone_6mc94_92", be = "_black_6mc94_100", Se = "_white_6mc94_104", d = {
  "gomoku-container": "_gomoku-container_6mc94_3",
  "gomoku-board": "_gomoku-board_6mc94_15",
  "board-lines": "_board-lines_6mc94_28",
  "star-points": "_star-points_6mc94_38",
  "star-point": "_star-point_6mc94_38",
  intersections: ve,
  intersection: he,
  clickable: ke,
  stone: $e,
  black: be,
  white: Se,
  "last-move": "_last-move_6mc94_110"
}, xe = ({
  perspective: e,
  onAction: t,
  isMyTurn: o,
  readonly: r
}) => {
  const { current_state: u, your_role: s, action_space_definition: i } = e, { board: l, lastMove: c } = u, y = (f, a) => {
    if (!o || r || !i.actions.find(
      ($) => $.action_id === "place"
    ) || l[f][a] !== 0)
      return;
    let _;
    if (s.identity === "Player Black")
      _ = "player_black";
    else if (s.identity === "Player White")
      _ = "player_white";
    else
      return;
    t({
      action_id: "place",
      role_id: _,
      params: { row: f, col: a }
    });
  }, z = (f, a) => !o || r ? !1 : i.actions.find(
    (_) => _.action_id === "place"
  ) !== void 0 && l[f][a] === 0, H = (f, a) => c !== null && c.row === f && c.col === a, G = (f) => f === 1 ? "black" : f === 2 ? "white" : null;
  return /* @__PURE__ */ m.jsx("div", { className: d["gomoku-container"], children: /* @__PURE__ */ m.jsxs("div", { className: d["gomoku-board"], children: [
    /* @__PURE__ */ m.jsxs("svg", { className: d["board-lines"], viewBox: "0 0 100 100", preserveAspectRatio: "none", children: [
      Array.from({ length: 15 }).map((f, a) => {
        const v = a / 14 * 100;
        return /* @__PURE__ */ m.jsx(
          "line",
          {
            x1: "0",
            y1: v,
            x2: "100",
            y2: v,
            stroke: "#000",
            strokeWidth: "0.3"
          },
          `h-${a}`
        );
      }),
      Array.from({ length: 15 }).map((f, a) => {
        const v = a / 14 * 100;
        return /* @__PURE__ */ m.jsx(
          "line",
          {
            x1: v,
            y1: "0",
            x2: v,
            y2: "100",
            stroke: "#000",
            strokeWidth: "0.3"
          },
          `v-${a}`
        );
      })
    ] }),
    /* @__PURE__ */ m.jsx("div", { className: d["star-points"], children: [3, 7, 11].map(
      (f) => [3, 7, 11].map((a) => /* @__PURE__ */ m.jsx(
        "div",
        {
          className: d["star-point"],
          style: {
            left: `${a / 14 * 100}%`,
            top: `${f / 14 * 100}%`
          }
        },
        `star-${f}-${a}`
      ))
    ) }),
    /* @__PURE__ */ m.jsx("div", { className: d.intersections, children: l.map(
      (f, a) => f.map((v, _) => {
        const O = z(a, _), $ = G(v), J = H(a, _);
        return /* @__PURE__ */ m.jsx(
          "div",
          {
            className: `${d.intersection} ${O ? d.clickable : ""}`,
            style: {
              left: `${_ / 14 * 100}%`,
              top: `${a / 14 * 100}%`
            },
            onClick: () => y(a, _),
            children: $ && /* @__PURE__ */ m.jsx(
              "div",
              {
                className: `${d.stone} ${d[$]} ${J ? d["last-move"] : ""}`
              }
            )
          },
          `${a}-${_}`
        );
      })
    ) })
  ] }) });
};
export {
  xe as default
};
