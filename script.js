const LOAD = 0;
const COPY = 1;
const STORE = 2;
const ADDR_OF = 3;

class Inst {
  constructor(type, lhs_symbol, rhs_symbol, ln) {
    this.type = type;
    this.lhs = lhs_symbol;
    this.rhs = rhs_symbol;
    this.ln = ln;
  }

  static parse(line, ln) {
    const exprs = line.split("=");
    if (exprs.length != 2) window.alert("parse error");
    const lhs = exprs[0];
    const rhs = exprs[1];

    if ((rhs[0] == "*" && lhs[0] == "*") || lhs[0] == "&") {
      window.alert("parse error");
      return;
    }

    if (lhs[0] == "*") return new Inst(STORE, lhs.substring(1), rhs, ln);
    else if (rhs[0] == "*") return new Inst(LOAD, lhs, rhs.substring(1), ln);
    else if (rhs[0] == "&") return new Inst(ADDR_OF, lhs, rhs.substring(1), ln);
    else return new Inst(COPY, lhs, rhs, ln);
  }
}

function parse(code) {
  code = code.replaceAll(" ", "").trim();
  const lines = code.split("\n");

  const insts = [];
  lines.forEach((l, ln) => {
    if (l.length == 0) return;
    insts.push(Inst.parse(l, ln));
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
  constructor(grid_size) {
    this.grid_size = grid_size;
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
        rows: grid_size,
        cols: grid_size,
      },
    });
  }

  #reset_layout() {
    const layout = this.cy.layout({
      name: "grid",
      fit: true,
      padding: 30,
      rows: this.grid_size,
      cols: this.grid_size,
    });
    layout.run();
  }

  #add_node(symbol) {
    this.cy.add([{ data: { id: symbol } }]);
  }

  add_edge(dst, src, type) {
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
  constructor(grid_size) {
    this.copy_edges = new Map();
    this.store_edges = new Map();
    this.load_edges = new Map();
    this.points_to_edges = new Map();
    this.cy = new CyGraph(grid_size);
  }

  #add_edge(map, dst, src) {
    if (!map.has(src)) map.set(src, new Set());
    if (!map.has(dst)) map.set(dst, new Set());
    const before_size = map.get(src).size;
    map.get(src).add(dst);
    const after_size = map.get(src).size;
    return after_size > before_size;
  }

  #copy_pointees(dst, src) {
    if (!this.points_to_edges.has(src))
      this.points_to_edges.set(src, new Set());
    if (!this.points_to_edges.has(dst))
      this.points_to_edges.set(dst, new Set());

    let updated = false;
    this.points_to_edges.get(src).forEach((pointee) => {
      updated |= this.#add_edge(this.points_to_edges, pointee, dst);
      this.cy.add_edge(pointee, dst, ADDR_OF);
    });
    return updated;
  }

  eval_copy_edge(dst, src) {
    let updated = this.#add_edge(this.copy_edges, dst, src);
    this.cy.add_edge(dst, src, COPY);
    updated |= this.#copy_pointees(dst, src);
    return updated;
  }

  eval_load_edge(dst, src) {
    let updated = this.#add_edge(this.load_edges, dst, src);
    this.cy.add_edge(dst, src, LOAD);
    this.points_to_edges.get(src).forEach((derefed) => {
      updated |= this.#copy_pointees(dst, derefed);
    });
    return updated;
  }

  eval_store_edge(dst, src) {
    let updated = this.#add_edge(this.store_edges, dst, src);
    this.cy.add_edge(dst, src, STORE);
    this.points_to_edges.get(dst).forEach((derefed) => {
      updated |= this.#copy_pointees(derefed, src);
    });
    return updated;
  }

  eval_points_to_edge(pointer, pointee) {
    let updated = this.#add_edge(this.points_to_edges, pointee, pointer);
    this.cy.add_edge(pointee, pointer, ADDR_OF);
    return updated;
  }
}

function num_symbols(insts) {
  let symbol_set = new Set();
  insts.forEach((i) => {
    symbol_set.add(i.lhs);
    symbol_set.add(i.rhs);
  });
  return symbol_set.size;
}

class Apa {
  constructor(code) {
    this.insts = parse(code);

    const ns = num_symbols(this.insts);
    const grid_size = Math.ceil(Math.sqrt(ns));

    this.g = new Graph(grid_size);
    this.next_index = 0;

    this.updated = false;
    this.finish = false;
  }

  #eval(inst) {
    switch (inst.type) {
      case COPY:
        return this.g.eval_copy_edge(inst.lhs, inst.rhs);
      case ADDR_OF:
        return this.g.eval_points_to_edge(inst.lhs, inst.rhs);
      case LOAD:
        return this.g.eval_load_edge(inst.lhs, inst.rhs);
      case STORE:
        return this.g.eval_store_edge(inst.lhs, inst.rhs);
    }
  }

  is_finish() {
    return this.finish;
  }

  next_inst_ln() {
    if (this.insts.length == 0) return 0;
    return this.insts[this.next_index].ln;
  }

  step() {
    if (this.insts.length == 0) return;
    const inst = this.insts[this.next_index];
    this.next_index = (this.next_index + 1) % this.insts.length;
    const updated = this.#eval(inst);
    this.updated |= updated;

    if (this.next_index == 0) {
      if (this.updated == false) {
        this.finish = true;
      } else {
        this.updated = false;
      }
    }
    return updated;
  }
}

function mark_line(ln_to_mark) {
  const code = document.getElementById("code").innerText;
  let marked_code = code
    .split("\n")
    .map((l, ln) => {
      if (ln == ln_to_mark) return "<mark>" + l + "</mark>";
      return l;
    })
    .reduce((acc, e) => {
      return acc + "\n" + e;
    });
  if (marked_code == undefined) marked_code = "";

  document.getElementById("code").innerHTML = marked_code;
}

function unmark() {
  document.getElementById("code").innerHTML =
    document.getElementById("code").innerText;
}

var apa = undefined;
function reset_apa() {
  const code = document.getElementById("code").innerText;
  apa = new Apa(code);
  document.getElementById("next").disabled = false;
  unmark();
}

function main() {
  document.getElementById("next").addEventListener("click", () => {
    if (apa == undefined) reset_apa();
    if (apa.is_finish()) {
      document.getElementById("next").disabled = true;
      return;
    }
    mark_line(apa.next_inst_ln());
    apa.step();
  });

  document.getElementById("reset").addEventListener("click", () => {
    reset_apa();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  main();
});
