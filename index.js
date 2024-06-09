// watchify index.js -p esmify -o bundle.js

import cytoscape from "cytoscape";
import { createTreeFromTreeArray } from "@lukeaus/plain-tree";

const P = require("parsimmon");

const snapToGrid = require("cytoscape-snap-to-grid");
snapToGrid(cytoscape);

let text = `\
(CP 
    (AP 
        (A' 
        (A where)) ^1) 
        (C' 
        (C did ^2) 
        (TP 
            (NP 
                (N' 
                    (N you))) 
                (T'
                    (T did ^t2) 
                (VP 
                    (V' 
                        (V get) 
(AP 
(A' 
    (A where)) ^t1) 
    (DP 
        (D' 
            (D that) 
            (NP 
                (N' 
                    (N hat)))))))))))
`;

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("problemexp").innerHTML = text;

  let ast = LispLike.Problem.tryParse(text);
  let sast = JSON.stringify(ast, null, 2);
  document.getElementById("problemast").innerHTML = sast;

  let reftree = createTreeFromTreeArray(ast).flatMap();
  let refnodes = reftree.map((x) => ({
    data: {
      id: x.id,
      // parent: x.parent ? x.parent.id : null,
      content: x.data.tag + (x.data.symbol ? x.data.symbol : ""),
    },
  }));
  let refedges = reftree.reduce((ys, x) => {
    if (x.parent)
      return ys.concat([{
        data: { id: crypto.randomUUID(), source: x.parent.id, target: x.id },
      }])
    else
      return ys
  }, [])

  cy = cytoscape({
    container: document.getElementById("cy"),
    elements: {
      nodes: refnodes,
      edges: refedges,
    },
    layout: {
      name: "breadthfirst",
    },

    style: [
      {
        selector: "node",
        css: {
          shape: "rectangle",
          content: "data(content)",
          "text-valign": "center",
          "text-halign": "center",
        },
      },
      {
        selector: ":parent",
        css: {
          "text-valign": "top",
          "text-halign": "center",
          shape: "round-rectangle",
          "corner-radius": "10",
          padding: 3,
          label: "",
        },
      },
      {
        selector: "edge",
        css: {
          "curve-style": "bezier",
          // 'target-arrow-shape': 'triangle'
        },
      },
    ],
  });

  cy.snapToGrid();
  cy.snapToGrid("snapOn");
  cy.snapToGrid("gridOn");
});

let LispLike = P.createLanguage({
  // problem -> expression*
  // TODO alternative form with ||
  Problem: function (r) {
    return r.Expression.trim(P.optWhitespace).many();
  },

  // expression -> symbol | source | target | list
  Expression: function (r) {
    return P.alt(r.Symbol, r.Source, r.Target, r.List);
  },

  // FIXME now we run into the compling Millinial Prize Problem of "Defining English Word"
  Symbol: function () {
    return P.regexp(/[a-zA-Z_\-][a-zA-Z0-9_\-']*/)
      .map((s) => ({ symbol: s, id: crypto.randomUUID(), children: [] }))
      .desc("symbol");
  },

  // source -> /^\d+/
  Source: function () {
    return P.regexp(/\^\d+/)
      .map((s) => ({
        tag: "LKS",
        source: s.slice(1),
        id: crypto.randomUUID(),
        children: [],
      }))
      .desc("source");
  },

  // target -> /^t\d+/
  Target: function () {
    return P.regexp(/\^t\d+/)
      .map((s) => ({
        tag: "LKT",
        target: s.slice(2),
        id: crypto.randomUUID(),
        children: [],
      }))
      .desc("target");
  },

  // list -> "(" expression* ")"
  List: function (r) {
    return r.Expression.trim(P.optWhitespace)
      .atLeast(1)
      .map((xs) => ({
        tag: xs[0].symbol,
        children: xs.slice(1),
        id: crypto.randomUUID(),
      }))
      .wrap(P.string("("), P.string(")"));
  },
});
