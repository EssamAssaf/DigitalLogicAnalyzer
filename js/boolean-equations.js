// Boolean Equation panel — load after simulation.js.
// Expressions are derived from the circuit's actual connection graph.
(() => {
    "use strict";

    const host = document.querySelector(".circuit-section");
    if (!host || typeof drawingArea === "undefined" || typeof connections === "undefined") return;

    const style = document.createElement("style");
    style.textContent = `
      .boolean-equation-panel {
        margin-top: 18px;
        padding: 16px 20px;
        border: 1px solid #00bfff;
        border-radius: 10px;
        background: #08152b;
        box-shadow: 0 0 10px rgba(0,191,255,.16);
      }
      .boolean-equation-panel h3 {
        margin: 0 0 12px;
        color: #58c7ff;
        font-size: 19px;
        text-align: center;
      }
      .boolean-equation-list { display: grid; gap: 10px; }
      .boolean-equation-row {
        padding: 11px 14px;
        border: 1px solid #174973;
        background: #061127;
        border-radius: 8px;
        color: #f1f7ff;
        font: 17px/1.6 Consolas, 'Courier New', monospace;
        overflow-wrap: anywhere;
        user-select: text;
      }
      .boolean-equation-name { color: #39ff14; font-weight: bold; }
      .boolean-overline {
        text-decoration-line: overline;
        text-decoration-color: currentColor;
        text-decoration-thickness: 1.5px;
        text-decoration-skip-ink: none;
        display: inline-block;
        padding-top: 3px;
      }
      .boolean-equation-empty { color: #a9bacb; text-align: center; }
      .boolean-equation-note { margin: 10px 0 0; color: #8fa9c7; font-size: 12px; }
      .boolean-characteristic { color:#58c7ff; font-weight:700; }
      .boolean-equation-row { text-align:center; font-size:16px; line-height:1.7; }
      .boolean-equation-row .boolean-overline { padding-top:2px; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement("section");
    panel.className = "boolean-equation-panel";
    panel.setAttribute("aria-label", "Boolean Equations");
    panel.innerHTML = `
      <h3>Boolean Equations</h3>
      <div class="boolean-equation-list" aria-live="polite"></div>
      <p class="boolean-equation-note">Equations are generated from connected gates. ? indicates an unconnected input.</p>
    `;
    host.appendChild(panel);
    const list = panel.querySelector(".boolean-equation-list");
    let lastSignature = "";
    let scheduled = false;

    const parenthesize = expression => `(${expression})`;

    function calculateEquations() {
        const gates = Array.from(drawingArea.querySelectorAll(".logic-gate"));
        const live = new Set(gates);
        const incoming = new Map();
        for (const connection of connections) {
            if (!live.has(connection.fromGate) || !live.has(connection.toGate)) continue;
            if (!incoming.has(connection.toGate)) incoming.set(connection.toGate, new Map());
            incoming.get(connection.toGate).set(Number(connection.inputIndex), {gate:connection.fromGate, pin:connection.outputIndex || 0});
        }

        const cache = new Map();
        const visiting = new Set();
        function expression(gate, pin = 0) {
            if (!gate) return "?";
            const key = `${gates.indexOf(gate)}:${pin}`;
            if (cache.has(key)) return cache.get(key);
            if (visiting.has(key)) return "⟲"; // cyclic / feedback circuit
            visiting.add(key);
            const type = gate.dataset.type;
            let result;
            if (type === "INPUT") {
                const svg = gate.querySelector("svg");
                result = svg?.dataset.label || svg?.querySelector(".source-label")?.textContent?.trim() || "?";
            } else if (type === "OUTPUT") {
                const source = incoming.get(gate)?.get(0);
                result = expression(source?.gate, source?.pin || 0);
            } else {
                const count = type === "NOT" ? 1 : Math.min(16, Math.max(2, Number(gate.dataset.inputs) || 2));
                const inputs = (type === "LATCH" || type === "FLIP_FLOP" || type === "CLOCK")
                    ? [] : Array.from({ length: count }, (_, i) => expression(incoming.get(gate)?.get(i)?.gate, incoming.get(gate)?.get(i)?.pin || 0));
                // Sequential outputs denote stored state; do not recursively expand
                // memory and clock controls into unreadable ternary expressions.
                if (type === "FLIP_FLOP") result = pin === 0 ? "Q(t+1)" : "¬(Q(t+1))";
                else if (type === "CLOCK") result = "CLK";
                else if (type === "LATCH") result = pin === 0 ? "Q(t+1)" : "¬(Q(t+1))";
                else if (type === "MUX" || type === "DEMUX") result = window.muxLogic.expression(inputs, gate.dataset.muxSize, gate.dataset.enable === "1", type, pin);
                else if (type === "ENCODER" || type === "DECODER") result = window.encoderDecoderLogic.expression(type, inputs, pin, gate.dataset.enable === "1");
                else if (type === "HALF_ADDER") result = pin === 1 ? parenthesize(inputs.join(" · ")) : parenthesize(inputs.join(" ⊕ "));
                else if (type === "FULL_ADDER") result = pin === 1
                    ? `((${inputs[0]} · ${inputs[1]}) + (${inputs[2]} · (${inputs[0]} ⊕ ${inputs[1]})))`
                    : parenthesize(inputs.join(" ⊕ "));
                else if (type === "COMPARATOR") result = pin === 0 ? `(¬(${inputs[0]}) · ${inputs[1]})` : pin === 1 ? `¬(${inputs[0]} ⊕ ${inputs[1]})` : pin === 2 ? `(${inputs[0]} · ¬(${inputs[1]}))` : "?";
                else if (type === "PARALLEL_ADDER") result = window.parallelAdderLogic.expression(inputs, pin);
                else if (type === "NOT") result = `¬${parenthesize(inputs[0])}`;
                else if (type === "AND") result = parenthesize(inputs.join(" · "));
                else if (type === "OR") result = parenthesize(inputs.join(" + "));
                else if (type === "NAND") result = `¬${parenthesize(inputs.join(" · "))}`;
                else if (type === "NOR") result = `¬${parenthesize(inputs.join(" + "))}`;
                else if (type === "XOR") result = parenthesize(inputs.join(" ⊕ "));
                else if (type === "XNOR") result = `¬${parenthesize(inputs.join(" ⊕ "))}`;
                else result = "?";
            }
            visiting.delete(key);
            cache.set(key, result);
            return result;
        }

        return gates.filter(gate => gate.dataset.type === "OUTPUT").map(output => ({
            label: output.dataset.outputLabel || output.querySelector(".output-label")?.textContent?.trim() || "Y",
            formula: expression(output)
        }));
    }

    function characteristicEquations() {
        const sequential = Array.from(drawingArea.querySelectorAll('.logic-gate'))
            .filter(gate => gate.dataset.type === 'LATCH' || gate.dataset.type === 'FLIP_FLOP');
        const seen = new Set();
        const rows = [];
        for (const gate of sequential) {
            const kind = gate.dataset.type === 'FLIP_FLOP' ? gate.dataset.ffKind : gate.dataset.latchKind;
            if (!['D','SR','JK'].includes(kind) || seen.has(kind)) continue;
            seen.add(kind);
            const formula = kind === 'D'
                ? 'Q(t+1) = D(t)'
                : kind === 'SR'
                ? 'Q(t+1) = S(t) + ¬(R(t)) · Q(t)'
                : 'Q(t+1) = J(t) · ¬(Q(t)) + ¬(K(t)) · Q(t)';
            rows.push({
                label: `${kind} ${gate.dataset.type === 'FLIP_FLOP' ? 'Flip-Flop' : 'Latch'}`,
                formula,
                note: kind === 'SR' ? 'S=R=1: Undefined.' : ''
            });
        }
        return rows;
    }

    // Render logical NOT as a bar ABOVE its operand, not as a side symbol.
    // Parse text into DOM nodes (no HTML injection from edited input labels).
    function renderFormula(formula) {
        const root = document.createDocumentFragment();

        function appendRange(container, from, to) {
            let plain = "";
            const flush = () => {
                if (plain) container.appendChild(document.createTextNode(plain));
                plain = "";
            };

            for (let i = from; i < to; i++) {
                if (formula[i] === "¬" && formula[i + 1] === "(") {
                    let depth = 1;
                    let end = i + 2;
                    while (end < to && depth > 0) {
                        if (formula[end] === "(") depth++;
                        if (formula[end] === ")") depth--;
                        end++;
                    }
                    if (depth === 0) {
                        flush();
                        const overline = document.createElement("span");
                        overline.className = "boolean-overline";
                        appendRange(overline, i + 2, end - 1);
                        container.appendChild(overline);
                        i = end - 1;
                        continue;
                    }
                }
                plain += formula[i];
            }
            flush();
        }

        appendRange(root, 0, formula.length);
        return root;
    }

    function render() {
        scheduled = false;
        const equations = calculateEquations();
        const characteristic = characteristicEquations();
        const signature = JSON.stringify({equations, characteristic});
        if (signature === lastSignature) return;
        lastSignature = signature;
        list.replaceChildren();
        for (const item of characteristic) {
            const row = document.createElement('div');
            row.className = 'boolean-equation-row';
            const title = document.createElement('span');
            title.className = 'boolean-characteristic';
            title.textContent = `${item.label}: `;
            row.append(title, renderFormula(item.formula));
            if (item.note) {
                const note = document.createElement('div');
                note.style.cssText = 'font:12px/1.5 Arial,sans-serif;color:#ffb65c;margin-top:4px';
                note.textContent = item.note;
                row.append(note);
            }
            list.appendChild(row);
        }
        if (!equations.length && !characteristic.length) {
            const empty = document.createElement('div');
            empty.className = 'boolean-equation-row boolean-equation-empty';
            empty.textContent = 'Add and connect an Output to display its Boolean equation.';
            list.appendChild(empty);
        }
        for (const {label, formula} of equations) {
            const row = document.createElement('div');
            row.className = 'boolean-equation-row';
            const name = document.createElement('span');
            name.className = 'boolean-equation-name';
            name.textContent = label;
            row.append(name, document.createTextNode(' = '), renderFormula(formula));
            list.appendChild(row);
        }
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(render);
    }

    // Observe gate additions/removals, label changes, input count and pin changes.
    // Do not watch SVG wire path geometry, which changes frequently while dragging.
    const observer = new MutationObserver(records => {
        if (records.some(r => r.type === "childList" ||
            (r.type === "attributes" && (r.attributeName === "data-inputs" ||
              r.attributeName === "data-label" || r.attributeName === "data-output-label" ||
              r.attributeName === "data-latch-kind" || r.attributeName === "data-ff-kind" ||
              r.attributeName === "data-master-slave-role" || r.attributeName === "data-enable")))) schedule();
    });
    observer.observe(drawingArea, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-inputs", "data-label", "data-output-label", "data-latch-kind", "data-ff-kind", "data-master-slave-role", "data-enable"]
    });
    // Wire creation/deletion and in-place editing are also reflected in interactions.
    document.addEventListener("click", schedule);
    document.addEventListener("keyup", schedule);
    document.addEventListener("pointerup", schedule);
    render();
})();
