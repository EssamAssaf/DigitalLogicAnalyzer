// ==========================================================
// LOGIC OUTPUT (LED) — component placement / rename / wiring
// OUTPUT is a standard .logic-gate with a single .input-pin.
// The LED stays in standby until the simulation engine exists.
// ==========================================================
(() => {
    "use strict";

    const addButton = document.getElementById("addOutputBtn");
    const renameButton = document.getElementById("renameOutputBtn");
    if (!addButton || !renameButton) return;

    // Six independently named output slots, presented in two rows.
    const slots = ["X", "Y", "Z", "W", "V", "U"].map((name, index) => ({
        index, name, button: null
    }));
    let activeSlot = 0;
    let serial = 0;
    const WIDTH = 80;
    const HEIGHT = 60;

    // Replace only the old Add Output button. Keep the existing pencil and LED legend.
    const controlRow = addButton.closest('.output-control-row') || addButton.parentElement;
    const legend = controlRow.querySelector('.output-legend');
    const palette = document.createElement("div");
    palette.className = "output-slot-grid";
    palette.setAttribute("role", "group");
    palette.setAttribute("aria-label", "Output components");
    addButton.replaceWith(palette);

    // Compact two-row controls: the pencil stays on the right, with LEDs stacked below.
    const tools = document.createElement('div');
    tools.className = 'output-side-tools';
    controlRow.appendChild(tools);
    tools.appendChild(renameButton);
    if (legend) {
        const leds = [...legend.querySelectorAll('.legend-led')];
        const labels = [...legend.querySelectorAll('span')].filter(el => !el.classList.contains('legend-led'));
        legend.classList.add('output-legend-vertical');
        legend.replaceChildren();
        for (let i = 0; i < leds.length; i++) {
            const row = document.createElement('span');
            row.className = 'output-led-row';
            row.appendChild(leds[i]);
            if (labels[i]) row.appendChild(labels[i]);
            legend.appendChild(row);
        }
        tools.appendChild(legend);
    }

    const style = document.createElement("style");
    style.textContent = `
      /* Match the compact Inputs palette and the approved two-row design. */
      .outputs-panel .output-control-row {
        display: flex !important;
        align-items: stretch !important;
        gap: 7px !important;
        width: 100%;
        min-width: 0;
      }
      .outputs-panel .output-slot-grid {
        display: grid !important;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        grid-template-rows: repeat(2, 25px);
        gap: 5px;
        flex: 1 1 auto;
        min-width: 0;
        align-self: center;
        padding: 4px;
        border: 1px solid #00bfff;
        border-radius: 7px;
        background: #07152e;
      }
      .outputs-panel .output-slot-button {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        width: 100%;
        height: 25px;
        padding: 0 2px;
        border: 1px solid #d8e9f9;
        border-radius: 5px;
        box-sizing: border-box;
        background: #07152e;
        color: #fff;
        font: 700 12px/1 Arial,sans-serif;
        text-align: center;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .outputs-panel .output-slot-button::after {
        content: '•';
        color: #00dfff;
        font-size: 11px;
        margin-left: 3px;
      }
      .outputs-panel .output-slot-button:hover {
        background: #123654;
        box-shadow: 0 0 5px #00bfff;
      }
      .outputs-panel .output-slot-button.active {
        border-color: #39fffa;
      }
      .outputs-panel .output-slot-button:disabled { opacity: .55; cursor: not-allowed; }
      .outputs-panel .output-slot-button:focus-visible { outline: 2px solid #fff; }
      .outputs-panel .output-side-tools {
        display: grid;
        grid-template-rows: 25px 19px 19px;
        gap: 3px;
        flex: 0 0 58px;
        min-width: 0;
        padding-left: 7px;
        border-left: 1px solid #00bfff;
        box-sizing: border-box;
        align-items: center;
      }
      .outputs-panel .output-side-tools #renameOutputBtn {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        min-width: 0;
        height: 25px;
        margin: 0;
        padding: 0;
        border: 1px solid #00bfff;
        border-radius: 5px;
        background: #07152e;
        color: #fff;
        font-size: 17px;
        cursor: pointer;
      }
      .outputs-panel .output-side-tools .output-legend-vertical {
        display: contents !important;
      }
      .outputs-panel .output-led-row {
        display: flex;
        align-items: center;
        justify-content: space-evenly;
        gap: 2px;
        height: 19px;
        font-size: 11px;
        color: #fff;
        border: 1px solid #00bfff;
        border-radius: 5px;
      }
      .outputs-panel .output-led-row .legend-led { flex-shrink: 0; }
      /* Reset the global .components-panel button margins: they caused
         the second row to overlap the first one. */
      .outputs-panel .output-slot-grid > .output-slot-button {
        margin: 0 !important;
        padding: 0 2px !important;
        height: 26px !important;
        min-height: 0 !important;
        line-height: 1 !important;
        box-sizing: border-box !important;
        align-self: stretch;
        transition: background-color .15s, box-shadow .15s;
      }
      .outputs-panel .output-slot-grid {
        grid-template-rows: repeat(2, 26px) !important;
        align-content: center;
        align-items: stretch;
        gap: 5px !important;
        padding: 4px !important;
        box-sizing: border-box;
      }
      .outputs-panel .output-side-tools > #renameOutputBtn {
        margin: 0 !important;
        padding: 0 !important;
        height: 26px !important;
        min-height: 0 !important;
        box-sizing: border-box;
      }
      .outputs-panel .output-side-tools {
        grid-template-rows: 26px 20px 20px !important;
        gap: 3px;
        padding-left: 7px;
        align-self: center;
      }
      .outputs-panel .output-led-row {
        height: 20px !important;
        min-height: 0;
        box-sizing: border-box;
      }
      /* Balanced LED legend: same width, height and centered content. */
      .outputs-panel .output-side-tools {
        grid-template-rows: repeat(3, 22px) !important;
        row-gap: 2px !important;
        align-content: center !important;
        justify-items: stretch !important;
      }
      .outputs-panel .output-side-tools > #renameOutputBtn {
        height: 22px !important;
        min-height: 22px !important;
      }
      .outputs-panel .output-led-row {
        display: grid !important;
        grid-template-columns: 15px 1fr !important;
        align-items: center !important;
        justify-items: center !important;
        column-gap: 2px !important;
        width: 100% !important;
        height: 22px !important;
        min-height: 22px !important;
        padding: 0 3px !important;
        margin: 0 !important;
        line-height: 1 !important;
        box-sizing: border-box !important;
      }
      .outputs-panel .output-led-row .legend-led {
        width: 11px !important;
        height: 11px !important;
        margin: 0 !important;
        display: block !important;
        border-radius: 50% !important;
      }
      .outputs-panel .output-led-row > span:not(.legend-led) {
        justify-self: center !important;
        margin: 0 !important;
        padding: 0 !important;
        font: 700 11px/1 Arial,sans-serif !important;
      }
      @media (max-width: 420px) {
        .outputs-panel .output-side-tools { flex-basis: 50px; }
        .outputs-panel .output-slot-grid { gap: 3px; padding: 3px; }
      }
    `;
    document.head.appendChild(style);

    function slotNode(slot) {
        return [...drawingArea.querySelectorAll('.output-node')].find(
            node => node.dataset.outputSlot === String(slot.index));
    }

    function refreshPalette() {
        for (const slot of slots) {
            const button = slot.button;
            button.textContent = slot.name;
            button.title = slotNode(slot)
                ? `Output ${slot.name} is already on canvas`
                : `Add output ${slot.name} to canvas`;
            button.disabled = Boolean(slotNode(slot));
            button.classList.toggle('active', activeSlot === slot.index);
            button.setAttribute('aria-label', button.title);
        }
    }

    for (const slot of slots) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'output-slot-button';
        button.addEventListener('click', () => {
            activeSlot = slot.index;
            createOutput(slot);
            refreshPalette();
        });
        slot.button = button;
        palette.appendChild(button);
    }

    function isOccupied(x, y) {
        return [...drawingArea.querySelectorAll(".logic-gate")].some(node => {
            const nx = Number.parseFloat(node.style.left) || 0;
            const ny = Number.parseFloat(node.style.top) || 0;
            return x < nx + node.offsetWidth &&
                x + WIDTH > nx && y < ny + node.offsetHeight &&
                y + HEIGHT > ny;
        });
    }

    // Align X/Y/Z/W/V/U vertically with A/B/C/D/E/F respectively.
    // The source and output SVGs use the same viewBox and pin y=40,
    // so matching their top coordinates puts the connection pins on one line.
    function availablePosition(slot) {
        const xMax = Math.max(0, drawingArea.clientWidth - WIDTH);
        const yMax = Math.max(0, drawingArea.clientHeight - HEIGHT);
        const index = slot.index;
        const inputKey = ["A", "B", "C", "D", "E", "F"][index];
        const sourceSvg = [...drawingArea.querySelectorAll('svg[data-input-key]')]
            .find(svg => svg.dataset.inputKey === inputKey);
        const sourceGate = sourceSvg?.closest('.logic-gate');
        const sourceY = sourceGate
            ? Number.parseFloat(sourceGate.style.top) || 0
            : 12 + index * 70;
        const preferredY = Math.max(0, Math.min(yMax, sourceY));
        const rightX = Math.floor(xMax / 20) * 20;

        // Prefer the exact matching row on the far right.
        // If occupied, look for another empty position without overlap.
        const candidateYs = [preferredY];
        for (let delta = 20; delta <= yMax; delta += 20) {
            if (preferredY + delta <= yMax) candidateYs.push(preferredY + delta);
            if (preferredY - delta >= 0) candidateYs.push(preferredY - delta);
        }
        for (let x = rightX; x >= 0; x -= 100) {
            for (const y of candidateYs) {
                if (!isOccupied(x, y)) return { x, y };
            }
        }
        return null;
    }

    function safeName(value) {
        const text = value.trim();
        return text.length >= 1 && text.length <= 8 &&
            /^[A-Za-z][A-Za-z0-9_]*$/.test(text) ? text : null;
    }

    function askName(current) {
        const answer = prompt("Enter output name (1–8 characters):", current);
        if (answer === null) return null;
        const valid = safeName(answer);
        if (!valid) {
            alert("Use 1–8 characters: letters, numbers or underscore. Start with a letter.");
            return null;
        }
        return valid;
    }

    function changeNodeName(node, value) {
        node.dataset.outputLabel = value;
        const svg = node.querySelector("svg");
        if (!svg) return;
        svg.dataset.outputLabel = value;
        const label = svg.querySelector(".output-label");
        if (label) label.textContent = value;
    }

    function createOutput(slot) {
        if (slotNode(slot)) return;
        const position = availablePosition(slot);
        if (!position) {
            alert("No empty space for a new output. Move components to make room.");
            return;
        }
        const node = document.createElement("div");
        node.className = "logic-gate output-node";
        node.dataset.type = "OUTPUT";
        node.dataset.inputs = "1";
        node.dataset.outputId = String(++serial);
        node.dataset.outputSlot = String(slot.index);
        node.style.left = `${position.x}px`;
        node.style.top = `${position.y}px`;
        node.title = "Double-click to rename output";
        node.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 80"
                 data-output-label="Y" data-value="unknown">
                <rect class="output-frame" x="18" y="20" width="77" height="40" rx="11"
                      fill="#07152e" stroke="#00bfff" stroke-width="2.6"/>
                <text class="output-label" x="42" y="46"
                      font-family="Arial,sans-serif" font-size="18" font-weight="bold"
                      text-anchor="middle" fill="white">Y</text>
                <circle class="output-lamp" cx="79" cy="40" r="12"
                        fill="#46576a" stroke="#9baec3" stroke-width="2" />
                <text class="output-value" x="79" y="45" text-anchor="middle"
                      font-size="12" font-weight="bold" fill="white">–</text>
                <circle class="input-pin" data-pin="0" cx="12" cy="40" r="4"
                        fill="#00ffff" stroke="none"/>
            </svg>`;
        changeNodeName(node, slot.name);
        drawingArea.appendChild(node);
        refreshPalette();
        // A source gate can connect to this OUTPUT's cyan input-pin using
        // the existing bidirectional wiring, without any wire-system changes.
    }

    function nameInUse(name, ignoredSlot = null, ignoredNode = null) {
        const normalized = name.toUpperCase();
        return slots.some(slot => slot !== ignoredSlot && slot.name.toUpperCase() === normalized) ||
            [...drawingArea.querySelectorAll('.output-node')].some(node =>
                node !== ignoredNode && (node.dataset.outputLabel || '').toUpperCase() === normalized);
    }

    // The existing pencil renames the last-selected output slot, including its canvas item.
    renameButton.addEventListener('click', () => {
        const slot = slots[activeSlot];
        const name = askName(slot.name);
        if (name === null) return;
        const node = slotNode(slot);
        if (nameInUse(name, slot, node)) {
            alert('Each output must have a unique name.');
            return;
        }
        slot.name = name;
        if (node) changeNodeName(node, name);
        refreshPalette();
    });

    drawingArea.addEventListener('dblclick', event => {
        const node = event.target.closest('.output-node');
        if (!node || event.target.closest('.input-pin')) return;
        event.preventDefault();
        const slot = slots[Number(node.dataset.outputSlot)];
        const name = askName(node.dataset.outputLabel || 'Y');
        if (name === null) return;
        if (nameInUse(name, slot || null, node)) {
            alert('Each output must have a unique name.');
            return;
        }
        changeNodeName(node, name);
        if (slot) {
            slot.name = name;
            activeSlot = slot.index;
        }
        refreshPalette();
    });

    // Update availability when outputs are removed, restored or loaded.
    const observer = new MutationObserver(() => refreshPalette());
    observer.observe(drawingArea, {childList:true});
    refreshPalette();
})();
