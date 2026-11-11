// WIRE JUMPS: visual bridges at non-connected orthogonal crossings.
// Load LAST, after open-wires.js. Does not change any electrical connections.
(() => {
  'use strict';
  if (window.__wireJumpsInstalled) return;
  window.__wireJumpsInstalled = true;

  const NS = 'http://www.w3.org/2000/svg';
  const jumpRadius = 7;
  const eps = 0.7;
  const defs = document.createElementNS(NS, 'defs');
  const overlay = document.createElementNS(NS, 'g');
  overlay.setAttribute('class', 'wire-jumps-visuals');
  overlay.style.pointerEvents = 'none';
  wireLayer.prepend(defs);
  wireLayer.appendChild(overlay);
  let nextId = 0;
  let scheduled = false;
  const masked = new Set();
  // Persist a creation sequence independently of SVG DOM order. Re-appending
  // a wire (Undo/Redo or moving a group) must never change its bridge priority.
  const creationOrder = new WeakMap();
  let nextCreationOrder = 0;
  function rememberWire(path) {
    if (!creationOrder.has(path)) creationOrder.set(path, ++nextCreationOrder);
  }


  function segments(path) {
    const d = path.getAttribute('d') || '';
    const tokens = d.match(/[MLHVmlhv]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
    const result = [];
    let x = 0, y = 0, cmd = null, i = 0;
    while (i < tokens.length) {
      if (/^[MLHVmlhv]$/.test(tokens[i])) { cmd = tokens[i++]; continue; }
      if (!cmd) break;
      const previous = {x,y};
      const wasMove = cmd.toUpperCase() === 'M';
      const isRelative = cmd === cmd.toLowerCase();
      if (cmd.toUpperCase() === 'H') {
        const n = Number(tokens[i++]); x = isRelative ? x+n : n;
      } else if (cmd.toUpperCase() === 'V') {
        const n = Number(tokens[i++]); y = isRelative ? y+n : n;
      } else if (cmd.toUpperCase() === 'M' || cmd.toUpperCase() === 'L') {
        if (i + 1 >= tokens.length) break;
        const a = Number(tokens[i++]), b = Number(tokens[i++]);
        x = isRelative ? x+a : a;
        y = isRelative ? y+b : b;
        if (cmd === 'M') cmd = 'L';
        if (cmd === 'm') cmd = 'l';
      } else break;
      if (Math.hypot(x-previous.x,y-previous.y) < eps) continue;
      if (!wasMove && (cmd.toUpperCase() === 'L' || cmd.toUpperCase() === 'H' || cmd.toUpperCase() === 'V')) {
        result.push({a:previous,b:{x,y}, horizontal:Math.abs(y-previous.y)<eps});
      }
    }
    return result;
  }

  function realWires() {
    return [...wireLayer.querySelectorAll('path')].filter(p =>
      p.isConnected && p.style.display !== 'none' &&
      (p.dataset.openWire === 'true' || connections.some(c => c.line === p)));
  }

  function isJunction(x,y) {
    // Include junctions from both completed and open-wire branching.
    const circles = wireLayer.querySelectorAll('.junction-layer circle, .open-wire-junction');
    return [...circles].some(c => c.style.display !== 'none' &&
      Math.hypot(Number(c.getAttribute('cx'))-x,Number(c.getAttribute('cy'))-y) < jumpRadius+2 &&
      c.style.display !== 'block');
  }

  // Intersection of any two straight SVG segments: horizontal, vertical or diagonal.
  function crossing(a,b) {
    const rx=a.b.x-a.a.x, ry=a.b.y-a.a.y;
    const sx=b.b.x-b.a.x, sy=b.b.y-b.a.y;
    const cross=rx*sy-ry*sx;
    if (Math.abs(cross)<.001) return null; // parallel or overlapping
    const qx=b.a.x-a.a.x, qy=b.a.y-a.a.y;
    const t=(qx*sy-qy*sx)/cross;
    const u=(qx*ry-qy*rx)/cross;
    const lengthA=Math.hypot(rx,ry),lengthB=Math.hypot(sx,sy);
    const margin=jumpRadius+2;
    if (t*lengthA < margin || (1-t)*lengthA < margin ||
        u*lengthB < margin || (1-u)*lengthB < margin) return null;
    const x=a.a.x+t*rx,y=a.a.y+t*ry;
    if (isJunction(x,y)) return null;
    return {x,y};
  }

  // A branch can retrace part of an existing wire from the same source.
  // That retraced segment is NOT a newly drawn crossing: ownership stays
  // with the original segment. Otherwise a phantom jump appears on a trunk
  // after an unrelated branch is added farther down the circuit.
  function onSegmentAt(segment, p) {
    const dx=segment.b.x-segment.a.x,dy=segment.b.y-segment.a.y;
    const len2=dx*dx+dy*dy;
    if (len2 < .01) return false;
    const t=((p.x-segment.a.x)*dx+(p.y-segment.a.y)*dy)/len2;
    return t>=-eps/Math.sqrt(len2) && t<=1+eps/Math.sqrt(len2) &&
      Math.abs((p.x-segment.a.x)*dy-(p.y-segment.a.y)*dx)/Math.sqrt(len2)<eps;
  }

  function retracesOlderSegment(newSegment, crossingPoint, data, newerIndex) {
    for (let k = 0; k < newerIndex; k++) {
      for (const olderSegment of data[k].segments) {
        const ax=olderSegment.b.x-olderSegment.a.x, ay=olderSegment.b.y-olderSegment.a.y;
        const bx=newSegment.b.x-newSegment.a.x, by=newSegment.b.y-newSegment.a.y;
        if (Math.abs(ax*by-ay*bx) > eps*Math.hypot(ax,ay)*Math.hypot(bx,by)) continue;
        if (onSegmentAt(olderSegment, crossingPoint) &&
            onSegmentAt(newSegment, crossingPoint)) return true;
      }
    }
    return false;
  }

  function redraw() {
    scheduled = false;
    for (const p of masked) p.removeAttribute('mask');
    masked.clear();
    defs.replaceChildren();
    overlay.replaceChildren();
    const paths = realWires();
    for (const path of paths) rememberWire(path);
    // Crucial: compare in actual first-seen creation order, NEVER the
    // current DOM order, orientation, color, or number of segments.
    paths.sort((a, b) => creationOrder.get(a) - creationOrder.get(b));
    const data = paths.map(path => ({path, segments:segments(path)}));
    const bridges = new Map();
    for (let i=0;i<data.length;i++) for (let j=i+1;j<data.length;j++) {
      if (data[i].path === data[j].path) continue;
      for (const a of data[i].segments) for (const b of data[j].segments) {

        // The *newer* wire always jumps, whether vertical or horizontal.
        // Genuine Junction dots are already excluded by crossing().
        const overPath = data[j].path;
        const overSegment = b;
        const c = crossing(a,b);
        if (!c) continue;
        // The later branch may include an old trunk segment in its path.
        // Never put a second jump on that inherited/retraced portion.
        if (retracesOlderSegment(overSegment, c, data, j)) continue;
        if (!bridges.has(overPath)) bridges.set(overPath,[]);
        const list = bridges.get(overPath);
        if (!list.some(q => Math.hypot(q.x-c.x,q.y-c.y)<1)) {
          const dx=overSegment.b.x-overSegment.a.x, dy=overSegment.b.y-overSegment.a.y;
          const length=Math.hypot(dx,dy);
          list.push({...c, ux:dx/length, uy:dy/length});
        }
      }
    }
    if (!bridges.size) return;
    const bounds = {
      width:Math.max(drawingArea.scrollWidth,drawingArea.clientWidth)+100,
      height:Math.max(drawingArea.scrollHeight,drawingArea.clientHeight)+100
    };
    for (const [path,places] of bridges) {
      const mask = document.createElementNS(NS,'mask');
      const id = 'circuit-wire-jump-mask-'+(++nextId);
      mask.id=id;
      mask.setAttribute('maskUnits','userSpaceOnUse');
      mask.setAttribute('x','0'); mask.setAttribute('y','0');
      mask.setAttribute('width',bounds.width);mask.setAttribute('height',bounds.height);
      const bg = document.createElementNS(NS,'rect');
      bg.setAttribute('x','0');bg.setAttribute('y','0');
      bg.setAttribute('width',bounds.width);bg.setAttribute('height',bounds.height);
      bg.setAttribute('fill','white');mask.appendChild(bg);
      const color=path.getAttribute('stroke') || '#00ffff';
      for (const {x,y,ux,uy} of places) {
        // A black mask removes just the newer wire under the bridge.
        // The mask rectangle rotates with the segment, including X crossings.
        const angle=Math.atan2(uy,ux)*180/Math.PI;
        const gap=document.createElementNS(NS,'rect');
        gap.setAttribute('x', x-jumpRadius-1);
        gap.setAttribute('y', y-5);
        gap.setAttribute('width', 2*jumpRadius+2);
        gap.setAttribute('height', 10);
        gap.setAttribute('transform',`rotate(${angle} ${x} ${y})`);
        gap.setAttribute('fill','black');mask.appendChild(gap);
        const arc=document.createElementNS(NS,'path');
        // Semi-circle offset to one side of the newer segment.
        const nx=uy, ny=-ux;
        const left={x:x-jumpRadius*ux,y:y-jumpRadius*uy};
        const right={x:x+jumpRadius*ux,y:y+jumpRadius*uy};
        const control1={x:left.x+11*nx,y:left.y+11*ny};
        const control2={x:right.x+11*nx,y:right.y+11*ny};
        arc.setAttribute('d',`M ${left.x} ${left.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${right.x} ${right.y}`);
        arc.classList.add('wire-jump-arc');
        arc.setAttribute('fill','none');arc.setAttribute('stroke',color);
        arc.setAttribute('stroke-width',path.getAttribute('stroke-width') || '3');
        arc.setAttribute('stroke-linecap','round');
        arc.style.filter=`drop-shadow(0 0 4px ${color})`;
        overlay.appendChild(arc);
      }
      defs.appendChild(mask);
      path.setAttribute('mask',`url(#${id})`);
      masked.add(path);
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled=true;
    requestAnimationFrame(redraw);
  }
  const observer = new MutationObserver(changes => {
    // Assign sequence numbers as soon as genuine wires appear, before
    // drawing overlays, and preserve them across DOM re-insertion.
    for (const change of changes) {
      if (change.type !== 'childList') continue;
      for (const node of change.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.('path') &&
            (node.dataset.openWire === 'true' || connections.some(c => c.line === node))) {
          rememberWire(node);
        }
      }
    }
    if (changes.some(c => (c.type==='attributes' && c.attributeName==='d' && c.target.tagName?.toLowerCase()==='path' && !overlay.contains(c.target)) ||
      (c.type==='childList' && c.target!==overlay && [...c.addedNodes,...c.removedNodes].some(n => n.nodeType===1 && n.tagName?.toLowerCase()==='path' && !n.classList.contains('wire-jump-arc'))))) schedule();
  });
  observer.observe(wireLayer,{subtree:true,childList:true,attributes:true,attributeFilter:['d']});
  drawingArea.addEventListener('pointermove', () => {if (typeof draggedGate !== 'undefined' && draggedGate) schedule();});
  document.addEventListener('pointerup',schedule);
  document.addEventListener('keyup',schedule);
  schedule();
})();
