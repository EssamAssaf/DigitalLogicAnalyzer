// AutoCAD-style group context menu + actions.
// Requires selection.js, gate-drag.js, rotation.js, open-wires.js to load first.
(() => {
  'use strict';
  if (window.__groupActionsInstalled) return;
  window.__groupActionsInstalled = true;

  const menu = document.createElement('div');
  menu.className = 'circuit-group-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <button type="button" data-group-action="move" role="menuitem">Move</button>
    <button type="button" data-group-action="rotate" role="menuitem">Rotate 90°</button>
    <button type="button" data-group-action="delete" role="menuitem">Delete</button>
    <button type="button" data-group-action="cancel" role="menuitem">Cancel Selection</button>`;
  const css = document.createElement('style');
  css.textContent = `
    .circuit-group-menu {position:fixed; z-index:99999; display:none; min-width:176px;
      padding:6px; background:#08152b; border:1px solid #00bfff; border-radius:9px;
      box-shadow:0 0 18px #00bfff66; font:14px Arial,sans-serif;}
    .circuit-group-menu button {width:100%;display:block;padding:10px 12px;
      background:transparent;color:#fff;text-align:left;border:0;border-radius:5px;cursor:pointer;}
    .circuit-group-menu button:hover,.circuit-group-menu button:focus-visible {
      background:#153d5e;outline:1px solid #00bfff;}
    .circuit-group-menu button[data-group-action="delete"]:hover {background:#752334;}
  `;
  document.head.appendChild(css);
  document.body.appendChild(menu);

  const point = e => {
    const r = drawingArea.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  };
  const copyPoints = points => points?.map(p=>({x:p.x,y:p.y}));
  const hasSelection = () => selectedCanvasGates.size>0 || selectedGroupWires.size>0;
  const hideMenu = () => {menu.style.display='none';};

  // The context menu is available over any selected item or the area bounded
  // by selected gates. It does not interfere with individual gate right-click.
  function selectedBounds() {
    const box = drawingArea.getBoundingClientRect();
    const boxes=[];
    for (const gate of selectedCanvasGates) {
      const r=gate.getBoundingClientRect();
      boxes.push({left:r.left-box.left,right:r.right-box.left,top:r.top-box.top,bottom:r.bottom-box.top});
    }
    for (const path of selectedGroupWires) {
      if (!path.isConnected) continue;
      let r;try {r=path.getBoundingClientRect();}catch{continue;}
      boxes.push({left:r.left-box.left,right:r.right-box.left,top:r.top-box.top,bottom:r.bottom-box.top});
    }
    if (!boxes.length) return null;
    return {left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),
      top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))};
  }
  drawingArea.addEventListener('contextmenu',event=>{
    if (!hasSelection())return;
    const gate=event.target.closest?.('.logic-gate');
    const onSelectedGate=gate&&selectedCanvasGates.has(gate);
    const onSelectedWire=selectedGroupWires.has(event.target);
    const p=point(event),b=selectedBounds();
    const inside=b&&p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom;
    if (!onSelectedGate&&!onSelectedWire&&!inside)return;
    event.preventDefault();event.stopImmediatePropagation();
    menu.style.display='block';
    menu.style.left=Math.max(4,Math.min(event.clientX,window.innerWidth-menu.offsetWidth-8))+'px';
    menu.style.top=Math.max(4,Math.min(event.clientY,window.innerHeight-menu.offsetHeight-8))+'px';
  },true);

  // Existing drag handler already moves selected gates and their wires when
  // a selected gate is dragged. Move menu adds click-to-position for groups.
  let moving=null;
  function beginMove() {
    if (!selectedCanvasGates.size) return;
    const gates=[...selectedCanvasGates];
    const snapshot=gates.map(g=>({element:g,x:parseFloat(g.style.left)||0,y:parseFloat(g.style.top)||0,
      w:g.offsetWidth,h:g.offsetHeight}));
    const group=new Set(gates);
    const internals=connections.filter(c=>group.has(c.fromGate)&&group.has(c.toGate)).map(c=>({
      c,bends:copyPoints(c.bends),routes:copyPoints(c.routePoints)}));
    const free=window.snapshotOpenWiresForDrag?.(group)||[];
    const minX=Math.min(...snapshot.map(g=>g.x)),minY=Math.min(...snapshot.map(g=>g.y));
    const maxX=Math.max(...snapshot.map(g=>g.x+g.w)),maxY=Math.max(...snapshot.map(g=>g.y+g.h));
    moving={start:null,snapshot,internals,free,minX,minY,maxX,maxY,
      history:typeof captureCircuitState==='function'?captureCircuitState():null};
    drawingArea.style.cursor='move';
  }
  function applyMove(dx,dy) {
    if(!moving)return;
    dx=Math.max(-moving.minX,Math.min(dx,drawingArea.clientWidth-moving.maxX));
    dy=Math.max(-moving.minY,Math.min(dy,drawingArea.clientHeight-moving.maxY));
    const grid=typeof GRID_SIZE==='number'?GRID_SIZE:20;
    dx=Math.round(dx/grid)*grid;dy=Math.round(dy/grid)*grid;
    for(const g of moving.snapshot){g.element.style.left=`${g.x+dx}px`;g.element.style.top=`${g.y+dy}px`;}
    for(const s of moving.internals){
      if(s.bends)s.c.bends=s.bends.map(p=>({x:p.x+dx,y:p.y+dy}));
      if(s.routes)s.c.routePoints=s.routes.map(p=>({x:p.x+dx,y:p.y+dy}));
    }
    window.translateOpenWiresForDrag?.(moving.free,dx,dy);
    updateWires();
    moving.dx=dx;moving.dy=dy;
  }
  function endMove(cancel=false) {
    if(!moving)return;
    if(cancel)applyMove(0,0);
    else if(moving.history&&typeof recordCircuitChange==='function')recordCircuitChange(moving.history);
    moving=null;drawingArea.style.cursor='';
  }
  document.addEventListener('pointermove',event=>{
    if(!moving)return;
    const p=point(event);
    if(!moving.start){moving.start=p;return;}
    applyMove(p.x-moving.start.x,p.y-moving.start.y);
  },true);
  // Prevent the placement click from initiating new gate or wire operations.
  document.addEventListener('click',event=>{
    if(!moving||!drawingArea.contains(event.target))return;
    event.preventDefault();event.stopImmediatePropagation();endMove(false);
  },true);

  // Rotate all selected items around ONE group center. Internal wire paths
  // rotate in canvas coordinates; unrelated external wires stay pin-attached.
  function rotateGroup() {
    if(!selectedCanvasGates.size)return;
    const gates=[...selectedCanvasGates];
    const bounds=selectedBounds();if(!bounds)return;
    const center={x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2};
    const turn=p=>({x:center.x-(p.y-center.y),y:center.y+(p.x-center.x)});
    const selected=new Set(gates);
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    // Rotate group-contained connection paths before updating endpoints.
    for(const c of connections){
      if(!selected.has(c.fromGate)||!selected.has(c.toGate))continue;
      if(!c.routePoints&&typeof createRoutePoints==='function')c.routePoints=createRoutePoints(c);
      if(c.routePoints){
        c.routePoints=c.routePoints.map(turn);
        if(c.routePoints.length>=2){
          c.startDirection=c.routePoints[0].y===c.routePoints[1].y?'horizontal':'vertical';
          const n=c.routePoints.length-1;
          c.endDirection=c.routePoints[n-1].y===c.routePoints[n].y?'horizontal':'vertical';
        }
      } else if(c.bends)c.bends=c.bends.map(turn);
    }
    // Rotating gate centers retains correct positioning when gate dimensions differ.
    for(const gate of gates){
      const oldCenter={x:(parseFloat(gate.style.left)||0)+gate.offsetWidth/2,
        y:(parseFloat(gate.style.top)||0)+gate.offsetHeight/2};
      const newCenter=turn(oldCenter);
      gate.style.left=`${newCenter.x-gate.offsetWidth/2}px`;
      gate.style.top=`${newCenter.y-gate.offsetHeight/2}px`;
      const svg=gate.querySelector('svg');if(!svg)continue;
      const angle=(Number(gate.dataset.rotation||0)+90)%360;
      gate.dataset.rotation=angle;
      svg.style.transformOrigin='center center';
      svg.style.transform=`rotate(${angle}deg)`;
      svg.style.overflow='visible';
      if(gate.dataset.type==='INPUT'||gate.dataset.type==='OUTPUT'){
        svg.querySelectorAll('text').forEach(label=>{
          label.style.transformBox='fill-box';
          label.style.transformOrigin='center center';
          label.style.transform=`rotate(${-angle}deg)`;
        });
      }
    }
    // Each selected source's open wires rotate as complete shapes, including
    // their endpoints and registered branches.
    window.rotateOpenWiresForGroup?.(selected,center);
    updateWires();
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
  }

  menu.addEventListener('click',event=>{
    const button=event.target.closest('button[data-group-action]');if(!button)return;
    const action=button.dataset.groupAction;
    hideMenu();event.stopPropagation();
    if(action==='move')beginMove();
    if(action==='rotate')rotateGroup();
    if(action==='delete')document.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true}));
    if(action==='cancel')clearCanvasSelection();
  });
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))hideMenu();},true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(moving){e.preventDefault();endMove(true);}hideMenu();}
  },true);
})();
