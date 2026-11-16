// =====================================
// NEON WIRE CONNECTION SYSTEM
// =====================================

const svgNS = "http://www.w3.org/2000/svg";

const wireLayer = document.createElementNS(
    svgNS,
    "svg"
);

wireLayer.setAttribute("width", "100%");

wireLayer.setAttribute("height", "100%");

wireLayer.style.position = "absolute";

wireLayer.style.left = "0";

wireLayer.style.top = "0";

wireLayer.style.pointerEvents = "none";

wireLayer.style.overflow = "visible";

wireLayer.style.zIndex = "0";

drawingArea.prepend(wireLayer);

// =====================================
// STORE CONNECTIONS
// =====================================

const connections = [];

let startPin = null;

// Fixed wire bend points

let wireBends = [];

// =====================================
// GET PIN POSITION
// =====================================

function getPinPosition(pin) {

    const pinRect = pin.getBoundingClientRect();

    const areaRect = drawingArea.getBoundingClientRect();

    return {

        x:
            pinRect.left +
            pinRect.width / 2 -
            areaRect.left,

        y:
            pinRect.top +
            pinRect.height / 2 -
            areaRect.top

    };

}

// =====================================
// BUILD ORTHOGONAL WIRE PATH
// =====================================

function wirePath(start, end, bends = []) {

    const points = [start, ...bends];

    let d = `M ${start.x} ${start.y}`;

    for (let i = 1; i < points.length; i++) {

        const current = points[i];

        d += `
            H ${current.x}
            V ${current.y}
        `;

    }

    // Final connection to input pin

    d += `
        V ${end.y}
        H ${end.x}
    `;

    return d;

}

// =====================================
// CREATE GLOWING WIRE
// =====================================
// =====================================
// REMOVE REDUNDANT WIRE BEND POINTS
// =====================================

function normalizeWireBends(start, bends) {

    const cleaned = [];

    let previous = {
        x: start.x,
        y: start.y
    };

    for (const bend of bends) {

        const current = {
            x: bend.x,
            y: bend.y
        };

        // Skip duplicate points
        if (
            current.x === previous.x &&
            current.y === previous.y
        ) {
            continue;
        }

        // Remove redundant intermediate points
        if (cleaned.length > 0) {

            const before = cleaned[cleaned.length - 1];

            if (
                before.x === current.x &&
                before.y === current.y
            ) {
                continue;
            }
        }

        cleaned.push(current);

        previous = current;
    }

    return cleaned;
}
function createWire(start, end, bends = []) {

    const wire = document.createElementNS(
        svgNS,
        "path"
    );

    wire.setAttribute(
        "d",
        wirePath(start, end, bends)
    );

    wire.setAttribute("fill", "none");

    wire.setAttribute("stroke", "#00ffff");

    wire.setAttribute("stroke-width", "3");

    wire.setAttribute("stroke-linecap", "round");

    wire.setAttribute("stroke-linejoin", "round");

    wire.style.filter =
        "drop-shadow(0 0 5px #00ffff)";
// Enable wire segment selection
wire.style.pointerEvents = "stroke";
wire.style.cursor = "pointer";

wire.addEventListener("mouseenter", () => {
    wire.setAttribute("stroke", "#ffff00");
});

wire.addEventListener("mouseleave", () => {
    wire.setAttribute("stroke", "#00ffff");
});
    wireLayer.appendChild(wire);

    return wire;

}

// =====================================
// FIND INPUT PIN
// =====================================

function findInputPin(gate, index) {

    return gate.querySelector(
        `.input-pin[data-pin="${index}"]`
    );

}

// =====================================
// UPDATE ALL WIRES
// =====================================

function updateWires() {

    connections.forEach(connection => {

        const outputPin =
            connection.fromGate.querySelector(
                `.output-pin[data-output="${connection.outputIndex || 0}"]`
            ) || (connection.outputIndex ? null : connection.fromGate.querySelector(".output-pin"));

        const inputPin = findInputPin(
            connection.toGate,
            connection.inputIndex
        );

        if (!outputPin || !inputPin) {

            if (connection.line.style.display !== "none") connection.line.style.display = "none";

            return;

        }

        const start = getPinPosition(outputPin);

        const end = getPinPosition(inputPin);

        if (connection.line.style.display !== "") connection.line.style.display = "";

        if (connection.routePoints) {

    const points = connection.routePoints;

    points[0] = { ...start };
    points[points.length - 1] = { ...end };

    // Preserve orthogonal connections
    if (points.length > 2) {

        if (connection.startDirection === "horizontal") {
            points[1].y = start.y;
        } else {
            points[1].x = start.x;
        }

        const last = points.length - 1;

        if (connection.endDirection === "horizontal") {
            points[last - 1].y = end.y;
        } else {
            points[last - 1].x = end.x;
        }
    }

    const path = points.map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    ).join(" ");

    if (connection.line.getAttribute("d") !== path) connection.line.setAttribute("d", path);

} else {

    connection.line.setAttribute(
        "d",
        wirePath(start, end, connection.bends || [])
    );

}

    });

}

// =====================================
// BIDIRECTIONAL GATE WIRING
// =====================================

// Both pin orders are supported, while the stored signal direction
// always remains output -> input.
function isInputOccupied(pin) {
    const gate = pin.closest(".logic-gate");
    const index = Number(pin.dataset.pin);
    return connections.some(connection =>
        connection.toGate === gate && connection.inputIndex === index
    );
}

function cancelCurrentWire() {
    if (startPin) startPin.style.filter = "";
    startPin = null;
    wireBends = [];
    previewWire.style.display = "none";
}

// Store paths drawn backwards in the canonical output -> input order.
// routePoints also preserves manual bends and works with wire editing.
function reverseDrawnRoute(start, end, bends) {
    const points = [{ ...start }];
    let previous = { ...start };

    for (const bend of bends) {
        points.push({ x: bend.x, y: previous.y });
        points.push({ x: bend.x, y: bend.y });
        previous = bend;
    }

    // Same orthogonal order as the live wire preview: horizontal, vertical.
    points.push({ x: end.x, y: previous.y });
    points.push({ ...end });

    const routePoints = simplifyRoute(points.reverse());
    const last = routePoints.length - 1;
    return {
        routePoints,
        startDirection: routePoints.length > 1 &&
            routePoints[0].y === routePoints[1].y
            ? "horizontal" : "vertical",
        endDirection: routePoints.length > 1 &&
            routePoints[last - 1].y === routePoints[last].y
            ? "horizontal" : "vertical"
    };
}

drawingArea.addEventListener("click", event => {
    const pin = event.target.closest(".input-pin, .output-pin");
    if (!pin) return;

    const clickedIsInput = pin.classList.contains("input-pin");
    const clickedGate = pin.closest(".logic-gate");

    if (!startPin) {
        if (clickedIsInput && isInputOccupied(pin)) {
            alert("This input is already connected.");
            return;
        }
        startPin = pin;
        wireBends = [];
        pin.style.filter = clickedIsInput
            ? "drop-shadow(0 0 8px #00ffff)"
            : "drop-shadow(0 0 8px #39ff14)";
        return;
    }

    if (pin === startPin) {
        cancelCurrentWire();
        return;
    }

    const startedAtInput = startPin.classList.contains("input-pin");

    // Clicking another pin of the same kind changes the starting pin.
    if (startedAtInput === clickedIsInput) {
        if (clickedIsInput && isInputOccupied(pin)) {
            alert("This input is already connected.");
            return;
        }
        startPin.style.filter = "";
        startPin = pin;
        wireBends = [];
        pin.style.filter = clickedIsInput
            ? "drop-shadow(0 0 8px #00ffff)"
            : "drop-shadow(0 0 8px #39ff14)";
        return;
    }

    const outputPin = startedAtInput ? pin : startPin;
    const inputPin = startedAtInput ? startPin : pin;
    const fromGate = outputPin.closest(".logic-gate");
    const toGate = inputPin.closest(".logic-gate");

    if (fromGate === toGate) {
        alert("A gate cannot connect to itself.");
        return;
    }

    if (isInputOccupied(inputPin)) {
        alert("This input is already connected.");
        return;
    }

    const inputIndex = Number(inputPin.dataset.pin);
    const bends = wireBends.map(point => ({ ...point }));
    const outputPosition = getPinPosition(outputPin);
    const inputPosition = getPinPosition(inputPin);

    const line = createWire(outputPosition, inputPosition, []);
    const connection = {
        fromGate,
        toGate,
        inputIndex,
        outputIndex: Number(outputPin.dataset.output || 0),
        bends: startedAtInput ? [] : bends,
        line
    };

    if (startedAtInput) {
        Object.assign(connection, reverseDrawnRoute(
            inputPosition, outputPosition, bends
        ));
    }

    connections.push(connection);
    cancelCurrentWire();
    updateWires();
});

// =====================================
// WIRE POSITION UPDATES
// =====================================

drawingArea.addEventListener("pointermove", () => {

    if (draggedGate) {

        updateWires();

    }

});

// =====================================
// OBSERVE GATE CHANGES
// =====================================

// Watch components only. Watching the SVG wire layer created a feedback loop:
// updateWires() writes SVG paths/styles, the observer then called updateWires()
// again indefinitely (especially while an open wire or node was present).
let wireRefreshScheduled = false;
const wireObserver = new MutationObserver(records => {
    const componentChanged = records.some(record => {
        if (record.type === "attributes") {
            // Only geometry/position changes on an actual component. SVG wire
            // attributes and temporary pin glow are not geometry changes.
            return record.target.classList?.contains("logic-gate") &&
                   record.attributeName === "style";
        }
        if (record.type === "childList") {
            return [...record.addedNodes, ...record.removedNodes].some(node =>
                node.nodeType === 1 &&
                (node.classList?.contains("logic-gate") ||
                 node.querySelector?.(":scope > .logic-gate"))
            );
        }
        return false;
    });
    if (!componentChanged || wireRefreshScheduled) return;
    wireRefreshScheduled = true;
    requestAnimationFrame(() => {
        wireRefreshScheduled = false;
        updateWires();
    });
});
wireObserver.observe(drawingArea, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["style"]
});

// =====================================
// LIVE WIRE PREVIEW
// =====================================

const previewWire = document.createElementNS(
    svgNS,
    "path"
);

previewWire.setAttribute("fill", "none");

previewWire.setAttribute("stroke", "#00ffff");

previewWire.setAttribute("stroke-width", "3");

previewWire.setAttribute(
    "stroke-linecap",
    "round"
);

previewWire.setAttribute(
    "stroke-linejoin",
    "round"
);

previewWire.style.filter =
    "drop-shadow(0 0 5px #00ffff)";

previewWire.style.pointerEvents = "none";

previewWire.style.display = "none";

wireLayer.appendChild(previewWire);

// =====================================
// SNAP MOUSE POSITION TO GRID
// =====================================

function snapWirePoint(event) {

    const area = drawingArea.getBoundingClientRect();

    return {

        x: Math.round(
            (event.clientX - area.left) / GRID_SIZE
        ) * GRID_SIZE,

        y: Math.round(
            (event.clientY - area.top) / GRID_SIZE
        ) * GRID_SIZE

    };

}
// =====================================
// AUTO CONNECT - SNAP TO INPUT PIN
// =====================================

const PIN_SNAP_DISTANCE = 20;

function getSnappedWireTarget(event) {
    const mouse = snapWirePoint(event);
    if (!startPin) return mouse;

    const sourceGate = startPin.closest(".logic-gate");
    const startedAtInput = startPin.classList.contains("input-pin");
    const candidates = startedAtInput ? ".output-pin" : ".input-pin";

    let closestPin = null;
    let closestDistance = PIN_SNAP_DISTANCE;
    const area = drawingArea.getBoundingClientRect();
    const mouseX = event.clientX - area.left;
    const mouseY = event.clientY - area.top;

    drawingArea.querySelectorAll(candidates).forEach(pin => {
        if (pin.closest(".logic-gate") === sourceGate) return;
        if (!startedAtInput && isInputOccupied(pin)) return;

        const position = getPinPosition(pin);
        const distance = Math.hypot(
            mouseX - position.x,
            mouseY - position.y
        );
        if (distance < closestDistance) {
            closestDistance = distance;
            closestPin = pin;
        }
    });

    return closestPin ? getPinPosition(closestPin) : mouse;
}

// =====================================
// FIX WIRE BEND POINT ON CLICK
// =====================================

drawingArea.addEventListener("click", (event) => {

    if (!startPin) return;

    // Do not create a bend when clicking a gate

    if (event.target.closest(".logic-gate")) {

        return;

    }

    const point = snapWirePoint(event);

    const last = wireBends.length

        ? wireBends[wireBends.length - 1]

        : getPinPosition(startPin);

    if (
        point.x === last.x &&
        point.y === last.y
    ) {

        return;

    }

    // Fix this point permanently for current wire

    wireBends.push(point);

});

// =====================================
// WIRE FOLLOWS THE MOUSE
// =====================================

drawingArea.addEventListener("pointermove", (event) => {

    if (!startPin) {

        previewWire.style.display = "none";

        return;

    }

    const start = getPinPosition(startPin);

    const mouse = getSnappedWireTarget(event);
    const points = [
        start,
        ...wireBends
    ];

    let d = `M ${start.x} ${start.y}`;

    // Draw all previously fixed sections

    for (let i = 1; i < points.length; i++) {

        d += `
            H ${points[i].x}
            V ${points[i].y}
        `;

    }

    // Only the unfinished section follows mouse

    d += `
        H ${mouse.x}
        V ${mouse.y}
    `;

    previewWire.setAttribute("d", d);

    previewWire.style.display = "block";

});

// =====================================
// CANCEL WIRE WITH ESC
// =====================================

document.addEventListener("keydown", (event) => {

    if (event.key === "Escape") {

        if (startPin) {

            startPin.style.filter = "";

        }

        startPin = null;

        wireBends = [];

        previewWire.style.display = "none";

    }

    // Undo last fixed bend

    else if (
        event.key === "Backspace" &&
        startPin
    ) {

        event.preventDefault();

        wireBends.pop();

    }

});

