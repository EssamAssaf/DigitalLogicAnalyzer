// Edge-triggered D, SR and JK flip-flops + a connectable CLK generator.
// Does not alter existing latches, gates or combinational analysis.
(() => {
  'use strict';
  const category=document.getElementById('flipFlopsCategory');
  const menu=document.getElementById('flipFlopsChoices');
  const area=document.getElementById('drawingArea');
  if(!category||!menu||!area||!window.advancedComponentPlacement)return;
  const ns='http://www.w3.org/2000/svg';
  const valid=x=>x===0||x===1;
  const inputs=kind=>kind==='D'?1:2;
  const dims=enable=>({width:180,height:enable?182:158});
  const el=(name,attrs,text)=>{
    const e=document.createElementNS(ns,name);
    for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));
    if(text!==undefined)e.textContent=text;
    return e;
  };

  function draw(gate,kind,enable){
    const {width,height}=dims(enable);
    gate.dataset.type='FLIP_FLOP';gate.dataset.ffKind=kind;
    gate.dataset.inputs=String(inputs(kind)+1+(enable?1:0));
    gate.dataset.enable=enable?'1':'0';
    gate.dataset.edge=gate.dataset.edge||'falling';
    gate.classList.add('advanced-gate','flip-flop-gate');
    gate.style.width=`${width}px`;gate.style.height=`${height}px`;
    const svg=el('svg',{viewBox:`0 0 ${width} ${height}`,role:'img','aria-label':`${kind} Flip-Flop with CLK, Q and Q bar`});
    svg.style.width='100%';svg.style.height='100%';
    const left=18,right=width-18,bottom=height-31,center=(bottom+8)/2;
    svg.append(el('rect',{x:left,y:8,width:right-left,height:bottom-8,rx:12,fill:'#180b38',stroke:'#b026ff','stroke-width':2.7}));
    svg.append(el('text',{x:width/2,y:center+5,'text-anchor':'middle',fill:'#f2f6ff',
      'font-family':'Arial,sans-serif','font-size':14,'font-weight':'bold'},`${kind} Flip-Flop`));
    const labels=kind==='D'?['D']:kind==='SR'?['S','R']:['J','K'];
    const ys=enable?(labels.length===1?[center-24]:[center-35,center+35]):(labels.length===1?[center]:[center-22,center+22]);
    labels.forEach((label,i)=>{
      const y=ys[i];
      svg.append(el('line',{x1:3,y1:y,x2:left,y2:y,stroke:'#00ffff','stroke-width':2}));
      svg.append(el('text',{x:left+8,y:y+4,fill:'#f2f6ff','font-family':'Arial,sans-serif','font-size':12},label));
      svg.append(el('circle',{class:'input-pin','data-pin':i,cx:3,cy:y,r:4,fill:'#00ffff'}));
    });
    [center-22,center+22].forEach((y,i)=>{
      svg.append(el('line',{x1:right,y1:y,x2:width-3,y2:y,stroke:'#39ff14','stroke-width':2}));
      svg.append(el('text',{x:right-7,y:y+4,'text-anchor':'end',fill:'#f2f6ff',
        'font-family':'Arial,sans-serif','font-size':12},i?'Q̅':'Q'));
      svg.append(el('circle',{class:'output-pin','data-output':i,cx:width-3,cy:y,r:4,fill:'#39ff14'}));
    });
    const clkX=enable?width/2-29:width/2;
    svg.append(el('line',{x1:clkX,y1:bottom,x2:clkX,y2:height-3,stroke:'#00ffff','stroke-width':2}));
    svg.append(el('text',{x:clkX+7,y:height-11,fill:'#f2f6ff','font-size':11,'font-family':'Arial,sans-serif'},'CLK'));
    // Triangle on clock input; bubble identifies falling-edge triggering.
    svg.append(el('path',{d:`M${clkX-7} ${bottom-13} L${clkX} ${bottom-5} L${clkX+7} ${bottom-13}`,
      fill:'none',stroke:'#f2f6ff','stroke-width':1.3}));
    if(gate.dataset.edge==='falling')svg.append(el('circle',{cx:clkX,cy:bottom-2,r:3,fill:'#180b38',stroke:'#f2f6ff','stroke-width':1.3}));
    svg.append(el('circle',{class:'input-pin','data-pin':labels.length,cx:clkX,cy:height-3,r:4,fill:'#00ffff'}));
    if(enable){
      // E sits BETWEEN S/R or J/K, and below D when there is one data input.
      // Preserve its original logical pin index for saved wires.
      const ey=labels.length===1?center+24:center;
      svg.append(el('line',{x1:3,y1:ey,x2:left,y2:ey,stroke:'#00ffff','stroke-width':2}));
      svg.append(el('text',{x:left+8,y:ey+4,fill:'#f2f6ff','font-size':12,'font-family':'Arial,sans-serif'},'E'));
      svg.append(el('circle',{class:'input-pin','data-pin':labels.length+1,cx:3,cy:ey,r:4,fill:'#00ffff'}));
    }
    gate.replaceChildren(svg);
    gate.title=`${kind} Flip-Flop. Triggered on ${gate.dataset.edge} CLK edge.${enable?' E=0 holds the stored state.':''}`;
  }

  // A missing / uninitialized clock must not generate an artificial edge.
  function next(kind,bits,previous,previousClock,edge,enabled){
    const n=inputs(kind),clock=bits[n],en=enabled?bits[n+1]:1;
    if(!valid(clock)||!valid(previousClock))return previous;
    const triggered=edge==='rising'?(previousClock===0&&clock===1):(previousClock===1&&clock===0);
    if(!triggered||en===0)return previous;
    if(!valid(en))return null;
    if(kind==='D')return valid(bits[0])?bits[0]:null;
    const [a,b]=bits;
    if(!valid(a)||!valid(b))return null;
    if(kind==='SR'){
      if(a===1&&b===1)return null;
      if(a===1)return 1;
      if(b===1)return 0;
      return previous;
    }
    if(a===0&&b===0)return previous;
    if(a===0&&b===1)return 0;
    if(a===1&&b===0)return 1;
    return valid(previous)?1-previous:null;
  }
  function step(gate,bits){
    const kind=gate.dataset.ffKind,clock=bits[inputs(kind)];
    const previous=gate.dataset.qvalue==='0'?0:gate.dataset.qvalue==='1'?1:null;
    const last=gate.dataset.ffLastClock==='0'?0:gate.dataset.ffLastClock==='1'?1:null;
    const value=next(kind,bits,previous,last,gate.dataset.edge||'falling',gate.dataset.enable==='1');
    gate.dataset.qvalue=valid(value)?String(value):'unknown';
    gate.dataset.ffLastClock=valid(clock)?String(clock):'unknown';
    return value;
  }
  function expression(kind,pin,values,enabled,edge){
    const signals=values.map(v=>v||'?');
    const clock=signals[inputs(kind)],q='Q(t)';
    // Lecture characteristic equations: Q(t) is memory, not another physical input.
    const action=kind==='D'?signals[0]:
      kind==='SR'?`(${signals[0]} + ¬(${signals[1]}) · ${q}) [S=R=1: Undefined]`:
      `(${signals[0]} · ¬${q} + ¬(${signals[1]}) · ${q})`;
    const updated=enabled?`(E ? ${action} : ${q})`:action;
    const formula=`${edge==='rising'?'↑':'↓'}${clock} ? ${updated} : ${q}`;
    return pin===0?formula:`¬(${formula})`;
  }
  window.flipFlopLogic={next,step,expression,draw};

  function close(){menu.hidden=true;category.setAttribute('aria-expanded','false');}
  category.addEventListener('click',()=>{
    const show=menu.hidden;
    document.querySelectorAll('.advanced-choices').forEach(m=>{if(m!==menu)m.hidden=true;});
    document.querySelectorAll('.advanced-tab[aria-expanded]').forEach(b=>{if(b!==category)b.setAttribute('aria-expanded','false');});
    menu.hidden=!show;category.setAttribute('aria-expanded',String(show));
  });
  document.querySelectorAll('.advanced-tab').forEach(b=>{if(b!==category)b.addEventListener('click',close);});
  menu.querySelectorAll('[data-ff-kind]').forEach(button=>button.addEventListener('click',()=>{
    const kind=button.dataset.ffKind;
    if(kind==='CLOCK'){addClock();close();return;}
    const {width,height}=dims(false);
    const place=window.advancedComponentPlacement.findSpace(width,height);
    if(!place){alert('No free space for the Flip-Flop.');return;}
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    const gate=document.createElement('div');gate.className='logic-gate advanced-gate flip-flop-gate';
    gate.style.left=`${place.x}px`;gate.style.top=`${place.y}px`;
    gate.dataset.qvalue='unknown';gate.dataset.ffLastClock='unknown';gate.dataset.edge='falling';
    draw(gate,kind,false);area.append(gate);
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
    close();
  }));

  const toggle=document.getElementById('toggleFlipFlopEnable');
  if(toggle)toggle.addEventListener('click',()=>{
    const gate=typeof selectedGate!=='undefined'?selectedGate:null;
    if(!gate||gate.dataset.type!=='FLIP_FLOP')return;
    const had=gate.dataset.enable==='1',kind=gate.dataset.ffKind,wanted=!had;
    const {width,height}=dims(wanted);
    const x=parseFloat(gate.style.left)||0,y=parseFloat(gate.style.top)||0;
    let place={x,y,width,height};
    if(x+width>area.clientWidth||y+height>area.clientHeight||
        !window.advancedComponentPlacement.isFree(place,new Set([gate]),4)){
      place=window.advancedComponentPlacement.findSpace(width,height);
      if(!place){alert('No free space to change Enable.');gateContextMenu.style.display='none';return;}
    }
    const attached=connections.filter(w=>had&&w.toGate===gate&&Number(w.inputIndex)===inputs(kind)+1);
    if(attached.length&&!confirm('Remove Enable? Its connected wire will be disconnected.'))return;
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    for(const w of attached){if(typeof deleteWireConnection==='function')deleteWireConnection(w);
      else{const i=connections.indexOf(w);if(i>=0)connections.splice(i,1);w.line?.remove();}}
    gate.style.left=`${place.x}px`;gate.style.top=`${place.y}px`;
    draw(gate,kind,wanted);
    if(typeof updateWires==='function')updateWires();
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
    gateContextMenu.style.display='none';
  });

  const edgeButton=document.getElementById('toggleFlipFlopEdge');
  if(edgeButton)edgeButton.addEventListener('click',()=>{
    const gate=typeof selectedGate!=='undefined'?selectedGate:null;
    if(!gate||gate.dataset.type!=='FLIP_FLOP')return;
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    gate.dataset.edge=gate.dataset.edge==='rising'?'falling':'rising';
    gate.dataset.ffLastClock='unknown';
    draw(gate,gate.dataset.ffKind,gate.dataset.enable==='1');
    if(typeof updateWires==='function')updateWires();
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
    gateContextMenu.style.display='none';
  });

  // Each CLOCK source is a real output pin. The clock only oscillates while Run is active.
  let timer=null;
  function repaint(clock){
    const value=clock.dataset.clockValue==='1'?1:0;
    const svg=clock.querySelector('svg');if(!svg)return;
    const valueNode=svg.querySelector('.clock-value');
    if(valueNode)valueNode.textContent=String(value);
    const frame=svg.querySelector('.clock-frame');
    if(frame)frame.setAttribute('stroke',value?'#39ff14':'#00bfff');
    const pin=svg.querySelector('.output-pin');
    if(pin)pin.setAttribute('fill',value?'#39ff14':'#00bfff');
  }
  function addClock(){
    // Same visual language as an A-G input, a little wider and larger.
    const width=126,height=84;
    const place=window.advancedComponentPlacement.findSpace(width,height);
    if(!place){alert('No free space for CLK.');return;}
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    const gate=document.createElement('div');gate.className='logic-gate advanced-gate clock-gate';
    gate.dataset.type='CLOCK';gate.dataset.inputs='0';gate.dataset.clockValue='0';
    gate.style.left=`${place.x}px`;gate.style.top=`${place.y}px`;
    gate.style.width=`${width}px`;gate.style.height=`${height}px`;
    gate.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 126 84" role="img" aria-label="CLK source">
      <rect class="clock-frame" x="8" y="17" width="97" height="49" rx="11" fill="#07152e" stroke="#00bfff" stroke-width="2.7" />
      <text x="40" y="47" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="18" font-weight="bold">CLK</text>
      <text class="clock-value" x="88" y="47" text-anchor="middle" fill="#39ff14" font-family="Arial,sans-serif" font-size="17" font-weight="bold">0</text>
      <line x1="105" y1="42" x2="122" y2="42" stroke="#00bfff" stroke-width="2" />
      <circle class="output-pin" data-output="0" cx="122" cy="42" r="4" fill="#00bfff" />
    </svg>`;
    area.append(gate);
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
  }
  function stopClock(){if(timer!==null){clearInterval(timer);timer=null;}}
  document.addEventListener('logic-run-state',event=>{
    stopClock();
    if(!event.detail?.active)return;
    // Start low; each tick toggles all CLOCK elements consistently.
    area.querySelectorAll('.clock-gate').forEach(c=>{c.dataset.clockValue='0';repaint(c);});
    timer=setInterval(()=>{
      const clocks=area.querySelectorAll('.clock-gate');
      clocks.forEach(c=>{c.dataset.clockValue=c.dataset.clockValue==='1'?'0':'1';repaint(c);});
      if(clocks.length)document.dispatchEvent(new Event('logic-clock-tick'));
    },750);
  });
  window.addEventListener('pagehide',stopClock);
})();
