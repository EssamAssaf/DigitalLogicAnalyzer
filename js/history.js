// =====================================
// UNDO / REDO HISTORY SYSTEM
// =====================================

const undoStack = [];
const redoStack = [];

const MAX_HISTORY = 50;

const historyIds = new WeakMap();
let nextHistoryId = 1;

let historyRestoring = false;
let pointerStartState = null;

// Assign stable IDs to existing objects
function getHistoryId(object) {

    if (!historyIds.has(object)) {
        historyIds.set(object, nextHistoryId++);
    }

    return historyIds.get(object);
}

// Make independent copies of wire points
function copyHistoryPoints(points) {

    if (!points) return null;

    return points.map(point => ({
        x: point.x,
        y: point.y
    }));
}

// Capture the complete circuit state
function captureCircuitState() {

    const gates = Array.from(
        drawingArea.querySelectorAll(".logic-gate")
    ).map(gate => ({

        id: getHistoryId(gate),

        element: gate,

        left: gate.style.left,

        top: gate.style.top,

        html: gate.innerHTML,

        type: gate.dataset.type,

        inputs: gate.dataset.inputs,

        rotation: gate.dataset.rotation || "0"

    }));

    const wires = connections.map(connection => ({

        id: getHistoryId(connection),

        connection: connection,

        fromGate: connection.fromGate,

        toGate: connection.toGate,

        inputIndex: connection.inputIndex,

        bends: copyHistoryPoints(
            connection.bends || []
        ),

        routePoints: copyHistoryPoints(
            connection.routePoints
        ),

        startDirection: connection.startDirection,

        endDirection: connection.endDirection

    }));

    return {
        gates,
        wires
    };
}

// Compare circuit states
function getCircuitSignature(state) {

    return JSON.stringify({

        gates: state.gates.map(gate => ({
            id: gate.id,
            left: gate.left,
            top: gate.top,
            html: gate.html,
            inputs: gate.inputs,
            rotation: gate.rotation
        })),

        wires: state.wires.map(wire => ({
            id: wire.id,
            from: getHistoryId(wire.fromGate),
            to: getHistoryId(wire.toGate),
            inputIndex: wire.inputIndex,
            bends: wire.bends,
            routePoints: wire.routePoints,
            startDirection: wire.startDirection,
            endDirection: wire.endDirection
        }))

    });
}

// Save an action in history
function recordCircuitChange(before) {

    if (historyRestoring || !before) return;

    const after = captureCircuitState();

    if (
        getCircuitSignature(before) ===
        getCircuitSignature(after)
    ) {
        return;
    }

    undoStack.push(before);

    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }

    redoStack.length = 0;

    updateHistoryButtons();
}

// Restore a previous circuit state
function restoreCircuitState(state) {

    historyRestoring = true;

    clearCanvasSelection();

    // Cancel unfinished connections
    if (startPin) {
        startPin.style.filter = "";
    }

    startPin = null;
    wireBends = [];

    previewWire.style.display = "none";

    selectedWireSegment = null;
    draggedGate = null;
    selectedGate = null;

    gateContextMenu.style.display = "none";

    // Remove current gates
    drawingArea.querySelectorAll(
        ".logic-gate"
    ).forEach(gate => gate.remove());

    // Restore saved gates
    state.gates.forEach(saved => {

        const gate = saved.element;

        gate.innerHTML = saved.html;

        gate.dataset.type = saved.type;
        gate.dataset.inputs = saved.inputs;
        gate.dataset.rotation = saved.rotation;

        gate.style.left = saved.left;
        gate.style.top = saved.top;

        gate.classList.remove("gate-selected");

        drawingArea.appendChild(gate);
    });

    // Remove current wires
    connections.forEach(connection => {
        connection.line.remove();
    });

    connections.length = 0;

    // Restore saved wires
    state.wires.forEach(saved => {

        const connection = saved.connection;

        connection.fromGate = saved.fromGate;
        connection.toGate = saved.toGate;

        connection.inputIndex = saved.inputIndex;

        connection.bends =
            copyHistoryPoints(saved.bends) || [];

        if (saved.routePoints) {

            connection.routePoints =
                copyHistoryPoints(saved.routePoints);

        } else {

            delete connection.routePoints;
        }

        connection.startDirection =
            saved.startDirection;

        connection.endDirection =
            saved.endDirection;

        connections.push(connection);

        wireLayer.appendChild(connection.line);

        connection.line.setAttribute(
            "stroke",
            "#00ffff"
        );

        connection.line.setAttribute(
            "stroke-width",
            "3"
        );
    });

    selectedCanvasGate = null;
    selectedCanvasWire = null;

    updateWires();

    historyRestoring = false;

    updateHistoryButtons();
}

// =====================================
// UNDO ACTION
// =====================================

function undoCircuitAction() {

    if (undoStack.length === 0) return;

    const currentState = captureCircuitState();

    const previousState = undoStack.pop();

    redoStack.push(currentState);

    restoreCircuitState(previousState);
}

// =====================================
// REDO ACTION
// =====================================

function redoCircuitAction() {

    if (redoStack.length === 0) return;

    const currentState = captureCircuitState();

    const nextState = redoStack.pop();

    undoStack.push(currentState);

    restoreCircuitState(nextState);
}

// =====================================
// HISTORY BUTTONS
// =====================================

const undoButton = document.getElementById("undoBtn");
const redoButton = document.getElementById("redoBtn");

function updateHistoryButtons() {

    undoButton.disabled = undoStack.length === 0;

    redoButton.disabled = redoStack.length === 0;
}

undoButton.addEventListener(
    "click",
    undoCircuitAction
);

redoButton.addEventListener(
    "click",
    redoCircuitAction
);

// =====================================
// AUTOMATIC HISTORY RECORDING
// =====================================

// Record changes caused by clicks
document.addEventListener("click", event => {

    if (
        event.target.closest(
            "#undoBtn, #redoBtn"
        )
    ) {
        return;
    }

    const before = captureCircuitState();

    queueMicrotask(() => {
        recordCircuitChange(before);
    });

}, true);

// Capture state before dragging
document.addEventListener("pointerdown", event => {

    if (event.button !== 0) return;

    pointerStartState = captureCircuitState();

}, true);

// Record state after dragging
document.addEventListener("pointerup", () => {

    const before = pointerStartState;

    pointerStartState = null;

    queueMicrotask(() => {
        recordCircuitChange(before);
    });

}, true);

// Record keyboard deletion
document.addEventListener("keydown", event => {

    const active = document.activeElement;

    const isEditing =
        active &&
        (
            active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable
        );

    if (isEditing) return;

    // Undo: Ctrl + Z
    if (event.ctrlKey && event.key.toLowerCase() === "z") {

        event.preventDefault();

        if (event.shiftKey) {
            redoCircuitAction();
        } else {
            undoCircuitAction();
        }

        return;
    }

    // Redo: Ctrl + Y
    if (event.ctrlKey && event.key.toLowerCase() === "y") {

        event.preventDefault();

        redoCircuitAction();

        return;
    }

    // Track Delete
    if (event.key === "Delete") {

        const before = captureCircuitState();

        queueMicrotask(() => {
            recordCircuitChange(before);
        });
    }

}, true);

updateHistoryButtons();