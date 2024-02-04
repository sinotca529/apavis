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
    const exprs = line.split("=");
    const lhs = exprs[0];
    const rhs = exprs[1];

    const type = "";
    if ((rhs[0] == "*" && lhs[0] == "*") || lhs[0] == "&") {
      window.alert("parse error");
      return;
    }

    if (lhs[0] == "*") insts.push(new Inst("store", lhs.substring(1), rhs));
    else if (rhs[0] == "*") insts.push(new Inst("load", lhs, rhs.substring(1)));
    else if (rhs[0] == "&")
      insts.push(new Inst("addr_of", lhs, rhs.substring(1)));
    else insts.push(new Inst("copy", lhs, rhs));
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

class Graph {
  constructor() {
    this.copy_edges = new Map();
    this.store_edges = new Map();
    this.load_edges = new Map();
    this.pointees = new Map();

    this.cy = cytoscape({
      container: document.getElementById("graph"),
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#666",
            label: (node) => {
              var p = node.data("pointee");
              if (p == undefined) p = "";
              return `${node.data("id")} -> {${p}}`;
            },
          },
        },
        {
          selector: "edge",
          style: {
            width: 3,
            "line-color": "#ccc",
            "target-arrow-color": "#ccc",
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
          },
        },
      ],
      layout: {
        name: "grid",
        rows: 1,
      },
    });
  }

  cy_add_node(symbol) {
    this.cy.add([{ data: { id: symbol } }]);
  }

  cy_set_pointee(symbol, pointee) {
    this.cy_add_node(symbol);
    var node = this.cy.$id(symbol);
    node.data("pointee", pointee);
    this.cy_reset_layout();
  }

  cy_add_edge(dst, src) {
    console.log(dst, src);
    this.cy_add_node(dst);
    this.cy_add_node(src);
    this.cy.add([
      {
        data: {
          id: src + "#" + dst,
          source: src,
          target: dst,
        },
      },
    ]);
    this.cy_reset_layout();
  }

  cy_reset_layout() {
    var layout = this.cy.layout({
      name: "cose",
      fit: true,
      padding: 30,
    });
    layout.run();
  }

  add_edge(map, dst, src) {
    if (!map.has(src)) map.set(src, new Set());
    const before_size = map.get(src).size;
    map.get(src).add(dst);
    const after_size = map.get(src).size;
    return after_size > before_size;
  }

  add_copy_edge(dst, src) {
    console.log(dst, src);
    const updated = this.add_edge(this.copy_edges, dst, src);
    console.log(dst, src);
    this.cy_add_edge(dst, src);
    return updated;
  }

  add_load_edge(dst, src) {
    this.add_edge(this.load_edges, dst, src);
  }

  add_store_edge(dst, src) {
    this.add_edge(this.store_edges, dst, src);
  }

  add_pointee(pointer, pointee) {
    this.add_edge(this.pointees, pointee, pointer);
    const pointees = Array.from(this.pointees.get(pointer)).join(" ");
    this.cy_set_pointee(pointer, pointees);
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
      case "copy":
        console.log("copy", i.lhs, i.rhs);
        g.add_copy_edge(i.lhs, i.rhs);
        break;
      case "addr_of":
        console.log("addr_of");
        g.add_pointee(i.lhs, i.rhs);
        break;
      case "load":
        console.log("load");
        g.add_load_edge(i.lhs, i.rhs);
        break;
      case "store":
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
