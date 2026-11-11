// SMART WIRE EDITING — click / move / click for BOTH orientations.
// Connected wires use this file. Open-ended wires retain their own editor.
let selectedWireSegment = null;

function simplifyRoute(points) {
  const result = [];
  for (const point of points) {
    const p = {x:point.x,y:point.y};
    const last = result.at(-1);
    if (last && Math.abs(last.x-p.x)<.01 && Math.abs(last.y-p.y)<.01) continue;
    result.push(p);
    while (result.length>=3) {
      const [a,b,c]=result.slice(-3);
      if ((Math.abs(a.x-b.x)<.01 && Math.abs(b.x-c.x)<.01) ||
          (Math.abs(a.y-b.y)<.01 && Math.abs(b.y-c.y)<.01)) result.splice(-2,1);
      else break;
    }
  }
  return result;
}

function createRoutePoints(connection) {
  const outputPin=connection.fromGate.querySelector('.output-pin');
  const inputPin=findInputPin(connection.toGate,connection.inputIndex);
  if (!outputPin||!inputPin) return [];
  const start=getPinPosition(outputPin), end=getPinPosition(inputPin);
  const points=[{...start}]; let previous=start;
  for (const bend of connection.bends||[]) {
    points.push({x:bend.x,y:previous.y},{x:bend.x,y:bend.y}); previous=bend;
  }
  points.push({x:previous.x,y:end.y},{...end});
  const route = simplifyRoute(points);
  // Keep a genuine orthogonal elbow even when the pins are aligned now.
  // Otherwise a subsequent position change turns a two-point L into a diagonal.
  if (route.length === 2) route.splice(1, 0, {
    x: route[0].x,
    y: route[1].y
  });
  return route;
}

function getEditableSegments(connection) {
  const points=connection.routePoints || createRoutePoints(connection);
  const segments=[];
  for (let i=0;i<points.length-1;i++) {
    const a=points[i],b=points[i+1];
    if (Math.abs(a.y-b.y)<.01 && Math.abs(a.x-b.x)>.01)
      segments.push({index:i,direction:'horizontal',a,b});
    else if (Math.abs(a.x-b.x)<.01 && Math.abs(a.y-b.y)>.01)
      segments.push({index:i,direction:'vertical',a,b});
  }
  return segments;
}

(() => {
  let pending=null;
  const copy=pts=>pts.map(p=>({x:p.x,y:p.y}));
  const cloneState=connection=>({
    bends:copy(connection.bends||[]),
    routePoints:connection.routePoints?copy(connection.routePoints):null,
    startDirection:connection.startDirection,
    endDirection:connection.endDirection
  });
  const restoreState=(c,s)=>{
    c.bends=copy(s.bends);
    if(s.routePoints)c.routePoints=copy(s.routePoints);else delete c.routePoints;
    c.startDirection=s.startDirection;c.endDirection=s.endDirection;
    updateWires();
  };
  function mousePoint(e){const r=drawingArea.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  function nearest(connection,e){
    const mouse=mousePoint(e);let result=null;
    for(const s of getEditableSegments(connection)){
      const a=s.a,b=s.b;
      const inRange=s.direction==='vertical'
        ? mouse.y>=Math.min(a.y,b.y)-3&&mouse.y<=Math.max(a.y,b.y)+3
        : mouse.x>=Math.min(a.x,b.x)-3&&mouse.x<=Math.max(a.x,b.x)+3;
      const distance=s.direction==='vertical'?Math.abs(mouse.x-a.x):Math.abs(mouse.y-a.y);
      if(inRange&&distance<=10&&(!result||distance<result.distance)) result={...s,distance};
    }
    return result;
  }
  function finish(cancel=false){
    if(!pending)return;
    const old=pending;pending=null;selectedWireSegment=null;
    if (old.armTimer) clearTimeout(old.armTimer);
    if(cancel)restoreState(old.connection,old.before);
    drawingArea.style.cursor='';
    updateWires();
  }
  function move(e){
    if(!pending || !pending.armed)return;
    const p=pending;
    const m=mousePoint(e);
    const axis=p.direction==='vertical'?'x':'y';
    const upper=p.direction==='vertical'?drawingArea.clientWidth:drawingArea.clientHeight;
    const grid=typeof GRID_SIZE==='number'?GRID_SIZE:20;
    const target=Math.max(0,Math.min(upper,Math.round(m[axis]/grid)*grid));
    const points=copy(p.original);
    const idx=p.index,first=points[idx],second=points[idx+1];
    if(target===first[axis])return;
    // A first/last segment needs a small stub, keeping component pins anchored.
    if(idx===0 || idx===points.length-2){
      const a={...first},b={...second};
      const sourceStub={...a},endStub={...b};
      const sign=p.direction==='vertical' ? Math.sign(b.y-a.y)||1 : Math.sign(b.x-a.x)||1;
      if(p.direction==='vertical'){
        sourceStub.y=a.y+sign*Math.min(16,Math.abs(b.y-a.y)/3);
        endStub.y=b.y-sign*Math.min(16,Math.abs(b.y-a.y)/3);
        points.splice(idx,2,a,sourceStub,{x:target,y:sourceStub.y},{x:target,y:endStub.y},endStub,b);
      } else {
        sourceStub.x=a.x+sign*Math.min(16,Math.abs(b.x-a.x)/3);
        endStub.x=b.x-sign*Math.min(16,Math.abs(b.x-a.x)/3);
        points.splice(idx,2,a,sourceStub,{x:sourceStub.x,y:target},{x:endStub.x,y:target},endStub,b);
      }
    } else {
      first[axis]=target;second[axis]=target;
    }
    p.connection.routePoints=points;
    const start=points[0],next=points[1],end=points.at(-1),prev=points.at(-2);
    p.connection.startDirection=Math.abs(start.y-next.y)<.01?'horizontal':'vertical';
    p.connection.endDirection=Math.abs(end.y-prev.y)<.01?'horizontal':'vertical';
    updateWires();
  }
  wireLayer.addEventListener('pointermove',e=>{
    const c=connections.find(c=>c.line===e.target);
    if(!c||pending)return;
    const s=nearest(c,e);
    e.target.style.cursor=s?(s.direction==='vertical'?'ew-resize':'ns-resize'):'pointer';
  },true);
  // Capture click before junctions.js (which otherwise starts a branch).
  wireLayer.addEventListener('click',e=>{
    const c=connections.find(c=>c.line===e.target);
    if(!c)return;
    if(e.shiftKey)return; // Existing Shift branch shortcut.
    e.preventDefault();e.stopImmediatePropagation();
    if(e.detail>=2){finish(true);return;} // dblclick is handled by junctions.js.
    if(pending){finish(false);return;}
    const segment=nearest(c,e);
    if(typeof clearCanvasSelection==='function')clearCanvasSelection();
    selectedCanvasWire=c.line;
    c.line.setAttribute('stroke','#ffff00');
    c.line.setAttribute('stroke-width','5');
    if(!segment)return;
    if(!c.routePoints)c.routePoints=createRoutePoints(c);
    // Existing two-vertex routes are also protected from diagonal deformation.
    if(c.routePoints.length===2) {
      c.routePoints.splice(1,0,{
        x:c.routePoints[0].x,
        y:c.routePoints[1].y
      });
    }
    const idx=segment.index;
    pending={connection:c,index:idx,direction:segment.direction,
      original:copy(c.routePoints),before:cloneState(c), armed:false, armTimer:null};
    // Do not deform the wire during the first click of a double-click.
    // A short activation delay keeps double-click branching independent of Move.
    const session=pending;
    session.armTimer=setTimeout(()=>{
      if(pending===session)session.armed=true;
    },310);
    selectedWireSegment={connection:c,index:idx,direction:segment.direction};
    drawingArea.style.cursor=segment.direction==='vertical'?'ew-resize':'ns-resize';
  },true);
  document.addEventListener('pointermove',e=>{if(pending)move(e);},true);
  document.addEventListener('click',e=>{
    if(!pending||!drawingArea.contains(e.target))return;
    if(connections.some(c=>c.line===e.target))return;
    e.preventDefault();e.stopImmediatePropagation();finish(false);
  },true);
  document.addEventListener('keydown',e=>{
    if(!pending)return;
    if(e.key==='Escape'){e.preventDefault();finish(true);}
    else if(e.key==='Enter'){e.preventDefault();finish(false);}
  },true);
})();


// ORTHOGONAL SAFETY: completed connections must never turn into diagonals
// after a double-click, segment move, rotation or component movement.
// Explicit "Add Diagonal Wire" segments live in open-wires.js and are untouched.
const previousOrthogonalUpdate = updateWires;
function repairOrthogonalRoute(connection) {
  const route = connection.routePoints;
  if (!Array.isArray(route) || route.length < 2) return false;
  const repaired = [{x: route[0].x, y: route[0].y}];
  let changed = false;
  for (let i = 1; i < route.length; i++) {
    const before = repaired[repaired.length - 1];
    const after = route[i];
    if (Math.abs(before.x - after.x) > .01 && Math.abs(before.y - after.y) > .01) {
      // Preserve the direction of the preceding section where possible.
      const preceding = repaired.length > 1 ? repaired[repaired.length - 2] : null;
      const precedingHorizontal = preceding && Math.abs(preceding.y - before.y) < .01;
      const corner = precedingHorizontal
        ? {x: after.x, y: before.y}
        : {x: before.x, y: after.y};
      repaired.push(corner);
      changed = true;
    }
    repaired.push({x: after.x, y: after.y});
  }
  if (!changed) return false;
  connection.routePoints = repaired;
  // The ordinary updateWires() keeps endpoints attached to their pins.
  connection.startDirection = Math.abs(repaired[0].y - repaired[1].y) < .01
    ? 'horizontal' : 'vertical';
  const n = repaired.length;
  connection.endDirection = Math.abs(repaired[n-1].y - repaired[n-2].y) < .01
    ? 'horizontal' : 'vertical';
  return true;
}
updateWires = function updateWiresOrthogonalOnly() {
  for (const connection of connections) repairOrthogonalRoute(connection);
  previousOrthogonalUpdate();
  // The standard wire updater may alter pin-facing vertices.
  for (const connection of connections) {
    if (repairOrthogonalRoute(connection)) {
      connection.line.setAttribute('d', connection.routePoints.map((p,i) =>
        `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '));
    }
  }
};
