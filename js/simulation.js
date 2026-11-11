// COMBINATIONAL LOGIC SIMULATION - load last, after outputs.js
(() => {
  "use strict";
  const run = document.getElementById("runBtn");
  if (!run) return;
  let active = false;
  let queued = false;
  const flip = value => value === null ? null : 1 - value;

  function gateResult(type, values) {
    if (type === "NOT") return flip(values[0] ?? null);
    if (type === "AND" || type === "NAND") {
      const value = values.includes(0) ? 0 : values.includes(null) ? null : 1;
      return type === "NAND" ? flip(value) : value;
    }
    if (type === "OR" || type === "NOR") {
      const value = values.includes(1) ? 1 : values.includes(null) ? null : 0;
      return type === "NOR" ? flip(value) : value;
    }
    if (type === "XOR" || type === "XNOR") {
      if (values.includes(null)) return null;
      const value = values.reduce((result, bit) => result ^ bit, 0);
      return type === "XNOR" ? flip(value) : value;
    }
    return null;
  }

  function setAttr(node, attr, value) {
    if (node && node.getAttribute(attr) !== String(value)) node.setAttribute(attr, String(value));
  }

  function showOutput(node, bit) {
    const svg = node.querySelector("svg");
    if (!svg) return;
    const lamp = svg.querySelector(".output-lamp");
    const value = svg.querySelector(".output-value");
    const frame = svg.querySelector(".output-frame");
    const color = bit === 1 ? "#39ff14" : bit === 0 ? "#ff3030" : "#46576a";
    setAttr(svg, "data-value", bit === null ? "unknown" : bit);
    setAttr(lamp, "fill", color);
    setAttr(lamp, "stroke", bit === null ? "#9baec3" : color);
    setAttr(frame, "stroke", bit === null ? "#00bfff" : color);
    const display = bit === null ? "–" : String(bit);
    if (value && value.textContent !== display) value.textContent = display;
    if (lamp) {
      const glow = bit === null ? "none" : `drop-shadow(0 0 6px ${color})`;
      if (lamp.style.filter !== glow) lamp.style.filter = glow;
    }
  }

  function calculate() {
    const incoming = new Map();
    for (const wire of connections) {
      if (!wire.fromGate?.isConnected || !wire.toGate?.isConnected) continue;
      if (!incoming.has(wire.toGate)) incoming.set(wire.toGate, new Map());
      incoming.get(wire.toGate).set(Number(wire.inputIndex), wire.fromGate);
    }
    const cache = new Map();
    const stack = new Set();
    function evaluate(gate) {
      if (cache.has(gate)) return cache.get(gate);
      if (stack.has(gate)) return null; // feedback without clock is unknown
      stack.add(gate);
      const type = gate.dataset.type;
      let result = null;
      if (type === "INPUT") {
        const bit = gate.querySelector("svg")?.dataset.value;
        result = bit === "0" ? 0 : bit === "1" ? 1 : null;
      } else if (type !== "OUTPUT") {
        const count = type === "NOT" ? 1 : Math.max(2, Number(gate.dataset.inputs) || 2);
        const parents = incoming.get(gate) || new Map();
        const bits = Array.from({length: count}, (_, i) => {
          const source = parents.get(i);
          return source ? evaluate(source) : null;
        });
        result = gateResult(type, bits);
      }
      stack.delete(gate);
      cache.set(gate, result);
      return result;
    }
    drawingArea.querySelectorAll(".output-node").forEach(node => {
      const parent = incoming.get(node)?.get(0);
      showOutput(node, parent ? evaluate(parent) : null);
    });
  }

  function refreshSoon() {
    if (!active || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (active) calculate();
    });
  }

  run.disabled = false;
  run.title = "Run or stop logic simulation";
  run.addEventListener("click", () => {
    active = !active;
    run.textContent = active ? "■ Stop" : "▶ Run";
    run.setAttribute("aria-pressed", String(active));
    if (active) calculate();
    else drawingArea.querySelectorAll(".output-node").forEach(node => showOutput(node, null));
  });

  document.addEventListener("click", event => {
    if (!event.target.closest("#runBtn")) refreshSoon();
  });
  document.addEventListener("pointerup", refreshSoon);
  document.addEventListener("keyup", refreshSoon);
  const observer = new MutationObserver(records => {
    if (!active) return;
    if (records.some(r => r.type === "childList" &&
      [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 &&
        (n.matches?.(".logic-gate, path") || n.querySelector?.(".logic-gate"))))) refreshSoon();
  });
  observer.observe(drawingArea, {childList: true, subtree: true});
})();
