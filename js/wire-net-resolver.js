// Electrical net graph. A drawn wire becomes conductive ONLY through
// explicit output/input pins, recorded branches, or endpoints snapped to
// another wire. Interior/interior crossings (wire bridges) never connect.
(() => {
  'use strict';
  const TOL = 5;
  const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const coord = node => ({x:Number(node.getAttribute('cx')),y:Number(node.getAttribute('cy'))});
  function onSegment(p,a,b) {
    const dx=b.x-a.x, dy=b.y-a.y, length=dx*dx+dy*dy;
    if(length<.001) return distance(p,a)<=TOL;
    const t=Math.min(1,Math.max(0,((p.x-a.x)*dx+(p.y-a.y)*dy)/length));
    return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy))<=TOL;
  }
  function onPath(p,points) {
    for(let i=1;i<points.length;i++) if(onSegment(p,points[i-1],points[i]))return true;
    return false;
  }
  function route(c) {
    if(c.routePoints?.length>1)return c.routePoints;
    const d=c.line?.getAttribute('d')||'';
    // SVG paths without explicit routePoints must follow the actual visible
    // H/V/M/L path, not a fabricated straight diagonal.
    const tokens=d.match(/[MLHVmlhv]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi)||[];
    const pts=[];let x=0,y=0,cmd='',i=0;
    while(i<tokens.length){
      if(/^[MLHVmlhv]$/.test(tokens[i])){cmd=tokens[i++];continue;}
      if(!cmd)break;
      const relative=cmd===cmd.toLowerCase();
      if(cmd.toUpperCase()==='H'){const n=Number(tokens[i++]);x=relative?x+n:n;}
      else if(cmd.toUpperCase()==='V'){const n=Number(tokens[i++]);y=relative?y+n:n;}
      else if('ML'.includes(cmd.toUpperCase())){if(i+1>=tokens.length)break;const a=Number(tokens[i++]),b=Number(tokens[i++]);x=relative?x+a:a;y=relative?y+b:b;if(cmd==='M')cmd='L';if(cmd==='m')cmd='l';}
      else break;
      pts.push({x,y});
    }
    return pts;
  }
  function rootDriver(wire,seen=new Set()) {
    if(!wire||seen.has(wire))return null;
    seen.add(wire);
    if(wire.parentConnection)return {gate:wire.parentConnection.fromGate,pin:Number(wire.parentConnection.outputIndex)||0};
    if(wire.parentWire)return rootDriver(wire.parentWire,seen);
    return wire.sourceKind==='output'?{gate:wire.sourceGate,pin:Number(wire.sourceIndex)||0}:null;
  }
  function collect() {
    const finished=(typeof connections==='undefined'?[]:connections).filter(c=>c.line?.isConnected&&c.fromGate?.isConnected&&c.toGate?.isConnected);
    const opened=(window.__dlaGetOpenWires?.()||[]).filter(w=>w.line?.isConnected&&w.sourceGate?.isConnected);
    const parts=[...finished.map(c=>({kind:'connection',object:c,points:route(c)})),...opened.map(w=>({kind:'open',object:w,points:w.vertices||[]}))];
    const parent=parts.map((_,i)=>i), find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
    const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
    const index=new Map(parts.map((p,i)=>[p.object,i]));
    // Explicit branch ownership is always a real electrical connection.
    for(let i=0;i<parts.length;i++){
      const p=parts[i],obj=p.object;
      const owner=p.kind==='connection'?obj.branchParent:(obj.parentConnection||obj.parentWire);
      if(index.has(owner))join(i,index.get(owner));
    }
    // A wire with a physical endpoint touching a second wire forms a tee.
    // Never join two wires merely because their interiors cross.
    for(let i=0;i<parts.length;i++){
      const p=parts[i];if(p.points.length<2)continue;
      const tips=p.kind==='open'?[p.points.at(-1)]:[];
      // Also support finalized explicitly drawn bends landing on a trunk.
      if(p.kind==='connection'&&p.object.openBranch)tips.push(p.points[0]);
      for(const tip of tips)for(let j=0;j<parts.length;j++){
        if(i!==j&&parts[j].points.length>1&&onPath(tip,parts[j].points))join(i,j);
      }
    }
    // A visible committed Node is an intentional electrical junction.
    // At that coordinate all touched conductors become ONE net. This is
    // deliberately distinct from an unmarked geometric wire crossing.
    for(const dot of drawingArea.querySelectorAll(
      '.wire-confirmed-junction, .open-wire-junction, .wire-free-endpoint'
    )) {
      if(!dot.isConnected || dot.style.display==='none')continue;
      const x=Number(dot.getAttribute('cx')),y=Number(dot.getAttribute('cy'));
      if(!Number.isFinite(x)||!Number.isFinite(y))continue;
      const at={x,y}, touched=[];
      for(let i=0;i<parts.length;i++)if(parts[i].points.length>1 && onPath(at,parts[i].points))touched.push(i);
      for(let j=1;j<touched.length;j++)join(touched[0],touched[j]);
    }
    const groups=new Map();
    parts.forEach((p,i)=>{const id=find(i);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(p);});
    const incoming=new Map(), netInfo=new Map();
    for(const [group,items] of groups){
      const drivers=[], sinks=[];
      const register=(list,gate,pin)=>{
        if(gate?.isConnected&&!list.some(x=>x.gate===gate&&x.pin===pin))list.push({gate,pin});
      };
      for(const item of items){
        const o=item.object;
        if(item.kind==='connection'){
          register(drivers,o.fromGate,Number(o.outputIndex)||0);
          register(sinks,o.toGate,Number(o.inputIndex)||0);
        }else if(o.sourceKind==='output')register(drivers,o.sourceGate,Number(o.sourceIndex)||0);
        else if(o.sourceKind==='input')register(sinks,o.sourceGate,Number(o.sourceIndex)||0);
        // Endpoint touching a free pin is an electrical attachment too.
        if(item.kind==='open'){
          const tip=item.points.at(-1);
          for(const gate of drawingArea.querySelectorAll('.logic-gate')){
            for(const pin of gate.querySelectorAll('.input-pin,.output-pin')){
              if(!tip||distance(tip,getPinPosition(pin))>TOL)continue;
              if(pin.classList.contains('input-pin'))register(sinks,gate,Number(pin.dataset.pin)||0);
              else register(drivers,gate,Number(pin.dataset.output)||0);
            }
          }
        }
      }
      // An open wire inherited a source via parent and the corresponding
      // completed wire is not necessarily present after user edits.
      for(const item of items)if(item.kind==='open'){
        const inherited=rootDriver(item.object);
        if(inherited)register(drivers,inherited.gate,inherited.pin);
      }
      const conflict=drivers.length>1;
      for(const sink of sinks){
        if(!incoming.has(sink.gate))incoming.set(sink.gate,new Map());
        // Never fabricate a value from two output drivers on one net.
        incoming.get(sink.gate).set(sink.pin,conflict?{conflict:true}:drivers[0]||{missing:true});
      }
      netInfo.set(group,{parts:items,drivers,sinks,conflict,connected:drivers.length===1});
    }
    return {incoming,groups:netInfo,parts,find,index};
  }
  window.__dlaResolveWireNets=collect;
})();
