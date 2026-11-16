// Node status is derived from the SAME electrical net graph used by Run.
// A wire endpoint is a real junction when it touches another conductor;
// a visual crossing in the middle of two paths is NEVER a junction.
(() => {
  'use strict';
  if (window.__wireConnectionCheckInstalled) return;
  window.__wireConnectionCheckInstalled=true;
  let running=false;
  const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=5;
  const point=c=>({x:Number(c.getAttribute('cx')),y:Number(c.getAttribute('cy'))});
  const onPath=(p,pts)=>{
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y;
      const d=dx*dx+dy*dy;
      if(d<.001)continue;
      const t=Math.min(1,Math.max(0,((p.x-a.x)*dx+(p.y-a.y)*dy)/d));
      if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=5)return true;
    }
    return false;
  };
  let pending=false;
  function refresh() {
    pending=false;
    const model=window.__dlaResolveWireNets?.();
    if(!model)return;
    const {parts,index,find,groups}=model;
    const groupOf=obj=>index.has(obj)?groups.get(find(index.get(obj))):null;
    // Only an output-driven *connected net* may own signal coloring.
    // Keep selected wires yellow; change the persistent base colors otherwise.
    for(const info of groups.values()) {
      if(info.drivers.length!==1)continue;
      const src=info.drivers[0].gate?.querySelector('svg');
      const color=src?.dataset.wireColor || info.parts.find(p=>p.kind==='connection')?.object.line?.dataset.wireColor;
      if(!color)continue;
      for(const part of info.parts){
        const line=part.object.line;
        line.dataset.wireColor=color;
        if(line.getAttribute('stroke')!=='#ffff00' && line.getAttribute('stroke')!=='#FFFF00'){
          line.setAttribute('stroke',color);
          line.style.filter=`drop-shadow(0 0 5px ${color})`;
        }
      }
    }
    // Branch dots are actual electrical nodes by construction.
    for(const dot of drawingArea.querySelectorAll('.wire-confirmed-junction')) {
      const info=groupOf(dot.__wireConnection);
      const connected=!!info && info.parts.length>1;
      dot.style.opacity=running&&connected?'0':'1';
      dot.removeAttribute('stroke');
    }
    for(const w of (window.__dlaGetOpenWires?.()||[])) {
      const info=groupOf(w),tip=w.vertices?.at(-1);
      const tipContacts=tip?parts.some(part=>part.object!==w&&onPath(tip,part.points)):false;
      // Terminal touching a live gate input or output counts as connected.
      const terminal=!!tip&&[...drawingArea.querySelectorAll('.logic-gate .input-pin,.logic-gate .output-pin')]
        .some(pin=>near(tip,getPinPosition(pin)));
      const connected=tipContacts||terminal;
      if(w.endDot){
        w.endDot.style.opacity=running&&connected?'0':'1';
        if(running&&!connected){
          w.endDot.setAttribute('stroke','#ff5555');
          w.endDot.setAttribute('stroke-width','2');
        } else {
          w.endDot.removeAttribute('stroke');
          w.endDot.removeAttribute('stroke-width');
        }
      }
      if(w.branchDot)w.branchDot.style.opacity=running&&info&&info.parts.length>1?'0':'1';
    }
  }
  const queue=()=>{
    if(!running||pending)return;
    pending=true;requestAnimationFrame(refresh);
  };
  document.addEventListener('logic-run-state',event=>{
    running=!!event.detail?.active;
    refresh();
  });
  document.addEventListener('pointerup',queue);
  document.addEventListener('logic-clock-tick',queue);
})();
