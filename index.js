// watchify index.js -p esmify -o bundle.js --debug

const P = require("parsimmon");
import { createTreeFromTreeArray } from "@lukeaus/plain-tree"; // FIXME make best effort to eliminate this

import cytoscape from "cytoscape";
import snapToGrid from "cytoscape-snap-to-grid";
snapToGrid(cytoscape);
import elk from 'cytoscape-elk';
cytoscape.use(elk);

import { testast } from "./testast.js";

let LispLike = P.createLanguage({
  // problem -> expression*
  // TODO alternative form with ||
  Problem: function (r) {
    // return r.Expression.trim(P.optWhitespace).many();
    return r.Expression.trim(P.optWhitespace);
  },

  // expression -> symbol | source | target | list
  Expression: function (r) {
    return P.alt(r.Symbol, r.Source, r.Target, r.List);
  },

  // FIXLATER now we run into the compling Millinial Prize Problem of "Defining English Word"
  Symbol: function () {
    return P.regexp(/[a-zA-Z_\-][a-zA-Z0-9_\-']*/)
      .map((s) => ({ symbol: s, id: crypto.randomUUID(), children: [] }))
      .desc("symbol");
  },

  // source -> /^\d+/
  Source: function () {
    return P.regexp(/\^\d+/)
      .map((s) => ({
      id: crypto.randomUUID(),
      link: true,
      tag: "LKS",
      source: parseInt(s.slice(1)),
      children: [],
      }))
      .desc("source");
  },

  // target -> /^t\d+/
  Target: function () {
    return P.regexp(/\^t\d+/)
      .map((s) => ({
        id: crypto.randomUUID(),
        link: true,
        tag: "LKT",
        target: parseInt(s.slice(2)),
        children: [],
      }))
      .desc("target");
  },

  // list -> "(" expression* ")"
  List: function (r) {
    return r.Expression.trim(P.optWhitespace)
      .atLeast(1)
      .map((xs) => ({
        id: crypto.randomUUID(),
        tag: xs[0].symbol,
        children: xs.slice(1),
      }))
      .wrap(P.string("("), P.string(")"))
      .desc("edgelist");
  },
});

// let testast = await fetch('test.lisp', { method: 'GET' })
let ast = LispLike.Problem.tryParse(testast.replace(/\n/g, ' '));
let sast = JSON.stringify(ast, null, 2);

// FIXME re-write this part, using cytoscape traversing and searching whenever possible
let rawtree = createTreeFromTreeArray([ast]).flatMap();
let refskeleton = rawtree.filter((x) => x.data.tag);
let refwords = rawtree.filter((x) => x.data.symbol);
let reflinks = rawtree.filter((x) => x.data.link);
let refnodes = refskeleton.map((x) => ({
  data: {
    id: x.id,
    // parent: x.parent ? x.parent.id : null,
    content: x.data.tag,
    linksource: x.data.source,
    linktarget: x.data.target,
  },
}));
let refedges = refskeleton.reduce((ys, x) => x.parent ? ys.concat([{
    data: { id: crypto.randomUUID(), source: x.parent.id, target: x.id },
  }]) : ys, [])

const sentenceFrom = (s) => s.reduce((ys, x) => 
  x.data.symbol? ys.concat(x.data.symbol) : ys, [])
let refsentence = sentenceFrom(rawtree)
console.log(refsentence)
// FIXME this is impure as hell, by https://js.cytoscape.org/#nodes.leaves
// actually this is way cheaper in terms of time than the leaves method, so stay put for now...
var refsubnodes = [];
refwords.forEach((x, i) => {
  var parent = x;
  while ((parent = parent.parent) !== null) {
    let childid = crypto.randomUUID()
    // console.log(x)
    refsubnodes.push({
      data: {
        id: childid,
        parent: parent.id,
        content: x.data.symbol,
        priority: -i,
      },
    });
  }
}, [])
// ENDFIX

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("problemexp").innerHTML = testast;
  document.getElementById("problemast").innerHTML = sast;
  cy = cytoscape({
    container: document.getElementById("cy"),
    autoungrabify: true,
    elements: {
      nodes: refnodes.concat(refsubnodes),
      edges: refedges,
    },
    // FIXME layout and style polishing
    layout: {
      name: "elk",
      nodeLayoutOptions: node => {
        if (node.isParent() || node.data('parent')) {
          return {
            'algorithm': 'box',
            'elk.aspectRatio': Number.MAX_SAFE_INTEGER,
            'priority': node.data('priority'),
          }
        } else
          return {}
      },
      elk: {
        'algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.edgeRouting': 'ORTHOGONAL',
        // 'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
        // 'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        // 'elk.layered.considerModelOrder.crossingCounterNodeInfluence': 0.5,
        // 'elk.layered.crossingMinimization.semiInteractive': 'true',
        'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
        'elk.layered.layering.strategy': 'INTERACTIVE',
        'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
      }
    },

    style: [
      {
        selector: "node",
        css: {
          shape: "rectangle",
          content: "data(content)",
          "text-valign": "center",
          "text-halign": "center",
          width: "label",
          height: "label",
          "padding": 5,
        },
      },
      {
        selector: ":parent",
        css: {
          label: "data(content)",
          "text-valign": "top",
          "text-halign": "center",
          shape: "round-rectangle",
          "corner-radius": "10",
          padding: 3,
        },
      },
      {
        selector: "edge",
        css: {
          "curve-style": "bezier",
          'target-arrow-shape': 'triangle'
          // 'curve-style': 'taxi',
          // 'taxi-direction': 'rightward',
          // 'target-arrow-shape': 'triangle',
          // 'arrow-scale': 0.66,
        },
      },
    ],
  });

  // cy.snapToGrid();
  // cy.snapToGrid("snapOn");
  // cy.snapToGrid("gridOn");

  interactive();
});

// ------------------------------

function interactive() {
  cy.elements = {
    nodes: refnodes.concat(refsubnodes),
    edges: refedges,
  }
  // FIXME do not show link target tags
  // cy.$('node[linktarget]').forEach((x) => {
  //   x.style('display', 'none')
  // })
  // cy.$("node[content *= 'LK']").forEach((x) => {
  //   x.style('display', 'none')
  // })
}
