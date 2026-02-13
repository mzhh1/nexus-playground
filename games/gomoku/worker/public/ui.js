import N from "react";
var v = { exports: {} }, f = {};
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var R = N, A = Symbol.for("react.element"), O = Symbol.for("react.fragment"), E = Object.prototype.hasOwnProperty, C = R.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, P = { key: !0, ref: !0, __self: !0, __source: !0 };
function b(a, s, m) {
  var r, l = {}, _ = null, p = null;
  m !== void 0 && (_ = "" + m), s.key !== void 0 && (_ = "" + s.key), s.ref !== void 0 && (p = s.ref);
  for (r in s) E.call(s, r) && !P.hasOwnProperty(r) && (l[r] = s[r]);
  if (a && a.defaultProps) for (r in s = a.defaultProps, s) l[r] === void 0 && (l[r] = s[r]);
  return { $$typeof: A, type: a, key: _, ref: p, props: l, _owner: C.current };
}
f.Fragment = O;
f.jsx = b;
f.jsxs = b;
v.exports = f;
var i = v.exports;
const S = "_intersections_6mc94_57", w = "_intersection_6mc94_57", L = "_clickable_6mc94_77", T = "_stone_6mc94_92", W = "_black_6mc94_100", B = "_white_6mc94_104", o = {
  "gomoku-container": "_gomoku-container_6mc94_3",
  "gomoku-board": "_gomoku-board_6mc94_15",
  "board-lines": "_board-lines_6mc94_28",
  "star-points": "_star-points_6mc94_38",
  "star-point": "_star-point_6mc94_38",
  intersections: S,
  intersection: w,
  clickable: L,
  stone: T,
  black: W,
  white: B,
  "last-move": "_last-move_6mc94_110"
}, q = ({
  perspective: a,
  onAction: s,
  isMyTurn: m,
  readonly: r
}) => {
  const { current_state: l, your_role: _, action_space_definition: p } = a, { board: d, lastMove: k } = l, h = (e, t) => {
    if (!m || r || !p.actions.find(
      (u) => u.action_id === "place"
    ) || d[e][t] !== 0)
      return;
    let n;
    if (_.identity === "Player Black")
      n = "player_black";
    else if (_.identity === "Player White")
      n = "player_white";
    else
      return;
    s({
      action_id: "place",
      role_id: n,
      params: { row: e, col: t }
    });
  }, $ = (e, t) => !m || r ? !1 : p.actions.find(
    (n) => n.action_id === "place"
  ) !== void 0 && d[e][t] === 0, x = (e, t) => k !== null && k.row === e && k.col === t, j = (e) => e === 1 ? "black" : e === 2 ? "white" : null;
  return /* @__PURE__ */ i.jsx("div", { className: o["gomoku-container"], children: /* @__PURE__ */ i.jsxs("div", { className: o["gomoku-board"], children: [
    /* @__PURE__ */ i.jsxs("svg", { className: o["board-lines"], viewBox: "0 0 100 100", preserveAspectRatio: "none", children: [
      Array.from({ length: 15 }).map((e, t) => {
        const c = t / 14 * 100;
        return /* @__PURE__ */ i.jsx(
          "line",
          {
            x1: "0",
            y1: c,
            x2: "100",
            y2: c,
            stroke: "#000",
            strokeWidth: "0.3"
          },
          `h-${t}`
        );
      }),
      Array.from({ length: 15 }).map((e, t) => {
        const c = t / 14 * 100;
        return /* @__PURE__ */ i.jsx(
          "line",
          {
            x1: c,
            y1: "0",
            x2: c,
            y2: "100",
            stroke: "#000",
            strokeWidth: "0.3"
          },
          `v-${t}`
        );
      })
    ] }),
    /* @__PURE__ */ i.jsx("div", { className: o["star-points"], children: [3, 7, 11].map(
      (e) => [3, 7, 11].map((t) => /* @__PURE__ */ i.jsx(
        "div",
        {
          className: o["star-point"],
          style: {
            left: `${t / 14 * 100}%`,
            top: `${e / 14 * 100}%`
          }
        },
        `star-${e}-${t}`
      ))
    ) }),
    /* @__PURE__ */ i.jsx("div", { className: o.intersections, children: d.map(
      (e, t) => e.map((c, n) => {
        const y = $(t, n), u = j(c), g = x(t, n);
        return /* @__PURE__ */ i.jsx(
          "div",
          {
            className: `${o.intersection} ${y ? o.clickable : ""}`,
            style: {
              left: `${n / 14 * 100}%`,
              top: `${t / 14 * 100}%`
            },
            onClick: () => h(t, n),
            children: u && /* @__PURE__ */ i.jsx(
              "div",
              {
                className: `${o.stone} ${o[u]} ${g ? o["last-move"] : ""}`
              }
            )
          },
          `${t}-${n}`
        );
      })
    ) })
  ] }) });
};
export {
  q as default
};
