// OPEN-ENDED WIRES — load LAST, after junctions.js and wire-colors.js.
// Enter fixes an unfinished wire at its current end; Escape still cancels.
// Click any part of a fixed open wire to start a connection/branch from it.
(() => {
  "use strict";
  if (window.__openEndedWiresInstalled) return;
  window.__openEndedWiresInstalled = true;

  const openWires = [];
  // Read-only snapshot for the Run-time connectivity verifier.
  window.__dlaGetOpenWires = () => [...openWires];
  const pathToWire = new WeakMap();
  const ns = "http://www.w3.org/2000/svg";
  let lastMouse = null;
  let continuing = null;
  let selectedOpenWire = null;

  const clone = p => ({ x: p.x, y: p.y });
  const equal = (a, b) => Math.abs(a.x - b.x) < .05 && Math.abs(a.y - b.y) < .05;
  const fmt = vertices => vertices.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");

  function dedupe(points) {
    const result = [];
    for (const p of points) if (!result.length || !equal(result[result.length - 1], p)) result.push(clone(p));
    return result;
  }

  function orthogonalVertices(start, bends, end) {
    const vertices = [clone(start)];
    let previous = start;
    for (const bend of bends) {
      vertices.push({ x: bend.x, y: previous.y }, clone(bend));
      previous = bend;
    }
    vertices.push({ x: end.x, y: previous.y }, clone(end));
    return dedupe(vertices);
  }

  function pinOf(wire) {
    if (!wire.sourceGate?.isConnected) return null;
    if (wire.sourceKind === "output") return wire.sourceGate.querySelector(`.output-pin[data-output="${wire.sourceIndex || 0}"]`) || (wire.sourceIndex ? null : wire.sourceGate.querySelector(".output-pin"));
    return wire.sourceGate.querySelector(`.input-pin[data-pin="${wire.sourceIndex}"]`);
  }

  const INPUT_WIRE_COLORS = {
    A: "#00ffff", B: "#ffd54f", C: "#39ff14", D: "#ff9b3d",
    E: "#ff67bc", F: "#59a9ff", G: "#be80ff"
  };

  // Read the persistent signal color. Never use the displayed stroke while a
  // wire is selected: that stroke may be temporary yellow/red highlighting.
  function sourceColor(pin) {
    if (!pin) return "#00ffff";
    const gate = pin.closest(".logic-gate");
    const key = gate?.querySelector("svg[data-input-key]")?.dataset.inputKey;
    const existing = connections.find(c => c.fromGate === gate && c.line?.dataset?.wireColor);
    return existing?.line?.dataset?.wireColor || INPUT_WIRE_COLORS[key] || "#00ffff";
  }

  function stableWireColor(wire, seen = new Set()) {
    if (!wire || seen.has(wire)) return null;
    seen.add(wire);
    // Follow the parent chain: selecting or recoloring a branch cannot
    // cause it to acquire a different signal color.
    if (wire.parentConnection) {
      const source = wire.parentConnection.fromGate?.querySelector('svg');
      return source?.dataset.wireColor ||
        wire.parentConnection.line?.dataset.wireColor || wire.color || null;
    }
    if (wire.parentWire) return stableWireColor(wire.parentWire, seen) || wire.color;
    const key = wire.sourceGate?.querySelector('svg[data-input-key]')?.dataset.inputKey;
    const source = wire.sourceGate?.querySelector('svg');
    return source?.dataset.wireColor ||
      wire.line?.dataset?.wireColor || wire.color || INPUT_WIRE_COLORS[key] || null;
  }

  function branchSignalColor(parentBranch, pin) {
    if (!parentBranch) return sourceColor(pin);
    // A branch can start from a free wire OR a completed gate-to-gate connection.
    // The completed connection has no `.color` property on its object.
    return stableWireColor(parentBranch.wire) ||
      parentBranch.connection?.line?.dataset?.wireColor ||
      parentBranch.color || sourceColor(pin);
  }

  // Position of a true branch, calculated from the parent wire rather than
  // drawing a second path from the original component's output pin.
  function branchPosition(wire) {
    let pts;
    if (wire.parentWire) {
      if (!wire.parentWire.line.isConnected) return null;
      pts = wire.parentWire.vertices;
    } else if (wire.parentConnection) {
      if (!connections.includes(wire.parentConnection)) return null;
      pts = wire.parentConnection.routePoints || createRoutePoints(wire.parentConnection);
    } else return null;
    const i = Math.min(wire.parentSegment, pts.length - 2);
    if (i < 0) return null;
    const a = pts[i], b = pts[i + 1];
    return { x: a.x + (b.x - a.x) * wire.parentRatio,
             y: a.y + (b.y - a.y) * wire.parentRatio };
  }

  function refreshWire(wire) {
    const pin = pinOf(wire);
    if (!pin || wire.vertices.length < 2 ||
        (wire.parentWire && !wire.parentWire.line.isConnected) ||
        (wire.parentConnection && !connections.includes(wire.parentConnection))) {
      wire.line.style.display = "none";
      if (wire.branchDot) wire.branchDot.style.display = "none";
      return;
    }
    const start = (wire.parentWire || wire.parentConnection) ? branchPosition(wire) : getPinPosition(pin);
    if (!start) return;
    const previousStart = wire.vertices[0];
    if (!equal(start, previousStart)) {
      const firstNext = wire.vertices[1];
      if (firstNext.y === previousStart.y) firstNext.y = start.y;
      else if (firstNext.x === previousStart.x) firstNext.x = start.x;
      wire.vertices[0] = start;
    }
    // Avoid emitting redundant SVG mutations while a wire is open.
    const nextPath = fmt(wire.vertices);
    if (wire.line.getAttribute("d") !== nextPath) wire.line.setAttribute("d", nextPath);
    const last = wire.vertices.at(-1);
    if (wire.endDot.getAttribute("cx") !== String(last.x)) wire.endDot.setAttribute("cx", last.x);
    if (wire.endDot.getAttribute("cy") !== String(last.y)) wire.endDot.setAttribute("cy", last.y);
    if (wire.branchDot) {
      wire.branchDot.setAttribute("cx", start.x);
      wire.branchDot.setAttribute("cy", start.y);
      wire.branchDot.style.display = "";
    }
    const netColor = stableWireColor(wire);
    if (netColor) {
      wire.color = netColor;
      wire.line.dataset.wireColor = netColor;
      // Preserve yellow selected-wire highlight, otherwise sync stroke.
      if (selectedOpenWire !== wire) {
        wire.line.setAttribute('stroke', netColor);
        wire.line.style.filter = `drop-shadow(0 0 5px ${netColor})`;
      }
      wire.branchDot?.setAttribute('fill', netColor);
      wire.endDot?.setAttribute('fill', netColor);
    }
    wire.line.style.display = "";
  }

  // Called after changing the source color or creating/removing a branch.
  // Recursively preserve source-net colors across every open-wire segment.
  window.__dlaRefreshOpenWireColors = function () {
    for (const wire of openWires) if (wire.line?.isConnected) refreshWire(wire);
  };

  function addFreeWire(pin, end, parentBranch = null, directDiagonal = false) {
    const start = parentBranch ? parentBranch.anchor : getPinPosition(pin);
    const points = directDiagonal ? dedupe([start, end]) : orthogonalVertices(start, wireBends, end);
    if (points.length < 2) return false;

    const color = branchSignalColor(parentBranch, pin);
    const line = document.createElementNS(ns, "path");
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", "3");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");
    line.setAttribute("d", fmt(points));
    line.style.filter = `drop-shadow(0 0 5px ${color})`;
    line.style.pointerEvents = "stroke";
    line.style.cursor = "crosshair";
    line.dataset.openWire = "true";
    line.dataset.wireColor = color;
    if (directDiagonal) line.dataset.diagonalWire = "true";
    const endDot = document.createElementNS(ns, "circle");
    endDot.classList.add("wire-free-endpoint");
    endDot.setAttribute("r", "4");
    endDot.setAttribute("fill", color);
    endDot.style.pointerEvents = "none";
    endDot.style.filter = `drop-shadow(0 0 5px ${color})`;

    const wire = {
      sourceGate: pin.closest(".logic-gate"),
      sourceKind: pin.classList.contains("output-pin") ? "output" : "input",
      sourceIndex: Number(pin.classList.contains("output-pin") ? (pin.dataset.output || 0) : (pin.dataset.pin || 0)),
      vertices: points,
      line,
      endDot,
      color,
      parentWire: parentBranch?.wire || null,
      parentConnection: parentBranch?.connection || null,
      parentSegment: parentBranch?.segment ?? -1,
      parentRatio: parentBranch?.ratio ?? 0,
      branchDot: null
    };
    if (parentBranch) {
      const dot = document.createElementNS(ns, "circle");
      dot.classList.add("open-wire-junction");
      dot.setAttribute("r", "4.5");
      dot.setAttribute("fill", color);
      dot.setAttribute("stroke", "#07152e");
      dot.setAttribute("stroke-width", "1");
      dot.style.pointerEvents = "none";
      dot.style.filter = `drop-shadow(0 0 5px ${color})`;
      wire.branchDot = dot;
    }
    pathToWire.set(line, wire);
    openWires.push(wire);
    wireLayer.append(line, endDot);
    if (wire.branchDot) wireLayer.appendChild(wire.branchDot);
    refreshWire(wire);
    return true;
  }

  // Commit an unfinished branch from a completed connection. Unlike the
  // original junctions preview, this is a real, independently editable open
  // wire whose anchor follows the actual parent route, not the source pin.
  window.commitOpenConnectionBranch = function (data) {
    const parent = data?.connection;
    if (!parent || !connections.includes(parent)) return false;
    const pin = parent.fromGate?.querySelector(`.output-pin[data-output="${parent.outputIndex || 0}"]`) || (parent.outputIndex ? null : parent.fromGate?.querySelector('.output-pin'));
    if (!pin) return false;
    const oldBends = wireBends;
    wireBends = (data.bends || []).map(clone);
    try {
      return addFreeWire(pin, clone(data.end), {
        connection: parent,
        anchor: clone(data.anchor),
        segment: data.segment,
        ratio: data.ratio,
        color: parent.line.dataset.wireColor || sourceColor(pin)
      });
    } finally { wireBends = oldBends; }
  };

  function nearestOnWire(wire, point) {
    let best = null;
    const vertices = wire.vertices;
    for (let i = 0; i < vertices.length - 1; i++) {
      const a = vertices[i], b = vertices[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = dx * dx + dy * dy;
      if (len < .01) continue;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len));
      const snap = { x: a.x + t * dx, y: a.y + t * dy };
      const distance = Math.hypot(point.x - snap.x, point.y - snap.y);
      if (!best || distance < best.distance) best = { index: i, ratio: t, snap, distance };
    }
    return best;
  }

  function isTyping() {
    const el = document.activeElement;
    return !!(el && (el.matches?.("input, textarea, select") || el.isContentEditable));
  }

  drawingArea.addEventListener("pointermove", event => {
    lastMouse = snapWirePoint(event);
    if (draggedGate) for (const wire of openWires) refreshWire(wire);
  });

  // Integration with gate-drag.js: translate an open wire as a complete
  // drawing when its source gate moves (single move or selected group).
  // Each snapshot is taken at pointerdown; applying dx/dy to the ORIGINAL
  // coordinates avoids drift even with grid snapping and repeated moves.
  window.snapshotOpenWiresForDrag = function snapshotOpenWiresForDrag(group) {
    return openWires.filter(wire => wire.line.isConnected && group.has(wire.sourceGate))
      .map(wire => ({
        wire,
        source: wire.vertices.map(clone)
      }));
  };

  window.translateOpenWiresForDrag = function translateOpenWiresForDrag(snapshots, dx, dy) {
    if (!snapshots?.length) return;
    for (const {wire, source} of snapshots) {
      if (!wire.line.isConnected) continue;
      wire.vertices = source.map(p => ({x: p.x + dx, y: p.y + dy}));
      refreshWire(wire);
    }
  };

  // Process Enter before ordinary shortcuts; Escape remains owned by wires.js.
  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" || !startPin || isTyping()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const end = lastMouse || wireBends.at(-1);
    if (!end) return;
    addFreeWire(startPin, clone(end), continuing);
    if (typeof cancelCurrentWire === "function") cancelCurrentWire();
    else {
      startPin.style.filter = "";
      startPin = null;
      wireBends = [];
      previewWire.style.display = "none";
    }
    continuing = null;
    branchPreview.style.display = "none";
  }, true);

  // Open-wire selection: first click selects; double-click or Shift+click branches.
  // No browser confirmation dialogs. Keep each wire's own color after deselection.
  function restoreSelection() {
    if (!selectedOpenWire) return;
    if (selectedOpenWire.line.isConnected) {
      selectedOpenWire.line.setAttribute("stroke", selectedOpenWire.color);
      selectedOpenWire.line.setAttribute("stroke-width", "3");
      selectedOpenWire.line.style.filter = `drop-shadow(0 0 5px ${selectedOpenWire.color})`;
    }
    selectedOpenWire = null;
  }

  function selectOpenWire(wire) {
    if (selectedOpenWire !== wire) restoreSelection();
    // A standard wire may also be selected, so clear that selection first.
    if (typeof clearCanvasSelection === "function") clearCanvasSelection();
    selectedOpenWire = wire;
    selectedCanvasWire = wire.line;
    wire.line.setAttribute("stroke", "#ffff00");
    wire.line.setAttribute("stroke-width", "5");
    wire.line.style.filter = "drop-shadow(0 0 8px #ffff00)";
  }

  function startBranchFromOpenWire(wire, event) {
    const pin = pinOf(wire);
    if (!pin) return;
    if (typeof cancelCurrentWire === "function") cancelCurrentWire();
    const bounds = drawingArea.getBoundingClientRect();
    const nearest = nearestOnWire(wire, {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    });
    if (!nearest || nearest.distance > 16) return;
    restoreSelection();
    selectedCanvasWire = null;
    startPin = pin;
    pin.style.filter = "drop-shadow(0 0 8px #00ffff)";
    // This is the key fix: begin at the clicked junction, NOT at the input
    // component's output pin. No hidden route back along the trunk.
    wireBends = [];
    continuing = {
      wire,
      anchor: clone(nearest.snap),
      segment: nearest.index,
      ratio: nearest.ratio,
      before: connections.length
    };
  }

  // -----------------------------------------------------------
  // CLICK -> MOVE -> CLICK wire segment editing (no mouse hold).
  // One click selects the wire in yellow and picks up its segment.
  // Moving the pointer repositions it; a second click puts it down.
  // Shift+click or double-click can still initiate a branch.
  // -----------------------------------------------------------
  let movingSegment = null;

  function canvasPointer(event) {
    const rect = drawingArea.getBoundingClientRect();
    return {x: event.clientX - rect.left, y: event.clientY - rect.top};
  }

  function nearestEditableSegment(wire, event) {
    const mouse = canvasPointer(event);
    const points = wire.vertices;
    let best = null;
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1];
      const vertical = Math.abs(a.x-b.x) < .1 && Math.abs(a.y-b.y) > .1;
      const horizontal = Math.abs(a.y-b.y) < .1 && Math.abs(a.x-b.x) > .1;
      if (!vertical && !horizontal) continue;
      const within = vertical
        ? mouse.y >= Math.min(a.y,b.y)-3 && mouse.y <= Math.max(a.y,b.y)+3
        : mouse.x >= Math.min(a.x,b.x)-3 && mouse.x <= Math.max(a.x,b.x)+3;
      if (!within) continue;
      const distance = vertical ? Math.abs(mouse.x-a.x) : Math.abs(mouse.y-a.y);
      if (distance <= 10 && (!best || distance < best.distance)) {
        best = {index:i, vertical, distance};
      }
    }
    return best;
  }

  function refreshTree(wire, visited = new Set()) {
    if (visited.has(wire)) return;
    visited.add(wire);
    refreshWire(wire);
    for (const child of openWires) if (child.parentWire === wire) refreshTree(child, visited);
    if (typeof updateWires === 'function') updateWires();
  }

  function remapBranchSegments(wire) {
    for (const child of openWires) if (child.parentWire === wire) child.parentSegment++;
    for (const connection of connections) {
      if (connection.openBranch?.wire === wire) connection.openBranch.segment++;
    }
    if (continuing?.wire === wire) continuing.segment++;
  }

  function restoreCanvasCursor() {
    drawingArea.style.cursor = '';
    if (movingSegment?.wire?.line) movingSegment.wire.line.style.cursor = '';
  }

  function finishSegmentMove(cancel = false) {
    if (!movingSegment) return;
    const move = movingSegment;
    movingSegment = null;
    if (cancel) {
      move.wire.vertices = move.original.map(clone);
      if (move.remapped) {
        for (const child of openWires) if (child.parentWire === move.wire) child.parentSegment--;
        for (const connection of connections) if (connection.openBranch?.wire === move.wire) connection.openBranch.segment--;
        if (continuing?.wire === move.wire) continuing.segment--;
      }
    }
    refreshTree(move.wire);
    restoreCanvasCursor();
  }

  function moveSegmentTo(event) {
    if (!movingSegment) return;
    const move = movingSegment;
    if (!move.wire.line.isConnected) { finishSegmentMove(true); return; }
    const mouse = canvasPointer(event);
    const grid = typeof GRID_SIZE === 'number' && GRID_SIZE > 0 ? GRID_SIZE : 20;
    const a = clone(move.original[move.index]);
    const b = clone(move.original[move.index+1]);
    const axis = move.vertical ? 'x' : 'y';
    const limit = move.vertical ? drawingArea.clientWidth : drawingArea.clientHeight;
    const desired = Math.max(0,Math.min(limit, Math.round(mouse[axis]/grid)*grid));
    const diff = desired-a[axis];
    a[axis] += diff; b[axis] += diff;
    const points = move.original.map(clone);
    points[move.index] = a;
    points[move.index+1] = b;
    if (move.index === 0) {
      // Anchor pin/junction stays fixed while first segment moves.
      points.unshift(clone(move.original[0]));
      if (!move.remapped) { remapBranchSegments(move.wire); move.remapped = true; }
    }
    move.wire.vertices = points;
    refreshTree(move.wire);
  }

  wireLayer.addEventListener('pointermove', event => {
    if (movingSegment) return;
    const wire = pathToWire.get(event.target);
    if (!wire) return;
    const seg = nearestEditableSegment(wire,event);
    wire.line.style.cursor = !seg ? 'pointer' : seg.vertical ? 'ew-resize' : 'ns-resize';
  });

  // The previous drag editor must not start when clicking an open wire.
  // The ordinary completed-wire editor only handles connection paths.
  wireLayer.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !pathToWire.has(event.target)) return;
    event.stopImmediatePropagation();
  }, true);

  // A placement click may land on empty space, not necessarily on the wire.
  // Capture it before empty-space deselection and wire-branch listeners.
  document.addEventListener('click', event => {
    if (!movingSegment || !drawingArea.contains(event.target)) return;
    if (event.detail >= 2) {
      // Let double-click branching work by canceling the pending move.
      finishSegmentMove(true);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    finishSegmentMove(false);
  }, true);

  document.addEventListener('pointermove', event => {
    if (!movingSegment) return;
    moveSegmentTo(event);
  }, true);

  wireLayer.addEventListener('click', event => {
    const wire = pathToWire.get(event.target);
    if (!wire) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.shiftKey) {
      finishSegmentMove(true);
      startBranchFromOpenWire(wire, event);
      return;
    }
    // The second click of a double-click must NEVER start moving the wire.
    // Its dblclick event below will start a branch at the clicked junction.
    if (event.detail >= 2) {
      finishSegmentMove(true);
      return;
    }
    selectOpenWire(wire);
    const segment = nearestEditableSegment(wire,event);
    if (!segment) return;
    movingSegment = {
      wire,
      index: segment.index,
      vertical: segment.vertical,
      original: wire.vertices.map(clone),
      remapped:false
    };
    drawingArea.style.cursor = segment.vertical ? 'ew-resize' : 'ns-resize';
  }, true);

  document.addEventListener('keydown', event => {
    if (!movingSegment) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      finishSegmentMove(true);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      finishSegmentMove(false);
    } else if (event.key === 'Delete') {
      finishSegmentMove(false);
    }
  }, true);

  // Draw the live preview from the selected branch point. The original
  // wires.js preview always starts from startPin, which is incorrect here.
  const branchPreview = document.createElementNS(ns, "path");
  branchPreview.setAttribute("fill", "none");
  branchPreview.setAttribute("stroke-width", "3");
  branchPreview.setAttribute("stroke-linecap", "round");
  branchPreview.setAttribute("stroke-linejoin", "round");
  branchPreview.style.pointerEvents = "none";
  branchPreview.style.display = "none";
  wireLayer.appendChild(branchPreview);
  drawingArea.addEventListener("pointermove", event => {
    if (!continuing || !startPin) {
      branchPreview.style.display = "none";
      return;
    }
    const color = stableWireColor(continuing.wire);
    const end = snapWirePoint(event);
    branchPreview.setAttribute("d", fmt(orthogonalVertices(continuing.anchor, wireBends, end)));
    branchPreview.setAttribute("stroke", color);
    branchPreview.style.filter = `drop-shadow(0 0 5px ${color})`;
    branchPreview.style.display = "";
    previewWire.style.display = "none";
  });

  wireLayer.addEventListener("dblclick", event => {
    const wire = pathToWire.get(event.target);
    if (!wire) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    // Cancel any click-to-move state before entering branch drawing mode.
    finishSegmentMove(true);
    startBranchFromOpenWire(wire, event);
  }, true);

  // Clicking unused background clears the temporary yellow selection.
  drawingArea.addEventListener("click", event => {
    if (event.target === drawingArea || (!event.target.closest?.(".logic-gate") &&
        !event.target.closest?.("path") && !event.target.closest?.(".wire-context-menu"))) {
      restoreSelection();
      if (selectedCanvasWire?.dataset?.openWire === "true") selectedCanvasWire = null;
    }
  });

  function removeOpenWire(wire) {
    if (!wire) return;
    if (movingSegment?.wire === wire) finishSegmentMove(false);
    const index = openWires.indexOf(wire);
    if (index >= 0) openWires.splice(index, 1);
    if (selectedOpenWire === wire) selectedOpenWire = null;
    if (selectedCanvasWire === wire.line) selectedCanvasWire = null;
    // Removing a parent also removes its free-wire branches.
    for (const child of [...openWires]) if (child.parentWire === wire) removeOpenWire(child);
    wire.line.remove();
    wire.endDot.remove();
    wire.branchDot?.remove();
    if (continuing?.wire === wire) continuing = null;
  }

  // Public hook for group deletion. Avoids dispatching fake click/key events.
  window.removeOpenWireByPath = function removeOpenWireByPath(path) {
    const wire = pathToWire.get(path);
    if (!wire) return false;
    removeOpenWire(wire);
    return true;
  };

  // Keep finished branch-to-input connections anchored at their actual junction.
  // fromGate remains the original source for logical evaluation, while the SVG
  // route starts at the branch point (not the source component again).
  const updateBeforeOpenBranches = updateWires;
  updateWires = function updateWiresWithOpenBranches() {
    updateBeforeOpenBranches();
    for (const connection of connections) {
      const branch = connection.openBranch;
      if (!branch || !branch.wire.line.isConnected) continue;
      const anchor = branchPosition({
        parentWire: branch.wire,
        parentSegment: branch.segment,
        parentRatio: branch.ratio
      });
      const pin = findInputPin(connection.toGate, connection.inputIndex);
      if (!anchor || !pin) continue;
      const end = getPinPosition(pin);
      const vertices = connection.routePoints || [];
      if (vertices.length < 2) continue;
      const oldStart = vertices[0];
      vertices[0] = clone(anchor);
      vertices[vertices.length - 1] = clone(end);
      if (vertices.length > 2) {
        if (Math.abs(vertices[1].y - oldStart.y) < .1) vertices[1].y = anchor.y;
        else vertices[1].x = anchor.x;
        const last = vertices.length - 1;
        if (connection.endDirection === "horizontal") vertices[last - 1].y = end.y;
        else vertices[last - 1].x = end.x;
      }
      connection.line.setAttribute("d", fmt(vertices));
      if (branch.dot) {
        branch.dot.setAttribute("cx", anchor.x);
        branch.dot.setAttribute("cy", anchor.y);
      }
    }
  };

  // Once the subsequent pin click connects the wire, show a junction at the branch point.
  drawingArea.addEventListener("click", event => {
    if (!continuing) return;
    const pin = event.target.closest(".input-pin, .output-pin");
    if (!pin) return;
    const pending = continuing;
    const branchBends = wireBends.map(clone);
    queueMicrotask(() => {
      if (connections.length > pending.before) {
        const connection = connections[connections.length - 1];
        const pin = findInputPin(connection.toGate, connection.inputIndex);
        if (pin) {
          const end = getPinPosition(pin);
          connection.routePoints = orthogonalVertices(pending.anchor, branchBends, end);
          const pts = connection.routePoints;
          connection.startDirection = pts.length > 1 && pts[0].y === pts[1].y ? "horizontal" : "vertical";
          connection.endDirection = pts.length > 1 && pts.at(-1).y === pts.at(-2).y ? "horizontal" : "vertical";
          const dot = document.createElementNS(ns, "circle");
          dot.classList.add("wire-confirmed-junction");
          dot.__wireConnection = connection;
          dot.setAttribute("r", "4.5");
          dot.setAttribute("fill", pending.wire.color);
          dot.style.pointerEvents = "none";
          wireLayer.appendChild(dot);
          connection.openBranch = {
            wire: pending.wire,
            segment: pending.segment,
            ratio: pending.ratio,
            dot
          };
          updateWires();
        }
      }
      if (continuing === pending) continuing = null;
      branchPreview.style.display = "none";
    });
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      continuing = null;
      branchPreview.style.display = "none";
      restoreSelection();
      if (selectedCanvasWire?.dataset?.openWire === "true") selectedCanvasWire = null;
    }
    if (event.key === "Delete" && !isTyping()) {
      const wire = selectedOpenWire || pathToWire.get(selectedCanvasWire);
      if (!wire) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      removeOpenWire(wire);
    }
  }, true);

  // Right-click selects the wire (yellow). Delete key removes it without a popup.
  wireLayer.addEventListener("contextmenu", event => {
    const wire = pathToWire.get(event.target);
    if (!wire) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectOpenWire(wire);
  }, true);

  // -----------------------------------------------------------
  // EXPLICIT DIAGONAL MODE. Right-click near a FREE WIRE ENDPOINT.
  // Normal wires and double-click branching stay orthogonal.
  // -----------------------------------------------------------
  let diagonalSession = null;
  const diagonalPreview = document.createElementNS(ns, "path");
  diagonalPreview.setAttribute("fill", "none");
  diagonalPreview.setAttribute("stroke-width", "3");
  diagonalPreview.setAttribute("stroke-linecap", "round");
  diagonalPreview.style.pointerEvents = "none";
  diagonalPreview.style.display = "none";
  wireLayer.appendChild(diagonalPreview);

  const diagonalMenu = document.createElement("div");
  diagonalMenu.className = "diagonal-wire-menu";
  Object.assign(diagonalMenu.style, {
    position: "fixed", zIndex: "11000", display: "none", padding: "5px",
    background: "#08152b", border: "1px solid #00bfff", borderRadius: "8px",
    boxShadow: "0 0 12px rgba(0,191,255,.4)"
  });
  const diagonalButton = document.createElement("button");
  diagonalButton.type = "button";
  diagonalButton.textContent = "Add Diagonal Wire";
  Object.assign(diagonalButton.style, {
    background: "transparent", color: "#fff", border: "0", padding: "9px 12px",
    cursor: "pointer", font: "14px Arial"
  });
  diagonalMenu.appendChild(diagonalButton);
  document.body.appendChild(diagonalMenu);
  let diagonalCandidate = null;

  function nearestFreeEnd(event) {
    const position = canvasPointer(event);
    let candidate = null;
    let distance = 13;
    for (const wire of openWires) {
      if (!wire.line.isConnected || wire.line.style.display === "none") continue;
      const end = wire.vertices.at(-1);
      const d = Math.hypot(position.x - end.x, position.y - end.y);
      if (d < distance) { candidate = wire; distance = d; }
    }
    return candidate;
  }

  function stopDiagonal() {
    diagonalSession = null;
    diagonalPreview.style.display = "none";
    drawingArea.style.cursor = "";
  }

  // Capture before the regular right-click wire/branch menus.
  drawingArea.addEventListener("contextmenu", event => {
    const wire = nearestFreeEnd(event);
    if (!wire || diagonalSession) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (movingSegment) finishSegmentMove(false);
    diagonalCandidate = wire;
    diagonalMenu.style.display = "block";
    diagonalMenu.style.left = Math.max(0, Math.min(event.clientX, innerWidth - 190)) + "px";
    diagonalMenu.style.top = Math.max(0, Math.min(event.clientY, innerHeight - 55)) + "px";
  }, true);

  diagonalButton.addEventListener("click", () => {
    diagonalMenu.style.display = "none";
    const wire = diagonalCandidate;
    diagonalCandidate = null;
    if (!wire?.line.isConnected) return;
    if (startPin && typeof cancelCurrentWire === "function") cancelCurrentWire();
    if (movingSegment) finishSegmentMove(false);
    const anchor = clone(wire.vertices.at(-1));
    diagonalSession = {wire, anchor, end: clone(anchor)};
    diagonalPreview.setAttribute("stroke", stableWireColor(wire));
    diagonalPreview.style.filter = `drop-shadow(0 0 5px ${stableWireColor(wire)})`;
    diagonalPreview.setAttribute("d", fmt([anchor, anchor]));
    diagonalPreview.style.display = "";
    drawingArea.style.cursor = "crosshair";
  });

  document.addEventListener("pointerdown", event => {
    if (!diagonalMenu.contains(event.target)) diagonalMenu.style.display = "none";
  }, true);

  // Moving the cursor generates ONE straight segment (no H/V bends).
  drawingArea.addEventListener("pointermove", event => {
    if (!diagonalSession) return;
    diagonalSession.end = snapWirePoint(event);
    diagonalPreview.setAttribute("d", fmt([diagonalSession.anchor, diagonalSession.end]));
  });

  // Enter commits; Esc cancels. Do not trigger existing wire shortcuts.
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") diagonalMenu.style.display = "none";
    if (!diagonalSession || isTyping()) return;
    if (event.key !== "Enter" && event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === "Enter") {
      const {wire, anchor, end} = diagonalSession;
      if (Math.hypot(end.x - anchor.x, end.y - anchor.y) > 3) {
        const pin = pinOf(wire);
        if (pin) addFreeWire(pin, end, {
          wire, anchor, segment: wire.vertices.length - 2, ratio: 1,
          color: stableWireColor(wire)
        }, true);
      }
    }
    stopDiagonal();
  }, true);

  // Refresh the source anchor after rotating or moving a component.
  const observer = new MutationObserver(records => {
    if (!records.some(record => record.type === "attributes" &&
      record.target.closest?.(".logic-gate"))) return;
    for (const wire of openWires) refreshWire(wire);
  });
  observer.observe(drawingArea, { subtree: true, attributes: true, attributeFilter: ["style", "transform"] });

  // Group rotation integration. Rotate the entire path (including free ends
  // and bends), not merely its source pin. Parent/child branch geometry remains
  // linked because their segment indices and ratios do not change.
  window.rotateOpenWiresForGroup = function rotateOpenWiresForGroup(gates, center) {
    const rotate = p => ({
      x: center.x - (p.y - center.y),
      y: center.y + (p.x - center.x)
    });
    const chosen = openWires.filter(w => w.line.isConnected && gates.has(w.sourceGate));
    for (const wire of chosen) {
      wire.vertices = wire.vertices.map(rotate);
    }
    for (const wire of chosen) {
      if (!wire.parentWire || !chosen.includes(wire.parentWire)) refreshTree(wire);
    }
  };
})();
