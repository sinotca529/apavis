const LOAD = 0;
const COPY = 1;
const STORE = 2;
const ADDR_OF = 3;

class Inst {
  constructor(type, lhs_symbol, rhs_symbol) {
    this.type = type;
    this.lhs = lhs_symbol;
    this.rhs = rhs_symbol;
  }
}

function parse(code) {
  code = code.replaceAll(" ", "").trim();
  const lines = code.split("\n");

  const insts = [];
  lines.forEach((line) => {
    if (line == "") return;
    // TODO: extract as Inst.parse
    const exprs = line.split("=");
    const lhs = exprs[0];
    const rhs = exprs[1];

    const type = "";
    if ((rhs[0] == "*" && lhs[0] == "*") || lhs[0] == "&") {
      window.alert("parse error");
      return;
    }

    if (lhs[0] == "*") insts.push(new Inst(STORE, lhs.substring(1), rhs));
    else if (rhs[0] == "*") insts.push(new Inst(LOAD, lhs, rhs.substring(1)));
    else if (rhs[0] == "&")
      insts.push(new Inst(ADDR_OF, lhs, rhs.substring(1)));
    else insts.push(new Inst(COPY, lhs, rhs));
  });

  return insts;
}

class Node {
  constructor(symbol) {
    this.symbol = symbol;
    this.pointees = new Set();
  }

  add_pointee(symbol) {
    this.pointees.add(symbol);
  }
}

class CyGraph {
  constructor() {
    this.cy = cytoscape({
      container: document.getElementById("graph"),
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#fff",
            label: "data(id)",
            "text-valign": "center",
            "text-halign": "center",
          },
        },
        {
          selector: `edge[label = ${COPY}]`,
          style: {
            width: 3,
            "line-color": "#ccc",
            "target-arrow-color": "#ccc",
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
          },
        },
        {
          selector: `edge[label = ${LOAD}]`,
          style: {
            width: 3,
            "line-color": "#a0c",
            "target-arrow-color": "#a0c",
            "source-arrow-color": "#a0c",
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "source-arrow-shape": "circle",
          },
        },
        {
          selector: `edge[label = ${STORE}]`,
          style: {
            width: 3,
            "line-color": "#00c",
            "target-arrow-color": "#00c",
            "curve-style": "bezier",
            "target-arrow-shape": "circle-triangle",
          },
        },
        {
          selector: `edge[label = ${ADDR_OF}]`,
          style: {
            width: 1,
            "line-color": "#000",
            "target-arrow-color": "#000",
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "line-style": "dashed",
          },
        },
      ],
      layout: {
        name: "grid",
        rows: 1,
      },
    });
  }

  #reset_layout() {
    var layout = this.cy.layout({
      name: "cose",
      fit: true,
      padding: 30,
    });
    layout.run();
  }

  #add_node(symbol) {
    this.cy.add([{ data: { id: symbol } }]);
  }

  add_edge(dst, src, type) {
    console.log(dst, src);
    this.#add_node(dst);
    this.#add_node(src);
    this.cy.add([
      {
        data: {
          id: src + "#" + dst,
          source: src,
          target: dst,
          label: type,
        },
      },
    ]);
    this.#reset_layout();
  }
}

class Graph {
  constructor() {
    this.copy_edges = new Map();
    this.store_edges = new Map();
    this.load_edges = new Map();
    this.pointees = new Map();
    this.cy = new CyGraph();
  }

  #add_edge(map, dst, src) {
    if (!map.has(src)) map.set(src, new Set());
    const before_size = map.get(src).size;
    map.get(src).add(dst);
    const after_size = map.get(src).size;
    return after_size > before_size;
  }

  add_copy_edge(dst, src) {
    const updated = this.#add_edge(this.copy_edges, dst, src);
    this.cy.add_edge(dst, src, COPY);
    return updated;
  }

  add_load_edge(dst, src) {
    this.#add_edge(this.load_edges, dst, src);
    this.cy.add_edge(dst, src, LOAD);
  }

  add_store_edge(dst, src) {
    this.#add_edge(this.store_edges, dst, src);
    this.cy.add_edge(dst, src, STORE);
  }

  add_pointee(pointer, pointee) {
    this.#add_edge(this.pointees, pointee, pointer);
    this.cy.add_edge(pointee, pointer, ADDR_OF);
  }
}

function apa(code) {
  const insts = parse(code);
  const g = new Graph();

  // worklist
  const stack = [];

  // Collect constraints
  insts.forEach((i) => {
    switch (i.type) {
      case COPY:
        console.log("copy", i.lhs, i.rhs);
        g.add_copy_edge(i.lhs, i.rhs);
        break;
      case ADDR_OF:
        console.log("addr_of");
        g.add_pointee(i.lhs, i.rhs);
        break;
      case LOAD:
        console.log("load");
        g.add_load_edge(i.lhs, i.rhs);
        break;
      case STORE:
        console.log("store");
        g.add_store_edge(i.lhs, i.rhs);
        break;
    }
  });

  // TODO: Analysis
}

function main() {
  document.getElementById("start").addEventListener("click", () => {
    var code = document.getElementById("code").value;
    apa(code);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  main();
});
