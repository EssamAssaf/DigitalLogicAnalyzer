// Encoder / Decoder: active-high standard one-hot encoder and binary decoder.
// This module augments the stable v10 implementation without replacing older panels.
(() => {
  'use strict';
  const category = document.getElementById('encoderDecoderCategory');
  const choices = document.getElementById('encoderDecoderChoices');
  if (!category || !choices || !window.advancedComponentPlacement) return;

  function evaluate(type, bits, pin, enabled = false) {
    if (type === 'ENCODER') {
      const required = bits.length;
      if (![4, 8, 16].includes(required) || bits.some(b => b !== 0 && b !== 1)) return null;
      const active = bits.reduce((count, b) => count + b, 0);
      if (active !== 1) return null; // Ordinary encoder has no priority function.
      const index = bits.indexOf(1);
      const outputCount = Math.log2(required);
      return pin >= 0 && pin < outputCount ? (index >> (outputCount - 1 - pin)) & 1 : null;
    }
    if (type === 'DECODER') {
      const data = enabled ? bits.slice(0, -1) : bits;
      if (![2, 3, 4].includes(data.length) || pin < 0 || pin >= 2 ** data.length) return null;
      if (enabled && bits.at(-1) === 0) return 0;
      if (enabled && bits.at(-1) !== 1) return null;
      if (data.some(b => b !== 0 && b !== 1)) return null;
      const index = data.reduce((num, bit) => num * 2 + bit, 0);
      return Number(index === pin);
    }
    return null;
  }

  function expression(type, inputs, pin, enabled = false) {
    if (type === 'ENCODER') {
      const outputCount = Math.log2(inputs.length);
      if (!Number.isInteger(outputCount) || pin < 0 || pin >= outputCount) return '?';
      const bit = outputCount - 1 - pin;
      const terms = inputs.filter((_, i) => (i >> bit) & 1);
      return `(${terms.join(' + ')})`; // Valid on exactly-one-active-input domain.
    }
    if (type === 'DECODER') {
      const data = enabled ? inputs.slice(0, -1) : inputs;
      if (pin < 0 || pin >= 2 ** data.length) return '?';
      const term = `(${data.map((x, i) => ((pin >> (data.length - i - 1)) & 1) ? `(${x})` : `¬(${x})`).join(' · ')})`;
      return enabled ? `((${inputs.at(-1) || '?'}) · ${term})` : term;
    }
    return '?';
  }
  window.encoderDecoderLogic = {evaluate, expression};

  const ns = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, value) {
    const element = document.createElementNS(ns, tag);
    for (const [key, val] of Object.entries(attrs || {})) element.setAttribute(key, String(val));
    if (value !== undefined) element.textContent = value;
    return element;
  }

  function dimensions(type, size, enable = false) {
    const inputCount = type === 'ENCODER' ? size : Math.log2(size) + Number(enable);
    const outputCount = type === 'ENCODER' ? Math.log2(size) : size;
    return {inputCount, outputCount, width: 208, height: Math.max(118, (Math.max(inputCount, outputCount) + 1) * 24) + (type === 'DECODER' && enable ? 28 : 0)};
  }

  function draw(gate, type, size, enable = false) {
    const {inputCount, outputCount, width, height} = dimensions(type, size, enable);
    const bottomEnable = type === 'DECODER' && enable;
    const bodyHeight = height - (bottomEnable ? 28 : 0);
    gate.classList.add('encoder-decoder-gate');
    gate.dataset.type = type;
    gate.dataset.codecSize = String(size);
    gate.dataset.inputs = String(inputCount);
    gate.dataset.enable = type === 'DECODER' && enable ? '1' : '0';
    gate.style.width = `${width}px`;
    gate.style.height = `${height}px`;
    const picture = svg('svg', {viewBox:`0 0 ${width} ${height}`, role:'img',
      'aria-label':`${type === 'ENCODER' ? 'Encoder' : 'Decoder'} with ${inputCount} inputs and ${outputCount} outputs`});
    picture.appendChild(svg('rect', {x:18, y:8, width:width-36, height:bodyHeight-16, rx:10,
      fill:'#180b38', stroke:'#b026ff', 'stroke-width':2.5}));
    const title = type === 'ENCODER' ? 'Encoder' : 'Decoder';
    picture.appendChild(svg('text', {x:width/2, y:bodyHeight/2-3, 'font-family':'Arial,sans-serif',
      'font-size':15, 'font-weight':'bold', 'text-anchor':'middle', fill:'#f3f5ff'}, title));
    picture.appendChild(svg('text', {x:width/2, y:bodyHeight/2+17, 'font-family':'Arial,sans-serif',
      'font-size':12, 'text-anchor':'middle', fill:'#d4c9fd'}, `${inputCount} × ${outputCount}`));

    function addSide(count, side) {
      const visibleCount = side === 'input' && bottomEnable ? count - 1 : count;
      for (let i=0; i<visibleCount; i++) {
        const y = (bodyHeight * (i+1)) / (visibleCount+1);
        const isInput = side === 'input';
        const startX = isInput ? 2 : width-18;
        const endX = isInput ? 18 : width-2;
        const line = svg('line', {x1:startX,y1:y,x2:endX,y2:y,
          stroke:isInput?'#00ffff':'#39ff14','stroke-width':2});
        picture.appendChild(line);
        const idx = isInput ? i : i;
        const label = isInput ?
          (type === 'ENCODER' ? `D${idx}` : `A${Math.log2(size)-1-idx}`) :
          (type === 'ENCODER' ? `Y${outputCount-1-idx}` : `Y${idx}`);
        picture.appendChild(svg('text', {
          x:isInput?26:width-26, y:y+4,
          'text-anchor':isInput?'start':'end',
          'font-family':'Arial,sans-serif','font-size':10,fill:'#f3f5ff'
        }, label));
        picture.appendChild(svg('circle', isInput ?
          {class:'input-pin','data-pin':i,cx:2,cy:y,r:4,fill:'#00ffff'} :
          {class:'output-pin','data-output':i,cx:width-2,cy:y,r:4,fill:'#39ff14'}));
      }
    }
    addSide(inputCount,'input');
    addSide(outputCount,'output');
    if (bottomEnable) {
      // E is logically the last input pin, but visually enters from below.
      const x = width / 2;
      picture.appendChild(svg('line', {x1:x, y1:bodyHeight-8, x2:x, y2:height-2,
        stroke:'#00ffff', 'stroke-width':2}));
      picture.appendChild(svg('text', {x:x+9, y:bodyHeight+10,
        'font-family':'Arial,sans-serif', 'font-size':11, fill:'#f3f5ff'}, 'E'));
      picture.appendChild(svg('circle', {class:'input-pin', 'data-pin':inputCount-1,
        cx:x, cy:height-2, r:4, fill:'#00ffff'}));
    }
    gate.replaceChildren(picture);
    gate.title = type === 'ENCODER' ? 'Exactly one active-high input is required.' : `Binary-to-one-hot decoding${enable ? ', active-high Enable (E)' : ''}.`;
  }

  function closeMenu() {
    choices.hidden = true;
    category.setAttribute('aria-expanded','false');
  }
  category.addEventListener('click', () => {
    const opening = choices.hidden;
    document.querySelectorAll('.advanced-choices').forEach(el => { if (el !== choices) el.hidden = true; });
    document.querySelectorAll('.advanced-tab[aria-expanded]').forEach(el => {if (el !== category) el.setAttribute('aria-expanded','false');});
    choices.hidden = !opening;
    category.setAttribute('aria-expanded',String(opening));
  });
  document.querySelectorAll('.advanced-tab').forEach(el => {
    if (el !== category) el.addEventListener('click',closeMenu);
  });
  choices.querySelectorAll('[data-encoder-size]').forEach(button => {
    button.addEventListener('click', () => {
      const size = Number(button.dataset.encoderSize);
      const {width,height} = dimensions('ENCODER',size);
      const place = window.advancedComponentPlacement.findSpace(width,height);
      if (!place) {alert('No free space is available for this component.'); return;}
      const before = typeof captureCircuitState === 'function' ? captureCircuitState() : null;
      const gate = document.createElement('div');
      gate.className='logic-gate advanced-gate encoder-decoder-gate';
      gate.style.left=`${place.x}px`;
      gate.style.top=`${place.y}px`;
      draw(gate,'ENCODER',size);
      drawingArea.appendChild(gate);
      if (before && typeof recordCircuitChange === 'function') recordCircuitChange(before);
      closeMenu();
    });
  });

  const convert = document.getElementById('convertComponent');
  if (convert) convert.addEventListener('click', () => {
    const gate = typeof selectedGate !== 'undefined' ? selectedGate : null;
    if (!gate || !['ENCODER','DECODER'].includes(gate.dataset.type)) return;
    const newType = gate.dataset.type === 'ENCODER' ? 'DECODER' : 'ENCODER';
    const size = Number(gate.dataset.codecSize);
    const {width,height} = dimensions(newType,size);
    const oldType = gate.dataset.type;
    const attached = connections.filter(w => w.fromGate === gate || w.toGate === gate);
    if (attached.length && !confirm(`Convert ${oldType} to ${newType}? ${attached.length} connected wire(s) will be disconnected to avoid incorrect pin assignments.`)) {
      gateContextMenu.style.display='none';
      return;
    }
    const left = Number.parseFloat(gate.style.left) || 0;
    const top = Number.parseFloat(gate.style.top) || 0;
    let proposed = {x:left,y:top,width,height};
    const excluded = new Set([gate]);
    if (proposed.x+width > drawingArea.clientWidth || proposed.y+height > drawingArea.clientHeight ||
        !window.advancedComponentPlacement.isFree(proposed,excluded,4)) {
      const next = window.advancedComponentPlacement.findSpace(width,height);
      if (!next) {alert('Not enough empty space to convert this component.');gateContextMenu.style.display='none';return;}
      proposed = next;
    }
    const before = typeof captureCircuitState === 'function' ? captureCircuitState() : null;
    attached.forEach(w => {
      if (typeof deleteWireConnection === 'function') deleteWireConnection(w);
      else {const index=connections.indexOf(w);if(index>=0)connections.splice(index,1);w.line?.remove();}
    });
    gate.style.left=`${proposed.x}px`;
    gate.style.top=`${proposed.y}px`;
    draw(gate,newType,size,false);
    if (typeof updateWires === 'function') updateWires();
    if (before && typeof recordCircuitChange === 'function') recordCircuitChange(before);
    gateContextMenu.style.display='none';
  });
  const decoderEnable = document.getElementById('toggleMuxEnable');
  if (decoderEnable) decoderEnable.addEventListener('click', () => {
    const gate = typeof selectedGate !== 'undefined' ? selectedGate : null;
    if (!gate || gate.dataset.type !== 'DECODER') return;
    const size = Number(gate.dataset.codecSize);
    const oldEnabled = gate.dataset.enable === '1';
    const nextEnabled = !oldEnabled;
    const {width, height} = dimensions('DECODER', size, nextEnabled);
    const previous = {x:parseFloat(gate.style.left)||0,y:parseFloat(gate.style.top)||0,width,height};
    let place = previous;
    if (place.x+width > drawingArea.clientWidth || place.y+height > drawingArea.clientHeight ||
        !window.advancedComponentPlacement.isFree(place,new Set([gate]),4)) {
      place=window.advancedComponentPlacement.findSpace(width,height);
      if(!place) {alert('No free space is available to change Enable.');gateContextMenu.style.display='none';return;}
    }
    const enableIndex=Math.log2(size);
    const removed=oldEnabled?connections.filter(w=>w.toGate===gate&&Number(w.inputIndex)===enableIndex):[];
    if(removed.length&&!confirm('Remove Enable? The wire connected to E will be disconnected.')) {
      gateContextMenu.style.display='none';return;
    }
    const before=typeof captureCircuitState==='function'?captureCircuitState():null;
    for(const w of removed) {
      if(typeof deleteWireConnection==='function')deleteWireConnection(w);
      else {const i=connections.indexOf(w);if(i>=0)connections.splice(i,1);w.line?.remove();}
    }
    gate.style.left=`${place.x}px`;gate.style.top=`${place.y}px`;
    draw(gate,'DECODER',size,nextEnabled);
    if(typeof updateWires==='function')updateWires();
    if(before&&typeof recordCircuitChange==='function')recordCircuitChange(before);
    gateContextMenu.style.display='none';
  });

})();
