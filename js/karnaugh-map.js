// Karnaugh map uses the exact truth-table simulation results; no parallel gate evaluation.
(() => {
  'use strict';
  const truthPanel = document.querySelector('.truth-table-panel');
  if (!truthPanel || document.getElementById('kmap-layout')) return;
  const layout = document.createElement('div');
  layout.id = 'kmap-layout';
  layout.className = 'logic-analysis-grid';
  truthPanel.parentNode.insertBefore(layout, truthPanel);
  layout.append(truthPanel);

  const panel = document.createElement('section');
  panel.className = 'kmap-panel';
  panel.setAttribute('aria-label', 'Karnaugh Map');
  panel.innerHTML = `<h3>Karnaugh Map (K-Map)</h3>
    <div class="kmap-controls"><label for="kmap-output">Output:</label><select id="kmap-output" aria-label="Select output for Karnaugh map"></select><label for="kmap-orientation">Orientation:</label><select id="kmap-orientation" aria-label="Karnaugh map orientation"><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></div>
    <div class="kmap-content" aria-live="polite"></div>
    <p class="kmap-note">Gray-code ordering. Groups may wrap across opposite edges.</p>`;
  layout.append(panel);
  const select = panel.querySelector('#kmap-output');
  const orientationSelect = panel.querySelector('#kmap-orientation');
  const content = panel.querySelector('.kmap-content');
  let model = null;

  const styles = document.createElement('style');
  styles.textContent = `
    .logic-analysis-grid {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;margin-top:18px;align-items:stretch;}
    .logic-analysis-grid .truth-table-panel {margin-top:0;min-width:0;}
    .kmap-panel {display:flex;flex-direction:column;min-width:0;padding:16px 20px;border:1px solid #00bfff;border-radius:10px;background:#08152b;box-shadow:0 0 10px rgba(0,191,255,.16);color:#f1f7ff;text-align:center;}
    .kmap-panel h3 {margin:0 0 12px;text-align:center;color:#58c7ff;font-size:19px;}
    .kmap-controls {display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:10px;margin:0 0 14px;color:#b9d6ed;font-size:13px;}
    .kmap-controls select {color:#f1f7ff;background:#10345a;border:1px solid #28719e;border-radius:5px;padding:5px 10px;max-width:60%;}
    .kmap-content {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;}
    .kmap-mode-column {min-width:0;border:1px solid #245b80;border-radius:8px;padding:14px 10px;background:#07142a;}
    .kmap-mode-column h4 {margin:0 0 12px;color:#58c7ff;font-size:16px;text-align:center;}
    .kmap-mode-column[data-kind="POS"] h4{color:#ffd66c;}
    .kmap-table-wrap {max-width:100%;overflow:auto;display:flex;justify-content:safe center;}
    /* Equal square cells for corner, Gray-code headers, and all 0/1 cells. */
    .kmap-content .kmap-table {table-layout:fixed;font-size:14px;}
    .kmap-content .kmap-table th,.kmap-content .kmap-table td {box-sizing:border-box;width:58px;min-width:58px;max-width:58px;height:58px;min-height:58px;padding:0 3px;font-size:14px;vertical-align:middle;}
    .kmap-content .kmap-table th:first-child {width:58px;min-width:58px;max-width:58px;}
    .kmap-mode-column .kmap-result{font-size:14px;margin-top:14px;}
    .kmap-mode-column .kmap-result strong{font-size:14px;margin-bottom:7px;}
    .kmap-mode-column .kmap-equation{font-size:17px;gap:5px;}
    .kmap-mode-column .kmap-steps{font-size:13px;max-width:100%;}
    .kmap-mode-column .kmap-step{padding:10px;margin:7px 0;}
    .kmap-mode-column .kmap-step-detail{font-size:12px;}
    .kmap-mode-column .kmap-step .kmap-term{font-size:15px;}
    @media (max-width:1250px){.kmap-content{grid-template-columns:1fr;}}
    @media (max-width:850px){.kmap-content{grid-template-columns:repeat(2,minmax(0,1fr));}}
    @media (max-width:540px){.kmap-content{grid-template-columns:1fr;}}
    .kmap-table-stage {position:relative;display:inline-block;margin:0 auto;isolation:isolate;}
    .kmap-group-overlay {position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;overflow:visible;}
    .kmap-group-outline {stroke-width:3;stroke-linejoin:round;transition:fill-opacity .16s ease,stroke-width .16s ease,filter .16s ease;}
    .kmap-group-outline.kmap-outline-highlight {stroke-width:4;filter:drop-shadow(0 0 5px currentColor);fill-opacity:.23;}
    .kmap-table {border-collapse:collapse;font:15px/1.4 Consolas,'Courier New',monospace;margin:0 auto;}
    .kmap-table th,.kmap-table td {border:1px solid #23567e;text-align:center;min-width:52px;height:43px;padding:5px 10px;white-space:nowrap;}
    .kmap-table th {background:#10345a;color:#58c7ff;}
    .kmap-table td {background:#061127;color:#f1f7ff;font-weight:bold;}
    .kmap-table td.kmap-one {color:#39ff14;}
    .kmap-table td.kmap-unknown {color:#ffb65c;}
    .kmap-table td.kmap-group {background:#08182d;}
    .kmap-table td.kmap-group[data-groups] {transition:filter .15s ease;}
    .kmap-table td.kmap-highlight {filter:brightness(1.65);outline:2px solid #fff;outline-offset:-3px;}
    .kmap-steps {margin:14px auto 0;max-width:460px;text-align:left;color:#c7e3fb;font-size:12px;line-height:1.6;}
    .kmap-steps-heading {text-align:center;color:#58c7ff;font-size:13px;font-weight:700;margin:0 0 8px;}
    .kmap-step {padding:8px 10px;margin:6px 0;border:1px solid #23567e;border-left:4px solid var(--step-color);border-radius:6px;background:#0b213d;cursor:default;}
    .kmap-step-label {color:var(--step-color);font-weight:bold;margin-right:6px;}
    .kmap-step .kmap-term {color:#f5faff;font:600 15px/1.7 Consolas,'Courier New',monospace;vertical-align:middle;}
    .kmap-step-detail {display:block;margin-top:4px;color:#a9c2dc;}
    .kmap-step:focus-visible {outline:2px solid #f5faff;outline-offset:2px;}
    .kmap-constant-step {text-align:center;color:#a9c2dc;font-size:12px;margin-top:10px;}
    .kmap-result {color:#e0f0ff;font-size:14px;margin-top:16px;overflow-wrap:anywhere;}
    .kmap-result strong {color:#58c7ff;display:block;margin-bottom:10px;font-size:14px;}
    .kmap-equation {display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:7px;min-height:36px;font:600 19px/1.8 Consolas,'Courier New',monospace;color:#f5faff;}
    .kmap-term {display:inline-flex;align-items:center;gap:2px;white-space:nowrap;}
    .kmap-negated {display:inline-block;border-top:2px solid #f5faff;padding-top:1px;line-height:1.1;vertical-align:middle;}
    .kmap-operator {color:#58c7ff;padding:0 2px;}
    .kmap-output-name {color:#39ff14;}

    .kmap-msg {color:#a9bacb;margin:25px auto;max-width:380px;font-size:13px;}
    .kmap-note {margin:auto 0 0;padding-top:12px;font-size:12px;color:#8fa9c7;}
    @media (max-width:850px) {.logic-analysis-grid {grid-template-columns:minmax(0,1fr);} }
  `;
  document.head.append(styles);

  const sopColors = ['#5bfb4a','#f26be9','#3ddad8','#ffb84d','#dce364','#62b4ff'];
  const posColors = ['#ffda44','#ff963e','#a790ff','#ff6d83','#67e7fd','#c5ff7b'];
  function groupColor(kind, index) {
    const colors = kind === 'SOP' ? sopColors : posColors;
    if (index < colors.length) return colors[index];
    // Stable palette expansion: distribute further hues with the golden angle.
    const hue = (kind === 'SOP' ? 122 : 43) + (index - colors.length + 1) * 137.508;
    return `hsl(${hue % 360} 88% 67%)`;
  }
  window.__logicKMapGroupColor = groupColor;
  const bitString = (n, digits) => n.toString(2).padStart(digits, '0');
  function gray(digits) {
    return Array.from({length:2 ** digits}, (_, index) => bitString(index ^ (index >> 1), digits));
  }
  function simplify(bits, labels) {
    const n = labels.length;
    const ones = bits.map((v, i) => v === 1 ? i : -1).filter(i => i >= 0);
    if (!ones.length) return {expression:'0', selected:[]};
    if (ones.length === 2 ** n) return {expression:'1', selected:[]};
    // Enumerate all implicants (0, 1, or don't-care for each variable).
    const possible = [];
    for (let code = 0; code < 3 ** n; code++) {
      let tmp = code, pattern = [];
      for (let k = 0; k < n; k++) { pattern.unshift(tmp % 3); tmp = Math.floor(tmp / 3); }
      const cells = bits.map((_, i) => i).filter(i => pattern.every((p, k) => p === 2 || Number(bitString(i,n)[k]) === p));
      if (cells.length && cells.every(i => bits[i] === 1) && cells.some(i => ones.includes(i)))
        possible.push({pattern,cells,literals:pattern.filter(p => p !== 2).length});
    }
    // Keep prime implicants only.
    const primes = possible.filter(a => !possible.some(b => b !== a && b.cells.length > a.cells.length && a.cells.every(i => b.cells.includes(i))));
    let best = null;
    const search = (index, chosen, covered) => {
      if (ones.every(i => covered.has(i))) {
        const cost = [chosen.length, chosen.reduce((sum,item) => sum + item.literals,0)];
        if (!best || cost[0] < best.cost[0] || (cost[0] === best.cost[0] && cost[1] < best.cost[1])) best = {cost, chosen:[...chosen]};
        return;
      }
      if (index >= primes.length || (best && chosen.length >= best.cost[0])) return;
      for (let k = index; k < primes.length; k++) {
        chosen.push(primes[k]);
        search(k+1, chosen, new Set([...covered,...primes[k].cells]));
        chosen.pop();
      }
    };
    search(0,[],new Set());
    const chosen = best?.chosen || [];
    const terms = chosen.map(g => g.pattern.map((p,i) => p === 2 ? '' : p === 1 ? labels[i] : `${labels[i]}'`).join('·') || '1');
    return {expression:terms.join(' + '),selected:chosen};
  }
  // Share the same exact group identities, ordering, and cells with SOP/POS tables.
  window.__logicKMapGetGroups = function(outputIndex, kind='SOP') {
    if (!model || !Array.isArray(model.inputs) || model.inputs.length < 2 || model.inputs.length > 4) return null;
    const index = Number(outputIndex);
    if (!Number.isInteger(index) || index < 0 || index >= model.outputs.length) return null;
    const bits = model.rows.map(row => row.outputs[index]);
    if (bits.some(bit => bit !== 0 && bit !== 1)) return null;
    const target = kind === 'POS' ? bits.map(bit => 1-bit) : bits;
    return simplify(target, model.inputs).selected.map(group => ({
      pattern: group.pattern.map(value => value === 2 ? '-' : String(value)).join(''),
      cells: group.cells.slice().sort((a,b) => a-b)
    }));
  };
  // Draw smooth, joined contours around each logical Karnaugh group. A wrapping
  // group produces one rounded contour on each visible edge of the map.
  function drawGroupOutlines(stage, table, groups, columns, kind) {
    stage.querySelector('.kmap-group-overlay')?.remove();
    const cells = [...table.querySelectorAll('tbody td[data-minterm]')];
    const positions = new Map();
    cells.forEach((cell, index) => positions.set(Number(cell.dataset.minterm), {
      row: Math.floor(index / columns), col: index % columns, cell
    }));
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.classList.add('kmap-group-overlay');
    svg.setAttribute('aria-hidden', 'true');
    const stageRect = stage.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${stageRect.width} ${stageRect.height}`);
    groups.forEach((group, groupIndex) => {
      const remaining = new Set(group.cells);
      while (remaining.size) {
        // Connected components in the drawn rectangular grid; opposite-edge
        // adjacency is deliberately split visually, never logically.
        const first = remaining.values().next().value;
        const queue = [first], component = [];
        remaining.delete(first);
        while (queue.length) {
          const id = queue.shift();
          const pos = positions.get(id);
          if (!pos) continue;
          component.push(pos);
          for (const neighbor of [...remaining]) {
            const other = positions.get(neighbor);
            if (other && Math.abs(other.row-pos.row) + Math.abs(other.col-pos.col) === 1) {
              remaining.delete(neighbor);
              queue.push(neighbor);
            }
          }
        }
        if (!component.length) continue;
        const minRow = Math.min(...component.map(c => c.row));
        const maxRow = Math.max(...component.map(c => c.row));
        const minCol = Math.min(...component.map(c => c.col));
        const maxCol = Math.max(...component.map(c => c.col));
        const topLeft = component.find(c => c.row===minRow && c.col===minCol)?.cell;
        const bottomRight = component.find(c => c.row===maxRow && c.col===maxCol)?.cell;
        if (!topLeft || !bottomRight) continue;
        const a=topLeft.getBoundingClientRect(), b=bottomRight.getBoundingClientRect();
        const inset=3;
        const x=a.left-stageRect.left+inset, y=a.top-stageRect.top+inset;
        const width=b.right-a.left-inset*2, height=b.bottom-a.top-inset*2;
        const rect=document.createElementNS(svgNS,'rect');
        rect.setAttribute('x', x); rect.setAttribute('y', y);
        rect.setAttribute('width', Math.max(1,width)); rect.setAttribute('height', Math.max(1,height));
        rect.setAttribute('rx', Math.min(13, height/3));
        rect.setAttribute('fill', groupColor(kind, groupIndex));
        rect.setAttribute('fill-opacity', '.14');
        rect.setAttribute('stroke', groupColor(kind, groupIndex));
        rect.dataset.group=String(groupIndex);
        rect.classList.add('kmap-group-outline');
        svg.append(rect);
      }
    });
    stage.append(svg);
  }
  function message(text) {
    content.replaceChildren();
    const p = document.createElement('p');p.className='kmap-msg';p.textContent=text;content.append(p);
  }
  function literal(name, negative) {
    const node=document.createElement('span');node.textContent=name;
    if(negative)node.className='kmap-negated';
    return node;
  }
  function groupTerm(group, inputs, kind) {
    const term=document.createElement('span');term.className='kmap-term';
    const factors=[...group.pattern].map((value,index)=>({value,label:inputs[index]})).filter(f=>f.value!=='-');
    if(!factors.length){term.textContent=kind==='SOP'?'1':'0';return term;}
    if(kind==='POS')term.append(document.createTextNode('('));
    factors.forEach((factor,index)=>{
      if(index){const op=document.createElement('span');op.className='kmap-operator';op.textContent=kind==='SOP'?'·':'+';term.append(op);}
      term.append(literal(factor.label,kind==='SOP'?factor.value==='0':factor.value==='1'));
    });
    if(kind==='POS')term.append(document.createTextNode(')'));
    return term;
  }
  function renderMap(kind, inputs, outputs, rows, outIndex, orientation) {
    const section=document.createElement('section');section.className='kmap-mode-column';section.dataset.kind=kind;
    const title=document.createElement('h4');title.textContent=kind==='SOP'?'SOP — Group 1s':'POS — Group 0s';section.append(title);
    const n=inputs.length, bits=rows.map(row=>row.outputs[outIndex]);
    const hasUnknown=bits.some(v=>v!==0&&v!==1);
    const target=kind==='POS'?bits.map(v=>v===null?null:1-v):bits;
    const minimized=hasUnknown?null:simplify(target,inputs);
    const isVertical=orientation==='vertical';
    const rowDigits=isVertical?Math.ceil(n/2):Math.floor(n/2);
    const colDigits=n-rowDigits;
    const rowIndices=isVertical?inputs.map((_,i)=>i).slice(colDigits):inputs.map((_,i)=>i).slice(0,rowDigits);
    const colIndices=isVertical?inputs.map((_,i)=>i).slice(0,colDigits):inputs.map((_,i)=>i).slice(rowDigits);
    const rGray=gray(rowDigits),cGray=gray(colDigits);
    const wrap=document.createElement('div');wrap.className='kmap-table-wrap';
    const stage=document.createElement('div');stage.className='kmap-table-stage';
    const table=document.createElement('table');table.className='kmap-table';
    // Exactly one 58px square per column, including the row-label column.
    table.style.width=`${(cGray.length+1)*58}px`;
    const thead=document.createElement('thead'),head=document.createElement('tr');
    const corner=document.createElement('th');corner.textContent=`${rowIndices.map(i=>inputs[i]).join('')} \\ ${colIndices.map(i=>inputs[i]).join('')}`;head.append(corner);
    for(const col of cGray){const th=document.createElement('th');th.textContent=col;head.append(th);}
    thead.append(head);table.append(thead);
    const body=document.createElement('tbody');
    for(const row of rGray){
      const tr=document.createElement('tr');const th=document.createElement('th');th.textContent=row;tr.append(th);
      for(const col of cGray){
        const indexBits=Array(n);
        rowIndices.forEach((i,j)=>{indexBits[i]=row[j];});
        colIndices.forEach((i,j)=>{indexBits[i]=col[j];});
        const index=parseInt(indexBits.join(''),2), bit=bits[index];
        const td=document.createElement('td');td.dataset.minterm=String(index);
        td.textContent=bit===null?'–':String(bit);
        if(bit===1)td.classList.add('kmap-one');
        if(bit===null)td.classList.add('kmap-unknown');
        if(minimized?.selected.length){
          const memberGroups=minimized.selected.map((g,i)=>g.cells.includes(index)?i:-1).filter(i=>i>=0);
          if(memberGroups.length){td.classList.add('kmap-group');td.dataset.groups=memberGroups.join(',');}
        }
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(body);stage.append(table);wrap.append(stage);section.append(wrap);
    if(minimized?.selected.length){requestAnimationFrame(()=>drawGroupOutlines(stage,table,minimized.selected,cGray.length,kind));}
    const note=document.createElement('div');note.className='kmap-result';
    const label=document.createElement('strong');label.textContent=kind==='SOP'?'Simplified SOP:':'Simplified POS:';note.append(label);
    if(hasUnknown){note.append(document.createTextNode('Unavailable while outputs contain unknown (–) values.'));section.append(note);return section;}
    const equation=document.createElement('div');equation.className='kmap-equation';
    const output=document.createElement('span');output.className='kmap-output-name';output.textContent=outputs[outIndex];equation.append(output,document.createTextNode(' = '));
    if(!minimized.selected.length){
      const value=document.createElement('span');value.textContent=kind==='SOP'?(target.every(v=>v===1)?'1':'0'):(target.every(v=>v===1)?'0':'1');equation.append(value);
    }else{
      minimized.selected.forEach((g,i)=>{
        if(i){const op=document.createElement('span');op.className='kmap-operator';op.textContent=kind==='SOP'?'+':'·';equation.append(op);}
        const term=groupTerm({pattern:g.pattern.map(p=>p===2?'-':String(p)).join('')},inputs,kind);
        term.style.color=groupColor(kind,i);equation.append(term);
      });
    }
    note.append(equation);
    const steps=document.createElement('div');steps.className='kmap-steps';
    const heading=document.createElement('div');heading.className='kmap-steps-heading';heading.textContent=kind==='SOP'?'SOP Grouping Steps':'POS Zero-Cell Grouping Steps';steps.append(heading);
    if(!minimized.selected.length){const p=document.createElement('div');p.className='kmap-constant-step';p.textContent='Constant output: no grouping required.';steps.append(p);}
    minimized.selected.forEach((g,i)=>{
      const step=document.createElement('div');step.className='kmap-step';step.tabIndex=0;
      step.style.setProperty('--step-color',groupColor(kind,i));
      const groupLabel=document.createElement('span');groupLabel.className='kmap-step-label';groupLabel.textContent=(kind==='SOP'?'Group ':'Zero Group ')+(i+1)+':';
      step.append(groupLabel,groupTerm({pattern:g.pattern.map(p=>p===2?'-':String(p)).join('')},inputs,kind));
      const detail=document.createElement('span');detail.className='kmap-step-detail';
      detail.textContent=`${g.cells.length} cell${g.cells.length===1?'':'s'} (${g.cells.slice().sort((a,b)=>a-b).map(v=>(kind==='SOP'?'m':'M')+v).join(', ')})`;
      step.append(detail);
      const highlight=active=>{
        section.querySelectorAll('.kmap-table td[data-groups]').forEach(td=>td.classList.toggle('kmap-highlight',active&&td.dataset.groups.split(',').includes(String(i))));
        section.querySelectorAll('.kmap-group-outline').forEach(outline=>outline.classList.toggle('kmap-outline-highlight',active&&outline.dataset.group===String(i)));
      };
      step.addEventListener('mouseenter',()=>highlight(true));step.addEventListener('mouseleave',()=>highlight(false));
      step.addEventListener('focus',()=>highlight(true));step.addEventListener('blur',()=>highlight(false));
      step.addEventListener('click',()=>{const selected=step.classList.toggle('kmap-selected');highlight(selected);});
      steps.append(step);
    });
    note.append(steps);section.append(note);return section;
  }
  function render() {
    if(!model){select.replaceChildren();select.disabled=true;message('Connect an output to display its Karnaugh map.');return;}
    const {inputs,outputs,rows}=model,prior=select.value;
    select.replaceChildren();outputs.forEach((name,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=name;select.append(option);});
    select.value=outputs.some((_,i)=>String(i)===prior)?prior:'0';select.disabled=false;
    if(inputs.length<2||inputs.length>4){message('K-Map supports 2 to 4 connected inputs.');return;}
    const idx=Number(select.value);
    content.replaceChildren(renderMap('SOP',inputs,outputs,rows,idx,orientationSelect.value),renderMap('POS',inputs,outputs,rows,idx,orientationSelect.value));
  }
  document.addEventListener('logic-truth-updated', e => {model=e.detail;render();});
  select.addEventListener('change',render);
  orientationSelect.addEventListener('change',render);
  model=window.__logicTruthData || null;
  render();
})();
