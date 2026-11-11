// TIMING DIAGRAM — load after truth-table.js.
// Visualizes the combinations in the Truth Table as evenly spaced logic steps.
(() => {
  'use strict';
  const truthPanel = document.querySelector('.truth-table-panel');
  if (!truthPanel) {
    console.warn('Timing Diagram: Truth Table panel was not found.');
    return;
  }
  const parent = truthPanel.parentElement;
  const panel = document.createElement('section');
  panel.className = 'timing-diagram-panel';
  panel.setAttribute('aria-label', 'Timing Diagram');
  panel.innerHTML = `<h3>Timing Diagram</h3><div class="timing-diagram-body"></div><p class="timing-diagram-note">Each interval represents one input combination from the Truth Table (illustrative logic steps, not propagation delays).</p>`;
  truthPanel.insertAdjacentElement('afterend', panel);
  const body = panel.querySelector('.timing-diagram-body');
  const style = document.createElement('style');
  style.textContent = `
    .timing-diagram-panel {margin-top:18px;padding:16px 20px;border:1px solid #00bfff;border-radius:10px;background:#08152b;box-shadow:0 0 10px rgba(0,191,255,.16)}
    .timing-diagram-panel h3 {margin:0 0 14px;text-align:center;color:#58c7ff;font-size:19px}
    .timing-diagram-scroll {max-width:100%;overflow-x:auto;border:1px solid #174973;border-radius:8px;background:#051023}
    .timing-diagram-svg {display:block;font:13px Consolas,'Courier New',monospace}
    .timing-diagram-msg {color:#a9bacb;text-align:center;margin:14px 0}
    .timing-diagram-note {color:#8fa9c7;font-size:12px;margin:10px 0 0}
  `;
  document.head.appendChild(style);
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, text) => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key,value]) => node.setAttribute(key, String(value)));
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  let raf = 0;
  function draw() {
    raf = 0;
    body.replaceChildren();
    const table = truthPanel.querySelector('.truth-table');
    if (!table) {
      const note = truthPanel.querySelector('.truth-table-msg')?.textContent || 'Create and connect a circuit output to display its timing diagram.';
      const p = document.createElement('p');
      p.className = 'timing-diagram-msg';
      p.textContent = note;
      body.append(p);
      return;
    }
    const names = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
    const rows = [...table.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()));
    if (!names.length || !rows.length) return;
    const left = 102, step = 54, top = 38, laneHeight = 62, high = 12, low = 40;
    const width = left + rows.length * step + 24;
    const height = top + names.length * laneHeight + 15;
    const svg = el('svg', {xmlns:ns,viewBox:`0 0 ${width} ${height}`,width,height,class:'timing-diagram-svg',role:'img','aria-label':'Logic waveforms for the truth table combinations'});
    svg.append(el('rect',{x:0,y:0,width,height,fill:'#051023'}));
    for (let i=0;i<=rows.length;i++) {
      const x = left + i*step;
      svg.append(el('line',{x1:x,y1:24,x2:x,y2:height-12,stroke:'#173451','stroke-width':1}));
      if(i<rows.length) svg.append(el('text',{x:x+step/2,y:19,fill:'#9eb4d1','text-anchor':'middle','font-size':11},i));
    }
    names.forEach((name,col) => {
      const base = top + col*laneHeight;
      svg.append(el('text',{x:12,y:base+28,fill:'#e5f3ff','font-weight':'bold'},name.length>11?name.slice(0,10)+'…':name));
      svg.append(el('line',{x1:left,y1:base+low,x2:width-24,y2:base+low,stroke:'#16324c','stroke-width':1}));
      let d = '';
      let prev = null;
      let unknown = false;
      rows.forEach((row,i) => {
        const raw = row[col];
        const bit = raw==='1'?1:raw==='0'?0:null;
        const x = left+i*step;
        const y = base+(bit===1?high:bit===0?low:26);
        if(i===0) d+=`M ${x} ${y}`;
        else d+=` L ${x} ${base+(prev===1?high:prev===0?low:26)} L ${x} ${y}`;
        d+=` L ${x+step} ${y}`;
        if(bit===null) {
          unknown=true;
          svg.append(el('text',{x:x+step/2,y:base+24,fill:'#ffb65c','text-anchor':'middle','font-size':12},'?'));
        }
        prev=bit;
      });
      const color = unknown?'#ffb65c':col===names.length-1?'#39ff14':'#00dfff';
      svg.append(el('path',{d,fill:'none',stroke:color,'stroke-width':2.6,'stroke-linejoin':'round'}));
    });
    const scroll = document.createElement('div');
    scroll.className = 'timing-diagram-scroll';
    scroll.append(svg);
    body.append(scroll);
  }
  function schedule(){if(!raf) raf=requestAnimationFrame(draw)}
  const truthContent = truthPanel.querySelector('.truth-table-content');
  if(truthContent) new MutationObserver(schedule).observe(truthContent,{subtree:true,childList:true,characterData:true});
  draw();
})();
