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
      incoming.get(wire.toGate).set(Number(wire.inputIndex), {gate: wire.fromGate, pin: wire.outputIndex || 0});
    }
    // Convert every explicit branch and endpoint junction into real signal
    // edges. Crossing-only wires remain electrically independent.
    const resolved = window.__dlaResolveWireNets?.();
    if (resolved) for (const [gate, pins] of resolved.incoming) {
      if (!incoming.has(gate)) incoming.set(gate, new Map());
      for (const [pin, source] of pins) incoming.get(gate).set(pin, source);
    }
    // Fixed-point propagation: unlike a recursive stack-only evaluator, this
    // resolves feedback loops when a controlling input forces the NAND state.
    // Unknown (null) remains unknown if no stable value can be established.
    const gateList=[...drawingArea.querySelectorAll('.logic-gate')];
    const memory=new Map(), ffMemory=new Map();
    let prior=new Map(), current=new Map(), evaluation=null;
    const allOutputs=[...drawingArea.querySelectorAll('.output-node')];
    function onePass() {
      const cache=new Map(), stack=new Set();
      function evaluate(gate,pin=0) {
        const key=`${gateList.indexOf(gate)}:${pin}`;
        if(cache.has(key))return cache.get(key);
        if(stack.has(key))return prior.has(key)?prior.get(key):null;
        stack.add(key);
        const type=gate.dataset.type;
        let value=null;
        if(type==='CLOCK')value=gate.dataset.clockValue==='1'?1:0;
        else if(type==='INPUT') {
          const bit=gate.querySelector('svg')?.dataset.value;
          value=bit==='0'?0:bit==='1'?1:null;
        } else if(type!=='OUTPUT') {
          const count=type==='NOT'?1:Math.max(2,Number(gate.dataset.inputs)||2);
          const parents=incoming.get(gate)||new Map();
          const bits=Array.from({length:count},(_,i)=>{
            const source=parents.get(i);
            return source?.gate?evaluate(source.gate,source.pin):null;
          });
          if(type==='FLIP_FLOP') {
            if(!ffMemory.has(gate))ffMemory.set(gate,window.flipFlopLogic.step(gate,bits));
            const q=ffMemory.get(gate);
            value=pin===0?q:pin===1&&q!==null?1-q:null;
          } else if(type==='LATCH') {
            if(!memory.has(gate))memory.set(gate,window.latchLogic.step(gate,bits));
            const q=memory.get(gate);
            value=pin===0?q:pin===1&&q!==null?1-q:null;
          } else value=(type==='MUX'||type==='DEMUX')?
            window.muxLogic.evaluate(bits,pin,gate.dataset.muxSize,gate.dataset.enable==='1',type)
            :(type==='ENCODER'||type==='DECODER')?
            window.encoderDecoderLogic.evaluate(type,bits,pin,gate.dataset.enable==='1')
            :type==='HALF_ADDER'?(bits.includes(null)?null:pin===1?(bits[0]&bits[1]):(bits[0]^bits[1]))
            :type==='FULL_ADDER'?(bits.includes(null)?null:pin===1?((bits[0]&bits[1])|(bits[2]&(bits[0]^bits[1]))):(bits[0]^bits[1]^bits[2]))
            :type==='COMPARATOR'?(bits.includes(null)?null:pin===0?Number(bits[0]<bits[1]):pin===1?Number(bits[0]===bits[1]):pin===2?Number(bits[0]>bits[1]):null)
            :type==='PARALLEL_ADDER'?window.parallelAdderLogic.evaluate(bits,pin)
            :gateResult(type,bits);
        }
        stack.delete(key);cache.set(key,value);
        current.set(key,value);
        return value;
      }
      const results=allOutputs.map(node=>{
        const src=incoming.get(node)?.get(0);
        return src?.gate?evaluate(src.gate,src.pin):null;
      });
      // Evaluate all gate outputs, including feedback sections not directly
      // selected by output traversal, to let each round settle the network.
      for(const gate of gateList) {
        const count=gate.querySelectorAll('.output-pin').length;
        for(let p=0;p<count;p++)evaluate(gate,p);
      }
      return results;
    }
    let values=[], settled=false;
    for(let round=0;round<16;round++) {
      current=new Map();values=onePass();
      if(prior.size===current.size&&[...current].every(([k,v])=>prior.get(k)===v)) {
        settled=true;break;
      }
      prior=current;
    }
    if(!settled){
      // An oscillating combinational feedback network has no stable logic
      // state. Display unknown rather than an arbitrary 0 or 1.
      values=values.map(()=>null);
    }
    allOutputs.forEach((node,i)=>showOutput(node,values[i]));
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
    document.dispatchEvent(new CustomEvent("logic-run-state",{detail:{active}}));
    if (!active) drawingArea.querySelectorAll(".output-node").forEach(node => showOutput(node, null));
  });

  document.addEventListener("click", event => {
    if (!event.target.closest("#runBtn")) refreshSoon();
  });
  document.addEventListener("pointerup", refreshSoon);
  document.addEventListener("logic-clock-tick", refreshSoon);
  document.addEventListener("keyup", refreshSoon);
  const observer = new MutationObserver(records => {
    if (!active) return;
    if (records.some(r => r.type === "childList" &&
      [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1 &&
        (n.matches?.(".logic-gate, path") || n.querySelector?.(".logic-gate"))))) refreshSoon();
  });
  observer.observe(drawingArea, {childList: true, subtree: true});
})();
