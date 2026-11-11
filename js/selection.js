// =====================================
// SELECT AND DELETE GATES / WIRES
// =====================================

let selectedCanvasGate = null;
let selectedCanvasWire = null;

// Store multiple selected gates for group operations.
const selectedCanvasGates = new Set();
// Paths selected by the AutoCAD window or crossing selection.
const selectedGroupWires = new Set();
const groupWireAppearance = new WeakMap();

function restoreGroupWire(path) {
    const saved = groupWireAppearance.get(path);
    if (!saved) return;
    path.setAttribute('stroke', saved.stroke);
    path.setAttribute('stroke-width', saved.width);
    path.style.filter = saved.filter;
    groupWireAppearance.delete(path);
}
function markGroupWire(path) {
    if (!groupWireAppearance.has(path)) {
        groupWireAppearance.set(path, {
            stroke: path.getAttribute('stroke') || path.dataset.wireColor || '#00ffff',
            width: path.getAttribute('stroke-width') || '3',
            filter: path.style.filter
        });
    }
    selectedGroupWires.add(path);
    path.setAttribute('stroke', '#ff3030');
    path.setAttribute('stroke-width', '5');
    path.style.filter = 'drop-shadow(0 0 8px #ff3030)';
}

// SVG path sampling supports straight, bent, horizontal and vertical wire routes.
function pathHitsRectangle(path, rectangle, crossingMode) {
    let length;
    try { length = path.getTotalLength(); } catch { return false; }
    if (!Number.isFinite(length) || length <= 0) return false;
    const pointInside = p => p.x >= rectangle.left && p.x <= rectangle.right &&
        p.y >= rectangle.top && p.y <= rectangle.bottom;
    const samples = Math.max(2, Math.ceil(length / 4));
    const box = drawingArea.getBoundingClientRect();
    const transform = path.getScreenCTM();
    if (!transform) return false;
    let anyInside = false;
    let allInside = true;
    for (let i = 0; i <= samples; ++i) {
        const p = path.getPointAtLength(length * i / samples);
        const screen = new DOMPoint(p.x, p.y).matrixTransform(transform);
        const inside = pointInside({ x: screen.x - box.left, y: screen.y - box.top });
        anyInside ||= inside;
        allInside &&= inside;
        if (crossingMode && anyInside) return true;
        if (!crossingMode && !allInside) return false;
    }
    return crossingMode ? anyInside : allInside;
}


function refreshGateSelection() {
    drawingArea.querySelectorAll(".logic-gate.gate-selected").forEach(gate => {
        if (!selectedCanvasGates.has(gate)) {
            gate.classList.remove("gate-selected");
        }
    });

    selectedCanvasGates.forEach(gate => {
        gate.classList.add("gate-selected");
    });

    // Keep the existing single-gate Delete behavior intact.
    selectedCanvasGate = selectedCanvasGates.size === 1
        ? selectedCanvasGates.values().next().value
        : null;
}

// Clear current selection (also called by Undo / Redo).
function clearCanvasSelection() {
    selectedCanvasGates.forEach(gate => {
        gate.classList.remove("gate-selected");
    });
    selectedCanvasGates.clear();

    for (const path of selectedGroupWires) restoreGroupWire(path);
    selectedGroupWires.clear();
    if (selectedCanvasWire && !selectedCanvasWire.dataset.openWire) {
        selectedCanvasWire.setAttribute('stroke-width', '3');
        selectedCanvasWire.setAttribute('stroke', selectedCanvasWire.dataset.wireColor || '#00ffff');
    }

    selectedCanvasGate = null;
    selectedCanvasWire = null;
}

// Ctrl + Click adds/removes a gate; regular click selects one gate.
drawingArea.addEventListener("click", (event) => {
    // A drag must not turn a multi-selection into a single selection.
    if (suppressGateSelectionClick) return;
    if (event.target.closest(".input-pin, .output-pin")) return;

    const gate = event.target.closest(".logic-gate");
    if (!gate) return;

    if (event.ctrlKey || event.metaKey) {
        if (selectedCanvasWire) {
            selectedCanvasWire.setAttribute("stroke-width", "3");
            selectedCanvasWire.setAttribute("stroke", "#00ffff");
            selectedCanvasWire = null;
        }
        if (selectedCanvasGates.has(gate)) {
            selectedCanvasGates.delete(gate);
        } else {
            selectedCanvasGates.add(gate);
        }
    } else {
        clearCanvasSelection();
        selectedCanvasGates.add(gate);
    }

    refreshGateSelection();
});

// =====================================
// DRAG A RECTANGLE TO SELECT GATES
// =====================================
const selectionRectangle = document.createElement("div");
selectionRectangle.setAttribute("aria-hidden", "true");
Object.assign(selectionRectangle.style, {
    position: "absolute",
    display: "none",
    pointerEvents: "none",
    border: "1px solid #00ffff",
    background: "rgba(0, 155, 255, 0.13)",
    zIndex: "20",
    boxSizing: "border-box"
});
drawingArea.appendChild(selectionRectangle);

let marqueeStart = null;
let marqueeActive = false;
let suppressMarqueeClick = false;
const MARQUEE_THRESHOLD = 5;

function getCanvasPoint(event) {
    const bounds = drawingArea.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(event.clientX - bounds.left, drawingArea.clientWidth)),
        y: Math.max(0, Math.min(event.clientY - bounds.top, drawingArea.clientHeight))
    };
}

// Only start on empty canvas: never interfere with pins, gates or wires.
drawingArea.addEventListener("pointerdown", event => {
    if (event.button !== 0 || startPin || event.target.closest(".logic-gate")) return;
    if (connections.some(connection => connection.line === event.target)) return;
    if (event.target.closest?.('path[data-open-wire="true"]')) return;
    if (event.target.closest("button, input, textarea")) return;

    marqueeStart = { ...getCanvasPoint(event), pointerId: event.pointerId };
    marqueeActive = false;
}, true);

document.addEventListener("pointermove", event => {
    if (!marqueeStart || event.pointerId !== marqueeStart.pointerId) return;

    const p = getCanvasPoint(event);
    if (!marqueeActive && Math.hypot(p.x - marqueeStart.x, p.y - marqueeStart.y) < MARQUEE_THRESHOLD) return;
    marqueeActive = true;

    const crossingMode = p.x < marqueeStart.x;
    selectionRectangle.style.border = crossingMode ? '1px dashed #39ff14' : '1px solid #00bfff';
    selectionRectangle.style.background = crossingMode ? 'rgba(57,255,20,.12)' : 'rgba(0,155,255,.13)';
    const left = Math.min(marqueeStart.x, p.x);
    const top = Math.min(marqueeStart.y, p.y);
    Object.assign(selectionRectangle.style, {
        display: "block",
        left: `${left}px`,
        top: `${top}px`,
        width: `${Math.abs(p.x - marqueeStart.x)}px`,
        height: `${Math.abs(p.y - marqueeStart.y)}px`
    });
});

function finishMarquee(event) {
    if (!marqueeStart || event.pointerId !== marqueeStart.pointerId) return;
    const wasActive = marqueeActive;
    const start = marqueeStart;
    marqueeStart = null;
    marqueeActive = false;
    selectionRectangle.style.display = "none";
    if (!wasActive || event.type === "pointercancel") return;

    const end = getCanvasPoint(event);
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    const crossingMode = end.x < start.x;

    if (!(event.ctrlKey || event.metaKey)) clearCanvasSelection();
    const areaRect = drawingArea.getBoundingClientRect();
    drawingArea.querySelectorAll(".logic-gate").forEach(gate => {
        const r = gate.getBoundingClientRect();
        const x1 = r.left - areaRect.left;
        const x2 = r.right - areaRect.left;
        const y1 = r.top - areaRect.top;
        const y2 = r.bottom - areaRect.top;
        const overlaps = x1 < right && x2 > left && y1 < bottom && y2 > top;
        const contained = x1 >= left && x2 <= right && y1 >= top && y2 <= bottom;
        if (crossingMode ? overlaps : contained) selectedCanvasGates.add(gate);
    });
    const bounds = {left, right, top, bottom};
    const wirePaths = [...wireLayer.querySelectorAll('path')].filter(path =>
        path.isConnected && (path.dataset.openWire === 'true' || connections.some(c => c.line === path)) &&
        path.style.display !== 'none');
    for (const path of wirePaths) {
        if (pathHitsRectangle(path, bounds, crossingMode)) markGroupWire(path);
    }
    refreshGateSelection();

    // A click may follow pointerup; prevent it from clearing the new selection.
    suppressMarqueeClick = true;
    setTimeout(() => { suppressMarqueeClick = false; }, 0);
}

document.addEventListener("pointerup", finishMarquee);
document.addEventListener("pointercancel", finishMarquee);

// Select a wire
wireLayer.addEventListener("click", (event) => {

    const wire = event.target;

    const connection = connections.find(
        item => item.line === wire
    );

    if (!connection) {
        return;
    }

    event.stopPropagation();

    clearCanvasSelection();

    selectedCanvasWire = wire;

    wire.setAttribute("stroke-width", "5");
    wire.setAttribute("stroke", "#ffff00");
});

// Delete a wire connection
function deleteWireConnection(connection) {

    if (!connection) {
        return;
    }

    if (
        selectedWireSegment &&
        selectedWireSegment.connection === connection
    ) {
        selectedWireSegment = null;
    }

    const index = connections.indexOf(connection);

    if (index !== -1) {
        connections.splice(index, 1);
    }

    connection.line.remove();

    selectedCanvasWire = null;
}

// Delete a gate and its wires
function deleteLogicGate(gate) {

    if (!gate) {
        return;
    }

    // Remove all connected wires
    const relatedConnections = connections.filter(
        connection =>
            connection.fromGate === gate ||
            connection.toGate === gate
    );

    relatedConnections.forEach(connection => {
        deleteWireConnection(connection);
    });

    // Cancel unfinished connection if necessary
    if (
        startPin &&
        startPin.closest(".logic-gate") === gate
    ) {
        startPin.style.filter = "";
        startPin = null;
        wireBends = [];
        previewWire.style.display = "none";
    }

    gate.remove();
    selectedCanvasGates.delete(gate);
    refreshGateSelection();

    if (selectedGate === gate) {
        selectedGate = null;
    }

    gateContextMenu.style.display = "none";

    updateWires();
}

// Delete selected gates (or a wire) in a single Undo / Redo action.
document.addEventListener("keydown", (event) => {
    if (event.key !== "Delete") return;

    const active = document.activeElement;
    if (active && (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable
    )) return;

    // A group must be processed before the legacy single-gate selection.
    if (selectedCanvasGates.size > 0 || selectedGroupWires.size > 0) {
        event.preventDefault();

        // Take one snapshot before removing the entire group.
        const before = captureCircuitState();
        const gatesToDelete = Array.from(selectedCanvasGates);

        // Delete explicitly selected wires, even if their source gate is outside the rectangle.
        for (const path of [...selectedGroupWires]) {
            const connection = connections.find(item => item.line === path);
            if (connection) deleteWireConnection(connection);
            else if (path.dataset.openWire === 'true') window.removeOpenWireByPath?.(path);
        }
        gatesToDelete.forEach(gate => deleteLogicGate(gate));
        clearCanvasSelection();

        // Record the entire deletion as ONE history action.
        recordCircuitChange(before);
        return;
    }

    if (selectedCanvasWire) {
        event.preventDefault();
        const before = captureCircuitState();
        const connection = connections.find(
            item => item.line === selectedCanvasWire
        );
        if (connection) {
            deleteWireConnection(connection);
            recordCircuitChange(before);
        }
    }
});

// Delete gate from right-click menu
document.getElementById("deleteGate").addEventListener(
    "click",
    () => {

        if (!selectedGate) {
            return;
        }

        clearCanvasSelection();

        deleteLogicGate(selectedGate);
    }
);

// =====================================
// DESELECT WHEN CLICKING EMPTY CANVAS
// =====================================

drawingArea.addEventListener("click", (event) => {

    if (suppressMarqueeClick) return;

    // Ignore clicks on gates and connection pins
    if (event.target.closest(".logic-gate")) {
        return;
    }

    // Ignore clicks on wires
    if (event.target.closest?.('path[data-open-wire="true"]') || connections.some(
        connection => connection.line === event.target
    )) {
        return;
    }

    // Clear selection on empty canvas
    clearCanvasSelection();

});
// =====================================
// SMART WIRE RESIZE CURSOR
// =====================================

wireLayer.addEventListener("pointermove", (event) => {

    const wire = event.target;

    const connection = connections.find(
        item => item.line === wire
    );

    if (!connection) return;

    // Get the current wire path
    const points = connection.routePoints ||
        createRoutePoints(connection);

    const area = drawingArea.getBoundingClientRect();

    const mouseX = event.clientX - area.left;
    const mouseY = event.clientY - area.top;

    let closestDirection = null;
    let minimumDistance = 10;

    for (let i = 0; i < points.length - 1; i++) {

        const a = points[i];
        const b = points[i + 1];

        let distance = Infinity;
        let direction = null;

        // Horizontal wire: vertical resize cursor
        if (a.y === b.y && a.x !== b.x) {

            const minX = Math.min(a.x, b.x);
            const maxX = Math.max(a.x, b.x);

            if (mouseX >= minX && mouseX <= maxX) {
                distance = Math.abs(mouseY - a.y);
                direction = "ns-resize";
            }
        }

        // Vertical wire: horizontal resize cursor
        else if (a.x === b.x && a.y !== b.y) {

            const minY = Math.min(a.y, b.y);
            const maxY = Math.max(a.y, b.y);

            if (mouseY >= minY && mouseY <= maxY) {
                distance = Math.abs(mouseX - a.x);
                direction = "ew-resize";
            }
        }

        if (distance < minimumDistance) {
            minimumDistance = distance;
            closestDirection = direction;
        }
    }

    wire.style.cursor = closestDirection || "pointer";

});

// A group is highlighted in red; this does not rotate or modify gate internals.
const autocadSelectionStyle = document.createElement('style');
autocadSelectionStyle.textContent = `
.logic-gate.gate-selected svg { filter: drop-shadow(0 0 7px #ff3030) drop-shadow(0 0 3px #ff3030) !important; }
.logic-gate.gate-selected svg .source-frame,
.logic-gate.gate-selected svg .output-frame { stroke: #ff3030 !important; }
`;
document.head.appendChild(autocadSelectionStyle);
