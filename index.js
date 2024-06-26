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
// postponed refactoring
let tree = createTreeFromTreeArray([ast]);
let rawtree = tree.flatMap();
let refskeleton = rawtree.filter((x) => x.data.tag);
let sourcedids = rawtree.filter((x) => x.data.source).map((x) => x.parent.id);
let targetedids = rawtree.filter((x) => x.data.target).map((x) => x.parent.id);
let refnodes = refskeleton.map((x) => ({
  data: {
    id: x.id,
    content: x.data.tag,
    linksource: x.data.source,
    linktarget: x.data.target,
  },
}));
refnodes[0].data.root = true;
let refedges = refskeleton.reduce((ys, x) => x.parent ? ys.concat([{
    data: { id: crypto.randomUUID(), source: x.parent.id, target: x.id },
  }]) : ys, [])

const sentenceFrom = (s) => s.reduce((ys, x) => 
  x.data.symbol? ys.concat(x.data.symbol) : ys, [])
let refsentence = sentenceFrom(rawtree)
// FIXME this is impure as hell, by https://js.cytoscape.org/#nodes.leaves
// actually this is way cheaper in terms of time than the leaves method, so postponed
var refsubnodes = [];
var refwords = [];
tree.traverseDepthFirst((x) => {
  if (x.data.symbol) refwords.push(x);
});
refwords.forEach((x, i) => {
  var parent = x;
  var child = x;
  var l = [];
  while ((parent = parent.parent) !== null) {
    let childid = crypto.randomUUID();
    l.push({
      data: {
        id: childid,
        parent: parent.id,
        content: x.data.symbol,
        priority: -i,
      },
    });
    if (targetedids.includes(child.id)) {
      l.forEach((x) => {
        x.data.virtualtarget = true;
      });
      break;
    }
    if (sourcedids.includes(child.id)) {
      l.forEach((x) => {
        x.data.virtualsource = true;
      });
    }
    child = parent;
  }
  refsubnodes = refsubnodes.concat(l);
}, [])
// ENDFIX

var cy;
const touchdevice = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
const cylayout = {
  name: "elk",
  nodeLayoutOptions: node => {
    if (node.isParent() || node.data('parent')) {
      return {
        'algorithm': 'box',
        'elk.interactive': false,
        // 'elk.spacing.nodeNode': 0,
        // 'elk.box.packingMode': 'GROUP_INC',
        'elk.aspectRatio': Number.MAX_SAFE_INTEGER,
        'priority': node.data('priority'),
      };
    } else
      return {}
  },
  elk: {
    'algorithm': 'layered',
    'elk.direction': 'DOWN',
    // 'elk.edgeRouting': 'ORTHOGONAL',
    // 'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
    'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
  }
};
var cursornodeid, cursoredgeid;
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("problemexp").innerHTML = testast;
  cy = cytoscape({
    container: document.getElementById("cy"),
    // autoungrabify: true,
    minZoom: 0.75,
    maxZoom: 3,
    selectionType: touchdevice ? 'additive' : 'single',
    elements: {
      nodes: refnodes.concat(refsubnodes).concat({
      data: {
        id: (cursornodeid = crypto.randomUUID()),
        style: { 'display': 'none' },
      },
      }),
      edges: refedges.concat({
      data: {
        id: (cursoredgeid = crypto.randomUUID()),
        source: cursornodeid,
        target: cursornodeid,
        virtual: true,
        style: { 'display': 'none' },
      },
      }),
    },
    // FIXME layout and style polishing - mostly done, except for node tag labels
    layout: cylayout,

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
        selector: "node[virtualtarget]",
        css: {
          opacity: 0.5,
        },
      },
      {
        selector: "edge",
        css: {
          "curve-style": "bezier",
          'target-arrow-shape': 'triangle'
        },
      },
    ],
  });
  cy.$('').forEach(x => x.ungrabify());
  let linktargets = cy.$('[linktarget]')
  cy.$('[linksource]').forEach((x) => {
    let t = linktargets.find(y => y.data('linktarget') === x.data('linksource'))
    const id = crypto.randomUUID()
    cy.add({ group: 'edges',
      data: { 
        virtual: true,
        id: id,
        source: t.incomers()[0].source().id(),
        target: x.incomers()[0].source().id(),
      },
    })
    x.data('virtualedge', id)
    t.data('virtualedge', id)
  })
  cy.$('edge[virtual]').style({
    'line-style': 'dashed',
    'curve-style': 'unbundled-bezier', // FIXME bezier
    'control-point-distances': '-200',
    'control-point-weights': '0.5',
  })
  cy.on('mouseover', function (evt) {
    document.getElementById("elementdata").innerHTML = JSON.stringify(evt.target.data(), null, 2);
  });
  cy.on('dragpan', function (evt) {
    const e = cy.extent();
    if (e.x1 + e.w < 0)
      cy.panBy({ x: e.x1 + e.w, y: 0 });
    if (e.y1 + e.h < 0)
      cy.panBy({ y: e.y1 + e.h, x: 0 });
    if (e.x2 - 2 * e.w > 0)
      cy.panBy({ x: e.x2 - 2 * e.w, y: 0 });
    if (e.y2 - 2 * e.h > 0)
      cy.panBy({ y: e.y2 - 2 * e.h, x: 0 });
  });
  cy.on('select', function (evt) {
    if (evt.target.isParent() || evt.target.isEdge())
      evt.target.unselect()
  });
  function flashselected(color) {
    cy.$(':selected').forEach(node => {
      node.style('background-color', color);
      setTimeout(() => {
        node.style('background-color', '');
      }, 100);
    });
  }
  cy.on('cxttap', function (evt) {
    if (cy.$(':selected').length === 0) return;
    let outgoers = cy.$(':selected')[0] // FIXME [0] not very robust
      .parent().outgoers()
    let selectedvirtual = cy.$(':selected').findIndex(x => x.data('virtualtarget'))
    let potentials = outgoers.map(x => 
      x.target().children()
       .filter(y => selectedvirtual > -1 || !y.data().virtualtarget)
       .map(y => y.data().content)
    )
    let selection = cy.$(':selected').map(x => x.data().content)
    let hit = potentials.findIndex(x => JSON.stringify(x) === JSON.stringify(selection))
    let movenotdone = cy.$(':selected')[0].parent().children()
                        .filter(x => x.style('display') === 'none').length;
    if (hit > -1 || movenotdone > 0) {
      outgoers[hit].style('display', 'element')
      outgoers[hit].target().style('display', 'element')
      outgoers[hit].target().children().forEach(x => {
        if (x.data('virtualtarget')) {
          cy.$('edge[virtual]').filter(y => y.data('source') === x.parent().id()).style('display', 'element')
        }
      });
      flashselected('green');
    } else {
      flashselected('red');
    }
    cy.$(':selected').unselect()
  });
  // cy.$('node[virtualsource]').forEach(x => x.grabify());
  cy.on('dbltap', 'node[virtualsource]', function (evt) {
    grabbedid = evt.target.parent().id;

  });
  // cy.snapToGrid();
  // cy.snapToGrid("snapOn");
  // cy.snapToGrid("gridOn");

  document.getElementById("reset").onclick = reset;
  document.getElementById("set").onclick = set;
  // reset(cy);
});

// ------------------------------

function set() {
  cy.$('').forEach(x => x.style('display', 'element'))
  // cy.$('[virtualtarget]').style('display', 'element');
}

function reset() {
  let hidenodes = cy.$(':parent[^root], :orphan[^root]')
  let hideedges = hidenodes.connectedEdges()
  hidenodes.style('display', 'none')
  hideedges.forEach(x => x.style('display', 'none'))
  // cy.$('[virtualtarget]').style('display', 'none');
  // TODO drag movement
  // TODO choose tag
}
