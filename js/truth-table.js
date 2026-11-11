// TRUTH TABLE — load after boolean-equations.js.
// Derives rows from actual gate connections, independently of current switch values.
(() => {
  "use strict";
  if (typeof drawingArea === "undefined" || typeof connections === "undefined") return;
  const host = document.querySelector(".circuit-section");
  if (!host) return;

  const css = document.createElement("style");
  css.textContent = `
    .truth-table-panel { margin-top:18px; padding:16px 20px; border:1px solid #00bfff;
      border-radius:10px; background:#08152b; box-shadow:0 0 10px rgba(0,191,255,.16); }
    .truth-table-panel h3 { margin:0 0 12px; text-align:center; color:#58c7ff; font-size:19px; }
    .truth-table-scroll { overflow-x:auto; max-width:100%; border:1px solid #174973; border-radius:8px; }
    .truth-table { width:100%; border-collapse:collapse; color:#f1f7ff; text-align:center;
      font:15px/1.5 Consolas,'Courier New',monospace; }
    .truth-table th,.truth-table td { padding:8px 12px; border:1px solid #174973; white-space:nowrap; }
    .truth-table th { background:#10345a; color:#58c7ff; position:sticky; top:0; }
    .truth-table td { background:#061127; }
    .truth-table tbody tr:nth-child(even) td { background:#091b33; }
    .truth-table td.tt-one { color:#39ff14; font-weight:bold; }
    .truth-table td.tt-zero { color:#f1f7ff; }
    .truth-table td.tt-unknown { color:#ffb65c; font-weight:bold; }
    .truth-table-msg { margin:8px 0; text-align:center; color:#a9bacb; }
    .truth-table-note { margin:10px 0 0; font-size:12px; color:#8fa9c7; }
  `;
  document.head.appendChild(css);

  const panel = document.createElement("section");
  panel.className = "truth-table-panel";
  panel.setAttribute("aria-label", "Truth Table");
  panel.innerHTML = `<h3>Truth Table</h3><div class="truth-table-content"></div>
    <p class="truth-table-note">Rows show every combination of connected inputs. – means an unknown or unconnected signal.</p>`;
  const after = host.querySelector(".boolean-equation-panel");
  if (after) after.insertAdjacentElement("afterend", panel);
  else host.appendChild(panel);
  const content = panel.querySelector(".truth-table-content");
  let scheduled = false;
  let oldSignature = "";
  const MAX_INPUTS = 7;
  const flip = bit => bit === null ? null : 1 - bit;

  function gateLogic(type, bits) {
    if (type === "NOT") return flip(bits[0] ?? null);
    if (type === "AND" || type === "NAND") {
      const value = bits.includes(0) ? 0 : bits.includes(null) ? null : 1;
      return type === "NAND" ? flip(value) : value;
    }
    if (type === "OR" || type === "NOR") {
      const value = bits.includes(1) ? 1 : bits.includes(null) ? null : 0;
      return type === "NOR" ? flip(value) : value;
    }
    if (type === "XOR" || type === "XNOR") {
      if (bits.includes(null)) return null;
      const value = bits.reduce((total, bit) => total ^ bit, 0);
      return type === "XNOR" ? flip(value) : value;
    }
    return null;
  }

  function getModel() {
    const gates = [...drawingArea.querySelectorAll(".logic-gate")];
    const live = new Set(gates);
    const outputs = gates.filter(g => g.dataset.type === "OUTPUT");
    const incoming = new Map();
    for (const c of connections) {
      if (!live.has(c.fromGate) || !live.has(c.toGate)) continue;
      if (!incoming.has(c.toGate)) incoming.set(c.toGate, new Map());
      incoming.get(c.toGate).set(Number(c.inputIndex), c.fromGate);
    }
    const used = new Set();
    const visited = new Set();
    function trace(gate) {
      if (!gate || visited.has(gate)) return;
      visited.add(gate);
      if (gate.dataset.type === "INPUT") { used.add(gate); return; }
      for (const source of incoming.get(gate)?.values() || []) trace(source);
    }
    outputs.forEach(trace);
    const inputs = gates.filter(g => used.has(g));
    const inputLabel = gate => gate.querySelector("svg")?.dataset.label ||
      gate.querySelector(".source-label")?.textContent?.trim() || "?";
    const outputLabel = gate => gate.dataset.outputLabel ||
      gate.querySelector(".output-label")?.textContent?.trim() || "Y";
    return {inputs, outputs, incoming, inputLabel, outputLabel};
  }

  function getValue(gate, rowValues, incoming, memo, visiting) {
    if (!gate) return null;
    if (memo.has(gate)) return memo.get(gate);
    if (visiting.has(gate)) return null;
    visiting.add(gate);
    const type = gate.dataset.type;
    let value = null;
    if (type === "INPUT") value = rowValues.has(gate) ? rowValues.get(gate) : null;
    else if (type === "OUTPUT") value = getValue(incoming.get(gate)?.get(0), rowValues, incoming, memo, visiting);
    else {
      const count = type === "NOT" ? 1 : Math.min(8, Math.max(2, Number(gate.dataset.inputs) || 2));
      const sources = incoming.get(gate) || new Map();
      const bits = Array.from({length:count}, (_,i) => getValue(sources.get(i), rowValues, incoming, memo, visiting));
      value = gateLogic(type, bits);
    }
    visiting.delete(gate);
    memo.set(gate, value);
    return value;
  }

  function render() {
    scheduled = false;
    const {inputs, outputs, incoming, inputLabel, outputLabel} = getModel();
    // Signature tracks changes to connectivity, gate types/input counts and editable names.
    const gates = [...drawingArea.querySelectorAll(".logic-gate")];
    const ids = new Map(gates.map((gate, i) => [gate, i]));
    const signature = JSON.stringify({
      gates: gates.map(g => [g.dataset.type, g.dataset.inputs,
        g.dataset.type === "INPUT" ? inputLabel(g) : "",
        g.dataset.type === "OUTPUT" ? outputLabel(g) : ""]),
      edges: connections.filter(c => ids.has(c.fromGate) && ids.has(c.toGate))
        .map(c => [ids.get(c.fromGate), ids.get(c.toGate), Number(c.inputIndex)]),
      columns: inputs.map(g => ids.get(g)), out: outputs.map(g => ids.get(g))
    });
    if (signature === oldSignature) return;
    oldSignature = signature;
    content.replaceChildren();
    if (!outputs.length) {
      const msg = document.createElement("p");
      msg.className = "truth-table-msg";
      msg.textContent = "Add and connect an Output to generate a truth table.";
      content.append(msg);
      return;
    }
    if (inputs.length > MAX_INPUTS) {
      const msg = document.createElement("p");
      msg.className = "truth-table-msg";
      msg.textContent = `Truth Table supports up to ${MAX_INPUTS} connected inputs (${inputs.length} found).`;
      content.append(msg);
      return;
    }
    const scroll = document.createElement("div");
    scroll.className = "truth-table-scroll";
    const table = document.createElement("table");
    table.className = "truth-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    [...inputs.map(inputLabel), ...outputs.map(outputLabel)].forEach(label => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = label;
      headerRow.append(th);
    });
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    const combinations = 2 ** inputs.length;
    for (let number = 0; number < combinations; number++) {
      const tr = document.createElement("tr");
      const values = new Map();
      inputs.forEach((gate, i) => {
        const bit = (number >> (inputs.length - i - 1)) & 1;
        values.set(gate, bit);
        const td = document.createElement("td");
        td.textContent = String(bit);
        td.className = bit ? "tt-one" : "tt-zero";
        tr.append(td);
      });
      const memo = new Map();
      outputs.forEach(gate => {
        const bit = getValue(gate, values, incoming, memo, new Set());
        const td = document.createElement("td");
        td.textContent = bit === null ? "–" : String(bit);
        td.className = bit === null ? "tt-unknown" : bit ? "tt-one" : "tt-zero";
        tr.append(td);
      });
      tbody.append(tr);
    }
    table.append(tbody);
    scroll.append(table);
    content.append(scroll);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(render);
  }
  const observer = new MutationObserver(records => {
    if (records.some(r => r.type === "childList" ||
      (r.type === "attributes" && ["data-inputs", "data-label", "data-output-label", "data-type"].includes(r.attributeName)))) schedule();
  });
  observer.observe(drawingArea, {subtree:true, childList:true, attributes:true,
    attributeFilter:["data-inputs", "data-label", "data-output-label", "data-type"]});
  document.addEventListener("click", schedule);
  document.addEventListener("pointerup", schedule);
  document.addEventListener("keyup", schedule);
  render();
})();
