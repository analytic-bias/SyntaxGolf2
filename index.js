
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
  document.getElementById('problemexp').innerHTML = text;

  function prettyPrint(x) {
    let s = JSON.stringify(x, null, 2);
    // console.log(s);
    return s;
  }

  let ast = LispLike.Problem.tryParse(text);
  let sast = prettyPrint(ast);
  document.getElementById('problemast').innerHTML = sast;

  cy = cytoscape({
    container: document.getElementById('cy'), // container to render in

    elements: {
      nodes: [
        { data: { id: 'a', parent: 'b' } },
        { data: { id: 'b' } },
        { data: { id: 'c', parent: 'b' } },
        { data: { id: 'd' } },
        { data: { id: 'e' } },
        { data: { id: 'f', parent: 'e' } }
      ],
      edges: [
        { data: { id: 'ad', source: 'b', target: 'd' } },
        { data: { id: 'eb', source: 'b', target: 'f' } }

      ]
    },

    style: [
      {
        selector: 'node',
        css: {
          'shape': 'rectangle',
          'content': 'data(id)',
          'text-valign': 'center',
          'text-halign': 'center'
        }
      },
      {
        selector: ':parent',
        css: {
          'text-valign': 'top',
          'text-halign': 'center',
          'shape': 'round-rectangle',
          'corner-radius': "10",
          'padding': 3,
          'label': ''
        }
      },
      {
        selector: 'edge',
        css: {
          'curve-style': 'bezier',
          // 'target-arrow-shape': 'triangle'
        }
      }
    ],

    layout: {
      name: 'grid',
      // rows: 1
    }
  });

  cy.snapToGrid();
  cy.snapToGrid('snapOn');
  cy.snapToGrid('gridOn');
})

let P = Parsimmon;
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
    return P.regexp(/[a-zA-Z_\-][a-zA-Z0-9_\-']*/).desc("symbol");
  },

  // source -> /^\d+/
  Source: function () {
    return P.regexp(/\^\d+/)
      .map(s => ({ tag: "LKS", source: s.slice(1) }))
      .desc("source");
  },

  // target -> /^t\d+/
  Target: function () {
    return P.regexp(/\^t\d+/)
      .map(s => ({ tag: "LKT", target: s.slice(2) }))
      .desc("target");
  },

  // list -> "(" expression* ")"
  List: function (r) {
    return r.Expression.trim(P.optWhitespace)
      .atLeast(1)
      .map(xs => ({ tag: xs[0], children: xs.slice(1) }))
      .wrap(P.string("("), P.string(")"));
  }
});
