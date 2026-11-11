// =====================================
// INPUT COMPONENTS A-G
// Add / Toggle / Rename. Loaded after gates.js.
// =====================================
(() => {
    "use strict";
    const rows = Array.from(document.querySelectorAll(".inputs-column .input-row"));
    const inputStates = new Map(rows.map(row => [row.dataset.inputKey, {
        label: row.dataset.inputKey,
        value: row.dataset.inputKey === "A" ? 1 : 0
    }]));

    const INPUT_X = 12;
    const INPUT_Y = 12;
    const INPUT_STEP = 70;
    const WIDTH = 80;
    const HEIGHT = 60;

    function inputSvgs(key) {
        return drawingArea.querySelectorAll(`.logic-gate svg[data-input-key="${key}"]`);
    }

    function repaintInput(svg, state) {
        const labelNode = svg.querySelector(".source-label");
        const valueNode = svg.querySelector(".source-value");
        if (labelNode) labelNode.textContent = state.label;
        if (valueNode) valueNode.textContent = String(state.value);
        svg.dataset.value = String(state.value);
        svg.dataset.label = state.label;
        const base = svg.querySelector(".source-frame");
        if (base) base.setAttribute("stroke", state.value ? "#39ff14" : "#00bfff");
    }

    function repaintExisting(key) {
        const state = inputStates.get(key);
        inputSvgs(key).forEach(svg => repaintInput(svg, state));
    }

    function occupied(x, y) {
        return Array.from(drawingArea.querySelectorAll(".logic-gate")).some(gate => {
            const gx = parseFloat(gate.style.left) || 0;
            const gy = parseFloat(gate.style.top) || 0;
            return x < gx + gate.offsetWidth && x + WIDTH > gx &&
                   y < gy + gate.offsetHeight && y + HEIGHT > gy;
        });
    }

    function createInput(key, index) {
        const x = INPUT_X;
        const y = INPUT_Y + index * INPUT_STEP;
        if (occupied(x, y)) return;

        const gate = document.createElement("div");
        gate.className = "logic-gate";
        gate.dataset.type = "INPUT";
        gate.dataset.inputs = "0";
        gate.style.left = `${x}px`;
        gate.style.top = `${y}px`;
        gate.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 80" data-input-key="${key}">
                <rect class="source-frame" x="10" y="20" width="78" height="40" rx="9"
                      fill="#07152e" stroke="#00bfff" stroke-width="2.5" />
                <text class="source-label" x="34" y="46" font-family="Arial, sans-serif"
                      text-anchor="middle" font-size="19" font-weight="bold" fill="#ffffff"></text>
                <text class="source-value" x="73" y="46" font-family="Arial, sans-serif"
                      text-anchor="middle" font-size="15" font-weight="bold" fill="#39ff14"></text>
                <circle class="output-pin" cx="96" cy="40" r="4"
                        fill="#39ff14" stroke="none" />
            </svg>`;
        repaintInput(gate.querySelector("svg"), inputStates.get(key));
        drawingArea.appendChild(gate);
    }

    rows.forEach((row, index) => {
        const key = row.dataset.inputKey;
        const add = row.querySelector(".input-add");
        const toggle = row.querySelector(".input-switch");
        const rename = row.querySelector(".input-rename");
        const value = toggle.querySelector(".input-value");
        const label = row.querySelector(".input-symbol");

        add.addEventListener("click", () => createInput(key, index));
        toggle.addEventListener("click", () => {
            const state = inputStates.get(key);
            state.value = state.value ? 0 : 1;
            toggle.classList.toggle("on", Boolean(state.value));
            toggle.setAttribute("aria-pressed", String(Boolean(state.value)));
            value.textContent = String(state.value);
            repaintExisting(key);
        });
        rename.addEventListener("click", () => {
            const state = inputStates.get(key);
            const requested = prompt("Enter input name (1–8 characters):", state.label);
            if (requested === null) return;
            const next = requested.trim();
            if (!next || next.length > 8 || !/^[A-Za-z][A-Za-z0-9_]*$/.test(next)) {
                alert("Use 1–8 characters: letters, numbers, or underscore. Start with a letter.");
                return;
            }
            state.label = next;
            label.textContent = next;
            add.title = `Add input ${next} to canvas`;
            add.setAttribute("aria-label", `Add input ${next}`);
            rename.title = `Rename input ${next}`;
            toggle.title = `Toggle input ${next}`;
            repaintExisting(key);
        });
    });

    // Repaint after undo/redo or clipboard paste, including duplicate inputs.
    // SVG carries a stable slot key even when outer gate dataset is copied selectively.
    const inputObserver = new MutationObserver(records => {
        if (!records.some(r => r.type === "childList" &&
            Array.from(r.addedNodes).some(n => n.nodeType === 1 &&
                (n.matches?.(".logic-gate") || n.querySelector?.(".logic-gate"))))) return;
        for (const key of inputStates.keys()) repaintExisting(key);
    });
    inputObserver.observe(drawingArea, {childList:true});
})();
