// =====================================
// WIRE BRANCHING & JUNCTION NODES
// Shift + Click a wire to branch from it.
// =====================================
// Load AFTER wires.js, wire-edit.js, selection.js, history.js and clipboard.js.

(() => {
    "use strict";

    const SNAP_DISTANCE = 14;
    const junctionDots = new Map();
    const junctionLayer = document.createElementNS(svgNS, "g");
    junctionLayer.setAttribute("class", "junction-layer");
    junctionLayer.style.pointerEvents = "none";
    wireLayer.appendChild(junctionLayer);

    let pendingBranch = null;
    const branchPreview = document.createElementNS(svgNS, "path");
    branchPreview.setAttribute("fill", "none");
    branchPreview.setAttribute("stroke", "#00ffff");
    branchPreview.setAttribute("stroke-width", "3");
    branchPreview.setAttribute("stroke-linecap", "round");
    branchPreview.setAttribute("stroke-linejoin", "round");
    branchPreview.setAttribute("stroke-dasharray", "6 5");
    branchPreview.style.filter = "drop-shadow(0 0 5px #00ffff)";
    branchPreview.style.pointerEvents = "none";
    branchPreview.style.display = "none";
    wireLayer.appendChild(branchPreview);

    function point(x, y) {
        return { x, y };
    }

    function samePoint(a, b) {
        return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
    }

    function getWireVertices(connection) {
        if (connection.routePoints && connection.routePoints.length > 1) {
            return connection.routePoints.map(p => point(p.x, p.y));
        }

        const outputPin = connection.fromGate?.querySelector(".output-pin");
        const inputPin = findInputPin(connection.toGate, connection.inputIndex);
        if (!outputPin || !inputPin) return [];

        const start = getPinPosition(outputPin);
        const end = getPinPosition(inputPin);
        const vertices = [start];
        let previous = start;

        for (const bend of connection.bends || []) {
            vertices.push(point(bend.x, previous.y));
            vertices.push(point(bend.x, bend.y));
            previous = bend;
        }

        vertices.push(point(previous.x, end.y));
        vertices.push(end);
        return vertices.filter((p, i, arr) => i === 0 || !samePoint(p, arr[i - 1]));
    }

    function nearestWirePoint(connection, x, y) {
        const vertices = getWireVertices(connection);
        let best = null;
        for (let i = 0; i < vertices.length - 1; i++) {
            const a = vertices[i];
            const b = vertices[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const lengthSq = dx * dx + dy * dy;
            if (lengthSq < 0.01) continue;
            const ratio = Math.max(0, Math.min(1,
                ((x - a.x) * dx + (y - a.y) * dy) / lengthSq
            ));
            const snap = point(a.x + ratio * dx, a.y + ratio * dy);
            const distance = Math.hypot(snap.x - x, snap.y - y);
            if (!best || distance < best.distance) {
                best = { segment: i, ratio, snap, distance };
            }
        }
        return best;
    }

    function getBranchAnchor(connection) {
        const parent = connection.branchParent;
        if (!parent || !connections.includes(parent)) return null;
        const vertices = getWireVertices(parent);
        if (vertices.length < 2) return null;
        const i = Math.max(0, Math.min(connection.branchSegment, vertices.length - 2));
        const a = vertices[i];
        const b = vertices[i + 1];
        const t = Math.max(0, Math.min(1, connection.branchRatio));
        return point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }

    function makePath(vertices) {
        return vertices.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
    }

    function newBranchRoute(anchor, end, bends) {
        const vertices = [point(anchor.x, anchor.y)];
        let previous = anchor;
        for (const bend of bends) {
            vertices.push(point(bend.x, previous.y));
            vertices.push(point(bend.x, bend.y));
            previous = bend;
        }
        vertices.push(point(previous.x, end.y));
        vertices.push(point(end.x, end.y));
        return vertices.filter((p, i, arr) => i === 0 || !samePoint(p, arr[i - 1]));
    }

    function getOrCreateDot(connection) {
        let dot = junctionDots.get(connection);
        if (!dot) {
            dot = document.createElementNS(svgNS, "circle");
            dot.setAttribute("r", "5");
            dot.setAttribute("fill", "#00ffff");
            dot.setAttribute("stroke", "#09182b");
            dot.setAttribute("stroke-width", "1.3");
            dot.style.filter = "drop-shadow(0 0 5px #00ffff)";
            dot.style.pointerEvents = "none";
            junctionLayer.appendChild(dot);
            junctionDots.set(connection, dot);
        }
        return dot;
    }

    function setCoordinateIfChanged(element, attribute, value) {
        const next = String(value);
        if (element.getAttribute(attribute) !== next) {
            element.setAttribute(attribute, next);
        }
    }

    // Preserve the normal gate-to-gate wiring system. Adjust the visual
    // starting point of branches only AFTER the standard update finishes.
    const standardUpdateWires = updateWires;
    updateWires = function updateWiresWithJunctions() {
        standardUpdateWires();

        // A two-vertex route can become diagonal after moving a gate.
        // Preserve orthogonal wiring unless the user explicitly enables
        // a diagonal mode in a later feature.
        for (const connection of connections) {
            const pts = connection.routePoints;
            if (!pts || pts.length !== 2) continue;
            const a = pts[0], b = pts[1];
            if (Math.abs(a.x - b.x) > .1 && Math.abs(a.y - b.y) > .1) {
                pts.splice(1, 0, {x: a.x, y: b.y});
                connection.startDirection = "vertical";
                connection.endDirection = "horizontal";
                connection.line.setAttribute("d", makePath(pts));
            }
        }

        const processed = new Set();
        function redrawBranch(connection) {
            if (processed.has(connection)) return;
            if (connection.branchParent?.branchParent) {
                redrawBranch(connection.branchParent);
            }
            processed.add(connection);

            if (!connection.branchParent) return;
            const anchor = getBranchAnchor(connection);
            const inputPin = findInputPin(connection.toGate, connection.inputIndex);
            if (!anchor || !inputPin) {
                const oldDot = junctionDots.get(connection);
                if (oldDot) oldDot.remove();
                junctionDots.delete(connection);
                return;
            }

            const end = getPinPosition(inputPin);
            if (!connection.routePoints || connection.routePoints.length < 2) {
                connection.routePoints = newBranchRoute(anchor, end, connection.bends || []);
            }

            const vertices = connection.routePoints;
            vertices[0] = anchor;
            vertices[vertices.length - 1] = end;
            if (vertices.length > 2) {
                if (connection.startDirection === "vertical") {
                    vertices[1].x = anchor.x;
                } else {
                    vertices[1].y = anchor.y;
                }
                const last = vertices.length - 1;
                if (connection.endDirection === "vertical") {
                    vertices[last - 1].x = end.x;
                } else {
                    vertices[last - 1].y = end.y;
                }
            }
            connection.line.setAttribute("d", makePath(vertices));
            connection.line.style.display = "";
            const dot = getOrCreateDot(connection);
            setCoordinateIfChanged(dot, "cx", anchor.x);
            setCoordinateIfChanged(dot, "cy", anchor.y);
        }

        for (const connection of connections) redrawBranch(connection);
        for (const [connection, dot] of junctionDots) {
            if (!connections.includes(connection) || !connection.branchParent) {
                dot.remove();
                junctionDots.delete(connection);
            }
        }
    };

    // If a trunk is deleted, dependent branches are deleted as well.
    const standardDeleteWireConnection = deleteWireConnection;
    deleteWireConnection = function deleteWireWithBranches(connection) {
        if (!connection) return;
        for (const dependent of [...connections]) {
            if (dependent.branchParent === connection) {
                deleteWireConnection(dependent);
            }
        }
        standardDeleteWireConnection(connection);
        const dot = junctionDots.get(connection);
        if (dot) dot.remove();
        junctionDots.delete(connection);
    };

    function eventPoint(event) {
        const rect = drawingArea.getBoundingClientRect();
        return point(event.clientX - rect.left, event.clientY - rect.top);
    }

    function wireFromTarget(target) {
        return connections.find(connection => connection.line === target);
    }

    function clearBranch() {
        pendingBranch = null;
        branchPreview.style.display = "none";
    }

    function snapInput(event) {
        const mouse = eventPoint(event);
        let best = { snap: snapWirePoint(event), pin: null };
        let distance = PIN_SNAP_DISTANCE;
        drawingArea.querySelectorAll(".input-pin").forEach(pin => {
            if (pin.closest(".logic-gate") === pendingBranch.parent.fromGate) return;
            if (isInputOccupied(pin)) return;
            const p = getPinPosition(pin);
            const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
            if (d < distance) {
                distance = d;
                best = { snap: p, pin };
            }
        });
        return best;
    }

    // =====================================
    // DISCOVERABLE BRANCHING / WIRE MENU
    // =====================================
    // A click starts a branch; a real drag keeps the existing wire editor.
    const DRAG_THRESHOLD = 5;
    let wirePress = null;

    const hoverDot = document.createElementNS(svgNS, "circle");
    hoverDot.setAttribute("r", "5");
    hoverDot.setAttribute("fill", "#00ffff");
    hoverDot.setAttribute("stroke", "#09182b");
    hoverDot.setAttribute("stroke-width", "1.4");
    hoverDot.style.filter = "drop-shadow(0 0 6px #00ffff)";
    hoverDot.style.pointerEvents = "none";
    hoverDot.style.display = "none";
    junctionLayer.appendChild(hoverDot);

    function hideHoverDot() {
        hoverDot.style.display = "none";
    }

    function previewJunction(connection, event) {
        const mouse = eventPoint(event);
        const nearest = nearestWirePoint(connection, mouse.x, mouse.y);
        if (!nearest || nearest.distance > SNAP_DISTANCE) {
            hideHoverDot();
            return;
        }
        hoverDot.setAttribute("cx", nearest.snap.x);
        hoverDot.setAttribute("cy", nearest.snap.y);
        hoverDot.style.display = "block";
    }

    function beginBranch(connection, event) {
        const mouse = eventPoint(event);
        const nearest = nearestWirePoint(connection, mouse.x, mouse.y);
        if (!nearest || nearest.distance > SNAP_DISTANCE) return;

        // The existing pin-to-pin drawing and junction drawing are exclusive.
        if (startPin) {
            if (typeof cancelCurrentWire === "function") cancelCurrentWire();
            else {
                startPin.style.filter = "";
                startPin = null;
                wireBends = [];
                previewWire.style.display = "none";
            }
        }
        pendingBranch = {
            parent: connection,
            segment: nearest.segment,
            ratio: nearest.ratio,
            anchor: nearest.snap,
            bends: [],
            end: nearest.snap
        };
        hideHoverDot();
        branchPreview.setAttribute("d", makePath([nearest.snap, nearest.snap]));
        branchPreview.style.display = "block";
    }

    // Right-click options make wire actions easy to discover.
    const wireMenu = document.createElement("div");
    wireMenu.className = "wire-context-menu";
    Object.assign(wireMenu.style, {
        position: "fixed",
        display: "none",
        zIndex: "10000",
        minWidth: "170px",
        padding: "6px",
        border: "1px solid #00bfff",
        borderRadius: "8px",
        background: "#08152b",
        boxShadow: "0 0 12px rgba(0, 191, 255, 0.35)"
    });
    const menuActions = [
        ["Add Junction / Branch", "branch"],
        ["Select Wire", "select"],
        ["Delete Wire", "delete"]
    ];
    menuActions.forEach(([label, action]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.dataset.action = action;
        Object.assign(button.style, {
            display: "block",
            width: "100%",
            padding: "9px 12px",
            border: "0",
            borderRadius: "4px",
            color: "#ffffff",
            background: "transparent",
            textAlign: "left",
            cursor: "pointer"
        });
        button.addEventListener("mouseenter", () => {
            button.style.background = "#123858";
        });
        button.addEventListener("mouseleave", () => {
            button.style.background = "transparent";
        });
        wireMenu.appendChild(button);
    });
    document.body.appendChild(wireMenu);
    let contextWire = null;
    let contextPoint = null;
    function hideWireMenu() { wireMenu.style.display = "none"; }

    wireMenu.addEventListener("click", event => {
        const action = event.target.closest("button")?.dataset.action;
        if (!action || !contextWire || !connections.includes(contextWire)) {
            hideWireMenu();
            return;
        }
        if (action === "branch") {
            beginBranch(contextWire, contextPoint);
        } else if (action === "select") {
            clearCanvasSelection();
            selectedCanvasWire = contextWire.line;
            contextWire.line.setAttribute("stroke-width", "5");
            contextWire.line.setAttribute("stroke", "#ffff00");
        } else if (action === "delete") {
            deleteWireConnection(contextWire);
            updateWires();
        }
        hideWireMenu();
    });

    document.addEventListener("pointerdown", event => {
        if (!wireMenu.contains(event.target)) hideWireMenu();
    }, true);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") hideWireMenu();
    });

    wireLayer.addEventListener("contextmenu", event => {
        const wire = wireFromTarget(event.target);
        if (!wire) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        contextWire = wire;
        contextPoint = {
            clientX: event.clientX,
            clientY: event.clientY
        };
        wireMenu.style.display = "block";
        wireMenu.style.left = Math.max(0, Math.min(event.clientX, innerWidth - wireMenu.offsetWidth - 8)) + "px";
        wireMenu.style.top = Math.max(0, Math.min(event.clientY, innerHeight - wireMenu.offsetHeight - 8)) + "px";
    }, true);

    wireLayer.addEventListener("pointermove", event => {
        const wire = wireFromTarget(event.target);
        if (!wire || pendingBranch || wirePress?.moved) {
            hideHoverDot();
            return;
        }
        previewJunction(wire, event);
    });
    wireLayer.addEventListener("pointerleave", hideHoverDot);

    wireLayer.addEventListener("pointerdown", event => {
        const wire = wireFromTarget(event.target);
        if (event.button !== 0 || !wire) return;
        wirePress = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            moved: false
        };
        // Shift remains a shortcut, avoiding the wire drag handler.
        if (event.shiftKey) event.stopImmediatePropagation();
    }, true);

    document.addEventListener("pointermove", event => {
        if (!wirePress || event.pointerId !== wirePress.pointerId) return;
        if (Math.hypot(event.clientX - wirePress.x, event.clientY - wirePress.y) >= DRAG_THRESHOLD) {
            wirePress.moved = true;
            hideHoverDot();
        }
    }, true);

    // Keep the drag flag until the browser has emitted its follow-up click.
    document.addEventListener("pointercancel", () => { wirePress = null; }, true);

    wireLayer.addEventListener("click", event => {
        const parent = wireFromTarget(event.target);
        if (!parent) return;
        const wasDrag = wirePress?.moved === true;
        wirePress = null;
        if (wasDrag || pendingBranch) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        hideWireMenu();
        // Single click selects / moves the wire; double click branches.
        // Shift + click remains the shortcut for branching.
        if (event.shiftKey) beginBranch(parent, event);
    }, true);

    wireLayer.addEventListener("dblclick", event => {
        const parent = wireFromTarget(event.target);
        if (!parent) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        beginBranch(parent, event);
    }, true);

    // Capture the input click before the ordinary pin-to-pin handler.
    drawingArea.addEventListener("click", event => {
        if (!pendingBranch) return;
        const pin = event.target.closest(".input-pin, .output-pin");
        if (!pin) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!pin.classList.contains("input-pin")) return;
        if (pin.closest(".logic-gate") === pendingBranch.parent.fromGate) return;
        if (isInputOccupied(pin)) {
            alert("This input is already connected.");
            return;
        }

        const inputIndex = Number(pin.dataset.pin);
        const end = getPinPosition(pin);
        const anchor = pendingBranch.anchor;
        const bends = pendingBranch.bends.map(p => ({ ...p }));
        const routePoints = newBranchRoute(anchor, end, bends);
        const first = routePoints[0];
        const second = routePoints[1];
        const last = routePoints[routePoints.length - 1];
        const beforeLast = routePoints[routePoints.length - 2];
        const sourcePin = pendingBranch.parent.fromGate.querySelector(".output-pin");
        const wire = createWire(getPinPosition(sourcePin), end, []);

        connections.push({
            fromGate: pendingBranch.parent.fromGate,
            toGate: pin.closest(".logic-gate"),
            inputIndex,
            bends,
            routePoints,
            startDirection: first && second && first.x === second.x ? "vertical" : "horizontal",
            endDirection: last && beforeLast && last.x === beforeLast.x ? "vertical" : "horizontal",
            branchParent: pendingBranch.parent,
            branchSegment: pendingBranch.segment,
            branchRatio: pendingBranch.ratio,
            line: wire
        });
        clearBranch();
        updateWires();
    }, true);

    // Fix intermediate bends by clicking the empty canvas.
    drawingArea.addEventListener("click", event => {
        if (!pendingBranch) return;
        if (event.target.closest(".logic-gate") || wireFromTarget(event.target)) return;
        event.stopImmediatePropagation();
        const bend = snapWirePoint(event);
        const previous = pendingBranch.bends.at(-1) || pendingBranch.anchor;
        if (!samePoint(bend, previous)) pendingBranch.bends.push(bend);
    }, true);

    document.addEventListener("pointermove", event => {
        if (!pendingBranch) return;
        const { snap } = snapInput(event);
        pendingBranch.end = point(snap.x, snap.y);
        branchPreview.setAttribute("d", makePath(
            newBranchRoute(pendingBranch.anchor, snap, pendingBranch.bends)
        ));
        branchPreview.style.display = "block";
    });

    document.addEventListener("keydown", event => {
        if (!pendingBranch) return;
        if (event.key === "Enter") {
            const active = document.activeElement;
            if (active && (active.matches?.("input,textarea,select") || active.isContentEditable)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const b = pendingBranch;
            if (typeof window.commitOpenConnectionBranch === "function" && b.end) {
                window.commitOpenConnectionBranch({
                    connection: b.parent,
                    anchor: b.anchor,
                    segment: b.segment,
                    ratio: b.ratio,
                    bends: b.bends,
                    end: b.end
                });
            }
            clearBranch();
        } else if (event.key === "Escape") {
            clearBranch();
        } else if (event.key === "Backspace") {
            const active = document.activeElement;
            if (active && (active.matches("input,textarea") || active.isContentEditable)) return;
            event.preventDefault();
            pendingBranch.bends.pop();
        }
    });
})();
