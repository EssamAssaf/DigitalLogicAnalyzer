// =====================================
// GROUP COPY / PASTE / DUPLICATE
// Loaded after history.js and selection.js.
// =====================================

let circuitClipboard = null;
let circuitPasteCount = 0;
const CLIPBOARD_OFFSET = 40;

function copyCircuitPoints(points) {
    return points ? points.map(point => ({ x: point.x, y: point.y })) : null;
}

// The clipboard stores an independent snapshot, not references to live gates.
function copySelectedCircuit() {
    const selected = Array.from(selectedCanvasGates).filter(gate => gate.isConnected);
    if (!selected.length) return false;

    const gateIndexes = new Map(selected.map((gate, index) => [gate, index]));
    const gates = selected.map(gate => ({
        html: gate.innerHTML,
        type: gate.dataset.type,
        inputs: gate.dataset.inputs,
        rotation: gate.dataset.rotation || '0',
        x: parseFloat(gate.style.left) || 0,
        y: parseFloat(gate.style.top) || 0,
        width: gate.offsetWidth,
        height: gate.offsetHeight
    }));

    // Copy only wires whose BOTH endpoints are in this selection.
    const wires = connections
        .filter(connection => gateIndexes.has(connection.fromGate) && gateIndexes.has(connection.toGate))
        .map(connection => ({
            from: gateIndexes.get(connection.fromGate),
            to: gateIndexes.get(connection.toGate),
            inputIndex: connection.inputIndex,
            outputIndex: connection.outputIndex || 0,
            bends: copyCircuitPoints(connection.bends || []),
            routePoints: copyCircuitPoints(connection.routePoints),
            startDirection: connection.startDirection,
            endDirection: connection.endDirection
        }));

    circuitClipboard = { gates, wires };
    circuitPasteCount = 0;
    return true;
}

function pasteCircuitClipboard() {
    if (!circuitClipboard || !circuitClipboard.gates.length) return false;
    const { gates, wires } = circuitClipboard;

    // One shared offset retains the exact relative arrangement.
    const desired = CLIPBOARD_OFFSET * (circuitPasteCount + 1);
    const minX = Math.min(...gates.map(gate => gate.x));
    const minY = Math.min(...gates.map(gate => gate.y));
    const maxX = Math.max(...gates.map(gate => gate.x + gate.width));
    const maxY = Math.max(...gates.map(gate => gate.y + gate.height));
    const maxDx = drawingArea.clientWidth - maxX;
    const maxDy = drawingArea.clientHeight - maxY;

    // Keep ALL pasted gates inside canvas; refuse if nothing can fit.
    if (drawingArea.clientWidth < maxX - minX || drawingArea.clientHeight < maxY - minY) {
        alert('Not enough canvas space to paste the selected circuit.');
        return false;
    }

    // Prefer bottom-right; if the group is near an edge, shift the entire group back inward.
    const dx = Math.max(-minX, Math.min(desired, maxDx));
    const dy = Math.max(-minY, Math.min(desired, maxDy));
    const before = captureCircuitState();

    const newGates = gates.map(saved => {
        const gate = document.createElement('div');
        gate.className = 'logic-gate';
        gate.dataset.type = saved.type;
        gate.dataset.inputs = saved.inputs;
        gate.dataset.rotation = saved.rotation;
        gate.innerHTML = saved.html;
        gate.style.left = `${saved.x + dx}px`;
        gate.style.top = `${saved.y + dy}px`;
        drawingArea.appendChild(gate);
        // Do not call updateGateInputs here: the copied SVG already has exact pins.
        return gate;
    });

    wires.forEach(saved => {
        const fromGate = newGates[saved.from];
        const toGate = newGates[saved.to];
        const outputPin = fromGate.querySelector(`.output-pin[data-output="${saved.outputIndex || 0}"]`) || (saved.outputIndex ? null : fromGate.querySelector('.output-pin')); 
        const inputPin = toGate.querySelector(`.input-pin[data-pin="${saved.inputIndex}"]`);
        if (!outputPin || !inputPin) return;

        const bends = (saved.bends || []).map(point => ({
            x: point.x + dx,
            y: point.y + dy
        }));
        const line = createWire(getPinPosition(outputPin), getPinPosition(inputPin), bends);
        const connection = { fromGate, toGate, inputIndex: saved.inputIndex, outputIndex: saved.outputIndex || 0, bends, line };
        if (saved.routePoints) {
            connection.routePoints = saved.routePoints.map(point => ({
                x: point.x + dx,
                y: point.y + dy
            }));
            connection.startDirection = saved.startDirection;
            connection.endDirection = saved.endDirection;
        }
        connections.push(connection);
    });

    clearCanvasSelection();
    newGates.forEach(gate => selectedCanvasGates.add(gate));
    refreshGateSelection();
    updateWires();
    recordCircuitChange(before); // One Undo entry for the complete pasted circuit.
    circuitPasteCount++;
    return true;
}

document.addEventListener('keydown', event => {
    const active = document.activeElement;
    if (active && (active.matches('input, textarea, select') || active.isContentEditable)) return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === 'c' && selectedCanvasGates.size) {
        event.preventDefault();
        copySelectedCircuit();
    } else if (key === 'v' && circuitClipboard) {
        event.preventDefault();
        pasteCircuitClipboard();
    } else if (key === 'd' && selectedCanvasGates.size) {
        event.preventDefault();
        if (copySelectedCircuit()) pasteCircuitClipboard();
    }
});
