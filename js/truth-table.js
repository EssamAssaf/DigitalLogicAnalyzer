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
      border-radius:10px; background:#08152b; box-shadow:0 0 10px rgba(0,191,255,.16); display:flex; flex-direction:column; min-width:0; }
    .truth-table-panel h3 { margin:0 0 12px; text-align:center; color:#58c7ff; font-size:19px; }
    /* Inner frame surrounds only the table area; the explanatory note stays below it. */
    .truth-table-content { flex:1 1 auto; min-height:260px; border:1px solid #174973;
      border-radius:7px; padding:8px 12px; display:flex; flex-direction:column;
      align-items:center; justify-content:center; min-width:0; box-sizing:border-box; }
    .truth-table-scroll { width:max-content; max-width:100%; margin:0 auto; overflow-x:auto; border:1px solid #174973; border-radius:8px; }
    .truth-table { width:max-content; max-width:none; border-collapse:collapse; color:#f1f7ff; text-align:center;
      font:15px/1.5 Consolas,'Courier New',monospace; }
    .truth-table th,.truth-table td { min-width:45px; padding:6px 10px; border:1px solid #174973; white-space:nowrap; }
    .truth-table th { background:#10345a; color:#58c7ff; position:sticky; top:0; }
    .truth-table td { background:#061127; }
    .truth-table tbody tr:nth-child(even) td { background:#091b33; }
    .truth-table td.tt-one { color:#39ff14; font-weight:bold; }
    .truth-table td.tt-zero { color:#f1f7ff; }
    .truth-table td.tt-unknown { color:#ffb65c; font-weight:bold; }
    /* Render Q-bar with a distinct, full-width overline (not a combining accent). */
    .tt-qbar { display:inline-block; position:relative; padding-top:3px; line-height:1.15; }
    .tt-qbar::before { content:""; position:absolute; height:2px; background:currentColor;
      left:-1px; right:-1px; top:1px; border-radius:1px; }
    .truth-table-msg { margin:8px 0; text-align:center; color:#a9bacb; }
    .truth-table-note { margin:auto 0 0; padding-top:12px; text-align:center; line-height:1.5; font-size:12px; color:#8fa9c7; }
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
      incoming.get(c.toGate).set(Number(c.inputIndex), {gate:c.fromGate, pin:c.outputIndex || 0});
    }
    const used = new Set();
    const visited = new Set();
    function trace(gate) {
      if (!gate || visited.has(gate)) return;
      visited.add(gate);
      if (gate.dataset.type === "INPUT") { used.add(gate); return; }
      for (const source of incoming.get(gate)?.values() || []) trace(source.gate);
    }
    outputs.forEach(trace);
    const inputs = gates.filter(g => used.has(g));
    const inputLabel = gate => gate.querySelector("svg")?.dataset.label ||
      gate.querySelector(".source-label")?.textContent?.trim() || "?";
    const outputLabel = gate => gate.dataset.outputLabel ||
      gate.querySelector(".output-label")?.textContent?.trim() || "Y";
    return {inputs, outputs, incoming, inputLabel, outputLabel};
  }

  function getValue(gate, rowValues, incoming, memo, visiting, pin = 0) {
    if (!gate) return null;
    const key = `${gate?.__haId || (gate.__haId = Math.random().toString(36).slice(2))}:${pin}`;
    if (memo.has(key)) return memo.get(key);
    if (visiting.has(key)) return null;
    visiting.add(key);
    const type = gate.dataset.type;
    let value = null;
    if (type === "INPUT") value = rowValues.has(gate) ? rowValues.get(gate) : null;
    else if (type === "OUTPUT") value = getValue(incoming.get(gate)?.get(0)?.gate, rowValues, incoming, memo, visiting, incoming.get(gate)?.get(0)?.pin || 0);
    else {
      const count = type === "NOT" ? 1 : Math.min(16, Math.max(2, Number(gate.dataset.inputs) || 2));
      const sources = incoming.get(gate) || new Map();
      const bits = Array.from({length:count}, (_,i) => getValue(sources.get(i)?.gate, rowValues, incoming, memo, visiting, sources.get(i)?.pin || 0));
      value = (type === "MUX" || type === "DEMUX") ? window.muxLogic.evaluate(bits, pin, gate.dataset.muxSize, gate.dataset.enable === "1", type)
        : (type === "ENCODER" || type === "DECODER")
        ? window.encoderDecoderLogic.evaluate(type, bits, pin, gate.dataset.enable === "1")
        : type === "HALF_ADDER" ? (bits.includes(null) ? null : pin === 1 ? bits[0] & bits[1] : bits[0] ^ bits[1])
        : type === "FULL_ADDER" ? (bits.includes(null) ? null : pin === 1 ? ((bits[0] & bits[1]) | (bits[2] & (bits[0] ^ bits[1]))) : (bits[0] ^ bits[1] ^ bits[2]))
        : type === "COMPARATOR" ? (bits.includes(null) ? null : pin === 0 ? Number(bits[0] < bits[1]) : pin === 1 ? Number(bits[0] === bits[1]) : pin === 2 ? Number(bits[0] > bits[1]) : null)
        : type === "PARALLEL_ADDER" ? window.parallelAdderLogic.evaluate(bits, pin)
        : gateLogic(type, bits);
    }
    visiting.delete(key);
    memo.set(key, value);
    return value;
  }

  function render() {
    scheduled = false;
    const {inputs, outputs, incoming, inputLabel, outputLabel} = getModel();
    // Signature tracks changes to connectivity, gate types/input counts and editable names.
    const gates = [...drawingArea.querySelectorAll(".logic-gate")];
    const ids = new Map(gates.map((gate, i) => [gate, i]));
    const signature = JSON.stringify({
      gates: gates.map(g => [g.dataset.type, g.dataset.inputs, g.dataset.enable, g.dataset.muxSize, g.dataset.ffKind, g.dataset.edge,
        g.dataset.type === "INPUT" ? inputLabel(g) : "",
        g.dataset.type === "OUTPUT" ? outputLabel(g) : ""]),
      edges: connections.filter(c => ids.has(c.fromGate) && ids.has(c.toGate))
        .map(c => [ids.get(c.fromGate), ids.get(c.toGate), Number(c.inputIndex), c.outputIndex || 0]),
      columns: inputs.map(g => ids.get(g)), out: outputs.map(g => ids.get(g))
    });
    if (signature === oldSignature) return;
    oldSignature = signature;
    content.replaceChildren();
    const publish = payload => {
      window.__logicTruthData = payload;
      document.dispatchEvent(new CustomEvent('logic-truth-updated', {detail: payload}));
    };
    // Latches have memory: enumerate characteristic transitions using Q(t), not
    // a misleading combinational table. Suppress downstream K-map data for this circuit.
    const activeLatches=gates.filter(g=>g.dataset.type==='LATCH');
    // Flip-flops update at a clock edge, not at every input change.
    // Display the compact classroom characteristic table (not Q(t) as an extra input).
    const activeFFs=gates.filter(g=>g.dataset.type==='FLIP_FLOP');
    if(activeFFs.length){
      const ff=activeFFs[0],kind=ff.dataset.ffKind,enabled=ff.dataset.enable==='1';
      // Lecture-style characteristic tables: Q(t) is stored state, not an input.
      const names=(enabled?['E']:[]).concat(kind==='D'?['D','Q(t+1)','State']:
        kind==='SR'?['S(t)','R(t)','Q(t+1)','State']:
        ['J(t)','K(t)','Q(t+1)','State']);
      const scroller=document.createElement('div');scroller.className='truth-table-scroll';
      const table=document.createElement('table');table.className='truth-table';
      const head=document.createElement('thead'),h=document.createElement('tr');
      for(const name of names){const th=document.createElement('th');th.textContent=name;h.append(th);}
      head.append(h);table.append(head);
      const body=document.createElement('tbody');
      function row(values){
        const tr=document.createElement('tr');
        for(const v of values){const td=document.createElement('td');td.textContent=String(v);
          td.className=v===1?'tt-one':v===0?'tt-zero':'tt-unknown';tr.append(td);}
        body.append(tr);
      }
      if(enabled)row([0,...(kind==='D'?['X']:['X','X']),'Q(t)','No Change']);
      const lead=enabled?[1]:[];
      if(kind==='D'){
        row([...lead,0,0,'Reset']);row([...lead,1,1,'Set']);
      }else if(kind==='SR'){
        row([...lead,0,0,'Q(t)','No Change']);
        row([...lead,0,1,0,'Reset']);
        row([...lead,1,0,1,'Set']);
        row([...lead,1,1,'?','Undefined']);
      }else{
        row([...lead,0,0,'Q(t)','No Change']);
        row([...lead,0,1,0,'Reset']);
        row([...lead,1,0,1,'Set']);
        row([...lead,1,1,'¬Q(t)','Complement']);
      }
      table.append(body);scroller.append(table);content.append(scroller);
      // Equations belong to Boolean Equations, not inside the Truth Table.
      // Only the characteristic state table is shown here.
      publish(null);return;
    }
    if (activeLatches.length) {
      const latch=activeLatches[0];
      const kind=latch.dataset.latchKind,enabled=latch.dataset.enable==='1';
      // Master/Slave parts are built from latches. Show the SR/JK characteristic
      // tables in the lecture format without inventing a physical Q(t) input.
      if(latch.dataset.masterSlaveRole && (kind==='SR'||kind==='JK')){
        const scroller=document.createElement('div');scroller.className='truth-table-scroll';
        const table=document.createElement('table');table.className='truth-table';
        const head=document.createElement('thead'),h=document.createElement('tr');
        for(const name of (kind==='SR'?['S(t)','R(t)','Q(t+1)','State']:['J(t)','K(t)','Q(t+1)','State'])){
          const th=document.createElement('th');th.textContent=name;h.append(th);
        }
        head.append(h);table.append(head);
        const body=document.createElement('tbody');
        const states=kind==='SR'?
          [[0,0,'Q(t)','No Change'],[0,1,0,'Reset'],[1,0,1,'Set'],[1,1,'?','Undefined']]:
          [[0,0,'Q(t)','No Change'],[0,1,0,'Reset'],[1,0,1,'Set'],[1,1,'¬Q(t)','Complement']];
        for(const values of states){
          const tr=document.createElement('tr');
          for(const v of values){const td=document.createElement('td');td.textContent=String(v);
            td.className=v===1?'tt-one':v===0?'tt-zero':'tt-unknown';tr.append(td);}
          body.append(tr);
        }
        table.append(body);scroller.append(table);content.append(scroller);
        // Keep this section for the characteristic state table only.
        publish(null);return;
      }
      const names=kind==='SR'?['S','R']:kind==='D'?['D']:['J','K'];
      if(enabled)names.unshift('E');
      // SR follows the four-row classroom table: S, R, Q and Q̅.
      // Q is a retained state for S=R=0, not a third input.
      names.push('Q','Q̅');
      const scroller=document.createElement('div');scroller.className='truth-table-scroll';
      const table=document.createElement('table');table.className='truth-table';
      const header=document.createElement('thead'),headrow=document.createElement('tr');
      const setLatchText=(cell,value)=>{
        if(value==='Q̅'){
          const mark=document.createElement('span');
          mark.className='tt-qbar';
          mark.textContent='Q';
          cell.append(mark);
        }else cell.textContent=String(value);
      };
      for(const name of names){const th=document.createElement('th');setLatchText(th,name);headrow.append(th);}
      header.append(headrow);table.append(header);
      const body=document.createElement('tbody');
      const appendRow=values=>{
        const tr=document.createElement('tr');
        for(const v of values){
          const td=document.createElement('td');
          setLatchText(td,v);
          td.className=v===1?'tt-one':v===0?'tt-zero':'tt-unknown';
          tr.append(td);
        }
        body.append(tr);
      };
      if(kind==='SR'){
        if(enabled) appendRow([0,'X','X','Q','Q̅']); // E=0: retain prior state
        appendRow([...(enabled?[1]:[]),0,0,'Q','Q̅']); // No Change
        appendRow([...(enabled?[1]:[]),0,1,0,1]);   // Reset
        appendRow([...(enabled?[1]:[]),1,0,1,0]);   // Set
        appendRow([...(enabled?[1]:[]),1,1,'X','X']); // Undefined
      } else if(kind==='D'){
        // Classroom D-latch table: E and D are the only physical inputs.
        // When enabled, the retained Q state is symbolic, not another input.
        if(enabled){
          appendRow([0,'X','Q','Q̅']); // E=0: No Change, regardless of D.
          appendRow([1,0,0,1]);     // E=1, D=0: Reset.
          appendRow([1,1,1,0]);     // E=1, D=1: Set.
        } else {
          // Without an Enable pin, D follows the input (transparent behavior).
          appendRow([0,0,1]);
          appendRow([1,1,0]);
        }
      } else if(kind==='JK'){
        // Compact JK characteristic table used in the lecture: J, K, Q, Q̅.
        // Q and Q̅ in the Hold/Toggle rows denote the stored previous values,
        // not additional physical inputs. E=0 always retains the stored state.
        if(enabled) appendRow([0,'X','X','Q','Q̅']);
        appendRow([...(enabled?[1]:[]),0,0,'Q','Q̅']); // Hold
        appendRow([...(enabled?[1]:[]),0,1,0,1]);   // Reset
        appendRow([...(enabled?[1]:[]),1,0,1,0]);   // Set
        appendRow([...(enabled?[1]:[]),1,1,'Q̅','Q']); // Complement/toggle
      }
      table.append(body);scroller.append(table);content.append(scroller);
      const info=document.createElement('p');info.className='truth-table-msg';
      info.textContent=activeLatches.length>1
        ?'Showing the first latch table. Sequential circuits retain state across changes.'
        :'Q and Q̅ denote the stored state. X means don’t care or undefined, as applicable. For JK, J=K=1 complements the previous state.';
      content.append(info);
      publish(null);
      return;
    }
    if (!outputs.length) {
      const msg = document.createElement("p");
      msg.className = "truth-table-msg";
      msg.textContent = "Add and connect an Output to generate a truth table.";
      content.append(msg);
      publish(null);
      return;
    }
    if (inputs.length > MAX_INPUTS) {
      const msg = document.createElement("p");
      msg.className = "truth-table-msg";
      msg.textContent = `Truth Table supports up to ${MAX_INPUTS} connected inputs (${inputs.length} found).`;
      content.append(msg);
      publish(null);
      return;
    }
    const scroll = document.createElement("div");
    scroll.className = "truth-table-scroll";
    const table = document.createElement("table");
    table.className = "truth-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    // Display the physical Full Adder pin names in the Truth Table,
    // instead of the independently editable switch/LED names. The underlying
    // truth model retains the original labels to avoid changing K-map equations.
    const displayInput = gate => {
      const targets = [...incoming.entries()].filter(([target, pins]) =>
        (target.dataset.type === "FULL_ADDER" || target.dataset.type === "COMPARATOR" || target.dataset.type === "ENCODER" || target.dataset.type === "DECODER" || target.dataset.type === "MUX" || target.dataset.type === "DEMUX") &&
        [...pins.values()].some(edge => edge.gate === gate));
      for (const [target, pins] of targets) {
        for (const [pin, edge] of pins) {
          if (edge.gate === gate) {
            if (target.dataset.type === "MUX") { const count=Number(target.dataset.muxSize); return pin < count ? `I${pin}` : pin < count+Math.log2(count) ? `S${pin-count}` : "E"; }
            if (target.dataset.type === "DEMUX") return pin===0 ? "I" : pin<=Math.log2(Number(target.dataset.muxSize)) ? `S${pin-1}` : "E";
            if (target.dataset.type === "ENCODER") return `D${pin}`;
            if (target.dataset.type === "DECODER") return target.dataset.enable === "1" && pin === Number(target.dataset.inputs)-1 ? "E" : `A${Math.log2(Number(target.dataset.codecSize))-1-pin}`;
            return (target.dataset.type === "COMPARATOR" ? ["A", "B"] : ["A", "B", "Cin"])[pin] || inputLabel(gate);
          }
        }
      }
      return inputLabel(gate);
    };
    const displayOutput = gate => {
      const source = incoming.get(gate)?.get(0);
      if (source?.gate?.dataset.type === "MUX") return "Y";
      if (source?.gate?.dataset.type === "DEMUX") return `D${source.pin}`;
      if (source?.gate?.dataset.type === "ENCODER") return `Y${Math.log2(Number(source.gate.dataset.inputs))-1-source.pin}`;
      if (source?.gate?.dataset.type === "DECODER") return `Y${source.pin}`;
      if (source?.gate?.dataset.type === "COMPARATOR")
        return ["A < B", "A = B", "A > B"][source.pin] || outputLabel(gate);
      if (source?.gate?.dataset.type === "FULL_ADDER")
        return source.pin === 1 ? "Cout" : "SUM";
      if (source?.gate?.dataset.type === "HALF_ADDER")
        return source.pin === 1 ? "E" : "R";
      return outputLabel(gate);
    };
    [...inputs.map(displayInput), ...outputs.map(displayOutput)].forEach(label => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = label;
      headerRow.append(th);
    });
    thead.append(headerRow);
    table.append(thead);
    const tbody = document.createElement("tbody");
    const combinations = 2 ** inputs.length;
    const rows = [];
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
      const outputBits = [];
      outputs.forEach(gate => {
        outputBits.push(getValue(gate, values, incoming, memo, new Set()));
        const bit = getValue(gate, values, incoming, memo, new Set());
        const td = document.createElement("td");
        td.textContent = bit === null ? "–" : String(bit);
        td.className = bit === null ? "tt-unknown" : bit ? "tt-one" : "tt-zero";
        tr.append(td);
      });
      rows.push({inputs: inputs.map(g => values.get(g)), outputs: outputBits});
      tbody.append(tr);
    }
    table.append(tbody);
    scroll.append(table);
    content.append(scroll);
    publish({inputs: inputs.map(inputLabel), outputs: outputs.map(outputLabel), rows});
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
