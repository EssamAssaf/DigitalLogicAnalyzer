// =====================================
// DRAG SINGLE GATES OR SELECTED GROUPS
// =====================================

let draggedGate = null;
let offsetX = 0;
let offsetY = 0;
const GRID_SIZE = 20;

// Read by selection.js to keep a completed group selection after dragging.
let suppressGateSelectionClick = false;
let dragSession = null;

function copyDragPoints(points) {
    return points ? points.map(p => ({ x: p.x, y: p.y })) : null;
}

// =====================================
// START DRAGGING
// =====================================

drawingArea.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey) return;

    const gate = event.target.closest(".logic-gate");
    if (!gate || event.target.closest(".input-pin, .output-pin")) return;

    draggedGate = gate;
    const rect = gate.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;

    // selection.js is loaded after this file, but this listener runs after
    // all scripts are ready. Use the current multi-selection when available.
    const selected = (typeof selectedCanvasGates !== "undefined" &&
        selectedCanvasGates.has(gate) && selectedCanvasGates.size > 1)
        ? Array.from(selectedCanvasGates)
        : [gate];

    const gates = selected.map(element => ({
        element,
        x: parseFloat(element.style.left) || 0,
        y: parseFloat(element.style.top) || 0,
        width: element.offsetWidth,
        height: element.offsetHeight
    }));
    const group = new Set(selected);

    // Internal wires move WITH the selected group, including existing bends.
    const internalWires = connections
        .filter(wire => group.has(wire.fromGate) && group.has(wire.toGate))
        .map(wire => ({
            wire,
            bends: copyDragPoints(wire.bends),
            routePoints: copyDragPoints(wire.routePoints)
        }));

    dragSession = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        primaryX: parseFloat(gate.style.left) || 0,
        primaryY: parseFloat(gate.style.top) || 0,
        gates,
        internalWires,
        // Store original paths of open-ended wires attached to selected gates.
        // These wires are not kept in the normal `connections` array.
        openWireSnapshots: typeof window.snapshotOpenWiresForDrag === "function"
            ? window.snapshotOpenWiresForDrag(group)
            : [],
        moved: false
    };

    gate.setPointerCapture(event.pointerId);
});

// =====================================
// MOVE GROUP WHILE KEEPING RELATIVE SPACING
// =====================================

drawingArea.addEventListener("pointermove", event => {
    const s = dragSession;
    if (!s || event.pointerId !== s.pointerId) return;

    const areaRect = drawingArea.getBoundingClientRect();
    let targetX = event.clientX - areaRect.left - offsetX;
    let targetY = event.clientY - areaRect.top - offsetY;

    targetX = Math.round(targetX / GRID_SIZE) * GRID_SIZE;
    targetY = Math.round(targetY / GRID_SIZE) * GRID_SIZE;

    // Restrict the COMPLETE group to the canvas, not only the clicked gate.
    const minX = Math.min(...s.gates.map(g => g.x));
    const minY = Math.min(...s.gates.map(g => g.y));
    const maxX = Math.max(...s.gates.map(g => g.x + g.width));
    const maxY = Math.max(...s.gates.map(g => g.y + g.height));
    const dx = Math.max(-minX, Math.min(targetX - s.primaryX, drawingArea.clientWidth - maxX));
    const dy = Math.max(-minY, Math.min(targetY - s.primaryY, drawingArea.clientHeight - maxY));

    if (Math.hypot(event.clientX - s.startClientX, event.clientY - s.startClientY) > 4) {
        s.moved = true;
    }

    s.gates.forEach(g => {
        g.element.style.left = `${g.x + dx}px`;
        g.element.style.top = `${g.y + dy}px`;
    });

    // Translate internal wire corners; external wires continue to follow pins.
    s.internalWires.forEach(saved => {
        const { wire } = saved;
        if (saved.bends) {
            wire.bends = saved.bends.map(p => ({ x: p.x + dx, y: p.y + dy }));
        }
        if (saved.routePoints) {
            wire.routePoints = saved.routePoints.map(p => ({ x: p.x + dx, y: p.y + dy }));
        }
    });

    // Translate every vertex of each open-ended wire with its source gate.
    // Do not re-derive the wire from its moving pin: that would leave bends
    // and free endpoints behind in the old position.
    if (typeof window.translateOpenWiresForDrag === "function") {
        window.translateOpenWiresForDrag(s.openWireSnapshots, dx, dy);
    }
    updateWires();
});

// =====================================
// STOP DRAGGING
// =====================================

function stopDragging(event) {
    if (!dragSession) return;
    if (event && event.pointerId !== dragSession.pointerId) return;

    if (dragSession.moved) {
        // The browser dispatches click after pointerup. Ignore that click in
        // selection.js so dragging does not collapse a multi-selection.
        suppressGateSelectionClick = true;
        setTimeout(() => { suppressGateSelectionClick = false; }, 0);
    }

    dragSession = null;
    draggedGate = null;
}

drawingArea.addEventListener("pointerup", stopDragging);
drawingArea.addEventListener("pointercancel", stopDragging);
