// Sequential Latches: SR (active-high truth convention), D, JK.
// Q stores a bit across evaluations; the companion Q̅ is its complement.
(() => {
  'use strict';
  const category=document.getElementById('latchesCategory');
  const menu=document.getElementById('latchesChoices');
  if(!category||!menu||!window.advancedComponentPlacement)return;
  const ns='http://www.w3.org/2000/svg';
  const isBit=b=>b===0||b===1;
  const inpCount=kind=>kind==='D'?1:2;
  const dimensions=(kind,enable)=>({width:180,height:enable?156:128});
  const svg=(tag,atts,txt)=>{
    const node=document.createElementNS(ns,tag);
    for(const [k,v] of Object.entries(atts))node.setAttribute(k,String(v));
    if(txt!==undefined)node.textContent=txt;
    return node;
  };
  function draw(gate,kind,enable){
    const {width,height}=dimensions(kind,enable);
    gate.dataset.type='LATCH';
    gate.dataset.latchKind=kind;
    gate.dataset.inputs=String(inpCount(kind)+(enable?1:0));
    gate.dataset.enable=enable?'1':'0';
    gate.classList.add('latch-gate','advanced-gate');
    gate.style.width=`${width}px`;
    gate.style.height=`${height}px`;
    const picture=svg('svg',{viewBox:`0 0 ${width} ${height}`,role:'img',
      'aria-label':`${kind} Latch${enable?' with Enable':''}; outputs Q and Q bar`});
    picture.style.width='100%';picture.style.height='100%';
    const left=19,right=width-19,bottom=height-23;
    picture.append(svg('rect',{x:left,y:8,width:width-38,height:bottom-8,rx:11,
      fill:'#180b38',stroke:'#b026ff','stroke-width':2.7}));
    picture.append(svg('text',{x:width/2,y:Math.round((bottom+8)/2)+4,
      'text-anchor':'middle',fill:'#f3f5ff','font-size':15,'font-weight':'bold',
      'font-family':'Arial,sans-serif'},`${kind} Latch`));
    const labels=kind==='SR'?['S','R']:kind==='D'?['D']:['J','K'];
    const ys=labels.length===1?[(bottom+8)/2]:[Math.round((bottom+8)/2)-23,Math.round((bottom+8)/2)+23];
    labels.forEach((label,i)=>{
      const y=ys[i];
      picture.append(svg('line',{x1:3,y1:y,x2:left,y2:y,stroke:'#00ffff','stroke-width':2}));
      picture.append(svg('text',{x:left+8,y:y+4,fill:'#f3f5ff','font-size':12,
        'font-family':'Arial,sans-serif'},label));
      picture.append(svg('circle',{class:'input-pin','data-pin':i,cx:3,cy:y,r:4,fill:'#00ffff'}));
    });
    [Math.round((bottom+8)/2)-23,Math.round((bottom+8)/2)+23].forEach((y,i)=>{
      picture.append(svg('line',{x1:right,y1:y,x2:width-3,y2:y,stroke:'#39ff14','stroke-width':2}));
      picture.append(svg('text',{x:right-9,y:y+4,'text-anchor':'end',fill:'#f3f5ff',
        'font-size':12,'font-family':'Arial,sans-serif'},i?'Q̅':'Q'));
      picture.append(svg('circle',{class:'output-pin','data-output':i,cx:width-3,cy:y,r:4,fill:'#39ff14'}));
    });
    if(enable){
      const x=width/2;
      picture.append(svg('line',{x1:x,y1:bottom,x2:x,y2:height-3,stroke:'#00ffff','stroke-width':2}));
      picture.append(svg('text',{x:x+10,y:height-12,fill:'#f3f5ff','font-size':12,
        'font-family':'Arial,sans-serif'},'E'));
      picture.append(svg('circle',{class:'input-pin','data-pin':labels.length,cx:x,cy:height-3,r:4,fill:'#00ffff'}));
    }
    gate.replaceChildren(picture);
    gate.title=`${kind} Latch. ${enable?'E=0 holds state; E=1 enables input.':'Enable is not connected (always active).'} Q and Q̅ retain the previous state.`;
  }

  // Returns state without mutating the supplied argument. null means a genuinely unknown state.
  function next(kind,bits,current,enablePresent,lastE){
    const n=inpCount(kind);
    const e=enablePresent?bits[n]:1;
    if(enablePresent && e===0)return current;
    if(!isBit(e))return null;
    if(kind==='D')return isBit(bits[0])?bits[0]:null;
    if(!bits.slice(0,n).every(isBit))return null;
    const [a,b]=bits;
    if(kind==='SR'){
      if(a===1&&b===1)return null; // forbidden input S=R=1
      if(a===1)return 1;
      if(b===1)return 0;
      return current;
    }
    // JK latch with both J and K high: toggle once per E activation,
    // not on each animation frame (which would produce an artificial oscillator).
    if(a===0&&b===0)return current;
    if(a===1&&b===0)return 1;
    if(a===0&&b===1)return 0;
    if(enablePresent && lastE===1)return current;
    return isBit(current)?1-current:null;
  }
  function step(gate,bits){
    const kind=gate.dataset.latchKind;
    if(!['SR','D','JK'].includes(kind))return null;
    const enable=gate.dataset.enable==='1';
    const previous=gate.dataset.qvalue==='0'?0:gate.dataset.qvalue==='1'?1:null;
    const lastE=gate.dataset.latchLastE==='0'?0:gate.dataset.latchLastE==='1'?1:null;
    const value=next(kind,bits,previous,enable,lastE);
    gate.dataset.qvalue=isBit(value)?String(value):'unknown';
    if(enable)gate.dataset.latchLastE=isBit(bits[inpCount(kind)])?String(bits[inpCount(kind)]):'unknown';
    else gate.dataset.latchLastE='unknown';
    return value;
  }
  function expression(kind,pin,inputs,enabled){
    const names=inputs.map(x=>x||'?');
    const q='Q(t)', s=names[0], r=names[1];
    // State equations from the lecture. SR=11 is forbidden (not a valid output).
    const data=kind==='D'?s:
      kind==='SR'?`(${s} + ¬(${r}) · ${q}) [S=R=1: Undefined]`:
      `(${s} · ¬${q} + ¬(${r}) · ${q})`;
    const state=enabled?`(E ? ${data} : ${q})`:data;
    return pin===0?state:`¬(${state})`;
  }
  window.latchLogic={next,step,expression,inpCount};

  const close=()=>{menu.hidden=true;category.setAttribute('aria-expanded','false');};
  category.addEventListener('click',()=>{
    const opening=menu.hidden;
    document.querySelectorAll('.advanced-choices').forEach(el=>{if(el!==menu)el.hidden=true;});
    document.querySelectorAll('.advanced-tab[aria-expanded]').forEach(el=>{if(el!==category)el.setAttribute('aria-expanded','false');});
    menu.hidden=!opening;category.setAttribute('aria-expanded',String(opening));
  });
  document.querySelectorAll('.advanced-tab').forEach(el=>{if(el!==category)el.addEventListener('click',close);});
  menu.querySelectorAll('[data-latch-kind]').forEach(button=>button.addEventListener('click',()=>{
    const kind=button.dataset.latchKind;
    const {width,height}=dimensions(kind,false);
    const place=window.advancedComponentPlacement.findSpace(width,height);
    if(!place){alert('No free space is available for this latch.');return;}
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    const gate=document.createElement('div');gate.className='logic-gate advanced-gate latch-gate';
    gate.style.left=`${place.x}px`;gate.style.top=`${place.y}px`;
    gate.dataset.qvalue='unknown';gate.dataset.latchLastE='unknown';
    draw(gate,kind,false);
    drawingArea.appendChild(gate);
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
    close();
  }));
  const button=document.getElementById('toggleLatchEnable');
  if(button)button.addEventListener('click',()=>{
    const gate=typeof selectedGate!=='undefined'?selectedGate:null;
    if(!gate||gate.dataset.type!=='LATCH'||gate.dataset.masterSlaveRole)return;
    const kind=gate.dataset.latchKind;
    const had=gate.dataset.enable==='1';
    const wanted=!had;
    const {width,height}=dimensions(kind,wanted);
    const x=Number.parseFloat(gate.style.left)||0,y=Number.parseFloat(gate.style.top)||0;
    let place={x,y,width,height};
    if(x+width>drawingArea.clientWidth||y+height>drawingArea.clientHeight||
       !window.advancedComponentPlacement.isFree(place,new Set([gate]),4)){
      place=window.advancedComponentPlacement.findSpace(width,height);
      if(!place){alert('No free space available to change Enable.');gateContextMenu.style.display='none';return;}
    }
    const eIndex=inpCount(kind);
    const attached=connections.filter(w=>had && w.toGate===gate && Number(w.inputIndex)===eIndex);
    if(attached.length && !confirm('Remove Enable? The wire connected to E will be disconnected.')){
      gateContextMenu.style.display='none';return;
    }
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    for(const w of attached){
      if(typeof deleteWireConnection==='function')deleteWireConnection(w);
      else {const ix=connections.indexOf(w);if(ix>=0)connections.splice(ix,1);w.line?.remove();}
    }
    gate.style.left=`${place.x}px`;gate.style.top=`${place.y}px`;
    gate.dataset.latchLastE='unknown';
    draw(gate,kind,wanted);
    if(typeof updateWires==='function')updateWires();
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
    gateContextMenu.style.display='none';
  });
})();
