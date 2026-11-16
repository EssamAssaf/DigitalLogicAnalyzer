// Master / Slave building blocks for D, SR and JK circuits.
// Every newly inserted block starts as Master. Right-click converts its role.
// The physical behavior is determined by its E wiring (CLK or inverted CLK),
// not by the text Master / Slave. Existing edge-triggered logic remains intact.
(() => {
  'use strict';
  const area = document.getElementById('drawingArea');
  const menu = document.getElementById('flipFlopsChoices');
  const tab = document.getElementById('flipFlopsCategory');
  const convertButton = document.getElementById('convertMasterSlave');
  if (!area || !menu || !window.advancedComponentPlacement) return;
  const ns = 'http://www.w3.org/2000/svg';
  const width = 188;
  const height = 146;
  const element = (tag, attrs, content) => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (content !== undefined) node.textContent = content;
    return node;
  };
  function render(gate) {
    const kind = gate.dataset.latchKind;
    const role = gate.dataset.masterSlaveRole;
    const label = `${kind} ${role}`;
    const pinNames = kind === 'D' ? ['D'] : kind === 'SR' ? ['S','R'] : ['J','K'];
    const svg = element('svg', {
      viewBox: `0 0 ${width} ${height}`,
      role: 'img',
      'aria-label': `${kind} ${role} latch with Enable E`
    });
    svg.style.width = '100%';
    svg.style.height = '100%';
    const left = 19, right = width - 19, bottom = height - 30;
    svg.append(element('rect', {
      x: left, y: 10, width: right-left, height: bottom-10, rx: 11,
      fill: '#180b38', stroke: '#b026ff', 'stroke-width': 2.7
    }));
    svg.append(element('text', {
      x: width / 2, y: 56, 'text-anchor': 'middle',
      fill: '#f3f5ff', 'font-size': 15, 'font-weight': 'bold',
      'font-family': 'Arial,sans-serif'
    }, role));
    svg.append(element('text', {
      x: width / 2, y: 76, 'text-anchor': 'middle',
      fill: '#bfc8e7', 'font-size': 12, 'font-family': 'Arial,sans-serif'
    }, `${kind} Latch`));
    const pinYs = pinNames.length === 1 ? [44] : [35, 105];
    pinNames.forEach((name,i) => {
      const y = pinYs[i];
      svg.append(element('line',{x1:3,y1:y,x2:left,y2:y,stroke:'#00ffff','stroke-width':2}));
      svg.append(element('text',{x:left+8,y:y+4,fill:'#f3f5ff','font-size':12,'font-family':'Arial,sans-serif'}, name));
      svg.append(element('circle',{class:'input-pin','data-pin':i,cx:3,cy:y,r:4,fill:'#00ffff'}));
    });
    const outputs = kind === 'D' ? ['Q'] : ['Q','Q̅'];
    const outYs = outputs.length === 1 ? [64] : [46,88];
    outputs.forEach((name,i)=>{
      const y=outYs[i];
      svg.append(element('line',{x1:right,y1:y,x2:width-3,y2:y,stroke:'#39ff14','stroke-width':2}));
      svg.append(element('text',{x:right-9,y:y+4,'text-anchor':'end',fill:'#f3f5ff','font-size':12,'font-family':'Arial,sans-serif'},name));
      svg.append(element('circle',{class:'output-pin','data-output':i,cx:width-3,cy:y,r:4,fill:'#39ff14'}));
    });
    // E sits BETWEEN S/R or J/K, matching the course diagrams.
    // Keep the logical data-pin index unchanged for existing saved connections.
    const ey=pinNames.length === 1 ? 92 : 70;
    svg.append(element('line',{x1:3,y1:ey,x2:left,y2:ey,stroke:'#00ffff','stroke-width':2}));
    svg.append(element('text',{x:left+8,y:ey+4,fill:'#f3f5ff','font-size':12,'font-family':'Arial,sans-serif'},'E'));
    svg.append(element('circle',{class:'input-pin','data-pin':pinNames.length,cx:3,cy:ey,r:4,fill:'#00ffff'}));
    gate.replaceChildren(svg);
    gate.title=`${label}. E=1 permits latch updates, E=0 holds the previous state. Connect CLK directly to Master E and inverted CLK to Slave E.`;
  }
  function insert(kind) {
    const position=window.advancedComponentPlacement.findSpace(width,height);
    if (!position) {alert(`No free space for ${kind} Master.`); return;}
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    const gate=document.createElement('div');
    gate.className='logic-gate advanced-gate master-slave-latch';
    gate.dataset.type='LATCH';
    gate.dataset.latchKind=kind;
    gate.dataset.masterSlaveRole='Master';
    gate.dataset.inputs=kind==='D'?'2':'3';
    gate.dataset.enable='1';
    gate.dataset.qvalue='unknown';
    gate.dataset.latchLastE='unknown';
    gate.style.width=`${width}px`;
    gate.style.height=`${height}px`;
    gate.style.left=`${position.x}px`;
    gate.style.top=`${position.y}px`;
    render(gate);
    area.append(gate);
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
    menu.hidden=true;
    tab?.setAttribute('aria-expanded','false');
  }
  // Intercept only D/SR/JK entries in the same original four-item menu.
  // Clock uses the pre-existing real CLK source implementation.
  menu.addEventListener('click', event => {
    const button=event.target.closest('button[data-ff-kind]');
    const kind=button?.dataset.ffKind;
    if(!['D','SR','JK'].includes(kind))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    insert(kind);
  },true);
  if(convertButton)convertButton.addEventListener('click',()=>{
    const gate=typeof selectedGate!=='undefined'?selectedGate:null;
    if(!gate||gate.dataset.type!=='LATCH'||!gate.dataset.masterSlaveRole)return;
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    gate.dataset.masterSlaveRole=gate.dataset.masterSlaveRole==='Master'?'Slave':'Master';
    render(gate); // Same pins and indices; existing wires remain attached.
    if(typeof updateWires==='function')updateWires();
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
    gateContextMenu.style.display='none';
  });
})();
