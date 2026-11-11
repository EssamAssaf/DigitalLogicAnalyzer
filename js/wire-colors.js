// ============================================================
// SIGNAL-BASED WIRE COLORS
// Load AFTER junctions.js (and after all other circuit scripts).
// One source output = one color; all branches share that color.
// Colors are stored on the source SVG so Undo/Redo & copy preserve them.
// ============================================================
(() => {
    "use strict";

    const INPUT_COLORS = {
        A: "#00e5ff", // cyan
        B: "#ffd43b", // yellow
        C: "#52ff84", // green
        D: "#ff9e45", // orange
        E: "#ff6ac8", // pink
        F: "#579cff", // blue
        G: "#b58aff"  // violet
    };

    const GATE_COLORS = [
        "#ff7272", "#00d6be", "#e7a1ff", "#f9b842",
        "#74f4c8", "#ff86ab", "#91c9ff", "#d5ff62",
        "#bb9cff", "#ffb38a", "#61e4ff", "#ee85ed"
    ];
    let nextGateColor = 0;
    const wiredLines = new WeakSet();

    const wireMenu = document.querySelector(".wire-context-menu");
    const junctionLayer = wireLayer.querySelector(".junction-layer");
    let rightClickedConnection = null;
    let drawingBranchColor = null;

    function sourceSvg(connection) {
        return connection?.fromGate?.querySelector("svg") || null;
    }

    function wireColor(connection) {
        const svg = sourceSvg(connection);
        if (!svg) return "#00ffff";
        if (svg.dataset.wireColor) return svg.dataset.wireColor;
        const key = svg.dataset.inputKey;
        const color = key && INPUT_COLORS[key]
            ? INPUT_COLORS[key]
            : GATE_COLORS[(nextGateColor++) % GATE_COLORS.length];
        svg.dataset.wireColor = color;
        return color;
    }

    function setAttributeIfChanged(element, name, value) {
        if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    }
    function setFilterIfChanged(element, value) {
        if (element.style.filter !== value) element.style.filter = value;
    }

    function restoreLineColor(connection) {
        if (!connection?.line) return;
        const selected = typeof selectedCanvasWire !== "undefined" &&
            selectedCanvasWire === connection.line;
        const editing = typeof selectedWireSegment !== "undefined" &&
            selectedWireSegment?.connection === connection;
        const color = (selected || editing) ? "#ffff00" : wireColor(connection);
        setAttributeIfChanged(connection.line, "stroke", color);
        setFilterIfChanged(connection.line, `drop-shadow(0 0 5px ${color})`);
    }

    function addLineListeners(connection) {
        const line = connection.line;
        if (wiredLines.has(line)) return;
        wiredLines.add(line);
        // The original createWire() resets the color to cyan on mouseleave.
        // This listener is added later, so it restores the correct net color.
        line.addEventListener("mouseleave", () => restoreLineColor(connection));
    }

    function refreshJunctionColors() {
        if (!junctionLayer) return;
        const dots = Array.from(junctionLayer.querySelectorAll("circle"));
        for (const connection of connections) {
            if (!connection.branchParent || !connection.routePoints?.length) continue;
            const anchor = connection.routePoints[0];
            const color = wireColor(connection);
            for (const dot of dots) {
                // The dotted hover preview is handled separately.
                if (dot === dots[dots.length - 1]) continue;
                const x = Number(dot.getAttribute("cx"));
                const y = Number(dot.getAttribute("cy"));
                if (Math.abs(x - anchor.x) > 0.2 || Math.abs(y - anchor.y) > 0.2) continue;
                setAttributeIfChanged(dot, "fill", color);
                setFilterIfChanged(dot, `drop-shadow(0 0 5px ${color})`);
            }
        }
    }

    function refreshAllWireColors() {
        for (const connection of connections) {
            addLineListeners(connection);
            restoreLineColor(connection);
        }
        refreshJunctionColors();
    }

    // junctions.js already wraps updateWires(). Keep that behavior intact.
    const previousUpdateWires = updateWires;
    updateWires = function updateWiresWithSignalColors() {
        previousUpdateWires();
        refreshAllWireColors();
    };

    // History restores gates from their SVG HTML (including data-wire-color).
    // It also resets path strokes to cyan after updating the circuit.
    const previousRestore = restoreCircuitState;
    restoreCircuitState = function restoreCircuitWithWireColors(state) {
        previousRestore(state);
        queueMicrotask(refreshAllWireColors);
    };

    // Wire clicks and selections need to remain highlighted yellow.
    // Run after the other event handlers without interfering with their actions.
    document.addEventListener("click", () => {
        queueMicrotask(refreshAllWireColors);
    });
    document.addEventListener("pointerup", () => {
        queueMicrotask(refreshAllWireColors);
    });

    // Capture right-clicked wire before the junction menu's capture listener.
    document.addEventListener("contextmenu", event => {
        rightClickedConnection = connections.find(c => c.line === event.target) || null;
        if (rightClickedConnection && colorInput) {
            colorInput.value = wireColor(rightClickedConnection);
        }
    }, true);

    // Match the junction preview to the wire it is branching from.
    document.addEventListener("click", event => {
        const connection = connections.find(c => c.line === event.target);
        if (connection) drawingBranchColor = wireColor(connection);
    }, true);
    wireLayer.addEventListener("pointermove", event => {
        const connection = connections.find(c => c.line === event.target);
        if (!connection || !junctionLayer) return;
        const dot = junctionLayer.lastElementChild;
        if (dot?.tagName.toLowerCase() !== "circle") return;
        const color = wireColor(connection);
        setAttributeIfChanged(dot, "fill", color);
        setFilterIfChanged(dot, `drop-shadow(0 0 6px ${color})`);
    });
    document.addEventListener("pointermove", () => {
        const preview = wireLayer.querySelector('path[stroke-dasharray="6 5"]');
        if (preview && preview.style.display !== "none" && drawingBranchColor) {
            setAttributeIfChanged(preview, "stroke", drawingBranchColor);
        }
    });

    // Add a discoverable native color picker to the EXISTING wire menu.
    let colorInput = null;
    if (wireMenu) {
        const row = document.createElement("label");
        row.textContent = "Change Wire Color";
        Object.assign(row.style, {
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: "12px", padding: "9px 12px", color: "#ffffff", cursor: "pointer"
        });
        colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.title = "Choose a signal color";
        colorInput.setAttribute("aria-label", "Change Wire Color");
        colorInput.value = "#00e5ff";
        Object.assign(colorInput.style, {
            width: "38px", height: "28px", cursor: "pointer",
            border: "1px solid #00bfff", borderRadius: "5px",
            background: "transparent", padding: "1px"
        });
        row.appendChild(colorInput);
        wireMenu.appendChild(row);

        // Prevent the existing menu's click handler from closing on the picker.
        row.addEventListener("click", event => event.stopPropagation());
        colorInput.addEventListener("input", () => {
            if (!rightClickedConnection || !connections.includes(rightClickedConnection)) return;
            const svg = sourceSvg(rightClickedConnection);
            if (!svg) return;
            // Record the state before a color change for Undo/Redo.
            if (!colorInput._colorBefore) colorInput._colorBefore = captureCircuitState();
            svg.dataset.wireColor = colorInput.value;
            refreshAllWireColors();
        });
        colorInput.addEventListener("change", () => {
            if (colorInput._colorBefore) {
                recordCircuitChange(colorInput._colorBefore);
                colorInput._colorBefore = null;
            }
            wireMenu.style.display = "none";
        });
        document.addEventListener("contextmenu", () => {
            colorInput._colorBefore = null;
        }, true);
    }

    refreshAllWireColors();
})();
