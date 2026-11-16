// 2-to-1 and 4-to-1 multiplexers, optional active-high Enable.
// Data pins are on the left, select pins S0/S1 are at the bottom, Y is on the right.
(() => {
  'use strict';
  const category = document.getElementById('muxCategory');
  const menu = document.getElementById('muxChoices');
  if (!category || !menu || !window.advancedComponentPlacement) return;

  const sizeOf = raw => Number(raw) === 4 ? 4 : 2;
  const selectCount = size => Math.log2(size);
  const inputCount = (size, enable, type = 'MUX') =>
    (type === 'MUX' ? size : 1) + selectCount(size) + Number(enable);
  const dims = (size, enable, type = 'MUX') => ({
    width:190,
    height:type === 'DEMUX' ? (size === 4 ? 216 : (enable ? 164 : 146))
      : (size === 4 ? (enable ? 226 : 190) : (enable ? 178 : 138))
  });

  function evaluate(bits, pin, rawSize, enabled, type = 'MUX') {
    const size=sizeOf(rawSize), n=selectCount(size);
    if(bits.length !== inputCount(size,enabled,type)) return null;
    const enableIndex=(type==='MUX'?size:1)+n;
    if(enabled && bits[enableIndex]===0) return 0;
    if(enabled && bits[enableIndex]!==1) return null;
    const selects=bits.slice(type==='MUX'?size:1, enableIndex);
    if(selects.some(x=>x!==0&&x!==1)) return null;
    const selected=selects.reduce((idx,bit,i)=>idx|(bit<<i),0);
    if(type==='DEMUX') {
      if(pin<0||pin>=size) return null;
      return selected!==pin ? 0 : (bits[0]===0||bits[0]===1 ? bits[0] : null);
    }
    if(pin!==0) return null;
    return bits[selected]===0||bits[selected]===1 ? bits[selected] : null;
  }

  function expression(inputs, rawSize, enabled, type = 'MUX', pin = 0) {
    const size=sizeOf(rawSize), n=selectCount(size);
    if(type==='DEMUX') {
      if(pin<0||pin>=size)return '?';
      const parts=[`(${inputs[0]||'?'})`];
      for(let i=n-1;i>=0;i--) {
        const bit=inputs[1+i]||'?';
        parts.push(pin&(1<<i)?`(${bit})`:`¬(${bit})`);
      }
      if(enabled)parts.push(`(${inputs[1+n]||'?'})`);
      return `(${parts.join(' · ')})`;
    }
    const terms=Array.from({length:size},(_,index)=>{
      const factors=[];
      for(let i=n-1;i>=0;i--){
        const bit=inputs[size+i]||'?';
        factors.push(index&(1<<i)?`(${bit})`:`¬(${bit})`);
      }
      factors.push(`(${inputs[index]||'?'})`);
      return `(${factors.join(' · ')})`;
    });
    const base=`(${terms.join(' + ')})`;
    return enabled?`((${inputs[size+n]||'?'}) · ${base})`:base;
  }
  window.muxLogic={evaluate,expression};

  const ns='http://www.w3.org/2000/svg';
  const svg=(tag,attrs,value)=>{
    const el=document.createElementNS(ns,tag);
    for(const [key,val] of Object.entries(attrs))el.setAttribute(key,String(val));
    if(value!==undefined)el.textContent=value;
    return el;
  };
  function draw(gate,size,enable,type='MUX') {
    const {width,height}=dims(size,enable,type);
    gate.dataset.type=type;
    gate.dataset.inputs=String(inputCount(size,enable,type));
    gate.dataset.muxSize=String(size);
    gate.dataset.enable=enable?'1':'0';
    gate.style.width=`${width}px`;
    gate.style.height=`${height}px`;
    gate.classList.add('mux-gate');

    const picture=svg('svg',{viewBox:`0 0 ${width} ${height}`,role:'img',
      'aria-label':`${type} ${type==='MUX'?`${size} to 1`:`1 to ${size}`}${enable?' with Enable':''}`});
    picture.style.width='100%';picture.style.height='100%';
    const left=22,right=width-23,top=9,bottom=height-32;
    const outline=type==='MUX'
      ?`M ${left} ${top} L ${right-7} ${top+17} L ${right-7} ${bottom-19} L ${left} ${bottom} Z`
      :`M ${left} ${top+17} L ${right-7} ${top} L ${right-7} ${bottom} L ${left} ${bottom-19} Z`;
    picture.append(svg('path',{d:outline,fill:'#180b38',stroke:'#b026ff','stroke-width':2.7,'stroke-linejoin':'round'}));
    const centerY=Math.round((top+bottom)/2);
    picture.append(svg('text',{x:width/2,y:centerY-2,'text-anchor':'middle','font-size':15,
      'font-weight':'bold','font-family':'Arial,sans-serif',fill:'#f3f5ff'},type));
    picture.append(svg('text',{x:width/2,y:centerY+15,'text-anchor':'middle','font-size':11,
      'font-family':'Arial,sans-serif',fill:'#d6ccfb'},type==='MUX'?`${size} × 1`:`1 × ${size}`));

    const leftPins=type==='MUX'?size:1;
    // Separate E from the other left pins and keep the bottom edge clear.
    const low=enable?bottom-62:bottom-26;
    const hi=top+25;
    const positions=leftPins===1?[centerY] : Array.from({length:leftPins},(_,i)=>hi+i*(low-hi)/(leftPins-1));
    const addLeft=(label,index,y)=>{
      picture.append(svg('line',{x1:3,y1:y,x2:left,y2:y,stroke:'#00ffff','stroke-width':2}));
      picture.append(svg('text',{x:left+7,y:y+4,'font-family':'Arial,sans-serif',fill:'#eef4ff','font-size':11},label));
      picture.append(svg('circle',{class:'input-pin','data-pin':index,cx:3,cy:y,r:4,fill:'#00ffff'}));
    };
    positions.forEach((y,i)=>addLeft(type==='MUX'?`I${i}`:'I',i,y));
    const selOffset=type==='MUX'?size:1;
    if(enable)addLeft('E',selOffset+selectCount(size),bottom-27);

    const addRight=(label,index,y)=>{
      picture.append(svg('line',{x1:right-7,y1:y,x2:width-3,y2:y,stroke:'#39ff14','stroke-width':2}));
      picture.append(svg('text',{x:right-13,y:y-6,'text-anchor':'end',fill:'#eef4ff',
        'font-size':11,'font-family':'Arial,sans-serif'},label));
      picture.append(svg('circle',{class:'output-pin','data-output':index,cx:width-3,cy:y,r:4,fill:'#39ff14'}));
    };
    if(type==='MUX')addRight('Y',0,centerY);
    else {
      const start=top+29,finish=bottom-28;
      for(let i=0;i<size;i++)addRight(`D${i}`,i,start+i*(finish-start)/(size-1));
    }
    for(let i=0;i<selectCount(size);i++){
      const x=selectCount(size)===1?Math.round(width/2):(Math.round(width/2)+(i===0?-24:24));
      picture.append(svg('line',{x1:x,y1:bottom-8,x2:x,y2:height-3,stroke:'#00ffff','stroke-width':2}));
      picture.append(svg('text',{x:x+8,y:height-17,fill:'#eef4ff','font-size':11,'font-family':'Arial,sans-serif'},`S${i}`));
      picture.append(svg('circle',{class:'input-pin','data-pin':selOffset+i,cx:x,cy:height-3,r:4,fill:'#00ffff'}));
    }
    gate.replaceChildren(picture);
    gate.title=`${type} ${type==='MUX'?`${size}×1`:`1×${size}`}${enable?' with active-high Enable':''}. S0 is the least significant selection line.`;
  }

  function close() {menu.hidden=true;category.setAttribute('aria-expanded','false');}
  category.addEventListener('click',()=>{
    const opening=menu.hidden;
    document.querySelectorAll('.advanced-choices').forEach(el=>{if(el!==menu)el.hidden=true;});
    document.querySelectorAll('.advanced-tab[aria-expanded]').forEach(el=>{if(el!==category)el.setAttribute('aria-expanded','false');});
    menu.hidden=!opening;
    category.setAttribute('aria-expanded',String(opening));
  });
  document.querySelectorAll('.advanced-tab').forEach(el=>{if(el!==category)el.addEventListener('click',close);});
  menu.querySelectorAll('[data-mux-size]').forEach(button => button.addEventListener('click',()=>{
    const size=sizeOf(button.dataset.muxSize);
    const {width,height}=dims(size,false);
    const place=window.advancedComponentPlacement.findSpace(width,height);
    if(!place){alert('No free space is available for this component.');return;}
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    const gate=document.createElement('div');
    gate.className='logic-gate advanced-gate mux-gate';
    gate.style.left=`${place.x}px`;gate.style.top=`${place.y}px`;
    draw(gate,size,false);
    drawingArea.appendChild(gate);
    if(before && typeof recordCircuitChange==='function')recordCircuitChange(before);
    close();
  }));

  const toggle=document.getElementById('toggleMuxEnable');
  if(toggle)toggle.addEventListener('click',()=>{
    const gate=typeof selectedGate!=='undefined'?selectedGate:null;
    if(!gate || !['MUX','DEMUX'].includes(gate.dataset.type))return;
    const size=sizeOf(gate.dataset.muxSize);
    const wasEnabled=gate.dataset.enable==='1', newEnabled=!wasEnabled;
    const type=gate.dataset.type;
    const {width,height}=dims(size,newEnabled,type);
    const oldX=parseFloat(gate.style.left)||0,oldY=parseFloat(gate.style.top)||0;
    const excluded=new Set([gate]);
    let position={x:oldX,y:oldY,width,height};
    if(position.x+width>drawingArea.clientWidth||position.y+height>drawingArea.clientHeight||
       !window.advancedComponentPlacement.isFree(position,excluded,4)) {
      position=window.advancedComponentPlacement.findSpace(width,height);
      if(!position){alert('No free space is available to change Enable.');gateContextMenu.style.display='none';return;}
    }
    const enablePin=(type==='MUX'?size:1)+selectCount(size);
    const enableWires=connections.filter(w=>wasEnabled && w.toGate===gate && Number(w.inputIndex)===enablePin);
    if(enableWires.length && !confirm('Remove Enable? The wire connected to E will be disconnected.')) {
      gateContextMenu.style.display='none';return;
    }
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    for(const w of enableWires) {
      if(typeof deleteWireConnection==='function') deleteWireConnection(w);
      else {const i=connections.indexOf(w);if(i>=0)connections.splice(i,1);w.line?.remove();}
    }
    gate.style.left=`${position.x}px`;gate.style.top=`${position.y}px`;
    draw(gate,size,newEnabled,type);
    if(typeof updateWires==='function')updateWires();
    if(before && typeof recordCircuitChange==='function')recordCircuitChange(before);
    gateContextMenu.style.display='none';
  });
  const convert=document.getElementById('convertComponent');
  if(convert)convert.addEventListener('click',()=>{
    const gate=typeof selectedGate!=='undefined'?selectedGate:null;
    if(!gate||!['MUX','DEMUX'].includes(gate.dataset.type))return;
    const oldType=gate.dataset.type;
    const type=oldType==='MUX'?'DEMUX':'MUX';
    const size=sizeOf(gate.dataset.muxSize);
    const enabled=gate.dataset.enable==='1';
    const {width,height}=dims(size,enabled,type);
    let position={x:parseFloat(gate.style.left)||0,y:parseFloat(gate.style.top)||0,width,height};
    if(position.x+width>drawingArea.clientWidth||position.y+height>drawingArea.clientHeight||
      !window.advancedComponentPlacement.isFree(position,new Set([gate]),4)) {
      position=window.advancedComponentPlacement.findSpace(width,height);
      if(!position){alert('No free space is available to convert this component.');gateContextMenu.style.display='none';return;}
    }
    // The terminals have different meanings after conversion. Disconnect all wires safely.
    const attached=connections.filter(w=>w.fromGate===gate||w.toGate===gate);
    if(attached.length&&!confirm(`Convert ${oldType} to ${type}? ${attached.length} connected wire(s) will be disconnected to prevent incorrect pin assignments.`)){
      gateContextMenu.style.display='none';return;
    }
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    for(const w of attached){
      if(typeof deleteWireConnection==='function')deleteWireConnection(w);
      else {const i=connections.indexOf(w);if(i>=0)connections.splice(i,1);w.line?.remove();}
    }
    gate.style.left=`${position.x}px`;gate.style.top=`${position.y}px`;
    draw(gate,size,enabled,type);
    if(typeof updateWires==='function')updateWires();
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
    gateContextMenu.style.display='none';
  });

})();
